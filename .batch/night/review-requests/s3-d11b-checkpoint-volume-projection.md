# 派验单 · CARD-S3-D11b（去重键的卷号与定稿态改读检查点）— v3

From: 项目总负责人 · AI writer项目组
To: QA（首验）／主身（入库）
执行方：developer（实施＋live 取证；判据 1/2/3/4 需实机）
判定面：**卡分支 HEAD ＋ 实施前 `788b84fd`**（`card/s3-d11b-checkpoint-volume-projection` 的提交头；实施后以卡分支 HEAD 为准，须在交件报告贴 `git rev-parse` 原文）
base：**`788b84fd`**（卡面入库提交；分支自它起，判定面与 R4 起点一致）
工作目录：`C:\develop\workspace\AI-writer\develop`

## 一、分母（三处）

1. 卡面 `.batch/night/cards/s3-d11b-checkpoint-volume-projection.md` —— 以入库提交 **`788b84fd`** 内的 blob 为准（**规矩：分母一律写 commit 库内 blob 的行／字节／sha，工作副本 CRLF 版不作分母**）：**113 行 / 11,299B / `c6a95633500fae6efb3ccf6dc445b87885f54c1a5dd5854cc90b8ed06da829a6`**（`git cat-file -s` 11,299、`git show 788b84fd:<路径> | sha256sum` 原文；
   注：盘上工作副本是 CRLF 版 113 行 / 11,412B / `ef8e7cd9…`，与库内逐行相同，**作分母用库内那份**）；
2. 本件 — 取报出时现算（不自引，避免循环）；
3. 交件报告 `.batch/night/staging/s3-d11b-report.md` — 实施后由 developer 出，出后报行数/字节/sha。

判据文字以卡面 §4（六条）为准；本单只落分层、取证命令与判定面，不改判据。

## 二、判据分层与取证

1. `[live]` 同卷 `incomplete=true` 连三批（真实编辑器保存）⇒ **0 次**提示；把检查点翻成 `false` 后再保存 ⇒ **1 次**提示。
2. `[live]` 跨两卷各一次：卷 1 关闭写 `v1:final`；进卷 2 必须再提示 1 次并写 `v2:final`（贴两个 `volumeIndex`）。
3. `[live]` 未连写项目不再恒 `vn:final`：链为 `null` 但检查点有卷号 ⇒ 指纹 `v<卷号>:...`；且 `incomplete=true` 时 0 次提示。
   > 观测点口径（卡面 §4 判据 3 子项，照抄）：`incomplete=true` 期间 0 次提示、localStorage 无可读记录，故「指纹是 `v<卷号>`」只能由翻转后的那一次观测证明：翻成 `false` 后关闭一次，读 localStorage 的 `v<卷号>:final` 作指纹证据；**不得用 0 次提示那一侧的数据充当指纹证据**。

   即：判据 3 的指纹取样＝**同 run 内翻 `false` 后关闭写入的 `v<卷号>:final`**；与判据 1 同一次跑里连着看。
4. `[live]` 重启后卷号不丢：顺序两次启动（每次 `app.quit`、`leftover=0`），指纹仍 `v<卷号>:...` 不退回 `vn`，贴重启前后两次指纹原文。
5. `[static]` 两条 grep，各自单文件/两文件、都不许全仓扫（卡面 §1 自身就有这两串，全仓必假红）：
   ```
   grep -n "chain?.volumeIndex\|chain?.status === 'running'" src/App.tsx src/components/editor/ArchFileViewer.tsx
   ```
   期望 **0 命中**；以及判定函数内必须出现 `synopsisIncomplete` 门：
   ```
   grep -n "synopsisIncomplete" src/services/architecture-character-nudge.ts
   ```
   不按行号判（插一行后 `:150` 顺延成 `:151`，照字面判不出来）。改为取三行原文、**按内容相邻判**：

   ```
   grep -n "synopsisIncomplete\|!hasOutlineContent\|dismissedVersion !==" src/services/architecture-character-nudge.ts
   ```

   必须构成**相邻顺序**：`!hasOutlineContent` → `synopsisIncomplete` → `dismissedVersion !==`；且 `synopsisIncomplete` 那一行是 `if (input.volume.synopsisIncomplete) return false`。门在不在，这条说了算。
6. `[static]` `src/services/__tests__/architecture-character-nudge.test.ts` 整文件汇总行＋末行 `EXIT=`；`check:fast` 末行 `EXIT=0`；写盘格式 `v<卷号>:<状态>` 一字不改。

`[live]` 四条按 `collab-rules-v1.md` §8 第 62 行取样口径：`sampleCount ≥ 2` 与取样时刻写进 evidence；每条各带 `triggerMode`（`ui-save`／`db-flip`），库造处逐条注「库造，非链路」。

> 判据 4 的「重启」取证口径（admin 11-22 裁，照抄卡面）：允许**顺序两次启动**（每次跑完 `app.quit`、`leftover=0`），仍禁并行；evidence 记 `instancesThisRun=2`、两次 `exitCode=0`、结束 `leftoverElectronProcesses=0`，并贴重启前后两次指纹原文。

实例三项＋`tasklist | grep -c electron` 的**命令原文**须写进 evidence.json。

## 三、R4（作用域写死）

1) `git diff --numstat 788b84fd..HEAD -- src electron scripts` 只允许出现卡面 §3 白名单内的四类路径；
2) **无新增生产文件**：单测文件属白名单第 4 类须逐条列出；`git status --porcelain -uall -- src electron scripts` 原文一并贴。

## 四、外派位

**本卡不外派，理由原句：改的是两个 UI 投影点，需实机 live。**

## 五、交付与回执

- 交件报告：`.batch/night/staging/s3-d11b-report.md`（六条判据逐条贴证据与命令原文；判据 3 按上面的指纹取样口径写）；
- 判词：`.batch/night/reports/s3-d11b-qa-firstcheck.md`，由 QA 出；
- 回执走 `.batch/night/bridge/to-owner`；
- 实施方不 commit 到主线、不 push；入库与 push 只由主身做；
- 一次一张：D11b 之外不得并行改码；若改法需动白名单外文件，**停手报**，不许自扩；
- **本细化（判据 5 的相邻顺序判法）不改卡面判据 5 原句，QA 按本件判。**

## 六、必读确认（开工件三行）

① 读：仓库根 `README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-*.md` 最新一版、卡面（`788b84fd` 内那份）与本单；
② 版本/日期：卡面入库 `788b84fd`（2026-11-22），base `788b84fd`；
③ 据此遵守三条：判据以卡面 §4 六条为准；白名单不扩、越界停手报；push 只由主身做。
