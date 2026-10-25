# P2-1 · 连续性 findings 期 1 —— 四类宿体作核对基准进审稿链

> 状态：**期 1 已实施（2026-10-24）· 期 2 已实施（2026-10-25）**，schema 21（无迁移）；待实机样本复验（见 §6.2 / §7.4）
> 日期：2026-10-24（期 1）· 2026-10-25（期 2：人物状态转移）
> 上级稿：`docs/design/architecture/long-form-readiness-review.md` §5（P2-1）· `docs/design/architecture/industry-alignment-and-stage-goals.md` §3.3（S×5 交付物）
> 前置：P1-1 四格（`p1-1-key-items-design.md` / `p1-1-institution-cadence-design.md` / `p1-1-knowledge-state-design.md` / `p1-1-power-ability-design.md`）

---

## 0. 四问（立项闸门）

按 `industry-alignment-and-stage-goals.md` §5 逐条作答，答不上就不该立项。

| 问 | 答 |
|---|---|
| **行业里叫什么** | **continuity findings**。形态：story bible 作 canon → manuscript validation 产出 findings（带引文、位置、严重度、类别）→ 作者 resolve / dismiss，工具不自动改写。出处：Loreon `manuscript-validation`、PlotLens `continuity-checker`（`industry-alignment…:31-33`） |
| **谁消费产出** | **修稿链**，不是面板。作者勾「纳入修稿」→ `renderHumanConfirmedReviewBrief`（只取 `decision === 'apply'`）→ 下一轮修稿模型。面板只是入口 |
| **失败形态属哪类** | continuity error。本期四类分别落在 ConStory-Bench 的 possession / world rules / knowledge / forgotten abilities 四个子类上（`industry-alignment…:102-110`） |
| **成熟产品做过什么** | 见第 1 问。**我们的差异是需求差异**：不与「写作建议」混谈，只判「两处陈述不能同时为真」；且 canon 是作者逐条登记的结构化事实，不是模型抽取的摘要 |

**是否开 ADR**：**不开**。本期 = 一个纯函数 + 一段提示词 + 复用既有 findings 通道，无 schema 变更、无数据迁移、无对外契约变更，撤回只需删一个数组项 ——「不可逆」不成立（`docs/README.md:63` 的标准）。

---

## 1. 形状：一块「核对基准」，不是第二套世界状态

```
【连续性核对基准（作者登记；本章为第 N 章）】   ← 共同约束（6 条，见 §1.2）
【关键物品（作者登记：谁拿着什么）】            ← 复用 renderPrewriteItemsSection
核对规则（物品）：…
【制度（周期事件：到没到点）】                  ← 复用 renderCadenceSection
核对规则（制度）：…
【知情（谁知道什么）】                          ← 复用 renderKnowledgeSection
核对规则（知情）：…
【能力（本书的能力规则…）】                     ← 复用 renderAbilitySection
核对规则（能力）：…
【人物状态转移（指针型：基准在 prompt 开头的【角色状态】）】  ← 期 2；**不含数据**
核对规则（人物状态转移）：…
```

**为什么复用而不重写**（判据 DM）：四节的渲染函数正文链已经在调。若审稿侧另写一份，同一件物品在两处会有两种措辞 ——
写的时候模型看到 A 版、审的时候按 B 版判，每章都在修一个不存在的错。所以：

| 节 | 渲染入口 | 上限（沿用，不收紧） |
|---|---|---|
| 关键物品 | `renderPrewriteItemsSection`（`prewrite-consultation.ts:136`） | 8 条 / 640 字 |
| 制度 | `renderCadenceSection`（`institution-cadence.ts:276`） | 6 条 / 480 字 |
| 知情 | `renderKnowledgeSection`（`knowledge-state.ts:242`） | 6 条 / 640 字 |
| 能力 | `renderAbilitySection`（`power-ability.ts:245`） | 5 条 / 640 字 |
| **人物状态（期 2）** | **不渲染** —— 指针指回模板 `{{character_states}}`（`character-state-lines.ts:87`） | 沿用该节既有口径 |

**不收紧**的理由：审稿侧若只给 5 条而写稿侧给了 8 条，剩下 3 条就成了「写的时候告知过、审的时候没得比」的盲区。

**第五类为什么是「指针型」**（期 2）：那批字节本来就在审稿 prompt 开头（模板 `{{character_states}}`）。
在块里再渲染一份，就是上一条判据 DM 反着做 —— 同一批事实出现两种措辞。所以第五类只给「指针 + 规则」，
由 `countCharacterStateFacts` 数出「有几条可核对的基准行」决定出不出。详见 §7。

### 1.1 筛选口径必须与生成链逐条同源

| 类 | 口径 | 生成链锚点 |
|---|---|---|
| 物品 | 本章出场角色持有的排前（只排序，不筛除） | `generate-draft.command.ts:2453-2461` + `key-item.ts` 的 `orderKeyItemsForChapter` |
| 制度 | `evaluateCadence` 判定后按 `due → overdue → unknown → not_due` 排序 | `:2487-2491` |
| 知情 | `learnedChapter <= 本章 && refState === 'valid'` | `:2519-2520` + `knowledge-state.ts` 的 `knowledgeUsableAtChapter` |
| 能力 | `abilityStageState(...) !== 'ahead'` | `:2547` |

后两条的判定函数已提到共享层供两链共用；生成链**本期未改**，仍保留内联写法，靠
`src/shared/__tests__/review-continuity-bible.test.ts` 的「读源码型」断言守漂移 —— 生成侧一改，那条测试就红。

### 1.2 共同约束（写进块首，六条）

1. 本节出现的才是基准；**没有出现的类别、没有登记的事实一概不判**。
2. **登记原文不是正文**：`quote` 必须是待审正文里逐字连续、全文只出现一次的单一摘录；登记侧的句子不得填进 `quote`，只写进 `description` 并标「登记：第 N 章」/「登记：作者条目」。
3. **只有两处陈述不能同时为真才报**；回忆、梦境、幻象、转述、传闻、比喻、角色故意撒谎，一律不报。
4. `description` ≤200 字，写清「冲突点 + 来源 + 改法指向」，结尾二选一：`改本章：…` / `核对登记：…`。
5. `category` 逐字写：物品 / 制度 / 知情 / 能力四类写 **`连续性核对（作者登记）`**（en：`Continuity check (author registry)`）；
   人物状态转移（期 2）写 **`连续性核对（角色状态）`**（en：`Continuity check (character state transitions)`）。
   分流理由：第五类的基准多数是**定稿派生快照**（`cs_provenance.kind === 'derived'`），叫「作者登记」会让模型
   把正常演进当成「与作者意图冲突」。
6. 每类 ≤2 条、合计 ≤8 条（期 2 由 6 提到 8：五类，新类 2 条）；**不得为覆盖类别而凑 pass**。

---

## 2. 四类判定表

| 类 | 成立（必带本章引文） | 不判 | severity | 改法指向 | 硬边界 |
|---|---|---|---|---|---|
| **物品** | 登记「某章：刀在甲手」，本章乙持有/使用，且正文无任何转交（交出/被夺/拾得/购得/偷取/寄存/损毁） | 未登记该物；写明转交；只是「看见某人拿着」；本章是回忆；登记无章号（时不点不明） | error = 核心道具换手且后文按新持有者续用；warning = 次要物品一次提及 | 默认「改本章：补转交过程」；正文完整而登记旧 ⇒「核对登记：更新第 N 章归属」 | **不得判「他不可能有这件东西」**（登记是快照，不是区间） |
| **知情** | 角色在本章说出/使用「自第 L 章才知道」的事而本章 < L；或正文写「他这才知道」而登记为早已知 | 未登记；本章只是没提到；沉默；转述；本章 ≥ L | error = 关键信息提前揭示 / 关键人物失忆并据此行动；warning = 一句台词越界 | 「改本章：改为不知道 / 补获知过程」；登记时点错 ⇒「核对登记：learned_chapter」 | **不得判「他为什么不知道」**（只有正向知情 + 下界） |
| **能力** | 早于「自第 N 章起」使用；用法违反硬限制/弱点/代价；正文写「无需代价」而登记了代价 | 未登记的用法（不得推定无限制）；登记未写该限制；只是威力强弱；次数与间隔 | error = 违反硬限制，或阶段未到即用并改变结果；warning = 代价一笔带过但结果成立 | 「改本章：改写用法 / 补代价」；长期不符 ⇒「核对登记：能力限制」 | **不判次数、冷却、累计**（ADR-0022） |
| **制度** | 状态 `到期`/`逾期`，且**本章正文自身**写出推进到本轮/上一轮的句子（「又领了一次」「上次是第 X 章」） | 状态 `未知`（缺锚一律不判，**绝不折成未到**）；`未到`；本章只字未提；问「应发多少」 | error = 同一轮连发两次；warning = 逾期一轮但只轻描 | 「改本章：删去重复的一轮 / 补出过程」；锚明显过期 ⇒「核对登记：上次发生」 | 只有四态 + 「上次真的发生」一锚，**不推算间隔、不要求数量** |
| **人物状态转移**（期 2） | 三条同时成立：① 基准里有**章号小于本章**的行，记着该角色的位置/身体/能力/心理/随身物品；② 本章把同一项写成另一个值，两值不能同时为真；③ 正文**没有写出转移过程**（位置无动身/途中/抵达，伤势无受伤/治疗/休息/时间流逝，能力提升无来源，物品无取得/失去） | 无该角色该项基准行；本章只是没提到；本章内部地点变化无跨章基准；回忆/梦境/幻象/转述/传闻/比喻/故意撒谎；**标注章号等于本章的行**（重审已定稿章时那行就是本章自身快照）；只是范围或措辞不同（「左肩刀伤」vs「身上有伤」）；过程写出但粗糙/耗时过长过短；**以时间跳跃交代间隔**（翌日、三日后） | error = 位置或身体状态被无声改写且后文按新状态演；warning = 一次性提及、不影响后续事件 | 默认「改本章：补出转移过程」；正文完整而登记值过期 ⇒「核对登记：更新第 N 章的状态」 | **只能判「正文与基准不能同时为真」**；不得判「一炷香走三百里不可能」这类需要移动耗时/距离/可达性数据的推断（本项目无此数据，判了就是伪造判据）；**不判角色行为是否合情理**（归模板【检查维度】第 3 条） |

---

## 3. 落点与接线

| 件 | 位置 |
|---|---|
| 纯函数 | `src/shared/review-continuity-bible.ts` —— `buildReviewContinuityBibleBlock(canon)` → `{ text, counts, chars } \| undefined` |
| 读侧 | `src/services/workflows/commands/review-continuity-canon.ts` —— 4 条 IPC 并发、每类独立降级 |
| 接线 | `review-chapter.command.ts`：`【证据锚点硬约束】` 之后条件展开注入；`recheck` 分支不读不带 |
| IPC | `db:key-items-list`（`ipc-channels.ts:1281`）· `db:cadences-list`（`:1286`）· `db:knowledge-list`（`:1292`）· `db:abilities-list`（`:1300`）**无需新增通道** |
| **人物状态（期 2）** | **不新增 IPC**：数据来自 `frozen.characterStates`（`review-chapter.command.ts` 里直接传给 `buildReviewContinuityBibleBlock` 的 `renderedCharacterStates`）。它也不进 `canon.failures` —— 读角色失败会让整次审稿准备抛错，不存在「本次没判」的降级态 |
| 落库 | 模型 JSON → `parseReviewGenerationResult` → `reviews.body` → `buildFindings` 投影成 `review_findings`（与今天所有 literary finding 同形） |

**为什么放在证据锚点约束之后、时间一致性检查之前**：先立「quote 只能来自正文」，再给对照材料，
模型才不会把登记原文当引文；时间那一条是相邻专项，放它前面会打断「引文 → 基准 → 判据」的阅读顺序。

**三处硬约束**

1. **空即零字节**：五类都没有可核对数据 ⇒ 返回 `undefined`，审稿 prompt 与改动前**逐字节相同**。
   由集成测试的哈希锚点守（无数据路径：`d60dd39d…`；四类齐备但无状态路径：`7557d87f…`，期 2 新增）。
   **期 2 的刻意变更**：合计额度 6→8 写在块首，因此**任何「四类有数据」的既有快照会变一次** ——
   这是作者裁定的结果（五类额度），**不是回归**。改审稿提示词必须同步这两行并记回本节。
2. **fail-open**：任一类读失败 ⇒ 少一节 + 一行日志（「连续性核对基准部分读取失败（…）」），**绝不阻断审稿**。
   「本次没判」与「判了没问题」必须能分开 —— 这是 `ConsistencyPreflightCoverage` 的同一条教训。
3. **不加 item 新字段**：审稿合同只有 `category/quote/description/severity`；
   塞 `stableFactKey` 会被 `parseReviewGenerationResult` 拒，且会把这些 item 错接进 recheck 的目标链。

**storyDayOffset 的来源**：取 `frozen.history` 里**最近一个已定稿且日序非空**的章（与生成链
`:929-934` 同口径）。取不到 ⇒ `null` ⇒ 日序轴上的制度判 `unknown`（不判），绝不按章号推算。

---

## 4. 生命周期：随报告生灭，因此不需要 `resolved`

四个事实决定了这一期**不能**建在 `review_findings.resolved` 上：

1. `status='resolved'` 有**四层闸门**，任何路径都不可达：报告构造强制降级（`review-cycle.ts:197-204`）→ 提交通道无条件 v2 并过滤 `unknown`（`review-revision-generation.ts:219-227`）→ 仓储显式拒绝 `resolved===true`（`review-cycle-repository.ts:865`，抛 `REVIEW_CYCLE_CONFLICT`）→ 中央 verifier 永久为假（`m03-review-cycle.ts:475`）。
2. 这是 **v2 契约的刻意设计**：模型判「已解决」不可信，语义是否解决仍由作者核实（判据 CJ）。
3. `recheckContext` 跳过 `unverified`（`review-cycle-repository.ts:596-600`）⇒ 模型产出的 finding 天然不进定向复核。
4. 因此「跨章累积清单 + resolve 状态机」若要做，必须先推翻 v2 契约 —— 属另一期，不在本期。

**本期的生命周期**：finding 属于**该次审稿报告**。重跑审稿即重算；作者的三个动作照旧
（纳入修稿 / 忽略 / 带建议完成 waive）。报告内生命周期天然避开两个坑：

- **永远处理不完的待办**（评审 §风险表点名的那条）：不存在跨章积压。
- **同一登记每章重报**：由「每类 ≤2 条 + 可兼容解释不判 + 干净章零误报」压住；若同一登记连续两章被报，
  按误报处理并回写登记（§6.3 误报表）。

---

## 5. 本期不做（每条都写了为什么可以不做）

| 不做 | 理由 |
|---|---|
| **确定性档**（代码算 diff） | 四类都没有可比对的结构值：物品只有快照、知情只有下界、能力只有阶段 + 自由文本限制。硬写只能伪造判据，退回作者早已否掉的「命中清单」（评审 §2.1） |
| **波及扫描**（改稿后重查受影响章） | 依赖跨章 finding 清单；本期 findings 随报告生灭，扫描对象不存在 |
| **跨章累积清单 / resolve 状态机** | 见 §4：要推翻 v2 契约 |
| **卷切片（P1-2 期 2）** | 与「本章 vs canon」判定无关；本期只读本章位置上的登记 |
| **时间 / 空间两类** | 已有专门落点：时间在 `【时间一致性检查】` + `reviewTimeContinuity`，空间在 `consistency-preflight.ts:146-171` 的确定性规则。再补语义档会与既有判据互相干扰。~~人物~~ **已由期 2 覆盖**（见 §7） |

---

## 6. 实施记录

### 6.1 落地清单（2026-10-24）

| 文件 | 动作 |
|---|---|
| `src/shared/review-continuity-bible.ts` | 新增（纯函数 + 四类规则 + 固定 category + 额度常量） |
| `src/shared/key-item.ts` | 新增 `orderKeyItemsForChapter` |
| `src/shared/knowledge-state.ts` | 新增 `knowledgeUsableAtChapter` |
| `src/services/workflows/commands/review-continuity-canon.ts` | 新增（4 条 IPC + fail-open + 失败清单） |
| `src/services/workflows/commands/review-chapter.command.ts` | 改：条件注入 + `readContinuityBibleBlock` + 两行日志 |
| `src/shared/__tests__/review-continuity-bible.test.ts` | 新增 15 例（含读源码防漂移） |
| `.../commands/__tests__/review-revision-runtime.test.ts` | 改：夹具补 4 条 channel + 4 例（无 canon 哈希锚点 / 四节顺序 / recheck 不读不带 / fail-open） |
| `src/shared/__tests__/review-generation-report.test.ts` | 改：+1 例（固定 category 过合同、不需要新字段） |

**验证**：`tsc --noEmit` 通过；5 个受影响套件 **189 例全绿**（含既有 46 例回归）；
改动文件 `eslint` 零告警。仓库另有 19 处**既有** lint 错误（`arc-position.ts` 等，非本期文件）。

**两条既有哈希不受影响**：`context-entry-parity` 的锚点属**写稿材料块**（`assembleChapterMaterials`），
本期不动材料组装 ⇒ 无需重算。`generate-draft.command.ts` 本期**未改**。

### 6.1b 期 2 落地清单（2026-10-25）

| 文件 | 动作 |
|---|---|
| `src/shared/review-continuity-bible.ts` | 改：新增 `REVIEW_CONTINUITY_CHARACTER_STATE_CATEGORY` + `REVIEW_CONTINUITY_CATEGORIES`；额度 6→8；`ReviewContinuityCanon.renderedCharacterStates`；`counts.characters`；`headerText` 第三参条件化标题与 category 句；新增 `CHARACTER_STATE_RULE` / `characterStateSectionHeader` / `CHARACTER_STATE_FACT_LINE` / `countCharacterStateFacts`；组装末位 push |
| `src/services/workflows/commands/review-chapter.command.ts` | 改：传 `renderedCharacterStates: frozen.characterStates`；注入日志追加「人物状态行 N」（中英各一处）；三处注释口径 |
| `src/services/workflows/commands/__tests__/review-revision-runtime.fixture.ts` | 改：新增 `characterStatesOverride`（默认行为逐字不变） |
| `src/shared/__tests__/review-continuity-bible.test.ts` | 改：新增 8 例 + 额度断言 6→8 + 一条「模板【检查维度】第 3 条原文未改」的读源码断言 |
| `src/services/workflows/commands/__tests__/review-revision-runtime.test.ts` | 改：`CanonFixture` 加 `characterStates`；新增 3 例（四类无状态零字节 + 新锚点 / 有状态注入顺序与日志 / 只有姓名不注入）；recheck 补断言 |
| `src/shared/__tests__/review-generation-report.test.ts` | 改：新增 2 例（新 category 与作者登记类共存 / 加新字段被拒） |

**未改**：`review-continuity-canon.ts`（4 条 IPC 与本类无关）· `character-state-lines.ts` · `review-revision-context.ts` · `builtin-prompt-templates.ts` · 报告合同 · 迁移与 schema（仍 21）。

**两条哈希**：无数据路径 `d60dd39d…` **不变**（块不产出）；四类齐备但无状态路径 `7557d87f…` 为**期 2 新增锚点**
（期 1 该路径的旧值作废 —— 额度 6→8 必然变一次，属 §3 硬约束 1 已声明的刻意变更）。

**回归**：`review-continuity-bible` 24/24 · `review-generation-report` 73/73 · `review-revision-runtime` 53/53
（三套合并 150/150）· `electron/services/__tests__/review-revision-context` 20/20 · `tsc --noEmit` 通过。

### 6.2 验收清单（待实机跑一次）

1. 3 章沙盒，四类各登记一条（都带第 1 章出处）：物品「刀—甲持有」/ 知情「甲—钥匙在井里—自第1章」/ 能力「隔空取物—硬限制：不能隔着活人取物—自第3章起」/ 制度「月例—每3章一次—上次第1章」。
2. 第 4 章草稿逐条植入人造矛盾（每条写成**唯一**句子）：`乙从怀里摸出那把刀` / `甲随口道：钥匙在井里，我早知道`（登记改为自第6章）/ `他隔空摄来茶杯` / `这个月的月例又发了一回`。
3. 跑审稿，查两处：`reviews.body.items[]`（`category/severity/quote/description`）与 `review_findings`（`status` 应为 `unverified` —— 与今天所有模型 finding 同形）。
4. 判定：4 条人造矛盾各产出 ≥1 条 `category = 连续性核对（作者登记）`；每条 `quote` 在草稿里 Ctrl-F **恰好一处**。
5. 干净章同流程：该 category 下 error/warning = 0（允许 0 条 pass；≤1 条 warning 须给书面「可兼容解释」，否则收紧措辞）。

### 6.3 误报表（跑完填）

| 章号 | 类别 | finding 摘要 | quote 唯一命中 | 归因 | 处置 |
|---|---|---|---|---|---|
| — | — | — | — | 登记措辞不足 / 规则过宽 / 模型误读 / 登记错 / **模型把时间跳跃当无过程**（期 2） | 改规则 / 改登记 / 不改 |

---

## 7. 期 2：人物状态转移（2026-10-25）

> 对应台账 12.15 的剩余两项（伤势单调 / 位置可行）。

### 7.1 作者裁定（四条）

| # | 裁定 | 含义 |
|---|---|---|
| A | **合并成一类** | 不做两条独立判据：底层是同一条逻辑「状态变了必须有正文过程」 |
| B | **category 新开** `连续性核对（角色状态）` | 不混用「作者登记」——该批 canon 多数是定稿派生值 |
| C | **不动 `cs_provenance`**，不存引文 | 无迁移、无 schema 变更 |
| D | **额度合计 6 → 8** | 新类 2 条；既有四类仍各 2 条 |

### 7.2 落地形状：指针型，不重渲染

基准是 `frozen.characterStates`（`review-revision-context.ts:132-159` 调 `formatCharacterStateLines`，
`upToChapter: source.chapterNumber`），形如：

```
顾长风（杂役）状态（按标注章节理解，非永久约束）：
  - location@chapter3: 百草园外园
  - physicalState@chapter7·派生: 左肩刀伤未愈
```

这份字节**已经在审稿 prompt 开头**（模板 `{{character_states}}`）。所以第五类只 push
「指针 + 规则」，指回该节，**不复制任何事实行**。四条补偿「相隔很远」：

1. 点名模板里**逐字**的标题（中文 `【角色状态】` / 英文 `[Known character states]` —— 两边不同，只写一个必有一边指空）
2. 给**结构**锚点（`紧跟【待审章节】之后`），不按「上一段」找
3. 首句写明「基准不在这里」
4. 规则里复述行格式 `field@chapterN: value` 与 `·派生` 标记

### 7.3 三条写死在规则里的边界

| 边界 | 为什么必须写死 |
|---|---|
| **标注章号等于本章的行不判** | `upToChapter === 本章`，重审已定稿章时那行就是**从本章正文抽出来的快照**，拿它判本章等于自证矛盾 |
| **基准陈旧时从严** | 位置快照可能几十章没更新；仅凭「地点不同」在长篇后期必然大面积误报。改为：明显陈旧时只在正文**自证矛盾**（同场景两地点 / 从未抵达却写「从某地出来」）才报 |
| **不得判「一炷香走三百里」** | 本项目**没有**移动耗时 / 距离 / 可达性数据。放这个口子，模型只能凭空造判据 |

**与模板【检查维度】第 3 条的分工**（不改模板，靠条件规则表达）：第 3 条判「同一时点、正文与标注为本章的登记值直接冲突」；
第五类判「跨章旧值被换掉且无过程」。同一现象只报一次，已按本条报出的不再按第 3 条重复。

**为什么「等于本章的作者登记值」归第 3 条**：那是作者手填的权威值，属于静态一致性；本类只处理**过程缺失**。

### 7.4 验收（实机，逐条）

1. 第 1 章定稿「左肩刀伤未愈 / 在百草园外园」；第 2 章写「伤口已经好透」且全章无治疗，位置直写「他在城南」且无动身
   ⇒ 各出 1 条 `连续性核对（角色状态）`，`quote` Ctrl-F **恰好一处**
2. 干净章（写了换药、写了出园赶路）⇒ 该 category 下 error/warning = 0
3. 重审**已定稿章** ⇒ 不得因 `@本章` 的状态行产生新类 finding
4. 只有角色、无任何状态的老项目 ⇒ 日志无「人物状态行」、prompt 无指针段

### 7.5 已知限制与风险

| # | 限制 | 处置 |
|---|---|---|
| 1 | 误报率完全取决于模型（语义判据，无代码复核） | 三重压制：仅在**有事实行**时出现 + 可兼容解释清单 + `quote` 必须唯一。上线后按 §6.3 跟；连续两章误报同一登记即收紧措辞或改登记 |
| 2 | 「明确治疗（带引文）」无引文可回查 | `cs_provenance` 不存 evidence（C 的裁定）。本期只要求正文写出过程，**不核对过程是否充分** —— 模型可能把一句「他服了药」当成过程已写出 |
| 3 | 模板被作者自定义覆盖、删掉 `【角色状态】` 标题 | 指针同时给结构锚点兜底；本期不检测模板形状 |
| 4 | 状态值里的换行可能伪造事实行 | `formatCharacterStateLines` 不压换行（既有行为）；伪造行只会让指针更早出现，不改变数据语义。本期不修 |
| 5 | prompt 体积 | 有状态时中文约 +700~900 字；`review-continuity-bible.test.ts` 已有五类体积用例守上限 |

**明确不做**：确定性 diff（六槽是自由文本，无可比对结构值）· 移动耗时/距离/可达性 · 给 `cs_provenance` 加引文/加列/迁移 ·
新 IPC · 改 `consistency_check` 模板 · recheck 分支注入 · 跨章累积/resolve 状态机（仍受 v2 契约限制，见 §4）。
