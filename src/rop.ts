/**
 * .rop 文件是单个 JSON 对象：
 *   {
 *     "input": string,               // 汇编 DSL 源码
 *     "gadgets": [{ name, addr, desc, tags: [{ name, color }] }],
 *     "leftStartAddress": "E9E0",    // 左侧起始地址（十六进制字符串）
 *     "rightStartAddress": "D710",   // 右侧起始地址
 *     "ideVersion": 100
 *   }
 *
 * 本扩展不涉及 .rin / gadgets.json / config.json，所有数据都在单个 .rop 文件里。
 */

export interface RopTag {
  name: string;
  color: string;
}

export interface RopGadget {
  name: string;
  addr: string;
  desc: string;
  tags: RopTag[];
}

export interface RopDocumentData {
  input: string;
  gadgets: RopGadget[];
  leftStartAddress: string;
  rightStartAddress: string;
  ideVersion: number;
}

export const DEFAULT_LEFT_ADDRESS = 'E9E0';
export const DEFAULT_RIGHT_ADDRESS = 'D710';
export const IDE_VERSION = 100;

export type RopParseResult = { ok: true; data: RopDocumentData } | { ok: false; error: string };

function normalizeGadget(raw: unknown): RopGadget {
  if (typeof raw !== 'object' || raw === null) {
    return { name: '', addr: '', desc: '', tags: [] };
  }
  const g = raw as Record<string, unknown>;
  const tags: RopTag[] = [];
  if (Array.isArray(g.tags)) {
    for (const t of g.tags) {
      if (typeof t === 'object' && t !== null) {
        const tag = t as Record<string, unknown>;
        tags.push({
          name: typeof tag.name === 'string' ? tag.name : '',
          color: typeof tag.color === 'string' ? tag.color : 'gray',
        });
      }
    }
  }
  return {
    name: typeof g.name === 'string' ? g.name : '',
    addr: typeof g.addr === 'string' ? g.addr : '',
    desc: typeof g.desc === 'string' ? g.desc : '',
    tags,
  };
}

export function parseRopDocument(text: string): RopParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `不是合法的 JSON：${(e as Error).message}` };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: '.rop 文件顶层必须是 JSON 对象。' };
  }
  const obj = raw as Record<string, unknown>;
  const input = typeof obj.input === 'string' ? obj.input : '';
  const gadgets = Array.isArray(obj.gadgets) ? obj.gadgets.map(normalizeGadget) : [];
  const leftStartAddress =
    typeof obj.leftStartAddress === 'string' ? obj.leftStartAddress : DEFAULT_LEFT_ADDRESS;
  const rightStartAddress =
    typeof obj.rightStartAddress === 'string' ? obj.rightStartAddress : DEFAULT_RIGHT_ADDRESS;
  const ideVersion = typeof obj.ideVersion === 'number' ? obj.ideVersion : IDE_VERSION;
  return { ok: true, data: { input, gadgets, leftStartAddress, rightStartAddress, ideVersion } };
}

export function serializeRopDocument(data: RopDocumentData): string {
  // 与 ropide.pages.dev / ropide-python 保持一致：紧凑单行 JSON。
  return JSON.stringify({
    input: data.input,
    gadgets: data.gadgets,
    leftStartAddress: data.leftStartAddress,
    rightStartAddress: data.rightStartAddress,
    ideVersion: data.ideVersion,
  });
}

export function newRopDocument(): RopDocumentData {
  return {
    input: '// new.rop\n',
    gadgets: [],
    leftStartAddress: DEFAULT_LEFT_ADDRESS,
    rightStartAddress: DEFAULT_RIGHT_ADDRESS,
    ideVersion: IDE_VERSION,
  };
}
