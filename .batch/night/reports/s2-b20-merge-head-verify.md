# B-20 验证记录卡：`post-merge-check.ps1` 的 MERGE_HEAD 探测在 linked worktree 已正确（修后 11-19 23:07 版）

- 记录人：developer · AI writer项目组（群分身）
- 记录时刻：2026-11-21 00:31–00:35（Asia/Shanghai）
- 对象：`C:/Users/伯云飞/.dsh/bot/workspace/rotation/post-merge-check.ps1`（116 行，mtime `2026-11-19 23:07`，**仓外文件**：`git ls-files | grep post-merge` 为空）
- **本卡不改码，故无分支、无单测。**
- 结论：原文缺陷（linked worktree 里 `.git` 是文件 → 探测失败 → 假 RED）在当前版本上**不再复现**；`--git-path` 兜底确实被走到，且完整运行到末行 `POSTMERGE OK`。

## 一、探测命令与输出原文（`wt-p56`，无合并进行中）

```powershell
$w = "C:\develop\workspace\AI-writer\wt-p56"
Get-Item -Force (Join-Path $w ".git")        # -Force 必需：.git 有隐藏属性
Test-Path (Join-Path $w ".git\MERGE_HEAD")
git -C $w rev-parse --git-path MERGE_HEAD
Test-Path (<上一条输出>)
```

```
dotgit_is_file = True
dotgit_mergehead_test = False
gitpath_raw = [C:/develop/workspace/AI-writer/develop/.git/worktrees/wt-p56/MERGE_HEAD]
gitpath_test = False
```

读法：
- `dotgit_is_file = True` → 确认这是**linked worktree**（`.git` 是文件，不是目录），即原缺陷的触发条件成立；
- `dotgit_mergehead_test = False` → `Join-Path $Repo ".git\MERGE_HEAD"` 为假，与原文描述一致；
- 因此脚本必然走兜底分支（`:59`）：
  ```powershell
  if (-not (Test-Path $mergeHeadPath)) { $mergeHeadPath = (git -C $Repo rev-parse --git-path MERGE_HEAD 2>$null) }
  ```
- `gitpath_test = False` → 兜底路径同样为假 → 不进等待循环（`:62`）、不置 `$inProgress`（`:65`）、不产出「MERGE_HEAD 仍在」那行、不会因此判 RED。

## 二、完整运行输出（末行 `POSTMERGE OK`）

主检出（干净树）上完整跑一次：`pwsh -NoProfile -File <script> -Repo C:\develop\workspace\AI-writer\develop -NoNotify`

```
[2026-11-21 00:35:38] C:\develop\workspace\AI-writer\develop  exp/mainline-1119 @ 0d2671db  docs(ledger): 更新推送落地状态至 376ce148（0/0、?? 0 件）
  已跟踪改动 0 项 / 未跟踪 1 项
  pnpm check:fast EXIT=0  0 项不合规 / [check:fast] batch-hygiene ✓ 0.3s / [check:fast] 全部通过。
POSTMERGE OK  exp/mainline-1119 @ 0d2671db
  relay 投递：已关闭 (-NoNotify)
RUN_EXIT=0
```

（`未跟踪 1 项` 是 QA 本轮写的 `S2-premise-qa-recheck.md`，不计入已跟踪改动。）

附：同一脚本在 `wt-p56` 上完整跑一次的输出（该树有 14 项既存已跟踪改动，非本卡缺陷）：

```
[2026-11-21 00:31:52] C:\develop\workspace\AI-writer\wt-p56  agent/p56-wb-docs @ 7478b44a  docs(agents): 修正 --cwd 判据并清 Hy4 残档（p56）
  已跟踪改动 14 项 / 未跟踪 0 项
  pnpm check:fast EXIT=0  doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条 / [check:fast] doc-placement ✓ 0.2s / [check:fast] 全部通过。
POSTMERGE RED  已跟踪改动 14 项
```

读法：这次 RED 的原因是「已跟踪改动 14 项」，**不是** MERGE_HEAD——输出里没有「MERGE_HEAD 仍在」那行，也没有 10 分钟复核提示。也就是说 linked worktree 上跑，假 RED 已经消失，只剩真实的脏树红。

## 三、为什么「贴改前改后两段输出」在本件不可满足

1. 脚本在仓外 `rotation/`（Bot 工作区），`git ls-files` 无此件 → 无分支可开、无 CI 可跑、无单测可挂；
2. 「改前输出」没有任何存证：22:55 那次假 RED 只留了一份 relay stub（`.batch/night/bridge/to-owner/20261119-225614-postmerge-red.md`），没有「worktree 路径＋命令＋输出原文」三件套；脚本 23:07 就被自修过，改前字节不可复原（无备份）；
3. 因此本件只能给「修后行为已验证」，不伪造改前输出。原文那句「已等待 5000 ms」属于 23:07 之前版本的文案，当前版本没有这句。

## 四、附：一次被弃用的运行（如实记录）

先前在 `C:/develop/workspace/AI-writer/test-master` 跑过一次，输出 RED（`pnpm test EXIT=1`，缺 node_modules）。核对该树 HEAD 为 `dbad51d7`「Merge pull request #331 from EthanYoQ/codex/intel-unit-budget」——**它不是本项目的树**（无 `check:fast`，退回 `pnpm test`）。该次运行不作为本卡证据，只记在此以免后人重复踩。

<!-- DONE -->
