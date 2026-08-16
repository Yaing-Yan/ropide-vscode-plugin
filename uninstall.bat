@echo off
setlocal
cd /d "%~dp0"

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
