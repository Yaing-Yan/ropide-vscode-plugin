import * as vscode from 'vscode';

/** 首次安装 / 重装后显示欢迎页。 */
export function showWelcome(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'ropide.welcome',
    'RopIDE',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = getWelcomeHtml();
  panel.webview.onDidReceiveMessage((msg: { type?: string; url?: string }) => {
    if (msg.type === 'open' && typeof msg.url === 'string') {
      void vscode.env.openExternal(vscode.Uri.parse(msg.url));
      return;
    }
    if (msg.type === 'command' && typeof msg.url === 'string') {
      void vscode.commands.executeCommand(msg.url);
    }
  });
  context.subscriptions.push(panel);
}

function getWelcomeHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { height: 100%; margin: 0; }
    body {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      padding: 24px;
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground, #cccccc);
      background: var(--vscode-editor-background, #1e1e1e);
    }
    .title {
      text-align: center;
      font-weight: bold;
      font-size: 1.7em;
      margin-top: 12vh;
    }
    .body {
      text-align: center;
      font-size: 1.1em;
      margin-top: 18px;
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 28px;
      flex-wrap: wrap;
    }
    .actions button {
      padding: 8px 18px;
      font-size: 13px;
      font-family: inherit;
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-background, #0e639c);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .actions button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .actions button.secondary {
      color: var(--vscode-button-secondaryForeground, #ccc);
      background: var(--vscode-button-secondaryBackground, #3a3d41);
    }
    .actions button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
    .footer {
      margin-top: auto;
      text-align: center;
      font-size: 0.85em;
      line-height: 1.9;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      padding-bottom: 8px;
    }
    a {
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
      cursor: pointer;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="title">欢迎使用RopIDE for VS Code</div>
  <div class="body">打开一个.rop文件以继续。</div>
  <div class="actions">
    <button data-command="ropide.newFile">新建一个ROP文件</button>
    <button class="secondary" data-command="ropide.openFile">打开ROP文件</button>
    <button class="secondary" data-command="ropide.openMarket">程序广场</button>
  </div>
  <div class="footer">
    <div>Copyright © 2026 <a href="https://github.com/Yaing-Yan/ropide-vscode-plugin">RopIDE for VS Code</a> @Yaing-Yan，使用了Vibe Coding技术</div>
    <div>Copyright © 2026 <a href="https://github.com/WulanOVO/rop-ide">RopIDE</a> @wlyibo</div>
    <div><a href="https://ropide.pages.dev/">RopIDE网页版</a>·<a href="https://rop-ide2.pages.dev/">xe1010ce20的ROP IDE 2nd</a></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-command]');
      if (btn) {
        vscode.postMessage({ type: 'command', url: btn.dataset.command });
        return;
      }
      const a = e.target.closest('a');
      if (a && a.href) {
        e.preventDefault();
        vscode.postMessage({ type: 'open', url: a.href });
      }
    });
  </script>
</body>
</html>`;
}
