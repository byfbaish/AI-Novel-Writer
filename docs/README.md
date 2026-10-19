# 项目文档 · 唯一入口

> **找文档只看这一页。** 本页给出「想干什么 → 打开哪个文件」的完整索引、每个目录的职责边界，以及**新文档该放哪里**的硬规则。
> 更新：2026-10-20 · 分支 `exp/arc-tree-v2`（E 系列施工中）
> 上一版入口是 [`plans/00-OVERVIEW.md`](plans/00-OVERVIEW.md)（2026-10-11 历史看板，已冻结，只作存档）。

---

## 0. 一句话地图

```
docs/
├── design/      ★ 现行设计 + 实施记录（唯一活跃设计区）
│   ├── prompt/         Prompt 流水线（组装 / 作用域 / 去重 / 缓存 / 追踪）
│   ├── architecture/   架构五层 / 故事弧 / 阶段结构 / 一致性校验 / 蓝图结构
│   ├── review/         审稿链
│   ├── characters/     角色卡、roster 同步
│   └── features/       设置包、作者操作手册等
├── plans/       🔒 台账 + 冻结合同（只读：唯一 TODO 台账 + Program v3 冻结包）
├── research/    🔒 研究、外部材料消化、实施证据（含被脚本引用的冻结证据）
├── adr/         ✅ 架构决策记录（编号连续，只增不改）
├── agents/      ✅ 交付与协作规则
├── handoffs/    ✅ 跨会话交接快照（日期化）
└── experiments/ ✅ 实验记录
```

**两句话记住边界**：

1. **要改代码的方案 → `docs/design/`。** 不再往 `docs/plans/` 里写设计稿。
2. **`docs/plans/` 与 `docs/research/` 里带 `novel-quality-*` 前缀的子树是冻结证据**，被 `scripts/__tests__` 与 `donor-delta.json` 按路径引用，**不得移动、改写、改名**。

---

## 1. 我要找什么 → 打开哪里

| 你想… | 打开 |
|---|---|
| 知道某功能**为什么这么设计** | `docs/design/<主题>/…-design.md` |
| 看某设计**做到哪一步**（实施没 / 卡在哪） | 该设计稿头部的 `> 状态：` 行 —— 状态只改这一行，不新建文件 |
| 找**接下来做什么**（TODO） | [`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md) ← **唯一台账** |
| 查 **Prompt 组装 / 材料准入 / 去重 / 缓存** | [`design/prompt/`](design/prompt/) |
| 查 **架构五层 / 故事弧 / 阶段结构 / 一致性校验** | [`design/architecture/`](design/architecture/) |
| 查 **审稿链**（材料去重、目标准入、序数断言） | [`design/review/`](design/review/) |
| 查**已定的、不可逆的决定** | [`adr/`](adr/) |
| 查**为什么没采纳某方案** | `design/<主题>/…-assessment.md`，或 `research/` |
| 查 **Program v3 原始合同 / 审计证据** | `plans/novel-quality-*/`、[`research/novel-quality-modernization/`](research/novel-quality-modernization/) 🔒 冻结 |
| 接手别人的会话 | [`handoffs/`](handoffs/) |
| 发布 / 交付 / 审查流程 | [`DEVELOPMENT.md`](DEVELOPMENT.md) · [`agents/delivery.md`](agents/delivery.md) |
| 产品术语 / 事实源边界 | [`product-domain.md`](product-domain.md) |

---

## 2. 目录职责（含冻结标记）

| 目录 | 职责 | 状态 | 能新增吗 |
|---|---|---|---|
| [`design/`](design/) | 所有**现行**设计稿、评估、实施记录，按主题分子目录 | ★ 活跃 | ✅ 新设计一律放这里 |
| [`plans/`](plans/) | ① 唯一 TODO 台账 ② Program v3 冻结合同 ③ 历史看板 | 🔒 除台账外冻结 | ⚠️ 只往台账追加；**不新增设计稿** |
| [`research/`](research/) | 外部材料消化、实施证据、协议与证据索引 | 🔒 冻结（`novel-quality-*` 子树） | ⚠️ 新调研需独立文件名并登记来源 |
| [`adr/`](adr/) | 难以从代码恢复的架构决定 | ✅ 只增不改 | ✅ 连续编号 |
| [`agents/`](agents/) | Issue / 领域文档 / Agent 交付规则 | ✅ 活跃 | ✅ |
| [`handoffs/`](handoffs/) | 指定分支或任务的交接快照 | 按日期过时 | ✅ `YYYY-MM-DD-主题.md` |
| [`experiments/`](experiments/) | 实验执行说明与回执 | 按日期 | ✅ |

> **编号勘误（2026-10-18 登记）**：`adr/0018-module-ownership.md` 与 `adr/0018-program-v3-domain-contracts.md` 为历史重号——后者实际接续 0017、先于 0019 定稿，引用时请以**文件全名**为准，不要凭编号猜测。因冻结子树 `research/novel-quality-modernization/`（`current-spec-index.md`、`evidence-index.md`、`s01-evidence.md`）按字面路径引用这两个文件名，**暂不改名**；后续新 ADR 从 **0021** 起连续编号。

---

## 3. 新文档放置规则（写之前先读这一节）

### 3.1 判定口诀（按顺序问）

1. **它会改代码或改产品行为吗？**
   → 会：`docs/design/<主题>/<编号>-<主题>-design.md`
   → 不会、只是看清现状 / 对比外部方案：`docs/design/<主题>/<主题>-assessment.md`
2. **它只是一条待办？** → 追加到 [`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md)，**不要新建台账**。
3. **它是一个不可逆的架构决定？** → `docs/adr/`（连续编号；进度和待办不写进 ADR）。
4. **它是外部报告 / 调研回执？** → `docs/research/`（保留来源、采集时间、适用边界）。
5. **它是一次跨会话交接？** → `docs/handoffs/YYYY-MM-DD-主题.md`（注明分支、基准 SHA、脏状态、未验证事项）。

### 3.2 硬规则

1. **不往 `plans/` 新增设计稿。** 2026-10-17 起 `plans/` 只保留台账与冻结合同；此前散落在 `plans/` 的设计稿已迁到 `design/<主题>`。
2. **冻结子树不得移动或改写**：`plans/novel-quality-modernization/`、`plans/novel-quality-program-2026-09-13/`、`plans/novel-quality-program-v3-2026-09-13/`、`research/novel-quality-modernization/`。
   原因：`vite.config.ts:89` 把 `**/docs/plans/**` 从 vitest 排除（冻结规划脚本自行执行），且 [`donor-delta.json`](research/novel-quality-modernization/donor-delta.json) 等证据文件按字面路径引用其中的 `.md`。
3. **每份设计稿头部必须有状态行与日期**：
   `> 状态：待裁定 / 已裁定 / 已实施 / 已搁置（原因）/ 已结项` + `> 日期：YYYY-MM-DD`。
   **状态变化只改这一行**，不新建文件；实施记录写在同一文件的「实施记录」章节。
4. **上位稿 / 子稿关系写在头部**：`> 上级稿：`docs/design/prompt/xxx-design.md` §…`。设计是树，不是散点。
5. **相对链接必须能点开**。提交前跑：

   ```bash
   node scripts/check-doc-links.mjs
   ```

6. **不复制** API Key、模型凭据、小说正文、用户目录、可再生构建输出。

### 3.3 命名约定

| 类型 | 命名 | 例 |
|---|---|---|
| 设计稿 | `<编号>-<主题>-design.md` | `p7-review-material-dedup-design.md` |
| 评估 / 否决记录 | `<主题>-assessment.md` | `seven-layer-skeleton-assessment.md` |
| 操作手册 / 草案 | `<编号>b-<主题>-guide.md` | `p1-2b-settings-period-authoring-guide.md` |
| 交接 | `YYYY-MM-DD-<主题>.md` | `2026-09-05-astra-code-review.md` |
| ADR | `NNNN-<slug>.md` | `0020-legacy-project-copy-import.md` |

---

## 4. 现行设计索引

> 完整索引即本节。**这是查找设计文档的唯一清单**，不要再去翻目录树。

### 4.1 Prompt 流水线 · [`design/prompt/`](design/prompt/)（22 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`prompt-payload-scoping-design.md`](design/prompt/prompt-payload-scoping-design.md) | ★ 上位稿 | 全链路 Prompt 载荷作用域（材料白名单）；P0/P1 系列的总纲 |
| [`chapter-prompt-pileup-triage.md`](design/prompt/chapter-prompt-pileup-triage.md) | 诊断 | 章节链路「一锅乱炖」逐条判定，payload 设计的前置 |
| [`p1-literal-dedup.md`](design/prompt/p1-literal-dedup.md) | ✅ 已完成 | 单次请求内逐字重复消除（D1 收敛 2/2→1/1） |
| [`p3-semantic-dedup.md`](design/prompt/p3-semantic-dedup.md) | 🏁 已关闭 | 语义去重；收益仅 2.8–4.7%，仅采纳提示词替代方案 |
| [`p4-prompt-config-merge.md`](design/prompt/p4-prompt-config-merge.md) | ⏸ 待做 | 提示词配置整合（AI 优化 → diff → 人工确认） |
| [`p4-reassessment.md`](design/prompt/p4-reassessment.md) | 结论 | P4 是否还有必要；原形态取消 |
| [`p0-0-upstream-projection-design.md`](design/prompt/p0-0-upstream-projection-design.md) | ✅ 已实施 | 上游章级投影 |
| [`p0-1-short-outline-scoping-design.md`](design/prompt/p0-1-short-outline-scoping-design.md) | ✅ 已实施 | 短细纲只喂该步材料（16.7k 字 → 单步材料） |
| [`p1-1-boundary-notice-design.md`](design/prompt/p1-1-boundary-notice-design.md) | ✅ 已实施 | 后续计划降级为「本章不可写事件」清单 |
| [`p1-2-architecture-projection-design.md`](design/prompt/p1-2-architecture-projection-design.md) | ✅ 已实施 | `architecture` 对正文只给事实源 |
| [`p1-3-variable-export-scoping-design.md`](design/prompt/p1-3-variable-export-scoping-design.md) | 部分落地 · 待裁定 | L1 变量出口语义化（`acceptsScopes` / `enforceRequiredContext`） |
| [`free-text-scoping-design.md`](design/prompt/free-text-scoping-design.md) | ✅ 已实施 | 自由文本按步骤分区（参考作品落点 + `global_guidance` 分区） |
| [`short-outline-first-failure-retry-design.md`](design/prompt/short-outline-first-failure-retry-design.md) | ✅ 已实施 | 短细纲首次失败自动重试 |
| [`outline-setting-compatibility-guard-design.md`](design/prompt/outline-setting-compatibility-guard-design.md) | 待裁定 R5 | 大纲/蓝图层「设定相容性」守卫 |
| [`outline-structure-marker-assessment.md`](design/prompt/outline-structure-marker-assessment.md) | 评估（替代已实施） | 大纲要不要加「标记行」；诊断对、处方错层 |
| [`global-guidance-scope-lint-design.md`](design/prompt/global-guidance-scope-lint-design.md) | ⏸ 搁置 | 全局写作要求章节越界静态校验（作者裁定不进框架） |
| [`contract-first-reassessment.md`](design/prompt/contract-first-reassessment.md) | 存档 | 《全链路 Prompt 架构重构评估》复核；结论已折进上位稿 |
| [`prompt-cache-evaluation.md`](design/prompt/prompt-cache-evaluation.md) | ⏸ 挂起 | 提示词缓存命中率评估 |
| [`debug-prompt-trace-design.md`](design/prompt/debug-prompt-trace-design.md) | 设计稿 | Debug 开关：Prompt 片段追踪 + 输入输出落盘 |
| [`prompt-trace-output-sample.md`](design/prompt/prompt-trace-output-sample.md) | 样本 | 真实生成数据的 Prompt 组装快照 |
| [`p8-fanqie-flavor-draft-quality-design.md`](design/prompt/p8-fanqie-flavor-draft-quality-design.md) | ✅ P1 生效 · ⏳ P2/P3 待复验 | 番茄向正文质量闸门：续写判定接回合格线 / 可判定 AI 味禁令 / 番茄 KPI 落点（§10 复验 #1） |
| [`p9-platform-style-layer-design.md`](design/prompt/p9-platform-style-layer-design.md) | ⏸ 待裁定 | 平台文风层：用写作 Skill 承载平台口味，`.vela-pack` 加 platform 字段，按平台选择加载 |

### 4.2 架构 / 故事弧 / 一致性 · [`design/architecture/`](design/architecture/)（36 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`stage-structure-layer.md`](design/architecture/stage-structure-layer.md) | ★ 主文档 | 第五层「阶段结构」显现设计（施工图 + 6 步落地） |
| [`arc-nesting-design.md`](design/architecture/arc-nesting-design.md) | ★ 主文档 | 弧的层级/因果/篇幅语义规范（大弧⊃中弧⊃小弧） |
| [`story-arc-proposal.md`](design/architecture/story-arc-proposal.md) | v3 提案 | 故事弧环节设计演进记录（v1→v4） |
| [`arc-granularity-and-enum.md`](design/architecture/arc-granularity-and-enum.md) | 问答闭环 | 作者五问答复（步骤粒度 / 枚举降级） |
| [`arc-prompt-assessment.md`](design/architecture/arc-prompt-assessment.md) | 评估 | 弧生成 Prompt 外部报告；哲学吸收、手段拒绝 |
| [`arc-space-causal-state-feasibility.md`](design/architecture/arc-space-causal-state-feasibility.md) | 评估 | 弧/空间/因果/状态修订版落地可行性 |
| [`causal-vs-state-digestion.md`](design/architecture/causal-vs-state-digestion.md) | 判据 | 「能推理→prompt；不能推理→代码」 |
| [`state-tracking-assessment.md`](design/architecture/state-tracking-assessment.md) | 评估 | 13 类状态里只有「角色知识」是纯空白 P0 |
| [`seven-layer-skeleton-assessment.md`](design/architecture/seven-layer-skeleton-assessment.md) | 坐标系 | 七层骨架模型 L0–L6（与「五层架构」编号不同，见文内换算） |
| [`l3-arc-gap-verification.md`](design/architecture/l3-arc-gap-verification.md) | 定论 | 为什么剧情树/叙事线索都不构成 L3 |
| [`layered-generation-assessment.md`](design/architecture/layered-generation-assessment.md) | 评估 | 分层/增量生成；仅篇幅约束可采纳 |
| [`architecture-consistency-design.md`](design/architecture/architecture-consistency-design.md) | 评估（已进台账） | 五层一致性校验 → AC1/AC2/AC3 三段走 |
| [`blueprint-key-events-structuring-design.md`](design/architecture/blueprint-key-events-structuring-design.md) | 初稿 v2 · 待裁定 | 蓝图 `keyEvents` 结构化 |
| [`phase2-keyevents-bprime-implementation-plan.md`](design/architecture/phase2-keyevents-bprime-implementation-plan.md) | 待过目 · 未动代码 | 阶段 2 + B′（含 R6）实施清单 |
| [`p11-plan-validity-and-fact-registry-design.md`](design/architecture/p11-plan-validity-and-fact-registry-design.md) | 📝 待裁定 | 计划的有效期与事实登记：水位列 / `attacks` / 复核五步 / 章级「前提」 |
| [`arc-delivery-audit-assessment.md`](design/architecture/arc-delivery-audit-assessment.md) | 📝 待裁定 | 弧光兑现度审计：情节弧被超额消耗、角色弧 3/7 起点、两弧不对齐 |
| [`p12-arc-node-anchoring-design.md`](design/architecture/p12-arc-node-anchoring-design.md) | 📝 待裁定 | 弧光结构位 ID（`M1-2/转折`，纯函数派生）+ `covers` + 三个不变量 |
| [`p13-arc-layer-expansion-design.md`](design/architecture/p13-arc-layer-expansion-design.md) | ✅ 已实施 | 弧光分层信息量必须递增：小弧从「标签」变「材料」+ 大弧「中弧推进」+ 生成时体检 |
| [`arc-proportion-calibration.md`](design/architecture/arc-proportion-calibration.md) | 📝 已并入下条 | 弧光篇幅比例：30:45:25 / 40:60 / 小弧差 ≤2 倍（现为全层均分） |
| [`arc-budget-engine-design.md`](design/architecture/arc-budget-engine-design.md) | 📝 立项 · 待裁定 | **骨架预算引擎**（合并平台画像）：章数由本地算、模型只复核；一张画像两个消费者；比例与绝对区间在 150 章下不兼容 |
| [`o1-arc-event-progress-design.md`](design/architecture/o1-arc-event-progress-design.md) | 📝 待裁定 | **O1 落地：按弧分配、按章生成**——事件按 `→` 编号 + 每章进度线 + `覆盖：#E<n>` 水位，四条不变量（不改批次/cursor/请求数） |
| [`synopsis-expansion-design.md`](design/architecture/synopsis-expansion-design.md) | ✅ 已实施 | **大纲层扩张机制**：章数不减，改「章级局面」（想要—被挡—尝试—代价—未决）+ 展开四来源 + 弧位块逐章步数上限（代码算，不让模型排） |
| [`arc-layer-handoff.md`](design/architecture/arc-layer-handoff.md) | ✅ 交接必读 | **弧光层工间交接**：初衷（把硬编码的阶段划分显性化）/ 职责三问 / 怎么长到 10.6k 的正反馈 / 五条已证伪假设 / 六条交接禁忌 / 下一步（先只写大弧层跑一次） |
| [`arc-tree-expansion-design.md`](design/architecture/arc-tree-expansion-design.md) | 🟡 待评审（`exp/arc-tree-v2`） | **弧光「逐节点展开」验证方案**：一次性生成的病是"同一个上下文里同时做 27 个决定 ⇒ 只能套格式"；本轮只做两层（大弧一次 + 中弧逐个大弧展开、小弧不拆）；复用同一 key 跑 1+N 次拼接，零 DB/契约改动；`arc-node` 的中弧结构位已够大纲对账，不依赖小弧 |
| [`arc-generality-and-ending-design.md`](design/architecture/arc-generality-and-ending-design.md) | ✅ 已实施（P15 + P16） | **弧光泛用性 / 结局 / 类型分配**：层级由章数定义、类型只有 A/B/C、骨料只认「拿到了」是三处题材偏置；张力=价值翻转；结局四笔债；**中弧三型原来只规定了"他失败"的位置、没有"对手失手"的位置**⇒ 各补反制/得手/反获 + 每小弧一条对手侧事件；D/E **暂不加** |
| [`arc-prompt-v2-web-test.md`](design/architecture/arc-prompt-v2-web-test.md) | 🧪 验证件 v2.1 · 已否决 | **弧光提示词组装稿（v2.1）**：真实项目数据填充、可直接粘到网页模型验证。v2 网页实测三处失败已修：小弧由「3–5 条必发事件」→「回合」→ **战线**；中弧补**局面**；**底牌记账上移大弧**。⚠️ v2.1 实测仍失败（小弧全是家长里短），原因见 v3 |
| [`arc-prompt-v3-web-test.md`](design/architecture/arc-prompt-v3-web-test.md) | ✅ 方向已验证（作者 2026-10-19）· 被 v4 取代 | **弧光提示词 v3**：行业词（卷/单元）、删掉第三层小弧、放开章数区间与占比、末尾**全书节奏表**。实测产出明显优于 v2.1（叙事任务有架子、状态变化留白） |
| [`arc-prompt-v4-web-test.md`](design/architecture/arc-prompt-v4-web-test.md) | ✅ 双画像已验证（2026-10-19）· 被 v5 取代 | **篇幅收回、改画像推荐**：模型不再输出章数/占比/章号；输入侧给「节奏推荐」画像。实测：番茄 23 单元 / 起点 21 单元，**无篇幅数字也未缩小气** ⇒ 数字不是"大"的必要条件 |
| [`arc-prompt-v5-web-test.md`](design/architecture/arc-prompt-v5-web-test.md) | 🧪 验证件 v5 · 被 v6 取代 | **补两处退化**：① 逼法"变"= 上一段那个办法**不好使了**，只换施压者判不合格，并给五档强度；② 结账必须落到具体的人/物/记录，追问"谁现在会来找麻烦"。硬画像实测 19 vs 27 单元。⚠️ 个数在三处声明（画像/怎么切/输出格式），画像改不动常量 |
| [`arc-prompt-v6-web-test.md`](design/architecture/arc-prompt-v6-web-test.md) | ✅ 双画像已验证（2026-10-19）· 被 v7 取代 | **个数单一事实源 + 去同质化**：个数只在【节奏推荐】声明；相邻两单元交手类型不许相同。实测首次分开卷数（番茄 7 卷 / 起点 5 卷），**总单元数守恒 28 vs 29**（被 章数÷跨度 钉住）⇒ 画像控形状、章数守恒 |
| [`arc-prompt-v7-web-test.md`](design/architecture/arc-prompt-v7-web-test.md) | ✅ 双画像已验证（2026-10-19）· 提示词定稿 | **标注转正 + 自检静默**：把模型自发的「（交手：X；档：A→B）」收编为正式字段供机器校验；自检改为只做不输出。实测起点 4 卷/23 单元、番茄 7 卷/28 单元；**"单元数守恒"被证伪**（是巧合） |
| [`arc-v7-implementation-design.md`](design/architecture/arc-v7-implementation-design.md) | ✅ 已实施 P1–P4 | **落地方案 P1/P2**：① 解析器兼容（`大弧\|卷`、`中弧\|单元`、补中文序号、两级模式成一等公民、golden 测试）；② 画像注入（`rhythm_profile` 走 M08 lane 六步，空=中性，模板需同时进 `requiredContextVariables`）；P3 体检两条只报不拦、P4 UI 文案 |
| [`unit-budget-elastic-allocation-design.md`](design/architecture/unit-budget-elastic-allocation-design.md) | ✅ E1/E1.5/E2 已实施 · **E3 全项目 Top 优先（未开始）** · §2 额度口径已被取代 | **弹性配给制**：单元章数由内容决定，代码只给「紧/松/按节奏」的方向（Z = 实际消耗 − 计划进度，±10% 三档）；偏差只在卷内结清、不跨卷；卷计划额度 = 画像默认 + 作者可覆盖；逐单元生成（不给 to，写完本单元即停） |
| [`volume-quota-context-budget-design.md`](design/architecture/volume-quota-context-budget-design.md) | 🟡 实施中（T2–T8 ✅ · E4 内：T11 优先/T9 后放/T10 确认搁置） | **大纲前缀预算（E4）**：每批都把整段已完成大纲塞进 prompt ⇒ 成本 O(已写章数)，长篇 666 章大纲 20 万字（133k–200k tokens）**数学上塞不进**；改三层投影（本卷全文 + **上一卷快照** + 最近 K 章），输入恒定 ≈2.6 万字；**卷末快照**按 agent compaction 语义只交接下一卷要用的物与债（生命周期止于下一卷）；**冻结与定稿同机制（作者触发、按卷冻、当前卷不冻）**，快照同时是回滚锚点（回滚单独立项）+ 弧光进全量清除；长卷单元**默认折叠可全量展开 + 可 pin 的卷/单元只读树 + Tab 实例 LRU4/墓碑（审稿对照场景）**；顺带解析 `cached_tokens`；E3 改「请求无 to、落库回填」 |
| [`unit-budget-prompt-ab-test.md`](design/architecture/unit-budget-prompt-ab-test.md) | 🧪 E2 已完成 · 提示词层已验证 | **弹性配给的 A/B/C 微型 prompt**：同一结构只改「配给状态」块（不足/均衡/充足），验章数是否跟着变；三份各 <1,500 字、虚构数据；附判读表与「提示词无效就别动机制」的判定规则 |
| [`e3-unit-batch-implementation-plan.md`](design/architecture/e3-unit-batch-implementation-plan.md) | 🟡 T1–T3 / T5–T7 / T4a 已实施 · T4b + T8–T10 待做 | **E3 实施拆解**：请求 `{from,unitIndex,maxChapters}`、落库 `{from,to}` + 游标三元组；预算按本卷剩余章数冻结；T1–T11 每步可独立验证 + 检查点回归清单 |

### 4.3 审稿链 · [`design/review/`](design/review/)（3 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`p7-review-material-dedup-design.md`](design/review/p7-review-material-dedup-design.md) | ✅ 已实施 | 审稿链材料去重（世界观/角色状态重复注入） |
| [`c1-review-architecture-declaration-design.md`](design/review/c1-review-architecture-declaration-design.md) | ✅ 已实施 | 审稿链「远期设定使用规则」声明（路子 B） |
| [`consistency-check-ordinal-claim-guard-design.md`](design/review/consistency-check-ordinal-claim-guard-design.md) | ✅ 已实施 | 序数/全称断言独立复核 |

### 4.4 角色 · [`design/characters/`](design/characters/)（2 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`p1-blueprint-roster-sync.md`](design/characters/p1-blueprint-roster-sync.md) | ✅ 已实施 | 蓝图角色 ↔ 角色卡 roster 同步 |
| [`p2-character-card-ai-generation.md`](design/characters/p2-character-card-ai-generation.md) | ✅ 已实施 | 角色卡管理界面的 AI 生成增强 |

### 4.5 功能与设置 · [`design/features/`](design/features/)（4 篇）

| 文档 | 状态 | 一句话 |
|---|---|---|
| [`user-settings-package-design.md`](design/features/user-settings-package-design.md) | 待审核 · 未编码 | 用户级设置包（创作资产导出/导入） |
| [`p1-2b-settings-period-authoring-guide.md`](design/features/p1-2b-settings-period-authoring-guide.md) | 草案 v1 | 世界观期次标注的作者操作手册 |
| [`system-notification-design.md`](design/features/system-notification-design.md) | 待裁定 | 系统级 OS 通知 + 声音提醒（主进程发通知/渲染进程播音/聚焦抑制/注册表热插拔；N1–N3 分期） |
| [`task-completion-notify-design.md`](design/features/task-completion-notify-design.md) | 已列入待办（顺延） | 应用内 toast 统一宿主 + 热插拔注册表（作者裁先做系统级；将来可合并为双输出） |

---

## 5. 台账与冻结区

- **唯一 TODO 台账**：[`plans/prompt-assembly-backlog.md`](plans/prompt-assembly-backlog.md)。P 系列（P1–P9 / P11 / P12）+ N 系列 + E 系列全在里面；新待办追加到这里。
- **历史看板**：[`plans/00-OVERVIEW.md`](plans/00-OVERVIEW.md)（2026-10-11 冻结，仅存档；现行状态见本页与台账）。
- **Program v3 冻结合同**：[`plans/novel-quality-program-v3-2026-09-13/00-START-HERE.md`](plans/novel-quality-program-v3-2026-09-13/00-START-HERE.md)（34 节点原合同；DAG/NOT STARTED 不代表当前调度）。
- **开发入口（Program v3 侧）**：[`research/novel-quality-modernization/current-spec-index.md`](research/novel-quality-modernization/current-spec-index.md) ← 逐项连接原合同与现行替代。
- **线程 10 交付计划**：[`research/novel-quality-modernization/thread10-delivery-plan.md`](research/novel-quality-modernization/thread10-delivery-plan.md)（采样裁决与实施顺序）。
- **留在 `plans/` 的两份历史文件**（目录外存在按字面路径的锚点，移动会造成断链，故不动）：
  - [`chapter-goal-review-production.md`](plans/chapter-goal-review-production.md) —— 被 [`donor-delta.json`](research/novel-quality-modernization/donor-delta.json) 按路径引用。
  - [`llm-probe-observation-plan.md`](plans/llm-probe-observation-plan.md) —— 被 `electron/services/llm-probe.ts`、`src/shared/synopsis-projection.ts`、`src/services/workflows/commands/generate-draft.command.ts` 的注释引用。
- **实施证据索引**：[`research/novel-quality-modernization/evidence-index.md`](research/novel-quality-modernization/evidence-index.md)；质量协议：[`quality-protocol.md`](research/novel-quality-modernization/quality-protocol.md)。
- **P8 取证（2026-10-17）**：[`research/2026-10-17-fanqie-draft-quality-evidence.md`](research/2026-10-17-fanqie-draft-quality-evidence.md) —— 番茄向草稿的 5 份并行取证 + 独立校验，供 [`p8-fanqie-flavor-draft-quality-design.md`](design/prompt/p8-fanqie-flavor-draft-quality-design.md) 引用。

---

## 6. 文档权威层级

| 文档 | 用途 | 权威与生命周期 |
| --- | --- | --- |
| [`README.md`](../README.md)、[`README_en.md`](../README_en.md) | 面向用户的产品定位、安装、隐私和能力概览 | 当前公开产品说明；中英文需要同步 |
| [`docs/product-domain.md`](product-domain.md) | 稳定产品术语、事实源和边界 | 可发布的领域词汇表；实现和规格应使用这里的名称 |
| [`docs/adr/`](adr/) | 难以从代码恢复的架构决定、边界和取舍 | 已接受决定；后续变化应明确扩展或取代原决定 |
| [`docs/agents/`](agents/) | Issue、领域文档和 Agent 协作规则 | 当前贡献流程；不得承载临时任务状态 |
| [`docs/design/`](design/) | 现行设计稿、评估与实施记录 | 按各稿头部的状态行使用；状态只改那一行 |
| [`docs/plans/`](plans/) | 待办台账 + Program v3 冻结范围 | 台账活；冻结包不回填进度 |
| [`docs/research/`](research/) | 调研、实施证据及实验执行说明 | 按各文件的日期和角色使用；历史回执不自动成为当前资格 |
| [`docs/handoffs/`](handoffs/) | 指定分支或任务的交接快照 | 有日期的任务状态；完成或分支变化后可能过时 |

本机 `AGENTS.md` 与 `CONTEXT.md` 是可选的本机 Agent 上下文，按仓库卫生规则保持忽略，**不是公共文档**，不能覆盖 [`product-domain.md`](product-domain.md) 或 ADR。

---

## 7. 已取代的决定

- [`0006-unified-cross-platform-github-release.md`](adr/0006-unified-cross-platform-github-release.md) 保存最初的 Windows + macOS ARM64 发布决定，当前三目标发布与平台更新动作由 [`0016-three-target-release-and-platform-update-actions.md`](adr/0016-three-target-release-and-platform-update-actions.md) 取代。
- [`0019-remove-real-call-hard-cap.md`](adr/0019-remove-real-call-hard-cap.md) 取代冻结实验合同的全局 80 次调用硬帽；80 保留为计划分配额，逐请求记账和产品安全限额继续有效。
- [`0020-legacy-project-copy-import.md`](adr/0020-legacy-project-copy-import.md) 将旧小说兼容改为保留原件的完整项目导入，禁止 AI 重建或覆盖既有设定；取代旧根退役/永久拒写要求。[现行 F05](research/novel-quality-modernization/frontend-transition-specs.md#f05--最终-v3-功能及桌面体验资格) 同时拥有新版编辑交互验收。
- [正文篇幅现行要求](plans/novel-quality-modernization/specs/S06B.md#prose-length-overrun) 自 2026-10-05 起保留一次既有超长压缩，仍超长则提示并继续；偏短处理不变。
- [AI 自主审稿与成稿资格](research/novel-quality-modernization/quality-protocol.md#ai-review-final-manuscript) 自 2026-10-01 获用户批准。
- [线程 10 交付计划](research/novel-quality-modernization/thread10-delivery-plan.md) 自 2026-10-02 拥有材料补齐、自动短细纲、有界模型筛选及 candidate-only 多轮资格。

---

## 8. Worktree 边界

审计或接手任务时先运行 `git worktree list --porcelain`，再在目标 Worktree 内记录分支、SHA 和 `git status --short`。移动、合并或删除 Worktree 属于单独的清理任务；文档治理不授权这些操作。

每次提交态文档绑定其实际 SHA；用户授权的工作区规格增量可供本次审查，但须记录来源、内容 hash 和未提交状态。不能把其他 Worktree 的材料或尚未提交的修订说成当前提交/远端已包含的事实。
