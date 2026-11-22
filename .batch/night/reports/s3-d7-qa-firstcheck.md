执行方：QA · AI writer项目组
model=宿主未暴露芯片原文（`env` 无 `DSH_MODEL`）| 倍率=未知 | provider=未知

# D7 首验判词 · 单元→章折算：预告给两个数

## 0. 结论

**不通过（判据 2）＋ 2 项延后（判据 1、7）**。判据 2 的估计算法在提交面实现为「先取商再乘」，与卡面 §2 口径 A′ 的精确值存在 ±1 偏差，可用一组正常读数复现（§2）。判据 1、7 按派验单分层为 `[live]`，本卡既然已在判据 2 上不通过，按群 admin 11-22 11:48 裁定**实机留到修复提交后一次跑完**，不在本判起实机、不按「缺证」记账。

交件报告**在盘**：`.batch/night/staging/s3-d7-unit-chapter-estimate-report.md` 136 行 / 9,536B / sha256 `7e9c6365c6a51d099fb6ea6ff1a8884f13c25529a365eeca9f4aa8c627c15e79`（未跟踪件，`git show HEAD:` 取空）。其判据 1 段是**单文件 browser 渲染 + 合成探针**（`unit={from:21,unitIndex:2,maxChapters:10,volumeRemaining:10}`，自标 `[mock]`），报告 `:129` 自认「无 Electron GUI 实机、无实例复用的三项 evidence」⇒ 判据 1 缺的是 **live 实机取证**，不是报告没交付。

| 判据（派验单原文编号） | 分层 | 结果 |
|---|---|---|
| 1 同屏两个数，标签原文区分「名义上界」「按当前实际倾向估计」 | live | **延后**（按 admin 11-22 11:48 裁定，修复提交后一次跑；有/无偏差两支都要） |
| 2 数值可复算：`synopsis_volume_deviations` 读数 ＋ A′ 手算，与界面估计逐位一致 | static | **不通过**（浮点先取商，见 §2） |
| 3 无偏差支兜底文案；估计值与名义上界不得相同 | static | **过**（提交面文案原文见 §3；界面侧随判据 1 补证） |
| 4 名义上界未变 | static | **过**（`maxChapters` 与插值文案未动，见 §4） |
| 5 单测整文件汇总行 + `check:fast` 末行 + `EXIT=` | mock | **过**（我复跑 29 passed / `EXIT=0`；`check:fast` 全通过 / `EXIT=0`） |
| 6 改动面落白名单；`--name-status` 无 `A` | static | **过**（3 文件、无 `A`，见 §5） |
| 7 实例纪律 `instancesThisRun`／`leftoverElectronProcesses`／`exitCode` | live | **延后**（同上，随判据 1 一次实机取证） |

## 1. 分母与判定面

- 判定面（改码）：`cae92355`（父 `72e2e484`，1 笔改码提交）；分支 `card/s3-d7-unit-chapter-estimate` 现头 **`29593eac`**（= 远端同名分支头，`29593eac` 只加派验单标签行、`src electron scripts` 三件 numstat 与 `cae92355` 逐行相同）。
- 判据分母（提交面实测 `git show 29593eac:<path> | sha256sum`）：
  - 卡面 `.batch/night/cards/s3-d7-unit-chapter-estimate.md` 74 行 / 8,130B / `4735c1a0bedb290199d47c094daaec907acf30c582749f4a360624d7a47330b5`
  - 派验单 `.batch/night/review-requests/s3-d7-unit-chapter-estimate.md` **31 行 / 3,800B / `96f9c21671cb065b2958517a5fdce8e15014350226c9974ddafea7dada3b5dd8`**（含判据分层标签行；此前 29 行 / 3,156B / `146e2957…` 版作废，仅追溯）
  - 派单件 `.batch/night/staging/s3-d7-dispatch.md` 53 行 / 3,886B / `40f51085b14ead606d5cc669f3686fb64be69c3bd32609081b89d136fd1880de`
- 分层口径按派验单标签行（负责人 11-22 补）：1 live、2/3/4/6 static、5 mock、7 live。

## 2. 判据 2 **不通过**：浮点先取商，与 A′ 差 1

提交面原文 `src/services/workflows/synopsis-unit-launch.ts`（`cae92355`）：

```ts
const perUnitChapters = input.coveredTo / input.completedUnits
return Object.freeze({
  volumeChapters: Math.max(1, Math.floor(perUnitChapters * input.remainingUnits)),
```

卡面 §2 口径 A′：`估计 ＝ max(1, floor(已写章数 ÷ 已完成单元数 × 本卷剩余单元数))`，数学上是 `floor(c × r ÷ d)`。实现先做 `c/d`（浮点）再乘 `r`，会落成 `110.999…` 一类值，`floor` 后少 1：

```
c=13 d=3 r=27    impl=116  exact=117  MISMATCH
c=15 d=11 r=11   impl=14   exact=15   MISMATCH
c=20 d=1 r=1     impl=20   exact=20   ok
c=5  d=3 r=2     impl=3    exact=3    ok
```

`15 章已写完 / 已完成 11 个单元 / 本卷剩 11 个单元` 属完全正常的读数，界面会给 14，手算 A′ 是 15 ⇒ 判据 2「与界面估计值逐位一致」不成立。

**枚举口径（正式，以后按这一组算）**：域 `c ∈ [1,200]`（已写章数）、`d ∈ [1,40]`（已完成单元数）、`r ∈ [1,40]`（本卷剩余单元数），并强制 `c ≥ d`——每个已完成单元至少写过 1 章，`c < d` 不是可发生的读数（这类只影响计数，不影响首个不等组）。脚本原文与输出：

```python
import math
def impl(c, d, r):  return max(1, math.floor((c / d) * r))      # synopsis-unit-launch.ts:355-359
def exact(c, d, r): return max(1, math.floor(c * r / d))        # 卡面 §2 A′ 的精确值

bad_all, bad_cd = [], []
for c in range(1, 201):
    for d in range(1, 41):
        for r in range(1, 41):
            if impl(c, d, r) != exact(c, d, r):
                bad_all.append((c, d, r, impl(c, d, r), exact(c, d, r)))
                if c >= d:
                    bad_cd.append((c, d, r, impl(c, d, r), exact(c, d, r)))
print("unrestricted mismatches =", len(bad_all), "first =", bad_all[0])
print("c>=d mismatches        =", len(bad_cd),  "first =", bad_cd[0])
```

```
unrestricted mismatches = 354 first = (13, 3, 27, 116, 117)
c>=d mismatches        = 350 first = (13, 3, 27, 116, 117)
5/3/2: impl=3 exact=3
20/1/1: impl=20 exact=20
ENUM_EXIT=0
```

**计数差异的交代**：`354` 是未加 `c ≥ d` 的全部不等组，`350` 是加了该约束后的组数（差 4 组，全部落在 `c < d`）；两者**首个不等组与两个样例完全一致**（`13/3/27`、`15/11/11`）。正式口径取 `c ≥ d` 的 **350**，我先前只报 354、未声明口径，属表述不全，不影响判据 2 的结论。

修法（一行）：`Math.floor((input.coveredTo * input.remainingUnits) / input.completedUnits)`，`max(1, …)` 保留；`perUnitChapters` 若仅作报告复算可保留原比值。

单测缺口：现有三条断言 `5/3×2=3`、`2/3×1→1`、`20/1×1=20` 全落在等值区间，抓不到该偏差；需补反例断言（`13/3/27 ⇒ 117`、`15/11/11 ⇒ 15`）。

## 3. 判据 3（static）过

提交面 `src/components/dialogs/ArchitectureConfirmDialog.tsx:789-800` 的兜底支原文：

```
按当前实际倾向估计：暂无历史折算（还没有写完的单元），无法估计。
```

`chapterEstimate === null` 时不渲染任何估计数，故「估计值与名义上界两数相同」不可能发生。界面侧渲染随判据 1 的 live 证据一并确认。

## 4. 判据 4（static）过

`unitMode.maxChapters` 的取值链未动：`git diff 72e2e484..cae92355` 未改 `computeSynopsisUnitRange`（`src/services/workflows/commands/architecture.command.ts:316`）与 `synopsis-volume` 相关常量；对话框 `:790` 的 `名义上界 ${unitMode.maxChapters} 章` 插值逐字保留。改动只在其后**追加**估计段。改动前后两个数值本身随判据 1 的实机原文一并贴。

## 5. 判据 5 / 6（mock / static）过

判据 5（我复跑，整文件、无 `-t`）：

```
$ pnpm test src/services/workflows/__tests__/synopsis-unit-launch.test.ts
 ✓ src/services/workflows/__tests__/synopsis-unit-launch.test.ts (29 tests) 1377ms
 Test Files  1 passed (1)
      Tests  29 passed (29)
TEST_EXIT=0

$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 18.0s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CF_EXIT=0
```

判据 6：

```
$ git diff --numstat 72e2e484..cae92355 -- src electron scripts
14	2	src/components/dialogs/ArchitectureConfirmDialog.tsx
29	0	src/services/workflows/__tests__/synopsis-unit-launch.test.ts
78	1	src/services/workflows/synopsis-unit-launch.ts

$ git diff --name-status 72e2e484..cae92355 -- src electron scripts
M	src/components/dialogs/ArchitectureConfirmDialog.tsx
M	src/services/workflows/__tests__/synopsis-unit-launch.test.ts
M	src/services/workflows/synopsis-unit-launch.ts
```

无 `A` 行。`synopsis-unit-launch.ts` 属卡面 §3「把偏差数据送到该对话框的既有读取路径（只读投影）」：新增行里 `ipc|CREATE TABLE|ALTER TABLE|migration|sqlite` 命中 **0**，未新增表/列/IPC；估计值只挂在 `SynopsisUnitProbeResult.chapterEstimate`（注释明写「不被任何校验或闸门读取」），未进 `ArchitectureUnitRange` 与 planning intent。

## 6. 记录项

1. 工作区 `src` 与判定面一致（`git status --porcelain -- src electron scripts` 只有 `?? src/components/dialogs/__tests__/d7-evidence.browser.tsx`，该未跟踪件在本次取证时已不在盘上）。判据 6 按提交面判，不受影响；若后续把这类取证脚本落进 `src/`，须按卡面 §8 第 2 条「白名单内新增」逐条列出并在判词标注。
2. 派验单按 **31 行 / 3,800B / `96f9c216…`** 版判，判据 1–7 文字与 29 行版逐字相同（`git diff` 只加标签行与空行），§3–§5 结论不因换版而变。
3. 交件报告 `:70` 的判据 2 自报 **PASS 作废**（其三条样例 `5/3/2`、`2/3/1`、`20/1/1` 全落在等值区间，`20/1/1` 必然是 `20`）；以本判词 §2 的穷举结果为准。
4. **本人更正**：本判词 11:48 版 §0 曾写「交件报告尚未落盘」，实为我把未跟踪件 `??` 的 `git show` 取空当成了文件不存在，未查工作区路径——报告一直在盘（见 §0 末段）。该表述作废，其余结论不变。教训：判「件是否落盘」必须 `wc -lc`／`sha256sum` 打工作区路径，未跟踪件不能用 `git show` 反证。
3. `synopsis_volume_deviations` 在本实现里只出现在 `SYNOPSIS_CHECKPOINT_KEYS`（`:200`），折算实际取自 `synopsis_covered_to` ＋ 卷结构计划单元数——符合卡面 §2「或等价的既有实际章数/单元数读数」，判据 2 的「读数」一项以 `coveredTo`／`completedUnits`／`remainingUnits` 三者入演算。

## 7. 放行建议

1. 按 §2 改一行（整数先乘后除）＋ 补两条反例单测；
2. 修复提交（一笔：`synopsis-unit-launch.ts` 改 1 行 ＋ 单测加 2 条反例断言）落 `card/s3-d7-unit-chapter-estimate`，报 sha；我在该提交上一次跑判据 1、7 的 `[live]` 取证并贴原文，判据 2 复算到逐位一致；
3. 我在新提交面上只复判判据 2 与判据 1、7，其余沿本判词 §3–§5 结论。

<!-- DONE -->
