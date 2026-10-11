import { describe, expect, it } from 'vitest'
import type { PromptTemplate } from '../builtin-prompt-templates'
import { isBuiltinOverrideStale, promptBuiltinRevision } from '../prompt-builtin-revision'

function template(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    key: 'world_building',
    name: '世界观',
    description: '构建世界矩阵',
    content: '正文 {{genre}}',
    systemRole: '你是世界观策划',
    variables: { genre: '小说类型', world_building: '世界观' },
    ...overrides,
  }
}

describe('promptBuiltinRevision', () => {
  it('is stable for identical content', () => {
    expect(promptBuiltinRevision(template())).toBe(promptBuiltinRevision(template()))
  })

  it('ignores identity fields and the built-in output contract', () => {
    const base = template()
    const renamed = template({ key: 'premise', systemSuffix: '★ 输出合同变了' } as Partial<PromptTemplate>)
    // key 是身份、systemSuffix 渲染时始终取内置版本 —— 二者的变化都不应触发"内置已更新"提示。
    expect(promptBuiltinRevision(renamed)).toBe(promptBuiltinRevision(base))
  })

  it('is order-independent for the variables map', () => {
    const base = template()
    const reordered = template({ variables: { world_building: '世界观', genre: '小说类型' } })
    expect(promptBuiltinRevision(reordered)).toBe(promptBuiltinRevision(base))
  })

  it('changes when the author-editable-by-us parts of the built-in change', () => {
    const base = promptBuiltinRevision(template())
    expect(promptBuiltinRevision(template({ content: '正文改了一个字' }))).not.toBe(base)
    expect(promptBuiltinRevision(template({ description: '说明变了' }))).not.toBe(base)
    expect(promptBuiltinRevision(template({ systemRole: '新角色定位' }))).not.toBe(base)
    expect(promptBuiltinRevision(template({ variables: { genre: '小说类型' } }))).not.toBe(base)
  })
})

describe('isBuiltinOverrideStale', () => {
  it('treats an override without a revision as stale (legacy files)', () => {
    expect(isBuiltinOverrideStale({}, template())).toBe(true)
  })

  it('treats a stamped override as fresh and a drifted one as stale', () => {
    const builtin = template()
    expect(isBuiltinOverrideStale({ builtinRevision: promptBuiltinRevision(builtin) }, builtin)).toBe(false)
    expect(isBuiltinOverrideStale({ builtinRevision: promptBuiltinRevision(template({ content: '旧版正文' })) }, builtin)).toBe(true)
  })
})
