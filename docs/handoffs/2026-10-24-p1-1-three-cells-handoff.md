# P1-1 剩余三格交接（制度 / 知情 / 能力）

> **状态**：期 2 ✅ 已合入（`ad2e0c58`）· 期 3 ✅ 已合入（`610c3c9e`）· **期 4a 未开工（待形状提案 + 作者签 G4a）**
> **日期**：2026-10-24 凌晨 · 分支 `exp/resource-ledger` · schema 15 → **17**
> **本稿定位**：接手人只看这一份就能继续施工。**实现细节在各期设计稿，本稿只写状态、判据、门与坑。**

---

## 1. 先读这四份

| 序 | 文档 | 为什么必须读 |
|---|---|---|
| 1 | [`../plans/p1-1-three-cells-plan.md`](../plans/p1-1-three-cells-plan.md) | 三期形状、19 处接线、团队协议、G0–G5、**核验十二条**、既有红清单（§5.3） |
| 2 | [`../design/architecture/p1-1-institution-cadence-design.md`](../design/architecture/p1-1-institution-cadence-design.md) | 期 2 形状与「锚 = 上次真的发生」的理由 |
| 3 | [`../design/architecture/p1-1-knowledge-state-design.md`](../design/architecture/p1-1-knowledge-state-design.md) | 期 3 形状、**引用键为什么不复用 `continuityStableFactKey`**、失效三态 |
| 4 | [`../design/architecture/long-form-readiness-review.md`](../design/architecture/long-form-readiness-review.md) §3 | 六类 continuity 的宿体现状（哪几格已落地、哪格还空） |

行业术语一律用它：**continuity / story bible 分区 / consult the bible / findings / power system / knowledge state**。
**不新增判据编号**；要表达约束就写「与判据 DN 同型」并给理由。

---

## 2. 总状态

| 格 | 迁移 | 表 | 登记页 | 写前查阅 | 状态 |
|---|---|---|---|---|---|
| 物品 possession | M14 | `key_items`（10 列） | ✅ | ✅【关键物品】 | ✅ 期 1（`b7c96853`） |
| **制度 periodic obligations** | **M15** | **`institution_cadences`（13 列）** | ✅ | ✅【制度（周期事件：到没到点）】 | **✅ 期 2（`ad2e0c58`）** |
| **知情 knowledge state** | **M16** | **`knowledge_states`（11 列）** | ✅ | ✅【知情（谁知道什么）】 | **✅ 期 3（`610c3c9e`）** |
| 能力 power system | M17 | 未建 | — | — | **⏳ 期 4a：只交形状提案** |

**写前查阅现在的节序**（`prewrite-consultation.ts:174-182`，改顺序会让四条哈希全翻）：

```
前文事实 → 关键物品 → 制度 → 知情 → 能力(未做) → 本书规则
```

**四条哈希锚点**（`context-entry-parity.test.ts`）：`dcca9697…`（无 prewrite）· `a006dfb7…`（前文事实+规则）·
`9db07fa7…`（`{cadences}`）· `7183dafb…`（`{knowledge}`）· `bddf8727…`（空必需材料）。
**前四条永远不改**；每期只能**新增**本节独立哈希。

---

## 3. 判据与形状（三张表各一行 + 三个"为什么不"）

| 格 | 一行判据 |
|---|---|
| 制度 | **锚 = 上次真的发生**（不是起算点 t0）；轴由作者选（每 N 章 / 每 N 日）；四态 `due / not_due / overdue / unknown`；**只判「该不该发生」，不判「应发多少」** |
| 知情 | 一行 = 某角色在第 L 章得知了第 C 章定稿里的那条事实；`fact_key = 'kf:' + sha256(章号␟归一化引文).slice(0,16)`；三态 `valid / stale / unverifiable` |
| 能力（待定） | Sanderson 第二定律三类限制（**硬限制 / 弱点 / 代价**）+ 当前阶段；**不做次数/冷却/积分** |

**为什么不记起算点 t0**：t0 要模运算，中间漏写一轮会被悄悄吞掉、此后永久错位；记「上次发生」则错位只影响一轮。

**为什么不复用 `continuityStableFactKey`**：它把模型复述的 `statement` 也算进 key ⇒ 同一件事每章重抽就换措辞
⇒ key 变 ⇒ 引用断。新键只用「章号 + 逐字引文」两个**不随抽取漂移**的量。

**为什么制度不引用 `resources.period`**：`prompt-builder.ts:318-330` 从类型上只收 `name/unit`（判据 DK：模型会拿费率算钱），
`period` 从来没有消费者。制度**自持 cadence**，两处各说各的不会互相打架，因为语义本就不同（口径说明 vs 周期事件）。

---

## 4. 期 2 · 制度（M15，`ad2e0c58`）

**交付**：`institution_cadences` 13 列 + 四态判定 + 独立登记页 + 写前查阅第四小节（≤6 条 / 480 字）。
33 文件 / +2188 行。

**判定表 9 行**（`src/shared/institution-cadence.ts`，逐行有用例）：章轴缺锚/未来锚 → `unknown`；
`elapsed ≥ 2×interval` → `overdue`；`interval ≤ elapsed < 2×interval` → `due`；否则 `not_due`；
日序轴缺锚 → **`unknown`（绝不降级）**；本章日序不可知但有 `fallback_interval_chapters` → 按章判（`basis='chapter-fallback'`），否则 `unknown / story-day-missing`。

**三处成员自裁（我复核后接受）**
1. `readCadences` 多收一个已算好的 `storyDayAnchors` —— 不再单独打一次 `db:continuity-list-before`。
2. 日序轴补了「锚日 > 本章日序 → `unknown / anchor-in-future`」（计划表只在章轴写了），与章轴对称。
3. `note` 不进提示词 —— 与「不判应发多少」一致（480 字预算下会挤掉判定行）。

**已知限制**：① 写前日序轴多为 `unknown`（新章日序为 null，且作者常不填降级轴）；② 逾期**只**在注入侧判定，
登记页没有「当前章」上下文，所以只落了表尾提示，**没有逐行标红** —— 要做得再引一条 IPC，属第二期。

---

## 5. 期 3 · 知情（M16，`610c3c9e`）

**交付**：`knowledge_states` 11 列（`character_id` FK / `fact_chapter` / `fact_evidence` / `fact_evidence_hash` /
`fact_key` / `learned_chapter` / `evidence` / `source` / 时间戳 + `UNIQUE(character_id, fact_key)`）+
三态 `refState` + 独立登记页 + 写前查阅第五小节（≤6 条 / 640 字）。32 文件 / +2690 行。

**四条不能再讨论的裁定**：人粒度 `character_id`（name 在 M02 后不唯一）· 只做正向知情 · **不做 C1 身份分面** ·
事实**引用**定稿事实、**不另存陈述**（存了就有两套措辞，封闭默认立刻失效）。

**封闭默认只在注入文本里成立**：登记过的事实 ⇒ 未列入者视为不知道；**未登记的事实一概不判**。
后半句必须逐字在节首说明里（`knowledge-state.ts:212`），否则会被读成「没登记 = 不知道」。

**失效三态怎么算**（在主进程仓储里算，渲染层与生成链都不自己拼）：
只在 `sourceStatus === 'current'` 的投影上判 key 在不在 —— 在 ⇒ `valid`；不在 ⇒ `stale`；
**投影缺失 / 已过期 / legacy ⇒ `unverifiable`**。**不自动改键、不自动删行、不自动迁到新事实**
（索引是无主键 JSON 数组，无 supersede 语义，自动改等于替作者认定「新的就是旧的那条」）。

**三处成员自裁（我复核后接受）**
1. `renderKnowledgeLine` **去掉 `chapterCharacters` 参数** —— 样例行不随「谁出场」变化，排序只在 `renderKnowledgeSection` 做（`orderKnowledgeStates` 里 `onStage` 集合）。
2. `refState` 只在 current 投影上判「在不在」（计划写的是「该章索引在」，等于把 stale 投影也算「在」）—— 收紧更保守，与「读不到就说读不到」一致。
3. 期界过滤（`learned_chapter <= 本章` 且 `refState === 'valid'`）放在 `readKnowledgeStates` 内，不在调用点。

**一处它做得比我要求更稳**：`fact_key` / `fact_evidence_hash` **由主进程从「章号 + 引文」重算**
（`knowledge-state-repository.ts:176`），客户端传什么 key 都改不了 ⇒ 不存在「面板算的和库里的不一致」这条缝。

**已知限制**（设计稿 §7 全文）：多章缺投影 ⇒ 大量 `unverifiable`（重新定稿该章即恢复）·
手填引文与库内引文差一个字 ⇒ `stale`（从候选里选最省事）· 不做负知识 · 不做 C1 · 不做自动抽取 · 不做 findings。

---

## 6. 期 4 · 能力（M17，未开工）

**前置门 G4a 只签文档**：`docs/design/architecture/p1-1-power-system-shape-proposal.md` **不存在**，必须先写。
写它需要的取样**在作者本机项目库里**（不在仓库）：
`golden_finger`、`characters.abilities`、世界观第 1 维。取样后要回答的是「这本书的能力到底是哪几类形态、
三类限制填得满吗」，而不是先建表。

**已定形状**（不得再讨论）：`power_abilities(ability_id, name UNIQUE, form, hard_limit, weakness, cost_note,
stage_chapter, stage_note, evidence, source, created_at, updated_at)`；`form` **不设 CHECK**（行业资料明确
「类别界限并不分明，常是几种特性的混合体」，词表只作 UI `datalist` 提示）；三态 `active / ahead / undated`，
**`ahead` 一律不注入**（剧透）。表名不叫 `abilities`（`characters.abilities` 是真实列名）。

---

## 7. 团队与门（谁在哪签、失败过哪条）

| 角色 | 期 | 实际耗时 | 我这关签了什么 |
|---|---|---|---|
| `eng-institution`（甲） | 期 2 | 22 分钟 | 19 处接线 + 4 套新测试，我**没代写一行** |
| `eng-knowledge`（乙） | 期 3 | 61 分钟 | 同上；期间它 `git stash` 做 HEAD 基线对照，我盯到 pop 完成 |
| `eng-power`（丙） | 期 4a → 4b | — | **G4a 只签文档，不签则 4b 不启动** |

**串行铁律的原因**：19 处接线里 15 处是共享文件（migrations registry / desktop-registry / portable 两处 /
prewrite-consultation / chapter-materials / generate-draft / editor-store / EditorArea / ProjectTree / sidebar-openers /
ipc-channels / db-controller），并行必冲突，且四条哈希会被连续打穿。

**失败过的一条（已写进计划 §5.3）**：期 2 收口时我以为迁移验收脚本红了是我弄坏的 ——
用 `git stash` 对照 HEAD 发现 `project-format-migration` 的 2 例 `PROJECT_MIGRATION_UNSAFE_FILE` **本来就红**。
⇒ **G5 的判据从「脚本 exit 0」改成「与基线失败集比对」**。接手人别重复踩。

---

## 8. 风险与不做

| 项 | 处理 | 状态 |
|---|---|---|
| 宿体又变成第二套账（重犯 W6） | 只存事实，不存算术结果；制度的 `note`、知情的 `evidence` 都不进提示词 | 已守 |
| 注入把上下文撑爆 | 三节最坏合计 +1.76 KB（480+640+640）；**装不下只降本节常量，不许改成可选材料**（续写轮会静默丢） | 已守 |
| `unknown` 被折成 `not_due` / 未来知识被提前注入 | 各有专门用例；渲染、类型、测试三处都分开 | 已守 |
| 世界状态页新增只读区 | **本期三格都没做**（要动 7 处，见计划 §2 备注） | 未做（有意） |
| findings（未卜先知 / 集体失忆 / 漏发） | 归 P2-1；本期只提供数据 | 未做（有意） |
| 自动抽取（谁在第几章知道了什么） | 不做；模型说的不算数 | 未做（有意） |

---

## 9. 顺手修的既有问题

- `runner.test.ts` 把 lane 清单与 `length: 13` 写死 → 改成从 `MIGRATION_LANE` 派生（断编号连续 / from-to 衔接 / owner 非空）。
- `m05–m14` lane 测试的 `toBe(12|13|14)` → `>= 上一版`（约定：**只有最新一档钉死版本**）。
- `project-sqlite-upgrade` 的「少装一档全线不放行」**结论本身是错的** → 改成「需要经过它的那一档的起点才不放行」。
- 便携/归档计数随迁移推进：54/516/161 → 59/558/203，`schemaVersion` 12 → 17。
- 评审 §0 / §1 图 / §1.1 / §2.1 / §2.2 与台账 12.15 里「四类事实无宿体」「知情依赖 C1」等**过期状态句**已清。

---

## 10. 下一步

1. **期 4a（丙）**：取样 → 写 `p1-1-power-system-shape-proposal.md` → 我签 G4a。**不签不开工**。
2. **期 4b**：M17 + 登记页 + 写前查阅第六小节（插在知情之后、本书规则之前）+ 六节齐备总哈希。
3. **之后**（按评审 §5 的顺序，先能用→写对→查错→跨部）：卷末快照（P1-2）→ findings（P2-1，注意
   `review_findings.resolved` **写不进去**）→ W8 跨部（P2-2）。
4. 三格都收口后，**这里补一节「六节齐备」总状态**并把本稿状态行改成「全部完成」。
