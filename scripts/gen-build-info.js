#!/usr/bin/env node
/**
 * RopIDE for VS Code — 构建信息生成器（跨平台，Node 18+）。
 *
 * 每次编译（npm run compile / vsce package 前置钩子）重新生成 src/buildInfo.ts：
 *   - BUILD_TIME        构建时间（UTC "YYYYMMDD-HHMMSS"，update.ts 用它比较远端更新）
 *   - BUILD_VERSION     package.json 的 version（唯一来源，不硬编码）
 *   - BUILD_COMMIT      构建所属 commit 短哈希（7 位）
 *   - BUILD_COMMIT_FULL 完整哈希
 *   - BUILD_COMMIT_DATE 提交时间（ISO 8601）
 *
 * 取值顺序：环境变量 ROPIDE_BUILD_COMMIT / ROPIDE_BUILD_COMMIT_DATE
 *         → 本地 git（rev-parse HEAD）
 *         → GitHub API 查询 main 分支头（适用于 tarball / 无 .git 的构建环境）
 * 三者都失败时记为 'unknown'，不阻塞构建。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'buildInfo.ts');
const REPO = 'Yaing-Yan/ropide-vscode-plugin';

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildTimeNow() {
  const d = new Date();
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    '-' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds())
  );
}

function run(cmd, args) {
  const { execFileSync } = require('child_process');
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'ignore'], // 无 .git 时 git 的报错不污染构建日志
  }).trim();
}

function fromGit() {
  try {
    const full = run('git', ['rev-parse', 'HEAD']);
    if (!/^[0-9a-f]{40}$/i.test(full)) return null;
    let date = '';
    try {
      date = run('git', ['log', '-1', '--format=%cI', 'HEAD']);
    } catch {
      /* 提交时间缺失不阻塞 */
    }
    return { full, short: full.slice(0, 7), date };
  } catch {
    return null; // 无 .git（tarball 构建）或 git 不可用
  }
}

async function fromGitHubApiAsync() {
  if (process.env.ROPIDE_BUILD_NO_FETCH === '1') return null;
  if (typeof globalThis.fetch !== 'function') return null;
  try {
    const res = await globalThis.fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ropide-build-info' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const full = typeof json.sha === 'string' ? json.sha : '';
    if (!/^[0-9a-f]{40}$/i.test(full)) return null;
    const date = json.commit?.committer?.date || '';
    return { full, short: full.slice(0, 7), date };
  } catch {
    return null; // 离线 / 限流 → unknown
  }
}

async function main() {
  const time = buildTimeNow();
  let version = '0.0.0';
  try {
    version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || version;
  } catch {
    /* package.json 读不到时保持兜底值 */
  }

  let commit = null;
  const envCommit = process.env.ROPIDE_BUILD_COMMIT;
  if (envCommit && /^[0-9a-f]{4,40}$/i.test(envCommit)) {
    commit = {
      full: envCommit.length === 40 ? envCommit : envCommit,
      short: envCommit.slice(0, 7),
      date: process.env.ROPIDE_BUILD_COMMIT_DATE || '',
    };
  }
  if (!commit) commit = fromGit();
  if (!commit) commit = await fromGitHubApiAsync();

  const commitShort = commit ? commit.short : 'unknown';
  const commitFull = commit ? commit.full : 'unknown';
  const commitDate = commit && commit.date ? commit.date : 'unknown';

  const content =
    `// 本文件由 scripts/gen-build-info.js 自动生成，请勿手改或提交。\n` +
    `export const BUILD_TIME = '${time}';\n` +
    `export const BUILD_VERSION = '${version}';\n` +
    `export const BUILD_COMMIT = '${commitShort}';\n` +
    `export const BUILD_COMMIT_FULL = '${commitFull}';\n` +
    `export const BUILD_COMMIT_DATE = '${commitDate}';\n`;

  fs.writeFileSync(OUT, content, 'utf8');
  process.stdout.write(`build info: v${version} (${commitShort}) ${time}\n`);
}

main().catch((e) => {
  // 任何意外都不应阻塞编译：写出 unknown 兜底。
  const content =
    `// 本文件由 scripts/gen-build-info.js 自动生成，请勿手改或提交。\n` +
    `export const BUILD_TIME = '${buildTimeNow()}';\n` +
    `export const BUILD_VERSION = '0.0.0';\n` +
    `export const BUILD_COMMIT = 'unknown';\n` +
    `export const BUILD_COMMIT_FULL = 'unknown';\n` +
    `export const BUILD_COMMIT_DATE = 'unknown';\n`;
  try {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, content, 'utf8');
  } catch {
    /* 写不进去就只能让 esbuild 失败 */
  }
  process.stderr.write(`gen-build-info fallback: ${e && e.message ? e.message : e}\n`);
});
