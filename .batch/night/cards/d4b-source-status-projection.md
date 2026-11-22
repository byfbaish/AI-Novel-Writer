# CARD-D4b · 单稿层 `sourceStatus` 投影（D4 判据② 正面）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：S3 收口后的主线头（**派单时按当时 `origin/exp/resource-ledger` 头填写，不写死旧值**）
排期：**S3 之后**，与 D9b（单次调用阶段态透传）同批；**S3 期间不派卡、不建分支**

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡、`.batch/night/staging/s3-d4-conflict-copy-report.md`（§7 第 1 条）。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07，另见 11-22 新增 §2 第 8 条）；`ruling-dispatch` v6 · 2026-11-20；本卡 v1 · 2026-11-22。
③ 三条口径：授权边界最窄执行（本卡只补 D4 判据② 的正面取证，不顺手改文案语义）；实机复验不外派；证据只认命令与输出原文。

## 1. 缺口（D4 为什么只能判反面）

D4 判据② 「只有单稿冲突、批次未停时，**只**出现产物层」当轮只能判反面（不得出现 `data-conflict-layer="batch"`、不得出现「本批已停止」），三条原因（developer 交件报告 §7 第 1 条，已核）：

1. 成功的单稿 run 不写 `recovery_candidates`：`electron/migrations/baseline-schema.ts:131-155` 注释写明该表只收失败生成的可见产物；
2. 单稿写稿块（`visibleRuns`）历史上不渲染 `SourceConflictNotice`：`src/components/panels/AIOutputPanel.tsx:465-500`；
3. 恢复上下文不携带冲突态：`src/shared/generation-owner-contract.ts:220-250`（`GenerationRecoveryContext`）无 `sourceStatus` 字段。

而冲突态在主进程侧**已有**：`src/services/workflows/chapter-materials.ts:45`（`sourceStatus?: 'current' | 'stale' | 'legacy' | 'invalid'`）与 `:617`／`:621`／`:630` 的判定分支。缺的是「把已判定的值送到渲染层单稿块」这一段。

## 2. 要做什么

把主进程已判定的 `sourceStatus` 经恢复上下文投影到单稿写稿块，使其在「单稿冲突、批次未停」时渲染产物层（`SourceConflictNotice`），从而正面可判。

- 只加字段与渲染分支，不改判定逻辑：`chapter-materials.ts` 现有 `sourceStatus` 判定分支（`:617`／`:621`／`:630`）原样复用，不许在这里新增“更严格/更宽松”的判定。
- 投影只走既有恢复上下文（`GenerationRecoveryContext`）通道；**不新增 IPC 频道**，`generation:read-context` 的载荷形态与既有字段不动，只加一个可选字段。
- 渲染只在单稿块加 `SourceConflictNotice`，批次层判定与 D4 已入库的两层互斥逻辑不改。

## 3. 白名单（三处，只准写进本卡）

1. `src/shared/generation-owner-contract.ts:220-250` —— `GenerationRecoveryContext` 增 `sourceStatus?: 'current' | 'stale' | 'legacy' | 'invalid'`（可选，缺省＝不渲染）。
2. 主进程填值点：`src/services/workflows/generate-draft.command.ts` 组装恢复上下文/首稿任务处（按 `chapter-materials.ts` 已判定的 `sourceStatus` 原值透传；只加赋值，不改判定）。
3. `src/components/panels/AIOutputPanel.tsx:465-500` —— 单稿写稿块按该字段渲染 `SourceConflictNotice`（产物层），其单测同步。

禁改：D4 已入库的批次层逻辑与文案（`src/shared/source-conflict-copy.ts` 现有文案不改）；`recovery_candidates` 写入语义；`generation:read-context` 契约的既有字段与载荷形态；`src/components/editor/*`、`NarrativeThreadEditor.tsx`、`VersionHistory.tsx`、`ArchFileViewer.tsx`；D1/D2 状态机与 `GENERATION_SOURCE_CHANGED` 触发点；`chapter-materials.ts` 的判定分支（只读复用）。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. **正面可判（唯一主判据）**：实机——构造「单稿冲突、批次未停」，单稿块上出现产物层文案（原文贴出），且**不出现** `data-conflict-layer="batch"`、不出现「本批已停止」类批次层文案；同屏文本原文 + 触发路径 + 读取命令与输出原文。读的是「既有产物」还是「新投影字段」须在证据里写明。
2. 单测：整文件汇总行 + 末行 `EXIT=`；至少一条断言「`sourceStatus` 缺失时不渲染产物层」（缺省不误报）。
3. 实例纪律：`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses` 须 0，并贴 `tasklist | grep -c electron` 原文。
4. 改动面：`git diff --name-only <base>..card/d4b-source-status-projection -- src electron scripts` 每行落在 §3 三处白名单内；`--name-status` 无 `A` 行（白名单内取证脚本须逐条列出）。

## 5. 外派位

- **静态活可外派**：读码确认投影落点与字段类型、给改动点清单；产物只作登记，不进判据。
- **不可外派：实机复验须在 `develop` 由 developer 执行**（主人 11-21 19:07；AGENTS 第 8 条）。

## 6. 回执与交付

- 分支：`card/d4b-source-status-projection`，起点＝派单时主线头；一卡一分支、提交用点名路径 `git add`（禁 `-A`）。
- 交件报告：`.batch/night/staging/d4b-report.md`（命令与输出原文）。
- 回执走 `.batch/night/bridge/to-owner`；群里交件 @ 项目总负责人 与 QA。

## 7. 实例纪律

单实例复用、`try/finally` + `app.quit`、父死连子进程树收；evidence 增 `instancesThisRun`／`exitCode`／`leftoverElectronProcesses`（须 0）。

## 8. 停手条件

- 投影必须动 `generation:read-context` 既有字段或载荷形态才能实现 ⇒ 停手报，交作者裁定（本卡只允许“加可选字段”）。
- 实机起不来或第二次仍起不来 ⇒ 立刻报「跑不起来 + 原文原因」。
- 为凑正面而 mock 掉真实路径、或在面板层硬塞文案 ⇒ 视为违规，判 FAIL。
