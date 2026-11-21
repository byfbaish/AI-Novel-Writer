执行方：QA · AI writer项目组
model：未取到环境自报（本机无 `DSH_MODEL`／provider 变量；判定不依赖此项）
判面 HEAD：`0f0ca3ee`（分支 `card/s2-d1-multicall-reverify`，=`exp/mainline-1119` 头，零提交）
判据分母：派验单 `.batch/night/review-requests/s2-d1-multicall-reverify.md`（34 行 / 1,812B / sha256 `383231701b3a6eb3e3d86f07d2d6d45c86178f2723ec1b9c08bcc36c65084998`）+ 卡面 `.batch/night/cards/s2-d1-multicall-reverify.md`（58 行 / 4,837B / sha256 `53e85f34ef218ac0d1757c98a255b3e767a449a33cde7d1ad00c1eb9f88b709c`）

## 0. 结论

**PASS（5/5）。** 零改码成立（§1）；我独立复跑实机得同 run 两行 attempt（§2）、`GENERATION_SOURCE_CHANGED` 计数 0（§3）、run 终态 `completed`（§4）、第 2 章草稿被采用（§5）、实例纪律三项齐（§6）；既有相关单测整文件 254 passed、`EXIT=0`（§7）。未覆盖项 0 条；记录项 3 条（§8），均不构成打回。

不返工实现，本卡无需新单测。

## 1. 判面与零改码（硬判据）

```
$ git rev-list --count 0f0ca3ee..card/s2-d1-multicall-reverify
0
$ git log --oneline -1 card/s2-d1-multicall-reverify
0f0ca3ee merge(card/d12-replay-retry): D12 上一章结尾重演与带原因整章重写实机验收（CARD-D12-replay-retry）
$ git diff --ignore-cr-at-eol --stat -- src electron scripts
（无输出）
$ git diff --numstat -- src electron scripts
（无输出）
$ git branch -vv | grep d1
* card/s2-d1-multicall-reverify 0f0ca3ee …
```

- 分支零提交、无 upstream、未 push；`src`／`electron`／`scripts` 无改动、无新增生产文件 ⇒ 零改码成立。
- 全树 `git diff --ignore-cr-at-eol --stat` 只有两件他人文档：`.batch/night/org/BACKLOG.md`（15 行，产品经理 D9b 排期）、`docs/design/product/live-pipeline-acceptance-defects-assessment.md`（6 行，产品经理 D9 转 ✅）。按「代码作用域 + 无新增生产文件」判，理由写进 §8 记录项 1。
- 取证脚本 `.runtime/s2-d1-multicall.mjs`（26,960B）在 `.runtime/` 下，未入库；交件报告 `.batch/night/staging/s2-d1-multicall-reverify-report.md`（157 行 / 9,520B / sha256 `09f8d2689a21ec48b721db800d628d5349cd4d0e173537d253f8cf4ce878547e`）。

## 2. 判据 1 · 同 run 内两次调用都发生（我自己跑的实机）

```
$ npx vite build            → BUILD_EXIT=0
$ node .runtime/s2-d1-multicall.mjs
[d1] seed-notes
[d1] request:outline · count=1
[d1] request:draft · count=1
[d1] settle · outcome=draft
[d1] run-terminal · status=completed
{"ok":true,"runId":"8b090993-736","evidencePath":"…\\.runtime\\.cache\\s2-d1\\8b090993-736\\evidence.json","head":"0f0ca3ee8dfd6488ff1fe682dc781c3c4fae0926","branch":"card/s2-d1-multicall-reverify","checks":{"twoCallsSameRun":true,"purposesDistinct":true,"noSourceChangedInDb":true,"noSourceChangedInLog":true,"runTerminal":true,"secondCallAdopted":true,"noExternalFetch":true,"noUnclassifiedRequest":true},"runStatus":"completed","attempts":["chapter-draft-short-outline:stop","chapter-draft:stop"],"draftChapter2":["draft:202"],"sourceChangedHits":0,"instancesThisRun":1,"leftoverElectronProcesses":0,"error":null}
ACC_EXIT=0
```

我的 run `8b090993-736`（`startedAt 2026-11-21T21:22:32.550Z` → `finishedAt 2026-11-21T21:22:40.232Z`），`generation_attempts` 两行原文（`evidence.json` → `db.attempts`）：

```json
{
  "attemptId": "f1ffad52-b612-41f3-abac-31e756a00f52",
  "runId": "2bde3ce8-0742-4f50-8e63-03ce34c3debe",
  "rootId": "ba327220-cf07-433c-8618-281a26b21536",
  "ordinal": 1,
  "purpose": "chapter-draft-short-outline",
  "finishReason": "stop",
  "failureCode": null,
  "attemptStatus": "settled"
},
{
  "attemptId": "d89c11fe-7230-4ce7-94d8-e17e2dad5de3",
  "runId": "2bde3ce8-0742-4f50-8e63-03ce34c3debe",
  "rootId": "ba327220-cf07-433c-8618-281a26b21536",
  "ordinal": 2,
  "purpose": "chapter-draft",
  "finishReason": "stop",
  "failureCode": null,
  "attemptStatus": "settled"
}
```

`run_id` 相同、`purpose` 不同（短细纲／正文）、ordinal 1→2 顺序、均 `stop`、`settled` ⇒ 判据 1 成立。

## 3. 判据 2 · 全程无 `GENERATION_SOURCE_CHANGED`

- 我这一轮的 `evidence.json`：`db.sourceChangedHits = 0`、`logSourceChangedHits = 0`，四表扫描（`db.scannedTables`）无命中；脚本末行 `"sourceChangedHits":0`。
- 复查命令（我自己执行，对交件 run 的库同样成立）：

```
$ grep -c "GENERATION_SOURCE_CHANGED" .runtime/.cache/s2-d1/8b090993-736/evidence.json
0
```

⇒ 判据 2 成立（应用日志与库双无）。

## 4. 判据 3 · run 有终态

我这一轮 `generation_runs` 行原文（`db.runs`）：

```json
{"runId": "2bde3ce8-0742-4f50-8e63-03ce34c3debe", "rootId": "ba327220-cf07-433c-8618-281a26b21536", "status": "completed", "keys": ["run_id", "root_action_id", "binding_json", "status", "created_at_ms", "open_key", "execution_owner", "execution_epoch", "lease_expires_at"]}
```

对应 `generation_roots` 行：`blockedCode = null`、`activeElapsedMs = 7`。`status=completed`，非永久 running、非无码 paused ⇒ 判据 3 成立。

## 5. 判据 4 · 第二次产出被采用

`drafts` 原文（同 run）：

```json
[{"id": 1, "chapter": 1, "version": 1, "status": "finalized", "source": "write", "wordCount": 903, "contentLength": 1046},
 {"id": 2, "chapter": 2, "version": 1, "status": "draft", "source": "write", "wordCount": 175, "contentLength": 202}]
```

第 2 章行：`status=draft`、`source=write`、`wordCount=175`、`contentLength=202`，与脚本末行 `"draftChapter2":["draft:202"]`、`settle · outcome=draft` 一致；同轮 `panel` 读数为第 2 章候选预览（含正文与「确认并采用候选」入口，`spinners:0`、`alerts:[]`） ⇒ 第二次产出被采用，不是「调用了但结果丢了」。判据 4 成立。

## 6. 判据 5 · 实例纪律三项

- `instancesThisRun = 1`、`exitCode = 0`、`leftoverElectronProcesses = 0`（我这一轮与交件轮 `ddcfaef9-fca` 同值）。
- `.runtime/.cache/s2-d1/` 下 5 个目录逐份读过（`evidence.json` 的 `instancesThisRun` / `leftoverElectronProcesses`）：**每轮均为 1 / 0，无并发双实例、无未扫残留**。

| run 目录 | ok | runStatus | checks | instances | exitCode | leftover |
|---|---|---|---|---|---|---|
| `1b1acf24-6a2` | true | completed | 全 true | 1 | null | 0 |
| `5d1e22f0-5b7` | false | — | `{}`（有 `error`／`failurePanel`） | 1 | null | 0 |
| `74d5a8db-7a2` | false | null | `twoCallsSameRun:false` 等 | 1 | null | 0 |
| `7f7dead3-bd4` | false | running（采样时未终态） | `runTerminal:false` | 1 | null | 0 |
| `ddcfaef9-fca` **（交件所指）** | true | completed | 全 true | 1 | 0 | 0 |

⇒ 前四轮为同一脚本的调试中间轮（失败轮 `exitCode` 未记，属脚本早期版本未写该字段，不影响交件轮），交件轮三项齐 ⇒ 判据 5 成立。

## 7. 既有相关单测（整文件，非 `-t` 过滤）

```
$ pnpm test src/services/workflows/commands/__tests__/generate-draft.command.test.ts
 ✓ src/services/workflows/commands/__tests__/generate-draft.command.test.ts (254 tests) 1141ms
 Test Files  1 passed (1)
      Tests  254 passed (254)
TEST_EXIT=0
```

与 developer 报的基线值一致。

## 8. 记录项与口径说明（不影响结论）

1. **「diff 为空」的作用域**：派验单「判定纪律」原文写「`git diff --ignore-cr-at-eol --stat` 为空、`git diff --numstat` 为空」，未限定路径。全树上现有两件**他人未提交文档**（BACKLOG、缺陷稿），我按「零改码＝执行方未改代码、无新增生产文件」判，并附 `-- src electron scripts` 的显式命令原文。若后续卡面要求「全树绝对干净」，请在卡面写明作用域，否则任何并行文档改动都会让该判据假红。
2. **调试中间轮**：`5d1e22f0-5b7`／`74d5a8db-7a2`／`7f7dead3-bd4`／`1b1acf24-6a2` 是脚本迭代轮（首轮 error、次轮未成 run、第三轮采样到 running、第四轮已成功）。交件只认 `ddcfaef9-fca`；失败轮不构成缺陷证据，`7f7dead3` 的 `running` 是采样时机而非终态缺失（同轮 `runTerminal:false` 即脚本自报「还没到终态就取数」）。
3. **脚本未入库**：`.runtime/s2-d1-multicall.mjs` 在 `.runtime/`（不入库），本卡零改码所以脚本不进仓。若后续要把该复验做成常驻回归，需另卡决定落点（`scripts/` 下入库）。

---

本判词为**首验终稿**：判面 `0f0ca3ee`（零提交分支，HEAD 变更即作废），判据分母如上两个 sha，结论 PASS 5/5，未覆盖项 0。D1 转 ✅ 由产品经理做。

<!-- DONE -->
