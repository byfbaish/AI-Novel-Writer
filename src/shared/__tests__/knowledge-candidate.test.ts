import { describe, expect, it } from 'vitest'
import type { FinalizedContinuityFact } from '../finalized-continuity'
import {
  KNOWLEDGE_CANDIDATES_MAX_ITEMS,
  KNOWLEDGE_CANDIDATE_QUOTE_MAX_CHARS,
  formatKnowledgeCandidateFacts,
  knowledgeCandidateFactIdentity,
  markKnowledgeCandidates,
  parseKnowledgeCandidateResponse,
  resolveKnowledgeCandidates,
  type KnowledgeCandidate,
} from '../knowledge-candidate'

/**
 * P20-3 知情候选（模型只能挑、不能写）。
 *
 * 这组用例守的是一条线：**候选里的引文、章号、`factKey` 全部来自已落库的事实**，
 * 模型的输出除了「第几条」「谁」之外一个字都进不来。所以「模型编了一条事实」
 * 这种事故在这里不是「被拦住了」，而是**根本没有入口**。
 */

function fact(over: Partial<FinalizedContinuityFact> = {}): FinalizedContinuityFact {
  return { category: 'plot', entities: ['柳长老'], statement: '柳长老在药房倒了第二碗药',
    sourceChapter: 3, evidence: '柳长老把第二碗药倒进了花盆。', ...over }
}

const roster = [
  { characterId: 'char:liu', name: '柳长老' },
  { characterId: 'char:qi', name: '阿七' },
]

describe('formatKnowledgeCandidateFacts · 编号清单（与 resolve 共用同一套编号）', () => {
  it('编号从 1 开始，带原文摘录', () => {
    const text = formatKnowledgeCandidateFacts([fact(), fact({ statement: '阿七在门外听见', sourceChapter: 4 })], 'zh-CN')
    expect(text.split('\n')[0]).toBe('1. 柳长老在药房倒了第二碗药')
    expect(text.split('\n')[2]).toBe('2. 阿七在门外听见')
    expect(text).toContain('原文：柳长老把第二碗药倒进了花盆。')
  })

  it('引文超长加「…」，绝不悄悄少字', () => {
    const long = '药'.repeat(KNOWLEDGE_CANDIDATE_QUOTE_MAX_CHARS + 20)
    const text = formatKnowledgeCandidateFacts([fact({ evidence: long })], 'zh-CN')
    expect(text).toContain(`${'药'.repeat(KNOWLEDGE_CANDIDATE_QUOTE_MAX_CHARS)}…`)
  })

  it('没有事实就明说「（无）」，不产空行让模型自己发挥', () => {
    expect(formatKnowledgeCandidateFacts([], 'zh-CN')).toBe('（无）')
    expect(formatKnowledgeCandidateFacts([], 'en-US')).toBe('(none)')
  })
})

describe('parseKnowledgeCandidateResponse · 只解析形状', () => {
  it('正常解析：只认 factIndex 与 characterId', () => {
    const { proposals, dropped } = parseKnowledgeCandidateResponse(
      '{"knowledge":[{"factIndex":1,"characterId":"char:liu"}]}',
    )
    expect(proposals).toEqual([{ factIndex: 1, characterId: 'char:liu' }])
    expect(dropped).toEqual([])
  })

  it('模型在项里塞了自造的名字/引文 ⇒ 一律不进 proposals（只留白名单字段）', () => {
    const { proposals } = parseKnowledgeCandidateResponse(
      '{"knowledge":[{"factIndex":2,"characterId":"char:qi","characterName":"我自己编的","factEvidence":"编的引文"}]}',
    )
    expect(proposals).toEqual([{ factIndex: 2, characterId: 'char:qi' }])
    // 多出来的字段连类型都留不下：下游拿不到它们，就不可能被写进库
    expect(Object.keys(proposals[0]!)).toEqual(['factIndex', 'characterId'])
  })

  it('坏 JSON / 不是数组 / 没有 knowledge 键 ⇒ 空结果，不抛错', () => {
    for (const raw of ['', 'not json', '{}', '{"knowledge":[]}', '{"knowledge":null}', '[]']) {
      expect(parseKnowledgeCandidateResponse(raw).proposals).toEqual([])
    }
  })

  it('缺字段/类型不对逐条丢并记账（不整批失败，也不静默少给）', () => {
    const { proposals, dropped } = parseKnowledgeCandidateResponse(
      '{"knowledge":[{"factIndex":1,"characterId":"char:liu"},{"factIndex":0,"characterId":"char:qi"},{"factIndex":"2","characterId":"char:qi"},{"factIndex":3},null]}',
    )
    expect(proposals).toHaveLength(1)
    expect(dropped).toHaveLength(4)
    expect(dropped.every(item => item.reason === 'invalid-shape')).toBe(true)
  })

  it('只给名字不给 id 不算数（按名字反查会把候选挂到同名的人头上）', () => {
    const { proposals, dropped } = parseKnowledgeCandidateResponse(
      '{"knowledge":[{"factIndex":1,"characterName":"柳长老"}]}',
    )
    expect(proposals).toEqual([])
    expect(dropped[0]!.reason).toBe('invalid-shape')
  })
})

describe('resolveKnowledgeCandidates · 反查事实与名单', () => {
  const facts = [fact(), fact({ statement: '阿七在门外听见', sourceChapter: 4, evidence: '阿七贴着门缝屏住呼吸。' })]

  it('引文/章号全部来自事实，不采信任何模型文本', () => {
    const { candidates, dropped } = resolveKnowledgeCandidates({
      proposals: [{ factIndex: 1, characterId: 'char:liu' }], facts, roster, chapterNumber: 5,
    })
    expect(dropped).toEqual([])
    expect(candidates).toHaveLength(1)
    const candidate = candidates[0]!
    expect(candidate.factEvidence).toBe(facts[0]!.evidence)
    expect(candidate.factChapter).toBe(3)
    expect(candidate.learnedChapter).toBe(5)
    expect(candidate.characterName).toBe('柳长老')
    // ★ 事实身份必须与 M16 的键同一个定义域，否则采纳后 `refState` 永远对不上（静默失效）
    expect(knowledgeCandidateFactIdentity(candidate.factChapter, candidate.factEvidence))
      .toBe(knowledgeCandidateFactIdentity(3, facts[0]!.evidence))
    // 模型给的 factIndex 用完即弃：候选里不该留下任何「模型说过什么」的痕迹
    expect(Object.keys(candidate).sort()).toEqual([
      'characterId', 'characterName', 'factChapter', 'factEvidence', 'learnedChapter', 'statement',
    ])
  })

  it('factIndex 从 1 起：0 与越界都丢，且不说成「没有候选」', () => {
    const { candidates, dropped } = resolveKnowledgeCandidates({
      proposals: [{ factIndex: 0, characterId: 'char:liu' }, { factIndex: 3, characterId: 'char:liu' }],
      facts, roster, chapterNumber: 5,
    })
    expect(candidates).toEqual([])
    expect(dropped.map(item => item.reason)).toEqual(['fact-index-out-of-range', 'fact-index-out-of-range'])
  })

  it('名单外的人一律丢（不许凭空造人）', async () => {
    const { dropped } = resolveKnowledgeCandidates({
      proposals: [{ factIndex: 1, characterId: 'char:ghost' }], facts, roster, chapterNumber: 5,
    })
    expect(dropped[0]!.reason).toBe('character-not-in-roster')
  })

  it('同一事实 + 同一人重复只留一条', () => {
    const { candidates, dropped } = resolveKnowledgeCandidates({
      proposals: [{ factIndex: 1, characterId: 'char:liu' }, { factIndex: 1, characterId: 'char:liu' }],
      facts, roster, chapterNumber: 5,
    })
    expect(candidates).toHaveLength(1)
    expect(dropped[0]!.reason).toBe('duplicated')
  })

  it('同一事实两个人知道 ⇒ 两条（这不是重复）', async () => {
    const { candidates } = resolveKnowledgeCandidates({
      proposals: [{ factIndex: 1, characterId: 'char:liu' }, { factIndex: 1, characterId: 'char:qi' }],
      facts, roster, chapterNumber: 5,
    })
    expect(candidates.map(item => item.characterId).sort()).toEqual(['char:liu', 'char:qi'])
  })

  it('超过单章上限的部分记 over-limit（不静默截断）', async () => {
    const many = Array.from({ length: 8 }, (_, index) => fact({ statement: `事实${index}`, evidence: `引文${index}。` }))
    const proposals = many.map((_, index) => ({ factIndex: index + 1, characterId: 'char:liu' }))
    const { candidates, dropped } = resolveKnowledgeCandidates({ proposals, facts: many, roster, chapterNumber: 5 })
    expect(candidates).toHaveLength(KNOWLEDGE_CANDIDATES_MAX_ITEMS)
    expect(dropped.filter(item => item.reason === 'over-limit')).toHaveLength(2)
  })

  it('解析阶段的丢弃项会合并进来（界面只读一处账）', async () => {
    const { dropped } = resolveKnowledgeCandidates({
      proposals: [], facts, roster, chapterNumber: 5,
      dropped: [{ factIndex: null, characterId: '', reason: 'invalid-shape' }],
    })
    expect(dropped).toHaveLength(1)
  })
})

describe('markKnowledgeCandidates · 失效判定靠「章号 + 引文」自证', () => {
  const base: KnowledgeCandidate = {
    factChapter: 3, factEvidence: '柳长老把第二碗药倒进了花盆。', statement: '陈述',
    characterId: 'char:liu', characterName: '柳长老', learnedChapter: 5,
  }
  const identity = knowledgeCandidateFactIdentity

  it('该事实仍在当前投影里 ⇒ valid（可采纳）', () => {
    const [view] = markKnowledgeCandidates([base], new Set([identity(3, base.factEvidence)]), new Set([3]))
    expect(view!.refState).toBe('valid')
  })

  it('那一章还在、但这条引文已经不在 ⇒ stale（章重定稿过，候选不可采纳）', () => {
    const [view] = markKnowledgeCandidates([base], new Set([identity(3, '另一句完全不同的引文。')]), new Set([3]))
    expect(view!.refState).toBe('stale')
  })

  it('那一章已经没有投影 ⇒ orphaned（章被删或投影失效）', () => {
    const [view] = markKnowledgeCandidates([base], new Set(), new Set([]))
    expect(view!.refState).toBe('orphaned')
  })

  it('空白差异不算改引文（与 factKey 的归一口径一致，否则会出现「键没变但候选被判失效」）', () => {
    const [view] = markKnowledgeCandidates([base], new Set([identity(3, `  ${base.factEvidence}  `)]), new Set([3]))
    expect(view!.refState).toBe('valid')
  })

  it('分类来自投影；取不到就是 unknown，不猜', () => {
    const key = identity(3, base.factEvidence)
    const [view] = markKnowledgeCandidates([base], new Set([key]), new Set([3]),
      new Map([[key, 'open-thread' as const]]))
    expect(view!.category).toBe('open-thread')
    const [missing] = markKnowledgeCandidates([base], new Set([key]), new Set([3]))
    expect(missing!.category).toBe('unknown')
  })
})
