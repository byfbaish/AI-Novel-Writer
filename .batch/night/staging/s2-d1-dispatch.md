# 派单 · CARD-S2-D1（同 run 多调用复验，零改码）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）
抄送判：QA · AI writer项目组（首验，派验单 `.batch/night/review-requests/s2-d1-multicall-reverify.md`）

## 派单依据

- 卡面：`.batch/night/cards/s2-d1-multicall-reverify.md`（v1 · 判据见 §4）
- 派验单：`.batch/night/review-requests/s2-d1-multicall-reverify.md`
- 前置：D13 已 ✅（提交 `a4503f10`）、D9 已 ✅（QA 判词 `0e2b99f5…`，提交 `8ae59d0a`）
- 必读确认三行：卡面 §0 原文照抄进开工回报，缺一行不许 start

## 起点与工作树（重要）

- 起点钉：`exp/mainline-1119` 头 **`0f0ca3ee`**（D13、D9 两支均未合并，本卡不需要它们）。
- 若 `develop` 工作树当前正在 `card/s2-d9-call-timeout`（HEAD `8ae59d0a`）：**允许就地取证**，但证据里必须写明 `git rev-parse HEAD` 实测值与当前分支名，不得为跑本卡去 merge／rebase／切分支改动历史。
- 分支：`card/s2-d1-multicall-reverify`，从 `0f0ca3ee` 起（群管理分身 2026-11-22 04:5x 定）。
- **分支上不提交**：本卡零改码，没有产物需要入库；取证脚本放 `.runtime/`（不入库、不进 `scripts/`）。

## 要证的事（一句话）

同一 run 内「短细纲」与「正文」两次调用都真实发生、都被允许落库，全程无 `GENERATION_SOURCE_CHANGED`，run 有终态。

## 交件必报（缺项按不通过）

1. `generation_attempts` 两行原文：`run_id` 相同、`purpose` 不同（短细纲／正文）。
2. 无 `GENERATION_SOURCE_CHANGED` 的取证命令与输出（计数为 0）。
3. `generation_runs`（或 roots）该 run 的终态行原文。
4. 第二次产出被采用：`drafts` 行原文或界面读数。
5. 实例纪律三项：`instancesThisRun=1`、`exitCode`、`leftoverElectronProcesses=0`。
6. R4 双空：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均为空（证明零改码）。
7. 命令原文：验收命令 + 末行 JSON + `EXIT=`；既有相关单测整文件汇总行（本卡无新单测）。

## 停手条件

- 真复现 `GENERATION_SOURCE_CHANGED` ⇒ 停手贴原文，**不许当场改码**，等裁定。
- 取证需要改生产代码或单测才能跑 ⇒ 停手报，不许改。

## 判据冻结

本卡判据不再改；QA 若发现措辞歧义，按现状判、疑点写进判词。
