# SafeLens - Your AI Security Assistant

SafeLens brings AI-powered security review directly into VS Code. It scans files and workspaces, highlights vulnerable lines, explains findings, and helps you fix issues through an interactive AI chat.

## Key Features

* **Inline markers:** Identify vulnerable lines with severity-based editor diagnostics.
* **AI explanations:** Get practical explanations, attack scenarios, and fix guidance.
* **Security sidebar:** Review findings, summaries, charts, and remediation details.
* **Interactive chat:** Ask questions about scan results and get focused help.

## Getting Started

1. Install the extension from the VS Code Marketplace.
2. Visit [SafeLens Dashboard](https://safelens-three.vercel.app) and log in.
3. Generate an extension API key from the dashboard.
4. In VS Code, open the Command Palette and run **SafeLens: Set API Key**.
5. Paste your generated key and start scanning.

## Usage

| Action | Instruction |
| :--- | :--- |
| Scan current file | `Ctrl+Shift+P` -> **SafeLens: Scan Current File** |
| Scan workspace | `Ctrl+Shift+P` -> **SafeLens: Scan Workspace Folder** |
| View findings | Click the SafeLens icon in the Activity Bar |
| See inline explanation | Hover over any marked line in your editor |
| Full detail and fix | Click a finding in the SafeLens sidebar |
| Chat with AI | Use the Chat tab in the sidebar |
| Clear markers | `Ctrl+Shift+P` -> **SafeLens: Clear All Markers** |

## Production URLs

Dashboard: https://safelens-three.vercel.app

Backend API: https://safelens-backend.onrender.com/api

