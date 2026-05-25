import * as vscode from 'vscode';
import { ScanFileCommand } from './commands/scanFile';
import { ScanFolderCommand } from './commands/scanFolder';
import { ClearDiagnosticsCommand } from './commands/clearDiagnostics';
import { DiagnosticsService } from './services/diagnosticsService';
import { SemgrepService } from './services/semgrepService';
import { AIService } from './services/aiService';
import { SidebarProvider } from './webview/sidebarProvider';
import { HoverProvider } from './utils/hoverProvider';
import { setContext } from './services/shareExtesnion';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { TerminalMonitorService } from './services/terminalMonitorService';

// ─── Paths (all deterministic) ───────────────────────────────────────────────

const VENV_DIR = path.join(os.homedir(), '.vscode-semgrep-venv');

const VENV_BIN =
  os.platform() === 'win32'
    ? path.join(VENV_DIR, 'Scripts')
    : path.join(VENV_DIR, 'bin');

const SEMGREP_BIN =
  os.platform() === 'win32'
    ? path.join(VENV_BIN, 'semgrep.exe')
    : path.join(VENV_BIN, 'semgrep');

const PYTHON_BIN =
  os.platform() === 'win32'
    ? path.join(VENV_BIN, 'python.exe')
    : path.join(VENV_BIN, 'python');

const PIP_BIN =
  os.platform() === 'win32'
    ? path.join(VENV_BIN, 'pip.exe')
    : path.join(VENV_BIN, 'pip');

// ─── Shell helper ─────────────────────────────────────────────────────────────

function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { env: process.env }, (error, stdout, stderr) => {
      if (error) {
        // Only reject if there's an actual exit code error
        // pip writes notices/warnings to stderr even on success — ignore them
        const isRealError = stderr?.toLowerCase().includes('error:');
        if (isRealError) {
          reject(stderr.trim());
        } else {
          // exit code non-zero but no real error line → treat as success
          resolve(stdout.trim());
        }
      } else {
        resolve(stdout.trim());
      }
    });
  });
}


// ─── Semgrep setup helpers ────────────────────────────────────────────────────

async function findSystemPython(): Promise<string | null> {
  const candidates =
    os.platform() === 'win32'
      ? ['python', 'python3', 'py']
      : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      const version = await runCommand(`${cmd} --version`);
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (
        match &&
        (parseInt(match[1]) > 3 ||
          (parseInt(match[1]) === 3 && parseInt(match[2]) >= 7))
      ) {
        console.log(`[semgrep-ext] Found system Python: ${cmd} (${version})`);
        return cmd;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function createVenv(pythonCmd: string): Promise<void> {
  if (fs.existsSync(PYTHON_BIN)) {
    console.log(`[semgrep-ext] Venv already exists at ${VENV_DIR}`);
    return;
  }
  console.log(`[semgrep-ext] Creating venv at ${VENV_DIR}`);
  await runCommand(`${pythonCmd} -m venv "${VENV_DIR}"`);
}

async function installSemgrepInVenv(): Promise<void> {
  // Skip pip upgrade entirely — avoids the "modify pip" error on Windows
  // Just install semgrep directly using the venv's Python to invoke pip
  // This bypasses the pip.exe lock issue on Windows
  await runCommand(
    `"${PYTHON_BIN}" -m pip install semgrep --quiet --disable-pip-version-check`
  );
}

async function validateSemgrep(): Promise<boolean> {
  if (!fs.existsSync(SEMGREP_BIN)) return false;
  try {
    const version = await runCommand(`"${SEMGREP_BIN}" --version`);
    console.log(`[semgrep-ext] Semgrep ready: ${version}`);
    return true;
  } catch {
    return false;
  }
}

function injectPathIntoProcess(): void {
  const current = process.env.PATH ?? '';
  const parts = current.split(path.delimiter);
  if (!parts.includes(VENV_BIN)) {
    process.env.PATH = `${VENV_BIN}${path.delimiter}${current}`;
    console.log(`[semgrep-ext] Injected ${VENV_BIN} into process PATH`);
  }
}

async function persistPathToTerminals(): Promise<void> {
  const platformKey =
    os.platform() === 'win32'
      ? 'terminal.integrated.env.windows'
      : os.platform() === 'darwin'
      ? 'terminal.integrated.env.osx'
      : 'terminal.integrated.env.linux';

  const config = vscode.workspace.getConfiguration();
  const existing: Record<string, string> =
    config.get<Record<string, string>>(platformKey) ?? {};
  const oldPath = existing['PATH'] ?? '${env:PATH}';

  if (!oldPath.includes(VENV_BIN)) {
    existing['PATH'] = `${VENV_BIN}${path.delimiter}${oldPath}`;
    await config.update(platformKey, existing, vscode.ConfigurationTarget.Global);
  }
}

async function setupSemgrep(
  progress: vscode.Progress<{ message?: string }>
): Promise<boolean> {
  progress.report({ message: 'Looking for Python…' });
  const python = await findSystemPython();

  if (!python) {
    vscode.window
      .showErrorMessage(
        'Python 3.7+ is required but was not found. Please install Python and reload VS Code.',
        'Download Python'
      )
      .then((choice) => {
        if (choice === 'Download Python') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://python.org/downloads')
          );
        }
      });
    return false;
  }

  progress.report({ message: 'Creating isolated Python environment…' });
  try {
    await createVenv(python);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to create virtual environment: ${err}`
    );
    return false;
  }

  progress.report({ message: 'Installing SafeLens (this may take a minute)…' });
  try {
    await installSemgrepInVenv();
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to install SafeLens: ${err}`);
    return false;
  }

  progress.report({ message: 'Verifying installation…' });
  const ok = await validateSemgrep();
  if (!ok) {
    vscode.window.showErrorMessage(
      'SafeLens installed but failed to run. Please check your Python installation.'
    );
    return false;
  }

  injectPathIntoProcess();
  await persistPathToTerminals();
  return true;
}

// ─── Extension entry points ───────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext) {
  console.log('SafeLens extension activated');
  setContext(context);

  let sidebarProvider: SidebarProvider | undefined;

  // ── URI Handler for automatic API Key synchronization ──────────────────────
  class SafeLensUriHandler implements vscode.UriHandler {
    async handleUri(uri: vscode.Uri): Promise<void> {
      if (uri.path === '/auth') {
        const params = new URLSearchParams(uri.query);
        const token = params.get('token');
        if (token) {
          await context.secrets.store('safelensApiKey', token);
          vscode.window.showInformationMessage('SafeLens: API Key successfully synchronized from website!');
          if (sidebarProvider) {
            sidebarProvider.sendAuthState();
          }
        } else {
          vscode.window.showErrorMessage('SafeLens: Token parameter was missing in sync link.');
        }
      }
    }
  }

  context.subscriptions.push(
    vscode.window.registerUriHandler(new SafeLensUriHandler())
  );

  // ── API Key commands ────────────────────────────────────────────────────────
  const setApiKey = vscode.commands.registerCommand(
    'safelens.setApiKey',
    async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your SafeLens API Key',
        ignoreFocusOut: true,
        password: true,
      });
      if (apiKey) {
        await context.secrets.store('safelensApiKey', apiKey);
        vscode.window.showInformationMessage(
          'SafeLens API Key saved successfully!'
        );
        if (sidebarProvider) {
          sidebarProvider.sendAuthState();
        }
      }
    }
  );

  const setbackendUrl = vscode.commands.registerCommand(
    'safelens.setbackendUrl',
    async () => {
      const backendUrl = await vscode.window.showInputBox({
        prompt: 'Enter your SafeLens Backend URL (e.g. https://safelens-backend.onrender.com/api)',
        ignoreFocusOut: true,
        value: vscode.workspace.getConfiguration('safelens').get<string>('backendUrl') || '',
      });
      if (backendUrl) {
        await vscode.workspace.getConfiguration('safelens').update('backendUrl', backendUrl, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          'SafeLens Backend URL saved successfully!'
        );
      }
    }
  );


  const deleteApiKey = vscode.commands.registerCommand(
    'safelens.deleteApiKey',
    async () => {
      await context.secrets.delete('safelensApiKey');
      vscode.window.showInformationMessage(
        'SafeLens API Key deleted successfully!'
      );
      if (sidebarProvider) {
        sidebarProvider.sendAuthState();
      }
    }
  );

  context.subscriptions.push(setApiKey, deleteApiKey);

  // ── Semgrep setup ───────────────────────────────────────────────────────────
  const semgrepValid = await validateSemgrep();

  if (semgrepValid) {
    injectPathIntoProcess();
  } else {
    const choice = await vscode.window.showWarningMessage(
      'SafeLens kit is required by SafeLens. Install it now?',
      'Install',
      'Not Now'
    );

    if (choice === 'Install') {
      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Setting up Semgrep',
          cancellable: false,
        },
        (progress) => setupSemgrep(progress)
      );

      if (success) {
        vscode.window.showInformationMessage(
          'SafeLens kit installed successfully'
        );
      }
    }
  }

  // ── Core services ───────────────────────────────────────────────────────────
  const extensionPath = context.extensionPath;
  const diagnosticsCollection = vscode.languages.createDiagnosticCollection('safelens');
  const diagnosticsService = new DiagnosticsService(diagnosticsCollection);
  const semgrepService = new SemgrepService();
  const aiService = new AIService();

  aiService.hasToken().then((hasKey) => {
    if (hasKey) {
      console.log('SafeLens: API key found in secure storage.');
    } else {
      console.log('SafeLens: No API key found in secure storage (running in local-only mode).');
    }
  });


  // ── Sidebar & hover ─────────────────────────────────────────────────────────
  sidebarProvider = new SidebarProvider(
    context.extensionUri,
    aiService,
    diagnosticsService
  );
  // Give sidebar access to semgrepService so it can re-apply custom regex rules
  // instantly when the user adds/removes a rule — no full re-scan needed.
  sidebarProvider.setSemgrepService(semgrepService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'safelens.sidebarView',
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  const hoverProvider = new HoverProvider(diagnosticsService);
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider)
  );

  // ── Commands ────────────────────────────────────────────────────────────────
  const scanFileCmd   = new ScanFileCommand(semgrepService, diagnosticsService, sidebarProvider, extensionPath);
  const scanFolderCmd = new ScanFolderCommand(semgrepService, diagnosticsService, sidebarProvider, extensionPath);
  const clearCmd      = new ClearDiagnosticsCommand(diagnosticsService, sidebarProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand('safelens.scanFile',   () => scanFileCmd.execute()),
    vscode.commands.registerCommand('safelens.scanFolder', () => scanFolderCmd.execute()),
    vscode.commands.registerCommand('safelens.clearDiagnostics', () => clearCmd.execute()),
    vscode.commands.registerCommand('safelens.openSidebar', () => {
      vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
    }),
    vscode.commands.registerCommand('safelens._openFinding', (findingId: string) => {
      vscode.commands.executeCommand('workbench.view.extension.safelens-sidebar');
      setTimeout(() => {
        const result = diagnosticsService.getLastResult();
        if (!result) return;
        const finding = result.findings.find((f) => f.id === findingId);
        if (finding) sidebarProvider.openFinding(finding);
      }, 300);
    }),
    diagnosticsCollection
  );

  // ── Auto scan on save ───────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const config = vscode.workspace.getConfiguration('safelens');
      if (config.get('scanOnSave', false)) {
        await scanFileCmd.executeForDocument(doc);
      }
    })
  );

  // ── Terminal Error Monitor ──────────────────────────────────────────────────
  if (typeof (vscode.window as any).onDidWriteTerminalData === 'function') {
    context.subscriptions.push(
      (vscode.window as any).onDidWriteTerminalData((event: any) => {
        TerminalMonitorService.handleTerminalData(event);
      })
    );
  }
}

export function deactivate() {}

