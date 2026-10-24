import { describe, expect, it } from 'vitest'
import {
  isVolumeHandoffEmpty,
  renderVolumeHandoffSection,
  VOLUME_HANDOFF_MAX_CHARS,
  VOLUME_HANDOFF_MAX_DEBTS,
  VOLUME_HANDOFF_MAX_EVENTS,
  VOLUME_HANDOFF_MAX_ITEMS,
  type VolumeHandoffDefinition,
} from '../volume-handoff'
import { VOLUME_HANDOFF_CHARS } from '../outline-prefix-budget'

/**
 * P1-2 期 1 · 卷末交接单渲染。
 *
 * 这一节是**正文链每一次请求**都会带上的背景（含续写轮、压缩轮），所以钉死五件事：
 * 1. 六项全空 ⇒ 空串（不留只有标题的空节）；
 * 2. 一项都装不进预算 ⇒ 整节空串（不是「注入了 1 条，内容是省略说明」）；
 * 3. 条数与字数上限按常量生效，超出**整条丢弃**并补省略行；
 * 4. 节首必须写**本章章号**（不然模型会把「上一卷」当成「上一章」）；
 * 5. 中英逐字对齐（标点、破折号、括号都不许漂）。
 */
function handoff(patch: Partial<VolumeHandoffDefinition> = {}): VolumeHandoffDefinition {
  return {
    handoffId: 'handoff:1',
    volumeIndex: 2,
    firstChapter: 21,
    lastChapter: 40,
    worldState: '',
    heroState: '',
    events: [],
    items: [],
    debts: [],
    openThread: '',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...patch,
  }
}

const FULL = handoff({
  worldState: '灵潮退去，北境三城封关',
  heroState: '顾长风的左臂仍未复原',
  events: ['玄火令被夺', '沈砚投靠监天台'],
  items: ['玄火令在监天台手中'],
  debts: ['欠沈砚一条命'],
  openThread: '监天台为何要玄火令',
})

describe('renderVolumeHandoffSection', () => {
  it('null ⇒ 空串（第一卷 / 还没登记时零字节）', () => {
    expect(renderVolumeHandoffSection(null, 'zh-CN', 45)).toBe('')
  })

  it('六项全空 ⇒ 空串，不是只有标题的空节', () => {
    expect(renderVolumeHandoffSection(handoff(), 'zh-CN', 45)).toBe('')
    expect(renderVolumeHandoffSection(handoff({ worldState: '   ', events: ['  '] }), 'zh-CN', 45)).toBe('')
  })

  it('只有 worldState ⇒ 只有那一行正文', () => {
    const text = renderVolumeHandoffSection(handoff({ worldState: '灵潮退去' }), 'zh-CN', 45)
    const body = text.split('\n').slice(2)
    expect(body).toEqual(['- 卷末世界：灵潮退去'])
  })

  it('worldState 本身就超 1500 字 ⇒ 整节空串（规则 5）', () => {
    const huge = '墨'.repeat(VOLUME_HANDOFF_MAX_CHARS + 1)
    expect(renderVolumeHandoffSection(handoff({ worldState: huge }), 'zh-CN', 45)).toBe('')
    expect(VOLUME_HANDOFF_MAX_CHARS).toBe(VOLUME_HANDOFF_CHARS)
  })

  it('事件 7 条 ⇒ 只装 5 条（条数上限先于字数生效）', () => {
    const events = ['甲', '乙', '丙', '丁', '戊', '己', '庚']
    const text = renderVolumeHandoffSection(handoff({ events }), 'zh-CN', 45)
    const bullets = text.split('\n').filter(line => line.startsWith('  - '))
    expect(bullets).toHaveLength(VOLUME_HANDOFF_MAX_EVENTS)
    expect(bullets).toEqual(['  - 甲', '  - 乙', '  - 丙', '  - 丁', '  - 戊'])
    // 有丢弃就要有省略行（规则 3：省略行本身不计入 maxChars）。
    expect(text.endsWith('（本条已按篇幅省略，未列出的内容以定稿原文为准）')).toBe(true)
  })

  it('债 5 条 ⇒ 只装 3 条', () => {
    const debts = ['一', '二', '三', '四', '五']
    const text = renderVolumeHandoffSection(handoff({ debts }), 'zh-CN', 45)
    const bullets = text.split('\n').filter(line => line.startsWith('  - '))
    expect(bullets).toHaveLength(VOLUME_HANDOFF_MAX_DEBTS)
    expect(bullets).toEqual(['  - 一', '  - 二', '  - 三'])
  })

  it('超字预算 ⇒ 后续项全丢 + 末尾省略行；且标题与说明句不计入预算', () => {
    // 60 字上限 < 「标题 + 说明句」的长度（约 110 字），所以这一条同时证明规则 1。
    const text = renderVolumeHandoffSection(FULL, 'zh-CN', 45, 60)
    expect(text).toContain('- 卷末世界：灵潮退去，北境三城封关')
    expect(text).toContain('- 卷末主角：顾长风的左臂仍未复原')
    expect(text).toContain('  - 玄火令被夺')
    // 第二条事件装不进 60 字 ⇒ break，后续（物品 / 债 / 未决）一并丢弃。
    expect(text).not.toContain('沈砚投靠监天台')
    expect(text).not.toContain('- 关键物品：')
    expect(text).not.toContain('- 卷末未决：')
    expect(text.split('\n').at(-1)).toBe('（本条已按篇幅省略，未列出的内容以定稿原文为准）')
  })

  it('节首写的是**本章**章号（45），不是第 1 章', () => {
    const text = renderVolumeHandoffSection(FULL, 'zh-CN', 45)
    expect(text.split('\n')[1]).toContain('本章为第45章')
    expect(text.split('\n')[1]).not.toContain('本章为第1章')
  })

  it('中文完整快照逐字比对（括号 / 间隔号 / 破折号 / 全角冒号）', () => {
    expect(renderVolumeHandoffSection(FULL, 'zh-CN', 45)).toBe([
      '【上一卷交接（第2卷 · 全书第21–40章）】',
      '以下是从第2卷交接下来的事实，本章为第45章；只写下一卷要用的，不是编年史。与已定稿原文冲突时以定稿原文为准。',
      '- 卷末世界：灵潮退去，北境三城封关',
      '- 卷末主角：顾长风的左臂仍未复原',
      '- 待承接的事件：',
      '  - 玄火令被夺',
      '  - 沈砚投靠监天台',
      '- 关键物品：',
      '  - 玄火令在监天台手中',
      '- 未结清的债：',
      '  - 欠沈砚一条命',
      '- 卷末未决：监天台为何要玄火令',
    ].join('\n'))
  })

  it('英文对称实现', () => {
    expect(renderVolumeHandoffSection(FULL, 'en-US', 45)).toBe([
      '[Previous volume handoff (Volume 2 · chapters 21–40 of the book)]',
      'These facts were handed over from Volume 2; this chapter is Chapter 45; keep only what the next volume needs — this is not a chronicle. Where it conflicts with the finalized text, the finalized text prevails.',
      '- World at volume end: 灵潮退去，北境三城封关',
      '- Protagonist at volume end: 顾长风的左臂仍未复原',
      '- Events to carry forward:',
      '  - 玄火令被夺',
      '  - 沈砚投靠监天台',
      '- Key items:',
      '  - 玄火令在监天台手中',
      '- Outstanding debts:',
      '  - 欠沈砚一条命',
      '- Unresolved at volume end: 监天台为何要玄火令',
    ].join('\n'))
  })

  it('isVolumeHandoffEmpty：空白字符也算空', () => {
    expect(isVolumeHandoffEmpty(null)).toBe(true)
    expect(isVolumeHandoffEmpty(handoff())).toBe(true)
    expect(isVolumeHandoffEmpty(handoff({ worldState: '  ', heroState: '\n', openThread: '\t' }))).toBe(true)
    expect(isVolumeHandoffEmpty(handoff({ events: ['  ', ''] }))).toBe(true)
    expect(isVolumeHandoffEmpty(handoff({ openThread: '未决' }))).toBe(false)
    expect(isVolumeHandoffEmpty(handoff({ items: ['玄火令'] }))).toBe(false)
  })

  it('条数上限常量与实现一致（改常量必须同步改节）', () => {
    const events = Array.from({ length: VOLUME_HANDOFF_MAX_EVENTS + 1 }, (_, index) => `事件${index}`)
    const items = Array.from({ length: VOLUME_HANDOFF_MAX_ITEMS + 1 }, (_, index) => `物品${index}`)
    const text = renderVolumeHandoffSection(handoff({ events, items }), 'zh-CN', 45)
    const bullets = text.split('\n').filter(line => line.startsWith('  - '))
    expect(bullets).toHaveLength(VOLUME_HANDOFF_MAX_EVENTS + VOLUME_HANDOFF_MAX_ITEMS)
    expect(bullets).toContain(`  - 物品${VOLUME_HANDOFF_MAX_ITEMS - 1}`)
    expect(bullets).not.toContain(`  - 物品${VOLUME_HANDOFF_MAX_ITEMS}`)
  })
})
