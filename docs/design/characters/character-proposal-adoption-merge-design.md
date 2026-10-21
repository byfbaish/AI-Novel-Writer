# 角色提议「采用到已有角色」的字段合并策略

> 状态：已实施（作者 2026-10-21 裁定：「初始面板的内容都已经被正文引用，不适合直接覆盖，最好采用合并路线」）  
> 日期：2026-10-21  
> 上级稿：无（与 [`p1-blueprint-roster-sync.md`](p1-blueprint-roster-sync.md) 相邻，但那条管的是蓝图↔roster 同步，不管提议采用）



---

## 1. 问题

角色提议弹窗里，作者把一份候选「**采用到已有角色**」时，卡片字段会怎么变？

旧规则（`electron/services/character-proposal-service.ts` 的 approve 循环）：

```
字段为空                                   → 采用候选值
字段非空 + 字段来源是 generated / derived   → **直接覆盖成候选值**
字段非空 + 字段来源是 author / legacy       → 跳过（保留原值）
```

问题出在第二行：**初始角色往往由 AI 生成（来源 generated），而它们的设定早已被正文引用**。  
这时采用候选会直接冲掉正文里已经写过的事实 —— 正文和角色卡对不上，后续审稿/写稿会拿错事实。

## 2. 决定：改合并，不覆盖

作者 2026-10-21 裁定合并路线。规则按字段分两类：

| 字段                                                                                             | 现有为空 | 现有非空且与候选不同              |
| ---------------------------------------------------------------------------------------------- | ---- | ----------------------- |
| 叙述性：`appearance` / `personality` / `background` / `abilities` / `motivation` / `arc` / `notes` | 采用候选 | **保留原文 + 空一行追加候选**（不覆盖） |
| 标识性：`name` / `gender` / `age` / `role`                                                         | 采用候选 | **保留现有值**，既不覆盖也不拼接      |

两条护栏：

- **幂等**：若候选（去空白与常见标点、小写化后）已经包含在现有文本里，则**不写**——  
  重复导入同一份材料不会把同一段话叠两遍；
- **可追溯**：写入仍走原有 changes 路径，字段 provenance 照常盖成本次批准来源，  
  未被采纳的字段 provenance 不动（与「采用生成文本绝不改写作者没碰过的字段」同一纪律）。

## 3. 实现

| 位置                                                                   | 改动                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `electron/services/character-proposal-service.ts`                    | 新增导出纯函数 `mergeAdoptedCharacterFields(existing, candidate)`；approve 循环里 `map` 分支改用它（删掉旧的「按 origin 覆盖或跳过」判断与随之无用的 `provenance` 局部量） |
| `src/components/characters/CharacterProposalSelectionPanel.tsx`      | 面板顶部补一句规则说明，避免作者以为「采用就等于覆盖」                                                                                                       |
| `electron/services/__tests__/character-proposal-field-merge.test.ts` | 6 条纯函数用例：空字段补全 / 非空追加 / 包含即去重 / 空白标点归一 / 标识字段不覆盖 / 空候选无差异                                                                         |

## 4. 为什么不做成「更聪明」的合并

- **不做语义合并**（判断两段描述是否冲突、谁更权威）：那是审稿链的活，写进角色卡就等于用一次导入  
  私自裁决事实。合并只保证「原文不丢」。
- **不给追加内容加来源标记**：角色字段会作为 prompt 材料下发，标记文本会污染提示词；来源追溯靠  
  `static_provenance.fields`，不靠正文里的括号。
- **不合并 name**：改名会重开别名窗口（`character_aliases` 的 `valid_through`），属于身份操作，  
  必须走作者显式编辑，不能被一次「采用」顺手做掉。

## 5. 遗留与后续

- **反复导入会变长**：幂等只挡「完全包含」的情形，措辞不同仍会追加。若作者感到字段膨胀，  
  后续可在面板上加「合并预览」，让作者保存前看到将追加的段落；
- **短字段的冲突不提示**：`gender`/`age`/`role` 与现有不同时静默保留现有值。若需要，可在候选行上  
  标一句「与现有不同，已保留现有值」，本稿未做；
- **关系提议的采用**：同一弹窗里「候选 → 已有卡」的关系现在可以一键采用  
  （`RelationshipBinding` 在目标名唯一命中名册时给出「采用到已有角色卡：X」，产出  
  `{ sourceSelectionKey, targetCharacterId, relation }`）；同名多张卡时保持禁用并提示手填。

## 6. 回归

- `character-proposal-field-merge.test.ts` 6/6；
- `character-proposal-grouping.browser.tsx` 4/4（含新增「目标唯一命中已有卡可直接采用」）；
- `character-proposal-confirmation.browser.tsx` 4/4；`character-proposal-reopen/declined` 6/6；
- `tsc --noEmit` 与 eslint 均 0 错误。
