# RopIDE 本地安装脚本（Windows / PowerShell）
# 用法：  .\install.ps1
# 作用：  编译 -> 打包 .vsix -> 安装到 VS Code（--force 覆盖）
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "==> 检查 Node.js ..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "未找到 node，请先安装 Node.js 18+"
}

if (-not (Test-Path node_modules)) {
    Write-Host "==> 安装依赖（npm install）..."
    npm install
}

Write-Host "==> 编译（esbuild）..."
npm run compile

Write-Host "==> 打包 .vsix（vsce package）..."
npx vsce package

$vsix = Get-ChildItem -Filter *.vsix | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $vsix) {
    Write-Error "打包失败：未生成 .vsix"
}
Write-Host "==> 已生成 $($vsix.Name)"

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
    Write-Error "未找到 code 命令，请在 VS Code 中执行命令面板 -> `"Shell Command: Install 'code' command in PATH`""
}

Write-Host "==> 安装扩展（$code --install-extension $($vsix.Name) --force）..."
& $code --install-extension $vsix.FullName --force

Write-Host ""
Write-Host "✅ 安装完成！"
Write-Host "   重新加载 VS Code 窗口（Ctrl+Shift+P -> Reload Window），"
Write-Host "   然后打开任意 .rop 文件即可进入 RopIDE 编辑器。"
