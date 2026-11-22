# CARD-S3-D4 · 批次中止与「来源已变化」文案分层

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v2 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`b4e8da53`**（S2 三支已合并；本卡 base 一律 `b4e8da53`）
顺序：**S3 第一张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行（只改 §3 白名单内文件）；实机复验在 `develop` 由 developer 执行、不外派；证据只认命令与输出原文，push 只由主身。

## 1. 现状（读于 `b4e8da53`）

- 缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md:69`：**🟡 已实施，待实机**（2026-11-07 独立复核兑现；已合并主区 `e0704a07`；4 处 browser 旧断言已同步；仍属单测级）。正文 `:468-490`。
- 现有文案：`src/components/panels/AIOutputPanel.tsx:398` — `recovery.sourceStatus === 'conflict' && !recovery.saved` 渲染「来源已变化；候选仍可复制，不能直接保存。」
- 同语义散落：`src/components/editor/CodeMirrorEditor.tsx:678/694/716`、`NarrativeThreadEditor.tsx:841/1028`、`VersionHistory.tsx:281`、`ArchFileViewer.tsx:1029`。
- 缺口：所有提示只说「这一稿不能落库」，没有一处说「这一批到此为止，后续单元不会再跑」。

## 2. 要做什么（只做文案分层，不动状态机）

同一份 `sourceStatus === 'conflict'` 驱动两层表述，且两层各有自己的前置条件：

- **产物层**（已有）：这一稿不能保存，仍可复制。
- **批次层**（新增）：本批已停止，后续单元不会再执行；需重新发起。**只在批次确实已停止时出现**——判据必须来自真实批状态（例如该批的 run/批次状态为中止），不能只看 `sourceStatus === 'conflict'`，否则单稿冲突会误报「整批已停」。
- 两层文案放同一处共享常量（`src/shared/` 或既有文案模块），由同一份 `sourceStatus` 与其批状态组合渲染；不要求改六个散落文件。

## 3. 白名单与禁改区

- 可改：`src/components/panels/AIOutputPanel.tsx`、承载文案的共享模块（新增或既有）、其单测；`AIOutputPanel` 相关 browser 测试只允许同步断言。
- 禁改：`src/components/editor/*`、`NarrativeThreadEditor.tsx`、`VersionHistory.tsx`、`ArchFileViewer.tsx`（六处散落本卡不改，登记为一致性遗留）；`sourceStatus` 判定逻辑；D1/D2 状态机与 `GENERATION_SOURCE_CHANGED` 触发点；`chapter-materials.ts`、D12 注入与重跑区。
- 不许为让文案出现而改批次真假的判定。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. 实机：制造「来源冲突 + 批次中止」，同一屏读到两层文案原文（中/英各一份）。
2. 实机：只有单稿冲突、批次未停时，**只**出现产物层，不出现「本批已停止」。
3. 批次层文案含明确后果与下一步（停在哪、要重发起），不是「来源已变化」的同义重复。
4. 单测：两支分支各一条（有中止 / 无中止），断言文案互斥；既有断言改动只加不减并在报告点名。
5. `pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`。

## 5. 外派位

- **静态活可外派**：读码定位「批状态从哪读、两层文案应挂哪个组件」、给复现步骤清单；产物只作登记，不进判据。
- **不可外派：实机复验须在 `develop` 由 developer 执行**（主人 11-21 19:07；AGENTS 第 8 条）。

## 6. 回执与交付

- 分支：`card/s3-d4-conflict-copy`，从 `b4e8da53` 起；一卡一分支、提交后用点名路径 `git add`（禁 `-A`）。
- 交件：报告 `.batch/night/staging/s3-d4-conflict-copy-report.md`（全部命令与输出原文）；群里交件 @ 项目总负责人 与 QA。
- 回执走 `.batch/night/bridge/to-owner`。

## 7. 实例纪律

单实例复用、跑完必关（`try/finally` + `app.quit()`）；evidence 含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）。

## 8. R4 判据（作用域写死）

判据二段，缺一不可：

1) `git diff --name-only b4e8da53..card/s3-d4-conflict-copy -- src electron scripts` 每一行都落在本卡 §3 白名单内（本卡要改 5 个文件，不再要求输出为空）。
2) **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下的文件；若本卡白名单允许新增（仅验收/取证脚本），须逐条列出路径并在判词中标注「白名单内新增」。`git diff --name-status b4e8da53..card/s3-d4-conflict-copy -- src electron scripts` 不得出现 `A` 行（白名单内新增除外）。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。

> **判据一修订（2026-11-22 11:0x，负责人裁定）**：原「`git diff --numstat … 输出为空`」只适用零改码卡（D16／D1）；本卡改 5 文件 +133/−26，照字面必 FAIL，故按派验单 `.batch/night/review-requests/s3-d4-conflict-copy.md`（sha256 `23f99b3f18ca96d9ada6f4ef347db5ae2e6a6e838d90609c8a4ff5d65324a144`）口径执行——**判据分母以派验单为准，本卡 v2 仅作归档对齐**。base 由 `5a285e83` 更正为 `b4e8da53`（`b4e8da53` 那笔入库时漏改）。
