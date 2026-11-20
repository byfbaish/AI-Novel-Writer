# CARD-1121-B20 · `post-merge-check.ps1` 的 MERGE_HEAD 探测验证记录（结论：当前版本已正确，不改码）

- 状态：已交（验证记录卡，非改码卡）
- 来源：BACKLOG **B-20**（developer 11-19 22:5x 报）；Goal stage 2，2026-11-21 00:30 裁为「B-20 走 A：验证记录卡结案」
- 执行方：developer · AI writer项目组（群分身）
- From：developer · AI writer项目组（群分身）｜To：项目总负责人 · AI writer项目组（群分身）
- **本卡不改码，故无分支、无单测。**

## 0. 工作区前置【硬】
- 工作目录：`C:/develop/workspace/AI-writer/develop`（主检出，干净树）
- 分支：`exp/mainline-1119`｜起点 SHA：`0d2671db`
- 开工前三项校验：HEAD=`0d2671db`、`rotation/post-merge-check.ps1` 存在（116 行，mtime 2026-11-19 23:07）、`git diff --numstat HEAD` 为空
- 对象属性：**仓外文件**——`git ls-files | grep post-merge` 为空，`rotation/` 内 0 跟踪件；故无分支、无单测可挂（见 §3）

## 1. 起因
原文缺陷：linked worktree 里 `.git` 是**文件**而非目录，脚本仍判「合并未完成」→ 假 RED，而同一棵树 `check:fast` 为 EXIT=0。脚本 11-19 23:07 已被自修（`:59` 加 `--git-path` 兜底），但从未留复现记录。

## 2. 结论（一行）
**当前 11-19 23:07 版在 linked worktree 上探测正确（`dotgit_is_file=True`、`dotgit_mergehead_test=False`、`gitpath_test=False`，走到 `--git-path` 兜底、不进等待循环），完整运行末行 `POSTMERGE OK`；缺陷已被自修，本卡不改码。**

## 3. 三样证据（缺一不判）
1. **探测命令＋输出原文**：`wt-p56` 上 `Get-Item -Force .git` → `dotgit_is_file=True`；`Test-Path .git\MERGE_HEAD` → `False`；`git rev-parse --git-path MERGE_HEAD` → `C:/develop/workspace/AI-writer/develop/.git/worktrees/wt-p56/MERGE_HEAD`；`Test-Path` 该值 → `False`（确走 `:59` 兜底分支）
2. **一次完整运行到 `POSTMERGE OK`**：`[2026-11-21 00:35:38] … develop  exp/mainline-1119 @ 0d2671db`／`已跟踪改动 0 项 / 未跟踪 1 项`／`pnpm check:fast EXIT=0`／`POSTMERGE OK  exp/mainline-1119 @ 0d2671db`／`RUN_EXIT=0`
3. **「贴改前改后两段输出」不可满足的说明**：脚本在仓外、无分支无单测；「改前输出」无存证（仅 22:55 假 RED 的 relay stub，无 worktree＋命令＋输出三件套），且脚本 23:07 自修后改前字节不可复原 → 只给修后证据，不伪造改前

## 4. 证据文件
`.batch/night/reports/s2-b20-merge-head-verify.md`

## 5. 禁改区（本卡遵守）
`rotation/post-merge-check.ps1` 未改一字节；`archive/` 内任何件与 `MANIFEST.sha256` 未动；未改 `relay-notify.ps1` 与任何 watch 配置。

## 6. 遗留
- `rotation/` 等仓外运维脚本是否入 git ⇒ 下期议题 **B-24**（只记议题，不写方案、不估工时）
- `wt-p56` 现有 14 项既存已跟踪改动不属本卡，未清理

<!-- DONE -->
