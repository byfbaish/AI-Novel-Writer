import { describe, expect, it } from 'vitest'
import {
  auditDraftHook,
  HOOK_COPY_RATIO_DEFAULT,
  HOOK_PLANTED_MIN_RUN,
  hookTokenCoverage,
  longestCommonRunLength,
} from '../hook-payoff-audit'
import {
  C5_CH6_CURRENT_HOOK,
  C5_CH6_FINALIZED_BODY,
  C5_CH6_LEGACY_HOOK,
} from './fixtures/c5-ch6-hook-planting.fixture'

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

/**
 * ★ 真实正负对照（2026-11-05 从作者库导出）。
 *
 * 上面那几条用的是手写短句，能证明「判据会响」，但证明不了「对真实产物会响」。
 * C5 原先唯一的真实正样本是第 6 章旧蓝图钩子，该章蓝图重生成后正样本消失 ——
 * 本段把它连同定稿正文一起固定下来，同时给出**不该响的对照**。
 */
describe('★ 真实正负对照：第 6 章旧钩子 × 定稿正文', () => {
  it('旧钩子与定稿正文最长公共片段 = 2 字 ⇒ 报 C5（唯一真实正样本）', () => {
    const c5 = auditDraftHook({ hookText: C5_CH6_LEGACY_HOOK, draft: C5_CH6_FINALIZED_BODY })
      .find(f => f.code === 'C5-unplanted')
    expect(c5).toBeDefined()
    expect(c5!.metric).toBe(2)
    expect(longestCommonRunLength(C5_CH6_LEGACY_HOOK, C5_CH6_FINALIZED_BODY)).toBe(2)
  })

  it('当前钩子 × 同一份正文 = 4 字 ⇒ 不报（重生成后它不再是正样本）', () => {
    const findings = auditDraftHook({ hookText: C5_CH6_CURRENT_HOOK, draft: C5_CH6_FINALIZED_BODY })
    expect(findings.some(f => f.code === 'C5-unplanted')).toBe(false)
    expect(longestCommonRunLength(C5_CH6_CURRENT_HOOK, C5_CH6_FINALIZED_BODY)).toBe(4)
  })

  it('旧钩子的机制词在正文里 0 次，那 2 字来自「皮肤」—— 自造设定的实证', () => {
    for (const word of ['寿元', '因果纹', '灼烧', '透支']) {
      expect(C5_CH6_FINALIZED_BODY).not.toContain(word)
    }
    // 「皮肤」出现 1 次：2 字片段只有这一个来源，也正是阈值定在 3 而不是 2 的理由。
    expect(C5_CH6_FINALIZED_BODY.split('皮肤').length - 1).toBe(1)
  })
})

describe('边界：不属于这两条判据的输入不报', () => {  it('钩子行解析不出来 ⇒ 空数组（结构问题归大纲侧 C1）', () => {
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

describe('C5 蹭线提示（C5-name-graze，可插拔、只报不拦）', () => {
  // 真实形态的合成样本：过线段只有地名，悬念核（第三页中间 / 谁先翻到）正文 0 次。
  // 6 字 ≥ 3，所以 C5-unplanted **不会**报 —— 这正是蹭线要补的那个缺口。
  const GRAZE_HOOK = '第三段废料区那页抄件，最后会被谁先翻到'
  const GRAZE_DRAFT = '他把车推过第三段废料区，风把灰吹到脸上。'
  const NOUNS = ['第三段废料区', '陈砚']

  it('命中时追加 C5-name-graze，且同时不报 C5-unplanted', () => {
    const findings = auditDraftHook({
      hookText: GRAZE_HOOK,
      draft: GRAZE_DRAFT,
      nameGraze: { properNouns: NOUNS },
    })
    const graze = findings.find(f => f.code === 'C5-name-graze')
    expect(graze).toBeDefined()
    expect(graze!.level).toBe('report')
    expect(graze!.message).toContain('蹭线')
    expect(graze!.message).toContain('整体落在人名/地名')
    expect(graze!.message).toContain('只提示、不阻断、不改稿')
    expect(graze!.metric).toEqual({ run: '第三段废料区', noun: '第三段废料区' })
    expect(findings.some(f => f.code === 'C5-unplanted')).toBe(false)
  })

  it('enabled: false ⇒ 不含 C5-name-graze（其余判定不受影响）', () => {
    const findings = auditDraftHook({
      hookText: GRAZE_HOOK,
      draft: GRAZE_DRAFT,
      nameGraze: { properNouns: NOUNS, enabled: false },
    })
    expect(findings.some(f => f.code === 'C5-name-graze')).toBe(false)
    expect(findings.some(f => f.code === 'C5-unplanted')).toBe(false)
  })

  it('不给 nameGraze ⇒ 行为与接线前逐字一致（向后兼容）', () => {
    expect(auditDraftHook({ hookText: GRAZE_HOOK, draft: GRAZE_DRAFT })).toHaveLength(0)
  })

  it('properNouns 为空表 ⇒ 不报蹭线，C5 自身逻辑不变', () => {
    const grazeHit = auditDraftHook({
      hookText: GRAZE_HOOK,
      draft: GRAZE_DRAFT,
      nameGraze: { properNouns: [] },
    })
    expect(grazeHit.some(f => f.code === 'C5-name-graze')).toBe(false)
    expect(grazeHit.some(f => f.code === 'C5-unplanted')).toBe(false)

    // 未落地的样本仍然只报 C5-unplanted，不会因为接了蹭线而改口。
    const unplanted = auditDraftHook({
      hookText: '第一道因果纹灼烧皮肤带来的寿元透支危机已无法逆转',
      draft: '他把袖子撸起来，皮肤在灯下泛着一层薄汗，随后又放下去。',
      nameGraze: { properNouns: NOUNS },
    })
    expect(unplanted.some(f => f.code === 'C5-unplanted')).toBe(true)
    expect(unplanted.some(f => f.code === 'C5-name-graze')).toBe(false)
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
