# RopIDE for VS Code

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

- **左右地址栏**：左侧行号替换为每行起始的**左侧地址**；输入区右侧相对位置显示每行的**右侧起始地址**。
- **状态栏地址**：光标所在处，VS Code 左下角状态栏实时显示 `L:xxxx R:xxxx`。
- **Gadgets 面板**：右上角按钮打开，优美排版展示所有 gadgets（名称、彩色标签、地址、描述），支持搜索、新增、编辑、删除。
- **编译**：右上角按钮一键编译，显示 hexdump（每行 16 字节，带左右地址），支持复制纯 hex 串 / hexdump。
- **新建**：新建 `.rop` 文件时依次填写**文件名**、**左侧地址**、**右侧地址**，并选择 gadgets 来源（`VerF` 预设 / `VerC` 预设 / 导入 `gadgets.json` / 空）。
- **gadget 补全**：输入 `#` 后弹出 gadget 补全列表。
- **常量 / 锚点补全**：输入 `$` 后弹出已定义常量与锚点补全列表。
- **侧边栏启动**：左侧活动栏新增 RopIDE 图标，点开即可在当前窗口「新建 / 打开」`.rop` 文件（不弹额外窗口）。
- **程序广场**：浏览 / 搜索 [ropide.pages.dev](https://ropide.pages.dev) 上的程序，精选/全部分区，一键下载（加载进当前编辑器）、发布（程序名/作者/机型/描述表单）。
- **Tab 对齐注释**：按 Tab 自动对齐当前行的 `//` 注释到上文列。

## 安装 / 运行

要求 Node.js 18+ 与 VS Code 1.85+，并确保已安装 `code` 命令行工具
（VS Code 命令面板 → `Shell Command: Install 'code' command in PATH`）。

**一键安装（推荐）**：编译 → 打包 `.vsix` → 安装进 VS Code：

```bash
./install.sh          # Linux / macOS
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

如需改代码后联调，仍可 `F5` 启动扩展开发宿主（仓库带 `.vscode/launch.json`）。

**卸载**：

```bash
./uninstall.sh          # Linux / macOS
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
├── install.sh              # Linux/macOS 一键安装脚本
├── install.ps1             # Windows 一键安装脚本
├── uninstall.sh            # Linux/macOS 卸载脚本
├── uninstall.ps1           # Windows 卸载脚本
├── icon.png                # 扩展图标
├── src/
│   ├── extension.ts          # 激活入口、命令注册、新建/打开文件
│   ├── ropEditorProvider.ts  # CustomTextEditor 提供者、状态栏
│   ├── launcherView.ts       # 侧边栏启动面板（WebviewView）
│   ├── presets.ts            # VerF / VerC gadgets 内置预设
│   ├── market.ts             # 程序广场 API（ropide.pages.dev）
│   └── rop.ts                # .rop JSON 解析/序列化
└── media/
    ├── editor.css            # 编辑器/面板/语法高亮样式
    ├── compiler.js           # 编译器 + 语法高亮解析（parser 移植）
    ├── editor.js             # Webview 主逻辑（地址栏、gadgets、编译、补全）
    └── icon.svg              # 侧边栏图标
```

> 注意：`media/editor.html` 未单独使用，HTML 由 `RopEditorProvider.getHtml()` 生成（便于注入 CSP nonce 与 webview URI）。

## 致谢

- **贴吧 @wlyibo** —— RopIDE 作者、[ropide.pages.dev](https://ropide.pages.dev) 网页版作者。他的 RopIDE 项目**推动了全民 ROP**，本插件的一切都建立在它之上。
- **rop-ide**（语法高亮 / 程序广场 / 编译逻辑参考）：https://github.com/WulanOVO/rop-ide
- **ropide-python**（编译器移植与 gadgets 预设，感谢梁圣开源）：`~/human-coding/ropide-python`
- 模拟器基础：贴吧 @噶么prince 的 CasioEmuMsvc 源码项目
