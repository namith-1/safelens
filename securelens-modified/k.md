# 🛡️ SafeLens — AI Security Scanner for VS Code

SafeLens integrates **Semgrep** and **Claude AI** directly into VS Code to give you:

- **Inline markers** on vulnerable lines (squiggly underlines by severity)
- **Hover tooltips** with AI-generated brief explanations + real-world attack scenarios
- **Sidebar panel** with full findings list, detailed AI explanations, and visualisations
- **Chat assistant** to ask anything about your vulnerabilities

---

## Requirements

1. **Semgrep** installed via pip:
   ```bash
   pip install semgrep
   ```

2. **Google Gemini API key** — 100% free, no billing required:
   1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   2. Sign in with your Google account → click **Create API key**
   3. Paste the key in VS Code settings:
   ```
   SafeLens → Gemini Api Key
   ```
   > Free tier: **15 requests/min, 1 million tokens/day** — more than enough for daily dev use.

---

## Usage

| Action | How |
|--------|-----|
| Scan current file | `Ctrl+Shift+P` → **SafeLens: Scan Current File** or click 📄 in sidebar |
| Scan workspace folder | `Ctrl+Shift+P` → **SafeLens: Scan Workspace Folder** or click 📁 |
| View findings | Click the 🛡️ icon in the Activity Bar |
| See inline explanation | Hover over any underlined line |
| Full detail + fix | Click a finding in sidebar → Issues tab |
| Chat with AI | Use the 💬 Chat tab in the sidebar |
| View charts | Use the 📊 Charts tab |
| Clear all markers | **SafeLens: Clear All Markers** |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `safelens.geminiApiKey` | `""` | Your Google Gemini API key (free at aistudio.google.com) |
| `safelens.semgrepConfig` | `"auto"` | Semgrep ruleset (`auto`, `p/javascript`, `p/owasp-top-ten`, etc.) |
| `safelens.severityFilter` | `"ALL"` | Min severity to show: ALL / INFO / WARNING / ERROR |
| `safelens.scanOnSave` | `false` | Auto-scan on file save |

---

## Project Structure

```
src/
├── extension.ts          # Entry point, wires everything together
├── types.ts              # Shared TypeScript types
├── commands/
│   ├── scanFile.ts       # Scan current file command
│   ├── scanFolder.ts     # Scan workspace folder command
│   └── clearDiagnostics.ts
├── services/
│   ├── semgrepService.ts # Runs semgrep, parses JSON output
│   ├── aiService.ts      # Anthropic API calls (explain, summarize, chat)
│   └── diagnosticsService.ts  # VSCode diagnostic collection + brief cache
├── utils/
│   └── hoverProvider.ts  # Hover tooltip with AI brief
└── webview/
    ├── sidebarProvider.ts # Webview controller
    └── sidebarHTML.ts     # Full sidebar HTML/CSS/JS
```

---

## Development

```bash
npm install
npm run compile
# Then press F5 in VS Code to launch Extension Development Host
```
