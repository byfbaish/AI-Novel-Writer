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

describe('statusbarModelCopy (D16 zh/en 不串 + 来源分档)', () => {
  it('uses zh copy for zh-CN without English', () => {
    const copy = statusbarModelCopy('zh-CN', '实际模型B', 'actual')
    expect(copy).toEqual({ title: '当前模型（实际调用）：实际模型B', label: '实际模型B' })
    expect(copy.title).not.toContain('Current model')
  })

  it('uses en copy for en-US without Chinese', () => {
    const copy = statusbarModelCopy('en-US', '实际模型B', 'actual')
    expect(copy).toEqual({ title: 'Current model (actual): 实际模型B', label: '实际模型B' })
    expect(copy.title).not.toContain('当前模型')
  })

  it('tooltip 区分「实际调用」与「仅配置」，可见文本仍只有模型名', () => {
    const actual = statusbarModelCopy('zh-CN', '实际模型B', 'actual')
    const configured = statusbarModelCopy('zh-CN', '配置模型A', 'configured')
    expect(actual.label).toBe('实际模型B')
    expect(configured.label).toBe('配置模型A')
    expect(actual.title).toContain('实际调用')
    expect(configured.title).toContain('配置')
    expect(configured.title).not.toContain('实际调用')
    expect(statusbarModelCopy('en-US', 'x', 'configured').title).toContain('configured')
  })
})
