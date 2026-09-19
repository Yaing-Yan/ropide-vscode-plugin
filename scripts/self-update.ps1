<#
  RopIDE for VS Code — 自更新脚本（由插件内的「立即更新」按钮触发）

  用法：  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\self-update.ps1

  流程：  下载 GitHub main 最新源码 -> npm install -> 编译 -> 打包 .vsix -> 覆盖安装
  界面复用 scripts\ui.ps1（与 install.ps1 同一套：反色标题胶囊 + 4 行渐变日志）。
  脚本只在临时目录里工作，安装完成后回 VS Code 重载窗口即可生效。

  注意：本文件必须保存为「UTF-8 with BOM」，否则 Windows PowerShell 5.1 会乱码。
#>

$ErrorActionPreference = 'Stop'
$SELF_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------------------------------------------------------------- 载入界面库
$uiLib = Join-Path $SELF_DIR 'ui.ps1'
if (Test-Path $uiLib) { . $uiLib }

if (-not (Get-Command Start-Ui -ErrorAction SilentlyContinue)) {
    function Initialize-Ui { param([string]$Title, [string]$Subtitle, [string]$Hint) }
    function Set-UiHeader { param([string]$Title, [string]$Subtitle, [string]$Hint) }
    function Start-Ui { }
    function Write-UiLog { param([string]$Text) Write-Host $Text }
    function Set-UiStatus { param([string]$Text, [string]$Kind) Write-Host $Text }
    function Stop-Ui { }
    function Invoke-UiStep {
        param([string]$FilePath, [string[]]$Arguments = @())
        Write-Host "==> $FilePath $($Arguments -join ' ')"
        & $FilePath @Arguments 2>&1 | ForEach-Object { Write-Host $_ }
        if ($null -ne $LASTEXITCODE) { return [int]$LASTEXITCODE }
        return 0
    }
}

$REPO    = 'Yaing-Yan/ropide-vscode-plugin'
$BRANCH  = 'main'
$TARBALL = "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH"
# %TEMP% 在 Windows 上总是存在，但仍用 GetTempPath() 兜底
$TmpRoot = if ($env:TEMP) { $env:TEMP } elseif ($env:TMP) { $env:TMP } else { [System.IO.Path]::GetTempPath() }
$WORK    = Join-Path $TmpRoot 'ropide-vscode-plugin-update'
$ARCHIVE = Join-Path $TmpRoot 'ropide-vscode-plugin-update.tar.gz'
$EXT_ID  = 'yaing-yan.ropide-vscode-plugin'
$Title   = 'RopIDE for VS Code'

function Fail {
    param([string]$Message)
    Set-UiStatus "× $Message" -Kind err
    Stop-Ui
    Write-Host ''
    exit 1
}

function Find-Code {
    $cmd = Get-Command code -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code-insiders.cmd",
        "$env:ProgramFiles\Microsoft VS Code\bin\code.cmd"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

# ------------------------------------------------------------------- 界面
Initialize-Ui -Title $Title -Subtitle '正在更新 / Updating' `
    -Hint '下载最新源码 → 编译打包 → 覆盖安装，完成后重载窗口即可'
Start-Ui
Set-UiStatus '检查运行环境…' -Kind busy

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail '未找到 Node.js，无法本地编译：请先安装 Node.js 18+'
}
Write-UiLog "node $(node -v)"

if (-not (Get-Command curl -ErrorAction SilentlyContinue)) {
    Fail '未找到 curl，无法下载更新：Windows 10+ 自带 curl.exe'
}

$codePath = Find-Code
if (-not $codePath) {
    Write-UiLog '未找到 code / code-insiders'
    Fail "未找到 code 命令：请在 VS Code 命令面板执行 Shell Command: Install 'code' command in PATH，然后重试"
}
Write-UiLog "code → $codePath"

# ------------------------------------------------------------- 下载最新源码
Set-UiStatus '下载最新源码…' -Kind busy
if (Test-Path $WORK) { Remove-Item -Recurse -Force $WORK }
New-Item -ItemType Directory -Path $WORK -Force | Out-Null
if ((Invoke-UiStep -FilePath 'curl' -Arguments @('-fsSL', $TARBALL, '-o', $ARCHIVE)) -ne 0) {
    Fail '源码下载失败（检查网络后重试）'
}
if ((Invoke-UiStep -FilePath 'tar' -Arguments @('-xzf', $ARCHIVE, '-C', $WORK, '--strip-components=1')) -ne 0) {
    Fail '源码解压失败'
}
Set-Location $WORK
Write-UiLog "工作目录 → $WORK"

# ------------------------------------------------------------- 编译 + 打包
Set-UiStatus '安装依赖（npm install）…' -Kind busy
if ((Invoke-UiStep -FilePath 'npm' -Arguments @('install', '--no-audit', '--no-fund')) -ne 0) { Fail 'npm install 失败' }

Set-UiStatus '编译（esbuild）…' -Kind busy
if ((Invoke-UiStep -FilePath 'npm' -Arguments @('run', 'compile')) -ne 0) { Fail '编译失败' }

Set-UiStatus '打包 .vsix（vsce package）…' -Kind busy
if ((Invoke-UiStep -FilePath 'npx' -Arguments @('--yes', 'vsce', 'package')) -ne 0) { Fail '打包失败' }

$vsix = Get-ChildItem -Filter *.vsix | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) { Fail '打包失败：未生成 .vsix' }
Write-UiLog "已生成 $($vsix.Name)"

# ------------------------------------------------------------- 覆盖安装
Set-UiStatus '覆盖安装到 VS Code…' -Kind busy
if ((Invoke-UiStep -FilePath $codePath -Arguments @('--install-extension', $vsix.FullName, '--force')) -ne 0) {
    Fail '扩展安装失败'
}

Write-UiLog "扩展 ID：$EXT_ID"
Set-UiHeader -Title $Title -Subtitle '更新完成 / Updated' -Hint '回到 VS Code 重载窗口（Ctrl+Shift+P → Reload Window）后生效'
Set-UiStatus '√ 更新完成 / updated' -Kind ok
Stop-Ui
Write-Host ''
