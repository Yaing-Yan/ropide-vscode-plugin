import * as vscode from 'vscode';
import {
  fetchMarketItem,
  fetchMarketChallenge,
  publishToMarket,
} from './market';
import { parseRopDocument, serializeRopDocument } from './rop';
import { RopEditorProvider } from './ropEditorProvider';
import { closeTabIfOpen } from './tabs';
import { marketUnread } from './marketState';
import { getRecentFiles, removeRecentFile } from './recent';
import { checkForUpdate, REPO_URL } from './update';
import { BUILD_TIME } from './buildInfo';

type WelcomeLang = 'zh-CN' | 'en';

interface WelcomeMessage {
  type?: string;
  lang?: string;
  url?: string;
  id?: number | string;
  name?: string;
  data?: string;
  author?: string;
  model?: string;
  description?: string;
  challengeToken?: string;
  challengeAnswer?: string;
}

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
    // 发布
    publish: '发布',
    publishTitle: '发布到程序广场',
    chooseRop: '选择要发布的 .rop 文件',
    progName: '程序名 *',
    progNamePh: '例如 tetris',
    author: '作者 *',
    authorPh: '你的昵称',
    model: '机型 *',
    modelSel: '选择机型',
    other: '其它',
    otherModel: '其它机型 *',
    otherModelPh: '输入机型',
    desc: '描述 *',
    descPh: '程序说明…',
    challenge: '内行验证 *',
    challengePh: '两字节十六进制',
    challengeText: '为防止垃圾信息或机器人提交，请查看 fx-991CNX VerF ROM 中 0x{addr} 处的两个字节，并以十六进制输入（例: 1A2B），以证明你是圈内成员。',
    cancel: '取消',
    published: '发布成功',
    publishFail: '发布失败：',
    challengeLoading: '正在获取验证题目…',
    challengeWait: '验证题目加载中，请稍候',
    challengeRetry: '验证题目加载失败，正在重试',
    challengeFail: '获取验证题目失败：',
    challengeRetryLater: '请稍后重试',
    challengeWrong: '验证失败：字节错误，已更换新题目',
    challengeExpired: '验证题目已过期，已更换新题目',
    needName: '请填写程序名',
    needAuthor: '请填写作者',
    needModel: '请选择 / 填写机型',
    needDesc: '请填写描述',
    needAnswer: '请输入 4 位十六进制的两字节答案',
    ropLoadFail: '读取 .rop 文件失败：',
    recentTitle: '最近打开',
    recentGone: '文件已不存在，已从最近列表移除',
    updateAvailable: '有新版本',
    updateTip: '点击前往 GitHub 获取最新版本',
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
    // publish
    publish: 'Publish',
    publishTitle: 'Publish to Market',
    chooseRop: 'Choose a .rop file to publish',
    progName: 'Name *',
    progNamePh: 'e.g. tetris',
    author: 'Author *',
    authorPh: 'Your nickname',
    model: 'Model *',
    modelSel: 'Select model',
    other: 'Other',
    otherModel: 'Other model *',
    otherModelPh: 'Enter model',
    desc: 'Description *',
    descPh: 'Program description…',
    challenge: 'Expert check *',
    challengePh: 'Two bytes in hex',
    challengeText: 'To prevent spam or bot submissions, please check the two bytes at 0x{addr} in the fx-991CNX VerF ROM and enter them in hex (e.g. 1A2B) to prove you are an insider.',
    cancel: 'Cancel',
    published: 'Published',
    publishFail: 'Publish failed: ',
    challengeLoading: 'Fetching challenge…',
    challengeWait: 'Challenge is loading, please wait',
    challengeRetry: 'Challenge failed to load, retrying',
    challengeFail: 'Failed to fetch challenge: ',
    challengeRetryLater: 'please retry later',
    challengeWrong: 'Check failed: wrong bytes, a new challenge was issued',
    challengeExpired: 'Challenge expired, a new one was issued',
    needName: 'Please enter a program name',
    needAuthor: 'Please enter the author',
    needModel: 'Please select / enter a model',
    needDesc: 'Please enter a description',
    needAnswer: 'Enter the two-byte answer as 4 hex digits',
    ropLoadFail: 'Failed to read .rop file: ',
    recentTitle: 'Recent',
    recentGone: 'File no longer exists; removed from the recent list',
    updateAvailable: 'Update available',
    updateTip: 'Click to get the latest version on GitHub',
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

  // 市场未读广播：任意视图打开广场清零时，同步刷新本欢迎页的红点。
  const sendUnread = (unread: number): void => {
    panel.webview.postMessage({ type: 'market:unread', unread });
  };
  marketUnread.subscribe(sendUnread);
  panel.onDidDispose(() => marketUnread.unsubscribe(sendUnread));

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

  panel.webview.onDidReceiveMessage((msg: WelcomeMessage) => {
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
        const r = await marketUnread.open();
        panel.webview.postMessage(
          'error' in r
            ? { type: 'market:list-result', error: r.error }
            : { type: 'market:list-result', items: r.items }
        );
      })();
      return;
    }
    if (msg.type === 'market:unread-check') {
      void (async () => {
        const unread = await marketUnread.check();
        panel.webview.postMessage({ type: 'market:unread', unread });
      })();
      return;
    }
    if (msg.type === 'recent:list') {
      panel.webview.postMessage({ type: 'recent:list-result', items: getRecentFiles(context) });
      return;
    }
    if (msg.type === 'recent:open' && typeof msg.url === 'string') {
      void (async () => {
        const uri = vscode.Uri.parse(msg.url as string);
        try {
          await vscode.workspace.fs.stat(uri);
        } catch {
          removeRecentFile(context, msg.url as string);
          panel.webview.postMessage({ type: 'recent:gone', items: getRecentFiles(context) });
          return;
        }
        await vscode.commands.executeCommand('vscode.openWith', uri, RopEditorProvider.viewType);
      })();
      return;
    }
    if (msg.type === 'update:check') {
      void (async () => {
        const r = await checkForUpdate();
        panel.webview.postMessage(
          'error' in r
            ? { type: 'update:result', ok: false }
            : { type: 'update:result', ok: true, hasUpdate: r.hasUpdate, url: REPO_URL }
        );
      })();
      return;
    }
    if (msg.type === 'market:get') {
      void handleWelcomeMarketDownload(msg.id ?? '', msg.name || 'program');
      return;
    }
    // 发布：先让用户选一个 .rop 文件，再回传序列化内容给 Webview 填表。
    if (msg.type === 'market:publish-open') {
      void (async () => {
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'Rop File': ['rop'] },
          title: welcomeText(lang, 'chooseRop'),
        });
        if (!uris || uris.length === 0) {
          panel.webview.postMessage({ type: 'market:publish-ready', cancelled: true });
          return;
        }
        try {
          const bytes = await vscode.workspace.fs.readFile(uris[0]);
          const text = Buffer.from(bytes).toString('utf8');
          const parsed = parseRopDocument(text);
          if (!parsed.ok) {
            panel.webview.postMessage({ type: 'market:publish-ready', error: parsed.error });
            return;
          }
          const fileName = uris[0].path.split('/').pop() || 'program.rop';
          panel.webview.postMessage({
            type: 'market:publish-ready',
            ok: true,
            data: serializeRopDocument(parsed.data),
            fileName,
          });
        } catch (e) {
          panel.webview.postMessage({ type: 'market:publish-ready', error: (e as Error).message });
        }
      })();
      return;
    }
    if (msg.type === 'market:challenge') {
      void (async () => {
        const r = await fetchMarketChallenge();
        panel.webview.postMessage(
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
      return;
    }
    if (msg.type === 'market:publish') {
      void (async () => {
        const r = await publishToMarket({
          name: String(msg.name || ''),
          author: String(msg.author || ''),
          model: String(msg.model || ''),
          description: String(msg.description || ''),
          data: String(msg.data || ''),
          timestamp: Date.now(),
          challengeToken: typeof msg.challengeToken === 'string' ? msg.challengeToken : '',
          challengeAnswer: typeof msg.challengeAnswer === 'string' ? msg.challengeAnswer : '',
        });
        panel.webview.postMessage(
          r.ok
            ? { type: 'market:publish-result', ok: true }
            : { type: 'market:publish-result', ok: false, code: r.code, error: r.error }
        );
      })();
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
  // 覆盖保存同名文件时，已打开的标签页不会自动重新读取磁盘内容，需先关闭再打开。
  await closeTabIfOpen(uri);
  await vscode.commands.executeCommand('vscode.openWith', uri, RopEditorProvider.viewType);
}

function getWelcomeHtml(lang: WelcomeLang): string {
  // 按钮文本显示目标语言：当前中文 → 显示 EN；当前英文 → 显示 中文
  const W = (k: string) => welcomeText(lang, k);
  const i18n = {
    target: lang === 'zh-CN' ? 'en' : 'zh-CN',
    featured: W('featured'),
    all: W('all'),
    marketEmpty: W('marketEmpty'),
    noMarketMatch: W('noMarketMatch'),
    loading: W('loading'),
    loadFail: W('loadFail'),
    download: W('download'),
    downloading: W('downloading'),
    unnamed: W('unnamed'),
    byAuthor: W('byAuthor'),
    byModel: W('byModel'),
    publish: W('publish'),
    publishTitle: W('publishTitle'),
    progName: W('progName'),
    progNamePh: W('progNamePh'),
    author: W('author'),
    authorPh: W('authorPh'),
    model: W('model'),
    modelSel: W('modelSel'),
    other: W('other'),
    otherModel: W('otherModel'),
    otherModelPh: W('otherModelPh'),
    desc: W('desc'),
    descPh: W('descPh'),
    challenge: W('challenge'),
    challengePh: W('challengePh'),
    challengeText: W('challengeText'),
    cancel: W('cancel'),
    published: W('published'),
    publishFail: W('publishFail'),
    challengeLoading: W('challengeLoading'),
    challengeWait: W('challengeWait'),
    challengeRetry: W('challengeRetry'),
    challengeFail: W('challengeFail'),
    challengeRetryLater: W('challengeRetryLater'),
    challengeWrong: W('challengeWrong'),
    challengeExpired: W('challengeExpired'),
    needName: W('needName'),
    needAuthor: W('needAuthor'),
    needModel: W('needModel'),
    needDesc: W('needDesc'),
    needAnswer: W('needAnswer'),
    ropLoadFail: W('ropLoadFail'),
    recentTitle: W('recentTitle'),
    recentGone: W('recentGone'),
    updateAvailable: W('updateAvailable'),
    updateTip: W('updateTip'),
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
    .ver-top {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 200;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75em;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      user-select: none;
    }
    .update-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: 999px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #2ea043, #238636);
      box-shadow: 0 2px 8px rgba(35, 134, 54, 0.4);
      cursor: pointer;
      text-decoration: none;
      animation: badgePop 0.25s ease;
    }
    .update-badge[hidden] { display: none; }
    .update-badge .dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #fff;
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes badgePop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    /* ---------- Hero ---------- */
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 11vh;
    }
    .logo-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 76px;
      height: 76px;
      border-radius: 20px;
      background: var(--vscode-button-background, #0e639c);
      background: linear-gradient(135deg,
        var(--vscode-button-background, #0e639c),
        color-mix(in srgb, var(--vscode-button-background, #0e639c) 55%, #7b52ff));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255,255,255,0.12);
      margin-bottom: 18px;
    }
    .logo-badge svg { width: 48px; height: 48px; }
    .title {
      text-align: center;
      font-weight: 700;
      font-size: 1.75em;
      letter-spacing: 0.2px;
      margin: 0;
    }
    .body {
      text-align: center;
      font-size: 1.05em;
      margin-top: 10px;
      color: var(--vscode-descriptionForeground, #9d9d9d);
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-top: 30px;
      flex-wrap: wrap;
    }
    .actions button {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 20px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-background, #0e639c);
      border: 1px solid transparent;
      border-radius: 999px;
      cursor: pointer;
      transition: transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
    }
    .actions button svg { width: 15px; height: 15px; opacity: 0.95; }
    .actions button:hover {
      background: var(--vscode-button-hoverBackground, #1177bb);
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }
    .actions button:active { transform: translateY(0); }
    .actions button.secondary {
      color: var(--vscode-button-secondaryForeground, #ccc);
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      border-color: var(--vscode-panel-border, #3c3c3c);
    }
    .actions button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }

    /* ---------- 最近打开 ---------- */
    .recent {
      width: min(520px, 92vw);
      margin: 34px auto 0;
    }
    .recent[hidden] { display: none; }
    .recent-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      margin-bottom: 8px;
    }
    .recent-title svg { width: 14px; height: 14px; }
    .recent-list { display: flex; flex-direction: column; gap: 6px; }
    .recent-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 8px;
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.02));
      cursor: pointer;
      text-align: left;
      transition: border-color 0.12s ease, transform 0.12s ease, background 0.12s ease;
    }
    .recent-item:hover {
      border-color: var(--vscode-focusBorder, #0e639c);
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
      transform: translateX(2px);
    }
    .recent-item .ri-icon {
      flex: 0 0 auto;
      display: flex;
      color: var(--vscode-button-background, #0e639c);
    }
    .recent-item .ri-icon svg { width: 18px; height: 18px; }
    .recent-item .ri-text { min-width: 0; display: flex; flex-direction: column; }
    .recent-item .ri-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground, #ccc);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .recent-item .ri-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl;
    }

    /* ---------- 程序广场未读小红点 ---------- */
    .market-unread {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: #e51400;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
      box-sizing: border-box;
      pointer-events: none;
    }
    .market-unread[hidden] { display: none; }

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
    .publish-panel {
      width: min(560px, 94vw);
      height: auto;
      max-height: 88vh;
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
      border-radius: 8px;
      padding: 10px 12px;
      min-width: 0;
      transition: border-color 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
    }
    .market-card:hover {
      border-color: var(--vscode-focusBorder, #0e639c);
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
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
    .market-header .market-dl { align-self: center; }

    /* ---------- 发布表单 ---------- */
    .form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .form-row > label { font-size: 12px; color: var(--vscode-descriptionForeground, #9d9d9d); }
    .text-input {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      font-size: 13px;
      font-family: inherit;
      color: var(--vscode-input-foreground, #ccc);
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
    }
    .text-input:disabled { opacity: 0.6; }
    .tag-select {
      padding: 5px 8px;
      font-size: 13px;
      font-family: inherit;
      color: var(--vscode-input-foreground, #ccc);
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
    }
    .challenge-hint {
      font-size: 12px;
      line-height: 1.6;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      white-space: normal;
    }
    .market-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }

    /* ---------- toast ---------- */
    .toast {
      position: fixed;
      left: 50%;
      bottom: 28px;
      transform: translateX(-50%);
      z-index: 300;
      max-width: 80vw;
      padding: 8px 16px;
      font-size: 13px;
      color: #fff;
      background: rgba(30, 30, 30, 0.92);
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .toast.error { background: rgba(150, 20, 20, 0.92); border-color: #e51400; }
    .toast[hidden] { display: none; }

    .footer {
      margin-top: auto;
      text-align: center;
      font-size: 0.82em;
      line-height: 1.7;
      color: var(--vscode-descriptionForeground, #9d9d9d);
      padding-bottom: 10px;
    }
    .footer .credit { opacity: 0.85; }
    .link-pills {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
    }
    .link-pills a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 13px;
      font-size: 12px;
      color: var(--vscode-foreground, #ccc);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.03));
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 999px;
      text-decoration: none;
      cursor: pointer;
      transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease, transform 0.12s ease;
    }
    .link-pills a:hover {
      color: var(--vscode-button-foreground, #fff);
      background: var(--vscode-button-background, #0e639c);
      border-color: var(--vscode-button-background, #0e639c);
      transform: translateY(-1px);
    }
    .link-pills a svg { width: 13px; height: 13px; }
    a {
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: none;
      cursor: pointer;
    }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <button class="lang-toggle" id="btnLang" data-target-lang="${i18n.target}" title="${W('switchTo')}">${langBtnLabel}</button>
  <div class="ver-top">
    <span>ver.${BUILD_TIME}</span>
    <a class="update-badge" id="updateBadge" hidden title="${i18n.updateTip}"><span class="dot"></span>${i18n.updateAvailable}</a>
  </div>
  <div class="hero">
    <div class="logo-badge">
      <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <rect x="14" y="18" width="30" height="20" rx="4"/>
          <rect x="52" y="18" width="30" height="20" rx="4"/>
          <path d="M44 28 h8"/><path d="M82 28 h14 v22"/><path d="M92 44 l4 6 4 -6"/>
          <rect x="24" y="56" width="80" height="58" rx="8"/>
          <rect x="34" y="64" width="60" height="16" rx="3"/>
        </g>
        <g fill="#fff"><circle cx="40" cy="92" r="3.2"/><circle cx="54" cy="92" r="3.2"/><circle cx="68" cy="92" r="3.2"/><circle cx="88" cy="92" r="3.2"/><circle cx="40" cy="104" r="3.2"/><circle cx="54" cy="104" r="3.2"/><circle cx="68" cy="104" r="3.2"/></g>
        <g stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"><rect x="82" y="100" width="14" height="8" rx="3"/></g>
      </svg>
    </div>
    <h1 class="title">${W('title')}</h1>
    <div class="body">${W('subtitle')}</div>
    <div class="actions">
      <button data-command="ropide.newFile">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z"/><path d="M9 1.5v4h4"/><path d="M8 8.5v3M6.5 10h3"/></svg>
        ${W('newFile')}
      </button>
      <button class="secondary" data-command="ropide.openFile">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 4a1 1 0 0 1 1-1h3l1.5 1.5h6a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>
        ${W('openFile')}
      </button>
      <button class="secondary" id="btnMarket">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c1.8 2 1.8 11 0 13M8 1.5c-1.8 2-1.8 11 0 13"/></svg>
        ${W('market')}<span class="market-unread" id="marketUnread" hidden></span>
      </button>
    </div>
    <div class="recent" id="recentSection" hidden>
      <div class="recent-title">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/></svg>
        ${i18n.recentTitle}
      </div>
      <div class="recent-list" id="recentList"></div>
    </div>
  </div>

  <div class="market-overlay" id="marketOverlay" hidden>
    <div class="market-panel">
      <div class="market-header">
        <h2>${W('marketTitle')}</h2>
        <div class="spacer"></div>
        <input class="market-search" id="marketSearch" type="text" placeholder="${W('marketSearchPh')}" />
        <button class="market-dl" id="btnPublishMarket">${i18n.publish}</button>
        <button class="market-close" id="btnCloseMarket" title="${W('closeTitle')}">×</button>
      </div>
      <div class="market-body">
        <div class="market-grid" id="marketGrid"></div>
      </div>
    </div>
  </div>

  <div class="market-overlay" id="publishOverlay" hidden>
    <div class="market-panel publish-panel">
      <div class="market-header">
        <h2>${i18n.publishTitle}</h2>
        <div class="spacer"></div>
        <button class="market-close" id="btnClosePublish" title="${W('closeTitle')}">×</button>
      </div>
      <div class="market-body">
        <div class="form-row"><label>${i18n.progName}</label><input class="text-input" id="publishName" placeholder="${i18n.progNamePh}" spellcheck="false" /></div>
        <div class="form-row"><label>${i18n.author}</label><input class="text-input" id="publishAuthor" placeholder="${i18n.authorPh}" spellcheck="false" /></div>
        <div class="form-row"><label>${i18n.model}</label>
          <select class="tag-select" id="publishModel" style="width:100%">
            <option value="" disabled selected hidden>${i18n.modelSel}</option>
            <option value="fx-991CNX (VerC)">fx-991CNX (VerC)</option>
            <option value="fx-991CNX (VerF)">fx-991CNX (VerF)</option>
            <option value="other">${i18n.other}</option>
          </select>
        </div>
        <div class="form-row" id="publishOtherRow" hidden><label>${i18n.otherModel}</label><input class="text-input" id="publishOtherModel" placeholder="${i18n.otherModelPh}" spellcheck="false" /></div>
        <div class="form-row"><label>${i18n.desc}</label><textarea class="text-input" id="publishDescription" rows="6" placeholder="${i18n.descPh}"></textarea></div>
        <div class="form-row">
          <label>${i18n.challenge}</label>
          <div class="challenge-hint" id="challengeHint">${i18n.challengeLoading}</div>
          <input class="text-input" id="challengeAnswer" maxlength="9" placeholder="${i18n.challengePh}" disabled spellcheck="false" />
        </div>
        <div class="market-actions">
          <button class="market-dl" id="btnCancelPublish" style="background:var(--vscode-button-secondaryBackground,#3a3d41)">${i18n.cancel}</button>
          <button class="market-dl" id="btnConfirmPublish">${i18n.publish}</button>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="credit">Copyright © 2026 RopIDE for VS Code @Yaing-Yan · 使用了 Vibe Coding 技术</div>
    <div class="credit">Copyright © 2026 RopIDE @wlyibo</div>
    <div class="link-pills">
      <a href="https://github.com/Yaing-Yan/ropide-vscode-plugin">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.35c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.52.56.83 1.28.83 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>
        插件仓库
      </a>
      <a href="https://github.com/WulanOVO/rop-ide">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.35c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.52.56.83 1.28.83 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>
        rop-ide
      </a>
      <a href="https://ropide.pages.dev/">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c1.8 2 1.8 11 0 13M8 1.5c-1.8 2-1.8 11 0 13"/></svg>
        RopIDE 网页版
      </a>
      <a href="https://rop-ide2.pages.dev/">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c1.8 2 1.8 11 0 13M8 1.5c-1.8 2-1.8 11 0 13"/></svg>
        ROP IDE 2nd
      </a>
    </div>
  </div>
  <div class="toast" id="toast" hidden></div>
  <script>
    const vscode = acquireVsCodeApi();
    const WI18N = ${JSON.stringify(i18n)};

    /* ---------- 语言切换按钮（右上角） ---------- */
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

    /* ---------- toast ---------- */
    const toast = document.getElementById('toast');
    let toastTimer = null;
    function showToast(text, isError) {
      toast.textContent = text;
      toast.classList.toggle('error', !!isError);
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
    }

    /* ---------- 程序广场未读小红点 ---------- */
    const marketUnreadEl = document.getElementById('marketUnread');
    function setMarketUnread(n) {
      n = Math.max(0, Number(n) || 0);
      if (n > 0) {
        marketUnreadEl.textContent = n > 99 ? '99+' : String(n);
        marketUnreadEl.hidden = false;
      } else {
        marketUnreadEl.hidden = true;
      }
    }
    // 打开时查询一次未读数（不标记已读；打开广场后宿主会广播清零）
    vscode.postMessage({ type: 'market:unread-check' });

    /* ---------- 最近打开的 .rop 文件 ---------- */
    const recentSection = document.getElementById('recentSection');
    const recentList = document.getElementById('recentList');
    function fsPathOf(uriStr) {
      try {
        let p = decodeURIComponent(String(uriStr).replace(/^file:\\/\\//, ''));
        if (/^\\/[A-Za-z]:/.test(p)) p = p.slice(1); // Windows /C:/...
        return p;
      } catch (e) { return String(uriStr); }
    }
    function renderRecent(list) {
      if (!Array.isArray(list) || !list.length) {
        recentSection.hidden = true;
        recentList.innerHTML = '';
        return;
      }
      recentSection.hidden = false;
      recentList.innerHTML = list.map((it) => {
        const path = fsPathOf(it.uri);
        return (
          '<button class="recent-item" data-uri="' + esc(it.uri) + '">' +
            '<span class="ri-icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5z"/><path d="M9 1.5v4h4"/></svg></span>' +
            '<span class="ri-text">' +
              '<span class="ri-name">' + esc(it.name) + '</span>' +
              '<span class="ri-path">' + esc(path) + '</span>' +
            '</span>' +
          '</button>'
        );
      }).join('');
    }
    recentList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-uri]');
      if (!btn) return;
      vscode.postMessage({ type: 'recent:open', url: btn.dataset.uri });
    });
    vscode.postMessage({ type: 'recent:list' });

    /* ---------- 版本更新徽章 ---------- */
    const updateBadge = document.getElementById('updateBadge');
    vscode.postMessage({ type: 'update:check' });

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

    /* ---------- 发布（需先选择 .rop 文件） ---------- */
    const publishOverlay = document.getElementById('publishOverlay');
    const publishName = document.getElementById('publishName');
    const publishAuthor = document.getElementById('publishAuthor');
    const publishModel = document.getElementById('publishModel');
    const publishOtherRow = document.getElementById('publishOtherRow');
    const publishOtherModel = document.getElementById('publishOtherModel');
    const publishDescription = document.getElementById('publishDescription');
    const challengeHint = document.getElementById('challengeHint');
    const challengeAnswer = document.getElementById('challengeAnswer');
    const btnPublishMarket = document.getElementById('btnPublishMarket');
    const btnConfirmPublish = document.getElementById('btnConfirmPublish');
    let publishData = null;
    let challenge = null;
    let challengeLoading = false;

    function hexAddr(v) {
      return Math.max(0, Math.floor(v)).toString(16).toUpperCase().padStart(4, '0');
    }

    btnPublishMarket.addEventListener('click', () => {
      btnPublishMarket.disabled = true;
      btnPublishMarket.textContent = WI18N.loading;
      vscode.postMessage({ type: 'market:publish-open' });
    });

    function closePublish() { publishOverlay.hidden = true; }

    document.getElementById('btnClosePublish').addEventListener('click', closePublish);
    document.getElementById('btnCancelPublish').addEventListener('click', () => {
      btnConfirmPublish.disabled = false;
      closePublish();
    });
    publishOverlay.addEventListener('mousedown', (e) => {
      if (e.target === publishOverlay) {
        btnConfirmPublish.disabled = false;
        closePublish();
      }
    });
    publishModel.addEventListener('change', () => {
      publishOtherRow.hidden = publishModel.value !== 'other';
    });

    function fetchChallenge() {
      challenge = null;
      challengeLoading = true;
      challengeAnswer.value = '';
      challengeAnswer.disabled = true;
      challengeHint.textContent = WI18N.challengeLoading;
      vscode.postMessage({ type: 'market:challenge' });
    }

    function confirmPublish() {
      const name = publishName.value.trim();
      const author = publishAuthor.value.trim();
      const model = publishModel.value === 'other' ? publishOtherModel.value.trim() : publishModel.value;
      const description = publishDescription.value.trim();
      if (!name) { showToast(WI18N.needName, true); return; }
      if (!author) { showToast(WI18N.needAuthor, true); return; }
      if (!model) { showToast(WI18N.needModel, true); return; }
      if (!description) { showToast(WI18N.needDesc, true); return; }

      const answer = challengeAnswer.value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
      if (!challenge) {
        if (challengeLoading) showToast(WI18N.challengeWait, true);
        else { showToast(WI18N.challengeRetry, true); fetchChallenge(); }
        return;
      }
      if (!/^[0-9a-f]{4}$/.test(answer)) {
        showToast(WI18N.needAnswer, true);
        return;
      }
      btnConfirmPublish.disabled = true;
      vscode.postMessage({
        type: 'market:publish',
        name,
        author,
        model,
        description,
        data: publishData,
        challengeToken: challenge.token,
        challengeAnswer: answer,
      });
    }
    btnConfirmPublish.addEventListener('click', confirmPublish);

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
      } else if (msg.type === 'market:unread') {
        setMarketUnread(msg.unread);
      } else if (msg.type === 'recent:list-result') {
        renderRecent(msg.items);
      } else if (msg.type === 'recent:gone') {
        renderRecent(msg.items);
        showToast(WI18N.recentGone, true);
      } else if (msg.type === 'update:result') {
        if (msg.ok && msg.hasUpdate && msg.url) {
          updateBadge.href = msg.url;
          updateBadge.hidden = false;
        }
      } else if (msg.type === 'market:publish-ready') {
        btnPublishMarket.disabled = false;
        btnPublishMarket.textContent = WI18N.publish;
        if (msg.error) {
          showToast(WI18N.ropLoadFail + msg.error, true);
        } else if (msg.cancelled) {
          // 用户取消选择文件
        } else {
          publishData = msg.data;
          publishName.value = (msg.fileName || 'program.rop').replace(/\\.rop$/i, '');
          publishAuthor.value = '';
          publishModel.value = '';
          publishOtherRow.hidden = true;
          publishOtherModel.value = '';
          publishDescription.value = '';
          publishOverlay.hidden = false;
          fetchChallenge();
        }
      } else if (msg.type === 'market:challenge-result') {
        challengeLoading = false;
        if (msg.ok) {
          challenge = { token: msg.token, offset: msg.offset };
          challengeAnswer.disabled = false;
          challengeHint.textContent = WI18N.challengeText.replace('{addr}', hexAddr(msg.offset));
        } else {
          challenge = null;
          challengeAnswer.disabled = true;
          challengeHint.textContent = WI18N.challengeFail + (msg.error || WI18N.challengeRetryLater);
        }
      } else if (msg.type === 'market:publish-result') {
        btnConfirmPublish.disabled = false;
        if (msg.ok) {
          showToast(WI18N.published);
          closePublish();
          items = [];
          downloadingId = null;
          grid.innerHTML = '<div class="market-empty">' + WI18N.loading + '</div>';
          vscode.postMessage({ type: 'market:list' });
        } else if (msg.code === 'wrong') {
          showToast(WI18N.challengeWrong, true);
          fetchChallenge();
        } else if (msg.code === 'expired') {
          showToast(WI18N.challengeExpired, true);
          fetchChallenge();
        } else {
          showToast(WI18N.publishFail + msg.error, true);
        }
      }
    });
  </script>
</body>
</html>`;
}