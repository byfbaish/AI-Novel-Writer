# 架构重建 = 整册替换（角色采纳语义分岔）

> 状态：已实施（作者 2026-10-29 裁定「按建议来」）  
> 日期：2026-10-29  
> 上级稿：[`character-proposal-adoption-merge-design.md`](character-proposal-adoption-merge-design.md)（那份管**增量链**的字段合并，本稿管**重建链**的整册替换，两者是分岔不是替代）

---

## 1. 问题（实机取证）

作者「清空角色卡后重新生成架构」，跑完后发现：右边运行日志里明明有新的主角卡（含锚点行、四层性格），但面板上的卡还是旧的；角色列表里 11 张，看得出有三批「名字不同、实际同人」。

查库（`characters` 42 行 / 11 活跃 / 31 退休）得到三条事实：

| 现象 | 证据 |
|---|---|
| 19:02 那次只落了 5 张新配角卡 | 采纳收据 `created=5, revived=0`；决策是 `陈砚 → keep-unresolved`、`赵铎 → keep-unresolved`，只有 5 个新名字 `create` |
| 11 张活跃卡是三批叠加 | `character-adoption:56106949`（13:44，4 张）与 `character-adoption:bed26526`（19:05，5 张）两批都没被上一批淘汰 |
| 图谱越滚越乱 | 活跃关系 47 条，其中陈砚→赵铎 10 条、措辞各异；本轮只产生 6 条边且不含主角 |

### 1.1 主角卡为什么被丢弃（根因链）

1. 提案项的 `sourceId` 是 `<artifactId>:<selectionKey>`，别名表的 `source_key` 是 `<operationId>`（`character-adoption:<runId>`）——**两套体系永不同源**；
2. `resolveScopedCharacterIdentity` 带 sourceKey 解析必然落空，`character-proposal-service.ts` 于是去掉 sourceKey **只按名字**重试；
3. 只按名字命中唯一候选时，函数因为「没有 sourceKey」不能断言是同一人，返回 `unresolved + candidateIds:[那一张]`；
4. `defaultCharacterProposalSelections` 只在「unresolved **且零候选**」时新建，其余一律 `keep-unresolved`。

⇒ **旧卡活着，新卡就进不来**，而 UI 只在一行小字里写「暂不采用：身份尚未明确」。

### 1.2 旧批为什么一直不退

`approve()` 里 `retireIds: []` 是硬编码空数组。只有作者在名册里手动删卡（`character-roster-author.ts`）才会 `retired=1`。所以每重跑一次架构都是**叠加**。

## 2. 决定：架构生成走整册替换

架构生成的心智模型是「重建一册名单」，不是「给现有名册补几张卡」。判据收成一个纯函数：

```ts
isArchitectureRebuildBatch(source) = source.kind === 'generation' && source.inputKind === 'architecture'
```

命中该判据时，采纳语义有四条与增量链不同：

| # | 规则 | 理由 |
|---|---|---|
| 1 | **默认采用**：唯一同名候选 → `map`（多候选仍 `keep-unresolved`，不猜） | 重建语境下唯一同名就是同一人；不这样做新卡被静默丢弃 |
| 2 | **字段覆盖**：新值非空即写入，不追加旧文；但 `provenance.kind === 'author'` 的字段保留 | 重建要的是这一册新性格，留着旧性格才是缺陷；反过来作者手改过的字段也不能每重跑一次就被冲掉 |
| 3 | **名单外旧卡退休**：活跃、未被本批采用、且 provenance 是架构/规划材料自动采纳产物 → `retired=1` | 不做这一步就是叠加而不是替换 |
| 4 | **关系边收敛**：本批声明过的每一对角色只保留一条边 | 实测同一对堆了 10 条措辞各异的边 |

### 2.1 覆盖与合并的分界（按字段 provenance）

| 字段 `static_provenance.fields[key].kind` | 现有值 | 重建时 |
|---|---|---|
| `author` | 非空 | **保留**（作者亲手改的，重建不是重置作者意见） |
| `author` | 空 | 采用候选 |
| `generated` / `derived` / 无记录 | 任意 | **覆盖**成候选值 |
| 任意 | 候选为空 | 不写（缺字段 ≠ 要清空） |

于是「重建」不等于「无条件覆盖」：它只重置**模型写的部分**。这条与合并稿「采用生成文本绝不改写作者没碰过的字段」是同一纪律的两种形态 —— 增量链靠"追加不覆盖"，重建链靠"覆盖但排除 author 字段"。

### 2.1 谁不会被退休

`isRosterRebuildRetirable` 只对**生成产物**生效，两类卡受保护：

- `provenance.kind === 'author' | 'legacy'`：作者手建的卡、历史迁移卡，重跑架构不该清掉；
- `approvalId` 以 `finalized-character-adoption:` / `cast-` 开头：**正文里出现过的人**（定稿链、归位表补全），重新生成架构不代表这些人不该存在。

### 2.2 其他链不受影响

导入（`import`）、定稿（`finalized-generation`）、旧名册（`legacy-roster-generation`）、归位表（`cast-ledger`）、目录（`directory`）全部保持原语义：默认不猜同名、字段合并、不退休任何人。有回归用例钉住（见 §5）。

## 3. 实现

| 位置 | 改动 |
|---|---|
| `src/shared/character-proposal.ts` | 新增 `isArchitectureRebuildBatch(source)`（主进程与渲染进程共用一份判据） |
| `src/services/workflows/character-proposal-preview.ts` | 默认选择：重建且唯一同名候选 → `map`；预览顶部加一句「本次是整册重建：同名按同一人替换，名单外旧角色会被退休」 |
| `electron/services/character-proposal-service.ts` | 新增导出纯函数 `replaceAdoptedCharacterFields`（覆盖语义）与 `authorOwnedFields`（从 provenance 里挑出作者手写字段）；`map` 分支按 rebuild 二选一；`retireIds` 按 §2.1 计算；commit 之后对本次涉及的对做边收敛 |
| `electron/repositories/character-roster-repository.ts` | **补 `updated_at`**：revive / changes / retire 三条 UPDATE 都显式写 `datetime('now')` |

### 3.1 为什么要顺手补 `updated_at`

revive 与 changes 路径过去只写 `identity_revision`，不改时间戳。后果不只是显示问题：13:44 明明改写并复活了陈砚的卡，`updated_at` 仍停在 10-25，**这次取证因此先被误判成「卡片没落库」**（还有一层：SQLite `datetime('now')` 存的是 UTC，比较时必须换算）。

## 4. 已知边界

- **同名不同人仍会被合并**：重建链下唯一同名直接 `map`。这是刻意取舍（重建即同一册），作者若遇到真同名的两个人，只能改名或在面板里改判；
- **`sourceKey` 与别名 `source_key` 仍未同源**：本次没有动身份解析，只在消费侧绕开了「必须带 sourceKey 才能 resolved」的限制。要让两条链共用一套来源键，得先决定别名表的 `source_key` 语义（当前是每次批准一个新 operationId，天生无法跨批命中）；
- **关系收敛只作用于本批声明过的对**：本批没提到的旧边不会被清，避免一次重建抹掉作者手写的关系。
- **不解决「名字漂移」**：实测同一批职能被反复造出新名字（周敬安 / 周秉德 / 韩执事 / 周执事…）。本稿只保证库里不再叠加，名字稳定属于 prompt 侧的问题。

## 5. 回归

- 新增 `electron/services/__tests__/character-proposal-architecture-rebuild.test.ts`（7 例）：覆盖/保留作者字段两条纯函数契约 + 整卡覆盖与时间戳 + 作者手改字段存活 + 旧批退休且不误伤作者卡与正文卡 + 增量链不退休 + 同对边收敛到 1 条；
- `src/services/workflows/__tests__/character-proposal-approval.test.ts` 增 1 例：重建批次唯一同名默认 `map`、多候选仍不猜、非重建批次行为不变；
- 既有 `character-proposal-*` 7 个套件 42 例全绿。
