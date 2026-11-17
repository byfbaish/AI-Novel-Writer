# P51 · 中位数连续 10 章口径 — 补验一轮回执（addendum）

工作目录：`C:\develop\workspace\AI-writer\wt-p51`（本轮全程未进 `develop`）
分支 `agent/p51-median`｜HEAD `26627655`（未新增 commit）
本轮只做三件事：修 ABI → 自证 ABI → 重跑两条闸门命令。**不判 PASS、不标 done、不动看板、不提交。**

---

## ① ABI 修复（放行清单第 1 条）

### 卡文原文命令

```
cd C:/develop/workspace/AI-writer/wt-p51/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3 && node ../../../../prebuild-install@7.1.3/node_modules/prebuild-install/bin.js -r electron -t 41.10.7
```

### 实际执行的命令（路径少一级 `..` 修正后）

```
Set-Location "C:\develop\workspace\AI-writer\wt-p51\node_modules\.pnpm\better-sqlite3@12.8.0\node_modules\better-sqlite3"
node ../../../prebuild-install@7.1.3/node_modules/prebuild-install/bin.js -r electron -t 41.10.7
```

**为何改路径**：卡文那条按 `../../../../` 解析落在 `wt-p51\node_modules\prebuild-install@7.1.3\...`，实测第一次照抄即 `MODULE_NOT_FOUND`（原文：

```
Error: Cannot find module 'C:\develop\workspace\AI-writer\wt-p51\node_modules\prebuild-install@7.1.3\node_modules\prebuild-install\bin.js'
```

）。从 `better-sqlite3\` 起算，`..\..\..` 才是 `.pnpm\`，`prebuild-install@7.1.3` 确实在那儿（`Test-Path ...\.pnpm\prebuild-install@7.1.3\node_modules\prebuild-install\bin.js` = True；`node_modules\prebuild-install` 顶层未 hoist）。**动作本身未变**，只修相对层级。

### 结果

| 项 | 值 |
| --- | --- |
| 退出码 | `0` |
| 实际耗时 | **2.573 s**（`Stopwatch` 实测，含 node 启动） |
| 命令输出 | 空（无下载、无缓存未命中提示） |
| 是否用了第 2 条兜底（从 develop `cp`） | **未用** |

### 产物 `better_sqlite3.node`

| 时点 | 字节数 | LastWriteTime | CreationTime |
| --- | --- | --- | --- |
| 本轮开跑前 | 1,903,104 | 2026/3/14 7:42:02 | 2026/11/15 7:28:28 |
| 修复后 | 1,903,104 | 2026/3/14 7:42:02 | 2026/11/15 7:28:28 |

字节数与卡文所述「产物 1,903,104B」一致；文件未被改写（prebuild-install 命中已就位产物，静默退出 0）。mtime 保持压缩包内时间、CreationTime 为本次 `node_modules` 建立时刻（2026/11/15 7:28:28）。

**事实核对（不确定项）**：上一轮（10:33）我实测同一路径是 `1,902,080 B / mtime 2026/3/14 7:36:00`，Electron 加载报 `NODE_MODULE_VERSION 137`；本轮开跑前该文件已是 `1,903,104 B / 7:42:02`。这两轮之间文件被替换过一次，**不确定**由谁/何时替换（不是本 Agent 写操作，上一轮我只读未改），本轮只如实记录观测值。

---

## ② ABI 自证（Electron 41 加载并开库）

探针脚本 `wt-p51\.batch\night\staging\probe-abi.cjs`（只读被测项目，未改源码/测试/docs），用 worktree 自带 Electron 41.10.7 的 node 模式执行（`ELECTRON_RUN_AS_NODE=1`）：

```
PROBE status=loaded-and-opened abi=145 electron=41.10.7 node=24.18.0 better-sqlite3=12.8.0 db=C:\develop\workspace\AI-writer\wt-p51\.batch\night\staging\probe-abi.db rows=1 integrity=ok
```

探针做的事：`new Database(<真实 db 文件>)` → `CREATE TABLE` → `INSERT` → `SELECT COUNT(*)` → `PRAGMA integrity_check` → `close()`。退出码 `0`。
同一次调用里 Electron 自带 crashpad 的 `TransactNamedPipe ... (0xEA)` 噪声照录一次：

```
[1115/111105.865:ERROR:third_party\crashpad\crashpad\util\win\registration_protocol_win.cc:136] TransactNamedPipe: 有更多数据可用。 (0xEA)
```

修复前对照（上一轮同一探针位点的错误原文，供 QA 判定「修好了」）：

```
Error: The module '\\?\C:\develop\workspace\AI-writer\wt-p51\node_modules\.pnpm\better-sqlite3@12.8.0\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 145.
```

---

## ③ 重跑两条命令（原文）

### 3.1 放行清单第 3 条：点名套件

```
Already up to date
Done in 307ms using pnpm v11.11.0
$ node scripts/run-tests-electron.mjs "src/components/editor/__tests__/draft-edit-median.test.ts" "electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts"
[1115/111111.253:ERROR:third_party\crashpad\crashpad\util\win\registration_protocol_win.cc:136] TransactNamedPipe: 有更多数据可用。 (0xEA)

 RUN  v4.1.11 C:/develop/workspace/AI-writer/wt-p51

[1115/111111.950:ERROR:third_party\crashpad\...] TransactNamedPipe: 有更多数据可用。 (0xEA)
[1115/111111.963:ERROR:third_party\crashpad\...] TransactNamedPipe: 有更多数据可用。 (0xEA)
 ✓ src/components/editor/__tests__/draft-edit-median.test.ts (11 tests) 3ms
 ✓ electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts (1 test) 173ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Start at  11:11:11
   Duration  1.27s (transform 358ms, setup 193ms, import 716ms, tests 176ms, environment 0ms)
```

退出码 `0`，无失败项。

**通过条数（分开记）**
- 中位数文件：**11 / 11**
- 仓储文件：**1 / 1**

### 3.2 放行清单第 4 条：`pnpm check:fast`

```
Already up to date
Done in 311ms using pnpm v11.11.0
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 21.6s
doc links: checked 1470, broken 2
  docs/design/architecture/p11-plan-validity-and-fact-registry-design.md -> ../../../.workbuddy/memory/notes/data-and-schema.md
  docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md -> ../../.workbuddy/memory/2026-11-10.md

[check:fast] doc-links 失败（0.2s）。修完再提交。
[ELIFECYCLE] Command failed with exit code 1.
```

退出码 `1`。`typecheck` 一步通过（21.6s）；红在 `doc-links` 一步，未执行到 `doc-placement --strict`。

**预置失败：文档缺陷（2 条指向不入库目录的硬链接），与本轮交付无关。** 按本轮口径不进分母，未修、未改 docs；本轮也未重跑 `check-doc-placement.mjs`（前一份回执 §4.3 那条是上一轮单独跑过的，本轮不重复）。上一份回执 §3.2 对这两条的归因表述以本条口径为准。

---

## ④ 仓库状态（原文）

```
$ git -C C:/develop/workspace/AI-writer/wt-p51 status -sb
## agent/p51-median
M  src/components/editor/ReviewReport.tsx
M  src/components/editor/__tests__/draft-edit-median.test.ts
M  src/components/editor/draft-edit-median.ts
```

（`M` 在暂存位列，即上一轮那次点名 `git add` 的 3 个文件；工作树无未暂存改动，无新增未跟踪文件 —— `.batch/` 与 `probe-abi.db` 被忽略未列出。）HEAD 仍 `26627655`。

---

## ⑤ 本轮命令台账

**用到的放行条目**：#1（prebuild-install，路径修正一级）、#3（点名套件）、#4（check:fast）。
**未用**：#2（从 develop 拷产物，因 #1 已退出 0 且产物字节数与卡文一致）。

**清单外的命令与用途（如实列全，均无写入被测项目）**
1. `node ../../../../prebuild-install@7.1.3/...`（卡文原样第一次）—— 仅用于确认卡文路径不可解析，报 `MODULE_NOT_FOUND`，未产生任何产物变更（前后字节数一致）。
2. `Test-Path` / `Get-ChildItem` / `Get-Item`（node_modules、`.pnpm`、产物字节数与 mtime）—— 取证。
3. `node -p "require('.../electron')"` —— 取 Electron 可执行文件绝对路径。
4. `& electron.exe <probe-abi.cjs>`（`ELECTRON_RUN_AS_NODE=1`）—— 卡要求 ② 的 ABI 自证，清单里没有对应条目，故自建只读探针执行一次；只新建了 `.batch/night/staging/probe-abi.cjs` 与 `probe-abi.db` 两个临时文件（均在 `.batch` 忽略区）。
5. `git -C ... status -sb` / `git rev-parse` / `git diff --cached --numstat` —— 只读取证（本卡要求把 `status -sb` 原文贴进回执）。

**未执行**：`pnpm install`、任何 `rebuild`、`pnpm dev`、无参全量 `pnpm test`、`test:browser`、`test:node`、`--config vitest.browser.config.ts`、`prepare-native-for-electron.mjs`、`check-doc-placement.mjs`、任何 `git add` / `commit` / `push` / `tag`，源码/测试/docs 未改一个字符。

---

## ⑥ 归因询问：`better_sqlite3.node` 在两轮之间被替换 —— **未能归因**

由联络人（豆包联络人）于 11:17 直接向执行方提问，原文问答记录如下（非执行方自述，属追加取证）。

**问**：本轮（11:09 这次补验）之前，你有没有在 `C:/develop/workspace/AI-writer/wt-p51` 里跑过 prebuild-install（或 prepare-native-for-electron、rebuild 之类），或者往 `build/Release/better_sqlite3.node` 拷过文件？

**答（11:17，原文摘要）**：「没有。」上一轮（10:33 那一轮）在 wt-p51 内只跑过 `pnpm test <两个点名文件>`（10:33:57 起）、`pnpm check:fast`（约 10:34:0x 起），以及若干只读命令（`git rev-parse` / `diff` / `ls-files` / `grep`、`node -p`、`Test-Path`、`Get-Item`、一次 `check-doc-placement.mjs --strict`）。没有跑 prebuild-install、没有 prepare-native-for-electron、没有 rebuild、没有 `pnpm install`，也没有往 `build/Release/better_sqlite3.node` 拷过任何文件。本轮第一次 prebuild-install 是 11:09 之后，首次还因卡文四级路径报 `MODULE_NOT_FOUND`。

**执行方主动给的一条不确定线索**：那两条 `pnpm` 命令开头都打印了 `Already up to date`（pnpm 跑脚本前的依赖检查）；它无法排除这次检查重新链接过包、从而把产物换成 store 里那份 1,903,104 B 的可能——10:33 读到 1,902,080 B，11:09 前已是 1,903,104 B。

**归因结论：未能归因。** 时间窗 10:33→11:09；现产物 1,903,104 B / mtime 2026-03-14 07:42:02，与 develop 那份字节数、mtime 均相同。已排除：豆包手写写操作（本轮问答）、developer 11:00–11:06 的验证（全在 `/tmp/abi-probe/` 内，无对 wt-p51 的写操作）。**候选路径（未证实）**：`pnpm` 依赖检查的重新链接。此事与本轮三件事（修 ABI / 自证 / 重跑两条命令）的交付结果无关，留待负责人另行裁定。
