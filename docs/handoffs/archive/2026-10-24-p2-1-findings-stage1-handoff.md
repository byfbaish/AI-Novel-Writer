# P2-1 findings 期 1 · 交接（2026-10-24）

> 状态：**已实施**（代码 + 测试全绿）；**待实机样本复验**（设计稿 §6.2）
> 设计稿：`docs/design/review/p2-1-continuity-findings-design.md`
> 分支：`exp/resource-ledger`

## 1. 这一期做了什么

把 P1-1 四类登记事实（物品 M14 / 制度 M15 / 知情 M16 / 能力 M17）作为**核对基准**拼进**每章审稿 prompt**，
由审稿模型产出带本章逐字引文的 findings，走**既有**报告 → `review_findings` 投影 → 作者三选一处置。

- **零 schema 变更**（仍为 20）、**零迁移**、**零新增模型调用**（审稿本来要跑一次）。
- findings 的 `category` 固定为 **`连续性核对（作者登记）`**（en：`Continuity check (author registry)`）。
- 模型 findings 落库是 `unverified`（无 span），与今天所有 literary finding 同形 ⇒ **不进 recheck**，这是预期行为。

## 2. 改了哪些文件

| 文件 | 动作 |
|---|---|
| `src/shared/review-continuity-bible.ts` | 新增：`buildReviewContinuityBibleBlock` + 四类规则 + `REVIEW_CONTINUITY_CATEGORY` + 额度常量 |
| `src/shared/key-item.ts` | 新增 `orderKeyItemsForChapter`（本章出场者持有排前） |
| `src/shared/knowledge-state.ts` | 新增 `knowledgeUsableAtChapter`（期界 + 引用有效） |
| `src/services/workflows/commands/review-continuity-canon.ts` | 新增：4 条 IPC 并发读 + 每类独立降级 + 失败清单 |
| `src/services/workflows/commands/review-chapter.command.ts` | 改：`readContinuityBibleBlock` + 在【证据锚点硬约束】后条件注入 + 两行日志 |
| 测试 3 个文件 | 新增 15 例 + 4 例 + 1 例 |

## 3. 四条硬约束（改这一块之前必读）

1. **空即零字节**：四类都没登记 ⇒ 不往 prompt 加任何字符。集成测试里有**提示词哈希锚点**
   `d60dd39deb4f513f780a9933294fbd98cffc23d2cfe07803ba6bfccf2e484fca`（`review-revision-runtime.test.ts`
   的「没有登记时不注入任何字节」一例）。**有意改审稿提示词 = 必须同步改这一行 + 记进设计稿 §3**。
2. **recheck 分支不读不带**：那一轮输出合同没有 `category`，产不出新 finding；集成测试断言**连四条 IPC 都没发**。
3. **不加 item 新字段**：合同只有 `category/quote/description/severity`；塞 `stableFactKey` 会被拒，并把这些 item 错接进 recheck 目标链。
4. **口径必须与生成链同源**：物品排序 / 制度四态排序 / 知情期界 / 能力 `ahead` 过滤，四处都在
   `generate-draft.command.ts:2453-2461 / 2487-2491 / 2519-2520 / 2547`。本期**未改**生成链，
   由 `review-continuity-bible.test.ts` 的「读源码型」断言守漂移 —— 生成侧一改就红，届时两处一起改。

## 4. 验证

```
tsc --noEmit                     ✅
vitest run（5 个受影响套件）       ✅ 189 例（含既有 46 例回归）
eslint（改动文件）                ✅ 零告警
check-doc-links.mjs              ✅
```

- `context-entry-parity` 的 7 条锚点属**写稿材料块**，本期不动材料组装 ⇒ **不需要重算**。
- 仓库另有 19 处**既有** lint 错误（`src/shared/arc-position.ts`、若干 `__tests__`），非本期引入，未动。

## 5. 期 1 没做（别以为漏了）

确定性档（四类都没有可比对的结构值）· 波及扫描（依赖跨章清单）· 跨章累积清单与 resolve 状态机（要推翻 v2 契约）·
`review_findings.resolved` 的不可达修复（刻意设计）· 卷切片 · 时间/空间/人物三类的语义档（各有既有落点）。

## 6. 下一步

1. **实机跑一次**设计稿 §6.2 的四条人造矛盾 + 干净章，把误报填进 §6.3 表。
2. 然后回评审 §5 的顺序：**P1-2 期 2**（卷末交接自动生成，动 `architecture.command.ts:3374` 卷翻转点）
   → 12.15 剩两项（伤势单调 / 位置可行）→ 修「第 5 维被挤出前 8 条」→ 让 `golden_finger` 进材料块 → W8。
3. 若实机误报偏高，优先收紧**规则文本**（`review-continuity-bible.ts` 的四个 `*_RULE`），不要动额度（额度是防挤占的闸）。
