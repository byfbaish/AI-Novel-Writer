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
- [x] **B-1a 去向＝转主人裁（2026-11-21 01:5x，S3 实测改写；此前「原件已不存在」的结论作废）**：`proj-pre-d12` **未删除，是被改名搬进 `.batch-a/d12proj`**——391 文件、`project.db` 14,405,632B、md5 `734804176281b0bd979133950522a181`，与旧记三个数逐项相符；改名人与时间无留痕。`proj-pre-a1`（db md5 `c338bad5…`）与 `proj-pre-b1replay`（db 16,969,728B）在 `.batch-a` 两个 `project.db` 里都没有，**仍未找到**。`.batch-a/` 整体 860 件／103,613,677B（du 101 MB）、无 README、在 git 之外，按 B-1e 属待认领孤儿；内有 `d12-manual-test/`（28 件／460K）、`_removed-txt/`（10 件／80K）、`d12proj/`、`proj/`（431 件，db 19,574,784B／md5 `e1cb3b49…`，11-15 新快照）。处置结论（主人 11-21 02:08「全按建议执行」已批准）：**打包核验后删，执行人＝管家跟班，组内任何人不得改动 `.batch-a` 与 `tmp-dev`**；在跟班核验完成前，本条不写「已删」。取证见 `.batch/night/org/s3-disposition-1121.md` §一、§二。
  11-20 07:0x 实取清单：现存可清理约 135 MB（五项明细见 C:\tmp\aiwriter-snapshot-inventory-1120.md）；closecheck 里的 190 MB 为 11-20 早先口径，已作废，不回改历史件。
- [x] **B-1b 结案「仓库外仓·不纳管」（2026-11-21 01:44 实测；口径见 02:08 主人裁定）**：对象 `AI-writer/_scratch-d18` **路径已不存在**（原记 45.6 MB／469 文件）；**非本组删除**，本组从未删除、未打包，删除方与时间不明。现存同类三处一律**不删**：根 `.backups` 3 件／19,311B、`develop/.backups` 2 件／180,192B、`.backups-archive` 1 件／76,597B。
- [x] **B-1c 结案「仓库外仓·不纳管」（同一口径）**：`AI-writer/_backup-2026-11-01` **路径不存在**（原记 23.2 MB／118 文件）——同 B-1b，**非本组删除**；现存同类三处（见 B-1b）一律**不删**。
- [x] **B-1d 去向＝转主人裁（2026-11-21 01:5x）**：`AI-writer` 根不是 git 仓库，仓外目录既不进 `git status` 也不受 `.gitignore` 约束。现存实测：根 `.backups` 3 件／19,311B、`develop/.backups` 2 件／180,192B、`.backups-archive` 1 件／76,597B、`tmp-dev/` 61 件／534,352B、`.batch-a/` 860 件／103,613,677B。去向已定（主人 11-21 02:08）：按「**仓库外仓·不纳管**」结案——不纳入本组任何仓、不出 README、**一律不删**；`.batch-a` 与 `tmp-dev` 由管家跟班处置（见 B-1a／B-19），组内不碰。

## B-2 分支清理（负责人认领）

现状：18 本地分支／5 远端／11 worktree。
- 8 个已并入主线，可直接删：`agent/wt-1`、`agent/wt-2`、`agent/wt-3`、`agent/p51-median`、`docs/fix-workbuddy-links`、`dev_byf`、`exp/arc-tree-v2`、`exp/world-state`。
- 3 个待验：`card/1117-C`、`card/1117-D`（已并入整合分支）、`card/git-track-ops-1117`。
- 4 个无人认领需定去留：`docs/bot-session-identity`、`agent/p56-wb-docs`、`keep/d9-d16`、`keep/night-w1-w5`。
- 2 个 detached worktree 需处置：`night-probe`、`test-master`。
- 缺口：没有分支登记册（字段见 skill `project-git-workflow`），建册后每条分支都要有 owner 与去留期限。

- [x] **B-2 S3 结论（2026-11-21 01:52 实测；删除动作 0）**：本地 **39** 条分支／远端 **5** 条 heads／**5** 棵 worktree。
  - **7 条已并入分支（主人 11-21 02:08：tip 随本阶段入库，删分支由主身在本阶段入库后执行；组内不删）**：`card/1119-H`、`card/1119-archive-first-merge`、`work/archive-in-git-1119`、`relive-src/{card/git-track-ops-1117,dev_byf,exp/resource-ledger,master}`；QA 复核逐条 `git merge-base --is-ancestor <tip> origin/exp/resource-ledger`＝exit 0，无独有提交。回滚＝`git branch <名> <tip>`，tip 见 `reports/s3-stocktake-1121.md` §6.1。
  - **其余 31 条保留**（39 ＝ 当前 `exp/mainline-1119` 1 ＋ 已并入 7 ＋ 未并入 31）：未并入即可能还有独有提交，本轮不出「已被别处携带」的证明就不删；含 25 条脱敏前老线与 `archive/local-rebuilt-1118`、`work/reboot-1118`（永不推送）。
  - 上面 `现状：18 本地分支…` 那张老清单连同 8 条「可直接删」名单**作废**，以本节实测为准。
  - worktree：`develop`（mainline）／`wt-1117f`（`card/1117-F`）／`wt-p56`（`agent/p56-wb-docs`，14 项他人既存改动）／`night-probe`＋`test-master`（detached，后者属另一仓）；清理须先认领，本轮不动。

## B-3 集成验收（合并后暴露，负责人裁）

- [x] **B-3 结案（2026-11-21 02:0x）**：两处红已由 E 卡收口——①`--all` 门禁面收窄为「已跟踪路径＋本次变更集」，`--disk` 降为统计面（只报不作门禁），`--write-baseline` 机制先建后删；②A 卡「`scripts/ops/*.mjs` 不含 `wc -l`」的冲突以「注释内字样不算违规」处理，E/F 两卡机检与单测同时绿。现状：`check-batch-hygiene --all`＝0 项 EXIT=0、`check-fast` 全绿、`--disk` 仍报历史账（14 项，全在 `signals/lead`／`tmp/`／`tools/`，`archive/` 0 行）。

A、D 两卡各自过验，合进 `card/git-track-ops-1117` 后红两处：
- `check-batch-hygiene` 报 236 项不合规，全部在 `.batch/` 内（带 `.vN` 文件名、缺末行换行）——白名单让这批文件进了机检视野，而它们正是 B 卡要收编的对象。
- A 卡测试「`scripts/ops/*.mjs` 源码不含 `wc -l`」被 D 卡新增的 `check-batch-hygiene.mjs` 触发（该文件里出现该字样）。
判据二选一：机检只对已收编路径生效；或先做收编卡再收紧。修完整体重验，通过后才落主线。
- [x] **B-1 认领结论（19:1x，项目总负责人）：五个目录全部「无人认领」。** 取证：`recall`（自身/群/团队记忆）、`read_own_chat`、`read_group_chat` 三次检索这些目录名均零命中，我这边没有任何建目录记录。实测元数据：`proj-pre-a1` 391 文件 44M、`proj-pre-d12` 391 文件 44M（**文件路径清单完全相同**，`project.db` 同为 14,405,632B 但 md5 `c338bad5…`≠`73480417…`，故不是字节重复份，是同一时点两次快照）、`proj-pre-b1replay` 194 文件 32M（db 16,969,728B）、`_scratch-d18` 469 文件 47M（11-04/11-05）、`_backup-2026-11-01` 118 文件 24M（11-01「清除前」）。全部为 `.ai-novel/project.db`＋章节 txt 的项目数据快照，均在 git 之外、无 README。**删不删等主人一句话，我不动一个字节。**
- [ ] **B-1e 规矩（大管家 11-17 定）：任何留档目录/归档件落盘时，同目录必须有 `README.md` 或首行说明**——建它的人、时间、用途、保留期限、过期后给谁。无说明一律按「待认领孤儿」进本 backlog，不许静默留着。
- [x] **B-4 去向＝转下期（2026-11-21 02:0x）**：口径条文已实践两次（B 卡那次 255 件撞车按三步处置；后续合并未再复现），但**条文仍未并入协作规则**，故不进本 Goal 收口面，转下期并入。原文：**B-4 合并前清场口径（负责人 19:2x 定，待并入协作规则）**：凡卡内在 `.batch/night/` 有改动的，合并进 develop 前须三步：①把目标工作区该目录的未跟踪副本整体 `tar.gz` 备份（同目录留 `README.md` 写谁/何时/用途/期限）；②逐件哈希比对未跟踪副本与待合入件，输出 `.log`；③比对结果中「实质不同」的件逐条取舍并写进合并报告，只差行尾的件以分支为准。理由：B 卡合并时 255 件撞车（232 件字节相同、23 件不同：18 件只差行尾、5 件实质差异）。
- [x] **B-5 结案（2026-11-21 02:0x）：规矩已实践并稳定**：此后 `CARD-1117-F-rulings.md`／`CARD-1118-B-rulings.md`／`CARD-1118-C-rulings.md`／`CARD-1119-E-rulings.md`／`CARD-1119-H-rulings.md` 均按「追加段另存、原件字节不动」出；本 Goal 内无一次原地改派验单。条文并入协作规则随 B-4 一并转下期。原文：**B-5 流转件评审追加段的落法（负责人 19:2x 定）**：派验单/卡面在评审过程中追加的终裁、退回、修订、终审段落，一律另存 `<卡号>-rulings.md` 单独成文，原文件字节不动。首个实例：`review-requests/CARD-1117-B-rulings.md`（7,281B，含 §五～§八）；`CARD-1117-B-baseline-intake.md` 恢复为 3,540B 交付版。

- **B-6 `archive/` 193 件未入 git（QA 在 F 卡首验提出，我受理，F 卡不改）**
  - 事实：B 卡收编把 193 件搬进 `archive/`，但 `.gitignore:93` 挡住，从未入库；本机 worktree 里没有 `archive/` 目录，所以 F 卡判据 7 的「archive 尾行 0」是在空集上成立，真反证来自单测夹具（`check-batch-hygiene.test.mjs:193`/`:206`）。
  - 影响：F 卡的 `trailing-newline` 整目录豁免保护的正是这批件，而卡面又要求「原样留档、事后哈希对账」——它们一旦随工作区清理消失，对账基线一起消失，且没有任何提交能证明存在过。
  - 待办（落主线后第一张卡）：二选一——给 `archive/` 加 `!` 反向包含后入库（186 件量级，需清场口径）；或明确「仅留本机」并写进备份口径 + 带 README（谁建/何时/用途/保留期/过期给谁）。

- [x] **B-16 `archive/` 是否整目录豁免 batch-hygiene 规则（11-19 12:26 记）**（结案见 §收口段：只结了尾行那半，整目录豁免 `versioned-filename` 转 B-23）
  - 事实：F 卡只给 `archive/` 豁免了 `trailing-newline`，`versioned-filename`（同目录须有主件）对 archive 仍生效。CARD-1118-D 把 82 件 `.vN` 工作件移进 `archive/` 后，`--disk` 计数会上升（`--all` 只扫已跟踪面，仍为 0）。
  - 待办：评估是否给 `archive/` 整目录豁免（理由：留档区不是流转件区，主件判据在这里无意义），或改用「archive 内文件名去掉版本段」的替代方案。改规则要动 `scripts/ops/check-batch-hygiene.mjs`，须单独出卡、不得在收编卡里顺手改。

- [x] **B-17 `archive/` 全量补登记 47 件（QA 13:2x 勘误后扩账，取代原「roster 22 件」口径）**（结案见 §收口段）
  - 事实：`archive/` 实存 97 件＝已登记 50 ＋ **未登记 47**：`.vN` 22 件全在 `archive/roster/`（`identity-roster.v2/.v3/.v3.1/.v3.2…`），另有非 `.vN` 老档 25 件（`1107/` 15、`resume-1114/` 6、`p9-prefix-restart-1113/` 1、`pre-restart-1113/` 1、`P9.json`、`wake-later.json`）。均不在 CARD-1118-D 的 82 件清单内。
  - 待办：按 B-1e 补进 README（谁建/何时/用途/保留期/过期给谁），或并入下一次 archive 整理卡。

- [x] **B-18 结案（2026-11-21 02:0x）：自记后未再复发**。此后每张卡均成对出派验单：`CARD-1119-E`、`CARD-1119-H`、`CARD-1121-B23`、`CARD-1121-B20` 全部齐；S3 清单件亦按「件＋派验单口径」交 QA 判。原文：**B-18 卡与派验单必须成对出（负责人 13:26 自记）**
  - 事实：CARD-1118-D 只出了卡面、没出派验单，QA 只能按卡面＋执行方的裁定请求单判。同类缺失第二次（CARD-1118-B 时由 QA 指出后补过一次）。
  - 规矩：出卡与出派验单是**同一个动作**；卡面无对应派验单（`review-requests/<卡号>-*.md`）不得翻「在办」。出下一张卡前先 `ls review-requests/ | grep <卡号>` 自检。

- [x] **B-19 交管家跟班处置（2026-11-21 02:08 主人裁定；01:44 实测 61 件／534,352B，du 656K 为块对齐）**：先单独保留 `pii-scan.mjs.bak-1119H` 到 `rotation/`（`rotation/pii-scan.mjs` 唯一回滚件），再打小包核 61 条清单，核完才删；**组内任何人不得改动 `tmp-dev/`**。核验完成前不写「已删」。原文：**B-19 `AI-writer/tmp-dev/` 遗留 scratch 件待清理（QA 20:5x 观察，负责人 21:0x 受理）**
  - 事实：QA 首验 CARD-1119-E 时发现该目录有 13 个 B/C/D 卡遗留 scratch 件；我 21:0x 实测顶层 25 个条目。均在 git 之外、无 README。
  - 规矩：先按 B-1e 判「谁建／何时／用途／保留期」，能追到卡号的并入该卡清理记录，追不到的按「待认领孤儿」报主人后删。**不得为图干净先删后问。**

- [x] **B-20 `post-merge-check.ps1` 的 MERGE_HEAD 探测在 linked worktree 里误判（developer 22:5x 报，负责人 23:1x 受理）**（2026-11-21 00:35 结案：验证记录卡）
  - 事实：linked worktree 里 `.git` 是文件而非目录，脚本仍判「合并未完成」→ 假 RED；同一棵树 `check:fast` 本身 EXIT=0。脚本已于 11-19 23:07 自修，`:59` 加 `--git-path` 兜底。
  - 结案：走 A「验证记录卡」——本卡不改码，脚本在仓外 `rotation/`（`git ls-files` 无跟踪件），故无分支、无单测；证据＝`wt-p56` 探测原文（`dotgit_is_file=True`／`dotgit_mergehead_test=False`／`gitpath_test=False`，确走兜底且不进等待循环）＋一次完整运行末行 `POSTMERGE OK  exp/mainline-1119 @ 0d2671db`。卡面 `cards/CARD-1121-B20-merge-head-verify.md`，证据 `reports/s2-b20-merge-head-verify.md`。
  - 遗留：`rotation/` 脚本入不入库 ⇒ **B-24**（只记议题，不写方案不估工时）。
- [x] **B-21 去向＝转下期（2026-11-21 02:0x）**：8 条 `待补` 仍在 `archive/README.md` §二，按 2026-11-20 00:31 口径「查不出即永久标 `待补` 并写复核过程」处理，本 Goal 不再动 README（改动须另出卡）。原文：**B-21 `archive/` 待补字段清理（stage 2 遗留 8 条，2026-11-20 记）**
  - 现状：`.batch/night/archive/README.md` §二 97 行里 8 行仍带 `待补`——1 条缺「谁建」（`resume-1114/wakeup-inbox/dsh-wake-20261114-0205-7426.md`，唤醒便条无署名）、7 条缺「何时」（`cards/p51-median-gap.v2.md`、`review-requests/p56.v2–v5.md`、`review-requests/reboot-hy4flash-sync.v2.md`、`staging/d1-delivered-path-report.v2.md`，原件均无日期）。
  - 口径（项目总负责人 2026-11-20 00:31 裁）：能查则查、查不出永久标 `待补` 并写清复核过程，不许写「未知」、不因此卡 stage 2。
  - 追平方式：下一张补登记卡；逐版时间须从台账/派验单留痕取得，禁按同族件推定日期填表。

- [x] **B-22 `--all-tracked` 90 文件／289 处命中须在推送前清零（developer 01:2x 报，负责人 01:40 出卡）**（结案见 §收口段）
  - 事实：`058c0867` 上 `pii-scan --all-tracked` 报 90 文件／289 处（user-path 106・secret 37・email 24・phone 14・privacy-word 10・idcard 9・name 9）；其中**真名只 8 文件／17 处**，其余 272 处是测试夹具与设计字样（`@example.invalid`、`sk-` 开头的设计字样等）。`.batch/night/staging/tmp-c9ff5961.jsonl`（1,591,957B，blob `b5cbf42a`）是完整会话日志，含 system prompt，已随 CARD-1117-B 入库。
  - 处置：出 `cards/CARD-1119-H-pii-preflight.md`（判据 7 条、红线 6 条，`--all-tracked` 命中 0 为唯一门禁）；真名改文本、假数据进 `.piiallow`（每行带依据）、日志件 `git rm --cached` 后移出到 quarantine 并留 md5。禁批量改测试夹具。

## 收口 · Goal「脱敏基线收口（四阶段）」stage 4（2026-11-20 05:45，项目总负责人）

- [x] **B-6 结案**：97 件清洗版已入库并生成 `.batch/night/archive/MANIFEST.sha256`（97 条，自身不入表）。判据：`git ls-tree -r --name-only HEAD -- .batch/night/archive \| grep -v 'MANIFEST\.sha256$' \| wc -l` = 97、`git show HEAD:.batch/night/archive/MANIFEST.sha256 \| wc -l` = 97、`archive/README.md` 登记 97 条。原「193 件」口径作废：193 是 B 卡搬入件数，入库面是其中 97 件（清洗版），其余仍在 `staging/`。
- [x] **B-17 结案**：`archive/README.md` 97 条五字段齐；`待补` 38→8，余 8 条转 B-21（不在本 Goal 收口面）。
- [x] **B-22 结案**：`--all-tracked` 90 文件／289 处 → `card/1119-H` @ `adb17d44` 上「通过（扫描 3363 个文件，0 处命中）」EXIT=0；机检工具 md5 回补丁前 `63e9328f548f66174e53a3e9937ddda8`。
- [x] **B-16 结案（仅尾行那半）**：`card/1119-E` @ `44ff679f` 让 `trailing-newline`（脚本 `:35` `RULE_TRAILING`）对 `archive/` 整目录豁免；**整目录豁免 `versioned-filename` 未做**，另记 **B-23**（见下）。
- [x] **B-4 部分结案（转下期，见 §转下期清单）**：本次合并前未跟踪件 1 件、无撞车（B 卡那次 255 件的场面未复现）；口径条文仍未并入协作规则，转下期。

### B-23 结案（2026-11-21 00:35）：**不成立：自 `d1a6e75c` 起 `archive/` 已豁免**

- 原述（2026-11-20 05:45 记）作废：`--disk` 对 `archive/` 内 `.vN` 件会按「同目录须有主件」判——代码中不存在这条规则。
- 证据一：`scripts/ops/check-batch-hygiene.mjs:38` `EXEMPT_VERSIONED_DIRS` 含 `${WATCH_ROOT}/archive/`，与 `versioned-filename` 规则同提交 `d1a6e75c`（11-17，CARD-1117-D）落地（`git log -S` 实证）。
- 证据二：`:85` `checkVersionedName` 命中豁免目录直接 `return null`；`grep -rn "主件" scripts/` 0 命中。
- 证据三：archive 内 `.vN` 实测 **71 件**（69 md＋2 mjs），`--disk | grep -E '^\.batch/night/archive/'` → **0 行**；14 项全在 `signals/lead` 4、`tmp/` 7、`tools/` 5。
- 定性：**不是本 Goal 修好的，是从未缺过**；S4 结案按「早已豁免、B-23 不成立」写，不许写成「本 Goal 修好的」。卡面 `cards/CARD-1121-B23-versioned-archive-verify.md`，证据 `reports/s2-b23-versioned-archive-not-a-defect.md`。

### B-24（新记，2026-11-21 00:35，下期议题）：仓外运维脚本（`rotation/` 等）是否入库

- 议题：`<用户主目录>/.dsh/bot/workspace/rotation/` 下的 `post-merge-check.ps1`、`pii-scan.mjs` 等运维脚本，`git ls-files` 无跟踪件、无版本历史、无评审通道；是否入库、入哪些、以何方式分发，待定。
- 边界：**本条只登记议题**——本 Goal 不写方案、不估工时、不动脚本。

### 转下期清单（2026-11-21 02:0x 更新，本 Goal S4 认定）

**已在本 Goal 结案**：B-1b、B-1c、B-1d（均「仓库外仓·不纳管」，不删）、B-2（三档结论已出、删除 0）、B-3（E 卡收口）、B-5（规矩已实践）、B-6、B-16（尾行那半）、B-17、B-18（未复发）、B-20（验证记录卡）、B-23（不成立：从未缺过）。

**已裁定、交管家跟班执行（不在本组待办）**：B-1a（`.batch-a` 打包核验后删）、B-19（`tmp-dev` 先留 `pii-scan.mjs.bak-1119H`、打小包核 61 条后删）。

**转下期**：B-1e 规矩落地检查、B-4（清场口径入协作规则）、B-21（`archive/` 8 条 `待补`）、B-24（仓外运维脚本是否入库，仅议题）、5 棵 worktree 清理（须先认领）。**S3 那 7 条已并入分支的删除已由主人交主身执行**，不在本组待办。
### 待主人一句话（本阶段已清零：四条全部有答）

主人 11-21 02:08「全按建议执行」已逐条落地，**本阶段不再有待裁项**：

1. 21,112,163B（约 20.1 MiB）删不删 → **`tmp-dev` 交跟班（先留 `pii-scan.mjs.bak-1119H`、打小包核 61 条后删）；三处 `.backups` 不删**。
2. `.batch-a/` 101 MB（860 件）怎么办 → **打包核验后删，执行人＝管家跟班，组内不碰**。
3. B-1d 纳不纳管 → **「仓库外仓·不纳管」结案，不删**。
4. 7 条已并入分支删不删 → **tip 随本阶段入库，删分支由主身在本阶段入库后执行**。

**已视为已答**：`C:/tmp/pmo-stage2-quarantine/` 7 件保留期（主身定 11-26 出到期清单）、97 件原件 bundle 保留期（推送＋QA 核验同 sha 后 7 天，至 2026-11-27，过期交群管理裁定）。
