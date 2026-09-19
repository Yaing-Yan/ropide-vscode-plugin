#!/usr/bin/env bash
# =============================================================================
#  RopIDE for VS Code — 一键发布脚本 / one-command publish script
#
#  用法 / Usage:
#    VSCE_PAT=xxxxx ./publish.sh              # 发布到 VS Code 官方商城
#    OVSX_PAT=xxxxx ./publish.sh --ovsx       # 发布到 Open VSX（VSCodium 等）
#    VSCE_PAT=xxxxx OVSX_PAT=yyyyy ./publish.sh --both
#    ./publish.sh --package                   # 只打包 .vsix，不发布
#    ./publish.sh --verify                    # 只校验 PAT 是否有效
#
#  环境变量 / Env:
#    VSCE_PAT   VS Code Marketplace Personal Access Token (Marketplace > Manage)
#    OVSX_PAT   Open VSX access token (https://open-vsx.org/user-settings/tokens)
#    BUMP       major | minor | patch | none  (默认 none)
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

MODE="vsce"
BUMP="${BUMP:-none}"
for arg in "$@"; do
  case "$arg" in
    --ovsx)    MODE="ovsx" ;;
    --both)    MODE="both" ;;
    --vsce)    MODE="vsce" ;;
    --package) MODE="package" ;;
    --verify)  MODE="verify" ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "未知参数 / unknown arg: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- sanity checks
PUBLISHER="$(node -p "require('./package.json').publisher")"
NAME="$(node -p "require('./package.json').name")"
VERSION="$(node -p "require('./package.json').version")"
ID="${PUBLISHER}.${NAME}"

say "扩展 / extension : ${ID}@${VERSION}"

[ -f icon.png ]  || die "缺少 icon.png / missing icon.png"
[ -f README.md ] || die "缺少 README.md / missing README.md"
[ -f LICENSE ]   || die "缺少 LICENSE / missing LICENSE"

# vsce 要求 publisher 字段存在且非占位符
case "$PUBLISHER" in
  ""|"undefined"|"publisher"|"your-publisher-name")
    die "package.json 的 publisher 字段无效：'$PUBLISHER'" ;;
esac

# ------------------------------------------------------------------- build step
say "编译 / compiling …"
npm run compile >/dev/null

say "打包 / packaging .vsix …"
rm -f ./*.vsix
VSIX="$(npx vsce package --out "${NAME}-${VERSION}.vsix" 2>&1 | tee /dev/stderr | grep -oE '^[^ ]+\.vsix$' | tail -1 || true)"
# vsce 输出里文件名可能带路径，兜底直接找
[ -n "${VSIX:-}" ] && [ -f "$VSIX" ] || VSIX="${NAME}-${VERSION}.vsix"
[ -f "$VSIX" ] || die "打包失败 / packaging failed"
say "已生成 / built : $VSIX ($(du -h "$VSIX" | cut -f1))"

[ "$MODE" = "package" ] && { say "仅打包模式，结束 / package-only, done."; exit 0; }

# --------------------------------------------------------------------- verify
if [ "$MODE" = "verify" ]; then
  [ -n "${VSCE_PAT:-}" ] || die "未设置 VSCE_PAT"
  say "校验 PAT / verifying PAT …"
  npx vsce verify-pat "$PUBLISHER" -p "$VSCE_PAT"
  say "PAT 有效 / PAT is valid ✅"
  exit 0
fi

# -------------------------------------------------------------------- publish
publish_vsce() {
  [ -n "${VSCE_PAT:-}" ] || die "未设置 VSCE_PAT（VS Code Marketplace Token）"
  say "→ VS Code Marketplace : ${ID}"
  local extra=()
  [ "$BUMP" != "none" ] && extra+=("$BUMP")
  npx vsce publish -p "$VSCE_PAT" "${extra[@]}" --packagePath "$VSIX"
  say "✅ VS Code Marketplace 发布成功"
  echo "   https://marketplace.visualstudio.com/items?itemName=${ID}"
}

publish_ovsx() {
  [ -n "${OVSX_PAT:-}" ] || die "未设置 OVSX_PAT（Open VSX Token）"
  say "→ Open VSX : ${ID}"
  npx --yes ovsx publish "$VSIX" -p "$OVSX_PAT"
  say "✅ Open VSX 发布成功"
  echo "   https://open-vsx.org/extension/${PUBLISHER}/${NAME}"
}

case "$MODE" in
  vsce) publish_vsce ;;
  ovsx) publish_ovsx ;;
  both) publish_vsce; publish_ovsx ;;
esac

say "全部完成 / all done 🎉"
