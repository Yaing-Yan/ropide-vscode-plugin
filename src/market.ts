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
export type MarketPublishResult = { ok: true } | { ok: false; error: string };

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

export async function publishToMarket(payload: {
  name: string;
  author: string;
  model: string;
  description: string;
  data: string;
  timestamp: number;
}): Promise<MarketPublishResult> {
  try {
    await getJson(`${MARKET_BASE_URL}/api/market`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
