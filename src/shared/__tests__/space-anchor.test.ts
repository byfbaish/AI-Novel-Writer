import { describe, expect, it } from 'vitest'
import {
  evaluateSpaceAccess,
  findMentionedSpaces,
  parseChapterSceneAnchors,
  parseChapterSpaceAnchor,
} from '../space-anchor'

/**
 * 测试重点不是「能判」，而是**判不了时必须是 unknown**（判据 CL）：
 * 缺时点、缺地点、窗口按日历日定义、中文时段词、日序打架 —— 每一种都不许折成合规。
 */

const NOTES = `# 第4章 要点

## 时间定位
- 故事日：7
- 书中写法：二月廿七
- 时段：14:30
- 依据：正文「申时三刻」

## 地点
- 执法殿：主角在审讯室接受问话
- 藏书阁·外楼

## 剧情节点
- [触发] 15:00 的钟声（这是事件时间，不是本章时点）
`

const TIME_ONLY = `# 第5章 要点

## 时间定位
- 故事日：9
- 时段：黄昏
`

const BARE = `# 第6章 要点

## 剧情节点
- [触发] 林岚进入北塔。
`

describe('parseChapterSpaceAnchor', () => {
  it('解析成功：日序、时点、地点各取各的栏目', () => {
    const anchor = parseChapterSpaceAnchor(NOTES)
    expect(anchor.dayOffset).toBe(7)
    expect(anchor.timeOfDay).toBe('14:30')
    expect(anchor.places).toEqual(['执法殿', '藏书阁·外楼'])
  })

  it('时点只在「时间定位」节内抓：剧情节点里的 15:00 不得被当成锚点', () => {
    const anchor = parseChapterSpaceAnchor(NOTES)
    expect(anchor.timeOfDay).not.toBe('15:00')
    const bodyOnly = parseChapterSpaceAnchor(`## 剧情节点\n- [触发] 15:00 的钟声\n`)
    expect(bodyOnly.timeOfDay).toBeNull()
  })

  it('栏目缺失时三项都为空：null / null / []（不填 0，不猜地点）', () => {
    expect(parseChapterSpaceAnchor(BARE)).toEqual({ dayOffset: null, timeOfDay: null, places: [] })
    expect(parseChapterSpaceAnchor('')).toEqual({ dayOffset: null, timeOfDay: null, places: [] })
  })

  it('中文时段词逐字保留，不折算成钟点', () => {
    const anchor = parseChapterSpaceAnchor(TIME_ONLY)
    expect(anchor.timeOfDay).toBe('黄昏')
    expect(anchor.dayOffset).toBe(9)
  })

  it('日序复用 parseStoryDayAnchor：写「未定」就是 null', () => {
    expect(parseChapterSpaceAnchor('## 时间定位\n- 故事日：未定\n- 时段：14:00\n').dayOffset).toBeNull()
  })

  it('不把说明文字当成地点名（冒号后是描述，只取名字）', () => {
    const anchor = parseChapterSpaceAnchor(`## 地点\n- 地点：执法殿·审讯室（阴森压抑）\n`)
    expect(anchor.places).toEqual(['执法殿·审讯室'])
  })

  it('地点表只取第一列，表头与分隔行跳过', () => {
    const anchor = parseChapterSpaceAnchor(`## 场景\n| 地点 | 说明 |\n|---|---|\n| 外门广场 | 必经之地 |\n`)
    expect(anchor.places).toEqual(['外门广场'])
  })

  it('仅当给出白名单时才做提及扫描', () => {
    const notes = `${BARE}\n她路过执法殿，没有进去。\n`
    expect(parseChapterSpaceAnchor(notes).places).toEqual([])
    expect(parseChapterSpaceAnchor(notes, { knownSpaces: ['执法殿', '藏书阁'] }).places).toEqual(['执法殿'])
  })

  it('白名单里少于 2 个字的项不参与匹配（避免单字误命中）', () => {
    expect(findMentionedSpaces('她路过执法殿', ['殿', '执法殿'])).toEqual(['执法殿'])
    expect(findMentionedSpaces('', ['执法殿'])).toEqual([])
  })
})

describe('evaluateSpaceAccess', () => {
  const at = (timeOfDay: string | null, places: string[] = [], dayOffset: number | null = 7) => ({
    dayOffset,
    timeOfDay,
    places,
  })

  it('窗口内：14:30 落在 14:00-16:00', () => {
    expect(evaluateSpaceAccess(at('14:30', ['执法殿']), '执法殿', '14:00-16:00', 7))
      .toMatchObject({ verdict: 'inside' })
  })

  it('窗口外：16:30 不在 09:00-12:00', () => {
    expect(evaluateSpaceAccess(at('16:30', ['藏书阁·外楼']), '藏书阁·外楼', '09:00-12:00', 7))
      .toMatchObject({ verdict: 'outside' })
  })

  it('24:00 结束按当日结束处理，23:00 仍在窗口内', () => {
    expect(evaluateSpaceAccess(at('23:00', ['试炼峰']), '试炼峰', '当日00:00-24:00', 7))
      .toMatchObject({ verdict: 'inside' })
  })

  it('跨夜窗口按并集判定（与 isWithinWindow 同口径）', () => {
    expect(evaluateSpaceAccess(at('23:30', ['夜市']), '夜市', '22:00-02:00', 7).verdict).toBe('inside')
    expect(evaluateSpaceAccess(at('01:30', ['夜市']), '夜市', '22:00-02:00', 7).verdict).toBe('inside')
    expect(evaluateSpaceAccess(at('12:00', ['夜市']), '夜市', '22:00-02:00', 7).verdict).toBe('outside')
  })

  it('中文时段词 ⇒ unknown 并说明不换算', () => {
    const result = evaluateSpaceAccess(at('黄昏', ['执法殿']), '执法殿', '14:00-16:00', 7)
    expect(result.verdict).toBe('unknown')
    expect(result.reason).toContain('24 小时制')
  })

  it('时点缺失 ⇒ unknown（只有日序不能定钟点）', () => {
    expect(evaluateSpaceAccess(at(null, ['执法殿']), '执法殿', '14:00-16:00', 7).verdict).toBe('unknown')
    expect(evaluateSpaceAccess(null, '执法殿', '14:00-16:00', 7).verdict).toBe('unknown')
  })

  it('空间名不在已登记名单 ⇒ unknown', () => {
    const result = evaluateSpaceAccess(at('14:30'), '试炼峰', '14:00-16:00', 7, { knownSpaces: ['执法殿', '藏书阁'] })
    expect(result.verdict).toBe('unknown')
    expect(result.reason).toContain('名单')
  })

  it('要点列了地点、但没点名该空间 ⇒ unknown（有「不在那儿」的证据）', () => {
    const result = evaluateSpaceAccess(at('14:30', ['藏书阁·外楼']), '执法殿', '14:00-16:00', 7)
    expect(result.verdict).toBe('unknown')
    expect(result.reason).toContain('藏书阁·外楼')
  })

  it('要点没列地点时不单独判 unknown，但 reason 里写清依据（按调用方给出的空间）', () => {
    const result = evaluateSpaceAccess(at('14:30'), '执法殿', '14:00-16:00', 7)
    expect(result.verdict).toBe('inside')
    expect(result.reason).toContain('按调用方给出的空间判定')
  })

  it('hours 解析不了 ⇒ unknown', () => {
    expect(evaluateSpaceAccess(at('14:30', ['执法殿']), '执法殿', '日出前后', 7).verdict).toBe('unknown')
    expect(evaluateSpaceAccess(at('14:30', ['执法殿']), '执法殿', null, 7).verdict).toBe('unknown')
    expect(evaluateSpaceAccess(at('14:30', ['执法殿']), '执法殿', '  ', 7).verdict).toBe('unknown')
  })

  it('窗口按日历日定义（每月D日 / 跨日区间）⇒ unknown：锚点没有当月日期', () => {
    expect(evaluateSpaceAccess(at('14:30', ['外门广场']), '外门广场', '每月1日08:00-12:00', 7).verdict).toBe('unknown')
    expect(evaluateSpaceAccess(at('14:30', ['百草园']), '百草园', '每月01日08:00-03日18:00', 7).verdict).toBe('unknown')
  })

  it('日序打架 ⇒ unknown', () => {
    const result = evaluateSpaceAccess(at('14:30', ['执法殿'], 7), '执法殿', '14:00-16:00', 8)
    expect(result.verdict).toBe('unknown')
    expect(result.reason).toContain('不一致')
  })

  it('空间名为空 ⇒ unknown', () => {
    expect(evaluateSpaceAccess(at('14:30'), '   ', '14:00-16:00', 7).verdict).toBe('unknown')
  })
})

/**
 * 章节要点模板自 2026-10-22 起产出 `## 空间锚点` 一节：
 *
 *     - 场景：青阳山·杂役处｜时段：06:15
 *     - 场景：执法殿·审讯室
 */
const NOTES_WITH_SCENE_ANCHORS = `# 第4章 要点

## 时间定位
- 故事日：9
- 书中写法：二月廿九
- 依据：正文说他「卯时起身」

## 空间锚点
- 场景：青阳山·杂役处｜时段：06:15
- 场景：执法殿·审讯室｜时段：14:30
- 场景：百草园·禁地方块｜时段：黄昏

## 剧情节点
- [触发] 15:00 在演武场动了手
`

describe('parseChapterSceneAnchors', () => {
  it('每条场景拆成地点 + 时段，顺序保持', () => {
    const scenes = parseChapterSceneAnchors(NOTES_WITH_SCENE_ANCHORS)

    expect(scenes).toEqual([
      { place: '青阳山·杂役处', timeOfDay: '06:15' },
      { place: '执法殿·审讯室', timeOfDay: '14:30' },
      { place: '百草园·禁地方块', timeOfDay: '黄昏' },
    ])
  })

  it('中文时段词原样保留，不折算成钟点', () => {
    const scenes = parseChapterSceneAnchors(NOTES_WITH_SCENE_ANCHORS)

    expect(scenes[2].timeOfDay).toBe('黄昏')
  })

  it('没有时段就是 null（不拿同章别处的钟点补）', () => {
    const notes = ['## 空间锚点', '- 场景：外门广场', '', '## 剧情节点', '- [触发] 15:00 动手'].join('\n')

    expect(parseChapterSceneAnchors(notes)).toEqual([{ place: '外门广场', timeOfDay: null }])
  })

  it('只在该节内解析：别的栏目里的钟点不会被抓', () => {
    const scenes = parseChapterSceneAnchors(NOTES_WITH_SCENE_ANCHORS)

    expect(scenes.some(scene => scene.timeOfDay === '15:00')).toBe(false)
  })

  it('最多 3 条（与模板声明的上限一致）', () => {
    const notes = [
      '## 空间锚点',
      '- 场景：甲｜时段：01:00',
      '- 场景：乙｜时段：02:00',
      '- 场景：丙｜时段：03:00',
      '- 场景：丁｜时段：04:00',
    ].join('\n')

    expect(parseChapterSceneAnchors(notes)).toHaveLength(3)
  })

  it('没有该节 ⇒ 空数组', () => {
    expect(parseChapterSceneAnchors('# 要点\n\n## 剧情节点\n- [触发] 某事')).toEqual([])
    expect(parseChapterSceneAnchors('')).toEqual([])
  })
})

describe('parseChapterSpaceAnchor · 空间锚点节并入 places', () => {
  it('新节的场景名会进 places（栏目全等匹配，不会被旧的「空间」别名误吃）', () => {
    const anchor = parseChapterSpaceAnchor(NOTES_WITH_SCENE_ANCHORS)

    expect(anchor.dayOffset).toBe(9)
    expect(anchor.places).toContain('青阳山·杂役处')
    expect(anchor.places).toContain('执法殿·审讯室')
  })
})
