import { describe, expect, it } from 'vitest'

import { extractMarkers, isTemplateMarker, isTerminalQueueMarker, parseMarkerLine } from '../markers.mjs'

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

  it('保留 `##` 前缀时同样识别（EMPTY 需前面有真 DONE，见终端判据用例）', () => {
    expect(extractMarkers('## [T1] DONE 收工')).toEqual([
      { marker: 'T1', state: 'DONE', note: '收工', timestamp: null },
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

  it('真实回复样本：`## [T9] DONE xxx` 之后跟 `## [QUEUE] EMPTY` ⇒ 读出 2 条标记', () => {
    const text = ['## [T9] DONE 修复 markers 误判', '## [QUEUE] EMPTY'].join('\n')
    expect(extractMarkers(text)).toEqual([
      { marker: 'T9', state: 'DONE', note: '修复 markers 误判', timestamp: null },
      { marker: 'QUEUE', state: 'EMPTY', note: '', timestamp: null },
    ])
  })

  it('任务书整段（正文说明 + 中间一次 EMPTY + 收尾再一次）⇒ 一条 EMPTY 都不读出（本轮要修的故障）', () => {
    const taskBook = [
      '本轮 3 项：T9 写代码 + 单测，T10/T11 只读清点。全部在 wt-1 里做。',
      '',
      '## [T1] DONE|BLOCKED|SKIPPED <一句话说明>',
      '## [T2] DONE <一句话说明>',
      '## [QUEUE] EMPTY',
      '每项做完输出一行 ## [T5] DONE <一句话>，全部做完输出 ## [QUEUE] EMPTY。',
      '',
      '收尾：',
      '## [T5] DONE <一句话>',
      '## [T6] DONE <一句话>',
      '## [QUEUE] EMPTY',
    ].join('\n')
    expect(extractMarkers(taskBook)).toEqual([])
  })

  it('任务书里 `## [T5] DONE <一句话>` 占位符行不读出（已有判据，回归锁）', () => {
    expect(extractMarkers('## [T5] DONE <一句话>')).toEqual([])
  })

  it('空文本 / 只有空白 ⇒ 空数组', () => {
    expect(extractMarkers('')).toEqual([])
    expect(extractMarkers(undefined)).toEqual([])
    expect(extractMarkers('   \n \n\t ')).toEqual([])
  })

  it('只有 `## [QUEUE] EMPTY` 一行、前面没有真 DONE ⇒ 不读出（条件②不满足）', () => {
    expect(extractMarkers('## [QUEUE] EMPTY')).toEqual([])
  })

  it('真 DONE 之后隔了几行文字再出现 EMPTY（不是最后一行）⇒ EMPTY 不读出（条件①不满足）', () => {
    const text = [
      '## [T1] DONE 收工',
      '中间说明一行',
      '中间说明二行',
      '## [QUEUE] EMPTY',
      '还有后续内容',
    ].join('\n')
    const markers = extractMarkers(text)
    expect(markers).toHaveLength(1)
    expect(markers[0]).toEqual({ marker: 'T1', state: 'DONE', note: '收工', timestamp: null })
  })

  it('afterIndex 只扫描最后一条用户消息之后的文本，锚点之前的行不读', () => {
    const anchor = '---- 最后一条用户消息 ----'
    const text = [
      '## [T2] DONE 上一轮的真实完成行（在锚点之前，不应被读到）',
      anchor,
      '## [T9] DONE xxx',
      '## [QUEUE] EMPTY',
    ].join('\n')
    const markers = extractMarkers(text, { afterIndex: text.indexOf(anchor) + anchor.length })
    expect(markers).toHaveLength(2)
    expect(markers[0]).toEqual({ marker: 'T9', state: 'DONE', note: 'xxx', timestamp: null })
    expect(markers[1]).toEqual({ marker: 'QUEUE', state: 'EMPTY', note: '', timestamp: null })
  })

  it('isTerminalQueueMarker 纯函数：两个条件缺一不可', () => {
    const doneThenEmpty = [
      { marker: 'T9', state: 'DONE', note: 'x', line: 0, lastContentLine: 1 },
      { marker: 'QUEUE', state: 'EMPTY', note: '', line: 1, lastContentLine: 1 },
    ]
    expect(isTerminalQueueMarker(doneThenEmpty, 1)).toBe(true)
    // 条件②不满足：前面没有真 DONE
    expect(isTerminalQueueMarker([doneThenEmpty[1]], 0)).toBe(false)
    // 条件①不满足：EMPTY 不在最后一行
    const midEmpty = [
      { marker: 'T9', state: 'DONE', note: 'x', line: 0, lastContentLine: 2 },
      { marker: 'QUEUE', state: 'EMPTY', note: '', line: 1, lastContentLine: 2 },
      { marker: 'T1', state: 'DONE', note: 'y', line: 2, lastContentLine: 2 },
    ]
    expect(isTerminalQueueMarker(midEmpty, 1)).toBe(false)
    // 非 QUEUE/EMPTY 不受终端判据影响
    expect(isTerminalQueueMarker(doneThenEmpty, 0)).toBe(true)
  })
})
