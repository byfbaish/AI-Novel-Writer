import { describe, expect, it } from 'vitest'

import { sourceConflictCopy, sourceConflictNoticeText } from '../source-conflict-copy'

/** D4：同一份 sourceStatus='conflict' 同时驱动产物层与批次层两条并列文案。 */
describe('sourceConflictCopy (D4 统一事实源)', () => {
  it('conflict 同时产出产物层与批次层两条文案，且「仅可复制」语义不丢', () => {
    const copy = sourceConflictCopy('zh-CN', 'conflict')
    expect(copy).not.toBeNull()
    expect(copy!.output).toContain('仍可复制')
    expect(copy!.output).toContain('不能保存')
    expect(copy!.batch).toContain('后续单元不再执行')
    expect(copy!.batch).toContain('重新发起')
    expect(copy!.output).not.toBe(copy!.batch)
  })

  it('current 不产出任何冲突文案', () => {
    expect(sourceConflictCopy('zh-CN', 'current')).toBeNull()
    expect(sourceConflictCopy('en-US', 'current')).toBeNull()
  })

  it('zh/en 文案不串', () => {
    const zh = sourceConflictCopy('zh-CN', 'conflict')!
    const en = sourceConflictCopy('en-US', 'conflict')!
    expect(zh.output).not.toMatch(/[A-Za-z]{4,}/)
    expect(zh.batch).not.toMatch(/[A-Za-z]{4,}/)
    expect(en.output).toContain('can still be copied')
    expect(en.batch).toContain('later units will not run')
    expect(en.output).not.toContain('来源')
    expect(en.batch).not.toContain('后续单元')
  })

  it('noticeText 把两条并列文案拼进单条字符串（给 setAiError 用）', () => {
    const text = sourceConflictNoticeText('zh-CN', 'conflict')
    expect(text).not.toBeNull()
    expect(text).toContain('仍可复制')
    expect(text).toContain('后续单元不再执行')
    expect(sourceConflictNoticeText('zh-CN', 'current')).toBeNull()
  })
})
