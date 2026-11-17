# P45 · README 对齐 0.5.0（含设置卡入口与框沿三色）

- 类型：A 类（改仓库文档并提交）　估时：20 分钟　执行：豆包
- 落点：`C:\develop\workspace\dsh-handoff-relay`，分支 `master`，**起点 HEAD `8df4e764fd60861dbcbf48e1a7846821bc68aa47`**
- 允许改的文件：**只有** `README.md`、`README.zh-CN.md`
- 禁止改：`index.js`、`client.js`、`index.test.mjs`、`package.json`、`cordis.patch.yml`
- 禁止：`git push`、`git tag`、`npm publish`、`git reset`、`git checkout -- .`、`git stash`

## 必须改的四点（两份 README 都要，中英各一份）

1. **安装命令版本号**：`#v0.4.0` → `#v0.5.0`
   - `README.md:168`、`README.zh-CN.md:145`
2. **加一句版本警告**（放在安装命令附近）：
   - 中文：`0.4.0 不可用（设置卡缺入口），请安装 0.5.0 或更高版本。`
   - 英文：`0.4.0 is not usable (its settings card never appears). Install 0.5.0 or later.`
3. **写明设置卡入口位置**（用户曾找不到）：
   - 中文：「卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面最下方「包含的组件」→ 点击 `Handoff Relay`** 即进入设置页。」
   - 英文对应翻译。
   - 原句 `从 0.4.0 起…贡献一张卡片` 改成 `从 0.5.0 起可用`，并删掉「只作编辑通道」这种自贬说法，改为「可直接增删行、绑定目录与会话」。
4. **新增一节「目录框沿颜色」（中文 + 英文各一句说明三态）**：
   - 绿 = 目录存在且可读；红 = 目录不存在 / 不可读 / 指到了文件；灰 = 宿主未提供目录核验（此态不阻止保存）
   - 补一句：保存时若目录不可读，行内会出现红字提示「目录当前不可读，保存后需确认」，**但不阻止保存**；路径存在性由 `GET /handoff-relay/probe` 在主进程判定，仅读 `stat`/`access`，不列举目录内容。

## 交付要求

- 一次点名提交：`git add README.md README.zh-CN.md`，提交信息 `docs: align README with 0.5.0 and settings card entry`
- 提交前自查：`git status --porcelain` 只应有这两个文件（`git diff --ignore-cr-at-eol --stat` 与 `--numstat` 双空作为开工判据）
- 报告落 `C:\develop\workspace\AI-writer\develop\.batch\night\staging\p45-readme-report.md`，末行 `<!-- DONE -->`，正文含：提交 SHA、`git show --numstat` 原文、两份 README 每处改动的 `文件:行` 与改后原文一句
- 信号：`.batch\night\signals\doubao\p45-readme-050.done`，三行：卡号 / 提交 SHA / `R3: 源目录清空且 delivered 有同名文件`
