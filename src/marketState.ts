import * as vscode from 'vscode';
import { fetchMarketList, MarketItem, MarketListResult } from './market';

/** 把市场条目的 timestamp 统一成 epoch 毫秒（兼容 number / 数字字符串 / ISO 字符串）。 */
function itemTime(it: MarketItem): number {
  const t = it.timestamp;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const n = Number(t);
    if (!isNaN(n)) return n;
    const d = Date.parse(t);
    if (!isNaN(d)) return d;
  }
  return 0;
}

/**
 * 跨视图共享的「程序广场未读」状态：
 *  - 最后查看时间存 globalState（跨窗口 / 跨会话 / 跨标签页）
 *  - 任一视图打开广场 → 拉取最新列表成功后标记已读，并向所有已注册视图广播清零
 *    （多个编辑器 / 多个欢迎页同时打开时，任意一个看过即全部消除红点）
 */
class MarketUnreadState {
  private cache: MarketItem[] | null = null;
  private context: vscode.ExtensionContext | null = null;
  private senders = new Set<(unread: number) => void>();

  init(context: vscode.ExtensionContext): void {
    this.context = context;
  }

  private lastSeen(): number {
    return this.context?.globalState.get<number>('ropide.marketLastSeen', 0) ?? 0;
  }

  /** 注册一个视图（编辑器 session / 欢迎页 panel），返回当前未读数（缓存可能为空）。 */
  subscribe(send: (unread: number) => void): number {
    this.senders.add(send);
    return this.unread();
  }

  unsubscribe(send: (unread: number) => void): void {
    this.senders.delete(send);
  }

  private broadcast(unread: number): void {
    for (const send of this.senders) {
      try {
        send(unread);
      } catch {
        /* 忽略失效视图 */
      }
    }
  }

  private unreadFrom(items: MarketItem[] | null): number {
    if (!items) return 0;
    const last = this.lastSeen();
    return items.filter((it) => itemTime(it) > last).length;
  }

  unread(): number {
    return this.unreadFrom(this.cache);
  }

  /** 查询未读数（不标记已读）：缓存为空时先拉一次列表。 */
  async check(): Promise<number> {
    if (!this.cache) {
      const r = await fetchMarketList();
      if (!('error' in r)) this.cache = r.items;
    }
    return this.unread();
  }

  /** 打开广场：拉最新列表；拉取成功才标记已读并广播清零。 */
  async open(): Promise<MarketListResult> {
    const r = await fetchMarketList();
    if ('error' in r) return r;
    this.cache = r.items;
    await this.context?.globalState.update('ropide.marketLastSeen', Date.now());
    this.broadcast(0);
    return r;
  }
}

export const marketUnread = new MarketUnreadState();