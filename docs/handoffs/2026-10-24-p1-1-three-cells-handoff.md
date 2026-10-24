# P1-1 剩余三格交接（制度 / 知情 / 能力）

> **状态**：**四格全部收口** —— 期 1 物品 ✅ · 期 2 制度 ✅ · 期 3 知情 ✅ · 期 4a ✅ 已签 · **期 4b 能力 ✅ 已合入**
> **日期**：2026-10-24 · 分支 `exp/resource-ledger` · schema 15 → **18**
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
| 能力 power system | M17 | `power_abilities`（13 列） | ✅ | ✅【能力（本书的能力规则：能做什么、要付什么、什么情况下会被破）】 | **✅ 期 4b** |

**写前查阅现在的节序**（`prewrite-consultation.ts:174-182`，改顺序会让四条哈希全翻）：

```
前文事实 → 关键物品 → 制度 → 知情 → 能力 → 本书规则
```

**哈希锚点**（`context-entry-parity.test.ts`）：`dcca9697…`（无 prewrite）· `a006dfb7…`（前文事实+规则）·
`9db07fa7…`（`{cadences}`）· `7183dafb…`（`{knowledge}`）· `bddf8727…`（空必需材料）；
期 4b **新增** `44ce3a3e…`（`{abilities}`）与 `4e636164…`（六节齐备）。
**前五条永远不改**；每期只能**新增**本节独立哈希。

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

## 6. 期 4 · 能力（M17）

**期 4b ✅ 已交付（2026-10-24）**：`power_abilities` 13 列 + 三态 + 登记页（含「从金手指原文取名字」）+ 写前查阅第六小节（≤5 条 / 640 字）。
实测：迁移 **122**（18 文件，含 m17 lane 6）· 仓储 6 · 纯函数 **23** · 面板 7(browser) · 注入窗口 **362** · 便携 29 + 归档 34 ·
`src` 全量 **3770 passed**（29 失败与基线 10 文件一致）· 便携 **60 表 / 571 字段 / added 216** · 归档 `{18, 60, 571}` ·
新增哈希 `{abilities}` = `44ce3a3e…`、六节齐备 = `4e636164…`；**六条旧哈希一字未改**。

**期 4a ✅ 已签（2026-10-24）**：`docs/design/architecture/p1-1-power-system-shape-proposal.md`（301 行）。
**形状以它的 §2.2 为准，13 列**：

```
ability_id · name(UNIQUE) · form · hard_limit · weakness · cost_note
· stage_chapter · stage_note · evidence · evidence_scope · source · created_at · updated_at
```

取样是**在作者本机库上只读做的**（三库 schema 16 / 9 / 10；`golden_finger` 406 / 318 / 223 字；
`abilities` 填了 7/8、8/9、12/12；「第 N 章」命中 **0**）。我复现过它的三条硬结论，见提案 §0.0。

**4a 改掉的三处（4b 照新形状做，别照旧计划）**

1. **新增 `evidence_scope`**（`golden-finger` / `worldbuilding` / `chapter`）：三本书的能力出处 **100% 是设定文本、0% 是章号**；
   没这一列，UI 只能把「世界观第 1 维那句话」写成「来源第 3 章」= 伪造章号。**只有 `chapter` 档才允许出现章号。**
2. **只登「本书级规则能力」，表里刻意没有 `character_id`**：角色技能留在 `characters.abilities`（已随角色卡进正文，`:2171`）。
   再登一份就是第二套账。代价要记住：**配角「忘了自己有这个技能」这类 findings 仍然查不出来**（那是角色卡质量，另一期）。
3. **`stage_chapter` 的真实默认是 `undated`**：`ahead` 是「作者手填章号才有」的开关，**4b 不得宣称「解决了剧透」**。

**4b 的四条验收条件（我签 G4a 时写下的）**

1. `evidence_scope` 三档各有测试：`chapter` 才渲染「来源第 N 章」，另两档渲染「作者登记」+ 出处域，**渲染行里不得出现章号**。
   ✅ 已落实且**收得比我要求的更紧**：`golden-finger` / `worldbuilding` 两档连「自第 N 章起」都不写（`stage_chapter` 也是章号），
   只写「作者登记」；阶段章号只用于 `ahead` 过滤。代码注释直接引用了这条签署条件。
2. `undated` 是主路径的测试 + `ahead` 只靠构造数据（`stage_chapter` 未来值）。
3. 空字段整段省略 ⇒ **零字节测试**（这是对判据 DN 的刻意例外，设计稿要写理由）。
4. 词表外 `form` 值读回来一字不差（不设 CHECK 的证明）。

**仍照旧的部分**：`form` 不设 CHECK（`datalist` 提示）；表名不叫 `abilities`；不做次数/冷却/积分；
插入位置 `【知情】` 之后、`【本书规则】` 之前；5 条 / 640 字；新增 `{abilities}` 哈希 + 「六节齐备」总哈希。

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

**发现的两条既有缺陷（第 1 条 2026-10-24 已修，第 2 条仍未修 —— 别当成新 bug，也别顺手改）**

1. ~~**【本书规则】在真实世界观里永远排不到第 5 维**~~ ✅ **2026-10-24 已修（轮转分配）**：
   `DIMENSION_PRIORITY = [1,2,4,5]` + 逐维上限 3 + 总上限 8，旧实现是「一维取满再换下一维」，
   实测三库都**恰好 8 条**、分布全为 `{"1":3,"2":3,"4":2}` ⇒ **第 5 维（时间历法）0 条**。
   这**不是样本巧合，是算术必然**：第 1 维 3 + 第 2 维 3 + 第 4 维 2 = 8，只要前两维各有 ≥3 条规则就必然满；
   压第 1 维上限也救不了（2+3+3 仍满）。而第 5 维恰恰是制度周期事件的原料，与制度格、findings 的制度类判定同源。
   现改为**轮转分配**（第 k 轮每维各取第 k 条），**两个上限常量（8 / 3）一个没动**，期 1 语义不变；
   同一份夹具下分布从 `{"1":3,"2":3,"4":2}` 变成 `{"1":2,"2":2,"4":2,"5":2}`。
   **实测不会改 `a006dfb7…` / `bddf8727…` 两条哈希**：这两条锚点用例（`context-entry-parity.test.ts:85` / `:310`）
   都**显式喂 `rules` 数组**（1 条 / 0 条），从不调用 `extractWorldBuildingRules`；`prewrite.ruleCount`
   是 `ChapterMaterialAssembly` 上的独立字段（`chapter-materials.ts:137`），**不进 `bundle.text`**、不参与哈希。
   原「修法会改哈希、另立项」的判断，是误把这两条锚点当成了经过抽取的链路。
2. **`golden_finger` 从不进正文请求**：`withGoldenFinger` 全仓只有 `architecture.command.ts:1635/2130` 调用；
   正文链 `novelConfigFacts` 的排除清单（`generate-draft.command.ts:811-818`）**含 `goldenFinger`**。
   ⇒ 系统流/金手指题材里，模型写第 N 章时看不到「这个能力要付什么代价」。期 4b 的能力槽是**部分补**（只补作者登记的那几句），
   不是全补。

   ✅ **2026-10-24 裁定：「让 `golden_finger` 进材料块」这条路不做。** 理由在 `src/shared/power-ability.ts:6-9`：
   金手指自由文本已由 P1-1 能力格（M17）以 `active` / `ahead` / `undated` 三态承担，正文走的是【能力】节；
   再把整段自由文本注入就是同一件事登记成第二套账，两边冲突时**没有仲裁规则**。所以这条不是「留待另一期」，而是**已判不做**。

**已知 flake（不是回归）**：`project-archive-service.test.ts` 单跑首次偶发 1 例超时（那条用例本身 7–8 秒），
重跑 34/34 全绿；期 3 也出现过同类（并行时 `ENOTEMPTY` teardown）。**报红前先单文件重跑一次再判。**

---

## 10. 下一步

1. ~~期 4a（丙）：取样 → 写形状提案 → 签 G4a~~ ✅ **2026-10-24 已签**（提案 §0.0 有我的复现记录）。
2. ~~期 4b（下一步）：M17（13 列）+ 登记页（名字要能从金手指原文一键取）+ 写前查阅第六小节 + `{abilities}` 哈希 + 六节齐备总哈希~~
   ✅ **2026-10-24 已落地**：13 列 / `evidence_scope` 三档 / 三态 / 5 条 640 字；设计稿
   [`p1-1-power-ability-design.md`](../design/architecture/p1-1-power-ability-design.md)。
   **四格全齐**（物品 M14 / 制度 M15 / 知情 M16 / 能力 M17），§2 的节序就是当前实际顺序。
3. **之后**（按评审 §5 的顺序，先能用→写对→查错→跨部）：卷末快照（P1-2）→ findings（P2-1，注意
   `review_findings.resolved` **写不进去**）→ W8 跨部（P2-2）。
4. 三格都收口后，**这里补一节「六节齐备」总状态**并把本稿状态行改成「全部完成」—— 能力落地后六节已齐，
   §2 已记录当前节序与新增两条哈希；「全部完成」等 leader 收口提交后改。
