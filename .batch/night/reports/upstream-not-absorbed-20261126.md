# 上游「不吸收」清单（2026-11-26）

- 出件：developer（只读评估；未改 `src/`、未 merge、未 cherry-pick、未 push）
- 来源：评估件 `.batch/night/reports/upstream-diff-eval-20261126.md` §四、机器清单 `upstream-diff-inventory.tsv`、基线 `.batch/night/reports/upstream-baseline-20261126.md`（`b52be88f`，上游 HEAD `f1d7f1d9`、分叉点 `549522d4`）
- 覆盖：**B 九簇 + C 五簇 + 非代码路径 324 条**（逐条见 §4）
- 判定口径：**「不吸收」＝有明确的不可吸收理由 ＋ 重估触发条件**。不写「暂不做」这类没有触发条件的句子；触发条件必须是可观测的事件（我方换引擎、上游抽出独立包、C1 落地等），不是「以后再说」。

## 0. 先纠一处数字（口径更正）

评估件 §二 写「非代码 315（A 285／M 30）」，本件按 `netdiff.tsv` 重算为 **324 条（A 287／M 36／D 1）**。
差 19 条＝**仓库根级文件**（`README*.md`、`pnpm-lock.yaml`、`package.json`、`.eslintrc.cjs`、`vitest.*.config.ts` 等）——前次筛选把「无目录前缀」的路径排除了，属筛选规则漏项，不是数据变化。
以本件 **324** 为准；评估件那行不追改（读数已入库、已验收），差额在此登记。

## 1. B 九簇（方向有价值、实现绑其路线 → 不吸收，只借思路）

| # | 簇 | 上游文件 | 值得借的 | 为什么不吸收（实现层） | 重估触发条件 |
|---|---|---|---|---|---|
| B1 | 模型能力探测 | `electron/services/model-discovery-service.ts` | 按 provider 解析 models URL；探到的上下文窗口与 `manual`/`learned` 来源分开标记 | 绑其 provider 注册表与 network-proxy；我方 provider 层没有对应注册面 | 我方把 provider 注册面收敛成统一接口时 |
| B2 | 生成用量口径 | `electron/llm/gemini-provider.ts` | `completionTokens` 含 thoughts 的统计口径；thinkingLevel adapter | adapter 绑其 reasoning 适配层，我方 provider 无 thinking 档位 | 我方接入 reasoning 模型并按档计费时 |
| B3 | 导入阶段机 | `electron/repositories/import-run-repository.ts` | 阶段可重入；缺料统计（作者推断／缺蓝图） | 81 个 hunk 与其阶段机同源；我方导入是另一套状态机 | 导入失败率成为瓶颈、需要缺料报表时 |
| B4 | 导入取消守卫 | `src/services/workflows/import-run-orchestrator.ts` | `stopIfCancelled`／`nextStage` 的守卫位置 | 与 B3 配套；单抄守卫会与我方取消模型打架（当前取消仍是裸 `Error`） | **C1 取消类型落地后**（`1630c44b`） |
| B5 | 全文检索 | `electron/vector-store.ts` | LanceDB 全文检索 ＋ commit 表能力探测 | 绑其 LanceDB 版本与 embedding space 注册表；我方向量层路线未定 | 我方向量层迁到 LanceDB 或等价引擎 |
| B6 | 知识库召回 | `electron/knowledge-base.ts` | rerank ＋ 全文召回 ＋ 来源门 | 与其 rerank 模型配置绑死，我方无 rerank 端点配置面 | 我方知识库要做 rerank 且 provider 有 rerank 端点 |
| B7 | 知识库 IPC | `electron/controllers/kb-controller.ts` | embedding／rerank 配置的 IPC 暴露形状 | IPC 契约与我方不同；与 B6 同批才有意义 | 与 B6 同批重估 |
| B8 | 批注式生成 | `electron/services/editor-inline-generation.ts` | 多批注 ＋ 上下文裁剪表 | 需整套 UI／IPC，属新功能不是修 bug；我方编辑器交互不同 | 编辑器批注进入产品范围时 |
| B9 | Skill 附件包 | `src/shared/writing-skills.ts` | Skill 带附件（bundle／安装清单） | 绑其安装清单格式，我方 Skill 面无此契约 | 我方 Skill 面要做附件分发时 |

## 2. C 五簇（冲突／被取代 → 不吸收）

| # | 簇 | 上游改动 | 为什么不吸收 | 重估触发条件 |
|---|---|---|---|---|
| C1 | 模型路由 store | `src/stores/llm-store.ts`：按 stage 路由模型、加 rerank 字段、删流式回调与 `activeRequests` | 我方 store 已被自有改写路线取代；照搬会把流式生成链打断 | 我方放弃自有 store，或上游把 stage 路由抽成独立包 |
| C2 | 草稿索引 | `src/services/draft-index.ts`：上游删 139 行能力 | 我方仍在使用该模块，删了就是拆我方功能 | 我方也决定撤掉 draft-index |
| C3 | legacy roster 修复 | `src/services/workflows/commands/legacy-character-roster-repair.command.ts`：−272 行，改用 model-routing／`pinWorkflowModel` | 依赖上游 workflow-main-generation 与 model-routing；我方命令层不同且无该修复入口 | 我方出现 legacy 角色名册修复需求 |
| C4 | 视觉层换壳 | `src/components/**`（161 个上游改写/删除文件） | 上游整层换成 RD 外壳；我方保留自有组件与皮肤体系 | 我方换壳到 RD 外壳 |
| C5 | 依赖整体上移 | `pnpm-lock.yaml` 及各包版本 | 加依赖须另立卡并评估 better-sqlite3／Electron ABI（worktree 只准单测的口径下切 ABI 会打断所有槽位） | 某项能力确需上游某个依赖时，逐包评估 |

## 3. 非代码 324 条（逐条见 §4）

| 簇 | 条数 | 状态分布 |
|---|---|---|
| 上游设计文档（RD 换壳期） | 160 | A 156／M 4 |
| 上游 verify 技能与 issue 场景库 | 65 | A 64／M 1 |
| 上游设计稿图片资源 | 44 | A 44 |
| 仓库根级治理件 | 19 | A 4／M 15 |
| 上游架构决策记录 | 14 | A 10／M 4 |
| 上游发布说明与清单 | 9 | A 6／M 3 |
| 上游文档（其他） | 6 | A 2／M 4 |
| 上游 CI 三平台构建 | 5 | A 1／M 4 |
| 其他非代码路径 | 2 | D 1／M 1 |

**唯一「方法论值得借」的子集**：`.claude/skills/verify/references/issue-scenarios/`（65 条里的大半）——上游把每个 issue 号落成一个可复现场景文件，形成「issue → 场景 → 验收」资产。触发条件＝本组建场景化验收体系时，按 issue 号抄场景内容，不装它的技能运行时。

## 4. 附录：非代码路径逐条（324 条）

下面每行一条：上游路径｜A/M/D｜所属簇｜为什么不吸收（逐行短理由，簇级完整理由见 §3 上表）｜重估触发条件。

| 上游路径 | 状态 | 簇 | 为什么不吸收 | 重估触发条件 |
|---|---|---|---|---|
| `.claude/skills/verify/SKILL.md` | M | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/baseline-scenarios.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/driver.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/a11.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/adock.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/arch.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/bpg.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/bs702.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/c6.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/c7.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/c8a.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/c8b.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/cch.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/chapter.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/contrast.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/ctxfetch.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/d77.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/e763.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/errl2.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/errl3.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/errl6.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/errl6b.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/errnet.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/ext653.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/f484.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/f491.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/f512.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/f571.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/f593.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/f685.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/fq.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/fspeed.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i607.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i608.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i626.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i631.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i668.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i676.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i686.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i686d.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/i764.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/import-infer.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/ja725.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/l1b.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/l4conn.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/odio.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/oro.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/perf702.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/pp702.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/prop-rel.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/r3.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/r702.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/rbk.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/reopen.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/ru702.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/sealed702.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/setdel.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/sm517.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/st504.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/trash.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/issue-scenarios/uxr.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/measurement.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/rd-review-scenarios.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.claude/skills/verify/references/rd-stage-scenarios.md` | A | 上游 verify 技能与 issue 场景库 | 绑 Claude 侧工作流；场景库只借方法论 | 建场景化验收体系时按 issue 号抄场景 |
| `.coderabbit.yaml` | A | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `.eslintrc.cjs` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `.gitattributes` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `.github/workflows/macos-arm64-cloud-build.yml` | M | 上游 CI 三平台构建 | 云端打包会破坏我方 worktree 只准单测的口径 | 真做云端多平台构建时，按 job 抄结构 |
| `.github/workflows/macos-daily-tests.yml` | A | 上游 CI 三平台构建 | 云端打包会破坏我方 worktree 只准单测的口径 | 真做云端多平台构建时，按 job 抄结构 |
| `.github/workflows/pr-ci.yml` | M | 上游 CI 三平台构建 | 云端打包会破坏我方 worktree 只准单测的口径 | 真做云端多平台构建时，按 job 抄结构 |
| `.github/workflows/windows-cloud-build-test.yml` | M | 上游 CI 三平台构建 | 云端打包会破坏我方 worktree 只准单测的口径 | 真做云端多平台构建时，按 job 抄结构 |
| `.github/workflows/windows-in-app-update-e2e.yml` | M | 上游 CI 三平台构建 | 云端打包会破坏我方 worktree 只准单测的口径 | 真做云端多平台构建时，按 job 抄结构 |
| `.gitignore` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `.release/notes/v1.3.0.md` | A | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/notes/v1.3.1.md` | A | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/notes/v1.3.2.md` | A | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/notes/v1.4.0.md` | A | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/notes/v1.5.0.md` | A | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/notes/v1.5.3.md` | A | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/scripts/github-desktop-promotion.mjs` | M | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/scripts/project-legacy-qualification.mjs` | M | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.release/scripts/validate-release-profile.mjs` | M | 上游发布说明与清单 | 绑其 NSIS 安装器与产物名 | 发版线统一或对齐变更日志格式时 |
| `.storybook/preview.tsx` | M | 其他非代码路径 | 不参与产品能力（仓库卫生/杂项） | 成为唯一规格或唯一实现时 |
| `CONTRIBUTING.md` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `README.md` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `README_en.md` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `README_ja.md` | A | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `README_zh.md` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `docs/README.md` | M | 上游文档（其他） | 随代码走的说明，我方文档体系独立 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/adr/0003-finalization-commit-and-manuscript-publication.md` | M | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0011-recoverable-finalized-chapter-deletion.md` | M | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0017-source-bound-character-state-and-continuity.md` | M | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0021-stage-flow-replaces-ide-shell.md` | M | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0022-product-name-shutong-keeps-legacy-identity.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0023-provider-owns-context-capacity-no-token-preflight.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0024-replace-finalized-chapter-via-reopened-draft.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0025-chapter-trash-soft-delete-and-restore.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0026-optional-material-budget-follows-model-window.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0027-context-window-resolved-in-one-place.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0028-execution-follows-the-resolved-context-window.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0029-generation-run-state-and-verification-scope.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0030-generation-ledger-admission.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/adr/0031-review-proof-v2.md` | A | 上游架构决策记录 | 决策上下文不同，且 ADR 编号/结论与我方冲突 | 同题决策要引先例（只引结论，不搬文件） |
| `docs/assets/brand/pagekin-icon-256.png` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/brand/pagekin-icon-512.png` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/brand/pagekin-icon.svg` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/brand/pagekin-mark-blue.svg` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/brand/pagekin-mark-ink.svg` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/brand/pagekin-mark-paper.svg` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/brand/social-preview.png` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/en/01-library.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/en/02-chapter.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/en/03-timeline.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/en/04-check.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/en/05-annotate.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/en/06-run.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/zh/01-library.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/zh/02-chapter.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/zh/03-timeline.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/zh/04-check.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/zh/05-annotate.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/hero/zh/06-run.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/pagekin-1.5.3-timeline-zh.gif` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/pagekin-hero-en.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/pagekin-hero-zh.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/annotate.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/architecture.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/blueprint.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/cast.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/chapter-dark.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/chapter.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/check.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/library.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/run.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/timeline.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/en/trash.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/annotate.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/architecture.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/blueprint.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/cast.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/chapter-dark.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/chapter.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/check.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/library.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/run.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/timeline.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/assets/readme/screens/zh/trash.webp` | A | 上游设计稿图片资源 | 绑其皮肤与发布页素材，品牌资产不可复用 | 换 UI 皮肤需其原始素材时 |
| `docs/brand/README.md` | A | 上游文档（其他） | 随代码走的说明，我方文档体系独立 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/design-system.md` | M | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/feature-matrix.md` | M | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/ia.md` | M | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/plan.md` | M | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-arch-clear.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-arch-generate.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-arch-rewrite.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-architecture.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-backup.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint-batch.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint-overwrite.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint-recovery.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-candidate-page.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-card-import.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-cast.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-delete.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-draft.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-finalize.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-focus.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-merge.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-review.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-selection.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-cleanup-retry.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-clear.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-exit-confirm.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-export.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-first-model.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-focus-search.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-graph.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-history-revert.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-history.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-import-menu.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-import-novel.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-index-model.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-kb-finalized.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-kb.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-lazy-retry.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-current.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-delete.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-empty.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-preview.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-remove.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-new-work.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-palette.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-plot-clear.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-plot.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-preflight.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-recheck.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-batch.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-cancel.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-confirm.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-diagnostics.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-discard.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-failure.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-live.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-save.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-settings-appearance.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-settings-model.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-setup-fill.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-setup-save-fail.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-setup.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-shell.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-tab-menu.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-tabs.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-thread-delete.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-threads.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-toasts.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-update.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-write-popover.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-fresh.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-matrix.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-migrate-galaxy.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-widths.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-backup.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-empty.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-preview.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-save-failed.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings-leave-library.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings-leave-spine.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings-leave.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-setup-720.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-setup.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-char.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-confirm.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-partial.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-rewrite.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review-rd7-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review-rd7-popover.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review-rd7-preflight.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-draft.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-finalize.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-focus.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-merge.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-review.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-sheets.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review-history-diff.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review-knowledge.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review-plot.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-alert-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-alert-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-buttons-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-buttons-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-clearing-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-clearing-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-danger-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-danger-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-dialog-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-dialog-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-panel-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-panel-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-library-starts-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-run-notice-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-run-notice-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-split-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-error-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-error-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-flood-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-flood-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-pinned-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-pinned-light.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review.mp4` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X1-review-cleanup-retry.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X1-review-import-settings.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X1-review-waive-all.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-cast-paste.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-history-loading.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-index-model.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-landing-blueprint.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-landing-no-blueprint.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-library-back.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-outline-range.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-recheck.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-focus-active-tab.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-focus-segmented-tab-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-focus-spine-current.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-hover-focus-start.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-import-dialog-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-import-dialog.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-inline-confirm-focus.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-long-title-before.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-long-title.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-menu-focus.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-plan-ring-dark.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-plan-ring.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-popover-1024x640.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-popover-1280x720-before.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-popover-1280x720.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-toast-resize.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-toast-top.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-toast-wheel.png` | A | 上游设计文档（RD 换壳期） | 随其 RD 视觉/交互层走，我方组件与皮肤不同 | 重启 RD 换壳，或需对齐某篇交互契约 |
| `docs/long-form-fiction-workflow.zh.md` | A | 上游文档（其他） | 随代码走的说明，我方文档体系独立 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/product-domain.md` | M | 上游文档（其他） | 随代码走的说明，我方文档体系独立 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/readme-visuals/hero-data.js` | M | 上游文档（其他） | 随代码走的说明，我方文档体系独立 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/readme-visuals/visual-manifest.json` | M | 上游文档（其他） | 随代码走的说明，我方文档体系独立 | 其某篇成为某能力唯一规格时按篇取 |
| `electron-builder.json5` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `index.html` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `llms.txt` | A | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `package.json` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `pnpm-lock.yaml` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `pnpm-workspace.yaml` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `public/skins/anime-night.webp` | D | 其他非代码路径 | 不参与产品能力（仓库卫生/杂项） | 成为唯一规格或唯一实现时 |
| `vite.config.ts` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `vitest.browser.config.ts` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `vitest.guards.config.ts` | A | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |
| `vitest.settings-browser.config.ts` | M | 仓库根级治理件 | 整套替换才有意义（README/锁文件/CI 入口） | 引入其某根级配置项时逐项比对字段 |

## 5. 自查与口径

1. **324 条的来源**：`C:\tmp\upstream-diff\netdiff.tsv`（基线 `549522d4` 与 master `32f4f7f8` 两棵 tar 快照逐文件 sha1 比对，1,857 行净变更）中，取「顶层目录不属于 `src`／`electron`／`scripts`／`test`／`build`／`plugins`」的全部路径 = 324 条（A 287／M 36／D 1）。生成命令：`python C:\tmp\upstream-diff\gen_not_absorbed.py`（脚本只读 tsv、只写 `C:\tmp\upstream-diff\`）。
2. **簇级判定 vs 逐条判定**：B／C 两组是**逐文件读过 diff 后**定性（见评估件 §四）；非代码 324 条是**按目录前缀给簇规则**，逐条列的是「该簇的不吸收理由 + 该簇的触发条件」——我没有逐篇读 160 篇 `docs/design` 与 44 个图片资源，这一点在此写明，不假装逐条读过。
3. **与本组课题的边界**：`docs/research/**` 属上游研究，与本组 RES 课题不同源；本件不引用其结论。
4. **未做的**：未评估上游 `.github/workflows` 的可执行性（会破坏 worktree 单测口径，已按 C 类处理）；未逐个依赖核 ABI。
