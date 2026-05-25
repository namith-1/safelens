import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ScanResult, Finding } from '../types';

interface TreeNode {
  name: string;
  isFolder: boolean;
  children: Record<string, TreeNode>;
  findings: Finding[];
}

export class HistoryService {
  private static outputChannel: vscode.OutputChannel | null = null;

  public static getOutputChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('SafeLens Scan Output');
    }
    return this.outputChannel;
  }

  /**
   * Log scan results to output channel and write them to the local history directory.
   */
  public async recordScan(result: ScanResult, targetPath: string): Promise<void> {
    const channel = HistoryService.getOutputChannel();
    channel.clear();

    const uri = vscode.Uri.file(targetPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : null;

    // 1. Generate & Print Terminal Summary
    const summaryText = this.generateSummaryText(result, targetPath, workspaceRoot);
    channel.appendLine(summaryText);
    // Don't show Output panel automatically as requested: "once scanned dont go to output showing file hierarchy"
    // channel.show(true);

    // 2. Save Error History to local workspace .safelens/history/
    if (workspaceRoot) {
      await this.saveHistoryFiles(result, targetPath, workspaceRoot);
    }
  }

  private generateSummaryText(result: ScanResult, targetPath: string, workspaceRoot: string | null): string {
    const separator = '='.repeat(60);
    const targetLabel = workspaceRoot ? path.relative(workspaceRoot, targetPath) || path.basename(targetPath) : path.basename(targetPath);
    
    let out = `${separator}\n`;
    out += `🛡️  SAFELENS SCAN SUMMARY: "${targetLabel}"\n`;
    out += `${separator}\n\n`;

    const findings = result.findings;

    if (findings.length === 0) {
      out += `✅ No security issues found in this scan!\n\n`;
      out += `Scan completed at: ${new Date().toLocaleString()}\n`;
      out += `${separator}`;
      return out;
    }

    // A. Main Error (first finding, as findings are pre-sorted by severity)
    const mainError = findings[0];
    const mainSeverityIcon = mainError.severity === 'ERROR' ? '🔴' : (mainError.severity === 'WARNING' ? '🟡' : '🔵');
    const relFile = workspaceRoot ? path.relative(workspaceRoot, mainError.file) : path.basename(mainError.file);
    
    out += `🚨 MAIN VULNERABILITY ALERT:\n`;
    out += `  Severity: ${mainSeverityIcon} [${mainError.severity}]\n`;
    out += `  Location: ${relFile} (Line ${mainError.line.start})\n`;
    out += `  Rule Match: ${mainError.ruleId}\n`;
    out += `  Details: ${mainError.message}\n`;
    if (mainError.codeSnippet) {
      out += `  Vulnerable Code:\n`;
      out += `    > ${mainError.codeSnippet.split('\n')[0]}\n`;
    }
    out += `\n`;

    // B. File Hierarchy & Responsible Vulnerabilities
    out += `📂 AFFECTED FILE HIERARCHY:\n`;
    const rootNode = this.buildTree(findings, workspaceRoot);
    const treeLines = this.printTree(rootNode);
    if (treeLines.length > 0) {
      out += treeLines.join('\n') + '\n';
    } else {
      out += `  (No hierarchy available)\n`;
    }

    out += `\n`;
    out += `Scan completed at: ${new Date().toLocaleString()}\n`;
    if (workspaceRoot) {
      out += `Local history stored in: .safelens/history/\n`;
    }
    out += `${separator}`;

    return out;
  }

  private buildTree(findings: Finding[], workspaceRoot: string | null): TreeNode {
    const rootNode: TreeNode = { name: 'Root', isFolder: true, children: {}, findings: [] };
    
    for (const f of findings) {
      let relPath = f.file;
      if (workspaceRoot && path.isAbsolute(f.file)) {
        relPath = path.relative(workspaceRoot, f.file);
      }
      relPath = relPath.replace(/\\/g, '/');
      const parts = relPath.split('/');
      
      let current = rootNode;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            isFolder: !isLast,
            children: {},
            findings: []
          };
        }
        current = current.children[part];
        if (isLast) {
          current.findings.push(f);
        }
      }
    }
    return rootNode;
  }

  private printTree(node: TreeNode, indent: string = ''): string[] {
    const lines: string[] = [];
    const entries = Object.values(node.children);
    
    entries.forEach((child, index) => {
      const isLast = index === entries.length - 1;
      const marker = isLast ? '└── ' : '├── ';
      const nextIndent = indent + (isLast ? '    ' : '│   ');
      
      if (child.isFolder) {
        lines.push(`${indent}${marker}📂 ${child.name}/`);
        lines.push(...this.printTree(child, nextIndent));
      } else {
        lines.push(`${indent}${marker}📄 ${child.name}`);
        for (const f of child.findings) {
          const icon = f.severity === 'ERROR' ? '🔴' : (f.severity === 'WARNING' ? '🟡' : '🔵');
          const shortRule = f.ruleId.split('.').pop() || f.ruleId;
          lines.push(`${nextIndent}├── ${icon} Line ${f.line.start}: ${f.message.slice(0, 60)} (${shortRule})`);
        }
      }
    });
    return lines;
  }

  private async saveHistoryFiles(result: ScanResult, targetPath: string, workspaceRoot: string): Promise<void> {
    const historyDir = path.join(workspaceRoot, '.safelens', 'history');
    
    try {
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
      }

      // Group findings by absolute file path
      const findingsByFile: Record<string, Finding[]> = {};
      for (const f of result.findings) {
        if (!findingsByFile[f.file]) {
          findingsByFile[f.file] = [];
        }
        findingsByFile[f.file].push(f);
      }

      // 1. Update history for files that currently have findings
      for (const [filePath, fileFindings] of Object.entries(findingsByFile)) {
        await this.updateFileHistory(filePath, fileFindings, workspaceRoot, historyDir);
      }

      // 2. If it's a single file scan and has no findings, write a clean history entry
      const isFile = fs.statSync(targetPath).isFile();
      if (isFile && result.findings.length === 0) {
        await this.updateFileHistory(targetPath, [], workspaceRoot, historyDir);
      }
    } catch (e) {
      console.error('Failed to save error history:', e);
    }
  }

  private async updateFileHistory(
    filePath: string,
    findings: Finding[],
    workspaceRoot: string,
    historyDir: string
  ): Promise<void> {
    // Generate flat, readable filename representing path hierarchy (e.g. src_app_py.json)
    const relPath = path.relative(workspaceRoot, filePath);
    const safeName = relPath.replace(/[\/\\]/g, '_').replace(/:/g, '') + '_history.json';
    const historyFilePath = path.join(historyDir, safeName);

    let historyObj: {
      filePath: string;
      lastUpdated: string;
      history: {
        timestamp: string;
        findingsCount: number;
        findings: {
          ruleId: string;
          severity: string;
          message: string;
          line: number;
          codeSnippet: string | null;
        }[];
      }[];
    } = {
      filePath: relPath,
      lastUpdated: '',
      history: []
    };

    if (fs.existsSync(historyFilePath)) {
      try {
        const raw = fs.readFileSync(historyFilePath, 'utf8');
        historyObj = JSON.parse(raw);
      } catch {}
    }

    // Append new scan entry
    const entry = {
      timestamp: new Date().toISOString(),
      findingsCount: findings.length,
      findings: findings.map(f => ({
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        line: f.line.start,
        codeSnippet: f.codeSnippet
      }))
    };

    historyObj.lastUpdated = entry.timestamp;
    historyObj.history.unshift(entry); // Prepend so most recent is first

    // Limit history log to last 50 entries
    if (historyObj.history.length > 50) {
      historyObj.history = historyObj.history.slice(0, 50);
    }

    fs.writeFileSync(historyFilePath, JSON.stringify(historyObj, null, 2), 'utf8');
  }
}
