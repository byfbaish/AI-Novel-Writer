import { describe, expect, it } from 'vitest'
import {
  resolveStatusbarModel,
  statusbarModelCopy,
  statusbarModelDisplay,
  statusbarModelTitle,
} from '../statusbar-model'

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

describe('statusbarModelDisplay (2026-11-22 作者裁定 C：常态默认 + 不同则并列)', () => {
  const actual = { modelId: 'model-b', modelName: '实际模型B' }

  it('配置 A / 实际 B ⇒ 并列「A（实际 B）」，来源 both', () => {
    const d = statusbarModelDisplay(actual, '配置模型A')
    expect(d).toEqual({
      label: '配置模型A（实际 实际模型B）',
      source: 'both',
      configuredName: '配置模型A',
      actualName: '实际模型B',
      same: false,
    })
  })

  it('配置与实际同名 ⇒ 只显示一次，same=true', () => {
    const d = statusbarModelDisplay({ modelId: 'a', modelName: '模型A' }, '模型A')
    expect(d?.label).toBe('模型A')
    expect(d?.same).toBe(true)
  })

  it('只有配置 ⇒ configured 档；只有实际 ⇒ actual 档', () => {
    expect(statusbarModelDisplay(null, '配置模型A')).toMatchObject({ label: '配置模型A', source: 'configured', actualName: null })
    expect(statusbarModelDisplay(actual, null)).toMatchObject({ label: '实际模型B', source: 'actual', configuredName: null })
  })

  it('空白串按缺失处理，两侧都空 ⇒ null', () => {
    expect(statusbarModelDisplay({ modelId: 'b', modelName: '   ' }, '配置模型A')?.label).toBe('配置模型A')
    expect(statusbarModelDisplay(actual, '   ')?.label).toBe('实际模型B')
    expect(statusbarModelDisplay(null, '   ')).toBeNull()
    expect(statusbarModelDisplay(null, null)).toBeNull()
  })
})

describe('statusbarModelTitle (来源写进 tooltip，可见文本只放名字)', () => {
  it('并列且不同：写清配置与实际', () => {
    const d = statusbarModelDisplay({ modelId: 'b', modelName: '实际模型B' }, '配置模型A')!
    expect(statusbarModelTitle(d, 'zh-CN')).toBe('当前模型（配置）：配置模型A ｜ 实际调用：实际模型B')
    expect(statusbarModelTitle(d, 'en-US')).toBe('Current model (configured): 配置模型A | actual: 实际模型B')
  })

  it('并列且相同：一句话说清没有歧义', () => {
    const d = statusbarModelDisplay({ modelId: 'a', modelName: '模型A' }, '模型A')!
    expect(statusbarModelTitle(d, 'zh-CN')).toBe('当前模型：模型A（配置与实际调用一致）')
    expect(statusbarModelTitle(d, 'zh-CN')).not.toContain('Current')
  })

  it('单侧档：分别写（配置）/（实际调用）', () => {
    expect(statusbarModelTitle(statusbarModelDisplay(null, '配置模型A')!, 'zh-CN')).toBe('当前模型（配置）：配置模型A')
    expect(statusbarModelTitle(statusbarModelDisplay({ modelId: 'b', modelName: 'B' }, null)!, 'zh-CN')).toBe('当前模型（实际调用）：B')
    expect(statusbarModelTitle(statusbarModelDisplay({ modelId: 'b', modelName: 'B' }, null)!, 'en-US')).toBe('Current model (actual): B')
  })
})
