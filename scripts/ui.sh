#!/usr/bin/env bash
# =============================================================================
#  RopIDE for VS Code — 终端界面库 / terminal UI helpers
# -----------------------------------------------------------------------------
#  画面结构 / layout:
#
#                 ▐  RopIDE for VS Code  ▌        <- 反色标题胶囊，水平居中
#                        副标题 / subtitle
#                    提示行（暗色，可省略）
#                      [1] 安装    [2] 卸载      <- 可选菜单区
#
#                 ──────────────────────────────
#                  │ 最旧的日志（最暗）
#                  │ ...
#                  │ ...
#                  │ 最新的日志（最亮）          <- 固定 4 行，由下往上渐暗
#                 ──────────────────────────────
#                  │ 当前状态 / 最终结果
#
#  用法 / usage:
#      . scripts/ui.sh
#      ui_init "标题" "副标题" "提示行"
#      ui_menu "  [1] 安装      [2] 卸载"
#      ui_begin
#      run npm install            # 命令输出实时滚动进日志区
#      ui_status "完成" ok
#
#  说明 / notes:
#    · 标题块位于屏幕中上部，整体水平居中（按显示宽度计算，中文按 2 列）。
#    · 不是 TTY（重定向 / CI）、设置了 NO_COLOR、TERM=dumb 或终端过小时，
#      自动退化为普通逐行输出，不会输出任何光标控制字符。
#    · 本文件被 install.sh（本地 source）与 simply-plugin.sh（下载后 source）
#      共用，请保持向后兼容：只新增函数，不要改已有函数签名。
# =============================================================================

UI_LOG_LINES=4          # 日志区行数（固定 4 行滚动）

# ---- 内部状态 ---------------------------------------------------------------
UI_TTY=0                # 1 = 启用全屏界面
UI_READY=0              # 1 = 已经 begin 过
UI_ROWS=24
UI_COLS=80
UI_WIDE=0               # 1 = 支持 256 色

UI_TITLE=""
UI_SUBTITLE=""
UI_HINT=""
UI_MENU1=""
UI_MENU2=""
UI_MENU3=""

UI_L1=""
UI_L2=""
UI_L3=""
UI_L4=""

UI_STATUS=""
UI_STATUS_KIND="busy"

UI_ROW_LOG=0
UI_ROW_STATUS=0
UI_ROW_END=0
UI_PANEL_X=1
UI_PANEL_W=68

UI_OUT=""
UI_TAB=$(printf '\t')
UI_CR=$(printf '\r')
UI_ESC=$(printf '\033')

# =============================================================================
#  底层工具
# =============================================================================

# 是否宽字符（码点为单位）
ui__is_wide() {
  local cp=$1
  if [ "$cp" -ge 4352 ] 2>/dev/null; then
    if { [ "$cp" -ge 4352 ] && [ "$cp" -le 4447 ]; } || \
       { [ "$cp" -ge 11904 ] && [ "$cp" -le 12350 ]; } || \
       { [ "$cp" -ge 12353 ] && [ "$cp" -le 13311 ]; } || \
       { [ "$cp" -ge 13312 ] && [ "$cp" -le 19903 ]; } || \
       { [ "$cp" -ge 19968 ] && [ "$cp" -le 40959 ]; } || \
       { [ "$cp" -ge 40960 ] && [ "$cp" -le 42191 ]; } || \
       { [ "$cp" -ge 44032 ] && [ "$cp" -le 55203 ]; } || \
       { [ "$cp" -ge 63744 ] && [ "$cp" -le 64255 ]; } || \
       { [ "$cp" -ge 65072 ] && [ "$cp" -le 65103 ]; } || \
       { [ "$cp" -ge 65280 ] && [ "$cp" -le 65376 ]; } || \
       { [ "$cp" -ge 65504 ] && [ "$cp" -le 65510 ]; } || \
       { [ "$cp" -ge 127744 ] && [ "$cp" -le 129791 ]; } || \
       { [ "$cp" -ge 131072 ] && [ "$cp" -le 262141 ]; }; then
      return 0
    fi
  fi
  return 1
}

# 字符串显示宽度 -> UI_OUT
ui__width_into() {
  local s="$1" i ch cp w=0
  for (( i = 0; i < ${#s}; i++ )); do
    ch=${s:i:1}
    if printf -v cp '%d' "'$ch" 2>/dev/null; then :; else cp=63; fi
    if ui__is_wide "$cp"; then w=$(( w + 2 )); else w=$(( w + 1 )); fi
  done
  UI_OUT=$w
}

# 截断到 max 个显示列（超长补 …）-> UI_OUT
ui__fit_into() {
  local s="$1" max="$2" i ch cp cw w=0 out=""
  s=${s//"$UI_CR"/}
  s=${s//"$UI_TAB"/'    '}
  if [ "$max" -le 0 ]; then UI_OUT=""; return 0; fi
  for (( i = 0; i < ${#s}; i++ )); do
    ch=${s:i:1}
    if printf -v cp '%d' "'$ch" 2>/dev/null; then :; else cp=63; fi
    if ui__is_wide "$cp"; then cw=2; else cw=1; fi
    # 预留 1 列给省略号，保证结果宽度不超过 max
    if [ $(( w + cw )) -gt $(( max - 1 )) ]; then UI_OUT="$out…"; return 0; fi
    out="$out$ch"
    w=$(( w + cw ))
  done
  UI_OUT="$out"
}

ui__at() { printf '%s[%d;%dH' "$UI_ESC" "$1" "$2"; }

# 居中输出（不换行）—— 超宽先按显示宽度截断，避免换行破坏布局
ui__center() {
  local w pad text
  ui__fit_into "$1" $(( UI_COLS - 4 ))
  text="$UI_OUT"
  ui__width_into "$text"; w=$UI_OUT
  pad=$(( ( UI_COLS - w ) / 2 ))
  if [ "$pad" -lt 0 ]; then pad=0; fi
  printf '%*s%s' "$pad" '' "$text"
}

ui__rule() { # <row> —— 在居中的面板宽度上画一条分隔线
  local row=$1 i=0 s=""
  while [ "$i" -lt "$UI_PANEL_W" ]; do
    s="$s─"
    i=$(( i + 1 ))
  done
  ui__at "$row" "$UI_PANEL_X"
  printf '%s%s%s' "$UI_C_ACCENT" "$s" "$UI_C_RESET"
}

ui__pill() {
  local w pad text
  ui__fit_into "$1" $(( UI_COLS - 10 ))
  text="$UI_OUT"
  ui__width_into "$text"; w=$UI_OUT
  pad=$(( ( UI_COLS - ( w + 6 ) ) / 2 ))
  if [ "$pad" -lt 0 ]; then pad=0; fi
  printf '%*s%s   %s   %s' "$pad" '' "$UI_C_PILL" "$text" "$UI_C_RESET"
}

ui__line_at() { # row, sgr, text
  ui__at "$1" "$UI_PANEL_X"
  printf '%s[K %s│%s %s%s%s' \
    "$UI_ESC" "$UI_C_GUTTER" "$UI_C_RESET" "$2" "$3" "$UI_C_RESET"
}

# 计算居中面板（框线 + 日志文字共用同一列宽，保证左边缘对齐）
ui__panel() {
  local w=$(( UI_COLS - 6 ))
  if [ "$w" -gt 68 ]; then w=68; fi
  if [ "$w" -lt 24 ]; then w=24; fi
  UI_PANEL_W=$w
  UI_PANEL_X=$(( ( UI_COLS - w ) / 2 + 1 ))
  if [ "$UI_PANEL_X" -lt 1 ]; then UI_PANEL_X=1; fi
  return 0
}

# ---- 颜色 -------------------------------------------------------------------
ui__colors() {
  local e="$UI_ESC"
  if [ "$UI_WIDE" = 1 ]; then
    UI_C_RESET="$e[0m"
    UI_C_PILL="$e[1;7m"
    UI_C_SUB="$e[38;5;250m"
    UI_C_HINT="$e[38;5;244m"
    UI_C_ACCENT="$e[38;5;68m"
    UI_C_GUTTER="$e[38;5;238m"
    UI_C_L1="$e[38;5;240m"
    UI_C_L2="$e[38;5;245m"
    UI_C_L3="$e[38;5;251m"
    UI_C_L4="$e[1;38;5;231m"
    UI_C_OK="$e[1;38;5;42m"
    UI_C_ERR="$e[1;38;5;203m"
    UI_C_BUSY="$e[38;5;222m"
  else
    UI_C_RESET="$e[0m"
    UI_C_PILL="$e[1;7m"
    UI_C_SUB="$e[1;97m"
    UI_C_HINT="$e[90m"
    UI_C_ACCENT="$e[36m"
    UI_C_GUTTER="$e[90m"
    UI_C_L1="$e[90m"
    UI_C_L2="$e[37m"
    UI_C_L3="$e[97m"
    UI_C_L4="$e[1;97m"
    UI_C_OK="$e[1;92m"
    UI_C_ERR="$e[1;91m"
    UI_C_BUSY="$e[33m"
  fi
}

ui__detect() {
  UI_TTY=0
  UI_WIDE=0
  ui__refresh_size
  [ -t 1 ] || return 0
  if [ -n "${NO_COLOR:-}" ]; then return 0; fi
  case "${TERM:-}" in ""|dumb) return 0 ;; esac
  # 太小的终端放不下整套界面，退回普通输出
  [ "$UI_ROWS" -ge 20 ] || return 0
  [ "$UI_COLS" -ge 46 ] || return 0
  local colors=8
  if command -v tput >/dev/null 2>&1; then
    colors=$(tput colors 2>/dev/null) || colors=8
  fi
  case "$colors" in ''|*[!0-9]*) colors=8 ;; esac
  if [ "$colors" -ge 256 ]; then UI_WIDE=1; fi
  UI_TTY=1
  ui__colors
  return 0
}

ui__refresh_size() {
  local sz=""
  sz=$(stty size 2>/dev/null < /dev/tty) || sz=""
  if [ -n "$sz" ]; then
    UI_ROWS=${sz%% *}
    UI_COLS=${sz##* }
  else
    UI_ROWS=${LINES:-24}
    UI_COLS=${COLUMNS:-80}
  fi
  case "$UI_ROWS" in ''|*[!0-9]*) UI_ROWS=24 ;; esac
  case "$UI_COLS" in ''|*[!0-9]*) UI_COLS=80 ;; esac
  return 0
}

# =============================================================================
#  绘制
# =============================================================================

ui__draw() {
  [ "$UI_TTY" = 1 ] || return 0
  ui__refresh_size
  ui__panel

  local rows=$UI_ROWS menu=0
  if [ -n "$UI_MENU1" ]; then menu=$(( menu + 1 )); fi
  if [ -n "$UI_MENU2" ]; then menu=$(( menu + 1 )); fi
  if [ -n "$UI_MENU3" ]; then menu=$(( menu + 1 )); fi

  # pill(1) 空(1) subtitle(1) hint(1) [menu] 空(1) 上框(1) 日志(4) 下框(1) 状态(1)
  local block=$(( 11 + menu ))
  local top=$(( rows * 28 / 100 ))
  if [ "$top" -lt 1 ]; then top=1; fi
  if [ $(( top + block )) -gt $(( rows - 1 )) ]; then
    top=$(( rows - 1 - block ))
    if [ "$top" -lt 1 ]; then top=1; fi
  fi

  printf '%s[2J%s[H' "$UI_ESC" "$UI_ESC"

  local y=$top
  ui__at "$y" 1; ui__pill "$UI_TITLE"; y=$(( y + 1 ))
  y=$(( y + 1 ))
  if [ -n "$UI_SUBTITLE" ]; then
    ui__at "$y" 1; printf '%s' "$UI_C_SUB"; ui__center "$UI_SUBTITLE"; printf '%s' "$UI_C_RESET"
  fi
  y=$(( y + 1 ))
  if [ -n "$UI_HINT" ]; then
    ui__at "$y" 1; printf '%s' "$UI_C_HINT"; ui__center "$UI_HINT"; printf '%s' "$UI_C_RESET"
  fi
  y=$(( y + 1 ))

  if [ -n "$UI_MENU1" ]; then ui__at "$y" 1; ui__center "$UI_MENU1"; y=$(( y + 1 )); fi
  if [ -n "$UI_MENU2" ]; then ui__at "$y" 1; ui__center "$UI_MENU2"; y=$(( y + 1 )); fi
  if [ -n "$UI_MENU3" ]; then ui__at "$y" 1; ui__center "$UI_MENU3"; y=$(( y + 1 )); fi

  y=$(( y + 1 ))
  ui__rule "$y"
  UI_ROW_LOG=$(( y + 1 ))
  ui__rule $(( UI_ROW_LOG + UI_LOG_LINES ))
  UI_ROW_STATUS=$(( UI_ROW_LOG + UI_LOG_LINES + 1 ))
  UI_ROW_END=$(( UI_ROW_STATUS ))

  ui__render_log
  ui__render_status
  return 0
}

ui__render_log() {
  [ "$UI_TTY" = 1 ] && [ "$UI_READY" = 1 ] || return 0
  local r=$UI_ROW_LOG
  ui__line_at "$r" "$UI_C_L1" "$UI_L1"; r=$(( r + 1 ))
  ui__line_at "$r" "$UI_C_L2" "$UI_L2"; r=$(( r + 1 ))
  ui__line_at "$r" "$UI_C_L3" "$UI_L3"; r=$(( r + 1 ))
  ui__line_at "$r" "$UI_C_L4" "$UI_L4"
  ui__at "$UI_ROW_STATUS" 1
  return 0
}

ui__render_status() {
  [ "$UI_TTY" = 1 ] && [ "$UI_READY" = 1 ] || return 0
  local color="$UI_C_BUSY" text
  case "$UI_STATUS_KIND" in
    ok)  color="$UI_C_OK" ;;
    err) color="$UI_C_ERR" ;;
  esac
  ui__fit_into "$UI_STATUS" $(( UI_PANEL_W - 4 ))
  text="$UI_OUT"
  ui__at "$UI_ROW_STATUS" "$UI_PANEL_X"
  printf '%s[K %s│%s %s%s%s' \
    "$UI_ESC" "$UI_C_GUTTER" "$UI_C_RESET" "$color" "$text" "$UI_C_RESET"
  return 0
}

# =============================================================================
#  对外 API
# =============================================================================

# ui_init <标题> [副标题] [提示行]
ui_init() {
  UI_TITLE=${1:-}
  UI_SUBTITLE=${2:-}
  UI_HINT=${3:-}
  return 0
}

# ui_menu [第一行] [第二行] [第三行]   —— 传空则收起菜单
ui_menu() {
  UI_MENU1=${1:-}
  UI_MENU2=${2:-}
  UI_MENU3=${3:-}
  if [ "$UI_READY" = 1 ]; then ui__draw; fi
  return 0
}

# ui_header <标题> [副标题] [提示行]
ui_header() {
  UI_TITLE=${1:-$UI_TITLE}
  UI_SUBTITLE=${2:-}
  UI_HINT=${3:-}
  if [ "$UI_READY" = 1 ]; then ui__draw; fi
  return 0
}

# ui_begin —— 清屏并进入全屏界面；非 TTY 时退化为普通输出
ui_begin() {
  ui__detect
  if [ "$UI_TTY" != 1 ]; then
    UI_READY=1
    printf '%s\n' "$UI_TITLE"
    if [ -n "$UI_SUBTITLE" ]; then printf '%s\n' "$UI_SUBTITLE"; fi
    if [ -n "$UI_HINT" ]; then printf '%s\n' "$UI_HINT"; fi
    if [ -n "$UI_STATUS" ]; then printf '%s\n' "$UI_STATUS"; fi
    printf '\n'
    return 0
  fi
  trap 'ui_finish' EXIT
  trap 'ui_finish; exit 130' INT
  trap 'ui_finish; exit 143' TERM
  UI_READY=1
  printf '%s[?25l' "$UI_ESC"          # 隐藏光标
  ui__draw
  return 0
}

# ui_log <一行文本> —— 追加到日志区；界面未启用时直接打印
ui_log() {
  local text="${1-}"
  if [ "$UI_TTY" != 1 ] || [ "$UI_READY" != 1 ]; then
    printf '%s\n' "$text"
    return 0
  fi
  UI_L1="$UI_L2"
  UI_L2="$UI_L3"
  UI_L3="$UI_L4"
  ui__fit_into "$text" $(( UI_PANEL_W - 4 ))
  UI_L4="$UI_OUT"
  ui__render_log
  return 0
}

# ui_status <文本> [busy|ok|err]
ui_status() {
  UI_STATUS=${1:-}
  UI_STATUS_KIND=${2:-busy}
  if [ "$UI_TTY" = 1 ] && [ "$UI_READY" = 1 ]; then
    ui__render_status
  else
    printf '%s\n' "$UI_STATUS"
  fi
  return 0
}

# ui_prompt <文本> —— 画在状态行且把光标留在文字后面，供 read 使用
ui_prompt() {
  UI_STATUS=${1:-}
  UI_STATUS_KIND="busy"
  if [ "$UI_TTY" = 1 ] && [ "$UI_READY" = 1 ]; then
    ui__render_status
  else
    printf '%s' "$UI_STATUS"
  fi
  return 0
}

# ui_finish —— 还原光标并把后续输出放到界面下方（可重复调用）
ui_finish() {
  [ "$UI_TTY" = 1 ] && [ "$UI_READY" = 1 ] || { UI_READY=0; return 0; }
  UI_READY=0
  trap - EXIT INT TERM
  printf '%s[0m%s[?25h' "$UI_ESC" "$UI_ESC"
  printf '%s[%d;1H\n' "$UI_ESC" $(( UI_ROW_END + 1 ))
  return 0
}

# run <命令> [参数...] —— 执行命令并把输出实时喂给日志区；返回命令退出码
run() {
  if [ "$UI_TTY" != 1 ] || [ "$UI_READY" != 1 ]; then
    printf '==> %s\n' "$*"
    "$@"
    return $?
  fi
  ui_log "\$ $*"
  local rcfile="${TMPDIR:-/tmp}/.ropide-ui-rc.$$"
  : >"$rcfile" 2>/dev/null || rcfile="/tmp/.ropide-ui-rc.$$"
  # 关掉子进程的彩色输出，避免 ANSI 序列打乱日志区布局
  while IFS= read -r line || [ -n "$line" ]; do
    ui_log "$line"
  done < <(
    set +e
    NO_COLOR=1 FORCE_COLOR=0 CLICOLOR=0 npm_config_color=false "$@" 2>&1
    printf '%s' "$?" >"$rcfile"
  )
  local rc
  rc=$(cat "$rcfile" 2>/dev/null) || rc=0
  rm -f "$rcfile" 2>/dev/null || true
  return "${rc:-0}"
}

# ui_demo —— 独立演示：bash scripts/ui.sh
ui_demo() {
  ui_init "RopIDE for VS Code" "终端界面演示 / terminal UI demo" \
    "scripts/ui.sh —— install.sh 与 simply-plugin.sh 共用"
  ui_menu "     [1] 安装 / Install          [2] 卸载 / Uninstall" "     [q] 退出 / Quit"
  ui_begin
  ui_status "请选择 [1/2/q] ▸ " busy
  sleep 1
  ui_menu ""
  ui_header "RopIDE for VS Code" "演示：日志区固定 4 行，由下往上越来越暗" \
    "run <命令> 会把命令输出实时滚动到日志区"
  ui_status "正在演示 / running demo…" busy
  run bash -c 'for i in 1 2 3 4 5 6 7 8 9 10 11 12; do echo "演示日志 demo log line $i"; sleep 0.12; done'
  ui_status "✅ 演示完成 / demo finished" ok
  printf '\n'
}

# 直接执行本文件时进入演示模式
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  ui_demo
fi
