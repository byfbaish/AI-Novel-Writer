import { describe, expect, it, vi } from 'vitest'
import { runOutlineProgressGateProbe } from '../outline-progress-gate-probe'
import type { OutlineProgressGate } from '../../shared/outline-progress-gate'

/**
 * 探针只做两件事：把会话取对、把真实闸门返回值原样透出。
 * 单测锁的就是这两件事 —— 一旦有人让探针自己判一遍，这里会先红。
 */

const fakeGate: OutlineProgressGate = {
  state: 'ahead',
  reason: 'handoff-missing',
  range: { volumeId: 'v1', volumeIndex: 1, name: '第一卷', first: 1, last: 6, basis: 'actual', actualLast: 6 },
  authorityStatus: 'continuous',
  draftLastChapter: 6,
  missingChapters: 0,
  handoff: 'missing',
}

const session = { projectPath: '/tmp/proj', sessionId: 's1' } as never

function deps(overrides: Partial<Parameters<typeof runOutlineProgressGateProbe>[1]> = {}) {
  return {
    currentProject: () => ({ projectPath: '/tmp/proj' }),
    resolveSession: () => session,
    readGate: vi.fn().mockResolvedValue({ gate: fakeGate }),
    ...overrides,
  } as Parameters<typeof runOutlineProgressGateProbe>[1]
}

describe('runOutlineProgressGateProbe', () => {
  it('原样透出真实闸门的返回值', async () => {
    const report = await runOutlineProgressGateProbe(7, deps())
    expect(report.ok).toBe(true)
    expect(report.projectPath).toBe('/tmp/proj')
    expect(report.gate).toEqual(fakeGate)
  })

  it('把降级原因透出到 warning，不吞掉', async () => {
    const report = await runOutlineProgressGateProbe(7, deps({
      readGate: vi.fn().mockResolvedValue({ gate: null, warning: '卷结构状态为 stale，本次不判' }),
    }))
    expect(report.ok).toBe(true)
    expect(report.gate).toBeNull()
    expect(report.warning).toBe('卷结构状态为 stale，本次不判')
  })

  it('没有打开项目时不发起判定', async () => {
    const readGate = vi.fn()
    const report = await runOutlineProgressGateProbe(7, deps({
      currentProject: () => null,
      readGate,
    }))
    expect(report.ok).toBe(false)
    expect(report.detail).toContain('没有打开的项目')
    expect(readGate).not.toHaveBeenCalled()
  })

  it('会话不是活动会话时不发起判定', async () => {
    const readGate = vi.fn()
    const report = await runOutlineProgressGateProbe(7, deps({
      resolveSession: () => null,
      readGate,
    }))
    expect(report.ok).toBe(false)
    expect(report.detail).toContain('不是活动会话')
    expect(readGate).not.toHaveBeenCalled()
  })

  it('章节号不合法时拒跑（闸门对 <2 恒返回 null，那样看不出是「不适用」还是「参数错」）', async () => {
    const readGate = vi.fn()
    const report = await runOutlineProgressGateProbe(1, deps({ readGate }))
    expect(report.ok).toBe(false)
    expect(report.detail).toContain('章节号不合法')
    expect(readGate).not.toHaveBeenCalled()
  })
})
