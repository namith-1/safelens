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
exports.ScanFileCommand = void 0;
const vscode = __importStar(require("vscode"));
const historyService_1 = require("../services/historyService");
class ScanFileCommand {
    constructor(semgrepService, diagnosticsService, sidebar, extensionPath) {
        this.semgrepService = semgrepService;
        this.diagnosticsService = diagnosticsService;
        this.sidebar = sidebar;
        this.extensionPath = extensionPath;
    }
    async execute() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('SΛFΞLΞNS: Open a file in the editor first.');
            return;
        }
        await this.executeForDocument(editor.document);
    }
    async executeForDocument(doc) {
        if (doc.isUntitled) {
            vscode.window.showWarningMessage('SΛFΞLΞNS: Save the file before scanning.');
            return;
        }
        const filePath = doc.uri.fsPath;
        let scanResult = null;
        let scanError = null;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `SΛFΞLΞNS: Scanning ${vscode.workspace.asRelativePath(filePath)}…`,
            cancellable: false,
        }, async (progress) => {
            this.sidebar.showScanLoading(filePath, 'file');
            progress.report({ message: 'Running rules…' });
            try {
                // Run semgrep-only scan first, stash it so custom regexes can be
                // re-applied instantly when the user adds/removes a rule.
                const rawResult = await this.semgrepService.scanPathRaw(filePath, this.extensionPath);
                this.sidebar.setLastRawResult(rawResult);
                // Now apply custom regex rules on top
                scanResult = this.semgrepService.applyCustomRegexes(rawResult, rawResult.meta.target);
                progress.report({ message: 'Done!' });
                this.diagnosticsService.applyFindings(scanResult);
                this.sidebar.showScanResult(scanResult);
                // Record scan history and print simplified terminal summary
                const historyService = new historyService_1.HistoryService();
                await historyService.recordScan(scanResult, filePath);
                console.log('Scan results:', scanResult);
                // sending the resutls to the backend is now handled in the semgrepService after the scan is complete, instead of in the sidebarProvider after displaying the results. This allows us to keep the scanning logic and backend communication logic together in the semgrepService, while the sidebarProvider focuses solely on displaying results and interacting with the user interface.
                this.semgrepService.sendResultsToBackend(scanResult).then(() => {
                    console.log('Scan results successfully sent to backend.');
                }).catch(err => {
                    const msg = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`SΛFΞLΞNS: Failed to send scan results to backend. ${msg}`);
                });
            }
            catch (err) {
                scanError = err;
            }
        });
        if (scanError) {
            const msg = scanError instanceof Error ? scanError.message : String(scanError);
            vscode.window.showErrorMessage(`SΛFΞLΞNS: ${msg}`);
            this.sidebar.showError(msg);
            return;
        }
        if (scanResult) {
            const { totalFindings } = scanResult.summary;
            if (totalFindings === 0) {
                vscode.window.showInformationMessage('SΛFΞLΞNS: No issues found!');
            }
            else {
                const action = await vscode.window.showWarningMessage(`🔍 SΛFΞLΞNS: ${totalFindings} issue(s) found.`, 'Open Sidebar');
                if (action === 'Open Sidebar') {
                    vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
                }
            }
        }
    }
}
exports.ScanFileCommand = ScanFileCommand;
//# sourceMappingURL=scanFile.js.map