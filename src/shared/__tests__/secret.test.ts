import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SECRET_MAX_ITEMS,
  activeExemptionKeys,
  parseSecretExemptionKey,
  renderSecretReviewLine,
  renderSecretReviewSection,
  secretChapterExemptionKey,
  secretChapterState,
  secretExemptionKey,
  secretExemptionScope,
  secretGuardsChapter,
  secretPendingKnowledge,
  type SecretDefinition,
} from '../secret'

/**
 * P20-2 秘密宿体（共享层）。
 *
 * 这个文件钉的是**判定与措辞**，不是数据库（那是 m21-installed-lane 的事）：
 * 1. 四态推导（未定 / 未揭穿 / 本章揭穿 / 已揭穿）—— 期界错了会把「该揭穿」判成「泄密」；
 * 2. 真相本体必须出现在审稿清单里（否则审稿员没有判定依据）；
 * 3. 「未填」不得被写成「没有人」；
 * 4. ★ **正文链不许读它** —— 真相进正文提示词等于把谜底交给写手（判据 DP 同族）。
 */
function secret(overrides: Partial<SecretDefinition> = {}): SecretDefinition {
  return {
    secretId: 'secret:1',
    title: '柳长老拿弟子试药',
    detail: '试药房里的残篇是柳长老从外门弟子身上取的',
    holders: ['柳长老'],
    unaware: ['众弟子'],
    revealChapter: 12,
    evidence: '谁在隐瞒什么：柳长老捂试药残篇',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('secretChapterState · 四态推导', () => {
  it('揭穿章已定：早于揭穿章是 pending，等于揭穿章是 revealed-now，晚于是 already-revealed', () => {
    const entry = secret({ revealChapter: 12 })
    expect(secretChapterState(entry, 5)).toBe('pending')
    expect(secretChapterState(entry, 11)).toBe('pending')
    expect(secretChapterState(entry, 12)).toBe('revealed-now')
    expect(secretChapterState(entry, 13)).toBe('already-revealed')
  })

  it('揭穿章未定（null）⇒ 任何一章都按「还没揭穿」处理（保守方向）', () => {
    const entry = secret({ revealChapter: null })
    expect(secretChapterState(entry, 1)).toBe('undecided')
    expect(secretChapterState(entry, 999)).toBe('undecided')
    // 保守方向的具体含义：每一章都要守卫（宁可多拦一次，不可漏放一次）。
    expect(secretGuardsChapter(entry, 1)).toBe(true)
    expect(secretGuardsChapter(entry, 999)).toBe(true)
  })

  it('只有已揭穿才不守卫', () => {
    expect(secretGuardsChapter(secret({ revealChapter: 12 }), 12)).toBe(true)
    expect(secretGuardsChapter(secret({ revealChapter: 12 }), 13)).toBe(false)
  })
})

describe('renderSecretReviewSection · 组节', () => {
  it('空输入 / 一条都没有 ⇒ 空串（不产只有标题的空节）', () => {
    expect(renderSecretReviewSection([], 5, 'zh-CN')).toBe('')
    // 缺 title 或 detail 的登记不算一条秘密
    expect(renderSecretReviewSection([secret({ title: '  ' })], 5, 'zh-CN')).toBe('')
    expect(renderSecretReviewSection([secret({ detail: '' })], 5, 'zh-CN')).toBe('')
  })

  it('★ 真相本体必须出现在清单里 —— 它是审稿员的判定依据', () => {
    const text = renderSecretReviewSection([secret()], 5, 'zh-CN')
    expect(text).toContain('【秘密守卫（未揭穿的真相）】')
    expect(text).toContain('柳长老拿弟子试药')
    expect(text).toContain('试药房里的残篇是柳长老从外门弟子身上取的')
    expect(text).toContain('隐瞒者：柳长老')
    expect(text).toContain('尚不知情：众弟子')
    expect(text).toContain('计划揭穿：第12章')
    // 规则要写清「只判写出真相」，否则审稿员会把「暗示太重」也报成泄密。
    expect(text).toContain('正文若在被审章写出了「真相」栏的内容，判为提前泄密')
  })

  it('★ 本章就是计划揭穿章 ⇒ 行里明说，避免审稿员把「该揭穿」判成「提前揭穿」', () => {
    const text = renderSecretReviewSection([secret({ revealChapter: 12 })], 12, 'zh-CN')
    expect(text).toContain('本章就是计划揭穿章')
    // 规则里也要有对应的豁免句
    expect(text).toContain('行尾标注「本章就是计划揭穿章」的那条不算泄密')
  })

  it('已揭穿的秘密不进清单（否则每章都在提醒「别泄密」，守卫节会变成噪音）', () => {
    const text = renderSecretReviewSection([secret({ revealChapter: 12 })], 20, 'zh-CN')
    expect(text).toBe('')
  })

  it('未定的揭穿章写「揭穿章未定」，不写 0、不写「永不揭穿」', () => {
    const line = renderSecretReviewLine(secret({ revealChapter: null }), 5, 'zh-CN')
    expect(line).toContain('揭穿章未定')
    expect(line).not.toContain('第0章')
  })

  it('★ 「尚不知情」为空时写「未填」，不得写成「没有人」', () => {
    const line = renderSecretReviewLine(secret({ unaware: [] }), 5, 'zh-CN')
    expect(line).toContain('尚不知情：未填')
    expect(line).not.toContain('没有人')
    // 规则里必须同时写明「未填 ≠ 所有人都知道」
    const text = renderSecretReviewSection([secret({ unaware: [] })], 5, 'zh-CN')
    expect(text).toContain('只说明作者没登记')
  })

  it(`条数上限 ${SECRET_MAX_ITEMS}：多出的不进正文（不是截断某一行）`, () => {
    const many = Array.from({ length: SECRET_MAX_ITEMS + 3 }, (_unused, index) => (
      secret({ secretId: `secret:${index}`, title: `秘密${index}`, revealChapter: index + 2 })
    ))
    const text = renderSecretReviewSection(many, 1, 'zh-CN')
    const items = text.split('\n').filter(line => line.startsWith('- 秘密：'))
    expect(items).toHaveLength(SECRET_MAX_ITEMS)
    // 每一行都是完整的（含真相），没有半行
    expect(items.every(line => line.includes('真相：'))).toBe(true)
  })

  it('排序：揭穿章近的在前，未定揭穿章的排最后', () => {
    const entries = [
      secret({ secretId: 's:c', title: '未定的账', revealChapter: null }),
      secret({ secretId: 's:b', title: '第三章穿的', revealChapter: 3 }),
      secret({ secretId: 's:a', title: '第二章穿的', revealChapter: 2 }),
    ]
    const text = renderSecretReviewSection(entries, 1, 'zh-CN')
    const titles = text.split('\n').filter(line => line.startsWith('- 秘密：'))
      .map(line => line.slice(0, line.indexOf('｜')))
    expect(titles).toEqual(['- 秘密：第二章穿的', '- 秘密：第三章穿的', '- 秘密：未定的账'])
  })

  it('英文环境走英文标题与措辞（不是中英混排）', () => {
    const text = renderSecretReviewSection([secret()], 5, 'en-US')
    expect(text).toContain('[Secret guard (truth not yet revealed)]')
    expect(text).toContain('truth:')
    expect(text).toContain('hiders:')
    expect(text).not.toContain('真相')
  })
})

describe('★ 正文链不许读秘密（判据 DP 同族）', () => {
  /**
   * 这条不是形式主义：`detail` 是真相本体，注入正文 prompt 会让模型当场把谜底写出来。
   * 第 3 维在正文链里整维跳过（`worldbuilding-rules.ts` 判据 DP）就是为了这件事。
   *
   * 断言方式：正文生成命令**不得** import 本模块，也不得引用渲染函数名。
   * 将来若有人想「顺手给正文也加一份守卫」，这条测试会先红。
   */
  const GENERATE_DRAFT = new URL('../../../src/services/workflows/commands/generate-draft.command.ts', import.meta.url)

  it('generate-draft.command.ts 不引用 secret 模块', () => {
    const source = readFileSync(GENERATE_DRAFT, 'utf8')
    expect(source).not.toContain("from '../../shared/secret'")
    expect(source).not.toContain('renderSecretReviewSection')
    expect(source).not.toContain('renderSecretReviewLine')
  })
})

/**
 * 豁免（2026-10-26 作者要求：审稿后对「知情」该项至少给两个出口）。
 *
 * 键落在 `consistency_exemptions.stable_fact_key` 上 —— 复用那张「稳定键 + 理由 + 可撤销」的表，
 * 不建新表。两种键的区别是**作用域**：章级只免一次，永久从此不管。
 */
describe('豁免键 · 临时（章级）与永久（秘密级）', () => {
  it('键形状固定：永久不带章号，章级带 #ch<N>', () => {
    expect(secretExemptionKey('secret:abc')).toBe('secret-exempt:secret:abc')
    expect(secretChapterExemptionKey('secret:abc', 30)).toBe('secret-exempt:secret:abc#ch30')
  })

  it('secretId 自带冒号也不会把章级键切错', () => {
    // 仓储生成的 id 是 `secret:<uuid>`，本身就含冒号 —— 分隔符因此不能用冒号。
    expect(parseSecretExemptionKey('secret-exempt:secret:abc#ch30'))
      .toEqual({ secretId: 'secret:abc', chapterNumber: 30 })
    expect(parseSecretExemptionKey('secret-exempt:secret:abc'))
      .toEqual({ secretId: 'secret:abc', chapterNumber: null })
  })

  it('章号非正整数直接抛，不许静默生成一个错键', () => {
    expect(() => secretChapterExemptionKey('secret:abc', 0)).toThrow('SECRET_INVALID:chapterNumber')
    expect(() => secretChapterExemptionKey('secret:abc', 1.5)).toThrow('SECRET_INVALID:chapterNumber')
  })

  it('别人家的豁免键解析成 null，绝不被误认（判据 DE 同族：认错一条就把 A 的豁免挂到 B 上）', () => {
    expect(parseSecretExemptionKey('volume-handoff:vol-1')).toBeNull()
    expect(parseSecretExemptionKey('outline-progress:vol-1')).toBeNull()
    expect(parseSecretExemptionKey('secret-exempt:')).toBeNull()
    // 带 #ch 但章号不是正整数 ⇒ 不认，而不是当成永久豁免
    expect(parseSecretExemptionKey('secret-exempt:secret:abc#ch0')).toBeNull()
    expect(parseSecretExemptionKey('secret-exempt:secret:abc#ch')).toBeNull()
  })

  it('永久优先于章级；章级只在被免的那一章生效', () => {
    const entry = secret({ secretId: 'secret:abc', revealChapter: 40 })
    expect(secretExemptionScope(entry, 30, new Set())).toBe('none')
    expect(secretExemptionScope(entry, 30, new Set(['secret-exempt:secret:abc#ch30']))).toBe('chapter')
    // 免了 30 不等于免了 31 —— 那正是「临时」的含义。
    expect(secretExemptionScope(entry, 31, new Set(['secret-exempt:secret:abc#ch30']))).toBe('none')
    expect(secretExemptionScope(entry, 31, new Set([
      'secret-exempt:secret:abc#ch30', 'secret-exempt:secret:abc',
    ]))).toBe('permanent')
  })

  it('已撤销的豁免不算数（过滤只在 activeExemptionKeys 一处做）', () => {
    const keys = activeExemptionKeys([
      { stableFactKey: 'secret-exempt:secret:abc', revoked: true },
      { stableFactKey: 'secret-exempt:secret:abc#ch30', revoked: false },
      { stableFactKey: 'volume-handoff:vol-1', revoked: false },
    ])
    expect(keys.has('secret-exempt:secret:abc')).toBe(false)
    expect(keys.has('secret-exempt:secret:abc#ch30')).toBe(true)
    expect(secretExemptionScope(secret({ secretId: 'secret:abc' }), 30, keys)).toBe('chapter')
  })

  it('欠知情名单 = 隐瞒者 ∪ 尚不知情，去重、去空、压换行', () => {
    const pending = secretPendingKnowledge({
      holders: ['柳长老', '柳长老'], unaware: [' 众弟子 ', '', '阿七\n（外门）'],
    })
    expect(pending.names).toEqual(['柳长老', '众弟子', '阿七 （外门）'])
  })
})

describe('renderSecretReviewSection · 豁免生效', () => {
  const entry = secret({ secretId: 'secret:abc', revealChapter: 40 })

  it('永久豁免 ⇒ 这条不进审稿清单', () => {
    const text = renderSecretReviewSection([entry], 30, 'zh-CN', 720,
      new Set([secretExemptionKey('secret:abc')]))
    expect(text).toBe('')
  })

  it('章级豁免只免那一章，下一章照旧报', () => {
    const keys = new Set([secretChapterExemptionKey('secret:abc', 30)])
    expect(renderSecretReviewSection([entry], 30, 'zh-CN', 720, keys)).toBe('')
    expect(renderSecretReviewSection([entry], 31, 'zh-CN', 720, keys)).toContain('柳长老拿弟子试药')
  })

  it('只免一条时其余照旧渲染（豁免不是一刀切）', () => {
    const other = secret({ secretId: 'secret:xyz', title: '城主的儿子还活着', revealChapter: 50 })
    const text = renderSecretReviewSection([entry, other], 30, 'zh-CN', 720,
      new Set([secretExemptionKey('secret:abc')]))
    expect(text).not.toContain('柳长老拿弟子试药')
    expect(text).toContain('城主的儿子还活着')
  })
})
