# 蓝图 `keyEvents` 结构化设计稿（§7.1-B-4 共同前提）

> **状态**：初稿 **v2** · 已吸收外部评审（见 §10）· **待作者裁定 D1–D6 与分期**（2026-10-14）  
> **上游依据**：`docs/design/prompt/prompt-payload-scoping-design.md` §5.5 / §7.1-B-4 / 附录 C / 附录 F  
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

| 想要的能力              | 现在为什么做不到                                               | 上游结论位置       |      |
| ------------------ | ------------------------------------------------------ | ------------ | ---- |
| 续写「写到第 K 条就停」      | 停止点判据**完全是字数**（`rounds < MAX ∧ chars ≤ 1.3t`），没有任何事件边界 | 附录 C         |      |
| 短细纲「写第 N–M 点」      | 清单是散文，无法分配编号                                           | §5.5 第 3 行   |      |
| 【后续计划边界】列出「本章不得出现」 | 只能靠 \`split(/\r?\n                                     | [；;]/)\` 猜条目 | 附录 B |
| 字数目标由**事件容量**推导    | 分配机制缺失，`keyEvents` 只是文本，没有每条的字数预估                      | 附录 F         |      |

而「不许让模型自报账目」是本项目红线 ⇒ 账目（编号、覆盖、停止点）**必须由代码算** ⇒ 前提是**清单本身是结构化的**。

---

## 2. 现状取证（可复查事实）

### 2.1 存储层

| 项    | 位置                                                  | 现状                                                                         |
| ---- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| 列定义  | `electron/migrations/baseline-schema.ts:62`         | `key_events TEXT DEFAULT '',  -- 关键事件`                                     |
| 写入   | `electron/repositories/blueprint-repository.ts:529` | `data.keyEvents` **原样绑定**（对比同语句 `:530` 的 `characters` 走了 `JSON.stringify`） |
| 读取   | `electron/repositories/blueprint-repository.ts:155` | `keyEvents: row.key_events` **原样返回**                                       |
| 变更比较 | `electron/repositories/blueprint-repository.ts:464` | `left.keyEvents === right.keyEvents`（**字符串严格相等**）                          |

**★ 关键发现（决定本稿成本）**：**同一张表的 `characters` 列就是 `TEXT` 存 `JSON.stringify(array)`**  
（写 `:530`、读时 `JSON.parse`）。也就是说：

> **「用 TEXT 列存 JSON 数组」是本项目已经存在的惯用法，不是新发明。**

⇒ **改 `keyEvents` 不需要加列、不需要走 lane 六步、不需要动 `baseline-schema.ts` 一个字节**（红线 1 不碰）。  
（原设计稿 §5.5 写的「必须走 lane 六步」是基于「要加列/改 DDL」的**假设**，本次调研否证了该假设。）

### 2.1b ⚠️ 列不是唯一落点：还有 4 类**持久化 JSON blob**

这些地方把 `keyEvents` 连同整个蓝图对象序列化存了下来，**旧数据（字符串）与新数据（数组）必须能共存**：

| blob                                                  | 位置                                                                                                                                                      | 风险                                                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recovery_candidates.source_snapshot` + `source_hash` | `electron/repositories/recovery-candidate-repository.ts:59-61` / `:85-94`                                                                               | ★★ **`source_hash` 是对快照整体取 `sha256`** —— 旧库（字符串）与新代码（数组）算出**不同 hash** ⇒ **旧恢复候选会被一律判 stale**。这是全改造**唯一可能造成"用户可见行为变化"**&#x7684;点，阶段 1 必须先统一 normalize 再序列化 |
| `character_sync_input` ×2                             | `electron/migrations/baseline-blueprint-schema.ts:12` / `:23`（存 `BlueprintData[]`）；读 `electron/services/generation-character-proposal-proof.ts:112-117` | 逐字段 `JSON.stringify` 比对                                                                                                                                   |
| 项目归档 / 审稿快照                                           | `electron/services/project-archive-service.ts:364` / `:373`（`safeString(source.keyEvents)`）、`:528-531`                                                  | ★ `safeString` 会**把数组强转成字符串** ⇒ 归档内容变形                                                                                                                    |
| 便携字段策略                                                | `electron/services/portable-project-field-policy.json:77`（`blueprints.key_events` 标 "D"）                                                                | 需确认数组形态是否仍可便携                                                                                                                                             |

### 2.2 契约层

| 项             | 位置                                                                                                                                                                                                                                                                                                                                                                                           | 现状                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 必填字段清单        | `src/shared/blueprint-semantic-contract.ts:20-38`                                                                                                                                                                                                                                                                                                                                            | `requiredFields` 含 `keyEvents`                            |
| 语言合同（zh/en）   | `blueprint-semantic-contract.ts:44` / `:54`                                                                                                                                                                                                                                                                                                                                                  | 「keyEvents **必须是非空字符串**」                                  |
| 解析校验          | `blueprint-semantic-contract.ts:217`                                                                                                                                                                                                                                                                                                                                                         | `requiredText(fieldValue(...'keyEvents'...))` → 强制 string |
| 语言化输出合同       | `src/services/prompt-language.ts:505`                                                                                                                                                                                                                                                                                                                                                        | 英文合同点名 `keyEvents`                                        |
| 类型定义（**9 处**） | `blueprint-semantic-contract.ts:73`、`electron/repositories/blueprint-repository.ts:24`/`:40`、`src/shared/plot-tree.ts:71`、`src/shared/consistency-preflight.ts:29`、`src/shared/recovery-candidate.ts:8`、`src/services/auto-next-chapter.ts:6`、`src/shared/narrative-thread.ts:60`、`src/services/workflows/chapter-creation-parameters.ts:13`、`src/services/workflows/chapter-workflow.ts:29` | 全部 `keyEvents: string`                                    |

### 2.3 产出模板（模型侧）

| 模板                    | 位置                                                             | 现状要求                                                                        |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 章节蓝图（首轮）              | `builtin-prompt-templates.ts:872` / `:882`                     | `"keyEvents": "…100字左右具体说明"`；「控制在 100-150 字以内」                              |
| 章节蓝图（分块续写）            | `builtin-prompt-templates.ts:949` / `:957`                     | 同上                                                                          |
| **导入已有小说·反向提取**       | `builtin-prompt-templates.ts:1610` / `:1615`                   | 「本章核心事件概述（100-150字…）」+「必须基于正文实际内容提取，不可臆造」                                   |
| ⚠️ **内联 JSON 形状（易漏）** | `src/services/workflows/commands/directory.command.ts:241-242` | 蓝图续写请求里**内联**的 `【精确 JSON 形状】` 说明（`"keyEvents":"简洁事件摘要"`），**不在 builtin 模板里** |

⚠️ **第三类容易被漏**：它不是「生成本章要写什么」，而是「读已有正文、回头补出一章蓝图」。  
结构化后它也必须产出数组，否则导入链路产出的仍是旧格式。

### 2.4 消费点

| 消费方             | 位置                                                                              | 用法                                                          | 改成数组后                                         |                       |
| --------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- | --------------------- |
| 执行合同·必需事件       | `generate-draft.command.ts:468`                                                 | `value: chapterInfo.keyEvents` 直接作为文本条目                     | 需 `map(e => e.event).join('\n')`              |                       |
| 正文 JSON 载荷      | `generate-draft.command.ts:269`                                                 | 字段透传进 `WriterChapterInfo`                                   | 随契约改                                          |                       |
| 续写材料块           | `generate-draft.command.ts:573`                                                 | 同上                                                          | 随契约改                                          |                       |
| 知识库检索           | `generate-draft.command.ts:630` / `:899`                                        | 拼进 query / `relevanceTerms`                                 | 需 join                                        |                       |
| 后续计划边界          | `generate-draft.command.ts:729-730`                                             | `第${n}章 ${title}：${keyEvents}`                              | 需 join；**这正是 P1-1 的落点素材**                     |                       |
| **目标核对清单**      | `src/shared/chapter-goal-review.ts:25-28`                                       | \*\*\`split(/\r?\n                                          | [；;]/)`切分成 items**，id =`ch{n}:keyEvents:{i}\` | ★ **改为直接用数组，id 天然稳定** |
| 叙事线索检索          | `electron/repositories/narrative-thread-repository.ts:170`                      | `${title}\n${keyEvents}` 拼文本                                | join                                          |                       |
| 蓝图 JSON 探针      | `electron/services/llm-probe.ts:45`                                             | 正则 \`"(?:keyEvents                                          | …)"\s*:\`                                     | 正则仍可用（字段名不变）          |
| 域工具字段表          | `electron/services/agent-domain-tool-effect.ts:10`                              | `blueprintStrings` 集合含 `keyEvents`                          | ★ **必须同步**（否则新值被当成非字符串）                       |                       |
| 变更证明            | `electron/services/generation-character-proposal-proof.ts:115-117`              | `JSON.stringify([...key_events...])` 比较                     | 需两侧同为 JSON                                    |                       |
| 字段清单            | `electron/services/main-generation-owner.ts:734`                                | `fields` 数组含 `keyEvents`                                    | 检查                                            |                       |
| **作者编辑器**       | `src/components/editor/ChapterCardEditor.tsx:1157-1158`                         | **Textarea**，`updateField('keyEvents', e.target.value)`     | ★ **UI 决策点（见 D4）**                            |                       |
| 章节创建预填          | `ChapterCardEditor.tsx:777`、`src/services/auto-next-chapter.ts:30`              | 传值给弹窗/创建参数                                                  | 需 join 或改形态                                   |                       |
| 蓝图续写·前置进度       | `directory.command.ts:227`（`recentBlueprints`）/ `:407-408`                      | 拼成 `第N章 标题：keyEvents` 作为 `chapter_list`（P0-0 的"前序已定稿事实"）    | 需 join                                        |                       |
| **Agent 提案白名单** | `src/services/agent/tools/propose-chapter-blueprint.tool.ts:8`                  | 允许 agent 提案写入的字段含 `keyEvents`                               | ★ **必须同步**，否则 agent 无法再提案该字段                  |                       |
| **Agent 读蓝图**   | `src/services/agent/tools/read-blueprint.tool.ts:39-40`                         | `关键事件: ${bp.keyEvents}` 直接拼文本                               | 数组会被拼成 `[object Object]`，**必须改**              |                       |
| 域变更对比面板         | `src/components/panels/agent/DomainProposalDiff.tsx:23` / `:33-37`              | label 映射 + `displayValue`：`Array.isArray → value.join('、')` | ★ **对象数组会渲染成 `[object Object]`**              |                       |
| 蓝图变更检测          | `src/services/workflows/directory-workflow.ts:271`                              | `saved.keyEvents !== blueprint.keyEvents`                   | 需双侧同形                                         |                       |
| 生成 owner 深比较    | `electron/services/main-generation-owner.ts:734-735`                            | `fields` 含 keyEvents + `isDeepStrictEqual`                  | 需双侧同形                                         |                       |
| 缩略文本截断          | `src/shared/plot-tree-generation-pure.ts:286`（`boundedText`）/ `:222`（`.trim()`） | 按**字符**截断 / 空值判定                                            | 需改按数组                                         |                       |
| 章节创建弹窗          | `src/components/dialogs/ChapterCreationDialog.tsx:517-521`                      | **第二处 Textarea**（Label「关键事件」）                               | ★ 与 `ChapterCardEditor` 同处理                   |                       |
| 输入 token 估算     | `src/services/generation/generation-harness.ts:508-509`                         | 整段 messages 字符累加                                            | 随文本自然变化，无需改                                   |                       |

### 2.5 测试

构造 `keyEvents` 值的测试**实测规模：src 37 个文件 / 147 处 + electron 15 个文件 / 28 处 = 合计 52 文件 / 175 处**（`grep keyEvents` 于 `**/__tests__/**`）。重灾区：  
`generate-draft.command.test.ts`、`directory.command.test.ts`、`main-generation-owner.test.ts`、  
`blueprint-repository.test.ts`、`chapter-goal-review.test.ts`、`prompt-local-qwen-contract.test.ts`。
⚠️ **52 个文件 ≠ "阶段 1 必须改 52 个"** —— 分类见 §7（这是评审缺口 2 的回应）。  
另注：`plugins/dsh-ai-novel-writer/` 是**独立插件包**，其 `keyEvents` 已是 `readonly string[]`  
（`novel-store.ts:122`），与主程序模型不同，**不计入本次改动面**。

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

### 3.1 归一化规则（`normalizeKeyEvents` —— 全改造的唯一入口）

读写两侧**都**过这个纯函数，规则只有三条：

| 输入 | 输出 | 说明 |
|---|---|---|
| `string`（旧数据 / 编辑器 Textarea / **阶段 1 的模型产出**） | 按 **`/\r?\n\|[；;]/` 切分**、`trim`、去空 → 多条 | ★ **必须与 `chapter-goal-review.ts:27` 现有规则逐字一致**，否则旧数据的核对项数会变（= 行为变化） |
| `BlueprintKeyEvent[]`（阶段 2 之后的模型产出） | 原样；缺 `id` 补 `ch{N}:E{i}`，缺 `estimatedUnits` 按 `wordsTarget / 条数` 均分 | 按序号**覆盖**模型自报的 `id` |
| 其他（`undefined` / `''` / 非法 JSON） | `[]` | 不抛错 |

**两个推论（关键）**：

1. **库里只存数组**（写入前先 normalize 再 `JSON.stringify`）⇒ **不存在"新旧格式混存"**，
   因此 **阶段 1 与阶段 2 之间没有格式兼容窗口**（评审缺口 3 的真正解法，见 §10）；
2. **读出的旧字符串与编辑器新写入的字符串走同一条切分规则** ⇒ 作者在阶段 1 手动改的
   "多行事件"，与旧数据、与阶段 2 模型产出的多条，**语义一致**。

---

## 4. ★ 关键决策（**待作者裁定**）

| #      | 决策                      | 推荐                                                                                              | 理由 / 代价                                                                                                                          |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **存储形态**                | **复用 `key_events TEXT` 存 JSON**（零 schema 迁移），**不走 lane 六步**                                     | 同表 `characters` 已是此模式；不动 DDL ⇒ 红线 1 与基线指纹**完全不受影响**。代价：DB 层无类型校验（与 `characters` 现状一致，非新增缺陷）。**若选"新增列"** ⇒ 必须走 lane 六步、成本翻倍且收益相同。 |
| **D2** | **`id` 由谁生成**           | **代码生成 `ch{N}:E{i}`**（章号 + 章内序号），模型**不必**给                                                               | 红线「不许让模型自报账目」+ **跨章唯一**（裸 `E1` 在第 7、8 章都出现会歧义）+ 与 `chapter-goal-review.ts` 现有 id（`ch{n}:keyEvents:{i}`）**同族**，两套账目可直接对齐。契约允许模型**可选**给出 id，代码在解析时**按序号覆盖**，避免模型编号漂移。                               |
| **D3** | **`estimatedUnits` 语义** | **可选字段**；缺省时由代码按 `wordsTarget / n` 均分；单位 = 汉字数                                                  | 强制模型预估会让"估不准"变成**硬失败**（增加无谓重试）；作为**建议值**比作为**门禁**稳。                                                                              |
| **D4** | **作者编辑器形态**             | **阶段 1 先保留现有 Textarea**（**必须显式标注"一行一条"语义**），不立刻换结构化编辑器                                                        | 守「语义化小修」；Textarea → 行数组 → 结构化数组是**可逆**的一步。⚠️ 但**必须在 Label/placeholder 写明"每行一条事件"** —— 现在两处 Textarea 都只写「实质冲突与转折」/「关键事件」，作者很可能用逗号或整段写，导致归一化歧义（评审建议，采纳）。结构化编辑器（每条一个输入框 + 预估字数）放**阶段 3**。                                              |
| **D5** | **旧数据兼容**               | **统一走 §3.1 归一化规则**：字符串 ⇒ **按现有切分规则 `/\r?\n|[；;]/` 切成多条**（⚠️ **不是"整体作一条"**）；数组 ⇒ 原样补 `id`/`estimatedUnits`；空/非法 ⇒ `[]`。**读时归一化、写时也归一化，绝不自动回写**。`estimatedUnits` 缺省 = 当前章 `wordsTarget / 条数`；**`id` 不加 `legacy` 之类标注**（会污染后续逻辑） | 守「绝不自动执行副作用」；旧库照常可读可写，作者不感知。★ **必须沿用现有切分规则**：`chapter-goal-review.ts:27` 本来就按 `/\r?\n|[；;]/` 切旧字符串 ⇒ 若改成"整体作一条"，旧数据的核对项数会**从 N 变 1**，产生**真实行为变化**（此缺陷由评审缺口 3 连带发现，见 §10）。**写入侧同样归一化** ⇒ 库里永远只存数组，不存在"新旧格式混存"。                                                                                                     |
| **D6** | **是否一次做完**              | **分三期**（见 §5），**只先做阶段 1**                                                                       | 与"不要过重任务、降低回滚风险"一致；阶段 1 **零行为变化**，是纯地基。                                                                                          |

---

## 5. 分期实施

### 阶段 1 · 地基（**零行为变化**，建议先做）

1. 新增 `BlueprintKeyEvent` 类型 + 两个纯函数：`normalizeKeyEvents(raw: unknown): BlueprintKeyEvent[]`（规则见 §3.1）、`keyEventsText(events)`（统一 join）。
2. `blueprint-repository.ts` 三个边界：**写入前先 normalize 再 `JSON.stringify`**、读取 `normalizeKeyEvents`、比较改双侧 `JSON.stringify`。
3. **9 处**类型定义改 `BlueprintKeyEvent[]`（清单见 §2.2）。
4. `chapter-goal-review.ts` 的 `freezeChapterGoals` 改为**直接吃数组**（保留 `string` 入参旧路径）。
5. **两处 agent 白名单 + 归档 `safeString` + 恢复候选 `source_hash`** 同改（§6 风险表）。
6. **模板暂不动** → 模型仍产字符串 → `normalizeKeyEvents` 按行切成多条 ⇒ **下游行为逐字不变**。
   ⚠️ 注意：**不是"合成单元素数组"**，而是**按现有切分规则切分**（§3.1 推论 2）。

### 阶段 2.5 · 验证期（评审缺口 1，**采纳**）

7. 在阶段 2 与阶段 3 之间插入：跑 **2–3 章真实生成**，在 trace 里比对
   `sum(estimatedUnits)` vs **实际产出字数**，确认偏差可接受再进阶段 3。
8. **若偏差过大**：阶段 3 的停止点判定改为「**实际产出字数**为主判据 + `estimatedUnits` 为辅助」，
   即 `estimatedUnits` **降级为提示**、不承担门禁职责。

### 阶段 2 · 产出侧

1. 三处模板改 JSON 示例（首轮 / 分块 / 反向提取），zh + en **+ 作者全局覆盖版**（⚠️ 覆盖版遮蔽内置，漏了这步等于白改）。
2. `blueprint-semantic-contract.ts` 的语言合同文字 + `normalizeBlueprintSemanticItem` 校验改为数组（含 `estimatedUnits` 区间校验）。
3. `prompt-language.ts:505` 英文合同同步。

### 阶段 3 · 消费侧（P1-1 / P1-2 / P1-3 各自的活）

1. 短细纲按编号分配（写第 N–M 条）。
2. 续写停止点改**事件驱动**，字数降级为护栏（`0.7t` 退回 / `1.3t` 上限）。
3. 【后续计划边界】直接引用编号条目。
4. 结构化编辑器（D4 的第二半）。

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
| **恢复候选 sha256** | `recovery-candidate-repository.ts:85-94` 的 `source_hash` 是整体快照 sha256 | ★★ 旧候选（字符串）与新数组**算出不同 hash ⇒ 一律判 stale**；阶段 1 必须先统一 normalize（见 §2.1b） |
| **归档 `safeString`** | `project-archive-service.ts:364` / `:373` | 会把数组**强转字符串** ⇒ 归档变形；阶段 1 同改 |
| **验收脚本读 manifest** | `scripts/real-provider-generation-qualification.mjs:760/845/874/1213`、`scripts/quality-modernization-driver.mjs:1881` 读 `BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST` | 阶段 2 改 `requiredFields` 会波及这两套验收脚本，需同步 |

---

## 7. 验收

- **阶段 1**：**行为不变** + 新增 `normalizeKeyEvents` 单测（覆盖「旧字符串切分 / 新数组 / 空值 / 非法值」）。
  ⚠️ **必须先区分两件事**（评审缺口 2 的回应）：

  | 类别 | 内容 | 怎么找 |
  |---|---|---|
  | **① 数据字面量要改** | 52 个测试文件里直接构造 `keyEvents: '…'` 的 fixture ⇒ 改数组字面量 | **`tsc --noEmit` 精确列出**（类型一改，编译器给出完整清单） |
  | **② 断言要改** | 断言 `keyEvents` 为字符串处（如 `toBe('…')`） | 同上 |
  | **③ 新增** | `normalizeKeyEvents` 单测 | 新写 |

  **"行为不变"的准确含义** = **测试通过数/失败数逐条不变** 且 **断言语义不变**（改的是数据形状，不是期望行为）。
  原稿写"55 个文件"是**笔误**（实测 52）。
  **降本手段**：先改类型 → 跑 `tsc --noEmit` → 按报错清单批量改；比人工 grep **快且不漏**。
- **阶段 2**：跑一次真实蓝图生成，`debug/prompt-trace/` 里 `ioCalls[].messages[].content` 应含数组型 `keyEvents`（⚠️ 不看 `snapshots[].built`）。
- **阶段 3**：按 P1 各自设计稿验收。

---

## 8. 初评（本文自评 · 供作者初评参考）

**结论：建议只批准「阶段 1」，且这是本稿最重要的增量。**
原设计稿把这条当成「必须走 lane 六步」的重活，调研后**该前提被否证**——复用 `key_events TEXT` 存 JSON，
与同表 `characters` 完全同法，**零 schema 迁移、零 DDL 变更、零基线指纹风险**。阶段 1 因此是**纯类型/边界改造**，
行为逐字不变，可用"测试数不变"硬证明，回滚成本≈一次 `git revert`。

**三个需要作者拍板的点**（已经外部评审讨论，见 §10；D2 / D4 已有明确推荐）：
1. **D4 编辑器形态** —— 阶段 1 保留 Textarea（**必须标注"一行一条"**）；结构化编辑器放阶段 3。
2. **D2 id 编号方案** —— **改为推荐 `ch{N}:E{i}`**（跨章唯一 + 与现有 goal id 同族），不再推荐 `E1…En`。
3. **分期边界** —— 阶段 1 单独提交、观察一轮再进阶段 2（中间插入**阶段 2.5 验证期**）。

**我判断的最大不确定性**（外审后：**两条已消解 / 一条保留**）：

1. ✅ **已消解**：旧数据兼容 —— 四类持久化 blob 里最危险的是 `recovery_candidates.source_hash` 的
   **sha256 全快照比对**（旧字符串 vs 新数组算出不同 hash ⇒ 旧候选一律判 stale）。
   **§3.1 的"读写双侧统一 normalize"直接解决**：库里只存数组、读时归一化 ⇒ 哈希两侧同形。
   阶段 1 仍须配回归测试。
2. ✅ **已消解（评审缺口 3）**：阶段 1→2 的**格式兼容窗口** —— 因"写入侧也归一化"，
   **库里永不出现两种格式**，窗口不存在。
3. ⬜ **保留**：`estimatedUnits` 的实际取值质量 —— 只影响阶段 3 停止点精度；
   已按评审建议**插入阶段 2.5 验证期**，偏差过大则降级为提示。

**建议的最小第一步**：阶段 1 的 1–3 项（类型 + repository 边界 + 9 处类型定义），**一次提交**，
跑 `tsc --noEmit` + 契约测试证明零回归。

---

## 9. 待作者确认清单

> **2026-10-14 作者逐条确认：全部同意**（阶段 1 获授权开工，见 §11）。

- [x] D1 存储：同意「复用 TEXT 列、不走 lane 六步？」
- [x] D2 id：同意改为 **`ch{N}:E{i}`**（跨章唯一）？
- [x] D3 `estimatedUnits`：同意「可选 + 缺省按 `wordsTarget / 条数` 均分」？
- [x] D4 编辑器：阶段 1 保留 Textarea + **标注"一行一条"**，可以吗？
- [x] D5 旧数据：同意「**读写双侧统一 normalize**（字符串按现有规则切分）+ 绝不回写」？
- [x] 分期：同意「阶段 1 单独提交 → 阶段 2 → **阶段 2.5 验证期** → 阶段 3」？

---

## 11. 实施进度：阶段 1（2026-10-14）

> **状态（2026-10-14 二次修订）：代码完成、`tsc --noEmit` 归零、回归已真比对、待提交。**
>
> ⚠️ **本节原写「回归比对通过」是不成立的**，已按 §11.6 的真实读数改写。首轮实施**中途失败**：
> 实际引入了 **53 条回归**（含 1 条用户可见的生产崩溃），根因两条，均已修复并补了回归测试。
> 教训：**不要用口径不一致的两份测试日志做"零回归"结论**（见 §11.6）。

### 11.1 落地产物

| 项 | 落点 |
|---|---|
| 新模块 | `src/shared/blueprint-key-events.ts`（`BlueprintKeyEvent` / `normalizeKeyEvents` / `keyEventsText` / `keyEventId`） |
| 新单测 | `src/shared/__tests__/blueprint-key-events.test.ts` |
| 存储边界 | `electron/repositories/blueprint-repository.ts`（读 `rowToData` / 写 `normalizeBlueprintKeyEvents` / 比较 `samePersistedBlueprint` / `commitRange` 全程改用 `normalizedRequest`） |
| 恢复候选哈希 | `electron/repositories/recovery-candidate-repository.ts`（新增 `legacySourceHashMatches` 旧形态只读兜底） |
| agent 两处白名单 | `electron/services/agent-domain-tool-effect.ts`（`keyEvents` 移出 `blueprintStrings`）、`src/services/agent/tools/propose-chapter-blueprint.tool.ts` |
| 归档 | `electron/services/project-archive-service.ts`（`portableKeyEvents` / `reviewKeyEventsField`，**只校验不改形**） |
| 消费点 | `chapter-goal-review.ts`、`plot-tree*.ts`、`narrative-thread*.ts`、`consistency-preflight.ts`、`recovery-candidate.ts`、`directory.command.ts`、`generate-draft.command.ts`、`character-card-generation.command.ts`、`import-novel.command.ts`、`review-revision-*.ts`、`batch-chapter-workflow.ts`、`chapter-workflow.ts`、`directory-workflow.ts`、`plot-tree-repository.ts`、`narrative-thread-repository.ts`、`generation-character-proposal-proof.ts`、`read-blueprint.tool.ts` |
| 编辑器 | `ChapterCardEditor.tsx`、`ChapterCreationDialog.tsx`（Textarea 往返 + **Label/placeholder 标注「每行一条」**，D4）、`DomainProposalDiff.tsx`（对象数组不再渲染 `[object Object]`） |
| 新增回归 | `recovery-candidate-repository.test.ts`「legacy source_hash compatibility」两条（旧候选仍新鲜 / 真改写后照常 stale）；**另加**：`blueprint-key-events.test.ts` 的 `keyEventsText` 字符串直通 2 条、`blueprint-semantic-contract.test.ts` 的「已解码数组二次校验」1 条（缺陷 A/B 的回归，均经负向验证） |

### 11.2 五个实现口径（**与设计稿的偏差，逐条附理由**）

1. **`commitRange` 必须整体切到 `normalizedRequest`** —— 原设计只提"三个边界"。
   但 `assertExactRange` / `commitPayloadHash` / `readExactRange` / 回读比对 / 冻结的
   `character_sync_input` 都读 `request`；若只有 `upsert` 归一化，调用方传字符串时会
   **落库（数组）与回读（数组）不等** ⇒ 误报「蓝图提交回读不一致」。
   归一化对已是数组的输入**幂等**（`id` 按序号重算、`estimatedUnits` 保留），故既有路径零变化。
2. **agent 侧 `keyEvents` 分支不写 `continue` 到 `changes[field] = structuredClone(value)`** ——
   该分支单独 `continue` 且 `changes[field]` 存**归一化后的数组**，因为原子提交路径随后会再一次归一化；
   若在此处保留字符串形态，`isAgentDomainToolCurrent` 的 JSON 指纹会变。
3. **`legacySourceHashMatches` 是设计稿未列的必要补充** —— 设计稿 §8 称 `source_hash` 风险
   「§3.1 读写双侧归一化直接解决」，但那只对**升级后新记录**的候选成立；**升级前已落库**的
   pending 候选，其 `source_hash` 是按自由文本算的，若不补旧形态比对，会**一律被判 stale**
   （= 真实的用户可见行为变化）。该函数**只读、不回写**，命中条件同时要求
   `source_draft_id` / `source_draft_version` 仍然一致。
4. **契约的 `keyEvents` 校验必须是双形态（`requiredKeyEvents`）** —— 设计稿只提"三个存储边界"，
   未提**校验器会吃到自己的产出**。`structured-batch-executor.ts:554` 对已解码产出再调
   `validateItem`，此时 `keyEvents` 已是数组 ⇒ 只收字符串必然崩（缺陷 A）。
   这是**阶段 2 之前就必须有的过渡态**：模型产字符串、领域对象是数组，两者共存。
5. **`keyEventsText` 必须接受字符串，且逐字返回** —— 设计稿 §3「文本呈现」只写了数组分支，
   未覆盖**续写恢复链路**（`draft:chapter-info` 反序列化出来的是字符串，缺陷 B）。
   选择"逐字返回"而非"切分再 join"，是为了不把作者原文的 `；` 改写成换行
   （`【作者资料（保留原文）】` 块承诺原文保留）；同时 `draft-recovery-workflow.ts` 在边界
   用 `normalizeKeyEvents` 归一化，让下游真正拿到数组。

### 11.3 已知残留（**不影响正确性，记录备查**）

- **文本呈现的分隔符归一**：多条事件进 prompt 时以 `\n` 连接（设计稿 §3「文本呈现」明文规定），
  因此模型若用 `；` 写多条，载荷中会由 `；` 变成换行。**条目集合不变**（`chapter-goal-review` 旧代码
  本就按 `/\r?\n|[；;]/` 切分），属设计已裁定行为，**不是偏差**。
- **升级后"原样重存"同一章会让旧候选转 stale**：升级后作者若把某章蓝图**不加修改地重新保存**，
  `key_events` 列由纯文本变为 JSON 数组串，旧候选的文本形态哈希不再命中。
  触发条件三重叠加（升级 + 该章被重存 + 存在未处理旧候选），后果仅为**多一次重新生成**，
  **无数据丢失**，且不自动回写。**接受为已知限制**，不在阶段 1 处理。
- **`main-generation-owner.ts:734` 的 `fields` 数组无需改**：`isDeepStrictEqual` 两侧分别来自
  `JSON.parse(character_sync_input)` 与 `BlueprintRepository.getAll()`，**本就同为数组形态**。

### 11.4 验收读数

- `tsc --noEmit`：**0 错误 / 退出码 0**；`eslint` 全部改动文件**干净**。
- **同口径回归比对（★ 这才是有效判据）**：同一批 10 个文件
  （`blueprint-semantic-contract` / `consistency-preflight` / `auto-next-chapter` / `plot-tree-generator` /
  `directory-workflow` / `generate-draft.command` / `directory.command` / `import-novel.command` /
  `draft-recovery-workflow` / `editor-discard`）：
  HEAD = **403 passed / 0 failed**；阶段 1 修复后 = **403 passed / 0 failed**。
- **src 侧全量 touched 面**：21 个文件 **670 passed / 0 failed**；electron 侧
  （repository × 7 + `main-generation-owner`）**251 passed / 0 failed**。
- **★★ 全量套件同口径比对（最终判据）**：纯 HEAD 与「阶段 1 修复后」各跑一次完整 `vitest run`
  （清空 `NODE_OPTIONS` 以避开 safe-delete shim 噪声）：

  | | HEAD | 阶段 1 修复后 |
  |---|---|---|
  | Tests | **140 failed / 5754 passed** | **137 failed / 5779 passed** |
  | Test Files | 25 failed / 406 passed | 24 failed / 408 passed |
  | **新增失败文件** | — | **0（无）** |

  ⇒ **零新增回归**；失败数反而**少 3**（均在 `scripts/` 计时敏感用例：`smoke-win-installer`、
  `quality-modernization-run`、`release-win-verify`，与本改动无关）；通过数 **+25**
  （新增 `blueprint-key-events.test.ts` 19 例 + 3 条回归 + 修复的 `plot-tree-repository`）。
  **全部剩余失败均已在 HEAD 逐条复现**，与阶段 1 无关。
- **已知非回归失败（已逐条在 HEAD 复现）**：
  - `electron/controllers/__tests__/generation-controller.test.ts` 1 例 `PORTABLE_SCHEMA_UNSUPPORTED`
    —— **HEAD 同红**（该路径 stage 1 一行未碰）；
  - `src/services/workflows/commands/__tests__/finalize-postprocess-character.integration.test.ts`
    2 例 —— **HEAD 同红**（`nextChapterPrompt` 断言）；
  - `project-restore-service` / `project-archive-service` / `legacy-project-copy-import` /
    `portable-project-format` / `plot-outline-batch.command` 等 —— **HEAD 同红**。
- ⚠️ **环境前置**：测试跑在 Node（当前机器 **Node 24.20.0 ⇒ `NODE_MODULE_VERSION 137`**）。
  若 `better-sqlite3` 处于 Electron ABI（145），**全部 sqlite 相关测试会因 ABI 不匹配集体失败**
  （实测 1861 failed），这是环境噪声、与本次改动无关；跑测试前先
  `node scripts/prepare-native-for-node.mjs`，**跑完 dev 前须在非沙箱终端**
  `pnpm run rebuild:electron` 切回。

### 11.5 下一阶段入口

阶段 2（产出侧）**未动**：`builtin-prompt-templates.ts:872/:882/:949/:957/:1610/:1615` 三处模板 +
`prompt-language.ts:505` + `directory.command.ts:241-242` 内联 JSON 形状 + **作者全局覆盖版**
+ `BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST` 波及的两套验收脚本。动手前先 `getPromptSource(key)`
并核对真实覆盖目录（`~/.vela/prompts/` 是 legacy 只读源，**不是生效目录**）。

### 11.6 ★★ 首轮实施失败复盘：两条真实缺陷（2026-10-14 修复）

首轮实施把「代码写完 + `tsc` 归零」当成完成，**漏了两条真实缺陷**。用**同一批 10 个文件**在
HEAD 与「阶段 1 已应用」下分别实跑，才暴露出真实读数：

| 状态 | 读数 |
|---|---|
| HEAD（无阶段 1） | **403 passed / 0 failed** |
| 阶段 1 首轮 | **53 failed / 350 passed** |

#### 缺陷 A（29+ 条）：契约对「已解码产出」二次校验，打断整条蓝图生成链路

调用链：`directory.command.ts:461`（`validateItem: validateBlueprintSemanticItem`）
→ `structured-batch-executor.ts:554`（对 `decoded` 逐项调 `validateItem`）
→ `validateBlueprintSemanticItem` → `normalizeBlueprintSemanticItem`。

`decodeBlueprintSemanticPayload` 已经把 `keyEvents` 变成数组，二次校验时
`requiredText(数组)` 抛 `StructuredContractDiagnostic('invalid_type', 'blueprint.keyEvents')`
⇒ 报 `code=invalid_output reason=invalid_item`。**HEAD 下解码产出是字符串，故不报**。

- **修法**：新增 `requiredKeyEvents(value, path)` 双形态入口（数组放行，其余仍走
  `requiredText` ⇒ 空串仍是 `empty_value`、非串非数组仍是 `invalid_type`）。
- **教训**：解码器与校验器共用同一个归一化函数时，**必须保证函数对"自己的产出"幂等**。

#### 缺陷 B（4 条）：`keyEventsText` 吃不下旧字符串 —— **用户可见的生产崩溃**

`keyEventsText` 原为 `(events ?? []).map(...)`。而**续写/恢复链路**上传的是字符串：
`draft-recovery-workflow.ts` 把持久化的 `draft:chapter-info` 原样 `JSON.parse(...) as Partial<ChapterInfo>`，
而该 authorInput 是 `generate-draft.command.ts:640` 用 `JSON.stringify(writerChapterInfo)` 写入的，
`WriterChapterInfo.keyEvents` 在 `:267` 被显式声明为 **`string`**。
⇒ 恢复已中断的章节正文报 `TypeError: (events ?? []).map is not a function`。

- **修法（两层）**：① `keyEventsText` 接受 `string` 并**逐字返回**（不重新切分 —— 保住作者原文，
  `【作者资料（保留原文）】` 块承诺的正是原文保留）；② `draft-recovery-workflow.ts` 在边界用
  `normalizeKeyEvents` 把 `keyEvents` 归一化后再构造 `GenerateDraftCommand`，让下游真正拿到数组。
- **教训**：领域契约改类型时，**要顺着"持久化 authorInput → 反序列化 → 重建命令"这条恢复链路
  单独走一遍**；`as ChapterInfo` 这类断言会**掩盖**契约不匹配。

#### 缺陷 C（其余，均为 fixture/断言未同步）

- **`normalizeKeyEvents` 漏传 `chapterNumber`**（`directory-workflow` / `blueprint-repository` /
  `character-repository` / `main-generation-owner` 等）：得到 `ch0:E1`，而生产路径是 `ch1:E1`。
  **判据**：夹具必须传真实章号，否则 id 与生产不一致。
- **断言仍按字符串比较**：`toBe(字符串)` → 数组时代必然失败（`toBe` 是引用相等，**改 `toEqual`**）。
- **`；` 归一为 `\n`**：进 JSON 载荷后 `JSON.stringify` 转义为字面 `\\n`，断言须写
  `'核查遇阻\\n承担代价'`。这是 §11.3 已承认的设计行为，**不是偏差**。

#### ★ 方法论教训（写进本条以免重犯）

1. **"零回归"必须用同口径基线**：首轮拿 `test-clean-before.txt`（只覆盖 **79** 个文件、且被截断
   无汇总行）与 `test-clean-after.txt`（覆盖 **432** 个文件）对比 —— **口径不一致，结论无效**。
   正解：**同一批文件**分别在 HEAD 与改动后各跑一次。
2. **`tsc` 归零 ≠ 语义正确**：两条缺陷都通过了类型检查（A 是运行时形状不符，B 被 `as` 断言掩盖）。
3. **新增回归测试必须做负向验证**：撤掉修复后测试要变红，否则测不到东西
   （本次 `keyEventsText` 与 `requiredKeyEvents` 的 3 条新用例已做负向验证：撤掉修复即 3 红）。
4. **全量跑失败数不可直接当回归判据**：环境噪声（`better-sqlite3` ABI、超时）会淹没真实信号，
   要**先分类**（ABI / 超时 / 真实断言差异）再判。

## 10. 外部评审意见处理（2026-10-14 · 其他项目组意见稿）

> 评审稿整体质量高：**否证原假设**、**定位 `source_hash` 风险**、**列举易漏消费点** 三处与本文独立调研结论一致。
> 下面逐条裁定 —— **采纳 5 条、修正 2 条、并借它连带发现并修正本稿 1 处真实缺陷**。

### 10.1 采纳（已落到本稿）

| # | 评审意见 | 处理 |
|---|---|---|
| 1 | **缺口 1**：`estimatedUnits` 缺质量保障机制，建议阶段 2/3 间加**验证期** | ✅ 采纳 → 新增 **§5 阶段 2.5**，并写明"偏差过大则停止点改以实际字数为**主判据**" |
| 2 | **缺口 2**：测试改动量未精确估算 | ✅ 采纳 → §2.5 给出**实测 52 文件 / 175 处**；§7 给出**三类分类** + `tsc --noEmit` 清单法 |
| 3 | **缺口 3**：阶段 1→2 兼容窗口未定义（编辑器写入什么格式） | ✅ 采纳**问题**；**解法不同**（见 10.2-1） |
| 4 | **D2**：推荐 `ch{N}:E{i}` | ✅ 采纳 → §4 D2 改为推荐 `ch{N}:E{i}` |
| 5 | **D4 / D5 补充**：Textarea 需标注"一行一条"；缺省 `estimatedUnits` 按 `wordsTarget/条数`；`id` 不加 legacy 标注 | ✅ 全部采纳 → §4 D4 / D5 |

### 10.2 修正

| # | 评审说法 | 修正 | 依据 |
|---|---|---|---|
| 1 | 缺口 3 给两个选项：(a) 编辑器写字符串、阶段 2 再迁移；(b) 编辑器改写入数组 | **都不是**。正解 = **写入侧也过 `normalizeKeyEvents`**（§3.1）⇒ 库里永远只存数组，**根本不存在混存窗口**，也不需要"一次性迁移脚本" | 编辑器仍是 Textarea（D4），它传的**就是字符串**；把"转数组"放在 repository 边界比改编辑器更内聚、改动更小 |
| 2 | "55 个测试文件需改" | 实测 **52**（src 37 + electron 15）；且**不是全都必须改** —— 只有「构造 fixture」「断言字符串」两类要改，第三类是**新增** | `grep keyEvents` 于 `**/__tests__/**` 的实测计数 |

### 10.3 ★ 由评审**连带发现**的本稿真实缺陷（已修正）

评审缺口 3 追问"编辑器写什么格式"，逼出一个本稿原有缺陷：

> **原 §4 D5 写的是「不是数组 ⇒ 降级为单元素数组」。这是错的。**
> `chapter-goal-review.ts:27` 对旧字符串本来就按 `/\r?\n|[；;]/` **切分成多条**；
> 若按"整体作一条"降级，旧数据的核对项数会**从 N 变 1** —— **这正是本稿要避免的"行为变化"**。
> ⇒ **已修正**：D5 / §3.1 改为**按现有切分规则切分**（保持行为逐字不变）。

### 10.4 评审未覆盖、本稿保留的独立结论

- `electron/services/project-archive-service.ts:364/:373` 的 `safeString` 会把数组**强转字符串**（归档变形）；
- **两处 agent 白名单**（`agent-domain-tool-effect.ts:10`、`propose-chapter-blueprint.tool.ts:8`）；
- **验收脚本读 `BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST`**（`scripts/real-provider-generation-qualification.mjs:760/845/874/1213` 等）；
- `DomainProposalDiff.displayValue` 对**对象数组**会渲染成 `[object Object]`。
