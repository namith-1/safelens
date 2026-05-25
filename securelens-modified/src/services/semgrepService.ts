import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { Finding, ScanError, ScanResult, Severity } from '../types';
import { randomUUID } from 'crypto';

// import aiService to send scan results to the backend for storage and further analysis
import { AIService } from './aiService';
import * as http from 'http';
import * as https from 'https';

export class SemgrepService {

  async scanPath(targetPath: string, extensionPath?: string): Promise<ScanResult> {
    const raw = await this.scanPathRaw(targetPath, extensionPath);
    return this.applyCustomRegexes(raw, raw.meta.target);
  }

  /** Returns the merged semgrep result BEFORE custom regex rules are applied.
   *  Callers (scan commands) stash this in SidebarProvider so regexes can be
   *  re-applied instantly without triggering a full semgrep re-scan. */
  async scanPathRaw(targetPath: string, extensionPath?: string): Promise<ScanResult> {
    const config = vscode.workspace.getConfiguration('safelens');
    const severityFilter: string = config.get('severityFilter', 'ALL');
    const absPath = path.resolve(targetPath);

    if (!fs.existsSync(absPath)) {
      throw new Error(`Path does not exist: ${absPath}`);
    }

    const rulesFile = this.findRulesFile(extensionPath);

    const passes: Promise<ScanResult>[] = [];

    if (rulesFile) {
      passes.push(this.runSemgrep(absPath, rulesFile, severityFilter).catch(() => this.emptyResult(absPath, rulesFile!)));
    }

    const results = await Promise.all(passes);
    return this.mergeResults(results, absPath);
  }


  private findRulesFile(extensionPath?: string): string | null {
    const candidates = [
      extensionPath ? path.join(extensionPath, 'media', 'safelens-rules.yaml') : null,
      extensionPath ? path.join(extensionPath, 'safelens-rules.yaml') : null,
      path.join(__dirname, '..', '..', 'media', 'safelens-rules.yaml'),
      path.join(__dirname, '..', 'media', 'safelens-rules.yaml'),
      path.join(__dirname, 'safelens-rules.yaml'),
    ].filter(Boolean) as string[];

    for (const c of candidates) {
      if (fs.existsSync(c)) { return c; }
    }
    return null;
  }


  private getIgnoreAndIncludeArgs(absPath: string): string[] {
    const filterArgs: string[] = [];
    const uri = vscode.Uri.file(absPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const roots: string[] = [];

    if (workspaceFolder) {
      roots.push(workspaceFolder.uri.fsPath);
    }
    
    try {
      const stat = fs.statSync(absPath);
      if (stat.isDirectory() && !roots.includes(absPath)) {
        roots.push(absPath);
      }
    } catch {}

    for (const root of roots) {
      const scanIgnorePath = path.join(root, '.scanignore');
      const onlyScanPath = path.join(root, '.onlyscan');

      if (fs.existsSync(scanIgnorePath)) {
        try {
          const content = fs.readFileSync(scanIgnorePath, 'utf8');
          const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
          for (const line of lines) {
            filterArgs.push('--exclude', line);
          }
        } catch (e) {
          console.error(`Failed to read .scanignore: ${e}`);
        }
      }

      if (fs.existsSync(onlyScanPath)) {
        try {
          const content = fs.readFileSync(onlyScanPath, 'utf8');
          const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
          for (const line of lines) {
            filterArgs.push('--include', line);
          }
        } catch (e) {
          console.error(`Failed to read .onlyscan: ${e}`);
        }
      }
    }

    return filterArgs;
  }

  private runSemgrep(absPath: string, configSource: string, severityFilter: string): Promise<ScanResult> {
    const args = [
      '--json',
      '--no-git-ignore',
      '--config', configSource,
      '--metrics=off',
    ];
    if (severityFilter !== 'ALL') { args.push('--severity', severityFilter); }
    
    const filterArgs = this.getIgnoreAndIncludeArgs(absPath);
    args.push(...filterArgs);
    
    args.push(absPath);

    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };

    return new Promise((resolve, reject) => {
      execFile('semgrep', args, { timeout: 120_000, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8', env },
        (_err, stdout, stderr) => {
          const clean = stdout ? stdout.replace(/^\uFEFF/, '').trim() : '';
          if (!clean) {
            return reject(new Error(stderr || _err?.message || 'No output'));
          }
          let raw: Record<string, unknown>;
          try { raw = JSON.parse(clean); 
            console.log(raw);
          }
          catch { return reject(new Error(`Parse failed: ${(stderr||'').slice(0,100)}`)); }
          resolve(this.buildResult(raw, absPath, configSource));
        }
      );
    });
  }

  private mergeResults(results: ScanResult[], target: string): ScanResult {
    const seen = new Set<string>();
    const allFindings: Finding[] = [];
    const allErrors: ScanError[] = [];

    for (const r of results) {
      for (const f of r.findings) {
        const key = `${f.ruleId}:${f.file}:${f.line.start}`;
        if (!seen.has(key)) {
          seen.add(key);
          allFindings.push({ ...f, id: `finding-${allFindings.length}-${Date.now()}-${Math.random().toString(36).slice(2,7)}` });
        }
      }
      allErrors.push(...r.errors);
    }

    // Sort by severity: ERROR → WARNING → INFO → UNKNOWN
    const rank: Record<string, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
    allFindings.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));

    const bySeverity: Record<string, number> = { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 };
    const byFile: Record<string, Finding[]> = {};
    for (const f of allFindings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      if (!byFile[f.file]) { byFile[f.file] = []; }
      byFile[f.file].push(f);
    }


    console.log(`Merged ${results.length} results into ${allFindings.length} unique findings across ${Object.keys(byFile).length} files.`);

    return {
      meta: {
        scannedAt: new Date().toISOString(),
        target,
        config: 'safelens-rules + p/secrets',
        semgrepVersion: results[0]?.meta?.semgrepVersion ?? null,
      },
      summary: {
        totalFindings: allFindings.length,
        totalErrors: allErrors.length,
        bySeverity,
        filesWithFindings: Object.keys(byFile).length,
      },
      findings: allFindings,
      findingsByFile: byFile,
      errors: allErrors,
    };
  }

  private buildResult(raw: Record<string, unknown>, target: string, configSource: string): ScanResult {
    const rawResults = (raw.results as unknown[]) || [];
    const seen = new Set<string>();
    const findings: Finding[] = [];

    rawResults.forEach((r: unknown, idx: number) => {
      const res   = r as Record<string, unknown>;
      const extra = (res.extra as Record<string, unknown>) || {};
      const start = (res.start as Record<string, number>) || {};
      const end   = (res.end   as Record<string, number>) || {};
const baseFp = typeof extra.fingerprint === 'string'
  ? extra.fingerprint
  : `${res.check_id}:${res.path}:${start.line}:${end.line}:${start.col}:${end.col}`;

const fp = `${baseFp}:${idx}`;
      if (seen.has(fp)) { return; }
      seen.add(fp);
      findings.push({
        id: randomUUID(),
        ruleId:      String(res.check_id || ''),
        severity:    this.normalizeSeverity(String(extra.severity || 'UNKNOWN')),
        message:     String(extra.message || ''),
        file:        String(res.path || ''),
        line:        { start: start.line ?? 1, end: end.line ?? 1 },
        column:      { start: start.col  ?? 0, end: end.col  ?? 0 },
        codeSnippet: typeof extra.lines === 'string' ? extra.lines.trim() : null,
        fix:         typeof extra.fix   === 'string' ? extra.fix   : null,
        metadata:    (extra.metadata as Record<string, unknown>) || {},
        fingerprint: fp,
      });
    });

    const rawErrors = (raw.errors as unknown[]) || [];
    const errors: ScanError[] = rawErrors.map((e: unknown) => {
      const err  = e as Record<string, unknown>;
      const span = ((err.spans as unknown[])?.[0] as Record<string, unknown>) || {};
      return {
        code: Number(err.code || 0), level: String(err.level || ''),
        message: String(err.message || err.long_msg || ''),
        path: typeof span.file === 'string' ? span.file : null,
      };
    });

    const bySeverity: Record<string, number> = { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 };
    const byFile: Record<string, Finding[]> = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      if (!byFile[f.file]) { byFile[f.file] = []; }
      byFile[f.file].push(f);
    }

    return {
      meta: { scannedAt: new Date().toISOString(), target, config: path.basename(configSource), semgrepVersion: typeof raw.version === 'string' ? raw.version : null },
      summary: { totalFindings: findings.length, totalErrors: errors.length, bySeverity, filesWithFindings: Object.keys(byFile).length },
      findings, findingsByFile: byFile, errors,
    };
  }

  private emptyResult(target: string, config: string): ScanResult {
    return {
      meta: { scannedAt: new Date().toISOString(), target, config, semgrepVersion: null },
      summary: { totalFindings: 0, totalErrors: 0, bySeverity: { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 }, filesWithFindings: 0 },
      findings: [], findingsByFile: {}, errors: [],
    };
  }

  private normalizeSeverity(s: string): Severity {
    const up = s.toUpperCase();
    if (up === 'ERROR')   { return 'ERROR'; }
    if (up === 'WARNING') { return 'WARNING'; }
    if (up === 'INFO')    { return 'INFO'; }
    return 'UNKNOWN';
  }

  public sendResultsToBackend = async (result: ScanResult): Promise<void> => {
    try {
      const aiService = new AIService();
      const hasKey = await aiService.hasToken();
      if (!hasKey) {
        console.log('SafeLens: No API key configured. Skipping sending results to backend.');
        return;
      }
      await aiService.post('/api/scans/save-results', { results: result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`SafeLens: Failed to send scan results to backend. ${msg}`);
    }
  };

  private getDisplayPath(filePath: string): string {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      if (filePath.startsWith(wsRoot)) {
        return path.relative(wsRoot, filePath).replace(/\\/g, '/');
      }
    }
    return filePath.replace(/\\/g, '/');
  }

  private getFilesToScan(dirPath: string): string[] {
    const files: string[] = [];
    const traverse = (currentPath: string) => {
      let stats: fs.Stats;
      try {
        stats = fs.statSync(currentPath);
      } catch {
        return;
      }
      if (stats.isDirectory()) {
        const name = path.basename(currentPath);
        if (name === 'node_modules' || name === '.git' || name === '.vscode' || name === '.safelens' || name === 'out' || name === 'dist') {
          return;
        }
        let children: string[] = [];
        try {
          children = fs.readdirSync(currentPath);
        } catch {
          return;
        }
        for (const child of children) {
          traverse(path.join(currentPath, child));
        }
      } else if (stats.isFile()) {
        const ext = path.extname(currentPath).toLowerCase();
        const allowedExts = [
          '.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
          '.cs', '.php', '.rb', '.rs', '.swift', '.kt', '.html', '.css', '.json', '.yaml', '.yml',
          '.md', '.sql', '.sh', '.bat', '.ps1'
        ];
        if (allowedExts.includes(ext)) {
          files.push(currentPath);
        }
      }
    };
    traverse(dirPath);
    return files;
  }

  public applyCustomRegexes(scanResult: ScanResult, absPath: string): ScanResult {
    const config = vscode.workspace.getConfiguration('safelens');
    const customVuls = config.get<any[]>('customRegexVulnerabilities', []);
    const customIgnores = config.get<any[]>('customRegexIgnores', []);

    if (customVuls.length === 0 && customIgnores.length === 0) {
      return scanResult;
    }

    const filesToScan: string[] = [];
    try {
      const stat = fs.statSync(absPath);
      if (stat.isFile()) {
        filesToScan.push(absPath);
      } else if (stat.isDirectory()) {
        filesToScan.push(...this.getFilesToScan(absPath));
      }
    } catch (e) {
      console.error('Error stating path for regex scan:', e);
    }

    const vulRegexes = customVuls.map(v => {
      try {
        return {
          id: v.id,
          message: v.message,
          severity: this.normalizeSeverity(v.severity || 'WARNING'),
          pattern: v.pattern,
          regex: new RegExp(v.pattern)
        };
      } catch (e) {
        console.error(`Invalid custom vulnerability regex: ${v.pattern}`, e);
        return null;
      }
    }).filter(Boolean) as { id: string; message: string; severity: Severity; pattern: string; regex: RegExp }[];

    const ignoreRegexes = customIgnores.map(i => {
      try {
        return {
          id: i.id,
          pattern: i.pattern,
          regex: new RegExp(i.pattern)
        };
      } catch (e) {
        console.error(`Invalid custom ignore regex: ${i.pattern}`, e);
        return null;
      }
    }).filter(Boolean) as { id: string; pattern: string; regex: RegExp }[];

    const customFindings: Finding[] = [];
    const ignoredLinesByFile: Record<string, Set<number>> = {};

    for (const filePath of filesToScan) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        const relativePath = this.getDisplayPath(filePath);

        lines.forEach((lineContent, lineIdx) => {
          const lineNum = lineIdx + 1;

          // Check if this line matches any ignore regex
          let isIgnored = false;
          for (const ignoreObj of ignoreRegexes) {
            if (ignoreObj.regex.test(lineContent)) {
              isIgnored = true;
              break;
            }
          }

          if (isIgnored) {
            if (!ignoredLinesByFile[relativePath]) {
              ignoredLinesByFile[relativePath] = new Set();
            }
            ignoredLinesByFile[relativePath].add(lineNum);
            return;
          }

          // Check against vulnerability regexes
          for (const vul of vulRegexes) {
            const match = lineContent.match(vul.regex);
            if (match) {
              customFindings.push({
                id: randomUUID(),
                ruleId: `custom-regex:${vul.id}`,
                severity: vul.severity,
                message: vul.message || `Custom Regex Match: ${vul.pattern}`,
                file: relativePath,
                line: { start: lineNum, end: lineNum },
                column: { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length },
                codeSnippet: lineContent.trim(),
                fix: null,
                metadata: { customRegex: true },
                fingerprint: `custom-regex:${vul.id}:${relativePath}:${lineNum}`,
              });
            }
          }
        });
      } catch (e) {
        console.error(`Failed to read/scan file for custom regex: ${filePath}`, e);
      }
    }

    const filteredSemgrepFindings = scanResult.findings.filter(f => {
      const fileIgnoredLines = ignoredLinesByFile[f.file];
      if (fileIgnoredLines && fileIgnoredLines.has(f.line.start)) {
        return false;
      }
      if (f.codeSnippet) {
        for (const ignoreObj of ignoreRegexes) {
          if (ignoreObj.regex.test(f.codeSnippet)) {
            return false;
          }
        }
      }
      return true;
    });

    const allFindings = [...filteredSemgrepFindings, ...customFindings];

    const rank: Record<string, number> = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
    allFindings.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));

    const bySeverity: Record<string, number> = { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 };
    const byFile: Record<string, Finding[]> = {};
    for (const f of allFindings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      if (!byFile[f.file]) { byFile[f.file] = []; }
      byFile[f.file].push(f);
    }

    return {
      ...scanResult,
      summary: {
        ...scanResult.summary,
        totalFindings: allFindings.length,
        bySeverity,
        filesWithFindings: Object.keys(byFile).length,
      },
      findings: allFindings,
      findingsByFile: byFile,
    };
  }
}

