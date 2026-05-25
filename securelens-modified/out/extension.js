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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const scanFile_1 = require("./commands/scanFile");
const scanFolder_1 = require("./commands/scanFolder");
const clearDiagnostics_1 = require("./commands/clearDiagnostics");
const diagnosticsService_1 = require("./services/diagnosticsService");
const semgrepService_1 = require("./services/semgrepService");
const aiService_1 = require("./services/aiService");
const sidebarProvider_1 = require("./webview/sidebarProvider");
const hoverProvider_1 = require("./utils/hoverProvider");
const shareExtesnion_1 = require("./services/shareExtesnion");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const terminalMonitorService_1 = require("./services/terminalMonitorService");
// ─── Paths (all deterministic) ───────────────────────────────────────────────
const VENV_DIR = path.join(os.homedir(), '.vscode-semgrep-venv');
const VENV_BIN = os.platform() === 'win32'
    ? path.join(VENV_DIR, 'Scripts')
    : path.join(VENV_DIR, 'bin');
const SEMGREP_BIN = os.platform() === 'win32'
    ? path.join(VENV_BIN, 'semgrep.exe')
    : path.join(VENV_BIN, 'semgrep');
const PYTHON_BIN = os.platform() === 'win32'
    ? path.join(VENV_BIN, 'python.exe')
    : path.join(VENV_BIN, 'python');
const PIP_BIN = os.platform() === 'win32'
    ? path.join(VENV_BIN, 'pip.exe')
    : path.join(VENV_BIN, 'pip');
// ─── Shell helper ─────────────────────────────────────────────────────────────
function runCommand(command) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(command, { env: process.env }, (error, stdout, stderr) => {
            if (error) {
                // Only reject if there's an actual exit code error
                // pip writes notices/warnings to stderr even on success — ignore them
                const isRealError = stderr?.toLowerCase().includes('error:');
                if (isRealError) {
                    reject(stderr.trim());
                }
                else {
                    // exit code non-zero but no real error line → treat as success
                    resolve(stdout.trim());
                }
            }
            else {
                resolve(stdout.trim());
            }
        });
    });
}
// ─── Semgrep setup helpers ────────────────────────────────────────────────────
async function findSystemPython() {
    const candidates = os.platform() === 'win32'
        ? ['python', 'python3', 'py']
        : ['python3', 'python'];
    for (const cmd of candidates) {
        try {
            const version = await runCommand(`${cmd} --version`);
            const match = version.match(/Python (\d+)\.(\d+)/);
            if (match &&
                (parseInt(match[1]) > 3 ||
                    (parseInt(match[1]) === 3 && parseInt(match[2]) >= 7))) {
                console.log(`[semgrep-ext] Found system Python: ${cmd} (${version})`);
                return cmd;
            }
        }
        catch {
            // try next candidate
        }
    }
    return null;
}
async function createVenv(pythonCmd) {
    if (fs.existsSync(PYTHON_BIN)) {
        console.log(`[semgrep-ext] Venv already exists at ${VENV_DIR}`);
        return;
    }
    console.log(`[semgrep-ext] Creating venv at ${VENV_DIR}`);
    await runCommand(`${pythonCmd} -m venv "${VENV_DIR}"`);
}
async function installSemgrepInVenv() {
    // Skip pip upgrade entirely — avoids the "modify pip" error on Windows
    // Just install semgrep directly using the venv's Python to invoke pip
    // This bypasses the pip.exe lock issue on Windows
    await runCommand(`"${PYTHON_BIN}" -m pip install semgrep --quiet --disable-pip-version-check`);
}
async function validateSemgrep() {
    if (!fs.existsSync(SEMGREP_BIN))
        return false;
    try {
        const version = await runCommand(`"${SEMGREP_BIN}" --version`);
        console.log(`[semgrep-ext] Semgrep ready: ${version}`);
        return true;
    }
    catch {
        return false;
    }
}
function injectPathIntoProcess() {
    const current = process.env.PATH ?? '';
    const parts = current.split(path.delimiter);
    if (!parts.includes(VENV_BIN)) {
        process.env.PATH = `${VENV_BIN}${path.delimiter}${current}`;
        console.log(`[semgrep-ext] Injected ${VENV_BIN} into process PATH`);
    }
}
async function persistPathToTerminals() {
    const platformKey = os.platform() === 'win32'
        ? 'terminal.integrated.env.windows'
        : os.platform() === 'darwin'
            ? 'terminal.integrated.env.osx'
            : 'terminal.integrated.env.linux';
    const config = vscode.workspace.getConfiguration();
    const existing = config.get(platformKey) ?? {};
    const oldPath = existing['PATH'] ?? '${env:PATH}';
    if (!oldPath.includes(VENV_BIN)) {
        existing['PATH'] = `${VENV_BIN}${path.delimiter}${oldPath}`;
        await config.update(platformKey, existing, vscode.ConfigurationTarget.Global);
    }
}
async function setupSemgrep(progress) {
    progress.report({ message: 'Looking for Python…' });
    const python = await findSystemPython();
    if (!python) {
        vscode.window
            .showErrorMessage('Python 3.7+ is required but was not found. Please install Python and reload VS Code.', 'Download Python')
            .then((choice) => {
            if (choice === 'Download Python') {
                vscode.env.openExternal(vscode.Uri.parse('https://python.org/downloads'));
            }
        });
        return false;
    }
    progress.report({ message: 'Creating isolated Python environment…' });
    try {
        await createVenv(python);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to create virtual environment: ${err}`);
        return false;
    }
    progress.report({ message: 'Installing SΛFΞLΞNS (this may take a minute)…' });
    try {
        await installSemgrepInVenv();
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to install SΛFΞLΞNS: ${err}`);
        return false;
    }
    progress.report({ message: 'Verifying installation…' });
    const ok = await validateSemgrep();
    if (!ok) {
        vscode.window.showErrorMessage('SΛFΞLΞNS installed but failed to run. Please check your Python installation.');
        return false;
    }
    injectPathIntoProcess();
    await persistPathToTerminals();
    return true;
}
// ─── Extension entry points ───────────────────────────────────────────────────
async function activate(context) {
    console.log('SafeLens extension activated');
    (0, shareExtesnion_1.setContext)(context);
    let sidebarProvider;
    // ── URI Handler for automatic API Key synchronization ──────────────────────
    class SafeLensUriHandler {
        async handleUri(uri) {
            if (uri.path === '/auth') {
                const params = new URLSearchParams(uri.query);
                const token = params.get('token');
                if (token) {
                    await context.secrets.store('safelensApiKey', token);
                    vscode.window.showInformationMessage('SΛFΞLΞNS: API Key successfully synchronized from website!');
                    if (sidebarProvider) {
                        sidebarProvider.sendAuthState();
                    }
                }
                else {
                    vscode.window.showErrorMessage('SΛFΞLΞNS: Token parameter was missing in sync link.');
                }
            }
        }
    }
    context.subscriptions.push(vscode.window.registerUriHandler(new SafeLensUriHandler()));
    // ── API Key commands ────────────────────────────────────────────────────────
    const setApiKey = vscode.commands.registerCommand('safelens.setApiKey', async () => {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your SΛFΞLΞNS API Key',
            ignoreFocusOut: true,
            password: true,
        });
        if (apiKey) {
            await context.secrets.store('safelensApiKey', apiKey);
            vscode.window.showInformationMessage('SΛFΞLΞNS API Key saved successfully!');
            if (sidebarProvider) {
                sidebarProvider.sendAuthState();
            }
        }
    });
    const setbackendUrl = vscode.commands.registerCommand('safelens.setbackendUrl', async () => {
        const backendUrl = await vscode.window.showInputBox({
            prompt: 'Enter your SafeLens Backend URL (e.g. https://pointer.panclaws.com/api)',
            ignoreFocusOut: true,
            value: vscode.workspace.getConfiguration('safelens').get('backendUrl') || '',
        });
        if (backendUrl) {
            await vscode.workspace.getConfiguration('safelens').update('backendUrl', backendUrl, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('SΛFΞLΞNS Backend URL saved successfully!');
        }
    });
    const deleteApiKey = vscode.commands.registerCommand('safelens.deleteApiKey', async () => {
        await context.secrets.delete('safelensApiKey');
        vscode.window.showInformationMessage('SΛFΞLΞNS API Key deleted successfully!');
        if (sidebarProvider) {
            sidebarProvider.sendAuthState();
        }
    });
    context.subscriptions.push(setApiKey, deleteApiKey);
    // ── Semgrep setup ───────────────────────────────────────────────────────────
    const semgrepValid = await validateSemgrep();
    if (semgrepValid) {
        injectPathIntoProcess();
    }
    else {
        const choice = await vscode.window.showWarningMessage('SΛFΞLΞNS(kit) is required by SΛFΞLΞNS. Install it now?', 'Install', 'Not Now');
        if (choice === 'Install') {
            const success = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Setting up Semgrep',
                cancellable: false,
            }, (progress) => setupSemgrep(progress));
            if (success) {
                vscode.window.showInformationMessage(`SΛFΞLΞNS(kit) installed successfully`);
            }
        }
    }
    // ── Core services ───────────────────────────────────────────────────────────
    const extensionPath = context.extensionPath;
    const diagnosticsCollection = vscode.languages.createDiagnosticCollection('safelens');
    const diagnosticsService = new diagnosticsService_1.DiagnosticsService(diagnosticsCollection);
    const semgrepService = new semgrepService_1.SemgrepService();
    const aiService = new aiService_1.AIService();
    aiService.hasToken().then((hasKey) => {
        if (hasKey) {
            console.log('SafeLens: API key found in secure storage.');
        }
        else {
            console.log('SafeLens: No API key found in secure storage (running in local-only mode).');
        }
    });
    // ── Sidebar & hover ─────────────────────────────────────────────────────────
    sidebarProvider = new sidebarProvider_1.SidebarProvider(context.extensionUri, aiService, diagnosticsService);
    // Give sidebar access to semgrepService so it can re-apply custom regex rules
    // instantly when the user adds/removes a rule — no full re-scan needed.
    sidebarProvider.setSemgrepService(semgrepService);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('safelens.sidebarView', sidebarProvider, { webviewOptions: { retainContextWhenHidden: true } }));
    const hoverProvider = new hoverProvider_1.HoverProvider(diagnosticsService);
    context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider));
    // ── Commands ────────────────────────────────────────────────────────────────
    const scanFileCmd = new scanFile_1.ScanFileCommand(semgrepService, diagnosticsService, sidebarProvider, extensionPath);
    const scanFolderCmd = new scanFolder_1.ScanFolderCommand(semgrepService, diagnosticsService, sidebarProvider, extensionPath);
    const clearCmd = new clearDiagnostics_1.ClearDiagnosticsCommand(diagnosticsService, sidebarProvider);
    context.subscriptions.push(vscode.commands.registerCommand('safelens.scanFile', () => scanFileCmd.execute()), vscode.commands.registerCommand('safelens.scanFolder', () => scanFolderCmd.execute()), vscode.commands.registerCommand('safelens.clearDiagnostics', () => clearCmd.execute()), vscode.commands.registerCommand('safelens.openSidebar', () => {
        vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
    }), vscode.commands.registerCommand('safelens._openFinding', (findingId) => {
        vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
        setTimeout(() => {
            const result = diagnosticsService.getLastResult();
            if (!result)
                return;
            const finding = result.findings.find((f) => f.id === findingId);
            if (finding)
                sidebarProvider.openFinding(finding);
        }, 300);
    }), diagnosticsCollection);
    // ── Auto scan on save ───────────────────────────────────────────────────────
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (doc) => {
        const config = vscode.workspace.getConfiguration('safelens');
        if (config.get('scanOnSave', false)) {
            await scanFileCmd.executeForDocument(doc);
        }
    }));
    // ── Terminal Error Monitor ──────────────────────────────────────────────────
    if (typeof vscode.window.onDidWriteTerminalData === 'function') {
        context.subscriptions.push(vscode.window.onDidWriteTerminalData((event) => {
            terminalMonitorService_1.TerminalMonitorService.handleTerminalData(event);
        }));
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map