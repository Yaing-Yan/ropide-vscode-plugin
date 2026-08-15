import * as vscode from 'vscode';

/**
 * 侧边栏（Activity Bar）启动面板。
 * 通过它可以在当前窗口内新建 / 打开 .rop 文件，无需额外窗口。
 */
export class RopideLauncherProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ropide.launcher';

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: { type?: string }) => {
      if (msg.type === 'new') {
        void vscode.commands.executeCommand('ropide.newFile');
      } else if (msg.type === 'open') {
        void vscode.commands.executeCommand('ropide.openFile');
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --fg: var(--vscode-foreground, #ccc);
      --muted: var(--vscode-descriptionForeground, #9d9d9d);
      --accent: var(--vscode-focusBorder, #007acc);
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #fff);
      --border: var(--vscode-panel-border, #3c3c3c);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 10px;
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--fg);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .brand svg { width: 20px; height: 20px; color: var(--accent); }
    .brand .name { font-weight: 700; font-size: 14px; }
    .subtitle { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 0 0 14px; }
    button {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 7px 10px;
      margin-bottom: 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--btn-bg);
      color: var(--btn-fg);
      cursor: pointer;
      font-size: 13px;
      font-family: inherit;
    }
    button:hover { filter: brightness(1.1); }
    button svg { width: 15px; height: 15px; }
    .hint { color: var(--muted); font-size: 11px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="brand">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9.5h8M8 14.5h8M9.5 4v2.2M14.5 4v2.2M9.5 17.8V20M14.5 17.8V20M4 9.5h2.2M4 14.5h2.2M17.8 9.5H20M17.8 14.5H20" stroke-linecap="round"/></svg>
    <span class="name">RopIDE</span>
  </div>
  <p class="subtitle">为 CASIO fx-991 CN X 编写的 ROP 程序。</p>
  <button id="btnNew">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
    新建 .rop 文件
  </button>
  <button id="btnOpen">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    打开 .rop 文件
  </button>
  <p class="hint">新建 / 打开后会在当前窗口以 RopIDE 编辑器打开，不会弹出额外窗口。</p>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('btnNew').addEventListener('click', () => vscode.postMessage({ type: 'new' }));
    document.getElementById('btnOpen').addEventListener('click', () => vscode.postMessage({ type: 'open' }));
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
