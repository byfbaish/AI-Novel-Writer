# 判词 · CARD-S3-D16（模型指示器补验：整机重启 / 配置A·实际B）· 首验

From: QA · AI writer项目组
To: 项目总负责人 · AI writer项目组（终审）
判定时间：2026-11-22 12:1x

## 0. 结论

**首验不通过 → 复判 PASS**（补证后判据 2 已齐，见 §5）。首验时仅判据 2 缺一项证据，其余 5 条通过。判据 1／3／4／5／6 达标；判据 2 要求的三处同源对账里，**`generation:last-model` 的 IPC 原文缺失**——脚本从未调用该通道，只读了状态栏 DOM，故「IPC 原文」无法贴出。补齐这一项即可只复判判据 2，不必重跑整卡、不必改代码。

## 1. 分母与判定面

- 判定面（提交面）：`544dcbd5`（分支 `card/s3-d16-indicator-verify`，**零提交**；`git rev-parse HEAD` 同值）。
- 卡面 `.batch/night/cards/s3-d16-indicator-verify.md`：65 行 / 5,802B / `2848337fc1092afb84ea6b9696be11b3edf50f95568741353f03588fc3819b15`。
- 派验单 `.batch/night/review-requests/s3-d16-indicator-verify.md`：30 行 / 4,500B / `f282eb0c2f17637c8253ea3869c58ad84bf610d2c1184f7d1dc07ce72c163cb2`（回填后工作区版；`94dbdd78…` 为回填前版本，作废）。
- 交件报告 `.batch/night/staging/s3-d16-indicator-verify-report.md`：116 行 / 7,602B / `efadb7e8dd14629222814716c1616fd2e4ab725fc6b0a16271f277e10865a66e`。
- evidence `.runtime/.cache/s3-d16/d7c52504-2e1/evidence.json`：148 行 / 4,072B / `3b6a1a1503df2b793e9069bbb5b09caf15768f85ad4d2d2cf7d01005400a71a2`。
- 取证脚本 `.runtime/s3-d16-live.mjs`：**387 行 / 23,713B / `bbf6f51eb24a0964af2af4f7b617db6c11fa48ad51fe031ffc07eff73b5acf28`**（回执报的 `bdb0eb48…`／372 行与现盘不符，见观察项 3）。
- 分母入库后核对：本单尚未入库（`git show HEAD:…` 仍为 `a362c793…`），入库后需补一行「库内 sha 与盘上一致」。

## 2. 判据逐条

### 判据 1 · 整机重启后仍显示实际调用模型 —— **[live] PASS**

```
[d16] launch#1  · {"instancesThisRun":1,"pid":64560}                     04:14:14.368Z
[d16] quit#1    · {"pid":64560,"closedAt":"2026-11-22T04:14:21.161Z"}
[d16] launch#2  · {"instancesThisRun":2,"pid":20872}                     04:14:21.907Z
[d16] statusbar:instance2 · {"statusbarText":"任务 日志 模型 D16 实际模型 B","title":"当前模型（实际调用）：D16 实际模型 B","label":"D16 实际模型 B"}
```
`pids` 记两次起停：`64560` startedAt `04:14:13.774Z`、`20872` startedAt `04:14:21.463Z`；进程退出与再起之间无重叠，属整机重启而非 `reload()`。重启前配置已切成 A（见判据 2），重启后状态栏仍显示 B ⇒ 未回退到配置值。

### 判据 2 · 构造 A≠B 并三处同源对账 —— **[live] 不通过（缺 IPC 原文）**

已取到的三面：

| 面 | 事实源 | 原文 |
|---|---|---|
| 配置 A | `llm:get-default-model` 回读 | `"d16-config"`（evidence `configuredAfterSwitch`） |
| 实际 B（持久化） | 真实 SQLite `generation_runs.binding_json` → `sourceManifest.modelReceipt.model` | `{"modelId":"d16-actual","modelName":"gpt-4.1"}` |
| 界面 | `.writer-statusbar` 可见文本 / tooltip | `D16 实际模型 B` / `当前模型（实际调用）：D16 实际模型 B` |

我独立读库复核（只读打开，非引用报告）：

```
$ python -c "sqlite3 ro …/d16live-d7c5/.ai-novel/project.db"
select run_id,status from generation_runs → ('f93b8120-9006-4936-b252-a203bef88cab','failed')
binding_json→sourceManifest.modelReceipt.model → {"modelId":"d16-actual","modelName":"gpt-4.1",…}
```

缺的一面：**`generation:last-model` IPC 原文**。卡面判据 2 证据源留痕点名了该通道（`electron/controllers/generation-controller.ts:290`、契约 `src/shared/generation-owner-contract.ts:424`、消费者 `src/services/generation/actual-model-hydration.ts:21`），派验单判据 2 亦要求「IPC `generation:last-model` 原文」，且写明「缺一条即 FAIL」。脚本侧实测：

```
$ grep -n "last-model\|actualModel\|generation:" .runtime/s3-d16-live.mjs
（无 generation:last-model 调用；仅 :347 actualModelFromBinding，读的是 binding）
```

即界面 B 是由「hydration → IPC」推断出来的，不是该通道的原文。此项属取证缺项，不是产品缺陷：代码链 `actual-model-hydration.ts:21` 调用该通道、`:33` 失败即清空，逻辑与现象一致。

### 判据 3 · tooltip 两档文案 —— **[static] PASS**

```
src/shared/statusbar-model.ts:52-66
  actual     → `当前模型（实际调用）：${name}` / en: `Current model (actual): ${name}`
  configured → `当前模型（配置）：${name}`     / en: `Current model (configured): ${name}`
src/shared/statusbar-model.ts:27-37  executed 非空优先，否则退回 configured
```
实机取到的 title 是「实际调用」档，与文案一致。「配置」档本次未被触发（只有 actual 为空才走该档），按 `[static]` 判，不升 `[live]`。

### 判据 4 · 无回归 —— **[static] PASS**

```
$ grep -c "GENERATION_MODEL_BINDING_INVALID" .runtime/s3-d16-run4.log → 0
$ grep -rn "generation:list'" src/shared/generation-owner-contract.ts:422 → 'generation:list': { args: []; return: MainGenerationRunView[] }
```
错误码只在 `electron/services/main-generation-owner.ts:130` 的严格校验里抛，本次运行日志零命中；`generation:list` 通道契约仍在，调用方（`src/services/workflows/commands/legacy-character-roster-repair.command.ts:240` 等）未改。

### 判据 5 · 实例纪律三项 —— **[live] PASS**

```
instancesThisRun=2（同一次运行内顺序两次起停，见判据 1 时间戳，不并发）
exitCode=0
leftoverElectronProcesses=0
$ tasklist | grep -c electron → 0（grep 命中 0 时自身返回 1，属正常）
```
按 admin 口径：整机重启测试的固有形态就是两个实例顺序执行，不记「多实例违规」。

### 判据 6 · R4 改动面 —— **[static] PASS**

```
$ git rev-parse HEAD → 544dcbd5e048a97a6d46ffacbf8fe4e4b40d4bdd
$ git status --porcelain -- src electron scripts → （空）
$ git diff --numstat 544dcbd5..HEAD -- src electron scripts → （空）
$ git branch --list 'card/s3-d16*' → card/s3-d16-indicator-verify 544dcbd5（零提交）
```
工作头等于 base，无新增生产文件；取证脚本只在 `.runtime/`。

## 3. 观察项（不入判据）

1. **本次 run 以 `failed` 收尾**：`f93b8120-9006-4936-b252-a203bef88cab:failed:d16-actual`，合成流式 SSE 落了两条 `generation_artifacts`（status `partial`）但未走完终态。判据 1／2 的读数**取自该 run 内**，不得表述为「run 正常完成」。
2. **判据 3「配置」档实机未触发**：按 static 文案原文判，未升 live；如需真机覆盖，另立卡。
3. **脚本读数不一致**：回执报 `.runtime/s3-d16-live.mjs` 372 行 / 22,598B / `bdb0eb48…`，现盘 387 行 / 23,713B / `bbf6f51e…`；本判词以现盘为准，请执行方说明是否在回执后改过脚本（不影响本次证据，但影响脚本可复现性）。

## 4. 补证要求（只此一项）

补证内容：实例 2 起后、读状态栏之前，调用一次 `generation:last-model`，把返回 JSON 原文写进 evidence（示例键名 `lastModelIpc`），并贴命令与输出原文。**不必重跑整卡两段、不必改产品代码**；补完只复判判据 2。

## 5. 复判（判据 2，2026-11-22 12:2x）

复判基准：首验判词 `2d6f0451b936200310b1aaec5c2099e50c8e863fafafacf37e075b055cb729b0`（108 行 / 7,384B），即本文件 §0–§4，原样保留；只复判判据 2，其余 5 条沿用首验结论。

新取证材料：
- run `2f0519a8-837`；evidence `.runtime/.cache/s3-d16/2f0519a8-837/evidence.json` **270 行 / 7,323B / `49cac1e41cd0962950e4a3706e85845053273aa7ad19f82f9144ae63a4295913`**
- 报告 `.batch/night/staging/s3-d16-indicator-verify-report.md` **172 行 / 11,349B / `6fd0c42ac58817d7dc38600de55c16543d5961d954c5f8f35dd91b9a0a0e45c1`**（就地更新，新增 §4.4／§6.1）
- 脚本 `.runtime/s3-d16-live.mjs` **441 行 / 26,556B / `149d56832c0ab9266acb677ea39b0fac89048724cf206be2eb084658ee9d43e0`**（前两版 `bbf6f51e…`／387 行、`bdb0eb48…`／372 行作废，差异说明见报告 §6.1）
- 判定面与 R4 复核不变：`git rev-parse HEAD` → `544dcbd5`；`git status --porcelain -- src electron scripts` 空；`git diff --numstat 544dcbd5..HEAD -- src electron scripts` 空。

### 判据 2 · 复判 —— **[live] PASS（四面齐）**

| 面 | 事实源 | 原文 |
|---|---|---|
| 配置 A | `llm:get-default-model` 回读 | `"d16-config"` |
| 实际 B（持久化） | 真实 SQLite `generation_runs.binding_json` → `sourceManifest.modelReceipt` | `{"modelId":"d16-actual","modelName":"gpt-4.1", …，"provider":"openai"}` |
| 实际 B（IPC） | `generation:last-model` 原文（实例 2，重启后、读状态栏前） | `{"at":"2026-11-22T04:23:25.280Z","args":[{"projectId":"234f7b3c-…","projectPath":"…\\d16live-2f05","leaseIdLength":36}],"result":{"modelId":"d16-actual","modelName":"gpt-4.1"}}` |
| 界面 | `.writer-statusbar` 可见文本 / tooltip | `D16 实际模型 B` / `当前模型（实际调用）：D16 实际模型 B` |

四面同源：`d16-actual` ≠ 配置 `d16-config`，A≠B 现场成立；实例 1 首次回填 `result:null`（写入前）、写入后同为 `d16-actual`，方向正确。

我独立读库复核（只读打开，不引用报告）：

```
$ python -c "sqlite3 ro …\p2f0519\d16live-2f05\.ai-novel\project.db"
select run_id,status from generation_runs → ('ec4f3aa7-cb5e-4839-a1c4-fe1f5aec9723','failed')
binding_json→sourceManifest.modelReceipt → {"modelId":"d16-actual","modelName":"gpt-4.1",…}
```

判据 5 的三项读数在新 run 同样成立：`instancesThisRun=2`（`43128` 于 `04:23:24.312Z` 退出 → `63112` 于 `04:23:24.983Z` 起，无重叠）、`exitCode=0`、`leftoverElectronProcesses=0`。

### 观察项（补）

4. 取证 hook 走 `process.mainModule.require('electron')` 取 `ipcMain._invokeHandlers` 包一层记录（渲染层 `window.aiNovelAPI` 为 `Object.isFrozen`，`app.evaluate` 内无 `require`）。`_invokeHandlers` 是 Electron 私有成员，只存在于 `.runtime/` 取证脚本、不入产品码；若后续要长期复用，建议改走公开的 `ipcMain.handle` 包装或主进程侧计数器。
5. 新 run 仍以 `failed` 收尾（`ec4f3aa7-…:failed:d16-actual`，合成 SSE 未走完终态）：判据 1／2 读数**取自该 run 内**，不得表述为「run 正常完成」。
6. 字段路径笔误：派验单判据 2 写 `sourceManifest.modelReceipt.model`，实际结构是 `sourceManifest.modelReceipt.{modelId,modelName}`（无 `model` 子键）；本判词按实际字段核对，建议下一版派验单改正措辞。

### 复判结论

**PASS**。判据 1／2／3／4／5／6 全部通过（判据 1／2／5 为 live，3／4／6 为 static）。判定面 `544dcbd5` 零改码，建议放行 D16 收口。

入库回填（2026-11-22 12:3x）：库内版本 sha 与盘上一致——提交 `9cd24897`（父 `544dcbd5`，`refs/heads/exp/resource-ledger` 已推同 sha），派验单 `f282eb0c2f17637c8253ea3869c58ad84bf610d2c1184f7d1dc07ce72c163cb2`（30 行 / 4,500B）、判词 `df83bc378baa5be9dfdc535dc5888775b557be78cbe657d338ef1a22672ed59f`（149 行 / 11,075B）、交件报告 `6fd0c42ac58817d7dc38600de55c16543d5961d954c5f8f35dd91b9a0a0e45c1`（172 行 / 11,349B）三件在提交面 `git show 9cd24897:<path>` 与盘上 sha256sum 逐字一致、未变；卡分支 `card/s3-d16-indicator-verify` 已回 `544dcbd5`（零提交），`git status --porcelain` 空。

<!-- DONE -->
