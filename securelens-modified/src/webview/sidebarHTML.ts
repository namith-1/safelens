import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads sidebar.html from media/ and returns it as a string.
 * Keeping HTML in a separate file avoids all TypeScript template-literal
 * escaping issues with backticks and ${} inside the webview JS.
 */
export function getSidebarHTML(
  _webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const htmlPath = path.join(extensionUri.fsPath, 'media', 'sidebar.html');
  return fs.readFileSync(htmlPath, 'utf8');
}
