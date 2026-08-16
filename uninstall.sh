#!/usr/bin/env bash
#
# RopIDE 卸载脚本（Linux / macOS）
# 用法：  ./uninstall.sh
#
set -euo pipefail
cd "$(dirname "$0")"

# 扩展 ID = publisher.name
EXT_ID=$(node -e "const p=require('./package.json'); process.stdout.write(p.publisher + '.' + p.name)" 2>/dev/null || echo "yaing-yan.ropide-vscode-plugin")

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

echo "==> 卸载扩展（$CODE --uninstall-extension $EXT_ID）..."
"$CODE" --uninstall-extension "$EXT_ID" || true

echo ""
echo "✅ 卸载完成。重新加载 VS Code 窗口（Ctrl+Shift+P → Reload Window）后生效。"
