# P22c · 旧宿主分支收口（只读提示 + 文案纠正）

- 卡号：P22c
- 出卡：AI writer总负责人，2026-11-14 05:56
- 仓库：`C:\develop\workspace\dsh-handoff-relay`
- 起点：`6a28319`（P22b 最新 HEAD，测试全绿 130/130）
- 估时：**25 分钟**
- 模型：豆包自动档即可（小幅改动，不用手动指定）

## 背景（QA 首验指出的两处偏差）

P22b 的旧宿主分支（`client.js` 里 P15/P17 形态的 `RelayCard`）有两处与新口径不符：

1. **仍可编辑、仍有手填 session id 输入框**，而卡面 §3 要求旧宿主只给只读提示（用户口径：不和残次品投放；手填 id 这条路正是本期要淘汰的）。
2. 文案写「exact 表示标题完全相等（**缺省为包含匹配**）」，与 P22a 定的 `exact` 缺省 **true** 相反。

## 必做

1. 旧宿主分支改为**只读**：
   - 不再渲染任何可编辑输入框（目录 / 目标会话 / 完成规则一律不给 `input`/`select`/`textarea`）；
   - **不出现「目标会话（session id）」这类手填 id 的列头或输入框**；
   - 改为一段提示：`当前宿主版本较旧，不支持本插件的配置界面。请直接编辑 cordis.patch.yml 里的 dsh-handoff-relay 配置，重启后生效。`
   - 现有 watches 可以只读展示（真实值），但不给保存按钮、不调 `mutate`。
2. 文案纠正：把「缺省为包含匹配」改成与新口径一致的说法，例如 `exact 为 true 时标题必须完全相等（缺省 true）；填 false 则按包含匹配。`
3. 新宿主分支（`plugins.row.config` 三列卡片 + 会话选择器）**一行不动**。

## 禁动

- 只许改 `client.js` 与 `index.test.mjs`；`index.js`、`package.json`、两份 README 一律不动。
- 不新增依赖、不改版本号（仍 0.5.0）、不 commit 其他文件。
- `git add` 必须点名两个文件，禁 `-A`。

## 判据（QA 会逐条核）

1. `git diff --numstat 6a28319 HEAD` 只有 `client.js` 与 `index.test.mjs`。
2. `git show HEAD:client.js | Select-String "缺省为包含匹配"` → 0 命中。
3. `git show HEAD:client.js | Select-String "session id"` → 旧分支内 0 命中（文件里如其他地方确有出现，报告里逐处说明理由）。
4. 渲染用例：以旧宿主桩（`settingsScope.bind`）渲染，断言输出里 `input`/`textarea`/`select` 标签 0 个、且无保存按钮；断言提示文案命中。
5. `node index.test.mjs` 全绿，贴末行（当前基线 130/130）。
6. porcelain 空；`git rev-parse --short=12 HEAD` 贴原文（不要自行补全）。

## 交付

- 报告 `.batch/night/reports/p22c-legacy-readonly.md`，末行 `<!-- DONE -->`。
- **报告落盘同一分钟内**必须写信号 `p22c-legacy-readonly.done` 到派卡指定目录；写不进去要立刻明说，不许沉默。
## 投递指令（联络人 2026-11-14 05:58 投前核对）

投前基线（我实跑）：HEAD `6a283196f083`、`git status --porcelain` 空。

- **只许改** `client.js` 与 `index.test.mjs`；`index.js`、`package.json`、两份 README 一律不碰；`git add` 点名这两个文件，禁 `-A`。
- 新宿主三列卡片 + 会话选择器那一段**一行不动**，只改旧宿主分支与那句 exact 文案。
- 交付后**不要**再往这张卡上加提交；报告里的数字以最终 HEAD 为准，若之后 HEAD 变了，必须同步改报告与信号里的 SHA。
- **信号**：报告落盘后同一分钟内写 `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p22c-legacy-readonly.done`（三行：报告路径 / 提交 SHA / `<!-- DONE -->`）；写不进立刻在回执里说「信号未写 + 原因」。
- 判据第 5 条贴的末行读数请用最终 HEAD 实跑的原文。

回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
