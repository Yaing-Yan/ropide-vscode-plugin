import * as vscode from 'vscode';
import { fetchMarketList, fetchMarketItem, MarketItem } from './market';
import { serializeRopDocument } from './rop';
import { RopEditorProvider } from './ropEditorProvider';

type WelcomeLang = 'zh-CN' | 'en';

/* ---------------- 欢迎页 i18n（复用全局设置 ropide.language） ---------------- */
const WELCOME_STR: Record<WelcomeLang, Record<string, string>> = {
  'zh-CN': {
    title: '欢迎使用RopIDE for VS Code',
    subtitle: '打开一个.rop文件以继续。',
    newFile: '新建一个ROP文件',
    openFile: '打开ROP文件',
    market: '程序广场',
    marketTitle: '程序广场',
    closeTitle: '关闭',
    switchTo: '切换到英文',
    marketSearchPh: '搜索 name / author / model / desc…',
    featured: '精选',
    all: '全部',
    marketEmpty: '程序广场空空如也',
    noMarketMatch: '没有匹配的程序',
    loading: '加载中…',
    loadFail: '加载失败：',
    download: '下载',
    downloading: '下载中…',
    unnamed: '(未命名)',
    byAuthor: '作者：',
    byModel: '机型：',
  },
  en: {
    title: 'Welcome to RopIDE for VS Code',
    subtitle: 'Open a .rop file to continue.',
    newFile: 'New ROP File',
    openFile: 'Open ROP File',
    market: 'Market',
    marketTitle: 'Program Market',
    closeTitle: 'Close',
    switchTo: 'Switch to Chinese',
    marketSearchPh: 'Search name / author / model / desc…',
    featured: 'Featured',
    all: 'All',
    marketEmpty: 'The market is empty',
    noMarketMatch: 'No matching programs',
    loading: 'Loading…',
    loadFail: 'Load failed: ',
    download: 'Download',
    downloading: 'Downloading…',
    unnamed: '(unnamed)',
    byAuthor: 'Author: ',
    byModel: 'Model: ',
  },
};

function welcomeText(lang: WelcomeLang, key: string): string {
  const pack = WELCOME_STR[lang] || WELCOME_STR['zh-CN'];
  const v = pack[key];
  return v !== undefined ? v : (WELCOME_STR['zh-CN'][key] ?? key);
}

function currentLanguage(): WelcomeLang {
  const v = vscode.workspace.getConfiguration('ropide').get<string>('language', 'zh-CN');
  return v === 'en' ? 'en' : 'zh-CN';
}

/** 首次安装 / 重装后显示欢迎页。右上角语言按钮显示的是“将要切换到的语言”。 */
export function showWelcome(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'ropide.welcome',
    'RopIDE',
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  let lang: WelcomeLang = currentLanguage();
  panel.webview.html = getWelcomeHtml(lang);

  // 其它入口（设置面板 / 编辑器内）改变 ropide.language 时，欢迎页同步切换。
  const onConfigChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('ropide.language')) {
      const next = currentLanguage();
      if (next !== lang) {
        lang = next;
        panel.webview.html = getWelcomeHtml(lang);
      }
    }
  });

  panel.webview.onDidReceiveMessage((msg: { type?: string; lang?: string; url?: string; id?: number | string; name?: string }) => {
    if (msg.type === 'set-language' && (msg.lang === 'zh-CN' || msg.lang === 'en')) {
      const next: WelcomeLang = msg.lang;
      void (async () => {
        try {
          const cfg = vscode.workspace.getConfiguration('ropide');
          await cfg.update('language', next, vscode.ConfigurationTarget.Global);
        } catch {
          // 写入失败不阻断界面刷新
        }
        lang = next;
        panel.webview.html = getWelcomeHtml(lang);
      })();
      return;
    }
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
  context.subscriptions.push(panel, onConfigChange);
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

function getWelcomeHtml(lang: WelcomeLang): string {
  // 按钮文本显示目标语言：当前中文 → 显示 EN；当前英文 → 显示 中文
  const i18n = {
    target: lang === 'zh-CN' ? 'en' : 'zh-CN',
    featured: welcomeText(lang, 'featured'),
    all: welcomeText(lang, 'all'),
    marketEmpty: welcomeText(lang, 'marketEmpty'),
    noMarketMatch: welcomeText(lang, 'noMarketMatch'),
    loading: welcomeText(lang, 'loading'),
    loadFail: welcomeText(lang, 'loadFail'),
    download: welcomeText(lang, 'download'),
    downloading: welcomeText(lang, 'downloading'),
    unnamed: welcomeText(lang, 'unnamed'),
    byAuthor: welcomeText(lang, 'byAuthor'),
    byModel: welcomeText(lang, 'byModel'),
  };
  const langBtnLabel = i18n.target === 'en' ? 'EN' : '中文';

  return `<!DOCTYPE html>
<html lang="${lang}">
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
    /* ---------- 右上角语言切换按钮 ---------- */
    .lang-toggle {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 200;
      padding: 6px 14px;
      font-size: 13px;
      font-family: inherit;
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 4px;
      cursor: pointer;
    }
    .lang-toggle:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
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
  <button class="lang-toggle" id="btnLang" data-target-lang="${i18n.target}" title="${welcomeText(lang, 'switchTo')}">${langBtnLabel}</button>
  <div class="title">${welcomeText(lang, 'title')}</div>
  <div class="body">${welcomeText(lang, 'subtitle')}</div>
  <div class="actions">
    <button data-command="ropide.newFile">${welcomeText(lang, 'newFile')}</button>
    <button class="secondary" data-command="ropide.openFile">${welcomeText(lang, 'openFile')}</button>
    <button class="secondary" id="btnMarket">${welcomeText(lang, 'market')}</button>
  </div>

  <div class="market-overlay" id="marketOverlay" hidden>
    <div class="market-panel">
      <div class="market-header">
        <h2>${welcomeText(lang, 'marketTitle')}</h2>
        <div class="spacer"></div>
        <input class="market-search" id="marketSearch" type="text" placeholder="${welcomeText(lang, 'marketSearchPh')}" />
        <button class="market-close" id="btnCloseMarket" title="${welcomeText(lang, 'closeTitle')}">×</button>
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
    const WI18N = ${JSON.stringify(i18n)};

    /* ---------- 语言切换按钮（右上角，显示目标语言） ---------- */
    document.getElementById('btnLang').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      vscode.postMessage({ type: 'set-language', lang: btn.dataset.targetLang });
    });

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
      grid.innerHTML = '<div class="market-empty">' + WI18N.loading + '</div>';
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
        grid.innerHTML = '<div class="market-empty">' + (q ? WI18N.noMarketMatch : WI18N.marketEmpty) + '</div>';
        return;
      }

      const card = (it, isFeatured) => {
        const idStr = String(it.id);
        const busy = downloadingId === idStr;
        return (
          '<div class="market-card ' + (isFeatured ? 'featured' : '') + '">' +
            '<div class="market-card-title">' + esc(it.name || WI18N.unnamed) +
              (isFeatured ? ' <span class="market-star">★</span>' : '') + '</div>' +
            '<div class="market-card-meta">' +
              '<span>' + WI18N.byAuthor + esc(it.author || '-') + '</span>' +
              '<span>' + WI18N.byModel + esc(it.model || '-') + '</span>' +
            '</div>' +
            (it.description ? '<div class="market-card-desc">' + esc(it.description) + '</div>' : '') +
            '<button class="market-dl" data-download="' + esc(idStr) + '"' + (busy ? ' disabled' : '') + '>' +
              (busy ? WI18N.downloading : WI18N.download) + '</button>' +
          '</div>'
        );
      };

      let html = '';
      if (featured.length) {
        html += '<div class="market-section">' + WI18N.featured + '</div>' + featured.map((it) => card(it, true)).join('');
      }
      if (normal.length) {
        if (featured.length) html += '<div class="market-section">' + WI18N.all + '</div>';
        html += normal.map((it) => card(it, false)).join('');
      }
      grid.innerHTML = html;
    }

    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'market:list-result') {
        if (msg.error) {
          grid.innerHTML = '<div class="market-empty">' + WI18N.loadFail + esc(msg.error) + '</div>';
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