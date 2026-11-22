# CARD-S3-D10 清空生成内容 · QA 首验判词

判词角色：QA · AI writer项目组（群分身）。判定口径：只按卡面 §4 判据与派验单 `053c29e3` 逐条独立复跑，不采信交件报告转述。

## 0. 结论（首验不通过：判据 2 FAIL，见 §8）

| 判据 | 分层 | 结论 |
|---|---|---|
| 1 残留宿主清单 | [static] | **通过**（四表逐表列出，行号我回源码核过，一处偏移见记录项 1；报告认 `8f8b8dfc`，见 §8 记录项 6） |
| 2 实机三档清空后卡片数为 0 | [live] | **不通过**（按主身裁 (a) 收窄到 `generatedText` 档，见 §8.3）：该档清空后界面仍 1 张「第2章候选」（`tierGeneratedText.afterCards=1`／`finalCards=1`），reload＋重开项目才归 0，卡面 §2 禁此修法；`creativeFields`／`blueprints` 两档记 **N/A**（该档不删生成内容，候选卡片应保留） |
| 3 回执原文与 DB 计数逐类对账 | [live] | **通过**（四表与 drafts 前后读数与回执数字一致；14 表口径其余行的原件见 §8 记录项 4） |
| 4 订阅方非零：文件:行＋运行时日志一行 | [static]＋[live] | **通过**（订阅注册处 `project-clear-service.ts:168-169`＋消费链 `system-notice-toast.ts:22`＋回执界面可见；`AppLogger` 不落 page console 按 admin 13:2x 裁定记记录项，不单列 FAIL） |
| 5 单测＋`check:fast` | [static] | **通过**（我本机复跑，见 §3） |
| 6 实例纪律三项 | [live] | **通过**（`instancesThisRun=1`／`exitCode=0`／`leftover=0`、`tasklist` 原文已落 evidence；`grep -c` 计数形式见记录项 5） |

首验总判：**不通过（D10 不 PASS）**，唯一判据级缺口是判据 2——库已清空、界面仍挂 1 张卡片。按 admin 13:2x 裁定：不另开卡、不扩白名单，由 developer 在 D10 的 apply 位 fix-forward（补一次 `generation:snapshot` 或等价渲染层重置入口），同卡分支 commit 不 push，三档各复跑一次、证据刷成新件后，在同一份判词追加 §10 复判。

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

## 8. 首验总判（2026-11-22 13:30，实机 run `f756048b-1d5`）

判定面：代码提交 **`71f72b9bcc36e362ac050e028f0b82c478506699`**（`CARD-S3-D10`，`git diff --numstat 9cd24897..71f72b9b` = `127 0` 单测 ／ `12 1` 源码，白名单外 0 件）；`git diff 71f72b9b -- src electron scripts` 为空。分母改用报告新版 **`8f8b8dfc…`（95 行 / 6,765B）**，已入库的旧版 `683690ad…`（95/6,737）作废（记录项 6）。

实机证据：`C:/develop/workspace/AI-writer/wt-d10/.runtime/.cache/s3-d10/f756048b-1d5/evidence.json`（wt-d10 在 `card/s3-d10-clear-reset`／`71f72b9b`，develop 主区 `exp/mainline-1119` 未被投用）；证据件 `.batch/night/staging/s3-d10-live-evidence.md` 69 行 / 6,694B / `7a50674e…`（`??` 未提交）。

我独立读 evidence 得到的读数（原样）：

```
instancesThisRun = 1
exitCode = 0
leftoverElectronProcesses = 0
tasklistElectronRaw = "INFO: No tasks are running which match the specified criteria.\r\n"
pids = [{"index":1,"pid":36088,"startedAt":"2026-11-22T05:26:14.037Z"}]
baselineCounts = {generation_runs:1, generation_artifacts:2, generation_attempts:2, generation_roots:1, drafts:2, blueprints:3}
tierGeneratedText.before = {runs:1, artifacts:2, attempts:2, roots:1, drafts:2, blueprints:0}
tierGeneratedText.after  = {runs:0, artifacts:0, attempts:0, roots:0, drafts:0, blueprints:0}
tierGeneratedText.afterCards = 1        ← 判据 2 的失败点
checks.finalCards = 1（baselineCardTitles=["第2章候选"]）
consoleLinesAll = []（n=0）
```

我用只读连接复读了同一个测试库 `C:\d10\f756048b-1d5\D10 清空回执\.ai-novel\project.db`：`generation_runs`／`attempts`／`artifacts`／`roots`、`drafts`、`blueprints`、`summary_snapshots`、`reviews`、`review_cycles` 九项 `COUNT(*)` 全为 0——与 evidence 的 `after` 一致，清空确实落到库上。

判据 2 的机制我独立核成（不采信交件自述）：全仓 `grep -rn "generation:snapshot" src electron` 的**唯一发送点**是 `electron/controllers/generation-controller.ts:139`（run 完成路径），`src/services/project-clear-service.ts` 内零命中；清空路径 `:171-206` 只做关 Tab（`:172`）、`useDraftStore.getState().reset()`（`:175`）、作废架构检查点（`:185-186`）、`refreshFileTree`（`:198`），没有一处触达面板；面板唯一失效信号是 `src/components/panels/AIOutputPanel.tsx:307-314` 的 `ipc.on('generation:snapshot', …)`（epoch 匹配且非 running 才自增 `generationRefresh`）。库行被删、信号未发，`setRuns` 不再重算——与「点刷新仍 1、reload 才 0」的三段对照吻合。admin 已裁 fix-forward 补信号且不扩白名单（卡面 §3 含「承载清空 IPC 的主进程 handler（仅加回执发射与日志）」与「渲染层 store 重置入口」）。

判据 3：三档回执原文在 evidence 内（如 generatedText 档末段「正文与审稿：清了 8 类，共 12 条。」），与 `before` 四表 `1/2/2/1`＋`drafts 2`＋`blueprints 0` 的行数口径一致，四表归零方向与回执一致，判过（14 表口径其余行见记录项 4）。

判据 6：一实例（单 PID 36088）串完三档，`instancesThisRun=1`、`exitCode=0`、`leftover=0`、`tasklist` 原文直接落 evidence（D16B 留下的记录项本条已满足）。

### 8.1 记录项（不改变总判）

1. 交件自述把 `AppLogger.info` 记在 `project-clear-service.ts:172`——盘上 `:169` 是 `AppLogger.info(receipt.lines.join(' '))`、`:172` 是 `editorState.closeTab(tab.id)`（`:168` 是 `formatClearReceipt`）。判据结论不受影响，后续引行号须按盘上原文。
2. `checks.finalGenerationList` = `{"error":"…generation:list… GENERATION_REQUEST_FAILED:ProjectSessionLeaseStale"}`——脚本侧那次 IPC 读取本身失败，故判据 2 的硬证据只用界面 `afterCards=1`，不引该 IPC 计数。
3. 判据 4 的「运行时日志一行」为空（`consoleLinesAll` n=0）：按 admin 13:2x 裁定，订阅注册处＋消费链＋回执界面可见即判过，`AppLogger` 不落 page console 属取证手段限制，记记录项，不补落点。
4. 判据 3 的 14 表逐类原件：evidence 只落了 8 个计数键（四表＋`drafts`＋`blueprints`＋`reviews`＋`review_cycles`），`summary_snapshots`／`contents`／`finalized_draft_import_operations` 等的逐类计数未单独落；我复读该库时这些表当前皆为 0，无法重算「清空前 12 条」的逐类拆分，故该项按四表＋drafts 口径判过。后续卡须把对账用到的每一类计数直接写进 evidence。
5. 判据 6 的 `tasklist | grep -c electron` 计数形式：evidence 落的是 `tasklist /FI "IMAGENAME eq electron.exe"` 原文（`INFO: No tasks are running…`）＋`leftoverElectronProcesses=0`，等价可核；后续卡按派验单字面补 `grep -c` 行，避免同一记录项反复出现。
6. 分母：主线 `9557070b` 入库的报告是旧版 `683690ad`（95/6,737），作废；判据 1 认 `wt-d10` 的新版 **`8f8b8dfc…`（95 行 / 6,765B）**。主身替换后请在收口时补一行「库内 sha 与盘上一致」。
7. 库内 sha 与盘上一致（主身 11-22 13:3x 补核）：新版报告已随提交 `d2432528` 入主线，`git show d2432528:.batch/night/staging/s3-d10-clear-reset-report.md | sha256sum` ＝ `8f8b8dfccb05a874…`，与盘上 `wt-d10` 版本逐位相同；旧版 `683690ad` 仅保留在 `9557070b` 历史中，不再作为判据 1 分母。
7. 卡分支上的 `--no-verify` 提交 `bbc9692e` 已 `git reset --soft 71f72b9b` 回退、分支头未动（admin 按「已回退、不追责」处理）；本判词判定面仍为 `71f72b9b`。

### 8.2 下一步（fix-forward 后补 §10 复判）

developer 在同一卡分支 commit（不 push）后，三档各再跑一次、证据刷成新件（旧 `7a50674e` 标作废），并把 `tasklist | grep -c electron` 原文与逐类计数直接落 evidence；我据新件在 §10 出复判，只重判判据 2（其余判据沿用本 §8）。

### 8.3 分母与判据 2 口径变更（2026-11-22 13:38，主身裁 (a)）

主身裁 (a)、卡面 §8.1 第 5 条已落：**判据 2 按「该档实际清空的对象」判**——`generatedText` 档清空成功后界面卡片数必须 `= 0`（不靠 reload、不靠点刷新）；`creativeFields`／`blueprints` 两档该档不删生成内容（`src/services/project-clear-service.ts:174-176` 的 `reset` 只在 `normalized.generatedText` 分支触发），卡片保留是正确行为，判据 2 记 **N/A**，理由原样写「该档不删生成内容，候选卡片应保留」，不许留空默认通过。

据此重述 §8 的判据 2：判的是 `tierGeneratedText` 那一档——evidence 原文 `tierGeneratedText.afterCards = 1`、`checks.finalCards = 1`，而该档四表 `1/2/2/1 → 0/0/0/0`，即「库删干净、界面仍挂 1 张」，**判据 2 不通过**的结论不变；另两档 `afterCards=1` 改记 N/A，不再算缺口。§8 里「三档清空后界面仍 1 张」的表述按本条收窄为「generatedText 档」。

分母同步换成入库版（我实测）：卡面 `.batch/night/cards/s3-d10-clear-reset.md` **101 行 / 12,319B / `c938dcba7bdade4167efb53aaf7eddad81a16e6b30b538266c66fc969147264f`**（§8.1 留痕＋§3.1 补白，§3 白名单与 §4 判据文字未动）；派验单 `.batch/night/review-requests/s3-d10-clear-reset.md` **44 行 / 8,641B / `40b29bc36a9935a6d39b2b324a1f19158b5b5f12b09482b32d7bc4cc51deb558`**（`:7`／`:40` 分母已换 `c938dcba`，`:6` 软限 45 分钟、15 分钟无产物即放 FF，外派位改为「豆包只出提案、apply 归 developer」）。旧分母 `7f9ee244`（78/7,504）与 `053c29e3`（44/7,763）作废，判定面代码仍为 `71f72b9b`。
