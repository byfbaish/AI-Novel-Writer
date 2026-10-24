import { describe, expect, it } from 'vitest'
import { freezeChapterGoals, parseChapterGoalReview } from '../chapter-goal-review'
import type { ConsistencyFinding } from '../consistency-preflight'
import { buildReviewGenerationReport, parseReviewGenerationResult } from '../review-generation-report'

const passingItem = { category: '剧情连贯性', severity: 'pass', description: '未发现矛盾。' }
const passing = { summary: '原始总结。', items: [passingItem] }
const source = '她合上已经装订好的相册。两人约定周三再搬设备。'
const goals = freezeChapterGoals(3, '完成相册；约定周三搬设备')
const answers = [
  { id: goals.items[0]!.id, status: 'completed', description: '装订已完成。', evidence: [{ quote: '已经装订好的相册' }] },
  { id: goals.items[1]!.id, status: 'completed', description: '约定已达成。', evidence: [{ quote: '两人约定周三再搬设备。' }] },
]

function build(overrides: Partial<Parameters<typeof buildReviewGenerationReport>[0]> = {}) {
  return buildReviewGenerationReport({
    content: JSON.stringify({ ...passing, goalReviews: answers }),
    sourceContent: source,
    frozenGoals: goals,
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    preflightFindings: [],
    ...overrides,
  })
}

describe('parseReviewGenerationResult', () => {
  it('accepts one strict JSON object or the original JSON fence and preserves category bytes and nonempty pass quotes', () => {
    const content = JSON.stringify({ ...passing, items: [{ ...passingItem, category: '  原始类别  ', quote: '  原文。  ' }] })
    const expected = { ...passing, items: [{ ...passingItem, category: '  原始类别  ', quote: '原文。' }] }
    expect(parseReviewGenerationResult(content)).toEqual(expected)
    expect(parseReviewGenerationResult(` \n\`\`\`JSON\t\r\n${content}\r\n\`\`\` \n`)).toEqual(expected)
    expect(parseReviewGenerationResult(JSON.stringify({ ...passing, items: Array.from({ length: 10 }, () => passingItem) })).items).toHaveLength(10)
  })

  it.each(['', ' \t\r\n '])('omits an empty pass quote just like an absent quote: %j', quote => {
    expect(parseReviewGenerationResult(JSON.stringify({ ...passing, items: [{ ...passingItem, quote }] })))
      .toEqual(parseReviewGenerationResult(JSON.stringify(passing)))
  })

  it('preserves complete Unicode fields while retaining explicit legacy replay', () => {
    const content = JSON.stringify({
      summary: ` ${'🌙'.repeat(121)} `,
      items: [{ category: '人物', severity: 'warning', description: ` ${'言'.repeat(201)} `, quote: ` ${'𠮷'.repeat(161)} ` }],
    })
    const result = parseReviewGenerationResult(content)
    expect(result.summary).toBe('🌙'.repeat(121))
    expect(result.items[0]?.description).toBe('言'.repeat(201))
    expect(result.items[0]?.quote).toBe('𠮷'.repeat(161))
    const legacy = parseReviewGenerationResult(content, 1)
    expect(legacy.summary).toBe('🌙'.repeat(120))
    expect(legacy.items[0]?.description).toBe('言'.repeat(200))
    expect(legacy.items[0]?.quote).toBe('𠮷'.repeat(160))
  })

  it('retains a long qualification and the complete uniquely locatable quote', () => {
    const prefix = '他说，' + '这是一段重复出现的回忆，'.repeat(18)
    const quote = prefix + '最后一次发生在清晨。'
    const sourceContent = quote + '\n' + prefix + '最后一次发生在傍晚。'
    const description = '需要结合当前段落与前文的关系核对，'.repeat(15) + '但这只是人物的错误猜测，客观叙述并无矛盾，不应修改。'
    const summary = '核对人物陈述与客观事实。'.repeat(12) + '保留末尾限定。'
    const frozenGoals = freezeChapterGoals(1, '确认时间')
    const result = build({ content: JSON.stringify({ summary, items: [{ category: '时间', severity: 'warning', description, quote }],
      goalReviews: [{ id: frozenGoals.items[0]!.id, status: 'completed', description: '时间已确认。', evidence: [{ quote }] }] }),
      sourceContent, frozenGoals })
    expect(result.summary).toBe(summary)
    expect(result.items[0]?.description).toBe(description)
    expect(result.items[0]?.quote).toBe(quote)
    expect(sourceContent.split(result.items[0]!.quote as string)).toHaveLength(2)
    expect(sourceContent.split(quote.slice(0, 160))).toHaveLength(3)
  })

  it.each([
    ['array root', []],
    ['null root', null],
    ['missing summary', { items: [passingItem] }],
    ['empty summary', { ...passing, summary: ' \n ' }],
    ['non-array items', { ...passing, items: {} }],
    ['no items', { ...passing, items: [] }],
    ['too many items', { ...passing, items: Array.from({ length: 11 }, () => passingItem) }],
    ['null item', { ...passing, items: [null] }],
    ['array item', { ...passing, items: [[]] }],
    ['unknown severity', { ...passing, items: [{ ...passingItem, severity: 'unknown' }] }],
    ['blank category', { ...passing, items: [{ ...passingItem, category: ' ' }] }],
    ['non-string description', { ...passing, items: [{ ...passingItem, description: 1 }] }],
    ['blank description', { ...passing, items: [{ ...passingItem, description: '\n' }] }],
    ['non-string quote', { ...passing, items: [{ ...passingItem, quote: null }] }],
    ['extra root key', { ...passing, approved: true }],
    ['model normalized goal contract', { ...passing, goalReview: {} }],
    ['model stable fact key', { ...passing, items: [{ ...passingItem, stableFactKey: 'forged' }] }],
    ['model source chapter', { ...passing, items: [{ ...passingItem, sourceChapter: 1 }] }],
  ])('rejects %s before normalization', (_label, value) => {
    expect(() => parseReviewGenerationResult(JSON.stringify(value))).toThrow('invalid review contract')
    if (value && !Array.isArray(value)) {
      expect(() => parseReviewGenerationResult(`审查结果：\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n以上。`))
        .toThrow('invalid review contract')
    }
  })

  it.each(['error', 'warning'])('requires a nonempty quote for %s', severity => {
    for (const quote of [undefined, '', ' \t\n ']) {
      expect(() => parseReviewGenerationResult(JSON.stringify({ ...passing, items: [{ ...passingItem, severity, quote }] })))
        .toThrow('invalid review contract')
    }
    const item = { ...passingItem, severity, quote: '原文。' }
    expect(parseReviewGenerationResult(JSON.stringify({ ...passing, items: [item] })).items).toEqual([item])
  })

  it.each([
    `explanation ${JSON.stringify(passing)}`,
    `\`\`\`\n${JSON.stringify(passing)}\n\`\`\``,
    `<think>private</think>${JSON.stringify(passing)}`,
    `审查结果：\n\`\`\`json\n${JSON.stringify(passing)}\n\`\`\`\n以上。`,
  ])('accepts a unique complete visible report without regenerating its wrapper: %s', content => {
    expect(parseReviewGenerationResult(content)).toEqual(passing)
  })

  it('keeps quoted brackets, escaped quotes and backslashes inside the complete report', () => {
    const report = { summary: '检查结束。', items: [{ category: '表达', severity: 'warning',
      description: '原句含有 }、[ 和 "引号"，保留 \\ 标记。', quote: '他说："{先关门}"。' }] }
    expect(parseReviewGenerationResult(`说明\n${JSON.stringify(report)}\n结束`)).toEqual(report)
  })

  it.each([
    '{"summary":"broken",',
    `${JSON.stringify(passing)} ${JSON.stringify({ ...passing, summary: '另一个结论。' })}`,
    `${JSON.stringify(passing)} ${JSON.stringify(passing)}`,
    `{"metadata":true}\n${JSON.stringify(passing)}`,
    `${JSON.stringify(passing)}\n{"summary":"尚未结束`,
    `<think>${JSON.stringify(passing)}</think>没有最终报告`,
    `<think>${JSON.stringify(passing)}`,
  ])('rejects ambiguity, truncation and hidden-only reports: %s', content => {
    expect(() => parseReviewGenerationResult(content)).toThrow()
  })

  it('excludes a complete hidden candidate before selecting the visible report', () => {
    expect(parseReviewGenerationResult(`<think>${JSON.stringify({ ...passing, summary: '隐藏候选。' })}</think>结果如下\n${JSON.stringify(passing)}`))
      .toEqual(passing)
  })

  it.each([
    `说明\n[${JSON.stringify(passing)}]\n结束`,
    `说明\n[${JSON.stringify(passing)}`,
    `说明\n[[${JSON.stringify(passing)}]\n结束`,
    `说明\n\`\`\`json\n[${JSON.stringify(passing)}]\n\`\`\`\n结束`,
  ])('rejects complete or truncated array roots without selecting their inner report: %s', content => {
    expect(() => parseReviewGenerationResult(content)).toThrow()
  })
  it('ignores a complete explanatory array without selecting any nested report', () => {
    const hiddenByArray = { ...passing, summary: '数组内候选不能成为报告。' }
    expect(parseReviewGenerationResult(`说明 []\n[${JSON.stringify(hiddenByArray)}]\n报告\n${JSON.stringify(passing)}`)).toEqual(passing)
  })
})

describe('buildReviewGenerationReport', () => {
  it('keeps frozen goal wording and per-goal source evidence, then removes raw model goalReviews', () => {
    const result = build()
    const normalized = parseChapterGoalReview(result.goalReview)!
    expect(result.summary).toBe(passing.summary)
    expect(result).not.toHaveProperty('goalReviews')
    expect(result.items[0]).toEqual(passingItem)
    expect(normalized.items.map(item => item.text)).toEqual(goals.items.map(item => item.text))
    expect(normalized.items.map(item => item.status)).toEqual(['completed', 'completed'])
    for (const item of normalized.items) for (const evidence of item.evidence) {
      expect(source.slice(evidence.start, evidence.end)).toBe(evidence.quote)
    }
    expect(result.items.slice(1).map(item => item.goalId)).toEqual(goals.items.map(item => item.id))
  })

  it.each([
    ['missing goal', [answers[0]]],
    ['duplicate goal', [answers[0], answers[0], answers[1]]],
    ['rewritten goal', [{ ...answers[0], text: '改成准备相册' }, answers[1]]],
    ['foreign goal', [{ ...answers[0], id: 'foreign' }, answers[1]]],
    ['invalid evidence', [{ ...answers[0], evidence: [{ quote: '模型编造的原文' }] }, answers[1]]],
    ['absent evidence', [{ ...answers[0], evidence: [] }, answers[1]]],
    ['invalid completion label', [{ ...answers[0], status: 'pass' }, answers[1]]],
    ['missing model goals', undefined],
  ])('keeps %s unknown rather than declaring an overall pass', (_label, goalReviews) => {
    const result = build({ content: JSON.stringify({ ...passing, goalReviews }) })
    expect(result.summary).toBe('审稿包含待核实项目，不能视为全部通过。')
    expect(result.items.some(item => item.severity === 'unknown')).toBe(true)
    expect(parseChapterGoalReview(result.goalReview)?.items.map(item => item.text)).toEqual(goals.items.map(item => item.text))
  })

  it('checks quotes only against the supplied source, including UTF-16 positions', () => {
    const frozenGoals = freezeChapterGoals(1, '锁上门')
    const sourceContent = '🌙她锁上门。'
    const content = JSON.stringify({ ...passing, goalReviews: [{ id: frozenGoals.items[0]!.id, status: 'completed', description: '已经锁门。', evidence: [{ quote: '她锁上门。' }] }] })
    const valid = build({ content, frozenGoals, sourceContent })
    expect(parseChapterGoalReview(valid.goalReview)?.items[0]?.evidence).toEqual([{ quote: '她锁上门。', start: 2, end: 7 }])
    const changed = build({ content, frozenGoals, sourceContent: '她没有锁门。' })
    expect(parseChapterGoalReview(changed.goalReview)?.items[0]?.status).toBe('unknown')
    expect(changed.summary).toContain('不能视为全部通过')
  })

  it.each(['zh-CN', 'en-US'] as const)('keeps unknown above unmet in the %s summary and separates UI from writing language', uiLocale => {
    const goalReviews = [
      { ...answers[0], status: 'unmet', evidence: [{ quote: '明天再装订' }] },
      { ...answers[1], status: 'unknown', evidence: [] },
    ]
    const result = build({ content: JSON.stringify({ ...passing, goalReviews }), sourceContent: '明天再装订。', uiLocale, writingLanguage: 'zh-CN' })
    expect(parseChapterGoalReview(result.goalReview)?.items.map(item => item.status)).toEqual(['unmet', 'unknown'])
    expect(result.summary).toBe(uiLocale === 'en-US'
      ? 'The review contains unresolved items and is not an overall pass.'
      : '审稿包含待核实项目，不能视为全部通过。')
    expect(result.items[1]?.severity).toBe('error')
    expect(result.items[2]?.severity).toBe('unknown')
  })

  it.each(['zh-CN', 'en-US'] as const)('uses the historical %s unmet summary when all goals have verified outcomes', uiLocale => {
    const result = build({
      content: JSON.stringify({ ...passing, goalReviews: [{ ...answers[0], status: 'unmet', evidence: [{ quote: '明天再装订' }] }, answers[1]] }),
      sourceContent: `明天再装订。${source}`,
      uiLocale,
    })
    expect(result.summary).toBe(uiLocale === 'en-US'
      ? 'Some chapter goals are unmet; check their evidence.'
      : '本章存在尚未完成的目标，请核对逐项证据。')
    expect(result.items.some(item => item.severity === 'unknown')).toBe(false)
  })

  it.each([null, undefined])('does not promote absent or unavailable frozen goals to pass: %s', sourceGoals => {
    const result = build({ frozenGoals: freezeChapterGoals(3, sourceGoals) })
    expect(result.items.some(item => item.severity === 'unknown')).toBe(true)
    expect(result.summary).toContain('不能视为全部通过')
  })

  it.each(['zh-CN', 'en-US'] as const)('appends only frozen preflight findings in %s without mutating input or losing model/goal items', uiLocale => {
    const finding: ConsistencyFinding = Object.freeze({
      stableFactKey: 'fact:frozen', severity: 'warning', sourceChapter: 2, evidence: '韩峥已死。',
      issue: Object.freeze({ zhCN: '蓝图与既成事实冲突。', enUS: 'The blueprint conflicts with established facts.' }),
      suggestion: Object.freeze({ zhCN: '核对原文。', enUS: 'Check the source.' }),
    })
    const preflightFindings = Object.freeze([finding])
    const before = JSON.stringify({ goals, preflightFindings })
    const result = build({ preflightFindings, uiLocale })
    expect(result.items).toHaveLength(4)
    expect(result.items[0]).toEqual(passingItem)
    expect(result.items.at(-1)).toEqual({
      category: uiLocale === 'en-US' ? 'Deterministic continuity preflight' : '确定性一致性预检',
      severity: 'warning', description: uiLocale === 'en-US' ? finding.issue.enUS : finding.issue.zhCN,
      quote: finding.evidence, stableFactKey: finding.stableFactKey, sourceChapter: finding.sourceChapter,
    })
    expect(result.summary).toBe(passing.summary)
    expect(JSON.stringify({ goals, preflightFindings })).toBe(before)
  })

  it('retains the strict model shape gate before adding trusted goal and preflight metadata', () => {
    expect(() => build({ content: JSON.stringify({ ...passing, items: [{ ...passingItem, goalId: goals.items[0]!.id }] }) })).toThrow('invalid review contract')
  })
})

/**
 * W3：审稿报告 v3 带状态差分。
 *
 * 这一组测的是「版本号 → 形状」这条契约本身，不是业务判断：
 * v3 允许一个附加顶层键，v1/v2 不允许；附加产出的失败只能丢自己，不能拖垮 items。
 */
describe('review report v3 · stateDelta', () => {
  const delta = { characterName: '顾长风', field: 'location' as const, observed: '南坡', quote: '两人约定周三再搬设备。' }
  const v3 = (overrides: Record<string, unknown> = {}) => JSON.stringify({ ...passing, stateDelta: [delta], ...overrides })

  it('accepts stateDelta only under report version 3', () => {
    expect(parseReviewGenerationResult(v3(), 3)).toMatchObject({ stateDelta: [delta] })
    // v2 的白名单不含 stateDelta：同一份文本在 v2 下必须被拒。否则「版本号决定形状」
    // 就退化成「读侧碰运气」，而 saved() 与便携投影都会用版本号重算正文再比哈希。
    expect(() => parseReviewGenerationResult(v3(), 2)).toThrow('invalid review contract')
    expect(() => parseReviewGenerationResult(v3(), 1)).toThrow('invalid review contract')
  })

  it('distinguishes "not produced" from "checked, nothing changed"', () => {
    // 缺键 = 本次未产出（例如模板被旧版全局覆盖）；空数组 = 判过了、本章无变化。
    // 用 ?? [] 把两者抹平，就等于让「没判」永远显示成「判过没问题」。
    expect(parseReviewGenerationResult(JSON.stringify(passing), 3)).not.toHaveProperty('stateDelta')
    expect(parseReviewGenerationResult(v3({ stateDelta: [] }), 3)).toEqual({ ...passing, stateDelta: [] })
  })

  it('rejects a field outside the character state vocabulary', () => {
    // field 必须落在 cs_* 的 6 个文本字段内，否则定稿期无处回写，差分就是死数据。
    expect(() => parseReviewGenerationResult(v3({ stateDelta: [{ ...delta, field: 'mood' }] }), 3))
      .toThrow('invalid review contract')
  })

  it('rejects two observations of the same character and field', () => {
    expect(() => parseReviewGenerationResult(v3({ stateDelta: [delta, { ...delta, observed: '北塔' }] }), 3))
      .toThrow('invalid review contract')
  })

  it('rejects more than twelve observations and any unknown key', () => {
    const many = Array.from({ length: 13 }, (_, index) => ({ ...delta, characterName: `角色${index}` }))
    expect(() => parseReviewGenerationResult(v3({ stateDelta: many }), 3)).toThrow('invalid review contract')
    expect(() => parseReviewGenerationResult(v3({ stateDelta: [{ ...delta, confidence: 0.9 }] }), 3))
      .toThrow('invalid review contract')
  })

  it('drops an unlocatable or ambiguous quote instead of failing the whole review', () => {
    const diagnostics = { stateDeltaDropped: 0 }
    const report = build({ content: v3({ stateDelta: [delta, { ...delta, characterName: '王德发', quote: '这句话不在正文里。' }] }),
      reportVersion: 3, diagnostics })
    expect(report.stateDelta).toHaveLength(1)
    expect(diagnostics.stateDeltaDropped).toBe(1)
    // 主产物不受影响：模型给的那条 item 仍在（后面几条是目标核对与预检生成的）。
    expect(report.items[0]).toEqual(passingItem)
  })

  it('drops a quote that occurs twice because it cannot be anchored', () => {
    const diagnostics = { stateDeltaDropped: 0 }
    const report = build({ content: v3({ stateDelta: [{ ...delta, quote: '她合上相册。' }] }),
      sourceContent: '她合上相册。她合上相册。', reportVersion: 3, diagnostics })
    expect(report.stateDelta).toEqual([])
    expect(diagnostics.stateDeltaDropped).toBe(1)
  })

  it('normalizes the quote to the exact source slice, dropping the model-added quotation pair', () => {
    const report = build({ content: v3({ stateDelta: [{ ...delta, quote: '「两人约定周三再搬设备。」' }] }), reportVersion: 3 })
    expect((report.stateDelta as Array<{ quote: string }>)[0]?.quote).toBe('两人约定周三再搬设备。')
  })
})

describe('P2-1 连续性 findings 走既有报告合同', () => {
  it('固定 category 逐字保留，且不需要任何新字段', () => {
    // 审稿 items 只有 category/quote/description/severity 四个键 —— 连续性 findings 必须
    // 靠这条既有通道落地，不能给它加 stableFactKey 之类的新字段（会被 contract 拒掉）。
    const item = {
      category: '连续性核对（作者登记）',
      quote: '乙从怀里摸出那把刀。',
      description: '登记：第1章刀在林岚手里；本章换手且无转交过程。改本章：补出转交过程。',
      severity: 'warning',
    }
    const content = JSON.stringify({ summary: '发现一处连续性冲突。', items: [item] })
    const parsed = parseReviewGenerationResult(content)
    expect(parsed.items[0]).toEqual(item)
    const report = build({ content, sourceContent: '乙从怀里摸出那把刀。', frozenGoals: freezeChapterGoals(1, '') })
    expect(report.items[0]).toEqual(item)
  })
})
