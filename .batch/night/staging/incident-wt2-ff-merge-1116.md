执行方：developer
事故件：`agent/wt-2` 未经终口径即快进合并，已复原
落盘时间：2026-11-16 06:47（CST）

## 一、时间线（全部本机时钟）

| 时间 | 事件 |
|---|---|
| 06:32 | 项目总负责人批「乙」（先把 `545988b2` 合入 `agent/wt-2`，再以合并后起点开工） |
| 06:35:28 | 我在 `C:\develop\workspace\AI-writer\wt-2` 执行 `git merge --ff-only 545988b2`，HEAD `26627655` → `545988b2`（Fast-forward，8 files / +190 −66） |
| 06:34–06:36 | 项目总负责人改口「甲」`26627655`，并明令不许动 `agent/wt-2` 基线 |
| 06:36:24 | 我核对后执行 `git reset --hard 26627655`，复原 |
| 06:41 | 群内如实上报（@项目总负责人 @大肥鱼） |

## 二、证据命令与输出

```
# 合并确实发生（reflog 留痕）
git -C wt-2 reflog -n 3
  → 06:35:28 merge 545988b2: Fast-forward
  → 06:36:24 reset: moving to 26627655

# 复原后状态
git -C wt-2 rev-parse --abbrev-ref HEAD   → agent/wt-2
git -C wt-2 rev-parse --short HEAD        → 26627655
git -C wt-2 status --porcelain            → （空，0 行）
git -C wt-2 log -1 --oneline              → 26627655 ...
```

## 三、影响与恢复

- 合并前 `wt-2` 工作区是干净的（`porcelain` 0 行），没有未提交改动被覆盖。
- `545988b2` 仍挂在 `exp/resource-ledger` 上，未丢；`wt-2` 现回到 `26627655`。
- 恢复方式只有 `reset --hard`：因 `--ff-only` 合并未产生合并提交，`revert` 不适用。

## 四、后续约束（本人承诺，已入群）

1. `wt-2` 只读不写；本卡（p55）改码由 WorkBuddy 在该槽位做，我不代做。
2. 起点口径未终时不动任何槽位；口径以「最后一条明确指令」为准，改口期间先停手问一句。
3. 动他人槽位前，先跑只读取证（`merge-base --is-ancestor` / `merge-tree`），把结论报给派单方再动手。

## 五、口径冲突待裁（06:46 新指令）

06:46 项目总负责人又下「选乙，先跑 `merge-base --is-ancestor` 与 `merge-tree`，干净就在 wt-2 本地合并，再按新起点重出 `.v2` 卡面」；06:46（同一分钟稍后）的事故处置又写「从此刻起 `wt-2` 你只读不写」。

我按更晚且更严的「只读」执行，未再合并。只读结论供裁：

```
git merge-base --is-ancestor 545988b2 agent/wt-2   → exit 1（wt-2 不含该提交）
git merge-tree --write-tree agent/wt-2 545988b2    → fd94d0cf9f22b99c3fde44af987aa45a8625002b, exit 0（无冲突）
```

即：技术上可干净快进，但需一条明确的「允许写 `wt-2`」指令才执行；否则按甲 `26627655` 定本。
