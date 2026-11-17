结论：PASS ｜ 产物：.batch/night/reports/review-overnight.md ｜ 判定线：文件型（本文件存在 + 表格覆盖昨夜 34 个文件 + 每行判定词与依据列） ｜ 证据：`git ls-tree HEAD` 36/36 路径命中、`git show HEAD`/`git grep -n HEAD` 关键行号逐字核过、8 份日志逐行实读；34 行判定 = 成立 11 / 需修 14 / 失效 6 / 空手 3；本轮零 `pnpm test` 重跑

> 本结论只指**本复核卡自身的文件型判定线达成**，不代表被复核的 34 份产物全部通过；逐份可用性见下表。本报告不给任何卡 `review --pass`、不置 `done`，换身份复核由他人执行；交付三步的第 ③ 步未执行，见 §5。

# 复核 11-11 夜跑产出 · 34 份文件逐份判定

## 0. 边界与方法（先写死，防通道用错）

- **本轮授权：只读**。未改源文件、未改已有报告、未 append、未建看板卡、未提交、未推送；仅新建 `CLAIM-review.md` 与本文件两个交付物。
- **零重跑声明**：本轮**未执行** `pnpm test` / `pnpm test:browser` / `pnpm check:full` 及其任何变体（依据 `.batch/night/index.md:144-151` §14：该链会删 `electron/` 455 个文件）。8 份日志的 `RUN-MARKERS` 实测为 1（5 份 baseline + serial，单次启动）或 0（wb-6 / wb-7，无 vitest `RUN v` 行），**日志内也无二次启动痕迹**。
- **两条通道分开**：`.batch/` 未入库（`git status --short` 中 `?? .batch/`），34 个文件只核「工作区存在 + mtime + 内容自洽」，**不用** `git ls-tree`（查不到是正常的）；报告引用的源码路径用 `git ls-tree HEAD <path>`（36/36 命中，无 MISS）+ `git show HEAD:<path>` / `git grep -n … HEAD -- <path>` 核行号。
- **HEAD**：`git rev-parse HEAD` = `13240ffd8920ca74e10dffefc20fca9873bdaa69`；`git rev-list --count 8c0bd657..13240ffd` = **11**（任务书 §1 与 `db-topup-1.md:12` 写「领先 10 个提交」为笔误，见 §4）。`git ls-tree -r --name-only HEAD electron/` = **455** 个文件。
- **输入前提**：`Get-ChildItem -Force .batch/night/reports` 实得 36 个文件 —— 昨夜 **34**（13 报告 + 8 日志 + 10 CLAIM + 3 STOP）全部存在，不判 BLOCKED；另 2 个是今早产物，按验收标准不计入（见 §6 附注）。

## 1. 逐份判定表（34 行 · 6 列）

> 排序：1–13 报告，14–21 日志，22–31 CLAIM，32–34 STOP。`[WS]` = `.batch/` 内文件按工作区通道核验，mtime 取 `Get-ChildItem LastWriteTime`；`[HEAD]` = 源码锚点已用 `git ls-tree HEAD` + 行号实读核验。

| 文件 | 首段结论 | 证据可复核？（能/不能 + 依据） | 与当前 HEAD 13240ffd 一致？ | 判定 | 缺什么 |
|---|---|---|---|---|---|
| `db-15.md` | PASS；19 行对照 / 5 条不一致；读数面 `wt-1@8c0bd657`（`db-15.md:1`, `:22`） | 能。所列路径均在 `git ls-tree HEAD`；但 `CodeMirrorEditor.tsx:821/:874/:887` 现值已是 `editable={editable}` / `</div>` / `style={{…}}`，`generation-call-timeout.ts:14` 现为失败码注释（常量在 `:12`） | 否：读数面 `8c0bd657`，`git rev-list --count 8c0bd657..13240ffd`=11 | **需修** | 改 `:821→:831`、`:874→:884`、`:887→:897`、`:281/:335/:336→:283/:339/:340`、`:14→:12`（原件指错行、位移 0）、`:17→:15`；`db-15.md:41` 表第 14 行判「一致」→「不一致」（`browser.tsx:340` 已改 `.not.toBeInTheDocument()`）。依据 `db-15-develop.md:20-24,77-95`；其余 15 行未复核（`db-15-develop.md:106`） |
| `db-15-develop.md` | PASS；在 `13240ffd` 上补正 5 处 + 1 失效子行（`:1`, `:10-11` 自证 HEAD） | 能。`git grep -n HEAD`：`CodeMirrorEditor.tsx:831/884/897`、`CodeMirrorEditor-generation.browser.tsx:283/339/340`、`generation-call-timeout.ts:12` 逐字吻合；`:339` 尾句「请重新选中后再试」、`:340` `.not.toBeInTheDocument()` 与 `:81-83` 一致 | 是 [WS + HEAD]（mtime 03:50:53） | **成立** | 仅核 5 处 + 1 子行，其余 15 行未复核（`:106`）；`generation-run-service.ts:203→:206` 标不确定（`:107`，本次 HEAD 实读：注释 `:203`、生产调用 `:206`） |
| `db-18.md` | PASS；三 runner 差异表 10 行 / 场景表 6 行（`:1`） | 能。`git grep -n HEAD`：`package.json:26/27/28`、`vitest.browser.config.ts:29`、`vite.config.ts:128/148`、`run-tests-electron.mjs:8/51` 逐字吻合；`git ls-tree -r --name-only HEAD` 得 `*.browser.tsx`=106、其中带 `.test./.spec.`=0（与 `wb-7-run-1.log:9014` 的 106 一致） | 部分：配置/脚本行号一致；但 `:19` 的「`*.test.*` 共 641 个」按 `git ls-tree -r --name-only HEAD` 以 `\.test\.(ts\|tsx\|mjs\|js)$` 计数 = **643** | **需修** | `db-18.md:19` 与 `:58` 的 `641`→`643`（或写明计数口径）；106 与 0 不变；`vite.config.ts` 是否逐字节同版未核（`:59`） |
| `db-22.md` | PASS；四列交叉表 6 行 / 4 组冲突（`:1`） | 能。`git grep -n HEAD`：`backlog:113`（D9–D11、D16 未开工）、`:114`、`:132`（D9 待裁定+阶段1已接线）、`:140`、`:143`、`project-core-repository.ts:331`、`architecture.command.ts:1367`、`live-pipeline-acceptance-defects-assessment.md:75`、`documentation-charter.md:96/241` 逐字吻合 | 是 [WS + HEAD]（`db-topup-1.md:49` 四处行号未变，本次实读确认；mtime 02:41:11） | **成立** | `git log` 未跑，稿内 commit 号未验证（`:66`）；`wb-19-develop.md:107` 称 `:113` 应改 `:114`，与本次实读（`:113` 确为 D9–D11、D16 行）有分歧，待裁 |
| `db-topup-1.md` | PASS；三态 = 仍成立 4 / 需改行号 1 / 已失效 1（`:1`, `:73-79`） | 能。所列 develop 现值锚点 `CodeMirrorEditor.tsx:897`、`browser.tsx:283/339/340`、`generation-call-timeout.ts:12/31`、`generation-run-service.ts:206`、`main-generation-plan.ts:188`、`check-ledger-snapshot.mjs:19-21`、`check-fast.mjs:24-26`、`webdav-backup-service.ts:443` 全部 HEAD 逐字吻合 | 是 [WS + HEAD]（三态与 `db-15-develop.md` / `wb-19-develop.md` 实证一致；mtime 02:49:06） | **成立** | `:12`「领先 10 个提交」→**11**；`:38` 把 `:14→:12` 记为「位移」→按 `db-15-develop.md:75` 改「原件指错行、位移 0」；`db-18` 文件计数未重扫（`:91`，本次已定值见上） |
| `db-topup-2.md` | PASS；结论「可」，日志 `:9014/:9015/:9017` 与报告数字逐字一致（`:1`） | 能。逐行实读 `wb-7-run-1.log:9014`=`Test Files 1 failed \| 105 passed (106)`、`:9015`=`Tests 1 failed \| 836 passed (837)`、`:9017`=`Duration 91.86s`、`:8992`=`Failed Tests 1`、`:9006`=`…RendererStartup.browser.tsx:137:25`、`:9011`=`[1/1]`、`:6989`=13 tests；`wb-7.md:9` 确无 sha | 是 [WS]（mtime 02:49:57；核的是 `.batch/` 日志行号） | **成立** | 判定对象 `wb-7.md` 的结论词已按 G7 需修，本报告的「可」仅指**证据链可复核**，不等于结论词可沿用；`wb-7.md` 缺 HEAD sha 与跑测时刻 porcelain（`:66`） |
| `wb-6.md` | **BLOCKED**；`pnpm test` 未退出，exit code 与四数未取得（`:1`, `:13-23`） | 能。`wb-6-run-1.log` 实读 5901 行、全文 `Test Files`/`Tests`/`Duration` 汇总 **0 条**；`:17`=`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`；`:499`=`195 tests \| 129 failed`、`:1434`=`187 tests \| 186 failed`、`:1980`=`45 tests \| 45 failed`（与 `:25` 三处抽样逐字吻合）；`:5901`=`[ELIFECYCLE] Test failed.` | 是 [WS + HEAD]（引用 `scripts/run-tests-electron.mjs` 在 `git ls-tree HEAD`；`package.json:26` = `node scripts/run-tests-electron.mjs`；mtime 03:27:18） | **成立** | 四数按 BLOCKED 定义未取得（这是结论内容，非缺陷）；`:72` 把 WB-7 写作「FAIL = 基线漂移」，按 `index.md:135` 应改「基线下调 / G7 下 PASS」 |
| `wb-6-late-result.md` | **BLOCKED（维持不变）**；补记进程 03:56:11 结束、EXITCODE=-1、日志仅 +1 行（`:1`, `:16-26`） | 能（部分）。`wb-6-run-1.log:5901` 逐字 = `[ELIFECYCLE] Test failed. See above for more details.`，5901 = 5900+1 ✓；`wb-6.md:55` 的 5900 行 / 1,034,112 字节是停手时刻值，+55 字节由本补记解释 ✓。但 `EXITCODE=-1` / `ELAPSED_SEC=4264.8` 取自后台任务输出，**日志内无对应行** | 是 [WS]（mtime 03:57:23，晚于 `wb-6.md` 03:27:18） | **成立** | 不替代 `wb-6.md`、不计入卡片判定线（`:43`）；`-1` 与 4264.8s 只能靠后台任务输出自证，无独立日志行可复算 |
| `wb-7.md` | **FAIL（基线漂移）**；`1 failed / 836 passed (837)`（`:1`, `:56`） | 能。`wb-7-run-1.log:9014/9015/9017` 逐字；`RendererStartup.browser.tsx:137` = `expect(listeners.size).toBe(1)`（`git show HEAD`）；`:6989`=13 tests 全绿；`:8992`=`Failed Tests 1` | 读数一致；**结论词口径已被** `docs/agents/acceptance-gates.md:16-19,37`（G7）与 `index.md:135` 更正 | **需修** | ①`:1`/`:56`「FAIL（基线漂移）」→「基线下调；按 G7（`acceptance-gates.md:37`）应判 PASS」；②`:28` 引 `:9015-9016`→`:9015`（`:9016` 实为 `Start at 02:41:29`）；③`:28` 的 `[1/1]` 引 `:9008`→`:9011`；④补被测 HEAD sha 与跑测时刻 `git status --porcelain`（`db-topup-2.md:66`）；⑤B16 消失原因未查（`:71`） |
| `wb-16.md` | PASS；「能（有前提）」（`:1`, `:46`） | 能（部分）。`generation-call-timeout.ts:31`（第二参数 capMs）、`generation-contract.ts:52` `RootBudget`、`generation-run-service.ts:206`、`generation-run-repository.ts:331`、`ai-output-failure-presentation.ts:181/186` 逐字吻合；但 `:20` 写 `generation-call-timeout.ts:14` 是 `DEFAULT_SINGLE_CALL_TIMEOUT_MS`，HEAD `:14` 实为失败码注释、常量在 `:12`；`:22` 写 `:17` 是失败码常量，HEAD `:17` 实为类型别名、常量在 `:15` | 方向一致，**2 处行号内容不吻合** | **需修** | `:20` 的 `:14→:12`、`:22` 的 `:17→:15`（`db-15-develop.md:62-75,99` 同源更正）；补 `main-generation-plan.ts:188`「budget 键集必须完全相等」这道更硬的闸（`db-topup-1.md:57`）；值来源未定位（`:35`） |
| `wb-19.md` | PASS；5 行对照表 + 5 条边界，`check-fast` = 3 步（`:1`, `:21-29`） | 能，但**结论被反转**。`git grep -n HEAD scripts/check-ledger-snapshot.mjs:19-21` 现值逐字 = 「单编号 / 区间 `D4–D8` / 并列 `D9–D11、D16`…复合行会**展开成多个编号**分别登记」；`:63` `expandIdCell`、`:160`/`:166` 调用实存；而报告 `:28` 写「复合编号只进未识别附注、不参与判定」。成因提交 `8bc4f61f`（`git log 8c0bd657..13240ffd` 第 10 条） | **否**（决定性一行已被后续提交改掉；`index.md:89` 同判已失效） | **失效** | 整份不得直接采信；按 `wb-19-develop.md:99-105` 重做第 28 行，`check-fast.mjs:23-27→:24-26`、退出码说明 `:40→:42`（HEAD `:42` 才是退出码说明，`:40` 是空注释） |
| `wb-19-develop.md` | PASS；重做反转行 + 4 行现值行号（`:1`, `:10-11` 自证 HEAD） | 能。`git grep -n HEAD`：`check-ledger-snapshot.mjs:63/160/166/242/269`、`check-fast.mjs:24-26/32/33`、`check-doc-placement.mjs:246/247/248/193/208`、`run-tests-electron.mjs:45/51/55/56` 逐字吻合；`:269` 打印标签仍带「复合/派生编号」残留，与报告 `:88` 一致 | 是 [WS + HEAD]（mtime 03:51:26） | **成立** | `:249/:261/:265` exit 2 分支未逐条重核（`:105`）；`check-prompt-wiring.mjs:50/51/715-716` 未重核（`:108`）；未逐 diff `8bc4f61f`（`:116`） |
| `wb-20.md` | PASS；主锚点 `webdav-backup-service.ts:441/:442/:443`，结论「对备份成败=否 / 对清理残留=是」（`:1`, `:48-50`） | 能（1 处不吻合）。`git grep -n HEAD -- electron/services/webdav-backup-service.ts` 定死 `:441`=`handle.close().catch(() => {})`、`:442`=`try { fs.unlinkSync(temporary) } catch (error) {`、`:443`=`if (…code !== 'ENOENT') { /* Preserve the operation error. */ }`；`:271/:355/:524/:549/:562/:594/:607` 七处 `.catch(() => {})` 与 `:32` 一致；`skin-service.ts:163/446` 两处 `console.warn` 逐字吻合。但 `:32` 列的 `:506` 现为 `if (![201, 405].includes(response.status))`，同族空 catch 实为 `:508` | 主结论一致，**1 处行号需更新** | **需修** | `:32` 的 `:506→:508`；主锚点与「否 / 是」结论不变；`temporary` 路径来源未追（`:52`）、DB-12 未点名本处（`:75`，`db-topup-1.md:71` 已复核零命中）、现有用例是否覆盖 `:442` 未读（`:74`） |
| `lead-wb6-baseline.log` | （日志无首段）汇总 `:7110`=`269 failed \| 373 passed (642)`、`:7111`=`65 failed \| 5293 passed \| 5 skipped (5363)`、`:7114`=`310.26s`；7116 行 | 能（行号逐字实读）；`RUN-MARKERS=1`（单次启动，日志内无重跑） | 否——HEAD 的 `electron/` 有 455 文件，而日志 `:4376`=`Cannot find module '/@id/…/electron/__tests__/creative-strategy-migration.test.ts'` | **失效** | **跑到第 4376 行时 electron 已不在**，汇总在 `:7110`，其后 2734 行都在残缺工作区上跑；269 failed / 642 不得引用。干净基线四数与 exit code 仍缺 |
| `lead-wb6-baseline-2.log` | 汇总 `:5016`=`37 failed \| 372 passed (409)`、`:5017`=`36 failed \| 5187 passed \| 3 skipped (5226)`、`:5018`=`Errors 24`、`:5020`=`260.16s`；5022 行 | 能；`RUN-MARKERS=1` | 否——`:3899`=`Cannot find module '../../electron/llm/openai-provider'`、`:3971`=`ENOENT … electron\main.ts`（硬证据：源码文件已不存在）；采集面 **409 ≠ 642**，少 233（`index.md:111` 记「清 .vite 后只收集到 409/642」） | **失效** | 六份里最严重——**跑到第 3899 行时 electron 已不在，第 3971 行是 ENOENT 实锤**，且开跑采集面已缺 233 个文件；汇总 `:5016` 的数全在残缺集上产出，四数不得引用 |
| `lead-wb6-baseline-3.log` | 汇总 `:7208`=`268 failed \| 374 passed (642)`、`:7209`=`68 failed \| 5715 passed \| 5 skipped (5788)`、`:7212`=`313.56s`；7215 行 | 能；`RUN-MARKERS=1` | 否——`:4671` 起 electron 模块缺失；`index.md:148` 明写「baseline-3 全部作废」、`:146` 撤销 §12.1 结案 | **失效** | **跑到第 4671 行时 electron 已不在**，汇总在 `:7208`；268 failed 里 electron 系为假红，不许当基线、不许引用（`index.md:148`） |
| `lead-wb6-baseline-4.log` | 汇总 `:7356`=`270 failed \| 372 passed (642)`、`:7357`=`78 failed \| 5448 passed \| 5 skipped (5531)`、`:7360`=`313.71s`；7363 行 | 能；`RUN-MARKERS=1` | 否——`:4433` 起 electron 模块缺失；`index.md:149-150` 记本轮挂 `fs-guard.cjs`，`:156` 记三轮 BLOCK 命中 0 次，四数仍不能当基线 | **失效** | **跑到第 4433 行时 electron 已不在**，汇总在 `:7356`；fs-guard 未抓到调用栈，删除源仍未查清（`index.md:161`） |
| `lead-wb6-baseline-5.log` | 汇总 `:7405`=`270 failed \| 372 passed (642)`、`:7406`=`77 failed \| 5449 passed \| 5 skipped (5531)`、`:7409`=`322.95s`；7412 行 | 能；`RUN-MARKERS=1` | 否——`:4438` 起 electron 模块缺失（早于汇总 `:7405`） | **失效** | **跑到第 4438 行时 electron 已不在**；与 -4 仅差 1 条 Tests（5448/5449），不构成「两轮互相印证」——两轮都跑在同一残缺工作区上 |
| `lead-wb6-baseline-serial.log` | 无汇总。`ReadAllLines` = **210 行**，`Test Files`/`Tests`/`Duration` 命中 **0**，无 electron 缺失命中；末行 `:210`=`❯ …/structured-planning-runtime.test.ts (0 test)` | 能（行数与末行实读）；`RUN-MARKERS=1` | N/A [WS]（mtime 04:17:17；未跑完，按 `index.md:172` 第 1 条「只有跑完的轮次才作数」，其 electron 完好**不能**当作「没删」的证据） | **空手** | exit code、四数、卡在哪个文件、跑完后的 `git status --porcelain electron/` 全无；没回答卡面「四数 + 卡在哪个文件」 |
| `wb-6-run-1.log` | 无汇总。5901 行、`Test Files`/`Tests`/`Duration` **0 条**、`:5901`=`[ELIFECYCLE] Test failed. See above for more details.`；`RUN-MARKERS=0` | 能。`:17`=`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":50,…}`；`:499`/`:1434`/`:1980` 与 `wb-6.md:25` 三处抽样逐字吻合；`:5900`=`✓ …update-retry-action.test.ts (1 test) 2ms` | 是 [WS]（`wb-6.md:1`、`wb-6-late-result.md:1` 均指向本文件；mtime 03:56:10） | **成立** | 不可当基线；62 条文件级失败行 / 累计 1074 failed 是部分读数（`wb-6.md:25`），不代表真实失败率 |
| `wb-7-run-1.log` | `Test Files 1 failed \| 105 passed (106)` / `Tests 1 failed \| 836 passed (837)` / `Duration 91.86s`（`:9014/:9015/:9017`）；9018 行 | 能。逐字实读；`FIRST-ELECTRON-MISS: none`（本轮不涉及 electron 源码删除）；`:6989`=`✓ chromium …CodeMirrorEditor-generation.browser.tsx (13 tests)`、`:9006`=`RendererStartup.browser.tsx:137:25`、`:8992`=`Failed Tests 1`。注意 `:9014` 带 ANSI 色码，用 `^ *Test Files` 会漏命中（`review-qa-baseline.md:109`） | 是 [WS + HEAD]（`RendererStartup.browser.tsx:137`=`expect(listeners.size).toBe(1)`，`git show HEAD` 逐字吻合） | **成立** | 日志 `:2` 只有 vitest 版本 + 仓库路径，无 HEAD sha（`db-topup-2.md:48`）；这是昨夜**唯一可作数**的测试证据，但只覆盖 browser，不能拿去套全量门 G12（`index.md:137`） |
| `CLAIM-WB-6.md` | （无结论词）认领声明，状态 `CLAIMED`；自述「02:43 之后」 | 能。mtime **02:44:58** 与自述一致；所列 `package.json:26`、`scripts/run-tests-electron.mjs`、`node_modules/electron/dist/electron.exe`、`node_modules/vitest/vitest.mjs` 经 `Test-Path` 全为 True，`vitest.browser.config.ts` 在 `git ls-tree HEAD` | 是 [WS]（分支 `exp/resource-ledger` 与当前一致） | **成立** | CLAIM 只证明接单、不证明出货（`index.md:41`）；其「允许跑全量测试」是昨夜窗口授权，今天已被本任务硬禁止，不可援引 |
| `CLAIM-WB-7.md` | 认领声明；自述 02:39（`date` 自证 02:38:56） | 能。mtime **02:40:54**，与自述相差 1–2 分钟（同一量级）；`vitest.browser.config.ts` 在 HEAD | 是 [WS] | **成立** | 同 `CLAIM-WB-6.md`；末行 `状态：CLAIMED（认领完成，尚未执行）` 不能当执行证据 |
| `CLAIM-WB-15.md` | 认领声明；自述「时间 02:52」 | **不能自洽**。mtime **02:37:18** 比自述早 15 分钟；对应报告 `db-15.md` mtime **02:37:54** 比自述「认领」还早 14 分钟 ⇒ 认领晚于交付 | N/A [WS]（通道只核存在 + mtime + 内容自洽） | **需修** | 自述时间改为 `02:37`（按 mtime），并注明「事后补记，不能作为事前认领证据」；卡号/计划/红线与 `db-15.md:5-22` 一致 |
| `CLAIM-WB-16.md` | 认领声明；自述「时间 03:32」 | 不能自洽。mtime **02:41:18**（差 51 分钟）；`wb-16.md` mtime 02:42:31 仍早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:41`；注明事后补记 |
| `CLAIM-WB-18.md` | 认领声明；自述「时间 02:58」 | 不能自洽。mtime **02:38:04**（差 20 分钟）；`db-18.md` 02:39:24 早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:38`；注明事后补记 |
| `CLAIM-WB-19.md` | 认领声明；自述「时间 03:52」 | 不能自洽。mtime **02:42:42**（差 70 分钟）；`wb-19.md` 02:43:44 早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:42`；注明事后补记 |
| `CLAIM-WB-20.md` | 认领声明；自述「时间 04:16」 | 不能自洽。mtime **02:43:50**（差 92 分钟）；`wb-20.md` 02:44:58 早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:43`；注明事后补记 |
| `CLAIM-WB-22.md` | 认领声明；自述「时间 03:06」 | 不能自洽。mtime **02:39:29**（差 27 分钟）；`db-22.md` 02:41:11 早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:39`；注明事后补记 |
| `CLAIM-DB-T1.md` | 认领声明；自述「时间 05:02」 | 不能自洽。mtime **02:48:02**（差 134 分钟）；`db-topup-1.md` 02:49:06 早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:48`；注明事后补记 |
| `CLAIM-DB-T2.md` | 认领声明；自述「时间 05:12」 | 不能自洽。mtime **02:49:36**（差 143 分钟，本批最大）；`db-topup-2.md` 02:49:57 早于自述 | N/A [WS] | **需修** | 自述时间改为 `02:49`；注明事后补记 |
| `STOP-db-t3.md` | 全文 = `完成 1/1`（11 字节，mtime 03:51:29） | 能（工作区存在 + 字节数 + 全文）；但按 `CLAIM-WB-6.md` 卡面 STOP 判定线「已完成 / 未完成 / 卡在哪一步各一行」，三行全无 | N/A [WS] | **空手** | 三行要素、停手时间、产物路径、卡点全无；`review-qa-baseline.md:60` 同判「11 字节空壳，不能当已停止的证据」 |
| `STOP-db-topup.md` | 全文 = `完成 2/2`（11 字节，mtime 02:50:00） | 能（存在 + 11 字节 + 全文）；同样缺三行要素 | N/A [WS] | **空手** | 同上；`review-qa-baseline.md:61` 同判 |
| `STOP-wb.md` | 停手记录，03:25 单卡 40 分钟盒到点；含「已完成 / 未完成 / 卡在哪一步」三段（1,922 字节，mtime 03:25:47） | 能。三要素齐全；所引 `wb-6-run-1.log` 1,034,112 字节 / 02:53:25 为停手时刻值（`wb-6.md:55` 同值），`[safe-delete]` 13 次与日志 `:17` 一致；`electron pid=24292` 属进程观测，无文件可复算 | 主体一致；「已完成」段把 WB-7 定性为 `FAIL = 基线漂移`，与 `index.md:135` / `acceptance-gates.md:16-19` 冲突 | **需修** | 「FAIL = 基线漂移」→「基线下调；按 G7 应判 PASS」（`index.md:135`、`acceptance-gates.md:37`）；pid 24292 无落盘证据 |

**计数校验**：成立 11（报告 7 + 日志 2 + CLAIM 2）／需修 14（报告 5 + CLAIM 8 + STOP 1）／失效 6（报告 1 + 日志 5）／空手 3（日志 1 + STOP 2）= **34**。

## 2. 专项 ① `wb-6.md` vs `wb-6-late-result.md`

**不矛盾，两份并存；正式采信 `wb-6.md`，`wb-6-late-result.md` 只作补记。理由是判定线从未达成，不是哪份更晚。**

- `wb-6.md:1` 记的是 **03:25 停手时刻**：日志定格 5900 行 / 1,034,112 字节、0 条汇总行、exit code 无从读取 ⇒ BLOCKED。
- `wb-6-late-result.md:1` 记的是 **同一后台进程 03:56:11 的结局**：EXITCODE=-1、ELAPSED_SEC=4264.8、日志 +1 行、汇总仍 0 条 ⇒ 「BLOCKED（维持不变）」。`wb-6-late-result.md:30-31` 自己逐条解释了为何不矛盾，`:43` 明写「本文件是补记，不是卡片报告；正式交付仍是 `CLAIM-WB-6.md` + `wb-6.md` + `wb-6-run-1.log` + `STOP-wb.md`」。
- **独立核验**：`wb-6-run-1.log` 现 **5901 行** = 5900（停手时）+ 1；`:5901` 逐字 `[ELIFECYCLE] Test failed. See above for more details.`；全文 `Test Files`/`Tests`/`Duration` 汇总 **0 条**；`:5900` 是 `✓ …update-retry-action.test.ts (1 test) 2ms`。即新增那行是 pnpm 收尾，**不是 vitest 汇总**。
- **采信口径**：`wb-6.md` 是卡片判定线的唯一正式产物，结论 BLOCKED 成立；`wb-6-late-result.md` 只补「进程已死 + exit -1」一个事实，**不能计入 WB-6 判定线**。两份共同证明 `exit code + passed/failed/total + 耗时` 四数从未取得 ⇒ **今晚基线未建立**。任何把这两份读成「基线已建成」或「多一条红」级读数的表述都是错的。
- **一条时间风险**：`ELAPSED_SEC=4264.8` ≈ 71 分钟，超 40 分钟盒 31 分钟，即 03:25 停手后进程仍活到 03:56（`review-qa-baseline.md:94`）。引用 03:27–03:56 之间落盘的产物，须把这 29 分钟算进去。

## 3. 专项 ② 六份 `lead-wb6-baseline*.log` 的数字去留

| 日志 | 汇总行 | 采集面 | **electron 已不在的首行** | 判定 |
|---|---|---|---|---|
| `lead-wb6-baseline.log` | `:7110-7114` `269 failed / 373 passed (642)` | 642 | **`:4376`** `Cannot find module '/@id/…/electron/__tests__/creative-strategy-migration.test.ts'` | 作废 |
| `lead-wb6-baseline-2.log` | `:5016-5020` `37 failed / 372 passed (409)` | **409（缺 233）** | **`:3899`** `Cannot find module '../../electron/llm/openai-provider'`；**`:3971`** `ENOENT … electron\main.ts` | 作废（最严重） |
| `lead-wb6-baseline-3.log` | `:7208-7212` `268 failed / 374 passed (642)` | 642 | **`:4671`** 同上 `/@id/…/electron/__tests__/…` | 作废 |
| `lead-wb6-baseline-4.log` | `:7356-7360` `270 failed / 372 passed (642)` | 642 | **`:4433`** 同上 | 作废 |
| `lead-wb6-baseline-5.log` | `:7405-7409` `270 failed / 372 passed (642)` | 642 | **`:4438`** 同上 | 作废 |
| `lead-wb6-baseline-serial.log` | **无**（210 行） | — | 无命中（未跑完，`index.md:172` 不得据此判「没删」） | 空手 / 无结论 |

**结论：六份里没有一份可当基线，四数（Test Files / Tests / Duration / exit code）一个都不能保留。** 判据不是「红多了几条」，而是：五份有汇总的日志都在**跑到中途**（:4376 / :3899 / :4671 / :4433 / :4438）就开始成片 `Cannot find module …/electron/**` 或 `ENOENT …\electron\main.ts`，而汇总行都在其后（:7110 / :5016 / :7208 / :7356 / :7405）——**从那一行起，剩下的 passed/failed 是在源码已不在的工作区上跑出来的**。`index.md:148` 已单独点名 baseline-3 作废，本次逐份核过，另外四份同理；baseline-2 更彻底，采集面 409 ≠ 642（`index.md:111` 记「清 .vite 后只收集到 409/642」），说明它开跑时文件集就已残缺。

**唯一可以保留的数字**是取证坐标，不是测试结果：各日志总行数（7116 / 5022 / 7215 / 7363 / 7412 / 210）、汇总行行号、electron 缺失首行行号、采集面 409 vs 642，以及 `RUN-MARKERS=1`（单次启动，可排除「同一日志里重跑」这一干扰）。这些用于定位事故，不得写成基线读数。

**昨夜唯一可作数的测试证据**是 `wb-7-run-1.log`（browser 单独跑）：`1 failed / 836 passed (837)`、91.86s，与 `acceptance-gates.md:16-18,37` 的 G7 口径吻合；但它是浏览器门，**不能拿去套 `pnpm test` 全量门 G12**（`index.md:137` 明写「不许拿 browser 的 837 去套全量」）。

## 4. 专项 ③ 两对 develop 版能否替代原版

**两对都必须并存，后一份不能直接替代前一份。**

1. **读数面不同，不可混算**：`db-15.md:22` / `wb-19.md:14` 自报 `wt-1@8c0bd657`；`db-15-develop.md:10-11` / `wb-19-develop.md:10-11` 自报 `13240ffd`。`git rev-list --count 8c0bd657..13240ffd` = 11。引用任一份都必须同时写清读数面，否则行号不可复算——这也是任务 §1 风险 2 的根源。
2. **新版只补正被点名的条目，旧版其余部分是唯一出处**：`db-15-develop.md:106` 明写「未逐条复核其余 15 行」，`wb-19-develop.md:114` 明写「未逐行重核 `check-i18n-coverage` / `check-prompt-wiring`」。`db-15.md:28-46` 的 19 行对照、`wb-19.md:25-29` 的另 4 行 + 5 条边界，本次 HEAD 复核多数仍逐字吻合，作废它们会丢证据。
3. **新版自身带未复核项**：`db-15-develop.md:107`（`generation-run-service.ts:203` 只标「应向 `:205` 一带核对」，本次 HEAD 实读注释在 `:203`、生产调用在 `:206`）、`wb-19-develop.md:105-116`（exit 2 分支未重核、未逐 diff `8bc4f61f`）。

**怎么用**：判读时**成对引用**；要现值行号以新版为准并落到本表「需修」列；`wb-19.md` 的第 28 行（复合编号不参与判定）必须**整体作废**，不能因为有了新版就继续引用。`db-15.md` 的第 14 行同理（「三处文案 + 仍可复制」在 `13240ffd` 已是两套东西、`:340` 极性反转）。

### 与 QA 底账 `review-qa-baseline.md` 的差异（本次独立发现）

1. **8 份 CLAIM 自述时间 > mtime 15–143 分钟，且全部晚于对应报告交付时间** —— QA 底账 §1.3 只列了 mtime，未核内容自洽；这 8 份因此从「无判定」进「需修」。
2. **`wb-16.md` 的 `:14` / `:17` 指错行** —— DB-T1（`db-topup-1.md:55-57`）与 QA 底账均判「仍成立」；本次 `git show HEAD` 实读否之，改判需修。
3. **`wb-20.md` 的 `:506` 现值不是空 catch（实为 `:508`）** —— DB-T1（`db-topup-1.md:69`）判「行号与内容逐字未变」；主锚点 `:441-443` 确实未变，但同族清单第 3 处错位，改判需修。
4. **`db-18.md` 的 641 → 643** —— QA 底账与 `db-topup-1.md:91` 标「不确定」，本次 `git ls-tree -r --name-only HEAD` 已定值。
5. **提交数 11 而非 10** —— 任务书 §1 与 `db-topup-1.md:12`（该行自己列了 11 条）均为笔误。
6. 采信 QA 底账 §3.2 的口径分歧结论：`wb-7.md` 按 G7 应判 PASS，本次落到「需修」而非「成立」。

## 5. 交付三步状态与待裁项

| 步 | 状态 | 证据 |
|---|---|---|
| ① claim | ✅ | `CLAIM-review.md` 已新建（本文件写入前落盘） |
| ② 报告 | ✅ | 本文件 `review-overnight.md`；34 行表格 + 三专项 + 反例自检 |
| ③ tag review | ⛔ **未执行** | 见下 |

**第 ③ 步未执行的原因（不是遗漏，是输入缺失）**：`node -e` 只读解析 `.runtime/board.json` 实得 **78 张卡**，按 `updatedAt` 倒序最近一张是 `43c5bcd6…`（2026-11-09 11:21:55Z），**没有本次 review 卡**；唯一标题带 REVIEW 的 `5c40336c-ea83-440a-9ad1-36664d2f787d`「夜跑 REVIEW · 07:00 WorkBuddy 干净会话技术复核（只读）」是 11-11 的 `done` 旧卡，不是本卡。`index.md:209` 也写「review 卡已备未投」。本轮授权「**不建看板卡**」禁止我 create 一张再 tag，且禁止自己 `review --pass`。脚本在 `scripts/task-board/dsh-task-board.mjs`，写法见 `.batch/night/b11-probe-prompt.md:49`。

**待裁（汇总，不擅自处理）**：
1. 第 ③ 步：由作者/看板负责人决定补建卡后 tag，还是指定落到某张既有卡；本报告首段 PASS 仅指文件型判定线达成，**若把第 ③ 步也算硬判定线，请改判 BLOCKED，我不自改**。
2. 任务书 / `db-topup-1.md:12` 的「领先 10 个提交」是否统一更正为 11。
3. `wb-7.md` 的结论词从 FAIL 改 PASS（基线下调）是否由卡主人落笔；本报告只给「需修」清单，不改原件。
4. `db-22.md:113` 与 `wb-19-develop.md:107` 关于 `:113 → :114` 的分歧（本次实读 `:113` 确为 D9–D11、D16 行，倾向不改，留待裁定）。
5. 8 份 CLAIM 的时间字段是否按 mtime 批量更正，抑或统一注明「事后补记」保留原样。

## 6. 复核命令清单与反例自检

**实际执行的命令类别**（全部只读）：`Get-ChildItem -Force .batch/night/reports`（36 文件 + mtime + 字节）；`git rev-parse HEAD` / `git log --oneline -15` / `git rev-list --count 8c0bd657..13240ffd` / `git status --short`；`git ls-tree HEAD -- <36 路径>`（**36/36 OK，无 MISS**）；`git show HEAD:<path>` 与 `git grep -n … HEAD -- <path>`（行号内容）；`git ls-tree -r --name-only HEAD`（106 / 643 / 455 三个计数）；`git diff HEAD -- electron/services/webdav-backup-service.ts`（**EMPTY**，工作区 == HEAD）；`[System.IO.File]::ReadAllLines` 逐份日志（行数 / 汇总 / 缺失首行 / `RUN-MARKERS`）；逐份读 13 报告 + 10 CLAIM + 3 STOP + `index.md` + `review-qa-baseline.md` + `acceptance-gates.md` + `review-batch.md`；`node -e` 只读解析 `.runtime/board.json`。**未执行**任何测试、闸门、写/删源码命令。

- **反例 1**：34 行每格依据均给 `文件:行`、命令名或具体数字；无「已检查 / 没问题 / 符合预期」类空话。
- **反例 2**：判「成立」的 11 行，其源码路径全部经 `git ls-tree HEAD` 命中、关键行号经 `git show HEAD` / `git grep -n HEAD` 逐字吻合；其 `.batch/` 内引用文件全部工作区存在（mtime 已逐行列）。凡行号内容不吻合者（`db-18` 计数、`wb-16` 的 `:14/:17`、`wb-20` 的 `:506`、`wb-19` 反转行）一律未判「成立」。`.batch/` 不入库，`git ls-tree` 查不到是正常的，按验收标准走工作区通道。
- **反例 3**：本轮零重跑；8 份日志 `RUN-MARKERS` ≤ 1，无二次启动；未在任何报告/日志里发现本次复核发起的 `pnpm test`。

**附注**：`master-baseline.log`（今早 12:33:21，368,862 字节）与 `review-qa-baseline.md`（12:54:09，15,056 字节）**不属于昨夜**，未计入 34 行表；`index.md:208` 记 master 对照轮「无结论」（`Test Files / Tests / Duration / FAIL` 命中 0）。`review-qa-baseline.md` 作为独立底账被复用并逐条复核：其 §3.2 六份日志的汇总行/缺失首行行号、§3.3 两版关系结论本次全部核实成立（差异见 §4），未照抄为结论。

---
本报告只交逐份判定与待裁项，**不自行宣布任何卡通过、不执行 `review --pass`、不置 `done`**；签字须换身份。
