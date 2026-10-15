import { describe, expect, it } from 'vitest'

import { BOUNDARY_EVENT_MAX_CHARS, toBoundaryNotice } from '../chapter-boundary'
import type { BlueprintKeyEvent } from '../blueprint-key-events'

const events = (...texts: string[]): BlueprintKeyEvent[] =>
  texts.map((event, index) => ({ id: `ch1:E${index + 1}`, event, estimatedUnits: 0 }))

describe('toBoundaryNotice', () => {
  it('单条事件并入章标题行', () => {
    expect(toBoundaryNotice('zh-CN', {
      chapters: [{ chapterNumber: 2, title: '升职第一天', keyEvents: events('他回到大厦。又走了。') }],
    })).toBe('- 第2章《升职第一天》：他回到大厦。')
  })

  it('多条事件改为章标题行 + 缩进子项（逐条枚举，不合并）', () => {
    expect(toBoundaryNotice('zh-CN', {
      chapters: [{
        chapterNumber: 6,
        title: '调查员',
        keyEvents: events('他全天沉默。', '王浩密报：林恪调走了签署页；', '林恪当面追问。'),
      }],
    })).toBe([
      '- 第6章《调查员》：',
      '  - 他全天沉默。',
      '  - 王浩密报：林恪调走了签署页；',
      '  - 林恪当面追问。',
    ].join('\n'))
  })

  it('按章分组并保持调用方给定的升序', () => {
    const notice = toBoundaryNotice('zh-CN', {
      chapters: [
        { chapterNumber: 2, title: '甲', keyEvents: events('甲事。') },
        { chapterNumber: 3, title: '乙', keyEvents: events('乙事。') },
      ],
    })
    expect(notice.split('\n')).toEqual(['- 第2章《甲》：甲事。', '- 第3章《乙》：乙事。'])
  })

  it('没有后续章节（空数组）⇒ 空串', () => {
    expect(toBoundaryNotice('zh-CN', { chapters: [] })).toBe('')
    expect(toBoundaryNotice('en-US', { chapters: [] })).toBe('')
  })

  it('没有事件的章整章略去；全部无事件 ⇒ 空串', () => {
    expect(toBoundaryNotice('zh-CN', {
      chapters: [
        { chapterNumber: 2, title: '空章', keyEvents: [] },
        { chapterNumber: 3, title: '有事件', keyEvents: events('乙事。') },
      ],
    })).toBe('- 第3章《有事件》：乙事。')
    expect(toBoundaryNotice('zh-CN', {
      chapters: [
        { chapterNumber: 2, title: '空串', keyEvents: '' },
        { chapterNumber: 3, title: '缺值', keyEvents: null },
        { chapterNumber: 4, title: '未定义', keyEvents: undefined },
      ],
    })).toBe('')
  })

  it('旧字符串形态（；/换行分隔）照常逐条枚举', () => {
    expect(toBoundaryNotice('zh-CN', {
      chapters: [{ chapterNumber: 4, title: '旧数据', keyEvents: '甲事。；乙事。' }],
    })).toBe('- 第4章《旧数据》：\n  - 甲事。\n  - 乙事。')
  })

  it('单条超长事件截断到 80 字并加省略号', () => {
    const long = `${'长'.repeat(200)}。`
    const notice = toBoundaryNotice('zh-CN', {
      chapters: [{ chapterNumber: 7, title: '长句', keyEvents: events(long) }],
    })
    const label = notice.slice(notice.indexOf('：') + 1)
    expect(label).toHaveLength(BOUNDARY_EVENT_MAX_CHARS + 1)
    expect(label.endsWith('…')).toBe(true)
    expect(label).not.toContain('。')
  })

  it('没有终止标点时整段保留（仍受 80 字上限约束）', () => {
    expect(toBoundaryNotice('zh-CN', {
      chapters: [{ chapterNumber: 5, title: '无标点', keyEvents: events('他只是站着') }],
    })).toBe('- 第5章《无标点》：他只是站着')
  })

  it('英文半角句号只在后跟空白或行尾时才算句末（小数点不误切）', () => {
    expect(toBoundaryNotice('en-US', {
      chapters: [{ chapterNumber: 3, title: 'Decimal', keyEvents: events('He was 3.5 meters away. Then the alarm rang.') }],
    })).toBe('- Chapter 3 — Decimal: He was 3.5 meters away.')
  })

  it('中文与英文形态对称', () => {
    const chapters = [{ chapterNumber: 2, title: 'Echo', keyEvents: events('He returns. Then he leaves.') }]
    expect(toBoundaryNotice('zh-CN', { chapters })).toBe('- 第2章《Echo》：He returns.')
    expect(toBoundaryNotice('en-US', { chapters })).toBe('- Chapter 2 — Echo: He returns.')
  })

  it('英文多条事件同样改用缩进子项', () => {
    expect(toBoundaryNotice('en-US', {
      chapters: [{ chapterNumber: 6, title: 'Investigator', keyEvents: events('He stays silent.', 'Wang tips him off.') }],
    })).toBe('- Chapter 6 — Investigator:\n  - He stays silent.\n  - Wang tips him off.')
  })

  it('负向：压缩后严格短于逐字全文，且不再包含后续章的事件全文', () => {
    const raw = [
      '甲事件的首句要点。后面还有很长很长的补充说明文字，全部都可以丢掉。',
      '乙事件的首句要点。后面同样跟着大段大段的细节描写，也都可以丢掉。',
    ]
    const notice = toBoundaryNotice('zh-CN', {
      chapters: [{ chapterNumber: 2, title: '甲', keyEvents: events(...raw) }],
    })
    expect(notice.length).toBeLessThan(raw.join('').length)
    for (const text of raw) expect(notice).not.toContain(text)
  })
})
