import { describe, expect, it } from 'vitest'

import { analyzeBlueprintVerbatimCopy } from '../blueprint-verbatim-overlap'

const EVENT_A = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳'
const EVENT_B = '春夏秋冬风花雪月山川湖海日月星辰'

describe('blueprint verbatim overlap · threshold', () => {
  it('flags an exact run at the floor', () => {
    const report = analyzeBlueprintVerbatimCopy(`前情提要。${EVENT_A}午后。`, EVENT_A)
    expect(report.runs).toHaveLength(1)
    expect(report.runs[0].length).toBe(EVENT_A.length)
    expect(report.coveredUnits).toBe(EVENT_A.length)
  })

  it('ignores a run one unit below the floor', () => {
    const report = analyzeBlueprintVerbatimCopy(`前情提要。${EVENT_A.slice(0, 15)}午后。`, EVENT_A)
    expect(report.runs).toHaveLength(0)
    expect(report.severity).toBe('none')
  })

  it('keeps disjoint runs separate', () => {
    const blueprint = `${EVENT_A}\n${EVENT_B}`
    const report = analyzeBlueprintVerbatimCopy(`${EVENT_A}中间另起一段。${EVENT_B}`, blueprint)
    expect(report.runs).toHaveLength(2)
  })

  it('merges a contiguous three-event block into one run', () => {
    const blueprint = `${EVENT_A}${EVENT_B}甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳`
    const report = analyzeBlueprintVerbatimCopy(blueprint, blueprint)
    expect(report.runs).toHaveLength(1)
    expect(report.runs[0].length).toBe(blueprint.length)
  })

  it('matches across punctuation and full-width differences', () => {
    const report = analyzeBlueprintVerbatimCopy(
      '他推开门,看见父亲坐在黑暗里,手里攥着一张纸。',
      '他推开门，看见父亲坐在黑暗里，手里攥着一张纸。',
    )
    expect(report.runs.length).toBeGreaterThan(0)
  })

  it('takes the excerpt from the prose, not from the normalized text', () => {
    const report = analyzeBlueprintVerbatimCopy(`前情提要。${EVENT_A}午后。`, EVENT_A)
    expect(report.runs[0].excerpt).toContain(EVENT_A)
  })
})

describe('blueprint verbatim overlap · severity', () => {
  it('returns none for an empty blueprint', () => {
    const report = analyzeBlueprintVerbatimCopy('他推开门，屋里没有人。', '')
    expect(report.severity).toBe('none')
    expect(report.ratio).toBe(0)
  })

  it('returns none when the prose does not reuse the blueprint', () => {
    const report = analyzeBlueprintVerbatimCopy('他推开门，屋里没有人。风从窗缝里挤进来。', EVENT_A)
    expect(report.severity).toBe('none')
  })

  it('is advisory when only a small part is reused in several places', () => {
    const filler = '风从窗缝里挤进来，吹得灯焰摇晃。他把外套挂在门后，走进里屋。'.repeat(6)
    const report = analyzeBlueprintVerbatimCopy(
      `${filler}${EVENT_A}${filler}${EVENT_B}${filler}`,
      `${EVENT_A}\n${EVENT_B}`,
    )
    expect(report.runs).toHaveLength(2)
    expect(report.ratio).toBeLessThan(0.25)
    expect(report.severity).toBe('advisory')
  })

  it('treats a single short run as coincidence', () => {
    const filler = '风从窗缝里挤进来，吹得灯焰摇晃。他把外套挂在门后，走进里屋。'.repeat(6)
    const report = analyzeBlueprintVerbatimCopy(`${filler}${EVENT_A}${filler}`, EVENT_A)
    expect(report.runs).toHaveLength(1)
    expect(report.severity).toBe('none')
  })

  it('is blocking when the prose is mostly the blueprint', () => {
    const report = analyzeBlueprintVerbatimCopy(`${EVENT_A}${EVENT_B}`, `${EVENT_A}${EVENT_B}`)
    expect(report.ratio).toBe(1)
    expect(report.severity).toBe('blocking')
  })
})

describe('blueprint verbatim overlap · english', () => {
  it('uses the English floor', () => {
    const short = 'abcdefghijklmnopqrstuvwxyzabcd'
    expect(analyzeBlueprintVerbatimCopy(`Something happened. ${short} then.`, short, { writingLanguage: 'en-US' }).runs).toHaveLength(0)

    const long = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuv'
    expect(analyzeBlueprintVerbatimCopy(`Something happened. ${long} then.`, long, { writingLanguage: 'en-US' }).runs.length).toBeGreaterThan(0)
  })
})

describe('blueprint verbatim overlap · real shape', () => {
  it('detects an event string produced by the key-event projection', () => {
    // 模拟 keyEventsText 的输出形状：多条事件以换行连接。正文逐字搬运其中一条。
    const blueprintText = [
      '他推开门，看见父亲坐在黑暗里，手里攥着一张纸。',
      '父亲把纸递过来，说这是你母亲留下的。',
      '他低头看纸上的字，认出那是母亲的笔迹。',
    ].join('\n')
    const prose = [
      '雨停了。他站在门口，手放在门把上，迟迟没有推开。',
      '他推开门，看见父亲坐在黑暗里，手里攥着一张纸。',
      '屋子里的空气是凉的，混着旧木头和烟的味道。',
    ].join('\n')

    const report = analyzeBlueprintVerbatimCopy(prose, blueprintText)
    expect(report.runs.length).toBeGreaterThan(0)
    expect(report.runs[0].excerpt).toContain('他推开门，看见父亲坐在黑暗里')
  })
})
