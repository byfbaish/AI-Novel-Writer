# 卡：README 安装段改写为 DSH 插件惯用写法

## 背景与目标

仓库 `C:\develop\workspace\dsh-handoff-relay`（已发布 https://github.com/byfbaish/dsh-handoff-relay ，HEAD `0db38cb`，tag `v0.3.0`）。用户看了 README 的安装段，认为不像 DSH 插件的常规写法——现在写的是「改 profile 的 package.json 加 `file:` 依赖 + 在 bundles 里加一行」，让人自己动 profile 配置。

目标：把两份 README 的安装相关小节改写成 DSH 插件惯用写法，**参考** `https://github.com/T-Auto/dsh-ops#readme` 的结构（不要抄它的内容）：
1. 官方插件市场（在 DSH 应用里装）
2. 一键安装（CLI 命令，可复制）
3. 更新方法
4. 卸载 / 查看状态

## 必做

1. 先完整读现有 `README.md` 与 `README.zh-CN.md`。**只重写「安装 / Install」相关小节**，其余章节（配置示例、`done` 四态、正则四条约束、稳定判定说明、许可证）一字不动。
2. 命令必须是真的能用，不许凭想象写：
   - 先用本机 CLI 查证：`dsh plugin --help`，或桌面版 `<安装目录>\resources\runtime\cli\bin\dsh.cmd plugin --help`；看清支持哪些子命令与参数（`add` / `remove` / `list` / `--profile` 等）。
   - 本插件**尚未发布到 npm**。所以「插件市场输入包名 `dsh-handoff-relay`」这条路如果实际不可用，就读不许写成可用——要么写「暂未发布到 npm，改用本地路径或 git 安装」，要么只写 CLI 实测支持的方式。
   - 每条写进 README 的命令，报告里都要附查证依据（原始输出片段，几行即可）。
3. 中英两版结构一致、命令一致、章节标题对应（英文 `Install` / `Update` / `Uninstall`，中文 `安装` / `更新` / `卸载`）。
4. 配置示例继续用现行 schema，不要改动：
   ```yaml
   stableMs: 5000
   watches:
     - dir: 'D:\path\to\inbox'
       targetSessionId: 'session-xxxx'
       done: { text: '<!-- DONE -->' }
   ```
   并保留那句「`targetSessionId` 必须指向当前存在的会话，宿主重启后会变」。

## 禁忌

- 不得出现内部路径（`C:\develop`、`AI-writer`）、`.batch`、Bot 名、卡号、workbuddy / doubao 等内部称呼。
- 不得写「为多 agent 派卡流程做的」这类背景叙述；README 只讲通用问题。
- 不得改 `index.js`、`index.test.mjs`、`cordis.patch.yml`，不得改 `package.json` 的 `name` / `version` / `license`。
- 不得 `git push`、不得重启 DSH、不得往 `scripts\dsh\wakeup-inbox` 丢文件。
- 允许：`git add README.md README.zh-CN.md`（**点名，不许 `-A`**）并本地 commit，commit message 自拟。

## 产物

1. 两份 README 已改（本地 commit 完成）。
2. 报告 `.batch/night/reports/readme-install-rewrite.md`，末尾 `<!-- DONE -->`，内容：
   - 改了哪几个小节（标题 + 行号范围）
   - 每条命令的查证依据（原始输出片段）
   - 双语一致性核对（逐节对应）
   - 脱敏自检结果（`git diff` 新增行里扫内部串，0 命中）

## 判定线（QA 会按这个查）

1. 安装段写出的每条命令都有查证依据；查不到依据的一律不许出现。
2. 中英两版小节一一对应，命令完全相同。
3. `git diff` 新增行里内部串 0 命中。
4. 除安装相关小节外，其他章节未被削弱或删除。
