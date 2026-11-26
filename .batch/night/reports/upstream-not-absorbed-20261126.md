# 上游「不吸收」清单（重评版 · 2026-11-26 23:5x）

- 出件：developer（只读分析；未改 `src/`／`electron/`、未 commit 生产码、未 push）
- 本版性质：**按主人 11-26 23:17 的新判据整篇重评**，替换同日 22:0x 那版（旧版判据已被否，不再作为依据）
- 输入：派单件 `.batch/night/staging/upstream-reabsorb-20261126.md`（57 行）、评估件 `.batch/night/reports/upstream-diff-eval-20261126.md`（`50e7c23a`）、基线 `.batch/night/reports/upstream-baseline-20261126.md`（`b52be88f`）、机器清单 `upstream-diff-inventory.tsv`
- 配套件：**`upstream-absorb-candidates-20261126.md`**（新增·吸收候选包＋排序＋起卡顺序）
- 口径补件：`.batch/night/staging/upstream-reabsorb-addendum-20261126.md`（33 行／3,372 B／`9f82e1c9…dbac`，11-26 23:28；主人 C2／C3／C5 三条裁定与件头两栏口径，与本件冲突处**以补件为准**）

## 0. 新判据（替换旧口径）

1. **独立取舍凭证**：判「不吸收」必须给出我方已在此领域做过独立取舍的凭证——文件路径 ＋ 我方提交号；区间读数命令原文为
   `git rev-list --count 549522d4..HEAD -- <path>` 与 `git rev-list --count 549522d4..upstream/master -- <path>`，
   并附至少一条 `git log --oneline 549522d4..HEAD -- <path>`。拿不出凭证 ⇒ **不得判「不吸收」**，只能进「吸收候选」或「新功能立项评估」。
2. **我方未动 ≠ 不吸收**：「我方 0–1 笔」是吸收的**利好条件**；「我方 25 笔 vs 上游 11 笔」也**不许假定上游先进**，先做内容比对再定谁更先进（B3 本版做了比对，见 §1.2）。
3. **C 类按产品意义定**：只答「这功能对产品要不要」，冲突面／实现差异只作代价说明，不作否决理由。
4. **只用读数说话**：一律用区间提交数；以定性描述替代读数即不合格（三类禁用说辞见派单件 §0 第 4 条原文，本件零出现）。
5. **两栏口径（补件 §2）**：「不吸收」**只保留「我方已独立取舍」一类**，且必须给「路径 ＋ 我方 sha」证明是主动分叉；其余四类——我方没动过的、我方动过但只是适配的、上游砍掉而我方在用的、上游新功能要立项的——**全部转 `upstream-absorb-candidates-20261126.md`**，本件不再留。

### 0.1 口径更正（我实测，影响全篇读数怎么读）

- **真实共同祖先不是 `549522d4`**：`git merge-base HEAD upstream/master` = **`fc576e08`（2026-08-16「chore(release): prepare v0.8.4 reliability release」）**，`549522d4` 是 10-14 的**上游快照**，不是我方祖先（它只是我方 `upstream-baseline` 追平的那个点）。
- 因此 `549522d4..HEAD` 计的是「我方自 08-16 真实分叉以来的全部改动」——这正是我们要的「我方动过多少」，口径成立；但它**不是**「10-14 之后的改动」。
- 由此产生一个**已知边界**：上游 08-16→10-14 之间约 `5,248 − 4,348 ≈ 900` 笔既不在我方树里、也不在基线那份 4,355 增量里。**真实缺口 5,248 笔 > 基线评的 4,355 笔**。本件仍按已验收的基线范围评（派单件口径），这条差额在此登记，不擅自扩面。
- 这条边界直接解释一件事实：**上游 `src/components/stage`、`run` 两套外壳从未到过我方树**。stage 首个提交是上游 `268456559`（2026-10-12 10:41「fix(stage): RD-3 新外壳包上渲染出错兜底…」），我方 08-16 已分叉 ⇒ 我方不是「拆掉了 stage」，也不是「选择不换壳」，而是**压根没拿到过**。C4 的定性据此重写（§1.9）。

## 1. 十项改判（逐条带凭证）

### 1.1 B1＋B2 合簇 → **吸收候选**

| 项 | 读数 |
|---|---|
| B1 `electron/services/model-discovery-service.ts` | 我方 **4** ／ 上游 **9** |
| B2 `electron/llm`（整目录） | 我方 **19** ／ 上游 **45** |

我方 19 笔（`git log --oneline --no-merges 549522d4..HEAD -- electron/llm`）按主题分四类：

- **模型准入与推理档位（6）**：`6492ef867` 收窄 Qwen3.8 原生生成、`ed654c2f2` 去掉准入白名单并纠正兼容参数、`c9194a678` Qwen 思考预算分档映射、`f5e12e921` SiliconFlow V4 Flash 显式推理、`87a55f662` 统一 Pro 资格登记、`124fb2368` bounded GLM 审稿条件。
- **订阅网关协议头（3）**：`b5a5ce771`／`a73877971` 只对生成会话发 opencode Go 会话头、`3248fc975` 修 PR230 校验缺陷。
- **诊断与流恢复（2）**：`9177140f1` 补齐生成失败诊断日志（此前错误被五层静默降级）、`2aa6d2a85` 保留流诊断并区分中断恢复。
- **跨域笔（8）**：`ae91d8e09`（大纲前缀预算）、`a47d441a5`、`7b576ca36`、`afeb3954d`、`eef413c3b`、`c4c3b5970`、`1ae38336e` 等，改的是周边能力顺手带到 `electron/llm`。

上游 45 笔的主干是：网络失败分因 `674273e1d`、从服务商超长报错里解析真实窗口 `c3994fbfb`、上游拒收 `max_tokens` 时换字段重发一次 `6f564670b`／`a4d32777b`／`39399fcf0`（含「值不被支持时**不**换字段」的边界 `0a85913fb`／`1e5ceb0bd`）、Anthropic 用量计入缓存写入与命中 `bc4a17ead`、自动档关思考的推理档映射 `1e75ccfe8`、Claude 家族拒绝采样参数 `d95a7e940`、上下文耗尽按截断处理 `f6ba9e5e3`。

**吸收什么（函数级）**：①`c3994fbfb` 的「超长报错 → 真实上下文窗口」解析，落我方 `src/services/generation/prompt-budget-failure.ts` 的 `provider-context` 分类（该分类我们已有，缺的是从报错文本取窗口）；②`1e75ccfe8` 的「作者显式选档才发推理参数、自动档映射 off」策略，落我方 provider 的 reasoning 映射；③`bc4a17ead` 的 Anthropic cache 用量归集，落我方 usage 记账。
**按我方接口的适配点**：我方准入在各自 provider 内、没有 stage 路由 store，适配时只加「能力探测 + 参数映射」两处，不引入其 model-routing。
**代价**：M（3 处、含 1 处跨 IPC usage 字段）。**前置**：无（B1 与 B2 合一张卡）。

### 1.2 B3 → **拆两半：B3a 吸收候选 ／ B3b 不吸收（我方已独立取舍）**

先做内容比对（派单件要求），结论：**两侧不是同一件事，不存在「谁更先进」的整体判断**。

- 我方 25 笔（`git log --oneline --no-merges 549522d4..HEAD -- electron/repositories/import-run-repository.ts`）全部围绕**可恢复导入**：`573434bbd` 可续引用导入、`5e6a27f2e`／`596e4f6ce` 围栏可续状态（#152）、`660fc81f8` 脱重增量来源、`8f5c79672` 长效应围栏＋KB 写串行、`3f86ea216` 安全根与效应账本校验、`75c907af9` 持久化可续解析、`2de4459c5` 知识效应绑持久权威、`a07697101` 围栏持久恢复权威、`bd6c70ebe` 重叠来源运行串行、`d59943b25` 跨恢复保稳定来源、`593536015` 只恢复未完成解析来源、`4acafa6e7` 让解析恢复可操作、`2a0b0119b`／`defc8869b`／`2e828a7cb` 收紧恢复边界、`b7ef05096` 安全续跑已提交效应、`34abea552` 按运行语言本地化重叠恢复等。
- 上游 11 笔改的是**作者原稿反推三阶段**与运行索引：`057afa828` 反推可跑全局／文风／蓝图三阶段、`ce04e4dab` 反推勾选冻结成导入账本行、`3b4b08f46` 进度分母不含已有蓝图章、`b594818f2` 提交事务里重读再补缺蓝图章、`2d7a6f03d` 导入/Agent/可续批次/图谱事件键改从运行索引取候选、`59a07f06b` 只按主键或根读绑定、`d4fd4119b` 删中间章后全书照常可写、`a6dc0aebd` 已取消请求报取消码、`017c1efeb` 轮 1 修复、`878313f1d` 导入主进程报错改抛错误码、`a1261f620` 删复述注释。

**实测缺口（QA M1 更正，我复算一致；原写「命中 0、没有阶段机」是错的）**：我方**有**阶段机，只是**静态两份**。
- `grep -rlE 'importStagesFor|ImportRunStage' src electron` → **8 个文件**：`electron/controllers/db-controller.ts`、`electron/migrations/m04-import-effect-ledger.ts`、`electron/repositories/import-run-repository.ts`、`src/services/workflows/__tests__/import-run-orchestrator.test.ts`、`src/services/workflows/import-run-orchestrator.ts`、`src/services/workflows/import-workflow.ts`、`src/shared/import-run.ts`、`src/shared/ipc-channels.ts`。
- 我方 `src/shared/import-run.ts:22-32` 是 **11 值** `ImportRunStage` 枚举（含 `author-commit`／`author-publish`／`author-postprocess`）；`src/services/workflows/import-run-orchestrator.ts:126` `REFERENCE_STAGES` 六阶段、`:127-129` `AUTHOR_STAGES` 五阶段、`:135` `stagesFor(run)` 按 `purpose` **二选一静态返回**、`:139` `stageIndex` 依据同一函数。
- 全仓 `importStagesFor` = **0**；上游把它放在 `src/shared/import-run.ts:46-49`，是**三份计划表**（`reference`／`author`／`authorWithInference`），`authorWithInference` 把 `global → style → blueprints` 插在 `author-postprocess` 之后（8 阶段），入参多一个 `authorInference?: boolean`，取值来自运行行上冻结的反推选项（仓库侧 `readAuthorInference(row.id)`）。
⇒ **真正缺的只有一件**：「按 `purpose` ＋ `authorInference` 派生阶段计划」——即第三份计划表 ＋ 反推选项落库/读回。**不是**「没有阶段机」。

- **B3a（吸收候选）**：第三份计划表 `authorWithInference` ＋ `authorInference` 冻结字段落库与读回 ＋ 运行索引候选查找（`2d7a6f03d`）＋ 删中间章后可写（`d4fd4119b`）。代价 **M**（**原估 L 作废**：不新造阶段机，接入点是我方 `import-run-orchestrator.ts:135` 的 `stagesFor` 换成共享 `importStagesFor`，两份现有计划表逐字不动；另加一列 run 级 flag）。前置：无，但先出一页方案（flag 落库形态＋迁移列＋`purpose='author-manuscript'` 下两表的选择时机）。
- **B3b（不吸收，凭证）**：我方 `electron/repositories/import-run-repository.ts` 区间 **25 笔**、`git log` 见上，可恢复导入与效应围栏是我方自建能力，上游没有同等物（上游最接近的只有 `a6dc0aebd` 取消码）⇒ 该半**不吸收**，凭证充分。

### 1.3 B4 → **吸收候选（前置两条）**

`src/services/workflows/import-run-orchestrator.ts` 我方 **10** ／ 上游 **21**。上游主力是阶段机守卫（`stopIfCancelled`／`nextStage`／`stageIndex`）。
**前置**：①取消卡 `1630c44b`（`WorkflowCancelledError`＋`isWorkflowCancellation` 落地）②B3a 的第三份计划表（守卫要挂在阶段序列上；我方现有两份表已有 `stageIndex`，缺的是 `authorWithInference` 那条序列）。
**代价**：S/M。**吸收什么**：守卫位置与「阶段推进前先判取消」的顺序，不搬其阶段枚举。

### 1.4 B5 → **吸收候选（方向已定：向量层就走 LanceDB）**

`electron/vector-store.ts` 我方 **15** ／ 上游 **14**。我方**已经在 `@lancedb/lancedb` 0.22.3 上**（`package.json` 依赖，22 个文件引用），缺的是检索层：
- 我方 **无** `src/shared/full-text-search.ts`（`Test-Path` = False），`fullTextTerms`／`rankFullText` 全仓命中 **0**；上游该文件已提供 `fullTextTerms`、`fullTextFilter`、`rankFullText`、`firstOfEach`，`electron/vector-store.ts:1460-1468` 用它做「取词 → 过滤 → 排序」。
- 上游还有 `cc745da95` LanceDB 连接收成 `openLanceDatabase` 单入口并钉表 2.0 格式、`c4073efd8` 生成入口截断前跨入口去重、`d69cc3983` 语料规模只数可用资料、`06d634da4` 中文按相邻二元组取词＋BM25 排序。
**吸收什么**：`src/shared/full-text-search.ts` 整件（按我方命名与导出风格重写）＋ `openLanceDatabase` 单入口 ＋ 中文二元组取词。
**适配点**：我方 `vector-store.ts` 的 `connectionPool`（`:179`）与 `lancedb` 目录（`:202`）已在，改成单入口只动一处；BM25 排序结果为只读候选，不改写入路径。
**代价**：M（新文件 1＋改动 2 处＋单测）。**前置**：无。

### 1.5 B6＋B7 合簇 → **吸收候选（前置 B5）**

`electron/knowledge-base.ts` 我方 **13** ／ 上游 **13**；`electron/controllers/kb-controller.ts` 我方 **10** ／ 上游 **26**。
我方**有** `electron/services/knowledge-source-gate.ts`（与上游同 sha `cfd026dc…`，是共同历史、不是我们的取舍）；我方**无** `electron/rerank.ts`、`src/shared/rerank-config.ts`、`src/shared/knowledge-ranking.ts`（`Test-Path` 全 False），`rerank|Rerank` 全仓命中 **0**。
上游该簇提供：`withKnowledgeSourceGate`（`:52`）＋ `rankPassages`（`:53`）＋ `RerankConfig`（`:54`）＋ `RERANK_CANDIDATE_COUNT`／`WRITING_KNOWLEDGE_COUNT`（`:55`）。
**吸收什么**：候选池常量＋`rankPassages` 重排（含 `kind:'none'` 的 not-configured 降级路径 `:111`）＋ KB 的 embedding/rerank 配置 IPC 形状。
**适配点**：我方 KB 服务接口与 `src/shared/ipc-channels.ts` 通道表；重排只在召回后，不碰导入写入。
**代价**：M。**前置**：B5（全文召回先有候选）＋ provider 侧 rerank 端点（我方现在没有 rerank 能力，需产品确认要不要）。

### 1.6 B8 → **新功能立项评估（不直接吸收）**

`electron/services/editor-inline-generation.ts` 我方 **1**（`80fcc7666`「feat: persist agent import and editor generation recovery」）／上游 **18**。
产品意义：编辑器内联批注生成（多批注 + 上下文裁剪）是**新交互能力**，不是修 bug。立项评估要点：UI 契约（批注锚点）、IPC（生成请求带批注范围）、成本（每次批注一次模型调用）、与现有生成链的关系。
**代价**：L。**前置**：编辑器批注进入产品范围（产品经理需求 → `prompt-clause-admission` 三问）。

### 1.7 B9 → **吸收候选**

`src/shared/writing-skills.ts` 我方 **1** ／ 上游 **11**。
上游 11 笔全在「Skill 引用文件解析」：`12c2af103` 把被引参考文件并入 skill prompt、`8bdceeea3` 平相对链接兼容并列出、`750f5bbb8` 角括号链接不阻塞、`a90342cad` 根 SKILL.md 不合并、按大小写不重复、`1320d8910` 安装后只从 install manifest 读引用、`d9c5461e9` 先写 bundle manifest 且保目录名、`67e0b1020` 按解析到的文件去重并从 skill 根读 `${SKILL_DIR}`、`0019b2b34` 显式 `./` 保持本地、`fc668cb90` 地址报错按界面语言、`dc7e2e8b4` 注释收紧。
**吸收什么**：引用去重键（解析后路径，不是字面量）＋ install manifest 优先规则 ＋ 角括号链接不阻塞。
**适配点**：我方 `writing-skills.ts` 现有 1 笔改动面小，按我方类型与错误码重写。
**代价**：S/M。**前置**：无。

### 1.8 C1 → **不吸收、不排期（主人 11-26 裁；admin 23:37 订正出处）**

`src/stores/llm-store.ts` 我方 2 ／ 上游 9。主人原话「不要、不排期」——判据不是冲突面，是产品不要。既有取消卡 `1630c44b` 属我方自己的取消与失败分离工作（19 处抛点），与「吸收上游 `llm-store` 改动」是两件事，不许混写成本簇的排期。补件 §3 曾把 C1 排进线序，**那是负责人沿旧排期的笔误、已订正作废**。

### 1.9 C2 → **按产品意义拆两半**

`src/services/draft-index.ts` 我方 **3** ／ 上游 **6**。
- **C2a（吸收候选，主人 11-26 23:23 定「需要」；不再按冲突面判）**：上游这三笔就是待吸收的行为——`77f650de7`（11-03）「定稿章可以重新打开修改，替换后提示后续内容不会跟着改」＋`329a57185`／`1bed1e390`（11-19）「合并视图按修稿自己的循环说复验」。产品意义：作者改错字是高频诉求，而「改完提示后续不同步」正是我方缺的那句提示。代价 **S/M**。
  **三笔全部属上游**（`git rev-list 549522d4..upstream/master | grep <sha>` 各命中 1，`… ..HEAD` 命中 0）——本行不是「我方已做过」，是「我方没有」。
  上游实际砍掉的量：`git diff --stat 549522d4 upstream/master -- src/services/draft-index.ts` → **`3 insertions(+), 171 deletions(-)`**（派单件与补件写「139 行」，与实测差 32 行；以实测 **171** 为准，差额登记于此）。
- **C2b（不吸收：上游删、我方主动保留）**：上游的删除动作为 `585c69258`（10-26「删除没有调用方的草稿索引与版本服务函数和重复的只读守卫」）／`27cd25361`（10-18「删除旧外壳留下的无人调用代码」），**两笔同样属上游**（在我方 HEAD 区间命中 0），与我方无关。我方该模块**仍在使用**：`src/components/editor/DraftEditor.tsx:24/114/597/614`、`src/services/workflows/chapter-workflow.ts:5`、`src/services/workflows/workflow-draft-meta.ts:3` 三处 import ⇒ 我方是**主动保留**这套能力，不跟删。我方在该文件的 3 笔（`a47d441a5`／`99bb86924`／`d9ac87003`，08-29～09-22 底座期）只是顺带改写，不构成取舍凭证；**本行的凭证是三处 import 引用点**，按「我方已独立取舍（主动保留）」记，不跟删。

### 1.10 C3 → **一次性吸收（主人 11-26 23:23 裁）；原判「不吸收」作废**

- 事实更正（保留）：`git cat-file -e HEAD:src/services/workflows/commands/legacy-character-roster-repair.command.ts` → **PRESENT**；`549522d4:<同路径>` → **PRESENT**。原清单写「我方无该入口」是错的，此处更正。
- 我方区间 **1** 笔：`d57b380c8`「feat: migrate legacy roster recovery to persistent main ownership」——落 16+ 文件：`electron/services/legacy-roster-generation.ts`（69 行）、`legacy-roster-source.ts`（104）、`legacy-roster-generation-context.ts`（27）、`legacy-roster-generation-proof.ts`（45）、`main-generation-owner.ts`（+107）、`character-roster-repository.ts`、`generation-source-binding.ts`、`generation-character-proposal-proof.ts`、`character-proposal-service.ts`、`generation-controller.ts`，外加 UI `src/components/editor/LegacyRosterRecoveryPanel.tsx`（60 行）与两个测试文件（168／87 行）。
- 上游 **12** 笔建在其 model-routing／`pinWorkflowModel` 上；该文件实测 **`26 insertions(+), 288 deletions(-)`**（`git diff --stat 549522d4 upstream/master -- <path>`；派单件的 −272 与实测差 16 行，以此处实测为准）。
- **结论（改判为吸收，一次性、不分期）**：把上游那次 model-routing／`pinWorkflowModel` 重构**整体吸收到我方实现**，一次收口。我方 `d57b380c8` 的 main-generation-owner 权威模型是**吸收后的落点、不推翻**；`legacy-roster-generation*.ts` 四件保留，把上游的阶段判定并进来。
- 实施落点（给实施方）：我方**没有** `pinWorkflowModel`，须先按我方 model 选择入口做等价物（`electron/llm` 的档位解析），再把上游命令层的 `288` 行删除对应的逻辑并进来；不许拆成两阶段。

### 1.11 C4 → **负责人转述主人 11-26 23:37 裁「一次性更换」；排工按 553，回滚基线 tag 已备**

**定性（二次更正）**：原定性（「待主人裁」）作废。负责人 11-26 23:45 转述主人 23:37 裁定：**C4 一次性更换，不分期推进**；专用分支 `card/c4-ui-rd-swap`，起卡前置＝porcelain 0 行 ＋ 回滚基线 tag `pre-ui-rd-swap-20261126`（→ `2880a05be`）。若与主人原话有出入，以主人原话为准、本行再改。

~~**定性（补件 §1 第 4 条）**：主人尚未答复，本件不转候选、不判吸收也不判不吸收，只给代价与可独立回滚的分期，等主人一句话。~~ **已作废**——见本行上方「定性（二次更正）」：C4 已裁一次性更换、不分期推进。本段仅作留档，不再代表当前定性。

**数字**：`git diff --name-status 549522d4 upstream/master -- src/components` 实测 **473** 条＝**A 215 / D 122 / M 133 / R 3**（R052／R054／R088；派单件沿用的 161 是别人转述、非实测；本件写死 **473**）。
**排工用的另一个数（QA 与 admin 均已核）**：`git diff --name-status HEAD upstream/master -- src/components | wc -l` = **553**——这是「我方当前树 → 上游」，含我方分叉后自己改动的组件，**派工与排期按 553**；473 只是「上游自分叉点起改了哪些」。两个数都对，口径不同，差 80 个我方独有组件。
**结构**：新增集中在新外壳 `stage/`（A 150、M 35），删除集中在旧外壳 `layout/`（D 20）、`panels/`（D 38）、`editor/`（D 26）、`dialogs/`（D 13）、`pages/`（D 7）；`settings/`、`ui/`、`characters/` 各有增删。
**我方投入（凭证）**：`layout` 34 笔、`panels` 104 笔、`dialogs` 101 笔、`editor` 144 笔、`settings` 34 笔、`characters` 26 笔、`pages` 16 笔、`ui` 11 笔；`src/components` 整体我方 304 笔／上游 1,554 笔。
**IPC 边界**：上游同期改了 14 个 IPC 面文件，含 `src/shared/ipc-channels.ts`、`electron/ipc/handle.ts`、`electron/ipc/direct-channels.json`、`electron/ipc-handlers.ts`、`electron/mcp/mcp-ipc-bridge.ts`。

**分期（已作废，仅留代价参考）**：以下三期是「若分三期做」的代价参照，**不再作为推进方式**（C4 已裁一次性更换）：

| 期 | 内容 | 触及 | 回滚方式 |
|---|---|---|---|
| 期 1 | **只冻结契约**：`src/shared/ipc-channels.ts` 对齐（新增通道先只读不写）＋ 旧壳保留双入口开关 `uiShell: legacy｜stage` | IPC 面 2 文件＋1 开关 | 开关切回 `legacy`，IPC 新增不动 |
| 期 2 | 引入 `stage/` 外壳最小可运行（`StageRoot`／`StageShell`／`StagePalette`／`RunCapsule`／`ExitGuardDialog`），业务面板仍走旧壳 | 新目录 ~6 文件＋入口 | 删新目录、开关回 `legacy` |
| 期 3 | 面板分批迁入（先 `panels` D 38、再 `editor` D 26、最后 `dialogs` D 13），**不删旧文件**，双跑一版 | 每批 ≤15 文件 | 按批 `git revert`，旧壳仍在 |

**代价**：L（473 文件规模，实质是换壳工程）。**前置**：起卡前 porcelain 0 行 ＋ 回滚 tag `pre-ui-rd-swap-20261126`（→ `2880a05be`）；结论已在二次更正中给出（一次性更换）。

### 1.12 C5 → **方向跟；依赖清单与 ABI 影响**

`package.json` 逐项比对（`git show HEAD:package.json` vs `git show upstream/master:package.json`）：

| 包 | 我方 | 上游 | 类型 | ABI／风险 |
|---|---|---|---|---|
| `better-sqlite3` | `^12.8.0` | `^13.0.3` | 运行时原生 | **major 升级＝原生 ABI 变更**，必须对 Electron 运行时重编；我方 devDep 有 `@electron/rebuild ^4.2.0`（上游已删），重建路径靠它；切 ABI 会打断所有 worktree 槽位 ⇒ 只能单卡串跑、不在 worktree 做 |
| `electron` | `^41.10.3` | `^44.9.3` | 运行时 | 大版本跨 3 档，同时抬 Chromium/Node ABI ⇒ 必带一次全量原生重编；具体 Node 版本以 Electron 44 release note 为准（**本件未核**，开卡时补） |
| `storybook` 等 7 个 | `^10.5.10` | `^10.6.2` | 仅开发 | 无运行时 ABI 影响；我方组件不走其 storybook（`.storybook/` 存在但配置自有） |
| `vite` | `^8.0.16` | `^8.2.4` | 仅开发 | 无 ABI 影响，注意插件 peer 版本 |
| `@electron/rebuild` | `^4.2.0` | 已删 | 仅开发 | **我方独有**，升级 Electron 时是必需品，不能跟删 |
| `@tailwindcss/typography` | `^0.5.19` | 已删 | 仅开发 | 我方独有，样式依赖，不能跟删 |
| `@lancedb/lancedb` | `0.22.3` | `0.22.3` | 运行时原生 | 两侧同版本，B5 不需要随升 |
| `node-pty` | 无 | 无 | — | 两侧都没有，不涉 |

**结论**：C5 的「跟随」只能是**逐包跟随**——`better-sqlite3` 13 与 `electron` 44 必须**同一张卡**（一次重编、一次性验 ABI），storybook/vite 另卡（纯开发依赖）。风险照写：Electron 44 与我方 Node/Electron 运行时的兼容需实机验一次 `pnpm dev` + 单测串跑。

**主人 11-26 23:23 裁：允许动 ABI 窗口**——加依赖不再以「切 ABI 会打断 worktree 槽位」为由否掉；纪律照旧，动 ABI 那一步**全仓串行**。卡面按此五步写：

| 步 | 动作 | 判据（可贴卡面） |
|---|---|---|
| 1 | 停所有 worktree 槽位：`git worktree list` 逐个 `git worktree remove`／停其进程；确认无 `node.exe` 占着槽位 | `git worktree list` 只剩主树；`Get-Process node` 无槽位进程 |
| 2 | 同卡升 `better-sqlite3 ^13.0.3` 与 `electron ^44.9.3`（一次 install，不分两卡） | `git diff --stat package.json pnpm-lock.yaml` 只含这两项＋lock |
| 3 | 重建原生模块（我方独有 devDep `@electron/rebuild ^4.2.0`） | Electron 运行时内 `require('better-sqlite3')` 成功 |
| 4 | `pnpm check:fast` ＋ 单测串跑（单实例、跑完即关） | `EXIT=0`；残留 Electron 进程 0 |
| 5 | 槽位重建后再放回（原分支 `git worktree add`） | 每个槽位冒烟 1 条单测通过 |

**回滚路径**：`git revert <升依赖那笔>` → `pnpm install` 回旧 lockfile → 按旧 ABI 重编原生模块。槽位在步 1 已停，**回滚期间保持停止**，不许「先放回再回滚」（那会把旧 ABI 的槽位与新 ABI 混用）。未核项：Electron 44 对应的 Node/Chromium 版本以官方 release note 为准，开卡时补一句实测版本号，本件不猜。

## 2. 簇级结论总表

| 簇 | 路径 | 我方 / 上游（区间提交数） | 改判 | 代价 | 前置 |
|---|---|---|---|---|---|
| B1＋B2 | `electron/services/model-discovery-service.ts`／`electron/llm` | 4／9 · 19／45 | **吸收候选** | M | — |
| B3a | `electron/repositories/import-run-repository.ts`（第三份阶段计划表＋反推 flag＋运行索引＋删章可写） | 25／11 | **吸收候选**（拆分） | **M**（原 L 作废） | 一页 flag 落库方案 |
| B3b | 同上（可恢复导入／效应围栏） | 25／11 | 不吸收（我方已独立取舍，凭证 25 笔，示例 `573434bbd`／`5e6a27f2e`／`596e4f6ce`） | — | — |
| B4 | `src/services/workflows/import-run-orchestrator.ts` | 10／21 | **吸收候选** | S/M | 取消卡 `1630c44b` ＋ B3a |
| B5 | `electron/vector-store.ts` | 15／14 | **吸收候选** | M | — |
| B6＋B7 | `electron/knowledge-base.ts`／`electron/controllers/kb-controller.ts` | 13／13 · 10／26 | **吸收候选** | M | B5 ＋ rerank 端点 |
| B8 | `electron/services/editor-inline-generation.ts` | 1／18 | **新功能立项** | L | 产品立项 |
| B9 | `src/shared/writing-skills.ts` | 1／11 | **吸收候选** | S/M | — |
| C1 | `src/stores/llm-store.ts` | 2／9 | **不吸收、不排期（主人 11-26 裁「不要」）**；我方仅 2 笔（`34f4ffde8`／`f2a791630`），非取舍，凭证是裁定本身 | — | — |
| C2a | `src/services/draft-index.ts`（定稿章重开／复验提示；上游砍 −171 行） | 3／6 | **吸收候选（主人定死「需要」）** | S/M | — |
| C2b | 同上（删无人调用函数） | 3／6 | 不吸收（上游删、我方主动保留）：凭证＝三处 import 引用点 `DraftEditor.tsx:24/114/597/614`、`chapter-workflow.ts:5`、`workflow-draft-meta.ts:3`；删除笔 `585c69258`／`27cd25361` 属上游、我方区间命中 0 | — | — |
| C3 | `src/services/workflows/commands/legacy-character-roster-repair.command.ts`（上游 −288 行 model-routing 重构） | 1／12 | **吸收（一次性，不分期）** | M | — |
| C4 | `src/components`（473 相对分叉点／**553 HEAD 对上游，排工按 553**） | 304／1,554 | **已裁：一次性更换**（负责人转述主人 11-26 23:37） | L | porcelain 0＋回滚 tag `pre-ui-rd-swap-20261126` |
| C5 | 依赖（`better-sqlite3` 13／`electron` 44） | — | **吸收（允许动 ABI，全仓串行＋回滚路径见 §1.12）** | M | 槽位全停 |

**计数复核**：上表每个读数都可用 §0 两行命令复算；`src/components` 的 473 由 `git diff --name-status 549522d4 upstream/master -- src/components | wc -l` 得出（A 215／D 122／M 133／**R 3**，R052／R054／R088，合计 473）；排工用的 553 由同一命令换成 `HEAD upstream/master` 得出。

## 3. 非代码路径 324 条（新判据下的簇级改判）

非代码总数 **324**（与评估件「315」的差 19 条＝仓库根级文件，筛选规则漏「无目录前缀」路径，口径已在评估件 §0 登记）。逐条见 §4 附录，簇级判定如下：

**两栏边界的一条判法（补件 §2 的落地解释）**：补件把「上游砍掉而我们在用的」也划进候选包。本件的处理是——**若我方有「主动保留」的凭证（引用点／HEAD 留存＋分叉前提交），它就是我方已独立取舍，留在本栏**；只有拿不出凭证（我方从未动过、或只有适配性质的一笔）才转候选。据此 C2b 与 D9 留本栏（都是「上游删、我方在用」，凭证是代码里的引用点），D2 与 D5a 转候选（D2 只有 1 笔且是换壳产物、D5a 我方 0 笔）。

| 簇 | 路径 | 条数 | 我方区间笔数 | 改判 | 我方凭证（sha 示例） |
|---|---|---|---|---|---|
| D1 | `docs/design/` | 160 | **383** | 不吸收（我方已独立取舍） | `046050d95`／`1c0700a1d`／`a1bcabeee` |
| D2 | `docs/assets/` | 44 | 1 | 吸收候选（随 C4 期 1，C4 未立项则不取） | 唯一一笔 `eef413c3b`（换壳产物，非取舍） |
| D3 | `docs/adr/` | 14 | **21** | 不吸收（我方已独立取舍） | `21c43e62c`／`22894f788`／`7944a3f74` |
| D4 | `docs/`（其他，含 `docs/research`） | 6 | 156 | 不吸收（我方已独立取舍） | `6f26f42fa`／`9a408d470`／`68ab42819` |
| D5a | `.claude/skills/verify/` | 65 | **0** | **吸收候选（方法论）** | 无（`git rev-list --count 549522d4..HEAD -- .claude` = **0**） |
| D6 | `.github/workflows/`＋`.github/` | 5 | 28 | 不吸收（我方已独立取舍） | `c6a69bb0b`／`3248fc975`／`a0fb2ff22` |
| D7 | `.release/` | 9 | 23 | 不吸收（我方已独立取舍） | `bf99e7f02`／`5b00960fa`／`9555b37ac` |
| D8 | `.storybook/` | 1 | 1 | 不吸收（我方已独立取舍） | `eef413c3b`（`preview.tsx` 在 HEAD） |
| D9 | `public/skins/` | 1 | **0** | 不吸收（上游删、我方主动保留） | `git rev-list --count 549522d4..HEAD -- public/skins` = 0（分叉前 `c365f44f0` 08-08「feat: add safe image skins and packaged qualification」）；凭证＝HEAD 留存＋主题引用点 `src/components/settings/AppearanceSettings.tsx:26`、`electron/services/release-skin-smoke.ts:12`。`eef413c3b` 只碰 `.storybook/preview.ts(x)`，属 D8 |
| D10 | 仓库根级 | 19 | 42 | 不吸收（我方已独立取舍） | `2880a05be`／`490e278de`／`816a16dbb` |

**结论口径**：本栏只剩「我方已独立取舍」这一类，且每行都有路径＋我方 sha；转候选的只有 **D5a**（我方 0 笔，无凭证可给）与 **D2**（唯一一笔是换壳产物，且价值取决于 C4 是否立项）。

## 4. 附录：非代码路径逐条（324 条，按新判据重贴簇号）

| 上游路径 | A/M/D | 簇 | 新判定 | 理由（含我方区间笔数） | 前置／触发 |
|---|---|---|---|---|---|
| `.claude/skills/verify/SKILL.md` | M | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/baseline-scenarios.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/driver.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/a11.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/adock.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/arch.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/bpg.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/bs702.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/c6.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/c7.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/c8a.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/c8b.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/cch.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/chapter.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/contrast.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/ctxfetch.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/d77.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/e763.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/errl2.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/errl3.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/errl6.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/errl6b.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/errnet.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/ext653.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/f484.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/f491.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/f512.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/f571.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/f593.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/f685.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/fq.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/fspeed.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i607.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i608.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i626.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i631.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i668.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i676.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i686.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i686d.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/i764.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/import-infer.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/ja725.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/l1b.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/l4conn.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/odio.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/oro.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/perf702.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/pp702.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/prop-rel.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/r3.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/r702.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/rbk.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/reopen.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/ru702.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/sealed702.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/setdel.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/sm517.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/st504.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/trash.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/issue-scenarios/uxr.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/measurement.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/rd-review-scenarios.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.claude/skills/verify/references/rd-stage-scenarios.md` | A | D5a | **吸收候选** | 我方 0 笔未做独立取舍；issue→场景→验收 的资产结构可用 | 建场景化验收体系时按 issue 号抄 |
| `.coderabbit.yaml` | A | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `.eslintrc.cjs` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `.gitattributes` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `.github/workflows/macos-arm64-cloud-build.yml` | M | D6 | **不吸收（我方已独立取舍）** | 我方 .github 区间 28 笔，自有 CI 闸 | 真做云端多平台时按 job 抄结构 |
| `.github/workflows/macos-daily-tests.yml` | A | D6 | **不吸收（我方已独立取舍）** | 我方 .github 区间 28 笔，自有 CI 闸 | 真做云端多平台时按 job 抄结构 |
| `.github/workflows/pr-ci.yml` | M | D6 | **不吸收（我方已独立取舍）** | 我方 .github 区间 28 笔，自有 CI 闸 | 真做云端多平台时按 job 抄结构 |
| `.github/workflows/windows-cloud-build-test.yml` | M | D6 | **不吸收（我方已独立取舍）** | 我方 .github 区间 28 笔，自有 CI 闸 | 真做云端多平台时按 job 抄结构 |
| `.github/workflows/windows-in-app-update-e2e.yml` | M | D6 | **不吸收（我方已独立取舍）** | 我方 .github 区间 28 笔，自有 CI 闸 | 真做云端多平台时按 job 抄结构 |
| `.gitignore` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `.release/notes/v1.3.0.md` | A | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/notes/v1.3.1.md` | A | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/notes/v1.3.2.md` | A | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/notes/v1.4.0.md` | A | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/notes/v1.5.0.md` | A | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/notes/v1.5.3.md` | A | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/scripts/github-desktop-promotion.mjs` | M | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/scripts/project-legacy-qualification.mjs` | M | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.release/scripts/validate-release-profile.mjs` | M | D7 | **不吸收（我方已独立取舍）** | 我方 .release 区间 23 笔，发布线自有 | 发版线统一时对齐变更日志格式 |
| `.storybook/preview.tsx` | M | D8 | **不吸收（我方已独立取舍）** | 我方 .storybook/ 存在且配置自有，不跟其写法 | 组件预览要与其对齐时按文件比 |
| `CONTRIBUTING.md` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `README.md` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `README_en.md` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `README_ja.md` | A | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `README_zh.md` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `docs/README.md` | M | D4 | **不吸收（我方已独立取舍）** | 我方文档体系自有，区间 156 笔 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/adr/0003-finalization-commit-and-manuscript-publication.md` | M | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0011-recoverable-finalized-chapter-deletion.md` | M | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0017-source-bound-character-state-and-continuity.md` | M | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0021-stage-flow-replaces-ide-shell.md` | M | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0022-product-name-shutong-keeps-legacy-identity.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0023-provider-owns-context-capacity-no-token-preflight.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0024-replace-finalized-chapter-via-reopened-draft.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0025-chapter-trash-soft-delete-and-restore.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0026-optional-material-budget-follows-model-window.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0027-context-window-resolved-in-one-place.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0028-execution-follows-the-resolved-context-window.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0029-generation-run-state-and-verification-scope.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0030-generation-ledger-admission.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/adr/0031-review-proof-v2.md` | A | D3 | **不吸收（我方已独立取舍）** | 我方 ADR 区间 21 笔，编号与结论自成一体 | 同题决策只引结论，不搬文件 |
| `docs/assets/brand/pagekin-icon-256.png` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/brand/pagekin-icon-512.png` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/brand/pagekin-icon.svg` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/brand/pagekin-mark-blue.svg` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/brand/pagekin-mark-ink.svg` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/brand/pagekin-mark-paper.svg` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/brand/social-preview.png` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/en/01-library.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/en/02-chapter.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/en/03-timeline.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/en/04-check.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/en/05-annotate.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/en/06-run.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/zh/01-library.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/zh/02-chapter.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/zh/03-timeline.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/zh/04-check.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/zh/05-annotate.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/hero/zh/06-run.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/pagekin-1.5.3-timeline-zh.gif` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/pagekin-hero-en.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/pagekin-hero-zh.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/annotate.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/architecture.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/blueprint.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/cast.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/chapter-dark.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/chapter.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/check.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/library.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/run.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/timeline.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/en/trash.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/annotate.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/architecture.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/blueprint.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/cast.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/chapter-dark.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/chapter.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/check.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/library.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/run.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/timeline.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/assets/readme/screens/zh/trash.webp` | A | D2 | **吸收候选（随 C4 分期）** | 素材只服务其换壳后 UI，我方 1 笔未做取舍 | C4 期 1 立项后按需取图 |
| `docs/brand/README.md` | A | D4 | **不吸收（我方已独立取舍）** | 我方文档体系自有，区间 156 笔 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/design-system.md` | M | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/feature-matrix.md` | M | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/ia.md` | M | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/plan.md` | M | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-arch-clear.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-arch-generate.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-arch-rewrite.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-architecture.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-backup.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint-batch.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint-overwrite.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint-recovery.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-blueprint.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-candidate-page.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-card-import.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-cast.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-delete.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-draft.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-finalize.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-focus.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-merge.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-review.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-chapter-selection.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-cleanup-retry.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-clear.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-exit-confirm.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-export.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-first-model.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-focus-search.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-graph.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-history-revert.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-history.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-import-menu.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-import-novel.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-index-model.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-kb-finalized.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-kb.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-lazy-retry.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-current.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-delete.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-empty.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-preview.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-library-remove.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-new-work.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-palette.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-plot-clear.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-plot.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-preflight.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-recheck.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-batch.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-cancel.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-confirm.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-diagnostics.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-discard.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-failure.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-run-live.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-save.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-settings-appearance.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-settings-model.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-setup-fill.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-setup-save-fail.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-setup.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-shell.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-tab-menu.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-tabs.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-thread-delete.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-threads.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-toasts.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-update.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-matrix-write-popover.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-fresh.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-matrix.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-migrate-galaxy.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review-widths.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-10-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-backup.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-empty.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-preview.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-save-failed.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings-leave-library.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings-leave-spine.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings-leave.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-settings.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-setup-720.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review-rd5-setup.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-5-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-char.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-confirm.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-partial.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review-rd6-rewrite.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-6-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review-rd7-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review-rd7-popover.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review-rd7-preflight.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-7-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-draft.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-finalize.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-focus.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-merge.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-review.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review-rd8-sheets.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-8-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review-history-diff.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review-knowledge.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review-plot.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-9-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-alert-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-alert-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-buttons-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-buttons-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-clearing-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-clearing-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-danger-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-danger-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-dialog-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-dialog-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-panel-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-legacy-panel-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-library-starts-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-run-notice-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-run-notice-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-split-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-error-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-error-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-flood-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toast-flood-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-pinned-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review-toasts-pinned-light.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-V-review.mp4` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X1-review-cleanup-retry.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X1-review-import-settings.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X1-review-waive-all.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-cast-paste.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-history-loading.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-index-model.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-landing-blueprint.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-landing-no-blueprint.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-library-back.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-outline-range.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X2-review-recheck.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-focus-active-tab.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-focus-segmented-tab-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-focus-spine-current.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-hover-focus-start.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-import-dialog-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-import-dialog.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-inline-confirm-focus.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-long-title-before.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-long-title.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-menu-focus.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-plan-ring-dark.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-plan-ring.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-popover-1024x640.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-popover-1280x720-before.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-popover-1280x720.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-toast-resize.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-toast-top.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/design/2026-10-11-frontend-redesign/review/RD-X3-review-toast-wheel.png` | A | D1 | **不吸收（我方已独立取舍）** | 我方 docs/design 区间 383 笔，自成体系与时钟 | 需对齐某篇交互契约时按篇取 |
| `docs/long-form-fiction-workflow.zh.md` | A | D4 | **不吸收（我方已独立取舍）** | 我方文档体系自有，区间 156 笔 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/product-domain.md` | M | D4 | **不吸收（我方已独立取舍）** | 我方文档体系自有，区间 156 笔 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/readme-visuals/hero-data.js` | M | D4 | **不吸收（我方已独立取舍）** | 我方文档体系自有，区间 156 笔 | 其某篇成为某能力唯一规格时按篇取 |
| `docs/readme-visuals/visual-manifest.json` | M | D4 | **不吸收（我方已独立取舍）** | 我方文档体系自有，区间 156 笔 | 其某篇成为某能力唯一规格时按篇取 |
| `electron-builder.json5` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `index.html` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `llms.txt` | A | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `package.json` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `pnpm-lock.yaml` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `pnpm-workspace.yaml` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `public/skins/anime-night.webp` | D | D9 | 不吸收（上游删、我方主动保留） | 我方 `549522d4..HEAD` 区间 0 笔；文件在 HEAD 留存（分叉前 `c365f44f0`），主题引用点 `src/components/settings/AppearanceSettings.tsx:26`、`electron/services/release-skin-smoke.ts:12` | 我方主题体系要接其皮肤格式时 |
| `vite.config.ts` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `vitest.browser.config.ts` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `vitest.guards.config.ts` | A | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |
| `vitest.settings-browser.config.ts` | M | D10 | **不吸收（我方已独立取舍）** | 根级 19 条我方区间 42 笔，治理件自有 | 引入其某根级配置项时逐项比对 |

## 5. 自查与未做

1. **读数可复算**：每个「我方／上游」数字都是
   `git rev-list --count 549522d4..HEAD -- <path>` 与 `git rev-list --count 549522d4..upstream/master -- <path>` 的直接输出，无估算。
2. **口径边界已写明**（§0.1）：真实共同祖先 `fc576e08`（08-16），`549522d4`（10-14）是上游快照而不是我方祖先；上游 08-16→10-14 约 900 笔不在基线 4,355 里，属**已知未评面**，本件不擅自扩面。
3. **禁用说辞自检**：件内三类禁用说辞（见派单件 §0 第 4 条）出现 **0 次**；判定理由全部落成「我方区间笔数＋路径／sha」或「产品意义」。
4. **未做／未核的三处，明写不藏**：①未逐篇读 `docs/design` 160 篇内容，D1 的「不吸收」是按我方 383 笔的取舍事实 + 文档体系独立性判的，不是读过每篇后的结论；②`electron` 44 对应的 Node 版本未核（C5 表内已标注）；③B8 未做 UI 工时估算（只给「新功能立项」这一性质判断）。
5. **与旧版（22:0x 版）的差异**：旧版判不吸收的 B1／B2／B5／B9 改为吸收候选；B3 由「整簇不吸收」拆成 B3a 吸收候选 ＋ B3b 不吸收（带 25 笔凭证）；C4 由「一句跟着换」改成 473 文件 + 三期 + 每期回滚方式；C5 由方向词改成逐包 ABI 表。**非代码 D5a／D2 变严**：旧版拿「方法论/品牌资产」当理由，本版按「我方 0–1 笔、拿不出独立取舍凭证」改判吸收候选。
6. **按口径补件（23:28）第三次改判的三处，与上一版（23:5x）不同**：①C3 由「不吸收」翻成「**一次性吸收、不分期**」（主人 23:23 裁；实测上游该文件 −288 行，派单件 −272 与实测差 16）；②C2a 由「按冲突面判需要」改成「**主人定死需要**」，并补实测「上游砍 171 行」（派单/补件写 139，差 32）；③C5 由「否掉 ABI 窗口」翻成「**允许动、全仓串行＋回滚路径**」（§1.12 五步表）。C4 定性原改为「待主人裁」（本次第 9 条再改为「已裁：一次性更换」）。
7. **一处口径冲突已定（不是我裁的）**：C1——负责人补件 §3 曾把 C1 排进线序（「等 C4 收口后起」），与主人「不要」相左。admin 11-26 23:37 明确：**以主人原话为准，C1 不要、不排期**，补件那句是负责人沿旧排期的笔误、已订正作废。本件 §1.8 与 §2 表 C1 行按此写死，候选包里不再有 C1；C1 的「不吸收」凭证是**裁定本身**（我方仅 2 笔 `34f4ffde8`／`f2a791630`，属底座期提交、非取舍），不与「我方已独立取舍」类混算。
8. **一处归属错已自查并改正（交件前）**：C2 那五笔（`77f650de7`／`329a57185`／`1bed1e390`／`585c69258`／`27cd25361`）经 `git rev-list 549522d4..HEAD | grep` 复核，**全部属上游**（HEAD 区间命中 0、`..upstream/master` 各命中 1）。原 §1.9 把它们写在我方语境下，属引用归属错误，已改为「上游待吸收／上游删除动作」；C2b 的凭证改为**三处 import 引用点**。全件 101 个引用的九位 sha 已逐条复核：其余均在我方区间命中 1。
9. **QA 首验三处必改已改（11-26 23:5x，M1／M2／M3）**：M1 §1.2 的「`ImportRunStage`／`importStagesFor` 命中 0、没有阶段机」改为实测——8 文件命中、11 值枚举 `src/shared/import-run.ts:22-32`、`import-run-orchestrator.ts:126-139` 两份静态计划表与 `stagesFor`，真缺的只有第三份 `authorWithInference` 计划表＋`authorInference` flag；**B3a 代价 L→M**、前置改为「一页 flag 落库方案」，两份件同步。M2 §3 D9 行：我方区间笔数 1→**0**（`public/skins` 实为 0 笔），凭证换成「HEAD 留存＋主题引用点 `AppearanceSettings.tsx:26`／`release-skin-smoke.ts:12`＋分叉前 `c365f44f0`」，`eef413c3b` 归 D8。M3：R 计数 4→**3**（R052／R054／R088，合计 473）。另按负责人 23:45 转述，C4 定性由「待主人裁」改为「已裁：一次性更换」，并补 553（HEAD 对上游，排工用）与 473（相对分叉点）两个口径及回滚 tag。
10. **本件不动生产码**：只读 `git`，写两份 `.batch/night/reports/` 件；未 `git add`、未 commit。
