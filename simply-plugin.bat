@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem RopIDE for VS Code — 简易安装 / 卸载（免 git clone）
rem 用法（Windows CMD 一行）：
rem   curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.bat -o %TEMP%\simply-plugin.bat && call %TEMP%\simply-plugin.bat
rem 用法（PowerShell）：
rem   curl.exe -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.bat -o $env:TEMP\simply-plugin.bat; cmd /c $env:TEMP%\simply-plugin.bat
rem
rem 安装/卸载的实际界面由 PowerShell（install.ps1 / uninstall.ps1）绘制：
rem 反色标题胶囊居中偏上，下方固定 4 行日志区，由下往上逐行变暗。

set "REPO=Yaing-Yan/ropide-vscode-plugin"
set "BRANCH=main"
set "TARBALL=https://codeload.github.com/%REPO%/tar.gz/refs/heads/%BRANCH%"
set "WORK=%TEMP%\ropide-vscode-plugin-src"
set "EXT_ID=yaing-yan.ropide-vscode-plugin"

rem ------------------------------------------------------------------ 颜色
rem 取 ESC 字符（Windows 10+ 控制台支持 ANSI 序列）
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "C_RESET="
set "C_PILL="
set "C_ACCENT="
set "C_KEY="
if defined ESC (
  set "C_RESET=%ESC%[0m"
  set "C_PILL=%ESC%[1;7m"
  set "C_ACCENT=%ESC%[36m"
  set "C_KEY=%ESC%[97m"
)

rem ------------------------------------------------------------------ 菜单
set "COLS=80"
for /f "tokens=2 delims=:" %%a in ('mode con ^| findstr /i "Columns"') do set "COLS=%%a"
set "COLS=%COLS: =%"
set /a TITLE_PAD=(COLS-25)/2
if %TITLE_PAD% lss 0 set "TITLE_PAD=0"
set "PAD="
for /l %%i in (1,1,%TITLE_PAD%) do set "PAD=!PAD! "

cls
echo.
echo %PAD%%C_PILL%   RopIDE for VS Code   %C_RESET%
echo.
echo      简易安装 / 卸载 · 免 git clone
echo      从 GitHub 拉取源码 → 编译 → 打包 → 安装到 VS Code
echo.
echo      %C_ACCENT%────────────────────────────────────────────────────────%C_RESET%
echo        %C_KEY%[1]%C_RESET% 安装 / Install           %C_KEY%[2]%C_RESET% 卸载 / Uninstall
echo        %C_KEY%[q]%C_RESET% 退出 / Quit
echo      %C_ACCENT%────────────────────────────────────────────────────────%C_RESET%
echo.
set /p choice=     请选择 [1/2/q]: 

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
goto :eof

rem ================================================================== 安装
:install
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 node，请先安装 Node.js 18+
  exit /b 1
)

echo.
echo ==^> 下载源码（免 git clone）...
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
curl -sSL "%TARBALL%" -o "%TEMP%\ropide-vscode-plugin.tar.gz"
if errorlevel 1 (
  echo [错误] 源码下载失败
  exit /b 1
)
tar -xzf "%TEMP%\ropide-vscode-plugin.tar.gz" -C "%WORK%" --strip-components=1
if errorlevel 1 (
  echo [错误] 源码解压失败
  exit /b 1
)
cd /d "%WORK%"

rem 优先交给 PowerShell 绘制安装界面
where powershell >nul 2>nul
if errorlevel 1 goto install_plain

powershell -NoProfile -ExecutionPolicy Bypass -File "%WORK%\install.ps1"
if errorlevel 1 (
  echo [错误] 安装失败，请查看日志。
  exit /b 1
)
echo.
echo [完成] 重载 VS Code 窗口（Ctrl+Shift+P ^> Reload Window）后，打开 .rop 文件即可使用。
goto :eof

:install_plain
echo [提示] 未找到 PowerShell，使用纯批处理模式。
echo ==^> 安装依赖...
call npm install --no-audit --no-fund

echo ==^> 编译 + 打包...
call npm run compile
call npx --yes vsce package

set "VSIX="
for /f "delims=" %%i in ('dir /b /o-d *.vsix') do if not defined VSIX set "VSIX=%%i"
if not defined VSIX (
  echo [错误] 打包失败：未生成 .vsix
  exit /b 1
)

where code >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 code 命令。请在 VS Code 命令面板执行 "Shell Command: Install 'code' command in PATH"。
  exit /b 1
)

echo ==^> 安装扩展...
code --install-extension "%VSIX%" --force

echo.
echo [完成] 重载 VS Code 窗口（Ctrl+Shift+P ^> Reload Window）后，打开 .rop 文件即可使用。
goto :eof

rem ================================================================== 卸载
:uninstall
where code >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 code 命令。请在 VS Code 命令面板执行 "Shell Command: Install 'code' command in PATH"。
  exit /b 1
)

echo.
echo ==^> 卸载扩展 %EXT_ID% ...
code --uninstall-extension "%EXT_ID%"
echo.
echo [完成] 重载 VS Code 窗口后生效。
goto :eof
