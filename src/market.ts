import { parseRopDocument, RopDocumentData } from './rop';

/**
 * 程序广场（Market）——对接 ropide.pages.dev 的 /api/market。
 * 参考：rop-ide 的 src/MarketPanel.jsx 与 ropide-python 的 main.py。
 */

export const MARKET_BASE_URL = 'https://ropide.pages.dev';

export interface MarketItem {
  id: number | string;
  name: string;
  author: string;
  model: string;
  description: string;
  featured?: number | boolean;
  timestamp?: number | string;
  commentCount?: number;
}

/** 程序广场评论（/api/comments）。 */
export interface MarketComment {
  id: number | string;
  author: string;
  content: string;
  timestamp: number;
}

export type MarketCommentsResult = { comments: MarketComment[] } | { error: string };
export type MarketCommentPostResult =
  | { ok: true; comment: MarketComment }
  | { ok: false; code: 'invalid' | 'notfound' | 'error'; error: string };

/** 与上游 rop-ide 的后端限制保持一致。 */
const MAX_COMMENT_AUTHOR = 50;
const MAX_COMMENT_CONTENT = 1000;

export type MarketListResult = { items: MarketItem[] } | { error: string };
export type MarketGetResult = { data: RopDocumentData } | { error: string };
export type MarketChallengeResult =
  | { challenge: { token: string; offset: number } }
  | { error: string };
export type MarketPublishResult =
  | { ok: true }
  | { ok: false; code: 'wrong' | 'expired' | 'error'; error: string };

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMarketList(): Promise<MarketListResult> {
  try {
    const data = await getJson(`${MARKET_BASE_URL}/api/market`);
    if (!Array.isArray(data)) {
      return { error: '返回数据不是列表' };
    }
    return { items: data as MarketItem[] };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function fetchMarketItem(id: number | string): Promise<MarketGetResult> {
  try {
    const json = (await getJson(
      `${MARKET_BASE_URL}/api/market?id=${encodeURIComponent(String(id))}`
    )) as Record<string, unknown>;
    if (typeof json.data !== 'string' || !json.data) {
      return { error: '返回数据为空' };
    }
    const parsed = parseRopDocument(json.data);
    if (!parsed.ok) {
      return { error: parsed.error };
    }
    return { data: parsed.data };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** 获取「内行验证」题目（返回 ROM 偏移 offset，用户需回答该处两个字节）。 */
export async function fetchMarketChallenge(): Promise<MarketChallengeResult> {
  try {
    const data = (await getJson(
      `${MARKET_BASE_URL}/api/market?challenge=true`
    )) as Record<string, unknown>;
    if (typeof data.token !== 'string' || typeof data.offset !== 'number') {
      return { error: '验证题目格式错误' };
    }
    return { challenge: { token: data.token, offset: data.offset } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function publishToMarket(payload: {
  name: string;
  author: string;
  model: string;
  description: string;
  data: string;
  timestamp: number;
  challengeToken: string;
  challengeAnswer: string;
}): Promise<MarketPublishResult> {
  try {
    const res = await fetch(`${MARKET_BASE_URL}/api/market`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { ok: true };
    }
    if (res.status === 403) {
      return { ok: false, code: 'wrong', error: '字节错误' };
    }
    if (res.status === 410) {
      return { ok: false, code: 'expired', error: '题目已过期' };
    }
    return { ok: false, code: 'error', error: `HTTP ${res.status} ${res.statusText}` };
  } catch (e) {
    return { ok: false, code: 'error', error: (e as Error).message };
  }
}

/* ---------------- 评论 ---------------- */

/** 归一化单条评论；无法识别时返回 null。 */
function normalizeComment(raw: unknown): MarketComment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const author = typeof obj.author === 'string' ? obj.author : '';
  const content = typeof obj.content === 'string' ? obj.content : '';
  if (!author && !content) return null;
  const id =
    typeof obj.id === 'number' || typeof obj.id === 'string' ? obj.id : 0;
  const ts = typeof obj.timestamp === 'number' ? obj.timestamp : Number(obj.timestamp);
  return { id, author, content, timestamp: Number.isFinite(ts) ? ts : 0 };
}

/** 归一化评论数组（按时间倒序，最新在前）。 */
function normalizeCommentList(data: unknown): MarketComment[] | null {
  if (!Array.isArray(data)) return null;
  const out: MarketComment[] = [];
  for (const item of data) {
    const c = normalizeComment(item);
    if (c) out.push(c);
  }
  out.sort((a, b) => b.timestamp - a.timestamp);
  return out;
}

/** 拉取某个程序的评论列表。 */
export async function fetchComments(
  fileId: number | string
): Promise<MarketCommentsResult> {
  const id = Number(fileId);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: '程序 ID 无效' };
  }
  try {
    const data = await getJson(
      `${MARKET_BASE_URL}/api/comments?fileId=${encodeURIComponent(String(id))}`
    );
    const comments = normalizeCommentList(data);
    if (!comments) {
      return { error: '返回数据不是列表' };
    }
    return { comments };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** 发表评论；成功返回服务端创建的评论（响应异常时用本地回显兜底）。 */
export async function postComment(
  fileId: number | string,
  author: string,
  content: string
): Promise<MarketCommentPostResult> {
  const id = Number(fileId);
  const a = String(author ?? '').trim();
  const c = String(content ?? '').trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, code: 'invalid', error: '程序 ID 无效' };
  }
  if (!a || a.length > MAX_COMMENT_AUTHOR) {
    return { ok: false, code: 'invalid', error: '昵称长度不合法' };
  }
  if (!c || c.length > MAX_COMMENT_CONTENT) {
    return { ok: false, code: 'invalid', error: '评论长度不合法' };
  }
  try {
    const res = await fetch(`${MARKET_BASE_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: id, author: a, content: c }),
    });
    if (res.ok) {
      let comment: MarketComment | null = null;
      try {
        comment = normalizeComment(await res.json());
      } catch {
        comment = null;
      }
      // 评论已经写入服务端；响应体异常时不要误报失败，用本地回显兜底。
      if (!comment) {
        comment = { id: `local-${Date.now()}`, author: a, content: c, timestamp: Date.now() };
      }
      return { ok: true, comment };
    }
    if (res.status === 400) {
      return { ok: false, code: 'invalid', error: '昵称或评论内容不合法' };
    }
    if (res.status === 404) {
      return { ok: false, code: 'notfound', error: '程序不存在或已被删除' };
    }
    return { ok: false, code: 'error', error: `HTTP ${res.status} ${res.statusText}` };
  } catch (e) {
    return { ok: false, code: 'error', error: (e as Error).message };
  }
}
