/**
 * RopIDE Webview 编辑器主逻辑。
 * 与 rop-ide 网页版保持一致：textarea + 高亮覆盖层，额外加入：
 *   - 左侧行号栏 → 每行起始左侧地址
 *   - 右侧地址栏 → 每行起始右侧地址
 *   - 状态栏光标处左/右地址
 *   - gadgets 查看/编辑、编译、新建、gadget 补全
 */
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();

  /* ---------------- 语言 / i18n ---------------- */
  const STR = {
    'zh-CN': {
      injectAddr: '注入地址',
      writeRam: '覆写RAM',
      writeRamTitle: '把编译结果写入模拟器 RAM（注入地址，默认左地址）',
      addr: '地址',
      launcherPh: 'launcher（如 FD 24 E0 E9 8F 23 42）',
      writeLauncher: '覆写launcher',
      writeLauncherTitle: '把 launcher 写入模拟器指定地址',
      newFileTitle: '新建 .rop 文件',
      gadgetsTitle: '查看 / 编辑 gadgets',
      compile: '编译',
      market: '程序广场',
      aboutTitle: '关于',
      closePanelTitle: '关闭分栏',
      leftAddr: '左地址',
      rightAddr: '右地址',
      copyHex: '复制 hex 串',
      copyDump: '复制 hexdump',
      compileHint: '点击任意字节 → 左下角显示左右地址，并高亮输入区对应位置',
      gadgetSearchPh: '搜索 name / addr / desc / tag…',
      add: '新增',
      import: '导入',
      export: '导出',
      importTitle: '导入 gadgets.json',
      exportTitle: '导出 gadgets.json',
      marketSearchPh: '搜索 name / author / model / desc…',
      publish: '发布',
      jumpLabel: '光标移动到地址',
      jumpSideTitle: '地址基准（左侧/右侧起始地址）',
      left: '左侧',
      right: '右侧',
      jumpPh: '如 E9E0',
      settings: '设置',
      lang: '语言',
      disasmExp: '【实验性】gadgets 展示汇编',
      disasmHint: '在 Gadgets 面板中显示每个 gadget 的反汇编片段（需要提供 _disas 文件）',
      disasmHoverExp: '【实验性】在悬浮窗内展示汇编',
      disasmHoverHint: '在鼠标悬停提示中显示 gadget 的反汇编片段（需要已加载 _disas 文件并开启「展示汇编」）',
      disasmProvide: '请提供 _disas',
      chooseFile: '选择文件',
      disasmLoaded: '已加载：',
      publishTitle: '发布到程序广场',
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
      copied: '已复制',
      unnamed: '(未命名)',
      loading: '加载中…',
      loadFail: '加载失败：',
      noGadgetMatch: '没有匹配的 gadget。',
      noGadgets: '还没有 gadgets。点击右上角「新增」添加一个。',
      noBytes: '（暂无字节）',
      edit: '编辑',
      delete: '删除',
      name: '名称',
      addrHex: '地址（十六进制）',
      tag: '标签',
      tagNamePh: '标签名',
      addTag: '添加标签',
      save: '保存',
      showDisasm: '汇编',
      disasmLoading: '加载反汇编…',
      disasmFail: '没有该地址的反汇编',
      invalidAddr: '注入地址无效（1-5 位十六进制）',
      noCompileResult: '没有可写入的编译结果',
      writingEmu: '覆写中…（首次定位 RAM 可能需要数十秒）',
      needLauncher: '请输入 launcher',
      invalidLauncherAddr: 'launcher 注入地址无效（1-5 位十六进制）',
      emuNotRunning: '找不到正在运行的 CasioEmuMsvc，或者进程不支持 MCP（请从模拟器自身目录启动，详见 README）',
      invalidJumpAddr: '请输入 1–5 位十六进制地址',
      noJumpBytes: '当前还没有可跳转的字节',
      written: '已写入',
      writeFail: '写入失败',
      exported: '已导出 gadgets.json',
      exportFail: '导出失败：',
      imported: '已导入 gadgets',
      importFail: '导入失败：',
      cancelled: '已取消',
      savedOpened: '已保存并打开',
      downloadFail: '下载失败：',
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
      noMarketMatch: '没有匹配的程序',
      marketEmpty: '程序广场空空如也',
      downloading: '下载中…',
      download: '下载',
      featured: '精选',
      all: '全部',
      byAuthor: '作者：',
      byModel: '机型：',
      invalidRop: '这不是合法的 .rop（JSON）文件。',
      constAnchor: '常量 / 锚点',
      htAddr: '地址',
      htValue: '值',
      htSide: '性质',
      htExpr: '表达式',
      htResult: '结果',
      htLE: '小端',
      htConst: '常量',
      htAnchor: '锚点',
      htAnchorDef: '锚点定义',
      htValueBlock: '数值块',
    },
    en: {
      injectAddr: 'Inject Addr',
      writeRam: 'Write RAM',
      writeRamTitle: 'Write the compiled bytes into emulator RAM (inject address, defaults to left)',
      addr: 'Address',
      launcherPh: 'launcher (e.g. FD 24 E0 E9 8F 23 42)',
      writeLauncher: 'Write launcher',
      writeLauncherTitle: 'Write launcher bytes to the given emulator address',
      newFileTitle: 'New .rop file',
      gadgetsTitle: 'View / edit gadgets',
      compile: 'Compile',
      market: 'Market',
      aboutTitle: 'About',
      closePanelTitle: 'Close panel',
      leftAddr: 'Left addr',
      rightAddr: 'Right addr',
      copyHex: 'Copy hex',
      copyDump: 'Copy hexdump',
      compileHint: 'Click any byte → L/R addresses shown in the status bar, source position highlighted',
      gadgetSearchPh: 'Search name / addr / desc / tag…',
      add: 'Add',
      import: 'Import',
      export: 'Export',
      importTitle: 'Import gadgets.json',
      exportTitle: 'Export gadgets.json',
      marketSearchPh: 'Search name / author / model / desc…',
      publish: 'Publish',
      jumpLabel: 'Move cursor to address',
      jumpSideTitle: 'Address base (left / right start address)',
      left: 'Left',
      right: 'Right',
      jumpPh: 'e.g. E9E0',
      settings: 'Settings',
      lang: 'Language',
      disasmExp: '[Experimental] Show gadget disassembly',
      disasmHint: 'Show disassembly snippets for each gadget in the Gadgets panel (requires a _disas file)',
      disasmHoverExp: '[Experimental] Show disassembly in hover',
      disasmHoverHint: 'Display gadget disassembly snippets in the hover tooltip (requires _disas file loaded and "Show gadget disassembly" enabled)',
      disasmProvide: 'Please provide _disas',
      chooseFile: 'Choose file',
      disasmLoaded: 'Loaded: ',
      publishTitle: 'Publish to Market',
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
      copied: 'Copied',
      unnamed: '(unnamed)',
      loading: 'Loading…',
      loadFail: 'Load failed: ',
      noGadgetMatch: 'No matching gadget.',
      noGadgets: 'No gadgets yet. Click "Add" at the top right.',
      noBytes: '(no bytes yet)',
      edit: 'Edit',
      delete: 'Delete',
      name: 'Name',
      addrHex: 'Address (hex)',
      tag: 'Tags',
      tagNamePh: 'Tag name',
      addTag: 'Add tag',
      save: 'Save',
      showDisasm: 'ASM',
      disasmLoading: 'Loading disassembly…',
      disasmFail: 'No disassembly at this address',
      invalidAddr: 'Invalid inject address (1-5 hex digits)',
      noCompileResult: 'Nothing compiled to write',
      writingEmu: 'Writing… (locating RAM may take tens of seconds the first time)',
      needLauncher: 'Please enter a launcher',
      invalidLauncherAddr: 'Invalid launcher address (1-5 hex digits)',
      emuNotRunning: 'CasioEmuMsvc is not running, or the process does not support MCP (start the emulator from its own directory, see README)',
      invalidJumpAddr: 'Enter a 1–5 digit hex address',
      noJumpBytes: 'No bytes to jump to yet',
      written: 'Written',
      writeFail: 'Write failed',
      exported: 'Exported gadgets.json',
      exportFail: 'Export failed: ',
      imported: 'Gadgets imported',
      importFail: 'Import failed: ',
      cancelled: 'Cancelled',
      savedOpened: 'Saved & opened',
      downloadFail: 'Download failed: ',
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
      noMarketMatch: 'No matching programs',
      marketEmpty: 'The market is empty',
      downloading: 'Downloading…',
      download: 'Download',
      featured: 'Featured',
      all: 'All',
      byAuthor: 'Author: ',
      byModel: 'Model: ',
      invalidRop: 'This is not a valid .rop (JSON) file.',
      constAnchor: 'Constant / anchor',
      htAddr: 'Address',
      htValue: 'Value',
      htSide: 'Side',
      htExpr: 'Expression',
      htResult: 'Result',
      htLE: 'Little-endian',
      htConst: 'Constant',
      htAnchor: 'Anchor',
      htAnchorDef: 'Anchor definition',
      htValueBlock: 'Value block',
    },
  };
  let lang = 'zh-CN';
  function t(key) {
    const pack = STR[lang] || STR['zh-CN'];
    return pack[key] !== undefined ? pack[key] : (STR['zh-CN'][key] || key);
  }

  // 设置状态（由宿主推送）
  let showGadgetDisasm = false;
  let showGadgetHoverDisasm = false;
  let disasFile = '';
  let disasLoaded = false;
  const disasmCache = new Map(); // addr -> { lines } | { error }
  let hoveredAddr = null; // 当前悬停的 gadget 地址，用于异步反汇编加载后更新提示框

  /* ---------------- 图标（feather 风格 SVG） ---------------- */
  const ICONS = {
    'new-file':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    'list':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    'play':
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    'copy':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    plus:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    globe:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    gear:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    code:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  };

  /* ---------------- 状态 ---------------- */
  const state = {
    input: '',
    gadgets: [],
    leftStartAddress: 'E9E0',
    rightStartAddress: 'D710',
    ideVersion: 100,
  };
  let fileName = 'untitled.rop';
  let dirty = false;
  let parsed = null;
  let byteStarts = [];
  let lineStarts = [0];
  let saveTimer = null;
  let editingGadgetIndex = -1;
  let editingGadget = null;
  let acItems = [];
  let acSelected = 0;
  let acKind = 'gadget';
  let marketItems = [];
  let marketLoading = false;
  let marketError = '';
  let downloadingId = null;
  let challenge = null;
  let challengeLoading = false;
  let injectAddress = '';
  let launcher = '';
  let launcherAddr = 'D180';
  let activeTab = null; // 侧栏当前 tab：compile / gadgets / market / settings

  /* ---------------- DOM ---------------- */
  document.getElementById('app').innerHTML = `
    <div class="error-banner" id="errorBanner" hidden></div>
    <div class="toolbar">
      <div class="tb-left">
        <div class="tb-emu">
          <span class="tb-field"><label for="injectAddress" data-i18n="injectAddr"></label><input class="addr-input" id="injectAddress" maxlength="5" spellcheck="false" /></span>
          <button class="tb-btn primary" id="btnWriteRam" data-i18n-title="writeRamTitle">${ICONS.play}<span data-i18n="writeRam"></span></button>
          <span class="tb-field"><label for="launcherAddr" data-i18n="addr"></label><input class="addr-input" id="launcherAddr" maxlength="5" value="D180" spellcheck="false" /></span>
          <input class="text-input tb-launcher" id="launcher" data-i18n-ph="launcherPh" spellcheck="false" />
          <button class="tb-btn primary" id="btnWriteLauncher" data-i18n-title="writeLauncherTitle">${ICONS.play}<span data-i18n="writeLauncher"></span></button>
          <span class="emu-status" id="emuError" hidden></span>
        </div>
      </div>
      <div class="tb-right">
        <button class="tb-btn" id="btnNew" data-i18n-title="newFileTitle">${ICONS['new-file']}</button>
        <button class="tb-btn" id="btnGadgets" data-i18n-title="gadgetsTitle">${ICONS.list}<span class="tb-badge" id="gadgetCount">0</span></button>
        <button class="tb-btn" id="btnCompile" data-i18n-title="compile">${ICONS.play}</button>
        <button class="tb-btn" id="btnMarket" data-i18n-title="market">${ICONS.globe}<span class="market-badge" id="marketBadge" hidden></span></button>
        <button class="tb-btn" id="btnSettings" data-i18n-title="settings">${ICONS.gear}</button>
        <button class="tb-btn" id="btnAbout" data-i18n-title="aboutTitle">${ICONS.info}</button>
      </div>
    </div>

    <div class="find-panel" id="findPanel" hidden>
      <div class="find-row">
        <input class="find-input" id="findInput" type="text" placeholder="查找…" spellcheck="false" />
        <span class="find-count" id="findCount"></span>
        <button class="find-btn" id="findPrev" title="上一个">▲</button>
        <button class="find-btn" id="findNext" title="下一个">▼</button>
        <button class="find-btn" id="findToggleReplace" title="替换">⤵</button>
        <button class="find-btn find-close" id="findClose" title="关闭">×</button>
      </div>
      <div class="find-row" id="replaceRow" hidden>
        <input class="find-input" id="replaceInput" type="text" placeholder="替换…" spellcheck="false" />
        <button class="find-btn" id="replaceOne" title="替换">替换</button>
        <button class="find-btn" id="replaceAll" title="全部替换">全部替换</button>
      </div>
    </div>

    <div class="main">
      <div class="editor">
        <div class="gutter" id="gutterLeft"><div class="gutter-inner"></div></div>
        <div class="code-wrap" id="codeWrap">
          <div class="highlight" id="highlight"></div>
          <textarea class="code-input" id="input" spellcheck="false" wrap="off"></textarea>
          <div class="autocomplete" id="autocomplete" hidden></div>
          <div class="hover-tip" id="hoverTip" hidden></div>
        </div>
        <div class="gutter right" id="gutterRight"><div class="gutter-inner"></div></div>
      </div>

      <div class="side-divider" id="sideDivider" hidden></div>

      <div class="sidepanel" id="sidepanel" hidden>
        <div class="sidepanel-tabs">
          <button class="sp-tab" data-tab="compile" data-i18n="compile"></button>
          <button class="sp-tab" data-tab="gadgets">Gadgets</button>
          <button class="sp-tab" data-tab="market" data-i18n="market"></button>
          <button class="sp-tab" data-tab="settings" data-i18n="settings"></button>
          <div class="spacer"></div>
          <button class="sp-close" id="btnClosePanel" data-i18n-title="closePanelTitle">${ICONS.close}</button>
        </div>
        <div class="sidepanel-body">
          <div class="tab-content" id="panelCompile" hidden>
            <div class="compile-setting">
              <span class="field"><span data-i18n="leftAddr"></span> <input class="addr-input" id="leftAddrInput" maxlength="5" /></span>
              <span class="field"><span data-i18n="rightAddr"></span> <input class="addr-input" id="rightAddrInput" maxlength="5" /></span>
            </div>
            <div class="compile-actions">
              <button class="icon-btn" id="btnCopyHex">${ICONS.copy}<span data-i18n="copyHex"></span></button>
              <button class="icon-btn" id="btnCopyDump">${ICONS.copy}<span data-i18n="copyDump"></span></button>
            </div>
            <div class="compile-info" id="compileInfo"></div>
            <div class="compile-hint" data-i18n="compileHint"></div>
            <div class="hexdump" id="hexdump"></div>
          </div>

          <div class="tab-content" id="panelGadgets" hidden>
            <div class="panel-toolbar">
              <input class="search-input" id="gadgetSearch" type="text" data-i18n-ph="gadgetSearchPh" />
              <button class="icon-btn primary" id="btnAddGadget">${ICONS.plus}<span data-i18n="add"></span></button>
              <button class="icon-btn" id="btnImportGadgets" data-i18n-title="importTitle">${ICONS.globe}<span data-i18n="import"></span></button>
              <button class="icon-btn" id="btnExportGadgets" data-i18n-title="exportTitle">${ICONS.download}<span data-i18n="export"></span></button>
            </div>
            <div class="gadget-list" id="gadgetList"></div>
          </div>

          <div class="tab-content" id="panelMarket" hidden>
            <div class="panel-toolbar">
              <input class="search-input" id="marketSearch" type="text" data-i18n-ph="marketSearchPh" />
              <button class="icon-btn primary" id="btnPublish">${ICONS.plus}<span data-i18n="publish"></span></button>
            </div>
            <div class="market-list" id="marketList"></div>
          </div>

          <div class="tab-content" id="panelSettings" hidden>
            <div class="settings-body">
              <div class="form-row">
                <label data-i18n="lang"></label>
                <select class="tag-select" id="selLanguage">
                  <option value="zh-CN">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div class="form-row">
                <label class="switch-row">
                  <input type="checkbox" id="chkDisasm" />
                  <span data-i18n="disasmExp"></span>
                </label>
                <div class="settings-hint" data-i18n="disasmHint"></div>
              </div>
              <div class="form-row" id="disasRow" hidden>
                <label><span data-i18n="disasmProvide"></span></label>
                <div class="disas-picker">
                  <button class="icon-btn" id="btnChooseDisas">${ICONS.download}<span data-i18n="chooseFile"></span></button>
                  <span class="disas-file" id="disasFile"></span>
                </div>
              </div>
              <div class="form-row" id="disasmHoverRow" hidden>
                <label class="switch-row">
                  <input type="checkbox" id="chkHoverDisasm" />
                  <span data-i18n="disasmHoverExp"></span>
                </label>
                <div class="settings-hint" data-i18n="disasmHoverHint"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <span id="bytesInfo">0 bytes · 0 errors</span>
      <div class="footer-right">
        <div class="footer-jump">
          <span class="jump-label" data-i18n="jumpLabel"></span>
          <select class="jump-side" id="jumpSide" data-i18n-title="jumpSideTitle">
            <option value="left" data-i18n="left"></option>
            <option value="right" data-i18n="right"></option>
          </select>
          <input class="jump-addr" id="jumpAddr" data-i18n-ph="jumpPh" maxlength="5" spellcheck="false" autocomplete="off" />
        </div>
        <span id="cursorInfo"></span>
      </div>
    </div>

    <div class="overlay" id="publishOverlay" hidden>
      <div class="panel">
        <div class="panel-header">
          <h2 data-i18n="publishTitle"></h2>
          <div class="spacer"></div>
          <button class="icon-btn" id="btnClosePublish">${ICONS.close}</button>
        </div>
        <div class="panel-body">
          <div class="form-row"><label data-i18n="progName"></label><input class="text-input" id="publishName" data-i18n-ph="progNamePh" /></div>
          <div class="form-row"><label data-i18n="author"></label><input class="text-input" id="publishAuthor" data-i18n-ph="authorPh" /></div>
          <div class="form-row"><label data-i18n="model"></label>
            <select class="tag-select" id="publishModel" style="width:100%">
              <option value="" data-i18n="modelSel"></option>
              <option value="fx-991CNX (VerC)">fx-991CNX (VerC)</option>
              <option value="fx-991CNX (VerF)">fx-991CNX (VerF)</option>
              <option value="other" data-i18n="other"></option>
            </select>
          </div>
          <div class="form-row" id="publishOtherRow" hidden><label data-i18n="otherModel"></label><input class="text-input" id="publishOtherModel" data-i18n-ph="otherModelPh" /></div>
          <div class="form-row"><label data-i18n="desc"></label><textarea class="text-input" id="publishDescription" rows="6" data-i18n-ph="descPh"></textarea></div>
          <div class="form-row">
            <label data-i18n="challenge"></label>
            <div class="challenge-hint" id="challengeHint" data-i18n="challengeLoading"></div>
            <input class="text-input" id="challengeAnswer" maxlength="9" data-i18n-ph="challengePh" disabled />
          </div>
          <div class="market-actions">
            <button class="icon-btn" id="btnCancelPublish" data-i18n="cancel"></button>
            <button class="icon-btn primary" id="btnConfirmPublish" data-i18n="publish"></button>
          </div>
        </div>
      </div>
    </div>

    <div class="toast" id="toast" hidden></div>
  `;

  const el = {
    errorBanner: document.getElementById('errorBanner'),
    btnNew: document.getElementById('btnNew'),
    btnGadgets: document.getElementById('btnGadgets'),
    btnCompile: document.getElementById('btnCompile'),
    btnMarket: document.getElementById('btnMarket'),
    marketBadge: document.getElementById('marketBadge'),
    btnSettings: document.getElementById('btnSettings'),
    btnAbout: document.getElementById('btnAbout'),
    gadgetCount: document.getElementById('gadgetCount'),
    gutterLeft: document.getElementById('gutterLeft'),
    gutterRight: document.getElementById('gutterRight'),
    codeWrap: document.getElementById('codeWrap'),
    highlight: document.getElementById('highlight'),
    input: document.getElementById('input'),
    autocomplete: document.getElementById('autocomplete'),
    hoverTip: document.getElementById('hoverTip'),
    bytesInfo: document.getElementById('bytesInfo'),
    cursorInfo: document.getElementById('cursorInfo'),
    jumpAddr: document.getElementById('jumpAddr'),
    jumpSide: document.getElementById('jumpSide'),
    sidepanel: document.getElementById('sidepanel'),
    sideDivider: document.getElementById('sideDivider'),
    btnClosePanel: document.getElementById('btnClosePanel'),
    tabs: document.querySelectorAll('.sp-tab'),
    panelCompile: document.getElementById('panelCompile'),
    panelGadgets: document.getElementById('panelGadgets'),
    panelMarket: document.getElementById('panelMarket'),
    panelSettings: document.getElementById('panelSettings'),
    selLanguage: document.getElementById('selLanguage'),
    chkDisasm: document.getElementById('chkDisasm'),
    disasRow: document.getElementById('disasRow'),
    btnChooseDisas: document.getElementById('btnChooseDisas'),
    disasFileLabel: document.getElementById('disasFile'),
    chkHoverDisasm: document.getElementById('chkHoverDisasm'),
    disasmHoverRow: document.getElementById('disasmHoverRow'),
    gadgetSearch: document.getElementById('gadgetSearch'),
    gadgetList: document.getElementById('gadgetList'),
    btnAddGadget: document.getElementById('btnAddGadget'),
    btnImportGadgets: document.getElementById('btnImportGadgets'),
    btnExportGadgets: document.getElementById('btnExportGadgets'),
    leftAddrInput: document.getElementById('leftAddrInput'),
    rightAddrInput: document.getElementById('rightAddrInput'),
    injectAddress: document.getElementById('injectAddress'),
    launcher: document.getElementById('launcher'),
    launcherAddr: document.getElementById('launcherAddr'),
    btnWriteRam: document.getElementById('btnWriteRam'),
    btnWriteLauncher: document.getElementById('btnWriteLauncher'),
    emuError: document.getElementById('emuError'),
    btnCopyHex: document.getElementById('btnCopyHex'),
    btnCopyDump: document.getElementById('btnCopyDump'),
    compileInfo: document.getElementById('compileInfo'),
    hexdump: document.getElementById('hexdump'),
    marketSearch: document.getElementById('marketSearch'),
    marketList: document.getElementById('marketList'),
    btnPublish: document.getElementById('btnPublish'),
    publishOverlay: document.getElementById('publishOverlay'),
    btnClosePublish: document.getElementById('btnClosePublish'),
    publishName: document.getElementById('publishName'),
    publishAuthor: document.getElementById('publishAuthor'),
    publishModel: document.getElementById('publishModel'),
    publishOtherRow: document.getElementById('publishOtherRow'),
    publishOtherModel: document.getElementById('publishOtherModel'),
    publishDescription: document.getElementById('publishDescription'),
    challengeHint: document.getElementById('challengeHint'),
    challengeAnswer: document.getElementById('challengeAnswer'),
    btnCancelPublish: document.getElementById('btnCancelPublish'),
    btnConfirmPublish: document.getElementById('btnConfirmPublish'),
    toast: document.getElementById('toast'),
    findPanel: document.getElementById('findPanel'),
    findInput: document.getElementById('findInput'),
    findCount: document.getElementById('findCount'),
    findPrev: document.getElementById('findPrev'),
    findNext: document.getElementById('findNext'),
    findToggleReplace: document.getElementById('findToggleReplace'),
    findClose: document.getElementById('findClose'),
    replaceRow: document.getElementById('replaceRow'),
    replaceInput: document.getElementById('replaceInput'),
    replaceOne: document.getElementById('replaceOne'),
    replaceAll: document.getElementById('replaceAll'),
  };

  /* ---------------- i18n：应用静态文案 ---------------- */
  function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((node) => {
      node.placeholder = t(node.dataset.i18nPh);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((node) => {
      node.title = t(node.dataset.i18nTitle);
    });
    // 带图标按钮的文字 span 已在 data-i18n 中处理
    renderFooter();
    if (activeTab === 'gadgets') renderGadgetList();
    if (activeTab === 'market') renderMarketList();
    if (activeTab === 'settings') syncSettingsUI();
  }

  /* ---------------- 工具函数 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function parseBase(s) {
    const n = parseInt(String(s || '0').replace(/^0x/i, ''), 16);
    return isNaN(n) ? 0 : n;
  }

  function hexAddr(v) {
    return Math.max(0, Math.floor(v)).toString(16).toUpperCase().padStart(4, '0');
  }

  function countLessThan(sortedArr, x) {
    let lo = 0, hi = sortedArr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedArr[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function deepCopy(g) {
    return JSON.parse(JSON.stringify(g));
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fallthrough */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function flashCopy(btn, originalLabel) {
    const prev = btn.innerHTML;
    btn.innerHTML = ICONS.check + t('copied');
    setTimeout(() => { btn.innerHTML = prev; }, 1400);
  }

  let toastTimer = null;
  function showToast(text, isError) {
    el.toast.textContent = text;
    el.toast.classList.toggle('error', !!isError);
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
  }

  function byteOffsetAt(pos) {
    return countLessThan(byteStarts, pos);
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    parsed = window.RopCompiler.parseRopInput(state.input, state.gadgets, {
      leftStartAddress: state.leftStartAddress,
      rightStartAddress: state.rightStartAddress,
    });
    byteStarts = parsed.byteStartPositions.slice().sort((a, b) => a - b);

    lineStarts = [0];
    for (let i = 0; i < state.input.length; i++) {
      if (state.input.charCodeAt(i) === 10) lineStarts.push(i + 1);
    }

    renderHighlight();
    renderGutters();
    renderFooter();
    updateCursor();
    if (activeTab === 'compile') renderCompile();
    syncEmuInjectAddress();
  }

  function renderHighlight() {
    const out = [];
    for (const spans of parsed.highlightLines) {
      let line = '';
      for (const span of spans) {
        const cls = span.type ? span.type.split(',').filter(Boolean).join(' ') : '';
        let html = escapeHtml(span.content);
        let attrs = '';
        const type = span.type || '';

        if (type.includes('gadget') && type.includes('closed')) {
          const m = span.content.match(/^#-?([^;\s]+)/);
          if (m) attrs = ` data-gadget="${escapeHtml(m[1])}"`;
        } else if (type.includes('anchor') && type.includes('closed')) {
          const m = span.content.match(/^<-?([^>\s]+)/);
          if (m) attrs = ` data-anchor="${escapeHtml(m[1])}"`;
        } else if (type.includes('constant') && type.includes('name')) {
          const m = span.content.match(/^\$([A-Za-z0-9_-]+)/);
          if (m) attrs = ` data-const="${escapeHtml(m[1])}"`;
        } else if (type.includes('value') && type.includes('closed')) {
          attrs = ' data-value-block';
          html = html.replace(/(\$)([A-Za-z0-9_-]+)/g,
            '<span class="const-ref" data-const="$2">$1$2</span>');
        }

        line += `<span class="${cls}"${attrs}>${html}</span>`;
      }
      out.push(line);
    }
    // 每行一个块级 div，行数与 textarea 完全一致（避免 pre + 换行符的尾行歧义导致整体偏移一行）
    el.highlight.innerHTML = out.map((l) => `<div class="hl-line">${l}</div>`).join('');
  }

  function renderGutters() {
    const leftBase = parseBase(state.leftStartAddress);
    const rightBase = parseBase(state.rightStartAddress);
    let l = '', r = '';
    for (let i = 0; i < lineStarts.length; i++) {
      const off = byteOffsetAt(lineStarts[i]);
      l += `<div class="gutter-line" title="0x${hexAddr(leftBase + off)}">${hexAddr(leftBase + off)}</div>`;
      r += `<div class="gutter-line" title="0x${hexAddr(rightBase + off)}">${hexAddr(rightBase + off)}</div>`;
    }
    el.gutterLeft.firstElementChild.innerHTML = l;
    el.gutterRight.firstElementChild.innerHTML = r;
    curLineIdx = -1;
    updateGutterCurrentLine(el.input.selectionStart || 0);
  }

  function renderFooter() {
    const p = parsed || { totalBytes: 0, errorCount: 0 };
    el.bytesInfo.textContent = `${p.totalBytes} bytes · ${p.errorCount} errors`;
    el.bytesInfo.classList.toggle('err', p.errorCount > 0);
    el.gadgetCount.textContent = state.gadgets.length;
  }

  let curLineIdx = -1;
  function updateCursor() {
    const pos = el.input.selectionStart;
    const off = byteOffsetAt(pos);
    const left = hexAddr(parseBase(state.leftStartAddress) + off);
    const right = hexAddr(parseBase(state.rightStartAddress) + off);
    el.cursorInfo.textContent = `L:${left}  R:${right}`;
    vscode.postMessage({ type: 'cursor', left, right });
    updateByteHighlight();
    updateGutterCurrentLine(pos);
  }

  // 高亮光标所在行的左右地址栏行号
  function updateGutterCurrentLine(pos) {
    let lo = 0, hi = lineStarts.length;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= pos) lo = mid;
      else hi = mid;
    }
    if (lo === curLineIdx) return;
    const lg = el.gutterLeft.firstElementChild;
    const rg = el.gutterRight.firstElementChild;
    if (curLineIdx >= 0) {
      if (lg.children[curLineIdx]) lg.children[curLineIdx].classList.remove('cur');
      if (rg.children[curLineIdx]) rg.children[curLineIdx].classList.remove('cur');
    }
    curLineIdx = lo;
    if (lg.children[lo]) lg.children[lo].classList.add('cur');
    if (rg.children[lo]) rg.children[lo].classList.add('cur');
  }

  // 找到光标处对应的字节索引（一个 token 可能对应多个字节，如 gadget 4 字节）
  function byteIndicesAtPos(pos) {
    const map = parsed ? parsed.charPosInInputMap : [];
    const set = new Set();
    const n = Math.floor(map.length / 2);
    for (let b = 0; b < n; b++) {
      const s = map[b * 2];
      const e = map[b * 2 + 1];
      if (s !== undefined && e !== undefined && pos >= s && pos <= e) set.add(b);
    }
    return set;
  }

  function updateByteHighlight() {
    if (el.sidepanel.hidden || activeTab !== 'compile') return;
    const set = byteIndicesAtPos(el.input.selectionStart);
    el.hexdump.querySelectorAll('[data-byte]').forEach((sp) => {
      sp.classList.toggle('sel', set.has(parseInt(sp.dataset.byte, 10)));
    });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      vscode.postMessage({
        type: 'content',
        input: state.input,
        gadgets: state.gadgets,
        leftStartAddress: state.leftStartAddress,
        rightStartAddress: state.rightStartAddress,
      });
    }, 300);
  }

  /* ---------------- 输入 / 光标 / 滚动 ---------------- */
  el.input.addEventListener('input', () => {
    state.input = el.input.value;
    dirty = true;
    render();
    scheduleSave();
    handleAutocomplete();
  });

  function syncScroll() {
    el.highlight.scrollTop = el.input.scrollTop;
    el.highlight.scrollLeft = el.input.scrollLeft;
    el.gutterLeft.scrollTop = el.input.scrollTop;
    el.gutterRight.scrollTop = el.input.scrollTop;
  }
  el.input.addEventListener('scroll', syncScroll);

  // 持续 rAF 同步，避免大幅度移动光标 / 滚动时高亮层与光标错位。
  function startScrollSyncLoop() {
    const tick = () => {
      syncScroll();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  startScrollSyncLoop();

  // 在可能触发自动滚动的操作后立即同步一次。
  ['keydown', 'keyup', 'mousedown', 'click', 'focus', 'wheel'].forEach((evt) => {
    el.input.addEventListener(evt, syncScroll);
  });

  el.input.addEventListener('click', updateCursor);
  el.input.addEventListener('keyup', updateCursor);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === el.input) updateCursor();
  });

  /* ---------------- Tab 键：对齐注释 ---------------- */
  el.input.addEventListener('keydown', (e) => {
    if (el.input.readOnly) return;
    if (!el.autocomplete.hidden) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        acSelected = Math.min(acSelected + 1, acItems.length - 1);
        renderAutocomplete();
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        acSelected = Math.max(acSelected - 1, 0);
        renderAutocomplete();
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectAutocomplete(acSelected);
        return;
      } else if (e.key === 'Escape') {
        hideAutocomplete();
        return;
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      alignComment();
    } else if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleComment();
    } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      findOpen(false);
    } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      findOpen(true);
    } else if (e.key === 'Escape') {
      if (!el.findPanel.hidden) {
        e.preventDefault();
        findClose();
      }
    }
  });

  function alignComment() {
    const text = state.input;
    const cursorPos = el.input.selectionStart;
    const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    const currentCol = cursorPos - lineStart;
    const beforeCurrent = text.substring(0, lineStart);
    const lines = beforeCurrent.split('\n');
    let targetCol = null;
    for (let i = lines.length - 2, tried = 0; i >= 0 && tried < 50; i--, tried++) {
      const m = lines[i].match(/\/\/.*$/);
      if (m) {
        const col = m.index;
        if (col > currentCol) { targetCol = col; break; }
      }
    }
    const spaces = targetCol != null ? ' '.repeat(targetCol - currentCol) : '  ';
    insertText(spaces);
  }

  /* ---------------- Ctrl+/ 注释切换 ---------------- */
  function toggleComment() {
    const text = state.input;
    const start = el.input.selectionStart;
    const end = el.input.selectionEnd;
    // 获取选区涉及的所有行号
    const before = text.substring(0, start);
    const firstLine = before.split('\n').length - 1; // 0-based
    const upToEnd = text.substring(0, end);
    const lastLine = upToEnd.split('\n').length - 1;

    const lines = text.split('\n');

    // 检查非空行是否全部已注释
    let allCommented = true;
    let hasNonEmpty = false;
    for (let i = firstLine; i <= lastLine; i++) {
      if (lines[i].trim().length > 0) {
        hasNonEmpty = true;
        if (!lines[i].trim().startsWith('//')) { allCommented = false; break; }
      }
    }
    // 全是空行，无需操作
    if (!hasNonEmpty) return;

    let newLines = lines.slice();
    let firstLineDelta = 0; // 首行字符增减量
    let totalDelta = 0;     // 总增减量，用于保持选区
    for (let i = firstLine; i <= lastLine; i++) {
      if (lines[i].trim().length === 0) continue; // 跳过空行
      if (allCommented) {
        // 取消注释：去掉 // 及后面的一个空格（如果有）
        const idx = newLines[i].indexOf('//');
        if (idx >= 0) {
          const removeCount = (newLines[i].charAt(idx + 2) === ' ') ? 3 : 2;
          newLines[i] = newLines[i].substring(0, idx) + newLines[i].substring(idx + removeCount);
          if (i === firstLine) firstLineDelta = -removeCount;
          totalDelta += -removeCount;
        }
      } else {
        // 添加注释，主动加一个空格
        newLines[i] = '// ' + newLines[i];
        if (i === firstLine) firstLineDelta = 3;
        totalDelta += 3;
      }
    }

    state.input = newLines.join('\n');
    el.input.value = state.input;
    dirty = true;
    render();
    scheduleSave();
    hideAutocomplete();

    // 保持选区不折叠
    const newStart = Math.max(0, start + firstLineDelta);
    const newEnd = Math.max(newStart, end + totalDelta);
    try { el.input.setSelectionRange(newStart, newEnd); } catch { /* 越界忽略 */ }
  }

  function insertText(text) {
    const start = el.input.selectionStart;
    const end = el.input.selectionEnd;
    el.input.setRangeText(text, start, end, 'end');
    state.input = el.input.value;
    dirty = true;
    render();
    scheduleSave();
  }

  /* ---------------- 查找 / 替换 ---------------- */
  let findMatches = [];
  let findIndex = -1;

  function findOpen(showReplace) {
    el.findPanel.hidden = false;
    el.findInput.value = '';
    el.replaceRow.hidden = !showReplace;
    el.findCount.textContent = '';
    findMatches = [];
    findIndex = -1;
    el.findInput.focus();
  }

  function findClose() {
    el.findPanel.hidden = true;
    el.input.focus();
  }

  function findDoSearch() {
    const q = el.findInput.value;
    if (!q) {
      findMatches = [];
      findIndex = -1;
      el.findCount.textContent = '';
      return;
    }
    const text = state.input;
    findMatches = [];
    let idx = 0;
    while (true) {
      idx = text.indexOf(q, idx);
      if (idx < 0) break;
      findMatches.push({ start: idx, end: idx + q.length });
      idx += q.length;
    }
    if (findMatches.length === 0) {
      findIndex = -1;
      el.findCount.textContent = '0/0';
      return;
    }
    // 保持当前光标位置附近的匹配索引
    const curPos = el.input.selectionStart;
    let best = 0;
    for (let i = 0; i < findMatches.length; i++) {
      if (findMatches[i].start <= curPos) best = i;
    }
    findIndex = best;
    findGoTo();
  }

  function findGoTo() {
    if (findMatches.length === 0 || findIndex < 0) return;
    const m = findMatches[findIndex];
    el.input.focus();
    el.input.setSelectionRange(m.start, m.end);
    // 滚动到匹配行
    const lineIndex = state.input.substring(0, m.start).split('\n').length - 1;
    const lh = parseFloat(getComputedStyle(el.input).lineHeight) || 21;
    el.input.scrollTop = Math.max(0, lineIndex * lh - el.input.clientHeight / 2);
    el.findCount.textContent = (findIndex + 1) + '/' + findMatches.length;
  }

  function findPrev() {
    if (findMatches.length === 0) return;
    findIndex = (findIndex - 1 + findMatches.length) % findMatches.length;
    findGoTo();
  }

  function findNext() {
    if (findMatches.length === 0) return;
    findIndex = (findIndex + 1) % findMatches.length;
    findGoTo();
  }

  function replaceOne() {
    if (findMatches.length === 0 || findIndex < 0) return;
    const m = findMatches[findIndex];
    const r = el.replaceInput.value;
    el.input.focus();
    el.input.setSelectionRange(m.start, m.end);
    el.input.setRangeText(r, m.start, m.end, 'select');
    state.input = el.input.value;
    dirty = true;
    render();
    scheduleSave();
    // 重新搜索
    const newStart = m.start + r.length;
    findDoSearch();
    // 恢复匹配导航位置
    for (let i = 0; i < findMatches.length; i++) {
      if (findMatches[i].start >= newStart) { findIndex = i; break; }
    }
    if (findIndex < 0) findIndex = findMatches.length - 1;
    if (findMatches.length > 0) findGoTo();
  }

  function replaceAll() {
    const q = el.findInput.value;
    const r = el.replaceInput.value;
    if (!q) return;
    const text = state.input;
    let result = '';
    let lastIdx = 0;
    let count = 0;
    let idx = 0;
    while (true) {
      idx = text.indexOf(q, idx);
      if (idx < 0) break;
      result += text.substring(lastIdx, idx) + r;
      idx += q.length;
      lastIdx = idx;
      count++;
    }
    result += text.substring(lastIdx);
    if (count === 0) return;
    state.input = result;
    el.input.value = state.input;
    dirty = true;
    render();
    scheduleSave();
    // 关闭查找面板
    findClose();
  }

  // 查找面板事件绑定
  el.findInput.addEventListener('input', findDoSearch);
  el.findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrev();
      else findNext();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      findClose();
    } else if ((e.key === 'f' || e.key === 'h') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      findClose();
    }
  });
  el.replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      findClose();
    }
  });
  el.findPrev.addEventListener('click', findPrev);
  el.findNext.addEventListener('click', findNext);
  el.findToggleReplace.addEventListener('click', () => {
    el.replaceRow.hidden = !el.replaceRow.hidden;
    if (!el.replaceRow.hidden) el.replaceInput.focus();
  });
  el.findClose.addEventListener('click', findClose);
  el.replaceOne.addEventListener('click', replaceOne);
  el.replaceAll.addEventListener('click', replaceAll);

  /* ---------------- 工具栏 + 右侧分栏 ---------------- */
  el.btnNew.addEventListener('click', () => vscode.postMessage({ type: 'new' }));
  el.btnGadgets.addEventListener('click', () => togglePanel('gadgets'));
  el.btnCompile.addEventListener('click', () => togglePanel('compile'));
  el.btnMarket.addEventListener('click', () => togglePanel('market'));
  el.btnSettings.addEventListener('click', () => togglePanel('settings'));
  el.btnAbout.addEventListener('click', () => vscode.postMessage({ type: 'about' }));
  el.btnClosePanel.addEventListener('click', () => {
    el.sidepanel.hidden = true;
    el.sideDivider.hidden = true;
    activeTab = null;
  });
  el.tabs.forEach((t) => t.addEventListener('click', () => openPanel(t.dataset.tab)));

  function openPanel(tab) {
    el.sidepanel.hidden = false;
    el.sideDivider.hidden = false;
    setActiveTab(tab);
    if (tab === 'compile') openCompile();
    else if (tab === 'gadgets') openGadgets();
    else if (tab === 'market') openMarket();
    else if (tab === 'settings') syncSettingsUI();
  }

  function togglePanel(tab) {
    if (!el.sidepanel.hidden && activeTab === tab) {
      el.sidepanel.hidden = true;
      el.sideDivider.hidden = true;
      activeTab = null;
    } else {
      openPanel(tab);
    }
  }

  function setActiveTab(tab) {
    activeTab = tab;
    el.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    el.panelCompile.hidden = tab !== 'compile';
    el.panelGadgets.hidden = tab !== 'gadgets';
    el.panelMarket.hidden = tab !== 'market';
    el.panelSettings.hidden = tab !== 'settings';
  }

  // 右侧分栏宽度可拖拽调整
  let sideWidth = 0; // 0 = 用 CSS 默认值
  function applySideWidth() {
    el.sidepanel.style.width = (sideWidth || 420) + 'px';
  }
  el.sideDivider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = el.sidepanel.getBoundingClientRect().width;
    const onMove = (ev) => {
      const w = Math.max(240, Math.min(startW - (ev.clientX - startX), Math.floor(window.innerWidth * 0.8)));
      sideWidth = w;
      applySideWidth();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
  });

  /* ---------------- Gadgets 面板 ---------------- */
  function openGadgets() {
    el.gadgetSearch.value = '';
    editingGadgetIndex = -1;
    editingGadget = null;
    renderGadgetList();
    el.gadgetSearch.focus();
  }
  el.btnAddGadget.addEventListener('click', () => {
    el.gadgetSearch.value = '';
    const g = { name: '', addr: '', desc: '', tags: [] };
    state.gadgets.push(g);
    editingGadgetIndex = state.gadgets.length - 1;
    editingGadget = deepCopy(g);
    renderGadgetList();
  });

  el.btnExportGadgets.addEventListener('click', () => {
    vscode.postMessage({ type: 'gadgets:export', gadgets: state.gadgets });
  });

  el.btnImportGadgets.addEventListener('click', () => {
    vscode.postMessage({ type: 'gadgets:import' });
  });

  el.gadgetSearch.addEventListener('input', renderGadgetList);

  const TAG_COLORS = ['gray', 'blue', 'yellow', 'orange', 'green', 'purple'];

  function filteredGadgets() {
    const q = el.gadgetSearch.value.trim().toLowerCase();
    return state.gadgets
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => {
        if (!q) return true;
        return (
          (g.name || '').toLowerCase().includes(q) ||
          (g.addr || '').toLowerCase().includes(q) ||
          (g.desc || '').toLowerCase().includes(q) ||
          (g.tags || []).some((t) => (t.name || '').toLowerCase().includes(q))
        );
      });
  }

  function tagHtml(tag, tagIndex) {
    const color = TAG_COLORS.includes(tag.color) ? tag.color : 'gray';
    let inner = `<span class="tag ${color}">${escapeHtml(tag.name)}`;
    if (tagIndex !== undefined) {
      inner += `<span class="tag-x" data-action="remove-tag" data-tagindex="${tagIndex}">×</span>`;
    }
    inner += '</span>';
    return inner;
  }

  function renderGadgetList() {
    const list = filteredGadgets();

    if (list.length === 0 && state.gadgets.length === 0) {
      el.gadgetList.innerHTML = '<div class="empty-hint">' + t('noGadgets') + '</div>';
      return;
    }
    if (list.length === 0) {
      el.gadgetList.innerHTML = '<div class="empty-hint">' + t('noGadgetMatch') + '</div>';
      return;
    }

    let html = '';
    for (const { g, i } of list) {
      if (i === editingGadgetIndex && editingGadget) {
        html += gadgetEditHtml(i, editingGadget);
      } else {
        html += gadgetViewHtml(i, g);
      }
    }
    el.gadgetList.innerHTML = html;
    if (showGadgetDisasm && disasLoaded) {
      el.gadgetList.querySelectorAll('[data-disasm-addr]').forEach((pre) => {
        const addr = pre.dataset.disasmAddr;
        if (disasmCache.has(addr)) {
          fillDisasm(pre, disasmCache.get(addr));
        } else {
          pre.textContent = t('disasmLoading');
          vscode.postMessage({ type: 'gadgets:disasm', addr });
        }
      });
    }
  }

  function fillDisasm(pre, result) {
    if (!pre.isConnected) return;
    if (result && result.lines) {
      pre.textContent = result.lines.join('\n');
      pre.classList.remove('err');
    } else {
      pre.textContent = t('disasmFail');
      pre.classList.add('err');
    }
  }

  function gadgetViewHtml(i, g) {
    const tags = (g.tags || []).map((t) => tagHtml(t)).join(' ');
    const addrNorm = (g.addr || '').replace(/^0x/i, '').toUpperCase();
    const disasmHtml =
      showGadgetDisasm && disasLoaded && addrNorm
        ? `<pre class="gadget-disasm" data-disasm-addr="${escapeHtml(addrNorm)}"></pre>`
        : '';
    return `
      <div class="gadget-card" data-index="${i}">
        <div class="gadget-card-header">
          <span class="gadget-name">${escapeHtml(g.name || t('unnamed'))}</span>
          ${tags}
          <div class="gadget-actions">
            <button class="icon-btn" data-action="edit" data-index="${i}" title="${t('edit')}">${ICONS.edit}</button>
            <button class="icon-btn" data-action="delete" data-index="${i}" title="${t('delete')}">${ICONS.trash}</button>
          </div>
        </div>
        <span class="gadget-addr">${escapeHtml(g.addr || '')}</span>
        <p class="gadget-desc">${escapeHtml(g.desc || '')}</p>
        ${disasmHtml}
      </div>`;
  }

  function gadgetEditHtml(i, g) {
    const tags = (g.tags || []).map((t, k) => tagHtml(t, k)).join(' ');
    const colorOptions = TAG_COLORS.map(
      (c) => `<option value="${c}">${c}</option>`
    ).join('');
    return `
      <div class="gadget-card highlighted" data-index="${i}">
        <div class="form-row"><label>${t('name')}</label>
          <input class="text-input" data-field="name" value="${escapeHtml(g.name)}" placeholder="pop-xr12" /></div>
        <div class="form-row"><label>${t('addrHex')}</label>
          <input class="text-input" data-field="addr" value="${escapeHtml(g.addr)}" placeholder="1D52C" /></div>
        <div class="form-row"><label>${t('desc')}</label>
          <textarea class="text-input" data-field="desc" rows="3" placeholder="">${escapeHtml(g.desc)}</textarea></div>
        <div class="form-row"><label>${t('tag')}</label>
          <div class="tags-editor">${tags}
            <input class="text-input tag-input" data-field="tagName" placeholder="${t('tagNamePh')}" />
            <select class="tag-select" data-field="tagColor">${colorOptions}</select>
            <button class="icon-btn" data-action="add-tag" data-index="${i}" title="${t('addTag')}">${ICONS.plus}</button>
          </div></div>
        <div class="gadget-actions">
          <button class="icon-btn primary" data-action="save" data-index="${i}" title="${t('save')}">${ICONS.check}${t('save')}</button>
          <button class="icon-btn" data-action="cancel" title="${t('cancel')}">${ICONS.close}</button>
        </div>
      </div>`;
  }

  el.gadgetList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = btn.dataset.index !== undefined ? parseInt(btn.dataset.index, 10) : editingGadgetIndex;

    if (action === 'edit') {
      el.gadgetSearch.value = '';
      editingGadgetIndex = idx;
      editingGadget = deepCopy(state.gadgets[idx]);
      renderGadgetList();
    } else if (action === 'delete') {
      if (editingGadgetIndex === idx) { editingGadgetIndex = -1; editingGadget = null; }
      state.gadgets.splice(idx, 1);
      editingGadgetIndex = -1;
      editingGadget = null;
      renderGadgetList();
      markChanged();
    } else if (action === 'save') {
      saveEditingGadget();
    } else if (action === 'cancel') {
      editingGadgetIndex = -1;
      editingGadget = null;
      renderGadgetList();
    } else if (action === 'add-tag') {
      const name = (editingGadget.tagName || '').trim();
      if (name) {
        editingGadget.tags.push({ name, color: editingGadget.tagColor || 'gray' });
        editingGadget.tagName = '';
        editingGadget.tagColor = 'gray';
        renderGadgetList();
      }
    } else if (action === 'remove-tag') {
      const ti = parseInt(btn.dataset.tagindex, 10);
      if (!isNaN(ti)) {
        editingGadget.tags.splice(ti, 1);
        renderGadgetList();
      }
    }
  });

  el.gadgetList.addEventListener('input', (e) => {
    if (editingGadgetIndex < 0 || !editingGadget) return;
    const field = e.target.dataset.field;
    if (!field) return;
    let v = e.target.value;
    if (field === 'name') v = v.replace(/\s+/g, '');
    if (field === 'addr') v = v.replace(/[^0-9a-fA-F]/g, '').slice(0, 5);
    editingGadget[field] = v;
  });

  el.gadgetList.addEventListener('change', (e) => {
    if (editingGadgetIndex < 0 || !editingGadget) return;
    const field = e.target.dataset.field;
    if (!field) return;
    editingGadget[field] = e.target.value;
  });

  function saveEditingGadget() {
    if (editingGadgetIndex < 0 || !editingGadget) return;
    if (!(editingGadget.name || '').trim()) return;
    let addr = (editingGadget.addr || '').toUpperCase();
    while (addr.length < 5) addr = '0' + addr;
    editingGadget.addr = addr;
    state.gadgets[editingGadgetIndex] = deepCopy(editingGadget);
    editingGadgetIndex = -1;
    editingGadget = null;
    renderGadgetList();
    markChanged();
  }

  function markChanged() {
    dirty = true;
    render();
    scheduleSave();
  }

  /* ---------------- 无效文件提示 ---------------- */
  function showError(message) {
    el.errorBanner.textContent = '⚠ ' + (message || t('invalidRop'));
    el.errorBanner.hidden = false;
    el.input.readOnly = true;
  }
  function clearError() {
    el.errorBanner.hidden = true;
    el.input.readOnly = false;
  }

  /* ---------------- 编译面板 ---------------- */
  function openCompile() {
    el.leftAddrInput.value = state.leftStartAddress;
    el.rightAddrInput.value = state.rightStartAddress;
    el.emuError.hidden = true;
    renderCompile();
  }

  function bindAddressInput(inputEl, key) {
    inputEl.addEventListener('input', () => {
      inputEl.value = inputEl.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 5);
      state[key] = inputEl.value || '0';
      renderCompile();
      markChanged();
    });
  }
  bindAddressInput(el.leftAddrInput, 'leftStartAddress');
  bindAddressInput(el.rightAddrInput, 'rightStartAddress');

  function renderCompile() {
    const hex = parsed ? parsed.hexChars : '';
    const leftBase = parseBase(state.leftStartAddress);
    const rightBase = parseBase(state.rightStartAddress);

    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(hex.slice(i, i + 2));

    let html = '';
    for (let row = 0; row * 16 < bytes.length; row++) {
      const rowBytes = bytes.slice(row * 16, row * 16 + 16);
      const byteSpans = rowBytes
        .map((b, col) => `<span class="hex-byte ${b === '00' ? 'zero' : ''}" data-byte="${row * 16 + col}">${b}</span>`)
        .join(' ');
      html += `<div class="hex-row">`
        + `<span class="hex-addr left">${hexAddr(leftBase + row * 16)}</span>`
        + `<span class="hex-bytes">${byteSpans}</span>`
        + `<span class="hex-addr right">${hexAddr(rightBase + row * 16)}</span>`
        + `</div>`;
    }
    if (bytes.length === 0) html = '<div class="empty-hint">' + t('noBytes') + '</div>';
    el.hexdump.innerHTML = html;

    const errClass = parsed && parsed.errorCount > 0 ? ' class="err"' : '';
    el.compileInfo.innerHTML = `<b>${parsed ? parsed.totalBytes : 0}</b> bytes · `
      + `<span${errClass}>${parsed ? parsed.errorCount : 0} errors</span>`;

    updateByteHighlight();
  }

  el.btnCopyHex.addEventListener('click', async () => {
    const hex = parsed ? parsed.hexChars : '';
    if (await copyText(hex)) flashCopy(el.btnCopyHex);
  });
  el.btnCopyDump.addEventListener('click', async () => {
    const hex = parsed ? parsed.hexChars : '';
    const pairs = [];
    for (let i = 0; i < hex.length; i += 2) pairs.push(hex.slice(i, i + 2));
    const dump = [];
    for (let i = 0; i < pairs.length; i += 16) dump.push(pairs.slice(i, i + 16).join(' '));
    if (await copyText(dump.join('\n'))) flashCopy(el.btnCopyDump);
  });

  // 点击编译结果中的字节 → 左下角显示左右地址 + 高亮输入区对应位置
  el.hexdump.addEventListener('click', (e) => {
    const span = e.target.closest('[data-byte]');
    if (!span) return;
    const byteIndex = parseInt(span.dataset.byte, 10);
    if (!isNaN(byteIndex)) selectByte(byteIndex);
  });

  function selectByte(byteIndex) {
    const left = hexAddr(parseBase(state.leftStartAddress) + byteIndex);
    const right = hexAddr(parseBase(state.rightStartAddress) + byteIndex);
    el.cursorInfo.textContent = `#${byteIndex}  L:${left}  R:${right}`;
    vscode.postMessage({ type: 'cursor', left, right });

    const map = parsed ? parsed.charPosInInputMap : [];
    const start = map[byteIndex * 2];
    const end = map[byteIndex * 2 + 1];
    if (start === undefined || end === undefined) return;
    el.input.focus();
    el.input.setSelectionRange(start, end + 1);
    scrollToInputPos(start);
  }

  function scrollToInputPos(pos) {
    const lineIndex = state.input.slice(0, pos).split('\n').length - 1;
    const lh = parseFloat(getComputedStyle(el.input).lineHeight) || 21;
    el.input.scrollTop = Math.max(0, lineIndex * lh - el.input.clientHeight / 2);
    syncScroll();
  }

  /* ---------------- 跳转到地址 ---------------- */
  function jumpToAddress() {
    const raw = el.jumpAddr.value.trim().replace(/^0[xX]/, '');
    if (!/^[0-9A-Fa-f]{1,5}$/.test(raw)) {
      showToast(t('invalidJumpAddr'), true);
      el.jumpAddr.focus();
      return;
    }
    const addr = parseInt(raw, 16);
    const base = el.jumpSide.value === 'left'
      ? parseBase(state.leftStartAddress)
      : parseBase(state.rightStartAddress);
    const total = parsed ? parsed.totalBytes : 0;
    if (total === 0) {
      showToast(t('noJumpBytes'), true);
      return;
    }
    const byteIndex = addr - base;
    if (byteIndex < 0 || byteIndex >= total) {
      showToast(`0x${hexAddr(base)} ~ 0x${hexAddr(base + total - 1)}`, true);
      return;
    }
    openPanel('compile');
    selectByte(byteIndex);
    updateByteHighlight();
  }

  el.jumpAddr.addEventListener('input', () => {
    el.jumpAddr.value = el.jumpAddr.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 5);
  });
  el.jumpAddr.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      jumpToAddress();
    }
  });
  el.jumpSide.addEventListener('change', () => {
    if (el.jumpAddr.value.trim()) jumpToAddress();
  });

  /* ---------------- 悬停提示 + 转到定义 ---------------- */
  function hexByte(v) { return (v & 0xff).toString(16).toUpperCase().padStart(2, '0'); }

  function evalExpr(inner) {
    let value = 0;
    let symbol = '+';
    const parts = String(inner).split(' ').filter(Boolean);
    for (const part of parts) {
      if (part.startsWith('$')) {
        const v = parsed ? parsed.constants[part.slice(1)] : undefined;
        if (v === undefined) return null;
        value += symbol === '-' ? -v : v;
        symbol = '';
      } else if (part === '+' || part === '-') {
        symbol = part;
      } else if (/^-?[0-9a-fA-F]+$/.test(part)) {
        value += symbol === '-' ? -parseInt(part, 16) : parseInt(part, 16);
        symbol = '';
      } else {
        return null;
      }
    }
    if (symbol !== '') return null;
    if (value < 0) value = 0xffff + value + 1;
    return value & 0xffff;
  }

  function buildHoverInfoFromToken(token) {
    if (!token) return null;
    if (token.kind === 'gadget') {
      const g = state.gadgets.find((x) => x.name === token.name);
      if (!g) return null;
      const info = { kind: 'gadget', name: g.name, addr: g.addr, desc: g.desc, tags: g.tags || [] };
      // 子开关：在悬浮窗内展示反汇编
      if (showGadgetDisasm && showGadgetHoverDisasm && disasLoaded && g.addr) {
        const addrNorm = g.addr.replace(/^0x/i, '').toUpperCase();
        const cached = disasmCache.get(addrNorm);
        if (cached) {
          info.disasmAddr = addrNorm;
          info.disasmLines = cached.lines || null;
          info.disasmError = cached.error || null;
        } else {
          info.disasmAddr = addrNorm;
          info.disasmLoading = true;
        }
      }
      return info;
    }
    if (token.kind === 'const') {
      const name = token.name;
      const val = parsed ? parsed.constants[name] : undefined;
      const side = parsed ? parsed.anchorSides[name] : undefined;
      if (side) return { kind: 'anchor-ref', name, addr: val, side };
      return { kind: 'constant', name, value: val };
    }
    if (token.kind === 'anchor') {
      const name = token.name;
      const val = parsed ? parsed.constants[name] : undefined;
      const side = (parsed && parsed.anchorSides[name]) || 'right';
      return { kind: 'anchor-def', name, addr: val, side };
    }
    if (token.kind === 'value') {
      const v = evalExpr(token.expr);
      return { kind: 'value', expr: String(token.expr).trim(), value: v };
    }
    return null;
  }

  // 识别 offset 处（当前行内）的 token
  function findTokenAt(offset) {
    const text = state.input;
    if (offset < 0 || offset >= text.length) return null;
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const nl = text.indexOf('\n', offset);
    const lineEnd = nl === -1 ? text.length : nl;
    const line = text.slice(lineStart, lineEnd);
    const col = offset - lineStart;

    const pats = [
      { kind: 'gadget', re: /#[^;\s]*/g, name: (s) => s.replace(/^#-?/, '') },
      { kind: 'anchor', re: /<-?[^>\s]*/g, name: (s) => s.replace(/^<-?/, '') },
      { kind: 'const', re: /\$[A-Za-z0-9_-]*/g, name: (s) => s.slice(1) },
    ];
    for (const p of pats) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(line))) {
        if (col >= m.index && col < m.index + m[0].length) {
          return { kind: p.kind, name: p.name(m[0]), start: lineStart + m.index, end: lineStart + m.index + m[0].length };
        }
      }
    }
    const vb = /\[[^\]]*\]?/g;
    let m2;
    while ((m2 = vb.exec(line))) {
      if (col >= m2.index && col < m2.index + m2[0].length) {
        const expr = m2[0].slice(1).replace(/\]$/, '');
        return { kind: 'value', expr, start: lineStart + m2.index, end: lineStart + m2.index + m2[0].length };
      }
    }
    return null;
  }

  let measureEl = null;
  function measureTextWidth(text) {
    if (!measureEl) {
      measureEl = document.createElement('div');
      const cs = getComputedStyle(el.input);
      ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing', 'tabSize', 'fontVariantLigatures', 'fontFeatureSettings'].forEach((p) => { measureEl.style[p] = cs[p]; });
      measureEl.style.position = 'absolute';
      measureEl.style.visibility = 'hidden';
      measureEl.style.whiteSpace = 'pre';
      measureEl.style.left = '-9999px';
      measureEl.style.top = '0';
      document.body.appendChild(measureEl);
    }
    measureEl.textContent = text;
    return measureEl.offsetWidth;
  }

  function charOffsetFromPoint(clientX, clientY) {
    const cs = getComputedStyle(el.input);
    const pad = parseFloat(cs.paddingLeft) || 12;
    const lh = parseFloat(cs.lineHeight) || 21;
    const rect = el.input.getBoundingClientRect();
    const x = clientX - rect.left - pad + el.input.scrollLeft;
    const y = clientY - rect.top - pad + el.input.scrollTop;

    let lineIndex = Math.floor(y / lh);
    if (lineIndex < 0) lineIndex = 0;
    if (lineIndex >= lineStarts.length) lineIndex = lineStarts.length - 1;
    const lineStart = lineStarts[lineIndex];
    let lineEnd = (lineIndex + 1 < lineStarts.length) ? lineStarts[lineIndex + 1] : state.input.length;
    if (lineEnd > lineStart && state.input.charCodeAt(lineEnd - 1) === 10) lineEnd--;

    let lo = 0, hi = lineEnd - lineStart;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (measureTextWidth(state.input.slice(lineStart, lineStart + mid)) < x) lo = mid + 1;
      else hi = mid;
    }
    return lineStart + lo;
  }

  function renderHoverHtml(info) {
    if (!info) return '';
    if (info.kind === 'gadget') {
      const tags = (info.tags || []).map((t) => tagHtml(t)).join(' ');
      let html = `<div class="ht-title">#${escapeHtml(info.name)};</div>`
        + `<div class="ht-row"><span class="ht-label">${t('htAddr')}</span><span class="ht-mono">${escapeHtml(info.addr || '')}</span></div>`
        + (tags ? `<div class="ht-tags">${tags}</div>` : '')
        + (info.desc ? `<div class="ht-desc">${escapeHtml(info.desc)}</div>` : '');
      if (info.disasmAddr) {
        let asmHtml;
        if (info.disasmLines) {
          asmHtml = info.disasmLines.map((l) => escapeHtml(l)).join('\n');
        } else if (info.disasmError) {
          asmHtml = `<span class="err">${escapeHtml(info.disasmError)}</span>`;
        } else {
          asmHtml = t('disasmLoading');
        }
        html += `<pre class="ht-disasm" data-ht-disasm="${escapeHtml(info.disasmAddr)}">${asmHtml}</pre>`;
      }
      return html;
    }
    if (info.kind === 'constant') {
      return `<div class="ht-title">${t('htConst')} <span class="ht-mono">$${escapeHtml(info.name)}</span></div>`
        + `<div class="ht-row"><span class="ht-label">${t('htValue')}</span><span class="ht-mono">0x${hexAddr(info.value)}</span></div>`;
    }
    if (info.kind === 'anchor-ref' || info.kind === 'anchor-def') {
      const label = info.kind === 'anchor-ref' ? t('htAnchor') : t('htAnchorDef');
      return `<div class="ht-title">${label} <span class="ht-mono">&lt;${escapeHtml(info.name)}&gt;</span></div>`
        + `<div class="ht-row"><span class="ht-label">${t('htAddr')}</span><span class="ht-mono">0x${hexAddr(info.addr)}</span></div>`
        + `<div class="ht-row"><span class="ht-label">${t('htSide')}</span><span class="ht-mono">${info.side === 'left' ? t('left') : t('right')}</span></div>`;
    }
    if (info.kind === 'value') {
      return `<div class="ht-title">${t('htValueBlock')}</div>`
        + `<div class="ht-row"><span class="ht-label">${t('htExpr')}</span><span class="ht-mono">${escapeHtml(info.expr)}</span></div>`
        + `<div class="ht-row"><span class="ht-label">${t('htResult')}</span><span class="ht-mono">${info.value == null ? '—' : '0x' + hexAddr(info.value)}</span></div>`
        + `<div class="ht-row"><span class="ht-label">${t('htLE')}</span><span class="ht-mono">${info.value == null ? '—' : hexByte(info.value) + ' ' + hexByte(info.value >> 8)}</span></div>`;
    }
    return '';
  }

  function showHover(info, x, y) {
    if (!info) { hideHover(); return; }
    hoveredAddr = info.disasmAddr || null;
    el.hoverTip.innerHTML = renderHoverHtml(info);
    el.hoverTip.hidden = false;
    const w = el.hoverTip.offsetWidth;
    const h = el.hoverTip.offsetHeight;
    let left = x + 14;
    let top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    el.hoverTip.style.left = Math.max(4, left) + 'px';
    el.hoverTip.style.top = Math.max(4, top) + 'px';
  }

  function hideHover() { hoveredAddr = null; el.hoverTip.hidden = true; }

  function handleHover(e) {
    const offset = charOffsetFromPoint(e.clientX, e.clientY);
    const token = findTokenAt(offset);
    const info = buildHoverInfoFromToken(token);
    if (info) {
      // 如果反汇编需要异步加载，立即请求
      if (info.disasmAddr && info.disasmLoading) {
        vscode.postMessage({ type: 'gadgets:disasm', addr: info.disasmAddr });
      }
      showHover(info, e.clientX, e.clientY);
    } else {
      hideHover();
    }
  }

  el.input.addEventListener('mousemove', handleHover);
  el.input.addEventListener('mouseleave', hideHover);

  /* ---------------- 覆写模拟器（RAM / launcher，位于顶部工具栏） ---------------- */
  function initEmuToolbar() {
    el.injectAddress.value = injectAddress || state.leftStartAddress;
    el.launcher.value = launcher;
    el.launcherAddr.value = launcherAddr;
    el.emuError.hidden = true;
  }

  // 用户未自定义注入地址时，跟随左地址变化。
  function syncEmuInjectAddress() {
    if (!injectAddress) el.injectAddress.value = state.leftStartAddress;
  }

  function showEmuStatus(msg, kind) {
    // kind: 'busy' | 'error' | ''（清空）
    if (msg) {
      el.emuError.textContent = msg;
      el.emuError.title = msg;
      el.emuError.hidden = false;
      // 状态条较窄，显示若干秒后自动隐藏。
      clearTimeout(showEmuStatus._t);
      if (kind !== 'busy') {
        showEmuStatus._t = setTimeout(() => { el.emuError.hidden = true; }, 5000);
      }
    } else {
      clearTimeout(showEmuStatus._t);
      el.emuError.hidden = true;
    }
    el.emuError.classList.toggle('error', kind === 'error');
    el.btnWriteRam.disabled = kind === 'busy';
    el.btnWriteLauncher.disabled = kind === 'busy';
  }

  el.injectAddress.addEventListener('input', () => {
    el.injectAddress.value = el.injectAddress.value.replace(/[^0-9a-fA-F]/g, '');
    injectAddress = el.injectAddress.value;
  });
  el.injectAddress.addEventListener('change', () => {
    injectAddress = el.injectAddress.value.trim();
    vscode.postMessage({ type: 'persist', key: 'injectAddress', value: injectAddress });
  });
  el.launcher.addEventListener('input', () => {
    launcher = el.launcher.value;
  });
  el.launcher.addEventListener('change', () => {
    launcher = el.launcher.value;
    vscode.postMessage({ type: 'persist', key: 'launcher', value: launcher });
  });
  el.launcherAddr.addEventListener('input', () => {
    el.launcherAddr.value = el.launcherAddr.value.replace(/[^0-9a-fA-F]/g, '');
    launcherAddr = el.launcherAddr.value;
  });
  el.launcherAddr.addEventListener('change', () => {
    launcherAddr = el.launcherAddr.value.trim() || 'D180';
    vscode.postMessage({ type: 'persist', key: 'launcherAddr', value: launcherAddr });
  });

  el.btnWriteRam.addEventListener('click', () => {
    const raw = (injectAddress.trim() || state.leftStartAddress).toUpperCase().replace(/^0X/, '');
    if (!/^[0-9A-F]{1,5}$/.test(raw)) {
      showEmuStatus(t('invalidAddr'), 'error');
      return;
    }
    const hex = parsed ? parsed.hexChars : '';
    if (!hex) {
      showEmuStatus(t('noCompileResult'), 'error');
      return;
    }
    showEmuStatus(t('writingEmu'), 'busy');
    vscode.postMessage({ type: 'emu:write', address: parseInt(raw, 16), hex });
  });

  el.btnWriteLauncher.addEventListener('click', () => {
    const hex = el.launcher.value.trim();
    if (!hex) {
      showEmuStatus(t('needLauncher'), 'error');
      return;
    }
    const raw = (launcherAddr || 'D180').toUpperCase().replace(/^0X/, '');
    if (!/^[0-9A-F]{1,5}$/.test(raw)) {
      showEmuStatus(t('invalidLauncherAddr'), 'error');
      return;
    }
    showEmuStatus(t('writingEmu'), 'busy');
    vscode.postMessage({ type: 'emu:write', address: parseInt(raw, 16), hex });
  });

  /* ---------------- autocomplete（gadget / 常量补全） ---------------- */
  function handleAutocomplete() {
    const pos = el.input.selectionStart;
    const before = state.input.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineBefore = before.slice(lineStart);
    if (lineBefore.includes('//')) { hideAutocomplete(); return; }

    // 常量 / 锚点补全：$...
    const cm = before.match(/\$([A-Za-z0-9_-]*)$/);
    if (cm) {
      const query = cm[1].toLowerCase();
      const consts = (parsed && parsed.constants) ? parsed.constants : {};
      const list = Object.keys(consts)
        .filter((n) => n.toLowerCase().includes(query))
        .sort()
        .slice(0, 50)
        .map((n) => ({ name: n, value: consts[n] }));
      if (!list.length) { hideAutocomplete(); return; }
      acKind = 'constant';
      acItems = list;
      acSelected = 0;
      renderAutocomplete();
      positionAutocomplete(pos);
      el.autocomplete.hidden = false;
      return;
    }

    // gadget 补全：#...
    const m = before.match(/#([A-Za-z0-9-]*)$/);
    if (!m || !state.gadgets.length) { hideAutocomplete(); return; }

    const query = m[1];
    const allow00 = !query.startsWith('-');
    const list = state.gadgets
      .map((g) => (allow00 ? g : { ...g, name: '-' + g.name }))
      .filter((g) => g.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 50);

    if (!list.length) { hideAutocomplete(); return; }
    acKind = 'gadget';
    acItems = list;
    acSelected = 0;
    renderAutocomplete();
    positionAutocomplete(pos);
    el.autocomplete.hidden = false;
  }

  function hideAutocomplete() {
    el.autocomplete.hidden = true;
    acItems = [];
  }

  function renderAutocomplete() {
    el.autocomplete.innerHTML = acItems
      .map((it, i) => {
        const addr = acKind === 'constant' ? hexAddr(it.value) : (it.addr || '');
        const desc = acKind === 'constant' ? t('constAnchor') : (it.desc || '').split('\n')[0];
        return `
        <div class="ac-item ${i === acSelected ? 'selected' : ''}" data-ac="${i}">
          <span class="ac-name">${escapeHtml(it.name)}</span>
          <span class="ac-addr">${escapeHtml(addr)}</span>
          <span class="ac-desc">${escapeHtml(desc)}</span>
        </div>`;
      })
      .join('');
  }

  function positionAutocomplete(pos) {
    const mirror = document.createElement('div');
    const cs = getComputedStyle(el.input);
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'padding', 'whiteSpace', 'wordWrap', 'wordBreak', 'tabSize'].forEach((p) => { mirror.style[p] = cs[p]; });
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.width = cs.width;
    mirror.textContent = state.input.substring(0, pos);
    const marker = document.createElement('span');
    marker.textContent = '|';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const top = marker.offsetTop + marker.offsetHeight - el.input.scrollTop;
    const left = marker.offsetLeft - el.input.scrollLeft;
    document.body.removeChild(mirror);
    el.autocomplete.style.top = Math.max(0, top) + 'px';
    el.autocomplete.style.left = Math.min(Math.max(0, left), el.codeWrap.clientWidth - 260) + 'px';
  }

  el.autocomplete.addEventListener('click', (e) => {
    const item = e.target.closest('[data-ac]');
    if (item) selectAutocomplete(parseInt(item.dataset.ac, 10));
  });

  function selectAutocomplete(index) {
    const it = acItems[index];
    if (!it) { hideAutocomplete(); return; }
    const pos = el.input.selectionStart;
    const before = state.input.slice(0, pos);
    if (acKind === 'constant') {
      const m = before.match(/\$[A-Za-z0-9_-]*$/);
      if (m) {
        const startIdx = pos - m[0].length;
        el.input.setRangeText('$' + it.name, startIdx, pos, 'end');
      }
    } else {
      const m = before.match(/#[A-Za-z0-9-]*$/);
      if (m) {
        const startIdx = pos - m[0].length;
        el.input.setRangeText('#' + it.name + ';', startIdx, pos, 'end');
      }
    }
    state.input = el.input.value;
    dirty = true;
    render();
    scheduleSave();
    hideAutocomplete();
  }

  /* ---------------- 设置页 ---------------- */
  function applySettings(s) {
    const oldLang = lang;
    if (typeof s.language === 'string' && STR[s.language]) lang = s.language;
    showGadgetDisasm = !!s.showGadgetDisasm;
    showGadgetHoverDisasm = showGadgetDisasm && !!s.showGadgetHoverDisasm;
    disasFile = typeof s.disasFile === 'string' ? s.disasFile : '';
    disasLoaded = !!s.disasLoaded;
    if (lang !== oldLang) applyStaticI18n();
    if (activeTab === 'settings') syncSettingsUI();
    if (activeTab === 'gadgets') renderGadgetList();
  }

  function syncSettingsUI() {
    el.selLanguage.value = lang;
    el.chkDisasm.checked = showGadgetDisasm;
    el.disasRow.hidden = !showGadgetDisasm;
    el.chkHoverDisasm.checked = showGadgetHoverDisasm && showGadgetDisasm;
    el.disasmHoverRow.hidden = !showGadgetDisasm;
    el.disasFileLabel.textContent = disasFile ? t('disasmLoaded') + disasFile : '';
  }

  el.selLanguage.addEventListener('change', () => {
    vscode.postMessage({ type: 'settings:set', key: 'language', value: el.selLanguage.value });
  });
  el.chkDisasm.addEventListener('change', () => {
    vscode.postMessage({ type: 'settings:set', key: 'showGadgetDisasm', value: el.chkDisasm.checked });
  });
  el.chkHoverDisasm.addEventListener('change', () => {
    vscode.postMessage({ type: 'settings:set', key: 'showGadgetHoverDisasm', value: el.chkHoverDisasm.checked });
  });
  el.btnChooseDisas.addEventListener('click', () => {
    vscode.postMessage({ type: 'disas:choose' });
  });

  /* ---------------- 程序广场 ---------------- */
  el.marketSearch.addEventListener('input', renderMarketList);
  el.btnPublish.addEventListener('click', openPublish);
  el.btnClosePublish.addEventListener('click', closePublish);
  el.btnCancelPublish.addEventListener('click', closePublish);
  el.publishModel.addEventListener('change', () => {
    el.publishOtherRow.hidden = el.publishModel.value !== 'other';
  });
  el.btnConfirmPublish.addEventListener('click', confirmPublish);

  el.marketList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-download]');
    if (btn) downloadMarketItem(btn.dataset.download);
  });

  function openMarket() {
    el.marketSearch.value = '';
    marketItems = [];
    marketError = '';
    marketLoading = true;
    renderMarketList();
    vscode.postMessage({ type: 'market:list' });
  }

  /* ---------------- 程序广场未读小红点 ---------------- */
  function setMarketBadge(n) {
    n = Math.max(0, Number(n) || 0);
    if (n > 0) {
      el.marketBadge.textContent = n > 99 ? '99+' : String(n);
      el.marketBadge.hidden = false;
    } else {
      el.marketBadge.hidden = true;
    }
  }

  function openPublish() {
    el.publishName.value = (fileName || 'untitled.rop').replace(/\.rop$/i, '');
    el.publishAuthor.value = '';
    el.publishModel.value = '';
    el.publishOtherModel.value = '';
    el.publishOtherRow.hidden = true;
    el.publishDescription.value = '';
    el.publishOverlay.hidden = false;
    fetchChallenge();
  }

  function closePublish() {
    el.publishOverlay.hidden = true;
  }

  function fetchChallenge() {
    challenge = null;
    challengeLoading = true;
    el.challengeAnswer.value = '';
    el.challengeAnswer.disabled = true;
    el.challengeHint.textContent = t('challengeLoading');
    vscode.postMessage({ type: 'market:challenge' });
  }

  function confirmPublish() {
    const name = el.publishName.value.trim();
    const author = el.publishAuthor.value.trim();
    const model = el.publishModel.value === 'other' ? el.publishOtherModel.value.trim() : el.publishModel.value;
    const description = el.publishDescription.value.trim();
    if (!name) { showToast(t('needName'), true); return; }
    if (!author) { showToast(t('needAuthor'), true); return; }
    if (!model) { showToast(t('needModel'), true); return; }
    if (!description) { showToast(t('needDesc'), true); return; }

    const answer = el.challengeAnswer.value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (!challenge) {
      if (challengeLoading) showToast(t('challengeWait'), true);
      else { showToast(t('challengeRetry'), true); fetchChallenge(); }
      return;
    }
    if (!/^[0-9a-f]{4}$/.test(answer)) {
      showToast(t('needAnswer'), true);
      return;
    }
    el.btnConfirmPublish.disabled = true;
    vscode.postMessage({
      type: 'market:publish',
      name,
      author,
      model,
      description,
      challengeToken: challenge.token,
      challengeAnswer: answer,
    });
  }

  function downloadMarketItem(id) {
    downloadingId = String(id);
    renderMarketList();
    const item = marketItems.find((it) => String(it.id) === String(id));
    vscode.postMessage({ type: 'market:get', id, name: item ? item.name : '' });
  }

  function renderMarketList() {
    if (marketLoading) {
      el.marketList.innerHTML = '<div class="empty-hint">' + t('loading') + '</div>';
      return;
    }
    if (marketError) {
      el.marketList.innerHTML = '<div class="empty-hint">' + t('loadFail') + escapeHtml(marketError) + '</div>';
      return;
    }

    const q = el.marketSearch.value.trim().toLowerCase();
    const items = marketItems.filter((it) => {
      if (!q) return true;
      return [it.name, it.author, it.model, it.description].some((s) =>
        String(s || '').toLowerCase().includes(q)
      );
    });
    const featured = items.filter((it) => it.featured);
    const normal = items.filter((it) => !it.featured);

    if (items.length === 0) {
      el.marketList.innerHTML = '<div class="empty-hint">' + (q ? t('noMarketMatch') : t('marketEmpty')) + '</div>';
      return;
    }

    const card = (it, isFeatured) => {
      const idStr = String(it.id);
      const busy = downloadingId === idStr;
      return `
      <div class="market-card ${isFeatured ? 'featured' : ''}">
        <div class="market-card-info">
          <div class="market-card-title">${escapeHtml(it.name || t('unnamed'))}${isFeatured ? ' <span class="market-star">★</span>' : ''}</div>
          <div class="market-card-meta">
            <span>${t('byAuthor')}${escapeHtml(it.author || '-')}</span>
            <span>${t('byModel')}${escapeHtml(it.model || '-')}</span>
          </div>
          ${it.description ? `<div class="market-card-desc">${escapeHtml(it.description)}</div>` : ''}
        </div>
        <button class="icon-btn primary market-dl" data-download="${escapeHtml(idStr)}" ${busy ? 'disabled' : ''}>${busy ? t('downloading') : ICONS.download + t('download')}</button>
      </div>`;
    };

    let html = '';
    if (featured.length) {
      html += `<div class="market-section">${t('featured')} <span class="tb-badge">${featured.length}</span></div>`;
      html += featured.map((it) => card(it, true)).join('');
    }
    if (normal.length) {
      if (featured.length) html += `<div class="market-section">${t('all')}</div>`;
      html += normal.map((it) => card(it, false)).join('');
    }
    el.marketList.innerHTML = html;
  }

  /* ---------------- 宿主消息 ---------------- */
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'init':
        if (typeof msg.fileName === 'string') {
          fileName = msg.fileName;
        }
        if (msg.settings && typeof msg.settings === 'object') {
          applySettings(msg.settings);
        }
        if (msg.valid === false) {
          showError(msg.error || t('invalidRop'));
        } else {
          clearError();
        }
        injectAddress = typeof msg.injectAddress === 'string' ? msg.injectAddress : '';
        launcher = typeof msg.launcher === 'string' ? msg.launcher : '';
        launcherAddr = typeof msg.launcherAddr === 'string' ? msg.launcherAddr : 'D180';
        // 查询一次市场未读数（不标记已读；打开广场后宿主会广播清零）
        vscode.postMessage({ type: 'market:unread-check' });
        // fallthrough
      case 'update': {
        state.input = typeof msg.input === 'string' ? msg.input : '';
        state.gadgets = Array.isArray(msg.gadgets) ? msg.gadgets : [];
        state.leftStartAddress = typeof msg.leftStartAddress === 'string' ? msg.leftStartAddress : 'E9E0';
        state.rightStartAddress = typeof msg.rightStartAddress === 'string' ? msg.rightStartAddress : 'D710';
        state.ideVersion = typeof msg.ideVersion === 'number' ? msg.ideVersion : 100;
        if (el.input.value !== state.input) el.input.value = state.input;
        dirty = false;
        initEmuToolbar();
        render();
        break;
      }
      case 'settings':
        applySettings(msg);
        break;
      case 'disas:load-result':
        if (msg.ok) {
          showToast(t('disasmLoaded') + (msg.file || ''));
        } else if (!msg.cancelled) {
          showToast(t('loadFail') + (msg.error || ''), true);
        }
        break;
      case 'gadgets:disasm-result': {
        const addrKey = String(msg.addr || '').toUpperCase();
        const result = msg.lines ? { lines: msg.lines } : { error: msg.error || '' };
        disasmCache.set(addrKey, result);
        // 更新 gadgets 面板
        el.gadgetList
          .querySelectorAll(`[data-disasm-addr="${addrKey}"]`)
          .forEach((pre) => fillDisasm(pre, result));
        // 更新悬停提示
        if (hoveredAddr === addrKey && !el.hoverTip.hidden) {
          const pre = el.hoverTip.querySelector('.ht-disasm[data-ht-disasm]');
          if (pre) fillDisasm(pre, result);
        }
        break;
      }
      case 'invalid':
        showError(msg.error || t('invalidRop'));
        break;
      case 'compile':
        openPanel('compile');
        break;
      case 'show-gadgets':
        openPanel('gadgets');
        break;
      case 'show-market':
        openPanel('market');
        break;
      case 'market:list-result':
        marketLoading = false;
        if (msg.error) {
          marketItems = [];
          marketError = String(msg.error);
        } else {
          marketError = '';
          marketItems = Array.isArray(msg.items) ? msg.items : [];
        }
        renderMarketList();
        break;
      case 'market:unread':
        setMarketBadge(msg.unread);
        break;
      case 'market:get-result':
        downloadingId = null;
        if (msg.error) {
          showToast(t('downloadFail') + msg.error, true);
        } else if (msg.cancelled) {
          showToast(t('cancelled'));
        } else {
          showToast(t('savedOpened'));
        }
        renderMarketList();
        break;
      case 'market:challenge-result':
        challengeLoading = false;
        if (msg.ok) {
          challenge = { token: msg.token, offset: msg.offset };
          el.challengeAnswer.disabled = false;
          el.challengeHint.textContent = t('challengeText').replace('{addr}', hexAddr(msg.offset));
        } else {
          challenge = null;
          el.challengeAnswer.disabled = true;
          el.challengeHint.textContent = t('challengeFail') + (msg.error || t('challengeRetryLater'));
        }
        break;
      case 'market:publish-result':
        el.btnConfirmPublish.disabled = false;
        if (msg.ok) {
          showToast(t('published'));
          closePublish();
          marketItems = [];
          marketError = '';
          marketLoading = true;
          renderMarketList();
          vscode.postMessage({ type: 'market:list' });
        } else if (msg.code === 'wrong') {
          showToast(t('challengeWrong'), true);
          fetchChallenge();
        } else if (msg.code === 'expired') {
          showToast(t('challengeExpired'), true);
          fetchChallenge();
        } else {
          showToast(t('publishFail') + msg.error, true);
        }
        break;
      case 'emu:write-result':
        if (msg.ok) {
          showEmuStatus('', '');
          showToast(t('written'));
        } else {
          const err = msg.code === 'not-running'
            ? t('emuNotRunning')
            : (msg.error || t('writeFail'));
          showEmuStatus(err, 'error');
        }
        break;
      case 'gadgets:export-result':
        if (msg.ok) {
          showToast(t('exported'));
        } else if (msg.cancelled) {
          showToast(t('cancelled'));
        } else {
          showToast(t('exportFail') + msg.error, true);
        }
        break;
      case 'gadgets:import-result':
        if (msg.ok) {
          const list = Array.isArray(msg.gadgets) ? msg.gadgets : [];
          if (msg.mode === 'replace') {
            state.gadgets = list;
          } else {
            // 补全：按地址判重，地址重复（哪怕说明不同）保留原有
            for (const g of list) {
              const dup = g.addr
                ? state.gadgets.some((x) => x.addr === g.addr)
                : state.gadgets.some((x) => x.name === g.name);
              if (!dup) state.gadgets.push(g);
            }
          }
          editingGadgetIndex = -1;
          editingGadget = null;
          renderGadgetList();
          markChanged();
          showToast(t('imported'));
        } else if (msg.cancelled) {
          showToast(t('cancelled'));
        } else {
          showToast(t('importFail') + msg.error, true);
        }
        break;
      default:
        break;
    }
  });

  // 就绪后向宿主请求初始数据
  try { applyStaticI18n(); } catch (e) { /* 静态文案异常不得阻塞初始化握手 */ }
  vscode.postMessage({ type: 'ready' });
})();
