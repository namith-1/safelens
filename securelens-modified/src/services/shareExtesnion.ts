import * as vscode from 'vscode';

let _context: vscode.ExtensionContext | undefined;

export function setContext(context: vscode.ExtensionContext) {
    _context = context;
}

export function getContext(): vscode.ExtensionContext {
    if (!_context) {
        throw new Error('Extension context not initialized');
    }
    return _context;
}

