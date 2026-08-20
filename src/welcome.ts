import * as vscode from 'vscode';
import { fetchMarketList, fetchMarketItem, MarketItem } from './market';
import { serializeRopDocument } from './rop';
import { RopEditorProvider } from './ropEditorProvider';

/** 首次安装 / 重装后显示欢迎页。 */
export function showWelcome(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'ropide.welcome',
    'RopIDE',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = getWelcomeHtml();
  panel.webview.onDidReceiveMessage((msg: { type?: string; url?: string; id?: number | string; name?: string }) => {
    if (msg.type === 'open' && typeof msg.url === 'string') {
      void vscode.env.openExternal(vscode.Uri.parse(msg.url));
      return;
    }
    if (msg.type === 'command' && typeof msg.url === 'string') {
      void vscode.commands.executeCommand(msg.url);
      return;
    }
    if (msg.type === 'market:list') {
      void (async () => {
        const r = await fetchMarketList();
        panel.webview.postMessage(
          'error' in r
            ? { type: 'market:list-result', error: r.error }
            : { type: 'market:list-result', items: r.items }
        );
      })();
      return;
    }
    if (msg.type === 'market:get') {
      void handleWelcomeMarketDownload(msg.id ?? '', msg.name || 'program');
      return;
    }
  });
  context.subscriptions.push(panel);
}

async function handleWelcomeMarketDownload(id: number | string, name: string): Promise<void> {
  const r = await fetchMarketItem(id);
  if ('error' in r) {
    void vscode.window.showErrorMessage(`下载失败：${r.error}`);
    return;
  }
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const safeName =
    name
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\.rop$/i, '') || 'program';
  const defaultUri = workspaceFolder
    ? vscode.Uri.joinPath(workspaceFolder, `${safeName}.rop`)
    : vscode.Uri.file(`${safeName}.rop`);
  const uri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: { 'Rop File': ['rop'] },
    saveLabel: 'Save & Open',
    title: '保存下载的程序',
  });
  if (!uri) return;
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(serializeRopDocument(r.data), 'utf8'));
  } catch (e) {
    void vscode.window.showErrorMessage(`写入失败：${(e as Error).message}`);
    return;
  }
  await vscode.commands.executeCommand('vscode.openWith', uri, RopEditorProvider.viewType);
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

    /* ---------- 程序广场（居中弹窗，卡片网格） ---------- */
    .market-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.45);
      padding: 20px;
      box-sizing: border-box;
    }
    .market-overlay[hidden] { display: none; }
    .market-panel {
      width: min(1080px, 96vw);
      height: 85vh;
      display: flex;
      flex-direction: column;
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .market-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
    }
    .market-header h2 { margin: 0; font-size: 15px; flex: 0 0 auto; }
    .market-header .spacer { flex: 1 1 auto; }
    .market-search {
      flex: 1 1 auto;
      min-width: 160px;
      padding: 5px 8px;
      font-size: 13px;
      font-family: inherit;
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
    }
    .market-close {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 16px;
      cursor: pointer;
    }
    .market-close:hover { background: var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31)); }
    .market-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px; }
    .market-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
      align-content: start;
    }
    .market-section {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      margin-top: 4px;
    }
    .market-grid > .market-empty { grid-column: 1 / -1; text-align: center; padding: 30px 0; color: var(--vscode-descriptionForeground, #9d9d9d); font-size: 13px; }
    .market-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 6px;
      padding: 10px 12px;
      min-width: 0;
    }
    .market-card.featured { border-color: var(--vscode-button-background, #0e639c); }
    .market-card-title {
      font-weight: 700;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .market-star { color: #f08c00; }
    .market-card-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    .market-card-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .market-card-desc {
      font-size: 11px;
      opacity: 0.85;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .market-dl {
      align-self: flex-end;
      padding: 3px 10px;
      font-size: 12px;
      font-family: inherit;
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-background, #0e639c);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .market-dl:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    .market-dl:disabled { opacity: 0.5; cursor: default; }
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
    <button class="secondary" id="btnMarket">程序广场</button>
  </div>

  <div class="market-overlay" id="marketOverlay" hidden>
    <div class="market-panel">
      <div class="market-header">
        <h2>程序广场</h2>
        <div class="spacer"></div>
        <input class="market-search" id="marketSearch" type="text" placeholder="搜索 name / author / model / desc…" />
        <button class="market-close" id="btnCloseMarket" title="关闭">×</button>
      </div>
      <div class="market-body">
        <div class="market-grid" id="marketGrid"></div>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>Copyright © 2026 <a href="https://github.com/Yaing-Yan/ropide-vscode-plugin">RopIDE for VS Code</a> @Yaing-Yan，使用了Vibe Coding技术</div>
    <div>Copyright © 2026 <a href="https://github.com/WulanOVO/rop-ide">RopIDE</a> @wlyibo</div>
    <div><a href="https://ropide.pages.dev/">RopIDE网页版</a>·<a href="https://rop-ide2.pages.dev/">xe1010ce20的ROP IDE 2nd</a></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    /* ---------- 链接 / 命令按钮 ---------- */
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

    /* ---------- 程序广场（居中弹窗） ---------- */
    const overlay = document.getElementById('marketOverlay');
    const grid = document.getElementById('marketGrid');
    const search = document.getElementById('marketSearch');
    let items = [];
    let downloadingId = null;

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[c]);
    }

    function openMarket() {
      overlay.hidden = false;
      search.value = '';
      items = [];
      downloadingId = null;
      grid.innerHTML = '<div class="market-empty">加载中…</div>';
      vscode.postMessage({ type: 'market:list' });
      search.focus();
    }
    function closeMarket() { overlay.hidden = true; }

    document.getElementById('btnMarket').addEventListener('click', openMarket);
    document.getElementById('btnCloseMarket').addEventListener('click', closeMarket);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeMarket(); });
    search.addEventListener('input', renderGrid);

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-download]');
      if (!btn) return;
      const id = btn.dataset.download;
      downloadingId = String(id);
      renderGrid();
      const it = items.find((x) => String(x.id) === String(id));
      vscode.postMessage({ type: 'market:get', id, name: it ? it.name : '' });
    });

    function renderGrid() {
      const q = search.value.trim().toLowerCase();
      const filtered = items.filter((it) => {
        if (!q) return true;
        return [it.name, it.author, it.model, it.description].some((s) =>
          String(s || '').toLowerCase().includes(q)
        );
      });
      const featured = filtered.filter((it) => it.featured);
      const normal = filtered.filter((it) => !it.featured);

      if (!filtered.length) {
        grid.innerHTML = '<div class="market-empty">' + (q ? '没有匹配的程序' : '程序广场空空如也') + '</div>';
        return;
      }

      const card = (it, isFeatured) => {
        const idStr = String(it.id);
        const busy = downloadingId === idStr;
        return (
          '<div class="market-card ' + (isFeatured ? 'featured' : '') + '">' +
            '<div class="market-card-title">' + esc(it.name || '(未命名)') +
              (isFeatured ? ' <span class="market-star">★</span>' : '') + '</div>' +
            '<div class="market-card-meta">' +
              '<span>作者：' + esc(it.author || '-') + '</span>' +
              '<span>机型：' + esc(it.model || '-') + '</span>' +
            '</div>' +
            (it.description ? '<div class="market-card-desc">' + esc(it.description) + '</div>' : '') +
            '<button class="market-dl" data-download="' + esc(idStr) + '"' + (busy ? ' disabled' : '') + '>' +
              (busy ? '下载中…' : '下载') + '</button>' +
          '</div>'
        );
      };

      let html = '';
      if (featured.length) {
        html += '<div class="market-section">精选</div>' + featured.map((it) => card(it, true)).join('');
      }
      if (normal.length) {
        if (featured.length) html += '<div class="market-section">全部</div>';
        html += normal.map((it) => card(it, false)).join('');
      }
      grid.innerHTML = html;
    }

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'market:list-result') {
        if (msg.error) {
          grid.innerHTML = '<div class="market-empty">加载失败：' + esc(msg.error) + '</div>';
        } else {
          items = Array.isArray(msg.items) ? msg.items : [];
          renderGrid();
        }
      } else if (msg.type === 'market:get-result') {
        downloadingId = null;
        renderGrid();
      }
    });
  </script>
</body>
</html>`;
}
