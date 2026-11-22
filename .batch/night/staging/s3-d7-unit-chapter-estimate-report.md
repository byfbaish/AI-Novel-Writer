执行方：developer · AI writer项目组
取数件：卡面 `s3-d7-unit-chapter-estimate.md` sha256 `4735c1a0bedb290199d47c094daaec907acf30c582749f4a360624d7a47330b5`（`git show HEAD:` 取）/ 派验单 `s3-d7-unit-chapter-estimate.md` sha256 `146e2957599cb259290003bfadd058fa4cf43a10287df66f5d8b521510fd6f53`（同上）/ base `72e2e484`
model=宿主未暴露芯片原文（`env | grep -iE "^DSH_(MODEL|ENGINE)"` 只回 `DSH_PROFILE`）|倍率=未知|provider=未知

# D7 交件报告 · 单元→章折算：预告并列名义上界与按当前实际倾向估计

## 1. 交件面

- 分支：`card/s3-d7-unit-chapter-estimate`
- **交件提交：`cae9235523f3eea1c80b5671a24219bb2b784d62`**（短 `cae92355`，代码提交；判定面认这个 sha）
- 父提交：`3f178475`（该分支已由主身 `merge origin/exp/resource-ledger`，HEAD = `8b0167cf`，其上另有 D16 文档提交 `dc9ba263`/`d3e5d76c`；代码改动仍只在本提交里）
- 未 push（push 由主身做）
- 分支建立方式：`git switch -c card/s3-d7-unit-chapter-estimate 72e2e484` 后代码提交，再按 admin 令 rebase/合并到主线；文档提交 `f35a2f1c` 在 rebase 时被判「patch already upstream」自动丢弃（其内容已在 `72e2e484`）

### 改动面（`git diff --numstat 72e2e484..cae92355 -- src electron scripts` 原文）

```
14	2	src/components/dialogs/ArchitectureConfirmDialog.tsx
29	0	src/services/workflows/__tests__/synopsis-unit-launch.test.ts
78	1	src/services/workflows/synopsis-unit-launch.ts
```

`git diff --name-status 72e2e484..cae92355 -- src electron scripts` 原文（无 `A` 行）：

```
M	src/components/dialogs/ArchitectureConfirmDialog.tsx
M	src/services/workflows/__tests__/synopsis-unit-launch.test.ts
M	src/services/workflows/synopsis-unit-launch.ts
```

### 白名单对照（卡面 §3）

| 路径 | 卡面 §3 | 结论 |
|---|---|---|
| `src/components/dialogs/ArchitectureConfirmDialog.tsx` | 可改（对话框） | 白名单内 |
| `src/services/workflows/synopsis-unit-launch.ts` | 「把偏差数据送到该对话框的既有读取路径（只读投影，不新增表/列/IPC）」 | 白名单内：只在该既有读取路径上**新增一个只读投影字段**，无新增表/列/IPC/落盘 |
| `src/services/workflows/__tests__/synopsis-unit-launch.test.ts` | 「其单测」 | 白名单内 |

禁改区一项未动，证据（三个命令输出均为空）：

```
$ git diff --numstat 72e2e484..cae92355 -- src/services/workflows/commands/architecture.command.ts src/shared/arc-position.ts
（空）
$ git diff -U0 72e2e484..cae92355 -- src/services/workflows/synopsis-unit-launch.ts | grep -E "^[+-].*(computeSynopsisUnitRange|synopsis_volume_deviations)" | grep -v "不新增\|无调用关系"
（空：本提交未改该函数、未碰 deviations 写入）
```

## 2. 改法（实现摘要）

1. `synopsis-unit-launch.ts`：`SynopsisUnitProbeResult` 增只读字段
   `readonly chapterEstimate?: { volumeChapters: number; perUnitChapters: number; completedUnits: number } | null`；
   新增导出纯函数 `estimateRemainingVolumeChapters({coveredTo, completedUnits, remainingUnits})`，
   实现 `Math.max(1, Math.floor((coveredTo / completedUnits) * remainingUnits))`，非安全整数 / 任一 <1 返回 `null`；
   探针返回处先取 `volume`（既有 `describeUnitVolume`），再由 `estimateFromCheckpoint` 从既有检查点
   （`synopsis_covered_to` + `synopsis_unit_cursor`）与既有卷/单元结构算 `completedUnits`，异常一律 `null`。
2. `ArchitectureConfirmDialog.tsx`：`const chapterEstimate = unitPreview?.chapterEstimate ?? null`；
   预告段改为两数并列——名义上界句子原样保留，其后追加
   `按当前实际倾向估计：本卷剩余单元约 X 章（据已写完 K 个单元的实际章数折算）。`，
   `chapterEstimate === null` 时该位写 `按当前实际倾向估计：暂无历史折算（还没有写完的单元），无法估计。`（英文同构）。
3. 不改 `computeSynopsisUnitRange`、不改 `arc-position.ts:960` 的 prompt 精度、不改落盘。

## 3. 判据对照（逐条，含分层）

判据分层按卡面模板 §4 第 11 条（`3f178475` 起）：`[static]` 读码/命令可判、`[mock]` 合成数据渲染、`[live]` 真实主进程+IPC。

### 判据 1 · 同屏两个数、标签原文清楚区分 —— **[mock] PASS（有偏差支）**

卡面判据 1 允许「实机（或对话框可复现路径）」。取证方式：单文件 browser 渲染，`probeSynopsisUnitLaunchForProject` 用合成探针结果（`unit={from:21,unitIndex:2,maxChapters:10,volumeRemaining:10}`、`chapterEstimate={volumeChapters:20,perUnitChapters:20,completedUnits:1}`），不是真 IPC ⇒ 标 `[mock]`。

界面原文（`[role="status"]` 的 `textContent`，脚本 `console.log` 原样摘录）：

```
单元模式：第1卷第2单元第1章（全书第21章）（本卷共 2 个单元）本卷剩余 10 章，名义上界 10 章。按当前实际倾向估计：本卷剩余单元约 20 章（据已写完 1 个单元的实际章数折算）。篇幅由剧情决定，写完按实际章数落盘。每次生成都是一个完整单元；上一次未完成的半成品不保留，也不会从断处接着写。
```

两数同屏（10 与 20）、标签原文为「名义上界」与「按当前实际倾向估计」，未被合并成「约 N–M」。

### 判据 2 · 有历史时算式可复算 —— **[static] PASS**

读数与演算（`coveredTo=20`、已完成单元数 `1`、本卷剩余单元数 `1`）：

```
20 ÷ 1 × 1 = 20 → max(1, floor(20)) = 20
同屏名义上界（maxChapters，原算法原值）= 10
```

`completedUnits` 的来源是既有检查点与卷结构：游标 `volumeIndex=1,unitIndex=2` ⇒ Σ 卷 1 之前各卷单元数(0) + (2−1) = 1。

### 判据 3 · 无偏差兜底原文 + 两数不得相同 —— **[mock] PASS（无偏差支）**

`chapterEstimate = null` 时界面原文：

```
单元模式：第1卷第2单元第1章（全书第21章）（本卷共 2 个单元）本卷剩余 10 章，名义上界 10 章。按当前实际倾向估计：暂无历史折算（还没有写完的单元），无法估计。篇幅由剧情决定，写完按实际章数落盘。每次生成都是一个完整单元；上一次未完成的半成品不保留，也不会从断处接着写。
```

估计位是兜底文案，**没有**把名义上界 10 填进去（该支界面上只有一个数字 10，即名义上界本身，标签未混用）。

### 判据 4 · 名义上界改前改后逐位一致 —— **[static] PASS**

- 改前（`72e2e484` 的对话框）原文片段：`本卷剩余 ${unitMode.volumeRemaining} 章，名义上界 ${unitMode.maxChapters} 章。` → 合成读数下即「本卷剩余 10 章，名义上界 10 章。」
- 改后（`cae92355`）界面原文：同上，「本卷剩余 10 章，名义上界 10 章。」逐字相同（见判据 1/3 原文）
- 结构证据：`unit` 由 `computeSynopsisUnitRange` 产出，本提交未改其调用与实现（禁改区 diff 为空），`chapterEstimate` 是并列新字段，`unit.maxChapters` 仍为 10；单测同时断言 `result.unit` 仍等于 `{from:11,unitIndex:1,maxChapters:10,volumeRemaining:20}`。

### 判据 5 · 单测两支 + 整文件汇总行 + check:fast + EXIT —— **[static] PASS（develop 主树）**

```
$ node scripts/run-tests-electron.mjs src/services/workflows/__tests__/synopsis-unit-launch.test.ts
 Test Files  1 passed (1)
      Tests  29 passed (29)
EXIT=0

$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 20.1s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] 全部通过。
EXIT=0
```

新增 3 支（无历史 ⇒ `chapterEstimate === null` 且 `unit` 不变；有历史 ⇒ `{volumeChapters:20,perUnitChapters:20,completedUnits:1}` 且 `unit.maxChapters === 10`；纯函数边界含 `5/3/2 ⇒ 3`（floor 与 ceil 分叉点）与下限 1）。

## 4. 取证脚本与环境纪律（如实交代）

- 判据 1/3 的界面原文来自**一次临时单文件 browser 渲染**：`src/components/dialogs/__tests__/d7-evidence.browser.tsx`，跑两次
  （第一次单支、第二次两支）均 `Tests 2 passed (2)` / `EXIT=0`，**跑完已删除，未入库**（提交面 `--name-status` 无 `A` 行即证）。
  只跑这一个文件，没有跑 test:browser 全量；browser 实例为 chromium headless，仅 2 个用例，跑完进程已退出。
- 单测与 check:fast 均在 `develop` 主树执行（非 worktree），整文件汇总行与末行 `EXIT=` 已贴。
- 本条无 Electron GUI 实机、无实例复用的三项 evidence（`instancesThisRun`/`exitCode`/`leftoverElectronProcesses`）——
  D7 的判据 1 允许「对话框可复现路径」，故按 `[mock]` 计；若 QA 要求 `[live]`，需另跑一次真实 Electron + 真实 SQLite 的对话框取证。

## 5. 附：实施包与口径

- `.batch/night/staging/s3-d7-implementation-package.md` 258 行 / 17,980B / sha256 `9ba5ee947f4c155e4feb1d4f239268aaebb13e920abe1f643a0e961188230c44`
  —— **已按 A′ 定稿**（`Math.floor` ＋ 下限 1，全包无实现级 `ceil` 残留；分母由主身改钉 `4735c1a0/146e2957/40f51085`）。实施包不进判据分母，判据一切以卡面 §2 的 A′ 为准。
- 本卡未改 `computeSynopsisUnitRange`、`arc-position.ts:960`、批次上界推导、`synopsis_volume_deviations` 写入、D6 常量、D12 注入区。
