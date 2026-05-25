import * as vscode from 'vscode';

export class HistoryService {
  private static outputChannel: vscode.OutputChannel | null = null;

  public static getOutputChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('SafeLens Scan Output');
    }
    return this.outputChannel;
  }
}

