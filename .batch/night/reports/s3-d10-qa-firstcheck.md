# CARD-S3-D10 清空生成内容 · QA 首验判词

判词角色：QA · AI writer项目组（群分身）。判定口径：只按卡面 §4 判据与派验单 `053c29e3` 逐条独立复跑，不采信交件报告转述。

## 0. 结论（暂不出总判）

| 判据 | 分层 | 结论 |
|---|---|---|
| 1 残留宿主清单 | [static] | **通过**（四表逐表列出，我核对了入口行号，一处行号偏移见记录项 1） |
| 2 实机三档清空后卡片数为 0 | [live] | **待实机**（无读数） |
| 3 回执原文与 DB 计数逐类对账 | [live] | **待实机**（无读数） |
| 4 订阅方非零：文件:行＋运行时日志一行 | [static]＋[live] | **静态部分通过**（订阅与回执发射处已钉到行）；**运行时日志待实机** |
| 5 单测＋`check:fast` | [static] | **通过**（我本机复跑，见 §3） |
| 6 实例纪律三项 | [live] | **待实机**（本卡未跑实机，报告未虚报，属如实） |

因此本判词不出 PASS。派验单 `053c29e3` §41 写明「判不了写实机后补证、不许默认通过」；判据 2／3／6 与判据 4 的运行时部分都是 live 项，缺读数只能记「待实机」。

## 1. 分母与判定面（本判词现算）

| 件 | 读数 | sha256 |
|---|---|---|
| 派验单 `.batch/night/review-requests/s3-d10-clear-reset.md` | 44 行 / 7,763B | `053c29e39851b2f9dcf719b9cc0125385ea90ff1f773c76787b6435f1c42c17d` |
| 卡面 `.batch/night/cards/s3-d10-clear-reset.md` | 78 行 / 7,504B | `7f9ee244596dbd24770ad5890129505562352a1ee4c562aa76a12a760f0ec354` |
| 交件报告 `.batch/night/staging/s3-d10-clear-reset-report.md` | 95 行 / 6,737B | `683690adf89bf080845edcc8efb3ff6d6b803acf26eafe9826776828687a8ae8` |

判定面（代码）：

```
$ git rev-parse --short card/s3-d10-clear-reset
71f72b9b
$ git log --oneline -1 card/s3-d10-clear-reset
71f72b9b CARD-S3-D10
$ git diff --numstat 9cd24897..card/s3-d10-clear-reset -- src electron scripts
127	0	electron/repositories/__tests__/project-clear-receipt.test.ts
12	1	electron/repositories/project-clear-repository.ts
```

白名单外改动 0 件（两件都在包 §五白名单内）：

```
$ git diff --name-only 9cd24897..card/s3-d10-clear-reset | grep -v -E "^(electron/repositories/project-clear-repository\.ts|electron/repositories/__tests__/project-clear-receipt\.test\.ts)$"
（无输出）
```

交件报告此刻在盘上是未跟踪件（`?? .batch/night/staging/s3-d10-clear-reset-report.md`）。admin 已要求 developer 在卡分支上再补一次只含报告文件的 commit；**本次判词的判定面是代码提交 `71f72b9b`**，报告提交 sha 出来后分母与判定面按新件重算，但判据结论不因报告入库而改变。

## 2. 判据 1 `[static]` 残留宿主清单 —— 通过

卡面判据 1 要求「三类卡片各自的宿主（文件路径/键名/表名）逐条列出」。交件报告 §4.5 给的是四表逐表清单，我逐条回到源码核对：

| 表 | 报告给的入口 | 我核到的原文 | 判定 |
|---|---|---|---|
| `generation_runs` | `main-generation-owner.ts:332` `SELECT run_id FROM generation_runs ORDER BY created_at_ms DESC, rowid DESC` | 该查询实为 **`:334`**（`:323` 是带 `LIMIT 50` 的列表版）；`:332` 是 `const list = () => {` | 行号偏移 2 行，表名与语句原文都对 |
| `generation_artifacts` | `:252` `SELECT 1 FROM generation_artifacts WHERE artifact_id=? AND status<>'discarded'` | `:252` 命中原文一致 | 通过 |
| `generation_attempts` | `:915` 由 artifacts 反查 attempt_id；`generation:read-context` recovery | `:915` 命中 `SELECT attempt_id FROM generation_artifacts WHERE artifact_id=?` | 通过 |
| `generation_roots` | `generation:list-batches`；`main-generation-owner.ts:1032/1101/1251` 的 `r JOIN g` | 三处原文均 `SELECT r.run_id FROM generation_runs r JOIN generation_roots g …` | 通过 |

`generation:list` / `generation:list-batches` 的注册处也核了（`electron/controllers/generation-controller.ts:288`／`:285`）。四表归属与「先子后父」的删除次序在源码里能对上（`project-clear-repository.ts:194-200`：artifacts → attempts → runs → roots），结论：判据 1 过。

## 3. 判据 5 `[static]` 单测与门禁 —— 通过

在 `wt-d10`（HEAD `71f72b9b`，node_modules 走 junction）本机复跑，不以报告为准：

```
$ node scripts/run-tests-electron.mjs electron/repositories/__tests__/project-clear-receipt.test.ts
 ✓ electron/repositories/__tests__/project-clear-receipt.test.ts (5 tests) 48ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
TEST_EXIT=0

$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 17.4s
doc links: checked 1468, broken 0
doc placement: 扫描 437 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CHECKFAST_EXIT=0
```

整文件汇总行与末行 EXIT 均贴原文，未用 `-t` 过滤。三条新增用例我也读了源码：四表归零并按 4 类计、老库无 M01 不抛、`review_cycles` 次序守门；守门用例确实造出了 `confirmation_review_id ≠ review_id` 的数据行（`seedReviewPair()` 先插 confirmation 目标、再插 `review_id` 指向行，并断言 `confirmationReviewId < reviewId`），断言的是结局（三表归 0）而不是「挪回必红」这种造不出来的反例——这符合 admin 13:1x 的硬要求。

## 4. 判据 4 `[static]` 订阅方 —— 静态部分通过

回执发射链：`src/services/project-clear-service.ts:168` `const receipt = formatClearReceipt(useLocaleStore.getState().locale, result.counts ?? emptyClearCounts())`、`:169` `AppLogger.info(receipt.lines.join(' '))`；消费链说明在 `src/services/system-notice-toast.ts:22`（`触发链：project-clear-service.ts 的 AppLogger.info(receipt.lines.join(' '))`）。IPC 调用点 `src/services/project-clear-service.ts:148` `'db:project-clear-generated-data'`。

静态部分（「订阅注册处 文件:行」）成立。缺的是判据后半句的**运行时日志一行**——报告 §5 自述「运行时日志未取」，属 live 项，记待实机。

## 5. 判据 2／3／6 —— 待实机（本判词不给结论）

报告 §5 明确判据 2／3／6 未做，caught 在 `git status` 里也没有实机产物（`.runtime/.cache/*d10*` 不存在，`s3-d10-clear-reset-report.md` 之外无新件）。按 admin 13:1x 的三步走裁定，实机在 merge 之后由 developer 在 develop 主区跑、只碰测试库副本，evidence 需四样：

1. 判据 2：三档各一次，清空前/后界面卡片数，0 的读数要原文；
2. 判据 3：可见回执原文＋同一时刻四表 `COUNT(*)` 逐类对账；
3. 判据 4：运行时日志一行（`AppLogger.info` 那行落在 SYSTEM_NOTICE 的原文）；
4. 判据 6：`instancesThisRun`／`exitCode`／`leftoverElectronProcesses=0`／`tasklist | grep -c electron` 原始输出（后者必须直接落 evidence，这是 D16B 留的记录项）。

实机证据回来后，我在本文件追加 §10 复判，不另起件。

## 6. 记录项（不改变结论）

1. 报告 §4.5 的 `main-generation-owner.ts:332` 应为 `:334`（`:323` 是 `LIMIT 50` 的列表版）。表名与语句原文都对，只是行号偏移 2 行；后续卡引行号前请二次核。
2. 报告 §5 判据 1 一行写「外派已交、本卡未复算」，与 §4.5 已复算四表的事实自相矛盾——该行读数作废，以 §4.5 为准。
3. 报告 §4 对 `:61` 的更正（`on_delete` 为 NO ACTION，不是 RESTRICT）与我实测一致，admin 也已同步主身改裁定件措辞；包与判据不动，此条不扣分。
4. 「挪回必红」的反例确实造不出来：整表 `DELETE FROM reviews` 时 `review_id` 的 CASCADE 在同语句带走子行，语句末检查无引用。兜底删除是保险，不是今日路径的承重墙——用例注释已按此写，我不据此判 FAIL。
5. 本判词落盘时交件报告仍为未跟踪件；报告入库后分母与判定面须重报（新 sha），不得把本判词的 `71f72b9b` 当作最终判定面。

## 7. 复跑清单（任何一方可独立复现）

```bash
git -C C:/develop/workspace/AI-writer/develop rev-parse --short card/s3-d10-clear-reset
git -C C:/develop/workspace/AI-writer/wt-d10 diff --numstat 9cd24897..71f72b9b
node scripts/run-tests-electron.mjs electron/repositories/__tests__/project-clear-receipt.test.ts   # 在 wt-d10
node scripts/check-fast.mjs                                                                        # 在 wt-d10
grep -n "status<>'discarded'" electron/services/main-generation-owner.ts
grep -n "FROM generation_runs ORDER BY created_at_ms" electron/services/main-generation-owner.ts
grep -n "formatClearReceipt\|AppLogger.info" src/services/project-clear-service.ts
```
