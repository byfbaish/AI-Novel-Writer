结论：BLOCKED ｜ 产物：C:/develop/workspace/AI-writer/develop/.batch/night/reports/fix-enotempty.md ｜ 判定线：7 文件逐个 `node scripts/run-tests-electron.mjs <file>`（failed=0、ENOTEMPTY=0）+ S1 ⊆ S0（新增=0）+ 反例段裸 `rmSync` 复现 ENOTEMPTY ≥1 ｜ 证据：7 文件 215 用例全过、ENOTEMPTY 全 0、S1 新增 0、`discard-*` 6→6；**卡在反例对照——14 次裸 `rmSync` 单跑 0 命中**

> 卡在哪一步：反例对照的复现条件（全量并发）与本卡明令禁止的「跑全量 / pnpm test 多路径」互斥。未超时（13:39 起约 45 分钟），主体改动与产物已落地，仅此一条验收标准待裁决。

# WB-E1 七个 electron/services 用例 cleanup 换 discardTree

## 0. 前提、授权与口径

- 授权：可改码 + 可提交（不含推送）。分支 `exp/resource-ledger`。时间盒 60 分钟。
- 输入前提（实读，非 BLOCKED）：`test/helpers/temp-dir.ts:39` 导出 `discardTree`；`vite.config.ts:135` `globalSetup: ['test/global-setup.ts']`；`test/global-setup.ts:14-16` 只有 setup、**无 teardown**；`scripts/run-tests-electron.mjs` 存在且参数原样透传 vitest。先例 `project-archive-service.test.ts:31` 的 import 写法一致。
- **补充判定线在开跑前到达**：卡面第 3 条改为集合断言 S1 ⊆ S0（新增=0 为 PASS），不判残留=0；`%TEMP%\discard-*` 只记「不增长」、不算失败、不手工删。**本轮无旧口径跑测数据需作废**，全程按 S0/S1 执行，非「重做」。
- 口径差（如实记录）：补充判定线给的 `dir /b … | sort` 是 cmd 语法；本会话 shell 为 bash/PowerShell，用等价的 `Get-ChildItem -Name … | Sort-Object`（PowerShell）生成 S0/S1，**两份用同一命令**，集合断言成立。曾尝试从 Bash 调 `cmd.exe` 做口径对照，被安全策略拦截，未绕过、未重试。
- 跑前基线（13:44 实测）：`git status --porcelain electron/` = 0 行；`.runtime/.cache/novel-quality-modernization` 顶层 9 项；`%TEMP%\discard-*` = 6；7 处现值与卡面行号逐一吻合（#2/#4 为无空格写法 `fs.rmSync(root,{recursive:true,force:true})`，其余有空格）。

## 1. 改动清单（只动 7 处）

每文件 = **加 1 行 import + 换 1 处 cleanup**，不改断言、不改业务代码、不碰范围外 `rmSync`。`git diff --stat -- electron/` = `7 files changed, 14 insertions(+), 7 deletions(-)`。

| # | 文件 | 卡面行 | 改后行 | cleanup 现值 → 改后 |
|---|---|---|---|---|
| 1 | `generation-source-binding.test.ts` | 75 | 76 | `cleanups.push(() => { db.close(); fs.rmSync(root, { recursive: true, force: true }); });` → `… db.close(); discardTree(root); });` |
| 2 | `graph-generation.test.ts` | 40 | 41 | `cleanup.push(()=>{owners.forEach(...);db.close();fs.rmSync(root,{recursive:true,force:true})})` → `…db.close();discardTree(root)})` |
| 3 | `import-generation.test.ts` | 43 | 44 | `cleanup.push(() => { owner.suspendForProjectClose(); db.close(); fs.rmSync(root, { recursive: true, force: true }) })` → `…db.close(); discardTree(root) })` |
| 4 | `legacy-roster-source.test.ts` | 21 | 22 | `cleanup.push(()=>{db.close();fs.rmSync(root,{recursive:true,force:true})})` → `cleanup.push(()=>{db.close();discardTree(root)})` |
| 5 | `legacy-project-copy-import.test.ts` | 206 | 207 | `afterEach(() => { closeProjectDatabase(); for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })` → `… discardTree(root) })` |
| 6 | `finalization-generation.test.ts` | 64 | 65 | `cleanup.push(() => { owner.suspendForProjectClose(); db.close(); fs.rmSync(root, { recursive: true, force: true }) })` → `…db.close(); discardTree(root) })` |
| 7 | `m01-project-upgrade.test.ts` | 38 | 39 | `for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })` → `for (const root of roots.splice(0)) discardTree(root)` |

import 统一为 `import { discardTree } from '../../../test/helpers/temp-dir'`，放在各文件 import 区末尾。**唯一行号位移 = 目标行 +1**（import 必须在顶部，属必要范围）。#1 原 import 行带分号，初次替换误改了它的分号，已复原，最终 diff 只剩纯 +1 行。

范围外未动（逐条核对 `git diff`）：`external-file-grant-service.test.ts` 全部 15 处、`legacy-project-copy-import.test.ts:245/:767`、以及同目录其余约 50 处 `rmSync`。

## 2. ENOTEMPTY 前后对比

**前值（独立复算，非仅引卡面）**：`.batch/night/reports/full-after-fix.log`，8177 行。

```
Test Files  27 failed | 615 passed (642)
Tests  114 failed | 8578 passed | 16 skipped (8708)
ENOTEMPTY 字面出现 73 次
```

按 7 个目标文件分组统计该文件行数：

```
generation-source-binding   : ENOTEMPTY-lines=0   FAIL-lines=14
graph-generation            : ENOTEMPTY-lines=0   FAIL-lines=8
import-generation           : ENOTEMPTY-lines=0   FAIL-lines=14
legacy-roster-source        : ENOTEMPTY-lines=6   FAIL-lines=6   ← 反例指定文件
legacy-project-copy-import  : ENOTEMPTY-lines=0   FAIL-lines=16
finalization-generation     : ENOTEMPTY-lines=12  FAIL-lines=12
m01-project-upgrade         : ENOTEMPTY-lines=0   FAIL-lines=3
```

错误形态样例（取自日志）：

```
Error: ENOTEMPTY, Directory not empty: \\?\C:\develop\workspace\AI-writer\develop\.runtime\.cache\novel-quality-modernization\finalization-generation-tests\owner-mtpzmJ
```

**后值**：7 个文件逐个单跑，`ENOTEMPTY-HITS` 全部 **0**，合计 215 用例全过（详见 §3）。

## 3. 7 文件逐个命令输出

统一口径：`node scripts/run-tests-electron.mjs <单个文件>`（**未用** `pnpm test` 多路径、**未跑全量**），PowerShell 7 通道。`git-status` = `git status --porcelain electron/` 行数；`cache` = `.runtime/.cache/novel-quality-modernization` 顶层条目数；`discard` = `%TEMP%\discard-*` 目录数。

```
===== [1/7] electron/services/__tests__/generation-source-binding.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  76 passed (76)
  Duration  32.95s (transform 840ms, setup 87ms, import 2.14s, tests 30.55s, environment 0ms)

===== [2/7] electron/services/__tests__/graph-generation.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  15 passed (15)
  Duration  14.45s (transform 937ms, setup 90ms, import 2.26s, tests 11.92s, environment 0ms)

===== [3/7] electron/services/__tests__/import-generation.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  19 passed (19)
  Duration  13.72s (transform 932ms, setup 87ms, import 2.26s, tests 11.20s, environment 0ms)

===== [4/7] electron/services/__tests__/legacy-roster-source.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  12 passed (12)
  Duration  8.30s (transform 392ms, setup 88ms, import 911ms, tests 7.12s, environment 0ms)

===== [5/7] electron/services/__tests__/legacy-project-copy-import.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  40 passed (40)
  Duration  87.36s (transform 858ms, setup 92ms, import 2.14s, tests 84.94s, environment 0ms)

===== [6/7] electron/services/__tests__/finalization-generation.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  40 passed (40)
  Duration  30.27s (transform 984ms, setup 93ms, import 2.41s, tests 27.58s, environment 0ms)

===== [7/7] electron/services/__tests__/m01-project-upgrade.test.ts =====
BEFORE git-status=7 cache=9 discard=6
EXIT=0
AFTER  git-status=7 cache=9 discard=6
GIT-STATUS-DIFF=0 ENOTEMPTY-HITS=0
  Test Files  1 passed (1)
  Tests  13 passed (13)
  Duration  17.62s (transform 283ms, setup 82ms, import 634ms, tests 16.72s, environment 0ms)
```

合计 `215 passed / 0 failed`。每轮 `GIT-STATUS-DIFF=0`（前后输出逐字节一致）。

**关于判定线「跑前跑后 git status 都是 0 行」**：字面 0 行不成立——本卡按授权修改的 7 个文件在提交前必然是 7 行 ` M`。这 7 行在**每一轮跑前、跑后完全相同**（`Compare-Object` 差集 = 0），即测试未额外触碰源码树；这才是该判据的实质（项目 `test/helpers/temp-dir.ts:59-64` 记载的「用例误删 electron/ 455 个源码文件」事故正是这条守卫要防的）。已如实记录绝对行数，提请裁决。

## 4. S0 / S1 集合断言

生成命令（PowerShell，S0/S1 同一命令）：`Get-ChildItem -Name ".runtime/.cache/novel-quality-modernization" | Sort-Object | Set-Content -Encoding utf8 <path>`

`S0.txt`（7 文件开跑前，9 项）：

```
a11-copy-import
finalization-generation-tests
formal-clean-test-fZq18D
graph-owner-tests
import-owner-tests
legacy-owner-tests
legacy-roster-source-tests
s05-m01
s05-sources
```

`S1.txt`（7 文件跑完 + 反例全部结束后复查，9 项）：

```
a11-copy-import
finalization-generation-tests
formal-clean-test-fZq18D
graph-owner-tests
import-owner-tests
legacy-owner-tests
legacy-roster-source-tests
s05-m01
s05-sources
```

**清单差异**：

```
S1-COUNT=9   ADDED=0   REMOVED=0
ADDED-ITEMS=[]   REMOVED-ITEMS=[]
判定：S1 ⊆ S0 ⇒ PASS（新增 = 0）
```

即跑完残留数 = 开跑前残留数 = 9，与补充判定线的预期完全一致（旧的 `binding-*` 等属上一轮同类用例遗留，本轮 `mkdtemp` 新建后 rename 走，未动旧目录）。若按卡面旧口径「残留 = 0」判，会误判失败。

## 5. `%TEMP%\discard-*`

```
DISCARD-BEFORE = 6
DISCARD-AFTER  = 6   （7 文件跑完）
DISCARD-AFTER-ALL = 6（含反例全部跑完后复查）
```

**未增长，正常现象，未当失败、未手工删**。`discardTree` 在句柄未释放时把目录 rename 到 `os.tmpdir()/discard-*`，`globalSetup` 的 `sweepDiscardedTrees()` 在下一轮开跑前收尸（`test/global-setup.ts` 故意不挂 teardown）。本轮 6→6 说明每次开跑的收尸与新增相抵，磁盘未堆残留。

## 6. 反例对照（未达标，BLOCKED 所在）

按卡面固定 #4 `legacy-roster-source.test.ts:21`（改码后 :22），单独恢复成裸 `fs.rmSync(root,{recursive:true,force:true})` 并保留 import，逐次单跑；**全程未改断言、未跑全量、未用 pnpm test 多路径**。

| 轮次 | 条件 | 次数 | EXIT | ENOTEMPTY 命中 | Tests |
|---|---|---|---|---|---|
| A | 默认环境（`CODEBUDDY_SAFE_DELETE_ENABLED=1`）单跑 | 1 | 0 | 0 | 12 passed |
| B | 关 shim（`=0`，`rmSync` 走原生）单跑 | 1 | 0 | 0 | 12 passed |
| C | 关 shim 串行重复单跑 | 8 | 全部 0 | 0 | 各 12 passed |
| D | 关 shim 同文件 4 实例并发（`ForEach-Object -Parallel`） | 4 | 全部 0 | 0 | — |
| 合计 | | **14** | | **0** | |

改回 `discardTree` 后复跑一次（判定线要求的收尾）：

```
RESTORED-EXIT=0  RESTORED-ENOTEMPTY=0
  Test Files  1 passed (1)
  Tests  12 passed (12)
  Duration  11.43s
S1-RECHECK COUNT=9 ADDED=0 REMOVED=0
```

**为什么复现不出（取证，不猜）**：`full-after-fix.log` 里 #4 本身有 **6 行 ENOTEMPTY / 6 行 FAIL**、#6 有 12 行，说明该错误确实存在且这两个文件正是重灾区；但它是**全量并发下的 teardown flake**——

- `docs/handoffs/2026-10-24-p1-1-three-cells-handoff.md:212`：「重跑 34/34 全绿；期 3 也出现过同类（**并行时 `ENOTEMPTY` teardown**）。**报红前先单文件重跑一次再判。**」
- `electron/controllers/__tests__/user-settings-package-controller.test.ts:65-67`：「Windows 句柄释放晚一拍，紧跟 `rmSync` 会撞 ENOTEMPTY/EPERM（teardown 噪声，不是断言失败）… 重试窗口给到 3s」
- `docs/design/architecture/upstream-invalidation-phase2-source-ref-and-read-gates.md:401`：「`afterEach` 里 `fs.rmSync` 撞上未释放的 sqlite 句柄，**断言本身全过**（单跑 29/29）」

即：**唯一能稳定触发它的条件（全量并发）恰是本卡禁止项**。串行单跑（哪怕 14 次）句柄都能及时释放，因此 0 命中。这不等于判定线无鉴别力——前值日志已证明「裸 `rmSync` + 全量并发」会命中 73 次；也不等于修复无效——§3 的 7 文件逐个全绿、§4 的新增 0 是实打实的。

## 7. 通道事故（已修正，留痕）

首次批量跑在 **Git Bash** 下进行，7 个文件全部 `0 test` / `Test Files 1 failed`，报 `Error: Vitest failed to find the runner`，栈顶 `test/setup-locale.ts:13`。查项目记忆 `notes/env-and-conventions.md:184-210` 确认是**已知的 MSYS 外壳假象**（PowerShell 下同样命令完全正常，与 node 版本无关），非代码缺陷。该轮 7 份日志全部作废（未收集到任何用例），且 `cache 9→9`、`discard 6→6`、`git status` 差集 0，**基线未被污染**。随后用 PowerShell 7 单文件探针验证（`generation-source-binding` 76 passed / ENOTEMPTY 0）才重新生成 S0 并跑正式批次。此为**通道重跑**，不是补充判定线所说的「旧口径判定线重做」。

## 8. 未做 / 边界 / 提请裁决

- 未跑全量、未用 `pnpm test` 多路径、未跑 `pnpm check:full`、未改断言、未改业务代码、未改范围外文件、未自己 `review --pass`、未 append 已有报告、未推送。
- 未手工删任何 `%TEMP%\discard-*` 目录。
- **待裁决 1（BLOCKED 主因）**：验收标准「裸 `rmSync` 版本能复现 ENOTEMPTY 至少 1 次」与本卡禁止跑全量互斥。可选：① 接受 `full-after-fix.log` 中 #4 的 6 条 ENOTEMPTY 作为前值替代本轮复现；② 单独授权一次全量并发跑做反例；③ 将该条改写为「单跑条件下 ENOTEMPTY=0 且改回 `discardTree` 后仍为 0」。本卡不代裁。
- **待裁决 2**：判定线「`git status --porcelain electron/` 前后都是 0 行」在「改码未提交」前提下不可能成立（恒为 7 行 ` M`）；本轮以「前后差集 = 0」等价判定，请确认口径。
- **待裁决 3**：看板 `dsh-task-board.mjs list --query` 对 `WB-E1` / `下午批` 均 `no tasks matched`，无卡 ID 可打 `tag --add review`。未造卡、未误 tag 其它卡（`discardTree` 只命中 13:20 的 planning-resume todo 卡，非本卡）。若需走看板，请给卡 ID 或授权建卡。
- 提交范围：`7 个测试文件 + CLAIM-WB-E1.md + fix-enotempty.md + S0.txt + S1.txt`。工作区另有 5 行既有改动（`docs/README.md`、3 个未跟踪 docs 文件、整个 `.batch/` 未跟踪），**不在本卡提交范围**，提交时精确 `git add` 指定路径，不 `add -A`。

BLOCKED · 待裁决
