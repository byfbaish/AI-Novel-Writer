# 蓝图 `keyEvents` 结构化设计稿（§7.1-B-4 共同前提）

> **状态**：初稿 · **待作者初评**（2026-10-14）
> **上游依据**：`docs/design/prompt-payload-scoping-design.md` §5.5 / §7.1-B-4 / 附录 C / 附录 F
> **本文只回答一个问题**：把蓝图 `keyEvents` 从 `string` 变成 `Array<{id, event, estimatedUnits}>`，**要动什么、代价多大、怎么分期**。
> **本文不实施**。按项目惯例，作者初评通过后才进入编码。

---

## 0. 一句话

`keyEvents` 是「本章要发生的几件事」的**清单**，但它在库里、契约里、下游全部是**一段自由文本**：
无法编号 → 无法对账 → 算不出停止点 → 字数只能按配置拍脑袋。
**结构化它是 P1-1 / P1-2 / P1-3 的共同前提**；而调研后发现，**代价比原设计稿估计的低得多**——因为存储层不需要改 schema。

---

## 1. 为什么（问题陈述）

四件当前做不到的事，根都在同一个地方：

| 想要的能力 | 现在为什么做不到 | 上游结论位置 |
|---|---|---|
| 续写「写到第 K 条就停」 | 停止点判据**完全是字数**（`rounds < MAX ∧ chars ≤ 1.3t`），没有任何事件边界 | 附录 C |
| 短细纲「写第 N–M 点」 | 清单是散文，无法分配编号 | §5.5 第 3 行 |
| 【后续计划边界】列出「本章不得出现」 | 只能靠 `split(/\r?\n|[；;]/)` 猜条目 | 附录 B |
| 字数目标由**事件容量**推导 | 分配机制缺失，`keyEvents` 只是文本，没有每条的字数预估 | 附录 F |

而「不许让模型自报账目」是本项目红线 ⇒ 账目（编号、覆盖、停止点）**必须由代码算** ⇒ 前提是**清单本身是结构化的**。

---

## 2. 现状取证（可复查事实）

### 2.1 存储层

| 项 | 位置 | 现状 |
|---|---|---|
| 列定义 | `electron/migrations/baseline-schema.ts:62` | `key_events TEXT DEFAULT '',  -- 关键事件` |
| 写入 | `electron/repositories/blueprint-repository.ts:529` | `data.keyEvents` **原样绑定**（对比同语句 `:530` 的 `characters` 走了 `JSON.stringify`） |
| 读取 | `electron/repositories/blueprint-repository.ts:155` | `keyEvents: row.key_events` **原样返回** |
| 变更比较 | `electron/repositories/blueprint-repository.ts:464` | `left.keyEvents === right.keyEvents`（**字符串严格相等**） |

**★ 关键发现（决定本稿成本）**：**同一张表的 `characters` 列就是 `TEXT` 存 `JSON.stringify(array)`**
（写 `:530`、读时 `JSON.parse`）。也就是说：

> **「用 TEXT 列存 JSON 数组」是本项目已经存在的惯用法，不是新发明。**

⇒ **改 `keyEvents` 不需要加列、不需要走 lane 六步、不需要动 `baseline-schema.ts` 一个字节**（红线 1 不碰）。
（原设计稿 §5.5 写的「必须走 lane 六步」是基于「要加列/改 DDL」的**假设**，本次调研否证了该假设。）

### 2.2 契约层

| 项 | 位置 | 现状 |
|---|---|---|
| 必填字段清单 | `src/shared/blueprint-semantic-contract.ts:20-38` | `requiredFields` 含 `keyEvents` |
| 语言合同（zh/en） | `blueprint-semantic-contract.ts:44` / `:54` | 「keyEvents **必须是非空字符串**」 |
| 解析校验 | `blueprint-semantic-contract.ts:217` | `requiredText(fieldValue(...'keyEvents'...))` → 强制 string |
| 语言化输出合同 | `src/services/prompt-language.ts:505` | 英文合同点名 `keyEvents` |
| 类型定义（**6 处**） | `blueprint-semantic-contract.ts:73`、`electron/repositories/blueprint-repository.ts:24`/`:40`、`src/shared/plot-tree.ts:71`、`src/shared/consistency-preflight.ts:29`、`src/shared/recovery-candidate.ts:8`、`src/services/auto-next-chapter.ts:6` | 全部 `keyEvents: string` |

### 2.3 产出模板（模型侧）

| 模板 | 位置 | 现状要求 |
|---|---|---|
| 章节蓝图（首轮） | `builtin-prompt-templates.ts:872` / `:882` | `"keyEvents": "…100字左右具体说明"`；「控制在 100-150 字以内」 |
| 章节蓝图（分块续写） | `builtin-prompt-templates.ts:949` / `:957` | 同上 |
| **导入已有小说·反向提取** | `builtin-prompt-templates.ts:1610` / `:1615` | 「本章核心事件概述（100-150字…）」+「必须基于正文实际内容提取，不可臆造」 |

⚠️ **第三类容易被漏**：它不是「生成本章要写什么」，而是「读已有正文、回头补出一章蓝图」。
结构化后它也必须产出数组，否则导入链路产出的仍是旧格式。

### 2.4 消费点

| 消费方 | 位置 | 用法 | 改成数组后 |
|---|---|---|---|
| 执行合同·必需事件 | `generate-draft.command.ts:468` | `value: chapterInfo.keyEvents` 直接作为文本条目 | 需 `map(e => e.event).join('\n')` |
| 正文 JSON 载荷 | `generate-draft.command.ts:269` | 字段透传进 `WriterChapterInfo` | 随契约改 |
| 续写材料块 | `generate-draft.command.ts:573` | 同上 | 随契约改 |
| 知识库检索 | `generate-draft.command.ts:630` / `:899` | 拼进 query / `relevanceTerms` | 需 join |
| 后续计划边界 | `generate-draft.command.ts:729-730` | `第${n}章 ${title}：${keyEvents}` | 需 join；**这正是 P1-1 的落点素材** |
| **目标核对清单** | `src/shared/chapter-goal-review.ts:25-28` | **`split(/\r?\n|[；;]/)` 切分成 items**，id = `ch{n}:keyEvents:{i}` | ★ **改为直接用数组，id 天然稳定** |
| 叙事线索检索 | `electron/repositories/narrative-thread-repository.ts:170` | `${title}\n${keyEvents}` 拼文本 | join |
| 蓝图 JSON 探针 | `electron/services/llm-probe.ts:45` | 正则 `"(?:keyEvents|…)"\s*:` | 正则仍可用（字段名不变） |
| 域工具字段表 | `electron/services/agent-domain-tool-effect.ts:10` | `blueprintStrings` 集合含 `keyEvents` | ★ **必须同步**（否则新值被当成非字符串） |
| 变更证明 | `electron/services/generation-character-proposal-proof.ts:115-117` | `JSON.stringify([...key_events...])` 比较 | 需两侧同为 JSON |
| 字段清单 | `electron/services/main-generation-owner.ts:734` | `fields` 数组含 `keyEvents` | 检查 |
| **作者编辑器** | `src/components/editor/ChapterCardEditor.tsx:1157-1158` | **Textarea**，`updateField('keyEvents', e.target.value)` | ★ **UI 决策点（见 D4）** |
| 章节创建预填 | `ChapterCardEditor.tsx:777`、`src/services/auto-next-chapter.ts:30` | 传值给弹窗/创建参数 | 需 join 或改形态 |
| **Agent 提案白名单** | `src/services/agent/tools/propose-chapter-blueprint.tool.ts:8` | 允许 agent 提案写入的字段含 `keyEvents` | ★ **必须同步**，否则 agent 无法再提案该字段 |
| **Agent 读蓝图** | `src/services/agent/tools/read-blueprint.tool.ts:39-40` | `关键事件: ${bp.keyEvents}` 直接拼文本 | 数组会被拼成 `[object Object]`，**必须改** |
| 域变更对比面板 | `src/components/panels/agent/DomainProposalDiff.tsx:23` | 字段 label 映射含 `keyEvents` | 需检查值的渲染方式 |

### 2.5 测试

构造 `keyEvents` 值的测试至少分布在：`electron/repositories/__tests__/blueprint-repository.test.ts`、
`plot-tree-repository.test.ts`、`character-repository.test.ts`、`import-run-*.test.ts`、
`recovery-candidate-migration.test.ts`、`src/services/workflows/__tests__/` 与 `src/shared/__tests__/` 多份契约测试。

---

## 3. 目标契约

```ts
/** 一条本章关键事件。 */
export interface BlueprintKeyEvent {
  /** 稳定编号，供跨步骤对账（短细纲 / 续写停止点 / 覆盖账目）。 */
  id: string
  /** 事件本身（一句话到一小段）。 */
  event: string
  /** 该事件的篇幅预估（汉字数），用于字数分配与停止点判断。 */
  estimatedUnits: number
}
```

**消费侧取值规则**（统一，避免各处各写一遍）：

- **文本呈现**（prompt / 检索 / 边界清单）：`events.map(e => e.event).join('\n')`
- **编号呈现**（短细纲分配、对账）：`E1. …\nE2. …`
- **总容量**：`events.reduce((s, e) => s + e.estimatedUnits, 0)`

---

## 4. ★ 关键决策（**待作者裁定**）

| # | 决策 | 推荐 | 理由 / 代价 |
|---|---|---|---|
| **D1** | **存储形态** | **复用 `key_events TEXT` 存 JSON**（零 schema 迁移），**不走 lane 六步** | 同表 `characters` 已是此模式；不动 DDL ⇒ 红线 1 与基线指纹**完全不受影响**。代价：DB 层无类型校验（与 `characters` 现状一致，非新增缺陷）。**若选"新增列"** ⇒ 必须走 lane 六步、成本翻倍且收益相同。 |
| **D2** | **`id` 由谁生成** | **代码生成**（`E1…En` 按数组序号），模型**不必**给 | 红线「不许让模型自报账目」；且与 `chapter-goal-review.ts` 现有 id 规则天然对齐。契约允许模型**可选**给出 id，代码在解析时**按序号覆盖**，避免模型编号漂移。 |
| **D3** | **`estimatedUnits` 语义** | **可选字段**；缺省时由代码按 `wordsTarget / n` 均分；单位 = 汉字数 | 强制模型预估会让"估不准"变成**硬失败**（增加无谓重试）；作为**建议值**比作为**门禁**稳。 |
| **D4** | **作者编辑器形态** | **阶段 1 先保留现有 Textarea**（一行一条），不立刻换结构化编辑器 | 守「语义化小修」；Textarea → 行数组 → 结构化数组是**可逆**的一步。结构化编辑器（每条一个输入框 + 预估字数）放**阶段 3**，随 UI 一起做。 |
| **D5** | **旧数据兼容** | 读时尝试 `JSON.parse`；**不是数组 ⇒ 降级为单元素数组**（`[{id:'E1', event: 原文本, estimatedUnits: 默认}]`）；**绝不自动回写** | 守「绝不自动执行副作用」。旧库照常可读可写，作者不感知。 |
| **D6** | **是否一次做完** | **分三期**（见 §5），**只先做阶段 1** | 与"不要过重任务、降低回滚风险"一致；阶段 1 **零行为变化**，是纯地基。 |

---

## 5. 分期实施

### 阶段 1 · 地基（**零行为变化**，建议先做）

1. 新增 `BlueprintKeyEvent` 类型与两个纯函数：`normalizeKeyEvents(raw: unknown): BlueprintKeyEvent[]`（含旧字符串降级）、`keyEventsText(events)`（统一 join）。
2. `blueprint-repository.ts` 三个边界：写入 `JSON.stringify`、读取 `normalizeKeyEvents`、比较改为 `JSON.stringify` 双侧。
3. 6 处类型定义改 `BlueprintKeyEvent[]`。
4. `chapter-goal-review.ts` 的 `freezeChapterGoals` 改为**直接吃数组**（保留 `string` 入参的旧路径作为兼容）。
5. **模板暂不动** → 模型仍产字符串 → 解析时合成单元素数组 ⇒ **下游行为逐字不变**（可用现有测试证明）。

### 阶段 2 · 产出侧

6. 三处模板改 JSON 示例（首轮 / 分块 / 反向提取），zh + en **+ 作者全局覆盖版**（⚠️ 覆盖版遮蔽内置，漏了这步等于白改）。
7. `blueprint-semantic-contract.ts` 的语言合同文字 + `normalizeBlueprintSemanticItem` 校验改为数组（含 `estimatedUnits` 区间校验）。
8. `prompt-language.ts:505` 英文合同同步。

### 阶段 3 · 消费侧（P1-1 / P1-2 / P1-3 各自的活）

9. 短细纲按编号分配（写第 N–M 条）。
10. 续写停止点改**事件驱动**，字数降级为护栏（`0.7t` 退回 / `1.3t` 上限）。
11. 【后续计划边界】直接引用编号条目。
12. 结构化编辑器（D4 的第二半）。

---

## 6. 风险与红线

| 风险 | 说明 | 对策 |
|---|---|---|
| 红线 1（DDL 冻结） | 本方案**不改任何 DDL** | ✅ 天然满足；若改选"新增列"则必须走 lane 六步 |
| 红线「模型自报账目」 | 编号/覆盖/停止点 | 一律由代码算；模型给的 id 只作参考并被覆盖 |
| 红线「绝不自动执行副作用」 | 旧数据 | 只做**读时容错**，不回写 |
| §8-8 过渡期双格式 | 新代码 × 旧库 | D5 的降级路径即缓解；`string` 与数组**同时可读** |
| §8-7 YAGNI | 契约字段膨胀 | 第一版**只有** `id` / `event` / `estimatedUnits` 三个字段，不加"伏笔权重""情绪曲线" |
| 覆盖版遮蔽内置 | 改内置 ≠ 生效 | 阶段 2 必须**三处同改**；动手前先 `getPromptSource(key)` |
| **Agent 侧两处白名单** | `electron/services/agent-domain-tool-effect.ts:10`（`blueprintStrings` 含 `keyEvents`）+ `src/services/agent/tools/propose-chapter-blueprint.tool.ts:8` | 结构体写入时会因"非字符串"被拒 / agent 提案被过滤 ⇒ 阶段 1 必须同改（**最易漏的两处**） |

---

## 7. 验收

- **阶段 1**：现有全套测试**通过数/失败数逐条不变**（尤其 `blueprint-repository.test.ts`、`plot-tree-*`、`chapter-goal-review.test.ts`、`prompt-local-qwen-contract`）；新增 `normalizeKeyEvents` 单测覆盖「旧字符串降级 / 新数组 / 空值 / 非法值」。
- **阶段 2**：跑一次真实蓝图生成，`debug/prompt-trace/` 里 `ioCalls[].messages[].content` 应含数组型 `keyEvents`（⚠️ 不看 `snapshots[].built`）。
- **阶段 3**：按 P1 各自设计稿验收。

---

## 8. 初评（本文自评 · 供作者初评参考）

**结论：建议只批准「阶段 1」，且这是本稿最重要的增量。**
原设计稿把这条当成「必须走 lane 六步」的重活，调研后**该前提被否证**——复用 `key_events TEXT` 存 JSON，
与同表 `characters` 完全同法，**零 schema 迁移、零 DDL 变更、零基线指纹风险**。阶段 1 因此是**纯类型/边界改造**，
行为逐字不变，可用"测试数不变"硬证明，回滚成本≈一次 `git revert`。

**三个需要作者拍板的点**（其余我有推荐、可按推荐执行）：
1. **D4 编辑器形态** —— 影响作者日常手感（Textarea 一行一条 vs 每条一个输入框）。我按"不破坏现状"推荐先保留 Textarea，但它决定了作者写蓝图的方式是否改变。
2. **D2 id 编号方案** —— 我推荐代码按序号生成（`E1…`）。若作者希望编号在**跨章**层面也稳定（如 `ch7:E3`），需要现在定，后改会牵动已存数据。
3. **分期边界** —— 是否同意"阶段 1 单独提交、观察一轮再进阶段 2"。

**我判断的最大不确定性**：`estimatedUnits` 的实际取值质量（模型估的字数与真实产出差多少）。
这只影响**阶段 3** 的停止点精度，不影响阶段 1/2，因此**不阻塞**开工；建议阶段 3 前先在 trace 里实测 2–3 章的偏差。

**建议的最小第一步**：阶段 1 的 1–3 项（类型 + repository 边界 + 6 处类型定义），**一次提交**，跑契约测试证明零回归。

---

## 9. 待作者确认清单

- [ ] D1 存储：同意「复用 TEXT 列、不走 lane？」
- [ ] D2 id：同意「代码按序号生成？是否需要 `ch{N}:E{i}` 形态？」
- [ ] D3 `estimatedUnits`：同意「可选 + 缺省均分？」
- [ ] D4 编辑器：阶段 1 保留 Textarea 是否可以？
- [ ] D5 旧数据：同意「读时降级、不回写？」
- [ ] 分期：是否「阶段 1 单独提交、观察后再进阶段 2？」
