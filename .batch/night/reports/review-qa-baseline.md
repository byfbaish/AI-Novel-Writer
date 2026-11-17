# QA 底账 · 昨夜（11-11→11-12）夜跑产物分母

> 用途：给 WorkBuddy review 提供**独立对照物**。本文件**不判分**，只固定分母与读数，供批阅时逐行比对。
> 口径：全部读数由文件工具取得（bash 执行器 04:37 起 `EXECUTOR_UNAVAILABLE`，全组停用），时间一律本机 +08 本地时间，由文件 mtime(ms) 换算。
> 时间换算自证两处：① `wb-7-run-1.log` 内 `Start at 02:41:29` + `Duration 91.86s` = **02:43:01**，与该文件 mtime 02:43:01 **秒级吻合**；② `wb-6-late-result.md` 记后台任务 03:56:11 结束，`wb-6-run-1.log` mtime 为 03:56:10，差 1 秒。
> 分母：**34**。不含 `reports/master-baseline.log`——那是今天 12:27 那轮、仍在写，不属昨夜。

## 1. 34 个文件清单（四类）

### 1.1 报告 13

| # | 文件 | 字节 | mtime | 首段结论词 |
|---|---|---|---|---|
| 1 | `db-15.md` | 12964 | 02:37:54 | PASS |
| 2 | `db-15-develop.md` | 9728 | 03:50:53 | PASS |
| 3 | `db-18.md` | 8771 | 02:39:24 | PASS |
| 4 | `db-22.md` | 10268 | 02:41:11 | PASS |
| 5 | `db-topup-1.md` | 10773 | 02:49:06 | PASS |
| 6 | `db-topup-2.md` | 6412 | 02:49:57 | PASS |
| 7 | `wb-6.md` | 8222 | 03:27:18 | **BLOCKED** |
| 8 | `wb-6-late-result.md` | 3661 | 03:57:18 | **BLOCKED（维持不变）** |
| 9 | `wb-7.md` | 6968 | 02:44:20 | **FAIL** |
| 10 | `wb-16.md` | 9947 | 02:42:31 | PASS |
| 11 | `wb-19.md` | 8303 | 02:43:44 | PASS |
| 12 | `wb-19-develop.md` | 9031 | 03:51:26 | PASS |
| 13 | `wb-20.md` | 8142 | 02:44:58 | PASS |

### 1.2 日志 8

| # | 文件 | 字节 | mtime | 有 vitest 汇总行 |
|---|---|---|---|---|
| 1 | `lead-wb6-baseline.log` | 728057 | 04:03:53 | 有（:7110） |
| 2 | `lead-wb6-baseline-2.log` | 551496 | 04:09:48 | 有（:5016） |
| 3 | `lead-wb6-baseline-3.log` | 731627 | 05:09:42 | 有（:7208） |
| 4 | `lead-wb6-baseline-4.log` | 748048 | 05:20:58 | 有（:7356） |
| 5 | `lead-wb6-baseline-5.log` | 753491 | 05:27:50 | 有（:7405） |
| 6 | `lead-wb6-baseline-serial.log` | 19039 | 04:17:17 | **无**（210 行） |
| 7 | `wb-6-run-1.log` | 1034167 | 03:56:10 | **无**（5901 行） |
| 8 | `wb-7-run-1.log` | 520475 | 02:43:01 | 有（:9014） |

### 1.3 CLAIM 10

| # | 文件 | 字节 | mtime |
|---|---|---|---|
| 1 | `CLAIM-WB-15.md` | 460 | 02:37:19 |
| 2 | `CLAIM-WB-16.md` | 488 | 02:41:18 |
| 3 | `CLAIM-WB-18.md` | 431 | 02:38:04 |
| 4 | `CLAIM-WB-19.md` | 466 | 02:42:42 |
| 5 | `CLAIM-WB-20.md` | 402 | 02:43:50 |
| 6 | `CLAIM-WB-22.md` | 401 | 02:39:30 |
| 7 | `CLAIM-WB-6.md` | 2686 | 02:44:58 |
| 8 | `CLAIM-WB-7.md` | 2314 | 02:40:54 |
| 9 | `CLAIM-DB-T1.md` | 446 | 02:48:02 |
| 10 | `CLAIM-DB-T2.md` | 448 | 02:49:36 |

### 1.4 STOP 3

| # | 文件 | 字节 | mtime | 备注 |
|---|---|---|---|---|
| 1 | `STOP-db-t3.md` | 11 | 03:51:30 | 11 字节＝空壳，不能当「已停止」的证据用 |
| 2 | `STOP-db-topup.md` | 11 | 02:50:04 | 同上 |
| 3 | `STOP-wb.md` | 1922 | 03:25:48 | 有正文，可读 |

## 2. 13 份报告首段原文（逐字，未转述）

1. `db-15.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-15.md ｜ 判定线：文件型（首段含「结论：」+ 对照表数据行 ≥15 + 不一致项每条含 `文件:行`） ｜ 证据：19 行逐条对照，5 条不一致项均带 wt-1@8c0bd657 的 `文件:行`；读数面 wt-1（agent/wt-1@8c0bd657）
2. `db-15-develop.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-15-develop.md ｜ 判定线：文件型（5 处行号 + 1 条失效子行，每处给旧→新→新行原文；≥3 处为 `git -C develop grep` 实取） ｜ 证据：HEAD=`13240ffd` 自证通过；5 处全部用 develop grep 重取，其中第 5 处（常量）复核后**不是位移而是原件指错行**，已回正
3. `db-18.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-18.md ｜ 判定线：文件型（首段含「结论：」+ 两表齐全 + 场景行 ≥5 + 差异表每行含配置 `:行号`） ｜ 证据：三 runner 差异表 10 行、场景判定表 6 行，每行均落到 `package.json` / `vite.config.ts` / `vitest.browser.config.ts` / `scripts/run-tests-electron.mjs` 的 `:行号`
4. `db-22.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-22.md ｜ 判定线：文件型（首段含「结论：」+ 表格覆盖 D17 / D9 / D20 + 冲突项含两处 `文件:行`） ｜ 证据：前提 grep 命中 18 文件；四列交叉表 6 行覆盖 D17x2 / D9x2 / D20x2；4 组冲突各给两处（甚至三处）`文件:行`
5. `db-topup-1.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-topup-1.md ｜ 判定线：文件型（首段含「结论：」+ 6 份逐一列出 + 每份 ≥1 处 develop 现值 `文件:行` + 三态计数） ｜ 证据：6 份全部复核，三态 = 仍成立 4 / 需改行号 1 / 已失效 1；每份均带 `13240ffd` 上的实取行号
6. `db-topup-2.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/db-topup-2.md ｜ 判定线：文件型（首段含「结论：」+ ≥1 处日志行号 + 三项各一句 + 明确「可/不可」） ｜ 证据：日志 :9014/:9015/:9017 与报告数字逐字一致；报告未声明 HEAD sha 与工作区干净度（wb-7.md:9 只到 toplevel + 分支），结论判「可」
7. `wb-6.md:1` — 结论：BLOCKED ｜ 产物：.batch/night/reports/wb-6.md ｜ 判定线：Test-Path ./.batch/night/reports/wb-6.md; Select-String -Pattern '结论：|exit code|passed|failed|total|\.test\.(ts|tsx|mjs):[0-9]+' ./.batch/night/reports/wb-6.md ｜ 证据：wb-6-run-1.log 定格在 02:53:25（1,034,112 字节 / 5900 行）、0 条 vitest 汇总行，`pnpm test` 在 40 分钟盒内未退出 → exit code 与四个数均未取得（见 STOP-wb.md）
8. `wb-6-late-result.md:1` — 结论：BLOCKED（维持不变） ｜ 产物：.batch/night/reports/wb-6-late-result.md ｜ 判定线：本文件为停手后的迟到结果补记，不替代 wb-6.md、不计入卡片判定线、不重跑 ｜ 证据：后台任务 ivfiyg 于 03:56:11 自行结束，EXITCODE=-1 / ELAPSED_SEC=4264.8，日志仅新增 1 行 `[ELIFECYCLE] Test failed`，vitest 汇总行仍为 0 条
9. `wb-7.md:1` — 结论：FAIL ｜ 产物：.batch/night/reports/wb-7.md ｜ 判定线：Test-Path ./.batch/night/reports/wb-7.md; Select-String -Pattern '结论：|failed / passed / total|\.tsx:[0-9]+' ./.batch/night/reports/wb-7.md ｜ 证据：wb-7-run-1.log:9014-9017 = `1 failed | 836 passed (837)`、Duration 91.86s，失败清单仅 RendererStartup.browser.tsx:137:25，基线的 B16 未复现
10. `wb-16.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/wb-16.md ｜ 判定线：文件型（首段含「结论：」+ ≥3 处 `path:行号` 源码引用 + 含「能/不能」二择一明确回答） ｜ 证据：前提 grep 已实跑（`src/` 内 15 处命中含 `RootBudget` 定义），报告含 11 处 `path:行号`，§4 给出「能（有前提）」二择一
11. `wb-19.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/wb-19.md ｜ 判定线：文件型（首段含「结论：」+ 对照表数据行 = 5 + 边界 ≥3 且每条含 `脚本:行号`） ｜ 证据：5 行对照表逐行落到脚本 `:行号`；5 条边界每条带 `脚本:行号`；`check-fast` 步数按实读为 **3**
12. `wb-19-develop.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/wb-19-develop.md ｜ 判定线：文件型（1 条反转行带实现行号 + 关键代码原文；4 条仍成立带现值行号；≥3 处为 `git -C develop grep` 实取） ｜ 证据：`check-ledger-snapshot.mjs:63-87`（`expandIdCell`）与调用 `:160/:166` 实读确认复合编号**已展开参与判定**，旧结论反向；其余 4 行现值行号已逐条重取
13. `wb-20.md:1` — 结论：PASS ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/wb-20.md ｜ 判定线：文件型（首段含「结论：」+ 精确 `文件:行` ≥2 + 含「是否静默失败」是/否结论 + 两档修法各给行号） ｜ 证据：主锚点 `electron/services/webdav-backup-service.ts:441/:442/:443`，另登记同族 `.catch(() => {})` 8 处；结论「对备份成败=否，对清理残留=是」

## 3. 三处专项的独立底账

### 3.1 `wb-6.md` vs `wb-6-late-result.md`

| 项 | `wb-6.md`（03:27:18） | `wb-6-late-result.md`（03:57:18） |
|---|---|---|
| 结论词 | BLOCKED | BLOCKED（维持不变） |
| 自述定位 | 正式卡产物 | 明确写「不替代 wb-6.md、不计入卡片判定线、不重跑」 |
| 证据 | 日志定格 02:53:25、5900 行、0 条汇总行 | 任务 ivfiyg 03:56:11 结束、EXITCODE=-1、ELAPSED_SEC=4264.8、日志仅加 1 行 `[ELIFECYCLE] Test failed` |

**我的读数（独立复核）**：`wb-6-run-1.log` 实测 **5901 行** = 5900（wb-6.md 时的定格）+ 1（迟到的 `[ELIFECYCLE] Test failed`）；全文 `Test Files` / `Tests` 汇总行 **0 条**（我按 `^ *(Test Files|Tests|Duration)` 扫过，无命中）。

**结论**：两份**并存、不互斥**。late-result 只补「进程已死 + exit code=-1」这一个事实，仍然没有 vitest 四数 ⇒ WB-6 的判定线从未达成，「BLOCKED」成立。**任何把这两份读成「基线已建成」的表述都是错的**；两份都不能当作「多一条红」级别的读数使用。

**一条待对齐**：`elapsed 4264.8s` ≈ 71 分钟，而 wb-6 卡的时间盒是 40 分钟。即这个进程跑到 03:56 才自己结束，**在「停手」之后仍在改工作区**——review 若要引用「03:27 之后的产物」，须把这 29 分钟算进去。

### 3.2 六份 baseline 日志逐份读数

| 日志 | 汇总行 | Test Files | Tests | 采集面 | 最早出现「electron 已不在」的行 | 判定 |
|---|---|---|---|---|---|---|
| `lead-wb6-baseline.log` | :7110-7114 | 269 failed / 373 passed (**642**) | 65 failed / 5293 passed / 5 skipped (5363) | 642，完整 | **:4376** `Cannot find module '.../electron/__tests__/creative-strategy-migration.test.ts'` | 作废 |
| `lead-wb6-baseline-2.log` | :5016-5020 | 37 failed / 372 passed (**409**) | 36 failed / 5187 passed / 3 skipped (5226) | **409 ≠ 642，开跑前已少 233 个文件** | :3899 `Cannot find module '../../electron/llm/openai-provider'`；:3971 `ENOENT ... electron\main.ts` | 作废（最严重） |
| `lead-wb6-baseline-3.log` | :7208-7212 | 268 failed / 374 passed (**642**) | 68 failed / 5715 passed / 5 skipped (5788) | 642 | **:4671** | 作废 |
| `lead-wb6-baseline-4.log` | :7356-7360 | 270 failed / 372 passed (**642**) | 78 failed / 5448 passed / 5 skipped (5531) | 642 | **:4433** | 作废 |
| `lead-wb6-baseline-5.log` | :7405-7409 | 270 failed / 372 passed (**642**) | 77 failed / 5449 passed / 5 skipped (5531) | 642 | **:4438** | 作废 |
| `lead-wb6-baseline-serial.log` | 无 | — | — | 210 行，无汇总 | — | INVALID |

**一句话结论**：六份里**没有一份可当基线**。判据不是「红多了几条」，而是：五份有汇总的日志都在**跑到一半**（:4376 / :4671 / :4433 / :4438）开始成片 `Cannot find module .../electron/**`，失败面到 **268–270 个测试文件**量级；baseline-2 更彻底——采集面只有 409 个文件（比 642 少 233），说明**它开跑时 electron 已经不在**。任何引用这六份里「passed 数」当基线的写法都应打回。

**唯一可采信的昨夜测试证据**是 `wb-7-run-1.log`（browser 单独跑）：`Test Files 1 failed | 105 passed (106)`、`Tests 1 failed | 836 passed (837)`、`Start at 02:41:29`、`Duration 91.86s`，与 11-11 已知基线总例数 837 一致。注意该行带 ANSI 颜色码（`\u001b[2m Test Files`），用 `^ *Test Files` 匹配会**漏命中**——review 若因此判「无汇总」，那是匹配问题不是文件问题。

**一条口径分歧（留待批阅时对齐）**：`wb-7.md` 首段判 **FAIL**，但其自身证据是 `1 failed / 836 passed`、且「基线的 B16 未复现」。按我写进 `docs/agents/acceptance-gates.md` 的 G7 口径（浏览器全量 ≤1 条红且必须是 B11 ⇒ 过），这条应判 **PASS**。分歧在「与既有基线 2 failed 比是变好还是变坏」的取法，不是事实分歧。

### 3.3 `db-15` / `wb-19` 两版关系

| 对 | 旧版 | 新版 | 关系 |
|---|---|---|---|
| `db-15.md` → `db-15-develop.md` | 02:37:54，PASS，19 行对照、5 条不一致；**读数面 `agent/wt-1@8c0bd657`（worktree）** | 03:50:53，PASS，**读数面 develop `13240ffd`**；5 处行号按现值重取，其中第 5 处判「不是位移而是**原件指错行**，已回正」 | **补正并存**，不是替代 |
| `wb-19.md` → `wb-19-develop.md` | 02:43:44，PASS，5 行对照 + 5 条边界，`check-fast` 步数 = 3 | 03:51:26，PASS，含**1 条反转行**：`8bc4f61f` 后复合编号已展开参与判定，旧结论反向；其余 4 条现值行号重取 | **补正并存**，不是替代 |

**独立复核**：`wb-19-develop.md` 的反转依据我按源码核过 —— `scripts/check-ledger-snapshot.mjs:63` `export function expandIdCell(cell) {`，调用点在 `:160`、`:166`，与报告所述一致，所以「复合编号已展开参与判定」成立。

**结论**：两对都是「新版补正旧版中的若干条」，**旧版全文不能整体作废**（只是其中被点名的条目失效），新版也不能替代旧版的读数面结论——两者检出的 commit 不同（`8c0bd657` vs `13240ffd`）。引用任何一份都必须同时写清读数面，否则不可复算。

## 4. 附注：超出本任务的一条发现（供裁定，不进分母）

`run-baseline-3.sh` 的两个时间比较都是**同一处 bug**：

- 第 10 行 `while [ "$(date +%H%M)" -lt 0630 ]; do sleep 20; done`
- 第 27 行 `if [ "$hhmm" -ge 0800 ]; then`

`date +%H%M` 带前导 0，bash 的 `[` 会按**八进制**解析；当分钟位含 8 或 9（如 `0438`）时是非法八进制 → 比较**报错**、条件判假。后果：

1. 06:30 从未生效：日志 mtime 证明 baseline-3 **05:09:42 就已经跑完**，而它 04:34:45 armed 后写的是「waiting for 06:30」。唯一自洽解释是第 10 行在 04:38（`0438`）判假退出，实际提前近两小时开跑。
2. 08:00 硬停同理：`hhmm` 含 8/9 时报错 → 判假 → 硬停不会触发。

即昨夜这套「06:30 自动开跑 / 08:00 硬停 / 15 分钟零增长」三道守卫里，**前两道因词法 bug 失效**，只剩零增长那一道（它比的是秒数变量，不涉及 `%H%M`）。

修法一行：改用 `printf -v hhmm '%(%H%M)T' -1` 不行（同样有前导 0）——正确做法是 `hhmm=$((10#$(date +%H%M)))` 强制十进制，或直接比 `date +%s` 的时间戳。这条改动属于环境/工具链，按分工归 developer。
