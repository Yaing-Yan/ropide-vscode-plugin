@echo off
setlocal
cd /d "%~dp0"

rem ---------------------------------------------------------------------------
rem  RopIDE for VS Code — 本地卸载（Windows）
rem
rem  优先调用 uninstall.ps1（与 install.ps1 相同的界面），
rem  找不到 PowerShell 时退回到下面的纯批处理流程。
rem ---------------------------------------------------------------------------

where powershell >nul 2>nul
if errorlevel 1 goto plain

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
if errorlevel 1 goto psfail
goto :eof

:psfail
echo.
echo [错误] PowerShell 卸载脚本执行失败。
echo        也可以手动运行： powershell -ExecutionPolicy Bypass -File uninstall.ps1
exit /b 1

:plain
echo [提示] 未找到 PowerShell，使用纯批处理模式。

rem 扩展 ID = publisher.name（若改过 package.json 请同步这里）
set "EXT_ID=yaing-yan.ropide-vscode-plugin"

where code >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 code 命令。请在 VS Code 命令面板执行 "Shell Command: Install 'code' command in PATH"。
  exit /b 1
)

echo ==^> 卸载扩展 %EXT_ID% ...
code --uninstall-extension "%EXT_ID%"

echo.
echo [完成] 重载 VS Code 窗口后生效。
endlocal
