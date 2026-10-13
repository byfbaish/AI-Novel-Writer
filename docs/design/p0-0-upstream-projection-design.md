# P0-0 上游章级投影 · 小设计稿

> **状态**：**已裁定并实施**（2026-10-13 作者拍板 3 项 → 代码已落地，见 §9 实施记录）
> **日期**：2026-10-13
> **上位文档**：`docs/design/prompt-payload-scoping-design.md`（§7.1-B-1 指向本文；缺口证据见其 §7.0.5-C3/C4）
> **一句话**：上游（蓝图 / 大纲）拿到的是**全书未投影的档案**，而正文侧早已做了章级投影——同一份数据，两条链处理口径不一致。

---

## 0. 结论先行

| | 蓝图侧（P0-0a） | 大纲侧（P0-0b） |
|---|---|---|
| 全量变量 | `novel_architecture`（含 `synopsis` 全量章级条目） | `plot_structure_guide`（弧光结构全文） |
| 实测量级 | 9,752 字 / 7 章（另一轮 15,917 字 / 33 章） | **12,513 字 / 全书 185 章** |
| 本步实际需要 | 设定段 + **本批章**大纲 + 前序梗概 + 后续边界 | **本批所处弧**的规格 + 前后弧骨架 |
| 能否照抄正文侧 | ❌ **不能**（见 §2） | ❌ 不能（语义相反） |
| 采用做法 | 三段切分（§3） | 分级裁剪，**B 档**（§4.2，作者裁定） |
| 风险 | 低（有 `chapter_list` 兜底 + 现成函数可复用） | 中（弧光是作者规划事实源） |

---

## 1. 缺口定位

### 1.1 蓝图侧 P0-0a

**组装点**：`src/services/workflows/directory-workflow.ts:361-372`

```ts
const parts: string[] = []
if (core.premise && core.premise.length > 50) parts.push(core.premise)
if (core.charactersArch && core.charactersArch.length > 50) parts.push(core.charactersArch)
if (core.worldbuilding && core.worldbuilding.length > 50) parts.push(core.worldbuilding)
if (core.synopsis && core.synopsis.length > 50) parts.push(core.synopsis)   // ← 全量，零投影
context.data.architecture = parts.join('\n\n---\n\n')
```

**消费点**（两条路径共用这一份，故改一处即全覆盖）：
- `directory.command.ts:391` `.withNovelArchitecture(architecture)` → 批量路径（`chapter_blueprint` / `chapter_blueprint_chunk`）
- `directory.command.ts:218` `architecture: input.architecture` → compact 单章路径（`chapter-blueprint-directory:compact-single`）

**对比正文侧**：`generate-draft.command.ts:1911-1934` 的 `readArchitecture()` —— 同样拼 `premise` / `worldbuilding`，但 synopsis 走 `synopsisSettingSectionsForDraft()`（剔章级）。

### 1.2 大纲侧 P0-0b

**赋值点**：`src/services/workflows/commands/architecture.command.ts:2135` 与 `:2407`

```ts
.withPlotStructureGuide(withArcPositionGuide(guide, core?.plotStructurePlan, totalChapters, from, to, writingLanguage))
```

**`guide` 来源**：`architecture.command.ts:1955`
```ts
const guide = resolveStageStructureGuide(core?.plotStructurePlan, config.plotStructure, totalChapters, writingLanguage)
```
（`architecture-workflow.ts:360-369`：作者自由弧优先，否则回退枚举模板）

**现状**：`withArcPositionGuide`（`src/shared/arc-position.ts:195`）**只追加**一个【本批所处弧位】块，`guide` 原文**一个字不删**。

> ⚠️ 注意区别：**大纲的章级条目已按范围投影**（`renderPlotOutlineRange`，`src/shared/plot-outline-contract.ts:243`）。本缺口说的是**弧光结构**（大弧/中弧骨架）那份，不是章大纲。

---

## 2. 关键前提：三段切分（本轮调研的核心认知）

**一开始的设想是"照抄正文侧，把章级条目全剔掉"——调研后确认这是错的。**

### 2.1 正文侧为什么能"全剔章级"

`synopsisSettingSectionsForDraft` 的注释（`generate-draft.command.ts:98-109`）写得很清楚：分层是 **弧光 → 情节大纲 → 章节蓝图 → 正文**，大纲的章级条目与本章蓝图**说的是同一件事**，两者并排进 prompt 且无优先级声明时，模型会在两份表述之间**自由取舍**。而章级内容的**权威载体在下游**（蓝图 / `chapter_info`）→ 上游那份是**冗余**，剔除是纯收益。

### 2.2 蓝图侧为什么不能照抄

对蓝图步骤而言，**大纲的章级条目是它的「上游输入」，不是冗余**：

```
弧光(结构) → 情节大纲(章级条目) → 章节蓝图 → 正文
                  ↑                    ↑
            这是蓝图的"输入"      这是章级内容的"权威载体"
```

**剔了，蓝图就失去了本步的依据**（模型不知道这一章要发生什么）。

### 2.3 三段结构与各自策略（★ 本设计的核心）

把 `synopsis` 的章级条目按与本批范围 `[n, m]` 的关系切成三段：

| 段 | 章号 | 与下游关系 | 建议策略 | 依据 |
|---|---|---|---|---|
| **前序** | `1 … n-1` | 已由 `chapter_list` 承载 | **剔除**（但只剔 `chapter_list` 实际覆盖的章） | `chapter_list` = `previous.slice(-100)`，每章 `第N章 标题：keyEvents`（`directory.command.ts:383-390`） |
| **本批** | `n … m` | **本步的输入** | **原样保留** | 蓝图的职责就是细化它 |
| **后续** | `m+1 … end` | 蓝图不该规划 | **降级为边界声明**（章号 + 标题，不含事件细节） | 保留"往哪去"的钩子感，同时不给细节以免诱发越界 |

**顺带收益**：前序段与 `chapter_list` 是**同一批章节的两种表述**（大纲版 vs 蓝图版，§7.0.6-C3 已登记的重叠），本改造**精确消除了这个重叠**——而且保留的是**蓝图版**（与实际已生成内容一致），不是大纲版。

**⚠️ 一处必须精确的地方**：`chapter_list` 窗口是 `slice(-100)`。超过 100 章的项目，**更早的前序章不在 `chapter_list` 里** → 那些章的大纲条目**不应剔除**（否则信息净损失）。故剔除范围必须 = `chapter_list` 实际覆盖的章号集合，**不能简单写成"所有 n 之前的章"**。

---

## 3. P0-0a 设计（蓝图侧）

### 3.1 落点

`directory-workflow.ts:365` 一行（以及从 `core.synopsis` 取值的边界处理）：

```ts
// 现状
if (core.synopsis && core.synopsis.length > 50) parts.push(core.synopsis)
// 目标
const projected = projectSynopsisForBlueprint(core.synopsis, { from: n, to: m, coveredChapters })
if (projected) parts.push(projected)
```

### 3.2 复用与新增

**可复用**（现成资产，成本低）：
- `parseChapterHeading`（`generate-draft.command.ts:83`）—— 章标题解析，支持 `## 第N章` / `第N-M章` 范围 / 中英双语；
- `projectSettingSections`（`:118`）—— 解析失败即**整体原样返回**的保守姿态；
- `synopsisSettingSectionsForDraft`（`:110`，**已导出**，`plot-outline-contract.test.ts` 已在跨模块使用）。

**需新增**：
- `projectSynopsisForBlueprint(synopsis, { from, to, coveredChapters })` —— 在 `projectSettingSections` 的同一套解析上，做**三段切分**（而非一刀切）。
- **建议落点**：提取到 `src/shared/`（与 `arc-position.ts` 同层），由正文侧与蓝图侧**共用同一份解析器**，避免两处口径漂移。⚠️ 提取会动 `generate-draft.command.ts` 的导出面，需跑 `plot-outline-contract.test.ts` + `generate-draft.command.test.ts`。

### 3.3 待确认的前提（实施前必做）

**`n` / `m` 在 `directory-workflow.ts` 的组装步骤里是否可得？**
- `n` / `m` 目前是 `directory.command.ts` 里按批次算出的（`batchStart` / `batchEnd`，`:380-391`），**不一定在 workflow 的"读取架构"步骤里可见**；
- 若不可得 → 两个选择：① 投影下移到 `directory.command.ts` 的调用点（`n`/`m` 已在手）；② 把范围从 workflow 传下来。
- **倾向 ①**：改动更局部，且 `chapter_list` 也在同一函数内构造，三段信息同处一室。

### 3.4 风险

| 风险 | 评估 |
|---|---|
| 剔除前序后蓝图"忘了前文" | **低**——`chapter_list`（前 100 章）+ `recentBlueprints`（`COMPACT_RECENT_BLUEPRINTS = 3`，`directory.command.ts:185`）双兜底 |
| 后续降级后 `suspenseHook` 质量下降 | **待裁定**（§7-2）——若作者认为钩子需要"下一章要发生什么"，可只对 `m+2` 之后降级 |
| 作者手写大纲非标准章标题 | **低**——`projectSettingSections` 解析失败时**整体原样返回**（宁可多留） |

---

## 4. P0-0b 设计（大纲侧弧光）

### 4.1 现成资产（比预想的更充分）

`src/shared/arc-position.ts` **已有完整骨架**：

| 能力 | 函数 | 说明 |
|---|---|---|
| 解析大弧/中弧 + 规格字段 | `parseArcStructure` | 拿不到章数的条目丢弃；**一个有效大弧都解析不出 → 返回 `null`** |
| 章数折算 | `scaledBoundaries` | 弧光自报章数 ≠ 全书章数时按比例折算并声明 |
| 定位本批弧位 | `arcSpanForChapters` | 产出 `ArcSpan`（本大弧 / 本中弧 / **`remainingMids`**） |
| 渲染注入块 | `renderArcPositionBlock` | 已有【硬约束·防提前】 |

**关键**：`ArcSpan.remainingMids` 已经是"**后续中弧的降级形态**"（`name` + `range` + `gist`，`gistOf` 取"因果/目标/动机"字段并截 90 字）—— **"后续降级"这条已现成**。

**需新增**：`前序中弧`的降级形态 + `其他大弧`的降级形态。

### 4.2 三档裁剪尺度（★ 待作者裁定）

| 档 | 本中弧 | 本大弧内其他中弧 | 其他大弧 | 省下（估） |
|---|---|---|---|---|
| **A 最省** | 全字段 | 名称 + 范围 + gist | 名称 + 范围 | 最多 |
| **B 推荐** | 全字段 | 名称 + 范围 + gist | 名称 + 范围 + **接续理由** | 多 |
| **C 保守** | 全字段 | **全字段** | 名称 + 范围 + 接续理由 | 中 |

**推荐 B 的理由**：大弧之间的**接续逻辑**（"为什么从弧一走到弧二"）是作者的规划意图，压成"名称+范围"会丢因果；而中弧之间的接续在 `gist` 里能保住。C 档基本只解决"其他大弧"这一半，收益不足；A 档会丢大弧接续理由。

**⚠️ 实现细节**：`SKIP_FIELDS`（`arc-position.ts:68`）**已把「接续理由」排除在 `fields` 外**。B 档要保留它，需**调整 `SKIP_FIELDS`** 或单独提取该字段——这会改变 `ArcSpan.midFields` 的现有语义，**需同步检查 `arc-position.test.ts`**。

### 4.3 与弧位块的关系

裁剪后**继续追加**弧位块（`withArcPositionGuide` 不变）——两者**同源**（都用 `parseArcStructure`），不会打架：
- 裁剪 = 减少"给什么细节"；
- 弧位块 = 声明"你在哪、不许提前"。

**天然安全边界**：作者若用**枚举故事结构**（`three_act` 等），`parseArcStructure` 返回 `null` → **不裁剪、不注入**，行为与现状完全一致（`architecture-workflow.ts:368` 的回退分支即此形态）。

---

## 5. 失败姿态：宁可多留（沿用正文侧纪律）

两条链共用一条纪律（`generate-draft.command.ts:108` 原文）：

> 结构无法可靠解析时整体保持原样：**宁可多留，也不猜着丢作者事实。**

具体触发条件（沿用 `projectSettingSections` 现有判定）：
- 含代码围栏（` ``` `）→ 原文返回；
- 一条章标题都没有 → 原文返回（老项目手写大纲形态）；
- 标题层级不一致 / 章号非严格递增 → 原文返回。

---

## 6. 实施顺序与验收

**顺序**：先 a 后 b。
- **a**：风险低、可复用现成函数、有 trace 可对照 → 可直接实施（改完跑 §6 验收）；
- **b**：需作者先定裁剪尺度（§7-1），且要动 `SKIP_FIELDS` 语义 → 先定档再动手。
  → ✅ 已定 **B 档**；实际实现**未动 `SKIP_FIELDS`**（改为在裁剪函数里按行单独识别接续理由），故该风险已消解。

**验收方法**（与既有取证口径一致）：
1. 跑一次**蓝图**（`chapter_blueprint_chunk`）与**大纲**（`synopsis`）生成，留 trace；
2. 比对 **`ioCalls[].messages[].content` 的长度差**（⚠️ **不看 `snapshots[].built`** —— 代码会追加块，实测差 7,093 字，见主稿红线 15）；
3. 逐项确认：设定段仍在、本批章条目仍在、前序段仅剔 `chapter_list` 覆盖范围、后续段降级为边界；
4. 新增单测：复用 `generate-draft.command.test.ts:68-115` 的四个既有用例形态（正常剔除 / 无设定段 / 歧义原文保留 / 散文误判）。

---

## 7. 作者裁定（2026-10-13，已生效）

| # | 问题 | 裁定 | 落地 |
|---|---|---|---|
| 1 | P0-0b 裁剪尺度 | **B 档**（其他大弧保留"接续理由"） | ✅ `projectArcStructureText` |
| 2 | P0-0a 后续段降级起点 | **`m+1` 起即降级**。⚠️ **本档为初始选择，可能根据实际效果优化为 `m+2` 起**（保留"下一章"给章末钩子）——若 `suspenseHook` 质量下降即回退到 `m+2` | ✅ `boundaryNotice` 对所有 `from > to` 的章生效 |
| 3 | `charactersArch` 是否投影 | **单独立项，后续详细讨论**（作者判断"蓝图按理说只需要本章出场角色"）。本文**不做**，保持全量 | ⏸ 未实施，已登记 |

裁定 2 的可调点已写进代码注释与单测，回退成本 = 改 `projectSynopsisForBlueprint` 里一个比较符（`heading.from > options.to` → `heading.from > options.to + 1`）+ 同步断言。

---

## 8. 本次不纳入

- **弧光本身的语义改写**（只做裁剪，不改作者原文措辞）；
- **跨链统一解析器**的完整重构（只在 §3.2 建议提取共用，不做全库梳理）;
- **`novel_architecture` 的其它段**（`premise` / `worldbuilding` 保持全量——它们是设定事实源，与章级无关）；
- **正文侧已有投影的复核**（本轮不改正文链）；
- **`charactersArch` 投影**（作者裁定单独立项，见 §7-3）。

---

## 9. 实施记录（2026-10-13）

**新增文件**
- `src/shared/synopsis-projection.ts`：把章标题解析 / 投影从 `generate-draft.command.ts` 抽到 shared，**正文链与蓝图链共用同一份解析器与失败姿态**（避免两处口径漂移）。导出 `synopsisSettingSectionsForDraft`（正文侧，行为与原实现逐字等价）、`projectSynopsisForBlueprint`（蓝图侧三段切分）、`renderBlueprintArchitecture`（只投影 `synopsis` 段）、类型 `BlueprintArchitecturePart` / `BlueprintSynopsisProjectionOptions`。

**改动文件**

| 文件 | 改动 |
|---|---|
| `src/services/workflows/commands/generate-draft.command.ts` | 删除内联实现（原 76–153 行），改为 import + re-export（保留既有导入面：`plot-outline-contract.test.ts:4` 直接引用本模块） |
| `src/services/workflows/directory-workflow.ts` | `parts` 改 `BlueprintArchitecturePart[]`；同时写 `context.data.architectureParts`（结构化）与 `context.data.architecture`（字符串兜底，只认字符串的读取方行为不变） |
| `src/services/workflows/commands/directory.command.ts` | 批量路径 `buildTask` 与 compact 单章 `compactTaskFor` **两条路径都投影**；`coveredChapters` 取自本批 `chapter_list` 实际覆盖的章号集合（`previous.slice(-100)`）；无 `architectureParts` 时不做投影（旧调用方/测试行为不变） |
| `src/shared/arc-position.ts` | 新增 `projectArcStructureText`（B 档分级裁剪）、`withProjectedArcGuide`（裁剪 + 弧位块）；`pickGistLine` / `isContinuationReasonLine`；原 `withArcPositionGuide` 保留未动 |
| `src/services/workflows/commands/architecture.command.ts` | 两处 synopsis 注入点（`:2135` 正常/批量、`:2407` 断点续写）改用 `withProjectedArcGuide` |

**B 档裁剪的实际形态**（`projectArcStructureText`）

| 位置 | 保留 | 依据 |
|---|---|---|
| 首个大弧之前的引言 | 原样 | 篇幅预算等全局声明 |
| 本中弧 | **全字段** | 本批的执行依据 |
| 本大弧内其他中弧 | 中弧标题 + **一句话定位**（与 `ArcSpan.remainingMids` 同形） | 防提前需要"知道后面有什么"，不需要细节 |
| 其他大弧 | 大弧标题 + **接续理由** | 弧间推进是作者规划意图（B 档相对 A 档的全部增量） |

⚠️ 实现说明：`SKIP_FIELDS`（`arc-position.ts:68`）**已把「接续理由」排除在 `midFields` 外**，故 B 档没有改 `SKIP_FIELDS`（那会改变 `ArcSpan.midFields` 的既有语义并波及 `arc-position.test.ts`），而是**在裁剪函数里单独按行识别**接续理由。`arc-position.test.ts` 既有 8 例全部保持通过。

**天然安全边界**：作者用枚举故事结构（`three_act` 等）时 `parseArcStructure` 返回 `null` → 不裁剪、不注入，行为与改造前完全一致。

**验证**
- `pnpm run typecheck`（tsc --noEmit）**0 错**；
- 新增单测 **28 例**（`src/shared/__tests__/synopsis-projection.test.ts` 11 例 + `arc-position.test.ts` 新增 9 例）；`arc-position` 17/17、`synopsis-projection` 11/11、`generate-draft.command` 209/209、`plot-outline-contract` 20/20；
- 回归 `src/services/workflows` + `src/shared/__tests__` + 两个 prompt 契约测试：**改动前后同为 4 文件 / 30 例失败**（`git stash` 同 ABI 对照确认**既有失败**，非本轮引入），通过数 1591 → 1600（新增测试）；
- `npx eslint` 改动文件：仅剩 2 条错误，经把 HEAD 原文拷回仓库内 lint 确认**均为既有**（`generate-draft.command.ts:300` 的 `_userGuidance`、`arc-position.ts:71` 的 `\/\[`）；全项目 lint 基线本就红（11 例）。

**未做（本轮明确不做）**：`charactersArch` 投影（§7-3）。

---

## 10. 实机 trace 取证结果（2026-10-13 晚，作者跑完一轮）

**证据源**（作者新生成，共 18 个文件）：`<项目根>/debug/prompt-trace/` 下
- `20261013-182735-610-蓝图-ch6-10-fde9e5f6.{json,md}` —— `promptKey=chapter_blueprint_chunk`，1 次调用 `chapter-blueprint-directory`（`n=6, m=10`）
- `20261013-182416-646-大纲-ch8-10-7923a61e.{json,md}` 等 4 份 —— `promptKey=synopsis`，`plot-outline:chapter:8|9|10`

### ★ 结论 1：P0-0a（蓝图侧）**已生效** ✅

| 项 | 值 |
|---|---|
| 实机 `novel_architecture` | **9,313 字** |
| 期望【投影后】总长 | **9,313 字**（精确命中） |
| 期望【未投影】总长 | 10,392 字 |
| 保留的章标题 | 仅 `## 第6章`…`## 第10章`（= 本批范围） |
| 是否含前序 `第1章`/`第5章` | **否**（已剔除，`chapter_list` 覆盖 1–5） |
| `chapter_list` 变量 | 2,216 字（前序梗概兜底，未受影响） |

投影后 synopsis 段 2,254 → **1,175 字**。逐项与设计稿 §6 验收 3 一致。

### ★★★ 结论 2：P0-0b（大纲侧）**完全未生效** ❌ —— 根因是**既有的弧标题解析缺陷**，与本轮改动无关

| 项 | 值 |
|---|---|
| 实机 `plot_structure_guide` | **12,513 字（一字节未减）** |
| `parseArcStructure(guide)` | **`null`** |
| `renderArcPositionBlock(...)` | **空串** → 连**改造前就有的弧位块也没注入** |
| 3 次调用 user message | 29,360 / 29,556 / 29,744 字，**均含弧光原文、均不含【本批所处弧位】块** |

**根因（精确到正则）**：作者生成的弧光标题是**区间格式**，而解析器只认**单值格式**。

| | 实际/夹具文本 | `MAJOR_HEADING` 捕获组 2（章数） |
|---|---|---|
| 作者真实产出 | `## 大弧一：第一个读墙的人（约 1–94 章）` | **`undefined`** |
| 测试夹具 | `## 大弧一：【规则初学】（约 100 章）` | `"100"` |

- 正则为 `（约?([0-9]+)章）` —— 只接受一个数字，遇到 `1–94` 时整个可选括号组匹配失败。
- 因 `majors.filter(item => item.chapters > 0 …)` 全部被滤掉 → `usable.length === 0` → **返回 `null`**。
- **决定性证据**：作者使用的内置模板 `src/services/builtin-prompt-templates.ts:680/704` 的**格式示范本身就写区间**：`## 大弧一：<名称>（约 X–Y 章）`；而 `### 中弧 1：<名称>（约 N 章）`（`:685`）写单值。作者产出与模板示范完全一致（大弧区间、中弧单值）。
- **→ 这不是偶发数据问题，是"模板教区间、解析器只认单值"的契约错配**：凡按模板产出的弧光，`parseArcStructure` 必然返回 `null`。
- **性质**：**既有缺陷**，`git show HEAD:src/shared/arc-position.ts` 的两个正则与本轮改动**逐字相同**（我的 diff 只新增函数，未触及这两行）。故改造前"弧位圈定"（2026-10-11 加的功能）在作者真实数据上**也从未生效过**——实测证据就是三次调用都没有弧位块。
- **验证性修复**：把两个正则的章数部分改为 `([0-9]+)(?:[\t ]*[–—-][\t ]*([0-9]+))?`（区间取 `末-首+1`），在作者真实弧光上 → **9 个大弧 / 33 个中弧全部解析成功**，章数合计 846 ≈ 全书 845（符合模板 ±10% 弹性）。修复方向已证可行，**本轮未改代码**（属新缺陷，需作者裁定后再动）。

**附带发现**：`plot_structure_guide` 变量在 `snapshots[].fragments[].variables` 里出现**两次 `step_guidance`（均为 0 字）**，与既有 trace 形态一致，非本轮引入。
