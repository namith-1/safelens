import * as vscode from 'vscode';
import { DiagnosticsService } from '../services/diagnosticsService';

/**
 * Hover tooltip — NO AI call here. Very fast.
 * Shows: severity icon, rule, message, snippet.
 * "🔍 Open Full AI Details" link triggers AI only when user clicks it.
 */
export class HoverProvider implements vscode.HoverProvider {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const finding = this.diagnosticsService.getFindingAtPosition(document, position);
    if (!finding) { return null; }

    const icons: Record<string, string> = { ERROR: '🔴', WARNING: '🟡', INFO: '🔵', UNKNOWN: '⚪' };

    const md = new vscode.MarkdownString('', true);
    md.isTrusted     = true;
    md.supportHtml   = false;

    md.appendMarkdown(`${icons[finding.severity] ?? '⚪'} **[SafeLens] ${finding.severity}** — \`${finding.ruleId}\`\n\n`);
    md.appendMarkdown(`${finding.message}\n\n`);

    // If we already have a cached AI brief from a previous click, show it
    const brief = this.diagnosticsService.getBrief(finding.id);
    if (brief) {
      md.appendMarkdown(`> 🤖 ${brief}\n\n`);
    } else {
      md.appendMarkdown(`*Click below to get AI explanation*\n\n`);
    }

    if (finding.codeSnippet) {
      md.appendMarkdown(`**Vulnerable code:**\n\`\`\`\n${finding.codeSnippet.slice(0, 200)}\n\`\`\`\n\n`);
    }

    // Clicking this link fires _openFinding command → opens sidebar → AI explanation loads
    const encodedId = encodeURIComponent(JSON.stringify(finding.id));
    md.appendMarkdown(`[🔍 Open Full AI Details](command:safelens._openFinding?${encodedId})`);
    md.appendMarkdown(`  ·  [📖 Rule Docs](https://semgrep.dev/r/${finding.ruleId})`);

    // Show count if multiple findings on this line
    const all = this.diagnosticsService.getLastResult();
    const sameLine = (all?.findingsByFile[document.uri.fsPath] ?? []).filter(f => {
      const l = position.line + 1;
      return l >= f.line.start && l <= Math.max(f.line.end, f.line.start);
    });
    if (sameLine.length > 1) {
      md.appendMarkdown(`\n\n---\n*${sameLine.length - 1} more issue(s) on this line — see sidebar*`);
    }

    return new vscode.Hover(md);
  }
}
