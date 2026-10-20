import { describe, expect, it } from 'vitest'

import {
  UNIT_CHAIN_STOP_COPY,
  decideUnitChainStep,
  describeUnitChain,
  type SynopsisUnitChainState,
} from '../synopsis-unit-chain'

/**
 * E3 T12 连写判定。
 *
 * 要保住的性质：
 * 1. **只连到本卷末**（v1）：换卷即停，且「卷末」优先于「配额」解释；
 * 2. 探针算不出下一个单元 ⇒ 停（不能拿旧范围重发，那是覆盖重写）；
 * 3. 已经停掉的链再问一百次也还是停（幂等，不会被完成事件反复复活）；
 * 4. 卷信息缺失时**不判卷界**（宁可继续，也不用猜出来的卷号把链掐断）。
 */

function chain(patch: Partial<SynopsisUnitChainState> = {}): SynopsisUnitChainState {
  return {
    projectPath: 'C:/books/a',
    total: 3,
    launched: 1,
    volumeIndex: 1,
    runId: 'run-1',
    targetUnits: 600,
    stepGuidance: {},
    status: 'running',
    stopReason: null,
    stopDetail: null,
    ...patch,
  }
}

describe('decideUnitChainStep', () => {
  it('同一卷、还有配额 ⇒ 继续下一批', () => {
    expect(decideUnitChainStep({ chain: chain(), next: { volumeIndex: 1 } }))
      .toEqual({ action: 'continue', reason: null, detail: null })
  })

  it('下一批进了别的卷 ⇒ 停在卷末（不是「配额用完」）', () => {
    const decision = decideUnitChainStep({ chain: chain({ total: 4 }), next: { volumeIndex: 2 } })
    expect(decision.action).toBe('stop')
    expect(decision.reason).toBe('volume-end')
    expect(decision.detail).toContain('第 2 卷')
  })

  it('配额用完 ⇒ 停；再多卷也不越过配额', () => {
    const decision = decideUnitChainStep({ chain: chain({ total: 2, launched: 2 }), next: { volumeIndex: 1 } })
    expect(decision).toMatchObject({ action: 'stop', reason: 'quota' })
  })

  it('算不出下一个单元 ⇒ 停，并把探针原因写进人话解释', () => {
    const decision = decideUnitChainStep({ chain: chain(), next: null, probeReason: 'compute-null' })
    expect(decision).toMatchObject({ action: 'stop', reason: 'no-unit' })
    expect(decision.detail).toContain('compute-null')
  })

  it('卷信息缺失时不判卷界，只按配额走', () => {
    // 探针没给 volume：volumeIndex 为 null
    expect(decideUnitChainStep({ chain: chain(), next: { volumeIndex: null } }).action).toBe('continue')
    // 链自己也不知道自己在哪一卷：同样不判卷界
    expect(decideUnitChainStep({ chain: chain({ volumeIndex: null }), next: { volumeIndex: 3 } }).action).toBe('continue')
  })

  it('已经停掉的链保持停止（幂等，不会被完成事件复活）', () => {
    const stopped = chain({ status: 'stopped', stopReason: 'manual', stopDetail: '作者点了停止' })
    expect(decideUnitChainStep({ chain: stopped, next: { volumeIndex: 1 } }))
      .toEqual({ action: 'stop', reason: 'manual', detail: '作者点了停止' })
    // 再问一次还是同一个结论
    expect(decideUnitChainStep({ chain: stopped, next: { volumeIndex: 1 } }).action).toBe('stop')
  })
})

describe('describeUnitChain / UNIT_CHAIN_STOP_COPY', () => {
  it('运行中报进度，停下来的报原因', () => {
    expect(describeUnitChain(chain())).toContain('1/3')
    expect(describeUnitChain(chain({ status: 'stopped', stopReason: 'volume-end' }))).toContain('本卷写完')
    expect(describeUnitChain(chain({ status: 'stopped', stopReason: 'failed', launched: 2 }))).toContain('2/3')
  })

  it('进度不会越过配额（launched 可能因竞态超出）', () => {
    expect(describeUnitChain(chain({ launched: 9, total: 3 }))).toContain('3/3')
  })

  it('每个停止原因都有中英文文案', () => {
    for (const [reason, copy] of Object.entries(UNIT_CHAIN_STOP_COPY)) {
      expect(copy.zh.length, reason).toBeGreaterThan(0)
      expect(copy.en.length, reason).toBeGreaterThan(0)
    }
  })
})
