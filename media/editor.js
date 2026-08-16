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

  /* ---------------- DOM ---------------- */
  document.getElementById('app').innerHTML = `
    <div class="error-banner" id="errorBanner" hidden></div>
    <div class="toolbar">
      <div class="tb-left">
        <span class="tb-title" id="fileName">untitled.rop</span>
        <span class="tb-dirty" id="dirtyBadge" hidden>●</span>
      </div>
      <div class="tb-right">
        <button class="tb-btn" id="btnNew" title="新建 .rop 文件">${ICONS['new-file']}</button>
        <button class="tb-btn" id="btnGadgets" title="查看 / 编辑 gadgets">${ICONS.list}<span class="tb-badge" id="gadgetCount">0</span></button>
        <button class="tb-btn" id="btnCompile" title="编译">${ICONS.play}</button>
        <button class="tb-btn" id="btnMarket" title="程序广场">${ICONS.globe}</button>
      </div>
    </div>

    <div class="editor">
      <div class="gutter" id="gutterLeft"><div class="gutter-inner"></div></div>
      <div class="code-wrap" id="codeWrap">
        <pre class="highlight" id="highlight" aria-hidden="true"></pre>
        <textarea class="code-input" id="input" spellcheck="false" wrap="off"></textarea>
        <div class="autocomplete" id="autocomplete" hidden></div>
      </div>
      <div class="gutter right" id="gutterRight"><div class="gutter-inner"></div></div>
    </div>

    <div class="footer">
      <span id="bytesInfo">0 bytes · 0 errors</span>
      <span id="cursorInfo"></span>
    </div>

    <div class="overlay" id="gadgetOverlay" hidden>
      <div class="panel">
        <div class="panel-header">
          <h2>Gadgets</h2>
          <span class="tb-badge" id="gadgetPanelCount">0</span>
          <div class="spacer"></div>
          <input class="search-input" id="gadgetSearch" type="text" placeholder="搜索 name / addr / desc / tag…" />
          <button class="icon-btn primary" id="btnAddGadget">${ICONS.plus}新增</button>
          <button class="icon-btn" id="btnCloseGadgets">${ICONS.close}</button>
        </div>
        <div class="panel-body">
          <div class="gadget-list" id="gadgetList"></div>
        </div>
      </div>
    </div>

    <div class="overlay" id="compileOverlay" hidden>
      <div class="panel">
        <div class="panel-header">
          <h2>编译结果</h2>
          <div class="spacer"></div>
          <button class="icon-btn" id="btnCloseCompile">${ICONS.close}</button>
        </div>
        <div class="panel-body">
          <div class="compile-setting">
            <span class="field">左地址 <input class="addr-input" id="leftAddrInput" maxlength="5" /></span>
            <span class="field">右地址 <input class="addr-input" id="rightAddrInput" maxlength="5" /></span>
            <div class="compile-actions">
              <button class="icon-btn" id="btnCopyHex">${ICONS.copy}复制 hex 串</button>
              <button class="icon-btn" id="btnCopyDump">${ICONS.copy}复制 hexdump</button>
            </div>
          </div>
          <div class="compile-info" id="compileInfo"></div>
          <div class="hexdump" id="hexdump"></div>
        </div>
      </div>
    </div>

    <div class="overlay" id="marketOverlay" hidden>
      <div class="panel">
        <div class="panel-header">
          <h2>程序广场</h2>
          <div class="spacer"></div>
          <input class="search-input" id="marketSearch" type="text" placeholder="搜索 name / author / model / desc…" />
          <button class="icon-btn primary" id="btnPublish">${ICONS.plus}发布</button>
          <button class="icon-btn" id="btnCloseMarket">${ICONS.close}</button>
        </div>
        <div class="panel-body">
          <div class="market-list" id="marketList"></div>
        </div>
      </div>
    </div>

    <div class="overlay" id="publishOverlay" hidden>
      <div class="panel">
        <div class="panel-header">
          <h2>发布到程序广场</h2>
          <div class="spacer"></div>
          <button class="icon-btn" id="btnClosePublish">${ICONS.close}</button>
        </div>
        <div class="panel-body">
          <div class="form-row"><label>程序名 *</label><input class="text-input" id="publishName" placeholder="例如 tetris" /></div>
          <div class="form-row"><label>作者 *</label><input class="text-input" id="publishAuthor" placeholder="你的昵称" /></div>
          <div class="form-row"><label>机型 *</label>
            <select class="tag-select" id="publishModel" style="width:100%">
              <option value="">选择机型</option>
              <option value="fx-991CNX (VerC)">fx-991CNX (VerC)</option>
              <option value="fx-991CNX (VerF)">fx-991CNX (VerF)</option>
              <option value="other">其它</option>
            </select>
          </div>
          <div class="form-row" id="publishOtherRow" hidden><label>其它机型 *</label><input class="text-input" id="publishOtherModel" placeholder="输入机型" /></div>
          <div class="form-row"><label>描述 *</label><textarea class="text-input" id="publishDescription" rows="6" placeholder="程序说明…"></textarea></div>
          <div class="market-actions">
            <button class="icon-btn" id="btnCancelPublish">取消</button>
            <button class="icon-btn primary" id="btnConfirmPublish">发布</button>
          </div>
        </div>
      </div>
    </div>

    <div class="toast" id="toast" hidden></div>
  `;

  const el = {
    errorBanner: document.getElementById('errorBanner'),
    fileName: document.getElementById('fileName'),
    dirtyBadge: document.getElementById('dirtyBadge'),
    btnNew: document.getElementById('btnNew'),
    btnGadgets: document.getElementById('btnGadgets'),
    btnCompile: document.getElementById('btnCompile'),
    btnMarket: document.getElementById('btnMarket'),
    gadgetCount: document.getElementById('gadgetCount'),
    gutterLeft: document.getElementById('gutterLeft'),
    gutterRight: document.getElementById('gutterRight'),
    codeWrap: document.getElementById('codeWrap'),
    highlight: document.getElementById('highlight'),
    input: document.getElementById('input'),
    autocomplete: document.getElementById('autocomplete'),
    bytesInfo: document.getElementById('bytesInfo'),
    cursorInfo: document.getElementById('cursorInfo'),
    gadgetOverlay: document.getElementById('gadgetOverlay'),
    gadgetPanelCount: document.getElementById('gadgetPanelCount'),
    gadgetSearch: document.getElementById('gadgetSearch'),
    gadgetList: document.getElementById('gadgetList'),
    btnAddGadget: document.getElementById('btnAddGadget'),
    btnCloseGadgets: document.getElementById('btnCloseGadgets'),
    compileOverlay: document.getElementById('compileOverlay'),
    btnCloseCompile: document.getElementById('btnCloseCompile'),
    leftAddrInput: document.getElementById('leftAddrInput'),
    rightAddrInput: document.getElementById('rightAddrInput'),
    btnCopyHex: document.getElementById('btnCopyHex'),
    btnCopyDump: document.getElementById('btnCopyDump'),
    compileInfo: document.getElementById('compileInfo'),
    hexdump: document.getElementById('hexdump'),
    marketOverlay: document.getElementById('marketOverlay'),
    marketSearch: document.getElementById('marketSearch'),
    marketList: document.getElementById('marketList'),
    btnPublish: document.getElementById('btnPublish'),
    btnCloseMarket: document.getElementById('btnCloseMarket'),
    publishOverlay: document.getElementById('publishOverlay'),
    btnClosePublish: document.getElementById('btnClosePublish'),
    publishName: document.getElementById('publishName'),
    publishAuthor: document.getElementById('publishAuthor'),
    publishModel: document.getElementById('publishModel'),
    publishOtherRow: document.getElementById('publishOtherRow'),
    publishOtherModel: document.getElementById('publishOtherModel'),
    publishDescription: document.getElementById('publishDescription'),
    btnCancelPublish: document.getElementById('btnCancelPublish'),
    btnConfirmPublish: document.getElementById('btnConfirmPublish'),
    toast: document.getElementById('toast'),
  };

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
    btn.innerHTML = ICONS.check + '已复制';
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
  }

  function renderHighlight() {
    const out = [];
    for (const spans of parsed.highlightLines) {
      let line = '';
      for (const span of spans) {
        const cls = span.type ? span.type.split(',').filter(Boolean).join(' ') : '';
        const html = escapeHtml(span.content);
        line += cls ? `<span class="${cls}">${html}</span>` : html;
      }
      out.push(line);
    }
    el.highlight.innerHTML = out.join('\n');
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
  }

  function renderFooter() {
    el.bytesInfo.textContent = `${parsed.totalBytes} bytes · ${parsed.errorCount} errors`;
    el.bytesInfo.classList.toggle('err', parsed.errorCount > 0);
    el.gadgetCount.textContent = state.gadgets.length;
  }

  function updateCursor() {
    const pos = el.input.selectionStart;
    const off = byteOffsetAt(pos);
    const left = hexAddr(parseBase(state.leftStartAddress) + off);
    const right = hexAddr(parseBase(state.rightStartAddress) + off);
    el.cursorInfo.textContent = `L:${left}  R:${right}`;
    vscode.postMessage({ type: 'cursor', left, right });
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
    if (!dirty) { dirty = true; el.dirtyBadge.hidden = false; }
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

  function insertText(text) {
    const start = el.input.selectionStart;
    const end = el.input.selectionEnd;
    el.input.setRangeText(text, start, end, 'end');
    state.input = el.input.value;
    if (!dirty) { dirty = true; el.dirtyBadge.hidden = false; }
    render();
    scheduleSave();
  }

  /* ---------------- 工具栏 ---------------- */
  el.btnNew.addEventListener('click', () => vscode.postMessage({ type: 'new' }));
  el.btnGadgets.addEventListener('click', openGadgets);
  el.btnCompile.addEventListener('click', openCompile);

  /* ---------------- Gadgets 面板 ---------------- */
  function openGadgets() {
    el.gadgetSearch.value = '';
    editingGadgetIndex = -1;
    editingGadget = null;
    renderGadgetList();
    el.gadgetOverlay.hidden = false;
    el.gadgetSearch.focus();
  }
  el.btnCloseGadgets.addEventListener('click', () => { el.gadgetOverlay.hidden = true; });
  el.btnAddGadget.addEventListener('click', () => {
    el.gadgetSearch.value = '';
    const g = { name: '', addr: '', desc: '', tags: [] };
    state.gadgets.push(g);
    editingGadgetIndex = state.gadgets.length - 1;
    editingGadget = deepCopy(g);
    renderGadgetList();
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
    el.gadgetPanelCount.textContent = state.gadgets.length;

    if (list.length === 0 && state.gadgets.length === 0) {
      el.gadgetList.innerHTML = '<div class="empty-hint">还没有 gadgets。点击右上角「新增」添加一个。</div>';
      return;
    }
    if (list.length === 0) {
      el.gadgetList.innerHTML = '<div class="empty-hint">没有匹配的 gadget。</div>';
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
  }

  function gadgetViewHtml(i, g) {
    const tags = (g.tags || []).map((t) => tagHtml(t)).join(' ');
    return `
      <div class="gadget-card" data-index="${i}">
        <div class="gadget-card-header">
          <span class="gadget-name">${escapeHtml(g.name || '(未命名)')}</span>
          ${tags}
          <div class="gadget-actions">
            <button class="icon-btn" data-action="edit" data-index="${i}" title="编辑">${ICONS.edit}</button>
            <button class="icon-btn" data-action="delete" data-index="${i}" title="删除">${ICONS.trash}</button>
          </div>
        </div>
        <span class="gadget-addr">${escapeHtml(g.addr || '')}</span>
        <p class="gadget-desc">${escapeHtml(g.desc || '')}</p>
      </div>`;
  }

  function gadgetEditHtml(i, g) {
    const tags = (g.tags || []).map((t, k) => tagHtml(t, k)).join(' ');
    const colorOptions = TAG_COLORS.map(
      (c) => `<option value="${c}">${c}</option>`
    ).join('');
    return `
      <div class="gadget-card highlighted" data-index="${i}">
        <div class="form-row"><label>名称</label>
          <input class="text-input" data-field="name" value="${escapeHtml(g.name)}" placeholder="pop-xr12" /></div>
        <div class="form-row"><label>地址（十六进制）</label>
          <input class="text-input" data-field="addr" value="${escapeHtml(g.addr)}" placeholder="1D52C" /></div>
        <div class="form-row"><label>描述</label>
          <textarea class="text-input" data-field="desc" rows="3" placeholder="赋值 XR12">${escapeHtml(g.desc)}</textarea></div>
        <div class="form-row"><label>标签</label>
          <div class="tags-editor">${tags}
            <input class="text-input tag-input" data-field="tagName" placeholder="标签名" />
            <select class="tag-select" data-field="tagColor">${colorOptions}</select>
            <button class="icon-btn" data-action="add-tag" data-index="${i}" title="添加标签">${ICONS.plus}</button>
          </div></div>
        <div class="gadget-actions">
          <button class="icon-btn primary" data-action="save" data-index="${i}" title="保存">${ICONS.check}保存</button>
          <button class="icon-btn" data-action="cancel" title="取消">${ICONS.close}</button>
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
    if (!dirty) { dirty = true; el.dirtyBadge.hidden = false; }
    render();
    scheduleSave();
  }

  /* ---------------- 无效文件提示 ---------------- */
  function showError(message) {
    el.errorBanner.textContent = '⚠ ' + (message || '这不是合法的 .rop（JSON）文件。');
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
    renderCompile();
    el.compileOverlay.hidden = false;
  }
  el.btnCloseCompile.addEventListener('click', () => { el.compileOverlay.hidden = true; });

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
        .map((b) => `<span class="hex-byte ${b === '00' ? 'zero' : ''}">${b}</span>`)
        .join(' ');
      html += `<div class="hex-row">`
        + `<span class="hex-addr left">${hexAddr(leftBase + row * 16)}</span>`
        + `<span class="hex-bytes">${byteSpans}</span>`
        + `<span class="hex-addr right">${hexAddr(rightBase + row * 16)}</span>`
        + `</div>`;
    }
    if (bytes.length === 0) html = '<div class="empty-hint">（暂无字节）</div>';
    el.hexdump.innerHTML = html;

    const errClass = parsed && parsed.errorCount > 0 ? ' class="err"' : '';
    el.compileInfo.innerHTML = `共 <b>${parsed ? parsed.totalBytes : 0}</b> bytes，`
      + `<span${errClass}>${parsed ? parsed.errorCount : 0} errors</span>`;
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
        const desc = acKind === 'constant' ? '常量 / 锚点' : (it.desc || '').split('\n')[0];
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
    if (!dirty) { dirty = true; el.dirtyBadge.hidden = false; }
    render();
    scheduleSave();
    hideAutocomplete();
  }

  /* ---------------- 程序广场 ---------------- */
  el.btnMarket.addEventListener('click', openMarket);
  el.btnCloseMarket.addEventListener('click', () => { el.marketOverlay.hidden = true; });
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
    el.marketOverlay.hidden = false;
    marketItems = [];
    marketError = '';
    marketLoading = true;
    renderMarketList();
    vscode.postMessage({ type: 'market:list' });
  }

  function openPublish() {
    el.publishName.value = (fileName || 'untitled.rop').replace(/\.rop$/i, '');
    el.publishAuthor.value = '';
    el.publishModel.value = '';
    el.publishOtherModel.value = '';
    el.publishOtherRow.hidden = true;
    el.publishDescription.value = '';
    el.publishOverlay.hidden = false;
  }

  function closePublish() {
    el.publishOverlay.hidden = true;
  }

  function confirmPublish() {
    const name = el.publishName.value.trim();
    const author = el.publishAuthor.value.trim();
    const model = el.publishModel.value === 'other' ? el.publishOtherModel.value.trim() : el.publishModel.value;
    const description = el.publishDescription.value.trim();
    if (!name) { showToast('请填写程序名', true); return; }
    if (!author) { showToast('请填写作者', true); return; }
    if (!model) { showToast('请选择 / 填写机型', true); return; }
    if (!description) { showToast('请填写描述', true); return; }
    el.btnConfirmPublish.disabled = true;
    vscode.postMessage({ type: 'market:publish', name, author, model, description });
  }

  function downloadMarketItem(id) {
    downloadingId = String(id);
    renderMarketList();
    vscode.postMessage({ type: 'market:get', id });
  }

  function renderMarketList() {
    if (marketLoading) {
      el.marketList.innerHTML = '<div class="empty-hint">加载中…</div>';
      return;
    }
    if (marketError) {
      el.marketList.innerHTML = '<div class="empty-hint">加载失败：' + escapeHtml(marketError) + '</div>';
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
      el.marketList.innerHTML = '<div class="empty-hint">' + (q ? '没有匹配的程序' : '程序广场空空如也') + '</div>';
      return;
    }

    const card = (it, isFeatured) => {
      const idStr = String(it.id);
      const busy = downloadingId === idStr;
      return `
      <div class="market-card ${isFeatured ? 'featured' : ''}">
        <div class="market-card-info">
          <div class="market-card-title">${escapeHtml(it.name || '(未命名)')}${isFeatured ? ' <span class="market-star">★</span>' : ''}</div>
          <div class="market-card-meta">
            <span>作者：${escapeHtml(it.author || '-')}</span>
            <span>机型：${escapeHtml(it.model || '-')}</span>
          </div>
          ${it.description ? `<div class="market-card-desc">${escapeHtml(it.description)}</div>` : ''}
        </div>
        <button class="icon-btn primary market-dl" data-download="${escapeHtml(idStr)}" ${busy ? 'disabled' : ''}>${busy ? '下载中…' : ICONS.download + '下载'}</button>
      </div>`;
    };

    let html = '';
    if (featured.length) {
      html += `<div class="market-section">精选 <span class="tb-badge">${featured.length}</span></div>`;
      html += featured.map((it) => card(it, true)).join('');
    }
    if (normal.length) {
      if (featured.length) html += `<div class="market-section">全部</div>`;
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
          el.fileName.textContent = fileName;
        }
        if (msg.valid === false) {
          showError(msg.error || '这不是合法的 .rop（JSON）文件。');
        } else {
          clearError();
        }
        // fallthrough
      case 'update': {
        state.input = typeof msg.input === 'string' ? msg.input : '';
        state.gadgets = Array.isArray(msg.gadgets) ? msg.gadgets : [];
        state.leftStartAddress = typeof msg.leftStartAddress === 'string' ? msg.leftStartAddress : 'E9E0';
        state.rightStartAddress = typeof msg.rightStartAddress === 'string' ? msg.rightStartAddress : 'D710';
        state.ideVersion = typeof msg.ideVersion === 'number' ? msg.ideVersion : 100;
        if (el.input.value !== state.input) el.input.value = state.input;
        dirty = false;
        el.dirtyBadge.hidden = true;
        render();
        break;
      }
      case 'invalid':
        showError(msg.error || '这不是合法的 .rop（JSON）文件。');
        break;
      case 'compile':
        openCompile();
        break;
      case 'show-gadgets':
        openGadgets();
        break;
      case 'show-market':
        openMarket();
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
      case 'market:get-result':
        downloadingId = null;
        if (msg.error) {
          showToast('下载失败：' + msg.error, true);
        } else {
          showToast('已加载到编辑器');
          el.marketOverlay.hidden = true;
        }
        renderMarketList();
        break;
      case 'market:publish-result':
        el.btnConfirmPublish.disabled = false;
        if (msg.ok) {
          showToast('发布成功');
          closePublish();
          marketItems = [];
          marketError = '';
          marketLoading = true;
          renderMarketList();
          vscode.postMessage({ type: 'market:list' });
        } else {
          showToast('发布失败：' + msg.error, true);
        }
        break;
      default:
        break;
    }
  });

  // 就绪后向宿主请求初始数据
  vscode.postMessage({ type: 'ready' });
})();
