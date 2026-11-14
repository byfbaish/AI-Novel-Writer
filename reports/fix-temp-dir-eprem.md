结论：FAIL ｜ 产物：C:\develop\workspace\AI-writer\develop\reports\fix-temp-dir-eprem.md ｜ 判定线：4 个代表文件单跑 0 EPERM ｜ 证据：两套口径改后均为 1/2/4 号 0 EPERM、3 号 8 条 EPERM（改前亦 8），该 8 条栈在 `project-migration-acceptance.test.ts:37` 用例自身的裸 `rmSync`，与 helper 不同源

# WB-H1 · `test/helpers/temp-dir.ts` 根治 EPERM（35 条同源）· A 案验收报告

- 授权：可改码 + 可提交（不含推送）。改动文件仅 `test/helpers/temp-dir.ts`。
- 时间：21:52 派活，22:26 收口；未跑全量、未推送。
- 提交：`2bf24dd6`（仅 `test/helpers/temp-dir.ts`，1 file changed, 131 insertions(+), 16 deletions(-)）。

> **结论为 FAIL 不是「改动没做完」，而是判定线字面未达成。** 三条改动全部落地、保护与 sweep 均独立验证 PASS、`check:fast` 绿、diff 与提交都只含目标文件。唯一未达成的是 3 号代表文件改后仍 8 条 EPERM；取证显示它不属于本卡根因、也不在「只改 helper」的授权范围内。详见 §5、§7，请负责人裁定。

---

## 1. 环境前提（必须先看，否则会误读下面的读数）

这套实机（WorkBuddy 沙箱会话）里，跑测会被 `node-safe-delete-shim.cjs` 包装 `fs.rmSync` / `fs.unlinkSync`，并按 `scope: turn` 累计删除数、超过 `threshold: 50` 就抛 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]`。项目 `notes/env-and-conventions.md` 明确规定跑测要摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` + `CODEBUDDY_TOOL_CALL_ID` 两个变量，否则 failed 数虚高、栈落在 cleanup 而不是断言。

为让前后对比严格同口径，本卡跑了**两套**独立基线，四文件全部一次一个、逐个单跑：

- **口径 A（负责人指定的原样命令）**：`node scripts/run-tests-electron.mjs <单个文件>`，不摘变量。
- **口径 B（项目规定的干净命令）**：`env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID node scripts/run-tests-electron.mjs <单个文件>`。

两套口径各跑改前 4 次 + 改后 4 次，共 16 次单文件单跑。**没有** `pnpm test` 多路径、没有 `test:node`、没有 `pnpm check:full`、没有全量。

日志落 `%TEMP%\wb-h1-logs\`：`before-*.log` / `beforeclean-*.log`（改前）、`afterclean-*.log` / `afterorig-*.log`（改后）。

**「同样的文件」核验**：开卡时工作区有 3 个并行任务的未提交 `M` 文件，其中含 4 号被测文件 `quality-modernization-run.test.mjs`。并行任务于 22:00:22 以 `2a98cbf3` 把它们提交，但提交不改变工作区内容 —— `git hash-object scripts/__tests__/quality-modernization-run.test.mjs` = `3a7dfe258e…`，与 `git rev-parse 2a98cbf3:scripts/__tests__/quality-modernization-run.test.mjs` = `3a7dfe258e…` **完全一致**。1/2/3 号文件不在这 3 个改动之列。因此 16 次单跑前后用的是同一份文件内容，对比成立。

## 2. 改前 / 改后逐文件汇总（同样的命令、同样的文件、前后对比）

`EPERM` 列 = 日志中 `EPERM` 出现次数（不是 failed 数）。

### 口径 A · 原样命令（改前 21:55:47–22:00:01 → 改后 22:20:47–22:24:5x）

| 文件 | 改前 exit / EPERM / Tests | 改后 exit / EPERM / Tests | EPERM 变化 |
|---|---|---|---|
| `electron/services/__tests__/generation-source-binding.test.ts` | 1 / 0 / 1 failed, 75 passed (76) | 1 / 0 / 1 failed, 75 passed (76) | 0 → 0 |
| `electron/services/__tests__/main-generation-owner.test.ts` | 1 / 0 / 2 failed, 185 passed (187) | 1 / 0 / 2 failed, 185 passed (187) | 0 → 0 |
| `scripts/__tests__/project-migration-acceptance.test.ts` | 1 / **8** / 8 failed (8) | 1 / **8** / 8 failed (8) | 8 → 8 |
| `scripts/__tests__/quality-modernization-run.test.mjs` | 1 / 0 / 134 failed, 61 passed (195) | 1 / 0 / 134 failed, 61 passed (195) | 0 → 0 |

口径 A 下 1/2/4 号的失败原因（改前、改后**完全相同**）都是 shim 噪声，不是 EPERM、也不是 `discardTree`：

```
Error: [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
  {"count":50,"threshold":50,"scope":"turn", ...}
  ❯ checkBulkDeleteGuard …/node-safe-delete-shim.cjs:243:19
  ❯ Object.unlinkSync …/generation-source-binding.test.ts:315:12
```

### 口径 B · 干净命令（改前 22:02:45–22:07:2x → 改后 22:14:22–22:18:3x）

| 文件 | 改前 exit / EPERM / Tests | 改后 exit / EPERM / Tests | EPERM 变化 |
|---|---|---|---|
| `electron/services/__tests__/generation-source-binding.test.ts` | 0 / 0 / **76 passed (76)** | 0 / 0 / **76 passed (76)** | 0 → 0 |
| `electron/services/__tests__/main-generation-owner.test.ts` | 0 / 0 / **187 passed (187)** | 0 / 0 / **187 passed (187)** | 0 → 0 |
| `scripts/__tests__/project-migration-acceptance.test.ts` | 1 / **8** / 8 failed (8) | 1 / **8** / 8 failed (8) | 8 → 8 |
| `scripts/__tests__/quality-modernization-run.test.mjs` | 0 / 0 / **195 passed (195)** | 0 / 0 / **195 passed (195)** | 0 → 0 |

### 4 个文件各自 EPERM 次数（判定线期望改后全 0）

| 文件 | 口径 A 改前 → 改后 | 口径 B 改前 → 改后 | 判定 |
|---|---|---|---|
| 1 generation-source-binding | 0 → 0 | 0 → 0 | ✅ 0 |
| 2 main-generation-owner | 0 → 0 | 0 → 0 | ✅ 0 |
| 3 project-migration-acceptance | **8 → 8** | **8 → 8** | ❌ **8** |
| 4 quality-modernization-run | 0 → 0 | 0 → 0 | ✅ 0 |

**关键取证（与负责人定性不一致，不自行改判，只列证据）**：负责人描述「35 条 EPERM 同源，栈顶部全部落在 `❯ discardTree test/helpers/temp-dir.ts:46:8`」。在这套实机的**单跑**口径下，该栈一条都没有复现：1/2/4 号改前 EPERM 即为 0，干净口径下改前就 76/187/195 全绿。实机观察到的 8 条 EPERM 全部来自 3 号文件，栈为：

```
Error: EPERM, Permission denied: \\?\C:\Users\<用户名>\AppData\Local\Temp\project-migration-acceptance-XXXXXX
  ❯ wrappedRmSync …/node-safe-delete-shim.cjs:814:12
  ❯ scripts/__tests__/project-migration-acceptance.test.ts:37:42
      37|   for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })
```

且 `grep -c "discardTree\|temp-dir" scripts/__tests__/project-migration-acceptance.test.ts` = **0** —— 该文件根本不引用 helper。因此这 8 条不经过 `discardTree`，改 helper 对其无影响（改前 8 → 改后 8，两套口径一致）。它们与全量并行跑测时出现的 `discardTree:46` 是否同源，超出本卡授权，需负责人裁定（§7）。

## 3. `formal freeze` 用例结果

用例全名：`formal freeze只接受已提交且tracked clean的协议revision`（`scripts/__tests__/quality-modernization-run.test.mjs:7192`）。

| 口径 | 改前 | 改后 |
|---|---|---|
| B 干净命令 | **✓ PASS** 647ms（195 passed / 195，`Test Files 1 passed`） | **✓ PASS** 680ms（195 passed / 195，`Test Files 1 passed`） |
| A 原样命令 | ✗ FAIL（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，count 79） | ✗ FAIL（同一 shim 噪声，count 79） |

- 干净口径下**改前就 PASS**，所以「helper 改完后这条必须自己消失」在本实机无法构成前后对比 —— 它没有红过；改后确实 PASS。
- 原样命令下改前/改后都 FAIL，但失败原因是 shim 的 50 阈值噪声，不是 EPERM、不是 helper；与负责人所述「原报 `EPERM … formal-clean-test-akh5eH`」不一致。
- 结论：判定线「改后 PASS」在干净口径 ✅ 达成；但**不能**据此声称是本次改动让它消失的。

## 4. 三条改动（全部在 `test/helpers/temp-dir.ts`）

1. **`:42` rename 带重试**：新增内部 `renameWithRetry()` + `sleepSync()`（`Atomics.wait`，无新依赖），按 `TEMP_RETRY` = 100ms × 20 次（约 2s）重试；只有重试用尽仍失败才进 catch。验证脚本实测每例 `renameAttempts=21`（首次 + 20 次重试）。
2. **`:46` 失败时按路径分流**：新增内部 `isDisposableRoot()`。就地 `rmSync` 也失败时 —— `root` 在 `.runtime/` 下或仓库根之外 ⇒ 不抛、`deferredCount += 1` 并登记到 `.runtime/.cache/.discard-pending.txt`（gitignored 运行时文件）；仓库根内且非 `.runtime/` ⇒ **照旧 `throw error`**，保护原样保留、未放宽。
   - 仓库根由 `import.meta.url` 推导并以 `process.cwd()` 兜底，模块加载时求一次，不随个别用例 `chdir` 漂移；跨盘符时 `path.relative` 返回绝对路径，同样判为「仓库根之外」。
3. **`sweepDiscardedTrees()` 补盲区**：原逻辑（扫 `os.tmpdir()/discard-*`）不变；新增两路 —— 读 `.discard-pending.txt` 清单逐条删、扫 `.runtime/.cache/discard-*` 前缀目录；删不掉的计入 `remaining` 并写回清单，**返回值语义不变**（仍是「仍删不掉的条数」）。清单条目也过 `isDisposableRoot()`，清单被污染时不碰仓库根内真实目录。末尾仅在 `deferredCount > 0 || remaining > 0` 时打**一行**汇总。

三个导出签名 `discardTree(root: string): void`、`discardTreeWithoutFollowingLinks(root: string): void`、`sweepDiscardedTrees(): number` 保持不变；未新增导出、未新增依赖。

## 5. 保护仍在 —— 验证方法与读数

独立脚本 `%TEMP%\wb-h1-logs\verify-protection.mjs`（不进仓库）：直接 import 真实 `test/helpers/temp-dir.ts`，patch `fs.renameSync` / `fs.rmSync` 使其恒定抛 `EPERM`，强制走到 `:46` 的分流分支，然后观察三种路径的行为：

```
OK   repo-inside-not-runtime: expected=THROW    actual=THROW    renameAttempts=21 code=EPERM
OK   under-dot-runtime:       expected=NO_THROW actual=NO_THROW renameAttempts=21
OK   outside-repo:            expected=NO_THROW actual=NO_THROW renameAttempts=21
PROTECTION_VERDICT=PASS   (exit=0)
```

即：**仓库根内、非 `.runtime/` 的路径删除失败时仍会抛错**（保护未放宽），而 `.runtime/` 下与仓库根之外不抛、只累计计数。

`sweep` 补盲区另用 `%TEMP%\wb-h1-logs\verify-sweep.mjs` 独立验证：造 1 个 `discard-*` 前缀残留 + 1 个清单条目残留 + 1 个「仓库根内非 `.runtime/`」路径混入清单，调用 `sweepDiscardedTrees()`：

```
OK prefixed residue swept / OK manifest residue swept / OK protected path NOT swept
OK remaining === 0 / OK manifest cleared
SWEEP_VERDICT=PASS   (exit=0)
```

## 6. 提交与闸门证据

- `git add -- test/helpers/temp-dir.ts` 后 `git diff --cached --stat`：
  `test/helpers/temp-dir.ts | 147 +++++++++++++++++++++++++++++++++++++----  1 file changed, 131 insertions(+), 16 deletions(-)` —— **只有目标文件**。
- 工作区 `git diff --stat`：空（改动已提交）。`git show --stat --oneline HEAD`：`2bf24dd6 …  1 file changed, 131 insertions(+), 16 deletions(-)`，文件为 `test/helpers/temp-dir.ts`。
- 提交前 `pnpm check:fast`（`node scripts/check-fast.mjs`）：
  `[check:fast] typecheck ✓ 27.8s` / `doc links: checked 1436, broken 0` / `[check:fast] doc-links ✓ 0.2s` / `doc placement: 扫描 431 份 md，当前违规 0 条，基线内 0 条，新增 0 条` / `[check:fast] doc-placement ✓ 0.2s` / `[check:fast] 全部通过。`，exit=0。
- `git commit` 的 pre-commit hook **自动重跑** `check:fast` 同样全绿（typecheck 26.8s / 0 broken / 0 违规 / 全部通过）。
- 提交 `2bf24dd6`（22:23:27），**未推送**。开卡时工作区已有 3 个预存未提交的 `M` 文件（`f05-a11-official-windows-driver.test.ts`、`quality-modernization-run.test.mjs`、`smoke-win-installer.test.ts`）和大量 `?? .batch/`，均非本卡改动；本卡只 `git add` 了目标文件，未触碰它们（并行任务于 22:00:22 以 `2a98cbf3` 自行提交这 3 个 `M`，见 §1 的 blob 核验）。

## 7. 判定线逐条结论与请裁定项

| 判定线 | 结果 | 说明 |
|---|---|---|
| 代表文件 3 个 EPERM = 0 | ❌ **未达成** | 1/2/4 号 = 0；3 号改前 8 → 改后 8（两套口径一致） |
| `formal freeze` 改后 PASS | ✅ 达成（干净口径） | 改前即 PASS，不构成「自行消失」的证据；原样口径因 shim 噪声仍 FAIL |
| `git diff --stat` 只有 `test/helpers/temp-dir.ts` | ✅ 达成 | 见 §6 |
| 改动后 `discardTree` 仍对「仓库根内、非 `.runtime/`」抛错 | ✅ 达成 | `PROTECTION_VERDICT=PASS`，见 §5 |

**按判定线字面，结论 FAIL。** 未达成项归因与请裁定：

1. 3 号文件 8 条 EPERM 的栈在用例自身 `afterEach` 的裸 `rmSync`（第 37 行），该文件不引用 `discardTree`。在「只改 `test/helpers/temp-dir.ts`」的授权下，本卡无法触及它；改 helper 前后读数完全相同（8 → 8）也印证了这一点。
2. 负责人定性的「35 条同源、栈顶 `discardTree:46`」在这套实机的**单跑**口径下未复现（1/2/4 号改前 EPERM 即 0，干净口径改前全绿）；实机改前实际看到的是 `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]` shim 噪声。全量并行跑测与单跑的环境差异可能是原因，但本卡不猜根因、不自行改判。
3. 请负责人裁定：① 3 号文件这 8 条是否属于本卡 35 条同源（若是，需扩大授权到该用例的 cleanup 或提供能复现 `discardTree:46` 的全量基线）；② 是否认可口径 B（项目规定的摘变量命令）作为正式验收口径；③ 是否将本卡按「三条改动已交付、判定线待复验」结案。

## 8. 反例 / 禁止项自查

- 改了 `test/helpers/temp-dir.ts` 以外的文件：**未命中**。源码只改这一个；本报告是任务指定的产物（`reports/` 未跟踪，不进提交）；`.runtime/.cache/.discard-pending.txt` 是 gitignored 运行时文件。
- 把保护放宽成「一律不抛」：**未命中**，见 §5 首例 `THROW`。
- 只加重试、没做 `:46` 分流：**未命中**，分流已实现并三例验证。
- 用 `pnpm test` 多路径或跑全量：**未命中**，16 次均为单文件单跑；`check:fast` 只含 typecheck + 两个文档检查，不含测试。
- 报告没有改前读数：**未命中**，§2 两套口径均有改前 / 改后逐行对比。
- 推送 / 改 `.batch/night/index.md` / 自己给卡 `review --pass`：**均未做**。
