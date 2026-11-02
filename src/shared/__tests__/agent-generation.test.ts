import { describe, expect, it } from 'vitest'
import { normalizeAgentPlanningArguments } from '../agent-generation'

describe('normalizeAgentPlanningArguments', () => {
  it('非规划类 workflow 原样透传（同一引用，不做任何改写）', () => {
    const args = { workflow: 'generate_draft', start_chapter: 3, chapter_count: 2, target_units: '800' }
    expect(normalizeAgentPlanningArguments(args, 100)).toBe(args)
  })

  it('规划类缺省时补起点 1、个数 = min(5, totalChapters)，并把 target_units 归一为默认 600', () => {
    const result = normalizeAgentPlanningArguments({ workflow: 'generate_blueprint' }, 100)
    expect(result).toMatchObject({ workflow: 'generate_blueprint', start_chapter: 1, chapter_count: 5, target_units: 600 })
  })

  it('全书不足 5 章时默认个数按 totalChapters 截断', () => {
    const result = normalizeAgentPlanningArguments({ workflow: 'generate_architecture' }, 3)
    expect(result).toMatchObject({ start_chapter: 1, chapter_count: 3 })
  })

  it('显式范围内参数保留，target_units 归一为传入值', () => {
    const result = normalizeAgentPlanningArguments(
      { workflow: 'generate_architecture', start_chapter: 2, chapter_count: 3, target_units: 800 },
      20,
    )
    expect(result).toMatchObject({ start_chapter: 2, chapter_count: 3, target_units: 800 })
  })

  it.each([
    { args: { workflow: 'generate_architecture', start_chapter: 1, chapter_count: 2.5 } },
    { args: { workflow: 'generate_architecture', start_chapter: 0, chapter_count: 1 } },
    { args: { workflow: 'generate_architecture', start_chapter: 1, chapter_count: 0 } },
    { args: { workflow: 'generate_architecture', start_chapter: 19, chapter_count: 2 } },
  ])('越界/非法输入抛 GENERATION_PLANNING_RANGE_INVALID：$args', ({ args }) => {
    expect(() => normalizeAgentPlanningArguments(args, 19)).toThrow('GENERATION_PLANNING_RANGE_INVALID')
  })
})
