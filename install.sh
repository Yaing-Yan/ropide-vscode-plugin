#!/usr/bin/env bash
#
# RopIDE 本地安装脚本（Linux / macOS）
# 用法：  ./install.sh
# 作用：  编译 → 打包 .vsix → 安装到 VS Code（--force 覆盖）
# 装完后重新加载 VS Code 窗口，打开任意 .rop 文件即可使用。
#
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 检查 Node.js ..."
command -v node >/dev/null 2>&1 || { echo "❌ 未找到 node，请先安装 Node.js 18+"; exit 1; }

if [ ! -d node_modules ]; then
  echo "==> 安装依赖（npm install）..."
  npm install
fi

echo "==> 编译（esbuild）..."
npm run compile

echo "==> 打包 .vsix（vsce package）..."
npx vsce package

VSIX=$(ls -t ./*.vsix 2>/dev/null | head -n1)
if [ -z "$VSIX" ]; then
  echo "❌ 打包失败：未生成 .vsix"
  exit 1
fi
echo "==> 已生成 ${VSIX}"

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
    if [ -x "$p" ]; then CODE="$p"; break; fi
  done
fi

if [ -z "$CODE" ]; then
  echo "❌ 未找到 code 命令行工具。"
  echo "   请在 VS Code 里执行命令面板 → \"Shell Command: Install 'code' command in PATH\"，然后重跑本脚本。"
  exit 1
fi

echo "==> 安装扩展（$CODE --install-extension $VSIX --force）..."
"$CODE" --install-extension "$VSIX" --force

echo ""
echo "✅ 安装完成！"
echo "   重新加载 VS Code 窗口（Ctrl+Shift+P → Reload Window），"
echo "   然后打开任意 .rop 文件即可进入 RopIDE 编辑器。"
