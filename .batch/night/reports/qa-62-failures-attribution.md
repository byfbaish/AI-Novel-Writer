# QA · 62 条失败逐条归因（基于 `full-after-enotempty-2.log`）

结论：PASS ｜ 产物：`.batch/night/reports/qa-62-failures-attribution.md` ｜ 判定线：62 条失败逐条落到原因类别，每类给条数 + 一条代表证据行号，条数加总必须等于 62 ｜ 证据：六类相加 6+35+4+13+4 = **62**，与 `full-after-enotempty-2.log:6987` 的 `Tests 62 failed | 8621 passed | 15 skipped (8698)` 严格相等；另有 8 个「文件级失败」不计入 62，已单列。

> 输入以 `全文` 为准：`full-after-enotempty-2.log`（20:02，`Test Files 21 failed | 620 passed (641)`、`Tests 62 failed`、`Errors 2`）。
> 旧日志 `full-after-enotempty.log`（19:42，66 failed、642 文件、Errors 48）不作为分母。

## 1. 六类归因（合计 62）

| # | 类别 | 条数 | 代表证据（行号） | 是否产品缺陷 |
|---|---|---|---|---|
| A | ENOTEMPTY（脏树未清） | **6** | `:6225` `Error: ENOTEMPTY, Directory not empty: …\.runtime\.cache\novel-quality-modernization\separated-review-test-M3rk7t` | 否（环境） |
| B | 脏树断言 / EPERM（同源，清理权限被拒） | **35** | `:6539` `Error: EPERM, Permission denied: …\.runtime\.cache\novel-quality-modernization\s05-sources\binding-HZo13z` | 否（环境） |
| C | installer `app.asar` 缺件 | **4** | `:6494` `Error: Missing required package file: …\Temp\ai-novel-package-bPj1No\resources\app.asar` | 否（夹具） |
| D | 真红（断言与实现/契约不一致） | **13** | `:5937` `SqliteError: no such column: story_day_offset` | **是** |
| E | 编码乱码（UTF-8 ↔ GBK 比较） | **4** | `:6315` `expected 'C:\Users\\ufffd\\ufffd\\ufffdƷ\ufffd\Ap…' to be 'C:\Users\<用户名>\AppData\Local\VibeCoding…'` | 否（环境/编码） |
| F | `(0 test)` 误收 | **0 条测试**（6 个**文件**） | `:5910` `Error: No test suite found in file …/scripts/task-board/test/claims.test.mjs` | 否（配置） |

**A+B 同源**：都是 `test/helpers/temp-dir.ts:46`（`discardTree`）在 Windows 上删不掉含 junction / 被占用句柄的目录，前者报 `ENOTEMPTY`、后者报 `EPERM`。**所以「7 条 ENOTEMPTY」这个数是按错误码数的，按根因数其实是 41 条（A 6 + B 35）**——developer 现在只改了 7 个用例的删树方式，剩下 35 条 EPERM 还没有人来认领。

## 2. 逐文件分布（14 个文件、62 条）

| 文件 | 失败条数 | 类别 |
|---|---|---|
| `electron/services/__tests__/generation-source-binding.test.ts` | 16 | B（全 EPERM，`s05-sources\binding-*`） |
| `electron/services/__tests__/main-generation-owner.test.ts` | 9 | B（全 EPERM，`s05-owner-tests\owner-*`） |
| `scripts/__tests__/smoke-win-installer.test.ts` | 9 | A×2 `:6347/:6359`、E×4 `:6315/:6331/:6424/:6462`、D×3 `:6371/:6401/:6440` |
| `scripts/__tests__/project-migration-acceptance.test.ts` | 8 | B（全 EPERM，`Temp\project-migration-acceptance-*`） |
| `scripts/__tests__/quality-modernization-run.test.mjs` | 5 | A×4 `:6225/:6237/:6250/:6263`、B×1 `:6275` |
| `scripts/__tests__/verify-win-package.test.ts` | 4 | C（4 条都被 `app.asar` 缺件提前短路） |
| `src/components/layout/__tests__/StatusBar.test.tsx` | 3 | D（`:6900/:6916/:6932` 缺 `当前模型：…` 文案） |
| `scripts/__tests__/public-repository-hygiene.test.ts` | 2 | D（`:6102` `AGENTS.md: expected true to be false`、`:6121` `expected '# 依赖…' to contain '/AGENTS.md'`） |
| `electron/__tests__/summary-continuity-migration.test.ts` | 1 | D（`:5937` sqlite 缺列） |
| `scripts/__tests__/f05-a11-official-windows-driver.test.ts` | 1 | D（`:5953` `Installed app executable hash differs` 断言未命中） |
| `scripts/__tests__/locale-shell.interaction.test.ts` | 1 | D（`:5987` `expected +0 to be 1`） |
| `scripts/__tests__/real-provider-generation-qualification.test.ts` | 1 | B（`:6287` EPERM） |
| `scripts/__tests__/renderer-browser-qualification-contract.test.ts` | 1 | D（`:6299` `expected 'node scripts/run-tests-electron.mjs' to be 'vitest run'`） |
| `electron/services/__tests__/legacy-roster-generation.test.ts` | 1 | D（`:6763` 期望 `GENERATION_SOURCE_CHANGED`、实得 `ARTIFACT_INTEGRITY_FAILED`） |

## 3. 不计入 62 的「文件级失败」8 个（`Test Files 21 failed` 的差额来源）

21 个失败文件 = 14 个有失败用例 + 6 个 `(0 test)` + 1 个 mock 加载失败。

| 文件 | 错误 | 行号 |
|---|---|---|
| `scripts/task-board/test/{claims,cli,identity,mcp,ops,transport}.test.mjs` ×6 | `No test suite found in file …` | `:5910 :5914 :5918 :5922 :5926 :5930` |
| `electron/mcp/__tests__/mcp-ipc-bridge.test.ts` | `Error: [vitest] No "app" export is defined on the "electron" mock.` | `:5887` |

**两处纠偏**：
1. **`ENOTEMPTY` 出现 7 次，但只有 6 条是测试失败**——第 7 处 `:5875` 是 `f05-a11` 的**文件级加载错误**，按 `Test Files` 计，不按 `Tests` 计。所以「7 条 ENOTEMPTY」和「62 条里的 6 条」都没错，是把两个分母混在一起了。
2. **`Errors 2` 与旧日志的 `Errors 48` 是两回事**：`:6953` / `:6969` 两条 `Invalid package …app.asar` 是从 develop 的 `.runtime/cache` 里带过来的污染，不是这轮 `-2` 跑出来的红；把它算进失败数会把 62 抬到 108。

## 4. 结论与建议（按成本排序）

1. **先修 41 条（A+B）**：不是产品缺陷，是 `discardTree` 在 Windows 上的删树缺陷。developer 现在只覆盖了 7 个用例；应按「凡在 `.runtime/cache` 下建临时树」的用例统一改用 `discardTreeWithoutFollowingLinks`，一次清完。**这一项做完，62 条会掉到 21 条。**
2. **再修 4 条编码（E）**：`smoke-win-installer` 拿 PowerShell 输出与 UTF-8 期望值比，全是乱码比较；不是业务问题。
3. **4 条 `app.asar`（C）**：`verify-win-package` 的夹具没造出 `resources/app.asar`，测试在第一条断言就短路，后面 3 条失败是连带的，修夹具后应一起消失。
4. **最后 13 条真红（D）**，按可复算程度排序：
   - `:5937` `no such column: story_day_offset` —— schema 与 `summary-repository.ts:965` 不一致，**最硬的一条，可立即定位**；
   - `:6102/:6121` hygiene 两条 —— 与 `978502e2` 是同一处，需确认该提交是否已覆盖；
   - `:6900/:6916/:6932` StatusBar 三条 —— D16 展示面缺文案，影响用户可见；
   - 其余 6 条（f05 hash、locale-shell、renderer-contract、legacy-roster、smoke 3 条）需要逐条起卡。
