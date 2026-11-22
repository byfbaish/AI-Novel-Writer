# 合并单 · S3-D4 来源冲突文案分层挂载

From: 项目总负责人 · AI writer项目组
To: 主身（merge 与 push 执行方）
日期：2026-11-22 11:1x（读于本地 `136c999c`）

## 1. 合并面

- 源分支：`card/s3-d4-conflict-copy`，头 **`136c999c`**（`fix(s3-d4): 来源冲突文案分层挂载，批次层只在批次真停时出现`）
- 父提交（base）：**`b4e8da53`**，`git merge-base --is-ancestor b4e8da53 card/s3-d4-conflict-copy` → 通过
- 目标：**`exp/mainline-1119`**（跟踪 `origin/exp/resource-ledger`）
- 合并时远端头：**`6f4d4f56`**（主身 11:2x 已推送留痕，远端头 `6f4d4f56`；执行前先 `git fetch` 确认主线＝该 sha 再合并）
- 分支相对远端头：`git rev-list --count origin/exp/resource-ledger..136c999c` → `1`（只多这一笔卡提交）

## 2. 改动面（`git diff --name-status b4e8da53..card/s3-d4-conflict-copy -- src electron scripts`）

```
M	src/components/panels/AIOutputPanel.tsx
M	src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
M	src/components/ui/SourceConflictNotice.tsx
M	src/components/ui/__tests__/SourceConflictNotice.test.tsx
M	src/shared/source-conflict-copy.ts
```

`git diff --shortstat b4e8da53..card/s3-d4-conflict-copy -- src electron scripts` → `5 files changed, 133 insertions(+), 26 deletions(-)`；**全 `M`、无 `A`、无 `D`**，五条全在卡面 §3 白名单内。

不涉 `.batch/`、不涉 `archive/`、不涉 `docs/`；与主线上已入库的卡面 v2（`635d0910…`）与 d10 §2 改写无文件交集 ⇒ 预期无冲突。

## 3. 合并前判据（主身执行时逐条贴输出）

1. 主线已快进到远端头：`git rev-parse --short exp/mainline-1119` = `6f4d4f56`
2. 源分支仍是 `136c999c`：`git rev-parse --short card/s3-d4-conflict-copy`
3. 分支上工作区干净：`git status --porcelain -uall` 为空（切换前应看到 d4/d10/d11 卡与 `AGENTS.md` 的 ` M`，那是分支落后主线所致，切到主线后应消失）
4. 合并后跑 `pnpm check:fast`，`EXIT=0`
5. 合并后用卡面 v2 口径复核（**只读、不改**）：
   - `git diff --name-only 6f4d4f56..exp/mainline-1119 -- src electron scripts` → 恰好上面 5 个路径
   - `git diff --name-status 6f4d4f56..exp/mainline-1119 -- src electron scripts` → 无 `A` 行

## 4. 建议命令（主身执行；`--no-ff` 保留卡号可追溯）

```bash
git fetch origin
git switch exp/mainline-1119
git merge --ff-only origin/exp/resource-ledger      # 到 6f4d4f56
git merge --no-ff card/s3-d4-conflict-copy -m "merge(card/s3-d4-conflict-copy): 来源冲突文案分层挂载（CARD-S3-D4）"
pnpm check:fast
git push origin exp/mainline-1119:exp/resource-ledger
```

## 5. 回滚点

- 合并前主线头：**`6f4d4f56`**（回滚：`git reset --hard 6f4d4f56` 后 `git push --force-with-lease`，或 `git revert -m 1 <merge-sha>`）
- 分支头不动：`136c999c`（如需重做，从它继续）
- 本卡不改库、不改迁移 ⇒ 无数据回滚需求

## 6. 合并后移交

- 合并 sha 出来后：QA 判词挂该 sha，产品经理把缺陷稿 D4 行转 ✅
- D7 apply 的放行闸＝「D4 已入库且远端头更新」，不按时间；放行后一次一张，D7→D16→D10→D11
