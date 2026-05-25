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
exports.ScanFolderCommand = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const historyService_1 = require("../services/historyService");
class ScanFolderCommand {
    constructor(semgrepService, diagnosticsService, sidebar, extensionPath) {
        this.semgrepService = semgrepService;
        this.diagnosticsService = diagnosticsService;
        this.sidebar = sidebar;
        this.extensionPath = extensionPath;
    }
    async execute() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showWarningMessage('SΛFΞLΞNS: No workspace folder open.');
            return;
        }
        let targetPath;
        if (folders.length === 1) {
            targetPath = folders[0].uri.fsPath;
        }
        else {
            const picks = folders.map(f => ({ label: f.name, fsPath: f.uri.fsPath }));
            const chosen = await vscode.window.showQuickPick(picks, { placeHolder: 'Select folder to scan' });
            if (!chosen) {
                return;
            }
            targetPath = chosen.fsPath;
        }
        let scanResult = null;
        let scanError = null;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `SafeLens: Scanning folder "${path.basename(targetPath)}"…`,
            cancellable: false,
        }, async (progress) => {
            this.sidebar.showScanLoading(targetPath, 'folder');
            progress.report({ message: 'Running rules on all files…' });
            try {
                // Stash raw semgrep result so custom regexes can be re-applied instantly
                const rawResult = await this.semgrepService.scanPathRaw(targetPath, this.extensionPath);
                this.sidebar.setLastRawResult(rawResult);
                // Apply custom regex rules on top
                scanResult = this.semgrepService.applyCustomRegexes(rawResult, rawResult.meta.target);
                this.semgrepService.sendResultsToBackend(scanResult).then(() => {
                    console.log('Scan results successfully sent to backend.');
                }).catch(err => {
                    const msg = err instanceof Error ? err.message : String(err);
                    vscode.window.showErrorMessage(`SΛFΞLΞNS: Failed to send scan results to backend. ${msg}`);
                });
                progress.report({ message: 'Done!' });
                this.diagnosticsService.applyFindings(scanResult);
                this.sidebar.showScanResult(scanResult);
                // Record scan history and print simplified terminal summary
                const historyService = new historyService_1.HistoryService();
                await historyService.recordScan(scanResult, targetPath);
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
            const { totalFindings, filesWithFindings } = scanResult.summary;
            if (totalFindings === 0) {
                vscode.window.showInformationMessage('✅ SΛFΞLΞNS: No issues found!');
            }
            else {
                const action = await vscode.window.showWarningMessage(`🔍 SΛFΞLΞNS: ${totalFindings} issue(s) across ${filesWithFindings} file(s).`, 'Open Sidebar');
                if (action === 'Open Sidebar') {
                    vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
                }
            }
        }
    }
}
exports.ScanFolderCommand = ScanFolderCommand;
//# sourceMappingURL=scanFolder.js.map