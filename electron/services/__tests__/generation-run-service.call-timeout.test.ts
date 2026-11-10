import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenerationTransportDiagnostics } from '../../../src/shared/generation-contract'
import { createGenerationRunService, type ExecuteGenerationRequest } from '../generation-run-service'
import type { GenerationRunRepository } from '../../repositories/generation-run-repository'

/**
 * D9 阶段 1 补测：覆盖 `generation-run-service.ts:285-293` 的 `if (timedOut)` 覆盖分支。
 *
 * 为什么单独建文件：`generation-run-service.test.ts` 在本基线恒红（fixture 只跑 M01，
 * 而 repository 的 INSERT 需要 M29 补的 execution_owner / execution_epoch / lease_expires_at），
 * 那条超时覆盖分支至今没有执行证据。本文件用**假 repository + 假 dispatch + 假时钟**，
 * 不加载 better-sqlite3，也不碰既有 fixture / 迁移 / repository。
 *
 * 为什么要让假 dispatch 先落一份 `endReason:'cancelled'` 的快照：
 * 那是上一轮缺陷的原始形状（provider 在 abort 路径上把 endReason 写成 cancelled）。
 * 真实 openai-provider 在 abort 后的 notify 会被 run-service 的
 * `controller.signal.aborted` 守卫（`:222-223`）丢弃，所以这里**额外在 abort 之前**
 * 投递一份 cancelled 快照，直接证明覆盖分支不依赖任何一侧的执行顺序。
 */

const abortedSnapshot: GenerationTransportDiagnostics = {
  startedAt: 0, elapsedMs: 120000, firstResponseMs: 3000, lastResponseMs: 60000,
  lastOutputMs: 60000, phase: 'stream', endReason: 'cancelled', visibleEvents: 1, reasoningEvents: 0,
}

function fixture(maxActiveElapsedMs: number) {
  const blockCalls: Array<[string, string]> = []
  const settleCalls: Array<{ attemptId: string; failureCode?: string; diagnostics?: GenerationTransportDiagnostics }> = []
  const receipt = {
    attempt: { attemptId: 'attempt-1', status: 'reserved' },
    artifact: { artifactId: 'artifact-1', revision: 0, text: '' },
    budget: { policy: { maxPhysicalRequests: 2, maxTokenLiability: 1000, maxOutputPerRequest: 100, maxActiveElapsedMs } },
    run: { runId: 'run-1', rootActionId: 'root-1' },
  }
  const repository = {
    findInvocation: () => undefined,
    get: () => ({ runId: 'run-1', rootActionId: 'root-1', status: 'running' }),
    reserve: () => receipt,
    markDispatched: () => undefined,
    budget: () => ({ policy: { maxActiveElapsedMs }, activeElapsedMs: 0, blockedCode: null, attempts: [] }),
    block: (rootId: string, code: string) => { blockCalls.push([rootId, code]) },
    snapshot: () => { throw new Error('this test never streams text') },
    receipt: () => ({ ...receipt, attempt: { ...receipt.attempt, status: 'dispatch-marked' } }),
    settle: (attemptId: string, _usage: unknown, _finishReason: unknown, failureCode?: string,
      diagnostics?: GenerationTransportDiagnostics) => {
      settleCalls.push({ attemptId, failureCode, diagnostics })
      return { ...receipt, attempt: { ...receipt.attempt, status: 'unknown' }, failureCode, diagnostics }
    },
  } as unknown as GenerationRunRepository
  return { repository, blockCalls, settleCalls }
}

const request: ExecuteGenerationRequest = {
  runId: 'run-1', invocationNonce: 'nonce-1', requestHash: 'a'.repeat(64),
  providerRequest: { prompt: 'author' }, reservedTokens: 10, requestedOutputTokens: 10,
  inputUpperBoundTokens: 0, reasoningUpperBoundTokens: 0,
  usagePolicy: { estimatorVersion: 'fixture-v1', safetyMarginTokens: 0, reasoning: 'included-in-completion', canBoundTotalLiability: true },
}

function dispatchWithCancelledSnapshot(_request: unknown, options: { signal: AbortSignal; onDiagnostics?: (d: GenerationTransportDiagnostics) => void }) {
  // 最坏形状：本地诊断在超时之前就已经是 cancelled（上一轮守卫不执行的前提）。
  options.onDiagnostics?.({ ...abortedSnapshot })
  // 真实 provider 在 abort 时也会再 notify 一次 cancelled（本仓会被 :222-223 守卫丢弃，照写以保持形状）。
  options.signal.addEventListener('abort', () => options.onDiagnostics?.({ ...abortedSnapshot }), { once: true })
  return new Promise<never>(() => {})
}

afterEach(() => { vi.useRealTimers() })

describe('D9 单次调用超时：timedOut 覆盖分支', () => {
  it('预算大于上限时按 10 分钟收口：block / settle 都落 GENERATION_CALL_TIMEOUT，且压过已存在的 cancelled 诊断', async () => {
    vi.useFakeTimers()
    const f = fixture(3_600_000)
    const service = createGenerationRunService({ repository: f.repository, dispatch: dispatchWithCancelledSnapshot })
    const operation = service.execute(request)
    await vi.advanceTimersByTimeAsync(600_000)
    const result = await operation

    expect(f.blockCalls).toEqual([['root-1', 'GENERATION_CALL_TIMEOUT']])
    expect(f.settleCalls).toHaveLength(1)
    expect(f.settleCalls[0].failureCode).toBe('GENERATION_CALL_TIMEOUT')
    expect(f.settleCalls[0].failureCode).not.toBe('GENERATION_CANCELLED')
    expect(f.settleCalls[0].diagnostics).toMatchObject({ endReason: 'failed', failureCode: 'GENERATION_CALL_TIMEOUT' })
    expect(result.failureCode).toBe('GENERATION_CALL_TIMEOUT')
  })

  it('预算剩余小于上限时按剩余收口：block / settle 落 ROOT_BUDGET_EXHAUSTED', async () => {
    vi.useFakeTimers()
    const f = fixture(300_000)
    const service = createGenerationRunService({ repository: f.repository, dispatch: dispatchWithCancelledSnapshot })
    const operation = service.execute(request)
    await vi.advanceTimersByTimeAsync(300_000)
    const result = await operation

    expect(f.blockCalls).toEqual([['root-1', 'ROOT_BUDGET_EXHAUSTED']])
    expect(f.settleCalls[0].failureCode).toBe('ROOT_BUDGET_EXHAUSTED')
    expect(f.settleCalls[0].diagnostics).toMatchObject({ endReason: 'failed', failureCode: 'ROOT_BUDGET_EXHAUSTED' })
    expect(result.failureCode).toBe('ROOT_BUDGET_EXHAUSTED')
  })
})
