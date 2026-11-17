# P45 首验 · README 对齐 0.5.0

- 判定对象：`C:\develop\workspace\dsh-handoff-relay` HEAD `87782339a5cb8d3c6786548f93d355b14a2dea35`「docs: align README with 0.5.0 and settings card entry」（父 `8df4e764`，21:39:40）
- 派验单：`.batch/night/review-requests/P45.md`（1,834B / `F6F49015…`）
- 判定时刻：2026-11-16 22:3x（Asia/Shanghai）
- 结论：**8 条中 7 条通过，第 4 条不通过**（入口路径两处措辞与宿主实际不一致）⇒ 建议打回改文案，改完只重验第 4 条。

## 逐条

**① 通过** — `git rev-list --count 8df4e764..HEAD` = `1`；`git diff --name-only 8df4e764 HEAD` 只有 `README.md`、`README.zh-CN.md`；`git show --numstat --format='' HEAD` = `16 4 README.md` / `12 2 README.zh-CN.md`，无代码、无 `package.json`、无 `cordis.patch.yml`（第 6 条同证）。porcelain 空。

**② 通过** — `git grep -c 'v0\.4\.0' HEAD -- README.md README.zh-CN.md` 零命中（exit 1）；安装行改 `#v0.5.0`（`README.md:168`、`README.zh-CN.md:145`）。

**③ 通过** —
- `README.md:171`：`0.4.0 is not usable (its settings card never appears). Install 0.5.0 or later.`
- `README.zh-CN.md:148`：`0.4.0 不可用（设置卡缺入口），请安装 0.5.0 或更高版本。`

**④ 不通过** — 两句都在，但路径两处与宿主实际不符：
- 中文 `README.zh-CN.md:207`：`卡片入口较深：**插件 → 已安装 → dsh-handoff-relay → 打开其 README 页 → 页面最下方「包含的组件」→ 点击 `Handoff Relay`** 即进入设置页。`
  - 「包含的组件」标签**对**：宿主中文 `partsLabel: "包含的组件"`（`dsh-client-ui-plugin-manager/lib/client.js:173`）。
  - 「页面最下方」**不对**：包详情页 `detailSections` 顺序是 README 文档 → 包配置 → `RowsSection`（包含的组件，`:6024`）→ 版本信息 `VersionSection`（`:6034`）→ 来源信息 `SourceSection`（`:6043`）⇒ 包含的组件下面还有两块。
- 英文 `README.md:242-243`：`**Plugins → Installed → dsh-handoff-relay → open its README page → “Included components” at the bottom → click `Handoff Relay`**`
  - `Installed` **对**（`:461 installedTab: "Installed"`）。
  - `“Included components”` **不存在**：宿主英文标签是 `partsLabel: "Components"`（`:467`）；全文件 `Included components` 0 命中。
  - `at the bottom` 同上一条，位置不对。
- 行可点这条链路成立：`configure.has(row) = ledger.rows.has(rowConfigKey(pkg.name,row.rowId))`（`:7003`），`rowConfigKey = \`${bundle}#${rowId}\``（`:87-89`），`ledger.rows = keysOf("plugins.row.config")`（`:123`）；仓库 `client.js:670` 注册 `name: "plugins.row.config"` + `key: ROW_CONFIG_KEY`（`:671`），点击进 `RowDetail`（`:5808`）并渲染该槽位。即「修好措辞后点得到」没问题。

建议改法（两处措辞，不动结构）：
- 中文：删「页面最下方」，写「页面里「包含的组件」一节」；
- 英文：`“Included components”` → `“Components”`，`at the bottom` → `in the “Components” section`。

**⑤ 通过** — 三色齐全且两句附加说明都在：
- `README.zh-CN.md:217`：`绿 = 目录存在且可读；红 = 目录不存在 / 不可读 / 指到了文件；灰 = 宿主未提供目录核验（此态不阻止保存）。`
- `README.zh-CN.md:219`：`…行内会出现红字提示「目录当前不可读，保存后需确认」，**但不阻止保存**。路径存在性由 `GET /handoff-relay/probe` 在主进程判定，仅读 `stat`/`access`，不列举目录内容。`
- 英文对应 `README.md:255`、`:257`，语义一致。
- 「仅读 `stat`/`access`」与 P44 代码核对一致（`index.js` 新增行只有 `fs.promises.stat`、`fs.promises.access`，无 readdir、无写）。

**⑥ 通过** — 见 ① 的 numstat，无 `index.js`/`client.js`/`index.test.mjs`/`package.json`/`cordis.patch.yml`。

**⑦ 通过** — `git ls-remote origin refs/heads/master` 仍 `74f4cc17a5f7d47bafa610255eb40e91d7f5ecd1`；tag 4 个；`npm view dsh-handoff-relay version` = `0.3.2`。

**⑧ 通过** — `.batch/night/staging/p45-readme-report.md` 在盘 4,209B / `F3DBA46096658797AA938CD562C92A92`，末行 `<!-- DONE -->`，正文含 SHA 与 numstat 原文。

## 备注（不拦）

1. 两份 README 另有旧文「目标会话（文本输入，保存前校验是否存在）」（`README.md:246`、`README.zh-CN.md:209`），而 0.5.0 卡片实际是会话选择器（P22c 三列卡片 + 选择会话）——与本卡新增「可直接增删行、绑定目录与会话」自相矛盾。不在本卡 8 条范围内，建议下一步顺手改，或落 backlog。
2. 本卡未跑 `index.test.mjs`（卡面要求不跑），代码未被改动已由 ⑥ 覆盖。

## 判定

**不通过（7/8）**：第 4 条因英文标签「Included components」在宿主中不存在、中英文「最下方」与页面实际顺序不符。改这两处措辞即可，改完由我复验第 4 条，其余不用重验。

<!-- DONE -->
