# 2026-11-11 单轮实机评审（reviewer · 独立核验）

- 被评对象：`41f3d832`（本地未推送）及其证据文档 `docs/handoffs/2026-11-11-night-evidence/*`
- 评审方式：只读源码 + 只读 git + 静态推演；**未起 dev / 未跑任何测试**（含单文件）
- 基线：`exp/resource-ledger` @ `41f3d832`；工作区仅 `?? .batch/`

## 1. 总体判断

**需修正**。四条里三条的核心事实成立、结论方向可用（B11「不是生产稳态泄漏」、D9「capMs 未接线」、A2「实际调用 B / 状态栏显示 A」），但 **B16 的归因链是错的，且会掩盖一个真实产品缺口**；B11 的「判 A」是自认的推定，其机制与代码/实测事件顺序相矛盾，只能算「A 未排除」；A2 的定性（缺陷 vs 设计边界）需要重述，因为原始验收判据 N3 明确要求「配置 A / 实际 B ⇒ 显示 B」，本轮结论**不是**把设计边界误写成 bug，而是**迟到了 4 天的验收失败**。零源码改动属实，无越界。

## 2. 逐条核验表

| 事项 | 主张 | 核对结果 | 依据 |
|---|---|---|---|
| B11-a | 生产 `window:close-requested` 稳态活跃订阅 = 1，不增长 | **成立** | `RendererStartup.tsx:41-47`（`if (Workspace \|\| !ipc.isElectron) return`，cleanup 即 unsub）；`TitleBar.tsx:75-94`（`[]` 只挂一次）；事件序列 4 on / 3 off / live=1 可被「StrictMode 双跑 + Workspace 挂载时父 effect 先 cleanup」完整解释 |
| B11-b | 「两处都挂上稳态是 1 还是 2」 | **报告的隐含答案有误**：两处同时挂着就是 **2**；能保持 1 只因 `RendererStartup` 的订阅被 `!Workspace` 门控，两者**结构性互斥**（仅挂载瞬间短暂重叠）。报告把「1」当成「两处都正常」的证据，其实 1 只证明「同一时刻只有一处」 | 同上 |
| B11-c | 判 A = 测试夹具缺陷（合成 Workspace 多订） | **未证实（推定）**，且与可观测事实冲突 | ① 报告自认 `b11-probe-result.md:22,163`「A 支为推定，未在夹具内打点」；② 生产事件在 1885ms 先 `off` 再 1886ms `on`，说明 React 顺序是「父 cleanup → 子 mount」，测试里同一顺序应得 1，实测 2 属**未解释的异常**；③ 夹具的 `on` mock 返回 `listeners.delete`（`RendererStartup.browser.tsx:114-115`），cleanup 路径本身没缺陷 |
| B11-d | 探针只包 `ipc.on` 可能漏拦 | **漏拦风险低，但不是零** | 全库该 channel 仅 2 处订阅，均走 `ipc.on`（grep 结果）；`src` 内无 `aiNovelAPI.on` 直调、无 `once` 用法。真实风险不是绕过，而是 ① patch 前已建立的订阅（`import()` 异步，报告已注）② 只测生产不测夹具 |
| B11-e | 报告自身证据自洽 | **不自洽** | 探针 `hasTitleBar` 定义是 `.tmp-ui/b11-probe-v2.mjs:54` `querySelector('header, [data-testid="titlebar"]')`；而 `TitleBar.tsx:216` 渲染的是 `div.writer-topbar`，**永远命中不到**。T1 的 `true` 来自书架页别的 `<header>`；T2/T3 的 `false` 不能证明 TitleBar 卸载（`bodyHead` 里就有 `AI小说作家 AI Novel Writer 当前项目：` = TitleBar 文案）。报告未察觉此矛盾 |
| A2-a | `recordActualModel` 全库仅一处调用 | **成立** | grep `src` + `electron` 仅 `generation-runtime.ts:409`，位于 `createDefaultEnvironment().beginModelExecution` 内 |
| A2-b | `MainGenerationSnapshot` 无模型字段 | **成立** | `generation-runtime.ts:82-93` 仅 `artifactId/attemptId/revision/durableRevision/text/textHash/status/compositionEligible/diagnostics` |
| A2-c | 章节写稿走 main-owned，不经 `beginModelExecution` | **成立** | `base-command.ts:154`；`generate-draft.command.ts:283-285` 默认依赖 **强制** `mainRequest`（缺失即 throw `DRAFT_MAIN_GENERATION_REQUEST_REQUIRED`）；`workflow-main-generation.ts:129` 走 `createMainOwnedGenerationRuntime` |
| A2-d | 状态栏语义 = 有 actual 显示 actual，否则退配置 | **成立** | `statusbar-model.ts:20-28`；`StatusBar.tsx:58-65` |
| A2-e | 根因「快照无模型字段」是**唯一**根因 | **部分成立**：解释力够，但不是最小修法 | `workflow-main-generation.ts:41` 渲染层**已经持有** `modelId`（`context.generationModelId ?? defaultModelId`），`:104` 还把它发给了主进程；缺的只是 `modelName`。渲染层有 `useLLMStore.models` 可反查。所以「必须给 `MainGenerationSnapshot` 加字段」不是唯一解，甚至不是最小解 |
| A2-f | 这是「缺陷」还是「设计未覆盖」 | **是缺陷（验收未兑现），不是把设计边界写成 bug** —— 与你的预设相反 | ① 原始判据硬写：`2026-11-07-d9-d16-structural-design-handoff.md:20`「D16 = 状态栏读实际调用事实源、不读配置当前选中值」、`:53` N3「构造『配置 A / 实际 B』⇒ 显示 B」；② 缺陷稿 D16 行至今 **⬜ 不得销账**（`live-pipeline-acceptance-defects-assessment.md:78`）；③ 11-07 已明确记过「正文生成不走这里、主路径不触发」（`2026-11-07-d9-d16-structural-design-handoff.md:43,89`）。本轮不是新发现，是**同一已知缺口第一次拿到实机证据** |
| B16-a | `sourceConflictNoticeText` 是拼接串 | **成立** | `source-conflict-copy.ts:38-41`，空格连接两句 |
| B16-b | `SourceConflictNotice` 渲染两条独立 `<p>` | **成立** | `SourceConflictNotice.tsx:19-24`；第三条文案出自 `AIOutputPanel.tsx:454`（`gate.sourceChanged`）也成立 |
| B16-c | 「拼成一个元素 ⇒ 精确 `getByText` 必然失败」 | **不成立** | ① 断言没有 `exact: true`（`CodeMirrorEditor-generation.browser.tsx:281,335,336`）；② provider 是 Playwright（`vitest.browser.config.ts`），`getByText(string)` 默认**子串、忽略大小写**，前一句是完整连续子串，本应命中；③ **同文件 :335/:336 用同一断言、同一拼接路径却通过了** —— 测试基线是「2 failed / 835」，B16 只贡献 1 个失败，若拼接致败，:335 必同红 |
| B16-d | 红灯是测试写法问题 | **不成立（机制错），且掩盖产品问题** | :281 的真实路径：`recovery.sourceStatus==='current'` → 过 `:714` 的门；随后 `:720-728` `target.filePath('draft/1') !== filePathRef.current('draft/2')` → 走 `:730` 的「正文或原目标已变化…」，**不经过 `:717` 的 `sourceConflictNoticeText`**。所以页面**有**提示，只是另一条文案。这恰是报告自己在「实机新发现」里说的那条 —— 同一条分支被判成「测试写法」 |
| B16-e | 建议修法（把 :281/:335 改正则/`toHaveTextContent`） | **不成立**：改完仍红 | `:281` 场景根本不产生「来源已变化」串，正则同样命中不到；会把一次必然红改成另一次必然红 |
| D9-a | `generation-run-service.ts:206` 未传 `capMs` | **成立** | 实际调用 `resolveCallDeadline(budgetRemainingMs)`；全库生产调用点仅此一处（grep） |
| D9-b | 因此 10 分钟写死、生产不可配 | **成立**（但需限定：root 预算 `maxActiveElapsedMs` 仍能向下夹紧） | `generation-call-timeout.ts:12,23-39`；`main-generation-plan.ts:18-26` `RootBudget` **无 per-call cap 字段** |
| D9-c | 「把 `readMainGenerationPolicy` 的 cap 接进来」 | **不成立（该字段不存在）** | `main-generation-plan.ts:183-206` 返回值只有 `budget{maxPhysicalRequests,maxTokenLiability,maxOutputPerRequest,maxActiveElapsedMs}`；要接需先扩 `RootBudget` + policy 版本 + binding 校验，属结构性改动，不是「一行」 |
| D9-d | 「超时把 `endReason` 覆盖成 `'cancelled'`」 | **不成立（写反了）** | `generation-run-service.ts:287-288` 是 `endReason: 'failed'`，注释明写「压过 provider 在 abort 路径上先写下的 `endReason='cancelled'`」；`:307-309` 只落 `failureCode`，settle 不传 endReason |
| D9-e | 12/12 单测绿 | **未复跑，数量对得上** | `generation-call-timeout.test.ts` 10 个 `it`；`generation-run-service.call-timeout.test.ts` 2 个。集成侧只用 `fixture(3_600_000)`/`fixture(300_000)`，**没有 cap 覆盖用例**，与「cap 未接线」互相印证 |
| D9-f | 已如实标注「未实机」 | **成立** | `d9-static-judgement.md:3` 首行、digest §9.4 标题 |
| 越界 | 零源码改动 | **成立** | `git show --stat 41f3d832` 9 个文件：8 doc + 1 `scripts/night/...md`；`git status` 仅 `?? .batch/` |

## 3. 最弱环节 Top 3

1. **B16 的归因链（会直接把排障带偏）**
   如果错了会怎样：下一班按交接稿 §2 第 2 条把 `:281/:335` 改成正则 —— **仍然红**；然后会得出「改测试无效 ⇒ 是产品问题」的二次结论，白烧一轮，且把 `:730` 那条文案优先级问题继续留在代码里（作者最常撞的正是这条）。

2. **B11 的「判 A」（把未证实假设写成结案）**
   如果错了会怎样：真泄漏（renderer 侧某条 cleanup 在特定路径不执行）被标成「夹具问题」关掉；症状是关窗偶发丢未保存正文，且不可复现。更具体的风险：**测试里的 2 至今没有任何机制能解释**，而生产的 cleanup 顺序证明同一个 React 语义下应为 1 —— 这个反常本身就是线索，不该被「按任务书判据推定」抹平。

3. **A2 的「设计未覆盖」倾向 / D16 台账状态**
   如果错了会怎样：把验收失败降级为「设计边界」，等于用一句「设计稿标注一下」销掉 N3 判据；而从 11-07 起 D16 就在缺陷稿挂着 ⬜。同时 backlog 现在写「已实施（…实机复验：不生效）」，状态词与结论自相矛盾，下一个人只会读到「已实施」。

## 4. 文档问题清单

| # | 文件:行 | 问题 |
|---|---|---|
| 1 | `b16-conflict-copy.md:58,62-63`；`2026-11-11-night-batch-digest.md:247`；`2026-11-11-night-closeout-handoff.md:16`；`.workbuddy/memory/2026-11-11.md`（20:00 段 B16 条） | 「拼接串 ⇒ 精确 getByText 必失败」事实错误（getByText 默认子串；:335 已通过） |
| 2 | `2026-11-11-night-closeout-handoff.md:25` | 修法（:281/:335 改正则 / toHaveTextContent）无效；`:335` 本就不该动 |
| 3 | `d9-static-judgement.md:13`（表 4）与 `:41`（§三.3）；`2026-11-11-night-batch-digest.md:256` ③ | 「覆盖成 `endReason:'cancelled'`」写反，代码是 `'failed'`（`generation-run-service.ts:287-288`） |
| 4 | `2026-11-11-night-closeout-handoff.md:26`；`d9-static-judgement.md:47` | 「`readMainGenerationPolicy` 的 cap」不存在该字段；实际需扩 `RootBudget` |
| 5 | `2026-11-11-night-closeout-handoff.md:47-48` | 「三项都是改一行就能收口」不实：D16 至少跨 snapshot/transport/owner；B16 是产品裁定，不是一行 |
| 6 | `docs/plans/prompt-assembly-backlog.md:139` | 同一格里「已实施」与「实机复验：主进程持租约路径不生效」并存，与 `live-pipeline-acceptance-defects-assessment.md:78` 的「⬜ 不得销账」直接冲突；本轮只加注、未同步状态词 |
| 7 | `b11-probe-result.md:10,16-17,130-145` | `hasTitleBar` 探针选择器命中不到 `TitleBar`（`.tmp-ui/b11-probe-v2.mjs:54`），T2/T3 的 `false` 与 `bodyHead` 里的 TitleBar 文案自相矛盾，报告未标注该项失效 |
| 8 | `a2-d16-recheck.md:36,71`「575 字正文」/ digest §9.2「2052 字」 | 575 是 `.cm-content` 的 `innerText.length`（CodeMirror 虚拟化后仅视口文本），不是章节字数；两个数字并列易被读成矛盾 |
| 9 | digest §9.1 / memory | 卡 `86418ba9` 由产出人自己 `review --pass` 结项（`lead:reviewer`），与项目自己的 N6「换身份复核、不自行 done」口径不一致，文档未标注这是自审 |
| 10 | 交叉引用 | 四份文档中没有 §8.7；全库 `§8.7` 只出现在 `2026-11-09-dsh-first-run-and-batch-resume-handoff.md:190` 等无关章节。若指「同剧情不立项」，该裁定**未被本轮重列**（digest/closeout/memory 均未出现） |
| 11 | D12 重列检查 | **通过**：四份文档均未把 D12 当新议题；`prompt-assembly-backlog.md:135` 仍为「已结项」，未被覆盖 |

## 5. 本轮遗漏、但应该做的事（只列，不执行）

1. 在 vitest browser 夹具里对同一 channel 打点（`RendererStartup.browser.tsx:109` 那个 `listeners` Set 本身就能读出 2 的来源：在 :136 前后打印 `Array.from(listeners)` 的 `Function.prototype.toString`/挂载顺序），**这是唯一能结掉 A/B/C 的动作**，且只需跑单文件。
2. 用「失败断言的实际 DOM」复核 B16：在 :281 前 dump `container.textContent`，一次就能看到页面给的是 `:730` 文案而不是空 —— 本轮实机已经采到同一条文案，却没把它和 :281 连起来。
3. 追 `diagnostics.endReason` 的消费方（D9 自己列了未核）。
4. 复核 `resolveCallDeadline` 的等号边界：`budgetRemainingMs === capMs` 时判 `ROOT_BUDGET_EXHAUSTED`（`resolveCallDeadline` 用 `>`），语义上应是 call timeout；无样本覆盖。
5. 给 D16 一个不动物流契约的候选修法评估：渲染层在 `workflow-main-generation.ts:41/104` 已持有 `modelId`，可在 begin 成功后自己 `recordActualModel`（`modelName` 从 `useLLMStore.models` 反查），代价远小于改 `MainGenerationSnapshot` + owner + 持久化契约。
6. 把 B11 的探针脚本与 `hasTitleBar` 选择器修好（或删掉该字段），否则下一轮还会拿它当证据。

## 6. 我不确定、需要补充的信息

1. `RendererStartup.browser.tsx` 实际失败行号：digest 写 `:138`，但现文件 `:138` 是 `invoke.mockClear()`，断言在 `:137`（差 1 行，疑似行漂移）。需给出失败用例名与 matcher 原文。
2. 我**没有执行**任何测试：B16 的 `:335 通过` 依赖 digest §4 的「2 failed / 835」失败清单；若该基线是在别的提交上跑的，B16 结论需重开。
3. B11 的 2 到底是「夹具多订」还是「cleanup 在 act 边界没跑」，静态推演给不出答案（按 React 语义应得 1）；必须夹具打点。
4. A2 实机里 `.cm-content` 575 / DB 2052 的真实关系（是否虚拟化截断），需要作者或主 agent 确认，否则「生成成功 2052 字」的证据强度打折。
5. 本轮是否有「可改码」之外的口头授权变更（尤其 B16 是否已允许改产品文案），文档里没有留痕，无法判断「判 A 还是判 B」的决策权归谁。
