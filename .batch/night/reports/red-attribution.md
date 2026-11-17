# 卡 A · 剩余失败逐条归因（21 条）

> 输入：`.batch/night/reports/full-after-ab-clean.log`（680,107B；11-12 23:02:03；MD5 `34dd75315ca430402a5fe04d4e5ec9fc`，与派卡一致）。
> 末尾汇总（`full-after-ab-clean.log:6231-6233`）：`Test Files 16 failed | Tests 21 failed | Errors 2`。

**分母交代（不预设数字）**：本表 21 行 = 日志 `⎯⎯ Failed Tests 21 ⎯⎯`（`:5825`）下实际列出的 21 条用例，一条不多一条不少。
日志里另有 **7 个「文件级失败」**（`:5775` `Failed Suites 7`）与 **2 条 unhandled error**（`:6195`），**不计入 21**，单列在 §5，理由与上一轮 62 条报告相同（按 `Test Files` 计，不按 `Tests` 计）。

**分类口径**：沿用 `qa-62-failures-attribution.md` 的 A–F（A 环境/脏树 · B EPERM · C 夹具 · D 真红=断言与实现或契约不一致 · E 编码 · F 误收）。本卡**没有新增大类**，但在 D 内部必须再分一档，否则会把「产品坏了」与「测试没跟上」混成一堆（见 §3）。

**结论先说**：21 条里**产品缺陷只有 1 条**（`:6136` legacy-roster 的错误码错档）。上一轮记为 D 的三条「硬红」经取证**降档**：`story_day_offset` 是**夹具**没跑迁移 lane（不是产品 schema 漂移），StatusBar 三条是**实现改了文案、测试没同提交跟**。

---

## 1. 逐条表（21 行）

| # | 文件:行号（日志） | 测试名 | 失败原文（关键一句） | 归因类别 | 是否产品缺陷 |
|---|---|---|---|---|---|
| 1 | `:5827`（断言失败点 `electron/__tests__/summary-continuity-migration.test.ts:96`） | summary continuity migration > cascades a migrated finalized continuity snapshot when its draft is deleted | `SqliteError: no such column: story_day_offset`（`summary-repository.ts:965` UPDATE） | **C 夹具**（legacy 夹具只建 baseline，不跑 M10 lane） | **否** |
| 2 | `:5843`（`scripts/__tests__/f05-a11-official-windows-driver.test.ts:29`） | admits the installed official Windows mode before checking package bytes | `expected '…Failed to parse header size from …\app.asar…' to contain 'Installed app executable hash differs'` | **C 夹具**（夹具写了 9 字节假 `app.asar`，Electron fs 补丁 stat 即抛 `Invalid package`，崩在哈希比较之前） | **否** |
| 3 | `:5877`（`scripts/__tests__/locale-shell.interaction.test.ts:59`） | locale shell browser regression > updates mounted shell components immediately and keeps the update card readable at 448px | `expected +0 to be 1`（`.writer-statusbar` 里找不到 `AI小说作家`） | **D-断言漂移**（断言指向 StatusBar 里从未存在的品牌文案） | **否** |
| 4 | `:5896`（`scripts/__tests__/quality-modernization-run.test.mjs:448`） | post-UI baseline uses its native review projection, persisted AI-only confirmation and 8192 refine command | `Error: ENOTEMPTY, Directory not empty: …\.runtime\.cache\novel-quality-modernization\post-ui-baseline-native-cBACyU` | **A 环境/脏树**（`finally` 里裸 `fs.rmSync` 删树） | **否** |
| 5 | `:5908`（`scripts/__tests__/renderer-browser-qualification-contract.test.ts:32`） | renderer browser qualification contract > keeps real-browser tests out of the default node runner behind a dedicated command | `expected 'node scripts/run-tests-electron.mjs' to be 'vitest run'` | **D-断言漂移**（`36f8748e` 把 `scripts.test` 换成 Electron 运行器，合同测试没同提交改） | **否** |
| 6 | `:5924`（`scripts/__tests__/smoke-win-installer.test.ts:918`） | Windows installer smoke contract > gives both official journeys an owned short scratch before launching | `expected 'C:\Users\���Ʒ�\AppData\…' to be 'C:\Users\<用户名>\AppData\Local\VibeCoding…'` | **E 编码**（PS 5.1 stdout 按 CP936 出、按 utf8 解） | **否** |
| 7 | `:5940`（同文件 `:957`） | … > never reuses an existing official scratch task directory | `expected 'C:\Users\���Ʒ�\AppData\…\13d3786a' to be 'C:\Users\<用户名>\…'` | **E 编码**（同上） | **否** |
| 8 | `:5956`（同文件 `:992`） | … > preserves the failed official receipt bytes in existing diagnostics and still fails | `Error: ENOENT: no such file or directory, open 'C:\Users\���Ʒ�\…\receipt.json'` | **E 编码**（乱码路径直接导致 ENOENT，是 6/7 的连带） | **否** |
| 9 | `:5968`（同文件 `:1084`） | … > detects only new error windows, including system-owned dialogs outside the app process tree | `expected [ 'WerFault','WerFault',… ] to deeply equal […]`，差异项 `'AIС˵����'` vs `'AI小说作家'` | **E 编码**（窗口标题过 PS 输出被转码） | **否** |
| 10 | `:5998`（同文件 `:1300`） | … > detects new global error windows when both target collections are empty | `Title: 'AIС˵����.exe - Ӧ�ó������'` vs `'AI小说作家.exe - 应用程序错误'` | **E 编码**（同上） | **否** |
| 11 | `:6021`（同文件 `:1441`） | … > decodes Electron UTF-8 JSON evidence exactly in Windows PowerShell 5.1 with and without a BOM | `expected '\ufffd޷\ufffd\ufffd򿪹ٷ\ufffd…' to be '无法打开官方主页，请稍后重试。'` | **E 编码**（传输层；见 §4 备注 A） | **否**（有 1 个未排除项，见 §4-A） |
| 12 | `:6037`（同文件 `:2386`） | … > reads Node-authored UTF-8 monitor control paths without corrupting non-ASCII characters | `ExecutablePath: 'C:\Users\���Ʒ�\…\AIС˵����.exe'` vs `'…\<用户名>\…\AI小说作家.exe'` | **E 编码**（同上） | **否** |
| 13 | `:6059`（同文件 `:3487`） | … > rejects a delayed product error dialog during the application post-exit period | `expected 'AIС˵����.exe - Ӧ�ó������' to be 'AI小说作家.exe - 应用程序错误'` | **E 编码**（同上） | **否** |
| 14 | `:6075`（`scripts/__tests__/verify-win-package.test.ts:38`） | Windows package verification > rejects a package without the LanceDB native binding | `got 'Missing required package file: …\Temp\ai-novel-package-Fm0ddG\resources\app.asar'` | **C 夹具**（假 asar 在 Electron 运行时不可 stat，第一条断言即短路） | **否** |
| 15 | `:6091`（同文件 `:56`） | … > finds and accepts the unpacked LanceDB binding | `Error: Missing required package file: …\ai-novel-package-5cfxOp\resources\app.asar` | **C 夹具**（同上） | **否** |
| 16 | `:6104`（同文件 `:73`） | … > rejects a package without the better-sqlite3 native binding | `got 'Missing required package file: …\ai-novel-package-gliTGT\resources\app.asar'` | **C 夹具**（同上） | **否** |
| 17 | `:6120`（同文件 `:86`） | … > rejects a package missing the Windows secure file-system helper | `got 'Missing required package file: …\ai-novel-package-HNlr65\resources\app.asar'` | **C 夹具**（同上，14–17 同源） | **否** |
| 18 | `:6136`（`electron/services/__tests__/legacy-roster-generation.test.ts:123`） | 新repair前作者修改来源或取消不再派发，坏JSON原片保留 | `expected [Function] to throw error including 'GENERATION_SOURCE_CHANGED' but got 'ARTIFACT_INTEGRITY_FAILED'` | **D-真红**（错误码错档：源变化被报成制品损坏） | **是** |
| 19 | `:6147`（`src/components/layout/__tests__/StatusBar.test.tsx:34`） | StatusBar model indicator (D16) > 配置 A / 实际调用 B ⇒ 界面显示 B，不显示 A（zh） | `expected '<div class="writer-statusbar…' to contain '当前模型：实际模型B'`（实际 title 是 `当前模型（实际调用）：…`） | **D-断言漂移**（`90770846` 改文案未同步测试） | **否** |
| 20 | `:6163`（同文件 `:44`） | … > 配置 A / 实际调用 B ⇒ 界面显示 B，不显示 A（en，zh/en 不串） | `expected '…' to contain 'Current model: 实际模型B'`（实际 `Current model (actual): …`） | **D-断言漂移**（同上） | **否** |
| 21 | `:6179`（同文件 `:52`） | … > 尚无实际调用记录时退回配置选中值（不打坏原有显示） | `expected '<div class="writer-statusbar…' to contain '当前模型：配置模型A'` | **D-断言漂移**（同上，19–21 同源） | **否** |

**分类合计**：A **1** ｜ B **0** ｜ C **6** ｜ D **6**（其中真红 1、断言漂移 5）｜ E **8** ｜ F **0**。
逐条对应：A=#4；C=#1 #2 #14 #15 #16 #17；E=#6–#13；D=#3 #5 #18 #19 #20 #21 → 1+6+8+6 = **21** ✅

> 与上一轮 62 条报告的对照：A 从 6 降到 1（`discardTree` 修了 7 个用例，漏了 `quality-modernization-run.test.mjs:448` 这一处裸 `rmSync`）；B（35 条 EPERM）**全清零**；C 从 4 升到 6（多出 #1 #2，是同一根因「假 asar」与「夹具不跑迁移 lane」）；D 从 13 降到 6，且原判「最硬的真红 `story_day_offset`」**降档为 C**；E 从 4 升到 8（`smoke` 里原先被 A/B 掩盖的编码断言显形）。

---

## 2. 产品缺陷的最小改法定位（仅 #18）

**#18 源变化被判成「制品损坏」**

- **改哪里**：`electron/repositories/generation-run-repository.ts:396-404`（`hydrateReceipt` 里那条 8 项合一的条件）。
- **为什么是这里**：这条 `fail('ARTIFACT_INTEGRITY_FAILED')` 把两类完全不同的事实压进一个错误码 —— ① 制品自述（`attemptId`/`artifactId`/`revision`/`textHash`）与库内行不符，那才是制品损坏；② `visible.fingerprint !== run.binding.fingerprint`，那是**运行绑定被重绑**（本例正是作者在模型回调里改了 `character_roster_meta.legacy_markdown`，绑定重写后旧制品的指纹自然过期）。现在 ② 先于「源已变化」的语义判定抛错，作者看到的是「制品损坏」，而制品一个字都没坏。
- **一句因果**：绑定重绑 ⇒ 旧制品指纹过期 ⇒ 命中完整性条件 ⇒ 抛错顺序把「源变了」错报成「制品坏了」。
- **同类判定**：`legacy-roster-generation.test.ts` 里这条用例自上一轮就是同一错误码，属长期红，不是本轮新引入。
- **与哪些失败疑似同源**：与 #3/#5/#19–#21 无共同根因（那是测试滞后）；与 §5 的 `mcp-ipc-bridge` 也无共同根因。**本轮 21 条内它没有同源伙伴**。

> 未做（按夜间禁令）：未复跑、未复现；上述定位依据是错误码唯一抛出点 `generation-run-repository.ts:404` + 用例内唯一的状态变更语句（`legacy-roster-generation.test.ts:121` 的 `UPDATE character_roster_meta`）。**若白天复跑发现是 `epoch`/`projectId` 分支命中，改法位置不变、条件要再拆细。**

---

## 3. 为什么 D 要分两档（本轮最重要的口径修正）

上一轮把「断言与实现不一致」统称 D 并一律标「产品缺陷=是」，本轮取证后发现其中 5 条根本不是产品问题，而是**实现改了、测试没在同一次提交里跟**（违反 T0#5「同提交同步文档/口径」的测试侧镜像）：

| 子档 | 判据 | 本轮条数 |
|---|---|---|
| D-真红 | 作者能在界面上/错误提示里看到错误行为 | 1（#18） |
| D-断言漂移 | 实现按设计改了（有提交说明/代码注释为准），断言还钉着旧文案或旧命令 | 5（#3 #5 #19 #20 #21） |

证据链：
- #19–#21：`90770846`（11-11 23:03）把 `statusbarModelCopy` 的 title 从 `当前模型：X` 改成 `当前模型（实际调用）：X` / `当前模型（配置）：X`，并在 `src/shared/statusbar-model.ts:36-38` 写明「可见文本仍只有模型名，区分只做在 title」——设计意图明确，`StatusBar.test.tsx` 自 `155efe4d`（11-07）起未再改过。
- #5：`36f8748e`「测试统一走 Electron 运行时」把 `package.json.scripts.test` 改为 `node scripts/run-tests-electron.mjs`（与 `AGENTS.md` §3 一致），`renderer-browser-qualification-contract.test.ts:32` 仍钉 `'vitest run'`。
- #3：`StatusBar.tsx` 是 `.writer-statusbar` 的唯一持有者，全文件零处 `AI小说作家`（`git log -S` 亦无引入记录），TitleBar 之外没有第二处品牌文本。**UNRESOLVED（部分）**：无法证明它曾经绿过 —— 手里最接近的两份旧日志（`full-after-enotempty-2.log:5998`、`full-after-fix.log`）都只显示它当时就是红的，无法定位「哪次提交把它弄红」。

---

## 4. 非产品缺陷类的成因与修法（供排期，不在本卡范围）

**A · #4**：`quality-modernization-run.test.mjs:448` 的 `finally` 直接 `fs.rmSync(directory,{recursive,force})`，与 A/B 41 条同一个 Windows 删树根因。同文件其它用例已改 `discardTreeWithoutFollowingLinks`（`test/helpers/temp-dir.ts:151`），**这一处漏改**。

**C · #1**：`test/helpers/legacy-baseline-fixture.ts:19` 只调 `initializeLegacyBaselineSchema`（`electron/migrations/baseline-schema.ts:587-612` 给 `summary_snapshots` 补 7 列，**不含 M10 的 `story_day_offset`/`story_day_label`**），不跑 `migrateSchema`。生产路径（`electron/database.ts:28-31` 新建、`:44-52` 老库 verify/upgrade）一定会过 M10，所以**产品无风险**；但 `saveFinalizedContinuity`（`summary-repository.ts:965-989`）写 M10 列时不判列存在，而读路径（同文件 `:1252`）判了 —— 读写不对称，属隐患，可另卡。
- **纠偏**：上一轮把这条判成「D 真红、最硬的一条」是**误判**；`m10-installed-lane.test.ts` 独立覆盖 M10 且是绿的，说明迁移本身没坏，坏的是夹具停在 v-baseline。

**C · #2 #14–#17**：五处夹具都写「假 asar」（`writeFileSync(asar,'wrong asar')` / `write(root,'resources/app.asar')` 写的是 7 字节 `'fixture'`）。本工程测试跑在 Electron 运行时（`scripts/run-tests-electron.mjs`，`ELECTRON_RUN_AS_NODE=1`），Electron 的 fs 补丁对**任何 `*.asar` 路径**都当场解析归档头：日志里两条 unhandled error 正是 `Invalid package …app.asar  ❯ t.lstatSync (node:electron/js2c/node_init:2:4714)`（`:6195-6230`），#2 的 stderr 里也有 `Failed to parse header size from …app.asar`。
- `existsSync` 吞掉这个异常返回 `false` ⇒ `verify-win-package.mjs:60` 报「缺件」，测试在第一条断言就短路；`f05-a11-offline-import-journey.mjs:122` 的 `statSync` 直接抛，撞不到 `:124` 的哈希比较。
- **修法**：夹具改成造一个**可解析的最小 asar**（`@electron/asar` 打空目录），或这五处改在 `test:node`（纯 Node 无 asar 补丁）下跑。**不要再往 `verify-win-package.mjs` 里加兜底** —— 生产包里那个 asar 一定是真的。

**E · #6–#13**：`smoke-win-installer.test.ts:281-309`（`runInstallerLibrary`/`runReleaseMonitorLibrary`）用 `powershell.exe -Command …` + `{encoding:'utf8'}` 取输出。PowerShell 5.1 重定向输出按 `[Console]::OutputEncoding`（本机中文 Windows = CP936）出字节，按 UTF-8 解就成 `AIС˵����`。加 `chcp`/`[Console]::OutputEncoding=[Text.Encoding]::UTF8` 到 `-Command` 前置，或改 `encoding:'buffer'` 后按 GBK 解。
- **§4-A 未排除项（#11）**：这条测的是产品侧 `Get-AiNovelUtf8NonEmptyLines` 的解码正确性。乱码形态与其它 7 条一致（整行 JSON 都坏了），所以首判传输层；**若它在 `test:node` 下单独复跑仍红，则升级为产品缺陷**（PS 助手按默认编码读文件）。夜间禁跑，留白天一次复跑定案。

**F · 不在 21 内**：见 §5。

---

## 5. 不计入 21 的三类（同日志，分开记）

### 5.1 文件级失败 7 个（`:5775` `Failed Suites 7`）

| 文件 | 错误 | 类别 |
|---|---|---|
| `scripts/task-board/test/{claims,cli,identity,mcp,ops,transport}.test.mjs` ×6（`:5800`–`:5822`） | `No test suite found in file …` | **F 误收**：这六个是 `node:test` 写的（`import { test } from 'node:test'`），被 vitest 默认 include 收走。`vite.config.ts:150-162` 的 `exclude` 没有 `**/scripts/task-board/test/**`，加一行即可 |
| `electron/mcp/__tests__/mcp-ipc-bridge.test.ts`（`:5777`） | `[vitest] No "app" export is defined on the "electron" mock` | **C 夹具/mock 滞后**：`mcp-ipc-bridge.ts:87` 的 `if (!app.isPackaged)` 是 `003ae6da`（10-12）加的，测试的全量 mock（`mcp-ipc-bridge.test.ts:20-26`）只导出 `ipcMain`。非产品缺陷 |

### 5.2 unhandled error 2 条（`:6195` `Unhandled Errors`，`:6233` `Errors 2`）

`Invalid package …\.runtime\cache\s14c-win-official-binding-*\resources\app.asar`，分别记在 `update-section.interaction.test.ts` 与 `locale-shell.interaction.test.ts` 名下。**这是 §4-C 的同一个假 asar 根因**，被 vite 的 `ReaddirpStream._stat` 扫到才显形；不是这两个用例自己的问题，也不是产品缺陷。

### 5.3 与环境相关的排除项

- 本轮运行目录是 `C:/develop/workspace/AI-writer/full-run-2`（日志内所有栈路径可证），该 worktree **现已不存在**，无法逐文件比对「当时树内版本 vs 现在 develop」。凡涉及「是不是被后来改好了」的判断，本报告只认当前 develop 的源码事实，不认推测。

---

## 6. 一句话给排卡人

21 条里 **1 条真产品缺陷**（`#18` 错误码错档，改 `generation-run-repository.ts:396-404` 一处）；**6 条夹具**（假 asar ×5 + 夹具不跑 M10 ×1，一次改完；顺带纠正上一轮把 `story_day_offset` 判成真红的误判）；**8 条编码**（PS 5.1 传输层一处修）；**6 条断言漂移**（实现改了没同提交改测试，5 条 + 1 条待定）。修完这 20 条，全量应只剩 `#18` 一类语义问题。

<!-- DONE -->
