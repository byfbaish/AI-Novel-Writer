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
- [x] **B-1 认领结论（19:1x，项目总负责人）：五个目录全部「无人认领」。** 取证：`recall`（自身/群/团队记忆）、`read_own_chat`、`read_group_chat` 三次检索这些目录名均零命中，我这边没有任何建目录记录。实测元数据：`proj-pre-a1` 391 文件 44M、`proj-pre-d12` 391 文件 44M（**文件路径清单完全相同**，`project.db` 同为 14,405,632B 但 md5 `c338bad5…`≠`73480417…`，故不是字节重复份，是同一时点两次快照）、`proj-pre-b1replay` 194 文件 32M（db 16,969,728B）、`_scratch-d18` 469 文件 47M（11-04/11-05）、`_backup-2026-11-01` 118 文件 24M（11-01「清除前」）。全部为 `.ai-novel/project.db`＋章节 txt 的项目数据快照，均在 git 之外、无 README。**删不删等主人一句话，我不动一个字节。**
- [ ] **B-1e 规矩（大管家 11-17 定）：任何留档目录/归档件落盘时，同目录必须有 `README.md` 或首行说明**——建它的人、时间、用途、保留期限、过期后给谁。无说明一律按「待认领孤儿」进本 backlog，不许静默留着。
- [ ] **B-4 合并前清场口径（负责人 19:2x 定，待并入协作规则）**：凡卡内在 `.batch/night/` 有改动的，合并进 develop 前须三步：①把目标工作区该目录的未跟踪副本整体 `tar.gz` 备份（同目录留 `README.md` 写谁/何时/用途/期限）；②逐件哈希比对未跟踪副本与待合入件，输出 `.log`；③比对结果中「实质不同」的件逐条取舍并写进合并报告，只差行尾的件以分支为准。理由：B 卡合并时 255 件撞车（232 件字节相同、23 件不同：18 件只差行尾、5 件实质差异）。
- [ ] **B-5 流转件评审追加段的落法（负责人 19:2x 定）**：派验单/卡面在评审过程中追加的终裁、退回、修订、终审段落，一律另存 `<卡号>-rulings.md` 单独成文，原文件字节不动。首个实例：`review-requests/CARD-1117-B-rulings.md`（7,281B，含 §五～§八）；`CARD-1117-B-baseline-intake.md` 恢复为 3,540B 交付版。

- **B-6 `archive/` 193 件未入 git（QA 在 F 卡首验提出，我受理，F 卡不改）**
  - 事实：B 卡收编把 193 件搬进 `archive/`，但 `.gitignore:93` 挡住，从未入库；本机 worktree 里没有 `archive/` 目录，所以 F 卡判据 7 的「archive 尾行 0」是在空集上成立，真反证来自单测夹具（`check-batch-hygiene.test.mjs:193`/`:206`）。
  - 影响：F 卡的 `final-newline` 整目录豁免保护的正是这批件，而卡面又要求「原样留档、事后哈希对账」——它们一旦随工作区清理消失，对账基线一起消失，且没有任何提交能证明存在过。
  - 待办（落主线后第一张卡）：二选一——给 `archive/` 加 `!` 反向包含后入库（186 件量级，需清场口径）；或明确「仅留本机」并写进备份口径 + 带 README（谁建/何时/用途/保留期/过期给谁）。

- [ ] **B-16 `archive/` 是否整目录豁免 batch-hygiene 规则（11-19 12:26 记）**
  - 事实：F 卡只给 `archive/` 豁免了 `final-newline`，`versioned-filename`（同目录须有主件）对 archive 仍生效。CARD-1118-D 把 82 件 `.vN` 工作件移进 `archive/` 后，`--disk` 计数会上升（`--all` 只扫已跟踪面，仍为 0）。
  - 待办：评估是否给 `archive/` 整目录豁免（理由：留档区不是流转件区，主件判据在这里无意义），或改用「archive 内文件名去掉版本段」的替代方案。改规则要动 `scripts/ops/check-batch-hygiene.mjs`，须单独出卡、不得在收编卡里顺手改。

- [ ] **B-17 `archive/` 全量补登记 47 件（QA 13:2x 勘误后扩账，取代原「roster 22 件」口径）**
  - 事实：`archive/` 实存 97 件＝已登记 50 ＋ **未登记 47**：`.vN` 22 件全在 `archive/roster/`（`identity-roster.v2/.v3/.v3.1/.v3.2…`），另有非 `.vN` 老档 25 件（`1107/` 15、`resume-1114/` 6、`p9-prefix-restart-1113/` 1、`pre-restart-1113/` 1、`P9.json`、`wake-later.json`）。均不在 CARD-1118-D 的 82 件清单内。
  - 待办：按 B-1e 补进 README（谁建/何时/用途/保留期/过期给谁），或并入下一次 archive 整理卡。

- [ ] **B-18 卡与派验单必须成对出（负责人 13:26 自记）**
  - 事实：CARD-1118-D 只出了卡面、没出派验单，QA 只能按卡面＋执行方的裁定请求单判。同类缺失第二次（CARD-1118-B 时由 QA 指出后补过一次）。
  - 规矩：出卡与出派验单是**同一个动作**；卡面无对应派验单（`review-requests/<卡号>-*.md`）不得翻「在办」。出下一张卡前先 `ls review-requests/ | grep <卡号>` 自检。

- [ ] **B-19 `AI-writer/tmp-dev/` 遗留 scratch 件待清理（QA 20:5x 观察，负责人 21:0x 受理）**
  - 事实：QA 首验 CARD-1119-E 时发现该目录有 13 个 B/C/D 卡遗留 scratch 件；我 21:0x 实测顶层 25 个条目。均在 git 之外、无 README。
  - 规矩：先按 B-1e 判「谁建／何时／用途／保留期」，能追到卡号的并入该卡清理记录，追不到的按「待认领孤儿」报主人后删。**不得为图干净先删后问。**

- [ ] **B-20 `post-merge-check.ps1` 的 MERGE_HEAD 探测在 linked worktree 里误判（developer 22:5x 报，负责人 23:1x 受理）**
  - 事实：linked worktree 里 `.git` 是文件而非目录，脚本仍判「合并未完成」→ 假 RED；同一棵树 `check:fast` 本身 EXIT=0。
  - 规矩：修脚本须单独出卡（改码）；在那之前合并后核以 `check:fast` 末行 + `check-batch-hygiene --all` 为准，`post-merge-check.ps1` 的红先看 MERGE_HEAD 探测这条已知缺陷再定性。
- [ ] **B-21 `archive/` 待补字段清理（stage 2 遗留 8 条，2026-11-20 记）**
  - 现状：`.batch/night/archive/README.md` §二 97 行里 8 行仍带 `待补`——1 条缺「谁建」（`resume-1114/wakeup-inbox/dsh-wake-20261114-0205-7426.md`，唤醒便条无署名）、7 条缺「何时」（`cards/p51-median-gap.v2.md`、`review-requests/p56.v2–v5.md`、`review-requests/reboot-hy4flash-sync.v2.md`、`staging/d1-delivered-path-report.v2.md`，原件均无日期）。
  - 口径（项目总负责人 2026-11-20 00:31 裁）：能查则查、查不出永久标 `待补` 并写清复核过程，不许写「未知」、不因此卡 stage 2。
  - 追平方式：下一张补登记卡；逐版时间须从台账/派验单留痕取得，禁按同族件推定日期填表。

- [ ] **B-22 `--all-tracked` 90 文件／289 处命中须在推送前清零（developer 01:2x 报，负责人 01:40 出卡）**
  - 事实：`058c0867` 上 `pii-scan --all-tracked` 报 90 文件／289 处（user-path 106・secret 37・email 24・phone 14・privacy-word 10・idcard 9・name 9）；其中**真名只 8 文件／17 处**，其余 272 处是测试夹具与设计字样（`@example.invalid`、`sk-` 开头的设计字样等）。`.batch/night/staging/tmp-c9ff5961.jsonl`（1,591,957B，blob `b5cbf42a`）是完整会话日志，含 system prompt，已随 CARD-1117-B 入库。
  - 处置：出 `cards/CARD-1119-H-pii-preflight.md`（判据 7 条、红线 6 条，`--all-tracked` 命中 0 为唯一门禁）；真名改文本、假数据进 `.piiallow`（每行带依据）、日志件 `git rm --cached` 后移出到 quarantine 并留 md5。禁批量改测试夹具。
