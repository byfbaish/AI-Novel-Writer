# S4 O1 实施包勘误 01（admin 2026-11-25 01:2x）

对象：`.batch/night/staging/s4-o1/impl-package.md`（333 行／35,465 B／`f51ac012…a90beb`，本文不修改该件，只追加勘误）。

## E1 J4c 括号里的算例数字错（豆包执行侧报出，admin 复核成立）

原文（J4c 行）：

> `startStep` 0→1 只影响传入新值的调用（`s0=1,M=4,b=2` 的 `j=1` 由 `[0,1]` 变 `[2,2]`）

按 §0.3 公式 `raw = s0 + j·(M-1-s0)/b` 实算：

- `s0=0, M=4, b=2, j=1` ⇒ `raw = 1·3/2 = 1.5` ⇒ `[floor 1.5, ceil 1.5] = [1,2]`
- `s0=1, M=4, b=2, j=1` ⇒ `raw = 1 + 1·2/2 = 2` ⇒ `[2,2]`

结论：括号应读作「由 `[1,2]` 变 `[2,2]`」。**判据本身不变**（`startStep` 参与运算、不得丢），错的只是算例里的下界数字。

## E2 `arc-position.ts` ⇄ `o1-event-progress.ts` 循环 import（豆包报告，admin 取证成立）

```
src/shared/arc-position.ts:2:import { renderEventProgressHint, unitEventSteps } from './o1-event-progress'
src/shared/o1-event-progress.ts:39:import { splitMinorSteps } from './arc-position'
```

判定：**本卡接受、不返工**。理由三条：①两处引用都只出现在函数体内，模块求值期没有顶层调用，ESM/Vitest 下无 TDZ 风险，实测 `Test Files 3 passed (3)`／`Tests 81 passed (81)`；②派单 §2 第 1 项本就允许 o1 只 import `splitMinorSteps`，环是包设计造成、非执行侧越界；③断环要改 `unitEventSteps` 入参形状（把已经 split 的步数组传进来），属签名变更，另开卡更稳。

技术债登记（进 S5 收口件）：断环方案＝把 `splitMinorSteps` 调用留在 `arc-position.ts`，`unitEventSteps` 改为接收已 split 的步名字数组，o1 侧不再 import `arc-position`；建议随 O1-b（水位落库与提示）一起做。
