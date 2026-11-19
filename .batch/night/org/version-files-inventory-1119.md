# 版本件清单 · CARD-1118-D（2026-11-19）

- 取数基线：`f8728c8d`（`work/pii-1119` 头）｜范围：`.batch/night/{cards,org,review-requests,staging}` **顶层** `*.vN`
- 实测 **79 件**（cards 23／org 8／review-requests 14／staging 34）
- 取数命令：`ls -1 .batch/night/{cards,org,review-requests,staging}/*.v[0-9]*`；字节取 `stat`（工作区实体），引用数取 `git grep -l -F <文件名> f8728c8d` 的条数
- 预分类：甲＝主件在且同字节（0）｜乙＝主件在但字节不同（48）｜丙＝无主件（31）；被已入库件引用（丁类）**56 件**
- 状态：**清单待审**，§2.2 未执行——本表过审前不动任何文件

| # | 路径 | 字节 | 主件存在 | 与主件同字节 | 被已入库件引用 | 预分类 |
|---|---|---|---|---|---|---|
| 1 | `.batch/night/cards/d1-delivered-path.v1.md` | 11297 | 否 | — | 1 | 丙 |
| 2 | `.batch/night/cards/d1-delivered-path.v2.md` | 13188 | 否 | — | 1 | 丙 |
| 3 | `.batch/night/cards/d1-delivered-path.v3.md` | 13853 | 否 | — | 5 | 丙 |
| 4 | `.batch/night/cards/d1-delivered-path.v4.md` | 13854 | 否 | — | 2 | 丙 |
| 5 | `.batch/night/cards/d1-delivered-path.v5.md` | 14183 | 否 | — | 4 | 丙 |
| 6 | `.batch/night/cards/p31-dedupe-persist.v2.md` | 8240 | 是 | 否 | 5 | 乙 |
| 7 | `.batch/night/cards/p50-fix4-ch03.v1-REBUILT.md` | 2199 | 是 | 否 | 3 | 乙（后缀为 `.v1-REBUILT.md`，非标准 `.vN.md`） |
| 8 | `.batch/night/cards/p51-median-gap.v2.md` | 4279 | 是 | 否 | 7 | 乙 |
| 9 | `.batch/night/cards/p51-median-gap.v3.md` | 6866 | 是 | 否 | 1 | 乙 |
| 10 | `.batch/night/cards/p54-fix3-to8.v2.md` | 3762 | 是 | 否 | 5 | 乙 |
| 11 | `.batch/night/cards/p54-fix3-to8.v3.md` | 3762 | 是 | 否 | 3 | 乙 |
| 12 | `.batch/night/cards/p54-fromto-inject.v1.md` | 7914 | 是 | 否 | 4 | 乙 |
| 13 | `.batch/night/cards/p55-pinned-cwd-allowlist.v1.md` | 10041 | 否 | — | 1 | 丙 |
| 14 | `.batch/night/cards/p55-pinned-cwd-allowlist.v2.md` | 10216 | 否 | — | 3 | 丙 |
| 15 | `.batch/night/cards/p56-fix-report-header.v1.md` | 1560 | 否 | — | 2 | 丙 |
| 16 | `.batch/night/cards/p56-wb-docs-stale.v1.md` | 7946 | 否 | — | 4 | 丙 |
| 17 | `.batch/night/cards/p56-wb-docs-stale.v2.md` | 8343 | 否 | — | 1 | 丙 |
| 18 | `.batch/night/cards/p56-wb-docs-stale.v3.md` | 8844 | 否 | — | 2 | 丙 |
| 19 | `.batch/night/cards/p56-wb-docs-stale.v4.md` | 8855 | 否 | — | 2 | 丙 |
| 20 | `.batch/night/cards/p56-wb-docs-stale.v5.md` | 8952 | 否 | — | 5 | 丙 |
| 21 | `.batch/night/cards/reboot-hy4flash-sync.v1.md` | 9820 | 否 | — | 3 | 丙 |
| 22 | `.batch/night/cards/reboot-hy4flash-sync.v2.md` | 10616 | 否 | — | 3 | 丙 |
| 23 | `.batch/night/cards/wb-rules-example.v1.md` | 6983 | 否 | — | 4 | 丙 |
| 24 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v1.md` | 4288 | 是 | 否 | 2 | 乙 |
| 25 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v2.md` | 5438 | 是 | 否 | 1 | 乙 |
| 26 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v3.md` | 7098 | 是 | 否 | 1 | 乙 |
| 27 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v4.md` | 7830 | 是 | 否 | 1 | 乙 |
| 28 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v5.md` | 8973 | 是 | 否 | 1 | 乙 |
| 29 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v6.md` | 9927 | 是 | 否 | 6 | 乙 |
| 30 | `.batch/night/org/ledger-append-1117-hy4flash-auth.v8.md` | 10632 | 是 | 否 | 2 | 乙 |
| 31 | `.batch/night/org/process-efficiency-assign-1116.v1.md` | 6435 | 否 | — | 2 | 丙 |
| 32 | `.batch/night/review-requests/CARD-1118-B-fork-close.v2.md` | 4141 | 是 | 否 | 0 | 乙 |
| 33 | `.batch/night/review-requests/CARD-1118-B-fork-close.v3.md` | 4446 | 是 | 否 | 0 | 乙 |
| 34 | `.batch/night/review-requests/CARD-1118-B-fork-close.v4.md` | 6569 | 是 | 否 | 0 | 乙 |
| 35 | `.batch/night/review-requests/CARD-1118-C-placeholder-close.v2.md` | 4801 | 是 | 否 | 0 | 乙 |
| 36 | `.batch/night/review-requests/CARD-1118-C-placeholder-close.v3.md` | 4957 | 是 | 否 | 0 | 乙 |
| 37 | `.batch/night/review-requests/d1-delivered-path.v2.md` | 6802 | 是 | 否 | 1 | 乙 |
| 38 | `.batch/night/review-requests/d1-delivered-path.v3.md` | 8288 | 是 | 否 | 5 | 乙 |
| 39 | `.batch/night/review-requests/merge-p55-into-develop.v1.md` | 2719 | 否 | — | 3 | 丙 |
| 40 | `.batch/night/review-requests/p54-fix3-to8.v2.md` | 4624 | 是 | 否 | 5 | 乙 |
| 41 | `.batch/night/review-requests/p56.v2.md` | 3660 | 是 | 否 | 1 | 乙 |
| 42 | `.batch/night/review-requests/p56.v3.md` | 3976 | 是 | 否 | 3 | 乙 |
| 43 | `.batch/night/review-requests/p56.v4.md` | 4087 | 是 | 否 | 3 | 乙 |
| 44 | `.batch/night/review-requests/p56.v5.md` | 4370 | 是 | 否 | 4 | 乙 |
| 45 | `.batch/night/review-requests/reboot-hy4flash-sync.v2.md` | 3471 | 是 | 否 | 3 | 乙 |
| 46 | `.batch/night/staging/d1-delivered-path-report.v2.md` | 11466 | 是 | 否 | 1 | 乙 |
| 47 | `.batch/night/staging/d1-precheck-1117.v2.md` | 7135 | 是 | 否 | 1 | 乙 |
| 48 | `.batch/night/staging/d1-precheck-1117.v3.md` | 8032 | 是 | 否 | 1 | 乙 |
| 49 | `.batch/night/staging/d1-precheck-1117.v4.md` | 8305 | 是 | 否 | 1 | 乙 |
| 50 | `.batch/night/staging/dispatch-schedule-endorse-doubao.v1.md` | 2833 | 否 | — | 2 | 丙 |
| 51 | `.batch/night/staging/dispatch-schedule-endorse-doubao.v2.md` | 3581 | 否 | — | 0 | 丙 |
| 52 | `.batch/night/staging/dispatch-schedule-endorse-doubao.v3.md` | 6471 | 否 | — | 0 | 丙 |
| 53 | `.batch/night/staging/dispatch-schedule-endorse-doubao.v4.md` | 7157 | 否 | — | 1 | 丙 |
| 54 | `.batch/night/staging/dispatch-schedule.v1.md` | 1742 | 否 | — | 1 | 丙 |
| 55 | `.batch/night/staging/dispatch-schedule.v2.md` | 7030 | 否 | — | 0 | 丙 |
| 56 | `.batch/night/staging/dispatch-schedule.v3.md` | 8749 | 否 | — | 2 | 丙 |
| 57 | `.batch/night/staging/doubao-liaison-handoff.v2.md` | 2258 | 是 | 否 | 0 | 乙 |
| 58 | `.batch/night/staging/doubao-liaison-handoff.v3.md` | 2643 | 是 | 否 | 0 | 乙 |
| 59 | `.batch/night/staging/incident-plugin-push-1116.v2.md` | 7089 | 是 | 否 | 0 | 乙 |
| 60 | `.batch/night/staging/message-admission.v1.md` | 4171 | 否 | — | 1 | 丙 |
| 61 | `.batch/night/staging/no-at-count.v2.mjs` | 1833 | 是 | 否 | 3 | 乙 |
| 62 | `.batch/night/staging/no-at-count.v3.mjs` | 1737 | 是 | 否 | 2 | 乙 |
| 63 | `.batch/night/staging/owner-config-fix-1116.v2.md` | 3341 | 是 | 否 | 1 | 乙 |
| 64 | `.batch/night/staging/owner-config-fix-1116.v3.md` | 3489 | 是 | 否 | 1 | 乙 |
| 65 | `.batch/night/staging/owner-config-fix-1116.v4.md` | 1631 | 是 | 否 | 0 | 乙 |
| 66 | `.batch/night/staging/owner-config-fix-1116.v5.md` | 1851 | 是 | 否 | 0 | 乙 |
| 67 | `.batch/night/staging/p54-realmachine-1115.v2.md` | 6718 | 是 | 否 | 1 | 乙 |
| 68 | `.batch/night/staging/p56-report.v2.md` | 12080 | 是 | 否 | 5 | 乙 |
| 69 | `.batch/night/staging/pointer-plan.v1.md` | 10809 | 否 | — | 0 | 丙 |
| 70 | `.batch/night/staging/pointer-plan.v2.md` | 8096 | 否 | — | 0 | 丙 |
| 71 | `.batch/night/staging/pointer-plan.v3.md` | 8107 | 否 | — | 0 | 丙 |
| 72 | `.batch/night/staging/pointer-plan.v4.md` | 7826 | 否 | — | 1 | 丙 |
| 73 | `.batch/night/staging/rules-example-acceptance.v2.md` | 5780 | 是 | 否 | 0 | 乙 |
| 74 | `.batch/night/staging/rules-example-acceptance.v3.md` | 6438 | 是 | 否 | 0 | 乙 |
| 75 | `.batch/night/staging/to-owner-watch-diagnosis-1116.v2.md` | 6071 | 是 | 否 | 0 | 乙 |
| 76 | `.batch/night/staging/wb-quota-schedule-1117.v1.md` | 4896 | 否 | — | 0 | 丙 |
| 77 | `.batch/night/staging/wt2-merge-backout-plan-1116.v2.md` | 11421 | 是 | 否 | 0 | 乙 |
| 78 | `.batch/night/staging/wt2-merge-backout-plan-1116.v3.md` | 13825 | 是 | 否 | 0 | 乙 |
| 79 | `.batch/night/staging/wt2-merge-backout-plan-1116.v4.md` | 15513 | 是 | 否 | 0 | 乙 |

合计 **79** 件：甲 0 ／ 乙 48 ／ 丙 31；其中被已入库件引用的 56 件（移入 archive 时必须留路径映射）。

## 与 B 卡「47 ＋ 35 ＝ 82」差 3 件的点名

当前 79 件与 `reports/CARD-1118-B-report.md` 里列过的 83 个路径做差集，**只在现在、不在 B 卡清单**的 3 件是：

1. `.batch/night/cards/p50-fix4-ch03.v1-REBUILT.md` —— B 卡之后新增／改名的 REBUILT 件（后缀非标准 `.vN.md`）；
2. `.batch/night/review-requests/CARD-1118-C-placeholder-close.v2.md` —— C 卡期间新增的派验单版本；
3. `.batch/night/review-requests/CARD-1118-C-placeholder-close.v3.md` —— 同上（含 11:58 的 115→119 订正）。

反向差集（在 B 卡清单、不在本表范围）7 条：`archive/` 下 2 件已移入的重复件、`staging/rules-review-docs-1116.v2.md`（B 卡时已移入 archive）、`staging/identity-copies/` 下 3 件（子目录，见下条）。

## 范围外：`staging/identity-copies/` 3 件（需负责人定是否并入）

```
.batch/night/staging/identity-copies/bot-session-identity.v2.md
.batch/night/staging/identity-copies/bot-session-identity.v3.md
.batch/night/staging/identity-copies/bot-session-identity.v4.md
```
这 3 件在 B 卡报告里被算进版本件（故 B 卡是 83），但卡面判据 2 的命令（顶层 glob）不含子目录，本表按卡面口径不纳入。若并入，总数 82，正好对上卡题「47＋35＝82」——**请裁定按 79 还是 82 收**。

其他 `staging` 子目录（`dev-draft-rules-example-1116/`、`p54v-evidence/`、`sample-3ch/`、`samples-02/`、`voided/`）实测 0 件 `.vN`。

## 依据

- 卡面：`.batch/night/cards/CARD-1118-D-version-files.md`（4,859B / 63 行）
- 基线件：`.batch/night/reports/CARD-1118-B-report.md` §二.4 与 §(3)(4)
- 执行方：developer · AI writer项目组｜2026-11-19 12:10–12:15
