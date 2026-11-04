import { describe, expect, it } from 'vitest'
import {
  auditDraftHook,
  HOOK_COPY_RATIO_DEFAULT,
  HOOK_PLANTED_MIN_RUN,
  hookTokenCoverage,
} from '../hook-payoff-audit'

const HOOK = '钩子：悬念截断 — 赵铎的尸骨停在半空｜种在：赵铎的尸骨'

describe('C3 照抄：正文末段与钩子行重合率过高', () => {
  it('整句搬进末段 ⇒ 报 C3', () => {
    const draft = '他站在门口，风从缝里进来。赵铎的尸骨停在半空。'
    const findings = auditDraftHook({ hookLine: HOOK, draft })
    const c3 = findings.find(f => f.code === 'C3-copy')
    expect(c3).toBeDefined()
    expect(c3!.level).toBe('report')
    expect(c3!.metric).toBeGreaterThanOrEqual(HOOK_COPY_RATIO_DEFAULT)
  })

  it('正常写完、末段自然收住 ⇒ 不报 C3', () => {
    const draft = [
      '他把门推开一条缝。风进来，灯焰歪了一下，又直了。',
      '门槛边上堆着的东西他没有看，也没有伸手。',
      '过了很久，他把门关上，退回台阶下面。',
    ].join('\n')
    const findings = auditDraftHook({ hookLine: HOOK, draft })
    expect(findings.some(f => f.code === 'C3-copy')).toBe(false)
  })

  it('只看正文最后 200 字 —— 前半部分抄了不算 C3', () => {
    const copied = '赵铎的尸骨停在半空。'
    const filler = '他往回走，街上的水没到脚踝。'.repeat(30)
    const draft = `${copied}${filler}`
    expect(draft.length).toBeGreaterThan(200)
    const findings = auditDraftHook({ hookLine: HOOK, draft })
    expect(findings.some(f => f.code === 'C3-copy')).toBe(false)
  })

  it('阈值可覆盖（标定用）', () => {
    const draft = '他站在门口，风从缝里进来。赵铎的尸骨停在半空。'
    expect(auditDraftHook({ hookLine: HOOK, draft, copyRatioThreshold: 1.01 })).toHaveLength(0)
  })
})

describe('C5 未落地：钩子和正文没有 ≥3 字的连续片段', () => {
  it('正文完全没提那个对象 ⇒ 报 C5', () => {
    const draft = '他站在门口，风从缝里进来。他退回台阶下面，把门关好。'
    const findings = auditDraftHook({ hookLine: HOOK, draft })
    const c5 = findings.find(f => f.code === 'C5-unplanted')
    expect(c5).toBeDefined()
    expect(c5!.metric).toBeLessThan(HOOK_PLANTED_MIN_RUN)
    expect(c5!.message).toContain('只判当章')
  })

  it('对象出现过（哪怕在开头）⇒ 不报 C5', () => {
    const draft = `赵铎的尸骨躺在那里已经三天。\n${'他每天来看一眼，什么也不做。'.repeat(20)}`
    const findings = auditDraftHook({ hookLine: HOOK, draft })
    expect(findings.some(f => f.code === 'C5-unplanted')).toBe(false)
  })

  it('只有一个通用二字词撞上 ⇒ 仍报 C5（"皮肤"救不了"因果纹 / 寿元"）', () => {
    // 实测口径：第 6 章钩子的 19 个 bigram 里只有「皮肤」在正文出现（覆盖率 0.053）。
    // 按旧的"共享实词数为 0"判据不报；按连续片段判据（最长 2 字）要报。
    const draft = '他把袖子撸起来，皮肤在灯下泛着一层薄汗，随后又放下去。'
    const findings = auditDraftHook({ hookText: '第一道因果纹灼烧皮肤带来的寿元透支危机已无法逆转', draft })
    const c5 = findings.find(f => f.code === 'C5-unplanted')
    expect(c5).toBeDefined()
    expect(c5!.metric).toBeLessThan(HOOK_PLANTED_MIN_RUN)
  })
})

describe('边界：不属于这两条判据的输入不报', () => {
  it('钩子行解析不出来 ⇒ 空数组（结构问题归大纲侧 C1）', () => {
    expect(auditDraftHook({ hookLine: '选择：他人 —— 他去求了赵铎', draft: '正文' })).toHaveLength(0)
  })

  it('钩子行没有断点 ⇒ 空数组', () => {
    expect(auditDraftHook({ hookLine: '钩子：落点｜种在：账本', draft: '正文' })).toHaveLength(0)
  })

  it('正文为空 ⇒ 空数组（还没写，不判）', () => {
    expect(auditDraftHook({ hookLine: HOOK, draft: '' })).toHaveLength(0)
    expect(auditDraftHook({ hookLine: HOOK, draft: '   \n  ' })).toHaveLength(0)
  })
})

describe('裸文本入口（蓝图 suspenseHook，无「钩子：」标记）', () => {
  // 真实样本：作者项目第 6 章。大纲写的是「赵铎的尸身已化作灰骨」，
  // 蓝图却另造了「因果纹 / 寿元」——正文按蓝图写，这两个词一次没出现。
  const BP_HOOK = '第一道因果纹灼烧皮肤带来的寿元透支危机已无法逆转'
  const DRAFT_CH6 =
    '李执事把黑笔搁回砚台边，没有再看那本考课簿。陈砚低头退出度支房，台阶上的雪被踩成一排黑印。'

  it('蓝图钩子走 hookText 才判得出来（大纲行会漏掉这一章）', () => {
    const byBlueprint = auditDraftHook({ hookText: BP_HOOK, draft: DRAFT_CH6 })
    expect(byBlueprint.some(f => f.code === 'C5-unplanted')).toBe(true)

    // 对照组：同一章用大纲行判，反而因为共享了「李执事 / 黑笔」等实词而不报 ——
    // 这正是必须支持裸文本入口的原因。
    const byOutline = auditDraftHook({
      hookLine: '收尾：李执事黑笔划过考课簿，墨迹未干，赵铎的尸身已化作灰骨散在风里。',
      draft: DRAFT_CH6,
    })
    expect(byOutline.some(f => f.code === 'C5-unplanted')).toBe(false)
  })

  it('hookText 为空串 ⇒ 空数组（不是"解析失败"，是没给）', () => {
    expect(auditDraftHook({ hookText: '   ', draft: DRAFT_CH6 })).toHaveLength(0)
  })

  it('hookText 与 hookLine 同时给 ⇒ hookText 优先（调用方要传对）', () => {
    const findings = auditDraftHook({ hookLine: HOOK, hookText: BP_HOOK, draft: DRAFT_CH6 })
    expect(findings.some(f => f.code === 'C5-unplanted')).toBe(true)
  })
})

describe('hookTokenCoverage：分母是钩子行', () => {
  it('钩子 token 全在目标里 ⇒ 1', () => {
    // 注意：tokenize 会丢掉含停用字的二元组（"停在""在半"因含「在」被丢），
    // 所以这里只取必然保留的几组来验分母口径。
    const hookTokens = new Set(['赵铎', '尸骨', '半空'])
    expect(hookTokenCoverage(hookTokens, '赵铎的尸骨停在半空')).toBe(1)
  })

  it('一个都没有 ⇒ 0', () => {
    const hookTokens = new Set(['赵铎', '尸骨'])
    expect(hookTokenCoverage(hookTokens, '他关上门')).toBe(0)
  })

  it('空集合不除零', () => {
    expect(hookTokenCoverage(new Set(), '任意')).toBe(0)
  })
})
