<p align="center">
  <img src="media/banner.png" alt="RopIDE for VS Code" width="100%" />
</p>

# RopIDE for VS Code

A VS Code extension built for **`.rop` files** — ROP programs for the **CASIO fx-991 CN X**.

A `.rop` file is a single JSON object:

```json
{
  "input": "// ...assembly DSL source...",
  "gadgets": [ { "name": "pop-er0", "addr": "121A8", "desc": "赋值 ER0", "tags": [] } ],
  "leftStartAddress": "E9E0",
  "rightStartAddress": "D710",
  "ideVersion": 100
}
```

This extension does **not** touch `.rin` / `gadgets.json` / `config.json` — everything lives inside the single `.rop` file.

## Features

When you open a `.rop` file, the editor shows the `input` field's content (not the raw JSON) with full syntax highlighting:

| Syntax | Description |
| --- | --- |
| `// comment` | Gray italic |
| `$name = value;` | Constant definition (cyan name + green value) |
| `#gadget;` / `#-gadget;` | Gadget reference (blue; recognized ones get a background) |
| `[expression]` | Value block (orange; closed ones get a background) |
| `<anchor>` / `<-anchor>` | Address anchor (green; closed ones get a background) |
| `00 11 AA` | Raw hex bytes |

Other highlights:

- **Left / right address gutters**: the line number gutter on the left shows each line's **left address**; a right gutter shows each line's **right start address**. The current line's addresses are highlighted in both gutters.
- **Status bar address**: VS Code's status bar shows `L:xxxx R:xxxx` for the cursor position in real time.
- **Gadgets panel**: open it from the toolbar — nicely laid out list of all gadgets (name, colored tags, address, description) with search, add, edit, delete.
- **Gadget disassembly (experimental)**: turn on *[Experimental] Show gadget disassembly* in Settings and provide a `_disas` file; each gadget in the Gadgets panel then shows the disassembly snippet from its address until `POP PC` / `RT`.
- **Compile**: one-click compile from the toolbar, showing a hexdump (16 bytes per row with left/right addresses), with copy-hex / copy-hexdump actions.
- **New file**: when creating a `.rop` file, sequentially fill in the **file name**, **left address**, **right address**, and choose the gadgets source (VerF preset / VerC preset / import `gadgets.json` / empty).
- **Gadget completion**: type `#` to get a gadget completion list.
- **Constant / anchor completion**: type `$` to get defined constants and anchors.
- **Market**: browse / search programs on [ropide.pages.dev](https://ropide.pages.dev), Featured / All sections, one-click download (**choose a save path, then it opens**), and publish (name / author / model / description form with expert check).
- **Overwrite emulator**: from the compile tab you can "overwrite RAM" (inject address, defaults to the left address) and "overwrite launcher" (fixed at `0xD180` by default) — writing into the running emulator's memory via CasioEmuMsvc's McpPlugin (MCP, port `3001`).
- **Tab-aligned comments**: pressing Tab aligns the current line's `//` comment with the column used above.
- **Settings**: UI language (简体中文 / English) and the experimental disassembly toggle, available from the toolbar gear / the side panel.

## ⚠️ Overwrite feature: the emulator must be started this way

"Overwrite RAM / overwrite launcher" writes memory through CasioEmuMsvc's **McpPlugin** (MCP, `http://127.0.0.1:3001`), so the emulator **must be started from its own directory** (on Linux/macOS the plugin loader only scans the **current working directory** for `CasioEmuMsvc.Plugin.*.so`); otherwise the plugin isn't loaded, port 3001 isn't listening, and overwriting reports "找不到正在运行的 CasioEmuMsvc，或者进程不支持 MCP".

**Correct way to start (important):**

```bash
cd /path/to/CasioEmuMsvc-mcp          # enter the directory that contains the CasioEmuMsvc binary (not its parent!)
./CasioEmuMsvc ../models/fx991cnxfVirtual   # launch with the model directory
```

> Verify: visit `http://127.0.0.1:3001/health` — a `{"status":"ok",...}` response means MCP is ready.
> If the port isn't 3001, change `ropide.casioemuMcpPort` in settings.

## Install / Run

Requires Node.js 18+ and VS Code 1.85+, with the `code` CLI installed
(VS Code command palette → `Shell Command: Install 'code' command in PATH`).

**One-click install (recommended)**: compile → package `.vsix` → install into VS Code:

```bash
./install.sh          # Linux / macOS
install.bat           # Windows (CMD, double-click or command line)
# or Windows PowerShell:
.\install.ps1
```

After installing, reload the VS Code window (`Ctrl+Shift+P` → `Reload Window`),
then open any `.rop` file to enter the RopIDE editor — **no F5 development host needed**.

Manual steps (equivalent to the scripts above):

```bash
npm install
npm run compile
npm run package                       # produces ropide-vscode-plugin-0.1.0.vsix
code --install-extension ropide-vscode-plugin-0.1.0.vsix --force
```

**Cross-platform packaging** (outputs `ropide-vscode-plugin-<yyyymmdd>.vsix`, works everywhere):

```bash
./build.sh
```

For live debugging after code changes, `F5` still starts the extension development host (the repo ships `.vscode/launch.json`).

**Uninstall**:

```bash
./uninstall.sh          # Linux / macOS
uninstall.bat           # Windows (CMD)
# or Windows PowerShell:
.\uninstall.ps1
```

## Compile rules

The compiler is a faithful port of [rop-ide](https://github.com/WulanOVO/rop-ide)'s `src/parser.js` and ropide-python's `compiler.py`:

- `#gadget;` encodes as 4 bytes (8 hex digits): `h1 h2 h3 h4`, where `h3 = ("0" if allow00 else "3") + addr[0]`, `h4 = "00" / "30"`.
- `[expression]` encodes as little-endian 2 bytes; forward references to `$constants` are supported (deferred back-patch).
- `<anchor>` records the address at the current byte-stream length (right address base; `<-anchor>` uses the left address base).
- Raw hex characters merge directly into the byte stream.
- Gutter / status-bar addresses = start address + byte offset of the current line / cursor.

## Directory structure

```
ropide-vscode-plugin/
├── package.json
├── tsconfig.json
├── build.sh                # Cross-platform packaging: outputs ropide-vscode-plugin-<yyyymmdd>.vsix
├── simply-plugin.sh        # One-line install/uninstall without git clone (Linux/macOS)
├── simply-plugin.bat       # One-line install/uninstall without git clone (Windows)
├── install.sh              # Linux/macOS one-click install script
├── install.ps1             # Windows PowerShell one-click install script
├── install.bat             # Windows CMD one-click install script
├── uninstall.sh            # Linux/macOS uninstall script
├── uninstall.ps1           # Windows PowerShell uninstall script
├── uninstall.bat           # Windows CMD uninstall script
├── icon.png                # Extension icon
├── media/
│   ├── banner.png          # README banner (AI-generated)
│   ├── editor.css          # Editor/panel/syntax-highlight styles
│   ├── compiler.js         # Compiler + syntax-highlight parser (parser port)
│   └── editor.js           # Webview main logic (gutters, gadgets, compile, completion, market, settings)
└── src/
    ├── extension.ts          # Activation entry, command registration, new/open files
    ├── ropEditorProvider.ts  # CustomTextEditor provider, status bar, settings & disas sync
    ├── presets.ts            # Built-in VerF / VerC gadget presets
    ├── market.ts             # Market API (ropide.pages.dev)
    ├── welcome.ts            # Welcome / About page (centered market dialog)
    └── rop.ts                # .rop JSON parse/serialize, disas parse & snippet
```

> Note: `media/editor.html` is not used separately; the HTML is generated by `RopEditorProvider.getHtml()` (to inject the CSP nonce and webview URIs).

---

# RopIDE for VS Code（中文）

一个专门为 **`.rop` 文件**（CASIO fx-991 CN X 的 ROP 程序）打造的 VS Code 插件。

`.rop` 文件本质上是单个 JSON 对象：

```json
{
  "input": "// ...汇编 DSL 源码...",
  "gadgets": [ { "name": "pop-er0", "addr": "121A8", "desc": "赋值 ER0", "tags": [] } ],
  "leftStartAddress": "E9E0",
  "rightStartAddress": "D710",
  "ideVersion": 100
}
```

本插件**不涉及** `.rin` / `gadgets.json` / `config.json`——所有操作都在单个 `.rop` 文件里完成。

## 快速安装（免 git clone）

一条命令即可完成，运行后会弹出**综合处理菜单**，选择「1 安装」或「2 卸载」：

**Linux / macOS：**

```bash
curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.sh -o /tmp/simply-plugin.sh && bash /tmp/simply-plugin.sh
```

**Windows：**

CMD（命令提示符）：

```bat
curl -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.bat -o %TEMP%\simply-plugin.bat && call %TEMP%\simply-plugin.bat
```

PowerShell：

```powershell
curl.exe -sSL https://raw.githubusercontent.com/Yaing-Yan/ropide-vscode-plugin/main/simply-plugin.bat -o $env:TEMP\simply-plugin.bat; cmd /c $env:TEMP\simply-plugin.bat
```

> 也可以 clone 仓库后运行 `./install.sh` / `install.bat` / `.\install.ps1`（见下文「安装 / 运行」）。

## 功能

打开 `.rop` 文件后，编辑器显示的是 `input` 字段的内容（而非原始 JSON），并带完整语法高亮：

| 语法 | 说明 |
| --- | --- |
| `// 注释` | 灰色斜体 |
| `$name = value;` | 常量定义（青色名称 + 绿色值） |
| `#gadget;` / `#-gadget;` | gadget 引用（蓝色，已识别的带底色） |
| `[表达式]` | 数值块（橙色，闭合的带底色） |
| `<锚点>` / `<-锚点>` | 地址锚点（绿色，闭合的带底色） |
| `00 11 AA` | 裸十六进制字节 |

其它特性：

- **左右地址栏**：左侧行号替换为每行起始的**左侧地址**；输入区右侧相对位置显示每行的**右侧起始地址**，光标所在行的左右地址会高亮提醒。
- **状态栏地址**：光标所在处，VS Code 左下角状态栏实时显示 `L:xxxx R:xxxx`。
- **Gadgets 面板**：右上角按钮打开，优美排版展示所有 gadgets（名称、彩色标签、地址、描述），支持搜索、新增、编辑、删除。
- **gadget 汇编展示（实验性）**：在设置中开启「【实验性】gadgets 展示汇编」并提供 `_disas` 文件后，Gadgets 面板中每个 gadget 下方会展示从该地址到 `POP PC` / `RT` 的反汇编片段。
- **编译**：右上角按钮一键编译，显示 hexdump（每行 16 字节，带左右地址），支持复制纯 hex 串 / hexdump。
- **新建**：新建 `.rop` 文件时依次填写**文件名**、**左侧地址**、**右侧地址**，并选择 gadgets 来源（`VerF` 预设 / `VerC` 预设 / 导入 `gadgets.json` / 空）。
- **gadget 补全**：输入 `#` 后弹出 gadget 补全列表。
- **常量 / 锚点补全**：输入 `$` 后弹出已定义常量与锚点补全列表。
- **程序广场**：浏览 / 搜索 [ropide.pages.dev](https://ropide.pages.dev) 上的程序，精选/全部分区，一键下载（**指定保存路径后打开**）、发布（程序名/作者/机型/描述表单）。
- **覆写模拟器**：编译结果页可「覆写 RAM」（注入地址，默认左地址）与「覆写 launcher」（固定 `0xD180`），通过 CasioEmuMsvc 的 McpPlugin（MCP，端口 `3001`）写入正在运行的模拟器内存。
- **Tab 对齐注释**：按 Tab 自动对齐当前行的 `//` 注释到上文列。
- **设置**：界面语言（简体中文 / English）与实验性反汇编开关，通过工具栏齿轮或侧栏「设置」页修改。

## ⚠️ 覆写功能：必须这样启动模拟器

「覆写 RAM / 覆写 launcher」通过 CasioEmuMsvc 的 **McpPlugin**（MCP，`http://127.0.0.1:3001`）写入内存，
因此模拟器**必须从它自己的目录启动**（Linux/macOS 的插件加载器只扫描**当前工作目录**里的 `CasioEmuMsvc.Plugin.*.so`），
否则插件不会加载、3001 端口不会监听，覆写会报「找不到正在运行的 CasioEmuMsvc，或者进程不支持 MCP」。

**正确启动方式（重点）：**

```bash
cd /path/to/CasioEmuMsvc-mcp          # 进入 CasioEmuMsvc 可执行文件所在的目录（不是父目录！）
./CasioEmuMsvc ../models/fx991cnxfVirtual   # 启动时带上模型目录
```

> 验证是否成功：浏览器/命令行访问 `http://127.0.0.1:3001/health`，返回 `{"status":"ok",...}` 即表示 MCP 已就绪。
> 若端口不是 3001，可在设置里改 `ropide.casioemuMcpPort`。

## 安装 / 运行

要求 Node.js 18+ 与 VS Code 1.85+，并确保已安装 `code` 命令行工具
（VS Code 命令面板 → `Shell Command: Install 'code' command in PATH`）。

**一键安装（推荐）**：编译 → 打包 `.vsix` → 安装进 VS Code：

```bash
./install.sh          # Linux / macOS
install.bat           # Windows（CMD 双击或命令行）
# 或 Windows PowerShell：
.\install.ps1
```

装完重新加载 VS Code 窗口（`Ctrl+Shift+P` → `Reload Window`），
打开任意 `.rop` 文件即可进入 RopIDE 编辑器——**无需 F5 调试宿主**。

手动分步（等价于上面脚本）：

```bash
npm install
npm run compile
npm run package                       # 生成 ropide-vscode-plugin-0.1.0.vsix
code --install-extension ropide-vscode-plugin-0.1.0.vsix --force
```

**跨平台打包**（输出 `ropide-vscode-plugin-<yyyymmdd>.vsix`，全平台通用）：

```bash
./build.sh
```

如需改代码后联调，仍可 `F5` 启动扩展开发宿主（仓库带 `.vscode/launch.json`）。

**卸载**：

```bash
./uninstall.sh          # Linux / macOS
uninstall.bat           # Windows（CMD）
# 或 Windows PowerShell：
.\uninstall.ps1
```

## 编译规则

编译器忠实移植自 [rop-ide](https://github.com/WulanOVO/rop-ide) 的 `src/parser.js` 与 ropide-python 的 `compiler.py`：

- `#gadget;` 编码为 4 字节（8 位 hex）：`h1 h2 h3 h4`，其中 `h3 = ("0" if allow00 else "3") + addr[0]`，`h4 = "00" / "30"`。
- `[表达式]` 编码为小端 2 字节；支持 `$常量` 的前向引用（延迟回填）。
- `<锚点>` 记录当前字节流长度对应的地址（右侧地址为基准，`<-锚点>` 以左侧地址为基准）。
- 裸十六进制字符直接并入字节流。
- 地址栏 / 状态栏地址 = 起始地址 + 当前行/光标前的字节偏移。

## 目录结构

```
ropide-vscode-plugin/
├── package.json
├── tsconfig.json
├── build.sh                # 跨平台打包：输出 ropide-vscode-plugin-<yyyymmdd>.vsix
├── simply-plugin.sh        # 免 git clone 一行安装/卸载（Linux/macOS）
├── simply-plugin.bat       # 免 git clone 一行安装/卸载（Windows）
├── install.sh              # Linux/macOS 一键安装脚本
├── install.ps1             # Windows PowerShell 一键安装脚本
├── install.bat             # Windows CMD 一键安装脚本
├── uninstall.sh            # Linux/macOS 卸载脚本
├── uninstall.ps1           # Windows PowerShell 卸载脚本
├── uninstall.bat           # Windows CMD 卸载脚本
├── icon.png                # 扩展图标
├── media/
│   ├── banner.png          # README 横幅（AI 生成）
│   ├── editor.css          # 编辑器/面板/语法高亮样式
│   ├── compiler.js         # 编译器 + 语法高亮解析（parser 移植）
│   └── editor.js           # Webview 主逻辑（地址栏、gadgets、编译、补全、程序广场、设置）
└── src/
    ├── extension.ts          # 激活入口、命令注册、新建/打开文件
    ├── ropEditorProvider.ts  # CustomTextEditor 提供者、状态栏、设置与 disas 同步
    ├── presets.ts            # VerF / VerC gadgets 内置预设
    ├── market.ts             # 程序广场 API（ropide.pages.dev）
    ├── welcome.ts            # 欢迎/关于页（居中程序广场弹窗）
    └── rop.ts                # .rop JSON 解析/序列化、disas 解析与片段截取
```

> 注意：`media/editor.html` 未单独使用，HTML 由 `RopEditorProvider.getHtml()` 生成（便于注入 CSP nonce 与 webview URI）。

## 致谢

- **贴吧 @wlyibo** —— RopIDE 作者、[ropide.pages.dev](https://ropide.pages.dev) 网页版作者。他的 RopIDE 项目**推动了全民 ROP**，本插件的一切都建立在它之上。
- **rop-ide**（语法高亮 / 程序广场 / 编译逻辑参考）：https://github.com/WulanOVO/rop-ide
- 模拟器基础：贴吧 @噶么prince 的 CasioEmuMsvc 源码项目
