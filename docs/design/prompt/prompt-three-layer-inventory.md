# Prompt 三层全景清单（系统级 / 工程级 / 作者级）

> 状态：已核对（2026-10-24）
> 核对基准：分支 `exp/resource-ledger` · HEAD `404c356d` · 仓库 schema 20
> 用途：**这份清单就是"不必再全量扫一遍"的凭据。** 下次只需跑 §8 的八条增量核对。
> 上级稿：[`prompt-three-layer-alignment-assessment.md`](./prompt-three-layer-alignment-assessment.md)（行业口径对照与缺口分级）· 相关：[`p1-literal-dedup.md`](./p1-literal-dedup.md)（去重）、[`prompt-clause-admission.md`](./prompt-clause-admission.md)（条款三问）

---

## 0. 怎么用

1. **动手前查一次**：要改 prompt / 模板 / 契约，先定位它在 §2（系统级）、§3（工程级）还是 §4（作者级）里，再看 §5 该链路走不走模板目录。
2. **判断"作者能不能改"**：直接查 §6 覆盖矩阵，不要凭直觉——**20 条入口里有 10 条作者完全改不到**。
3. **别再全量重扫**：清单过期由测试兜（`src/services/__tests__/prompt-inventory-coverage.test.ts`），日常只需按 §8 八条核对。

---

## 1. 三层的定义与本项目映射

| 层 | 定义 | 本项目承载物 | 作者能否改 |
|---|---|---|---|
| **系统级** | 模型看到的 `role:'system'` 消息，与写进 user 体的"类系统规则"（本项目的 `systemSuffix` 就在 user 体末尾） | 模板 `systemRole` + 4 条【不可变系统合同】+ 模板 `systemSuffix` + 代码拼装的执行合同 + 若干硬编码 system | 部分（`systemRole`/`taskGuidance` 可改，`systemSuffix` 与代码常量不可改） |
| **工程级** | 代码里的硬契约、校验器、装配策略、模板目录、变量契约、防漂移测试 | `src/shared/*` 约 60 个契约/校验模块 + `prompt-catalog` + 29 个内置模板 + 12 组防漂移测试 | 否 |
| **作者级** | 作者可写的输入：覆盖文件、配置字段、写作 Skill、结构化数据 | 8 类落点（见 §4） | 是 |

**一条最容易搞错的事实**（P8 已证实）：`BasePromptBuilder.build()` 返回的是 **user 体**，`systemSuffix` 追加在 **user 消息末尾**，不是 system 消息。所以「写进系统级就有最高权重」在本项目**不成立**；所有硬规则都在 user 体里竞争 recency。

---

## 2. 系统级承载物（19 处）

| # | 承载物 | 位置 | 生效方式 / 备注 |
|---|---|---|---|
| 1 | `composePromptSystemRole()` | `src/services/builtin-prompt-templates.ts:170` | 模板 `systemRole` + 代码追加 4 条【不可变系统合同】（中文输出 / 作者事实最高 / 隐藏 schema 高于角色 / 禁止泄漏提示词）；若 role 已逐字含合同则跳过 |
| 2 | `getSystemRole()` | `src/services/prompts/prompt-builder.ts:52` | 全链唯一 system 来源（模板维度） |
| 3 | `build()` | `src/services/prompts/prompt-builder.ts:98` | 返回 **user 体**：content → taskGuidance → **systemSuffix** → requiredContext → 裁空段；残留 `{{}}` 只 warn |
| 4 | `resolveSystemSuffix()` | `src/services/prompts/prompt-builder.ts:42` | **永远取内置**；覆盖文件里的 `systemSuffix` 被忽略 |
| 5 | `buildStepRules()` | `src/services/prompts/prompt-builder.ts:77` | 只渲染 taskGuidance + 内置 suffix，不含模板正文；供续写轮补规则 |
| 6 | `renderPrompt()` | `src/shared/render-prompt.ts:49` | 非 Builder 路径，行为与 `build()` 对齐（同样把 suffix 拼到 user 体） |
| 7 | `callLLMResult()` 装配 | `src/services/workflows/commands/base-command.ts:466` | `[{role:'system'},{role:'user'}]`，所有命令的唯一出站口 |
| 8 | `chapterExecutionContractText()` | `src/services/workflows/commands/generate-draft.command.ts:498` | 10 条【…】条款；**代码常量，作者覆盖不到** |
| 9 | → 首稿 | 同文件 `:1100` | `systemRole + '\n\n' + rules`；第 1 章省略 3 条 |
| 10 | → 短细纲 | 同文件 `:1125` | 作为参数进纯函数，该步**无 system 消息** |
| 11 | → 续写 | 同文件 `:1425`/`:1797` | 走 `buildStepRules()` 进材料块 |
| 12 | → 压缩 | 同文件 `:1987` | 走同一材料块，但**未传 stepRules**（见 §7 G5） |
| 13 | 定稿对账块 | `src/shared/draft-reconciliation.ts:66` | 纯函数渲染，模板目录无对应 key |
| 14 | `reviewExecutionContract()` | `src/shared/review-execution-contract.ts:42` | 独立文本（判定口径而非写作义务）6 条；recheck 分支刻意不加 |
| 15 | 主进程补 system | `electron/services/main-generation-owner.ts:519` | outline / blueprint 追加 `planningTargetInstruction`——**渲染层拼的 system 里没有它** |
| 16 | 结构化语法修复 | `src/services/workflows/structured-syntax-repair.ts:29` | 硬编码 4 条「只修 JSON」，对所有 structured 任务生效 |
| 17 | 图谱链 system | `src/shared/plot-tree-generation-pure.ts:330` · `narrative-thread-generation-pure.ts:128` | 纯函数内置，无模板 key |
| 18 | 角色清单/详情 system | `src/services/prompt-language.ts:65`（`detailSystem`）· `architecture.command.ts:1846` | 与 `character_dynamics` 的 systemRole 混合；模板正文不参与 |
| 19 | `synopsis` 两级结构 suffix | `src/services/prompts/synopsis-two-level-suffix.ts` · 调用 `architecture.command.ts:3586` | 卷/单元结构下整段替换 suffix；**不改模板对象**（否则 `synopsisInputsFingerprint` 全失效） |

> 另有写作助手身份（`src/services/agent/context-builder.ts:85`）把 `composePromptSystemRole` + `renderPrompt` 拼成**一个** system 串，再拼 L0/L1/tool 段。

---

## 3. 工程级

### 3.1 契约与校验模块（`src/shared/`，按主题）

| 主题 | 模块（一句话职责） |
|---|---|
| 情节大纲 | `plot-outline-contract`（请求合同/确认前缀/章数上下限）· `chapter-heading`（章标题唯一解析）· `chapter-position`（三层位置表达）· `outline-tree`（卷/单元/章树，算出来不落库）· `outline-budget` / `outline-prefix-budget`（字数探针 / 前缀投影成本）· `architecture-projection` / `synopsis-projection`（按章段投影）· `synopsis-unit-rewind`（单元回退）· `arc-position` / `arc-node` / `arc-tree`（弧光解析 / 结构位 / 只读树）· `volume-structure`（卷单元有效区间，三档来源）· `chapter-boundary`（禁写边界文案） |
| 蓝图 | `blueprint-semantic-contract`（语义合同 + 引用归一化）· `blueprint-key-events`（keyEvents 唯一归一化入口）· `blueprint-character-sync-evidence`（点名 vs 名册对账）· `chapter-goal-review`（冻结章目标 + 完成度） |
| 连续性 | `finalized-continuity` · `finalized-continuity-facts` · `consistency-preflight` · `chapter-time-continuity` · `story-day-anchor` · `institution-cadence` · `knowledge-state` · `key-item` · `cast-ledger` / `cast-ledger-completion` · `draft-reconciliation` · `chapter-staleness` · `prewrite-consultation`（写前查阅七节）· `review-continuity-bible`（审稿四类核对基准） |
| 空间 / 时间 | `space-constraints`（含 Markdown 表格摘录）· `space-machine-line`（机读行解析 + 对账）· `space-time-consistency`（结构对结构，缺字段不判）· `space-anchor`（章 → 地点/时段/日序） |
| 资源 | `resource-ledger`（契约 + 余额/中断纯函数）· `worldbuilding-resource-extract` · `worldbuilding-numeric-audit` · `worldbuilding-completeness`（五维齐备性）· `worldbuilding-rules` · `worldbuilding-self-review` |
| 角色 | `character-proposal` / `character-proposal-parser` · `character-identity`（resolved/ambiguous/unresolved）· `character-roster` · `character-state-lines`（状态行唯一渲染入口）· `character-role` / `relationship-presentation` / `appearance-profile` |
| 审稿 | `review-generation-report` · `review-execution-contract` · `review-far-term-setting` · `review-state-conflict` · `review-cycle` / `human-confirmed-review` · `review-revision-generation` |
| 写作 Skill | `writing-skills`（SKILL.md 解析 / 阶段枚举）· `builtin-writing-skills` |
| 生成归属 / 传输 | `generation-owner-contract`（渲染层↔主进程归属）· `generation-contract`（诊断与哈希）· `agent-response-protocol` · `structured-contract-diagnostic` / `json-text-repair` |
| 正文其它 | `text-scope-tags`（自由文本段级标签 + 作用域字段）· `novel-config-localization` · `draft-short-outline`（短细纲契约与提示词）· `volume-handoff` / `volume-handoff-gate` · `draft-units`（字数口径）· `world-state-view` |

### 3.2 内置模板 key（29 个）与**真实消费方**

| # | key | 用途 | EDITABLE | 有消费方 |
|---|---|---|---|---|
| 1 | `planning_material_character_extraction` | 从原始资料提取待确认角色 | 是 | ✅ |
| 2 | `character_background_synthesis` | 无卡角色补全人物背景 | 是 | ✅ |
| 3 | `assistant_writing_identity` | 右侧写作助手身份与指导 | 是 | ✅ |
| 4 | `edit_selected_text` | 选中正文按指令改写 | 是 | ✅（主进程 `promptKeys` 动态引用） |
| 5 | `generate_novel_config_field` | 补全单项配置 | 是 | ✅ |
| 6 | `generate_global_config` | 一句话灵感 → 整本配置 | 是 | ✅ |
| 7 | `premise` | 架构 1/5 故事前提 | 是（架构链） | ✅ |
| 8 | `character_dynamics` | 架构 2/5 角色图谱 | 是（架构链） | ✅（**只用 systemRole + taskGuidance，正文不渲染**） |
| 9 | `world_building` | 架构 3/5 世界观五维 | 是（架构链） | ✅ |
| 10 | `plot_structure` | 架构 4/5 卷单元结构 | 是（架构链） | ✅ |
| 11 | `synopsis` | 架构 5/5 情节大纲 | 是（架构链） | ✅ |
| 12 | `chapter_blueprint` | 全书一次性蓝图（**历史遗留**；黄金三章法则的原始出处，运行时改走 `chapter_blueprint_chunk`） | **否** | ❌ **无运行时消费方·历史遗留**（不删不搬，裁定见 §7 G1） |
| 13 | `chapter_blueprint_chunk` | 分块续写蓝图 | 是（架构链） | ✅ |
| 14 | `first_chapter_draft` | 第一章正文 | 是 | ✅ |
| 15 | `next_chapter_draft` | 后续章正文 | 是 | ✅（与 14 二选一，`generate-draft.command.ts:687`） |
| 16 | `refine_chapter` | 章节精修 | 是 | ✅ |
| 17 | `consistency_check` | 一致性审稿 | 是 | ✅ |
| 18 | `analyze_writing_style` | 文风分析 | 是 | ✅ |
| 19 | `refine_from_review` | 审稿驱动修稿 | 是 | ✅ |
| 20 | `generate_chapter_notes` | 定稿后章节要点 | 是 | ✅ |
| 21 | `update_character_cards` | 定稿后角色状态 | 是 | ✅ |
| 22 | `infer_novel_config` | 逆向推演配置 | 是 | ✅ |
| 23 | `extract_initial_characters` | 从图谱抽结构化角色卡 | **否** | ❌ **无运行时消费方** |
| 24 | `infer_single_chapter_blueprint` | 从正文反推单章蓝图 | 是 | ✅ |
| 25 | `infer_novel_config_with_vectors` | 向量采样增强推演 | 是 | ✅ |
| 26 | `world_building_self_review` | 世界观写库后只读自审 | **否** | ✅ |
| 27 | `world_building_resource_extract` | 资源登记提案 | **否** | ✅ |
| 28 | `extract_resource_movements` | 定稿后资源变动抽取 | **否** | ✅（默认不注册步骤） |
| 29 | `generate_volume_handoff` | 卷末交接单生成 | **否** | ✅ |

`EDITABLE_PROMPT_KEYS` 23 项（`src/services/builtin-prompt-templates.ts:37`）· `ARCHITECTURE_PROMPT_KEYS` 6 项（同文件 `:74`，仅 UI 标注"不建议修改"）。

### 3.3 变量契约与兜底注入

| 机制 | 位置 | 说明 |
|---|---|---|
| 可用变量声明 | `PromptTemplate.variables`（`builtin-prompt-templates.ts:24`） | 设置页变量 chip 与英文说明来源 |
| 必带上下文 | `PromptTemplate.requiredContextVariables`（同文件 `:27`） | **覆盖版删掉占位符时仍强制追加** |
| 兜底注入 | `src/shared/render-prompt.ts:5` | 仅当 content/taskGuidance/内置 suffix 都未引用该变量时追加 |
| 未赋值占位符 | `src/services/prompts/prompt-builder.ts:121` | 只 `console.warn`，不阻断 |
| 重复变量提示 | `src/services/prompt-variable-usage.ts:11` | 只识别不改写 |
| 覆盖优先级 | `src/services/prompt-catalog.ts:125` | **project > global > builtin**（`resolve`）；`peek` 同步、不水合、不抛诊断（`:239`） |
| 目录 | 项目 `{project}/.ai-novel/prompts`（`:384`）· 全局 `VELA_HOME/prompts`（`electron/services/user-prompt-store.ts:45`） | 文件名必须与 key + 语言一致，否则进 diagnostics |

### 3.4 防漂移测试（12 组）

| 测试 | 锁定对象 |
|---|---|
| `src/services/workflows/__tests__/context-entry-parity.test.ts:68` | 材料块拼装结果的 sha256 逐字节锚点 |
| `src/services/workflows/commands/__tests__/review-revision-runtime.test.ts:881` | 审稿提示词哈希（无登记时逐字节不变） |
| `src/shared/__tests__/review-execution-contract.test.ts:66` | 读生成侧源码，断言每条【…】条款在审稿侧有处置 |
| `src/services/__tests__/prompt-system-role.test.ts` | 【不可变系统合同】只追加一次 |
| `src/services/__tests__/prompt-language-contract.test.ts` | 中英覆盖完整性 |
| `src/services/__tests__/prompt-local-qwen-contract.test.ts:270` | 每 key 变量集合、EDITABLE 白名单、不可编辑项 |
| `src/services/workflows/commands/__tests__/generate-draft.command.test.ts:1570` | 同轮请求内作者字段逐字只出现一次 |
| `src/services/__tests__/prompt-builtin-revision.test.ts` | 内置模板摘要与"覆盖落后"判定 |
| `src/services/__tests__/prompt-variable-usage.test.ts` | 变量提取与重复识别 |
| `src/services/__tests__/synopsis-two-level-suffix.test.ts` | 两级结构 suffix 文案 |
| `src/services/__tests__/prompt-style-imitation-contract.test.ts` | 文风分析模板关键措辞 |
| `src/services/__tests__/prompt-inventory-coverage.test.ts` | **本清单自身**：模板 key 不漏、§5 路径全部存在 |

---

## 4. 作者级：8 类落点与生效优先级

| # | 类别 | 落点 | 生效优先级 / 备注 |
|---|---|---|---|
| 1 | 项目覆盖 | `{project}/.ai-novel/prompts/{key}.{lang}.json` | **优先级 1**；可改 `systemRole` / `taskGuidance`；`content` 在 UI 只读 |
| 2 | 全局覆盖 | `VELA_HOME/prompts/{key}.{lang}.json` | 优先级 2；**旧覆盖会静默遮蔽内置改进**（W1 已有徽标提示） |
| 3 | 项目自由指导 | `{project}/.ai-novel/prompts/*.md` | 只进**正文链**（`generate-draft.command.ts:753`）；审稿/修稿/架构/大纲不读 |
| 4 | 架构分步指导 | `context.data.stepGuidance`（运行时内存，不落文件） | 架构链五个步骤各自注入；**落在不可编辑的 `systemSuffix` 里**（§7 G7） |
| 5 | `novel_config` 字段 | `coreOutline` / `worldSetting` / `goldenFinger` / `protagonistProfile` → 架构与正文；`globalGuidance` / `writingStyle` / `referenceWorks` → 正文变量 | 经 `text-scope-tags` 段级投影后才进 prompt |
| 6 | 写作 Skill | `{project}/.ai-novel/writing-skills.json` + `skills/` | 4 阶段 `planning/drafting/review/refinement`；工作流启动时**冻结**；注入在第一条 user 消息前 |
| 7 | 结构化数据 | `characters` / `project_core` / `blueprints` / M14–M19 各表 | DB 为唯一事实源，写入走各自登记页 |
| 8 | 卷末交接单（作者版） | `volume_handoffs` 表 `source='author'` | 自动生成**永不覆盖**作者版 |

---

## 5. 装配链路（20 条入口，含"走不走模板目录"）

| # | 链路 | 入口 | 走模板？ | 作者可干预 | 变量覆盖 |
|---|---|---|---|---|---|
| 1 | 首稿正文 | `src/services/workflows/commands/generate-draft.command.ts:883` | 是（`first/next_chapter_draft`） | A 可改 | 满 |
| 2 | 短细纲 | `src/shared/draft-short-outline.ts:64` | **否**（纯函数，无 system） | C 不可改 | —（不走模板） |
| 3 | 续写轮 | `src/services/workflows/commands/generate-draft.command.ts:1412` | 部分（`stepRules` 复刻 taskGuidance + suffix） | B 只改 taskGuidance | 满 |
| 4 | 压缩轮 | `src/services/workflows/commands/generate-draft.command.ts:1960` | 部分但**不传 stepRules** | C 不可改 | —（不走模板） |
| 5 | 章节执行合同 | `src/services/workflows/commands/generate-draft.command.ts:498` | 否（代码常量） | C | —（不走模板） |
| 6 | 定稿对账块 | `src/shared/draft-reconciliation.ts:66` | 否 | C | —（不走模板） |
| 7 | 审稿主体 | `src/services/workflows/commands/review-chapter.command.ts:114` | 是（`consistency_check`）+ 9 段代码块 | A/C 混合 | 满 |
| 8 | 审稿复核 recheck | `src/services/workflows/commands/review-chapter.command.ts:141` | **否**（另一套手工 prompt） | C | —（不走模板） |
| 9 | 精修 | `src/services/workflows/commands/refine-draft.command.ts:69` | 是（`refine_chapter`） | A | 满 |
| 10 | 审稿驱动修稿 | `src/services/workflows/commands/refine-from-review.command.ts:19` | 是（`refine_from_review`）+ 代码合同与材料块 | C | 满 |
| 11 | 情节大纲 | `src/services/workflows/commands/architecture.command.ts:3549` + `src/shared/plot-outline-contract.ts:395` | 是（`synopsis`）+ 代码请求合同 + 主进程 system | A/C 混合 | 满 |
| 12 | 蓝图（批量） | `src/services/workflows/commands/directory.command.ts:434` | 是（`chapter_blueprint_chunk`） | A | 满 |
| 13 | 蓝图（单章兜底） | `src/services/workflows/commands/directory.command.ts:206` | **否**（只借 systemRole） | C | —（不走模板） |
| 14 | 角色图谱 | `src/services/workflows/commands/architecture.command.ts:1762` | 部分（只用 systemRole + taskGuidance） | B | 缺 8 |
| 15 | 角色详情 | `src/services/workflows/commands/architecture.command.ts:1846` | 否（`prompt-language.ts:65` 硬编码） | C | —（不走模板） |
| 16 | 角色卡生成 | `src/services/workflows/commands/character-card-generation.command.ts:77` | 是（`character_background_synthesis`） | A | 满 |
| 17 | 定稿·章节要点 | `src/services/workflows/commands/finalize-chapter.command.ts:323` | 是（`generate_chapter_notes`） | A | 满 |
| 18 | 定稿·角色状态 | `src/services/workflows/commands/finalize-chapter.command.ts:563` | 是 + **内联最终合同覆盖模板 JSON 示例** | B | 满 |
| 19 | 定稿·卷末交接 | `src/services/volume-handoff-generation.ts:367` | 是（`generate_volume_handoff`，不可编辑） | C | 满 |
| 20 | 编辑器行内改写 | `electron/services/editor-inline-generation.ts:48` | 是（`edit_selected_text`） | A | 满 |

> 入口列为装配入口行号；权威核对请跑 `node scripts/check-prompt-wiring.mjs`（「变量覆盖」列即该脚本的 `content`/`suffix` 覆盖表投影：`满` = 声明占位符全部注入，`缺 N` = N 个占位符没有链路注入或正文不渲染，`—` = 该链不渲染模板占位符）。

**未单列的 4 条纯函数/硬编码链**：剧情树与叙事线索（`src/shared/plot-tree-generation-pure.ts:330` · `narrative-thread-generation-pure.ts:128`）、旧作名单修复（`src/shared/legacy-roster-generation-pure.ts:45`）、结构化语法修复（`src/services/workflows/structured-syntax-repair.ts:29`）、写作助手 system 拼装（`src/services/agent/context-builder.ts:85`）——全部为 C。

---

## 6. 覆盖矩阵（作者可干预程度）

| 档 | 含义 | 条数 | 链路 |
|---|---|---|---|
| **A 可改** | 走模板目录，`systemRole` / `taskGuidance` 生效 | 7 | 首稿 · 精修 · 蓝图批量 · 角色卡生成 · 章节要点 · 编辑器改写 · （混合链的模板部分） |
| **B 只能改 taskGuidance** | 模板正文/JSON 示例被代码覆盖 | 3 | 续写轮 · 角色图谱 · 定稿角色状态 |
| **C 完全改不到** | 代码常量 / 纯函数 / 硬编码 system | 10 | 短细纲 · 压缩轮 · 执行合同 · 对账块 · recheck · 审稿驱动修稿 · 蓝图单章兜底 · 角色详情 · 卷末交接 · 4 条纯函数链 |

> **结论**：作者能直接改的只有 **7/20**。所以"把要求写进 prompt"与"把要求写进模板"是两件事——改之前先查这张表，否则会改到一条不生效的位置（`docs/fanqie-guidance-final.md` 记的就是这类事故）。

---

## 7. 缺口分级

分级口径：**P0 = 会让人静默误判（以为改生效了其实没有）**；**P1 = 规则在某条链上缺失**；**P2 = 口径不统一 / 可维护性**。

### P0（4 条）

| # | 缺口 | 证据 |
|---|---|---|
| G1 | `chapter_blueprint`、`extract_initial_characters` **无运行时消费方**，但仍在模板表里 | 全库搜 `resolvePromptTemplate('chapter_blueprint')` 零命中；仅出现在本地化清单、trace 标签与测试。**2026-10-24 作者裁定：不删不搬，只在模板头标「历史遗留」** —— 删 key 要动 `prompt-local-qwen-contract` 的变量快照与 JSON 字段快照 + `prompt-language-contract` 的 `REQUIRED_CORE_KEYS` 共 6 处；搬内容会与 `chapter_blueprint_chunk:1044-1046` 重复（且唯一无承载的那条属「替作者决定」）。逐条归属见 `design/architecture/long-form-craft-alignment-assessment.md` §4 |
| G2 | `EDITABLE_PROMPT_KEYS` **不参与加载校验**，手写非白名单 key 的 JSON 仍会被 `resolve` 采用 | `src/services/prompt-catalog.ts:52` 只用于 UI 过滤与 trace 标注 |
| G3 | 覆盖里的 `systemSuffix` 被渲染层忽略，但主进程按**文件字节**取哈希 | `src/services/prompts/prompt-builder.ts:42` vs `electron/services/generation-source-binding.ts:481` |
| G4 | 定稿「角色状态」步骤用**内联最终合同**覆盖模板 JSON 示例 | `src/services/workflows/commands/finalize-chapter.command.ts:563` |

### P1（4 条）

| # | 缺口 | 证据 |
|---|---|---|
| G5 | 压缩轮不带 `stepRules`：模板正文与 taskGuidance 的规则在压缩请求里完全不出现 | `generate-draft.command.ts:1951` 参数表无该字段 |
| G6 | `character_dynamics` 模板正文在角色图谱链**从不渲染** | `architecture.command.ts:1717` 只用 systemRole/taskGuidance |
| G7 | 作者的分步指导落在**不可编辑**的 `systemSuffix` 里 | `builtin-prompt-templates.ts:449`/`:543`/`:649`/`:786`/`:1490` |
| G8 | 项目 Markdown 指导只在正文链被读，其他链不读 | `generate-draft.command.ts:753`；`generation-source-binding.ts:461` |

### P2（2 条）

| # | 缺口 | 证据 |
|---|---|---|
| G9 | 主进程额外追加的 system（`planningTargetInstruction`）不在渲染层投影里，排障时看不到全貌 | `electron/services/main-generation-owner.ts:519` |
| G10 | `systemSuffix` 追加在 user 体末尾（"系统级"直觉失效，是 P8 的根因） | `prompt-builder.ts:110` |

> 本轮**只登记不修**（作者 2026-10-24 裁定：先保证现有链路的产出质量稳定）。修法建议与优先级见 [`prompt-three-layer-alignment-assessment.md`](./prompt-three-layer-alignment-assessment.md) §5。

---

## 8. 增量核对清单（下次只跑这八条，< 2 小时）

| # | 核对什么 | 怎么核 | 变了说明 |
|---|---|---|---|
| 1 | 模板 key 增删 | 跑 `prompt-inventory-coverage.test.ts` | §3.2 要同步 |
| 2 | EDITABLE 白名单变化 | 同上测试（已覆盖） | §3.2 的「是/否」列要改 |
| 3 | 新增装配链路 | 跑 `node scripts/check-prompt-wiring.mjs`（零消费方 / 未注入会直接列出来） | §5 补一行，§6 档位要判 |
| 4 | 新增手工拼装（不经模板） | 搜 `systemRole +`、`composePromptSystemRole` 的调用点 | §5 补行 |
| 5 | 作者级落点是否新增 | 搜 `writtenPrompt` / `writing-skills.json` / `stepGuidance` 的新消费点 | §4 补行 |
| 6 | 覆盖优先级是否改动 | 读 `prompt-catalog.ts` 的 `resolve`/`peek` | §3.3 与 §4 都要改 |
| 7 | 防漂移测试增删 | `ls src/**/__tests__/*prompt*` | §3.4 补行 |
| 8 | 缺口是否被修 | 逐条按 §7 的「证据」列 grep 一次 | 修掉的标 ✅ 并写日期 |

**清单过期的强制信号**：只要 §3.2 与 `BUILTIN_PROMPTS` 的 key 集合不一致，测试立即红——这条断言就是"不用全量重扫"的全部凭据。
