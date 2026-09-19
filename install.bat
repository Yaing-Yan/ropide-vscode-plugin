@echo off
setlocal
cd /d "%~dp0"

rem ---------------------------------------------------------------------------
rem  RopIDE for VS Code — 本地安装（Windows）
rem
rem  优先调用 install.ps1：反色标题胶囊 + 居中偏上 + 固定 4 行渐变日志区。
rem  找不到 PowerShell 时退回到下面的纯批处理流程，功能完全一致。
rem ---------------------------------------------------------------------------

where powershell >nul 2>nul
if errorlevel 1 goto plain

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 goto psfail
goto :eof

:psfail
echo.
echo [错误] PowerShell 安装脚本执行失败。
echo        也可以手动运行： powershell -ExecutionPolicy Bypass -File install.ps1
exit /b 1

:plain
echo [提示] 未找到 PowerShell，使用纯批处理模式。

echo ==^> 检查 Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 node，请先安装 Node.js 18+
  exit /b 1
)

if not exist node_modules (
  echo ==^> 安装依赖...
  call npm install
)

echo ==^> 编译...
call npm run compile

echo ==^> 打包 .vsix...
call npx --yes vsce package

set "VSIX="
for /f "delims=" %%i in ('dir /b /o-d *.vsix') do if not defined VSIX set "VSIX=%%i"
if not defined VSIX (
  echo [错误] 打包失败：未生成 .vsix
  exit /b 1
)
echo ==^> 已生成 %VSIX%

where code >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 code 命令。请在 VS Code 命令面板执行 "Shell Command: Install 'code' command in PATH"。
  exit /b 1
)

echo ==^> 安装扩展...
code --install-extension "%VSIX%" --force

echo.
echo [完成] 重载 VS Code 窗口（Ctrl+Shift+P ^> Reload Window）后，打开 .rop 文件即可使用。
endlocal
