import { describe, expect, it } from 'vitest'
import { resolveStatusbarModel, statusbarModelCopy } from '../statusbar-model'

describe('resolveStatusbarModel (D16 实际调用优先)', () => {
  const actual = { modelId: 'model-b', modelName: '实际模型B' }

  it('shows the actually-called model even when a different model is configured', () => {
    // 验收：配置 A / 实际调用 B ⇒ 显示 B
    expect(resolveStatusbarModel(actual, '配置模型A')).toBe('实际模型B')
  })

  it('falls back to the configured model only when there is no actual call record', () => {
    expect(resolveStatusbarModel(null, '配置模型A')).toBe('配置模型A')
    expect(resolveStatusbarModel(undefined, '配置模型A')).toBe('配置模型A')
  })

  it('prefers a non-empty actual name and ignores blank strings', () => {
    expect(resolveStatusbarModel({ modelId: 'b', modelName: '  ' }, '配置模型A')).toBe('配置模型A')
    expect(resolveStatusbarModel({ modelId: 'b', modelName: '  实际B  ' }, '配置模型A')).toBe('实际B')
    expect(resolveStatusbarModel(null, '   ')).toBeNull()
    expect(resolveStatusbarModel(null, null)).toBeNull()
  })
})

describe('statusbarModelCopy (D16 zh/en 不串)', () => {
  it('uses zh copy for zh-CN without English', () => {
    const copy = statusbarModelCopy('zh-CN', '实际模型B')
    expect(copy).toEqual({ title: '当前模型：实际模型B', label: '实际模型B' })
    expect(copy.title).not.toContain('Current model')
  })

  it('uses en copy for en-US without Chinese', () => {
    const copy = statusbarModelCopy('en-US', '实际模型B')
    expect(copy).toEqual({ title: 'Current model: 实际模型B', label: '实际模型B' })
    expect(copy.title).not.toContain('当前模型')
  })
})
