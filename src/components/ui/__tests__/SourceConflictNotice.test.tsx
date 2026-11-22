import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import SourceConflictNotice from '../SourceConflictNotice'
import { sourceConflictBatchLayer, sourceConflictCopy } from '../../../shared/source-conflict-copy'

/**
 * D4 组件单测：两层文案各有前置条件，互不代偿。
 * - 产物层随 `sourceStatus === 'conflict'` 出现；
 * - 批次层只随真实批状态（`batchStopped`，来自 `evaluateBatchRecoveryGate(...).terminated`）出现。
 * node 环境无 jsdom，沿用仓库既有 `StatusBar.test.tsx` 的 renderToString 范式。
 */
describe('SourceConflictNotice (D4)', () => {
  it('冲突态同时渲染产物层与批次层两条并列文案', () => {
    const copy = sourceConflictCopy('zh-CN', 'conflict')!
    const html = renderToString(<SourceConflictNotice sourceStatus="conflict" batchStopped />)
    expect(html).toContain('data-conflict-layer="output"')
    expect(html).toContain('data-conflict-layer="batch"')
    expect(html).toContain(copy.output)
    expect(html).toContain(copy.batch)
    // 「仅可复制」语义不丢
    expect(html).toContain('仍可复制')
    expect(html).toContain('后续单元不再执行')
  })

  it('冲突但批次未停：只有产物层，不报「本批已停止」', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="conflict" />)
    expect(html).toContain('data-conflict-layer="output"')
    expect(html).toContain('仍可复制')
    expect(html).not.toContain('data-conflict-layer="batch"')
    expect(html).not.toContain('后续单元')
    expect(html).not.toContain('本批已停止')
  })

  it('批次已停但来源未冲突：仍报批次层（真停了就要说得出来）', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="current" batchStopped />)
    expect(html).toContain('data-conflict-layer="batch"')
    expect(html).toContain('后续单元不再执行')
    expect(html).not.toContain('data-conflict-layer="output"')
    expect(html).not.toContain('来源已变化')
  })

  it('批次层带章号时说清从第几章重开', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="conflict" batchStopped batchChapterNumber={3} />)
    expect(html).toContain(sourceConflictBatchLayer('zh-CN', 3))
    expect(html).toContain('从第3章重新发起')
    expect(html).not.toContain('从第null章')
  })

  it('current 态不渲染任何冲突文案', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="current" />)
    expect(html).toBe('')
    expect(html).not.toContain('来源已变化')
    expect(html).not.toContain('后续单元')
  })

  it('en-US 文案不串中文', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="conflict" batchStopped locale="en-US" />)
    expect(html).toContain('can still be copied')
    expect(html).toContain('later units will not run')
    expect(html).not.toContain('来源已变化')
    expect(html).not.toContain('仍可复制')
    expect(html).not.toContain('后续单元')
  })

  it('en-US 批次层带章号', () => {
    const html = renderToString(<SourceConflictNotice sourceStatus="current" batchStopped batchChapterNumber={4} locale="en-US" />)
    expect(html).toContain('Start a new batch from Chapter 4')
  })
})
