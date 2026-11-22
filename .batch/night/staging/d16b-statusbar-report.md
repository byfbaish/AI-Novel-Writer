# D16B 判据 5 实机取证报告（developer）

执行方：developer · AI writer项目组（Architecture / IT Advisor，本卡 apply/live 位）
对象卡面：`.batch/night/cards/d16b-statusbar-default-first.md` v1（49 行 / 4,681B / `594d7691…`），判据按卡面 **§2 的 1–6** 编号
被测代码：参考实现 `961eaa05`（分支 `card/d16b-statusbar-default-first`，父 `fb2c5d6f`，4 文件 +167/−20，未合主线）
判定面 HEAD：`36b29a81`（`exp/mainline-1119`），`git status --porcelain -uall` 空
取证时间：2026-11-22 13:04（Asia/Shanghai）
脚本：`.runtime/s3-d16b-live-c.mjs`（491 行，= `.runtime/s3-d16b-live.mjs` 前 306 行 helper + `.runtime/s3-d16b-tail-v2.mjs`）
证据：`.runtime/.cache/s3-d16/af51f396-e79/evidence.json`

**本件不是 PASS**：PASS 权在 QA。本件只提供判据 5 的 live 证据。

## 1. build 口径（谁跑的这份 dist）

`dist/` 与 `dist-electron/` 是工作区内的构建产物，当前源码树是主线 `36b29a81`（**不含** `961eaa05`）。本卡实机跑的是 12:53 那次构建，其来源用包内标记取证，脚本首步自带断言：

```
[d16] build:marker · [{"file":"App-CCaQMhCA.js","w180":true,"actual":true}]
```

`w180` = 产物含 `max-w-[180px]`（`961eaa05` 才有的宽度改动），`actual` = 产物含并列文案 `（实际 `。主线旧 `StatusBar.tsx:124-132` 仍是 `max-w-[120px]` 且无并列分支，二者足以区分。

残余风险（老实写）：这是**标记级**等价，不是「从 `961eaa05` 重新构建后比对 bundle sha」。如需字节级等价，可另开一步：`git worktree add` 到 `961eaa05` → 建 `node_modules` junction → `npx vite build` → 比对 `dist/assets/App-*.js`。

## 2. 判据 5-①：改默认模型后右下角跟着配置刷新

走真实 UI 路径：点状态栏模型段打开设置页（`StatusBar` 模型段 `onClick={() => openSettings()}`），在设置页模型卡上点「设为默认」，**不 reload**，直接读 `.writer-statusbar`：

```
[d16] statusbar:config-a · {"statusbarText":"任务 日志 模型 D16 配置模型 A","found":true,
  "title":"当前模型（配置）：D16 配置模型 A","label":"D16 配置模型 A", ...}
[d16] settings:click-b · {"ok":true,"buttons":1}
[d16] statusbar:config-b · {"statusbarText":"任务 日志 模型 D16 实际模型 B","found":true,
  "title":"当前模型（配置）：D16 实际模型 B","label":"D16 实际模型 B", ...}
[d16] ui-path · settings-click
```

`uiPath=settings-click` 表示走的是设置页点击，没有退化到 `reload-fallback`。

## 3. 判据 5-②③：实际 ≠ 默认时并列 ＋ tooltip 两段原文同屏

默认 B 跑一次真实生成（合成流式，`physicalModelRequests=0`），`generation_runs.binding_json` 落 `modelReceipt`：

```
[d16] run:done · ["f5be81b6-ec4b-4d3b-a0fd-cf94956236fd:failed:d16-actual"]
[d16] binding:model · {"runId":"f5be81b6-…","status":"failed","modelId":"d16-actual",
  "modelName":"gpt-4.1","operation":"chapter-draft","createdAtMs":1795323870605}
```

再把默认改回 A（同一条设置页路径，不 reload）：

```
[d16] statusbar:mixed · {"statusbarText":"任务 日志 模型 D16 配置模型 A（实际 D16 实际模型 B）","found":true,
  "title":"当前模型（配置）：D16 配置模型 A ｜ 实际调用：D16 实际模型 B",
  "label":"D16 配置模型 A（实际 D16 实际模型 B）",
  "allTitles":["收起任务","打开日志","打开模型","当前模型（配置）：D16 配置模型 A ｜ 实际调用：D16 实际模型 B"]}
```

可见文本 `D16 配置模型 A（实际 D16 实际模型 B）` 与 tooltip `当前模型（配置）：D16 配置模型 A ｜ 实际调用：D16 实际模型 B` 同屏、同一次读取里取到（判据 5③）。并列模板出自 `src/shared/statusbar-model.ts:76-83`，tooltip 出自 `statusbarModelTitle` 的 `both` 分支。

## 4. 判据 5-④：实例纪律四项

| 项 | 值 | 来源 |
|---|---|---|
| `instancesThisRun` | 1 | evidence.json |
| `exitCode` | 0 | 进程退出码 |
| `leftoverElectronProcesses` | 0 | 收尾后按 pid 树清点 |
| `tasklist` electron 行数 | 0 | `tasklist //FI "IMAGENAME eq electron.exe" \| grep -c electron.exe` |

运行前后各测一次：开跑前 0，跑完 0；`pids` 只一条 `{"index":1,"pid":63628}`。合成调用读数：`chatCalls=2`、`embeddings=1`、`intercepted=[]`（无出网请求）。

## 5. 未覆盖与边界（不粉饰）

1. 本次 run 终态是 `failed`（合成流式的结束方式不做完稿收尾），`modelReceipt` 仍写入 `d16-actual`/`gpt-4.1`，足以判「实际调用 ≠ 默认」。run 失败原因不在本卡判据内，未排查；若要查，另开卡。
2. 实机只跑了 1 个实例（单实例串跑，无整机重启）；本卡判据 5 未要求重启，D16 旧卡的整机重启口径不在本卡。
3. 截图未留：本件证据是 DOM 原文（`statusbarText`／`title`／`label`／`allTitles`）+ evidence.json，未出 PNG。卡面 §5 写「含 live 截图/DOM 原文」，本件按 DOM 原文交付；要图我再补。
4. 判据 1/2/3/4/6 是 QA/负责人的面，本件不重复判定。

## 6. 观察项（不进判定，建议单开卡）

1. `resolveStatusbarModel` / `statusbarModelCopy` 已无生产调用者（`StatusBar.tsx` 只调新 API），旧单测仍在跑 —— 死代码，建议清理卡。
2. `statusbar-model.ts:75` `same` 用**显示名**判等，不是 model id：两个不同配置若取了同一个昵称，会静默合并成一次显示。属既有设计，本卡不拦。
3. `max-w-[180px]` + `truncate`：极长昵称下可见文本会截断，完整信息只在 tooltip。本卡判据只要求三段同屏，未要求全宽可见。

<!-- DONE -->
