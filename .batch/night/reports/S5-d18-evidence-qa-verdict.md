# S5 · D18 evidence 单判据复判（QA）

- 判词对象：`wt-d18` @ `7b48f074`（分支 `card/s5-d18-hook-unplanted`）
- evidence：`wt-d18/.runtime/.cache/s5/a59a522b-260/evidence.json`｜105 行｜4,388B｜`4e6e3982b547b9e8c79efbca799c4d2b93b438b0c47d33e8d85da3aa1effb61d`
- 派单口径：只判一条 `open-write-dialog=true` 能否作数；不扩大判据、不重跑、不重新取证
- 判定时刻：2026-11-22 23:0x（Asia/Shanghai）
- **结论：作数（PASS，限定判据范围）**

## 一、判据成立

`checks.openWriteDialog = {clicked:"写作第6章", dialogVisible:true}`（`evidence.json:79-82`，`clicked` 在 `:80`、`dialogVisible` 在 `:82`）；对应 `stepLog` 项 `open-write-dialog`（`:35-38`，detail 在 `:37`）与 `start-writing`（`:39-43`，detail `true` 在 `:42`）。写作入口对话框确实打开、并已点下开始写作。

## 二、四项必备证据（缺一项即作废）逐条核

| 项 | 派单要求 | 盘上实读（行号为 evidence.json 行号） | 判 |
|---|---|---|---|
| 路径与指纹 | 路径存在、行数/字节/sha | `test -f` → EXISTS；`wc -lc` → `105 4388`；`sha256sum` → `4e6e3982…b61d`，与派单值逐字相同 | ✅ |
| 实例数 | `instancesThisRun=1` | `:10` `"instancesThisRun": 1` | ✅ |
| 退出码 | `exitCode=0` | `:11` `"exitCode": 0` | ✅ |
| 残留进程 | `leftoverElectronProcesses=0` ＋ `tasklist` 命令原文与输出 | `:12` `"leftoverElectronProcesses": 0`；`:13` `tasklistElectronRaw = "INFO: No tasks are running which match the specified criteria."`；`:14` 计数原文 `"0"` | ✅ |

实机树绝对路径与 sha 原文：`:8` `"tree": "C:\\develop\\workspace\\AI-writer\\wt-d18"`；`:9` `"treeHead": "7b48f074"`；仓内实读 `git -C wt-d18 rev-parse --short HEAD` → `7b48f074`、分支 `card/s5-d18-hook-unplanted`，与 evidence 一致。

## 三、必须写明的无效项（不得引为证据）

- `chatCalls=0`（`:98`）、`promptChars=0`（`:93`）；`physicalModelRequests=0`（`:101`）；`d5` 步 detail（`:67`）同值。
- 第 6 章草稿始终未生成：`stepLog:draft-ready`（`:45-48`，detail 在 `:47`）`drafts` 仅第 1–5 章 finalized 夹具（各 len 309）、`finalizeReady:false`。
- 故 **D18-3/4 与 D5-3 本轮取证无效**，不得作为任何判据、缺陷稿状态或看板变更的证据引用。

## 四、限定与观察（不扣分、不改判）

1. 写作按钮出现依赖前置夹具：`stepLog:seed`（`:20-24`）明载先 seed 第 1–5 章 `status=finalized` 才渲染「写作第6章」。故本读数只证明「在已有 1–5 章定稿连续序列的项目上，第 6 章写作入口可开」，不外推到空项目或断号序列。
2. 四项读数均由同一取证脚本自记，无外部旁证（按派单不重跑、不扩取证），本判词只证「该脚本本轮运行记录如此」，不独立证明单实例。
3. `stepLog:arch-generate`（`:55-58`）`generateOpened:false`、`generateStarted:false` → 走 fallback（`:60`）；末屏「单元定位失败：未读到 `.ai-novel/partial_arch.json`」属环境前置缺口，不在本判据内。

## 五、纪律与现场

- 未重跑、未重新取证、未扩判据；未动 develop：`git log -1` = `79c1bbb7`、分支 `exp/mainline-1119`、`git status --porcelain -uall` 仅本判词一行 `??`。
- 本判词为新增件（`??`），不自行 add，交 admin 决定是否入库。

<!-- DONE -->

## 六、取证副本（admin 补记，11-22 23:1x）

按取证模板第三行新规，本判词入库同笔提交携带 evidence 副本，供日后复核：

- 原件：`wt-d18/.runtime/.cache/s5/a59a522b-260/evidence.json`｜105 行｜4,388B｜sha256 `4e6e3982b547b9e8c79efbca799c4d2b93b438b0c47d33e8d85da3aa1effb61d`
- 副本：`.batch/night/staging/s5-d18-evidence.json`｜sha256 同值（拷贝后实测一致）
