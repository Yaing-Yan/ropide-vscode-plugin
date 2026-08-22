import * as vscode from 'vscode';
import {
  RopDocumentData,
  parseRopDocument,
  serializeRopDocument,
  newRopDocument,
  parseGadgetsJson,
  parseDisas,
  disasSnippet,
} from './rop';
import { fetchMarketItem, fetchMarketChallenge, publishToMarket } from './market';
import { emuWrite, parseHexBytes } from './emu';
import { showWelcome } from './welcome';
import { closeTabIfOpen } from './tabs';
import { marketUnread } from './marketState';

interface EditorSession {
  document: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  data: RopDocumentData;
  writing: boolean;
  valid: boolean;
  error: string;
  disasMap: Map<number, string[]> | null;
  disasFile: string;
}

interface SidecarConfig {
  disasPath?: string;
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
  /** 路径 -> 已解析的 disas 地址映射（避免对同一大文件重复解析） */
  private readonly disasCache = new Map<string, Map<number, string[]>>();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.name = 'RopIDE Address';
    this.statusBar.text = '$(location) RopIDE';
    this.statusBar.tooltip = '光标处的左/右地址（由 RopIDE 计算）';
    this.statusBar.show();
    context.subscriptions.push(this.statusBar);

    // 全局设置（语言 / 展示汇编开关）变化 → 同步到所有编辑器
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('ropide.showGadgetDisasm') || e.affectsConfiguration('ropide.language') || e.affectsConfiguration('ropide.showGadgetHoverDisasm')) {
          this.pushGlobalSettingsToAll();
        }
      })
    );
  }

  private globalSettings(): { language: string; showGadgetDisasm: boolean; showGadgetHoverDisasm: boolean; showWelcomeOnStartup: boolean } {
    const cfg = vscode.workspace.getConfiguration('ropide');
    return {
      language: cfg.get<string>('language', 'zh-CN'),
      showGadgetDisasm: cfg.get<boolean>('showGadgetDisasm', false),
      showGadgetHoverDisasm: cfg.get<boolean>('showGadgetHoverDisasm', false),
      showWelcomeOnStartup: cfg.get<boolean>('showWelcomeOnStartup', true),
    };
  }

  private sessionSettings(s: EditorSession) {
    return {
      ...this.globalSettings(),
      disasFile: s.disasFile,
      disasLoaded: s.disasMap !== null,
    };
  }

  private pushGlobalSettingsToAll(): void {
    const g = this.globalSettings();
    for (const s of this.sessions.values()) {
      s.panel.webview.postMessage({ type: 'settings', ...g, disasFile: s.disasFile, disasLoaded: s.disasMap !== null });
    }
  }

  private pushSettings(s: EditorSession): void {
    s.panel.webview.postMessage({ type: 'settings', ...this.sessionSettings(s) });
  }

  /** .rop 文件旁的隐藏配置 sidecar：<name>.ropide.json */
  private sidecarUri(ropUri: vscode.Uri): vscode.Uri {
    const base = ropUri.path.replace(/\.rop$/i, '');
    return ropUri.with({ path: base + '.ropide.json' });
  }

  private async readSidecar(ropUri: vscode.Uri): Promise<SidecarConfig> {
    try {
      const bytes = await vscode.workspace.fs.readFile(this.sidecarUri(ropUri));
      const obj = JSON.parse(Buffer.from(bytes).toString('utf8'));
      return typeof obj === 'object' && obj ? (obj as SidecarConfig) : {};
    } catch {
      return {};
    }
  }

  private async writeSidecar(ropUri: vscode.Uri, cfg: SidecarConfig): Promise<void> {
    const uri = this.sidecarUri(ropUri);
    const bytes = Buffer.from(JSON.stringify(cfg, null, 2), 'utf8');
    await vscode.workspace.fs.writeFile(uri, bytes);
  }

  /** 读取（必要时解析）指定 disas 文件，返回地址映射；失败返回 null。 */
  private async loadDisasMap(disasPath: string): Promise<Map<number, string[]> | null> {
    const cached = this.disasCache.get(disasPath);
    if (cached) return cached;
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(disasPath));
      const text = Buffer.from(bytes).toString('utf8');
      const map = parseDisas(text);
      this.disasCache.set(disasPath, map);
      return map;
    } catch {
      return null;
    }
  }

  /** 根据 sidecar 加载该 .rop 文件对应的 _disas 到 session。 */
  private async loadSessionDisas(session: EditorSession): Promise<void> {
    const cfg = await this.readSidecar(session.document.uri);
    const p = cfg.disasPath;
    if (p) {
      const map = await this.loadDisasMap(p);
      if (map) {
        session.disasMap = map;
        session.disasFile = p.split(/[\\/]/).pop() || p;
      } else {
        // 路径失效：清空，但 sidecar 保留（用户可能只是临时移动了文件）
        session.disasMap = null;
        session.disasFile = '';
      }
    }
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
      disasMap: null,
      disasFile: '',
    };
    this.sessions.set(uriKey, session);
    this.lastActiveUri = uriKey;

    // 市场未读广播：任意视图打开广场清零时，同步刷新本编辑器的红点。
    const sendUnread = (unread: number): void => {
      webviewPanel.webview.postMessage({ type: 'market:unread', unread });
    };
    marketUnread.subscribe(sendUnread);

    // 按 sidecar 配置加载该 .rop 文件自己的 _disas（不依赖进程生命周期）。
    void this.loadSessionDisas(session).then(() => this.pushSettings(session));

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
      marketUnread.unsubscribe(sendUnread);
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
          injectAddress: this.context.globalState.get<string>('ropide.injectAddress', ''),
          launcher: this.context.globalState.get<string>('ropide.launcher', ''),
          launcherAddr: this.context.globalState.get<string>('ropide.launcherAddr', 'D180'),
          settings: this.sessionSettings(session),
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
      case 'market:list': {
        void (async () => {
          const r = await marketUnread.open();
          session.panel.webview.postMessage(
            'error' in r
              ? { type: 'market:list-result', error: r.error }
              : { type: 'market:list-result', items: r.items }
          );
        })();
        break;
      }
      case 'market:unread-check': {
        void (async () => {
          const unread = await marketUnread.check();
          session.panel.webview.postMessage({ type: 'market:unread', unread });
        })();
        break;
      }
      case 'market:get': {
        const id = message.id as number | string;
        const name = typeof message.name === 'string' ? message.name : 'program';
        void (async () => {
          const r = await fetchMarketItem(id);
          if ('error' in r) {
            session.panel.webview.postMessage({ type: 'market:get-result', id, error: r.error });
            return;
          }
          // 让用户指定保存路径，再打开。
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
          const defaultUri = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder, `${sanitizeFileName(name)}.rop`)
            : vscode.Uri.file(`${sanitizeFileName(name)}.rop`);
          const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'Rop File': ['rop'] },
            saveLabel: 'Save & Open',
            title: '保存下载的程序',
          });
          if (!uri) {
            session.panel.webview.postMessage({ type: 'market:get-result', id, cancelled: true });
            return;
          }
          try {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(serializeRopDocument(r.data), 'utf8'));
          } catch (e) {
            session.panel.webview.postMessage({
              type: 'market:get-result',
              id,
              error: `写入失败：${(e as Error).message}`,
            });
            return;
          }
          // 覆盖保存同名文件时，已打开的标签页不会自动重新读取磁盘内容，需先关闭再打开。
          await closeTabIfOpen(uri);
          await vscode.commands.executeCommand('vscode.openWith', uri, RopEditorProvider.viewType);
          session.panel.webview.postMessage({ type: 'market:get-result', id, ok: true });
        })();
        break;
      }
      case 'market:challenge': {
        void (async () => {
          const r = await fetchMarketChallenge();
          session.panel.webview.postMessage(
            'error' in r
              ? { type: 'market:challenge-result', ok: false, error: r.error }
              : {
                  type: 'market:challenge-result',
                  ok: true,
                  token: r.challenge.token,
                  offset: r.challenge.offset,
                }
          );
        })();
        break;
      }
      case 'market:publish': {
        const name = String(message.name || '');
        const author = String(message.author || '');
        const model = String(message.model || '');
        const description = String(message.description || '');
        const challengeToken = typeof message.challengeToken === 'string' ? message.challengeToken : '';
        const challengeAnswer = typeof message.challengeAnswer === 'string' ? message.challengeAnswer : '';
        void (async () => {
          const r = await publishToMarket({
            name,
            author,
            model,
            description,
            data: serializeRopDocument(session.data),
            timestamp: Date.now(),
            challengeToken,
            challengeAnswer,
          });
          session.panel.webview.postMessage(
            r.ok
              ? { type: 'market:publish-result', ok: true }
              : { type: 'market:publish-result', ok: false, code: r.code, error: r.error }
          );
        })();
        break;
      }
      case 'emu:write': {
        const address = Number(message.address);
        const hex = String(message.hex || '');
        void (async () => {
          if (!Number.isFinite(address)) {
            session.panel.webview.postMessage({ type: 'emu:write-result', ok: false, error: '地址无效' });
            return;
          }
          const bytes = parseHexBytes(hex);
          if (bytes === null) {
            session.panel.webview.postMessage({ type: 'emu:write-result', ok: false, error: '十六进制数据无效' });
            return;
          }
          const port = vscode.workspace
            .getConfiguration('ropide')
            .get<number>('casioemuMcpPort', 3001);
          const r = await emuWrite(address, bytes, { port });
          session.panel.webview.postMessage(
            r.ok
              ? { type: 'emu:write-result', ok: true }
              : { type: 'emu:write-result', ok: false, code: r.code, error: r.error }
          );
        })();
        break;
      }
      case 'persist': {
        const key = String(message.key || '');
        if (key === 'injectAddress' || key === 'launcher' || key === 'launcherAddr') {
          void this.context.globalState.update(`ropide.${key}`, String(message.value ?? ''));
        }
        break;
      }
      case 'settings:set': {
        const key = String(message.key || '');
        const value = message.value;
        void (async () => {
          const cfg = vscode.workspace.getConfiguration('ropide');
          if (key === 'showGadgetDisasm') {
            await cfg.update('showGadgetDisasm', !!value, vscode.ConfigurationTarget.Global);
          } else if (key === 'language') {
            await cfg.update('language', String(value), vscode.ConfigurationTarget.Global);
          } else if (key === 'showGadgetHoverDisasm') {
            await cfg.update('showGadgetHoverDisasm', !!value, vscode.ConfigurationTarget.Global);
          } else if (key === 'showWelcomeOnStartup') {
            await cfg.update('showWelcomeOnStartup', !!value, vscode.ConfigurationTarget.Global);
          }
          this.pushGlobalSettingsToAll();
        })();
        break;
      }
      case 'disas:choose': {
        void (async () => {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Disassembly (_disas)': ['txt', 'disas', 'asm', '*'] },
            title: '选择 _disas 反汇编文件',
          });
          if (!uris || uris.length === 0) {
            session.panel.webview.postMessage({ type: 'disas:load-result', cancelled: true });
            return;
          }
          try {
            const disasPath = uris[0].fsPath;
            const bytes = await vscode.workspace.fs.readFile(uris[0]);
            const text = Buffer.from(bytes).toString('utf8');
            session.disasMap = parseDisas(text);
            this.disasCache.set(disasPath, session.disasMap);
            session.disasFile = disasPath.split(/[\\/]/).pop() || disasPath;
            // 路径写入该 .rop 文件旁的隐藏配置（<name>.ropide.json），重启后仍然有效。
            await this.writeSidecar(session.document.uri, { disasPath });
            this.pushSettings(session);
            session.panel.webview.postMessage({
              type: 'disas:load-result',
              ok: true,
              file: session.disasFile,
            });
          } catch (e) {
            session.panel.webview.postMessage({
              type: 'disas:load-result',
              ok: false,
              error: (e as Error).message,
            });
          }
        })();
        break;
      }
      case 'gadgets:disasm': {
        const addrStr = String(message.addr || '').replace(/^0x/i, '');
        const addr = parseInt(addrStr, 16);
        if (!session.disasMap || !Number.isFinite(addr)) {
          session.panel.webview.postMessage({
            type: 'gadgets:disasm-result',
            addr: addrStr,
            error: session.disasMap ? '地址无效' : '尚未加载 _disas 文件',
          });
          return;
        }
        const lines = disasSnippet(session.disasMap, addr);
        session.panel.webview.postMessage(
          lines
            ? { type: 'gadgets:disasm-result', addr: addrStr, lines }
            : { type: 'gadgets:disasm-result', addr: addrStr, error: '该地址没有反汇编记录' }
        );
        break;
      }
      case 'about': {
        showWelcome(this.context);
        break;
      }
      case 'gadgets:import': {
        void (async () => {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Gadgets JSON': ['json'] },
            title: '导入 gadgets',
          });
          if (!uris || uris.length === 0) {
            session.panel.webview.postMessage({ type: 'gadgets:import-result', cancelled: true });
            return;
          }
          try {
            const bytes = await vscode.workspace.fs.readFile(uris[0]);
            const text = Buffer.from(bytes).toString('utf8');
            const r = parseGadgetsJson(text);
            if (!r.ok) {
              session.panel.webview.postMessage({ type: 'gadgets:import-result', ok: false, error: r.error });
              return;
            }
            const mode = await vscode.window.showQuickPick(
              ['覆盖（替换全部）', '补全（仅添加缺失的）'],
              { placeHolder: '选择导入方式', title: '导入 gadgets' }
            );
            if (!mode) {
              session.panel.webview.postMessage({ type: 'gadgets:import-result', cancelled: true });
              return;
            }
            session.panel.webview.postMessage({
              type: 'gadgets:import-result',
              ok: true,
              gadgets: r.gadgets,
              mode: mode.startsWith('覆盖') ? 'replace' : 'merge',
            });
          } catch (e) {
            session.panel.webview.postMessage({ type: 'gadgets:import-result', ok: false, error: (e as Error).message });
          }
        })();
        break;
      }
      case 'gadgets:export': {
        const gadgets = Array.isArray(message.gadgets)
          ? (message.gadgets as RopDocumentData['gadgets'])
          : session.data.gadgets;
        void (async () => {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
          const defaultUri = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder, 'gadgets.json')
            : undefined;
          const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'Gadgets JSON': ['json'] },
            saveLabel: 'Export',
            title: '导出 gadgets',
          });
          if (!uri) {
            session.panel.webview.postMessage({ type: 'gadgets:export-result', cancelled: true });
            return;
          }
          try {
            await vscode.workspace.fs.writeFile(
              uri,
              Buffer.from(JSON.stringify(gadgets, null, 2), 'utf8')
            );
            session.panel.webview.postMessage({ type: 'gadgets:export-result', ok: true });
          } catch (e) {
            session.panel.webview.postMessage({
              type: 'gadgets:export-result',
              ok: false,
              error: (e as Error).message,
            });
          }
        })();
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

  /** 让某个面板执行动作（编译 / 显示 gadgets / 程序广场等）。 */
  postToActive(type: 'compile' | 'show-gadgets' | 'show-market'): void {
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

function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.rop$/i, '');
  return cleaned || 'program';
}
