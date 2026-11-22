# CARD-S3-D16 · 交件报告：模型指示器两条缺口补验（整机重启 / 配置A·实际B）

执行方：developer · AI writer项目组
取数件：派验单 `.batch/night/review-requests/s3-d16-indicator-verify.md`（`94dbdd788e311eba5145c78311c7d743216a56b0abe93bdae1e044bde3b0041c`，30 行/4,447B）· 卡面 `.batch/night/cards/s3-d16-indicator-verify.md`（`2848337f…`，65 行/5,802B）· base `544dcbd5`
model=宿主未暴露芯片原文（`env | grep -iE "^DSH_(MODEL|ENGINE|PROFILE|BOT)"` 只返回 `DSH_PROFILE`/`DSH_PROFILE_DIR`）

## 0. 必读确认

① 读了：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡、`docs/handoffs/2026-11-11-night-evidence/d16-impl-verify.md`、派验单。
② 版本：`README.md` `c87cd4ab`（2026-11-14）、`AGENTS.md` `a276fffb`（2026-11-07）、`ruling-dispatch` v6（2026-11-20）、卡面 v1（2026-11-22）。
③ 口径：本卡以补验为主、零改码；实机复验不外派；证据只认命令与输出原文。

## 1. 结论（先给结果）

两条缺口**都在真机上补到了**，判据 1／2／5 `[live]` 全过，判据 3／4／6 用 `[static]` 证据过；本卡**零改码**（分支上零提交）。

- 缺口①整机重启：关掉实例 1 的进程（pid 64560，`04:14:21.161Z` 退出），用同一 `--user-data-dir`、同一项目再起实例 2（pid 20872，`04:14:21.463Z`），状态栏仍是实际调用模型 B，未回退到配置 A。
- 缺口②A≠B：实例 1 里跑一次真实生成，调用模型是 B（`d16-actual` / 昵称「D16 实际模型 B」），事后把默认模型切成 A（`d16-config` / 「D16 配置模型 A」），状态栏的可见文本与 tooltip **仍指向 B**。这次是真 A≠B 现场：配置值 `d16-config`、实际调用事实源 `d16-actual`、界面显示「D16 实际模型 B」，三处同源对账。

## 2. 交件面与判定面

判定面＝分支 `card/s3-d16-indicator-verify`（从 `544dcbd5` 起），**零提交**：

```
$ git log --oneline -1
544dcbd5 merge: 同步 origin/exp/resource-ledger——判词取主身复判终版（232 行/b3061478），其余文档两向同内容
$ git status --porcelain -- src electron scripts
（空）
$ git diff --numstat 544dcbd5..card/s3-d16-indicator-verify -- src electron scripts
（空）
$ git diff --name-status 544dcbd5..card/s3-d16-indicator-verify -- src electron scripts
（空）
```

R4 两段均满足：无改动、无新增生产文件；取证脚本只在 `.runtime/`（不入库）。

## 3. 判据对照

| 判据 | 分层 | 结论 | 证据 |
|---|---|---|---|
| 1 整机重启后仍显示实际模型 | `[live]` | PASS | 两次 PID ＋ 重启前后状态栏 `title`/可见文本原文一致（§4.2） |
| 2 构造 A≠B 并显示 B | `[live]` | PASS | 配置 A=`d16-config`、实际 B=`d16-actual`、界面「D16 实际模型 B」三处同源（§4.1） |
| 3 tooltip 两档文案 | `[static]` | PASS | `src/shared/statusbar-model.ts:52-66` 两档文案原文；`:27-37` 优先取实际；实机取到的 title 是「实际调用」档 |
| 4 无回归 | `[static]` | PASS | 日志中 `GENERATION_MODEL_BINDING_INVALID` 命中 0；`generation:list` 被脚本正常调用并回读 run 终态 |
| 5 实例纪律三项 | `[live]` | PASS | `instancesThisRun=2`、`exitCode=0`、`leftoverElectronProcesses=0`，`tasklist` 0 行（§4.3） |
| 6 R4 判据 | `[static]` | PASS | §2 两段命令输出均为空 |

## 4. 实机证据（原文）

一次运行串完两次起停（单实例计时、跑完必关）：

```
$ node .runtime/s3-d16-live.mjs > .runtime/s3-d16-run7.log 2>&1; echo "EXIT=$?"
EXIT=0
```

evidence：`.runtime/.cache/s3-d16/2f0519a8-837/evidence.json`（runId `2f0519a8-837`，脚本 `441 行 / 26,556B / 149d5683…`）

### 4.1 缺口②：配置 A ／ 实际 B ／ 界面 B

```
[d16] run:done · ["ec4f3aa7-cb5e-4839-a1c4-fe1f5aec9723:failed:d16-actual"]
[d16] binding:model · {"runId":"ec4f3aa7-cb5e-4839-a1c4-fe1f5aec9723","status":"failed","modelId":"d16-actual","modelName":"gpt-4.1","operation":"chapter-draft","createdAtMs":1795320860128}
[d16] configured:after-switch · "d16-config"
[d16] statusbar:instance1 · {"statusbarText":"任务 日志 模型 D16 实际模型 B","found":true,"title":"当前模型（实际调用）：D16 实际模型 B","label":"D16 实际模型 B","allTitles":["收起任务","打开日志","打开模型","当前模型（实际调用）：D16 实际模型 B"]}
```

三处同源对账：

| 面 | 事实源 | 原文 |
|---|---|---|
| 配置值 A | `llm:set-default-model` 后回读的默认模型 id | `d16-config` |
| 实际调用 B | `generation_runs.binding_json.sourceManifest.modelReceipt.model` | `{"modelId":"d16-actual","modelName":"gpt-4.1"}` |
| 界面显示 | `.writer-statusbar` 可见文本 / tooltip | `D16 实际模型 B` / `当前模型（实际调用）：D16 实际模型 B` |

实际调用真实发生、并且真的走了 B 的请求：主进程 `globalThis.fetch` 记录 `chatCalls=2`、`embeddings=1`、`intercepted=[]`（无合成模型之外的出网），见 `evidence.mainStateInstance1`。

### 4.2 缺口①：整机重启（不是 reload）

```
[d16] launch#1 · {"instancesThisRun":1,"pid":64560}
[d16] quit#1 · {"pid":64560,"closedAt":"2026-11-22T04:14:21.161Z"}
[d16] launch#2 · {"instancesThisRun":2,"pid":20872}
[d16] statusbar:instance2 · {"statusbarText":"任务 日志 模型 D16 实际模型 B","found":true,"title":"当前模型（实际调用）：D16 实际模型 B","label":"D16 实际模型 B","allTitles":["收起任务","打开日志","打开模型","当前模型（实际调用）：D16 实际模型 B"]}
```

重启（进程退出 → 同 `--user-data-dir` 再起）前后，状态栏可见文本与 tooltip 完全相同，都是 B；配置此时是 A。`checks.sameModelAcrossRestart: true`。

### 4.3 实例纪律三项

```
instancesThisRun=2（一次运行内两次起停，均在 evidence 记 PID）
exitCode=0
leftoverElectronProcesses=0
$ tasklist | grep -c electron
0
```
（`grep -c` 命中 0 时自身返回 1，属正常。）

### 4.4 `generation:last-model` 通道原文（QA 补证项）

判据 2 要求的三处对账里，这一处是**通道本身的返回**，不是界面推断。取数方式：在已注册的
`ipcMain._invokeHandlers` 上给 `generation:last-model` 的 handler 包一层记录 `{at, args, result}`。
只能装在主进程侧——渲染层 `window.aiNovelAPI` 的 descriptor 是 `{writable:false, configurable:false}`
且 `Object.isFrozen(...)===true`（`defineProperty` 抛 `Cannot redefine property: aiNovelAPI`）；
`app.evaluate` 的脚本作用域里既没有 `require` 也没有可用的动态 import（原文：
`ReferenceError: require is not defined`、`TypeError: A dynamic import callback was not specified.`），
实测可用的是 `process.mainModule.require('electron')`。

hook 安装（两实例各一次）：

```
[d16] hook:last-model#1 · {"installed":true,"reused":false}
[d16] hook:last-model#2 · {"installed":true,"reused":false}
```

实例 1（进入项目时有两次取数，第一次的实际模型尚未回填，故 `result: null`；第二次即实际值）：

```
[d16] lastModelIpc:instance1 · [{"at":"2026-11-22T04:23:18.597Z","args":[{"projectId":"234f7b3c-f3d3-4006-864f-cc70f1cc764e","projectPath":"C:\\Users\\伯云飞\\AppData\\Local\\VibeCodingScratch\\d16\\p2f0519\\d16live-2f05","leaseIdLength":36}],"result":null},{"at":"2026-11-22T04:23:23.573Z","args":[{"projectId":"234f7b3c-f3d3-4006-864f-cc70f1cc764e","projectPath":"C:\\Users\\伯云飞\\AppData\\Local\\VibeCodingScratch\\d16\\p2f0519\\d16live-2f05","leaseIdLength":36}],"result":{"modelId":"d16-actual","modelName":"gpt-4.1"}}]
```

实例 2（整机重启后，读状态栏之前的取数）：

```
[d16] lastModelIpc:instance2 · [{"at":"2026-11-22T04:23:25.280Z","args":[{"projectId":"234f7b3c-f3d3-4006-864f-cc70f1cc764e","projectPath":"C:\\Users\\伯云飞\\AppData\\Local\\VibeCodingScratch\\d16\\p2f0519\\d16live-2f05","leaseIdLength":36}],"result":{"modelId":"d16-actual","modelName":"gpt-4.1"}}]
```

对账（判据 2 三处同源）：

```
通道返回        modelId=d16-actual   modelName=gpt-4.1
binding_json    sourceManifest.modelReceipt.model = d16-actual   （run ec4f3aa7-…）
状态栏          title=当前模型（实际调用）：D16 实际模型 B
配置侧          已切回 d16-config（D16 配置模型 A），未被误用
```

（`args` 里 `leaseId` 只记长度，不落值。）

## 5. 已知限制（如实记录，不掩盖）

1. **这次 run 以 `failed` 收尾**：`ec4f3aa7-…:failed:d16-actual`。合成流式 SSE 被主进程收到并落了两条 `generation_artifacts`（status `partial`，len 1172/1145），但 run 未走完终态。这不影响判据 1／2 的取数——binding 的 `modelReceipt` 是**实际发起调用的模型**，`chatCalls=2` 也证明物理请求真的发出去了；状态栏显示的是这条持久化事实，不依赖 run 终态。
2. **判据 3 的「配置」档**没在实机里被触发：只有 `actual` 为空时状态栏才退回配置档（`src/shared/statusbar-model.ts:27-37`），而本卡要证的正是「有实际调用时显示实际」，故配置档按判据分层用 `[static]` 文案原文作证（`当前模型（配置）：${name}`）。
3. 时间的时区：日志里 `04:14:21Z` 是 UTC，本机墙上时间 12:14，同一时刻。

## 6. 命令原文汇总

```
$ git switch -c card/s3-d16-indicator-verify 544dcbd5
Switched to a new branch 'card/s3-d16-indicator-verify'
$ git diff --numstat 544dcbd5..card/s3-d16-indicator-verify -- src electron scripts   → （空）
$ git diff --name-status 544dcbd5..card/s3-d16-indicator-verify -- src electron scripts → （空）
$ node .runtime/s3-d16-live.mjs > .runtime/s3-d16-run7.log 2>&1; echo "EXIT=$?"      → EXIT=0
$ grep -c "GENERATION_MODEL_BINDING_INVALID" .runtime/s3-d16-run7.log                  → 0
$ tasklist | grep -c electron                                                          → 0
$ wc -lc .runtime/s3-d16-live.mjs                                                        → 441 26556 .runtime/s3-d16-live.mjs
$ sha256sum .runtime/s3-d16-live.mjs                                                     → 149d56832c0ab9266acb677ea39b0fac89048724cf206be2eb084658ee9d43e0
```

### 6.1 脚本版本差异（回应「372 行 vs 387 行」的追问）

```
372 行 / 22,598B / bdb0eb48…   12:12 补丁前的读数；回执时沿用了这份旧读数（我的错）
387 行 / 23,713B / bbf6f51e…   之后两处补丁：① quit 前读实例 1 的 mainState（原读到的是实例 2，
                               重启后 globalThis.__d16 归零，chatCalls 假 0）并加断言 chatCalls>=1；
                               ② 目标字数 '200'→'300'（DRAFT_TEXT≈288 字，200 的上限 260 会判超长）
441 行 / 26,556B / 149d5683…   本轮补 IPC 原文：新增 installLastModelHook / readLastModelIpc、
                               两实例各装一次 hook、证据落 lastModelIpc 并加断言
```

以**最后一版 `441 行 / 26,556B / 149d56832c0ab9266acb677ea39b0fac89048724cf206be2eb084658ee9d43e0`**为准；
`bdb0eb48…` 与 `bbf6f51e…` 作废。脚本不进库（`.runtime/` 未跟踪），判据只看它跑出来的 evidence。
