结论：FAIL ｜ 产物：.batch/night/reports/wb-7.md ｜ 判定线：Test-Path ./.batch/night/reports/wb-7.md; Select-String -Pattern '结论：|failed / passed / total|\.tsx:[0-9]+' ./.batch/night/reports/wb-7.md ｜ 证据：wb-7-run-1.log:9014-9017 = `1 failed | 836 passed (837)`、Duration 91.86s，失败清单仅 RendererStartup.browser.tsx:137:25，基线的 B16 未复现

# WB-7 · browser 全量判读（夜跑 11-12 · 只跑一次）

## 0. 执行记录（证据链）

| 项 | 值 |
|---|---|
| 工作区自证 | `git rev-parse --show-toplevel` = `C:/develop/workspace/AI-writer/develop`（= 要求主区）；分支 `exp/resource-ledger` |
| 输入前提 | `vitest.browser.config.ts` 存在（`Test-Path` = True）✅ |
| 唯一执行命令 | `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts`（在 develop 根，develop 根路径下执行） |
| 有效运行次数 | **1 次**（`START=2026-11-12 02:41:26 +08:00` → `END=2026-11-12 02:43:01 +08:00`） |
| 关于第一次发起 | 首次尝试用 `cmd.exe /c` 包一层做重定向，被工具安全策略拦截（`Command blocked for security: cmd.exe cannot be used from the PowerShell tool`），**测试进程未启动、无任何测试输出、不构成一次运行**；随即改用原生 PowerShell `2>&1 \| Tee-Object` 重发，即上表那唯一一次有效运行。未发生重试、补跑、挑结果。 |
| exit code | `1`（vitest 有失败用例时的正常退出码） |
| 耗时 | vitest 自报 `Duration 91.86s`（transform 0ms / setup 1.04s / import 7.49s / tests 75.52s）；墙钟 94.7s；`Start at 02:41:29` |
| 完整输出证据 | `.batch/night/reports/wb-7-run-1.log`（520,475 字节，唯一一次运行的完整 stdout+stderr） |
| 执行口径 | 严格按任务字面命令原样执行，**未加 `env -u`、未摘变量、未改环境变量**。取证：本会话确实注入了 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` 与 `CODEBUDDY_TOOL_CALL_ID`（`.workbuddy/memory/notes/env-and-conventions.md` 第 34 轮记载全量跑测可能因此产生 cleanup 假失败）。本次不擅自变更口径，如实取数；本次失败栈落在断言（`:137:25` 的 `expect`），**不是 cleanup / `rmSync`**，故不受该噪声影响。 |
| 编码说明 | 日志中文经 PowerShell 管道后呈 GBK 乱码；判定所需的数字、文件路径、行号、断言消息均为 ASCII 且完整。失败用例中文名已从源码 `src/components/startup/__tests__/RendererStartup.browser.tsx:109` 只读核对，非推测。 |

## 1. 三个数

| 指标 | 本次 |
|---|---|
| **failed** | **1** |
| **passed** | **836** |
| **total** | **837** |

原始行：`Test Files  1 failed | 105 passed (106)`、`Tests  1 failed | 836 passed (837)`（wb-7-run-1.log:9014、9015-9016）；汇总区标注 `Failed Tests 1`、`[1/1]`（log:8992、9008）。

## 2. 失败清单（每条带 `文件:行`）

1. **`src/components/startup/__tests__/RendererStartup.browser.tsx:137:25`** — 用例「外观损坏时响应关闭请求，工作台接管后由业务决定未保存正文是否关闭」（用例名见源码 `:109`）。错因：`AssertionError: expected 2 to be 1 // Object.is equality`，即 `expect(listeners.size).toBe(1)` 实得 2 —— 重新检查、工作台接管后 `window:close-requested` 监听器残留了 2 个而非 1 个。失败截图落在 `__screenshots__/RendererStartup.browser.tsx/---------------------------------1.png`。
   - 栈落在**断言**上（`expect`），不是 `afterEach` / `rmSync` / cleanup，非 safe-delete 噪声。
   - 本次日志中**未出现** `:130` 的失败条目；基线记录写的是 `RendererStartup.browser.tsx:130/:137`，本次实际报出的失败行只有 `:137:25`。

**失败清单共 1 条**（与 `Failed Tests 1` / `[1/1]` 一致）。

## 3. 与 11-11 基线逐项比对

基线：`2 failed / 835 passed / 837 total`，99.3s；失败点 B11 `RendererStartup.browser.tsx:130/:137`、B16 `CodeMirrorEditor-generation.browser.tsx:281`。

| 比对项 | 基线 | 本次 | 判定 |
|---|---|---|---|
| total | 837 | 837 | **同** |
| passed | 835 | 836 | **多 1** |
| failed | 2 | 1 | **少 1** |
| B11 `RendererStartup.browser.tsx` | 失败（记录 `:130/:137`） | 仍失败，实际报 `:137:25`；日志无 `:130` 失败条目 | **部分同**（用例仍在，行号收窄为 `:137`） |
| B16 `CodeMirrorEditor-generation.browser.tsx:281` | 失败 | 该文件 13 个用例本次全部通过（`wb-7-run-1.log:6989` 显示 `✓ ... CodeMirrorEditor-generation.browser.tsx (13 tests) 1240ms`） | **少**（未复现） |
| 耗时 | 99.3s | 91.86s | **少 7.44s**（不单独构成判据） |
| Test Files | 基线未给 | `1 failed \| 105 passed (106)` | 无基线可比 |

逐项结论：**总数一致，但失败集合不一致 —— 少了一条失败（B16 消失），passed 相应 +1、failed −1。**

## 4. 结论

**FAIL（基线漂移）**。卡定义：PASS = 仍是基线｜FAIL = 基线漂移｜BLOCKED = 跑不起来。本次命令跑通了（不是 BLOCKED），但读数从 `2 failed / 835 passed` 变成 `1 failed / 836 passed`，且基线的 B16 `CodeMirrorEditor-generation.browser.tsx:281` 本次未复现、该文件全绿 —— 与基线不是同一条，因此判 **FAIL**。

> 这里的 `FAIL` 指**本卡的基线判读结果**（漂移），不是"测试整体红"；本次测试确有 1 条失败用例，已如实列在 §2，没有把失败写成 PASS，也没有因为变绿就报 PASS。

卡点：无（命令跑通、输出完整、未触发 BLOCKED）。

## 5. 反例自检

- 只给总数不给用例名 → 未踩：§2 给出完整用例名 + `文件:行` + 一句错因。
- 把失败写成 PASS → 未踩：1 条失败如实列出，且基线漂移判为 FAIL 而非 PASS。
- 没跑就写「与基线一致」 → 未踩：单次运行证据为 `wb-7-run-1.log`（520,475 字节），含 vitest 汇总与失败栈。
- 跑多次只报最好那次 → 未踩：有效运行 1 次，首次被安全策略拦截时测试进程未启动，已如实披露，未补跑。

## 6. 待裁决项（不擅自处理，仅汇总）

1. **B16 消失的原因未查**：本次按「只跑一次 / 只读」约束，未做任何代码或历史比对，无法判断是偶发（flaky）、基线记录口径差异、还是环境差异。不猜测。
2. **safe-delete 口径**：本次按字面命令裸跑。项目笔记第 34 轮建议全量跑测带 `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID`；是否把 WB-7/WB-6 的标准口径改为「摘变量」，需主人裁定，本次未擅自改命令、未重跑。
3. **`:130` 行号差异**：基线记 `:130/:137`，本次只有 `:137:25`；是记录口径还是行为差异，本次不推断。
4. 日志中文乱码属 PowerShell 管道编码问题，不影响 ASCII 判定信息；是否改用 UTF-8 直写日志属后续口径问题，本次未重跑修正。

DONE
