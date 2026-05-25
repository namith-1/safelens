import * as vscode from 'vscode';
import { SemgrepService } from '../services/semgrepService';
import { DiagnosticsService } from '../services/diagnosticsService';
import { SidebarProvider } from '../webview/sidebarProvider';

export class ScanFileCommand {
  constructor(
    private readonly semgrepService: SemgrepService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly sidebar: SidebarProvider,
    private readonly extensionPath: string
  ) {}

  async execute(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('SafeLens: Open a file in the editor first.');
      return;
    }
    await this.executeForDocument(editor.document);
  }

  async executeForDocument(doc: vscode.TextDocument): Promise<void> {
    if (doc.isUntitled) {
      vscode.window.showWarningMessage('SafeLens: Save the file before scanning.');
      return;
    }

    const filePath = doc.uri.fsPath;
    let scanResult: any = null;
    let scanError: any = null;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `SafeLens: Scanning ${vscode.workspace.asRelativePath(filePath)}…`,
        cancellable: false,
      },
      async (progress) => {
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

          console.log('Scan results:', scanResult);
          // sending the resutls to the backend is now handled in the semgrepService after the scan is complete, instead of in the sidebarProvider after displaying the results. This allows us to keep the scanning logic and backend communication logic together in the semgrepService, while the sidebarProvider focuses solely on displaying results and interacting with the user interface.
          this.semgrepService.sendResultsToBackend(scanResult).then(() => {
            console.log('Scan results successfully sent to backend.');
          }).catch(err => {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`SafeLens: Failed to send scan results to backend. ${msg}`);
          });
        } catch (err: unknown) {
          scanError = err;
        }
      }
    );

    if (scanError) {
      const msg = scanError instanceof Error ? scanError.message : String(scanError);
      vscode.window.showErrorMessage(`SafeLens: ${msg}`);
      this.sidebar.showError(msg);
      return;
    }

    if (scanResult) {
      const { totalFindings } = scanResult.summary;
      if (totalFindings === 0) {
        vscode.window.showInformationMessage('SafeLens: No issues found!');
      } else {
        const action = await vscode.window.showWarningMessage(
          `🔍 SafeLens: ${totalFindings} issue(s) found.`, 'Open Sidebar'
        );
        if (action === 'Open Sidebar') {
          vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
        }
      }
    }
  }
}

