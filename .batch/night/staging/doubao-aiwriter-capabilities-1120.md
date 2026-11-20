# AI writer 能力清单（从仓内文档/任务卡的文件名反推）

> 生成方式：仅向豆包 agent 提供「文件名 + 字节 + mtime + 目录结构」清单（`.batch/night/tmp/cap-input-1120.md`，20,787 B / 570 行），
> 不含任何正文；豆包据字面信息推断，未读正文、未开 `.ai-novel/` 数据库。原始回帖落在 `.batch/night/tmp/cap-raw-1120.txt`。
> 派活档位：DeepSeek V4.1 Flash · 推理强度 高（chip 原文 `DeepSeek V4.1 Flash 高`）。

## 创作流水线

| 域 | 模块 | 能力 | 依据文件（相对路径） | 初判状态 |
|---|---|---|---|---|
| 创作流水线 | 提示词组装 | 拼装章节提示词块并固定投放顺序 | docs/design/prompt/chapter-prompt-block-ordering-design.md；docs/design/prompt/prompt-block-order-audit.md | 半成品 |
| 创作流水线 | 提示词组装 | 核对提示词三层内容对齐 | docs/design/prompt/prompt-three-layer-alignment-assessment.md；docs/design/prompt/prompt-three-layer-inventory.md | 半成品 |
| 创作流水线 | 提示词组装 | 裁剪提示词负载并收敛作用域 | docs/design/prompt/prompt-payload-scoping-design.md；docs/design/prompt/free-text-scoping-design.md；docs/design/prompt/p0-1-short-outline-scoping-design.md；docs/design/prompt/p1-3-variable-export-scoping-design.md；docs/design/prompt/global-guidance-scope-lint-design.md | 半成品 |
| 创作流水线 | 提示词组装 | 过滤进入提示词的条款并合并配置分段 | docs/design/prompt/prompt-clause-admission.md；docs/design/prompt/p4-prompt-config-merge.md；docs/design/prompt/p4-reassessment.md | 仅有壳 |
| 创作流水线 | 提示词组装 | 输出提示词追踪记录并评估缓存收益 | docs/design/prompt/debug-prompt-trace-design.md；docs/design/prompt/prompt-trace-output-sample.md；docs/design/features/p16b-prompt-config-and-trace-guide.md；docs/design/prompt/prompt-cache-evaluation.md | 半成品 |
| 创作流水线 | 提示词组装 | 去除提示词重复并分诊块堆积 | docs/design/prompt/p1-literal-dedup.md；docs/design/prompt/p3-semantic-dedup.md；docs/design/prompt/chapter-prompt-pileup-triage.md；docs/plans/prompt-assembly-backlog.md | 仅有壳 |
| 创作流水线 | 提示词组装 | 注入章节任务锚与章节角色指引 | docs/design/prompt/chapter-task-anchor-design.md；docs/design/prompt/p14-chapter-role-guidance-design.md | 仅有壳 |
| 创作流水线 | 弧与预算 | 计算故事弧预算并校准比例 | docs/design/architecture/arc-budget-engine-design.md；docs/design/architecture/arc-proportion-calibration.md；docs/handoffs/2026-10-19-arc-budget-handoff.md | 半成品 |
| 创作流水线 | 弧与预算 | 弹性分配单元预算并跑提示词 A/B | docs/design/architecture/unit-budget-elastic-allocation-design.md；docs/design/architecture/unit-budget-prompt-ab-test.md | 半成品 |
| 创作流水线 | 弧与预算 | 划分弧粒度、嵌套弧层并展开弧树 | docs/design/architecture/arc-granularity-and-enum.md；docs/design/architecture/arc-nesting-design.md；docs/design/architecture/arc-tree-expansion-design.md | 仅有壳 |
| 创作流水线 | 弧与预算 | 迭代弧提示词 v2–v7 并落地 V7 方案 | docs/design/architecture/arc-prompt-assessment.md；docs/design/architecture/arc-prompt-v7-web-test.md；docs/design/architecture/arc-v7-implementation-design.md | 半成品 |
| 创作流水线 | 弧与预算 | 审计弧交付、收敛结局并评估七层骨架 | docs/design/architecture/arc-delivery-audit-assessment.md；docs/design/architecture/arc-generality-and-ending-design.md；docs/design/architecture/seven-layer-skeleton-assessment.md | 不明 |
| 创作流水线 | 弧与预算 | 交接弧层、跟踪事件进度、验证缺口并锚定节点 | docs/design/architecture/arc-layer-handoff.md；docs/design/architecture/o1-arc-event-progress-design.md；docs/design/architecture/l3-arc-gap-verification.md；docs/design/architecture/p12-arc-node-anchoring-design.md | 仅有壳 |
| 创作流水线 | 弧与预算 | 建故事节拍库并生成故事弧提案 | docs/design/architecture/story-beat-library.md；docs/design/architecture/story-arc-proposal.md | 仅有壳 |
| 创作流水线 | 大纲与蓝图 | 结构化蓝图关键事件 | docs/design/architecture/blueprint-key-events-structuring-design.md；docs/design/architecture/phase2-keyevents-bprime-implementation-plan.md | 半成品 |
| 创作流水线 | 大纲与蓝图 | 定义卷单位结构、上下文配额与卷数来源 | docs/design/architecture/volume-unit-structure-design.md；docs/design/architecture/volume-quota-context-budget-design.md；docs/design/architecture/d6-volume-count-source-design.md | 仅有壳 |
| 创作流水线 | 大纲与蓝图 | 生成卷级交接 | docs/design/architecture/p1-2-volume-handoff-design.md；docs/plans/p1-2-volume-handoff-plan.md；docs/handoffs/2026-11-02-d14-volume-structure-sync-handoff.md | 半成品 |
| 创作流水线 | 大纲与蓝图 | 圈定大纲变更范围并守设定兼容 | docs/design/architecture/d17-outline-change-range-design.md；docs/design/prompt/outline-setting-compatibility-guard-design.md；docs/design/prompt/outline-structure-marker-assessment.md | 仅有壳 |
| 创作流水线 | 大纲与蓝图 | 校验计划有效性并登记事实 | docs/design/architecture/p11-plan-validity-and-fact-registry-design.md | 仅有壳 |
| 创作流水线 | 大纲与蓝图 | 扩写摘要、规范章节位置格式并做首败重试 | docs/design/architecture/synopsis-expansion-design.md；docs/design/architecture/chapter-position-format-design.md；docs/design/prompt/short-outline-first-failure-retry-design.md | 仅有壳 |
| 创作流水线 | 大纲与蓝图 | 生成上游投影与架构投影 | docs/design/prompt/p0-0-upstream-projection-design.md；docs/design/prompt/p1-2-architecture-projection-design.md | 仅有壳 |
| 创作流水线 | 设定抽取 | 抽取世界观并评估容量与阶段成本 | docs/design/architecture/p1-1-worldbuilding-extraction-assessment.md；docs/design/prompt/worldbuilding-capacity-and-stage-cost-design.md | 不明 |
| 创作流水线 | 设定抽取 | 建模机构节奏、关键道具、力量体系与秘密 | docs/design/architecture/p1-1-institution-cadence-design.md；docs/design/architecture/p1-1-key-items-design.md；docs/design/architecture/p1-1-power-ability-design.md；docs/design/architecture/p20-2-secrets-design.md | 仅有壳 |
| 创作流水线 | 设定抽取 | 建模知识范围、感知边界、知识状态与知识候选 | docs/design/architecture/p1-1-knowledge-scope-and-awareness-design.md；docs/design/architecture/p1-1-knowledge-state-design.md；docs/design/architecture/p20-3-knowledge-candidates-design.md | 仅有壳 |
| 创作流水线 | 设定抽取 | 落地三宫格设定单元 | docs/plans/p1-1-three-cells-plan.md；docs/handoffs/2026-10-24-p1-1-three-cells-handoff.md | 半成品 |
| 创作流水线 | 世界状态 | 注入世界状态并接线评审 | docs/design/architecture/w7-world-state-injection-design.md；docs/design/architecture/world-state-review-and-wiring-plan.md；docs/design/architecture/world-state-w4a-wiring-plan.md | 半成品 |
| 创作流水线 | 世界状态 | 交接嵌套世界 | docs/design/architecture/w8-nested-world-handoff-design.md；docs/handoffs/archive/2026-10-23-w6-and-w8-handoff.md | 半成品 |
| 创作流水线 | 世界状态 | 维护资源账本 | docs/design/architecture/w6-resource-ledger-design.md；docs/handoffs/2026-10-23-w6a-4-resource-proposal-handoff.md | 半成品 |
| 创作流水线 | 世界状态 | 校验数值资源一致性与架构一致性 | docs/design/architecture/ac5-numeric-resource-consistency-design.md；docs/design/architecture/architecture-consistency-design.md | 仅有壳 |
| 创作流水线 | 世界状态 | 分流因果与状态消化并评估状态追踪 | docs/design/architecture/causal-vs-state-digestion.md；docs/design/architecture/state-tracking-assessment.md | 不明 |
| 创作流水线 | 人物构建 | 构建人物四层行为与核心谎言 | docs/design/prompt/character-behavior-four-layers.md；docs/design/prompt/character-core-lie-design.md；docs/handoffs/2026-10-29-character-behavior-night-handoff.md | 半成品 |
| 创作流水线 | 人物构建 | 建模人物性格、动力位点与事件类型 | docs/design/prompt/character-disposition-questionnaire.md；docs/design/prompt/character-disposition-state-design.md；docs/design/prompt/character-dynamics-effective-site.md；docs/design/prompt/character-event-types-draft.md | 仅有壳 |
| 创作流水线 | 人物构建 | 标定主角黄金特质并跑实验 | docs/design/prompt/protagonist-golden-traits.md；docs/design/prompt/golden-trait-experiment-manual.md | 半成品 |
| 创作流水线 | 人物构建 | 生成角色卡、合并提案并重建名单同步蓝图 | docs/design/characters/p2-character-card-ai-generation.md；docs/design/characters/character-proposal-adoption-merge-design.md；docs/design/characters/character-roster-rebuild-design.md；docs/design/characters/p1-blueprint-roster-sync.md | 仅有壳 |
| 创作流水线 | 章节生成 | 跑单元批量生成链 | docs/design/architecture/e3-unit-batch-chain-design.md；docs/design/architecture/e3-unit-batch-implementation-plan.md；docs/handoffs/archive/2026-10-20-t10-unit-batch-acceptance.md | 能跑 |
| 创作流水线 | 章节生成 | 执行章节失败契约并降级检查点 | docs/design/architecture/d13-chapter-failure-contract-design.md；docs/design/architecture/d8-checkpoint-degradation-design.md；docs/design/architecture/d20-checkpoint-template-fingerprint-design.md | 半成品 |
| 创作流水线 | 章节生成 | 执行章节钩子契约 | docs/design/prompt/d18-chapter-hook-contract-design.md；docs/handoffs/2026-11-05-d18-hook-contract-wiring-handoff.md | 半成品 |
| 创作流水线 | 章节生成 | 注入上一章摘要并按章节基准对齐改写 | docs/design/prompt/previous-chapter-context-assessment.md；docs/design/prompt/refine-chapter-base-alignment-design.md | 仅有壳 |
| 创作流水线 | 章节生成 | 重放短简介并重试 | docs/design/product/d12-short-synopsis-replay-fix-plan.md；docs/design/product/d12-retry-design-20260909.md；.batch/night/cards/b-d12-wiring-sites.md | 半成品 |
| 创作流水线 | 章节生成 | 批量生成样章、绑定题名并改写样章 | .batch/night/cards/p47-gen-3ch-02.md；.batch/night/cards/p50-gen-3ch-03.md；.batch/night/cards/p22a-title-binding.md；.batch/night/cards/story-rewrite.md | 半成品 |
| 创作流水线 | 章节生成 | 评估分层生成、契约优先与长文工艺 | docs/design/architecture/layered-generation-assessment.md；docs/design/prompt/contract-first-reassessment.md；docs/design/architecture/long-form-craft-alignment-assessment.md；docs/design/product/writing-capability-assessment.md | 不明 |
| 创作流水线 | 风格与体验 | 生成作者人格模式并约束番茄味草稿 | docs/design/prompt/author-persona-mode-design.md；docs/design/prompt/p8-fanqie-flavor-draft-quality-design.md | 仅有壳 |
| 创作流水线 | 风格与体验 | 实时渲染 AI 输出 | docs/design/features/ai-output-live-render-design.md | 仅有壳 |
| 创作流水线 | 风格与体验 | 中断并续跑批量创作 | docs/design/features/batch-interrupt-resume-design.md；docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md | 半成品 |

**本域条目数：43**

## 数据与资产

| 域 | 模块 | 能力 | 依据文件（相对路径） | 初判状态 |
|---|---|---|---|---|
| 数据与资产 | 项目空间 | 建立项目根目录与会话租约 | docs/adr/0001-project-root-and-session-lease.md | 仅有壳 |
| 数据与资产 | 项目空间 | 按工作区隔离小说库存储 | docs/adr/0010-dsh-plugin-per-workspace-novel-store.md；.batch/night/cards/p52-projects-research.md | 仅有壳 |
| 数据与资产 | 人物数据 | 以结构化人物名单作为事实源 | docs/adr/0007-structured-character-roster-fact-source.md | 仅有壳 |
| 数据与资产 | 章节生命周期 | 可恢复删除定稿章节并留删除回执 | docs/adr/0011-recoverable-finalized-chapter-deletion.md；docs/adr/0026-deletion-receipt-records-its-intent.md；docs/handoffs/2026-10-30-invalidation-and-deletion-baseline.md | 半成品 |
| 数据与资产 | 章节生命周期 | 回退定稿或任意章节并保留稿件 | docs/adr/0021-revert-finalization-keeps-the-manuscript.md；docs/adr/0023-revert-any-chapter-with-explicit-staleness.md | 半成品 |
| 数据与资产 | 失效传播 | 计算上游版本并失效派生数据 | docs/design/architecture/upstream-version-and-derived-invalidation-design.md；docs/design/architecture/upstream-invalidation-phase2-source-ref-and-read-gates.md；docs/design/architecture/upstream-invalidation-phase3-plan-and-ui.md | 半成品 |
| 数据与资产 | 派生视图 | 投影定稿连续性与叙事线 | docs/adr/0013-finalized-continuity-projection-and-narrative-threads.md | 仅有壳 |
| 数据与资产 | 派生视图 | 维护情节树派生快照 | docs/adr/0014-plot-tree-is-a-derived-snapshot.md | 仅有壳 |
| 数据与资产 | 派生视图 | 维护源绑定角色状态与连续性 | docs/adr/0017-source-bound-character-state-and-continuity.md | 仅有壳 |
| 数据与资产 | 项目空间 | 版本化项目向量空间 | docs/adr/0004-versioned-project-embedding-space.md | 仅有壳 |
| 数据与资产 | 契约登记 | 登记模块归属、V3 领域契约与动作接缝 | docs/adr/0018-module-ownership.md；docs/adr/0018-program-v3-domain-contracts.md；docs/adr/0008-agent-actions-use-domain-fact-and-workflow-seams.md | 仅有壳 |
| 数据与资产 | 导入迁移 | 导入旧项目拷贝 | docs/adr/0020-legacy-project-copy-import.md；docs/research/novel-quality-modernization/s06d-legacy-roster-evidence.md；.batch/night/cards/p22c-legacy-readonly.md | 半成品 |
| 数据与资产 | 契约登记 | 定义存储、全局数据与模式泳道契约 | docs/research/novel-quality-modernization/s01-storage-contract.json；docs/research/novel-quality-modernization/s03-global-data-contract.md；docs/research/novel-quality-modernization/s05-schema-lane-evidence.md | 半成品 |
| 数据与资产 | 资产盘点 | 盘点仓库资产并给出处置结论 | docs/research/novel-quality-modernization/asset-disposition.json；docs/research/novel-quality-modernization/inventory.json；docs/research/novel-quality-modernization/inventory-finalize.py | 半成品 |
| 数据与资产 | 资产盘点 | 比对捐赠方差异并维护规格索引 | docs/research/novel-quality-modernization/donor-delta.json；docs/research/novel-quality-modernization/current-spec-index.md；docs/research/novel-quality-modernization/feature-evidence-levels.json | 半成品 |
| 数据与资产 | 配置 | 登记配置注册表写入路径 | docs/design/product/config-registry-write-paths-assessment.md | 不明 |
| 数据与资产 | 配置 | 管理用户设置包 | docs/design/features/user-settings-package-design.md | 仅有壳 |
| 数据与资产 | 台账 | 重写 D 段台账 | docs/plans/2026-11-09-d-segment-ledger-rewrite-proposal.md | 仅有壳 |

**本域条目数：18**

## 质量门禁

| 域 | 模块 | 能力 | 依据文件（相对路径） | 初判状态 |
|---|---|---|---|---|
| 质量门禁 | 一致性校验 | 守住一致性校验的序号声明 | docs/design/review/consistency-check-ordinal-claim-guard-design.md | 仅有壳 |
| 质量门禁 | 一致性校验 | 产出连续性发现 | docs/design/review/p2-1-continuity-findings-design.md；docs/handoffs/archive/2026-10-24-p2-1-findings-stage1-handoff.md | 半成品 |
| 质量门禁 | 评审 | 出具评审架构声明并去重评审材料 | docs/design/review/c1-review-architecture-declaration-design.md；docs/design/review/p7-review-material-dedup-design.md；.batch/night/cards/edit-3ch-review-brief.md | 仅有壳 |
| 质量门禁 | 门禁执行 | 暴露门禁短路证据并提供门禁界面 | docs/design/product/d21-gate-shortcircuit-evidence-20260909.md；docs/design/product/d21-gate-ui-guide-20260909.md；docs/design/product/d21-fix-c-implementation-plan-20260909.md | 半成品 |
| 质量门禁 | 门禁执行 | 检查同情节重复 | docs/design/product/same-plot-check-20260909.md | 不明 |
| 质量门禁 | 文风测量 | 测量散文形态 | docs/design/product/prose-shape-measurement-design.md | 仅有壳 |
| 质量门禁 | 文风测量 | 量化并干预 AI 味（含重叠评估与样本对照） | docs/research/2026-11-04-ai-flavor-indicator-map.md；docs/research/2026-11-04-ai-flavor-measurement-and-intervention.md；docs/research/2026-11-12-less-ai-tone-overlap-assessment.md；docs/research/2026-10-27-ai-flavor-practice-notes-douban.md | 半成品 |
| 质量门禁 | 文风测量 | 跑连续性校准实验 | docs/experiments/continuity-calibration-round01.md；docs/experiments/continuity-calibration-round01-results.md | 半成品 |
| 质量门禁 | 阈值校准 | 校准复用覆盖率阈值 | docs/experiments/reuse-coverage-threshold-calibration-20260909.md | 不明 |
| 质量门禁 | 指标统计 | 统计动作数中位数并定位缺口 | .batch/night/cards/p48-median-actions.md；.batch/night/cards/p51-median-gap.md | 半成品 |
| 质量门禁 | 指标统计 | 统计编辑度量并出报表 | .batch/night/cards/p34-edit-count-feasibility.md；.batch/night/cards/p35-edit-metrics.md；.batch/night/cards/p36-clear-stats.md；.batch/night/cards/p38-edit-stats-report.md | 半成品 |
| 质量门禁 | 规格校验 | 校验文学规格与写作约束 | .batch/night/cards/p46-spec-literary-checks.md；.batch/night/cards/p49-writing-constraints.md | 仅有壳 |
| 质量门禁 | 验收 | 评估验收缺陷并出实测验证清单 | docs/design/product/live-pipeline-acceptance-defects-assessment.md；docs/design/product/live-verification-checklist.md；docs/design/product/2026-11-07-batch-acceptance-plan.md；docs/agents/acceptance-gates.md | 半成品 |
| 质量门禁 | 质量治理 | 维护质量问题台账与质量协议 | docs/research/novel-quality-modernization/g01-issue-ledger.md；docs/research/novel-quality-modernization/quality-protocol.md；docs/research/novel-quality-modernization/protocol.json | 半成品 |
| 质量门禁 | 质量治理 | 执行质量现代化治理计划 | docs/plans/novel-quality-modernization/00-START-HERE.md；docs/plans/novel-quality-modernization/01-PLAN.md；docs/plans/novel-quality-modernization/04-EXECUTION-MATRIX.md | 仅有壳 |
| 质量门禁 | 调研 | 收集上游质量证据与阈值校准语料 | docs/research/2026-10-17-fanqie-draft-quality-evidence.md；docs/research/2026-10-25-threshold-calibration-corpus/README.md；docs/research/2026-10-25-threshold-calibration-corpus/corpus-candidates.md | 不明 |
| 质量门禁 | 调研 | 研究承接基础并吸收外部方案 | docs/research/2026-08-29-novel-continuity-foreshadowing-foundation.md；docs/research/2026-10-25-oh-story-absorption/assessment.md；docs/research/2026-10-30-moshu-competitor/assessment.md | 不明 |

**本域条目数：17**

## 发布与运营

| 域 | 模块 | 能力 | 依据文件（相对路径） | 初判状态 |
|---|---|---|---|---|
| 发布与运营 | 定稿发布 | 定稿提交并发布稿件 | docs/adr/0003-finalization-commit-and-manuscript-publication.md | 仅有壳 |
| 发布与运营 | 平台打包 | 通过 Windows 包资格校验 | docs/adr/0005-github-hosted-windows-package-qualification.md | 仅有壳 |
| 发布与运营 | 发布流水线 | 统一跨平台 GitHub 发布并执行三目标更新 | docs/adr/0006-unified-cross-platform-github-release.md；docs/adr/0016-three-target-release-and-platform-update-actions.md | 半成品 |
| 发布与运营 | 发布流水线 | 填 npm 发布字段并做版本 bump | .batch/night/cards/p16-version-bump.md；.batch/night/cards/npm-fields-finish.md；.batch/night/cards/npm-publish-fields.md | 半成品 |
| 发布与运营 | 发布流水线 | 同步版本文件清单 | .batch/night/org/version-files-inventory-1119.md；.batch/night/cards/CARD-1118-D-version-files.md | 半成品 |
| 发布与运营 | 文档发行 | 落 README 版本说明与安装指引 | .batch/night/cards/p12-readme-040.md；.batch/night/cards/p45-readme-050.md；.batch/night/cards/readme-install-rewrite.md；.batch/night/cards/p21-rollback-readme.md | 半成品 |
| 发布与运营 | 平台适配 | 适配番茄平台风格层并落位写作指引 | docs/design/prompt/p9-platform-style-layer-design.md；docs/fanqie-guidance-final.md；docs/fanqie-guidance-placement.md | 半成品 |
| 发布与运营 | 平台适配 | 界定平台体裁覆盖边界 | docs/research/2026-10-28-platform-genre-coverage-bounds.md；docs/product-domain.md | 不明 |
| 发布与运营 | 上游运营 | 跟踪上游仓库同步差异 | docs/upstream-sync-ledger.md；docs/handoffs/upstream-sync/2026-10-14-diff.md；docs/handoffs/upstream-sync/2026-10-14-diff-02.md | 半成品 |
| 发布与运营 | 交付运营 | 走交付流程并流转 issue | docs/agents/delivery.md；docs/agents/issue-tracker.md；docs/agents/triage-labels.md | 半成品 |
| 发布与运营 | 交付运营 | 规划 Q4 交付与作者下一步 | docs/design/product/2026-11-13-q4-delivery-plan.md；docs/design/product/2026-11-12-author-now-what-works.md | 仅有壳 |
| 发布与运营 | 夜间批次 | 夜间派卡并做会签裁定 | .batch/night/org/ruling-dispatch-v3-1117.md；.batch/night/org/ruling-dispatch-v4-1119.md；.batch/night/org/stage4-closecheck-1120.md；.batch/night/cards/_CARD-TEMPLATE.md | 半成品 |
| 发布与运营 | 夜间批次 | 维护夜间 backlog 与效率盘点 | .batch/night/org/BACKLOG.md；.batch/night/org/process-efficiency-1116.md | 半成品 |
| 发布与运营 | 夜间批次 | 留痕派活档位与授权 | .batch/night/org/ledger-append-1117-hy4flash-auth.md；.batch/night/org/close-reboot-hy4flash-sync-1117.md | 半成品 |

**本域条目数：14**

## 工具与基础设施

| 域 | 模块 | 能力 | 依据文件（相对路径） | 初判状态 |
|---|---|---|---|---|
| 工具与基础设施 | 外部 agent 通道 | 维护外部 agent 通道手册 | docs/agents/dsh-channel.md；docs/agents/doubao-channel.md；docs/agents/workbuddy-channel.md；docs/agents/copilot-channel.md；docs/agents/task-board-channel.md | 半成品 |
| 工具与基础设施 | 任务板 | 跨 harness 访问任务板 | docs/design/harness/cross-harness-task-board-access-design.md；docs/superpowers/plans/2026-11-03-dsh-task-board.md | 半成品 |
| 工具与基础设施 | 规则 | 登记规则注册表 | docs/agents/rule-registry.md | 半成品 |
| 工具与基础设施 | 协作 | 并行跑多工作树 | docs/agents/worktree-parallel.md | 半成品 |
| 工具与基础设施 | 文档治理 | 落文档放置章程并开 AGENTS.md 通道 | docs/adr/0024-document-placement-charter-and-agents-md.md；docs/adr/0025-track-agents-md-and-copilot-channel.md；docs/agents/documentation-charter.md；docs/agents/doc-placement-baseline.json | 半成品 |
| 工具与基础设施 | 运行控制 | 管理运行租约、中止与空闲守卫 | docs/design/features/d2-run-lease-abort-design.md；docs/design/features/idle-guards-wiring-inventory.md | 半成品 |
| 工具与基础设施 | 运行控制 | 监视文件变更并监听信号 | docs/design/harness/dsh-file-watch-plugin-design.md；.batch/night/cards/p40-drop-watch8.md；.batch/night/cards/signal-watch-setup.md | 半成品 |
| 工具与基础设施 | 通知 | 发系统通知与任务完成提醒 | docs/design/features/system-notification-design.md；docs/design/features/task-completion-notify-design.md | 仅有壳 |
| 工具与基础设施 | 客户端界面 | 出设置卡片与设置界面 | .batch/night/cards/p11-settings-card.md；.batch/night/cards/p19-settings-card-reslot.md；.batch/night/cards/p22b-settings-ui.md；docs/design/features/p1-2b-settings-period-authoring-guide.md | 半成品 |
| 工具与基础设施 | 客户端界面 | 注入客户端配置表单与会话 | .batch/night/cards/p17-client-inject-configforms.md；.batch/night/cards/p27-client-inject-sessions.md；.batch/night/cards/p14-settings-inject-mount.md；.batch/night/cards/p26-config-esm-race.md | 半成品 |
| 工具与基础设施 | 路径能力 | 探测目录与路径可用性 | .batch/night/cards/p29-dir-check.md；.batch/night/cards/p43-path-probe-api.md；.batch/night/cards/p44-dir-probe.md；.batch/night/cards/p54-fix2-dir-ownership.md | 半成品 |
| 工具与基础设施 | 中继 | 做中继寻址并修正投错 | .batch/night/cards/P54-requirement.md；.batch/night/cards/p54-fromto-inject.md；.batch/night/cards/p15-fix-relay-card-render.md；.batch/night/cards/p6-addressing.md | 半成品 |
| 工具与基础设施 | 中继 | 限制选择器数量并延后唤醒 | .batch/night/cards/p28-picker-limit.md；.batch/night/cards/wake-later.md；.batch/night/cards/wake-later-fix.md | 半成品 |
| 工具与基础设施 | 渲染 | 探测渲染能力与帧色 | .batch/night/cards/p42-renderer-capabilities.md；.batch/night/cards/p39-frame-color.md | 半成品 |
| 工具与基础设施 | 探针 | 观察模型探针配置 | docs/plans/llm-probe-observation-plan.md；.batch/night/cards/p19a-probe-row-config.md；.batch/night/cards/p25-describe-probe.md | 半成品 |
| 工具与基础设施 | 平台约定 | 遵守主题、语言、技能作用域与调用上限约定 | docs/adr/0009-preserve-explicit-dark-theme-intent.md；docs/adr/0012-project-writing-language-is-independent-from-ui-locale.md；docs/adr/0015-writing-skills-are-stage-scoped-guidance.md；docs/adr/0019-remove-real-call-hard-cap.md | 仅有壳 |
| 工具与基础设施 | 外部文件 | 走用户中介的外部文件能力 | docs/adr/0002-user-mediated-external-file-capabilities.md | 仅有壳 |
| 工具与基础设施 | 文档治理 | 修文档破链并持久化去重结果 | .batch/night/cards/TBD-doc-broken-links.md；.batch/night/cards/docs-merge.md；.batch/night/cards/p31-dedupe-persist.md；docs/design/harness/harness-and-docs-reorganization-plan.md | 半成品 |
| 工具与基础设施 | 仓库治理 | 落 PII 行并做预检、卫生豁免 | .batch/night/cards/CARD-1119-A-pii-line-landing.md；.batch/night/cards/CARD-1119-H-pii-preflight.md；.batch/night/cards/CARD-1119-E-hygiene-archive-exempt.md | 半成品 |
| 工具与基础设施 | 仓库治理 | 配钩子与协作、Git 工作流规则 | .batch/night/cards/CARD-1117-D-hooks.md；.batch/night/cards/CARD-1117-C-collab-rules.md；.batch/night/org/ruling-git-workflow-1117.md | 半成品 |
| 工具与基础设施 | 仓库治理 | 录入基线并定位根因 | .batch/night/cards/CARD-1117-B-baseline-intake.md；docs/handoffs/2026-11-12-full-baseline-and-root-causes.md | 半成品 |
| 工具与基础设施 | 仓库治理 | 关分叉 / 占位并清理三元组 | .batch/night/cards/CARD-1118-B-fork-close.md；.batch/night/cards/CARD-1118-C-placeholder-close.md；.batch/night/cards/CARD-1117-A-de-triplet.md | 半成品 |
| 工具与基础设施 | 台账 | 维护实现台账并做取件清理 | .batch/night/cards/wb-impl-ledger.md；.batch/night/cards/p8-take-and-cleanup.md；.batch/night/cards/p9-failed-take.md | 半成品 |
| 工具与基础设施 | 文档治理 | 维护开发文档与 README | docs/DEVELOPMENT.md；docs/README.md | 半成品 |
| 工具与基础设施 | 前端迁移 | 迁移前端并审计过渡状态 | docs/research/novel-quality-modernization/frontend-transition-audit-2026-09-22.md；docs/research/novel-quality-modernization/frontend-transition-plan.md；docs/research/novel-quality-modernization/frontend-transition-specs.md | 半成品 |

**本域条目数：24**

免费
今天 08:13

---

总条目数：118
不明条目数：10

分域实测条目数（脚本按行数复核，与豆包自报并列）：

| 域 | 脚本计数 | 豆包自报 |
|---|---|---|
| 创作流水线 | 44 | 43 |
| 数据与资产 | 18 | 18 |
| 质量门禁 | 17 | 17 |
| 发布与运营 | 14 | 14 |
| 工具与基础设施 | 25 | 24 |
| 合计 | 118 | 116 |
