#!/usr/bin/env bash
#
# RopIDE for VS Code — 简易安装 / 卸载（免 git clone）
#
# 用法（一行）：
#   curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.sh | bash
#
# 运行后会显示一个综合处理菜单，可选择「安装」或「卸载」。
set -eu

REPO="Yaing-Yan/ropide-vscode-plugin"
BRANCH="main"
TARBALL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"
WORK_DIR="${TMPDIR:-/tmp}/ropide-vscode-plugin-src"
EXT_ID="yaing-yan.ropide-vscode-plugin"

echo "=============================================="
echo "  RopIDE for VS Code — 简易安装 / 卸载"
echo "=============================================="
echo "  [1] 安装"
echo "  [2] 卸载"
echo "  [q] 退出"
printf "请选择 [1/2/q]: "
read -r choice

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

case "$choice" in
  1)
    command -v node >/dev/null 2>&1 || { echo "❌ 未找到 node，请先安装 Node.js 18+"; exit 1; }
    if ! CODE=$(find_code); then
      echo "❌ 未找到 code 命令。请在 VS Code 命令面板执行 \"Shell Command: Install 'code' command in PATH\"。"
      exit 1
    fi
    echo "==> 下载源码（免 git clone）..."
    rm -rf "$WORK_DIR"
    mkdir -p "$WORK_DIR"
    curl -sSL "$TARBALL" | tar xz -C "$WORK_DIR" --strip-components=1
    cd "$WORK_DIR"
    echo "==> 安装依赖..."
    npm install --no-audit --no-fund
    echo "==> 编译 + 打包..."
    npm run compile
    npx vsce package
    VSIX=$(ls -t ./*.vsix 2>/dev/null | head -n1)
    [ -n "$VSIX" ] || { echo "❌ 打包失败：未生成 .vsix"; exit 1; }
    echo "==> 安装扩展..."
    "$CODE" --install-extension "$VSIX" --force
    echo ""
    echo "✅ 安装完成！重载 VS Code（Ctrl+Shift+P → Reload Window）后打开 .rop 文件即可。"
    ;;
  2)
    if ! CODE=$(find_code); then
      echo "❌ 未找到 code 命令。"
      exit 1
    fi
    echo "==> 卸载扩展 ${EXT_ID} ..."
    "$CODE" --uninstall-extension "$EXT_ID" || true
    echo ""
    echo "✅ 卸载完成！重载 VS Code 后生效。"
    ;;
  *)
    echo "已退出。"
    ;;
esac
