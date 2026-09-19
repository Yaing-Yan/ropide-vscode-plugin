#!/usr/bin/env bash
#
# RopIDE for VS Code — 简易安装 / 卸载（免 git clone）
#
# 推荐用法（先下载到文件再执行，避免管道占用 stdin）：
#   curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.sh -o /tmp/simply-plugin.sh && bash /tmp/simply-plugin.sh
#
# 或直接管道（脚本会从 /dev/tty 读取选择）：
#   curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.sh | bash
#
# 界面由 scripts/ui.sh 提供（运行时按需下载）：
#   标题胶囊反色居中偏上，下方固定 4 行日志区，由下往上逐行变暗。
#   下载失败 / 非 TTY / NO_COLOR / 终端过小时自动退化为普通逐行输出。
#
set -eu

REPO="Yaing-Yan/ropide-vscode-plugin"
BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
TARBALL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"
WORK_DIR="${TMPDIR:-/tmp}/ropide-vscode-plugin-src"
ARCHIVE="${TMPDIR:-/tmp}/ropide-vscode-plugin.tar.gz"
EXT_ID="yaing-yan.ropide-vscode-plugin"

# ---------------------------------------------------------------- 载入界面库
UI_LIB="${TMPDIR:-/tmp}/ropide-ui.sh"
if curl -fsSL --max-time 20 "$RAW/scripts/ui.sh" -o "$UI_LIB" 2>/dev/null && [ -s "$UI_LIB" ]; then
  # shellcheck source=scripts/ui.sh
  . "$UI_LIB" || true
fi
rm -f "$UI_LIB" 2>/dev/null || true

# 极简兜底：界面库不可用时保证功能完整
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
    "$HOME/.local/bin/code" \
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"; do
    if [ -x "$p" ]; then
      printf '%s\n' "$p"
      return 0
    fi
  done
  return 1
}

# ------------------------------------------------------------------- 选择菜单
ui_init "$TITLE" "简易安装 / 卸载 · 免 git clone" \
  "从 GitHub 拉取源码 → 编译 → 打包 → 安装到 VS Code"
ui_menu "      [1] 安装 / Install          [2] 卸载 / Uninstall" \
  "      [q] 退出 / Quit"
ui_begin
ui_prompt "请选择 [1/2/q] ▸ "
read -r choice < /dev/tty 2>/dev/null || read -r choice || true
choice=${choice:-q}
ui_menu ""

case "$choice" in
  1)
    ui_header "$TITLE" "正在安装 / Installing" \
      "下载源码 → 安装依赖 → 编译打包 → 安装扩展"

    command -v node >/dev/null 2>&1 || fail "未找到 Node.js，请先安装 Node.js 18+"
    command -v curl >/dev/null 2>&1 || fail "未找到 curl，请先安装 curl"
    ui_log "node $(node -v 2>/dev/null || echo '?')"

    CODE=$(find_code) || true
    [ -n "${CODE:-}" ] || fail "未找到 code 命令：请在 VS Code 命令面板执行 \"Shell Command: Install 'code' command in PATH\""
    ui_log "code → $CODE"

    ui_status "下载源码（免 git clone）…" busy
    run curl -fsSL "$TARBALL" -o "$ARCHIVE" || fail "源码下载失败"
    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"
    run tar xzf "$ARCHIVE" -C "$WORK_DIR" --strip-components=1 || fail "源码解压失败"
    cd "$WORK_DIR"
    ui_log "工作目录 → $WORK_DIR"

    ui_status "安装依赖（npm install）…" busy
    run npm install --no-audit --no-fund || fail "npm install 失败"

    ui_status "编译 + 打包…" busy
    run npm run compile || fail "编译失败"
    run npx --yes vsce package || fail "打包失败"

    VSIX=$(ls -t ./*.vsix 2>/dev/null | head -n1 || true)
    [ -n "$VSIX" ] || fail "打包失败：未生成 .vsix"
    ui_log "已生成 $(basename "$VSIX")"

    ui_status "安装扩展…" busy
    run "$CODE" --install-extension "$VSIX" --force || fail "扩展安装失败"

    ui_log "已安装 $(basename "$VSIX")；重载窗口：Ctrl+Shift+P → Reload Window"
    ui_header "$TITLE" "安装完成 / Installed" \
      "重载 VS Code 窗口后打开任意 .rop 文件即可使用"
    ui_status "✅ 安装完成 / done" ok
    ui_finish
    printf '\n'
    ;;
  2)
    ui_header "$TITLE" "正在卸载 / Uninstalling" "移除已安装的 RopIDE 扩展"

    CODE=$(find_code) || true
    [ -n "${CODE:-}" ] || fail "未找到 code 命令"
    ui_log "code → $CODE"

    ui_status "卸载扩展 ${EXT_ID}…" busy
    run "$CODE" --uninstall-extension "$EXT_ID" || true

    ui_header "$TITLE" "卸载完成 / Uninstalled" "重载 VS Code 窗口后生效"
    ui_status "✅ 卸载完成 / done" ok
    ui_finish
    printf '\n'
    ;;
  *)
    ui_status "已退出 / bye" ok
    ui_finish
    printf '\n'
    ;;
esac
