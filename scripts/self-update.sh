#!/usr/bin/env bash
#
# RopIDE for VS Code — 自更新脚本（由插件内的「立即更新」按钮触发）
#
# 用法：  bash scripts/self-update.sh
#
# 流程：  下载 GitHub main 最新源码 → npm install → 编译 → 打包 .vsix → 覆盖安装
#         （与 simply-plugin.sh 的安装流程一致，只是不需要手动下载脚本）
#
# 界面复用 scripts/ui.sh：反色标题胶囊居中偏上，下方固定 4 行渐变日志。
# 脚本只在临时目录里工作，不会碰当前已安装的扩展目录；安装完成后回 VS Code
# 重载窗口（Ctrl+Shift+P → Reload Window）即可生效。
#
set -euo pipefail

SELF_DIR=$(cd "$(dirname "$0")" && pwd)

# ---------------------------------------------------------------- 载入界面库
UI_LIB="$SELF_DIR/ui.sh"
# shellcheck source=scripts/ui.sh
[ -f "$UI_LIB" ] && . "$UI_LIB"

if ! command -v ui_begin >/dev/null 2>&1; then
  ui_init() { :; }
  ui_menu() { :; }
  ui_header() { :; }
  ui_begin() { :; }
  ui_log() { printf '%s\n' "${1-}"; }
  ui_status() { printf '%s\n' "${1-}"; }
  ui_prompt() { printf '%s' "${1-}"; }
  ui_finish() { :; }
  run() { printf '==> %s\n' "$*"; "$@"; }
fi

REPO="Yaing-Yan/ropide-vscode-plugin"
BRANCH="main"
TARBALL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"
WORK_DIR="${TMPDIR:-/tmp}/ropide-vscode-plugin-update"
ARCHIVE="${TMPDIR:-/tmp}/ropide-vscode-plugin-update.tar.gz"
EXT_ID="yaing-yan.ropide-vscode-plugin"
TITLE="RopIDE for VS Code"

fail() {
  ui_status "✗ ${1}" err
  ui_finish
  printf '\n'
  exit 1
}

find_code() {
  for c in code code-insiders codium; do
    if command -v "$c" >/dev/null 2>&1; then
      printf '%s\n' "$c"
      return 0
    fi
  done
  for p in \
    /usr/share/code/bin/code \
    /opt/vscode/bin/code \
    /snap/bin/code \
    /usr/local/bin/code \
    "$HOME/.local/bin/code" \
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; do
    if [ -x "$p" ]; then
      printf '%s\n' "$p"
      return 0
    fi
  done
  return 1
}

# ------------------------------------------------------------------- 界面
ui_init "$TITLE" "正在更新 / Updating" "下载最新源码 → 编译打包 → 覆盖安装，完成后重载窗口即可"
ui_begin
ui_status "检查运行环境…" busy

command -v node >/dev/null 2>&1 || fail "未找到 Node.js，无法本地编译：请先安装 Node.js 18+"
command -v curl >/dev/null 2>&1 || fail "未找到 curl，无法下载更新：请先安装 curl"
ui_log "node $(node -v 2>/dev/null || echo '?')"

CODE=$(find_code) || true
if [ -z "${CODE:-}" ]; then
  ui_log "未找到 code / code-insiders / codium"
  fail "未找到 code 命令行工具：请在 VS Code 命令面板执行 \"Shell Command: Install 'code' command in PATH\"，然后重试"
fi
ui_log "code → $CODE"

# ------------------------------------------------------------- 下载最新源码
ui_status "下载最新源码…" busy
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"
run curl -fsSL "$TARBALL" -o "$ARCHIVE" || fail "源码下载失败（检查网络后重试）"
run tar xzf "$ARCHIVE" -C "$WORK_DIR" --strip-components=1 || fail "源码解压失败"
cd "$WORK_DIR"
ui_log "工作目录 → $WORK_DIR"

# ------------------------------------------------------------- 编译 + 打包
ui_status "安装依赖（npm install）…" busy
run npm install --no-audit --no-fund || fail "npm install 失败"

ui_status "编译（esbuild）…" busy
run npm run compile || fail "编译失败"

ui_status "打包 .vsix（vsce package）…" busy
run npx --yes vsce package || fail "打包失败"

VSIX=$(ls -t ./*.vsix 2>/dev/null | head -n1 || true)
if [ -z "$VSIX" ]; then
  fail "打包失败：未生成 .vsix"
fi
ui_log "已生成 $(basename "$VSIX")"

# ------------------------------------------------------------- 覆盖安装
ui_status "覆盖安装到 VS Code…" busy
run "$CODE" --install-extension "$VSIX" --force || fail "扩展安装失败"

ui_log "扩展 ID：${EXT_ID}"
ui_header "$TITLE" "更新完成 / Updated" "回到 VS Code 重载窗口（Ctrl+Shift+P → Reload Window）后生效"
ui_status "✅ 更新完成 / updated" ok
ui_finish
printf '\n'
