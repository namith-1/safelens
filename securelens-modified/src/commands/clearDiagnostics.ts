import * as vscode from 'vscode';
import { DiagnosticsService } from '../services/diagnosticsService';
import { SidebarProvider } from '../webview/sidebarProvider';

export class ClearDiagnosticsCommand {
  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly sidebar: SidebarProvider
  ) {}

  execute(): void {
    this.diagnosticsService.clear();
    this.sidebar.showCleared();
    vscode.window.showInformationMessage('SafeLens: All markers cleared.');
  }
}

