import * as vscode from 'vscode';
import { Finding, ScanResult } from '../types';

const SEVERITY_MAP: Record<string, vscode.DiagnosticSeverity> = {
  ERROR:   vscode.DiagnosticSeverity.Error,
  WARNING: vscode.DiagnosticSeverity.Warning,
  INFO:    vscode.DiagnosticSeverity.Information,
  UNKNOWN: vscode.DiagnosticSeverity.Hint,
};

export class DiagnosticsService {
  private lastResult: ScanResult | null = null;
  private briefCache = new Map<string, string>();

  constructor(private readonly collection: vscode.DiagnosticCollection) {}

  getLastResult(): ScanResult | null { return this.lastResult; }

  getFindingAtPosition(document: vscode.TextDocument, position: vscode.Position) {
    const result = this.lastResult;
    if (!result) { return null; }
    const findings = result.findingsByFile[document.uri.fsPath];
    if (!findings || findings.length === 0) { return null; }
    const line = position.line + 1; // semgrep is 1-based
    return findings.find(f => line >= f.line.start && line <= Math.max(f.line.end, f.line.start)) ?? null;
  }

  applyFindings(result: ScanResult): void {
    this.lastResult = result;
    this.collection.clear();
    for (const [filePath, findings] of Object.entries(result.findingsByFile)) {
      const uri = vscode.Uri.file(filePath);
      this.collection.set(uri, findings.map(f => this.makeDiagnostic(f)));
    }
  }

  clear(): void {
    this.collection.clear();
    this.lastResult = null;
    this.briefCache.clear();
  }

  getBrief(findingId: string): string | undefined { return this.briefCache.get(findingId); }
  setBrief(findingId: string, brief: string): void { this.briefCache.set(findingId, brief); }

  private makeDiagnostic(f: Finding): vscode.Diagnostic {
    const startLine = Math.max(0, (f.line.start || 1) - 1);
    const endLine   = Math.max(0, (f.line.end   || f.line.start || 1) - 1);
    const startCol  = Math.max(0, f.column.start || 0);
    const endCol    = Math.max(startCol + 1, f.column.end || startCol + 80);

    const range    = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol));
    const severity = SEVERITY_MAP[f.severity] ?? vscode.DiagnosticSeverity.Warning;
    const diag     = new vscode.Diagnostic(range, `[SΛFΞLΞNS] ${f.message}`, severity);

    diag.code = { value: f.ruleId, target: vscode.Uri.parse(`https://semgrep.dev/r/${f.ruleId}`) };
    diag.source = 'SafeLens';
    (diag as vscode.Diagnostic & { findingId?: string }).findingId = f.id;

    if (f.codeSnippet) {
      diag.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(vscode.Uri.file(f.file), range),
          `Snippet: ${f.codeSnippet.slice(0, 120)}`
        )
      ];
    }
    return diag;
  }
}
