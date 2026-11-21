执行方：developer
model=magpie/group/bot | 倍率=未提供（宿主不暴露，不臆造） | provider=magpie/group/bot

# CARD-S2-D9 交件报告 · 单次调用超时上限可注入 + 三态可辨 + 实机超时中止

卡面：`.batch/night/cards/s2-d9-call-timeout.md`（85 行 / 8,738B / sha256 前 16 位 `1cb20941a8aac8d7`）
分支：`card/s2-d9-call-timeout`（自 `0f0ca3ee` 起，一卡一分支，未 push）
范围：只加接线——`DEFAULT_SINGLE_CALL_TIMEOUT_MS` 语义未动、既有 `block(root, code)` → 收尾路径未动（卡面 §3.1 硬约束）。

## 1. 改了什么

| 文件 | 改动 | 行 |
|---|---|---|
| `electron/services/generation-run-service.ts` | 上限可注入：依赖新增 `callTimeoutCapMs?`（不传即默认值）；超时从裸 `setTimeout` 改为 `createSingleCallWatchdog`（生产首次接线），`onTimeout` 内部仍按 mark → block → abort 顺序调用 `runDeadlineTimeout`，`block` 仍走 `deps.repository.block(run.rootActionId, code)` | `:6`、`:77`、`:82`、`:117`、`:206-212`、`:236-264`、`:339-341`、`:367-368` |
| 同上 | 三态上报：新增依赖 `onCallPhase?`（只报状态、不参与判定），`reportCallPhase()` 在启动时、超时回调内、失败收口时各报一次 | `:208-214`、`:246`、`:264`、`:340` |
| 同上 | 验收用环境变量 `AI_NOVEL_CALL_TIMEOUT_CAP_MS`：只有 `/^\d+$/` 且正安全整数才生效，非法值一律回落默认（不放宽护栏） | `:117-127` |
| 同上 | `timeoutMs: Math.max(1, callDeadline.deadlineMs)`：`resolveSingleCallTimeoutMs(0)` 会回落 600000，0 预算必须仍立刻收口 | `:243-245` |
| `electron/services/__tests__/generation-run-service.call-timeout.test.ts` | 2 用例 → 6 用例：新增「上限可注入：默认值不变、注入值生效」与「三态：watchdog 生产接线后的阶段态取值」 | 全文 |
| `scripts/s2-d9-call-timeout-acceptance.mjs` | 新建验收脚本：单实例串跑 timeout / failure 两档，采集运行态、面板读数、DB 行，落 evidence | 新文件 |

单实例纪律：`instancesThisRun=1`、`leftoverElectronProcesses=0`、`finally` 里 `quit()`。

## 2. 五条判据

### 判据 1 · 实机一次真超时中止（命令原文 + 起止时间戳 + 末行 JSON）

命令（原文）：

```
AI_NOVEL_CALL_TIMEOUT_CAP_MS=2500 node scripts/s2-d9-call-timeout-acceptance.mjs
```

把 10 分钟压到 2.5 秒：正文请求永不返回（`new Promise(() => {})`），到点由 watchdog 收口。

末行 JSON（原文）：

```json
{"ok":true,"runId":"dbf8ea39-bc1","evidencePath":"...\\.runtime\\.cache\\s2-d9\\dbf8ea39-bc1\\evidence.json","capMs":2500,"checks":{"capInjected":true,"timeoutBlockedCode":true,"timeoutRunSettledFailed":true,"timeoutCopy":true,"failureCopy":true,"failureDistinctFromTimeout":true,"generatingReadBeforeTimeout":true,"noExternalFetch":true,"noUnclassifiedRequest":true},"codes":["timeout:null","failure:GENERATION_PROVIDER_FAILED"],"blocked":["GENERATION_CALL_TIMEOUT",null],"instancesThisRun":1,"leftoverElectronProcesses":0,"error":null}
```

起止时间戳（evidence `bands[].startedAt/finishedAt` 原文）：timeout 档 `2026-11-21T20:43:27.688Z` → `2026-11-21T20:43:35.035Z`（约 7.35s，含建连与收口；cap 2.5s + 撤销与落盘耗时）。
EXIT=0。

### 判据 2 · `blocked_code = GENERATION_CALL_TIMEOUT`，该 run 终态失败

DB 实读（`SELECT *` 原文，见 evidence `db.roots` / `db.runs`）：

```
generation_roots: rootId=95d26a9b-5c5c-4f98-94be-3cae191e25bc  blocked_code=GENERATION_CALL_TIMEOUT  active_elapsed_ms=2522
generation_roots: rootId=b6e4ebb1-deed-4953-b66b-0e9dba0e9d0f  blocked_code=(null)                    active_elapsed_ms=5
generation_runs:  runId=fc1c1497-2c37-43e1-b750-0bf9e5618cc7  root_id=95d26a9b-…  status=failed
generation_runs:  runId=79a7d86b-6a1e-4cf7-8002-7b729b6df9d9  root_id=b6e4ebb1-…  status=failed
```

**字段位置偏差（请按 schema 校正判据措辞）**：`blocked_code` 列在 `generation_roots` 上，不在 `generation_runs` 上；`generation_runs` 只记 `status`。
- 写入点：`electron/repositories/generation-run-repository.ts:757-759` → `UPDATE generation_roots SET blocked_code = ? WHERE root_action_id = ?`
- 列集：`generation_roots`＝`root_action_id, idempotency_key, action_json, budget_json, active_elapsed_ms, active_since_ms, blocked_code, revision`；`generation_runs`＝`run_id, root_action_id, binding_json, status, created_at_ms, open_key`。

即「超时那次调用的 root 被 block 为 `GENERATION_CALL_TIMEOUT`、该 run 终态 `failed`」两条都在，只是分属两张表。

### 判据 3 · 三态可辨（界面文案各不相同）

| 态 | 触发条件 | 界面读数原文（中） | 界面读数原文（英） |
|---|---|---|---|
| 生成中 | 已提交、请求在飞、尚无结论 | 转圈图标 2 个 + 进度 `1/1`，`role="alert"` 未出现（evidence `generatingSamples[0]`：`{"spinners":2,"progress":["1/1"],"alertCount":0}`，`20:43:30.464Z`） | 同左（运行态无文案） |
| 超时已中止 | 单次调用到 cap 未返回，watchdog 收口 | `第 2 章 · 写稿 / 调用超时已中止 / 本次调用超过 10 分钟未完成，已中止。/ 本次未保存草稿或正文章节。请调整章节要求后重试。` | `Call stopped after timeout` / `This call did not finish within 10 minutes and was stopped.`（`src/components/panels/ai-output-failure-presentation.ts:186-192`） |
| 调用失败 | provider 返回 HTTP 500，非超时 | `第 2 章 · 写稿 / 工作流未完成 / 服务返回 HTTP 500，请求未完成。/ 错误码：GENERATION_PROVIDER_FAILED / 本次未保存草稿或正文章节。请调整章节要求后重试。` | `Workflow did not finish` + `Error code: GENERATION_PROVIDER_FAILED`（同文件 `transportDiagnosticReason` 档） |

三档互不相同：运行态无 alert、超时档 heading 与失败档 heading 不同、失败档多「错误码」行。

**口径记录（不计判据）**：超时档界面**没有**「错误码：」行。原因是超时码走 transport diagnostics（`activityDiagnostics.failureCode`）命中 `:182` 的 D9 分支，而不是渲染层 `error.code`；失败档的码来自 `error.code`。这属既有设计（`errorCodeFromUnknown` 只读 `.code`），本卡未改动文案模块。若判据 4/三态需要超时档也显示码，是另一张卡的事。

### 判据 4 · 预算小于上限归 `ROOT_BUDGET_EXHAUSTED`

单测原文（`electron/services/__tests__/generation-run-service.call-timeout.test.ts`，describe `D9 上限可注入：默认值不变、注入值生效`）：

- `resolveSingleCallTimeoutMs()` 与 `resolveSingleCallTimeoutMs(undefined)` 都是 `600000`（默认不变）
- `resolveCallDeadline(3_600_000)` → `{deadlineMs:600000, failureCode:'GENERATION_CALL_TIMEOUT'}`
- `resolveCallDeadline(300_000)` → `{deadlineMs:300000, failureCode:'ROOT_BUDGET_EXHAUSTED'}`（预算 5 分钟 < 上限 10 分钟，归预算耗尽）
- 注入 `callTimeoutCapMs:1200`：advance 1199ms 后 `blockCalls` 仍为 `[]`，再 advance 1ms → `[['root-1','GENERATION_CALL_TIMEOUT']]`

### 判据 5 · 单测覆盖 + 整文件汇总行 + check:fast

整文件（只认汇总行，未用 `-t`）：

```
node scripts/run-tests-electron.mjs electron/services/__tests__/generation-run-service.call-timeout.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
EXIT=0
```

同命令带上 `src/shared/__tests__/generation-call-timeout.test.ts`（覆盖上限常量与纯函数语义）：`Test Files 2 passed (2)`、`Tests 16 passed (16)`、`EXIT=0`。

闸门：

```
node scripts/check-fast.mjs
[check:fast] typecheck ✓ 15.1s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
EXIT=0
```

三态覆盖方式：假 repository + 假 dispatch，注入 `onCallPhase` 收集阶段序列——
- 超时档：`['attempt-1:generating','attempt-1:timed-out']`
- 失败档（`dispatchProviderFailure` → `GENERATION_PROVIDER_FAILED`）：`['attempt-1:generating','attempt-1:failed']`，`blockCalls` 为空（失败不 block），`settleCalls[0].failureCode === 'GENERATION_PROVIDER_FAILED'`

## 3. 复现命令

```bash
# 1) 单测（整文件）
node scripts/run-tests-electron.mjs electron/services/__tests__/generation-run-service.call-timeout.test.ts
node scripts/run-tests-electron.mjs electron/services/__tests__/generation-run-service.call-timeout.test.ts src/shared/__tests__/generation-call-timeout.test.ts

# 2) 闸门
node scripts/check-fast.mjs

# 3) 实机验收（需先有 dist：npx vite build）
AI_NOVEL_CALL_TIMEOUT_CAP_MS=2500 node scripts/s2-d9-call-timeout-acceptance.mjs
```

evidence：`.runtime/.cache/s2-d9/dbf8ea39-bc1/evidence.json`（`ok:true`，`checks` 9 项全 true）。

## 4. 已知边界

1. **超时档无「错误码」行**（见判据 3 的口径记录），码只走 diagnostics；文案模块未改。
2. **文案常量**：超时档写死「本次调用超过 10 分钟未完成」，注入 cap 后仍是这句——生产语义正确（生产 cap 就是 10 分钟），验收注入不影响文案。
3. **phase 到渲染层的接线未做**：`main-generation-owner.ts:265-268` 与 `src/services/generation/generation-runtime.ts:82-93`（+`:242` 的 `identicalContent` 比较）不在本卡 §4 白名单，已按流程上报请裁 (a)/(b)。本卡只做到「主进程内三态可取、可上报（`onCallPhase`）」；若要界面按 phase 分流，需另裁。
4. **`generation_runs.blocked_code` 不存在**：判据 2 措辞按 §2 的 schema 校正。
5. 验收脚本只在 `develop` 实机跑（不外派、不在 worktree 跑），与本卡 §6 一致。

## 5. 提交面

- 分支 `card/s2-d9-call-timeout`，父 `0f0ca3ee`，一卡一提交，未 push。
- 入库文件 3 个（本报告在 `.batch/` 不入库）。
- R4 判据（去掉行尾差异）：`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 在提交后只剩非本卡改动（`.batch/night/org/BACKLOG.md`、`docs/design/product/live-pipeline-acceptance-defects-assessment.md`）。

<!-- DONE -->
