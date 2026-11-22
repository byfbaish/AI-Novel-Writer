执行方：developer · AI writer项目组
取数件：卡面 `s3-d4-conflict-copy.md` sha256 `635d09106fa74acd698189f6e2f2052b851fe450daab8cf769e4985f89cd4894`（v2 归档值；首验分母按派验单）/ 派验单 `s3-d4-conflict-copy.md` sha256 `23f99b3f18ca96d9ada6f4ef347db5ae2e6a6e838d90609c8a4ff5d65324a144` / base `b4e8da53`
model=宿主未暴露芯片原文（`env | grep DSH_MODEL` 空，见 §7）|倍率=未知|provider=未知

# D4 交件报告 · 来源冲突两层文案分层挂载

## 1. 交件面

- 分支：`card/s3-d4-conflict-copy`
- 提交：`136c999c35563114c55719401684a1a7ecf799de`（短 sha `136c999c`）
- 父提交：`b4e8da53`
- 未 push（照群内口径，push 由主身做）
- 计算方式：`git log -1 --format=%H` 原文 `136c999c35563114c55719401684a1a7ecf799de`

### 改动面（`git diff --numstat b4e8da53..HEAD -- src electron scripts` 原文）

```
4	7	src/components/panels/AIOutputPanel.tsx
42	2	src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
23	9	src/components/ui/SourceConflictNotice.tsx
35	4	src/components/ui/__tests__/SourceConflictNotice.test.tsx
29	4	src/shared/source-conflict-copy.ts
```

`git diff --name-status b4e8da53..HEAD -- src electron scripts` 原文：5 行全为 `M`，无 `A`（无新增生产文件）。

合计 133 insertions / 26 deletions，与负责人 11-22 10:4x 贴出的 `+133/−26` 一致。

### 白名单对照（派验单 §3）

| 改动文件 | 白名单条目 |
|---|---|
| `src/components/panels/AIOutputPanel.tsx` | 白名单第 1 条 |
| `src/components/ui/SourceConflictNotice.tsx` | 「承载文案的共享模块」 |
| `src/shared/source-conflict-copy.ts` | 「承载文案的共享模块」 |
| `src/components/ui/__tests__/SourceConflictNotice.test.tsx` | 「其单测」 |
| `src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx` | 「AIOutputPanel 相关 browser 测试（只允许同步断言）」 |

禁改区未动：`src/components/editor/*`、`NarrativeThreadEditor.tsx`、`VersionHistory.tsx`、`ArchFileViewer.tsx`、`sourceStatus` 判定、D1/D2 状态机与 `GENERATION_SOURCE_CHANGED`、`chapter-materials.ts`、D12 区——`git diff --name-only` 五条路径可见即证。

## 2. 改法（行为变化）

1. `src/shared/source-conflict-copy.ts`
   - 新增导出 `sourceConflictBatchLayer(locale, chapterNumber: number | null = null)` 与私有 `batchLayerText`。
   - 中文带章号：`本批已停止：后续单元不再执行，需从第${chapterNumber}章重新发起本批。`；无章号：`本批已停止：后续单元不再执行，需重新发起本批。`
   - 英文带章号：`This batch has stopped: later units will not run. Start a new batch from Chapter ${chapterNumber}.`；无章号：`… Start a new batch to continue.`
   - `sourceConflictCopy().batch` 改为调用同一函数（无章号版），两层文案同源。
2. `src/components/ui/SourceConflictNotice.tsx`
   - props 增 `batchStopped?: boolean`（默认 `false`）与 `batchChapterNumber?: number | null`（默认 `null`）。
   - 产物层随 `sourceStatus === 'conflict'` 出现；批次层**只随 `batchStopped`** 出现；各带 `data-conflict-layer="output" / "batch"` 便于分别断言。
3. `src/components/panels/AIOutputPanel.tsx:453-459`
   - 批卡原先用 `gate.terminated &&` 内联一段文案，改为 `<SourceConflictNotice sourceStatus={gate.sourceChanged ? 'conflict' : 'current'} batchStopped={gate.terminated} batchChapterNumber={gate.wayOut?.chapterNumber ?? null} />`。
   - `batchStopped` 取自 `evaluateBatchRecoveryGate({ batch, rootRunStatus }).terminated`（root run 终态），**不再**用 `sourceStatus === 'conflict'` 顶替。

行为翻转（须点名，见 §3 末）：批次来源变化但根 run 未终态时，先前会报「来源已变化：后续单元不再执行，需重新发起。」——正是本卡要修的误报，现不再出现；批次真停时才出现批次层。

## 3. 判据对照

| 判据 | 证据来源 | 能判否 |
|---|---|---|
| ① 实机「来源冲突 + 批次中止」同屏两层（中/英） | 见 §4 实机档 A | 见 §4 |
| ② 实机仅单稿冲突、批次未停时只有产物层 | 见 §4 实机档 B ＋ §5 browser 断言 | 部分（口径差异已写明） |
| ③ 批次层含后果与下一步（停在哪、要重发起） | 文案原文＋§4 实机档 A 的 `data-conflict-layer="batch"` 文本 | 能 |
| ④ 单测两支互斥、整文件汇总行 + `EXIT=` | §5 两行汇总原文 | 能 |
| ⑤ `check:fast` | §5 末行 | 能 |

## 4. 实机证据

判定面：**基于工作区**，工作区等于提交 `136c999c`（`git status --porcelain -- src electron` 空；`git log -1 --oneline` = `136c999c fix(s3-d4): 来源冲突文案分层挂载，批次层只在批次真停时出现`）。

取证脚本（不入库）：`.runtime/s3-d4-batch-layers.mjs`；运行原文：

```
$ node .runtime/s3-d4-batch-layers.mjs > .runtime/s3-d4-run5.log 2>&1; echo "EXIT=$?"
EXIT=1
```

runId `945ff8a4-e3b`，evidence `.runtime/.cache/s3-d4/945ff8a4-e3b/evidence.json`。

**本轮相对上一轮改了什么（同参数不复跑）**：

1. `createProject` 的蓝图从 2 章加到 3 章。上一轮批次场景点「启动批量创作」后被前端拦下，对话框提示原文：`未找到第3章蓝图。请先补齐连续蓝图后再启动批量创作。`（起始章节默认第 2 章、本次 2 章 ⇒ 需第 2、3 章蓝图）。批次从未启动，因此 `mainState.intercepted` 只有 3 条 `band="single-fail"`，看起来像 `band` 没生效，实际是那一档根本没发请求。
2. 合成 provider 的 draft 失败条件由 `draftCalls >= 2` 改为 `draftCalls >= 1`（批次从第 2 章起跑，第一次 draft 就是第 2 章；第 1 章已定稿不重跑）。

本轮 `mainState`（`physicalModelRequests` 必须为 0＝未真实出网）：

```json
{"physicalModelRequests":0,"embeddings":2,"unclassified":0,"draftCalls":3,"bands":["single-fail","batch-stop"],"intercepted":5}
```

`bands` 里已含 `batch-stop`，即 `globalThis.__d4.band='batch-stop'` 本轮确实生效。

### 4.1 判据① 批次层（实机，已达成）与判据③（后果与下一步）

批次场景：`批量创作` 从第 2 章起跑 2 章；第 2 章 draft 返回 500 ⇒ 批次根 run 终态失败。`batch:terminal` 原文：

```
[d4] batch:terminal · ["b818cbbd-6772-4d48-af40-10d8fab0f528:failed","5983fd63-127e-4e29-ba00-0bde931cb22a:failed"]
```

面板原文（`.writer-ai-panel` 内 `innerText` 摘录，` | ` 为换行）：

```
AI 输出 | 批量正文：已保存 0 章，下一章 2 | 本批已停止：后续单元不再执行，需从第2章重新发起本批。 | 继续此批次
```

同一屏上的失败原文（证明「批次确实中止」而非文案臆测）：

```
批量草稿待审 · 第 2 至 3 章 | 工作流未完成 | 服务返回 HTTP 500，请求未完成。 | 错误码：GENERATION_PROVIDER_FAILED
```

判据③核对：批次层同时给出「停在哪」＝本批已停止、后续单元不再执行；「要重发起」＝需从第2章重新发起本批（章号取 `gate.wayOut.chapterNumber`，实机读到 2，与批次起始章一致）。

### 4.2 判据① 的两层同屏（未达成，原因如下）

同一轮 reload 后面板读数（`evidence.json → failurePanel`）：

```json
{"panelText":"AI 写作助手 …（77 字符，仅欢迎语）","outputLayers":[],"batchLayers":[],"alerts":[]}
```

失败原文：`Error: 等待超时：批次层的两层同屏`。

原因：reload 后终态批次 run 不再出现在面板，`generation:list` 不读回已终态的批次 run（`AIOutputPanel.tsx:316-345` 的 `runs` 来源）。因此「reload 后再看两层」这条路径在本卡白名单内不通；批次层本身是在**同一会话内**（reload 前）实机出现的，上面 4.1 的原文即取自该时刻。产物层与批次层能否同屏，由 §5 的 browser 用例（真实 React 渲染、断言 `[data-conflict-layer]`）覆盖。

**这正是负责人 11-22 11:3x 给的降级口径所覆盖的情形**：交件报告附取证脚本与失败原文，双层渲染由 browser 用例覆盖；判据 1 的文字要不要这么改，由主身定，我不改判据。

### 4.3 判据② 反面（实机，已达成）

单稿场景（`single` 档）：`单稿 run completed → 改第 1 章正文（来源变化）→ reload` 后面板 `panelText` 只有欢迎语，`outputLayers=0`、`batchLayers=0`，且全屏不含「本批已停止」「后续单元不再执行」。断言原文（脚本内置）：

```
assert.equal(singlePanel.batchLayers.length, 0, '单稿冲突不得出现批次层')
assert.ok(!/本批已停止|后续单元不再执行/.test(singlePanel.panelText), '单稿冲突不得报「整批已停止」')
```

即：单稿冲突不会误报「整批已停止」。产物层正面的缺口见 §7 第 1 条（归 D4b）。

### 4.4 实例纪律（证据三项 + 进程原文）

```json
{"instancesThisRun":1,"exitCode":1,"leftoverElectronProcesses":0}
```

`exitCode=1` 的来源就是 4.2 那条超时（脚本以失败收尾），不是崩溃；4.1、4.3 两组断言在超时前已通过。`leftoverElectronProcesses=0` 由脚本收尾统计（按本项目 userData 路径过滤 `electron.exe` 命令行）。

```
$ tasklist | grep -c electron
0
```

（`grep -c` 命中 0 行时自身返回 1，故该命令的 shell 退出码为 1，属正常：输出 0 即无残留。）

## 5. 单测与闸门（整文件汇总行）

```
$ node scripts/run-tests-electron.mjs src/components/ui/__tests__/SourceConflictNotice.test.tsx
 ✓ src/components/ui/__tests__/SourceConflictNotice.test.tsx (7 tests) 7ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
EXIT=0
```

```
$ node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx
 ✓ |chromium| src/components/panels/__tests__/AIOutputPanel.main-recovery.browser.tsx (21 tests) 343ms
 Test Files  1 passed (1)
      Tests  21 passed (21)
EXIT=0
```

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 17.4s
doc links: checked 1468, broken 0
[check:fast] doc-links ✓ 0.3s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
0 项不合规
[check:fast] batch-hygiene ✓ 0.2s
[check:fast] 全部通过。
EXIT=0
```

两支互斥的断言位置：
- 同屏支：`SourceConflictNotice.test.tsx` 第 1 支（`batchStopped` → output+batch 都在）与 `AIOutputPanel.main-recovery.browser.tsx`「批次来源变化且批次确实已终止…」（两层同屏＋继续按钮 disabled）。
- 单层支：`SourceConflictNotice.test.tsx` 第 2 支（冲突但 `batchStopped` 缺省 → 只有 output，且 `not.toContain('后续单元')`）与 browser「来源变化的未完成批次不能继续…」（`[data-conflict-layer="batch"]` 为 null）。

## 6. 账号/数据面

无。本卡只改渲染文案与组件 props，不新增表/列/IPC，不出网。

## 7. 备注（交给 QA 判的两处口径）

1. **判据② 的实机可达性**：成功完成的单稿 run 不写 `recovery_candidates`（`electron/migrations/baseline-schema.ts:131-155` 注释：该表只收失败生成的可见产物），reload 后也不在 `generation:list` 里；而 `AIOutputPanel.tsx` 的单稿写稿块（`visibleRuns`，`:465-500`）历史上**不渲染** `SourceConflictNotice`，`GenerationRecoveryContext`（`src/shared/generation-owner-contract.ts:220-250`）也没有 `sourceStatus` 字段。故「单稿 draft 块上出现产物层」在本卡白名单内**没有挂载点**，实机档 B 只能核判据②的反面（不得出现批次层、不得报「本批已停止」）；正面「只出现产物层」由审修/规划恢复卡的 browser 断言覆盖。若要求实机正面取证，需要扩白名单（给单稿 run 块补 `sourceStatus`，动 `generation:read-context` 契约），请裁定。
2. **报告头第 3 行的模型名**：`env | grep -iE "^DSH_(MODEL|ENGINE|PROFILE|BOT)"` 只返回 `DSH_PROFILE=desktop`、`DSH_PROFILE_DIR=…`，无模型标识；不编造，留「宿主未暴露」。
