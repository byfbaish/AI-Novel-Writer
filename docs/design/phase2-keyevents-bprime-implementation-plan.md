# 阶段 2 + B′（含 R6）实施清单

> **状态**：**待作者过目 · 未动代码**（2026-10-15 02:15）
> **上游**：`blueprint-key-events-structuring-design.md` §5「阶段 2」+ `outline-setting-compatibility-guard-design.md` §8.6（B′）与 §9.7（R6）
> **为什么合并**：B′ 的结构化伴随字段与 R6 的作者决定日志都需要一次 schema 迁移（红线 1 ⇒ lane 六步）。
> 两件事共用**同一次**迁移窗口 ⇒ 一次迁移、两个提交（作者 2026-10-15 裁定 R6 与 B′ 合并）。

## 0. 一句话

**先做产出侧让它产出结构化（零 DDL、可独立验收）→ 再一次迁移把「结构对结构」的比对所需的存储补齐 → 最后接消费侧（校验器 + 锚点人物管理面）。**

---

## 1. 范围与顺序

| 段 | 内容 | DDL | 可独立验收 | 依赖 |
|---|---|---|---|---|
| **段一** | `keyEvents` 阶段 2：产出侧全部改成数组形状 | **零** | ✅ **已实施 `ec2f4e79`** | 阶段 1（已完成） |
| **段二** | B′ 双写：设定侧 `spaceRules` + 蓝图侧 `spaceRefs` + 结构对结构校验器 | 需要 1 列 | 需迁移 | 段一（形状稳定后） |
| **段三** | R6：锚点人物（功能配角）管理面 + 撤销 | 需要 1 表 | 需迁移 | 无（与段二并行） |
| **验证** | 阶段 2.5：真实跑 2–3 章，比对 `sum(estimatedUnits)` vs 实际字数 | — | ✅ | 段一 |

**阶段 2.5 实测读数（2026-10-15 03:05，作者实机生成 ch6-8）**：

| 项 | 结果 |
|---|---|
| 请求形状 | trace 里三处模板请求均含数组示例（`"estimatedUnits": 700`）✅ |
| 落库形状 | ch6 = 4 条 / ch7 = 5 条 / ch8 = 4 条；**id 被运行时重写为 `ch6:E1`…**（模型给的是 `8:E1`）✅ |
| 数值尺度 | `sum(estimatedUnits)` = **2550 / 2600 / 2500** vs 项目「每章 2500 单位」合同 ⇒ 偏差 **+2% / +4% / 0%** |
| 参照 | ch1 已定稿正文 `word_count = 2464`（合同 2500）⇒ 单位尺度 ≈ 字数，估值与真实可比 |
| 修复轮 | 修复后两次运行**均未出现** `:structured-syntax-repair` attempt ⇒ 本地确定性修复生效或输出本就合法 ✅ |
| 旧章兼容 | ch1-5 仍为数组（各 1 条，阶段 1 写时归一），读时双形态未回归 ✅ |

⇒ **阶段 2.5 结论：数值口径可用，可进迁移段**；严格闭环（ch6 估算 2550 vs 其真实正文）留作迁移段的并行观察项。

**段一落地记录（2026-10-15 02:41，`ec2f4e79`）**：三处模板 + 运行时合同（zh/en）+ 内联形状 + 两份覆盖版（含 builtinRevision）+ 验收脚本口径；契约校验无需改（阶段 1 已双形态）；新增形状回归 2 例；5 文件 142/142。**下一步 = 阶段 2.5 实机验证**（跑 2–3 章，比对 `sum(estimatedUnits)` vs 实际字数）。

**建议执行顺序**：段一（✅ 已实施）→ 阶段 2.5 实机验证 → **一次迁移（段二列 + 段三表）** → 段三代码 → 段二代码。
理由：段一本身零风险且立刻可见（trace 里就能看到数组）；而迁移窗口只有一个，进去之前先把产出侧跑通，避免"迁移完了发现形状还要调"。

---

## 2. 段一：`keyEvents` 阶段 2（产出侧，零 DDL）

### T1 内置模板三处（zh；en 走 `prompt-language.ts` 同源）

| # | 模板 key | 内置行号 | 现状要求 |
|---|---|---|---|
| T1-a | `chapter_blueprint`（首轮） | `builtin-prompt-templates.ts:879` / 要求 `:889` | `"keyEvents": "…100字左右具体说明"` |
| T1-b | `chapter_blueprint_chunk`（分块续写） | `:956` / 要求 `:964` | 同上 |
| T1-c | `infer_single_chapter_blueprint`（**导入反向提取**） | `:1619` / 要求 `:1624` | 「本章核心事件概述（100-150字）」 |

改为数组形态，**示例即形态**（红线 12：模型抄示例形状）：

```json
"keyEvents": [{"id": "1:E1", "event": "具体发生了什么，含因果与结果", "estimatedUnits": 700}]
```

同时把「100-150 字以内」的措辞改为 **「每条事件 30-80 字；条目数 2–5 条（按本章体量）」**，并写明 **`id` 由代码最终裁定，模型给的仅作参考**（红线：模型自报账目一律由代码算）。

### T2 内联 JSON 形状（**最易漏的一处，不在模板里**）

`src/services/workflows/commands/directory.command.ts:241-243` 的 `【精确 JSON 形状】`：`"keyEvents":"简洁事件摘要"` → 数组形态（zh/en 两行同改）。

### T3 作者全局覆盖版（红线 3：覆盖版遮蔽内置，漏了等于没改）

作者**确实有这两份覆盖版**（实测目录 `~/.ai-novel-writer-dev/generations/88ac198e…/prompts/`）：

- `chapter_blueprint_chunk.zh-CN.json`（含 `"keyEvents": "具体发生了什么…100字左右"`）
- `infer_single_chapter_blueprint.zh-CN.json`（含 `"keyEvents": "本章核心事件概述（100-150字…）"`）

流程：**备份 → 原子写回 → 写入新的 `builtinRevision`**（否则面板会长期显示"新版内置尚未生效"假警报，上一轮踩过）。
⚠️ 覆盖版正文里若含反引号会被静默截断（红线 14）——用 JSON 完整转义写回，不要手拼。

### T4 契约层

| 位置 | 改什么 |
|---|---|
| `src/shared/blueprint-semantic-contract.ts:19-39` | `requiredFields` 形状说明；新增 `keyEvents` 的**数组合同**（`minimumItems` / `estimatedUnits` 区间 / `id` 必填但被代码覆盖） |
| 同文件 `:41-55` 语言合同 zh/en | 「keyEvents 必须是非空字符串」→「keyEvents 必须是非空数组，元素含 id/event/estimatedUnits」 |
| 同文件 `:217` `normalizeBlueprintSemanticItem` | `requiredText(...keyEvents...)` → 数组校验（含 `estimatedUnits` 为正整数、区间上限防膨胀） |
| `src/services/prompt-language.ts:505` | 英文合同点名 `keyEvents` 的那句同步 |

### T5 验收脚本同步（**容易漏**）

`scripts/real-provider-generation-qualification.mjs`：

- `:845-851` —— 该脚本**动态读 manifest** 拼验收提示词，并断言「title、role、purpose、keyEvents、suspenseHook 为非空字符串」；`keyEvents` 那句必须改为数组形态，否则**验收脚本自己会判不合格**。
- `:790` / `:1213` —— 脚本内的夹具蓝图为字符串（阶段 1 双形态仍可读），但验收口径要一并核对。

`scripts/quality-modernization-driver.mjs` 只引用 case 名（`valid-keyEvents-mustShow-unknown`），**无需改**（已核实）。

### T6 测试面

- `src/services/__tests__/prompt-local-qwen-contract.test.ts`、`prompt-language-contract.test.ts` —— 断言模板措辞/合同的用例随 T1/T4 更新。
- 蓝图命令测试（`directory.command.test.ts` / `architecture.command.test.ts` / `generate-draft.command.test.ts`）—— 断言 `user message` 含 `"keyEvents": [` 的新形状（**信不信由你：写断言而不是镜像实现**）。

### T7 段一验收

1. 跑一遍真实大纲/蓝图（可复用 `每天第一句谎话都会成真`）：trace 的请求里出现数组形状示例；
2. 库内 `blueprints.key_events` = JSON 数组串（`json_valid` 且 `json_type='array'`）；
3. 下游无回归：`normalizeKeyEvents` 双形态仍可读旧字符串（已有回归测试）；
4. `tsc` 0 错 + 相关测试面全绿。

---

## 3. 段二：B′ 双写（结构对结构，不做语义解析）

### T8 设定侧：世界观的机读伴随行

在【空间结构】每条空间条目下，要求模型**额外输出一行机读约束**（人读散文仍在，双写）：

```
老陈记｜hours=07:00-09:00｜entry=直接进入
```

- 落点：`world_building` 模板第 4 维（zh 内置 + en 内置 + **作者覆盖版**，覆盖版存在，走 T3 同流程）。
- 约束：时段一律 `HH:MM-HH:MM` **24 小时制**、跨零点用 `22:00-02:00`；写不了就不写该行（**fail-open**，不逼模型编）。
- 与 A⁺ 的关系：A⁺ 已要求「关键规则写成可判定形式」（`07:00–09:00`），本步只是把**同一事实**再给一个**机器可读的单一引用**——作者条件「同规则异构体 → 单一引用」的落点。

### T9 蓝图侧：`spaceRefs` 伴随字段

蓝图条目新增（与 `keyEvents` 并列）：

```json
"spaceRefs": [{"space": "老陈记", "timeRef": "14:00", "beat": "买早饭"}]
```

- `space` 必须是设定层已登记的空间名（逐字）；`timeRef` 为 24 小时制单点或区间。
- 只在**确有空间/钟点**时输出；没有就空数组（fail-open）。

### T10 校验器（新文件 `src/shared/space-time-consistency.ts`）

**只做结构对结构**（Q4 边界，判据 ⑫）：

1. 空间名引用一致性：`spaceRefs[].space` 是否逐字命中设定层登记名（不是 ⇒ finding「引用了未登记的空间名」）；
2. 钟点包含判定：`timeRef` 落在该空间 `hours` 区间内（**纯字符串/数字比较**，不做任何中文时段推断）；
3. 两侧任缺结构化字段 ⇒ **不判**，只记一条 info「未提供可判定形式」，不阻塞。

### T11 落点与关卡

复用现成闭环（**新增规则 ≠ 新增流程**）：`consistency-preflight.ts` 计算 → `ChapterCreationDialog.tsx:331-353` 有 finding 即停下 → `ConsistencyPreflightPanel` + `ConsistencyExemptionRepository` 放行。
**finding 必须带「冲突源层级」**（本例源 = 世界观 ⇒ 改第 1 章没用），且**绝不自动改**。

---

## 4. 段三：R6 锚点人物管理面（唯一一次迁移的另一半）

### T12 一次 lane 六步迁移，两件事

| 需求 | 迁移内容 |
|---|---|
| 段二需要 | `blueprints` 新增 **TEXT** 列（存 `spaceRefs` JSON；复用"TEXT 存 JSON"惯例，与 `key_events`/`characters` 同法） |
| 段三需要 | 新表 **`character_cast_decisions`**（append-only 作者决定日志：登记 / 撤销 / 口吻 / 定位 + revision + operation_id） |

⚠️ `portable-project-field-policy.json` 需为新列登记策略（`blueprints.key_events` 现标 "D"，新列同类）。

### T13 `declinedCandidateNames()` 改读新表

- 新表为空时**一次性回填**：从既有已批准批次的 `functional` 决策派生（保证老陈这类现存登记不丢）。
- 派生来源从"扫已批准批次"改为"读决定日志"，**撤销 = 追加一条反向记录**（不改写任何已批准收据 —— 与 `reopen` 同一原则：不重写历史，只追加现状）。

### T14 UI：角色侧栏新增「锚点人物（不建卡）」区

- 列出已登记：名字 / 定位 / 固定口吻 / 与主角关系 / 登记来源；
- 操作：**撤销**（撤销后名字回到待建卡候选，蓝图仍声明他 ⇒ 清单自然带回）、改口吻/定位；
- **命名改掉「功能配角」** —— 它与名册角色「配角(supporting)」撞车（作者已指出）；建议 **「锚点人物（不建卡）」**。

### T15 「复活 vs 孪生」语义（设计稿 §9.7 验收点 5）

副本实测：对**已退休身份**同名建卡**会新建孪生身份**（库里出现同名两条，行为无冲突）。
建议按验收点 5 实现：**复活 = 复用原 `character_id`（重开别名窗口）**，并在手动建卡命中已退休同名时提示；撤销登记不等于复活，两者独立。

---

## 5. 验收读数（每段怎么算过）

| 段 | 读数 |
|---|---|
| 段一 | 实机 trace 出现数组示例；`json_type(key_events)='array'`；`normalizeKeyEvents` 旧串兼容测试仍绿；`tsc` 0；契约/模板测试面全绿；`real-provider-generation-qualification.mjs` 的口径同步后自身可通过 |
| 段二 | 校验器单测（**含负向**：未登记空间名 / 越界钟点各一例必须判 finding；缺字段必须不判）；实机跑一次能看到 finding + 关卡停下 |
| 段三 | 撤销后候选清单回填（**副本实测**：撤销老陈 → `pendingBlueprintCandidates` 重新含老陈）；决定日志 append-only（重复操作幂等、不产生第二条同义记录）；四个验收点逐条有测试 |

---

## 6. 红线对照

| 红线 | 本清单如何满足 |
|---|---|
| 1 DDL 冻结 | 段二零 DDL；段二/三**合并为一次** lane 六步迁移；不动既有表结构 |
| 2 主进程 ESM | 无影响 |
| 3 覆盖版遮蔽 | T3/T8 均含覆盖版同步 + `builtinRevision` 写回 |
| 12 示例即形态 | T1/T8/T9 都是"改示例形状"而非"加一句规则" |
| 14 反引号截断 | 覆盖版一律 JSON 转义写回 |
| 16 改内置 required 变量会穿透覆盖版 | 段二**不新增模板变量**，全部走"改示例 + 改已有块"（判据 ⑪） |
| ⑫ 证明只管依赖字段 | 校验器只比结构字段；两侧缺失即 fail-open |
| Q4 边界 | 校验器零语义解析（不认"下午两点"，只认 `14:00`） |

---

## 7. 作者已拍板（2026-10-15 02:22）

| # | 问题 | 裁定 |
|---|---|---|
| 1 | 段二结构化字段存哪 | ✅ **`blueprints` 新增 TEXT 列**（与 R6 同一次迁移） |
| 2 | 校验器触发面 | ✅ **只做同章内单点比较**；跨章一致性留阶段 3 |
| 3 | 命名 | ✅ **「锚点人物（不建卡）」** |

⇒ 本清单**全部前置问题已闭环**，可直接开段一（零 DDL）。

## 8. 原开放项记录（已拍板，保留备查）

1. **段二的结构化字段存哪**：① `blueprints` 新增 TEXT 列（**推荐**，与 R6 同一次迁移，语义清晰）；② 塞进 `key_events` 变成 `{events, refs}` 包装对象（零 DDL，但语义混、触及全部现有读者）。
2. **校验器的触发面**：① 只做**同章内**单点比较（空间名 + 钟点，推荐先做）；② 连跨章一致性一起（同一空间在不同章被赋不同 `hours` 也要判）——后者需要"跨章结构化索引"，建议留阶段 3。
3. **命名**：`锚点人物（不建卡）` / `无卡角色` / 保留`功能配角`（我推荐第一个；理由：名册里已有「配角」，同词不同义必误导）。

---

## 9. 迁移段执行清单（lane 六步 · 已预置，开工即用）

> 2026-10-15 03:15 预置。**本段是唯一一次 schema 迁移**，段二（B′ 结构化列）与段三（R6 决定日志表）共用它。

### 9.0 现状事实（已核对，不要凭记忆）

| 项 | 值 / 位置 |
|---|---|
| 当前 schema 版本 | `LATEST_SCHEMA_VERSION = 8`（`electron/migrations/registry.ts:15`）、`CURRENT_DESKTOP_SCHEMA_VERSION = 8`（`electron/migrations/desktop-registry.ts:17`） |
| 本次新增 | **M08（from 8 → to 9）** |
| 参照实现 | `electron/migrations/m07-plot-structure-plan.ts`（幂等 `apply*` + `verify*` + `createM07Migration`） |
| 基线 | `baseline-schema.ts` **一个字节都不许动**（红线 1）；M00 指纹是 `sha256(JSON.stringify(sqlite_master))` |

### 9.1 迁移内容（两件事，一次做完）

1. **`blueprints` 新增伴随列** `structured_refs TEXT NOT NULL DEFAULT ''` —— 存 B′ 的 `spaceRefs` JSON（与 `key_events` 同法：TEXT 存 JSON，不动既有列）。
2. **新表 `character_cast_decisions`**（R6 锚点人物的 append-only 作者决定日志）：

```sql
CREATE TABLE character_cast_decisions (
  decision_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  anchor_role TEXT NOT NULL,          -- 定位（摊主/门卫…）
  catchphrase TEXT NOT NULL DEFAULT '',
  relation_to_protagonist TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,               -- 'register' | 'revoke'
  source_revision INTEGER NOT NULL,   -- 记录时的角色名册 revision
  operation_id TEXT NOT NULL,         -- 作者操作幂等键
  created_at TEXT NOT NULL            -- 展示前补 Z（见 data-and-schema 约定）
);
```
> 语义：**追加**记录，撤销 = 追加一条 `revoke`；当前有效登记 = 按 `name` 取最后一条。
> 这样「已批准批次不可改写」的历史约束不受影响（与 `reopen` 同一原则）。

### 9.2 六步落点（照 `notes/data-and-schema.md` 的 lane 定义）

| # | 文件 | 动作 |
|---|---|---|
| 1 | `electron/migrations/registry.ts` | `MIGRATION_LANE` 追加 `{ id: 'M08', from: 8, to: 9, owner: '<本次>' }`；`LATEST_SCHEMA_VERSION = 9` |
| 2 | `src/shared/project-storage.ts` | `MIGRATION_IDS` 追加同名 `'M08'` |
| 3 | `electron/migrations/m08-*.ts`（新建） | `applyM08*`（幂等：列/表已存在即返回）+ `verifyM08*`（`PRAGMA table_info` / `sqlite_master`）+ `createM08Migration({ from: 8, to: 9 })` |
| 4 | `electron/migrations/desktop-registry.ts` | import + `const m08 = createM08Migration(...)`；`createMigrationRegistry([...m07, m08], [...]`；`CURRENT_DESKTOP_SCHEMA_VERSION = 9` |
| 5 | `electron/services/sqlite-project-migration.ts` | `CANONICAL_SCHEMA_UPGRADE_UNSUPPORTED` 白名单同步 |
| 6 | `baseline-schema.ts` | **保持冻结**，不加任何幂等 ALTER |

### 9.3 迁移段的验收

1. **旧项目可升级**：用作者库副本（`每天第一句谎话都会成真`）跑一次打开流程 ⇒ `user_version = 9`、两处新增存在、**不报 `UNRECOGNIZED_SCHEMA`**；
2. **指纹登记**：`desktop-registry.ts` 的 `schemas(9)` 与实际库指纹一致（跑 `electron/migrations/__tests__` / `sqlite-project-migration` 相关测试）；
3. **幂等**：同一库重复 apply 不改 `sqlite_master`；
4. **不碰基线**：`git diff` 里 `baseline-schema.ts` 必须为空；
5. 附带：`portable-project-field-policy.json` 为新列登记策略（`blueprints.key_events` 现标 "D"）。

### 9.4 迁移后的两段代码（各自独立提交）

- **段三（先做）**：`declinedCandidateNames()` 改读 `character_cast_decisions`（空表时一次性回填：从既有已批准批次的 `functional` 决策派生）+ 「锚点人物（不建卡）」管理面（列表 / 撤销 / 改口吻定位）。
- **段二（后做）**：世界观产出加机读行（`hours=`/`entry=`）+ 蓝图产出加 `spaceRefs` 写入 `structured_refs` + 新校验器 `space-time-consistency.ts`（**同章内**单点比较，零语义解析，两侧缺字段 fail-open）+ 接既有预检关卡（finding 带「冲突源层级」）。
