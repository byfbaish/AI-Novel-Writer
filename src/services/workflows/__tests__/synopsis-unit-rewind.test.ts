import { describe, expect, it } from 'vitest'

import { planSynopsisUnitRewind } from '../synopsis-unit-rewind'
import { archStepCheckpointKeys } from '../arch-step-checkpoint'
import { isUsableSynopsisCheckpoint, synopsisFactsFingerprint } from '../commands/architecture.command'
import { renderPlotOutlineSynopsis } from '../../../shared/plot-outline-contract'

const expected = {
  synopsis: '',
  premise: 'p',
  charactersArch: 'c',
  worldbuilding: 'w',
  plotStructurePlan: 'plan',
  genre: 'g',
  totalChapters: 150,
  wordsPerChapter: 3000,
  writingLanguage: 'zh-CN' as const,
  plotStructure: '',
  narrativePov: '',
  globalGuidance: '',
}

function outline(lines: string[]): string {
  return `# 情节大纲\n\n${lines.join('\n')}`
}

describe('planSynopsisUnitRewind', () => {
  it('只有第 1 卷第 1 单元 ⇒ 回退到全书起点，游标归初始', () => {
    const text = outline([
      '## 第1卷第1单元第1章（全书第1章）：溃烂',
      '正文。',
      '## 第1卷第1单元第2章（全书第2章）：药渣',
      '正文。',
    ])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 2, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.range).toEqual({ from: 1, to: 2 })
    expect(result.plan.coveredTo).toBe(0)
    expect(result.plan.cursor).toEqual({ volumeIndex: 1, unitIndex: 1, writtenInVolume: 0 })
    expect(result.plan.removedChapters).toEqual([1, 2])
    // 新正文只剩标题与进度行（没有章条目）
    expect(result.plan.outlineText).toContain('# 情节大纲')
    expect(result.plan.outlineText).not.toContain('第1卷第1单元第1章')
    expect(result.plan.outlineText).toContain('已覆盖至第 0 章')
  })

  it('两个单元 ⇒ 只退最后一个，前面的原样保留', () => {
    const text = outline([
      '## 第1卷第1单元第1章（全书第1章）：甲',
      '正文一。',
      '## 第1卷第1单元第2章（全书第2章）：乙',
      '正文二。',
      '## 第1卷第2单元第1章（全书第3章）：丙',
      '正文三。',
    ])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 3, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.range).toEqual({ from: 3, to: 3 })
    expect(result.plan.coveredTo).toBe(2)
    expect(result.plan.cursor).toEqual({ volumeIndex: 1, unitIndex: 2, writtenInVolume: 2 })
    expect(result.plan.outlineText).toContain('## 第1卷第1单元第2章（全书第2章）：乙')
    expect(result.plan.outlineText).not.toContain('第1卷第2单元第1章')
  })

  it('第二卷的单元：卷内已写章数从本卷首章算，不按全书章号算', () => {
    const text = outline([
      '## 第1卷第1单元第1章（全书第1章）：甲',
      '正文一。',
      '## 第2卷第1单元第1章（全书第31章）：乙',
      '正文二。',
      '## 第2卷第1单元第2章（全书第32章）：丙',
      '正文三。',
    ])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 32, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.range).toEqual({ from: 31, to: 32 })
    expect(result.plan.coveredTo).toBe(30)
    // 卷首章 = 31 ⇒ 水位 30 ⇒ 卷内已写 0 章（这一卷前面没写过）
    expect(result.plan.cursor).toEqual({ volumeIndex: 2, unitIndex: 1, writtenInVolume: 0 })
  })

  it('正文里没有归属标题 ⇒ fail-closed，不猜边界', () => {
    const text = outline(['## 第1章：甲', '正文。', '## 第2章：乙', '正文。'])
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 2, expected,
    })
    expect(result).toEqual({ ok: false, reason: 'no-attribution' })
  })

  it('空大纲 ⇒ nothing-written', () => {
    expect(planSynopsisUnitRewind({
      outlineText: '# 情节大纲', writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 0, expected,
    })).toEqual({ ok: false, reason: 'nothing-written' })
  })

  it('旧进度行不会残留成第二条', () => {
    const text = `${outline(['## 第1卷第1单元第1章（全书第1章）：甲', '正文。'])}\n\n> 本大纲已覆盖至第 1 章（全书 150 章），其余章节将在后续批次继续生成。`
    const result = planSynopsisUnitRewind({
      outlineText: text, writingLanguage: 'zh-CN', totalChapters: 150, coveredTo: 1, expected,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.outlineText.match(/已覆盖至第/g)?.length).toBe(1)
  })
})

describe('回滚后的检查点必须能通过续写校验（2026-10-21 实机 bug 回归）', () => {
  // 真实形态：重写单元后 covered_to 停在目标单元前一章、range 记目标单元、incomplete=false。
  // 第一版把 `synopsis_result` 一起删了、且旧不变式只认 coveredTo === range.to ⇒
  // 点完重写再去生成就报「检查点缺少正文 / 章节范围或进度已损坏」。
  const body = [
    '## 第1卷第1单元第1章（全书第1章）：甲',
    '选择：拖 —— 他请求宽限三日，借口去药渣堆寻药缓解毒性。'.repeat(8),
    '收尾：未决。',
  ].join('\n')

  function checkpoint(overrides: Record<string, unknown> = {}) {
    const expectedForBody = { ...expected, synopsis: body }
    const db = renderPlotOutlineSynopsis(body, 5, expectedForBody)
    return {
      db,
      partial: {
        synopsis_range: { from: 6, to: 7 },
        synopsis_covered_to: 5,
        synopsis_incomplete: false,
        synopsis_result: body,
        synopsis_facts_fingerprint: 'x',
        synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 5 },
        synopsis_db_hash: synopsisFactsFingerprint([db]),
        synopsis_body_hash: synopsisFactsFingerprint([body]),
        ...overrides,
      },
    }
  }

  it('「本批尚未开始」（coveredTo = range.from − 1）是合法状态', () => {
    const { db, partial } = checkpoint()
    expect(isUsableSynopsisCheckpoint(partial, db, 'zh-CN', 150)).toBe(true)
  })

  it('真损坏仍然拒绝：coveredTo 与 range 完全对不上', () => {
    const { db, partial } = checkpoint({ synopsis_covered_to: 3 })
    expect(isUsableSynopsisCheckpoint(partial, db, 'zh-CN', 150)).toBe(false)
  })

  it('缺 synopsis_result 仍然拒绝（正文镜像无从校验）', () => {
    const { db, partial } = checkpoint()
    delete (partial as { synopsis_result?: string }).synopsis_result
    expect(isUsableSynopsisCheckpoint(partial, db, 'zh-CN', 150)).toBe(false)
  })
})

describe('清空架构项时级联作废检查点进度（2026-10-21 实机）', () => {
  it('清前提 ⇒ 前提自己 + 世界观 + 大纲全部作废（链是级联的）', () => {
    const keys = archStepCheckpointKeys('premise')
    expect(keys).toContain('premise_result')
    expect(keys).toContain('world_building_result')
    expect(keys).toContain('synopsis_covered_to')
    expect(keys).toContain('synopsis_unit_cursor')
  })

  it('清世界观 ⇒ 不碰前提，但要清世界观与大纲', () => {
    const keys = archStepCheckpointKeys('worldbuilding')
    expect(keys).not.toContain('premise_result')
    expect(keys).toContain('world_building_result')
    expect(keys).toContain('synopsis_covered_to')
  })

  it('清情节大纲 ⇒ 只清大纲自己的 12 个进度键', () => {
    const keys = archStepCheckpointKeys('synopsis')
    expect(keys.length).toBe(12)
    expect(keys).toContain('synopsis_result')
    expect(keys).toContain('synopsis_db_hash')
    expect(keys).not.toContain('premise_result')
  })

  it('清角色图谱：检查点里没有它的进度，但大纲必须作废（角色也是源事实）', () => {
    const keys = archStepCheckpointKeys('characters')
    expect(keys).toContain('synopsis_covered_to')
    expect(keys).not.toContain('premise_result')
  })

  it('清卷/单元结构 ⇒ 大纲作废', () => {
    expect(archStepCheckpointKeys('plotStructure')).toContain('synopsis_unit_cursor')
  })
})
