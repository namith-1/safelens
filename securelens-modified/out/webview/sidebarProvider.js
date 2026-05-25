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
exports.SidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const sidebarHTML_1 = require("./sidebarHTML");
class SidebarProvider {
    constructor(extensionUri, aiService, diagnosticsService) {
        this.extensionUri = extensionUri;
        this.aiService = aiService;
        this.diagnosticsService = diagnosticsService;
        this.chatHistory = [];
        this.activeFinding = null;
        this.lastResult = null;
        // lastRawResult = semgrep findings BEFORE custom regex layer, used to re-apply
        // regexes instantly when the user adds/removes a custom rule without full re-scan
        this.lastRawResult = null;
        this.semgrepService = null;
        SidebarProvider.instance = this;
    }
    /** Called from extension.ts after construction so we can use semgrepService */
    setSemgrepService(svc) {
        this.semgrepService = svc;
    }
    /** Called by scan commands to stash the raw (pre-regex) semgrep result */
    setLastRawResult(raw) {
        this.lastRawResult = raw;
    }
    static postToWebview(message) {
        if (this.instance) {
            this.instance.post(message);
        }
    }
    getAIService() { return this.aiService; }
    async sendAuthState() {
        const hasKey = await this.aiService.hasToken();
        this.post({ type: 'authState', payload: { loggedIn: hasKey } });
    }
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = (0, sidebarHTML_1.getSidebarHTML)(webviewView.webview, this.extensionUri);
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        this.sendAuthState();
    }
    // ── After scan: send ALL findings to sidebar, then get AI overview ────────────
    async showScanResult(result) {
        this.lastResult = result;
        this.chatHistory = [];
        // Sort by risk: ERROR first
        const rank = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
        const sorted = [...result.findings].sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
        const sortedResult = { ...result, findings: sorted };
        // Send all findings to webview immediately (squiggles already in editor)
        this.post({ type: 'scanResult', payload: sortedResult });
        // One AI call for the whole scan — overview summary
        if (result.findings.length > 0) {
            try {
                this.post({ type: 'summaryLoading' });
                const rawJson = await this.aiService.summarizeScan(result.findings);
                try {
                    this.post({ type: 'summaryStructured', payload: JSON.parse(rawJson) });
                }
                catch {
                    this.post({ type: 'summary', payload: rawJson });
                }
            }
            catch (err) {
                this.post({ type: 'summaryError', payload: err instanceof Error ? err.message : String(err) });
            }
        }
        else {
            this.post({ type: 'summary', payload: '⚠️ SΛFΞLΞNS returned 0 findings. Rules may still be downloading — try scanning again.' });
        }
    }
    // ── Called from hover "Open Full AI Details" click ────────────────────────────
    openFinding(finding) {
        this.activeFinding = finding;
        this.post({ type: 'openFinding', payload: finding.id });
        this.fetchExplanation(finding);
    }
    // ── Called when cursor moves onto a squiggle line (no AI, just highlight) ─────
    highlightFinding(finding) {
        this.post({ type: 'highlightFinding', payload: finding.id });
    }
    showScanLoading(targetPath, type) {
        this.post({ type: 'scanLoading', payload: { path: targetPath, type } });
    }
    showError(message) { this.post({ type: 'error', payload: message }); }
    showCleared() {
        this.lastResult = null;
        this.chatHistory = [];
        this.activeFinding = null;
        this.post({ type: 'cleared' });
    }
    // ── Fetch AI explanation for a finding ────────────────────────────────────────
    async fetchExplanation(finding) {
        try {
            this.post({ type: 'explanationLoading', payload: finding.id });
            const explanation = await this.aiService.explainFinding(finding);
            // Cache brief for hover tooltip
            this.diagnosticsService.setBrief(finding.id, explanation.brief);
            this.post({ type: 'explanation', payload: { findingId: finding.id, explanation } });
        }
        catch (err) {
            this.post({ type: 'explanationError', payload: err instanceof Error ? err.message : String(err) });
        }
    }
    // ── Webview → extension messages ─────────────────────────────────────────────
    async handleMessage(msg) {
        switch (msg.type) {
            case 'setApiKey': {
                vscode.commands.executeCommand('safelens.setApiKey');
                break;
            }
            case 'openLoginPage': {
                const cfg = vscode.workspace.getConfiguration('safelens');
                // Derive frontend URL from backendUrl: strip /api suffix, swap port 5000→5173 for localhost
                let frontendUrl = cfg.get('frontendUrl')?.trim();
                if (!frontendUrl) {
                    const backendUrl = cfg.get('backendUrl')?.trim() || 'http://localhost:5000/api';
                    frontendUrl = backendUrl
                        .replace(/\/api\/?$/, '') // remove trailing /api
                        .replace(':5000', ':5173'); // swap local backend port to frontend port
                }
                // Always open the /login route
                const loginUrl = frontendUrl.replace(/\/$/, '') + '/login';
                vscode.env.openExternal(vscode.Uri.parse(loginUrl));
                break;
            }
            case 'getRegexes': {
                const config = vscode.workspace.getConfiguration('safelens');
                const customVuls = config.get('customRegexVulnerabilities', []);
                const customIgnores = config.get('customRegexIgnores', []);
                this.post({ type: 'sendRegexes', payload: { customVuls, customIgnores } });
                break;
            }
            case 'saveRegexes': {
                const { customVuls, customIgnores } = msg.payload;
                const config = vscode.workspace.getConfiguration('safelens');
                await config.update('customRegexVulnerabilities', customVuls, vscode.ConfigurationTarget.Global);
                await config.update('customRegexIgnores', customIgnores, vscode.ConfigurationTarget.Global);
                // Re-apply custom regex layer on the cached semgrep result instantly —
                // no need for a full semgrep re-scan, just re-run the regex pass.
                const rawBase = this.lastRawResult ?? this.lastResult;
                if (rawBase && this.semgrepService) {
                    try {
                        const updated = this.semgrepService.applyCustomRegexes(rawBase, rawBase.meta.target);
                        this.diagnosticsService.applyFindings(updated);
                        await this.showScanResult(updated);
                        this.post({ type: 'toast', payload: `✅ Custom rules applied — ${updated.summary.totalFindings} finding(s) total.` });
                    }
                    catch (e) {
                        console.error('SafeLens: failed to re-apply custom regexes', e);
                    }
                }
                break;
            }
            case 'generateRegex': {
                const { prompt, ruleType } = msg.payload;
                const hasKey = await this.aiService.hasToken();
                if (!hasKey) {
                    this.post({ type: 'regexGeneratedError', payload: 'Sign-in/API Key required.' });
                    break;
                }
                try {
                    const aiResponse = await this.aiService.chat([
                        {
                            role: 'user',
                            content: `Generate a regular expression for the following scenario: "${prompt}". Respond with ONLY a raw JSON object (no markdown, no backticks, no code fences) with EXACTLY two fields: "regex" (the regex pattern as a string) and "description" (a brief explanation of what it does). Example format: {"regex": "test", "description": "matches test"}.`,
                            timestamp: Date.now()
                        }
                    ], [], null);
                    // Clean markdown code blocks from response if AI included them anyway
                    let cleaned = aiResponse.trim();
                    if (cleaned.startsWith('```json')) {
                        cleaned = cleaned.slice(7);
                    }
                    else if (cleaned.startsWith('```')) {
                        cleaned = cleaned.slice(3);
                    }
                    if (cleaned.endsWith('```')) {
                        cleaned = cleaned.slice(0, -3);
                    }
                    cleaned = cleaned.trim();
                    let parsed;
                    try {
                        parsed = JSON.parse(cleaned);
                    }
                    catch {
                        parsed = {
                            regex: cleaned,
                            description: 'AI generated pattern'
                        };
                    }
                    this.post({
                        type: 'regexGenerated',
                        payload: {
                            regex: parsed.regex,
                            description: parsed.description,
                            ruleType
                        }
                    });
                }
                catch (err) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    this.post({ type: 'regexGeneratedError', payload: errMsg });
                }
                break;
            }
            // User clicked a finding in the sidebar list → jump editor + fetch AI
            case 'selectFinding': {
                const id = msg.payload;
                const finding = this.lastResult?.findings.find(f => f.id === id) ?? null;
                if (!finding) {
                    return;
                }
                this.activeFinding = finding;
                this.jumpToLocation(finding.file, finding.line.start);
                this.fetchExplanation(finding);
                break;
            }
            case 'scanFile':
                vscode.commands.executeCommand('safelens.scanFile');
                break;
            case 'scanFolder':
                vscode.commands.executeCommand('safelens.scanFolder');
                break;
            case 'clear':
                vscode.commands.executeCommand('safelens.clearDiagnostics');
                break;
            case 'jumpToFinding': {
                const f = this.lastResult?.findings.find(x => x.id === msg.payload) ?? null;
                if (f) {
                    this.jumpToLocation(f.file, f.line.start);
                }
                break;
            }
            case 'jumpToCrash': {
                const payload = msg.payload;
                this.jumpToLocation(payload.file, payload.line);
                break;
            }
            case 'triggerCopilot': {
                const payload = msg.payload;
                await vscode.env.clipboard.writeText(payload.prompt);
                await vscode.commands.executeCommand('workbench.action.chat.open');
                vscode.window.showInformationMessage('SafeLens: Copilot Chat opened. Prompt copied to clipboard! Paste it to run the fix.');
                break;
            }
            case 'triggerQuickFix': {
                const payload = msg.payload;
                await this.jumpToLocation(payload.file, payload.line);
                await vscode.commands.executeCommand('editor.action.quickFix');
                break;
            }
            case 'chat': {
                const userText = msg.payload;
                const hasKey = await this.aiService.hasToken();
                if (!hasKey) {
                    this.post({ type: 'chatError', payload: 'Sign-in/API Key required.' });
                    break;
                }
                const userMsg = { role: 'user', content: userText, timestamp: Date.now() };
                this.chatHistory.push(userMsg);
                this.post({ type: 'chatTyping' });
                try {
                    const response = await this.aiService.chat(this.chatHistory, this.lastResult?.findings ?? [], this.activeFinding);
                    const aMsg = { role: 'assistant', content: response, timestamp: Date.now() };
                    this.chatHistory.push(aMsg);
                    this.post({ type: 'chatMessage', payload: aMsg });
                }
                catch (err) {
                    this.post({ type: 'chatError', payload: err instanceof Error ? err.message : String(err) });
                }
                break;
            }
        }
    }
    async jumpToLocation(filePath, lineNum) {
        try {
            let targetPath = filePath;
            if (!path.isAbsolute(filePath) && vscode.workspace.workspaceFolders) {
                targetPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
            }
            const uri = vscode.Uri.file(targetPath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const ed = await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
            const line = Math.max(0, lineNum - 1);
            const pos = new vscode.Position(line, 0);
            ed.selection = new vscode.Selection(pos, pos);
            ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
        catch { /* file may not be readable */ }
    }
    post(message) {
        this.view?.webview.postMessage(message);
    }
}
exports.SidebarProvider = SidebarProvider;
SidebarProvider.instance = null;
//# sourceMappingURL=sidebarProvider.js.map