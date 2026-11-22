# D11b 交件报告 · 补卡去重键改读检查点卷号与定稿态

- 卡面：`.batch/night/cards/s3-d11b-checkpoint-volume-projection.md`（库内 `788b84fd`，113 行 / 11,299B / `c6a95633500fae6efb3ccf6dc445b87885f54c1a5dd5854cc90b8ed06da829a6`）
- 派验单：`.batch/night/review-requests/s3-d11b-checkpoint-volume-projection.md`（库内 `c424a6f2`，73 行 / 5,819B / `e1a9f1993e53b3201afa04126a08dc90e8ad04c4193565f6ca18f4c30d91a908`）
- 执行方：developer · AI writer项目组（群分身）／工作树 `C:\develop\workspace\AI-writer\wt-d11b`
- 卡分支：`card/s3-d11b-checkpoint-volume-projection`（起点 `788b84fd`，未 push、未动 develop 主区）
- 交件提交：**`b9bdcba3f489e89aaf0c1ab52021e20dc4ad0e52`**（`git log -1 --oneline` → `b9bdcba3 fix(nudge): CARD-S3-D11b 补卡去重键改读检查点卷号与定稿态`）

## 一、四样（派验单要求）

1. **卡分支提交 sha**：`b9bdcba3f489e89aaf0c1ab52021e20dc4ad0e52`（父 `788b84fd8a2c1a53be7de4b7dab9dbfb565f4734`）
2. **六条判据读数**：见 §二
3. **实例三项**：`instancesThisRun=2`、两次启动均 `exitCode=0`、结束 `leftoverElectronProcesses=0`、`tasklist` 原文 `INFO: No tasks are running which match the specified criteria.`
4. **`git status --porcelain` 原文**：`git status --porcelain -uall -- src electron scripts` → 空（EXIT=0）；全树 `git status --porcelain -uall` → 空

## 二、判据对照

### 判据 1 [live] 同卷未定稿连三批 0 次、翻定稿后保存 1 次 —— PASS

- 种态：检查点 `synopsis_incomplete=true`、`synopsis_unit_cursor={volumeIndex:1,unitIndex:1,writtenInVolume:0}`；连写链从未启动（chain=null）。
- `judge1-wip-initial`：`bannerVisible=false` / `bannerCount=0` / `dismissedValue=null` / `sampleCount=2` / `2026-11-22T11:03:36.244Z`
- 三批真实编辑器保存（`Ctrl+End` 输入 → `button[title^="保存"]` → `saveButtonGone=true`），正文长度 189 → 256 → 323：

  | 批次 | bannerVisible | bannerCount | dismissedValue | synopsisLen | saveButtonGone |
  |---|---|---|---|---|---|
  | 1 | false | 0 | null | 189 | true |
  | 2 | false | 0 | null | 256 | true |
  | 3 | false | 0 | null | 323 | true |

- 翻 `synopsis_incomplete=false`（同一卷 1，库造记 `db-flip`）后 `judge1-final-first`：`bannerVisible=true` / `bannerCount=1` / `dismissedValue=null` / `sampleCount=2` / `11:03:51.013Z`
- 定稿后再保存一次 `judge1-final-save`：`bannerVisible=true` / `bannerCount=1`（仍 1 次、未变 2 次）/ `synopsisLen=390`
- 关闭后再连跑三批（5/6/7，UI 保存）：三次 `bannerVisible=false`，`dismissedValue` 恒 `v1:final`

### 判据 2 [live] 跨两卷各一次 —— PASS

- 卷 1 关闭写入 `v1:final`（判据 3 取证）；随后检查点翻 `volumeIndex=2`、`incomplete=false`（库造 `db-flip`）、同态重开。
- `judge2-volume2-prompt`：`bannerVisible=true` / `bannerCount=1` / `dismissedValueBeforeClose=v1:final` / `sampleCount=2` / `11:04:10.070Z` —— 卷号变化后重新提示 1 次。
- 关闭 `judge2-volume2-after-close`：`dismissedValueAfterClose=`**`v2:final`** / `bannerVisible=false` / `sampleCount=2` / `11:04:11.013Z`

### 判据 3 [live] chain=null 但检查点有卷号 ⇒ 指纹取 `v<卷号>`、未定稿 0 次 —— PASS

- 全程未启动连写链（`chain=null`）；同卷 `incomplete=true` 时 0 次（见判据 1 三批），翻转后那次关闭写入 **`v1:final`**（不是 `vn:final`），`judge3-close-after-flip`：`dismissedValue=v1:final` / `sampleCount=2` / `11:03:55.363Z`。指纹只能从翻转后关闭写入取，已按要求在同 run 内连看。

### 判据 4 [live] 重启后卷号不丢 —— PASS

- 判据 2 结束时落盘：检查点 `{synopsis_incomplete:false, synopsis_unit_cursor:{volumeIndex:2,…}}`、dismiss `v2:final`（`judge2.checkpointBeforeRestart` / `dismissedBeforeRestart`）。
- **顺序两次启动**（不并行）：实例 1 pid 37372 → `app.quit` 后 leftover=0；实例 2 pid 7156（`instancesThisRun=2`），同一 `--user-data-dir`。
- 重启后 `judge4-restart-volume2`：`bannerVisible=false` / `bannerCount=0` / `dismissedValue=v2:final` / `sampleCount=2` / `11:04:15.209Z` —— 若卷号退回 `vn`，指纹会从 `v2:final` 变成 `vn:final` 而再提示一次；实际 0 次 ⇒ 卷号来自检查点且重启不丢。
- 正向反证：重启后把检查点翻到 `volumeIndex=3`（`db-flip`）→ `judge4-volume3-prompt` `bannerVisible=true`/`bannerCount=1`（`11:04:19.743Z`）→ 关闭写 **`v3:final`**（`11:04:20.689Z`）⇒ 重启后卷号仍按检查点取。

### 判据 5 [static] 两处投影点不再读链、判定函数内有 `synopsisIncomplete` 门 —— PASS

- `grep -n "chain?.volumeIndex\|chain?.status === 'running'\|unitChain?.status\|activeChain?.volumeIndex" src/App.tsx src/components/editor/ArchFileViewer.tsx` → 无匹配，`EXIT=1`（只扫卡面指定的两个文件，未做全仓扫描）。
- 新投影点：`src/App.tsx:335-337`
  ```
  335:          const checkpoint = await readSynopsisUnitCheckpoint(projectSession)
  336:          if (!isCurrentProjectSession()) return
  337:          const volume = outlineNudgeVolumeIdentity({
  ```
  `src/components/editor/ArchFileViewer.tsx:346,352,355`：`useState<OutlineNudgeVolumeIdentity | null>` + `readSynopsisUnitCheckpoint(session)` + `setNudgeVolume(outlineNudgeVolumeIdentity({…}))`；`:376` 横幅门加 `|| !nudgeVolume`；`:386-387` `if (!nudgeVolume) return` 后再 `dismissOutlineCharacterNudge`。
- 判定函数三行相邻原文（`src/services/architecture-character-nudge.ts:148-154`，`sed -n '148,154p'`）：
  ```
    if (input.globallyDisabled === true) return false
    if (!hasOutlineContent(input.synopsis)) return false
    // D11b：该卷大纲**仍在逐批生成**（检查点 `synopsis_incomplete === true`）时不提示。
    // 作者此时看到的还是半卷稿，逐批改正文会让「同一卷只提示一次」变成噪音；
    // 定稿（翻成 false）后按卷号再提示一次，正是作者要的时机。
    if (input.volume.synopsisIncomplete) return false
    return input.dismissedVersion !== outlineNudgeDraftVersion(input.volume)
  ```
  即 `!hasOutlineContent` → `synopsisIncomplete` 门 → `dismissedVersion !==` 相邻顺序成立。

### 判据 6 [static] 单测整文件汇总行 + `check:fast` 末行 + `EXIT=` —— PASS

- `node ./node_modules/vitest/vitest.mjs run src/services/__tests__/architecture-character-nudge.test.ts`
  ```
   Test Files  1 passed (1)
        Tests  16 passed (16)
  ```
  `UNIT_EXIT=0`（`set -o pipefail` 下取，非 tail 退出码）
- `node scripts/check-fast.mjs` 末行 `[check:fast] 全部通过。`、`CHECKFAST_EXIT=0`
- 写盘格式未改：`outlineNudgeDraftVersion` 仍是 `v${volume.volumeIndex ?? 'n'}:${volume.synopsisIncomplete ? 'wip' : 'final'}`（`src/services/architecture-character-nudge.ts:134-136`）。

## 三、R4 范围复核

- `git diff --numstat 788b84fd..HEAD -- src electron scripts`：
  ```
  7	4	src/App.tsx
  24	7	src/components/editor/ArchFileViewer.tsx
  42	12	src/services/__tests__/architecture-character-nudge.test.ts
  4	0	src/services/architecture-character-nudge.ts
  ```
  全部落在卡面 §3 四类白名单内（两处投影点、判定函数、对应单测）；`electron/`、`scripts/` 未动。
- `git diff --name-status 788b84fd..HEAD -- src electron scripts`：四条全是 `M`，**无新增生产文件**（单测为既有文件内新增用例，未新建文件）。
- `git status --porcelain -uall -- src electron scripts`：空（EXIT=0）。

## 四、实机取证

- 脚本：`C:\develop\workspace\AI-writer\wt-d11b\.runtime\s3-d11b-live.mjs`（untracked，不入库）
- 运行：`cd C:\develop\workspace\AI-writer\wt-d11b && node .runtime/s3-d11b-live.mjs` → `exitCode=0`
- evidence：`.runtime/.cache/s3-d11b/0a2815bf-a6e/evidence.json`（337 行 / 11,161B / `4e382026e46da17f843595dd121967c8ca69865cd2895815b8dbb6857e43af3d`）
- 合成模型：`physicalModelRequests=0`（全部模型请求走脚本注入的本地合成 fetch，未出网）
- 实例纪律：`instancesThisRun=2`；实例 1 `pid=37372`、实例 2 `pid=7156`；两次退出后 `leftoverElectronProcesses=0`；`tasklistElectronRaw` 原文 `INFO: No tasks are running which match the specified criteria.`
- 取样口径：`SAMPLE={mode:'stable-poll',minGapMs:300,pollIntervalMs:400}`，每条读数均 `sampleCount=2` 且带 `sampledAt`；库造处 `triggerMode` 已逐条标注（`db-seed`／`db-flip`／`ui-save`／`ui-close`／`restart`）并注明「库造，非链路」。
- 构建：`node ./node_modules/vite/bin/vite.js build` EXIT=0（wt-d11b 自己的 dist，实机脚本用 `loadFile(dist/index.html)`）。

## 五、边界与风险

- `ArchFileViewer.tsx` 只改该投影点（`useMemo` → `useState` + `useEffect`），未触及该文件其它逻辑；`unitChain` 仍保留给进度条（`:1101-1146`）。
- `nudgeVolume=null` 表示「检查点未就绪」，此时不判提示、不写 dismiss —— 防初值退化 `vn:final` 把用户记录写成无卷号值。
- 门副作用（卡面 §5.1 已声明、有意为之）：`synopsis_incomplete=true` 期间完全不提示；作者手工改正文而不回写检查点则不会提示，待定稿后按卷号提示一次。
- 未 push、未动 develop 主区；`wt-d11b` 的 `node_modules` 为 junction，未 `pnpm install`、未切 ABI。
