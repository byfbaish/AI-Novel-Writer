# D9 · 慢吐超时判读（**未实机**，2026-11-11）

> 首行如实标注：**本轮未做 10 分钟慢吐实机**（计划内明确降级为静态判读 + 单测取证）。
> 卡片容器格式沿用 `scripts/night/20261111/wb-4-d9-slow-judge.md` 的五问，逐条回答。

## 一、五问回答

| # | 问题 | 结论 | 依据 |
|---|---|---|---|
| 1 | 是否触发超时 | **会**，单次调用上限写死 600,000 ms | `src/shared/generation-call-timeout.ts`：`DEFAULT_SINGLE_CALL_TIMEOUT_MS = 10 * 60 * 1000` |
| 2 | 是否停整批 | **会停整批** | `electron/services/generation-run-service.ts:203-220`：超时后 `block(rootActionId)` + `controller.abort()`；`block` 之后同一 rootAction 的后续 open 全部被拒 |
| 3 | 界面文案 | 两档：单次调用超时 / 批次中断 | `src/components/panels/ai-output-failure-presentation.ts:175` 附近的两条 `GENERATION_CALL_TIMEOUT` 分支文案 |
| 4 | 是否误记 cancelled | **不会误记 cancelled**，但存在覆盖风险 | `generation-run-service.ts:287-288` 超时路径显式覆盖 `endReason:'cancelled'`；`:303-305` 落 `failureCode`。单测断言拿到的是 `GENERATION_CALL_TIMEOUT` 而非 `GENERATION_CANCELLED` |
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
3. **超时与 cancelled 的边界**：`endReason` 被覆盖为 `'cancelled'`，但 `failureCode` 保留 `GENERATION_CALL_TIMEOUT`。
   单测只钉了 failureCode；若下游有按 `endReason` 判定的消费方，会把超时读成用户取消。**本轮未追下游消费方**，列为未核。

## 四、下一步（不自行实施）

- 若要真验证：需一次 10 分钟级慢吐实机（与「成功章」互斥，必须单独开轮）。
- 若不想真等：至少把 `capMs` 从 `readMainGenerationPolicy` 接进 `resolveCallDeadline`，让单测的 30,000 档在集成层也成立；
  这属改码，需作者单独点头。
