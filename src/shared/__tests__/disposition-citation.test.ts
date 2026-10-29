import { describe, expect, it } from 'vitest'
import {
  auditDispositionCitations,
  bottomLineCountOfCard,
  dispositionIdsOfCard,
} from '../disposition-citation'

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

  // 2026-10-29 作者裁定：定性无 = "没有现成做法"，不等于"没有性格"。
  // 做法是他平日的习惯，底线是他这个人 —— 所以兜底到第一层底线，是 try / catch 里的 catch。
  it('定性写「无」、选择行退到底线 —— 这是兜底路径，不报', () => {
    const synopsis = chapterQ(
      1,
      '定性：无 — 碰到了底线2，但三条做法都不适用',
      '选择：守 —— 他把话岔开｜否掉了 应下，因为 底线2：他欠着的人还没还完',
    )
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS, bottomLineCount: 4 })).toEqual([])
  })

  it('定性写「无」、选择行写 D0（他不在场）—— 也不报', () => {
    const synopsis = chapterQ(1, '定性：无 — 纯他人视角，他全程不在场', '选择：守 —— 他等到天亮｜否掉了 出手，因为 D0：这一章没有他的戏')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('定性写了做法、选择行却退到底线 —— 有做法就该用做法，报 MISMATCH', () => {
    const synopsis = chapterQ(1, '定性：D2 — 要他放弃攒了很久的东西', '选择：守 —— 他不吭声｜否掉了 动手，因为 底线3：他舍不得那样东西')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS, bottomLineCount: 4 })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_MISMATCH'])
    expect(findings[0].zh).toContain('底线3')
  })

  it('没有定性行的旧格式，只写底线兜底 —— 不算缺依据', () => {
    const synopsis = chapter(1, '选择：守 —— 他把话岔开｜否掉了 应下，因为 底线2：他欠着的人还没还完')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('底线的位次超出角色卡的底线条数就报 ARC_CHOICE_UNKNOWN_BOTTOM', () => {
    const synopsis = chapter(1, '选择：守 —— 他把话岔开｜否掉了 应下，因为 底线7：他欠着的人还没还完')
    const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS, bottomLineCount: 4 })
    expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_UNKNOWN_BOTTOM'])
    expect(findings[0].zh).toContain('底线7')
  })

  it('不给底线条数时不校验位次 —— 章纲里读不到条的数，硬要求会误报', () => {
    const synopsis = chapter(1, '选择：守 —— 他把话岔开｜否掉了 应下，因为 底线7：他欠着的人还没还完')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS })).toEqual([])
  })

  it('连续三章都走底线兜底，不算「一条倾向推所有局面」', () => {
    const make = (n: number) =>
      chapterQ(n, '定性：无 — 碰到了底线2', `选择：守 —— 他把话岔开｜否掉了 应下，因为 底线2：他欠着的人还没还完`)
    const synopsis = [make(1), make(2), make(3)].join('\n')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS, bottomLineCount: 4 })).toEqual([])
  })

  it('英文 bottom 写法同样识别为兜底', () => {
    const synopsis = [
      '## Chapter 1: Door',
      '',
      'Qualify: none — touches bottom 2, but no practice applies',
      '',
      'Choice: Hold — he deflects | ruled out: accepting, because bottom 2: he still owes someone',
      '',
      'Prose.',
      '',
      'Hook: the door is still open.',
      '',
    ].join('\n')
    expect(auditDispositionCitations({ synopsis, dispositionIds: IDS, bottomLineCount: 4 })).toEqual([])
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

  // ===== 2026-10-29 接线用：分批生成时的区间过滤 + 从角色卡取数 =====
  describe('chapterRange（分批生成只报本批）', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— A｜否掉了 B，因为 D9：编的'),
      chapter(5, '选择：规则 —— A｜否掉了 B，因为 D8：也编的'),
    ].join('\n')

    it('区间外的章不报，区间内的报', () => {
      const findings = auditDispositionCitations({
        synopsis,
        dispositionIds: IDS,
        chapterRange: { from: 4, to: 8 },
      })
      expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_UNKNOWN_D'])
      expect(findings[0].chapter).toContain('第5章')
    })

    it('不给区间时两章都报（旧行为不变）', () => {
      const findings = auditDispositionCitations({ synopsis, dispositionIds: IDS })
      expect(findings).toHaveLength(2)
    })

    it('连续同一条的计数不受区间影响 —— 它要跨批累积才有意义', () => {
      const three = [
        chapter(1, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
        chapter(2, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
        chapter(3, '选择：规则 —— A｜否掉了 B，因为 D2：他先算账'),
      ].join('\n')
      // 只看第 3 章：前两章在区间外，但计数仍累积到 3 ⇒ 仍报
      const findings = auditDispositionCitations({
        synopsis: three,
        dispositionIds: IDS,
        chapterRange: { from: 3, to: 3 },
      })
      expect(findings.map(f => f.code)).toEqual(['ARC_CHOICE_SAME_D'])
      expect(findings[0].chapter).toContain('第3章')
    })
  })

  describe('从角色卡取数', () => {
    it('取出第三层做法的编号，按数值排序', () => {
      const card = '第三层【他对各类事的做法】\nD1 有人讨承诺 → 先要凭据\nD3 要他站队 → 不站\nD2 借东西 → 不动'
      expect(dispositionIdsOfCard(card)).toEqual(['D1', 'D2', 'D3'])
    })

    it('不把 D0 算进白名单 —— 它是申报值，不是卡上的做法', () => {
      expect(dispositionIdsOfCard('选择行可能写 D0，但那不是做法')).toEqual([])
    })

    it('卡上没有编号时返回空数组（调用方据此跳过体检）', () => {
      expect(dispositionIdsOfCard('他很谨慎，先要凭据')).toEqual([])
      expect(dispositionIdsOfCard('')).toEqual([])
      expect(dispositionIdsOfCard(null)).toEqual([])
    })

    it('数出第一层有几条底线（取最大编号）', () => {
      const card = '第一层【他在乎什么】\nB1 那个人\nB2 自己的命\nB3 不欠人'
      expect(bottomLineCountOfCard(card)).toBe(3)
    })

    it('没有 B 编号时返回 undefined —— 不校验兜底序号，避免整批误报', () => {
      expect(bottomLineCountOfCard('他很谨慎')).toBeUndefined()
      expect(bottomLineCountOfCard(null)).toBeUndefined()
    })
  })
})
