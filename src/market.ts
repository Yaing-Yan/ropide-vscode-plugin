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
}

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
