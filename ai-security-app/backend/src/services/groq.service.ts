// src/services/groq.service.ts
//
// All Groq API calls are centralised here.
// Controllers call this service — nothing else talks to Groq directly.
//
// Free tier: 30 RPM · 6 000 RPD · 500 K tokens/day on llama-3.3-70b
// Get a free key (no billing): https://console.groq.com/keys

import https from 'https';
import { ExtensionFinding, AIExplanation, AIScanSummary, ChatMessage } from '../types';

const GROQ_HOST  = 'api.groq.com';
const GROQ_PATH  = '/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ─── Core HTTP wrapper ────────────────────────────────────────────────────────
function callGroq(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 1500,
  customApiKey?: string
): Promise<string> {
  const apiKey = customApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set in environment variables.');

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages,
    max_tokens: maxTokens,
    temperature: 0.4,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GROQ_HOST,
        path: GROQ_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              return reject(new Error(
                `Groq API error ${parsed.error.code ?? res.statusCode}: ${parsed.error.message}`
              ));
            }
            const text: string = parsed?.choices?.[0]?.message?.content ?? '';
            if (!text) return reject(new Error('Groq returned an empty response.'));
            resolve(text);
          } catch {
            reject(new Error('Failed to parse Groq response.'));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Helper: parse JSON from AI response safely ───────────────────────────────
function parseJSON<T>(raw: string): T | null {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ─── 1. Explain a single finding ─────────────────────────────────────────────
export async function explainFinding(finding: ExtensionFinding, customApiKey?: string): Promise<AIExplanation> {
  const prompt = `You are a security expert. Analyze this Semgrep finding and respond ONLY with valid JSON (no markdown fences, no preamble, no trailing text).

Finding:
- Rule: ${finding.ruleId}
- Severity: ${finding.severity}
- Message: ${finding.message}
- File: ${finding.file}
- Code snippet: ${finding.codeSnippet || 'N/A'}

Respond with this exact JSON shape:
{
  "brief": "<1-2 sentence simple explanation suitable for a hover tooltip>",
  "detail": "<full markdown explanation of the vulnerability, 3-5 paragraphs>",
  "realWorldScenario": "<a concrete real-world attack story showing how this fails in production, easy to understand for a junior developer>",
  "howToFix": "<markdown code-level fix with before/after example>",
  "references": ["<URL1>", "<URL2>"]
}`;

  const raw = await callGroq([{ role: 'user', content: prompt }], 1500, customApiKey);
  const parsed = parseJSON<AIExplanation>(raw);

  if (parsed) return parsed;

  // Graceful fallback if JSON parse fails
  return {
    brief: finding.message,
    detail: finding.message,
    realWorldScenario: 'Could not generate scenario.',
    howToFix: `Refer to Semgrep documentation for rule: ${finding.ruleId}`,
    references: [`https://semgrep.dev/r/${finding.ruleId}`],
  };
}

// ─── 2. Summarize a full scan ─────────────────────────────────────────────────
export async function summarizeScan(findings: ExtensionFinding[], customApiKey?: string): Promise<AIScanSummary> {
  if (findings.length === 0) {
    return {
      overallRisk: 'LOW',
      oneLiner: 'No findings detected in this scan.',
      summary: 'Semgrep returned 0 findings. Rules may not have matched any patterns, or the file type may not be supported.',
      mostDangerous: { ruleId: '', why: 'No findings to analyze.' },
      topThreeFixes: ['Try scanning with a broader ruleset.', 'Verify the file extension is supported.'],
    };
  }

  const severityRank: Record<string, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
  const sorted = [...findings].sort(
    (a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3)
  );

  const list = sorted.slice(0, 30).map((f, i) =>
    `${i + 1}. [${f.severity}] ${f.ruleId}: ${f.message} — ${f.file}:${f.line.start}`
  ).join('\n');

  const prompt = `You are a security expert reviewing code scan results. Here are ALL findings sorted by severity:

${list}
${findings.length > 30 ? `\n(and ${findings.length - 30} more...)` : ''}

Respond ONLY with valid JSON, no markdown fences, no preamble:
{
  "overallRisk": "CRITICAL | HIGH | MEDIUM | LOW",
  "oneLiner": "<one sentence overall assessment>",
  "summary": "<2-3 sentence markdown summary covering the overall risk level and main vulnerability categories found>",
  "mostDangerous": {
    "ruleId": "<rule id of the single most dangerous finding>",
    "why": "<2-3 sentences explaining why this is the most dangerous and what an attacker could do>"
  },
  "topThreeFixes": ["<fix 1 — most urgent>", "<fix 2>", "<fix 3>"]
}`;

  const raw = await callGroq([{ role: 'user', content: prompt }], 1500, customApiKey);
  const parsed = parseJSON<AIScanSummary>(raw);

  if (parsed) return parsed;

  return {
    overallRisk: 'HIGH',
    oneLiner: `${findings.length} security issues found.`,
    summary: `Found ${findings.length} issues including ${findings.filter(f => f.severity === 'ERROR').length} critical errors.`,
    mostDangerous: { ruleId: sorted[0]?.ruleId ?? '', why: sorted[0]?.message ?? '' },
    topThreeFixes: ['Review the ERROR severity findings first.'],
  };
}

// ─── 3. Chat with scan context ────────────────────────────────────────────────
export async function chat(
  messages: ChatMessage[],
  contextFindings: ExtensionFinding[],
  activeFinding: ExtensionFinding | null,
  customApiKey?: string
): Promise<string> {
  const system = `You are SafeLens AI, a friendly and expert security assistant.
You help developers understand and fix security vulnerabilities found by Semgrep.
${contextFindings.length > 0
    ? `Current scan has ${contextFindings.length} finding(s).`
    : 'No active scan results yet.'}
${activeFinding
    ? `The user is currently viewing: [${activeFinding.severity}] ${activeFinding.ruleId} — ${activeFinding.message}`
    : ''}
Keep responses concise, practical, and beginner-friendly. Use markdown for code examples.`;

  const apiMessages = [
    { role: 'system', content: system },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  return callGroq(apiMessages, 2000, customApiKey);
}
