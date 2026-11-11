# D9 · 慢吐超时判读（**未实机**，2026-11-11）

> 首行如实标注：**本轮未做 10 分钟慢吐实机**（计划内明确降级为静态判读 + 单测取证）。
> 卡片容器格式沿用 `scripts/night/20261111/wb-4-d9-slow-judge.md` 的五问，逐条回答。

## 一、五问回答

| # | 问题 | 结论 | 依据 |
|---|---|---|---|
| 1 | 是否触发超时 | **会**，单次调用上限写死 600,000 ms | `src/shared/generation-call-timeout.ts`：`DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000` |
| 2 | 是否停整批 | **会停整批** | `electron/services/generation-run-service.ts:203-220`：超时后 `block(rootActionId)` + `controller.abort()`；`block` 之后同一 rootAction 的后续 open 全部被拒 |
| 3 | 界面文案 | 两档：单次调用超时 / 批次中断 | `src/components/panels/ai-output-failure-presentation.ts:175` 附近的两条 `GENERATION_CALL_TIMEOUT` 分支文案 |
| 4 | 是否误记 cancelled | **不会误记**，且已做反向压制 | `generation-run-service.ts:287-288`：`timedOut` 时**显式把 `endReason` 覆盖为 `'failed'`**，注释原文「超时归属必须压过 provider 在 abort 路径上先写下的 endReason='cancelled'」；`:303-305` 落 `failureCode`。单测断言拿到 `GENERATION_CALL_TIMEOUT` 而非 `GENERATION_CANCELLED` |
| 5 | 异常 | 见下节「不可达配置」 | — |

## 二、单测取证（本轮真跑）

```
$ pnpm test src/shared/__tests__/generation-call-timeout.test.ts \
             electron/services/__tests__/generation-run-service.call-timeout.test.ts

 ✓ src/shared/__tests__/generation-call-timeout.test.ts (10 tests) 6ms
 ✓ electron/services/__tests__/generation-run-service.call-timeout.test.ts (2 tests) 10ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
```

- 假时钟：`vi.advanceTimersByTimeAsync(600_000)` 与 `300_000` 两档。
- 断言重点：失败码必须是 `GENERATION_CALL_TIMEOUT`，不是 `GENERATION_CANCELLED`。

## 三、静态判读发现的真问题（未修，待裁）

1. **配置通道不可达**：`generation-run-service.ts:206` 调 `resolveCallDeadline(budgetRemainingMs)` 时**没有传 `capMs`**，
   因此生产路径上永远吃 `DEFAULT_SINGLE_CALL_TIMEOUT_MS`（10 分钟）写死值。
   `resolveCallDeadline` 本身支持 `capMs`（单测里就是用 30,000 覆盖来测的），
   但没有任何生产入口把配置传进来 ⇒ **「可配置 watchdog」只是函数签名上的能力**。
2. **超时语义粒度**：超时是「停整批」而不是「只废当前章」。这与 `2026-11-11` 作者已裁口径一致
   （单章超时停整批），但与台账 `:132` 写的「现行续写模式只抛弃超时那一章」**不同向**；
   续写链路本夜仍无人读过代码，故不能据此改台账（DB-8 第 9 项）。
3. **超时与 cancelled 的边界（已修正，原表述写反）**：超时路径把 `endReason` 覆盖为 **`'failed'`**（不是 `'cancelled'`），
   `failureCode` 同时落 `GENERATION_CALL_TIMEOUT`。也就是说这一层是**对的**，不存在「被误读成用户取消」的问题。
   仍需核的是下游有没有别处按 `endReason` 反推用户意图；**本轮未追消费方**，保留为未核项。
   （2026-11-11 复核：原文误写为「覆盖成 `'cancelled'`」，与 `:287` 代码相反，已按代码更正。）

## 四、下一步（不自行实施）

- 若要真验证：需一次 10 分钟级慢吐实机（与「成功章」互斥，必须单独开轮）。
- 若不想真等：**不能只写一行**。`RootBudget`（`electron/services/main-generation-plan.ts:22-23`）只有
  `maxPhysicalRequests / maxTokenLiability / maxOutputPerRequest / maxActiveElapsedMs`，**没有 per-call 上限字段**；
  要接通得先扩契约（加 cap 字段 + 冻结进 source binding + 估计器版本），再在 `generation-run-service.ts:206` 传参。
  这属结构性改码，需作者单独点头。
  （2026-11-11 复核：原稿写「把 `readMainGenerationPolicy` 的 cap 接进来」不成立——那个 cap 不存在。）
