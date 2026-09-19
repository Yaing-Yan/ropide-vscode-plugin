#!/usr/bin/env bash
#
# RopIDE 卸载脚本（Linux / macOS）
# 用法：  ./uninstall.sh
#
# 界面由 scripts/ui.sh 提供（与 install.sh 一致）。
#
set -euo pipefail

SELF_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SELF_DIR"

UI_LIB="$SELF_DIR/scripts/ui.sh"
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

TITLE="RopIDE for VS Code"

fail() {
  ui_status "✗ ${1}" err
  ui_finish
  printf '\n'
  exit 1
}

# 扩展 ID = publisher.name（优先读 package.json，读不到则用内置值）
EXT_ID=""
if command -v node >/dev/null 2>&1; then
  EXT_ID=$(node -e "const p=require('./package.json'); process.stdout.write(p.publisher + '.' + p.name)" 2>/dev/null | head -n1 || true)
fi
case "$EXT_ID" in
  *[!A-Za-z0-9._-]*|.*|*.) EXT_ID="yaing-yan.ropide-vscode-plugin" ;;
  *.*) : ;;
  *) EXT_ID="yaing-yan.ropide-vscode-plugin" ;;
esac

ui_init "$TITLE" "卸载向导 · Linux / macOS" "移除已安装的扩展 ${EXT_ID}"
ui_begin
ui_status "查找 code 命令行工具…" busy

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

ui_status "卸载扩展 ${EXT_ID}…" busy
run "$CODE" --uninstall-extension "$EXT_ID" || ui_log "卸载命令返回非零（可能扩展未安装，继续）"

ui_header "$TITLE" "卸载完成 / Uninstalled" "重载 VS Code 窗口后生效"
ui_status "✅ 卸载完成 / done" ok
ui_finish
printf '\n'
