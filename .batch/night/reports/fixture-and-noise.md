# 溯源 thread11-w4-* 四份 fixture + 定性两类既有噪声（只读）

**结论摘要（5 行内）**
1. 四份文件名可从 `scripts/quality-modernization-driver.mjs:780-783` 与 `protocol.json:3184/3188/3192/3196` 逐字读出；哈希在 `driver.mjs:778`（输入）与 `:780-783`（四份源）。
2. **从未入库**：`git rev-list --all --objects` 命名字符串 0 条；`git log --all --diff-filter=A` 0 条；`git fsck --unreachable` 的 1497 个 tree 对象逐个展开也是 0 条 ⇒ 无 `git cat-file blob` 可恢复。
3. **磁盘也没有**：`C:\develop` 全树（排除 node_modules）`thread11-w4*` = 0；`.runtime` 下 `*-saved*` = 0；dist / build / dist-electron 三个目录存在但无文件。
4. B1（task-board 6 个 `(0 test)`）：**设计如此 + vitest 收集遗漏** —— 它们是 `node:test` 套件（各自 `:1` 从 `node:test` 导入），官方入口是 `node --test scripts/task-board/test/*.test.mjs`（`docs/agents/task-board-channel.md:467` 等 9 处记录通过数）；仓库已有 `.node-test.mjs` 命名约定避开 vitest，这 6 个没跟上。
5. B2（`Invalid package …app.asar`）：两个候选造假包点在 `scripts/__tests__/smoke-win-installer.test.ts:31` 与 `:1008`，且都平台/环境门控；**错误文案在仓库 tracked 文件与 node_modules 内本次读取范围内未找到**，产生点标「不确定」；本仓未启用任何 unhandled 抑制项。

---

## 1. 改动清单

**无。** 本轮只读：没有改任何业务代码 / 测试 / `docs/**` / `scripts/**`，没有新增文件到 `src/` / `electron/` / `scripts/`，没有 git 写操作，没有改全局配置。唯一新建文件是本报告。

---

## 2. 执行记录（命令 + 退出码）

| # | 命令（节选） | 退出码 | 用途 |
|---|---|---|---|
| 1 | `git -C <develop> rev-parse --short HEAD` | 0 | 自证 HEAD = `13240ffd` |
| 2 | `git -C <develop> grep -n "thread11-w4" -- .` | 0 | 找四份文件名的出处 |
| 3 | `Get-Content scripts/quality-modernization-driver.mjs`（455–485） | 0 | 读校验函数原文 |
| 4 | `git -C <develop> grep -n "713e14b0" -- .` | 0 | 定位固定哈希 |
| 5 | `git -C <develop> rev-list --all --objects \| Select-String 'thread11-w4'` | 0（结果 0 条） | 全 refs 对象扫描 |
| 6 | `git -C <develop> log --all --diff-filter=A -- '*thread11-w4*'` | 0（结果 0 条） | 是否曾新增过这些路径 |
| 7 | `git -C <develop> fsck --unreachable --no-reflogs` + 逐 tree `git cat-file -p` | 0 | 扫不可达对象（1826 条 → 1497 tree） |
| 8 | `Test-Path` 11 个候选目录 | 0 | 构建产物 / 缓存目录是否存在 |
| 9 | `Get-ChildItem C:\develop -Recurse -Filter 'thread11-w4*'`（排除 node_modules） | 0（结果 0 条） | 磁盘级搜索 |
| 10 | `Get-ChildItem .runtime -Recurse -Filter '*-saved*'` | 0（结果 0 条） | 备份痕迹 |
| 11 | `Get-Content vite.config.ts`（120–175） | 0 | vitest include/exclude 取证 |
| 12 | `git grep -rn "node:test" -- scripts test src` | 0（9 个文件） | B1 同类规模 |
| 13 | `git grep -rn "app.asar" -- src electron scripts test` | 0 | B2 造假包点 |
| 14 | `Grep "Invalid package"` over `node_modules`（0 match） | 0 | 错误文案出处 |
| 15 | `git log --all -S "Invalid package"` | 0 | 该文案的历史出现 |

**未执行**：任何测试运行器、`pnpm dev`、构建命令、任何 git 写操作。

---

## 3. 原始输出（关键片段原样粘贴）

### 3.1 四份文件名 + 哈希（`scripts/quality-modernization-driver.mjs:778-783`）

```
778:  diagnosticInputHash: '713e14b031d3e373ed603f09b9c36a4ac32415bf3217ddae6961e6c71cb82ada',
780:    premise: { name: 'thread11-w4-premise-saved.md', sha256: '5682e67d6a450405b7ee695e5263da163a37c9bc501ec2e853c51cee4845820a' },
781:    characters: { name: 'thread11-w4-characters-saved.md', sha256: 'b025461e58fb7726e7c6bf445f4112bdcdca726fc6a2264544e0e565be238053' },
782:    worldbuilding: { name: 'thread11-w4-worldbuilding-saved.md', sha256: '5b082ea3b1447bd09e465a9bc7e43c05e057200513691b71b05959060d5e4549' },
783:    rows: { name: 'thread11-w4-blueprint-1791057053875-ce289708-saved-rows.json', sha256: '5d6e65d5e2566e765a0b317f86e43c63310eed1fc2c48e4192d802045d81ff11' },
```

协议侧同文（`docs/research/novel-quality-modernization/protocol.json`）：

```
3181:      "diagnosticInputHash": "713e14b031d3e373ed603f09b9c36a4ac32415bf3217ddae6961e6c71cb82ada",
3184:          "name": "thread11-w4-premise-saved.md",
3188:          "name": "thread11-w4-characters-saved.md",
3192:          "name": "thread11-w4-worldbuilding-saved.md",
3196:          "name": "thread11-w4-blueprint-1791057053875-ce289708-saved-rows.json",
```

强制点（读函数本体 `:463-479`，注意：**卡片说的「463-479 钉死哈希」严格说常量在 `:778`，463-479 是执行校验的函数**，两者指向同一条约束）：

```
463: export function readPlanningNativeSource(inputPath) {
464:   const bytes = fs.readFileSync(inputPath), policy = PLANNING_NATIVE_DIAGNOSTIC
465:   if (digest(bytes) !== policy.diagnosticInputHash) throw new Error('PLANNING_NATIVE_INPUT_DRIFT')
466:   const input = JSON.parse(bytes), values = {}
467:   for (const [key, entry] of Object.entries(policy.sources)) {
468:     const content = fs.readFileSync(path.join(path.dirname(inputPath), entry.name))
469:     if (digest(content) !== entry.sha256) throw new Error('PLANNING_NATIVE_SOURCE_DRIFT')
```

⇒ **四份文件必须与输入 JSON 同目录（sibling）**（`:468` 用 `path.dirname(inputPath)` 拼路径）。

### 3.2 入库史：三重扫描全 0

```
$ git -C <develop> rev-list --all --objects | Select-String 'thread11-w4'
hits = 0

$ git -C <develop> log --all --diff-filter=A --oneline -- '*thread11-w4*'
adds_count = 0

$ git -C <develop> fsck --unreachable --no-reflogs
unreachable_total = 1826      （其中 unreachable tree = 1104、unreachable commit = 393）
trees_to_scan     = 1497      （1104 棵不可达 tree + 393 个不可达 commit 的 tree）
逐个 `git cat-file -p <tree>` 后匹配 'thread11-w4'：
thread11-w4_in_unreachable_trees = 0
```

结论：**四份文件在此仓库的全部 refs（含 `refs/agents/*/checkpoints/*`、`refs/remotes/*`）与全部不可达对象中均从未出现。** 因此不存在可执行的恢复命令——`git cat-file blob <sha>` 需要 blob 存在且能按名定位，这里两个前提都不成立。

### 3.3 磁盘 / 构建产物逐处 `Test-Path`

```
.runtime                   True
.cache                     False
dist                       True
out                        False
build                      True
release                    False
dist-electron              True
node_modules\.cache        False
.batch                     True
temp                       False
.tmp                       False
```

```
$ Get-ChildItem C:\develop\workspace\AI-writer\develop -Recurse -Filter 'thread11-w4*' -File   （排除 node_modules）
found_count = 0

$ Get-ChildItem C:\develop -Recurse -Filter 'thread11-w4*' -File                              （排除 node_modules）
found_count = 0

$ Get-ChildItem <develop>\.runtime -Recurse -File -Filter '*-saved*'
count = 0
```

即：`dist` / `build` / `dist-electron` / `.runtime` / `.batch` 五个目录都在，但**没有任何一个文件命中这四份名字**；`.runtime` 下也没有 `*-saved.*` 形态的备份。

### 3.4 该诊断的触发条件（决定「不恢复」的代价）

```
scripts/quality-modernization-run.mjs:1407:  const planningNative = command === 'planning-native-diagnostic'
scripts/quality-modernization-run.mjs:1544:      if (planningNative) readPlanningNativeSource(diagnosticInputPath)
scripts/__tests__/quality-modernization-planning-resume.test.mjs:25: const inputPath = process.env.QUALITY_PLANNING_RESUME_TEST_INPUT
scripts/__tests__/quality-modernization-planning-resume.test.mjs:26: test.skipIf(!inputPath)('saved-outline continuation uses real owners and SQLite with a synthetic provider', ...
```

---

## 4. 任务 B 的两个定性

### 4.1 B1 · `scripts/task-board/test/*.mjs` 的 `(0 test)`

**性质**：这些文件是 **`node:test` 套件**，不是 vitest 套件；vitest 按默认 include 把它们当测试文件收进来，执行后 0 个用例注册，于是显示 `(0 test)`。

**证据**：

```
scripts/task-board/test/claims.test.mjs:1: import { test, after } from 'node:test'
scripts/task-board/test/cli.test.mjs:1: import { test } from 'node:test'
scripts/task-board/test/identity.test.mjs:1: import { test } from 'node:test'
scripts/task-board/test/mcp.test.mjs:1: import { test } from 'node:test'
scripts/task-board/test/ops.test.mjs:1: import { test } from 'node:test'
scripts/task-board/test/transport.test.mjs:1: import { test } from 'node:test'
```

目录里另有 `fake-board.mjs`（夹具，不是测试文件）。vitest 配置侧：

```
vite.config.ts:128:  test: {
vite.config.ts:150:    exclude: [
151:      ...configDefaults.exclude,
152:      '**/.worktrees/**',
153:      '**/.pnpm-store/**',
154:      '**/.workbuddy/**',
155:      '**/.runtime/**',
156:      '**/plugins/**',
159:      '**/docs/plans/**',
161:    ],
```

⇒ `test` 段**只有 exclude、没有 include**，故落 vitest 默认 include（`**/*.{test,spec}.?(c|m)[jt]s?(x)`），`scripts/task-board/test/*.test.mjs` 命中；而 exclude 里没有覆盖 `scripts/` 的这一子目录。

**它们是否另有入口**：有，且是文档写死的唯一入口——

```
docs/agents/task-board-channel.md:467: | `node --test scripts/task-board/test/*.test.mjs` | **113 / 113 通过**（3.6s）… |
docs/agents/task-board-channel.md:475: | `node --test scripts/task-board/test/*.test.mjs` | 72 条全绿 … |
（同表另见 :484 / :526 / :541 / :551 / :576 / :587）
```

`package.json` 里**没有**对应脚本（`git grep -n 'task-board' -- package.json` 零命中；`package.json:26-29` 只有 `test` / `test:node` / `test:browser` / `test:renderer-surface:e2e`）。所以现在是「靠文档记忆跑」，没有 npm 别名。

**仓库已有同类命名约定（这是关键对照）**：

```
scripts/lib/continuity-calibration.node-test.mjs
scripts/lib/continuity-calibration-runner.node-test.mjs
```

`.node-test.mjs` 后缀**不匹配** vitest 默认 include（需要 `.test.` / `.spec.` 段），所以这两个 node:test 套件从来没被 vitest 收进去。`scripts/__tests__/probe-legacy-project-open.node.mjs` 同理（`.node.mjs` 不匹配）。全仓 `node:test` 引用共 9 个文件，其中只有 task-board 的 6 个踩进了默认 include。

**排除的正确做法**（二选一，代价不同）：

1. **配置侧（推荐）**：在 `vite.config.ts:150-161` 的 `exclude` 里加一行 `'**/scripts/task-board/test/**'`（或更窄 `'scripts/task-board/test/*.test.mjs'`）。改一行、不动任何测试文件、不影响 `node --test` 入口。
2. **命名侧**：把 6 个文件改成 `*.node-test.mjs`。但这会让 `docs/agents/task-board-channel.md` 里 9 处 `node --test scripts/task-board/test/*.test.mjs` 命令失配，必须同提交改文档 —— 代价更大，且违反「同提交同步文档」时容易漏。

**是否算失败**：**不算失败用例**。`(0 test)` 是「文件被收集但没用例注册」，不会进 `failed` 计数。**不确定**的是它对汇总口径的影响：汇总里 `Test Files` 会把这 6 个算进去（显示为 0 test），可能让「文件数」虚高 6；具体计入 passed 还是单列，本次未跑测试，标**不确定**。

**结论**：**设计如此（node:test 套件）+ vitest 侧配置遗漏**，两者都成立，不冲突；缺的是一条 exclude。

### 4.2 B2 · installer 用例自造假包导致的 `Invalid package …app.asar`

**假包写入点（仓库内、按路径分两类）**：

```
scripts/__tests__/smoke-win-installer.test.ts:20-31
  20: oldWriterIt('rejects wrong old-writer binaries and junction paths before launching', () => {
  21:   const project = resolve(process.env.AI_NOVEL_A11_FIXTURE_PROJECT!)
  22:   const guardRoot = mkdtempSync(join(resolve(project, '..'), 'writer-guard-'))
  30:     mkdirSync(join(guardRoot, 'resources'))
  31:     writeFileSync(join(guardRoot, 'resources', 'app.asar'), 'wrong asar')

scripts/__tests__/smoke-win-installer.test.ts:1003-1008
1004:     mkdirSync(resolve('.runtime/cache'), { recursive: true })
1005:     const temporary = mkdtempSync(join(resolve('.runtime/cache'), 's14c-win-official-binding-'))
1006:     mkdirSync(join(temporary, 'resources'))
1007:     writeFileSync(join(temporary, 'AI小说作家.exe'), 'fake installed executable')
1008:     writeFileSync(join(temporary, 'resources', 'app.asar'), 'fake installed asar')
```

- `:31` 那个落在**项目目录之外**（`AI_NOVEL_A11_FIXTURE_PROJECT` 的兄弟目录），且整条用例被 `:17-18` 的 `AI_NOVEL_A11_OLD_EXE` + `AI_NOVEL_A11_FIXTURE_PROJECT` 双环境变量门控（不设置时是 `it.skip`）。
- `:1008` 那个落在**仓库内**的 `.runtime/cache/…`，被 `windowsPowerShellIt`（`:77-87` → `windowsIt` = `:10` `process.platform === 'win32' ? it : it.skip`）门控 —— 在 Windows 上**会真跑**。

**另一类不落在仓库树内**：

```
scripts/__tests__/verify-win-package.test.ts:16-19
  17:   const root = mkdtempSync(path.join(tmpdir(), 'ai-novel-package-'))
  28: afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true }) })
  35:     write(root, 'resources/app.asar')
```

⇒ 这一类的假包在**系统 temp**，`afterEach` 自清（`:28-30`），不会留在仓库里被扫描。

**谁读这些假包**：

```
scripts/smoke-win-app.ps1:895:  $asarPath = Join-Path (Split-Path -Parent $resolvedExe) 'resources\app.asar'
scripts/smoke-win-app.ps1:935:  if ((Get-OldWriterProofHash $asarPath) -ne $verifiedBinary.asar) { … }
scripts/smoke-win-installer.ps1:106:  "--asar-sha256=$((Get-AiNovelFileSha256 -Path (Join-Path $installRoot 'resources\app.asar')).ToLowerInvariant())",
scripts/smoke-win-installer.ps1:176:  $asarSha256 = (Get-AiNovelFileSha256 -Path (Join-Path $installRoot 'resources\app.asar')).ToLowerInvariant()
```

两处都是**按文件名算 sha256 后比对**，不做 asar 结构解析 ⇒ 假包在脚本层的正常结果是「哈希不匹配」而不是「Invalid package」。

**错误文案的来源：本次读取范围内未找到。**

```
$ git -C <develop> grep -rn "Invalid package" -- .        → 仅 2 条，且都不是这条
electron/main.ts:261:      throw new Error('Invalid packaged smoke invocation: exactly one environment and one-time CLI token pair must match')
electron/release-vector-smoke-runner.ts:8:  if (!invocation) throw new Error('Invalid packaged vector smoke invocation')

$ Grep "Invalid package" over node_modules                → Found 0 match(es)

$ git log --all -S "Invalid package"
54f097af / 6ed69574 / 38cf9f04 / 8abee7dc / 44065942    ← 逐个查看补丁，命中的都是
+  if (!invocation) throw new Error('Invalid packaged vector smoke invocation')  的子串，不是 asar 那条
```

⇒ **`Invalid package …app.asar` 这句不是本仓库代码产生的**。它只能来自被调起的子进程/外部工具（Windows 侧安装或打包链路）。具体是哪一个：**不确定**——本次不允许跑测试，无法复现那 48 条 unhandled error 的栈。

**会不会影响全量判定**：**会，而且是「看似绿、退出码不绿」那一类**。vitest 汇总把 `Tests failed` 与 `Errors`（unhandled）分开计；unhandled error 不进 `failed` 数，但会让进程退出码非 0。所以看「failed = 0」会得出「全绿」的错误结论，而真实退出码可能是 1。48 这个具体数字**本次未能复现**（禁跑），标**不确定**。

**有无既有抑制手段**：仓库内**没有**启用任何抑制项——

```
$ git -C <develop> grep -rn "dangerouslyIgnoreUnhandledErrors|onUnhandledError|unhandledRejection" -- vite.config.ts test src electron scripts
（零命中）
```

（`dangerouslyIgnoreUnhandledErrors` 是 vitest 的框架级配置项，本仓 `vite.config.ts:128-162` 未出现；这句是框架事实，不是本仓证据。）另有一个**部分相关**的既有约定：`.runtime/**` 已在 `test.exclude`（`vite.config.ts:155`）里，说明「把临时产物写进 `.runtime`」是既定落点 —— `:1008` 那条确实照做了，所以如果噪声来自它，问题不在路径规范，而在「假包被读取的链路」。

**性质与「是否算失败」**：

| 现象 | 性质 | 算不算失败 |
|---|---|---|
| task-board 6 个 `(0 test)` | 收集口径问题（配置遗漏），用例本身在 `node --test` 下全绿（`docs/agents/task-board-channel.md:467` 记录 113/113） | **不算**（不进 failed），但会虚高文件数（**不确定**具体计法） |
| `Invalid package …app.asar` 48 条 unhandled | 子进程/外部工具的噪声，来源未定位 | **算「结果不可信」**：不影响 failed 计数，但能单独把退出码打成非 0 |

---

## 5. 结论与未做的事

### 5.1 任务 A 结论

- **文件名**（4 个，逐字）：`thread11-w4-premise-saved.md`、`thread11-w4-characters-saved.md`、`thread11-w4-worldbuilding-saved.md`、`thread11-w4-blueprint-1791057053875-ce289708-saved-rows.json`；出处 `scripts/quality-modernization-driver.mjs:780-783`、`docs/research/novel-quality-modernization/protocol.json:3184/3188/3192/3196`；绑定哈希 `driver.mjs:778` + `:780-783`；约束执行点 `:464-470`。
- **从未入库**（三重证据全 0：refs 对象扫描、`--diff-filter=A`、1497 个 tree 的不可达扫描）⇒ **没有可恢复命令**，`git cat-file blob` 无从下手。
- **构建产物/缓存也恢复不了**：五个存在的目录（`.runtime` / `dist` / `build` / `dist-electron` / `.batch`）里 0 命中；`.cache` / `out` / `release` / `node_modules\.cache` / `temp` / `.tmp` 六个目录**根本不存在**。
- **最省事的替代方案（按代价排序，未实施）**：
  1. **保持现状（成本 0）**：该用例本身 `test.skipIf(!inputPath)`（`quality-modernization-planning-resume.test.mjs:25-26`），生产路径也只有显式 `planning-native-diagnostic` 才读（`quality-modernization-run.mjs:1407/:1544`）。代价：planning-native 诊断永久不可跑，`:472-477` 那组一致性断言（`totalChapters` / `wordsPerChapter` / `sources` 比对）失去覆盖。
  2. **找回原始字节（成本中，唯一「不改哈希」的路）**：从 Thread 11 / W4 的原始会话产物里把四份原文件放回，只补文件不改 `driver.mjs` / `protocol.json`。前提是原始字节还在别处；本次只在 `C:\develop` 内搜过（0 命中），其它盘位/其它机器**未扫**。
  3. **按新哈希重建（成本最高）**：重做四份源 + 输入 JSON，再改 `driver.mjs:778-783` 与 `protocol.json:3181-3198` 共 5 个哈希。这会连带让历史 receipt 的 `manifest.diagnosticInputHash` 校验（`driver.mjs:343`）与旧证据失配，破坏可比性；属改协议，需另裁。
  4. **用 saved 场景部分替代（成本低但不完整）**：`readSavedNativeSource`（`driver.mjs:481`）+ `SAVED_NATIVE_REVIEW_DIAGNOSTIC` 能覆盖「续写选路」的一部分，覆盖不了 planning-native 的源一致性断言。

  **建议**：先走 1；若必须补覆盖，先试 2，2 不成再谈 3。

### 5.2 未做 / 未复核（逐条）

- **未跑任何测试**（`pnpm test` / `test:browser` / `test:node` / 任何 `*.browser.tsx` 一律没跑）⇒ B2 的「48 条 unhandled」**未能复现**，来源**不确定**。
- **未扫 `node_modules` 内的 `thread11-w4*`**（判定不需要：该目录是第三方依赖，不承载本项目 fixture；如需绝对完备可补一次）。
- **未扫 `C:\develop` 以外的盘位**（`Documents` / `Desktop` / `Temp` / 其它盘）。任务书说「此前搜索未找到」，本次只复核了 `C:\develop` 全树，结论对**该范围**成立。
- **未核** `git stash list`（`for-each-ref` 输出里未见 `refs/stash`，等于没有 stash）；未核 `git fsck --lost-found`（该选项会往 `.git/lost-found` 写文件，违反只读）。
- **未核** B1 里 `(0 test)` 对汇总计数的确切影响（需跑测试）。
- **未核** `scripts/task-board/test` 的 6 个文件在 `node --test` 下当前是否仍全绿（文档记录的是 2026-11-03 的 113/113，**未复跑**）。
- **不确定**：B2 的 `Invalid package …app.asar` 究竟由哪个外部工具打印；`dist` / `build` / `dist-electron` 三个目录本次只做 `Test-Path`，**未逐个列内容**（全树 `thread11-w4*` 扫描已覆盖文件名，但「改名保存的副本」无法用文件名法排除）。

### 5.3 现场观察（不是本 agent 的改动，给联络人）

收尾时 `git -C <develop> status --short` 已经不再只有 `?? .batch/`，而是：

```
 M docs/README.md
?? .batch/
?? docs/agents/acceptance-gates.md
?? docs/design/product/2026-11-12-author-now-what-works.md
?? docs/research/2026-11-12-less-ai-tone-overlap-assessment.md
```

- `docs/README.md` 的 diff 只有 1 行插入（`docs/README.md:331` 附近的 §4.6 登记表，新增 `2026-11-12-author-now-what-works.md` 一行）。
- 这四处**都不是本 agent 写的**：本 agent 本轮只新建了本报告一个文件，未执行任何写操作。推测是同一 worktree 上有并行 agent 在写文档（会话开始时该状态尚未出现，收尾时出现），但**无法证明先后顺序**，标**不确定**。
- 未对这些改动做任何处理（未 add、未 commit、未 checkout、未删除）。

## [T1] DONE 四份 fixture 从未入库也从未落盘，无 blob 可恢复；B1 属 node:test 套件踩进 vitest 默认 include（缺一条 exclude），B2 错误文案不在本仓代码里、来源不确定。
