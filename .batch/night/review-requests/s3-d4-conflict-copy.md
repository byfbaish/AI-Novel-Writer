# 派验单 · CARD-S3-D4（批次中止与「来源已变化」文案分层）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方）
执行方：developer · AI writer项目组
派单件：`.batch/night/staging/s3-d4-dispatch.md`
卡面：`.batch/night/cards/s3-d4-conflict-copy.md`
起点/base：**`b4e8da53`**；分支：**`card/s3-d4-conflict-copy`**
放行依据：主人 10:18 放行（群管理分身传达原话「就按照负责人说的那个顺序开」）
外派位：静态活可外派（只登记、不进判据）；**不可外派：实机复验须在 `develop` 由 developer 执行**（主人 11-21 19:07；AGENTS 第 8 条）

## 判据（逐条要输出原文；缺一条即 FAIL）

1. 界面/日志证据：同一屏读到两层文案原文（中/英各一份），且「只有单稿冲突、批次未停」时**只**出现产物层。
   > **判据① 收口（2026-11-22 11:3x，主身裁定 a，负责人留痕）**：批次层已实机取证（§4.1 原文＋两条 batch run `failed`）、单稿档不误现批次层（§4.2 `batchLayers=0`、全屏无「本批已停止」）即算过；「两层同屏」前提依赖单稿层挂载点（现行 `AIOutputPanel.tsx:465-500` 单稿块不挂 `SourceConflictNotice`），**归 D4b，不在本卡判据**。`exitCode=1` ＝取证脚本自身等待批次根 run 终态的 300s 超时，非产品崩溃、非实例残留；终态批次 run reload 后不在 `generation:list` 属既存行为，记观察项不计缺陷。
2. 单测：整文件汇总行 + 末行 `EXIT=`（不许 `-t` 过滤）；有中止 / 无中止两支各一条，断言文案互斥。
3. 改动面全落白名单：`git diff --name-only b4e8da53..card/s3-d4-conflict-copy -- src electron scripts` 每行都在卡面 §3 白名单内；有白名单外路径即 FAIL（须贴 `--numstat` 原文）。
4. 无新增生产文件：`git diff --name-status b4e8da53..card/s3-d4-conflict-copy -- src electron scripts` 无 `A` 行（白名单内取证脚本须逐条列出并标注）。
5. 批次层文案含明确后果与下一步（停在哪、要重发起），不是「来源已变化」的同义重复。
6. `pnpm check:fast` 末行 + `EXIT=`；实例纪律 `instancesThisRun=1`、`leftoverElectronProcesses=0`。

## 判定纪律

- 只判本单列出的判据，不追加卡面外要求；判据分母＝卡面 `5bc84e8b1f1fb4254c4d9044ae8e240fd702b024f3a36fe991a7fc92587e81e3` + 本派验单。
- 判词落 `.batch/night/reports/s3-d4-qa-firstcheck.md`（含命令原文与输出摘录），并投 `.batch/night/bridge/to-owner`。
- 交件报告用 `-t` 过滤、或只贴片段不贴整文件汇总行的，按无效证据判 FAIL（D13 教训）。
- 既有断言的改动只允许「只加不减」，报告须点名改了哪条；未点名视为 FAIL。
- 判定面：developer 交件的提交 sha（不许判工作区中间态）；提交面与工作区不一致时以提交面为准并记录差额。

> 判据 3/4 修订（2026-11-22 10:2x，负责人裁定）：原措辞「`--numstat` 输出为空」只适用于零改码卡（如 D16／D1）；本卡要改 `AIOutputPanel.tsx` 与共享文案模块，故改为「改动面全落白名单 ＋ 无新增生产文件」。判定面仍是提交 sha，不是工作区。
