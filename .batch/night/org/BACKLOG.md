# BACKLOG

认领规则：每条只有一个 owner，认领时把 `owner:` 填上自己的身份（`群名:Bot`），并在群里发一行索引。
不认领不动手；各群回归自己主线时按下列顺序挑。

## B-1 临时碎片清理（等各群回归主线时认领）

依据：`workspace\reports\aiwriter-temp-files-audit-20261117.md`（跟班审计）。今日已按批准执行头两项，其余等认领。

已做（2026-11-17，留痕 `workspace\org\temp-cleanup-log-20261117.txt`）：
- `develop/.tmp-ui`：删除 331 个 `*.mjs` 一次性探针（0.34 MB），保留 png/md/json/cjs。
- `.backups`：按「留最近 3 份」保留 3 个最新快照目录 + 3 个最新散文件，其余 8 项（0.17 MB）打包至 `.backups-archive\backups-archive-20261117-160935.zip` 后删除。

修正后的实测（审计报告口径偏大，以此为准）：

| 项 | 实测 | 报告口径 |
|---|---|---|
| `.tmp-ui` | 429 文件 / 38.8 MB（其中 .mjs 331 个仅 0.34 MB） | 483 条目 / 87.5 MB |
| `AI-writer/.backups` | 996 文件 / 116.2 MB，全部在 4 个快照目录里，无 996 个散 `.bak` | 996 个 `.bak-20261108` |

待候选：
- [ ] B-1a `.backups` 三个项目快照目录 116 MB（`proj-pre-a1` 42.35 MB、`proj-pre-d12` 42.35 MB、`proj-pre-b1replay` 31.27 MB，前两个内容清单仅 2 条不同，近乎重复）。可选：整体打包归档后删目录，或只先去重复份。**需主人一句话**，未批不动。
- [ ] B-1b `_scratch-d18` 45.6 MB（469 文件，12 天）—— 认领后按「未跟踪＋未引用＋>30 天」逐档判。
- [ ] B-1c `_backup-2026-11-01` 23.2 MB（16 天）。
- [ ] B-1d `AI-writer` 根不是 git 仓库，`.backups`／`_scratch-d18`／`_trash`／`_backup-2026-11-01` 全在仓库外，既不进 `git status` 也不受 `.gitignore` 约束——要么纳入，要么明确「仓库外仓」。

## B-2 分支清理（负责人认领）

现状：18 本地分支／5 远端／11 worktree。
- 8 个已并入主线，可直接删：`agent/wt-1`、`agent/wt-2`、`agent/wt-3`、`agent/p51-median`、`docs/fix-workbuddy-links`、`dev_byf`、`exp/arc-tree-v2`、`exp/world-state`。
- 3 个待验：`card/1117-C`、`card/1117-D`（已并入整合分支）、`card/git-track-ops-1117`。
- 4 个无人认领需定去留：`docs/bot-session-identity`、`agent/p56-wb-docs`、`keep/d9-d16`、`keep/night-w1-w5`。
- 2 个 detached worktree 需处置：`night-probe`、`test-master`。
- 缺口：没有分支登记册（字段见 skill `project-git-workflow`），建册后每条分支都要有 owner 与去留期限。

## B-3 集成验收（合并后暴露，负责人裁）

A、D 两卡各自过验，合进 `card/git-track-ops-1117` 后红两处：
- `check-batch-hygiene` 报 236 项不合规，全部在 `.batch/` 内（带 `.vN` 文件名、缺末行换行）——白名单让这批文件进了机检视野，而它们正是 B 卡要收编的对象。
- A 卡测试「`scripts/ops/*.mjs` 源码不含 `wc -l`」被 D 卡新增的 `check-batch-hygiene.mjs` 触发（该文件里出现该字样）。
判据二选一：机检只对已收编路径生效；或先做收编卡再收紧。修完整体重验，通过后才落主线。
