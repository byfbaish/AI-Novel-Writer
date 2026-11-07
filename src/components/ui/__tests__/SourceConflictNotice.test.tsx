import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import SourceConflictNotice from '../SourceConflictNotice'
import { sourceConflictCopy } from '../../../shared/source-conflict-copy'

/**
 * D4 组件单测：冲突态下产物层与批次层两条并列文案**同时出现**，且「仅可复制」语义不丢。
 * node 环境无 jsdom，沿用仓库既有 `StatusBar.test.tsx` 的 renderToString 范式。
 */
describe('SourceConflictNotice (D4)', () => {
  it('冲突态同时渲染产物层与批次层两条并列文案', () => {
    const copy = sourceConflictCopy('zh-CN', 'conflict')!
    const html = renderToString(<SourceConflictNotice sourceStatus="conflict" />)
    expect(html).toContain('data-conflict-layer="output"')
    expect(html).toContain('data-conflict-layer="batch"')
    expect(html).toContain(copy.output)
    expect(html).toContain(copy.batch)
    // 「仅可复制」语义不丢
    expect(html).toContain('仍可复制')
    expect(html).toContain('后续单元不再执行')
  })

  it('current 态不渲染任何冲突文案', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="current" />)
    expect(html).toBe('')
    expect(html).not.toContain('来源已变化')
    expect(html).not.toContain('后续单元')
  })

  it('en-US 文案不串中文', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="conflict" locale="en-US" />)
    expect(html).toContain('can still be copied')
    expect(html).toContain('later units will not run')
    expect(html).not.toContain('来源已变化')
    expect(html).not.toContain('仍可复制')
    expect(html).not.toContain('后续单元')
  })
})
