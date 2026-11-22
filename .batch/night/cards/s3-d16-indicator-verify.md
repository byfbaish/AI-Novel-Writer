# CARD-S3-D16 · 模型指示器补验两条缺口（整机重启 / 配置A·实际B）

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`5a285e83`**
顺序：**S3 第三张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡、`docs/handoffs/2026-11-11-night-evidence/d16-impl-verify.md`。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：本卡**以补验为主**，默认零改码；实机复验不外派；证据只认命令与输出原文。

## 1. 现状（读于 `5a285e83`；表行 `:78`、正文 `:972-975`）

- 表行：**✅ 已实施（2026-11-11）**，缺陷销账——`viewOf` 从持久化 binding 的 `sourceManifest.modelReceipt` 投影 `model{modelId,modelName}`；新增轻量通道 `generation:last-model` 供启动期回填；状态栏显示名按 `modelId` 反查昵称、兜底 `modelName`、再兜底 `modelId`。
- **但两处实机缺口未被验证**（原文照抄该行）：①`reload()` 只重建渲染进程、**不等于整机重启**，判据字面的「重启后」未验；②「配置 A / 实际 B ⇒ 显示 B」因该项目最近一条 run 恰好是 A（12:51 cancelled）**未直接观察到**——显示 A 是正确行为、与配置值相同，区分不出读实际还是读配置。
- 历史判定保留：主进程 `model:` 字段 vs 界面状态栏，见实施记录 §9。

## 2. 要证的事（两条，缺一条不算过）

1. **整机重启后仍显示实际模型**：不是 `reload()`，是关掉应用进程再起（同一 user-data-dir、同一项目）。
2. **配置 A / 实际 B ⇒ 界面显示 B**：先让实际调用为 B（可用合成响应或可用模型切换），界面状态栏与 tooltip 都指向 B；**必须构造出 A≠B 的现场**，不接受「A 恰好等于实际」。

## 3. 白名单与禁改区

- 本卡默认**零改码**：不改 `src/`、`electron/` 生产文件，不改既有单测。
- 取证脚本放 `.runtime/`（不入库）；确需入库须先报我裁。
- 若复验失败（显示配置值 / 重启后回退）⇒ **停手贴原文**，不许当场改码修它。
- 禁碰：`generation:list` 载荷形态、`modelReceipt` 写入链路、"项目未获授权"闸门（不许绕过）。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. 整机重启：贴进程起止（PID 或起停时间戳）+ 重启前/后状态栏快照或可见文本原文，值等于实际调用模型。
2. 构造 A≠B：贴配置值 A、主进程日志实际 `model:` B、界面显示 B 三处原文同屏。
3. tooltip 两档（实际调用 / 配置）在 B≠A 时文案原文正确。
4. 无回归：`GENERATION_MODEL_BINDING_INVALID` 未出现；`generation:list` 仍可用。
5. 实例纪律三项：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）。

## 5. 外派位

- **静态活可外派**：读码确认「配置值 A 从哪读、实际 B 从哪进界面、整机重启与 reload 的差别」并给操作步骤；产物只登记。
- **不可外派：实机复验须在 `develop` 由 developer 执行。**

## 6. 回执与交付

- 分支：`card/s3-d16-indicator-verify`，从 `5a285e83` 起；**分支上零提交**（零改码），取证脚本留 `.runtime/`。
- 交件：报告 `.batch/night/staging/s3-d16-indicator-verify-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。

## 7. 实例纪律

单实例复用、跑完必关；整机重启也按「一次一个实例」计时，重启后再起第二实例属同一轮允许的一次起停，须在 evidence 记清两次 PID。

## 8. R4 判据（作用域写死）

判据二段，缺一不可：

1) `git diff --numstat 5a285e83..card/s3-d16-indicator-verify -- src electron scripts` 输出为空（无改动、无新增）。
2) **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下的文件；若本卡白名单允许新增（仅验收/取证脚本），须逐条列出路径并在判词中标注「白名单内新增」。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。
