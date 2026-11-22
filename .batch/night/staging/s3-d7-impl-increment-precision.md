执行方：developer · AI writer项目组（Architecture / IT Advisor，本件为实施包增量，不改码、不提交）
判定面：`cae92355`（`src/services/workflows/synopsis-unit-launch.ts:341-359`）
model=宿主未暴露芯片原文 |倍率=未知|provider=未知

# D7 实施包增量 · 判据 2 FAIL 的精度缺陷（浮点提前取商）

## 1. 现象与根因（已证实）

`src/services/workflows/synopsis-unit-launch.ts:341-359`（`cae92355` 版）：

```ts
const perUnitChapters = input.coveredTo / input.completedUnits      // :355 先取商（浮点）
return Object.freeze({
  volumeChapters: Math.max(1, Math.floor(perUnitChapters * input.remainingUnits)),  // :357 再乘
```

先除后乘，`coveredTo / completedUnits` 的二进制浮点误差被乘 `remainingUnits` 放大，`Math.floor` 落进下一档，比卡面 §2 的 A′ 精确值小 1。卡面判据 2 要求「与界面估计值逐位一致」，故判 FAIL。

独立复现（`.runtime/d7-float-check.mjs`，`node .runtime/d7-float-check.mjs` → `EXIT=0`）：

```
13/3/27 impl=116 exact=117 | 15/11/11 impl=14 exact=15 | 5/3/2 impl=3 exact=3 | 20/1/1 impl=20 exact=20 | 2/3/1 impl=1 exact=1
all: mismatch=354 first=[13,3,27,116,117]
c>=d: mismatch=350 first=[13,3,27,116,117]
```

与 QA 的 354 组、admin 的 350 组（加了 `c≥d` 枚举口径）完全对齐，首个不等组与两个样例一致。

## 2. 改法（一处，先乘后除）

`src/services/workflows/synopsis-unit-launch.ts:355-358` 改为：

```ts
  const perUnitChapters = input.coveredTo / input.completedUnits
  return Object.freeze({
    // 口径 A′ 的精确值：先乘后除，避免浮点提前取商被 remainingUnits 放大
    volumeChapters: Math.max(1, Math.floor((input.coveredTo * input.remainingUnits) / input.completedUnits)),
    perUnitChapters,
  })
```

- `perUnitChapters` 字段语义不变（仍是浮点商，仅供信息展示），不必改类型、不必改返回结构。
- `max(1, …)` 保留；`floor` 在非负整数除法上等价于整数截断，无需换 `Math.trunc`。
- 溢出：`coveredTo ≤ 全书章数`、`remainingUnits ≤ 本卷单元数`，乘积远小于 `2^53`，仍在安全整数域（三个入参已被 `Number.isSafeInteger` 挡过）。
- 只改这一处；`estimateFromCheckpoint`（`:388-410`，取 `completedUnits` 的部分）、对话框调用链、`computeSynopsisUnitRange` 全部不动。

## 3. 单测增量（两条反例断言）

`src/services/workflows/__tests__/synopsis-unit-launch.test.ts:215-224`（现有「D7 纯函数边界」用例）末尾追加两组，或新增一条用例，二选一（建议追加，保持整文件汇总行不变仍计新增用例数）：

```ts
    // 浮点提前取商的反例：先除后乘会掉 1（13/3×27=117、15/11×11=15）
    expect(estimateRemainingVolumeChapters({ coveredTo: 13, completedUnits: 3, remainingUnits: 27 })?.volumeChapters).toBe(117)
    expect(estimateRemainingVolumeChapters({ coveredTo: 15, completedUnits: 11, remainingUnits: 11 })?.volumeChapters).toBe(15)
```

现有五条断言（`5/2/2=5`、`5/3/2=3`、`2/3/1=1`、三条 null）都落在等值区间，改前改后数值相同，抓不到此缺陷——这一点也是本次未在提交前发现的原因，报告里如实记。

## 4. 验证命令与预期读数

```bash
node scripts/run-tests-electron.mjs src/services/workflows/__tests__/synopsis-unit-launch.test.ts
# 预期：Test Files 1 passed (1) / Tests 30 passed (30) / EXIT=0   （原 29 + 若新增用例则 30；追加在既有用例内则仍 29）

node scripts/check-fast.mjs
# 预期：[check:fast] 全部通过。/ EXIT=0
```

复算脚本可留 `.runtime/d7-float-check.mjs`（不入库），改后重跑应得 `all: mismatch=0`、`c>=d: mismatch=0`。

## 5. 判据对照（改后）

| 判据 | 现状 | 改后取证 |
|---|---|---|
| 2 有历史可复算、与界面估计值逐位一致 | FAIL（116 vs 117） | `[static]`：贴上面两条反例断言与整文件汇总行；界面支随判据 1 的 `[live]` 证据给「本卷剩余 10 章，名义上界 10 章。按当前实际倾向估计：本卷剩余单元约 20 章…」同屏原文 |
| 1 同屏两数 | 与本次改动无关 | 不变（估值仍是同一字段，只修正算术） |
| 3 无偏差兜底 | 不受影响 | 不变（`null` 分支未动） |
| 4 名义上界逐位一致 | 不受影响 | 不变（`volumeChapters` 与 `unit.maxChapters` 各自独立） |
| 5 单测＋check:fast | 数字会变 | 用改后整文件汇总行与末行 `EXIT=` 重贴 |
| 6 白名单 | 不变 | 仍三文件（本增量只动其中两个：实现＋单测） |
| 7 实例纪律 | 不变 | 本条无 live 实机，属 `[static]` |

## 6. 落地方式（按 admin 令）

- 由主身提交到 `card/s3-d7-unit-chapter-estimate`，一笔包含：`src/services/workflows/synopsis-unit-launch.ts`（1 行改）、`src/services/workflows/__tests__/synopsis-unit-launch.test.ts`（2 行加）、本增量件；提交后报 sha，QA 以 `git show <sha>:<path>` 取分母复判。
- 我不写生产码入库，本件只是实施包；改码由主身执行，或按 admin 指派外派。

## 7. 交件报告在盘上的位置（澄清 QA「盘上没有」）

`.batch/night/staging/s3-d7-unit-chapter-estimate-report.md` 136 行 / 9,536B / sha256 `7e9c6365c6a51d099fb6ea6ff1a8884f13c25529a365eeca9f4aa8c627c15e79`，`git status` 显示 `??`（未跟踪）——它在工作区、不在任何提交里，所以 `git show HEAD:<path>` 取不到。QA 判据 1/3/7 用工作区路径读即可；需要入库存档则由主身在同一笔里 `git add` 点名。
