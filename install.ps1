# RopIDE 本地安装脚本（Windows / PowerShell）
# 用法：  .\install.ps1
# 作用：  编译 -> 打包 .vsix -> 安装到 VS Code（--force 覆盖）
#
# 界面由 scripts\ui.ps1 提供：标题胶囊反色、居中偏上；下方固定 4 行日志区，
# 由下往上逐行变暗。非交互 / NO_COLOR / 终端过小时自动退化为普通逐行输出。
#
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# ---------------------------------------------------------------- 载入界面库
$uiLib = Join-Path $PSScriptRoot 'scripts\ui.ps1'
if (Test-Path $uiLib) { . $uiLib }

# 极简兜底：ui.ps1 缺失时保证脚本仍能跑完
if (-not (Get-Command Start-Ui -ErrorAction SilentlyContinue)) {
    function Initialize-Ui { param([string]$Title, [string]$Subtitle, [string]$Hint) }
    function Set-UiMenu { param([string[]]$Lines) }
    function Set-UiHeader { param([string]$Title, [string]$Subtitle, [string]$Hint) }
    function Start-Ui { }
    function Write-UiLog { param([string]$Text) Write-Host $Text }
    function Set-UiStatus { param([string]$Text, [string]$Kind) Write-Host $Text }
    function Show-UiPrompt { param([string]$Text) Write-Host -NoNewline $Text }
    function Stop-Ui { }
    function Invoke-UiStep {
        param([string]$FilePath, [string[]]$Arguments = @())
        Write-Host "==> $FilePath $($Arguments -join ' ')"
        & $FilePath @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
        if ($null -ne $LASTEXITCODE) { return [int]$LASTEXITCODE }
        return 0
    }
}

$script:Title = 'RopIDE for VS Code'

function Fail {
    param([string]$Message)
    Set-UiStatus "× $Message" -Kind err
    Stop-Ui
    Write-Host ''
    exit 1
}

# ------------------------------------------------------------------- 开始界面
Initialize-Ui -Title $script:Title -Subtitle '本地安装向导 · Windows / PowerShell' `
    -Hint '编译 esbuild → 打包 .vsix → 安装到 VS Code'
Start-Ui
Set-UiStatus '检查运行环境…' -Kind busy

# ------------------------------------------------------------------ 环境检查
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-UiLog '未在 PATH 中找到 node'
    Fail '未找到 Node.js，请先安装 Node.js 18+'
}
Write-UiLog "node $(node -v)"

# 定位 code 命令行工具
$code = Get-Command code -ErrorAction SilentlyContinue
if (-not $code) {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code-insiders.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $code = $c; break }
    }
}
if (-not $code) {
    Write-UiLog '未找到 code / code-insiders'
    Fail "未找到 code 命令：请在 VS Code 命令面板执行 Shell Command: Install 'code' command in PATH，然后重跑本脚本"
}
$codePath = if ($code -is [string]) { $code } else { $code.Source }
Write-UiLog "code → $codePath"

# ------------------------------------------------------------------- 依赖
if (-not (Test-Path node_modules)) {
    Set-UiStatus '安装依赖（npm install）…' -Kind busy
    if ((Invoke-UiStep -FilePath 'npm' -Arguments @('install')) -ne 0) { Fail 'npm install 失败' }
} else {
    Write-UiLog 'node_modules 已存在，跳过 npm install'
}

# ------------------------------------------------------------------- 编译
Set-UiStatus '编译（esbuild）…' -Kind busy
if ((Invoke-UiStep -FilePath 'npm' -Arguments @('run', 'compile')) -ne 0) { Fail '编译失败' }

# ------------------------------------------------------------------- 打包
Set-UiStatus '打包 .vsix（vsce package）…' -Kind busy
if ((Invoke-UiStep -FilePath 'npx' -Arguments @('--yes', 'vsce', 'package')) -ne 0) { Fail '打包失败' }

$vsix = Get-ChildItem -Filter *.vsix | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) { Fail '打包失败：未生成 .vsix' }
Write-UiLog "已生成 $($vsix.Name)"

# ------------------------------------------------------------------- 安装
Set-UiStatus '安装扩展到 VS Code…' -Kind busy
if ((Invoke-UiStep -FilePath $codePath -Arguments @('--install-extension', $vsix.FullName, '--force')) -ne 0) {
    Fail '扩展安装失败'
}

Write-UiLog "已安装 $($vsix.Name)；重载窗口：Ctrl+Shift+P → Reload Window"
Set-UiHeader -Title $script:Title -Subtitle '安装完成 / Installed' `
    -Hint '重载 VS Code 窗口后打开任意 .rop 文件即可使用'
Set-UiStatus '√ 安装完成 / done' -Kind ok
Stop-Ui
Write-Host ''
