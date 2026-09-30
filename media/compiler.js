/**
 * RopIDE 编译器 / 解析器（Webview 侧）。
 * 忠实移植自 rop-ide 的 src/parser.js（https://github.com/WulanOVO/rop-ide）
 * 以及 ropide-python 的 compiler.py。
 *
 * 输出：
 *   hexChars            最终十六进制字符串（大写）
 *   highlightLines      每个语法 span 的 { type, content } 列表
 *   byteStartPositions  每个字节在 input 字符串中的起始字符位置（最终字节序）
 *   errorCount          语法错误数量
 *   totalBytes          总字节数
 *   segments            分段列表（每段的运行区/储存区基准）
 *   lineSegment         每一行所属的段索引
 */

/* ---------------------------------------------------------------------------
 * 分段（segment）
 *
 * 段标记写在**整行注释**里：
 *
 *   // @seg 名称 L=E9E0 R=D710
 *
 * 因为是注释，旧版编辑器 / 旧编译器会原样忽略，所以 .rop 文件结构
 * （input / gadgets / leftStartAddress / rightStartAddress / ideVersion）
 * 和「不使用分段标记」时的编译结果都完全不变。
 *
 * 语义：段内第一字节的地址 = 该段的运行区(L)/储存区(R)基准；
 *      段内地址 = 段基准 + 段内字节偏移。
 *      没有写 L= / R= 的段继承 .rop 顶层的 leftStartAddress / rightStartAddress。
 *      第一个标记之前的代码属于「默认段」，同样继承顶层地址。
 * ------------------------------------------------------------------------- */
(function () {
  'use strict';

  // // @seg / @segment / @分段 后跟空格或行尾（后面是名称与键值对）
  const SEG_MARK_RE =
    /^[ \t]*\/\/[ \t]*@(?:seg|segment|分段)(?![0-9A-Za-z_\u4e00-\u9fff])[ \t]*(.*)$/i;
  // 支持 L= / left= / run= / 运行区= 与 R= / right= / store= / 储存区= / 存储区=
  const SEG_KV_RE =
    /(?:^|[\s,;|])(left|run|运行区|right|store|储存区|存储区|l|r)[ \t]*[:=][ \t]*(?:0x)?([0-9a-fA-F]{1,5})(?=$|[\s,;|])/gi;

  /** 规范化十六进制地址字符串（去掉 0x、转大写、最多 5 位） */
  function normHexAddr(s) {
    const t = String(s == null ? '' : s)
      .trim()
      .replace(/^0[xX]/, '')
      .replace(/[^0-9a-fA-F]/g, '')
      .slice(0, 5)
      .toUpperCase();
    return t;
  }

  /** 把十六进制地址解析成数值；非法返回 0 */
  function parseHexAddr(s) {
    const n = parseInt(normHexAddr(s) || '0', 16);
    return isNaN(n) ? 0 : n;
  }

  /** 规范成 5 位地址（供 #gadget; / #!addr; 编码使用）；非法返回 '' */
  function normAddr5(s) {
    const t = String(s == null ? '' : s)
      .replace(/^0[xX]/, '')
      .replace(/[^0-9a-fA-F]/g, '')
      .toUpperCase();
    if (!t || t.length > 5) return '';
    return t.padStart(5, '0');
  }

  /**
   * 按 `#gadget;` 的规则把 5 位地址编码成 8 位 hex。
   * 与旧版逐字节一致（含 h1 为 '00' 且非 allow00 时改写成 '01' 的特例）。
   */
  function encodeGadgetRef(addr, allow00) {
    let hex = addr.slice(3, 5);
    if (hex === '00' && !allow00) hex = '01';
    hex += addr.slice(1, 3);
    hex += (allow00 ? '0' : '3') + addr[0];
    hex += allow00 ? '00' : '30';
    return hex;
  }

  /** 读取 `*n` 重复后缀；没有则返回 null */
  function matchRepeat(text, from) {
    const m = /^\*(\d{1,3})/.exec(text.slice(from));
    if (!m) return null;
    return { count: Math.max(1, parseInt(m[1], 10)), end: from + m[0].length, text: m[0] };
  }

  /** 判断一行是否为分段标记行；是则返回 { name, left, right }，否则返回 null。 */
  function parseSegmentMark(line) {
    const m = SEG_MARK_RE.exec(line);
    if (!m) return null;
    let left = '';
    let right = '';
    const rest = String(m[1] || '').replace(SEG_KV_RE, (_all, key, val) => {
      const k = String(key).toLowerCase();
      if (k === 'l' || k === 'left' || k === 'run' || key === '运行区') left = normHexAddr(val);
      else right = normHexAddr(val);
      return ' ';
    });
    let name = rest.replace(/[\s,;|]+/g, ' ').trim();
    if (name.length >= 2) {
      const a = name[0];
      const b = name[name.length - 1];
      if ((a === '"' && b === '"') || (a === "'" && b === "'") || (a === '“' && b === '”')) {
        name = name.slice(1, -1).trim();
      }
    }
    return { name, left, right };
  }

  /**
   * 预扫描所有行，建立分段表。
   * 返回 { segments, lineSegment }；lineSegment[i] 是第 i 行所属的段索引。
   */
  function buildSegments(lines, defaultLeft, defaultRight) {
    const segments = [];
    const lineSegment = new Array(lines.length);
    const mk = (mark, lineIdx, hasMark) => ({
      name: mark ? mark.name : '',
      left: (mark && mark.left) || defaultLeft,
      right: (mark && mark.right) || defaultRight,
      leftExplicit: !!(mark && mark.left),
      rightExplicit: !!(mark && mark.right),
      hasMark: !!hasMark,
      markLine: hasMark ? lineIdx : -1,
      startLine: lineIdx,
      endLine: lineIdx,
      startByte: null, // 编译时填充：该段第一字节在整条字节流中的下标
    });

    let current = mk(null, 0, false);
    for (let i = 0; i < lines.length; i++) {
      const mark = parseSegmentMark(lines[i]);
      if (mark) {
        if (i === 0) {
          // 第一行就是标记：直接作为第一段，不产生空的默认段
          current = mk(mark, 0, true);
        } else {
          current.endLine = i - 1;
          segments.push(current);
          current = mk(mark, i, true);
        }
      }
      lineSegment[i] = segments.length; // 当前段的最终下标
    }
    current.endLine = Math.max(0, lines.length - 1);
    segments.push(current);
    return { segments, lineSegment };
  }

  function parseRopInput(input, gadgets, options) {
    options = options || {};
    const leftStartAddress = options.leftStartAddress || '0';
    const rightStartAddress = options.rightStartAddress || '0';

    const lines = input.split('\n');
    const segInfo = buildSegments(
      lines,
      normHexAddr(leftStartAddress),
      normHexAddr(rightStartAddress)
    );
    const segments = segInfo.segments;
    const lineSegment = segInfo.lineSegment;
    const charPosInInputMap = [];
    const highlightLines = [];
    const constants = {};
    const anchorSides = {};  // 锚点名 -> 'left' | 'right'
    let errorCount = 0;
    let hexChars = '';
    let posInInput = 0;

    const deferredValuePatches = [];
    const deferredHighlightPatches = [];
    const deferredConstPatches = [];   // $a = <用到尚未定义的名字>; 延后到第一遍结束再算
    const byteMacros = {};             // %name = AA BB CC;  ->  { bytes, startPos, endPos }
    const messages = [];               // 编译期诊断：{ level, line, text }

    function addMessage(level, lineIndex, text) {
      messages.push({ level, line: lineIndex + 1, text });
    }

    /**
     * 当前已产出的字节数（含尚未回填的延迟数值块）。
     * 与旧版一致：Math.ceil(hexChars.length / 2) + 之前挂起的延迟字节数。
     */
    function currentByteCount() {
      let deferred = 0;
      for (const p of deferredValuePatches) {
        if (p.startHexIndex <= hexChars.length) deferred += p.bytesToInsert || 2;
      }
      return Math.ceil(hexChars.length / 2) + deferred;
    }

    /**
     * 求值表达式：由 `+` / `-` 连接的字面量、`$常量` 与 `<锚点>` 组成。
     *
     * @param inner                    表达式文本（不含括号）
     * @param allowUndefinedAsDeferred 未定义的名字是否按「延后回填」处理
     * @param keepNegative             true 时保留负值（常量定义用；旧版 $a = -1; 存的就是 -1）
     */
    function evalExpression(inner, allowUndefinedAsDeferred, keepNegative) {
      let value = 0x0000;
      let symbol = '+';
      let hasErrors = false;
      let deferred = false;

      const parts = String(inner).split(' ').filter(Boolean);
      for (const part of parts) {
        // <锚点> / <-锚点>：锚点存在和常量同一个表里，负号在定义处已确定，这里忽略
        const am = /^<(-?)([A-Za-z0-9_-]+)>$/.exec(part);
        const refName = part.startsWith('$')
          ? part.substring(1)
          : (am ? am[2] : null);
        if (refName !== null) {
          const constantValue = constants[refName];
          if (constantValue !== undefined) {
            if (symbol === '+') value += constantValue;
            else if (symbol === '-') value -= constantValue;
            else { hasErrors = true; break; }
          } else {
            if (allowUndefinedAsDeferred) {
              deferred = true;
              if (symbol === '+') value += 0;
              else if (symbol === '-') value -= 0;
              else { hasErrors = true; break; }
            } else {
              hasErrors = true;
              break;
            }
          }
          symbol = '';
        } else if (part === '+' || part === '-') {
          if (symbol === '') symbol = part;
          else { hasErrors = true; break; }
        } else {
          if (!/^-?[0-9a-fA-F]+$/.test(part)) { hasErrors = true; break; }
          if (symbol === '+') value += parseInt(part, 16);
          else if (symbol === '-') value -= parseInt(part, 16);
          else { hasErrors = true; break; }
          symbol = '';
        }
      }

      if (symbol !== '') {
        hasErrors = true;
      } else if (!isNaN(value)) {
        if (!(allowUndefinedAsDeferred && deferred) && (value > 0xffff || value < -0x8000)) {
          hasErrors = true;
        }
        if (value < 0 && !keepNegative) value = 0xffff + value + 1; // 负数转补码
      } else {
        hasErrors = true;
      }

      return { value, hasErrors, deferred };
    }

    function pushHexChars(hex, startPosInLine, endPosInLine, repeatBytes) {
      if (!hex) return;
      hexChars += hex.toUpperCase();
      for (let k = 0; k < repeatBytes; k++) {
        charPosInInputMap.push(startPosInLine);
        charPosInInputMap.push(endPosInLine);
      }
    }

    lines.forEach((line, lineIndex) => {
      const lineStartPosInInput = posInInput;
      const segIndex = lineSegment[lineIndex] || 0;
      const seg = segments[segIndex];
      // 记录该段第一字节在整条字节流中的下标（用于段内偏移换算）
      if (seg.startByte === null) seg.startByte = currentByteCount();
      const segMark = seg.markLine === lineIndex ? parseSegmentMark(line) : null;
      const spans = [];
      const pushSpan = (type, content) => spans.push({ type, content });

      let i = 0;
      while (i < line.length) {
        const char = line[i];
        const charPosInInput = lineStartPosInInput + i;

        // 注释 //...（分段标记行用 seg-mark 额外标注）
        if (char === '/' && line[i + 1] === '/') {
          pushSpan(segMark ? 'comment,seg-mark' : 'comment', line.substring(i));
          break;
        }

        // 常量 $a = 0x...;
        else if (char === '$') {
          let j = i + 1;
          while (j < line.length && line[j] !== ';') j++;
          const hasSemicolon = j < line.length && line[j] === ';';
          const constantContent = line.substring(i, hasSemicolon ? j + 1 : j);

          if (hasSemicolon) {
            const constantStr = line.substring(i + 1, j).replace(/\s+/g, '');
            const parts = constantStr.split('=');
            if (parts.length === 2) {
              // 旧行为：值里允许空格（$a = 12 34; 即 0x1234），所以字面量判定用去空格版本
              const strippedValue = parts[1];
              const rawBody = line.substring(i + 1, j);
              const rawValue = rawBody.slice(rawBody.indexOf('=') + 1).trim();
              if (/^-?[0-9a-fA-F]+$/.test(strippedValue)) {
                const intValue = parseInt(strippedValue, 16);
                if (!isNaN(intValue) && intValue <= 0xffff && intValue >= -0x8000) {
                  if (constants[parts[0]] !== undefined) {
                    errorCount++;
                    addMessage('error', lineIndex, `常量 $${parts[0]} 重复定义`);
                    pushSpan('constant,name,warning', constantContent);
                    i = j + 1;
                    continue;
                  }
                  constants[parts[0]] = intValue;
                } else {
                  errorCount++;
                  pushSpan('constant,value,warning', constantContent);
                  i = j + 1;
                  continue;
                }
              } else {
                // 表达式：$a = $b + 1; / $a = <label> - 8;
                const res = evalExpression(rawValue, true, true);
                if (res.hasErrors) {
                  errorCount++;
                  addMessage('error', lineIndex, `常量 $${parts[0]} 的表达式无法求值：${rawValue}`);
                  pushSpan('constant,value,warning', constantContent);
                  i = j + 1;
                  continue;
                }
                if (constants[parts[0]] !== undefined) {
                  errorCount++;
                  addMessage('error', lineIndex, `常量 $${parts[0]} 重复定义`);
                  pushSpan('constant,name,warning', constantContent);
                  i = j + 1;
                  continue;
                }
                if (res.deferred) {
                  // 引用了后面才定义的名字 → 第一遍结束后再算
                  deferredConstPatches.push({
                    name: parts[0],
                    expr: rawValue,
                    lineIndex,
                    valueSpanIndex: spans.length + 2, // name / equal / value / ';'
                  });
                } else {
                  constants[parts[0]] = res.value;
                }
              }
            }

            const partsForHighlight = constantContent.split(/(\s*=\s*)/);
            if (partsForHighlight.length === 3) {
              pushSpan('constant,name', partsForHighlight[0]);
              pushSpan('constant,equal', partsForHighlight[1]);
              pushSpan(
                'constant,value',
                partsForHighlight[2].substring(0, partsForHighlight[2].length - 1)
              );
              pushSpan('', ';');
            } else {
              errorCount++;
              pushSpan('constant,name,warning', constantContent);
            }
          } else {
            errorCount++;
            pushSpan('constant,name', constantContent);
          }

          i = j + (hasSemicolon ? 1 : 0);
        }

        // gadget #name; / 地址字面量 #!addr;（可带 -! 前缀）、均可加 *n 重复
        else if (char === '#') {
          let j = i + 1;
          while (j < line.length && line[j] !== ';' && line[j] !== ' ') j++;
          const hasSemicolon = j < line.length && line[j] === ';';
          const gadgetContent = line.substring(i, hasSemicolon ? j + 1 : j);

          if (hasSemicolon) {
            let gadgetName = gadgetContent.substring(1, gadgetContent.length - 1);
            const allow00 = !gadgetName.startsWith('-');
            if (!allow00) gadgetName = gadgetName.slice(1);

            const rep = matchRepeat(line, j + 1) || { count: 1, end: j + 1, text: '' };
            const spanContent = line.substring(i, rep.end);

            if (gadgetName.startsWith('!')) {
              // #!addr; —— 直接按 gadget 编码写地址，不必先建 gadget 条目
              const addr = normAddr5(gadgetName.slice(1));
              if (!addr) {
                errorCount++;
                addMessage('error', lineIndex, `地址字面量的写法不对：${spanContent}`);
                pushSpan('gadget,literal,warning', spanContent);
              } else {
                pushSpan('gadget,literal,closed' + (rep.count > 1 ? ',repeat' : ''), spanContent);
                const hex = encodeGadgetRef(addr, allow00);
                for (let r = 0; r < rep.count; r++) {
                  pushHexChars(hex, charPosInInput, lineStartPosInInput + j, 4);
                }
              }
            } else {
              const gadget = (gadgets || []).find((g) => g.name === gadgetName);
              if (!gadget) {
                errorCount++;
                addMessage('error', lineIndex, `找不到 gadget #${gadgetName};`);
                pushSpan('gadget,warning', spanContent);
              } else {
                pushSpan('gadget,closed' + (rep.count > 1 ? ',repeat' : ''), spanContent);

                const addr = gadget.addr || '';
                const hex = encodeGadgetRef(addr, allow00);
                for (let r = 0; r < rep.count; r++) {
                  pushHexChars(hex, charPosInInput, lineStartPosInInput + j, 4);
                }
              }
            }
            i = rep.end;
            continue;
          } else {
            pushSpan('gadget', gadgetContent);
          }

          i = j + (hasSemicolon ? 1 : 0);
        }

        // 数值块 [...]，可加 *n 重复
        else if (char === '[') {
          let j = i + 1;
          while (j < line.length && line[j] !== ']') j++;
          const hasBracket = j < line.length && line[j] === ']';
          const valueContent = line.substring(i, hasBracket ? j + 1 : j);
          const rep = matchRepeat(line, j + 1) || { count: 1, end: j + 1, text: '' };

          if (hasBracket) {
            const inner = line.substring(i + 1, j);
            const spanContent = line.substring(i, rep.end);
            const firstPass = evalExpression(inner, true);
            const value = firstPass.value;
            const hasErrors = firstPass.hasErrors;
            const deferred = firstPass.deferred || /\$/.test(inner) || /<[^>]*>/.test(inner);

            if (hasErrors) {
              // 旧版只给「警告」高亮、不计入 errorCount，这里保持计数不变，只额外记一条诊断
              addMessage('warning', lineIndex, `数值块无法求值，已忽略：${valueContent}`);
              pushSpan('value,closed,warning', spanContent);
              i = rep.end;
              continue;
            } else {
              pushSpan('value,closed' + (rep.count > 1 ? ',repeat' : ''), spanContent);
            }

            const addrStr = value.toString(16).toUpperCase().padStart(4, '0');
            const littleEndian = addrStr.slice(2, 4) + addrStr.slice(0, 2);

            if (!deferred) {
              for (let r = 0; r < rep.count; r++) {
                pushHexChars(littleEndian, charPosInInput, lineStartPosInInput + j, 2);
              }
            } else {
              for (let r = 0; r < rep.count; r++) {
                deferredValuePatches.push({
                  startHexIndex: hexChars.length,
                  endHexIndex: hexChars.length,
                  expression: inner,
                  startPosInLine: charPosInInput,
                  endPosInLine: lineStartPosInInput + j,
                  bytesToInsert: 2,
                });
                deferredHighlightPatches.push({
                  lineIndex,
                  spanIndex: spans.length - 1,
                  expression: inner,
                });
              }
            }
          } else {
            pushSpan('value', valueContent);
          }

          i = hasBracket ? rep.end : j;
        }

        // 地址锚点 <...> / <-...>，可选 @绝对地址 断言（<key-table@EA3E>）
        else if (char === '<') {
          let j = i + 1;
          while (j < line.length && line[j] !== '>' && line[j] !== ' ') j++;
          const hasClose = j < line.length && line[j] === '>';
          const anchorContent = line.substring(i, hasClose ? j + 1 : j);

          if (hasClose) {
            let anchorName = line.substring(i + 1, j);
            let addrStart = parseHexAddr(seg.right);
            let side = 'right';
            if (anchorName.startsWith('-')) {
              anchorName = anchorName.substring(1);
              addrStart = parseHexAddr(seg.left);
              side = 'left';
            }

            let declared = null;
            const at = anchorName.indexOf('@');
            if (at >= 0) {
              declared = normAddr5(anchorName.slice(at + 1));
              anchorName = anchorName.slice(0, at);
            }

            // 段内偏移 = 全局字节数 - 该段起始字节数（无分段标记时起始字节数为 0，与旧版一致）
            const addr = addrStart + (currentByteCount() - seg.startByte);

            let badDeclared = false;
            if (at >= 0) {
              if (!declared) {
                badDeclared = true;
                errorCount++;
                addMessage('error', lineIndex, `锚点 ${anchorContent} 的绝对地址写法不对`);
              } else if (parseInt(declared, 16) !== addr) {
                badDeclared = true;
                errorCount++;
                const actual = addr.toString(16).toUpperCase().padStart(4, '0');
                const diff = addr - parseInt(declared, 16);
                addMessage(
                  'error',
                  lineIndex,
                  `锚点 ${anchorContent} 断言失败：实际 ${actual}，相差 ${diff > 0 ? '+' : ''}${diff} 字节`
                );
              }
            }

            pushSpan(badDeclared ? 'anchor,closed,warning' : 'anchor,closed', anchorContent);
            constants[anchorName] = addr;
            anchorSides[anchorName] = side;
          } else {
            pushSpan('anchor', anchorContent);
          }

          i = j + (hasClose ? 1 : 0);
        }

        // 字节串常量 %name = AA BB CC;  与引用 %name;（可加 *n 重复）
        else if (char === '%') {
          let j = i + 1;
          while (j < line.length && /[A-Za-z0-9_-]/.test(line[j])) j++;
          const macroName = line.substring(i + 1, j);
          let k = j;
          while (k < line.length && (line[k] === ' ' || line[k] === '\t')) k++;

          if (macroName && line[k] === '=') {
            let m = k + 1;
            while (m < line.length && line[m] !== ';') m++;
            const hasSemi = m < line.length;
            const bodyHex = line.substring(k + 1, m).replace(/[^0-9a-fA-F]/g, '').toUpperCase();
            const content = line.substring(i, hasSemi ? m + 1 : m);

            if (!hasSemi || bodyHex.length % 2 !== 0 || bodyHex.length === 0) {
              errorCount++;
              addMessage('error', lineIndex, `字节串 %${macroName} 的定义不合法：${content}`);
              pushSpan('macro,name,warning', content);
            } else if (byteMacros[macroName]) {
              errorCount++;
              addMessage('error', lineIndex, `字节串 %${macroName} 重复定义`);
              pushSpan('macro,name,warning', content);
            } else {
              byteMacros[macroName] = {
                bytes: bodyHex,
                startPos: lineStartPosInInput + i,
                endPos: lineStartPosInInput + m,
              };
              pushSpan('macro,name', line.substring(i, j));
              pushSpan('macro,equal', line.substring(j, k + 1));
              pushSpan('macro,bytes', line.substring(k + 1, m));
              pushSpan('', ';');
            }
            i = hasSemi ? m + 1 : m;
            continue;
          }

          if (macroName && line[j] === ';') {
            const base = j + 1;
            const rep = matchRepeat(line, base) || { count: 1, end: base, text: '' };
            const spanContent = line.substring(i, rep.end);
            const rec = byteMacros[macroName];
            if (!rec) {
              errorCount++;
              addMessage('error', lineIndex, `未定义的字节串 %${macroName}（需要先写 %${macroName} = ...; ）`);
              pushSpan('macro,closed,warning', spanContent);
            } else {
              pushSpan('macro,closed' + (rep.count > 1 ? ',repeat' : ''), spanContent);
              for (let r = 0; r < rep.count; r++) {
                pushHexChars(rec.bytes, rec.startPos, rec.endPos, rec.bytes.length / 2);
              }
            }
            i = rep.end;
            continue;
          }

          // 不是字节串语法 → 保持旧版的 other 处理
          let m2 = i + 1;
          while (m2 < line.length && !/[0-9a-fA-F\/\$#\[<]/.test(line[m2])) m2++;
          pushSpan('other', line.substring(i, m2));
          i = m2;
        }

        // 裸十六进制字符
        else if (/[0-9a-fA-F]/.test(char)) {
          let j = i + 1;
          while (j < line.length && /[0-9a-fA-F\s]/.test(line[j])) j++;
          const hexContent = line.substring(i, j);
          pushSpan('hex', hexContent);

          for (let k = i; k < j; k++) {
            const c = line[k];
            if (/[0-9a-fA-F]/.test(c)) {
              hexChars += c.toUpperCase();
              charPosInInputMap.push(lineStartPosInInput + k);
            }
          }
          i = j;
        }

        // 其他字符
        else {
          let j = i + 1;
          while (j < line.length && !/[0-9a-fA-F\/\$#\[<]/.test(line[j])) j++;
          pushSpan('other', line.substring(i, j));
          i = j;
        }
      }

      highlightLines.push(spans);
      posInInput += line.length + 1;
    });

    // 第一遍结束：结算「引用了后面才定义的名字」的常量定义（$a = <label> - 8;）
    // 反复扫描直到没有进展，这样 $a = $b + 1; $b = $c + 1; $c = 5; 这类依赖链也能算出来。
    {
      const pending = deferredConstPatches.slice();
      let progress = true;
      while (progress && pending.length) {
        progress = false;
        for (let i = pending.length - 1; i >= 0; i--) {
          const res = evalExpression(pending[i].expr, true, true);
          if (!res.hasErrors && !res.deferred) {
            constants[pending[i].name] = res.value;
            pending.splice(i, 1);
            progress = true;
          }
        }
      }
      for (const p of pending) {
        errorCount++;
        addMessage('error', p.lineIndex, `常量 $${p.name} 的表达式无法求值：${p.expr}`);
        const spans = highlightLines[p.lineIndex];
        const span = spans && spans[p.valueSpanIndex];
        if (span && !span.type.includes('warning')) span.type += ',warning';
      }
    }

    // 第二遍：按位置顺序插入延迟字节
    {
      let insertedHexCount = 0;
      const patchesSorted = deferredValuePatches
        .slice()
        .sort((a, b) => a.startHexIndex - b.startHexIndex);
      for (const patch of patchesSorted) {
        const { value, hasErrors } = evalExpression(patch.expression, false);
        if (hasErrors) {
          errorCount++;
          continue;
        }
        const addrStr = value.toString(16).toUpperCase().padStart(4, '0');
        const littleEndian = addrStr.slice(2, 4) + addrStr.slice(0, 2);
        const insertPos = patch.startHexIndex + insertedHexCount;

        hexChars =
          hexChars.substring(0, insertPos) + littleEndian + hexChars.substring(insertPos);
        insertedHexCount += littleEndian.length;

        const mapping = [];
        for (let k = 0; k < (patch.bytesToInsert || 2); k++) {
          mapping.push(patch.startPosInLine);
          mapping.push(patch.endPosInLine);
        }
        charPosInInputMap.splice(insertPos, 0, ...mapping);
      }
    }

    for (const h of deferredHighlightPatches) {
      const { hasErrors } = evalExpression(h.expression, false);
      if (hasErrors) {
        const span = highlightLines[h.lineIndex] && highlightLines[h.lineIndex][h.spanIndex];
        if (span) {
          span.type = span.type.includes('warning') ? span.type : span.type + ',warning';
        }
      }
    }

    const byteStartPositions = [];
    for (let b = 0; b < Math.floor(charPosInInputMap.length / 2); b++) {
      byteStartPositions.push(charPosInInputMap[b * 2]);
    }

    // 补全每段的字节区间，方便调用方做「字节 → 段」的换算
    const totalBytes = Math.floor(hexChars.length / 2);
    for (let s = 0; s < segments.length; s++) {
      if (segments[s].startByte === null) segments[s].startByte = 0;
      segments[s].endByte =
        s + 1 < segments.length ? segments[s + 1].startByte : totalBytes;
      if (segments[s].endByte < segments[s].startByte) {
        segments[s].endByte = segments[s].startByte;
      }
      segments[s].byteLength = segments[s].endByte - segments[s].startByte;
    }

    return {
      hexChars,
      charPosInInputMap,
      highlightLines,
      errorCount,
      byteStartPositions,
      constants,
      anchorSides,
      totalBytes,
      segments,
      lineSegment,
      messages,
      macros: byteMacros,
    };
  }

  window.RopCompiler = {
    parseRopInput,
    parseSegmentMark,
    normHexAddr,
    normAddr5,
    parseHexAddr,
    encodeGadgetRef,
    matchRepeat,
  };
})();
