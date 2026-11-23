# FACT · 候选规则盘点与取舍（S2 第一步 · 卡面 prompt 第 1 条）

- 判定面：`7bffc1ee7cd1d13db02466bcfdbe12bd73625490`
- 筛选口径（卡面明文）：**结构对结构、可判定**；凡需要读懂自然语言的都不要；两侧任缺结构化字段 ⇒ fail-open 不判；新规则独立 `stableFactKey` 前缀。

---

## §A 已选（本卡实施，详见 `impl-package.md`）

| # | 规则 | 为什么它合格 | 为什么它值得做 |
|---|---|---|---|
| R1 | `attacks.space` 未登记 | 名字逐字比对；登记侧是 `parseSpaceRules` 的现成输出 | 契约（`blueprint-semantic-contract.ts:51/63`）明文要求「逐字复制」，**全仓零校验** |
| R2 | `attacks.hour` 越窗 | 纯数字比较，复用 `isWithinWindow`；`hours=none` / 按月窗口一律跳过 | 同上；「被作废的那一格根本不存在」是确定性矛盾 |
| R3 | 同一格被两章声称作废 | `(space,hour)` 字符串聚合 + 章号集合比较 | 卡面「纯增量」里唯一能跨章的确定性对账；`arc-node.ts:236` 的 INV-2 同族但射程不同 |

**共同前提**：`attacks` 是**已有结构化输入**，`blueprints.key_events[].attacks` 由 `normalizeKeyEvents` 严格归一化（`blueprint-key-events.ts:111-127`），`db:blueprint-get` 读出即带（`blueprint-repository.ts:191`），两处 preflight 调用点都拿得到 —— 不需要新 IPC、不需要新列、不需要新提示词。

---

## §B 已评估、**本卡不做**（附理由与建议承接方）

| # | 候选 | 为什么合格 | 为什么这次不做 |
|---|---|---|---|
| C1 | 世界观【具名人物登记】(`人名｜定位｜口吻｜关系`) vs 蓝图 `characters[]` | 逐字比对，格式是固定四段竖线，属结构 | **全库无解析器**（`docs/plans/prompt-assembly-backlog.md` 12.9 明确写「末尾【具名人物登记】全库无解析器，要等 W4a 的 `anchors`」），要新写一个模块 → 超出「按既有先例实现」的卡面口径。建议单独立卡，落地位置＝新建 `src/shared/named-character-registration.ts`（本卡白名单无新增文件约束，故不做） |
| C2 | 弧光结构位 `covers` 接进预检（INV-1 提前消耗后续弧光） | `validateArcCovers`（`src/shared/arc-node.ts:238-297`）**已经是纯函数**，注释写着「P12-2 会接进预检」 | 预检调用点（`consistency-preflight.ts:24-46`）拿不到 synopsis 与弧光结构；要接线得为 preflight 增两个输入（新 IPC / 新参数）⇒ 属**接线**不是**加规则**。建议另卡，且那一卡动 `readConsistencyPreflight` 签名需先出方案 |
| C3 | 章节要点 `space anchor`（地点栏目）vs 空间登记 | 理论上可判 | 模板**不产出**地点栏目（`src/shared/space-anchor.ts` 文件头 §「锚点实际从哪来」已实测），默认 `places=[]` ⇒ 恒不可判定，做了也是死规则 |
| C4 | 角色名册（roster）vs 蓝图 `characters[]` | 名字逐字 | 作者普遍用别名/称谓，名册只有 `displayName`；误报率不可接受。要做得先有 stable ID 口径（`character-identity.ts` 的 `displayNameSnapshot` 只对**已定稿**角色成立） |
| C5 | `keyEvents[].estimatedUnits` 之和 vs 本章字数目标 | 纯数字 | preflight 调用点**没有** `targetUnits` 输入（单章对话框有 `wordsTarget`，但没传进 `BlueprintForPreflight`）⇒ 同 C2，属接线 |
| C6 | 定稿连续性事实（`continuity_facts.statement`）vs 本章蓝图 | — | `statement` 是模型产出的自由文本，分类靠关键词粗分（`finalized-continuity.ts`）⇒ **语义**，违反卡面第一条 |

## §C 已否（技术上不成立，别再提）

| 候选 | 否掉的理由（取证） |
|---|---|
| `attacks.space` 必须出现在本章 `spaceRefs` 里 | 契约明说「hour 是**被攻击那一格**的钟点，**不是这一章动手的钟点**」（`blueprint-semantic-contract.ts:51/63`）⇒ 动作地点与被攻击空间可以不同，强判必误报 |
| `attacks.hour` 与本章 `spaceRefs.timeRef` 比对 | 同上，两者语义不同 |
| 从正文散文里抽「谁在什么时候做了什么」再对账 | 语义解析，卡面第一条直接否 |
| 中文时段词（「下午两点」「黄昏」）换算 | `space-time-consistency.ts:1-20` 文件头已定性：只认 `HH:MM`，不认语义时段 |
| `keyEvents[].id` 章号前缀错位 | `normalizeKeyEvents` 读时**重算** `id`（`blueprint-key-events.ts:174-180`，`keyEventId(chapterNumber, index)`），存储里的 id 永远正确 ⇒ 恒空判 |
| 蓝图 `characters` 重名/空串 | 调用点已 `split(/[、,，]/).filter(Boolean)`（`ChapterCreationDialog.tsx:368`），纯格式问题，价值低于噪声成本 |

---

## §D 顺手发现、本卡不修的既有偏差（供裁决，不作本卡判据）

1. **`structuredRefs` 双路径不对称**：单章对话框构造 `BlueprintForPreflight` 时**没传** `structuredRefs`（`ChapterCreationDialog.tsx:362-372`），批量路径传的是 DB 行（含 `structuredRefs`，`blueprint-repository.ts:185-196`）⇒ 现有的 `space:` 规则在单章路径上恒 fail-open，`describeSpaceTimeCoverage` 会如实报「本次未参与判定」。要不要修是**产品口径**（单章路径当前静默，修了会让存量项目首次冒 finding），建议由项目总负责人裁定后再单独派卡，不在本卡偷偷改。
2. **C2 的纯函数已就绪但没接线**：`arc-node.ts:238` 注释写「P12-2 会接进预检」，实际 `grep -rn "validateArcCovers"` 只有 `auditArcCovers`（`:449`）在架构生成命令里用（`architecture.command.ts:812`）—— 预检侧确实没接。
