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
exports.DiagnosticsService = void 0;
const vscode = __importStar(require("vscode"));
const SEVERITY_MAP = {
    ERROR: vscode.DiagnosticSeverity.Error,
    WARNING: vscode.DiagnosticSeverity.Warning,
    INFO: vscode.DiagnosticSeverity.Information,
    UNKNOWN: vscode.DiagnosticSeverity.Hint,
};
class DiagnosticsService {
    constructor(collection) {
        this.collection = collection;
        this.lastResult = null;
        this.briefCache = new Map();
    }
    getLastResult() { return this.lastResult; }
    getFindingAtPosition(document, position) {
        const result = this.lastResult;
        if (!result) {
            return null;
        }
        const findings = result.findingsByFile[document.uri.fsPath];
        if (!findings || findings.length === 0) {
            return null;
        }
        const line = position.line + 1; // semgrep is 1-based
        return findings.find(f => line >= f.line.start && line <= Math.max(f.line.end, f.line.start)) ?? null;
    }
    applyFindings(result) {
        this.lastResult = result;
        this.collection.clear();
        for (const [filePath, findings] of Object.entries(result.findingsByFile)) {
            const uri = vscode.Uri.file(filePath);
            this.collection.set(uri, findings.map(f => this.makeDiagnostic(f)));
        }
    }
    clear() {
        this.collection.clear();
        this.lastResult = null;
        this.briefCache.clear();
    }
    getBrief(findingId) { return this.briefCache.get(findingId); }
    setBrief(findingId, brief) { this.briefCache.set(findingId, brief); }
    makeDiagnostic(f) {
        const startLine = Math.max(0, (f.line.start || 1) - 1);
        const endLine = Math.max(0, (f.line.end || f.line.start || 1) - 1);
        const startCol = Math.max(0, f.column.start || 0);
        const endCol = Math.max(startCol + 1, f.column.end || startCol + 80);
        const range = new vscode.Range(new vscode.Position(startLine, startCol), new vscode.Position(endLine, endCol));
        const severity = SEVERITY_MAP[f.severity] ?? vscode.DiagnosticSeverity.Warning;
        const diag = new vscode.Diagnostic(range, `[SafeLens] ${f.message}`, severity);
        diag.code = { value: f.ruleId, target: vscode.Uri.parse(`https://semgrep.dev/r/${f.ruleId}`) };
        diag.source = 'SafeLens';
        diag.findingId = f.id;
        if (f.codeSnippet) {
            diag.relatedInformation = [
                new vscode.DiagnosticRelatedInformation(new vscode.Location(vscode.Uri.file(f.file), range), `Snippet: ${f.codeSnippet.slice(0, 120)}`)
            ];
        }
        return diag;
    }
}
exports.DiagnosticsService = DiagnosticsService;
//# sourceMappingURL=diagnosticsService.js.map