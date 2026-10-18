# 弧光 v7 落地方案：解析器兼容 + 画像注入（P1/P2）

> 状态：待裁定（未改代码）
> 日期：2026-10-19
> 上级稿：提示词定稿 [`arc-prompt-v7-web-test.md`](arc-prompt-v7-web-test.md) ｜ 定位 [`arc-layer-handoff.md`](arc-layer-handoff.md) ｜ 画像方向 [`arc-budget-engine-design.md`](arc-budget-engine-design.md)
> 分支：`exp/arc-tree-v2`

## 1. 目标与非目标

**目标（本稿范围）**

1. **P1 解析器兼容**：让 `parseArcStructure` 同时认「大弧/中弧」与「卷/单元」，并支持"只有两级"的 v7 输出。
2. **P2 画像注入**：新增 `rhythm_profile` 变量，按项目注入平台节奏，**提示词里不再出现任何个数常量**。

**非目标（本稿明确不做）**

- 不改 `synopsis` / 正文 / 审稿链路（`plot_structure_guide` 接口不变）。
- 不做"部"层级（冻结快照只在 `arc-prompt-v5` 里留了 schema，不实现）。
- 不做骨架预算引擎全量（只保留"章数由系统折算"这一条接口）。
- 不动 `baseline-schema.ts` 任何字节（红线 1）。

## 2. 现状锚点（代码事实）

| 环节 | 位置 | 现行为 |
|---|---|---|
| 模板 | `builtin-prompt-templates.ts:639`（key `plot_structure`） | 9 个变量；`requiredContextVariables` 7 项，全部被正文引用 ⇒ 无追加块 |
| 生成 | `architecture.command.ts:1853` 取模板、`:1889-1904` 绑变量、`:1928` 写 `plot_structure_plan` | 变量全靠 `ArchitecturePromptBuilder`，无画像概念 |
| 解析 | `arc-position.ts:194` `MAJOR_HEADING` / `:195` `MID_HEADING` / `:227` `MINOR_LIST_HEADER` / `:235` `MINOR_ITEM_BARE` | **字面认「大弧」「中弧」**；`MID_HEADING` 序号只认 `[0-9]*` |
| 消费 | `architecture-workflow.ts:360` `resolveStageStructureGuide` | 空 → 回退枚举模板（老项目不受影响） |
| 折算 | `arc-position.ts:54` `arcWeight` / `:422` `scaledBoundaries` | 有章数用章数，无则等权 |

## 3. 变更面总表

| # | 层 | 改动 | 风险 |
|---|---|---|---|
| P1 | 解析 | 两张正则加别名 + 中文序号；两级模式成为一等公民 | **高**（弧位/大纲/审计三处共用） |
| P2 | 数据 | 新列 `rhythm_profile`（**M09**，M08 已被 structured_refs 占用）+ lane 六步 | 中（迁移） |
| P2 | 模板 | 新增 `{{rhythm_profile}}`，正文换 v7 | 中（红线 16 穿透覆盖版） |
| P3 | 体检 | `ARC_SAME_HAND_TYPE` / `ARC_TIER_STUCK` | 低（只报不拦） |
| P4 | UI | 平台节奏下拉 + 文案改"卷/单元" | 低 |

## 4. P1 · 解析器兼容（先做，因为它决定后面全能不能跑）

### 4.1 两张正则的别名

```text
MAJOR_HEADING: ^#{2,3}\s*(?:大弧|卷)[^：:]*[：:]\s*(.+?)\s*$
MID_HEADING:   ^#{3,4}\s*(?:中弧|单元)\s*[0-9一二三四五六七八九十]*\s*[：:]\s*(.+?)\s*$
```

- `## 卷一：…` 落在 `MAJOR_HEADING`（允许 2–3 个 #）；`### 单元一：…` 落在 `MID_HEADING`（允许 3–4 个 #）。层级不冲突。
- **必须补中文序号**：现在 `MID_HEADING` 是 `[0-9]*`，`单元一` 直接匹配失败——这是 v7 输出能解析的**前置条件**，不是优化项。
- 别名用"或"，**不替字**：旧库里的 `大弧/中弧` 文本必须继续解析，任何"把旧词替换成新词"的做法都会在只读路径上改数据（禁止）。

### 4.2 两级模式（v7 没有小弧）

v7 输出根本没有小弧，`parseMinorArcs` 收集结果恒为空。需要把"两级"当成合法形态，而不是降级：

| 项 | 三级（旧） | 两级（v7） |
|---|---|---|
| 结构 | 大弧 → 中弧 → 小弧 | 卷 → 单元 |
| 叶子 | 小弧 | 单元 |
| 弧位 ID | `M1-2/转折` | `U1-2`（卷-单元） |
| 折算 | 小弧边界在中弧内均分 | 单元边界在卷内均分（`scaledBoundaries` 已够用） |
| 审计 | P13 密度检查（小弧是否有料） | **下沉到单元**：检查"叙事任务/进入离开/段间推进/逼法"四格是否齐 |

判定方式：`minors.length === 0 && mids.length > 0` ⇒ 两级模式。不要用"有没有【】"判断，那是小弧的形态特征。

### 4.3 受影响的三处消费者

1. `renderArcPositionBlock`（`arc-position.ts:600+`）：两级模式下按单元出块，文案把"本中弧"改成"本单元"。
2. `arc-node.ts:109/124`：`buildArcNodes` 在无 minors 时把 mid 当叶子，ID 前缀 `U`。
3. `summarizeArcDensity`（`architecture.command.ts:332`）：两级模式**不再报** `MINORS_NAMELESS`（没有小弧），改报四格缺失。

### 4.4 测试（golden 驱动）

| 样本 | 用途 | 断言 |
|---|---|---|
| 旧三级 plan（现有测试夹具 + 一份真实库导出） | 回归 | majors/mids/minors 计数、边界、弧位 ID **与改动前逐字段相同** |
| v7 起点版（真实输出，4 卷 / 23 单元） | 新形态 | 卷 4、单元计数 5/6/7/5、无小弧、不抛错 |
| v7 番茄版（7 卷 / 28 单元） | 新形态 | 卷 7、单元 4/3/5/4/3/5/4 |
| 非法形态（`### 卷一` 用错层级） | 失败模式 | 明确报错而非静默产出 0 个节点 |

## 5. P2 · 画像注入

### 5.1 数据落点：新列 `rhythm_profile`（**M09**，v9→v10）

平台是**书的属性**，不是 App 的属性——同一个 App 里两本书可以一本起点一本番茄。所以落在 `project_core`，不是全局设置。

```sql
ALTER TABLE project_core ADD COLUMN rhythm_profile TEXT NOT NULL DEFAULT ''
```

按 `notes/data-and-schema.md` 的 **lane 六步**：

1. `registry.ts` 追加 `MIGRATION_LANE` + `LATEST_SCHEMA_VERSION+1`
2. `src/shared/project-storage.ts` 追加同名 `MIGRATION_IDS`
3. 新建 `electron/migrations/m09-rhythm-profile.ts`（`apply*` 幂等 + `verify*` + `create*Migration`）
4. `desktop-registry.ts` 跑 `apply*` 后取 `schemas(n+1)` 注册、`CURRENT_DESKTOP_SCHEMA_VERSION+1`
5. `sqlite-project-migration.ts` 的 `CANONICAL_SCHEMA_UPGRADE_UNSUPPORTED` 白名单（**最容易漏**：漏改的直接表现是老项目打不开；已加 v9→v10 回归测试）
6. 基线保持冻结，不在 `initializeLegacyBaselineSchema` 里加幂等 ALTER

### 5.2 空值语义：**空 = 中性，不是默认起点**

- 空串 ⇒ 模板不注入推荐块（渲染时整段裁掉），行为等同"按内容定"。
- 理由：老项目升级后不该被静默改节奏。默认起点等于替作者做了一个他没做过的选择。
- `pruneEmptyOptionalPromptSections` 已有"空段落裁剪"能力，可直接复用。

### 5.3 模板侧

| 项 | 改法 |
|---|---|
| `variables` | 加 `rhythm_profile: '平台节奏推荐（可选，由项目画像注入）'` |
| `requiredContextVariables` | **必须加**：否则作者覆盖版拿不到画像（红线 16：只读内置 required 清单） |
| `content` | 用 v7 定稿；`【节奏推荐】`块改成 `{{rhythm_profile}}`，并在其前后保留说明句 |
| 反引号 | 正文禁 Markdown 反引号（红线 5） |

### 5.4 调用侧

- `ArchitecturePromptBuilder` 加 `withRhythmProfile(text)`。
- `architecture.command.ts:1889` 链上补 `.withRhythmProfile(resolveRhythmProfile(core))`。
- 画像文案集中在 `src/services/prompts/rhythm-profiles.ts`，中英各一份（跟 `writingLanguage`），内容与 `arc-prompt-v7` 文档里的两段**逐字一致**，避免文档与代码两套说法。

## 6. P3 · 体检器两条（只报不拦）

| 代码 | 判定 | 数据来源 |
|---|---|---|
| `ARC_SAME_HAND_TYPE` | 同一卷内相邻两单元的 `（交手：X）` 相同 | 逼法行末标注 |
| `ARC_TIER_STUCK` | 相邻两单元 `（档：A→B）` 的 B 相同且未上升 | 同上 |

- 解析正则：`（\s*交手[：:]\s*([^；）]+)；\s*档[：:]\s*([^→）]+)→([^）]+)）`
- 标注缺失**不报**（v6 之前的历史 plan 没有标注），只在存在标注时比较。
- 接在 `summarizeArcDensity` 同一处输出，措辞沿用"只提示，不影响本次生成"。

## 7. P4 · UI / i18n（已实施）

- 设置面板新增「平台节奏」：不指定 / 起点向 / 番茄向 / 自定义文本；写在 `project_core.rhythm_profile`（不属于 `NovelConfig`，单独走 `db:project-core-update`）。
- 文案：`弧光结构（自由弧）` → `卷 / 单元结构`；`ArchFileViewer`、`ArchitectureConfirmDialog`、配置页枚举选项三处同步，中英一致。
- 编辑器 tab 的空值预填逻辑不变（仍回退枚举模板）。

**刻意没做的一件事（作者 2026-10-19 裁定）**：不按题材硬绑节奏。番茄也有悬疑向爆款，题材→节奏是刻板印象；若要联动，只能做**两个显式选项之间的默认推荐**，且作者手改一次后不再覆盖。

**P4 之外、已登记为缺口**：文风是**另一轴**。现有链路偏番茄文风，还没有稳定的"起点文风"模板；"起点节奏 + 番茄文风"是合法中间态，不算硬伤。将来随 `p9-platform-style-layer-design.md` 落地，与 `rhythm_profile` 共用同一份平台画像（一套画像两个消费者），台账已登记。

## 8. 折算规则（明确写死，防回归）

- **不假设单元总数守恒**：v7 实测 23 vs 28，总数由 卷数 × 每卷单元数 决定。
- 卷边界：`scaledBoundaries(majors.map(arcWeight), totalChapters)`（现有）。
- 单元边界：在所属卷区间内 `scaledBoundaries(mids.map(arcWeight), 卷长度)`（现有）。
- 两级模式下不再计算小弧边界；`arcWeight` 缺省等权不变。

## 9. 回滚

| 层 | 回滚方式 |
|---|---|
| 提示词 | 模板是数据，回退到旧版 content 即可；无需改代码 |
| 画像 | 列可留空不读，空 = 中性 ⇒ 行为等同未引入 |
| 解析器 | 别名是向后兼容的**只增**改动，不需要回滚 |

## 10. 验收清单

1. 旧三级 plan 解析结果与改动前**逐字段相同**（golden diff 为空）。
2. v7 两份真实输出可解析：卷 4 / 23 单元、卷 7 / 28 单元。
3. 生成一个新项目跑「卷/单元 → 大纲」：弧位块出现，且不越层取材。
4. 画像为空时，渲染出的 prompt 里**没有**【节奏推荐】块。
5. 有标注的 plan 才触发两条新体检；旧 plan 零新增告警。
6. `pnpm run typecheck` + `arc-position` / `arc-node` / `architecture.command` 目标测试文件全绿。
7. `node scripts/check-doc-links.mjs` 0 断链。

## 11. 风险与已知代价

1. **解析器是三处共用的地基**：别名必须"或"，一旦有人图省事做字符串替换，旧库会静默错位。
2. **两级让小弧级审计失效**：P13 的 `MINORS_NAMELESS` 对 v7 输出恒为空。必须同批把审计下沉到单元四格，否则等于关掉了体检。
3. **画像穿透覆盖版**：新增 required 变量会改变作者覆盖版的实际输入（红线 16 的既有效应），需要在变更说明里写清楚，避免有人以为"我覆盖了模板就与画像无关"。
4. **不做"部"**：200 万字量级仍需另案；本稿只保证"卷/单元"这一层跑通，且节奏表里的"还/留债"已经是将来部级快照的接口。

## 12. 实施顺序

```
P1 解析器（含 golden 测试）  ← 先做，单独可验
  └ P2 画像（M09 + 变量 + 模板替换）  ← 依赖 P1 能解析新词
      └ P3 体检器两条              ← 依赖 P2 的标注格式
          └ P4 UI/i18n            ← 最后，纯展示
```

每阶段独立提交、独立验；P1 不合入就不动 P2。
