import { BUILD_TIME } from './buildInfo';

/**
 * 版本更新检查：本插件以源码 / .vsix 方式安装，没有 Marketplace 版本号可比。
 * 因此改为比较「本地构建时间 BUILD_TIME」与「GitHub main 分支最新提交时间」，
 * 远端更新则提示有新版本。任何网络/解析失败都静默返回（不打扰用户）。
 */

const REPO = 'Yaing-Yan/ropide-vscode-plugin';
export const REPO_URL = `https://github.com/${REPO}`;

export type UpdateResult =
  | { hasUpdate: boolean; localTime: number; remoteTime: number; sha: string }
  | { error: string };

/** 把 BUILD_TIME（UTC 的 "YYYYMMDD-HHMMSS"）解析为毫秒时间戳。 */
function parseBuildTime(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  const [, y, mo, d, h, mi, se] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
}

export async function checkForUpdate(): Promise<UpdateResult> {
  const local = parseBuildTime(BUILD_TIME);
  if (Number.isNaN(local)) {
    return { error: '无法解析本地构建时间' };
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as {
      sha?: string;
      commit?: { committer?: { date?: string } };
    };
    const dateStr = json.commit?.committer?.date;
    if (!dateStr) {
      return { error: '返回数据缺少提交时间' };
    }
    const remote = Date.parse(dateStr);
    if (Number.isNaN(remote)) {
      return { error: '提交时间格式错误' };
    }
    // 留 2 分钟余量，避免构建时间与提交时间的细微差异误报。
    const hasUpdate = remote - local > 2 * 60 * 1000;
    return { hasUpdate, localTime: local, remoteTime: remote, sha: (json.sha || '').slice(0, 7) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
