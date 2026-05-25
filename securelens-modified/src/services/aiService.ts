// src/services/aiService.ts
import * as https from 'https';
import * as http  from 'http';
import * as vscode from 'vscode';
import { AIExplanation, ChatMessage, Finding } from '../types';
import { getContext } from './shareExtesnion';

interface AIScanSummary {
  overallRisk: string;
  oneLiner: string;
  summary: string;
  mostDangerous: { ruleId: string; why: string };
  topThreeFixes: string[];
}

// ── Strip everything outside printable ASCII 0x21–0x7E ──────────────────────
// This catches accidental bullet chars (•), newlines, spaces, tabs — anything
// that would cause Node's http module to throw "invalid character in header".
function sanitizeKey(raw: string): string {
  return raw.replace(/[^\x21-\x7E]/g, '').trim();
}

export class AIService {

  private context = getContext();


  // FIX 1: Extracted getToken as a private class method (arrow-style via property)
  //        so `this.context` is always the class instance — no scoping issues.
  public getToken = async (): Promise<string> => {
    const cfg = vscode.workspace.getConfiguration('safelens');
    let rawToken = cfg.get<string>('backendToken')?.trim();

    if (!rawToken) {
      rawToken = await this.context.secrets.get('safelensApiKey');
    }

    if (!rawToken) {
      throw new Error('SafeLens: API key not configured. Please set your API key in VS Code settings.');
    }

    return rawToken;
  };

  public hasToken = async (): Promise<boolean> => {
    try {
      const rawToken = await this.getToken();
      return !!rawToken;
    } catch {
      return false;
    }
  };

  public async getConfig(): Promise<{ baseUrl: string; apiKey: string }> {
    const cfg = vscode.workspace.getConfiguration('safelens');

    const baseUrl = cfg.get<string>('backendUrl')?.trim().replace(/\/+$/, '') || 'http://localhost:5000/api';
    console.log('Using backend URL:', baseUrl);
    
    // FIX 2: Removed duplicate `const rawToken` declaration.
    //        Previously rawToken was declared both inside getToken and here.
    const rawToken = await this.getToken();
    const apiKey   = sanitizeKey(rawToken);

    console.log('Retrieved API key from secure storage:', apiKey ? '[REDACTED]' : 'null');

    if (!apiKey) {
      throw new Error('SafeLens: API key not configured. Please set your API key in VS Code settings.');
    }

    // Warn in output channel if the raw value had bad chars that were stripped
    if (rawToken !== apiKey) {
      vscode.window.showWarningMessage(
        'SafeLens: your Backend Token contained invalid characters that were stripped automatically. ' +
        'Consider re-pasting the key from the Extension Setup page to avoid issues.'
      );
    }

    return { baseUrl, apiKey };
  }

  // ── Direct Groq call — used when apiKey is a gsk_ Groq Cloud key ───────────
  private async callGroqDirect<T>(
    endpoint: 'explain' | 'summarize' | 'chat',
    body: unknown,
    apiKey: string
  ): Promise<T> {
    const GROQ_MODEL = 'llama-3.3-70b-versatile';

    let messages: Array<{ role: string; content: string }>;
    let maxTokens = 1500;

    if (endpoint === 'explain') {
      const { finding } = body as { finding: Finding };
      const prompt = `You are a security expert. Analyze this Semgrep finding and respond ONLY with valid JSON (no markdown fences, no preamble).

Finding:
- Rule: ${finding.ruleId}
- Severity: ${finding.severity}
- Message: ${finding.message}
- File: ${finding.file}
- Code snippet: ${(finding as any).codeSnippet || 'N/A'}

Respond with ONLY this JSON:
{"brief":"<1-2 sentence tooltip>","detail":"<markdown explanation>","realWorldScenario":"<attack story>","howToFix":"<code fix>","references":["<url>"]}`;
      messages = [{ role: 'user', content: prompt }];
    } else if (endpoint === 'summarize') {
      const { findings } = body as { findings: Finding[] };
      const rankMap: Record<string, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
      const sorted = [...findings].sort((a, b) => (rankMap[a.severity] ?? 3) - (rankMap[b.severity] ?? 3));
      const list = sorted.slice(0, 20).map((f, i) =>
        `${i + 1}. [${f.severity}] ${f.ruleId}: ${f.message}`
      ).join('\n');
      const prompt = `Security expert reviewing findings:\n${list}\n\nRespond ONLY with valid JSON:\n{"overallRisk":"HIGH","oneLiner":"<summary>","summary":"<markdown>","mostDangerous":{"ruleId":"<id>","why":"<reason>"},"topThreeFixes":["<fix1>","<fix2>","<fix3>"]}`;
      messages = [{ role: 'user', content: prompt }];
    } else {
      // chat
      maxTokens = 2000;
      const { messages: chatMsgs, contextFindings, activeFinding } = body as {
        messages: ChatMessage[];
        contextFindings: Finding[];
        activeFinding: Finding | null;
      };
      const system = `You are SafeLens AI, an expert security assistant helping developers understand and fix Semgrep security vulnerabilities.\n${contextFindings.length > 0 ? `Current scan: ${contextFindings.length} finding(s).` : ''}\n${activeFinding ? `Active finding: [${activeFinding.severity}] ${activeFinding.ruleId} — ${activeFinding.message}` : ''}\nBe concise and practical. Use markdown for code.`;
      messages = [
        { role: 'system', content: system },
        ...chatMsgs.map(m => ({ role: m.role, content: m.content })),
      ];
    }

    const payload = JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.4,
    });

    const rawText = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.groq.com',
          path: '/openai/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                return reject(new Error(`Groq API error: ${parsed.error.message}`));
              }
              const text: string = parsed?.choices?.[0]?.message?.content ?? '';
              if (!text) return reject(new Error('Groq returned an empty response.'));
              resolve(text);
            } catch {
              reject(new Error(`Failed to parse Groq response: ${data.slice(0, 200)}`));
            }
          });
        }
      );
      req.on('error', (err: Error) => reject(new Error(`Cannot reach Groq API: ${err.message}`)));
      req.write(payload);
      req.end();
    });

    // Wrap result in the shape callers expect
    if (endpoint === 'chat') {
      return { message: { role: 'assistant', content: rawText, timestamp: Date.now() } } as unknown as T;
    }

    // explain / summarize — parse JSON from AI response
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (endpoint === 'explain') {
        return { explanation: parsed } as unknown as T;
      } else {
        return { summary: parsed } as unknown as T;
      }
    } catch {
      // JSON parse failed — return graceful fallback
      if (endpoint === 'explain') {
        return {
          explanation: {
            brief: 'AI analysis complete.',
            detail: rawText,
            realWorldScenario: '',
            howToFix: rawText,
            references: [],
          }
        } as unknown as T;
      } else {
        return {
          summary: {
            overallRisk: 'HIGH',
            oneLiner: 'See AI summary below.',
            summary: rawText,
            mostDangerous: { ruleId: '', why: '' },
            topThreeFixes: [],
          }
        } as unknown as T;
      }
    }
  }

  public async post<T>(path: string, body: unknown): Promise<T> {
    const { baseUrl, apiKey } = await this.getConfig();

    // ── Direct Groq path: skip backend entirely when user has a gsk_ key ──────
    if (apiKey.startsWith('gsk_') || apiKey.startsWith('gsk-')) {
      const endpoint = path.includes('/explain') ? 'explain'
                     : path.includes('/summarize') ? 'summarize'
                     : 'chat';
      console.log(`[SafeLens] Calling Groq directly for endpoint: ${endpoint}`);
      return this.callGroqDirect<T>(endpoint, body, apiKey);
    }

    // ── sk- path: call local SafeLens backend ─────────────────────────────────
    const url = new URL(path, baseUrl + '/');
    const payload = JSON.stringify(body);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    return new Promise((resolve, reject) => {
      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.success) {
              return reject(new Error(parsed.message ?? `Backend error (HTTP ${res.statusCode})`));
            }
            resolve(parsed.data as T);
          } catch {
            reject(new Error(`SafeLens: unexpected response — ${data.slice(0, 120)}`));
          }
        });
      });
      req.on('error', (err: Error) =>
        reject(new Error(`SafeLens: cannot reach backend at ${baseUrl} — ${err.message}`))
      );
      req.write(payload);
      req.end();
    });
  }

  async explainFinding(finding: Finding): Promise<AIExplanation> {
    const hasKey = await this.hasToken();
    if (!hasKey) {
      return {
        brief: finding.message,
        detail: `💡 **AI Explanations require an API Key.**\n\nPlease configure your SafeLens API key to unlock deep AI analysis, attack scenarios, and automatic fixes.`,
        realWorldScenario: 'Attack scenario generation is available with an active API key.',
        howToFix: `Refer to local rule: ${finding.ruleId}`,
        references: [`https://semgrep.dev/r/${finding.ruleId}`],
      };
    }

    try {
      const result = await this.post<{ explanation: AIExplanation }>('/api/ai/explain', { finding });
      return result.explanation;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`SafeLens AI: ${msg}`);
      return {
        brief: finding.message,
        detail: finding.message,
        realWorldScenario: 'Could not reach backend. Check settings.',
        howToFix: `Refer to Semgrep documentation for rule: ${finding.ruleId}`,
        references: [`https://semgrep.dev/r/${finding.ruleId}`],
      };
    }
  }

  async summarizeScan(findings: Finding[]): Promise<string> {
    if (findings.length === 0) {
      return '⚠️ Semgrep returned 0 findings.';
    }

    const hasKey = await this.hasToken();
    if (!hasKey) {
      const rank: Record<string, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
      const sorted = [...findings].sort((a, b) => (rank[a.severity] ?? 3) - (rank[a.severity] ?? 3));
      return JSON.stringify({
        overallRisk:   'MEDIUM',
        oneLiner:      `${findings.length} security issues found.`,
        summary:       `Found ${findings.length} issues. Configure API Key for AI summaries.`,
        mostDangerous: { ruleId: sorted[0]?.ruleId ?? '', why: sorted[0]?.message ?? '' },
        topThreeFixes: ['Configure SafeLens API Key to generate AI fixes.'],
      });
    }

    try {
      const result = await this.post<{ summary: AIScanSummary }>('/api/ai/summarize', { findings });
      return JSON.stringify(result.summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`SafeLens AI: ${msg}`);
      return JSON.stringify({
        overallRisk:   'HIGH',
        oneLiner:      `${findings.length} security issues found.`,
        summary:       `Found ${findings.length} issues.`,
        mostDangerous: { ruleId: '', why: 'Error reaching AI.' },
        topThreeFixes: [],
      });
    }
  }

  async chat(messages: ChatMessage[], contextFindings: Finding[], activeFinding: Finding | null): Promise<string> {
    const hasKey = await this.hasToken();
    if (!hasKey) {
      return '💬 **AI Chat is disabled because no API Key was found.**';
    }

    try {
      const result = await this.post<{ message: { role: string; content: string; timestamp: number } }>(
        '/api/ai/chat', { messages, contextFindings, activeFinding }
      );
      return result.message.content;
    } catch (err: unknown) {
      console.log('Error during AI chat:', err);
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`SafeLens AI: ${msg}`);
      throw err;
    }
  }
}
