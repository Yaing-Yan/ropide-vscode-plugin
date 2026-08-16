@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem RopIDE for VS Code — 简易安装 / 卸载（免 git clone）
rem 用法（Windows CMD 一行）：
rem   curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.bat -o %TEMP%\simply-plugin.bat && call %TEMP%\simply-plugin.bat
rem 用法（PowerShell）：
rem   curl.exe -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.bat -o $env:TEMP\simply-plugin.bat; cmd /c $env:TEMP\simply-plugin.bat

set "REPO=Yaing-Yan/ropide-vscode-plugin"
set "BRANCH=main"
set "TARBALL=https://codeload.github.com/%REPO%/tar.gz/refs/heads/%BRANCH%"
set "WORK=%TEMP%\ropide-vscode-plugin-src"
set "EXT_ID=yaing-yan.ropide-vscode-plugin"

echo ==============================================
echo   RopIDE for VS Code — 简易安装 / 卸载
echo ==============================================
echo   [1] 安装
echo   [2] 卸载
echo   [q] 退出
set /p choice=请选择 [1/2/q]: 

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
goto :eof

:install
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 node，请先安装 Node.js 18+
  exit /b 1
)
where code >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 code 命令。请在 VS Code 命令面板执行 "Shell Command: Install 'code' command in PATH"。
  exit /b 1
)

echo ==^> 下载源码（免 git clone）...
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
curl -sSL "%TARBALL%" -o "%TEMP%\ropide-vscode-plugin.tar.gz"
tar -xzf "%TEMP%\ropide-vscode-plugin.tar.gz" -C "%WORK%" --strip-components=1
cd /d "%WORK%"

echo ==^> 安装依赖...
call npm install --no-audit --no-fund

echo ==^> 编译 + 打包...
call npm run compile
call npx vsce package

set "VSIX="
for /f "delims=" %%i in ('dir /b /o-d *.vsix') do if not defined VSIX set "VSIX=%%i"
if not defined VSIX (
  echo [错误] 打包失败：未生成 .vsix
  exit /b 1
)

echo ==^> 安装扩展...
code --install-extension "%VSIX%" --force

echo.
echo [完成] 重载 VS Code 窗口（Ctrl+Shift+P ^> Reload Window）后，打开 .rop 文件即可使用。
goto :eof

:uninstall
where code >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 code 命令。
  exit /b 1
)
echo ==^> 卸载扩展 %EXT_ID% ...
code --uninstall-extension "%EXT_ID%"
echo.
echo [完成] 重载 VS Code 窗口后生效。
goto :eof
