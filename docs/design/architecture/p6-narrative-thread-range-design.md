# P6 落地设计稿：叙事线索候选的章区间化（档 1）与生成后建议（档 3）

> 状态：待裁定（2026-11-24）
> 日期：2026-11-24
> 依据：`docs/roadmap/ROADMAP.md` L2-PLANUI 系列；评估报告 `.batch/night/reports/planui-design-assessment.md` §3（未跟踪，仅作本轮输入）。
> 主人裁定（2026-11-24 04:39）：P6 只做**档 1（章区间 ≤10，复用 `PLANNING_ACTION_CHAPTER_LIMIT`）**与**档 3（生成后建议，必须带「已扫 N 章／剩余 M 章」进度）**；不做档 2 按单元批量。
> 项目总负责人技术裁（2026-11-24）：档 1+档 3 均取，并加约束**「档 1 开工前必须先落每章 token 预算上限，超限拒绝而非静默截断」**。
> 项目总负责人裁决（2026-11-24 第二轮）：**同意 N 次串行**（一次 10 章需 `512+3,072×10=31,232`，逼近 32,768 硬顶）；**失败即停、已产出候选整批保留可确认、记失败章号供续跑、不许自动跳过**；判据须贴每次请求的 `maxRequestedOutputTokensPerAttempt` 与累计预算原文。
> 术语：现值只有「卷 → 单元 → 章」（正本 `src/shared/arc-position.ts:142-151`）。

---

## 0. 一句话结论

候选生成器现在**一次只认一个章号**，而数据行本来就是区间（`targetStartChapter`/`targetEndChapter`）；所以档 1 不是重写生成器，而是**把区间展开成一串串行单章请求**，每章预算沿用现值的 4096，超出就拒绝该章、不截断；档 3 的进度只能由"计划区间并集"派生，**不新建扫描表**。

---

## 1. 背景（现状，文件:行）

| 现状 | 位置 |
|---|---|
| UI 只有一个"蓝图章节"单选（`第N章 · 章名`），换章要重选、重跑 | `src/components/editor/NarrativeThreadEditor.tsx:1050`（`NativeSelect`）、`:1081`（`option`）；选中章号存 `aiBlueprintChapter`（`:226`） |
| 生成器输入是**单章**：`{kind:'plan', chapterNumber: input.blueprint.chapterNumber}` | `src/services/narrative-thread-candidate-generator.ts:31-33` |
| 单次请求预算固定 4096 tokens | `src/shared/narrative-thread-generation-pure.ts:38-43`（`NARRATIVE_THREAD_CANDIDATE_BUDGET = {maxAttempts:1, maxRequestedOutputTokens:4096, maxRequestedOutputTokensPerAttempt:4096, deadlineMs:120_000}`） |
| 落库的计划行**已经是区间** | `electron/repositories/narrative-thread-repository.ts:39-40`（`targetStartChapter`/`targetEndChapter`）、`:52`（插入） |
| 章号事实源＝已定稿草稿 | `electron/repositories/narrative-thread-repository.ts:130`（取 `drafts.chapter_number`）、`:138`（`MAX(chapter_number)`） |
| 已存在的超限拒绝机制（可复用，不另造） | `src/shared/plot-outline-contract.ts:9`（`PLANNING_ACTION_CHAPTER_LIMIT = 10`）、`:20-23`（`assertPlanningActionRange` 抛 `GENERATION_PLANNING_RANGE_INVALID`） |

**问题量化**：800 章的书写到第 200 章时，作者要给每章都点一次"生成候选"，这是 200 次"选章→点生成→看候选→确认"。区间化把这一步压成"起章 + 3 章"一次动作。

**边界（不动）**：蓝图生成链路的 10 章契约与 `directory.command.ts:319`/`:341`、`src/shared/agent-generation.ts:8-11` 一律不动——P6 只动**叙事线索候选**，两件事共用"10"这个数字但不共用代码。

---

## 2. 目标 / 非目标

**目标**
1. 档 1：一次输入"起点章 + 章数 N（1..10）"，产出 N 章候选，逐章可确认。
2. 档 1 的每章 token 预算上限**写死在设计里并先于实现**：超限拒绝该章，不静默截断、不静默少生成。
3. 档 3：候选确认后，面板给出"下一段建议 + 已扫 N 章 / 剩余 M 章"。

**非目标**
- 不做档 2（按单元批量，见 §6）。
- 不改 `PLANNING_ACTION_CHAPTER_LIMIT`、不改蓝图 10 章约束。
- 不新增模型 purpose、不改请求合同字段。

---

## 3. 档 1：章区间（≤10）

### 3.1 入参与上限

- UI：两个控件替换现在的单选 —— `起点章`（数字，默认＝当前蓝图章）+ `章数 N`（1..10，默认 3）。区间＝`[起点, 起点+N-1]`。
- 上限校验**复用** `assertPlanningActionRange` 与 `PLANNING_ACTION_CHAPTER_LIMIT`（`src/shared/plot-outline-contract.ts:9`、`:20-23`）：N > 10 或越界时抛 `GENERATION_PLANNING_RANGE_INVALID`，UI 显示原文，不做"自动缩到 10"。
- 为什么不新造上限：同一产品里两个"10"必须同源，否则日后调一处必漂。

### 3.2 两种实现变体与取舍（本稿选 B）

| 变体 | 做法 | 预算 | 失败影响 | 结论 |
|---|---|---|---|---|
| **A 一次请求 N 章** | 一个 prompt 要 N 章计划 | `512 + 3072×N`（policy 见 `src/services/generation/task-budget-planner.ts:7-30`：`baseTokens=512`，`structuredItems.tokensPerItem` zh-CN planning = 3072）；N=10 → 31,232，逼近 `maxRequestedOutputTokensPerAttempt` 默认 32,768（`src/services/generation/generation-harness.ts:95-108`） | 单点失败丢全部 10 章；长输出质量衰减无证据 | 不选（v1） |
| **B 区间→N 次串行单章请求** | 复用现有单章通道（`narrative-thread-candidate-generator.ts:31-33`）与现有预算 4096/章 | 每章 4096，总量 N×4096；每请求独立，永不触碰 32,768 | 只丢一章，已生成的保留 | **选 B（v1）** |

选 B 的理由（三条，都可验证）：
1. **不改请求合同**：不新增 purpose、不改多章入参，回退面＝只回退 UI 循环。
2. **失败局部化**：第 7 章失败不影响第 1–6 章已确认的计划行。
3. **天然满足"每章预算上限"**：N 章不可能被塞进一个预算，因此"静默截断"这条风险从结构上被消掉。

> 若日后要走 A，必须先补：真实模型在 31K 输出下的质量证据 + `split-required` 分支的 UI。**在拿到证据前，A 不在实现范围。**

### 3.3 每章 token 预算上限（硬约束，先于开跑）

| 项 | 值 | 来源 |
|---|---|---|
| 单章上限 | **4096** tokens（含重试 1 次，每次同为 4096） | `src/shared/narrative-thread-generation-pure.ts:38-43` |
| 单章下限（低于此值视为"塞不下"） | 3072 tokens | `src/services/generation/task-budget-planner.ts:7-30`（zh-CN planning 每结构化项 3072） |
| 单次请求硬顶 | 32,768 | `src/services/generation/generation-harness.ts:95-108` |
| 区间总预算 | N × 4096（串行，**不是**并发合计） | 本稿 §3.2 变体 B |

**超限行为（必须写死，项目总负责人 2026-11-24 裁）**：
1. 模型输出被截断或返回 `prompt_budget_exhausted`（`src/services/generation/prompt-budget-failure.ts:8`）⇒ 该章判**失败**，`decision:'capacity-conflict'`（`task-budget-planner.ts:104-118` 的既有三态之一），UI 显示「第 7 章超出单章预算 4096，已停止；可缩小章范围或改章名后重试」。
2. **失败即停，但不丢已产出**：第 k 章失败后 k+1…N 不再发起；**k 之前已产出的候选整批保留、可逐章确认**（不是"整段作废"）。
3. **记失败章号供续跑**：UI 保存「区间起点 + 已跑章数 + 失败章号」，作者点「从这里续跑」即从失败章重开一段。v1 只在会话内记（不落库）——重开面板即丢，此时按"未扫"处理，**不伪造进度**。
4. **禁止**：自动跳过失败章继续下一章、自动减少章数、自动切短文本。跳过一章，「已扫 N 章／剩余 M 章」就开始骗人，而那句进度正是档 3 的生效前提。
5. 并发度固定为 1（串行），避免 N 倍瞬时费用与 DB 写竞争。

### 3.4 逐章确认（不合并）

每章仍产出各自的候选卡并各自确认（沿用 `NarrativeThreadEditor.tsx:1085-1100` 一带的 confirm/reject 交互）；区间只负责"一次跑出 N 章候选"，**不合并成"整段一次确认"**——整段一次确认会让作者在信息最少时做最大决策。

---

## 4. 档 3：生成后建议 + 进度

### 4.1 触发条件（三条同时成立才出现）

1. 当前单元内已有**至少一条**已确认的叙事线索计划行（`targetStartChapter`/`targetEndChapter` 非空）；
2. 该单元还有**未覆盖章**（并集之外存在章号）；
3. 当前不在生成中（避免建议条与进度条打架）。

形态：面板内**一条提示条**（不弹窗、不抢焦点），文案示例：`建议继续：第 21–23 章（3 章）· 已扫 20 章 / 剩余 12 章` + 一个「采用」按钮把起章/章数填进档 1 的控件。

### 4.2 「已扫 N 章 / 剩余 M 章」的事实源（诚实口径）

- **已扫 N**＝本单元内所有计划行的 `[targetStartChapter, targetEndChapter]` 区间**并集**的章数（`electron/repositories/narrative-thread-repository.ts:39-40`、`:52`）。
- **剩余 M**＝本单元章数上限 − N。单元章数取单元策略的 `maxChapters`（`src/shared/plot-outline-contract.ts:135-172`，注意 `:150-154` 注释：它是**名义上界**，不是产出接受带）；单元模式无 `to` 时以该值计。
- **不新建"扫描记录表"**：仓库里现在没有任何扫描台账（`narrative-thread-repository.ts` 只有计划行与事件），新区间确认即代表"这几章扫过"。
- **口径写清**：N 是"声明覆盖的章数"，不是"每章都真生成了候选"。若某章候选被作者 reject，该章仍算已扫（有决策记录）——与 O1「只核声明不核内容」同一口径，避免两处口径相反。

### 4.3 建议区间怎么算

`下一起点 = 并集右端 + 1`；`建议章数 = min(3, 剩余 M, 10)`。不做"智能跳到缺章"（缺章只在并集中间出现时才提示，提示文案改为「第 15–16 章尚未规划」）。

---

## 5. 每条：产品上改了什么／体验差异／不选的最坏后果／代价

**P6-档1**
- 改了什么：一个单选 → 起点章 + 章数；后端 N 次串行调用；失败暂停逻辑。
- 体验差异：200 章工作量从 200 次点击变成约 67 次（默认 3 章/次）。
- 不选最坏后果：作者到 300 章后因"每章都要点"而放弃写线索计划，O1 的事件进度水位就没有载体——**P6 档 1 是 O1 的前置**。
- 代价：中。UI 一处、循环与暂停逻辑一处、进度条一处；回归面在候选生成器的调用方与 DB 写入节流。

**P6-档3**
- 改了什么：面板多一条提示条 + 两个计数。
- 体验差异：作者不用自己记"我上次扫到第几章"。
- 不选最坏后果：区间功能存在但作者不知道下一步该给哪段——档 1 的使用率会掉回手动。
- 代价：低。纯读现计划行与单元策略，无写入。

---

## 6. 不做（档 2 的明确否决）

**档 2「按单元批量生成线索」不做**，三条理由：
1. 与 O1 冲突：O1 的进度水位按"章"递进，单元批量会把整个单元的章一次性判死，EV-3（不拖后）无法逐章校验。
2. 失败代价 ×N：单元 10 章一次失败＝10 章全废，而单章失败只丢 1 章。
3. 预算：单元批量请求必须 >31K 输出（见 §3.2 变体 A），当前没有任何真实模型证据支持 31K 稳定输出。

---

## 7. 验收判据（分层）

| # | 层 | 判据 | 证据 |
|---|---|---|---|
| 1 | [static] | 区间入参校验复用 `assertPlanningActionRange`；N=0/11/越界各抛 `GENERATION_PLANNING_RANGE_INVALID` 且文案含上限值 | 单测 + `tsc` EXIT=0 |
| 2 | [static] | 串行执行器：N 章按顺序调用，第 k 章失败后 k+1 不再发起，已成功章的计划行仍在 | 单测（注入假生成器） |
| 3 | [mock] | 每章预算 = 4096 且不受 N 影响；总请求数 = N；每次请求的 `maxRequestedOutputTokensPerAttempt` 原文贴出为 4096 | 单测断言调用参数 + 参数原文 |
| 3b | [static] | 预算算式可复核：单章 policy ＝ `512 + 3,072×1`（`src/services/generation/task-budget-planner.ts:10-24`），N 章串行累计 ＝ `N×4096`；一次请求 N 章的算式 `512+3,072×N`（N=10 → 31,232）与单次硬顶 32,768（`src/shared/provider-presets.ts:106`、`:118`）的对比写进实施包 | 算式原文 + 两个文件行号 |
| 4 | [mock] | 档 3 计数：给定区间并集 `[11-20]`、单元上限 32 ⇒ `已扫 10 / 剩余 22`；空计划 ⇒ 不显示建议条 | 纯函数单测 |
| 4b | [mock] | 失败即停：第 2 章失败后第 3 章不发起；第 1 章候选仍在可确认；UI 记录失败章号并可续跑 | 单测（注入假生成器） |
| 5 | [live] | 真实 Electron + 真实 SQLite：N=3 跑完，库内出现 3 条计划行，`targetStartChapter/EndChapter` 与输入一致；中途 kill 后已落库行不丢 | 一卡一脚本 + 库读原文 |
| 6 | [live] | 单章超预算：构造 4096 上限下必须截断的输入，UI 显示"第 k 章超出单章预算…已停止"，后续章未发起 | 同上 + 日志原文 |

---

## 8. 开放问题（交项目总负责人核、主人裁定）

1. 默认章数 3 是否合理（3 章 ≈ 3×4096 输出、约 2–4 分钟）？成本与体验的折中点需一次真机计时。
2. 档 3 建议是"提示条"还是"打开面板时自动填入"？本稿取提示条（不抢注意力、不擅自改作者输入）。
3. 「剩余 M」在单元 `maxChapters` 变化（作者改单元上界）时如何处理历史 N？本稿：N 只算落在当前上界内的章，超出部分不计——需实现时确认不会出现"N > 上限"的显示。
