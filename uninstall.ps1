# RopIDE 卸载脚本（Windows / PowerShell）
# 用法：  .\uninstall.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$extId = "$($pkg.publisher).$($pkg.name)"

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
    Write-Error "未找到 code 命令，请在 VS Code 中执行命令面板 -> `"Shell Command: Install 'code' command in PATH`""
}

Write-Host "==> 卸载扩展（$code --uninstall-extension $extId）..."
& $code --uninstall-extension $extId
if ($LASTEXITCODE -ne 0) { Write-Warning "卸载命令返回非零（可能扩展未安装，忽略）" }

Write-Host ""
Write-Host "✅ 卸载完成。重新加载 VS Code 窗口（Ctrl+Shift+P -> Reload Window）后生效。"
