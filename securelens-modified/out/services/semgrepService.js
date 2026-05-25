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
exports.SemgrepService = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const crypto_1 = require("crypto");
// import aiService to send scan results to the backend for storage and further analysis
const aiService_1 = require("./aiService");
class SemgrepService {
    constructor() {
        this.sendResultsToBackend = async (result) => {
            try {
                const aiService = new aiService_1.AIService();
                const hasKey = await aiService.hasToken();
                if (!hasKey) {
                    console.log('SafeLens: No API key configured. Skipping sending results to backend.');
                    return;
                }
                await aiService.post('/api/scans/save-results', { results: result });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`SafeLens: Failed to send scan results to backend. ${msg}`);
            }
        };
    }
    async scanPath(targetPath, extensionPath) {
        const raw = await this.scanPathRaw(targetPath, extensionPath);
        return this.applyCustomRegexes(raw, raw.meta.target);
    }
    /** Returns the merged semgrep result BEFORE custom regex rules are applied.
     *  Callers (scan commands) stash this in SidebarProvider so regexes can be
     *  re-applied instantly without triggering a full semgrep re-scan. */
    async scanPathRaw(targetPath, extensionPath) {
        const config = vscode.workspace.getConfiguration('safelens');
        const severityFilter = config.get('severityFilter', 'ALL');
        const absPath = path.resolve(targetPath);
        if (!fs.existsSync(absPath)) {
            throw new Error(`Path does not exist: ${absPath}`);
        }
        const rulesFile = this.findRulesFile(extensionPath);
        const passes = [];
        if (rulesFile) {
            passes.push(this.runSemgrep(absPath, rulesFile, severityFilter).catch(() => this.emptyResult(absPath, rulesFile)));
        }
        const results = await Promise.all(passes);
        return this.mergeResults(results, absPath);
    }
    findRulesFile(extensionPath) {
        const candidates = [
            extensionPath ? path.join(extensionPath, 'media', 'safelens-rules.yaml') : null,
            extensionPath ? path.join(extensionPath, 'safelens-rules.yaml') : null,
            path.join(__dirname, '..', '..', 'media', 'safelens-rules.yaml'),
            path.join(__dirname, '..', 'media', 'safelens-rules.yaml'),
            path.join(__dirname, 'safelens-rules.yaml'),
        ].filter(Boolean);
        for (const c of candidates) {
            if (fs.existsSync(c)) {
                return c;
            }
        }
        return null;
    }
    getIgnoreAndIncludeArgs(absPath) {
        const filterArgs = [];
        const uri = vscode.Uri.file(absPath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const roots = [];
        if (workspaceFolder) {
            roots.push(workspaceFolder.uri.fsPath);
        }
        try {
            const stat = fs.statSync(absPath);
            if (stat.isDirectory() && !roots.includes(absPath)) {
                roots.push(absPath);
            }
        }
        catch { }
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
                }
                catch (e) {
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
                }
                catch (e) {
                    console.error(`Failed to read .onlyscan: ${e}`);
                }
            }
        }
        return filterArgs;
    }
    runSemgrep(absPath, configSource, severityFilter) {
        const args = [
            '--json',
            '--no-git-ignore',
            '--config', configSource,
            '--metrics=off',
        ];
        if (severityFilter !== 'ALL') {
            args.push('--severity', severityFilter);
        }
        const filterArgs = this.getIgnoreAndIncludeArgs(absPath);
        args.push(...filterArgs);
        args.push(absPath);
        const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' };
        return new Promise((resolve, reject) => {
            (0, child_process_1.execFile)('semgrep', args, { timeout: 120000, maxBuffer: 50 * 1024 * 1024, encoding: 'utf8', env }, (_err, stdout, stderr) => {
                const clean = stdout ? stdout.replace(/^\uFEFF/, '').trim() : '';
                if (!clean) {
                    return reject(new Error(stderr || _err?.message || 'No output'));
                }
                let raw;
                try {
                    raw = JSON.parse(clean);
                    console.log(raw);
                }
                catch {
                    return reject(new Error(`Parse failed: ${(stderr || '').slice(0, 100)}`));
                }
                resolve(this.buildResult(raw, absPath, configSource));
            });
        });
    }
    mergeResults(results, target) {
        const seen = new Set();
        const allFindings = [];
        const allErrors = [];
        for (const r of results) {
            for (const f of r.findings) {
                const key = `${f.ruleId}:${f.file}:${f.line.start}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allFindings.push({ ...f, id: `finding-${allFindings.length}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
                }
            }
            allErrors.push(...r.errors);
        }
        // Sort by severity: ERROR → WARNING → INFO → UNKNOWN
        const rank = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
        allFindings.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
        const bySeverity = { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 };
        const byFile = {};
        for (const f of allFindings) {
            bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
            if (!byFile[f.file]) {
                byFile[f.file] = [];
            }
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
    buildResult(raw, target, configSource) {
        const rawResults = raw.results || [];
        const seen = new Set();
        const findings = [];
        rawResults.forEach((r, idx) => {
            const res = r;
            const extra = res.extra || {};
            const start = res.start || {};
            const end = res.end || {};
            const baseFp = typeof extra.fingerprint === 'string'
                ? extra.fingerprint
                : `${res.check_id}:${res.path}:${start.line}:${end.line}:${start.col}:${end.col}`;
            const fp = `${baseFp}:${idx}`;
            if (seen.has(fp)) {
                return;
            }
            seen.add(fp);
            findings.push({
                id: (0, crypto_1.randomUUID)(),
                ruleId: String(res.check_id || ''),
                severity: this.normalizeSeverity(String(extra.severity || 'UNKNOWN')),
                message: String(extra.message || ''),
                file: String(res.path || ''),
                line: { start: start.line ?? 1, end: end.line ?? 1 },
                column: { start: start.col ?? 0, end: end.col ?? 0 },
                codeSnippet: typeof extra.lines === 'string' ? extra.lines.trim() : null,
                fix: typeof extra.fix === 'string' ? extra.fix : null,
                metadata: extra.metadata || {},
                fingerprint: fp,
            });
        });
        const rawErrors = raw.errors || [];
        const errors = rawErrors.map((e) => {
            const err = e;
            const span = err.spans?.[0] || {};
            return {
                code: Number(err.code || 0), level: String(err.level || ''),
                message: String(err.message || err.long_msg || ''),
                path: typeof span.file === 'string' ? span.file : null,
            };
        });
        const bySeverity = { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 };
        const byFile = {};
        for (const f of findings) {
            bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
            if (!byFile[f.file]) {
                byFile[f.file] = [];
            }
            byFile[f.file].push(f);
        }
        return {
            meta: { scannedAt: new Date().toISOString(), target, config: path.basename(configSource), semgrepVersion: typeof raw.version === 'string' ? raw.version : null },
            summary: { totalFindings: findings.length, totalErrors: errors.length, bySeverity, filesWithFindings: Object.keys(byFile).length },
            findings, findingsByFile: byFile, errors,
        };
    }
    emptyResult(target, config) {
        return {
            meta: { scannedAt: new Date().toISOString(), target, config, semgrepVersion: null },
            summary: { totalFindings: 0, totalErrors: 0, bySeverity: { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 }, filesWithFindings: 0 },
            findings: [], findingsByFile: {}, errors: [],
        };
    }
    normalizeSeverity(s) {
        const up = s.toUpperCase();
        if (up === 'ERROR') {
            return 'ERROR';
        }
        if (up === 'WARNING') {
            return 'WARNING';
        }
        if (up === 'INFO') {
            return 'INFO';
        }
        return 'UNKNOWN';
    }
    getDisplayPath(filePath) {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            if (filePath.startsWith(wsRoot)) {
                return path.relative(wsRoot, filePath).replace(/\\/g, '/');
            }
        }
        return filePath.replace(/\\/g, '/');
    }
    getFilesToScan(dirPath) {
        const files = [];
        const traverse = (currentPath) => {
            let stats;
            try {
                stats = fs.statSync(currentPath);
            }
            catch {
                return;
            }
            if (stats.isDirectory()) {
                const name = path.basename(currentPath);
                if (name === 'node_modules' || name === '.git' || name === '.vscode' || name === '.safelens' || name === 'out' || name === 'dist') {
                    return;
                }
                let children = [];
                try {
                    children = fs.readdirSync(currentPath);
                }
                catch {
                    return;
                }
                for (const child of children) {
                    traverse(path.join(currentPath, child));
                }
            }
            else if (stats.isFile()) {
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
    applyCustomRegexes(scanResult, absPath) {
        const config = vscode.workspace.getConfiguration('safelens');
        const customVuls = config.get('customRegexVulnerabilities', []);
        const customIgnores = config.get('customRegexIgnores', []);
        if (customVuls.length === 0 && customIgnores.length === 0) {
            return scanResult;
        }
        const filesToScan = [];
        try {
            const stat = fs.statSync(absPath);
            if (stat.isFile()) {
                filesToScan.push(absPath);
            }
            else if (stat.isDirectory()) {
                filesToScan.push(...this.getFilesToScan(absPath));
            }
        }
        catch (e) {
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
            }
            catch (e) {
                console.error(`Invalid custom vulnerability regex: ${v.pattern}`, e);
                return null;
            }
        }).filter(Boolean);
        const ignoreRegexes = customIgnores.map(i => {
            try {
                return {
                    id: i.id,
                    pattern: i.pattern,
                    regex: new RegExp(i.pattern)
                };
            }
            catch (e) {
                console.error(`Invalid custom ignore regex: ${i.pattern}`, e);
                return null;
            }
        }).filter(Boolean);
        const customFindings = [];
        const ignoredLinesByFile = {};
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
                                id: (0, crypto_1.randomUUID)(),
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
            }
            catch (e) {
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
        const rank = { ERROR: 0, WARNING: 1, INFO: 2, UNKNOWN: 3 };
        allFindings.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3));
        const bySeverity = { INFO: 0, WARNING: 0, ERROR: 0, UNKNOWN: 0 };
        const byFile = {};
        for (const f of allFindings) {
            bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
            if (!byFile[f.file]) {
                byFile[f.file] = [];
            }
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
exports.SemgrepService = SemgrepService;
//# sourceMappingURL=semgrepService.js.map