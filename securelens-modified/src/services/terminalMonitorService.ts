import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { HistoryService } from './historyService';
import { SidebarProvider } from '../webview/sidebarProvider';

interface StackFrame {
  file: string;
  line: number;
  functionName: string;
}

interface RuntimeException {
  type: string;
  message: string;
  origin: StackFrame;
  propagation: StackFrame[];
}

interface TreeNode {
  name: string;
  isFolder: boolean;
  children: Record<string, TreeNode>;
  findings: any[];
}

export class TerminalMonitorService {
  private static buffers: Map<string, string> = new Map();

  /**
   * ANSI escape stripping regex.
   */
  private static stripAnsi(text: string): string {
    return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }

  /**
   * Handle incoming terminal data chunks.
   */
  public static handleTerminalData(event: vscode.TerminalShellExecutionStartEvent | { terminal: vscode.Terminal; data: string }): void {
    const terminal = event.terminal;
    const rawData = 'data' in event ? event.data : '';
    if (!rawData) return;

    const termId = terminal.name + '_' + terminal.processId;
    let buffer = this.buffers.get(termId) || '';

    // Append new stripped data
    buffer += this.stripAnsi(rawData);

    // Limit buffer length to prevent high memory usage (last 5000 chars is plenty for stack traces)
    if (buffer.length > 5000) {
      buffer = buffer.slice(buffer.length - 5000);
    }

    this.buffers.set(termId, buffer);

    // Run analyzers on the accumulated buffer
    this.checkAndAnalyzeErrors(buffer, terminal, termId);
  }

  private static checkAndAnalyzeErrors(buffer: string, terminal: vscode.Terminal, termId: string): void {
    // 1. Check for Python Traceback
    if (buffer.includes('Traceback (most recent call last):')) {
      const pythonExc = this.parsePythonTraceback(buffer);
      if (pythonExc) {
        this.processException(pythonExc, terminal);
        this.buffers.set(termId, ''); // Clear buffer to prevent double-detection
        return;
      }
    }

    // 2. Check for Node.js Exception
    // Look for standard Error: message followed by at least one "    at " line
    if (/(\w+Error|Error): .*\r?\n\s+at /i.test(buffer)) {
      const nodeExc = this.parseNodeTraceback(buffer);
      if (nodeExc) {
        this.processException(nodeExc, terminal);
        this.buffers.set(termId, ''); // Clear buffer
        return;
      }
    }

    // 3. Fallback Generic Exception check (Java, Go, Rust, general errors)
    if (/(panic:|panicked at|\w+Exception|\w+Error)/i.test(buffer)) {
      const genExc = this.parseGenericException(buffer);
      if (genExc) {
        this.processException(genExc, terminal);
        this.buffers.set(termId, ''); // Clear buffer
        return;
      }
    }

    // 4. Custom generic / custom logs error check (for DB errors, database error log lines, etc. without stack trace)
    const customExc = this.parseCustomError(buffer);
    if (customExc) {
      this.processException(customExc, terminal);
      this.buffers.set(termId, ''); // Clear buffer
      return;
    }
  }

  private static parseCustomError(buffer: string): RuntimeException | null {
    const lines = buffer.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    // Scan lines from bottom to top to find the most recent error message
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      const containsErrorKeyword = 
        lowerLine.includes('error:') || 
        lowerLine.includes('exception:') || 
        lowerLine.includes('panic:') ||
        lowerLine.includes('database error') ||
        lowerLine.includes('db error') ||
        lowerLine.includes('critical error') ||
        lowerLine.includes('fatal error') ||
        lowerLine.includes('critical database error') ||
        lowerLine.includes('connection failed') ||
        lowerLine.includes('mongoerror') ||
        lowerLine.includes('mongooseerror');
      
      const isFalsePositive = 
        lowerLine.includes('no error') || 
        lowerLine.includes('0 error') || 
        lowerLine.includes('without error') ||
        lowerLine.includes('injecting env') ||
        lowerLine.includes('dotenv');
        
      if (containsErrorKeyword && !isFalsePositive) {
        let errType = 'RuntimeError';
        let errMsg = line;
        
        // Try to extract a clean type and message
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          errType = line.slice(0, colonIdx).trim();
          errMsg = line.slice(colonIdx + 1).trim();
        } else {
          // If no colon, find the error keyword and use it as type
          const keywords = ['database error', 'db error', 'critical error', 'fatal error', 'connection failed', 'mongoerror', 'mongooseerror'];
          for (const kw of keywords) {
            const idx = lowerLine.indexOf(kw);
            if (idx !== -1) {
              errType = line.slice(idx, idx + kw.length).trim();
              errMsg = line.trim();
              break;
            }
          }
        }

        // If message is too short and there's a next line, append it to give more context
        if (errMsg.length < 15 && i + 1 < lines.length) {
          errMsg += ' ' + lines[i + 1];
        }

        // Find file context in surrounding lines (10 lines before, 10 lines after)
        const stackFrames: StackFrame[] = [];
        const contextLines = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 11));
        const fileLineRegex = /(?:^|\s|["'\(\[]|at\s)((?:[a-zA-Z]:[\\\/]|\/|[a-zA-Z0-9_\-\.]+\/)[a-zA-Z0-9_\-\.\/\\ ]+\.[a-zA-Z0-9_]+):(\d+)(?::(\d+))?/i;

        for (const contextLine of contextLines) {
          const match = contextLine.match(fileLineRegex);
          if (match) {
            const filePath = match[1];
            if (filePath.includes('node_modules') || filePath.includes('node:internal') || filePath.includes('sdk/')) continue;
            
            stackFrames.push({
              file: filePath,
              line: parseInt(match[2]),
              functionName: '<context>'
            });
          }
        }

        let originFrame: StackFrame;
        const propagation: StackFrame[] = [];

        if (stackFrames.length > 0) {
          const uniqueFrames = stackFrames.filter((v, i, a) => a.findIndex(t => t.file === v.file && t.line === v.line) === i);
          originFrame = uniqueFrames[0];
          propagation.push(...uniqueFrames.slice(1));
        } else {
          // Fallback to active editor or a workspace file if no file path found in output
          const activeEditor = vscode.window.activeTextEditor;
          let file = activeEditor ? activeEditor.document.uri.fsPath : '';
          
          if (!file && vscode.workspace.workspaceFolders) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            const candidates = ['server.js', 'app.js', 'index.js', 'main.py', 'manage.py'];
            for (const c of candidates) {
              const fullPath = path.join(workspaceRoot, c);
              if (fs.existsSync(fullPath)) {
                file = fullPath;
                break;
              }
            }
            if (!file) {
              file = path.join(workspaceRoot, 'server.js');
            }
          }
          
          originFrame = {
            file: file || 'server.js',
            line: 1,
            functionName: '<main>'
          };
        }

        return {
          type: errType,
          message: errMsg,
          origin: originFrame,
          propagation
        };
      }
    }
    
    return null;
  }

  private static parsePythonTraceback(buffer: string): RuntimeException | null {
    const lines = buffer.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const traceIdx = lines.findIndex(l => l.startsWith('Traceback (most recent call last):'));
    if (traceIdx === -1) return null;

    const relevantLines = lines.slice(traceIdx);
    const stackFrames: StackFrame[] = [];
    let errType = 'PythonError';
    let errMsg = 'Exception occurred';

    // Parse frames matching: File "filename.py", line X, in funcname
    const frameRegex = /File "([^"]+)", line (\d+)(?:, in (.+))?/i;

    for (let i = 0; i < relevantLines.length; i++) {
      const line = relevantLines[i];
      const match = line.match(frameRegex);
      if (match) {
        stackFrames.push({
          file: match[1],
          line: parseInt(match[2]),
          functionName: match[3] || '<module>'
        });
      }
    }

    // The last line in Python traceback usually represents the error type & message
    // e.g., "ZeroDivisionError: division by zero"
    const lastLine = relevantLines[relevantLines.length - 1];
    if (lastLine && lastLine.includes(':') && !lastLine.startsWith('File "')) {
      const parts = lastLine.split(':');
      errType = parts[0].trim();
      errMsg = parts.slice(1).join(':').trim();
    }

    if (stackFrames.length === 0) return null;

    // Python prints the call stack top-down:
    // First frame is start of execution, last frame is the CRASH ORIGIN.
    const origin = stackFrames[stackFrames.length - 1];
    const propagation = [...stackFrames].reverse().slice(1); // Callers in reverse order

    return {
      type: errType,
      message: errMsg,
      origin,
      propagation
    };
  }

  private static parseNodeTraceback(buffer: string): RuntimeException | null {
    const lines = buffer.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    // Find the exception header line (e.g. ReferenceError: x is not defined)
    // followed by "at "
    let headerIdx = -1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes('Error:') && lines[i+1].startsWith('at ')) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return null;

    const header = lines[headerIdx];
    const parts = header.split(':');
    const errType = parts[0].trim();
    const errMsg = parts.slice(1).join(':').trim();

    const stackFrames: StackFrame[] = [];
    // Parse Node stack frames:
    // e.g. "at startServer (/path/to/src/server.js:22:15)"
    // or "at /path/to/src/server.js:22:15"
    const frameRegex = /^at (?:([^(]+)\s+\((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))$/;

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('at ')) break; // Stop when stack trace ends

      const match = line.match(frameRegex);
      if (match) {
        if (match[2]) {
          stackFrames.push({
            file: match[2],
            line: parseInt(match[3]),
            functionName: match[1].trim()
          });
        } else {
          stackFrames.push({
            file: match[5],
            line: parseInt(match[6]),
            functionName: '<anonymous>'
          });
        }
      }
    }

    if (stackFrames.length === 0) return null;

    // Node prints the call stack bottom-up:
    // First frame is the CRASH ORIGIN, subsequent frames are the callers (propagation).
    const origin = stackFrames[0];
    const propagation = stackFrames.slice(1);

    return {
      type: errType,
      message: errMsg,
      origin,
      propagation
    };
  }

  private static parseGenericException(buffer: string): RuntimeException | null {
    const lines = buffer.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let errLineIdx = -1;
    let errType = 'RuntimeError';
    let errMsg = 'An exception occurred';

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.startsWith('panic:')) {
        errLineIdx = i;
        errType = 'GoPanic';
        errMsg = line.slice(6).trim();
        break;
      }
      if (line.includes('panicked at')) {
        errLineIdx = i;
        errType = 'RustPanic';
        errMsg = line.slice(line.indexOf('panicked at')).trim();
        break;
      }
      const excMatch = line.match(/^([a-zA-Z0-9\._]+Exception)(?:: (.*))?$/);
      if (excMatch) {
        errLineIdx = i;
        errType = excMatch[1];
        errMsg = excMatch[2] || 'Null or empty exception';
        break;
      }
      const errMatch = line.match(/^([a-zA-Z0-9\._]+Error): (.*)$/);
      if (errMatch) {
        errLineIdx = i;
        errType = errMatch[1];
        errMsg = errMatch[2];
        break;
      }
    }

    if (errLineIdx === -1) return null;

    const stackFrames: StackFrame[] = [];
    const contextLines = lines.slice(Math.max(0, errLineIdx - 10), Math.min(lines.length, errLineIdx + 15));
    
    // Match file paths like C:\path\to\file.js:12 or /path/to/file.py:12 or src/main.rs:10:9
    const fileLineRegex = /(?:^|\s|["'\(\[])((?:[a-zA-Z]:[\\\/]|\/|[a-zA-Z0-9_\-\.]+\/)[a-zA-Z0-9_\-\.\/\\ ]+\.[a-zA-Z0-9_]+):(\d+)(?::(\d+))?/i;

    for (const line of contextLines) {
      const match = line.match(fileLineRegex);
      if (match) {
        const filePath = match[1];
        if (filePath.includes('node_modules') || filePath.includes('node:internal') || filePath.includes('sdk/')) continue;
        
        stackFrames.push({
          file: filePath,
          line: parseInt(match[2]),
          functionName: '<context>'
        });
      }
    }

    if (stackFrames.length === 0) return null;

    const uniqueFrames = stackFrames.filter((v, i, a) => a.findIndex(t => t.file === v.file && t.line === v.line) === i);
    const originFrame = uniqueFrames[0];
    const propagation = uniqueFrames.slice(1);

    return {
      type: errType,
      message: errMsg,
      origin: originFrame,
      propagation
    };
  }

  private static async processException(exc: RuntimeException, terminal: vscode.Terminal): Promise<void> {
    const channel = HistoryService.getOutputChannel();
    channel.clear();

    const separator = '='.repeat(60);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || null;

    // A. Resolve relative paths
    const resolveRelPath = (fp: string) => {
      if (workspaceRoot && path.isAbsolute(fp)) {
        return path.relative(workspaceRoot, fp);
      }
      return path.basename(fp);
    };

    const originRelFile = resolveRelPath(exc.origin.file);

    // B. Build Tree Node Hierarchy for Crash Path
    // Build tree using only the frames in the stack trace
    const framesWithPaths = [exc.origin, ...exc.propagation].filter(f => f.file && !f.file.includes('node_modules') && !f.file.includes('internal/'));

    let out = `${separator}\n`;
    out += `💥  SAFELENS: RUNTIME EXCEPTION DETECTED IN TERMINAL [${terminal.name}]\n`;
    out += `${separator}\n\n`;

    out += `🚨 ERROR: ${exc.type}: ${exc.message}\n\n`;
    out += `📍 CRASH ORIGIN:\n`;
    out += `  File: ${originRelFile}\n`;
    out += `  Line: ${exc.origin.line}\n`;
    out += `  Function: ${exc.origin.functionName}\n\n`;

    out += `⛓️  PROPAGATION STACK (How it propagated):\n`;
    out += `  💥 ${originRelFile}:${exc.origin.line} (${exc.origin.functionName}) - CRASH POINT\n`;
    for (const f of exc.propagation.slice(0, 8)) {
      if (f.file.includes('node_modules') || f.file.includes('internal/')) continue;
      out += `  └── 📄 ${resolveRelPath(f.file)}:${f.line} (${f.functionName})\n`;
    }
    out += `\n`;

    out += `📂 CRASH FILE HIERARCHY:\n`;
    const treeLines = this.buildCrashTree(framesWithPaths, exc.origin.file, workspaceRoot);
    out += treeLines.join('\n') + '\n';
    out += `${separator}`;

    channel.appendLine(out);
    // Don't show Output panel automatically as requested: "show in detail in sidebar... not in output"
    // channel.show(true);

    // Open sidebar and send exception details to sidebar webview
    try {
      // Execute command to reveal the SafeLens sidebar view
      await vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
      
      // Give a tiny delay for the sidebar webview to register/initialize if it wasn't open
      setTimeout(() => {
        SidebarProvider.postToWebview({
          type: 'runtimeCrash',
          payload: {
            errorType: exc.type,
            message: exc.message,
            origin: exc.origin,
            propagation: exc.propagation
          }
        });
      }, 300);
    } catch (err) {
      console.error('Error posting to SafeLens sidebar:', err);
    }
  }

  private static buildCrashTree(frames: StackFrame[], originFile: string, workspaceRoot: string | null): string[] {
    const rootNode: TreeNode = { name: 'Root', isFolder: true, children: {}, findings: [] };
    
    // Sort frames to build tree recursively
    for (const f of frames) {
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
          // Add a dummy finding representing the stack trace frame location
          const mockFinding = {
            id: '',
            ruleId: f.functionName,
            severity: f.file === originFile ? 'ERROR' : 'WARNING',
            message: f.file === originFile ? '💥 CRASH ORIGIN' : '⛓️ PROPAGATING CALLER',
            file: f.file,
            line: { start: f.line, end: f.line },
            column: { start: 0, end: 0 },
            codeSnippet: null,
            fix: null,
            metadata: {},
            fingerprint: ''
          };
          current.findings.push(mockFinding);
        }
      }
    }
    return this.printCrashTree(rootNode);
  }

  private static printCrashTree(node: TreeNode, indent: string = ''): string[] {
    const lines: string[] = [];
    const entries = Object.values(node.children) as TreeNode[];
    
    entries.forEach((child, index) => {
      const isLast = index === entries.length - 1;
      const marker = isLast ? '└── ' : '├── ';
      const nextIndent = indent + (isLast ? '    ' : '│   ');
      
      if (child.isFolder) {
        lines.push(`${indent}${marker}📂 ${child.name}/`);
        lines.push(...this.printCrashTree(child, nextIndent));
      } else {
        lines.push(`${indent}${marker}📄 ${child.name}`);
        for (const f of child.findings) {
          const icon = f.severity === 'ERROR' ? '💥' : '⛓️';
          lines.push(`${nextIndent}└── ${icon} Line ${f.line.start}: ${f.message} in ${f.ruleId}()`);
        }
      }
    });
    return lines;
  }
}
