import * as vscode from 'vscode';
import * as path from 'path';
import { AIService }          from '../services/aiService';
import { DiagnosticsService } from '../services/diagnosticsService';
import { SemgrepService }     from '../services/semgrepService';
import { Finding, ScanResult, ChatMessage } from '../types';
import { getSidebarHTML }     from './sidebarHTML';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private static instance: SidebarProvider | null = null;
  private view?: vscode.WebviewView;
  private chatHistory: ChatMessage[] = [];
  private activeFinding: Finding | null = null;
  private lastResult: ScanResult | null = null;
  // lastRawResult = semgrep findings BEFORE custom regex layer, used to re-apply
  // regexes instantly when the user adds/removes a custom rule without full re-scan
  private lastRawResult: ScanResult | null = null;
  private semgrepService: SemgrepService | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly aiService: AIService,
    private readonly diagnosticsService: DiagnosticsService
  ) {
    SidebarProvider.instance = this;
  }

  /** Called from extension.ts after construction so we can use semgrepService */
  public setSemgrepService(svc: SemgrepService): void {
    this.semgrepService = svc;
  }

  /** Called by scan commands to stash the raw (pre-regex) semgrep result */
  public setLastRawResult(raw: ScanResult): void {
    this.lastRawResult = raw;
  }

  public static postToWebview(message: Record<string, unknown>): void {
    if (this.instance) {
      this.instance.post(message);
    }
  }

  getAIService(): AIService { return this.aiService; }

  public async sendAuthState(): Promise<void> {
    const hasKey = await this.aiService.hasToken();
    this.post({ type: 'authState', payload: { loggedIn: hasKey } });
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = getSidebarHTML(webviewView.webview, this.extensionUri);
    webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    this.sendAuthState();
  }

  // ── After scan: send ALL findings to sidebar, then get AI overview ────────────
  async showScanResult(result: ScanResult): Promise<void> {
    this.lastResult = result;
    this.chatHistory = [];

    // Sort by risk: ERROR first
    const rank: Record<string, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
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
        } catch {
          this.post({ type: 'summary', payload: rawJson });
        }
      } catch (err: unknown) {
        this.post({ type: 'summaryError', payload: err instanceof Error ? err.message : String(err) });
      }
    } else {
      this.post({ type: 'summary', payload: '⚠️ SΛFΞLΞNS returned 0 findings. Rules may still be downloading — try scanning again.' });
    }
  }

  // ── Called from hover "Open Full AI Details" click ────────────────────────────
  openFinding(finding: Finding): void {
    this.activeFinding = finding;
    this.post({ type: 'openFinding', payload: finding.id });
    this.fetchExplanation(finding);
  }

  // ── Called when cursor moves onto a squiggle line (no AI, just highlight) ─────
  highlightFinding(finding: Finding): void {
    this.post({ type: 'highlightFinding', payload: finding.id });
  }

  showScanLoading(targetPath: string, type: 'file' | 'folder'): void {
    this.post({ type: 'scanLoading', payload: { path: targetPath, type } });
  }

  showError(message: string): void  { this.post({ type: 'error', payload: message }); }
  showCleared(): void {
    this.lastResult = null;
    this.chatHistory = [];
    this.activeFinding = null;
    this.post({ type: 'cleared' });
  }

  // ── Fetch AI explanation for a finding ────────────────────────────────────────
  private async fetchExplanation(finding: Finding): Promise<void> {
    try {
      this.post({ type: 'explanationLoading', payload: finding.id });
      const explanation = await this.aiService.explainFinding(finding);
      // Cache brief for hover tooltip
      this.diagnosticsService.setBrief(finding.id, explanation.brief);
      this.post({ type: 'explanation', payload: { findingId: finding.id, explanation } });
    } catch (err: unknown) {
      this.post({ type: 'explanationError', payload: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── Webview → extension messages ─────────────────────────────────────────────
  private async handleMessage(msg: { type: string; payload?: unknown }): Promise<void> {
    switch (msg.type) {
      case 'setApiKey': {
        vscode.commands.executeCommand('safelens.setApiKey');
        break;
      }

      case 'openLoginPage': {
        const cfg = vscode.workspace.getConfiguration('safelens');
        // Derive frontend URL from backendUrl: strip /api suffix, swap port 5000→5173 for localhost
        let frontendUrl = cfg.get<string>('frontendUrl')?.trim();
        if (!frontendUrl) {
          const backendUrl = cfg.get<string>('backendUrl')?.trim() || 'http://localhost:5000/api';
          frontendUrl = backendUrl
            .replace(/\/api\/?$/, '')          // remove trailing /api
            .replace(':5000', ':5173');          // swap local backend port to frontend port
        }
        // Always open the /login route
        const loginUrl = frontendUrl.replace(/\/$/, '') + '/login';
        vscode.env.openExternal(vscode.Uri.parse(loginUrl));
        break;
      }

      case 'getRegexes': {
        const config = vscode.workspace.getConfiguration('safelens');
        const customVuls = config.get<any[]>('customRegexVulnerabilities', []);
        const customIgnores = config.get<any[]>('customRegexIgnores', []);
        this.post({ type: 'sendRegexes', payload: { customVuls, customIgnores } });
        break;
      }

      case 'saveRegexes': {
        const { customVuls, customIgnores } = msg.payload as { customVuls: any[]; customIgnores: any[] };
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
          } catch (e) {
            console.error('SafeLens: failed to re-apply custom regexes', e);
          }
        }
        break;
      }

      case 'generateRegex': {
        const { prompt, ruleType } = msg.payload as { prompt: string; ruleType: 'vul' | 'ignore' };
        
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
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.slice(3);
          }
          if (cleaned.endsWith('```')) {
            cleaned = cleaned.slice(0, -3);
          }
          cleaned = cleaned.trim();

          let parsed: { regex: string; description: string };
          try {
            parsed = JSON.parse(cleaned);
          } catch {
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
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.post({ type: 'regexGeneratedError', payload: errMsg });
        }
        break;
      }

      // User clicked a finding in the sidebar list → jump editor + fetch AI
      case 'selectFinding': {
        const id = msg.payload as string;
        const finding = this.lastResult?.findings.find(f => f.id === id) ?? null;
        if (!finding) { return; }
        this.activeFinding = finding;
        this.jumpToLocation(finding.file, finding.line.start);
        this.fetchExplanation(finding);
        break;
      }

      case 'scanFile':   vscode.commands.executeCommand('safelens.scanFile');   break;
      case 'scanFolder': vscode.commands.executeCommand('safelens.scanFolder'); break;
      case 'clear':      vscode.commands.executeCommand('safelens.clearDiagnostics'); break;

      case 'jumpToFinding': {
        const f = this.lastResult?.findings.find(x => x.id === msg.payload) ?? null;
        if (f) { this.jumpToLocation(f.file, f.line.start); }
        break;
      }

      case 'jumpToCrash': {
        const payload = msg.payload as { file: string; line: number };
        this.jumpToLocation(payload.file, payload.line);
        break;
      }

      case 'triggerCopilot': {
        const payload = msg.payload as { prompt: string };
        await vscode.env.clipboard.writeText(payload.prompt);
        await vscode.commands.executeCommand('workbench.action.chat.open');
        vscode.window.showInformationMessage('SafeLens: Copilot Chat opened. Prompt copied to clipboard! Paste it to run the fix.');
        break;
      }

      case 'triggerQuickFix': {
        const payload = msg.payload as { file: string; line: number };
        await this.jumpToLocation(payload.file, payload.line);
        await vscode.commands.executeCommand('editor.action.quickFix');
        break;
      }

      case 'chat': {
        const userText = msg.payload as string;

        const hasKey = await this.aiService.hasToken();
        if (!hasKey) {
          this.post({ type: 'chatError', payload: 'Sign-in/API Key required.' });
          break;
        }

        const userMsg: ChatMessage = { role: 'user', content: userText, timestamp: Date.now() };
        this.chatHistory.push(userMsg);
        this.post({ type: 'chatTyping' });
        try {
          const response = await this.aiService.chat(
            this.chatHistory,
            this.lastResult?.findings ?? [],
            this.activeFinding
          );
          const aMsg: ChatMessage = { role: 'assistant', content: response, timestamp: Date.now() };
          this.chatHistory.push(aMsg);
          this.post({ type: 'chatMessage', payload: aMsg });
        } catch (err: unknown) {
          this.post({ type: 'chatError', payload: err instanceof Error ? err.message : String(err) });
        }
        break;
      }
    }
  }

  private async jumpToLocation(filePath: string, lineNum: number): Promise<void> {
    try {
      let targetPath = filePath;
      if (!path.isAbsolute(filePath) && vscode.workspace.workspaceFolders) {
        targetPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
      }
      const uri = vscode.Uri.file(targetPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const ed  = await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true });
      const line = Math.max(0, lineNum - 1);
      const pos  = new vscode.Position(line, 0);
      ed.selection = new vscode.Selection(pos, pos);
      ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch { /* file may not be readable */ }
  }

  private post(message: Record<string, unknown>): void {
    this.view?.webview.postMessage(message);
  }
}
