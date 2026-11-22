# D10 判据 2 实机取证（确定性取样版）

- 执行方：developer（apply 位）
- 树：`C:/develop/workspace/AI-writer/wt-d10`，分支 `card/s3-d10-clear-reset`，HEAD **`4a3aaf1823d3b2cb26c5c241a400ac042fd061ff`**（`CARD-S3-D10-FF`，父 `71f72b9b`）
- 脚本：`wt-d10/.runtime/s3-d10-live.mjs`（取样已按卡面 §8.1 第 7 条改为确定性等待：轮询卡片数，连续两次读数相同且间隔 ≥300ms 才取，轮询间隔 350ms）
- 原始证据：`wt-d10/.runtime/.cache/s3-d10/b96d57c6-7c9/evidence.json`（246 行 / 10,526B / `cd73444e214118a9ab0799974650dbf3fb88dc9158720c3ee009b6166b133d5e`）

## 1. 三档读数（判据 2 只认这些键）

| 档 | `afterCards` | 取样 | 说明 |
|---|---|---|---|
| `creativeFields` | 1 | sampleCount=2，gap 359ms | 该档不删生成内容，候选卡片应保留 ⇒ **N/A** |
| `blueprints` | 1 | sampleCount=2，gap 360ms | 同上 ⇒ **N/A** |
| `generatedText` | **0** | sampleCount=2，gap 364ms，`afterCardsAt=2026-11-22T05:46:41.380Z` | 清空后卡片与区块同时消失 |

- `finalCards=0`、`finalSectionPresent=false`、`checks.noResidualCards=true`
- 对照项（不顶替判据）：`afterManualRefreshCardCount=0`、`afterReopenCardCount=0`
- 清空后 `generation:list` 原文（当前会话探针）：`[]`
- 四表同一时刻 `COUNT(*)`：`1/2/2/1` → `0/0/0/0`（`generation_runs/artifacts/attempts/roots`），`drafts 2→0`、`blueprints 3→0`

## 2. 实例与退出证据

- `instancesThisRun=1`
- `exitCode=0`
- `leftoverElectronProcesses=0`
- `tasklist` 原文：`INFO: No tasks are running which match the specified criteria.`
- `chatCalls=2`、`physicalModelRequests=0`

## 3. 作废的旧取证

- `.runtime/.cache/s3-d10/95d46e3c-366/evidence.json`：固定 800ms sleep 取样（口径已废，结论同向）
- `.runtime/.cache/s3-d10/6da1e901-f93/evidence.json`：取样轮询间隔 350ms 改前触发「连续两次间隔 <300ms」误判，超时失败，作废
- `.runtime/.cache/s3-d10/f756048b-1d5/evidence.json`（旧 `7a50674e…` 报告所引）：fix-forward 前，判据 2 FAIL

## 4. 取证脚本的一处观测（供后人）

`window.aiNovelAPI` 是 contextBridge 暴露的冻结对象，在页内改 `api.invoke = …` 静默无效 ⇒「面板自己那次 `generation:list` 的返回原文」无法在页内拦截，只能用「再 `project:open` 拿当前会话，再用同一通道调一次」的探针取（本脚本 `probe:generation-list-after-clear` 即此法，返回 `[]`）。

<!-- DONE -->
