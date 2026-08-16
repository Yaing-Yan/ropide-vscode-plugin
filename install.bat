@echo off
setlocal
cd /d "%~dp0"

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
call npx vsce package

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
