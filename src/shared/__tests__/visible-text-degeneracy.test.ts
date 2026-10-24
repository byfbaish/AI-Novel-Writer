import { describe, expect, it } from 'vitest'

import {
  assertNotDegenerateVisibleText,
  findVisibleTextDegeneracies,
} from '../visible-text-integrity'

const REPEATED_SENTENCE = '他推开门，看见父亲坐在黑暗里。'

describe('visible text degeneracy · verbatim repeat', () => {
  it('reports a long sentence that appears three times', () => {
    const findings = findVisibleTextDegeneracies(`${REPEATED_SENTENCE}\n他走了。\n${REPEATED_SENTENCE}\n${REPEATED_SENTENCE}`)
    const repeat = findings.find(finding => finding.kind === 'verbatim-repeat')
    expect(repeat?.severity).toBe('blocking')
    expect(repeat?.count).toBe(3)
  })

  it('does not report the same sentence appearing twice', () => {
    const findings = findVisibleTextDegeneracies(`${REPEATED_SENTENCE}\n${REPEATED_SENTENCE}`)
    expect(findings).toEqual([])
  })

  it('ignores short dialogue repeated many times', () => {
    const findings = findVisibleTextDegeneracies('好的我知道了。'.repeat(10))
    expect(findings).toEqual([])
  })

  it('reports two identical adjacent paragraphs', () => {
    const findings = findVisibleTextDegeneracies('他推开门走进屋子。\n\n他推开门走进屋子。')
    expect(findings.find(finding => finding.kind === 'verbatim-repeat')?.count).toBe(2)
  })

  it('ignores identical adjacent paragraphs shorter than the floor', () => {
    const findings = findVisibleTextDegeneracies('他来了。\n\n他来了。')
    expect(findings).toEqual([])
  })

  it('subtracts occurrences already present in the source text', () => {
    const source = [REPEATED_SENTENCE, '他走了。', REPEATED_SENTENCE, REPEATED_SENTENCE].join('\n')
    const findings = findVisibleTextDegeneracies(source, { source })
    expect(findings).toEqual([])
  })

  // 回归护栏：正文链夹具大量使用这种结构化重复串，滑窗式判据会把它们全部误杀。
  it('never flags structured fixtures used by existing command tests', () => {
    expect(findVisibleTextDegeneracies('正文'.repeat(2500))).toEqual([])
    expect(findVisibleTextDegeneracies('初'.repeat(100))).toEqual([])
    expect(findVisibleTextDegeneracies('本章正文。'.repeat(125))).toEqual([])
    expect(findVisibleTextDegeneracies('本章正文持续推进。'.repeat(60))).toEqual([])
    expect(findVisibleTextDegeneracies('正'.repeat(450))).toEqual([])
    expect(findVisibleTextDegeneracies('长'.repeat(1400))).toEqual([])
  })
})

describe('visible text degeneracy · placeholder leak', () => {
  it('reports a refusal phrase', () => {
    const findings = findVisibleTextDegeneracies('作为 AI，我无法继续下面的内容。')
    expect(findings.find(finding => finding.kind === 'placeholder-leak')?.severity).toBe('blocking')
  })

  it('reports an explicit omission', () => {
    const findings = findVisibleTextDegeneracies('此处省略 300 字。')
    expect(findings.find(finding => finding.kind === 'placeholder-leak')?.severity).toBe('blocking')
  })

  it('reports replacement characters', () => {
    const findings = findVisibleTextDegeneracies('他走进\uFFFD\uFFFD的房间。')
    expect(findings.find(finding => finding.kind === 'placeholder-leak')).toBeTruthy()
  })

  it('does not flag normal prose', () => {
    expect(findVisibleTextDegeneracies('他推开门，屋里没有人。')).toEqual([])
  })
})

describe('visible text degeneracy · meta leak', () => {
  it('reports writing-process vocabulary as blocking', () => {
    const findings = findVisibleTextDegeneracies('他停了一下。\n本章细纲：先抑后扬。')
    const meta = findings.find(finding => finding.kind === 'meta-leak')
    expect(meta?.severity).toBe('blocking')
  })

  it('does not flag 「下一章」 inside a normal sentence', () => {
    const findings = findVisibleTextDegeneracies('他回头看了一眼，说道，下一章再见。')
    expect(findings).toEqual([])
  })

  it('reports an outline-style short line as advisory', () => {
    const findings = findVisibleTextDegeneracies('本章\n他推开门。')
    const meta = findings.find(finding => finding.kind === 'meta-leak')
    expect(meta?.severity).toBe('advisory')
  })

  it('does not flag a long narrative line that merely contains 「本章」', () => {
    const findings = findVisibleTextDegeneracies('本章正文持续推进。'.repeat(60))
    expect(findings).toEqual([])
  })
})

describe('visible text degeneracy · class filter and language', () => {
  it('honours the class filter used by the short outline path', () => {
    const text = '本章细纲：先抑后扬。'
    expect(findVisibleTextDegeneracies(text, { classes: ['verbatim-repeat', 'placeholder-leak'] })).toEqual([])
    expect(findVisibleTextDegeneracies(text, { classes: ['meta-leak'] }).length).toBe(1)
  })

  it('applies the English floor instead of the Chinese one', () => {
    const shortLine = 'a b c d e f g h i j k l'
    expect(findVisibleTextDegeneracies(`${shortLine}\n${shortLine}\n${shortLine}`, { writingLanguage: 'en-US' })).toEqual([])

    const longSentence = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuv'
    const findings = findVisibleTextDegeneracies(
      `${longSentence}\n${longSentence}\n${longSentence}`,
      { writingLanguage: 'en-US' },
    )
    expect(findings.find(finding => finding.kind === 'verbatim-repeat')?.severity).toBe('blocking')
  })
})

describe('assertNotDegenerateVisibleText', () => {
  it('throws on a blocking degeneracy', () => {
    expect(() => assertNotDegenerateVisibleText('作为 AI，我无法继续。', 'zh-CN')).toThrow(/占位或拒绝语/u)
  })

  it('stays silent for advisory-only findings', () => {
    expect(() => assertNotDegenerateVisibleText('本章\n他推开门。', 'zh-CN')).not.toThrow()
  })

  it('stays silent for clean prose', () => {
    expect(() => assertNotDegenerateVisibleText('他推开门，屋里没有人。', 'zh-CN')).not.toThrow()
  })
})
