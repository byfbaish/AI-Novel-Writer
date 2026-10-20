import { describe, expect, it } from 'vitest'
import { architecturePlanningRange, type ArchitecturePlanningIntent } from '../generation-owner-contract'

// E3 T8：单元模式请求期没有 `to`，授权/上界校验用「起点 + 名义上界」折算出来的 boundTo。
const base = { version: 'architecture-action-v1' as const, priorSteps: [] as const }

describe('architecturePlanningRange：架构意图的章号上界', () => {
  it('区间模式：原样返回', () => {
    expect(architecturePlanningRange({ ...base, synopsisRange: { from: 11, to: 20 } }))
      .toEqual({ from: 11, to: 20 })
  })

  it('单元模式：to = from + maxChapters − 1', () => {
    const intent: ArchitecturePlanningIntent = {
      ...base,
      synopsisRange: null,
      synopsisUnit: { from: 11, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 },
    }
    expect(architecturePlanningRange(intent)).toEqual({ from: 11, to: 15 })
  })

  it('两种模式都没有 / 非法字段 ⇒ null（调用方跳过校验，不猜）', () => {
    expect(architecturePlanningRange({ ...base, synopsisRange: null })).toBeNull()
    expect(architecturePlanningRange({ ...base, synopsisRange: null, synopsisUnit: null })).toBeNull()
    expect(architecturePlanningRange(null)).toBeNull()
    expect(architecturePlanningRange({
      ...base, synopsisRange: null,
      synopsisUnit: { from: 0, unitIndex: 1, maxChapters: 5, volumeRemaining: 10 },
    })).toBeNull()
    expect(architecturePlanningRange({
      ...base, synopsisRange: null,
      synopsisUnit: { from: 1, unitIndex: 1, maxChapters: 0, volumeRemaining: 10 },
    })).toBeNull()
  })
})
