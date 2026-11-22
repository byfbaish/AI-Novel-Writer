# 卡面草案 · CARD-S3-D11b（去重键的卷号与定稿态改读检查点）

状态：**已入库（11-22 18:5x，项目总负责人出；admin 已逐条核过五处实质，见 §9）——未投实施。**
From: 项目总负责人 · AI writer项目组
To: 大肥鱼（admin，核草案）／主身（入库）
起点：**`14401f4b`**（D11 三件入库后的主线头；草案初稿读于 `aeba1882`）
工作目录：`C:\develop\workspace\AI-writer\develop`
预计生效分支：`card/s3-d11b-checkpoint-volume-projection`
改动面预估（非实测，仅供估量）：`src/App.tsx` 约 +8/−3、`src/components/editor/ArchFileViewer.tsx`（`ArchFileViewerSession` 内）约 +18/−5、`src/services/architecture-character-nudge.ts` 约 +1/−0、单测约 +30/−0，合计约 `+57 −8`。

## 0. 本轮授权

可改码（限 §3 白名单四类）、可提交（限卡分支）、**不可 push**；入库与 push 只由主身做。开工前写一句本轮授权，未明说不做善意推断。

## 1. 现状（读于 `aeba1882`，11-22 以 `14401f4b` 复读，内容无变化）

D11 的去重键按卷，但两个投影点取错了来源：卷号取自内存链 `useSynopsisUnitChainStore` 的 `volumeIndex`，定稿态取 `chain?.status === 'running'`。链只在内存里（`src/stores/synopsis-unit-chain-store.ts:3-7`，`volumeIndex` 仅由 UI `start()` 写入、不持久化），因此：

- 未连写过的项目链为 `null` ⇒ 指纹恒为 `vn:final`，逐批写大纲也会立刻按「定稿」提示；
- 没有链时各卷共用 `vn` ⇒ 跨卷「各一次」不成立；
- 重启后链失忆、卷号丢失，指纹退回 `vn`。

而卷号其实在检查点里：`src/services/workflows/synopsis-unit-launch.ts:308` `const explicitCursor = checkpoint.synopsis_unit_cursor ?? null`——两个投影点都没用它。

**另有一处缺失的判定门**：`src/services/architecture-character-nudge.ts:148` `globallyDisabled` → `:149` `!hasOutlineContent` → `:150` 直接比对指纹，**中间没有 `synopsisIncomplete` 判断**，所以 `incomplete=true`（大纲还没定稿）时也会提示一次。

## 2. 改法（既定，不许自行发挥）

1. `volumeIndex` 改读检查点 `partial_arch.json` 的 `synopsis_unit_cursor.volumeIndex`，**必须走 `src/services/workflows/synopsis-unit-launch.ts:308` 同一条读取路径／同源读取函数**（即 `readSynopsisUnitCheckpoint(projectSession)`），不许自己另写一套读文件逻辑。
2. `synopsisIncomplete` 改读检查点 `synopsis_incomplete`，**不回退 `chain.status`**（`=== true` 即未定稿；缺失按 `false`）。
3. 内存链 store 不持久化（`src/stores/synopsis-unit-chain-store.ts:3-7` 语义不动），链只用于显示进度。
4. 两处投影点改后形状（示意，不改语义）：
   - `src/App.tsx:333-338`：`const checkpoint = await readSynopsisUnitCheckpoint(projectSession)`；`outlineNudgeVolumeIdentity({ volumeIndex: checkpoint.synopsis_unit_cursor?.volumeIndex ?? null, synopsisIncomplete: checkpoint.synopsis_incomplete === true })`。该调用点本就在 `async` 流程内、已持有 `projectSession`，无需新增 IPC。
   - `src/components/editor/ArchFileViewer.tsx:344-347`：**该投影点在内层组件 `ArchFileViewerSession` 里**（定义于 `:128-134`），不是外层 `ArchFileViewer`。该组件 `:138` 已有 `const currentProject = useProjectStore(s => s.currentProject)`，改法按 `:163-185` 那段现成范式写死：`captureProjectSession(currentProject)` → `isProjectSessionPath(session, projectKey)` → `disposed` 标志 ＋ `isProjectSessionCurrent(session)` 守卫，成功后 `setState`；`useMemo` 依赖改挂该 state；不得在渲染期直接发 IPC，**不许去 props 里找 session**（会撞白名单）。
5. **判定侧加门（原文照抄主身口径）**：

   > 在 `src/services/architecture-character-nudge.ts:149` 之后、`:150` 的 `return` 之前插入：
   > `if (input.volume.synopsisIncomplete) return false;`
   > 理由：现判定只有三道门（`:148` `globallyDisabled`、`:149` `!hasOutlineContent`、`:150` 指纹比对），`synopsis_incomplete=true` 时照样提示一次，与「仅在定稿后才提示」相反。

### 2.1 行号写死（实施按这些锚点，别只认函数名）

- `readSynopsisUnitCheckpoint(projectSession)` —— `src/services/workflows/synopsis-unit-launch.ts:186`；
- 其内部走 `:164` `readSynopsisUnitCheckpointWithStatus(...)`，在 `:171` 调 `ipc.invokeWithProjectSession(..., 'fs:read-json', synopsisUnitCheckpointPath(projectSession.projectPath), ...)`；
- 检查点路径由 `:148` `synopsisUnitCheckpointPath(projectPath)` 给出；
- 卷号取值锚点 `:308`（`checkpoint.synopsis_unit_cursor`）；
- 判定门落点：`src/services/architecture-character-nudge.ts:149`／`:150` 之间（新增一行）。

### 2.2 判定时序（写死，否则缺陷原样复现）

1. 横幅判定**不在渲染期**：`src/components/editor/ArchFileViewer.tsx:359-367` 的 `useEffect` 调 `shouldNudgeOutlineCharacterSupplement(...)`，`nudgeVolume` 由 `:344-347` 喂进来。故顺序必须是：先取检查点投影到 state → 该 effect 依赖这个 state → 再判定。
2. **必须加「检查点未就绪」态**：检查点尚未读回时 `setOutlineCharacterNudge(false)` 且**不写任何 dismiss**，不得以 `vn:final` 作初值判定。否则初值退化成 `vn:final`，判据 3 的 0 次会因竞态时红时绿。
3. `src/App.tsx:333-338` 的 `await readSynopsisUnitCheckpoint(...)` **之后要补一次 `isCurrentProjectSession()` 守卫**（该文件 `:317`／`:322`／`:329` 已有先例），否则切换项目后会拿旧项目的卷号写 dismiss 指纹。

## 3. 白名单（四类，不许扩）

1. `src/App.tsx:333-338`；
2. `src/components/editor/ArchFileViewer.tsx`——仅限内层组件 `ArchFileViewerSession` 里该投影点的读取改造（`useMemo` 改 state ＋ 未就绪态 ＋ 必要的 `useState`／`useEffect` 声明与依赖；范式抄 `:163-185`），**不得触及本文件其它逻辑、不许改组件 props**；行号 `:344-347`／`:359-367` 保留作定位锚点；
3. `src/services/architecture-character-nudge.ts:139-151`——**必须动**：仅在 `:149` 与 `:150` 之间加 `if (input.volume.synopsisIncomplete) return false`；同目录单测 `src/services/__tests__/architecture-character-nudge.test.ts` 补两条（wip 连三批 0 次／翻 final 1 次）；
4. 对应单测 ＋ 本卡卡面／派验单。

禁改区：`generation:read-context` 契约、dismiss 写入格式（`v<卷号>:<状态>`）、提示文案、状态栏与其它卡涉及的文件、`src/stores/synopsis-unit-chain-store.ts` 的持久化语义。

## 4. 判据（六条）

逐条带分层标签（`[live]`／`[static]`）：

1. `[live]` 同卷 `incomplete=true` 连三批（真实编辑器保存）⇒ **0 次**提示；把检查点翻成 `false` 后再保存 ⇒ **1 次**提示。
2. `[live]` 跨两卷各一次：卷 1 关闭写 `v1:final`；进卷 2 **必须**再提示 1 次并写 `v2:final`（贴两个 `volumeIndex`）。
3. `[live]` 未连写项目不再恒 `vn:final`：链为 `null` 但检查点有卷号 ⇒ 指纹 `v<卷号>:...`；且 `incomplete=true` 时 0 次提示。
   - 观测点口径（admin 11-22 裁）：`incomplete=true` 期间 0 次提示、localStorage 无可读记录，故「指纹是 `v<卷号>`」只能由翻转后的那一次观测证明：翻成 `false` 后关闭一次，读 localStorage 的 `v<卷号>:final` 作指纹证据；**不得用 0 次提示那一侧的数据充当指纹证据**。
4. `[live]` 重启后卷号不丢：顺序两次启动（每次 `app.quit`、`leftover=0`），指纹仍 `v<卷号>:...` 不退回 `vn`，贴重启前后两次指纹原文。
5. `[static]` 两处投影点 `grep -n` 不得再出现 `chain?.volumeIndex`、`chain?.status === 'running'`；**另加**：`src/services/architecture-character-nudge.ts` 的判定函数内必须出现 `synopsisIncomplete` 这道门（贴 `grep -n` 原文）。
6. `[static]` `src/services/__tests__/architecture-character-nudge.test.ts` 整文件汇总行＋末行 `EXIT=`；`check:fast` 末行 `EXIT=0`；写盘格式 `v<卷号>:<状态>` 一字不改。

`[live]` 四条按 `collab-rules-v1.md` §8 第 62 行取样口径：`sampleCount ≥ 2` 与取样时刻写进 evidence；每条各带 `triggerMode`（`ui-save`／`db-flip`），库造处逐条注「库造，非链路」。

> 判据 4 的「重启」取证口径（admin 11-22 裁）：允许**顺序两次启动**（每次跑完 `app.quit`、`leftover=0`），仍禁并行；evidence 记 `instancesThisRun=2`、两次 `exitCode=0`、结束 `leftoverElectronProcesses=0`，并贴重启前后两次指纹原文。

## 5. 明确不许（写死在卡面）

- 不许扩白名单；
- 不许动 `generation:read-context` 契约；
- 不许改 dismiss 写入格式；
- 不许把任一条判据降 `[mock]`；
- 不许顺手改状态栏或其它卡；
- 不许删 `:148`／`:149` 既有两道门或改判定顺序；
- 不许在「检查点未就绪」时按 `vn:final` 出判定，或在此期间写 dismiss。

## 5.1 风险（有意为之，别当漏判）

门的副作用：`synopsis_incomplete=true` 期间完全不提示；若作者手工改完正文而检查点没有回写 `false`，就会一直不提示。**这是设计取舍，有意为之**（宁可不打扰，也不在未定稿时催补角色）。QA 若认为该场景应提示，按记录项写，不因此判 FAIL。

## 6. 外派位

**本卡不外派，理由原句：改的是两个 UI 投影点，需实机 live。**

## 7. 交付与回执

- 交件报告：`.batch/night/staging/s3-d11b-report.md`（判据 1–4 各贴 evidence 与指纹原文／`triggerMode`，判据 5 贴 `grep -n` 原文，判据 6 贴汇总行与 `EXIT=`，实例三项＋`tasklist | grep -c electron` 原文）；
- 判词：`.batch/night/reports/s3-d11b-qa-firstcheck.md`，由 QA 出；
- 回执走 `.batch/night/bridge/to-owner`；入库与 push 由主身做。

## 8. R4（作用域写死）

1) `git diff --numstat 14401f4b..HEAD -- src electron scripts` 只允许出现 §3 白名单内的四类路径；
2) 无新增生产文件（单测文件属第 4 类，须逐条列出）。

## 9. 修订留痕

1. 本件为**草案**，admin 核过、主身确认后由主身把状态行改成「已入库」再开工；草案期间任何人不得据此改码。
2. v3（11-22 18:5x）：按 admin／主身逐条核定的五处落定——§2 第 5 条加判定侧的门（原文照抄）、§3 第 3 类改「必须动」并加两条单测、§4 重写为六条（判据 5 加查门）、删去旧的「wip 不可观测即降级」补偿、§2.1 行号写死；base 与 R4 锚点 `14401f4b`、白名单第 2 类、判词路径 `reports/`、双启动引用块保留。
3. 同版并入 developer 只读复核的三条事实（未改白名单范围）：投影点在内层组件 `ArchFileViewerSession`（`:128-134`，`:138` 有 `currentProject`，范式抄 `:163-185`）；新增 §2.2 判定时序（`useEffect` 在 `:359-367`、必须有「检查点未就绪」态且不写 dismiss、`App.tsx` await 后补 `isCurrentProjectSession()`）；新增 §5.1 门副作用风险（有意为之）。
