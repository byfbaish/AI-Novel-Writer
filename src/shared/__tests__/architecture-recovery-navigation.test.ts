import { describe, expect, it } from 'vitest'
import { architectureRecoveryHandle } from '../architecture-recovery-navigation'

function checkpoint(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    world_building_incomplete: true,
    world_building_generation_handle: { projectId: 'p1', epoch: 'e1', rootActionId: 'r1', runId: 'run1' },
    synopsis_incomplete: true,
    synopsis_generation_handle: { projectId: 'p1', epoch: 'e1', rootActionId: 'r2', runId: 'run2' },
    ...overrides,
  }
}

describe('architectureRecoveryHandle', () => {
  it('worldbuilding 检查点合法时返回冻结的 4 键 handle', () => {
    const handle = architectureRecoveryHandle(checkpoint(), 'worldbuilding', 'p1')
    expect(handle).toEqual({ projectId: 'p1', epoch: 'e1', rootActionId: 'r1', runId: 'run1' })
    expect(Object.isFrozen(handle)).toBe(true)
  })

  it('synopsis 检查点合法时返回其 handle', () => {
    const handle = architectureRecoveryHandle(checkpoint(), 'synopsis', 'p1')
    expect(handle?.runId).toBe('run2')
  })

  it('未标记 incomplete 时返回 undefined', () => {
    expect(architectureRecoveryHandle(checkpoint({ world_building_incomplete: false }), 'worldbuilding', 'p1')).toBeUndefined()
  })

  it('projectId 不匹配时返回 undefined', () => {
    expect(architectureRecoveryHandle(checkpoint(), 'worldbuilding', 'other-project')).toBeUndefined()
  })

  it.each([
    ['键数不足', { world_building_generation_handle: { projectId: 'p1', epoch: 'e1', runId: 'run1' } }],
    ['含空字符串值', { world_building_generation_handle: { projectId: '', epoch: 'e1', rootActionId: 'r1', runId: 'run1' } }],
    ['数组形状', { world_building_generation_handle: ['p1', 'e1', 'r1', 'run1'] }],
  ])('畸形 handle 返回 undefined（%s）', (_label, overrides) => {
    expect(architectureRecoveryHandle(checkpoint(overrides), 'worldbuilding', 'p1')).toBeUndefined()
  })
})
