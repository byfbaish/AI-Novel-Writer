import { describe, expect, it } from 'vitest'
import { auditDispositionCitations } from '../disposition-citation'

const IDS = ['D1', 'D2', 'D3'] as const

function chapter(index: number, choice: string, name = '门口'): string {
  return [`## 第${index}章：${name}`, '', choice, '', '正文一段。', '', '收尾：门没关。', ''].join('\n')
}

/** 带「定性：」行的版本 —— 定性在章标题行与选择行之间，单独一行。 */
function chapterQ(index: number, qualify: string, choice: string, name = '门口'): string {
  return [`## 第${index}章：${name}`, '', qualify, '', choice, '', '正文一段。', '', '收尾：门没关。', ''].join('\n')
}

describe('性格引用体检', () => {
  it('引用了存在的编号就不报', () => {
    const synopsis = [chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 D1：先查册子')].join('\n')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('选择行没有编号就报 ARC_CHOICE_NO_D', () => {
    const synopsis = chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为他向来谨慎')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_NO_D'])
    expect(findings[0].chapter).toContain('第1章')
  })

  it('D0 是显式「本章无性格戏」，合法', () => {
    const synopsis = chapter(1, '选择：守 —— 他等到天亮｜否掉了 出手，因为 D0：这一章没人碰到他那几条')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('引用不存在的编号就报 ARC_CHOICE_UNKNOWN_D', () => {
    const synopsis = chapter(1, '选择：自己 —— 他动手｜否掉了 借力，因为 D7：主角很猛')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_UNKNOWN_D'])
    expect(findings[0].zh).toContain('D7')
  })

  it('连续三章引用同一条就报 ARC_CHOICE_SAME_D', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
      chapter(2, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
      chapter(3, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
    ].join('\n')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_SAME_D'])
    expect(findings[0].chapter).toContain('第3章')
  })

  it('定性行与选择行是同一条就不报', () => {
    const synopsis = chapterQ(1, '定性：D2 — 要他放弃攒了很久的东西', '选择：规则 —— 他抬出条文｜否掉了 求人，因为 D2：他先算账')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('定性行与选择行不是同一条就报 ARC_CHOICE_MISMATCH', () => {
    const synopsis = chapterQ(1, '定性：D1 — 有人跟他讨一句口头承诺', '选择：规则 —— 他抬出条文｜否掉了 求人，因为 D2：他先算账')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_MISMATCH'])
    expect(findings[0].zh).toContain('D1')
    expect(findings[0].zh).toContain('D2')
  })

  it('定性写「无」而选择行仍引用具体编号 —— 两处不一致，报 MISMATCH', () => {
    const synopsis = chapterQ(1, '定性：无 — 这一章只是过场，没人碰到他那几条', '选择：规则 —— 他抬出条文｜否掉了 求人，因为 D2：他先算账')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_MISMATCH'])
  })

  it('英文 Qualify: 与 Choice: 不一致同样报', () => {
    const synopsis = [
      '## Chapter 1: The Door', '',
      'Qualify: D1 — someone asks him for a verbal promise', '',
      'Choice: Rules — he cites the clause | ruled out: asking for help, because D3: the anchor',
    ].join('\n')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_MISMATCH'])
  })

  it('没有定性行的旧格式大纲不做一致性比较', () => {
    const synopsis = chapter(1, '选择：规则 —— 他抬出条文｜否掉了 求人，因为 D2：他先算账')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('只连续两章不报；中间换一条会断开计数', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
      chapter(2, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
      chapter(3, '选择：自己 —— A｜否掉了 B，因为 D3：锚点被押上桌'),
      chapter(4, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
    ].join('\n')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('D0 不参与「连续同一条」，连续几章无戏不算扁平', () => {
    const synopsis = [
      chapter(1, '选择：守 —— A｜否掉了 B，因为 D0：本章无性格戏'),
      chapter(2, '选择：守 —— A｜否掉了 B，因为 D0：本章无性格戏'),
      chapter(3, '选择：守 —— A｜否掉了 B，因为 D0：本章无性格戏'),
    ].join('\n')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('英文大纲同样能读（Choice / Chapter）', () => {
    const synopsis = [
      '## Chapter 1: The Door',
      'Choice: Rules — he cites the clause | ruled out: asking a favour, because D1: he checks the ledger first',
      '',
      '## Chapter 2: The Gate',
      'Choice: Rules — he cites the clause | ruled out: asking a favour, because he is careful',
      '',
    ].join('\n')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_NO_D'])
    expect(findings[0].chapter).toContain('Chapter 2')
  })

  it('空大纲不报（还没生成时不该制造噪音）', () => {
    expect(auditDispositionCitations({ synopsis: '', dispositionIds: IDS })).toEqual([])
  })
})
