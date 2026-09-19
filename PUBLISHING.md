# 发布指南 / Publishing Guide

把 **RopIDE for VS Code** 上架到 VS Code 插件商城（Microsoft 官方 Marketplace）。

当前状态 / Status：

| 项目 | 状态 |
| --- | --- |
| 扩展 ID | `yaing-yan.ropide-vscode-plugin` |
| 版本 | `0.1.0` |
| `.vsix` 打包 | ✅ 已通过 (`ropide-vscode-plugin-0.1.0.vsix`) |
| 发布者 `yaing-yan` | ❌ 尚未在 Marketplace 注册 |
| 自动化脚本 / CI | ✅ `publish.sh` + `.github/workflows/publish.yml` |

> **唯一剩下的门槛是「发布者凭证（PAT）」。** 官方 Marketplace 没有任何免登录的匿名发布通道，
> 这个 Token 只能由账号持有人（你）在自己的 Microsoft 账号下生成。

---

## 一、最快路径（约 3 分钟）

### 1. 登录并注册发布者

1. 打开 <https://marketplace.visualstudio.com/manage>
2. 用 Microsoft 账号登录（会自动创建 Azure DevOps 组织，免费）
3. 点击 **Create publisher**，ID 填 `yaing-yan`（必须与 `package.json` 里的 `publisher` 一致）

### 2. 生成 PAT

1. 打开 <https://dev.azure.com>，右上角 **User settings → Personal access tokens**
2. **New Token**，设置：
   - Organization：选择 `All accessible organizations`（**必须**，选单个组织会导致 401）
   - Scopes：点 **Show all scopes** → 勾选 **Marketplace → Manage**
   - Expiration：按需（最长 1 年）
3. 创建后**立即复制** Token（只显示一次）

### 3. 一条命令发布

```bash
cd ropide-vscode-plugin
VSCE_PAT=<粘贴你的Token> ./publish.sh
```

或者用 npm script：

```bash
npm run publish:vsce --  # 先 export VSCE_PAT
```

发布成功后地址：
<https://marketplace.visualstudio.com/items?itemName=yaing-yan.ropide-vscode-plugin>

---

## 二、发布脚本用法

`publish.sh` 会自动编译、打包、发布，并做了失败前置校验。

```bash
VSCE_PAT=xxx ./publish.sh              # 发布到 VS Code 官方商城
OVSX_PAT=xxx ./publish.sh --ovsx       # 发布到 Open VSX（VSCodium / 非微软发行版）
VSCE_PAT=xxx OVSX_PAT=yyy ./publish.sh --both
./publish.sh --package                 # 只打包 .vsix
VSCE_PAT=xxx ./publish.sh --verify     # 只校验 Token 是否有效
BUMP=patch VSCE_PAT=xxx ./publish.sh   # 自动把版本号 +0.0.1 后发布
```

---

## 三、CI 自动发布（推荐长期使用）

`.github/workflows/publish.yml` 已配置好。只需一次性添加仓库密钥：

1. 仓库 → **Settings → Secrets and variables → Actions → New repository secret**
2. 添加 `VSCE_PAT` = 上面的 Marketplace Token
3. （可选）添加 `OVSX_PAT` = Open VSX Token

之后两种触发方式：

- **打 tag**：`git tag v0.1.0 && git push origin v0.1.0` → 自动发布 + 建 GitHub Release
- **手动**：Actions → *Publish to Marketplaces* → *Run workflow*（可选 bump 版本）

---

## 四、Open VSX（备选 / 同时上架）

官方 Marketplace 只服务微软系产品；VSCodium、Eclipse Theia、Gitpod 等使用 Open VSX。

1. 用 **GitHub 账号**登录 <https://open-vsx.org>
2. 在 <https://open-vsx.org/user-settings/tokens> 生成 Access Token
3. `OVSX_PAT=xxx ./publish.sh --ovsx`

---

## 五、常见报错

| 报错 | 原因 / 解决 |
| --- | --- |
| `ERROR The Personal Access Token verification has failed` | PAT 的 Organization 没选 `All accessible organizations`，或缺少 **Marketplace → Manage** scope |
| `ERROR You're not authorized to publish` / `Publisher 'xxx' not found` | 发布者 ID 还没在 <https://marketplace.visualstudio.com/manage> 创建，或与 `package.json` 的 `publisher` 不一致 |
| `ERROR Extension version already exists` | 该版本已发布，先改 `package.json` 的 `version`（或 `BUMP=patch`） |
| `ERROR Icon must be at least 128x128` | 当前 `icon.png` 正好 128×128，已满足；若替换图标请勿小于 128 |
| `ERROR Missing repository field` | 已配置；若改仓库地址需同步更新 `package.json` |
| 发布后商城搜不到 / 更新慢 | 通常几分钟，偶尔要 15 分钟以上；先直接访问 items 链接确认 |

---

## 六、发布前自检清单

```bash
./publish.sh --package          # 打包必须无警告
code --install-extension ropide-vscode-plugin-0.1.0.vsix   # 本地装一遍验证
```

- [x] `package.json` 有 `publisher` / `license` / `icon` / `repository`
- [x] `README.md` 里的图片使用相对路径 `media/…`，且 `media/` 已打进 VSIX
- [x] `LICENSE`（GPL-3.0）已包含
- [x] `src/**`、`node_modules/**` 已通过 `.vscodeignore` 排除
