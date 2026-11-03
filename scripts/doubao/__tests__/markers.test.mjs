import { describe, expect, it } from 'vitest'

import { extractMarkers, isTemplateMarker, parseMarkerLine } from '../markers.mjs'

/**
 * 用例全部取自真实值班场景：正是「任务书里写了格式示例」那一轮把 `[T1] DONE`
 * 当成真标记报了出来的，所以回归样本用页面真实文本，不用编造的简化串。
 */
describe('extractMarkers', () => {
  it('读出真标记（markdown 标题已渲染，`##` 丢失）', () => {
    const text = ['[T3] DONE 补完 actual/headings 两档', '2026-11-03T01:40:12Z', '[T4] BLOCKED 缺 mkdir 权限'].join('\n')
    expect(extractMarkers(text)).toEqual([
      { marker: 'T3', state: 'DONE', note: '补完 actual/headings 两档', timestamp: '2026-11-03T01:40:12Z' },
      { marker: 'T4', state: 'BLOCKED', note: '缺 mkdir 权限', timestamp: null },
    ])
  })

  it('保留 `##` 前缀时同样识别', () => {
    expect(extractMarkers('## [QUEUE] EMPTY')).toEqual([
      { marker: 'QUEUE', state: 'EMPTY', note: '', timestamp: null },
    ])
  })

  it('任务书正文里的格式示例不算标记（本轮真 bug 的回归样本）', () => {
    const pageText = [
      '本轮清单：',
      '',
      '## [T1] DONE|BLOCKED|SKIPPED <一句话说明>',
      '2026-11-03T01:40:12Z',
      '',
      '每项结束都要按上面格式回报。',
    ].join('\n')
    expect(extractMarkers(pageText)).toEqual([])
  })

  it('只有占位符的 note 也算模板行', () => {
    expect(extractMarkers('## [T2] DONE <一句话说明>')).toEqual([])
    expect(extractMarkers('## [T2] DONE （一句话说明）')).toEqual([])
    expect(extractMarkers('## [T2] DONE (说明)')).toEqual([])
  })

  it('真标记后面跟普通短语不会被误杀', () => {
    const markers = extractMarkers('[T5] DONE 只改了 src/shared，未动 electron/')
    expect(markers).toHaveLength(1)
    expect(markers[0].note).toBe('只改了 src/shared，未动 electron/')
  })

  it('note 里出现竖线但不是枚举模板时保留', () => {
    const markers = extractMarkers('[T6] DONE 表格：a | b | c 三列已补齐')
    expect(markers).toHaveLength(1)
  })

  it('时间戳允许落在标记行后两行内，第三行不算', () => {
    const near = ['[T1] DONE x', '', '2026-11-03T02:00:00Z'].join('\n')
    expect(extractMarkers(near)[0].timestamp).toBe('2026-11-03T02:00:00Z')

    const far = ['[T1] DONE x', '', '', '2026-11-03T02:00:00Z'].join('\n')
    expect(extractMarkers(far)[0].timestamp).toBeNull()
  })

  it('大小写与前后空白归一化，note 截到 160 字符', () => {
    const longNote = '很长的说明'.repeat(60)
    const [marker] = extractMarkers(`   ## [t7]  done   ${longNote}   `)
    expect(marker.marker).toBe('T7')
    expect(marker.state).toBe('DONE')
    expect(marker.note).toHaveLength(160)
  })

  it('不认识的状态 / 没有方括号的裸 DONE 一律不算', () => {
    expect(extractMarkers('[T1] FINISHED 做完了')).toEqual([])
    expect(extractMarkers('T1 DONE 做完了')).toEqual([])
    expect(extractMarkers('[DONE] 做完了')).toEqual([])
  })

  it('空输入与 undefined 安全返回空数组', () => {
    expect(extractMarkers('')).toEqual([])
    expect(extractMarkers(undefined)).toEqual([])
  })

  it('parseMarkerLine / isTemplateMarker 单行视角与整体一致', () => {
    expect(parseMarkerLine('[T1] DONE 收工')?.marker).toBe('T1')
    expect(parseMarkerLine('## [T1] DONE|BLOCKED|SKIPPED <一句话说明>')).toBeNull()
    expect(isTemplateMarker('## [T1] DONE|BLOCKED 两选一', '|BLOCKED 两选一')).toBe(true)
    expect(isTemplateMarker('[T1] DONE 收工', '收工')).toBe(false)
  })
})
