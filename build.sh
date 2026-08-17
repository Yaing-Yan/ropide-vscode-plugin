#!/usr/bin/env bash
#
# RopIDE for VS Code — 跨平台打包脚本
#
# 输出: ropide-vscode-plugin-<yyyymmdd>.vsix
#
# 该 .vsix 为「全平台通用」：
#   - 宿主代码为纯 TypeScript/JavaScript（仅用 vscode API + fetch + Node 内置模块）
#   - 无 child_process、无原生模块、无平台二进制（.exe/.dll/.so 一律不打包）
#   - 不指定 vsce 的 --target，即为平台无关安装包
# 因此 Windows / macOS / Linux（x86 或 ARM），只要该平台能运行 VS Code，
# 均可安装并使用其中全部功能。
#
set -euo pipefail
cd "$(dirname "$0")"

DATE=$(date +%Y%m%d)
OUT="ropide-vscode-plugin-${DATE}.vsix"

echo "==> 检查 Node.js ..."
command -v node >/dev/null 2>&1 || { echo "❌ 未找到 node，请先安装 Node.js 18+"; exit 1; }

if [ ! -d node_modules ]; then
  echo "==> 安装依赖 ..."
  npm install
fi

echo "==> 编译（esbuild，纯 JS 产物，无平台相关二进制）..."
npm run compile

echo "==> 打包 ${OUT}（不指定 --target = 全平台通用）..."
npx vsce package --out "$OUT"

echo ""
echo "✅ 已生成 ${OUT}"
echo "   该 .vsix 全平台通用：Windows / macOS / Linux（x86 / ARM），"
echo "   只要该平台能运行 VS Code 即可安装并使用全部功能。"
