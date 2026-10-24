# P2-1 · 连续性 findings 期 1 —— 四类宿体作核对基准进审稿链

> 状态：**已实施（2026-10-24）**，schema 仍为 20（无迁移）；待实机样本复验（见 §6.2 验收清单）
> 日期：2026-10-24
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
```

**为什么复用而不重写**（判据 DM）：四节的渲染函数正文链已经在调。若审稿侧另写一份，同一件物品在两处会有两种措辞 ——
写的时候模型看到 A 版、审的时候按 B 版判，每章都在修一个不存在的错。所以：

| 节 | 渲染入口 | 上限（沿用，不收紧） |
|---|---|---|
| 关键物品 | `renderPrewriteItemsSection`（`prewrite-consultation.ts:136`） | 8 条 / 640 字 |
| 制度 | `renderCadenceSection`（`institution-cadence.ts:276`） | 6 条 / 480 字 |
| 知情 | `renderKnowledgeSection`（`knowledge-state.ts:242`） | 6 条 / 640 字 |
| 能力 | `renderAbilitySection`（`power-ability.ts:245`） | 5 条 / 640 字 |

**不收紧**的理由：审稿侧若只给 5 条而写稿侧给了 8 条，剩下 3 条就成了「写的时候告知过、审的时候没得比」的盲区。

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
5. `category` 必须逐字写 **`连续性核对（作者登记）`**（en：`Continuity check (author registry)`）。
6. 每类 ≤2 条、合计 ≤6 条；**不得为覆盖类别而凑 pass**。

---

## 2. 四类判定表

| 类 | 成立（必带本章引文） | 不判 | severity | 改法指向 | 硬边界 |
|---|---|---|---|---|---|
| **物品** | 登记「某章：刀在甲手」，本章乙持有/使用，且正文无任何转交（交出/被夺/拾得/购得/偷取/寄存/损毁） | 未登记该物；写明转交；只是「看见某人拿着」；本章是回忆；登记无章号（时不点不明） | error = 核心道具换手且后文按新持有者续用；warning = 次要物品一次提及 | 默认「改本章：补转交过程」；正文完整而登记旧 ⇒「核对登记：更新第 N 章归属」 | **不得判「他不可能有这件东西」**（登记是快照，不是区间） |
| **知情** | 角色在本章说出/使用「自第 L 章才知道」的事而本章 < L；或正文写「他这才知道」而登记为早已知 | 未登记；本章只是没提到；沉默；转述；本章 ≥ L | error = 关键信息提前揭示 / 关键人物失忆并据此行动；warning = 一句台词越界 | 「改本章：改为不知道 / 补获知过程」；登记时点错 ⇒「核对登记：learned_chapter」 | **不得判「他为什么不知道」**（只有正向知情 + 下界） |
| **能力** | 早于「自第 N 章起」使用；用法违反硬限制/弱点/代价；正文写「无需代价」而登记了代价 | 未登记的用法（不得推定无限制）；登记未写该限制；只是威力强弱；次数与间隔 | error = 违反硬限制，或阶段未到即用并改变结果；warning = 代价一笔带过但结果成立 | 「改本章：改写用法 / 补代价」；长期不符 ⇒「核对登记：能力限制」 | **不判次数、冷却、累计**（ADR-0022） |
| **制度** | 状态 `到期`/`逾期`，且**本章正文自身**写出推进到本轮/上一轮的句子（「又领了一次」「上次是第 X 章」） | 状态 `未知`（缺锚一律不判，**绝不折成未到**）；`未到`；本章只字未提；问「应发多少」 | error = 同一轮连发两次；warning = 逾期一轮但只轻描 | 「改本章：删去重复的一轮 / 补出过程」；锚明显过期 ⇒「核对登记：上次发生」 | 只有四态 + 「上次真的发生」一锚，**不推算间隔、不要求数量** |

---

## 3. 落点与接线

| 件 | 位置 |
|---|---|
| 纯函数 | `src/shared/review-continuity-bible.ts` —— `buildReviewContinuityBibleBlock(canon)` → `{ text, counts, chars } \| undefined` |
| 读侧 | `src/services/workflows/commands/review-continuity-canon.ts` —— 4 条 IPC 并发、每类独立降级 |
| 接线 | `review-chapter.command.ts`：`【证据锚点硬约束】` 之后条件展开注入；`recheck` 分支不读不带 |
| IPC | `db:key-items-list`（`ipc-channels.ts:1281`）· `db:cadences-list`（`:1286`）· `db:knowledge-list`（`:1292`）· `db:abilities-list`（`:1300`）**无需新增通道** |
| 落库 | 模型 JSON → `parseReviewGenerationResult` → `reviews.body` → `buildFindings` 投影成 `review_findings`（与今天所有 literary finding 同形） |

**为什么放在证据锚点约束之后、时间一致性检查之前**：先立「quote 只能来自正文」，再给对照材料，
模型才不会把登记原文当引文；时间那一条是相邻专项，放它前面会打断「引文 → 基准 → 判据」的阅读顺序。

**三处硬约束**

1. **空即零字节**：四类都没登记 ⇒ 返回 `undefined`，审稿 prompt 与改动前**逐字节相同**。
   由集成测试的哈希锚点守（`d60dd39d…`；改审稿提示词必须同步该行并记回本节）。
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
| **时间 / 空间 / 人物三类** | 已有专门落点：时间在 `【时间一致性检查】` + `reviewTimeContinuity`，空间在 `consistency-preflight.ts:146-171` 的确定性规则，人物六槽是自由文本（12.15 另两项未做）。再补语义档会与既有判据互相干扰 |

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

### 6.2 验收清单（待实机跑一次）

1. 3 章沙盒，四类各登记一条（都带第 1 章出处）：物品「刀—甲持有」/ 知情「甲—钥匙在井里—自第1章」/ 能力「隔空取物—硬限制：不能隔着活人取物—自第3章起」/ 制度「月例—每3章一次—上次第1章」。
2. 第 4 章草稿逐条植入人造矛盾（每条写成**唯一**句子）：`乙从怀里摸出那把刀` / `甲随口道：钥匙在井里，我早知道`（登记改为自第6章）/ `他隔空摄来茶杯` / `这个月的月例又发了一回`。
3. 跑审稿，查两处：`reviews.body.items[]`（`category/severity/quote/description`）与 `review_findings`（`status` 应为 `unverified` —— 与今天所有模型 finding 同形）。
4. 判定：4 条人造矛盾各产出 ≥1 条 `category = 连续性核对（作者登记）`；每条 `quote` 在草稿里 Ctrl-F **恰好一处**。
5. 干净章同流程：该 category 下 error/warning = 0（允许 0 条 pass；≤1 条 warning 须给书面「可兼容解释」，否则收紧措辞）。

### 6.3 误报表（跑完填）

| 章号 | 类别 | finding 摘要 | quote 唯一命中 | 归因 | 处置 |
|---|---|---|---|---|---|
| — | — | — | — | 登记措辞不足 / 规则过宽 / 模型误读 / 登记错 | 改规则 / 改登记 / 不改 |
