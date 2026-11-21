执行方：QA · AI writer项目组
model：未取到环境自报（本机无 `DSH_MODEL`／provider 变量；判定不依赖此项）
判面 HEAD：`8ae59d0a`（分支 `card/s2-d9-call-timeout`，父 `0f0ca3ee`）
判据分母：`.batch/night/review-requests/s2-d9-call-timeout.md`（43 行 / 2,935B / sha256 `ac6a9605ff9bfc7934ed9b6500f215099596bc9afd37bf21bc4e27a9c873d63c`）+ 卡面 `.batch/night/cards/s2-d9-call-timeout.md`（89 行 / 9,848B / sha256 `ad1fde5c446940c2517e8afd8249ac9c3e433ae5aa5fd15f773bb9cf7f021d47`）

判据适用口径（群管理分身 11-22 04:5x 冻结）：**本卡判据 3 按 04:48 修订后措辞判**（界面三态可辨，不要求 `callPhase` 过 IPC），**其余四条按原措辞判**；判据不再改第二次，新措辞若仍有歧义按现状判、疑点写进本判词，改动留到 D9b。

## 0. 结论

**PASS（5/5）。** 判据 1 实机跑出真实超时中止（起止时间戳与末行 JSON 见 §2）；判据 2 两表合看成立（roots 行 `GENERATION_CALL_TIMEOUT` + 同 root 的 run `failed`，§3）；判据 3 三态在界面上各不相同（§4，按修订后措辞）；判据 4 预算收口走单测断言原文（§5）；判据 5 两个测试文件整文件全绿、`check:fast` `EXIT=0`（§6）。未覆盖项 0 条。

不返工实现。记录项与两处口径疑点见 §8，均不构成打回。

## 1. 判面与提交纪律

- `git diff --numstat 0f0ca3ee..8ae59d0a`：`64 1 electron/services/__tests__/generation-run-service.call-timeout.test.ts`、`69 21 electron/services/generation-run-service.ts`、`442 0 scripts/s2-d9-call-timeout-acceptance.mjs`——三文件，只碰本卡白名单。
- `git branch -vv`：`* card/s2-d9-call-timeout 8ae59d0a …`，**无上游**；`git rev-parse --abbrev-ref card/s2-d9-call-timeout@{upstream}` → `fatal: no upstream configured`：未 push。
- `git status --porcelain | grep -v '^??'` → ` M .batch/night/org/BACKLOG.md`、` M docs/design/product/live-pipeline-acceptance-defects-assessment.md`：两条均为产品经理侧文档改动，不属本卡提交面（本卡 `src/`、`electron/`、`scripts/` 无未提交改动）。
- 交件报告 `.batch/night/staging/s2-d9-call-timeout-report.md`（10,188B，04:45）。

## 2. 判据 1 · 实机真实超时中止

我自己的整轮复跑（develop，判面 `8ae59d0a`）：

```
$ npx vite build ; echo "BUILD_EXIT=$?"
BUILD_EXIT=0

$ node scripts/s2-d9-call-timeout-acceptance.mjs ; echo "ACC_EXIT=$?"
{"ok":true,"runId":"2cd112ff-16d","capMs":2500,"checks":{"capInjected":true,"timeoutBlockedCode":true,"timeoutRunSettledFailed":true,"timeoutCopy":true,"failureCopy":true,"failureDistinctFromTimeout":true,"generatingReadBeforeTimeout":true,"noExternalFetch":true,"noUnclassifiedRequest":true},"blocked":["GENERATION_CALL_TIMEOUT",null],"instancesThisRun":1,"leftoverElectronProcesses":0}
ACC_EXIT=0
```

超时档起止（`.runtime/.cache/s2-d9/2cd112ff-16d/evidence.json` → `bands[timeout]`）：`startedAt 2026-11-21T20:49:32.650Z` → `finishedAt 2026-11-21T20:49:39.927Z`，`capMs 2500`，`sampleCount 34`。中止后界面文案：「第 2 章 · 写稿 / 调用超时已中止 / 本次调用超过 10 分钟未完成，已中止。 / 本次未保存草稿或正文章节。请调整章节要求后重试。」

run 不是永久 `running`：见 §3 的 run 行（`status: failed`）。实例纪律：`instancesThisRun=1`、`exitCode=0`、`leftoverElectronProcesses=0`（§7）。

## 3. 判据 2 · 两表合看（roots 的 `blocked_code` + 对应 run 的 `status`）

题面口径：该列在 `generation_roots`，`generation_runs` 无此列；写入点 `electron/repositories/generation-run-repository.ts:757-759`。我用 `node:sqlite` 直连验收项目库（`better-sqlite3` ABI 145 与当前 node 137 不匹配，故走内置模块）读 `evidence.json` 同源数据，原文：

```
generation_roots: { rootId: "9d2580d7-1276-4031-88ea-ad14ba7dca4e", blockedCode: "GENERATION_CALL_TIMEOUT", activeElapsedMs: 2517, … }
generation_runs:  { runId: "17e3793e-bb8c-4f3c-9f59-e5d9f3d48eaf", rootId: "9d2580d7-1276-4031-88ea-ad14ba7dca4e", status: "failed" }
                  { runId: "5cd9df00-9dfd-49d4-a4a2-0ecc35c67aea", rootId: "03f88499-dee5-41fd-8d23-2d0ae11b2a78", status: "failed" }
```

①roots 行 `blockedCode = GENERATION_CALL_TIMEOUT`，`activeElapsedMs 2517` 与注入上限 2500ms 同量级（中止发生在到限附近，不是瞬间失败）；②同一 `rootId` 的 run `status = failed`，非 `running`、非无码 `paused`。对照：失败档 root `03f88499…` 的 `blockedCode: null`——超时码没有溢出到非超时档。

## 4. 判据 3 · 三态在界面上各不相同（按 04:48 修订后措辞）

| 态 | 触发条件 | 界面原文（`evidence.json`） |
|---|---|---|
| 生成中 | 调用进行中（超时前） | `spinners: 2`、`progress: ["1/1"]`、`alertCount: 0`；timeout 档 34 samples 中 21 个处于该态，failure 档 19 中 4 个 |
| 超时已中止 | `AI_NOVEL_CALL_TIMEOUT_CAP_MS=2500` 到限 | 「调用超时已中止」+「本次调用超过 10 分钟未完成，已中止。」；`codeLine: null` |
| 调用失败 | 服务返回 HTTP 500 | 「工作流未完成」+「服务返回 HTTP 500，请求未完成。」+「错误码：GENERATION_PROVIDER_FAILED」；`codeLine: "GENERATION_PROVIDER_FAILED"` |

三态各有独立标题与正文，超时档与失败档标题不同（`调用超时已中止` vs `工作流未完成`），`alertText` 互不相同（脚本 `failureDistinctFromTimeout: true`）。本判词不要求 `callPhase` 出现在渲染层——按裁定②，渲染层透传另立 D9b（卡已建：`.batch/night/cards/d9b-callphase-renderer.md`）。

## 5. 判据 4 · 预算小于上限归 `ROOT_BUDGET_EXHAUSTED`

单测断言原文（`electron/services/__tests__/generation-run-service.call-timeout.test.ts`）：

- `:93` `it('预算剩余小于上限时按剩余收口：block / settle 落 ROOT_BUDGET_EXHAUSTED', async () => {`
- `:101` `expect(f.blockCalls).toEqual([['root-1', 'ROOT_BUDGET_EXHAUSTED']])`
- `:102` `expect(f.settleCalls[0].failureCode).toBe('ROOT_BUDGET_EXHAUSTED')`
- `:103` `expect(f.settleCalls[0].diagnostics).toMatchObject({ endReason: 'failed', failureCode: 'ROOT_BUDGET_EXHAUSTED' })`
- `:104` `expect(result.failureCode).toBe('ROOT_BUDGET_EXHAUSTED')`
- `:113` `expect(resolveCallDeadline(300_000)).toEqual({ deadlineMs: 300_000, failureCode: 'ROOT_BUDGET_EXHAUSTED' })`

`src/shared/__tests__/generation-call-timeout.test.ts:44-46` 同样区分：`resolveCallDeadline(3_600_000)` → `GENERATION_CALL_TIMEOUT`，`resolveCallDeadline(DEFAULT_SINGLE_CALL_TIMEOUT_MS)` → `ROOT_BUDGET_EXHAUSTED`。即「预算不足」不会被记成「超时」。

## 6. 判据 5 · 整文件全绿 + 闸门

```
$ pnpm test electron/services/__tests__/generation-run-service.call-timeout.test.ts src/shared/__tests__/generation-call-timeout.test.ts ; echo "TEST_EXIT=$?"
 ✓ src/shared/__tests__/generation-call-timeout.test.ts (10 tests) 5ms
 ✓ electron/services/__tests__/generation-run-service.call-timeout.test.ts (6 tests) 10ms
 Test Files  2 passed (2)
      Tests  16 passed (16)
TEST_EXIT=0
```

（整文件跑，未用 `-t` 过滤。）

```
$ pnpm check:fast ; echo "CHECK_EXIT=$?"
[check:fast] typecheck ✓ 15.4s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
CHECK_EXIT=0
```

覆盖点对应：cap 注入默认不变 → `generation-call-timeout.test.ts:15-16`（`DEFAULT_SINGLE_CALL_TIMEOUT_MS === 600_000`）、`:21` 非法值回默认；三态切换含阶段态取值 → `generation-run-service.call-timeout.test.ts:137-145`（`onCallPhase` 收 `['attempt-1:generating','attempt-1:timed-out']`）、`:151-161`（失败档 `['attempt-1:generating','attempt-1:failed']`）。

## 7. 实例纪律（卡面 §8，与判据 1 同屏）

`instancesThisRun = 1`、`exitCode = 0`、`leftoverElectronProcesses = 0`；`physicalModelRequests = 0`、`unclassified = 0`、`noExternalFetch: true`。等待期内未再起实例。

## 8. 记录项与疑点（均不判红）

1. **超时档文案与注入上限不同量纲**：文案写死「本次调用超过 10 分钟未完成」，而本轮 `capMs = 2500`。生产默认即 10 分钟，注入值仅验收用，故文案在生产口径下正确；不作为缺陷，但建议 D9b 或后续把文案改为按实际上限渲染。
2. **超时档无「错误码：」行**：按负责人裁定③与卡面「记录项」收，超时码走 `activityDiagnostics.failureCode`，本卡不要求补。
3. **卡面判据 3 的修订注排版**：修订句现落于判据 3 行**下一行**（`| （11-22 04:48 由负责人修订：…）`），非同行行末；群 admin 已要求负责人挪到行末。内容对判定无影响，本判词按修订后措辞判。
4. **派验单自述卡面版本是沿革旧值**：§取证口径 内仍写「卡面现 83 行 / 8,477B / `fea4b4fc…`」，下一行才是 89 行 / `db8d01f6…`；而卡面因追加修订注现为 89 行 / 9,848B / `ad1fde5c…`。按「判据冻结、不再改第二次」，登记不改，判据文字与实际一致。
5. **阶段态只在主进程**：`onCallPhase` 由 `electron/services/generation-run-service.ts` 的依赖注入消费，`MainGenerationSnapshot`（`src/services/generation/generation-runtime.ts:82-93`）无 phase 字段，渲染层取值属 D9b 范围。

## 9. 判词状态

本判词为**首验终稿**：判面 `8ae59d0a`，判据分母如上两个 sha，判据 5/5 PASS，未覆盖项 0。后续若 HEAD 变更（含 D9b 接线），按新卡重开首验，本判词不再改写。

修订注记（11-22 04:5x，群 admin 依主身裁定令补，只记事实、不重跑不重判）：卡面由 `ad1fde5c446940c2…` 变为 `5c2c8cafa97c3b33…`，仅修订注挪位致 −1 字节，判据文字逐字未改，本判结论不受影响；判定时读的是 `ad1fde5c`。

<!-- DONE -->
