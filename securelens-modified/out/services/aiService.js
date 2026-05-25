"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
// src/services/aiService.ts
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const vscode = __importStar(require("vscode"));
const shareExtesnion_1 = require("./shareExtesnion");
// ── Strip everything outside printable ASCII 0x21–0x7E ──────────────────────
// This catches accidental bullet chars (•), newlines, spaces, tabs — anything
// that would cause Node's http module to throw "invalid character in header".
function sanitizeKey(raw) {
    return raw.replace(/[^\x21-\x7E]/g, '').trim();
}
class AIService {
    constructor() {
        this.context = (0, shareExtesnion_1.getContext)();
        // FIX 1: Extracted getToken as a private class method (arrow-style via property)
        //        so `this.context` is always the class instance — no scoping issues.
        this.getToken = async () => {
            const cfg = vscode.workspace.getConfiguration('safelens');
            let rawToken = cfg.get('backendToken')?.trim();
            if (!rawToken) {
                rawToken = await this.context.secrets.get('safelensApiKey');
            }
            if (!rawToken) {
                throw new Error('SafeLens: API key not configured. Please set your API key in VS Code settings.');
            }
            return rawToken;
        };
        this.hasToken = async () => {
            try {
                const rawToken = await this.getToken();
                return !!rawToken;
            }
            catch {
                return false;
            }
        };
    }
    async getConfig() {
        const cfg = vscode.workspace.getConfiguration('safelens');
        const baseUrl = cfg.get('backendUrl')?.trim().replace(/\/+$/, '') || 'http://localhost:5000/api';
        console.log('Using backend URL:', baseUrl);
        // FIX 2: Removed duplicate `const rawToken` declaration.
        //        Previously rawToken was declared both inside getToken and here.
        const rawToken = await this.getToken();
        const apiKey = sanitizeKey(rawToken);
        console.log('Retrieved API key from secure storage:', apiKey ? '[REDACTED]' : 'null');
        if (!apiKey) {
            throw new Error('SafeLens: API key not configured. Please set your API key in VS Code settings.');
        }
        // Warn in output channel if the raw value had bad chars that were stripped
        if (rawToken !== apiKey) {
            vscode.window.showWarningMessage('SafeLens: your Backend Token contained invalid characters that were stripped automatically. ' +
                'Consider re-pasting the key from the Extension Setup page to avoid issues.');
        }
        return { baseUrl, apiKey };
    }
    // ── Direct Groq call — used when apiKey is a gsk_ Groq Cloud key ───────────
    async callGroqDirect(endpoint, body, apiKey) {
        const GROQ_MODEL = 'llama-3.3-70b-versatile';
        let messages;
        let maxTokens = 1500;
        if (endpoint === 'explain') {
            const { finding } = body;
            const prompt = `You are a security expert. Analyze this Semgrep finding and respond ONLY with valid JSON (no markdown fences, no preamble).

Finding:
- Rule: ${finding.ruleId}
- Severity: ${finding.severity}
- Message: ${finding.message}
- File: ${finding.file}
- Code snippet: ${finding.codeSnippet || 'N/A'}

Respond with ONLY this JSON:
{"brief":"<1-2 sentence tooltip>","detail":"<markdown explanation>","realWorldScenario":"<attack story>","howToFix":"<code fix>","references":["<url>"]}`;
            messages = [{ role: 'user', content: prompt }];
        }
        else if (endpoint === 'summarize') {
            const { findings } = body;
            const rankMap = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
            const sorted = [...findings].sort((a, b) => (rankMap[a.severity] ?? 3) - (rankMap[b.severity] ?? 3));
            const list = sorted.slice(0, 20).map((f, i) => `${i + 1}. [${f.severity}] ${f.ruleId}: ${f.message}`).join('\n');
            const prompt = `Security expert reviewing findings:\n${list}\n\nRespond ONLY with valid JSON:\n{"overallRisk":"HIGH","oneLiner":"<summary>","summary":"<markdown>","mostDangerous":{"ruleId":"<id>","why":"<reason>"},"topThreeFixes":["<fix1>","<fix2>","<fix3>"]}`;
            messages = [{ role: 'user', content: prompt }];
        }
        else {
            // chat
            maxTokens = 2000;
            const { messages: chatMsgs, contextFindings, activeFinding } = body;
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
        const rawText = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.groq.com',
                path: '/openai/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(payload),
                },
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            return reject(new Error(`Groq API error: ${parsed.error.message}`));
                        }
                        const text = parsed?.choices?.[0]?.message?.content ?? '';
                        if (!text)
                            return reject(new Error('Groq returned an empty response.'));
                        resolve(text);
                    }
                    catch {
                        reject(new Error(`Failed to parse Groq response: ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', (err) => reject(new Error(`Cannot reach Groq API: ${err.message}`)));
            req.write(payload);
            req.end();
        });
        // Wrap result in the shape callers expect
        if (endpoint === 'chat') {
            return { message: { role: 'assistant', content: rawText, timestamp: Date.now() } };
        }
        // explain / summarize — parse JSON from AI response
        try {
            const cleaned = rawText.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (endpoint === 'explain') {
                return { explanation: parsed };
            }
            else {
                return { summary: parsed };
            }
        }
        catch {
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
                };
            }
            else {
                return {
                    summary: {
                        overallRisk: 'HIGH',
                        oneLiner: 'See AI summary below.',
                        summary: rawText,
                        mostDangerous: { ruleId: '', why: '' },
                        topThreeFixes: [],
                    }
                };
            }
        }
    }
    async post(path, body) {
        const { baseUrl, apiKey } = await this.getConfig();
        // ── Direct Groq path: skip backend entirely when user has a gsk_ key ──────
        if (apiKey.startsWith('gsk_') || apiKey.startsWith('gsk-')) {
            const endpoint = path.includes('/explain') ? 'explain'
                : path.includes('/summarize') ? 'summarize'
                    : 'chat';
            console.log(`[SafeLens] Calling Groq directly for endpoint: ${endpoint}`);
            return this.callGroqDirect(endpoint, body, apiKey);
        }
        // ── sk- path: call local SafeLens backend ─────────────────────────────────
        const url = new URL(path, baseUrl + '/');
        const payload = JSON.stringify(body);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;
        const options = {
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
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (!parsed.success) {
                            return reject(new Error(parsed.message ?? `Backend error (HTTP ${res.statusCode})`));
                        }
                        resolve(parsed.data);
                    }
                    catch {
                        reject(new Error(`SafeLens: unexpected response — ${data.slice(0, 120)}`));
                    }
                });
            });
            req.on('error', (err) => reject(new Error(`SafeLens: cannot reach backend at ${baseUrl} — ${err.message}`)));
            req.write(payload);
            req.end();
        });
    }
    async explainFinding(finding) {
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
            const result = await this.post('/api/ai/explain', { finding });
            return result.explanation;
        }
        catch (err) {
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
    async summarizeScan(findings) {
        if (findings.length === 0) {
            return '⚠️ Semgrep returned 0 findings.';
        }
        const hasKey = await this.hasToken();
        if (!hasKey) {
            const rank = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
            const sorted = [...findings].sort((a, b) => (rank[a.severity] ?? 3) - (rank[a.severity] ?? 3));
            return JSON.stringify({
                overallRisk: 'MEDIUM',
                oneLiner: `${findings.length} security issues found.`,
                summary: `Found ${findings.length} issues. Configure API Key for AI summaries.`,
                mostDangerous: { ruleId: sorted[0]?.ruleId ?? '', why: sorted[0]?.message ?? '' },
                topThreeFixes: ['Configure SafeLens API Key to generate AI fixes.'],
            });
        }
        try {
            const result = await this.post('/api/ai/summarize', { findings });
            return JSON.stringify(result.summary);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`SafeLens AI: ${msg}`);
            return JSON.stringify({
                overallRisk: 'HIGH',
                oneLiner: `${findings.length} security issues found.`,
                summary: `Found ${findings.length} issues.`,
                mostDangerous: { ruleId: '', why: 'Error reaching AI.' },
                topThreeFixes: [],
            });
        }
    }
    async chat(messages, contextFindings, activeFinding) {
        const hasKey = await this.hasToken();
        if (!hasKey) {
            return '💬 **AI Chat is disabled because no API Key was found.**';
        }
        try {
            const result = await this.post('/api/ai/chat', { messages, contextFindings, activeFinding });
            return result.message.content;
        }
        catch (err) {
            console.log('Error during AI chat:', err);
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`SafeLens AI: ${msg}`);
            throw err;
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=aiService.js.map