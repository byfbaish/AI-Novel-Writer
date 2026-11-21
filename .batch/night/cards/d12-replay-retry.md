From: 项目总负责人 · AI writer项目组 | 5dfa8c4d
To: developer · AI writer项目组 · 群分身

# D12 开工包：短细纲注入形态锁定 + 正文「带原因重跑一次」（S1）

状态：**可投**（待群管理分身审核后派发；本包已解开 developer/QA 提的两处口径冲突，见 §1.3）
估时：改码 60–90 分钟 + 首验 30 分钟
执行方：developer；首验方：QA（A 类卡）
类型：**A 类**——会产生仓库提交，必须配派验单（已随本包落盘）

## 0.0 必读确认（主身 11-21 08:44 定的群硬规矩；缺本段不 start、不派卡）

1. **读了哪几份（路径）**：
   - `C:\develop\workspace\AI-writer\develop\README.md`
   - `C:\develop\workspace\AI-writer\develop\AGENTS.md`
   - `C:\develop\workspace\AI-writer\develop\.batch\night\org\ruling-dispatch-v6-1120.md`（`ruling-dispatch-*` 最新一版；org 下另有 v3-1117 / v4-1119 / v5-1119，均已被取代，只留档）
2. **各自版本或日期**：
   - `README.md`：2026-11-14 15:01，13,777B；正文当前版本段 `> ## v1.1.0`（`README.md:39`），中文版与 `README_en.md` 双语并列。
   - `AGENTS.md`：`charter-version: 2026-11-07`，5,633B，硬顶 ≤ 60 行 且 ≤ 4,500 字符。
   - `ruling-dispatch-v6-1120.md`：v6 · 2026-11-20 · 76 行 / 8,483B · 状态「现行」，明写取代 v5-1119（v5 5,595B / 60 行 / `e115c505e7eb543e236794368a149481`，字节不动）。
3. **据此要遵守的三条口径**：
   - **授权与提交面**：`AGENTS.md` §2 第 1、5、8 条——开工先写 `本轮授权`、未明说按最窄执行；改码那次提交同步文档且提交前 `pnpm check:fast`；并行隔离下不跑全量/`test:browser`/`test:node`。本卡据此只动 §3 白名单文件、提交前跑 §4.4 指定两条命令。
   - **不猜根因 + 换身份签字**：`AGENTS.md` §2 第 3、4 条——先取证再改、测试红先 `git stash` 对照；「干完 ≠ 完成」，自评不算通过，签字换身份（本卡自评只作交件，结论由 QA 判词给）。
   - **派活档位与回执口径**：`ruling-dispatch-v6-1120.md` §1、§2——豆包侧默认指定 `DeepSeek V4.1 Flash` 并在派活行写明推理强度档，`"model"` 行照抄界面原文（模型名与档位同控件同一行、档位为中文单字）；回退「自动」档须在派活档位同段括号内写 `（回退原因：<一句>）`。本卡不经豆包派活，故这条只作本组通用口径确认；本卡自身的模型/工具约束见 §0 末行与 §7。

## 0.1 外派位（主人 11-21 定；本卡逐卡写明）

- **本卡外派位：不可外派。** 主身原文（11-21 19:07）：「不可外派：实机复验须在 develop 由 developer 执行（AGENTS 第 8 条：worktree 禁全量／test:browser／test:node）」。外派只接静态活（读码给复现步骤、写取证脚本、静态核对判据字段是否可判），不碰运行环境、不装依赖、不切 ABI。
- **已撤回**：WorkBuddy 外派件 `.batch/night/staging/d12-live-verify-workbuddy-dispatch.md` 作废，仅留作 S2 外派模板参考，不再执行；wt-2 内已产生的 `node_modules`/`dist`/`dist-electron` 不再使用、不合回主区、不进仓库。
- **实机取证归属**：§4.3 全部由 developer 在 develop 内跑并贴命令原文与输出摘录；判定归 QA 与项目总负责人。
- **回执地址**：`C:\develop\workspace\AI-writer\develop\.batch\night\bridge\to-owner`（`.batch\night\bridge\` 下；工作区根无 `bridge\` 目录）。投递须有 resolved/delivered 留痕。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\develop`。**本卡是主工作区卡，明写允许在此改码**：S1 期间只有 developer 一个改码方（QA 只读、其他人不碰仓），且实机验收脚本 `scripts/draft-generation-startup-acceptance.mjs` 依赖本工作区既有 `node_modules`；另建 worktree 需重装依赖、无法直接跑该脚本。
- 分支：`card/d12-replay-retry`，起点 HEAD **`89ec7014`**。
- 开工第一动作逐条核，任一不符即停手（回执照抄实质输出，不自行换目录）：
  1. `git rev-parse --show-toplevel` ＝ `C:/develop/workspace/AI-writer/develop`（规范化后比较）。
  2. `git branch --show-current` ＝ `card/d12-replay-retry`（新建分支后核）。
  3. `git rev-parse --short HEAD` ＝ `89ec7014`。
  4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` **双空**；另读 `git diff --cached --numstat` 为空。
  5. `git -c core.quotepath=false status --porcelain=v1`：首列不得出现 `M/A/D/R/U`；`??` 项**只允许这两条**（本卡与派验单，收口前保持未跟踪，不要 `git add`）：
     - `?? .batch/night/cards/d12-replay-retry.md`
     - `?? .batch/night/review-requests/d12-replay-retry.md`
  6. 目标文件存在：`git ls-files src/services/workflows/commands/generate-draft.command.ts src/shared/draft-short-outline.ts src/services/workflows/chapter-materials.ts` 三条都有。
- 禁：`pnpm install` / `pnpm rebuild` / `pnpm dev`（切 ABI 会打断别的槽位）；禁 `push` / `tag` / `publish` / 合并（push 只由主身做）。

## 1. 起因与口径裁定

### 1.1 现场事实（本包逐条核过现头 `89ec7014`）

| # | 事实 | 证据 |
|---|---|---|
| 1 | 短细纲已只收「上一章要点（整份）+ 结尾 ≤300 码元」，不收全文 | `generate-draft.command.ts:1205-1224`（`:1212` 调 `draftShortOutlinePredecessor`，`:1216` 显式传 300）；`draft-short-outline.ts:58` 常量＝300 |
| 2 | 正文链路仍收上一章**全文**且 `required`、不参与裁剪 | `chapter-materials.ts:608-624`（`:620` `isRequired = source === predecessorSource`，`:621` `passages = isRequired ? [source.content] : …`） |
| 3 | 重演判据存在：上一章结尾 1,000 码元窗口 vs 新章开头 1,200 码元，CJK 8 字 / 英文 20 字 ngram，连续覆盖 ≥80 码元 | `generate-draft.command.ts:361-402`；常量 `:103-106`；`chapter-materials.ts:249` `PREVIOUS_ENDING_MAX_CHARS = 1_000` |
| 4 | 命中后直接抛错，**零重跑** | `generate-draft.command.ts:1616-1621`；全仓无正文重跑入口（developer 已核） |
| 5 | 首稿在判定前已 `compose-visible`（可见组成不可回退） | 定义 `:1347-1362`（`:1355` 调 `generation:compose-visible`）；调用点 `:1506` |
| 6 | 群管理分身早前引的 `:1142-1144`、developer 引的 `:1149-1155` 都不是注入点——现头该处是材料容量超限的 catch 块 | `:1141-1154` 实读 |

### 1.2 缺陷稿现状与冲突

`docs/design/product/live-pipeline-acceptance-defects-assessment.md:62` 现写 D12「✅ 结案（2026-11-08 · 判为 9B 模型弱点、非 App 缺陷；修法 `ba3d4bc5`）」。而 S1 done-when 要求「D12 转 ✅ + 带原因重跑一次成功」。QA 指出二者字面打架，要求二选一。

### 1.3 裁定：不是 (a) 全推翻，也不是 (b) 只补验证，是「结论修订、按两半条重开」

- **半条①注入形态**：R6 已在现头，缺陷现象（短细纲收全文）**不复现**——11-08 这一半判断不推翻。但它从未实机验证、无单测锁定注入形态，缺陷稿的 ✅ 依据是直连复跑（模型弱点），不是链路实机。⇒ 本轮补「单测锁定 + 实机读数」，语义不改（要点不封字、整份带入，见 §2.1）。
- **半条②失败处理**：11-08 的「模型弱点」结论只解释「模型会重演」，**不覆盖「命中后一次都不重跑」**——后者是 App 侧行为缺口，现头确实没有入口。⇒ 按 App 缺陷补，这是本轮唯一新增行为。
- **状态口径**：D12 由 ✅ 降 **🟡（重开）**，在分支首个提交里改（逐字文本见 §2.3）；QA 判词通过后由**产品经理**按判词转 ✅ 并附 evidence 路径，执行方不得自行转 ✅。
- 范围纪律：D12 与 D13 的「失败留草稿/恢复候选」**不是一件**，本卡不碰候选语义；D8、D6 不碰。

## 2. 要改成什么（唯一口径）

### 2.1 短细纲注入形态（锁定，不新增话术）

短细纲这一步**只允许**收到以下四块，顺序即现状：

1. 本章蓝图投影 JSON（`toBlueprintProjection`，只含本章）——`:1207`
2. 【前驱状态】：上一章要点 + 上一章结尾片段——`:1212-1217`
3. 【分段预算】（代码按 `keyEvents[].estimatedUnits` 折算）——`:1219` 起
4. 【本章执行合同】rules——`:1218`

额度（两条互不挪用）：

- 结尾片段 ≤ **300 码元**（`DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS`，作者 11-04 裁定）。**禁改** `previousEnding` 的 1,000（那是开头重演守卫的判据窗口，`chapter-materials.ts:249`）。
- 要点**不设上限**（口径 v3，2026-11-21 群管理分身裁定后由负责人定稿）：整份六栏要点原样带入，现状行为不变（来源 `generate-draft.command.ts:2680-2681`，`chapterNotes.trim()`），**不写任何截断逻辑**。
  - 理由：要点本身就是摘要（实测常见 394 字 / 丰富 576 字），封 300 会整栏丢 `## 伏笔与钩子`、把 `## 角色动态` 切在行中间——是拿产出质量换判据，而 D12 要证的只是「短细纲不带上一章正文」，与要点长短无关。
  - 改为**结构性判据**（§4.1）：六栏标题全在、角色动态表行数不变、伏笔与钩子条目数不变、正文片段不在场。
  - 观测不设阈：实机与交件报 `notesBlockUnits`，仅作记录，不判红。

**不注入**（逐条，出现即判错）：

- 上一章全文或任何其他章的定稿正文；
- 书级设定池、参考作品、文风要求、全局写作要求、黄金第一章法则、AI 味反制（P0-1 已裁，见 `docs/design/prompt/p0-1-short-outline-scoping-design.md` §6）；
- 作者本章指导的独立块（只在蓝图 JSON 内承载，`:1206` 注释）。

**正文链路不动**：上一章全文仍 `required`、不裁、按 B1 置尾（`chapter-materials.ts:621`、`:832-834`）。本卡不得把 R6 抄到正文路径。

### 2.2 「带原因重跑一次」的产品语言与落点

**语义一句话**：正文首稿被判「开头重演上一章结尾」时，不直接丢弃，而是把**判法**（不是例子）作为一段【修正说明】追加到同一份请求里，整章重写一次；仍命中才按现行为落候选。

**开在哪一层（唯一口径）**：`generate-draft.command.ts` 正文生成轮内、**`acknowledge()` 之前**——即在 `initialVisibleDraft` 已算出（`:1493` 一带）、`await acknowledge(...)`（`:1506`）之前判定与重写；不得放在 catch 之后另起工作流，也不得新开 IPC/新表/新列。

理由（写进判据）：`generation:compose-visible` 只增不改（`R:646-655` 契约），首稿一旦 compose，重跑文本只能追加，产出「重演开头 + 新开头」的拼接稿，比丢弃更差。因此重跑必须在 compose 之前完成，最终**只 compose 一次**，`artifactIds` 只含最终采用那一稿。

**触发条件**：`!recovery?.composition`（非续跑恢复）且首稿命中 `hasSubstantialPreviousChapterReuse`（判据函数不改阈值）。续写/压缩轮**不触发**（它们只追加，开头来自首稿）。

**次数**：1 次。第二次仍命中 → 不再重跑，走既有失败路径（`:1616-1621`）。

**原因文本（逐字，落第 2 次请求的最后一块；中英各一版，占位符由判据统计填入）**：

```
【修正说明】上一稿开头与上一章结尾连续重合 {runs} 处、共 {units} 字。请整章重写：从上一章最后一个动作结束之后的时间点起笔，只写本章新发生的事件；不得复述、确认或回放上一章已经发生的事件、动作与意象，也不得摘要上一章。
```

```
[Correction] The previous draft's opening overlapped the previous chapter's ending in {runs} run(s), {units} units in total. Rewrite the whole chapter: start at the moment after the previous chapter's last action and write only what happens in this chapter. Do not retell, confirm, or replay any event, action, or imagery already completed in the previous chapter, and do not summarize it.
```

红线：`{runs}`/`{units}` 只放数字；**不得**把被判废正文或上一章原文的任何片段贴回去（例子会被逐字抄成内容）。

**「原因落哪」**：不新增表列、不新增 IPC。
1. 真实请求体（第 2 次 `messages`）——由既有 prompt trace 与合成验收捕获取证；
2. 一行日志：`检测到开头重演（{runs} 处 / {units} 字），已带原因整章重写一次`；
3. attempt 序列自然多一条 `purpose=chapter-draft-no-progress-recovery`（**口径 v5，2026-11-21 裁定**：主进程 `electron/services/main-generation-owner.ts:590-630` 要求第二次 `chapter-draft` 的 messages 与首稿深度相等，附加【修正说明】即抛 `GENERATION_MATERIAL_PROMPT_MISMATCH`；放行的只有 continuation / no-progress-recovery / condense 三种，取语义最近的 no-progress-recovery，不改主进程）。`attemptedPurposes` 随之多这一项。

**重跑请求本身失败（provider/网络）**：不丢首稿——回退用首稿继续既有流程，日志记一行「重写请求失败，沿用首稿」，最终仍由 `:1616` 闸按现行为处置。

**预算**：重跑受既有生成预算约束（`O:187-198` 口径），预算不足则**不重跑**、直接按现行为失败；不得为重跑放宽预算。

**作者可见（第二次仍失败时）**：错误文案在现文案后补一句「已自动重写一次仍未通过」并带 `{runs}/{units}`；`chapter-failure.ts:115-120` 的 `detail/suggestions` 文案不动。

### 2.3 分支首个提交须改的缺陷稿（逐字，替换 `:62` 整行）

```
| D12 | 阻塞 | 🟡 **重开（2026-11-21 · S1）**：注入形态已由 R6 落地、待实机锁定；命中后「零重跑」为 App 侧缺口，本轮补「带原因重跑一次」 | 正文重演被丢弃且无重试、无回流。**两半条**：① 注入形态——短细纲只收「要点整份 + 结尾 ≤300」，不收上一章全文（R6，现头 `generate-draft.command.ts:1205-1224`）；正文链路仍按 R2/R3 收上一章全文（`chapter-materials.ts:608-624`，required 不裁）。② 失败处理——重演命中后按判法（不给例子）整章重写一次，仍命中才落候选。11-08 的「9B 模型弱点」结论只解释「模型会重演」，不覆盖「命中后零重跑」。判据与证据见 `.batch/night/cards/d12-replay-retry.md` | `generate-draft.command.ts:361-402`（判据）、`:1616-1621`（拦截）、`:1347-1362`（compose）；`draft-short-outline.ts:58`（300） |
```

同段末追加一段（不超过 8 行）：

```
> **2026-11-21 S1 重开口径**：11-08 结案依据为直连复跑（3 干净/5 重演/2 失控），只证明「模型会重演」，未覆盖「命中后零重跑」，且注入形态从未实机锁定。本轮按两半条补齐：注入形态补单测 + 实机读数；重跑补一次带原因整章重写。验收证据见 `.batch/night/reports/d12-replay-retry-qa-firstcheck.md` 与本卡 §4。
```

## 3. 落点与禁改区【硬】

- 改：
  - `src/services/workflows/commands/generate-draft.command.ts`：重演判据的统计化（新增返回 `{runs, units}` 的纯函数或扩展原函数，原布尔包装保持语义）、`acknowledge` 前的一次重写 + 修正说明拼接；`:1616-1621` 现有闸**保留**作兜底。
  - `src/shared/draft-short-outline.ts`：**本卡不改要点逻辑**（口径 v3 撤掉上限）。仅当为满足 §4.1 结构断言需要导出辅助（如栏名常量）时才动，且不改 `DRAFT_SHORT_OUTLINE_PREDECESSOR_TAIL_CHARS = 300` 的语义。
  - `src/services/workflows/chapter-materials.ts`：**不改**。要点文本来自 `generate-draft.command.ts:2680-2681`（`predecessorNotes` 直接用 `chapterNotes.trim()`），取数侧无截断职责；确需动该处先报负责人，不得自行扩大范围。禁改 `:608-624`、`:249`。
  - `docs/design/product/live-pipeline-acceptance-defects-assessment.md`：只改 §2 表 D12 行 + D12 段末追加，逐字按 §2.3。
- 补测试：
  - `src/shared/__tests__/draft-short-outline.test.ts`（注入形态）
  - `src/services/workflows/commands/__tests__/generate-draft.command.test.ts`（重跑）
  - `scripts/d12-replay-acceptance.mjs`（实机场景，见 §4.3）
- **禁改**：`chapter-materials.ts:608-624`（正文必需全文）、`:249`（1,000 守卫窗口）、B1 置尾顺序、`chapter-failure.ts` 既有码与 `:115-120` 文案、`draftShortOutlinePrompt` 的指令核心与既有判据句、短细纲重试通道（`:1390-1399`）、D13 候选/恢复语义、既有测试断言（含 `:833` 那条 D13 注释点名的断言）。

## 4. 验收判据【硬】（每条可指认；缺一条不通过）

### 4.1 单测——注入形态（`draft-short-outline.test.ts`）

1. **按块计（两块独立，不合并算）**：上一章 1,000 字夹具（40 段互不同句）——短细纲请求【前驱状态】中，**结尾块 ≤300 码元**；要点块**不设上限**（只报 `notesBlockUnits` 供记录）。
2. **要点结构完整（口径 v3 核心）**：用 developer 测过的两档夹具——「常见 394 字（剧情 3 条＋角色表 2 行＋1 条伏笔）」与「丰富 576 字（角色表 3 行＋3 条钩子）」——两档**完整带入**：六栏标题（`## 时间定位`/`## 空间锚点`/`## 剧情节点`/`## 角色动态`/`## 新增设定`/`## 伏笔与钩子`）全在、`## 角色动态` 表格行数不变、`## 伏笔与钩子` 条目数不变。
3. **全文不在场**：上一章**中段**（第 10–30 段）任一整句不得出现在短细纲请求里；等价机读断言：凡与上一章中段重合的连续片段 ≤ 80 码元（夹具要点用摘要、不逐字引用原文，故正常应为 0）。
4. 要点为空：只出现结尾块、无空标题。
5. 第 1 章：不出现【前驱状态】块。
6. **反向回归**：正文请求仍含上一章全文（存在 ≥301 码元连续片段）——防把 R6 抄到正文路径。

### 4.2 单测——重跑（`generate-draft.command.test.ts`）

7. 首稿重演 + 重写干净：`chapter-draft` 请求恰 2 次；第 2 次 user content ＝ 第 1 次 + `\n\n` + 【修正说明】；含 `{runs}`/`{units}` 数字；**不含**首稿任何连续 8 码元片段；`generation:compose-visible` 恰 1 次且 `artifactIds` 只含第 2 次 artifact；`generation:commit-draft` 1 次；候选 0。
8. 两次都重演：请求 2 次；commit 0；候选 1 且 `failureCode=DRAFT_PREVIOUS_ENDING_REPLAY`；错误文案含「已自动重写一次」与统计数字。
9. 首稿干净：请求 1 次，不出现【修正说明】。
10. 重写请求抛 provider 错：请求 2 次；回退用首稿继续既有流程（compose 首稿 1 次、最终闸按现行为抛）；日志含回退行。
11. 续写/压缩轮不触发重跑（构造首稿干净、合并后重演的用例：不出现第 3 次请求）。

### 4.3 实机复验（必须贴命令与输出原文）

- 命令：`node scripts/d12-replay-acceptance.mjs`（新增：复用 `scripts/draft-generation-startup-acceptance.mjs` 的 `launch/prepare/plan/generate` 与 synthetic fetch 拦截，响应序列 `['outline','replay','clean']`；真实 Electron + 真实 SQLite/LanceDB，`physicalModelRequests` 必须为 0）。
- 输出必须含以下机器可读字段（末行 JSON + `evidence.json` 路径）：
  - `endingBlockUnits` ≤ 300（结尾块）；`notesBlockUnits` 只记录、不设阈值
  - `notesSixColumnsPresent` = true、`notesTableRowsUnchanged` = true、`notesHooksCountUnchanged` = true（口径 v3 三条结构判据，缺一即不通过）
  - `outlineMidMaxOverlapUnits` ≤ 80（上一章中段 vs 短细纲请求；证明全文不在场）
  - `proseContainsFullPrevious` = true（正文首稿请求仍含 ≥301 连续片段）
  - `proseDispatches` = 2、`retryHasCorrection` = true、`retryLeaksDraftFragment` = false
  - `composeCalls` = 1、`drafts` = 1
  - `candidates` = 0，口径为「`recovery_candidates` 表内**本章**（`chapter_number = 2`）无失败候选行，报告实读计数」（该字段过去写死 `0`，本卡必须为实读，非 0 按 D 系列新增条目报，不许改判据迁就结果）
  - `endingBlock` 段非空断言：段缺失或为空串时不得把 `endingBlockUnits` 算成 0 通过，须直接判不通过（防静默 fail-open）
- 通过标准：以上全部成立，且 `evidence.json` 里两份请求体可回读（贴路径 + 字节数 + sha256）。
- 不准用「截图通过」「我跑了没问题」替代；QA 复跑同命令比对 JSON。

### 4.4 回归与门禁

- 点名套件：`pnpm test src/shared/__tests__/draft-short-outline.test.ts src/services/workflows/commands/__tests__/generate-draft.command.test.ts`
- `pnpm check:fast` 全绿。
- 既有用例不许改判、不许改断言；发现既有红先 `git stash` 对照确认是否本卡引入。

### 4.5 提交与交付纪律

- 一次点名 `git add` 只加本卡动过的文件；**不加** §0 白名单里那两个未跟踪件；禁 `-A`/`-f`/`--no-verify`/`--force`；禁 push/tag/publish/merge。
- 报告：`.batch/night/staging/d12-replay-retry-report.md`，末行 `<!-- DONE -->`；头三行按卡模板定式（第 1 行 `执行方：developer`；第 2 行取数件三元组；第 3 行 `model=… | 倍率=… | provider=…`）。
- 报告必须含：起点/终点 HEAD、`--numstat`、§4.1–4.3 每条判据的**命令 + 输出原文**、实机 `evidence.json` 路径与两份请求体 sha256。

## 5. 派验与判定

- 派验单：`.batch/night/review-requests/d12-replay-retry.md`（已随本包落盘，QA 据此开判）。
- 首验单：`.batch/night/reports/d12-replay-retry-qa-firstcheck.md`；QA 判词须逐条对 §4，含「未覆盖项」一栏。
- QA PASS 后：产品经理把缺陷稿 `:62` 转 ✅（附 evidence 路径与本判词路径）；developer 不再改该行。

## 6. 版本纪律

本卡**不另存 `.vN`**（流转件只走 git 版本）：要改就在本文件原处改，并在群里报一句改了什么。

## 7. 群管理分身派发时的两条附加条件（与本卡同级约束）

1. ~~「要点 ≤300」新增约束~~ **已撤销（口径 v3，2026-11-21）**：要点不设上限、原样整份带入，只按 §4.1 判结构完整（六栏、表行数、伏笔条目）与正文不在场。条件①（发现会丢就停手报）随本裁定关闭，developer 不必再择一处置。
2. 交件说明里须逐条答 §4，并附缺陷稿 `:62` 的 ✅→🟡 逐字替换 diff；分支不 push。

## 8. 口径 v5 裁定（2026-11-21，交件后两处偏离的裁示）

1. **重写请求 purpose 改用 `chapter-draft-no-progress-recovery`——接受，不改主进程。** 依据：`electron/services/main-generation-owner.ts:590-630` 把「第二次 `chapter-draft` 与首稿深度相等」作为不变量，附加【修正说明】必然 `GENERATION_MATERIAL_PROMPT_MISMATCH`；放行集合是 continuation / no-progress-recovery / condense（`:607`），取 no-progress-recovery 语义最近。**不授权**为了保留 `chapter-draft` 去放开主进程的相等判定——那是放宽一个防串稿不变量，超出本卡范围。附条件：①单测须断言第 2 次 `purpose` 为该值（不只断言请求次数）；②交件须写一句该 purpose 是否触发既有「无进展恢复」的可见语义（`:1626`、`:2149` 两处引用处），有副作用就报，不许默不作声；③§4.2 判据里「purpose=chapter-draft」的表述以本节为准。
2. **缺陷稿行号不另开订正提交。** 卡面与缺陷稿里的 `generate-draft.command.ts` 行号一律是**起点 `89ec7014` 基线引用**，不是活指针；`1d08ba08` 之后的偏移在报告里标注即可。理由：行号随每笔提交漂移，逐笔订正会把流转件变成行号台账，代价大于收益；引用的语义（判据函数、拦截点、compose 调用）比行号稳定。
