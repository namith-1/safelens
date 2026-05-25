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
exports.HoverProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Hover tooltip — NO AI call here. Very fast.
 * Shows: severity icon, rule, message, snippet.
 * "🔍 Open Full AI Details" link triggers AI only when user clicks it.
 */
class HoverProvider {
    constructor(diagnosticsService) {
        this.diagnosticsService = diagnosticsService;
    }
    provideHover(document, position) {
        const finding = this.diagnosticsService.getFindingAtPosition(document, position);
        if (!finding) {
            return null;
        }
        const icons = { ERROR: '🔴', WARNING: '🟡', INFO: '🔵', UNKNOWN: '⚪' };
        const md = new vscode.MarkdownString('', true);
        md.isTrusted = true;
        md.supportHtml = false;
        md.appendMarkdown(`${icons[finding.severity] ?? '⚪'} **[SafeLens] ${finding.severity}** — \`${finding.ruleId}\`\n\n`);
        md.appendMarkdown(`${finding.message}\n\n`);
        // If we already have a cached AI brief from a previous click, show it
        const brief = this.diagnosticsService.getBrief(finding.id);
        if (brief) {
            md.appendMarkdown(`> 🤖 ${brief}\n\n`);
        }
        else {
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
exports.HoverProvider = HoverProvider;
//# sourceMappingURL=hoverProvider.js.map