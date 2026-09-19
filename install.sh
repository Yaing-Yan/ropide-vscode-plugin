#!/usr/bin/env bash
#
# RopIDE 本地安装脚本（Linux / macOS）
# 用法：  ./install.sh
# 作用：  编译 → 打包 .vsix → 安装到 VS Code（--force 覆盖）
# 装完后重新加载 VS Code 窗口，打开任意 .rop 文件即可使用。
#
# 界面由 scripts/ui.sh 提供：标题居中偏上（反色胶囊），下方固定 4 行日志区，
# 由下往上逐行变暗。非 TTY / NO_COLOR / 终端过小时自动退化为普通逐行输出。
#
set -euo pipefail

SELF_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SELF_DIR"

# ---------------------------------------------------------------- 载入界面库
UI_LIB="$SELF_DIR/scripts/ui.sh"
# shellcheck source=scripts/ui.sh
[ -f "$UI_LIB" ] && . "$UI_LIB"

# 极简兜底：ui.sh 缺失时保证脚本仍能正常跑完
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

TITLE="RopIDE for VS Code"

fail() {
  ui_status "✗ ${1}" err
  ui_finish
  printf '\n'
  exit 1
}

# ------------------------------------------------------------------- 开始界面
ui_init "$TITLE" "本地安装向导 · Linux / macOS" \
  "编译 esbuild → 打包 .vsix → 安装到 VS Code"
ui_begin
ui_status "检查运行环境…" busy

# ------------------------------------------------------------------ 环境检查
if ! command -v node >/dev/null 2>&1; then
  ui_log "未在 PATH 中找到 node"
  fail "未找到 Node.js，请先安装 Node.js 18+"
fi
ui_log "node $(node -v 2>/dev/null || echo '?')"

# 定位 code 命令行工具
CODE=""
for c in code code-insiders codium; do
  if command -v "$c" >/dev/null 2>&1; then
    CODE="$c"
    break
  fi
done
if [ -z "$CODE" ]; then
  for p in \
    /usr/share/code/bin/code \
    /opt/vscode/bin/code \
    /snap/bin/code \
    "$HOME/.local/bin/code" \
    "/mnt/c/Program Files/Microsoft VS Code/bin/code" \
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; do
    if [ -x "$p" ]; then
      CODE="$p"
      break
    fi
  done
fi
if [ -z "$CODE" ]; then
  ui_log "未找到 code / code-insiders / codium"
  fail "未找到 code 命令行工具：请在 VS Code 命令面板执行 \"Shell Command: Install 'code' command in PATH\"，然后重跑本脚本"
fi
ui_log "code → $CODE"

# ------------------------------------------------------------------- 依赖
if [ ! -d node_modules ]; then
  ui_status "安装依赖（npm install）…" busy
  run npm install || fail "npm install 失败"
else
  ui_log "node_modules 已存在，跳过 npm install"
fi

# ------------------------------------------------------------------- 编译
ui_status "编译（esbuild）…" busy
run npm run compile || fail "编译失败"

# ------------------------------------------------------------------- 打包
ui_status "打包 .vsix（vsce package）…" busy
run npx --yes vsce package || fail "打包失败"

VSIX=$(ls -t ./*.vsix 2>/dev/null | head -n1 || true)
if [ -z "$VSIX" ]; then
  fail "打包失败：未生成 .vsix"
fi
ui_log "已生成 $(basename "$VSIX")"

# ------------------------------------------------------------------- 安装
ui_status "安装扩展到 VS Code…" busy
run "$CODE" --install-extension "$VSIX" --force || fail "扩展安装失败"

ui_log "已安装 $(basename "$VSIX")；重载窗口：Ctrl+Shift+P → Reload Window"
ui_header "$TITLE" "安装完成 / Installed" \
  "重载 VS Code 窗口后打开任意 .rop 文件即可使用"
ui_status "✅ 安装完成 / done" ok
ui_finish
printf '\n'
