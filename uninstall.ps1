# RopIDE 卸载脚本（Windows / PowerShell）
# 用法：  .\uninstall.ps1
#
# 界面与 install.ps1 一致，由 scripts\ui.ps1 提供。
#
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$uiLib = Join-Path $PSScriptRoot 'scripts\ui.ps1'
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

$script:Title = 'RopIDE for VS Code'

function Fail {
    param([string]$Message)
    Set-UiStatus "× $Message" -Kind err
    Stop-Ui
    Write-Host ''
    exit 1
}

$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$extId = "$($pkg.publisher).$($pkg.name)"

Initialize-Ui -Title $script:Title -Subtitle '卸载向导 · Windows / PowerShell' `
    -Hint "移除已安装的扩展 $extId"
Start-Ui
Set-UiStatus '查找 code 命令…' -Kind busy

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
    Fail "未找到 code 命令：请在 VS Code 命令面板执行 Shell Command: Install 'code' command in PATH"
}
$codePath = if ($code -is [string]) { $code } else { $code.Source }
Write-UiLog "code → $codePath"

Set-UiStatus "卸载扩展 $extId…" -Kind busy
$rc = Invoke-UiStep -FilePath $codePath -Arguments @('--uninstall-extension', $extId)
if ($rc -ne 0) { Write-UiLog '卸载命令返回非零（可能扩展未安装，继续）' }

Set-UiHeader -Title $script:Title -Subtitle '卸载完成 / Uninstalled' -Hint '重载 VS Code 窗口后生效'
Set-UiStatus '√ 卸载完成 / done' -Kind ok
Stop-Ui
Write-Host ''
