/**
 * RopIDE 压缩分析引擎（Webview 侧，纯函数、可独立测试）。
 *
 * 三档：
 *   档 1  体检      analyze()        —— 只看不改：字节预算、重复片段、锚点别名、
 *                                      手写地址反解、gadget 使用率、.rop 体积分解
 *   档 2  一键改写  planHexRewrite() —— 手写 4 字节地址 → #!addr;（编译结果不变，改完自检）
 *                  stripUnusedGadgets()
 *   档 3  拼接候选  candidates()      —— 未对齐复用 / 重复片段折叠 / 数据落在代码字内
 *                  diffBaseline()    —— 压缩前后对比（省了多少、哪些锚点地址变了）
 *
 * 说明：ROP 链里的 4 字节地址是 CPU 从指令流固定位置读走的，
 * 「重复字节去重」会让程序必须多跳一次（≥4 B），所以真正能省的只有
 * 「同一段字节兼做代码与数据」这类别名机会 —— 候选只给建议，是否可用由作者判断。
 */
(function () {
  'use strict';

  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

  function utf8Len(s) {
    if (encoder) return encoder.encode(s).length;
    return unescape(encodeURIComponent(s)).length;
  }

  function hexBytes(hex) {
    const out = [];
    for (let i = 0; i + 1 < hex.length; i += 2) out.push(hex.slice(i, i + 2).toUpperCase());
    return out;
  }

  function pad4(v) {
    return (v >>> 0).toString(16).toUpperCase().padStart(4, '0');
  }

  /** input 每一行起始的字符下标 */
  function lineStartsOf(input) {
    const starts = [0];
    for (let i = 0; i < input.length; i++) {
      if (input.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
  }

  /** 把 highlightLines 的 span 展开成带绝对位置与类型的列表 */
  function spansWithPositions(input, parsed) {
    const lineStarts = lineStartsOf(input);
    const lines = input.split('\n');
    const out = [];
    for (let li = 0; li < parsed.highlightLines.length; li++) {
      let off = lineStarts[li] !== undefined ? lineStarts[li] : 0;
      for (const span of parsed.highlightLines[li]) {
        const type = span.type || '';
        const start = off;
        const end = off + span.content.length;
        out.push({ line: li, start, end, type, content: span.content, text: lines[li] || '' });
        off = end;
      }
    }
    return out;
  }

  /** 判定一个 8 位 hex 字是否为 `#gadget;` 的地址编码；是则返回 { addr, allow00 } */
  function decodeGadgetRef(hex) {
    const h = String(hex).toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(h)) return null;
    const b1 = h.slice(0, 2);
    const b2 = h.slice(2, 4);
    const b3 = h.slice(4, 6);
    const b4 = h.slice(6, 8);
    const allow00 = b4 === '00';
    const flag = b3[0];
    if (allow00 ? flag !== '0' : flag !== '3') return null;
    if (!allow00 && b4 !== '30') return null;
    const addr = b3[1] + b2 + b1;
    const enc = window.RopCompiler.encodeGadgetRef(addr, allow00);
    if (enc !== h) return null;
    return { addr, allow00 };
  }

  /**
   * 每个字节属于哪一类来源。
   *
   * 按 span 顺序「重放」而不是查 charPosInInputMap：gadget 字的 4 个字节共用同一个
   * 源码位置，靠 charPos 无法区分字内偏移。重放顺序 == 最终字节顺序（延迟回填的
   * 数值块本来就插在它被记录的位置上），所以重放是精确的。
   *
   * 返回 { kinds, wordStart, spanOfByte }
   *   kinds[i]      gadget | literal | value | hex | macro
   *   wordStart[i]  该字节是不是一个 4 字节地址字的开头
   *   spanOfByte[i] 该字节来自哪个 span（用于定位到源码行）
   */
  function byteKinds(input, parsed) {
    const spans = parsed ? spansWithPositions(input, parsed) : [];
    const kinds = [];
    const wordStart = [];
    const spanOfByte = [];
    const repeatOf = (s) => {
      const m = /\*(\d{1,3})\s*$/.exec(s.content);
      return m ? Math.max(1, parseInt(m[1], 10)) : 1;
    };
    for (const s of spans) {
      const t = s.type || '';
      let kind = null;
      let per = 0;
      if (t.includes('gadget') && t.includes('closed')) {
        kind = t.includes('literal') ? 'literal' : 'gadget';
        per = 4 * repeatOf(s);
      } else if (t.includes('value') && t.includes('closed')) {
        kind = 'value';
        per = 2 * repeatOf(s);
      } else if (t.includes('macro') && t.includes('closed')) {
        const m = /^%([A-Za-z0-9_-]+)/.exec(s.content);
        const rec = m && parsed.macros ? parsed.macros[m[1]] : null;
        if (!rec) continue;
        kind = 'macro';
        per = (rec.bytes.length / 2) * repeatOf(s);
      } else if (t === 'hex') {
        kind = 'hex';
        per = (s.content.match(/[0-9a-fA-F]/g) || []).length / 2;
      }
      if (!kind || per <= 0) continue;
      for (let k = 0; k < per; k++) {
        kinds.push(kind);
        wordStart.push(k % 4 === 0 && (kind === 'gadget' || kind === 'literal'));
        spanOfByte.push(s);
      }
    }
    return { kinds, wordStart, spanOfByte };
  }

  /** 找出所有「长度 ≥ minLen 的重复片段」（同一位置只保留最长） */
  function findDuplicates(bytes, minLen, cap) {
    const n = bytes.length;
    const out = [];
    if (n < minLen * 2) return out;
    const limit = Math.min(n, cap || 4096);
    const seen = new Map();
    for (let i = 0; i + minLen <= limit; i++) {
      const key = bytes.slice(i, i + minLen).join('');
      const arr = seen.get(key);
      if (arr) arr.push(i);
      else seen.set(key, [i]);
    }
    const pairs = new Map();
    for (const [, pos] of seen) {
      if (pos.length < 2) continue;
      for (let a = 0; a < pos.length && out.length < 400; a++) {
        for (let b = a + 1; b < pos.length && out.length < 400; b++) {
          let len = minLen;
          while (pos[a] + len < n && pos[b] + len < n && bytes[pos[a] + len] === bytes[pos[b] + len]) len++;
          const key = pos[a] + ':' + pos[b];
          const prev = pairs.get(key);
          if (!prev || prev < len) pairs.set(key, len);
        }
      }
    }
    for (const [key, len] of pairs) {
      const [a, b] = key.split(':').map(Number);
      out.push({ at: a, other: b, len });
    }
    // 去掉被更长片段包含的短片段
    out.sort((x, y) => y.len - x.len);
    const kept = [];
    for (const d of out) {
      if (kept.some((k) => d.at >= k.at && d.at + d.len <= k.at + k.len && d.other >= k.other && d.other + d.len <= k.other + k.len)) continue;
      kept.push(d);
    }
    return kept;
  }

  /** 档 1：压缩体检 */
  function analyze(input, parsed, gadgets) {
    const hex = parsed ? parsed.hexChars : '';
    const bytes = hexBytes(hex);
    const lineStarts = lineStartsOf(input);
    const lines = input.split('\n');
    const spans = parsed ? spansWithPositions(input, parsed) : [];

    // ---- .rop 体积分解 ----
    const g = Array.isArray(gadgets) ? gadgets : [];
    const inputJson = JSON.stringify(input);
    const gadgetsJson = JSON.stringify(g);
    const total = JSON.stringify({
      input,
      gadgets: g,
      leftStartAddress: 'E9E0',
      rightStartAddress: 'D710',
      ideVersion: 100,
    });
    const fileSize = {
      total: utf8Len(total),
      input: utf8Len(inputJson),
      gadgets: utf8Len(gadgetsJson),
      rest: utf8Len(total) - utf8Len(inputJson) - utf8Len(gadgetsJson),
    };

    // ---- 每行字节数 ----
    const perLine = new Map();
    if (parsed) {
      for (let b = 0; b < parsed.totalBytes; b++) {
        const pos = parsed.charPosInInputMap[b * 2];
        if (pos === undefined) continue;
        let lo = 0;
        let hi = lineStarts.length;
        while (lo + 1 < hi) {
          const mid = (lo + hi) >> 1;
          if (lineStarts[mid] <= pos) lo = mid;
          else hi = mid;
        }
        perLine.set(lo, (perLine.get(lo) || 0) + 1);
      }
    }
    const lineBytes = [...perLine.entries()]
      .map(([line, n]) => ({ line, bytes: n, text: lines[line] || '' }))
      .sort((a, b) => b.bytes - a.bytes || a.line - b.line);

    // ---- 重复片段 ----
    const duplicates = findDuplicates(bytes, 4, 4096);
    let duplicateSaving = 0;
    for (const d of duplicates) {
      // 折叠第二次出现需要一次跳转/间接寻址（4 B），只有净省才计入
      const net = d.len - 4;
      if (net > 0) duplicateSaving += net;
    }

    // ---- 锚点别名（同一地址多个名字）----
    const byAddr = new Map();
    for (const [name, addr] of Object.entries(parsed ? parsed.constants : {})) {
      if (!(parsed && parsed.anchorSides && parsed.anchorSides[name])) continue; // 只看锚点，不看 $ 常量
      const arr = byAddr.get(addr);
      if (arr) arr.push(name);
      else byAddr.set(addr, [name]);
    }
    const aliases = [...byAddr.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([addr, names]) => ({ addr, names }))
      .sort((a, b) => a.addr - b.addr);

    // ---- 手写 4 字节地址（可反解成 #!addr;）----
    const handHex = [];
    for (const s of spans) {
      if (s.type !== 'hex') continue;
      const re = /\b[0-9A-Fa-f]{8}\b/g;
      let m;
      while ((m = re.exec(s.content)) !== null) {
        const dec = decodeGadgetRef(m[0]);
        if (!dec) continue;
        handHex.push({
          line: s.line,
          start: s.start + m.index,
          end: s.start + m.index + 8,
          hex: m[0].toUpperCase(),
          addr: dec.addr,
          allow00: dec.allow00,
          source: s.text,
        });
      }
    }

    // ---- gadget 使用率 ----
    const used = new Set();
    for (const s of spans) {
      if (!s.type.includes('gadget') || !s.type.includes('closed')) continue;
      if (s.type.includes('literal')) continue;
      const m = /^#(-?)([^;\s*]+)/.exec(s.content);
      if (m) used.add(m[2]);
    }
    const usedList = g.map((x) => x.name).filter((n) => used.has(n));
    const unusedList = g.map((x) => x.name).filter((n) => !used.has(n));

    // ---- 字节串常量 ----
    const macros = Object.entries(parsed && parsed.macros ? parsed.macros : {}).map(([name, rec]) => ({
      name,
      bytes: rec.bytes.length / 2,
    }));

    return {
      totalBytes: parsed ? parsed.totalBytes : 0,
      errorCount: parsed ? parsed.errorCount : 0,
      hex,
      lineCount: lines.length,
      fileSize,
      lineBytes,
      duplicates,
      duplicateSaving,
      aliases,
      handHex,
      handHexBytes: handHex.length * 4,
      gadgetUsage: { total: g.length, used: usedList, unused: unusedList },
      macros,
      messages: parsed && parsed.messages ? parsed.messages : [],
      segments: parsed && parsed.segments ? parsed.segments.length : 1,
    };
  }

  /**
   * 档 2：把手写 4 字节地址改写成 #!addr; / #-!addr;
   * 返回 { edits, count, bytes }；edits 按位置倒序，方便直接套用。
   */
  function planHexRewrite(input, parsed, gadgets) {
    const report = analyze(input, parsed, gadgets);
    const edits = report.handHex.map((h) => ({
      start: h.start,
      end: h.end,
      text: (h.allow00 ? '#!' : '#-!') + h.addr + ';',
      line: h.line,
      hex: h.hex,
    }));
    edits.sort((a, b) => b.start - a.start);
    return { edits, count: edits.length, bytes: edits.length * 4 };
  }

  function applyEdits(text, edits) {
    let out = text;
    for (const e of edits) {
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
    }
    return out;
  }

  /** 档 2：剔除未被引用的 gadget（只影响 .rop 体积，不影响编译结果） */
  function stripUnusedGadgets(input, parsed, gadgets) {
    const report = analyze(input, parsed, gadgets);
    const unused = new Set(report.gadgetUsage.unused);
    const kept = (gadgets || []).filter((g) => !unused.has(g.name));
    return { gadgets: kept, removed: (gadgets || []).length - kept.length, removedNames: [...unused] };
  }

  /**
   * 档 3：拼接候选
   *
   * 三类：
   *   unaligned —— 某个 2 字节数值的字节在流内别处已存在（未对齐也算），可考虑改指针复用
   *   repeat    —— 重复片段折叠（需要一次跳转，净省 = len - 4）
   *   in-code   —— 数据字节落在某个 4 字节地址字内部（作者在第 44 行用的就是这类手法）
   */
  function candidates(input, parsed, opts) {
    const o = opts || {};
    const bytes = hexBytes(parsed ? parsed.hexChars : '');
    const bk = parsed ? byteKinds(input, parsed) : { kinds: [], wordStart: [] };
    const kinds = bk.kinds;
    const wordStart = bk.wordStart;
    const out = [];
    const starts = lineStartsOf(input);
    const lineOfByte = (b) => {
      const span = bk.spanOfByte && bk.spanOfByte[b];
      if (span) return span.line;
      const pos = parsed && parsed.charPosInInputMap ? parsed.charPosInInputMap[b * 2] : undefined;
      if (pos === undefined) return -1;
      let lo = 0;
      let hi = starts.length;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid] <= pos) lo = mid;
        else hi = mid;
      }
      return lo;
    };

    // 索引：2 字节序列 -> 出现位置
    const pairAt = new Map();
    for (let i = 0; i + 2 <= bytes.length; i++) {
      const key = bytes[i] + bytes[i + 1];
      const arr = pairAt.get(key);
      if (arr) arr.push(i);
      else pairAt.set(key, [i]);
    }

    // ---- 复用候选（每个重复的 2 字节值只报一条）----
    // at    = 想省掉的那处字面量（数值块 / 裸 hex 里）
    // other = 字节流里已有同样两字节的位置；若落在地址字内部则最有价值
    const reported = new Set();
    for (let i = 0; i + 2 <= bytes.length; i++) {
      const kind = kinds[i];
      if (kind !== 'value' && kind !== 'hex') continue;
      const key = bytes[i] + bytes[i + 1];
      if (reported.has(key)) continue;
      const others = (pairAt.get(key) || []).filter((p) => p !== i && !(p < i + 2 && p + 2 > i));
      if (!others.length) continue;
      reported.add(key);
      // 优先挑「地址字内部、且不是字首」的那处：那才是真正零成本的字节
      let other = others[0];
      let inCode = false;
      for (const p of others) {
        const pk = kinds[p];
        if ((pk === 'gadget' || pk === 'literal') && !wordStart[p]) {
          other = p;
          inCode = true;
          break;
        }
      }
      out.push({
        kind: 'reuse',
        save: 2,
        risk: inCode ? 'medium' : 'high',
        at: i,
        other,
        where: inCode ? 'code' : 'data',
        line: lineOfByte(i),
        line2: lineOfByte(other),
        detail: inCode
          ? `${key} 已作为地址字内部的字节存在（字节 ${other}，非字首）`
          : `${key} 在字节 ${other} 已存在`,
      });
    }

    // ---- repeat：重复片段折叠 ----
    const dups = findDuplicates(bytes, 6, 4096);
    for (const d of dups) {
      const net = d.len - 4;
      if (net <= 0) continue;
      out.push({
        kind: 'repeat',
        save: net,
        risk: 'medium',
        at: d.at,
        other: d.other,
        len: d.len,
        line: lineOfByte(d.at),
        line2: lineOfByte(d.other),
        detail: `${d.len} 字节片段在字节 ${d.other} 重复；折叠需一次跳转（4 B），净省 ${net} B`,
      });
    }

    const rank = { low: 0, medium: 1, high: 2 };
    out.sort((a, b) => b.save - a.save || rank[a.risk] - rank[b.risk] || a.at - b.at);
    const max = o.max || 40;
    return out.slice(0, max);
  }

  /**
   * 档 3：压缩校验 —— 与基线对比省了多少、哪些锚点地址变了。
   * baseline = { hex, totalBytes, anchors: {name: addr} }
   */
  function diffBaseline(parsed, baseline) {
    if (!parsed || !baseline) return null;
    const before = hexBytes(baseline.hex || '');
    const after = hexBytes(parsed.hexChars || '');
    let common = 0;
    while (common < before.length && common < after.length && before[common] === after[common]) common++;
    let tail = 0;
    while (
      tail < before.length - common &&
      tail < after.length - common &&
      before[before.length - 1 - tail] === after[after.length - 1 - tail]
    ) {
      tail++;
    }
    const changed = [];
    const anchors = parsed.constants || {};
    const prev = baseline.anchors || {};
    for (const name of new Set([...Object.keys(anchors), ...Object.keys(prev)])) {
      const a = prev[name];
      const b = anchors[name];
      if (a === b) continue;
      changed.push({
        name,
        from: a === undefined ? null : a,
        to: b === undefined ? null : b,
        diff: a !== undefined && b !== undefined ? b - a : null,
      });
    }
    changed.sort((x, y) => Math.abs(y.diff || 0) - Math.abs(x.diff || 0));
    return {
      beforeBytes: before.length,
      afterBytes: after.length,
      saved: before.length - after.length,
      commonPrefix: common,
      commonSuffix: tail,
      changedBytes: Math.max(0, after.length - common - tail),
      anchorChanges: changed,
      identical: before.join('') === after.join(''),
    };
  }

  window.RopCompress = {
    analyze,
    planHexRewrite,
    applyEdits,
    stripUnusedGadgets,
    candidates,
    diffBaseline,
    byteKinds,
    decodeGadgetRef,
    findDuplicates,
    spansWithPositions,
    utf8Len,
    pad4,
  };
})();
