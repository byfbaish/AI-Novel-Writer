# 上游差异评估（2026-11-26）

- 出件：developer（只读评估；未 merge、未 cherry-pick、未 push、未改任何 `src/` 生产码）
- 任务书：`.batch/night/reports/upstream-diff-task-20261126.md`
- 口径件：`.batch/night/reports/upstream-diff-baseline-20261126.md`
- 交付：本文件 ＋ `upstream-diff-inventory.tsv`（4,319 行全量机器清单）
- 取数时刻：2026-11-26 21:05–21:35（读数为当时快照；上游 master 尖端 `32f4f7f8`）
- 我方基线：`HEAD 5d0a418d`（2026-11-26 19:11:55 +0800）、`git status --porcelain` 2 行（他人清单件）

## 一、分叉点（命令原文）

```
$ git merge-base HEAD upstream-baseline
（无输出）EXIT=1                      # 无共同祖先：两条历史不可比

$ git merge-base HEAD relive-src/upstream-baseline
dd04d3e979a3800bba50ac9aa1d365884b87737b
2026-10-10 02:xx +0800 test: keep batch chapter waits inside React act (#337)
                                      # 假祖先：上游重写过历史

$ git rev-parse upstream-baseline^{tree} relive-src/upstream-baseline^{tree}
ecca898653fcd98b69c9870ec6ecf4063be26a4d
ecca898653fcd98b69c9870ec6ecf4063be26a4d   # 两棵树的指纹相同＝同一份上游快照
```

**真实分叉点取上游提交侧**：`549522d4`（#381 rd-4-run-sheet，2026-10-14 03:43 +0800，树 `ecca8986…`），
与口径件一致。双方提交数：上游 `compare/549522d4...master` = **ahead 4,348 / behind 0**；
我方自假祖先 `dd04d3e9` 以来 **1,086 笔**（只作偏离量记录，不参与增量统计）。
我方相对基线：**2,750 文件、+321,128 −27,782**（`git diff --name-only upstream-baseline HEAD | wc -l` = 2750）。

## 二、上游增量

- 提交面：`GET /repos/EthanYoQ/Pagekin/commits?sha=master&since=2026-10-14` 分页 **44 页 → 4,319 笔**
  （与 compare 的 4,348 差 29 笔＝0.67%，因按 committer 日期分页、rebase 后日期早于基线；不影响文件级结论，见 §六）。
- 4,319 笔里 merge **653**、非 merge **3,666**；按标题前缀：fix 1,339、test 1,556、chore 221、docs 164、refactor 151、feat 135、perf 49。
- 主题 distribution（inventory `theme` 列）：`other` 1,697、`test-harness` 1,469、`rd-redesign` 277、`generation` 194、`docs` 127、`import-archive` 117、`ci-release` 104、`i18n` 90、`llm-provider` 84、`characters` 70、`ui-shell` 48、`knowledge` 42。
- **文件级净变更（基线 549522d4 → master 32f4f7f8）**：1,857 路径 = **M 789 / A 896 / D 172**；
  顶层分布 `src` 886、`electron` 379、`scripts` 235、`docs` 224、`.claude` 65、`test` 27、`.release` 9、`.github` 5、`build` 3、`plugins` 3。
- **非代码提交单列（315 路径 = A 285 / M 30）**：`docs/design` 160、`.claude/skills` 65、`docs/assets` 44、`docs/adr` 14、`.release/notes` 6、`.github/workflows` 5。
  其中 `.claude/skills/verify/references/issue-scenarios/` 是一整套**以 issue 号命名的场景化验收资产**（a11／adock／arch／c7／i607／i626／i686／perf702／r702／trash…）——方向值得借鉴（B 类），但绑它的 verify 技能链。

## 三、三方 triage（我方能吸收的面到底有多大）

只对「两边都存在的 863 个路径」判：**我方与基线逐字节相同（OURS_EQ_BASE）410 / 我方已改写（DIVERGED）289**，其余为上游删除。

| 类别 | 数量 | 含义 |
|---|---|---|
| 交集路径（上游改＆我方有） | 863 | M 699 / D 161 / A 3 |
| ├ `OURS_EQ_BASE` | 410 | 上游的改动落在我们**没动过**的文件上 → 吸收成本最低 |
| │  └ 其中生产代码 | 204 | `src/services` 42、`src/shared` 25、`src/components` 24、`electron/services` 23、`electron/repositories` 11、`electron/controllers` 8 |
| └ `DIVERGED` | 289 | 我方已改写 → 上游改动只能按意图移植 |
| 上游删除、我方保留 | 161 | `src/components` 占 116（＝RD 视觉层换壳，不是我们该跟的） |
| 上游新增、我方已有同名 | 3 | 例：`electron/migrations/__tests__/m07/m08-installed-lane.test.ts` |

**关键结论：A1 = 0。** 我们与上游的差异是**文件级**，不是提交级——我方相对基线已走 2,750 文件、1,086 笔，
任何上游提交的父链上下文都不在我们树上成立。我生成了 22 个「基线→master 净 diff」补丁，
其中 14 个在 develop 主工作树 `git apply --check` **全部 OK**（文本层能落），但这**不等于 A1**：
落下去的是「六周净改动的结果」，不是某一笔可 cherry-pick 的提交，语义仍要按我方接口核对。
所以下文全部 A 类都是 **A2（按我方改写）**，没有任何一条能原样搬。

## 四、逐条定性

### A2 · 真缺陷修复（建议吸收，按簇）

| 上游改动（文件） | 改动面 | 定性 | 相关提交（新→旧） |
|---|---|---|---|
| `electron/services/manuscript-publisher.ts` | 回收站恢复/重发时避开「未清理完的删除收据」占用的文件名（`reservedManuscriptTargets()` 改必填、`republishTarget` 换不撞名目标） | A2 · 数据安全：不做的话续跑清理会删掉刚放回的书稿；**我方两个符号 0 命中＝新建机制**，不是改调用点 | `5eb71454` `7e02aca1` `0efbdec2` `5bfbc3b4` `2cb88ad5` |
| `electron/controllers/import-controller.ts` | 导入读文件失败按「编码／单文件 64MB 上限／总量 MB／EPERM-EACCES 权限」分项说明；解析路径时才说「系统不让打开」 | A2 · 文案与判据错位（单文件超限被说成总量超限） | `589d20b4` `c3c2692a` `23249954` `626a6417` |
| `src/services/workflows/workflow-utils.ts` | 裸中文抛错改登记码 `GENERATION_PROJECT_SESSION_REQUIRED`；取消改抛 `WorkflowCancelledError`，重试不再把取消当失败；`finalizationStepErrorMessage` 作为失败原因唯一出口 | A2 · 取消/失败混淆是**真 bug**（会把真实失败记成已取消）；**我方 0 处取消类型，需新建＋收口 4 抛点** | `ee7b305b` `832d480b` `768735c4` `d4e31ca9` `27fdf08e` `ff9192b8` `edfd5c81` |
| `src/services/generation/prompt-budget-failure.ts` | 网络失败按传输诊断分「没连上（响应头之前断）/中途断（之后断）/代理连不上」，大写代理主机也认；短细纲、自动续写、编辑器扩写同一说明 | A2 · 我方已有 `'network'` 一档（`:62`／`:116`），收益是**三因细分**；上游同簇文件 `electron/llm/transport-diagnostics.ts` 我方 ABSENT | `674273e1` `5992318b` |
| `electron/controllers/external-file-grant-controller.ts` | 用正则匹配**本地化中文错误文案**改成按 `EXTERNAL_FILE_GRANT_*`/`SECURE_FS_*` 码 switch | A2 · 真缺陷：换界面语言即失效 | 与 #722 同批 |
| `src/shared/model-profile-draft.ts` | `ContextWindowSource`（manual/learned/endpoint/preset/default）＋`resolveContextWindow`＋`sameModelIdentity` | A2 · 上下文窗口来源可解释，影响预算判据 | — |
| `src/services/authoritative-chapter-sequence.ts` | `readWritableChapters` / `WritableChapters` | A2 · 小（2 hunks），可写章边界收敛 | — |
| `src/i18n/core.ts` | `resolveInterfaceLocale`/`storedInterfaceLocale`/`copyLocale`/`errorLocaleForRun`：**界面语言与错误文案语言分离** | A2 · 线长（牵 90 笔 i18n），建议单独立项 | `768735c4` `9d845200` |
| `scripts/monitor-win-release-gate.ps1` | +1,064/−642 Windows 发布闸 | A2 · 工具链收益大但绑其 NSIS 产物名与进程名，需重写映射 | — |

### B · 方向有价值、实现绑上游路线（只借思路）

| 上游改动（文件） | 改动面 | 定性 |
|---|---|---|
| `electron/vector-store.ts` | LanceDB 全文检索（`fullTextTerms`/`tableSupportsField`/`knowledgeStoreSupportsCommits`） | B · 牵存储版本与索引迁移，我们已自建 |
| `electron/knowledge-base.ts` | rerank ＋ 全文召回 ＋ 来源门 | B · 与 `kb-controller` 的 `getEmbeddingConfig`/`getRerankConfig` 成对，绑其设置面 |
| `electron/services/model-discovery-service.ts` | Anthropic `/v1/models`、Ollama 窗口探测 | B · 值得抄「探测失败不写入 learned」的纪律 |
| `electron/llm/gemini-provider.ts` | thinkingLevel adapter＋`geminiTokenUsage` 把 thoughts 计入 completionTokens | B · 我们 provider 层不按此结构 |
| `electron/repositories/import-run-repository.ts` | 81 hunks：作者推断、缺蓝图统计 | B · 依赖其导入阶段机 |
| `src/services/workflows/import-run-orchestrator.ts` | 阶段机 `stageIndex`/`nextStage`/`stopIfCancelled` | B · 与上一条同簇 |
| `electron/services/editor-inline-generation.ts` | 批注式生成（+202） | B · 交互形态不同 |
| `src/shared/writing-skills.ts` | Skill 附件包 `WritingSkillPackageInspection` | B · 我们 Skill 面无此契约 |
| `.claude/skills/verify/references/issue-scenarios/*` | 以 issue 号命名的场景化验收脚本 | B · **方法论值得借**：issue → 可复现场景 → 验收脚本 |

### C · 冲突 / 已被取代

| 上游改动（文件） | 改动面 | 定性 |
|---|---|---|
| `src/stores/llm-store.ts` | stage 模型路由与 rerank 字段；删流式回调与 `activeRequests` | C · 我们模型路由是另一套 |
| `src/services/draft-index.ts` | 上游删 139 行 | C · 索引策略不同 |
| `src/services/workflows/commands/legacy-character-roster-repair.command.ts` | −272 行，依赖上游 model-routing | C · 残留清理，不是能力 |
| `src/components/**` 161 个 | RD 视觉层整体换壳 | C · 方向不同，不予吸收 |
| `pnpm-lock.yaml`／依赖升级 | 上游换依赖版本 | C · 单列风险（加依赖须另立卡） |

## 五、A 类吸收代价与建议顺序

按「真 bug > 数据安全 > 文案/可解释 > 结构性」排，三条先做：

1. **取消与失败的混淆（`src/services/workflows/workflow-utils.ts`）— M（新建机制）**：`isWorkflowCancellation` 全仓 **0 命中**；我方是 `workflow-utils.ts:57`／`:60`／`:63`／`:236` 四处**直抛** `new Error('工作流已取消')`。所以本项是「**新建取消类型 ＋ 收口 4 个抛点**」，不是改现成判定入口。
   风险：「把真实失败改记成取消」的回归，须带单测覆盖四处抛点。预计冲突 2–4 处（我方已改写的 catch 分支）。
2. **回收站/重发的文件名冲突（`electron/services/manuscript-publisher.ts` ＋ `ChapterDeletionRepository`）— M（新建机制）**：`reservedManuscriptTargets`／`republishTarget` 我方 **0 命中**，publisher 无 `reserved` 参数——不是改调用点，要**新建「删除收据占位目录 ＋ 选目标处必填入参」**这套机制。
   这条仍**必须照做**：机制缺一处，续跑清理就会删掉刚放回的书稿。按新建计工作量。
3. **网络失败分因（`src/services/generation/prompt-budget-failure.ts`）— S/M**：上游同一簇还改了 `electron/llm/transport-diagnostics.ts`（我方 **ABSENT**，无此文件）；我方 `prompt-budget-failure.ts:62` 已有 `'network'` 一档、`:116` `NETWORK_FAILURES` 归入该档。
   所以收益是**三因细分（未连上／中途断／代理不可达）**，不是从无到有；需先新建传输诊断载体，再细分文案。

其余：`import-controller.ts` 文案分项（S，独立可做）；`external-file-grant-controller.ts` 去中文正则（S，与 i18n 线耦合）；
`model-profile-draft.ts`（M，牵预算判据）；`i18n/core.ts`（L，单独立项）；`monitor-win-release-gate.ps1`（L，工具链）。

**风险单列**：① 上游 `vector-store`/`knowledge-base` 簇带依赖升级，吸收＝加依赖，须另立卡并评估 ABI；
② `.github/workflows` 5 笔改 CI，会破坏 worktree 隔离口径（我们只准单元测试）——不吸收，只参考写法；
③ 语料/PII：本次评估未触碰任何正文语料，`.runtime/` 未动。

## 六、口径与偏差（自查）

1. **提交数 4,319 vs 4,348（差 29 笔，0.67%）**：`/commits?since=` 按 committer 日期过滤，上游 rebase 后部分提交的 committer 日期早于 2026-10-14，被过滤掉。**文件级结论不受影响**（文件增量取自两棵 tar 快照逐文件 sha1，不依赖提交列表）。
2. **`files_n` 与 `class` 两列留空**：列表接口不返回单笔改动文件数，逐笔取需 4,319 次调用（未认证配额 60/h），本列留空；`class` 也不按提交填——定性是按**文件簇**做的（见 §四），单笔提交填 class 会把 `chore`/`test` 与真缺陷混在一列里。正文用「簇」表达改动面，不用估算数字充数。
3. **A1 = 0 的判定依据**：不是「apply 全失败」，而是 **apply --check 全过也不构成 A1**——净 diff 能落不等于某笔提交可 cherry-pick；我方父链已偏离 1,086 笔。任务书要求的「A1 必须 `git apply --check` 真过」我按更严的口径执行：**只有 commit 级、父链一致的才叫 A1**，本次为 0。
4. **取数通道**：`api.github.com` 未认证（60/h，用尽后改走认证 MCP `list_commits(path=…)`）、`codeload.github.com` 取 tar；
   `github.com:443` 的 git 协议与 `ssh` 通道在本机不可用（已实测），故未做 `git fetch`。
5. **未做**：未评估运行时行为差异（需要真机跑上游），未评估数据库迁移兼容性（上游 migrations 与我方 M 系列交集未逐条比对）——两项都超出「只读评估」授权，需要时另立卡。
6. **§五 口径修订（QA `c4ee25f8` 首验 C1–C3 ＋ 负责人裁定「按 C1–C3 改」）**：初版把三处工作量估小了，本文已改，读数与分类未动。修订凭据（本机实测）：

```
$ grep -rn "isWorkflowCancellation" src electron | wc -l
0
$ grep -n "throw new Error(text('工作流已取消'" src/services/workflows/workflow-utils.ts
57: 60: 63: 236:          # 四处直抛，无取消类型
$ grep -rn "reservedManuscriptTargets\|republishTarget" src electron | wc -l
0
$ ls electron/llm/transport-diagnostics.ts
No such file or directory      # 我方 ABSENT
$ grep -n "'network'\|networkFailureText" src/services/generation/prompt-budget-failure.ts
62:  | 'network'     116:  if (NETWORK_FAILURES.has(code)) return 'network'
```
