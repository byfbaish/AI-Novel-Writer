# Goal stage 2 · 未跟踪件清单与入库风险（QA 侧，供归属裁定）

清单生成方：QA · AI writer项目组
取数时刻：2026-11-19T23:47+0800
取数命令：`git status --porcelain -uall | grep '^??' | cut -c4-`（−uall＝逐文件展开，不用 clean／stash）
基线：`exp/mainline-1119` @ `68fa0381`，已跟踪改动 0 件
计数：`-uall` 展开 **69 件**；`git status --porcelain` 目录折叠计 **67 条**
说明：本清单只做取证与分类建议，归属由项目总负责人裁定；我不动任何文件

---

## 一、按类别（建议处置，非决定）

| 类 | 件数 | 内容 | 建议 | 依据 |
|---|---|---|---|---|
| 甲 台账／卡／报告／裁定／派验单 | 42 | `cards/` 19、`org/` 4、`reports/` 12、`review-requests/` 7（明细见 §二） | 随本阶段入库（`.gitignore` 已放行 cards／org／reports／review-requests） | stage 2 判据「无未跟踪件残留」 |
| 乙 `.vN` 命名件（在甲范围内） | 21 | 见 §三 | **不能直接入库**，`versioned-filename` 会红 | `check-batch-hygiene.mjs` 实测，§三 有逐件名单 |
| 丙 staging 台账件 | 17 | `CARD-1118-D-ruling-request-1119` 1、`dispatch-schedule-endorse-doubao` v1–v4 4、`dispatch-schedule` v1–v3 3、`doubao-cli-investigation-20261119` 1、`message-admission.v1` 1、`pointer-plan` v1–v4 4、`v4-signing-receipt-20261119` 1、`voided/owner-config-fix-1116-correction-1128` 1、`wb-quota-schedule-1117.v1` 1 | 同甲（staging 已放行；`.vN` 在此目录豁免版本规则） | 同上 |
| 丁 staging 身份副本 | 3 | `identity-copies/bot-session-identity.v2/.v3/.v4.md`（4,252／4,252／4,528B） | 待负责人定：入库或移出；内容互不同字节（md5 三值不同） | B 卡裁定「内容不同留盘原地进清单」 |
| 戊 运行时数据 | 5 | `staging/project.db-shm`（32,768B）、`staging/project.db-wal`（0B，即 SQLite 已 checkpoint／本次无待写数据）、`staging/samples-02/.ai-novel/project.db`（1,261,568B）及其 `-shm`／`-wal` | **不入库**；建议加 `.gitignore` 规则或移出工作区（禁 clean） | 数据面，非协作介质 |
| 己 投递落点件 | 1 | `delivered/62e69db07b3/2026-11-18-2000-report.md`（2,899B） | 待负责人定：`delivered/` 是否属入库面 | — |
| 庚 工具件 | 1 | `scripts/workbuddy/space-readonly-check.mjs`（5,012B） | B-8 未结：按 B 卡派验单 §六.2 本应「补保留期说明后入库」，执行方当时选留盘待认领 | B-8 |

## 二、69 件全清单（路径 · 字节）

```
.batch/night/cards/CARD-1118-C-placeholder-close.md	5153
.batch/night/cards/CARD-1118-D-version-files.md	11475
.batch/night/cards/CARD-1119-A-pii-line-landing.md	5847
.batch/night/cards/d1-delivered-path.v1.md	11297
.batch/night/cards/d1-delivered-path.v2.md	13188
.batch/night/cards/d1-delivered-path.v3.md	13853
.batch/night/cards/d1-delivered-path.v4.md	13854
.batch/night/cards/d1-delivered-path.v5.md	14183
.batch/night/cards/p55-pinned-cwd-allowlist.v1.md	10041
.batch/night/cards/p55-pinned-cwd-allowlist.v2.md	10216
.batch/night/cards/p56-fix-report-header.v1.md	1560
.batch/night/cards/p56-wb-docs-stale.v1.md	7946
.batch/night/cards/p56-wb-docs-stale.v2.md	8343
.batch/night/cards/p56-wb-docs-stale.v3.md	8844
.batch/night/cards/p56-wb-docs-stale.v4.md	8855
.batch/night/cards/p56-wb-docs-stale.v5.md	8952
.batch/night/cards/reboot-hy4flash-sync.v1.md	9820
.batch/night/cards/reboot-hy4flash-sync.v2.md	10616
.batch/night/cards/wb-rules-example.v1.md	6983
.batch/night/org/process-efficiency-assign-1116.v1.md	6435
.batch/night/org/process-efficiency-draft-v1.md	6201
.batch/night/org/ruling-dispatch-v4-1119.md	4327
.batch/night/org/version-files-inventory-1119.md	9766
.batch/night/reports/CARD-1118-B-qa-firstcheck.md	12528
.batch/night/reports/CARD-1118-B-report.md	24866
.batch/night/reports/CARD-1118-C-qa-firstcheck.md	9043
.batch/night/reports/CARD-1118-C-report.md	15629
.batch/night/reports/CARD-1118-D-qa-firstcheck.md	8610
.batch/night/reports/CARD-1118-D-report.md	10427
.batch/night/reports/CARD-1119-A-qa-firstcheck.md	7775
.batch/night/reports/CARD-1119-A-report.md	6597
.batch/night/reports/CARD-1119-E-qa-firstcheck.md	11533
.batch/night/reports/CARD-1119-E-report.md	8749
.batch/night/reports/GOAL1-archive-first-merge-qa-firstcheck.md	6804
.batch/night/reports/GOAL1-archive-first-merge-report.md	8012
.batch/night/review-requests/CARD-1118-B-rulings.md	2828
.batch/night/review-requests/CARD-1118-C-placeholder-close.md	3825
.batch/night/review-requests/CARD-1118-C-rulings.md	4382
.batch/night/review-requests/CARD-1119-A-pii-line-landing.md	2880
.batch/night/review-requests/merge-p55-into-develop.v1.md	2719
.batch/night/review-requests/p31-v2.md	3125
.batch/night/review-requests/p51-v2.md	3778
.batch/night/staging/CARD-1118-D-ruling-request-1119.md	4118
.batch/night/staging/dispatch-schedule-endorse-doubao.v1.md	2833
.batch/night/staging/dispatch-schedule-endorse-doubao.v2.md	3581
.batch/night/staging/dispatch-schedule-endorse-doubao.v3.md	6471
.batch/night/staging/dispatch-schedule-endorse-doubao.v4.md	7157
.batch/night/staging/dispatch-schedule.v1.md	1742
.batch/night/staging/dispatch-schedule.v2.md	7030
.batch/night/staging/dispatch-schedule.v3.md	8749
.batch/night/staging/doubao-cli-investigation-20261119.md	7164
.batch/night/staging/identity-copies/bot-session-identity.v2.md	4252
.batch/night/staging/identity-copies/bot-session-identity.v3.md	4252
.batch/night/staging/identity-copies/bot-session-identity.v4.md	4528
.batch/night/staging/message-admission.v1.md	4171
.batch/night/staging/pointer-plan.v1.md	10809
.batch/night/staging/pointer-plan.v2.md	8096
.batch/night/staging/pointer-plan.v3.md	8107
.batch/night/staging/pointer-plan.v4.md	7826
.batch/night/staging/project.db-shm	32768
.batch/night/staging/project.db-wal	0
.batch/night/staging/samples-02/.ai-novel/project.db	1261568
.batch/night/staging/samples-02/.ai-novel/project.db-shm	32768
.batch/night/staging/samples-02/.ai-novel/project.db-wal	0
.batch/night/staging/v4-signing-receipt-20261119.md	2747
.batch/night/staging/voided/owner-config-fix-1116-correction-1128.md	1606
.batch/night/staging/wb-quota-schedule-1117.v1.md	4896
delivered/62e69db07b3/2026-11-18-2000-report.md	2899
scripts/workbuddy/space-readonly-check.mjs	5012
```

同字节重复：仅 `staging/project.db-shm` 与 `staging/samples-02/.ai-novel/project.db-shm`（同一 md5 `b7c14ec6110fa820ca6b65f5aec85911`，都是零填充的 SQLite 共享内存文件），属数据面，无需去重动作。其余 67 件两两不同字节。

## 三、入库即红的 21 件（`versioned-filename`，实测非推测）

取证方式：直接 import 受验脚本的真函数，对 69 件逐一判，排除 `EXEMPT_VERSIONED_DIRS = [".batch/night/archive/", ".batch/night/staging/"]`：

```
node -e "import('./scripts/ops/check-batch-hygiene.mjs').then(m=>{ … m.checkVersionedName(p) … })"
→ 会命中的件数=21
```

名单（全部在 `cards/`、`org/`、`review-requests/`，即版本规则的**非**豁免目录）：

```
cards/d1-delivered-path.v1.md … .v5.md                 （5）
cards/p55-pinned-cwd-allowlist.v1.md .v2.md            （2）
cards/p56-fix-report-header.v1.md                      （1）
cards/p56-wb-docs-stale.v1.md … .v5.md                 （5）
cards/reboot-hy4flash-sync.v1.md .v2.md                （2）
cards/wb-rules-example.v1.md                           （1）
org/process-efficiency-assign-1116.v1.md               （1）
org/process-efficiency-draft-v1.md                     （1，`-v1` 亦命中）
review-requests/merge-p55-into-develop.v1.md           （1）
review-requests/p31-v2.md                             （1）
review-requests/p51-v2.md                             （1）
```

三条可选处置（请负责人择一，我不自行决定）：

1. **改名入库**：把 `x.vN.md` 改为 `x.md`（保留最新版）＋历史版移 `.batch/night/archive/`（豁免目录）。风险：cards 里 `d1-delivered-path` 等历史版有对账价值，改名会丢「这是第几版」的显式信息（git 里可见，但路径变了）。
2. **整体移入 `archive/`**：21 件都进 `.batch/night/archive/`，路径换成 `archive/…`，README 一并登记。代价：archive 件数从 97 变 118，与 stage 1 冻结的 97 冲突，需要另开一卡。
3. **暂不入库、移出工作区**：把这 21 件挪到工作区外留档（如 `C:/tmp/`），工作区只留无 `vN` 的件。代价：`stage 2` 判据「无未跟踪件残留」能过，但这些历史版离开工作区。

无论选哪条，**都不能原样 `git add`**：那会让下一次 `--all` 从 0 项变 21 项，stage 2 自己的 pre-commit 就会红。

## 四、待裁定项汇总（给负责人，一行一条）

1. 甲／丙 **59 件**是否按「随本阶段入库」处理（甲 42 ＋ 丙 17；合计 69 件中余 10 件见第 3–6 条）。
2. §三 21 件走哪条处置（改名／进 archive／移出）。
3. 丁 3 件身份副本：入库还是移出。
4. 戊 5 件运行时数据：加 `.gitignore` 规则还是移出工作区。
5. 己 1 件 `delivered/62e69db07b3/…`：`delivered/` 是否属入库面。
6. 庚 1 件 `scripts/workbuddy/space-readonly-check.mjs`：B-8 结案方式（补说明入库／移出）。
7. QA 判词 `reports/GOAL1-archive-first-merge-qa-firstcheck.md` 落点（已入库面内，可随甲类一起入库）。

<!-- DONE -->
