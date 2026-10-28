import { describe, expect, it } from 'vitest'
import {
  normalizeStoryBeatKey,
  STORY_BEATS,
  STORY_BEAT_KEYS,
  storyBeatCatalogMarkdown,
  storyBeatEnumDoc,
  storyBeatFitsSpan,
  storyBeatOf,
  storyBeatRulesMarkdown,
  storyBeatSpanText,
  storyBeatSpanVerdict,
} from '../story-beats'

/**
 * 节拍库是**唯一事实源**：`getPlotStructureGuide`（全书引导）、卷纲模板里的可选表、
 * 以及 `arc-position.ts` 的体检都从它取名字与跨度。这里守的是三件事：
 *
 * 1. 词表不重复、不空洞（重复键会让 `normalizeStoryBeatKey` 静默取第一个）；
 * 2. **中英两套拍序条数必须一致** —— 英文是独立手写的一份，漏一条不会报错，
 *    只会在英文项目里少一拍（这正是 `prompt-language.ts` 的老毛病）；
 * 3. 跨度判定与"只定两端"的措辞不能退回去按百分比切章。
 */
describe('节拍库：词表完整性', () => {
  it('键与条目一一对应，且没有重复的名字', () => {
    expect(STORY_BEATS.map(beat => beat.key)).toEqual([...STORY_BEAT_KEYS])
    expect(new Set(STORY_BEATS.map(beat => beat.key)).size).toBe(STORY_BEATS.length)
    expect(new Set(STORY_BEATS.map(beat => beat.zh)).size).toBe(STORY_BEATS.length)
    expect(new Set(STORY_BEATS.map(beat => beat.en)).size).toBe(STORY_BEATS.length)
  })

  it('每套拍子的中文拍序与英文拍序条数一致（防中英漂移）', () => {
    for (const beat of STORY_BEATS) {
      expect(beat.slotsZh.length, `${beat.zh} 的中英拍序条数不一致`).toBe(beat.slotsEn.length)
    }
  })

  it('只有 freeform 允许不预设拍序，且它必须给出下限', () => {
    const empty = STORY_BEATS.filter(beat => beat.slotsZh.length === 0)
    expect(empty.map(beat => beat.key)).toEqual(['freeform'])
    expect(empty[0]!.guideZh?.trim()).toBeTruthy()
    expect(empty[0]!.guideEn?.trim()).toBeTruthy()
  })
})

describe('节拍库：名字归一', () => {
  it('键、中文名、英文名、别名都能认', () => {
    expect(normalizeStoryBeatKey('three_act')).toBe('three_act')
    expect(normalizeStoryBeatKey('三幕')).toBe('three_act')
    // 旧枚举里同时存过两种中文写法，任一个都必须认出来
    expect(normalizeStoryBeatKey('三幕式')).toBe('three_act')
    expect(normalizeStoryBeatKey('三幕结构')).toBe('three_act')
    expect(normalizeStoryBeatKey('Three-act')).toBe('three_act')
    expect(normalizeStoryBeatKey('七点结构')).toBe('seven_point')
    expect(normalizeStoryBeatKey('3+2+1')).toBe('escalation_321')
  })

  it('认不出就是 null，不猜', () => {
    expect(normalizeStoryBeatKey('四幕')).toBeNull()
    expect(normalizeStoryBeatKey('')).toBeNull()
    expect(normalizeStoryBeatKey(null)).toBeNull()
  })
})

describe('节拍库：跨度', () => {
  const threeAct = storyBeatOf('three_act')!
  const freeform = storyBeatOf('freeform')!

  it('三幕装得下一卷，装不下整本', () => {
    expect(storyBeatFitsSpan(threeAct, 21)).toBe(true)
    expect(storyBeatFitsSpan(threeAct, 3)).toBe(false)
    expect(storyBeatFitsSpan(threeAct, 150)).toBe(false)
  })

  it('不设上限的拍子对任意章数都合规', () => {
    expect(storyBeatFitsSpan(freeform, 3)).toBe(true)
    expect(storyBeatFitsSpan(freeform, 800)).toBe(true)
  })

  it('全书 150 章用三幕 ⇒ 明确写「只定两端」，不写百分比切章', () => {
    const verdict = storyBeatSpanVerdict(threeAct, 150, 'zh-CN')
    expect(verdict.fits).toBe(false)
    expect(verdict.text).toContain('只定')
    expect(verdict.text).toContain('两端')
    expect(verdict.text).toContain('不要在这里按百分比切章')
  })

  it('全书 20 章用三幕 ⇒ 装得下，但仍不按百分比切章', () => {
    const verdict = storyBeatSpanVerdict(threeAct, 20, 'zh-CN')
    expect(verdict.fits).toBe(true)
    expect(verdict.text).toContain('不要按百分比切章')
  })

  it('跨度文案中英都没有空串', () => {
    for (const beat of STORY_BEATS) {
      expect(storyBeatSpanText(beat, 'zh-CN').trim()).not.toBe('')
      expect(storyBeatSpanText(beat, 'en-US').trim()).not.toBe('')
    }
  })
})

describe('节拍库：交给 prompt 的两块文本', () => {
  it('可选表是 4 列表，行数 = 表头 2 + 节拍数', () => {
    for (const language of ['zh-CN', 'en-US'] as const) {
      const rows = storyBeatCatalogMarkdown(language).split('\n')
      expect(rows).toHaveLength(STORY_BEATS.length + 2)
      for (const beat of STORY_BEATS) {
        expect(rows.some(row => row.startsWith(`| ${language === 'en-US' ? beat.en : beat.zh} |`))).toBe(true)
      }
    }
  })

  it('规则是五条，且都在讲可判定的东西', () => {
    const rules = storyBeatRulesMarkdown('zh-CN')
    expect(rules.split('\n')).toHaveLength(5)
    expect(rules).toContain('相邻两个单元不许同拍')
    expect(rules).toContain('同一卷内')
    expect(rules).toContain('拍子必须匹配篇幅')
    // 「一层一套」是防"叠层"的闸门，丢了这条整个改动就退化成模板填空
    expect(rules).toContain('每一层只准一套')
  })

  it('枚举说明覆盖全部键', () => {
    const doc = storyBeatEnumDoc('zh-CN')
    for (const key of STORY_BEAT_KEYS) expect(doc).toContain(`${key}=`)
  })
})
