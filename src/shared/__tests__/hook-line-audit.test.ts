import { describe, expect, it } from 'vitest'
import { auditChapterHook, auditOutlineHooks } from '../hook-line-audit'
import { parseHookLine } from '../synopsis-hook-line'

function hook(line: string) {
  const parsed = parseHookLine(line)
  if (!parsed) throw new Error(`not a hook line: ${line}`)
  return parsed
}

const BODY = [
  '## 第1章：门口',
  '选择：交换 —— 他拿四块灵石换了一条消息，否掉了赊账，因为 筹码：旧账本',
  '赵铎的尸骨停在半空那一瞬，他没敢伸手。',
].join('\n')

describe('C1 结构：缺行 / 类型不认识 / 缺种在 —— 事故档', () => {
  it('没有钩子行：一条 accident', () => {
    const findings = auditChapterHook(1, null, BODY)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ code: 'C1-structure', level: 'accident' })
  })

  it('类型不在六值：一条 accident，并列出六值', () => {
    const findings = auditChapterHook(1, hook('钩子：随便写的类型 — 他合上账本｜种在：账本'), BODY)
    const c1 = findings.filter(f => f.code === 'C1-structure')
    expect(c1).toHaveLength(1)
    expect(c1[0]!.message).toContain('六值')
  })

  it('缺「种在：」：一条 accident', () => {
    const findings = auditChapterHook(1, hook('钩子：悬念截断 — 刀停在半空'), BODY)
    expect(findings.some(f => f.code === 'C1-structure' && f.message.includes('种在'))).toBe(true)
  })

  it('只有类型没有断点：一条 accident，且不再往下判版式', () => {
    const findings = auditChapterHook(1, hook('钩子：落点｜种在：那四块灵石'), BODY)
    expect(findings.some(f => f.code === 'C1-structure' && f.message.includes('没有断点'))).toBe(true)
    expect(findings.every(f => f.code === 'C1-structure')).toBe(true)
  })

  it('旧名「收尾：」不按新格式报结构错（历史大纲不逼重生成）', () => {
    const findings = auditChapterHook(1, hook('收尾：门没关。'), BODY)
    expect(findings.filter(f => f.code === 'C1-structure')).toHaveLength(0)
  })
})

describe('C1b 版式：只报不重跑', () => {
  it('问号', () => {
    const findings = auditChapterHook(1, hook('钩子：悬念截断 — 他还能活下来吗？｜种在：尸骨'), BODY)
    const c1b = findings.find(f => f.code === 'C1b-format')
    expect(c1b?.level).toBe('report')
    expect(c1b?.message).toContain('问号')
  })

  it('心理动词作谓语', () => {
    const findings = auditChapterHook(1, hook('钩子：情绪断裂 — 他想知道门外是谁｜种在：门房'), BODY)
    expect(findings.some(f => f.code === 'C1b-format' && f.message.includes('心理活动'))).toBe(true)
  })

  it('解释 / 总结词', () => {
    const findings = auditChapterHook(1, hook('钩子：信息炸弹 — 原来那张纸是赵铎写的｜种在：纸'), BODY)
    expect(findings.some(f => f.code === 'C1b-format' && f.message.includes('解释'))).toBe(true)
  })

  it('干净的断点不报版式', () => {
    const findings = auditChapterHook(1, hook('钩子：悬念截断 — 尸骨停在半空｜种在：赵铎的尸骨'), BODY)
    expect(findings.filter(f => f.code === 'C1b-format')).toHaveLength(0)
  })
})

describe('C2 锚点：与本章正文没有共享实词就报，但不判空钩/外挂', () => {
  it('断点与正文无交集 ⇒ report', () => {
    const findings = auditChapterHook(1, hook('钩子：危机降临 — 千军万马压了过来｜种在：城墙'), BODY)
    const c2 = findings.find(f => f.code === 'C2-anchor')
    expect(c2?.level).toBe('report')
    // 机器分不清两种成因 —— 文案必须两种都写出来，不能替作者定性
    expect(c2?.message).toContain('空钩')
    expect(c2?.message).toContain('外挂')
  })

  it('断点与正文有共享实词 ⇒ 不报', () => {
    const findings = auditChapterHook(1, hook('钩子：悬念截断 — 尸骨停在半空｜种在：赵铎的尸骨'), BODY)
    expect(findings.filter(f => f.code === 'C2-anchor')).toHaveLength(0)
  })
})

describe('C4 落点自洽', () => {
  it('本章没有「选择：」行 ⇒ report', () => {
    const text = '## 第2章：门里\n他把账本合上了。'
    const findings = auditChapterHook(2, hook('钩子：落点 — 账本合上了｜种在：账本'), text)
    expect(findings.some(f => f.code === 'C4-landing' && f.message.includes('选择'))).toBe(true)
  })

  it('断点与「选择：」行有共享实词 ⇒ 不报', () => {
    const findings = auditChapterHook(1, hook('钩子：落点 — 他把四块灵石推过去了｜种在：柜台'), BODY)
    expect(findings.filter(f => f.code === 'C4-landing')).toHaveLength(0)
  })

  it('断点与「选择：」行无共享实词 ⇒ report，但允许"另有出处"', () => {
    const findings = auditChapterHook(1, hook('钩子：落点 — 灯灭了｜种在：灯'), BODY)
    const c4 = findings.find(f => f.code === 'C4-landing')
    expect(c4?.level).toBe('report')
    expect(c4?.message).toContain('忽略')
  })
})

describe('auditOutlineHooks：按章切块', () => {
  it('多章大纲：逐章出结论，章数正确', () => {
    const synopsis = [
      '全书总纲：一场关于欠债与还债的故事。',
      '',
      '## 第1章：门口',
      '选择：交换 —— 他拿四块灵石换了一条消息',
      '赵铎的尸骨停在半空。',
      '钩子：悬念截断 — 尸骨停在半空｜种在：赵铎的尸骨',
      '',
      '## 第2章：门里',
      '他把账本合上了。',
    ].join('\n')
    const result = auditOutlineHooks(synopsis)
    expect(result.chaptersChecked).toBe(2)
    expect(result.chaptersWithHook).toBe(1)
    expect(result.findings.some(f => f.code === 'C1-structure' && f.chapter === 2)).toBe(true)
  })

  it('第一个章标题之前的设定层不参与判定', () => {
    const synopsis = ['# 情节大纲', '全书总纲：随便写点。', '', '## 第1章：门口', '钩子：落点 — 门开了｜种在：门'].join('\n')
    const result = auditOutlineHooks(synopsis)
    expect(result.chaptersChecked).toBe(1)
    expect(result.findings.every(f => f.chapter === 1)).toBe(true)
  })

  it('空文本不崩、不报', () => {
    const result = auditOutlineHooks('')
    expect(result.chaptersChecked).toBe(0)
    expect(result.findings).toHaveLength(0)
  })
})

describe('C2 与钩子行自身的隔离（2026-11-04 接线回归）', () => {
  it('钩子行自带的词不能算作「本章正文」的共享实词', () => {
    // 正文里没有「尸骨」二字 —— 唯一的重合来源就是钩子行本身。若把钩子行算进
    // 比对文本，C2 会永远不报（空判据）。
    const synopsis = [
      '## 第1章：门口',
      '他把门推开了。',
      '钩子：悬念截断 — 尸骨停在半空｜种在：尸骨',
    ].join('\n')
    const result = auditOutlineHooks(synopsis)
    expect(result.findings.some(f => f.code === 'C2-anchor' && f.chapter === 1)).toBe(true)
  })

  it('正文确实共享实词时不报 C2', () => {
    const synopsis = [
      '## 第1章：门口',
      '赵铎的尸骨停在半空。',
      '钩子：悬念截断 — 尸骨停在半空｜种在：尸骨',
    ].join('\n')
    const result = auditOutlineHooks(synopsis)
    expect(result.findings.some(f => f.code === 'C2-anchor')).toBe(false)
  })
})
