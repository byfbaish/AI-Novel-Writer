import { describe, expect, it } from 'vitest'

import {
  KNOWLEDGE_MAX_CHARS,
  KNOWLEDGE_MAX_ITEMS,
  KNOWLEDGE_QUOTE_MAX_CHARS,
  knowledgeFactEvidenceHash,
  knowledgeFactKey,
  normalizeFactQuote,
  renderKnowledgeLine,
  renderKnowledgeSection,
  type KnowledgeStateDefinition,
} from '../knowledge-state'

/**
 * P1-1 期 3 知情（谁知道什么）· 纯函数。
 *
 * 这一组守的不是排版，而是四件会决定生成质量的事：
 * 1. **引用键只由「章号 + 逐字引文」决定**：同一引文换个 `statement` 仍是同一个 key ——
 *    否则每章重抽一次，作者登记的知情关系就全部指向空气；
 * 2. **失效三态只有 `valid` 参与注入**：`stale` / `unverifiable` 是「登记失效」，
 *    不是「这个角色不知道」，混进提示词就会被反着读；
 * 3. **节首说明必须逐字包含「未登记的事实一概不判」**：少了这句，封闭默认会被读成
 *    「这本书里谁都不知道别的任何事」；
 * 4. **超预算整条丢弃**：截半行会变成另一条事实。
 */
const entry = (over: Partial<KnowledgeStateDefinition> = {}): KnowledgeStateDefinition => ({
  knowledgeId: 'knowledge:1',
  characterId: 'character:guchangfeng',
  characterName: '顾长风',
  factChapter: 9,
  factEvidence: '灵根检测结果被人改过',
  factEvidenceHash: 'a'.repeat(64),
  factKey: 'kf:0123456789abcdef',
  learnedChapter: 12,
  evidence: '',
  source: 'author',
  refState: 'valid',
  createdAt: '',
  updatedAt: '',
  ...over,
})

describe('引用键', () => {
  it('同一引文配不同的 statement 仍是同一个 key（statement 不参与）', async () => {
    // 这条用例钉的是「为什么不用 continuityStableFactKey」：那个函数把 statement 算进 key。
    const quote = '灵根检测结果被人改过'
    expect(await knowledgeFactKey(9, quote)).toBe(await knowledgeFactKey(9, quote))
    // 同一引文、同一章 ⇒ 与有没有 statement 无关（本函数的入参里根本没有那个字段）。
    expect(await knowledgeFactKey(9, ` ${quote} `)).toBe(await knowledgeFactKey(9, quote))
  })

  it('空白差异归一后同 key；换字或换章则不同', async () => {
    const base = await knowledgeFactKey(9, '灵根检测结果被人改过')
    expect(await knowledgeFactKey(9, '\n  灵根检测结果被人改过\t')).toBe(base)
    // 内部连续空白压成一个空格：两处写法归一后是同一个串。
    expect(await knowledgeFactKey(9, '灵根   检测 结果被人改过')).toBe(await knowledgeFactKey(9, '灵根 检测 结果被人改过'))
    expect(await knowledgeFactKey(9, '灵根检测结果被人改过。')).not.toBe(base)
    expect(await knowledgeFactKey(10, '灵根检测结果被人改过')).not.toBe(base)
    // 键的形状：`kf:` + 16 hex（引用而不是内容哈希）
    expect(base).toMatch(/^kf:[a-f0-9]{16}$/u)
  })

  it('引文指纹是完整 64 hex，且只对归一化后的文本取哈希', async () => {
    const quote = '灵根检测结果被人改过'
    const hash = await knowledgeFactEvidenceHash(quote)
    expect(hash).toMatch(/^[a-f0-9]{64}$/u)
    expect(await knowledgeFactEvidenceHash(`  ${quote}  `)).toBe(hash)
    expect(await knowledgeFactEvidenceHash(`${quote}。`)).not.toBe(hash)
    // 归一化不碰字符本身（不做 Unicode 归一）
    expect(normalizeFactQuote('  灵根   检测 ')).toBe('灵根 检测')
  })

  it('空引文与非法章号直接拒绝（没有引文就没有键）', async () => {
    await expect(knowledgeFactKey(9, '   ')).rejects.toThrow('KNOWLEDGE_INVALID:factEvidence')
    await expect(knowledgeFactKey(0, '引文')).rejects.toThrow('KNOWLEDGE_INVALID:factChapter')
    await expect(knowledgeFactKey(1.5, '引文')).rejects.toThrow('KNOWLEDGE_INVALID:factChapter')
    await expect(knowledgeFactEvidenceHash('')).rejects.toThrow('KNOWLEDGE_INVALID:factEvidence')
  })
})

describe('renderKnowledgeLine / renderKnowledgeSection', () => {
  it('中文行与计划样例逐字一致', () => {
    expect(renderKnowledgeLine(entry(), 'zh-CN'))
      .toBe('- 顾长风：知道（事实出处：第9章「灵根检测结果被人改过」；自第12章得知）')
  })

  it('英文行对称（结构相同，不是只翻一半）', () => {
    expect(renderKnowledgeLine(entry(), 'en-US'))
      .toBe('- 顾长风: knows (fact: Chapter 9 "灵根检测结果被人改过"; learned in Chapter 12)')
    expect(renderKnowledgeSection([entry()], 'en-US')).toContain('[Knowledge state (who knows what)]')
  })

  it('节首说明逐字包含封闭默认与它的边界（未登记的事实一概不判）', () => {
    const section = renderKnowledgeSection([entry()], 'zh-CN')
    expect(section.split('\n')[0]).toBe('【知情（谁知道什么）】')
    expect(section).toContain('以下只列已登记的事实：登记过的事实，未列出的角色视为不知道；未登记的事实一概不判。')
    // 英文侧同样要带上后半句，否则只说了封闭、没说过滤范围。
    expect(renderKnowledgeSection([entry()], 'en-US'))
      .toContain('facts that were never registered are not judged at all')
  })

  it('失效三态只有 valid 进注入（stale / unverifiable 跳过）', () => {
    const section = renderKnowledgeSection([
      entry({ knowledgeId: 'k:valid', characterName: '顾长风', refState: 'valid' }),
      entry({ knowledgeId: 'k:stale', characterName: '小郑', refState: 'stale' }),
      entry({ knowledgeId: 'k:unknown', characterName: '王五', refState: 'unverifiable' }),
    ], 'zh-CN')
    expect(section).toContain('顾长风')
    expect(section).not.toContain('小郑')
    expect(section).not.toContain('王五')
    expect(section.split('\n').filter(line => line.startsWith('- '))).toHaveLength(1)
  })

  it('超长引文按 60 字截断并加「…」（只截显示，不改登记）', () => {
    const long = '引'.repeat(KNOWLEDGE_QUOTE_MAX_CHARS + 20)
    const line = renderKnowledgeLine(entry({ factEvidence: long }), 'zh-CN')
    expect(line).toContain(`${'引'.repeat(KNOWLEDGE_QUOTE_MAX_CHARS)}…`)
    expect(line).not.toContain('引'.repeat(KNOWLEDGE_QUOTE_MAX_CHARS + 1))
  })

  it('排序：本章出场角色优先 → 得知章降序 → 角色名', () => {
    const section = renderKnowledgeSection([
      entry({ knowledgeId: 'k:a', characterName: '甲', learnedChapter: 12 }),
      entry({ knowledgeId: 'k:b', characterName: '乙', learnedChapter: 14 }),
      entry({ knowledgeId: 'k:c', characterName: '丙', learnedChapter: 10 }),
    ], 'zh-CN', ['丙'])
    const lines = section.split('\n').filter(line => line.startsWith('- '))
    // 丙 不在本章出场时应当排最后（得知最早），出场后提到最前。
    expect(lines[0]).toContain('丙')
    expect(lines[1]).toContain('乙')
    expect(lines[2]).toContain('甲')
  })

  it('条数与字数双上限：超出的整条丢弃，不截半行', () => {
    const many = Array.from({ length: KNOWLEDGE_MAX_ITEMS + 2 }, (_, index) => entry({
      knowledgeId: `k:${index}`, characterName: `角色${index}`, learnedChapter: 20 - index,
    }))
    const byCount = renderKnowledgeSection(many, 'zh-CN')
    expect(byCount.split('\n').filter(line => line.startsWith('- '))).toHaveLength(KNOWLEDGE_MAX_ITEMS)
    expect(byCount).not.toContain('角色7：')

    // 字数上限：单行就能吃掉整个预算时，一条都不出（也不出半行）。
    const tight = renderKnowledgeSection([entry()], 'zh-CN', [], 10)
    expect(tight).toBe('')
    // 默认上限下正常出。（第一条断言用默认值，保证常量没被悄悄改小）
    expect(KNOWLEDGE_MAX_CHARS).toBeGreaterThan(100)
    expect(renderKnowledgeSection([entry()], 'zh-CN').split('\n')).toHaveLength(3)
  })
})
