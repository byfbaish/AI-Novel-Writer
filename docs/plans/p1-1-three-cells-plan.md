# P1-1 剩余三格 · 施工计划与团队协议

> **状态**：🚧 **期 2 ✅、期 3 ✅ 已合入；期 4a 未开工（等形状提案 + 作者签 G4a）**
> **基准**：HEAD `610c3c9e` · **schema 17** · 已落地 P0-2 期 1（写前查阅）+ P1-1 期 1 物品（M14）/ 期 2 制度（M15）/ 期 3 知情（M16）
> **交接**：[`../handoffs/2026-10-24-p1-1-three-cells-handoff.md`](../handoffs/2026-10-24-p1-1-three-cells-handoff.md)（状态、判据、门与坑都在那儿）
> **事实依据**：`docs/design/architecture/long-form-readiness-review.md` §3 / §5 · `industry-alignment-and-stage-goals.md`
> **术语**：continuity / story bible 分区 / consult the bible / findings / power system / knowledge state。**本批不新增判据编号。**

---

## 0. 范围与切分

| 期 | 内容 | 迁移 | 交付物 | 已裁定的关键点 |
|---|---|---|---|---|
| **期 2** ✅ | 制度（周期事件：月例/签到/送账） | **M15** v15→16 | 表 + 登记页 + 写前查阅第 4 节 | 判定轴作者选，缺则 **unknown** |
| **期 3** ✅ | 信息流（who knows what） | **M16** v16→17 | 表 + 登记页 + 写前查阅第 5 节 | 人粒度、只做正向知情、**不做 C1** |
| **期 4a** ✅ | 能力（power system）**形状提案** | — | 取样记录 + 字段论证 | **只签文档，不写码**（2026-10-24 已签，见提案 §0.0） |
| **期 4b** | 能力落地 | **M17** v17→18 | 表 + 登记页 + 写前查阅第 6 节 | Sanderson 三类限制 + 阶段 |

**写前查阅的注入顺序（三期共用，定死）**：
前文事实 → 关键物品 → **制度 → 知情 → 能力** → 本书规则。
事实与设定靠前（先看 canon），规则最后（像约束条款，收尾位最不易被忽略）。

全部写进 `chapter-materials.ts` 的 `author:required`（必需块 ⇒ 续写轮也可见）；`prewrite` 缺省必须**零字节**。

---

## 1. 三格形状

### 1.1 制度 `institution_cadences`（M15）

```
cadence_id · name(UNIQUE) · axis('chapter'|'story-day') · interval(>0)
· anchor_chapter · anchor_story_day · fallback_interval_chapters
· note · chapter_number · evidence · source · created_at · updated_at
```

- **锚 = 上次真的发生**，不是起算点 t0 —— 起算点要模运算，错过一轮就永久错位。
- `chapter_number`（制度写在哪章）与 `anchor_chapter`（上次发生在哪章）**不是重复**。
- **四态**：`due` / `not_due` / `overdue`（`elapsed ≥ 2N`：至少漏了一整轮）/ `unknown`。
- **降级只发生在运行时值缺失这一侧**：日序轴缺锚 ⇒ 永远 `unknown`，**绝不折成 not_due**；锚有但本章日序不可知 ⇒ 有 `fallback_interval_chapters` 才按章判（`basis='chapter-fallback'`），否则 `unknown / story-day-missing`。
- 只判「该不该发生」，**不判「应发多少」**（ADR-0022）。
- **自持 cadence，永不引用 `resources.period`**：`prompt-builder.ts:318-330` 从类型上只收 `name/unit`（判据 DK：模型会拿费率算钱），period 从未进过提示词。

### 1.2 信息流 `knowledge_states`（M16）

一行 = 「某角色在第 L 章得知了第 C 章定稿里的那条事实」。

```
knowledge_id · character_id · fact_chapter · fact_evidence · fact_evidence_hash · fact_key
· learned_chapter(≥ fact_chapter) · evidence · source · created_at · updated_at
· UNIQUE(character_id, fact_key)
```

- 主语是 `character_id`，**表里不存名字**（M02 后 `characters.name` 不再 UNIQUE）；显示名读时 JOIN。
- 只做**正向知情**；`CHECK(learned_chapter >= fact_chapter)` 挡住「先于事实存在就知道」。
- **封闭默认只在注入文本里成立**：登记过的事实 ⇒ 未列入者视为不知道；**未登记的事实一概不判**（这句必须逐字出现在节首说明，测试钉它）。

**引用键（本期唯一技术硬点）**

```
fact_key = 'kf:' + sha256(`${fact_chapter}\u001f${normalizeQuote(fact_evidence)}`).slice(0, 16)
normalizeQuote = trim + 连续空白压成一个空格（不做 Unicode 归一：定位用的是原文切片）
```

| 问题 | 结论 |
|---|---|
| 为什么不用 `continuityStableFactKey`（`consistency-preflight.ts:73-91`） | 它把模型复述的 `statement` 也算进 key ⇒ 同一件事每章重抽就换措辞 ⇒ key 变 ⇒ 引用断。新键只用「章号 + 逐字引文」两个不随抽取漂移的量 |
| 为什么不拿引文原文当键 | 200 字做索引与 IPC 太重；16 hex 够用，「同章同文」本就该是同一条 |
| 为什么不让 `statement` 参与 | 一旦允许，就等于承认「同一引文两种表述 = 两条事实」，封闭默认立刻失效 |
| 事实被重抽/改稿 | key 不重算（key 是引用不是内容哈希），由 `refState` 判失效 |

**失效三态**：`valid` 参与 / `stale`（该章索引在但已无此 key）跳过 + 提示重选 / `unverifiable`（该章索引缺失）跳过 + 提示读不到。
**不自动改键、不自动删行、不自动迁到新事实** —— 索引是无主键 JSON 数组（`summary_snapshots.continuity_facts`），无 supersede 语义，自动改等于替作者认定「新的就是旧的那条」。

### 1.3 能力 `power_abilities`（M17，4b）

依据 **Sanderson 第二定律**（限制 > 能力；限制分**硬限制 / 弱点 / 代价**三类）+ 网文金手指形态（系统/宝物/导师/功法/天赋/知识/规则）。

> ⚠️ **本节已被期 4a 修正（2026-10-24，G4a 已签）**：形状以
> [`p1-1-power-system-shape-proposal.md`](../design/architecture/p1-1-power-system-shape-proposal.md) §2.2 为准。
> 三处变化：**新增 `evidence_scope`（13 列）**、**只登「本书级规则能力」不登角色技能**（`characters.abilities` 是它的家）、
> **`stage_chapter` 的默认值是 `undated`**（真实三库「第 N 章」命中 0 次）。下面保留原稿以便对照。

```
ability_id · name(UNIQUE) · form · hard_limit · weakness · cost_note
· stage_chapter · stage_note · evidence · **evidence_scope（4a 新增）** · source · created_at · updated_at
```

- **`evidence_scope`**：`golden-finger` / `worldbuilding` / `chapter`。**为什么必须有**：三本书的能力出处 **100% 是设定文本、0% 是章号**；
  没有这一列，UI 只能把「世界观第 1 维那句话」渲染成「来源第 3 章」——那是伪造章号（判据 DN 同型）。
- **登记主体**：只登**本书级规则能力**。有角色归属的技能留在 `characters.abilities`（且已随角色卡进正文，`:2171`），
  再登一份就是第二套账（W6 的教训）。所以本表**刻意没有 `character_id`**。
- `form` **不设 CHECK**：行业资料明确「类别界限并不分明，常是几种特性的混合体」，实测 18 个实例里 3 个跨类；
  词表只作 UI `datalist` 提示，词表外照样保存并原样渲染（要有测试：词表外值读回来一字不差）。
- 表名不叫 `abilities`：`characters.abilities` 是真实列名，同名会把「角色卡原文」与「power system 登记」混为一谈。
- **三态**：`active`（≤ 本章）/ `ahead`（> 本章，**一律不注入**，剧透）/ `undated`（未标章号，**真实主路径**）。
  `ahead` 在真实数据里不会自然出现，它是「作者手填章号才有」的开关 —— 期 4b **不得**声称「解决了剧透」。
- **空字段整段省略**（`hard_limit`/`weakness`/`cost_note` 为空就不出现，且不写「未登记」）：
  这是对判据 DN 的**刻意例外**，理由是注入「限制未登记」会被模型读成「没有限制」，比不写更糟。要有零字节测试。
- **不做**次数/冷却/积分/强度平衡/技能树（派生数值，ADR-0022）。
- 与相邻格的划界：**有归属与转手 = 物品；有硬限制/弱点/代价 = 能力；有数量增减 = 资源**；同时成立就分别登记
  （小绿瓶既是宝物也是能力载体）。**载体没了能力还在不在**这件事，只有分两行登记才写得出来。

### 1.4 各节预算

| 节 | 条数 | 字数 |
|---|---|---|
| 制度 | 6 | 480 |
| 知情 | 6 | 640 |
| 能力 | 5 | 640 |

三节最坏合计 +1.76 KB。装不下时**只降本节常量**，不许改成可选材料（续写轮会静默丢）。

---

## 2. 接线（M14 实测 19 处，按符号名索引，不接受"照旧"）

| # | 位置 | 内容 |
|---|---|---|
| 1 | `electron/migrations/mNN-*.ts`（新建） | SQL 常量 + `hasSchemaObject` + `apply`（表/索引**分别**判存在）+ `verify`（列集/可空性/UNIQUE/索引/CHECK）+ 工厂（`owner:'P1-1'`） |
| 2-3 | `migrations/registry.ts` | lane 槽位 + `LATEST_SCHEMA_VERSION` |
| 4-7 | `migrations/desktop-registry.ts` | import 三函数 + `apply`+`schemas(N)`+工厂 + `implementations` 追加 + 指纹展开 + `CURRENT_DESKTOP_SCHEMA_VERSION`（**整行格式逐字不变**，`scripts/project-migration-acceptance.mjs:41` 用正则解析） |
| 8 | `src/shared/project-storage.ts` | `MIGRATION_IDS` 末尾追加 |
| 9 | `src/shared/<cell>.ts`（新建） | 实体/入参/结果 + 上限常量 + **唯一渲染入口**（判据 DM 同型） |
| 10 | `src/shared/ipc-channels.ts` | 3 条（知情 4 条）通道类型 |
| 11 | `electron/repositories/<cell>-repository.ts`（新建） | `hasXSchema`（缺表降级 `[]`，不抛）+ list + upsert（重名就地拒）+ delete |
| 12 | `electron/controllers/db-controller.ts` | handler + **写通道进 `MUTATING_DATABASE_CHANNELS`（读通道不进）** |
| 13-14 | `portable-project-field-policy.json` + `portable-project-format.ts` | `mNNTables` + `tables.<表>` **逐字段**（漏一列 ⇒ 导出 fail-closed）+ origin 联合 + Set + delta 判定 + 三元链末位 |
| 15-17 | `prewrite-consultation.ts` / `chapter-materials.ts` / `generate-draft.command.ts` | 常量 + 渲染 + 组装计数 + `prewrite.x` 透传 + `readX()` + 日志报条数（不报内容） |
| 18 | 界面 5 处 + 2 新文件 | `editor-store.ts` 的 `EditorTab['type']` **与** `PROJECT_SCOPED_BUILTIN_TYPES`（漏后者 ⇒ 两项目共用 tab）、`EditorArea`（import/图标/渲染）、`ProjectTree`（树入口）、`sidebar-file-openers`（联合）、`<X>Panel.tsx` + `<X>Editor.tsx` |
| 19 | 测试 | 见 §3 |
| 20 | 文档 | 新建 `p1-1-<cell>-design.md` + 改评审 §3 对应行 + 改台账 12.14–12.18 |

**每期必须同批改的三处计数**（属**预期变化**，同一提交写清"为什么变"）：

| 期 | `portable-project-format.test.ts` | `project-archive-service.test.ts` | 上一期 lane 版本钉 |
|---|---|---|---|
| 期 2 | 58 表 / 547 字段 / added 192 | `{16, 58, 547}` | `m14` → `>= 15` |
| 期 3 | 59 / 558 / 203 | `{17, 59, 558}` | `m15` → `>= 16` |
| 期 4b | 60 / 570 / 215 | `{18, 60, 570}` | `m16` → `>= 17` |

（实测核对，不要直接抄；数字对不上先查是否漏了一列。）

---

## 3. 每期测试清单

- **期 2**：`m15-installed-lane`（6）· `institution-cadence-repository`（6）· `institution-cadence` 纯函数（10，判定表逐行 + 「渲染行无差值」正则）· `CadenceRegistryPanel.browser`（7）· 扩展 4 处 + 计数 3 处。
- **期 3**：`m16-installed-lane`（6）· `knowledge-state-repository`（8）· `knowledge-state` 纯函数（9，含「同引文不同 statement ⇒ 同 key」「refState 三态」）· `KnowledgeRegistryPanel.browser`（8）· 扩展 4 处 + 计数 3 处。
- **期 4b**：`m17-installed-lane`（6，额外断言 `form` 无 CHECK）· `power-ability-repository`（6）· `power-ability` 纯函数（8，含 `ahead` 不注入、空字段整段省略）· `AbilityRegistryPanel.browser`（7）· 扩展 4 处 + 计数 3 处。

**哈希纪律**：三条旧锚点 `dcca9697…` / `a006dfb7…` / `bddf8727…` **永远不改**；每期**新增一条**本节独立哈希（`{cadences}` / `{knowledge}` / `{abilities}`）；期 4b 再加一条「六节齐备」总哈希。

---

## 4. 团队与串行

| 角色 | 负责 | 可写范围 | 期内开工前 |
|---|---|---|---|
| **甲** `eng-institution` | 期 2（M15） | 19 处 + 设计稿 | 形状对账（G0） |
| **乙** `eng-knowledge` | 期 3（M16） | 同上 | **只读**：核三条旧哈希、读 `continuity_facts` 结构、复核引用键 |
| **丙** `eng-power` | 期 4a → 4b（M17） | 4a 只写提案；4b 同 19 处 | **只读**：取样 `project_core.golden_finger` 与 `characters.abilities`（本机项目库只读连接） |
| **丁** `verifier` | 全程 | **只读**：跑命令、看 diff、出核验单 | 按 §5.2 十二条逐条 |
| **leader（我）** | G0 / G4a / 每期 G5 | 签收、合并、写交接稿 | — |

**串行铁律**：甲 G5 合入后乙才动第一行代码；乙 G5 后丙才开 4b；4a（只读取样 + 文档）可与甲并行。
**原因**：19 处里 15 处是共享文件，并行必冲突，且 `context-entry-parity` 哈希会被连续打穿。

---

## 5. 验收门

### 5.1 门与命令

| 门 | 判据 | 命令 |
|---|---|---|
| **G0 准入** | 分支干净 + 基线绿 + 「DDL ↔ 裁定」逐条对账 | `git status --porcelain` 空；`npx vitest run src/shared/__tests__/prewrite-consultation.test.ts src/services/workflows/__tests__/chapter-materials.test.ts src/services/workflows/__tests__/context-entry-parity.test.ts` |
| **G1 schema** | 迁移 6 处 + 便携 4 处 | `npx vitest run electron/migrations/__tests__` + `tsc --noEmit` |
| **G2 仓储** | 缺表降级/重名/非法值/写通道登记 | `npx vitest run electron/repositories/__tests__/<cell>-repository.test.ts` |
| **G3 界面** | 可增删改、保存前不落库、重名整批不提交 | `npx vitest run --config vitest.browser.config.ts src/components/editor/__tests__/<X>Panel.browser.tsx` + `eslint` |
| **G4 注入** | 三条旧哈希不变 + 新节零字节 + 续写轮可见 | `npx vitest run src/shared/__tests__/prewrite-consultation.test.ts src/services/workflows/__tests__/{chapter-materials,context-entry-parity}.test.ts src/services/workflows/commands/__tests__/generate-draft.command.test.ts` |
| **G4a 形状** | 只签文档：四字段各有真实取样支撑 + 七类形态提示够用 | 读 `p1-1-power-system-shape-proposal.md`；**不签则 4b 不启动** |
| **G5 收口** | 全量绿 + 提交 + 迁移验收 | 全量 `npx vitest run` → 授权 commit → **提交后**跑 `node scripts/project-migration-acceptance.mjs --run-synthetic`（拒脏树）→ 交接稿填实测数字 |

### 5.2 核验官十二条（只读）

1. 迁移 6 处齐全，`id/from/to/owner` 与 lane 一致；`apply` 对表与索引分别判存在。
2. `CURRENT_DESKTOP_SCHEMA_VERSION` 整行格式未改（正则能解析）。
3. `MIGRATION_IDS` 与 `LATEST_SCHEMA_VERSION` 已加。
4. 便携 4 处齐全，`tables.<表>` 覆盖**每个物理列**。
5. 可空列 `verify` 断言 `notnull===0`；仓储读 `COALESCE`、写存 NULL（不是空串）。
6. 零字节：`prewrite` 缺省与传空逐字节相同；三条旧哈希未变。
7. 不伪造章号：无章号分支渲染「作者登记」，且不出现「第0章 / 当前章」。
8. 不注入派生数值：渲染行的数字只能来自输入字段（纯函数测试 + grep）。
9. `unknown` 独立用例且断言 `!== not_due`；`ahead` 独立用例且断言不出现。
10. 期界：未来事实 / 未来阶段不进注入，各有专门用例。
11. 日志只报条数不报内容；无 `console.log` / `[DEBUG-` 残留。
12. 交接稿本节与提交内容一致（文件清单、计数、命令输出对得上）。

---

### 5.3 已知的既有红（**不是本批造成的，别误判**）

| 门 | 现象 | 结论 |
|---|---|---|
| `project-migration-acceptance.mjs --run-synthetic` | `exitCode:1`，根因是 `electron/services/__tests__/project-format-migration.test.ts` 的 2 例 `PROJECT_MIGRATION_UNSAFE_FILE`（`expected {state:'blocked'} to match {state:'ready', backupOnlyCount:2}`） | 期 2 施工后在 **HEAD 基线**（`git stash` 对照）上同样失败 ⇒ 既有问题，与本批无关。但该脚本因此**长期红**，不要拿它当"本批把迁移搞坏了"的证据；`targetSchemaVersion` 能解析成正确值，说明版本行格式没被破坏 |
| `electron/controllers/__tests__` | 3 例（`llm-controller-connection` 2 · `generation-controller` 1，都是 finish code / recovery prefix） | 同样 HEAD 基线对照确认既有 |
| `npx vitest run src` | 10 文件 / 29 例 | 既有（UI 契约、qwen 契约、导出、世界观恢复等），与本批无关 |

**做法**：每期 G5 只与**基线失败集**比对；新增失败才拦。基线失败集要随批更新在交接稿里。

---

## 6. 风险与不做

| # | 风险 | 遇到走哪条 |
|---|---|---|
| R1 | 必需块膨胀 | 只降本节常量（集中一处）；**不许**改可选材料 |
| R2 | 迁移编号被抢 | 停手重排，同步 6 处含指纹顺序 |
| R3 | 便携计数变化被当回归 | 三处计数同批改 + 注释写原因 |
| R4 | 日序轴写前多为 unknown | 这是设计：登记页提示「要写前就能判，请填按章降级」 |
| R5 | 「上次发生」不更新 ⇒ 永久 overdue | 面板标红 + 表头提示；**不做自动推进**（模型说发了 ≠ 记账） |
| R6 | 重定稿导致大面积 `stale` | 只标失效不改键；面板给「按当前定稿重选」 |
| R7 | 「未登记不判」被误读成「谁都不知道」 | 说明句逐字保留 + 测试钉 |
| R8 | 形态词表被当枚举校验 | `form` 无 CHECK；测试钉「词表外照样保存并渲染」 |
| R9 | 能力/物品/资源边界模糊 | 按 §1.3 划界，两处分别登记 |
| R10 | 取样拿不到真实能力原文 | 退化为作者口述粘贴，仍逐字段给出处；**不许凭想象定字段** |

**本批不做**：findings（P2-1；插入点 `consistency-preflight.ts:99-134` + `:219-232` + `review_findings.category`；注意 `resolved` 写不进去 `review-cycle-repository.ts:865`，无引文只能落 `unverified`）· 世界状态新增只读区（要动 7 处，一次做完）· 四格自动抽取 · C1 身份分面 · 审稿链注入 · 复用 `resources.period` · 历法换算 · 能力次数/冷却 · 制度「应发多少」。

---

## 7. 交接文档大纲（三格完工后写）

`docs/handoffs/<日期>-p1-1-three-cells-handoff.md`：
0 抬头 · 1 先读这四份（设计稿 §形状 / 评审 §3 / 台账 12.14–12.18 / 本稿 §1.2 引用键）· 2 总状态表 · 3 判据与形状（三张表各一行 + 三个"为什么不"）· 4 期 2 · 5 期 3 · 6 期 4 · 7 团队与门（谁在哪签、失败过哪条）· 8 风险与不做（已发生标「已踩」）· 9 顺手修的既有问题 · 10 下一步。

---

## 8. 施工前必须知道的两处既有问题

1. ~~**文档与裁定冲突，期 3 必须同批改**~~ → ✅ **已解决（2026-10-24）**：`long-form-readiness-review.md` §1.1 信息流行与 §5 P1-1 依赖列已改为「只做正向知情、不做 C1 身份分面」（与 M16 落地同批）。
2. `review_findings` 的 `resolved` 枚举存在但**写不进去**（`review-cycle-repository.ts:865`，v2 契约要求语义是否解决仍由作者核实）—— P2-1 别建在这上面。
