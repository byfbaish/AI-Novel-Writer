结论：PARTIAL ｜ 产物：C:\develop\workspace\AI-writer\develop\reports\db-d1-three-classes.md ｜ 判定线：C 类 4 条 + E 类 4 条 + D 类 13 条，每条给出 file:line 或标注"未定位+已排除的文件" ｜ 证据：日志行号 / 代码行号

# DB-D1 · 三小类失败逐条定位（只读）

本轮授权：只读。**没有跑任何测试命令**，没有改任何源文件（唯一写入是本文件）。下面每一条结论都是「日志原文 + 代码原文 + commit diff」三者的互证，凡只有其一支撑的地方都标了「不确定」。

基线：`develop\.batch\night\reports\full-after-enotempty-2.log`（20:02，6993 行，UTF-8 无 BOM）——`Test Files 21 failed | 620 passed (641)` / `Tests 62 failed | 8621 passed | 15 skipped (8698)`。

## 0. 开篇三条勘误（影响后面所有小表的读法）

**0.1 分母照任务书用 21，但 D 类里有 3 条不是真红，是编码。**
日志 `:6371`（:1084 Processes 数组）、`:6401`（:1300 Title）、`:6440`（:2386 ExecutablePath）三条的**实得串是乱码**，形态与 E 类完全一致（`AIС˵����` / `���Ʒ�`）。它们被比较的每一对里，「期望」是 Node 侧 UTF-8 正确值、「实得」是经 PowerShell 边界的错解值 ⇒ 同因不同面。所以本报告仍按 4+4+13 给 21 行，但**真红实为 10 条**，那 3 条在 §2 追加表里定因，在 §3 里只做索引。

**0.2 日志行号与当前源码行号差 1（smoke 测试）。**
`2a98cbf3`（2026-11-12 22:00:22，晚于 20:02 基线）改了 `scripts/__tests__/smoke-win-installer.test.ts`（+5/-2，净 +1 行在文件上部）。所以日志里 `:917/:956/:1083/:1299/:1440/:2385/:3486` 对应的现源码行是 `:918/:957/:1084/:1300/:1441/:2386/:3487`。两列在表里并列，避免拿旧行号去改新文件。

**0.3 C 类的机制在本轮只读范围内没闭合 —— 这是 PARTIAL 的唯一原因。**
详见 §1.Q2：夹具确实写了 `resources/app.asar`、实现确实只认这个路径、两侧字面量逐字节一致，但日志显示断言时刻文件不在。三种解释里两种已被证据排除，第三种需要一次单文件跑测才能定性，而本轮禁止跑测。

---

## 1. C 类 · installer 夹具缺 `resources/app.asar`（条数核对 4 / 4）

日志位置：`:6477`（用例 1）、`:6493`（用例 2）、`:6506`（用例 3）、`:6522`（用例 4），对应文件 `scripts/__tests__/verify-win-package.test.ts`。

| # | 日志行 | 用例 | 期望断言（file:line） | 日志实得 | 最可能代码位置 |
|---|---|---|---|---|---|
| C1 | :6477-6488 | rejects a package without the LanceDB native binding | `test:38` `toThrow('Missing LanceDB Windows native binding')` | `expected … but got 'Missing required package file: …\ai-novel-package-IyXmgq\resources\app.asar'` | 守卫 `scripts/verify-win-package.mjs:60`；夹具写入 `test:35` |
| C2 | :6493-6502 | finds and accepts the unpacked LanceDB binding | `test:56` `expect(verifyWindowsPackage(root)).toMatchObject({…})` | `Error: Missing required package file: …\ai-novel-package-bPj1No\resources\app.asar`（栈 `verifyWindowsPackage mjs:60:38` → `test:56:12`） | 同上：`mjs:57-60`；夹具写入 `test:44` |
| C3 | :6506-6517 | rejects a package without the better-sqlite3 native binding | `test:73` `toThrow('Missing better-sqlite3 Windows native binding')` | 同上形态，目录 `ai-novel-package-lGwwkQ` | `mjs:60`；夹具写入 `test:66` |
| C4 | :6522-6533 | rejects a package missing the Windows secure file-system helper | `test:86` `toThrow('Missing Windows secure file-system helper')` | 同上形态，目录 `ai-novel-package-rZDmwF` | `mjs:60`；夹具写入 `test:78` |

**Q1 夹具在哪个函数里造这个临时包 —— 确定答案。**
- `fixture()`：`scripts/__tests__/verify-win-package.test.ts:16-20`（`mkdtempSync(path.join(tmpdir(), 'ai-novel-package-'))`，目录前缀就是日志里那串）。
- `write(root, relative)`：同文件 `:22-26`（`mkdirSync(path.dirname(target), { recursive: true })` + `writeFileSync(target, 'fixture')`）。
- 四条用例分别在这两行造件：`:35`（C1 的 asar）、`:44`（C2）、`:66`（C3）、`:78`（C4），每条都紧跟 `write(root, 'AI小说作家.exe')`（`:36/:45/:67/:79`）。

**Q2 它本应造出 `resources/app.asar` 的那一步在哪、为什么没造出来 —— 只到「不是 A 也不是 B」，C 未闭合。**
任务书列的三个候选是「没调用 / 调用失败 / 断言前提与实现不一致」。逐条排除：

1. **不是没调用**：日志的代码帧就是运行时代的源码，`test:36/37/38`、`test:84/86` 与当前文件逐行一致（`:6484-6487`、`:6529-6531`），而 `:35` 正好在这段帧上方、第 36 行是 `write(root, 'AI小说作家.exe')` ⇒ 第 35 行必然是 `write(root, 'resources/app.asar')`。调用发生了。
2. **不是前提与实现不一致**：实现侧 `scripts/verify-win-package.mjs:57` `const asar = path.join(unpackedDir, 'resources', 'app.asar')`、`:59-60` 逐个 `existsSync` + 抛错；夹具写的正是同一路径。把两边的字面量按 UTF-8 字节 dump 比对（`'resources'`/`'app.asar'` 全部是 ASCII 单字节），**无不可见字符、无同形字差异**。
3. **不是被 vitest 层清掉**：`discardTree` 的清扫只认 `discard-` 前缀（`test/helpers/temp-dir.ts:102` `if (!name.startsWith(STAGED_PREFIX)) continue`），`globalSetup` 只调这一个函数（`test/global-setup.ts:14-16`）；`vite.config.ts:128-163` 的 test 段只有 `setupFiles`/`globalSetup`/超时/`maxWorkers`/`exclude`，没有 temp 清理。
4. **不是写入抛错**：`writeFileSync` 若抛，用例会以 fs 错误（EPERM/ENOENT）中止，不会走到 `verifyWindowsPackage` 的断言。

于是只剩「文件写成功、断言时刻却不在」这一种形态，而它在本轮可读的证据里**无法再往下切**：
- `full-run` 工作树（20:02 的 cwd，见日志里的 `../develop/node_modules`、`.runtime\.cache\a11-win-driver-*`）**现在已不存在**，没法核当时磁盘状态；
- 唯一能定性的一步是「单文件跑一次，看是写入侧还是读侧」，本轮明确禁止（今天已知它会删 `electron/`）。

**这条红是存量，不是今天某笔提交引入。** 今天 12 份日志（02:43 起）里都能看到 `scripts/__tests__/verify-win-package.test.ts (6 tests | 4 failed)`：`wb-6-run-1`、`lead-wb6-baseline`、`-2`、`-3`、`-4`、`-5`、`-serial`、`master-baseline`、`full-after-fix`、`rerun-27`、`full-after-enotempty`、`full-after-enotempty-2`。两个文件自 `8abee7dc`（2026-08-29）后都没有再改过（`git log -- <两文件>` 各只有一条），所以「今天改坏了」这条路径也不成立。

**Q3 最小改动（只描述，不改） —— 分两种情形，因为根因未定。**
先把「一步拆成可观测的两步」，这是当前最该做的：在每条用例的 `write(...)` 之后、调用 `verifyWindowsPackage` 之前加一条
`expect(existsSync(path.join(root, 'resources', 'app.asar'))).toBe(true)`（`existsSync` 从 `node:fs` 直接取，不经被测模块）。
- 若这条断言也红 ⇒ 问题**在写侧**（temp 写入被环境拦掉或不可见），最小改动是给 `fixture()/write()` 加失败即抛（`writeFileSync` 后回读 `statSync.size`），不碰被测代码；
- 若这条断言绿而 `verifyWindowsPackage` 仍抛 ⇒ 问题**在读侧**，即被测模块在 Electron 运行时下对 `.asar` 路径的 `existsSync` 语义（本仓库测试统一跑 `ELECTRON_RUN_AS_NODE=1`，见 `scripts/run-tests-electron.mjs:51`；这与 D5 的 `archive.cc:215` 是同一类现象）。那时最小改动在 `scripts/verify-win-package.mjs:57-61`，把「必需文件」判定从 `existsSync` 换成不经 asar 语义的 `lstatSync`/`openSync`。
**不确定**：我无法在本轮判定走哪一支。

---

## 2. E 类 · 编码乱码（条数核对 4 / 4，另 3 条同因已并表）

| # | 日志行 | 现源码行 | 期望断言 | 日志实得 | 位置 |
|---|---|---|---|---|---|
| E1 | :6315 | `test:918` | `expect(win32.dirname(result.scratch)).toBe(scratchBase)` | `expected 'C:\Users\\ufffd\\ufffd\\ufffdƷ\ufffd\Ap…' to be 'C:\Users\<用户名>\AppData\Local\VibeCoding…'` | 实得来源 `:293`；期望来源 `:899` |
| E2 | :6331 | `test:957` | `expect(result.scratch).toBe(scratch)` | `…\ai-novel…` 同形；实得 `C:\Users\���Ʒ�\AppData\Local\VibeCodingScratch\an\2873b8f8` | 实得来源 `:293`；期望来源 `:947` |
| E3 | :6424 | `test:1441` | `expect(result.NoBomZhCN).toBe('无法打开官方主页，请稍后重试。')` | `expected '\ufffd޷\ufffd\ufffd򿪹ٷ\ufffd\uf…' to be '无法打开官方主页，请稍后重试。'` | 实得来源 `:293`（脚本 `:1416-1437`）；期望来源 `:1441` 字面量 |
| E4 | :6462 | `test:3487` | `expect(result.FinalTitle).toBe('AI小说作家.exe - 应用程序错误')` | `expected 'AIС˵\ufffd\ufffd\ufffd\ufffd.exe - Ӧ\…' to be 'AI小说作家.exe - 应用程序错误'` | 实得来源 `:275`（`runProbeLibrary`，用例 `:3460-3483`；**中文串在脚本内** `:3472`/`:3480`）；期望来源 `:3487` 字面量 |
| E5（原 D） | :6371 | `test:1084` | `expect(result.Processes).toEqual(['WerFault','WerFault','AI小说作家',…])` | 数组差在 `AI小说作家` → `AIС˵����` | 实得来源 `:275`（`runProbeLibrary`）；期望来源 `:1084` 字面量 |
| E6（原 D） | :6401 | `test:1300` | `expect(result).toEqual({Count:1,ProcessName:'WerFault',Title:'AI小说作家.exe - 应用程序错误'})` | `Title` 变 `AIС˵����.exe - Ӧ�ó������` | 实得来源 `:275`（`runProbeLibrary`，用例 `:1266-1267`）；期望来源 `:1300` |
| E7（原 D） | :6440 | `test:2386` | `expect(parseLastJsonLine(output)).toEqual({State:'legacy-bridge-arm', ExecutablePath: executablePath})` | `ExecutablePath` 变 `C:\Users\<用户名>…` → `C:\Users\���Ʒ�\…\AIС˵����.exe` | 实得来源 `:307`（`runReleaseMonitorLibrary`，用例 `:2377-2378`）；期望来源 `:2387` |

**Q1 实际值从哪里拿的 —— 子进程 stdout，Node 按 UTF-8 解。**
三个夹具助手，全部是 `execFileSync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-Command', <内联脚本>], { encoding: 'utf8' })`：
- `runProbeLibrary`：`scripts/__tests__/smoke-win-installer.test.ts:267-279`（`encoding:'utf8'` 在 `:277`）
- `runInstallerLibrary`：`:281-295`（`encoding:'utf8'` 在 `:293`）
- `runReleaseMonitorLibrary`：`:297-309`（`encoding:'utf8'` 在 `:307`）
取值一律经 `parseLastJsonLine(output)`（`:311-315`）从 stdout 最后一行 JSON `JSON.parse`。**所以「实际值」= PowerShell 子进程 stdout 的字节被 Node 按 UTF-8 解码后的字符串**，中间没有第二次转码。

**Q2 期望值的编码来源 —— Node 进程内的 UTF-8 正确值，不经子进程。**
- E1：`:899` `const scratchBase = join(process.env.LOCALAPPDATA!, 'VibeCodingScratch', 'an')`（Node 读环境变量，W API，中文名正确）。
- E2：`:947` `const scratch = join(process.env.LOCALAPPDATA!, 'VibeCodingScratch', 'an', taskId)`。
- E3/E4/E5/E6/E7：源码字面量（UTF-8 文件里的 `'无法打开官方主页，请稍后重试。'`、`'AI小说作家'` 等），在 `:1441`、`:3487`、`:1084`、`:1300`、`:2387`。

**Q3 哪一侧该转码、在哪一行转 —— 子进程侧；两向都要钉，一处改不够。**
- **上行（PS→Node，stdout）**：在 `:289-291`（`runInstallerLibrary`）、`:275`（`runProbeLibrary`）、`:305`（`runReleaseMonitorLibrary`）拼命令时执行到子进程的第一句就设输出编码（`[Console]::OutputEncoding = [Text.Encoding]::UTF8`）。Node 侧的 `encoding:'utf8'` 本身是「正确的假设」，错的是子进程没按 UTF-8 输出，因此不该先去改 Node 侧。
- **下行（Node→PS，内联脚本里的中文字面量）**：`:6371/:6401/:6462` 出现的 `С˵` 形态说明脚本文本被按另一种代码页解释过。这一向只能在「少走命令行」上解：把内联脚本落成带 UTF-8 BOM 的临时 `.ps1`、用 `-File` 执行。仓库里已有这条约定——该文件自己就有用例钉着「直接由 Windows PowerShell 执行的脚本必须带 UTF-8 BOM」（`:139`，断言区 `:138-170`）。
- 备选（只治上行、治不了下行）：Node 侧改 `encoding:'buffer'` + `TextDecoder('gbk')`。**不建议作为首选**，因为它把「GBK」写进测试契约，而产品侧（`scripts/smoke-win-installer.ps1` 写 JSON 证据）是按 UTF-8 走的。

**「`<用户名>` 被 GBK 解」的迹象是否成立 —— 成立，但不是「一处 GBK」，是两向各错一次。**
- 证据 A（U+FFFD 形态）：E1/E2 实得串是 `C:\Users\���Ʒ�\…`，含 `\ufffd`。U+FFFD 是「字节在目标编码里非法」才产生的替换字符 ⇒ 「某侧按另一种代码页输出、Node 却按 UTF-8 解」确有其事，对应上行。
- 证据 B（西里尔/拉丁扩展形态）：E4/E5/E6 实得串里 `AI小说作家` 变成 `AIС˵����`，位置本该是中文的地方出现了 `С`、`˵` 这类字符，这是「UTF-8 字节被按 cp936 解」的典型结果 ⇒ 下行也有一次错解。
- 两种形态同时出现在同一份日志里，且都指向同一个边界 `execFileSync('powershell.exe', ['-Command', …])`。
- **不确定**：具体代码页号（936 还是 65001 混用）本轮没有实测，只能说「形态符合 cp936」。不写「确认是 GBK」。

---

## 3. D 类 · 真红归因（条数核对 13 / 13：10 条真红 + 3 条编码见 §2 的 E5/E6/E7）

### 3.1 `electron/__tests__/summary-continuity-migration.test.ts` — `no such column: story_day_offset`

| 列 | 内容 |
|---|---|
| 期望断言 | `electron/__tests__/summary-continuity-migration.test.ts:96-107`：`SummaryRepository.saveFinalizedContinuity({draftId, chapterNumber:1, …})` 不抛错；随后 `:109-111` 断言 `summary_snapshots.draft_id = draftId`，`:112-115` 断言删 draft 后快照级联消失 |
| 日志实得 | `:5936-5937` `FAIL … > cascades a migrated finalized continuity snapshot when its draft is deleted` / `SqliteError: no such column: story_day_offset`；栈 `better-sqlite3 wrappers.js:5:21` → `electron/repositories/summary-repository.ts:965:26` → `SummaryRepository.saveFinalizedContinuity …:1002:7` → `electron/__tests__/summary-continuity-migration.test.ts:96:23` |
| 最可能代码位置 | **写入侧** `electron/repositories/summary-repository.ts:968`（UPDATE 的 `story_day_offset = ?, story_day_label = ?`）与 `:987`（INSERT 的列清单里同样两列）。列由 `electron/migrations/m10-story-day.ts:13` 的 `ALTER TABLE summary_snapshots ADD COLUMN story_day_offset INTEGER DEFAULT NULL` 添加；而本用例的库只跑基线 `initializeLegacyBaselineSchema`（`test/helpers/legacy-baseline-fixture.ts:18`），基线 schema 本身不含这两列（`docs/design/architecture/world-state-review-and-wiring-plan.md:660` 明写「基线 `baseline-schema.ts` 一行未改」） |

补充两点（都是证据，不是猜测）：
- 这套「冻结基线上直接引用 M10 列 ⇒ `no such column`」的失败形态，在设计稿里已被预言过：`docs/design/architecture/world-state-review-and-wiring-plan.md:711`（讲的是 `listFinalizedContinuityBefore`，同一类）。
- 同一函数里**读路径是有守卫的**（`:922` `if (storyDayOffset !== null)` 才走 `:923-928` 的 `SELECT … story_day_offset`），只有**写路径无守卫**。同文件已有列存在性守卫的先例：`:943 hasCharacterIdentitySchema(db)`；可复用的通用守卫在 `electron/repositories/derived-source-ref.ts:71` `export function hasColumn`。
- 修法方向（只描述）：按 `:943` 的写法判列存在，不存在时走一份不含这两列的 UPDATE/INSERT 分支。该改的是**实现侧**（测试造的是合法历史库，不该被要求升到 M10）。

### 3.2 `src/components/layout/__tests__/StatusBar.test.tsx` 3 条 — 缺「当前模型：…」文案

三条日志：`:6900`（zh）、`:6916`（en）、`:6932`（回退配置值）。

| 列 | 内容 |
|---|---|
| 期望断言 | `StatusBar.test.tsx:34` `expect(html).toContain('当前模型：实际模型B')`；`:44` `toContain('Current model: 实际模型B')`；`:52` `toContain('当前模型：配置模型A')` |
| 日志实得 | 渲染串里该文案以 **title（tooltip）**形式存在且带括注：`title="当前模型（实际调用）：实际模型B"`，可见文本只有 `<span …>实际模型B</span>`（`:6903/:6919/:6935` 的长串里可直接读到） |
| 最可能代码位置 | 文案产在 `src/shared/statusbar-model.ts:55`（zh `当前模型（实际调用）：${name}` / `当前模型（配置）：${name}`）与 `:50`（en `Current model (actual): …`），`label` 恒等于模型名（`:51/:56`）；渲染在 `src/components/layout/StatusBar.tsx:123`（`title={modelCopy.title}`）与 `:127`（`<span>{modelCopy.label}</span>`） |

决定性旁证：同一模块的自有单测 `src/shared/statusbar-model.test.ts:28` 钉的正是 `{ title: '当前模型（实际调用）：实际模型B', label: '实际模型B' }`，而这条是**绿的**；`statusbar-model.ts:39-41` 的注释把口径写死了：「可见文本仍只有模型名（状态栏是常驻区域，不加前缀、不改颜色）；区分只做在 `title`（tooltip）里」。
⇒ 这三条是**测试断言与现行 D16 契约不一致**，该改测试侧（把断言改成比 `title` 属性，或比 `当前模型（实际调用）：…` 的完整 title 串），**不是组件缺功能**。

### 3.3 `scripts/__tests__/renderer-browser-qualification-contract.test.ts` — 契约入口没同步

| 列 | 内容 |
|---|---|
| 期望断言 | `scripts/__tests__/renderer-browser-qualification-contract.test.ts:32` `expect(packageMetadata.scripts?.test).toBe('vitest run')` |
| 日志实得 | `:6298-6302` `expected 'node scripts/run-tests-electron.mjs' to be 'vitest run'`（Expected `vitest run` / Received `node scripts/run-tests-electron.mjs`） |
| 最可能代码位置 | `package.json` 的 `scripts.test` = `node scripts/run-tests-electron.mjs`；这个入口的立场写在 `scripts/run-tests-electron.mjs:2-33`（`better-sqlite3` 原生模块只能对一份 ABI 编译，统一走 Electron 运行时，`pnpm dev` 与 `pnpm test` 可并存） |

**该改哪边：改测试侧 `:32` 这一行。** 依据三条：
1. 同一条用例的其余断言仍成立——`:33-34` 的 `test:browser = 'vitest run --config vitest.browser.config.ts'` 与 `package.json` 完全一致，`:36-44` 的 browser config 断言也仍成立；
2. 该用例名就叫「keeps real-browser tests out of the default node runner behind a dedicated command」，这个**意图**已被「`test:browser` 单列 + 默认入口是 electron runner」保住，钉死字面量 `'vitest run'` 只是更早版本的入口名；
3. 反过来把 `package.json` 改回 `vitest run`，会同时打掉「全工程一份 ABI」这条（`run-tests-electron.mjs` 的注释与 `AGENTS.md §3` 都把它定为唯一入口）。
（若作者坚持「默认入口的契约就是 `vitest run`」，那要改的是 `package.json`，代价如上——这条属裁定，不属本报告结论。）

### 3.4 `electron/services/__tests__/legacy-roster-generation.test.ts` — 两个错误码谁先命中

| 列 | 内容 |
|---|---|
| 期望断言 | `electron/services/__tests__/legacy-roster-generation.test.ts:123` `await expect(f.owner.executeLegacyRosterGeneration({handle})).rejects.toThrow('GENERATION_SOURCE_CHANGED')`（用例 `:121`：「新repair前作者修改来源或取消不再派发，坏JSON原片保留」，`:122` 让模型只吐 `{坏语法` 并在回调里改 `character_roster_meta.legacy_markdown`） |
| 日志实得 | `:6762-6763` `expected [Function] to throw error including 'GENERATION_SOURCE_CHANGED' but got 'ARTIFACT_INTEGRITY_FAILED'` |
| 最可能代码位置 | 实得码抛在 `electron/repositories/generation-run-repository.ts:404`（`hydrateReceipt` 内一长串完整性条件任一不成立即 `fail('ARTIFACT_INTEGRITY_FAILED')`，条件含 `visible.attemptId/rootActionId/artifactId/epoch/fingerprint/revision` 与 `textHash(visible.text) !== visible.textHash`）；期望码的抛出点在 `electron/services/main-generation-owner.ts:198`（同族还有 `:654/:721/:738/:746/:753`），条件都是 `compareGenerationSourceBindings(...)` 失败 |

**谁先命中：完整性校验先。** `hydrateReceipt`（`generation-run-repository.ts:396-404`）在任何来源绑定比较之前执行——只要产物被读回一次（`:389-394` 的 `receipt`），就说先炸完整性。所以「作者改来源」这条用例拿不到它要的错误码。
**不确定**：`:404` 里究竟是哪一项不成立（`textHash(visible.text) !== visible.textHash` 最可疑，因为该用例的产物是坏 JSON 原片）——本轮只读到了抛出点这一行，没读到写入侧算 `textHash` 的地方，不把「裁剪/归一导致不符」写成结论。
**该改哪边（描述）**：断的是产品侧次序——要么完整性校验放在来源绑定判定之后，要么「坏 JSON 原片」这类合法中间态不该被完整性校验判死。测试的期望值（来源变更优先）本身是它想守的合同，不宜改测试。

### 3.5 `scripts/__tests__/f05-a11-official-windows-driver.test.ts` — hash 断言之前先死在 asar 解析

| 列 | 内容 |
|---|---|
| 期望断言 | `scripts/__tests__/f05-a11-official-windows-driver.test.ts:29` `expect(result.stderr).toContain('Installed app executable hash differs')`（前置 `:28` `expect(result.status).not.toBe(0)` 已成立） |
| 日志实得 | `:5952-5958` `expected '[1112/195731.436:ERROR:electron\shell…' to contain 'Installed app executable hash differs'`，实得行是 `[…:ERROR:electron\shell\common\asar\archive.cc:215] Failed to parse header size from C:\…\a11-win-driver-AWEJNQ\installed-app\resources\app.asar` |
| 最可能代码位置 | 驱动 `scripts/f05-a11-offline-import-journey.mjs:122`（`assert(fs.statSync(exe).isFile() && fs.statSync(asar).isFile(), 'Windows app executable or ASAR missing')`，`asar` 在 `:119` 拼出）与 `:123`（`assert.equal(sha256(exe), expectedExe, '… app executable hash differs')`）；`sha256` 定义在 `:116`（`fs.readFileSync(file)`） |

**机制（三条证据链）：**
1. 用例在 `:23` 用 `process.execPath` 起驱动。本仓库测试统一由 `node scripts/run-tests-electron.mjs` 启动（`package.json` 的 `test`），该脚本 `scripts/run-tests-electron.mjs:48` 用 **`electronExecutable`** 起 vitest ⇒ 测试进程里的 `process.execPath` 是 **electron.exe**，子进程继承 `ELECTRON_RUN_AS_NODE=1`（`:51`）。
2. 报错行的源文件是 `electron\shell\common\asar\archive.cc` —— 这是 Electron 自己的 C++ asar 读取器，不是 Node 的，也不是驱动的 JS。说明驱动进程里的 `fs` 是 **asar-aware 的**，把 `resources\app.asar` 当归档解析；而用例 `:21` 写进去的内容是字符串 `wrong asar`（故意做坏），归档头解析必然失败。
3. 失败发生在此 `:123` 的 hash 比对之前 ⇒ stderr 里没有 `Installed app executable hash differs`。

**这也解释了「补 `ELECTRON_RUN_AS_NODE` 无效已回滚」**：runner 本来就已经设了 `ELECTRON_RUN_AS_NODE=1`（`:51`），这个变量不改变 asar 归档语义，补它等于没补。
**该改哪边（描述）**：驱动侧不要用 asar-aware 的 `fs` 去读「包本身」（`mjs:122` 的 `statSync` 与 `:123/:124` 的 `sha256` 都走它）；可行方向是「用纯 node 子进程算哈希」或「先比 exe 哈希、把 asar 比对放到不会再触发归档解析的地方」，测试侧也可考虑用非 electron 的 node 可执行起驱动。
**不确定**：ELECTRON_RUN_AS_NODE 模式下 asar 补丁是否仍然启用，本轮没有实测，是从报错行的 C++ 文件来源反推的。

### 3.6 `scripts/__tests__/locale-shell.interaction.test.ts` — `expected +0 to be 1`

| 列 | 内容 |
|---|---|
| 期望断言 | `scripts/__tests__/locale-shell.interaction.test.ts:59` `expect(await page.locator('.writer-statusbar').getByText('AI小说作家', { exact: true }).count()).toBe(1)` |
| 日志实得 | `:5986-5993` `expected +0 to be 1`，栈 `❯ scripts/__tests__/locale-shell.interaction.test.ts:59:98`（代码帧就是 `:57/:58/:59` 三行） |
| 最可能代码位置 | **实现侧**：`src/components/layout/StatusBar.tsx` 全文 290 行内**不含**「小说」字面量（`Select-String -Pattern '小说'` = 0）。状态栏只渲染「任务/日志/模型」三个入口（`:97-104`）与模型段（`:123-134`） |

同一条用例的 `:57`（`.writer-topbar` 里的 `AI小说作家`）和 `:58`（`AI Novel Writer`）是通的 ⇒ 产品名当期只在顶栏。所以这条差 1 不是"少渲染一次"，而是**状态栏从来不放产品名**。
**该改哪边**：偏测试侧（把 `:59` 改成断言 topbar，或删掉这条），但「产品名是否必须常驻状态栏」是产品口径，**需作者裁定**，本报告不给裁定。

### 3.7 `scripts/__tests__/public-repository-hygiene.test.ts` 2 条 — 已被 `978502e2` 覆盖

| 列 | 内容 |
|---|---|
| 期望断言（旧版） | `scripts/__tests__/public-repository-hygiene.test.ts:19` `expect(existsSync(target), target).toBe(false)`（`prohibitedPaths` 含 `AGENTS.md`，`:5-13`）；另一条要求 `.gitignore` 含 `/AGENTS.md` |
| 日志实得 | `:6102` `AssertionError: AGENTS.md: expected true to be false`；`:6121` `expected '# 依赖\nnode_modules\n\n# 构建输出\ndist\nd…' to contain '/AGENTS.md'` |
| 覆盖性 | `978502e2`（2026-11-12 21:26:15，**晚于 20:02 基线**）只改这一个文件（+12/-4）：① 从 `prohibitedPaths` 删掉 `AGENTS.md`，判定从 `existsSync` 改为 `git ls-files`（「不入库」而非「工作区不存在」）② 从 `.gitignore` 必备项删掉 `/AGENTS.md`，并补反向断言 `expect(tracked, 'AGENTS.md must stay tracked (ADR-0025)').toBe('AGENTS.md')` 与 `.not.toContain('/AGENTS.md')` |

**判定：两条都被覆盖**（按 diff 判读；本轮未跑测试，属报告与代码互证）。
一处弱断言提醒（不属本轮修法）：新版 `:19` 用 `tracked.includes(target)` 做子串匹配，`rule.md` 会命中 `rules/rule.md.bak` 这类路径；当前列表里无此情形，但这是弱断言。

---

## 4. 未覆盖 / 不确定（别把本报告当成「三类都查清了」）

1. **没跑任何测试。** 「`978502e2` 是否真把两条修绿」「E 类改编码后是否转绿」全部只有日志+代码+diff 互证，没有实测。今天已知跑测会删 `electron/`，这一点没变。
2. **C 类机制未闭合**（§1.Q2）——这是 PARTIAL 的唯一原因。`full-run` 工作树已删，无法核对 20:02 的磁盘状态；要定性必须跑一次那个单文件。
3. **E 类的代码页号未实测**：结论只到「两向各错一次、形态符合 cp936」，没到「确认 936」。
4. **D3.4 只确认了抛出点**，没确认 `generation-run-repository.ts:404` 里哪一项条件不成立（`textHash` 不符只是最可疑）。
5. **D3.5 的 asar 语义未实测**：ELECTRON_RUN_AS_NODE 下 asar 补丁是否仍启用，是从 `archive.cc` 这个 C++ 源文件反推的。
6. **行号偏移**：smoke 测试的日志行号与现源码差 1（`2a98cbf3` 22:00 改动），表里两列并列；其余文件未见偏移。
7. **未读**：`electron/services/legacy-roster-*.ts` 只读了 owner 与 repository 的相关行；`scripts/f05-a11-offline-import-journey.mjs` 只读了 asar/hash 相关行（未通读）；`test/helpers/temp-dir.ts` 读了 40-107 行，未通读全文。
8. **归类修正未改分母**：D 类 13 条里有 3 条实为编码（§2 的 E5/E6/E7）。若 QA 想按真实根因重新归类，分母应为 C4 + E7 + 真红10 = 21；本报告按任务书的 4+4+13 给行，两种口径的对应关系在 §2/§3 交叉标注。
