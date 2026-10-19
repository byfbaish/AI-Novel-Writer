import { describe, expect, it } from 'vitest'
import {
  PLOT_OUTLINE_CONTENT,
  PLOT_OUTLINE_PROTOCOL,
  plotOutlinePolicy,
  plotOutlineUnitPolicy,
} from '../plot-outline-contract'

// E3 T2（e3-unit-batch-implementation-plan.md §3）：
// 逐单元批次请求期没有 `to`，与旧的章号区间形态互斥。
function manifest(intent: Record<string, unknown>, maxPhysicalRequests = 10) {
  return {
    operation: 'generate-plot-outline',
    policy: {
      planning: {
        kind: 'architecture',
        outlineProtocol: PLOT_OUTLINE_PROTOCOL,
        intent,
        outlineContent: { ...PLOT_OUTLINE_CONTENT },
      },
      budget: { maxPhysicalRequests },
    },
  }
}

describe('plotOutlineUnitPolicy：逐单元批次契约', () => {
  it('单元模式：放行无 to 的请求，返回单元四元组', () => {
    const m = manifest({ synopsisRange: null, synopsisUnit: { from: 11, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 } })
    expect(plotOutlineUnitPolicy(m)).toEqual({
      unit: { from: 11, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 },
      content: PLOT_OUTLINE_CONTENT,
    })
    // 区间校验器不认识单元模式：返回 null 而不是把无 to 的批次当成非法
    expect(plotOutlinePolicy(m)).toBeNull()
  })

  it('旧的章号模式照旧：区间校验器通过，单元校验器返回 null', () => {
    const m = manifest({ synopsisRange: { from: 1, to: 5 } })
    expect(plotOutlinePolicy(m)).toEqual({ range: { from: 1, to: 5 }, content: PLOT_OUTLINE_CONTENT })
    expect(plotOutlineUnitPolicy(m)).toBeNull()
  })

  it('两种形态并存：两边都拒绝（互斥）', () => {
    const m = manifest({ synopsisRange: { from: 1, to: 5 }, synopsisUnit: { from: 6, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 } })
    expect(() => plotOutlineUnitPolicy(m)).toThrow('GENERATION_PLOT_OUTLINE_POLICY_INVALID')
    expect(() => plotOutlinePolicy(m)).toThrow('GENERATION_PLOT_OUTLINE_POLICY_INVALID')
  })

  it('既无 to 也无 unit：区间校验器报错（保持旧行为）', () => {
    expect(() => plotOutlinePolicy(manifest({ synopsisRange: null }))).toThrow('GENERATION_PLOT_OUTLINE_POLICY_INVALID')
    expect(plotOutlineUnitPolicy(manifest({ synopsisRange: null }))).toBeNull()
  })

  it.each([
    ['from 为 0', { from: 0, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 }],
    ['unitIndex 为 0', { from: 11, unitIndex: 0, maxChapters: 5, volumeRemaining: 10 }],
    ['maxChapters 为 0', { from: 11, unitIndex: 2, maxChapters: 0, volumeRemaining: 10 }],
    ['volumeRemaining 为 0', { from: 11, unitIndex: 2, maxChapters: 5, volumeRemaining: 0 }],
    ['maxChapters 超过本卷剩余', { from: 11, unitIndex: 2, maxChapters: 11, volumeRemaining: 10 }],
    ['maxChapters 超过单请求上限', { from: 11, unitIndex: 2, maxChapters: 11, volumeRemaining: 20 }],
    ['非整数 from', { from: 11.5, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 }],
  ])('非法单元字段：%s ⇒ 拒绝', (_label, unit) => {
    expect(() => plotOutlineUnitPolicy(manifest({ synopsisUnit: unit }))).toThrow('GENERATION_PLOT_OUTLINE_POLICY_INVALID')
  })

  it('非大纲操作 / 非 unit 形态：返回 null（不抛）', () => {
    expect(plotOutlineUnitPolicy({ operation: 'other' })).toBeNull()
    expect(plotOutlineUnitPolicy(manifest({ synopsisUnit: null }))).toBeNull()
    expect(plotOutlineUnitPolicy(manifest({}))).toBeNull()
  })

  it('内容声明不匹配：拒绝（与区间模式同一把尺）', () => {
    const m = manifest({ synopsisUnit: { from: 11, unitIndex: 2, maxChapters: 5, volumeRemaining: 10 } })
    const broken = { ...m, policy: { ...m.policy, planning: { ...m.policy.planning, outlineContent: { maxAttemptsPerChapter: 9 } } } }
    expect(() => plotOutlineUnitPolicy(broken)).toThrow('GENERATION_PLOT_OUTLINE_POLICY_INVALID')
  })
})
