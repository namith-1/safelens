import * as vscode from 'vscode';
import * as path from 'path';
import { SemgrepService } from '../services/semgrepService';
import { DiagnosticsService } from '../services/diagnosticsService';
import { SidebarProvider } from '../webview/sidebarProvider';
import { HistoryService } from '../services/historyService';

export class ScanFolderCommand {
  constructor(
    private readonly semgrepService: SemgrepService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly sidebar: SidebarProvider,
    private readonly extensionPath: string
  ) {}

  async execute(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      vscode.window.showWarningMessage('SΛFΞLΞNS: No workspace folder open.');
      return;
    }

    let targetPath: string;
    if (folders.length === 1) {
      targetPath = folders[0].uri.fsPath;
    } else {
      const picks = folders.map(f => ({ label: f.name, fsPath: f.uri.fsPath }));
      const chosen = await vscode.window.showQuickPick(picks, { placeHolder: 'Select folder to scan' });
      if (!chosen) { return; }
      targetPath = chosen.fsPath;
    }

    let scanResult: any = null;
    let scanError: any = null;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SafeLens: Scanning folder "${path.basename(targetPath)}"…`,
        cancellable: false,
      },
      async (progress) => {
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
          const historyService = new HistoryService();
          await historyService.recordScan(scanResult, targetPath);
        } catch (err: unknown) {
          scanError = err;
        }
      }
    );

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
      } else {
        const action = await vscode.window.showWarningMessage(
          `🔍 SΛFΞLΞNS: ${totalFindings} issue(s) across ${filesWithFindings} file(s).`, 'Open Sidebar'
        );
        if (action === 'Open Sidebar') {
          vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
        }
      }
    }
  }
}
