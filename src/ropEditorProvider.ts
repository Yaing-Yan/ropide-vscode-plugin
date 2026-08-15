import * as vscode from 'vscode';
import {
  RopDocumentData,
  parseRopDocument,
  serializeRopDocument,
  newRopDocument,
} from './rop';

interface EditorSession {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  data: RopDocumentData;
  writing: boolean;
  valid: boolean;
  error: string;
}

/**
 * 负责把 .rop 的 JSON 文档映射到 Webview 编辑器：
 *   - 打开时把 input / gadgets / 地址 发给 Webview
 *   - Webview 编辑 input 时，把完整 JSON 写回文档
 *   - 状态栏显示光标处的左/右地址
 */
export class RopEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'ropide.rop';

  private readonly sessions = new Map<string, EditorSession>();
  private readonly statusBar: vscode.StatusBarItem;
  private lastActiveUri: string | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.name = 'RopIDE Address';
    this.statusBar.text = '$(location) RopIDE';
    this.statusBar.tooltip = '光标处的左/右地址（由 RopIDE 计算）';
    this.statusBar.show();
    context.subscriptions.push(this.statusBar);
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const parsed = parseRopDocument(document.getText());
    const data = parsed.ok ? parsed.data : newRopDocument();
    const uriKey = document.uri.toString();

    const session: EditorSession = {
      document,
      panel: webviewPanel,
      data,
      writing: false,
      valid: parsed.ok,
      error: parsed.ok ? '' : parsed.error,
    };
    this.sessions.set(uriKey, session);
    this.lastActiveUri = uriKey;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Webview 就绪后再发送初始数据（避免消息早于监听器注册）。
    const onMessage = webviewPanel.webview.onDidReceiveMessage((message) =>
      this.handleMessage(session, message)
    );

    // 外部改动（撤销、另一个编辑器、磁盘刷新）→ 同步回 Webview。
    const onChange = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== uriKey) return;
      if (session.writing) return; // 自己写回导致的变更，忽略。
      const latest = parseRopDocument(e.document.getText());
      if (!latest.ok) {
        session.valid = false;
        session.error = latest.error;
        webviewPanel.webview.postMessage({ type: 'invalid', error: latest.error });
        return;
      }
      session.valid = true;
      session.error = '';
      session.data = latest.data;
      webviewPanel.webview.postMessage({ type: 'update', ...latest.data });
    });

    const onDispose = webviewPanel.onDidDispose(() => {
      this.sessions.delete(uriKey);
      if (this.lastActiveUri === uriKey) this.lastActiveUri = undefined;
      onMessage.dispose();
      onChange.dispose();
      onDispose.dispose();
    });

    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this.lastActiveUri = uriKey;
      }
    });
  }

  private handleMessage(session: EditorSession, message: Record<string, unknown>): void {
    switch (message.type) {
      case 'ready': {
        const fileName = session.document.uri.fsPath.split(/[\\/]/).pop() || 'untitled.rop';
        session.panel.webview.postMessage({
          type: 'init',
          ...session.data,
          fileName,
          valid: session.valid,
          error: session.error,
        });
        break;
      }
      case 'content': {
        const data: RopDocumentData = {
          input: typeof message.input === 'string' ? message.input : session.data.input,
          gadgets: Array.isArray(message.gadgets) ? (message.gadgets as RopDocumentData['gadgets']) : session.data.gadgets,
          leftStartAddress:
            typeof message.leftStartAddress === 'string'
              ? message.leftStartAddress
              : session.data.leftStartAddress,
          rightStartAddress:
            typeof message.rightStartAddress === 'string'
              ? message.rightStartAddress
              : session.data.rightStartAddress,
          ideVersion: session.data.ideVersion,
        };
        session.data = data;
        this.writeBack(session);
        break;
      }
      case 'cursor': {
        const left = typeof message.left === 'string' ? message.left : '';
        const right = typeof message.right === 'string' ? message.right : '';
        if (left && right) {
          this.statusBar.text = `$(location) L:${left}  R:${right}`;
          this.statusBar.tooltip = `左侧地址 0x${left} · 右侧地址 0x${right}`;
        }
        break;
      }
      case 'new': {
        void vscode.commands.executeCommand('ropide.newFile');
        break;
      }
      default:
        break;
    }
  }

  private writeBack(session: EditorSession): void {
    if (!session.valid) return; // 文件不是合法 JSON 时不写回，避免覆盖原内容。
    const json = serializeRopDocument(session.data);
    const doc = session.document;
    const text = doc.getText();
    const lines = text.split('\n');
    const lastLine = Math.max(lines.length - 1, 0);
    const lastChar = lines[lines.length - 1].length;

    session.writing = true;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(doc.uri, new vscode.Range(0, 0, lastLine, lastChar), json);
    void (async () => {
      try {
        await vscode.workspace.applyEdit(edit);
      } finally {
        session.writing = false;
      }
    })();
  }

  /** 让某个面板执行动作（编译 / 显示 gadgets 等）。 */
  postToActive(type: 'compile' | 'show-gadgets'): void {
    let session: EditorSession | undefined;
    if (this.lastActiveUri) {
      session = this.sessions.get(this.lastActiveUri);
    }
    if (!session) {
      session = this.sessions.values().next().value as EditorSession | undefined;
    }
    if (!session) {
      void vscode.window.showInformationMessage('请先打开一个 .rop 文件。');
      return;
    }
    session.panel.webview.postMessage({ type });
  }

  private getHtml(webview: vscode.Webview): string {
    const mediaUri = (name: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', name));

    const css = mediaUri('editor.css');
    const compiler = mediaUri('compiler.js');
    const main = mediaUri('editor.js');

    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${css}" />
  <title>RopIDE</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${compiler}"></script>
  <script nonce="${nonce}" src="${main}"></script>
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
