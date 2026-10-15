import { describe, expect, it } from 'vitest'
import { reviewRevisionAuthorMaterial, type ReviewRevisionContext } from '../review-revision-generation'

/**
 * P7（2026-10-16）：审稿链作者材料块支持「省略已由模板侧注入的字段」。
 *
 * 最要紧的两条：
 * ① **默认行为必须逐字不变**（精修/改写链依赖它）；
 * ② omit `worldbuilding` 后，**前缀去重不能把 `config.worldSetting` 换成「见 worldbuilding 原文」**
 *    —— 那份被引用的原文并不在 prompt 里，会静默丢作者设定。
 */

const WORLDBUILDING = '# 世界观\n\n### 1.【核心规则与体系漏洞】\n记录先于事实。\n\n### 3.【隐喻与深层危机】\n终极谜团：能力是被「写」进来的。'

function fixture(overrides: Partial<ReviewRevisionContext> = {}): ReviewRevisionContext {
  return {
    version: 1,
    operation: 'review-chapter',
    source: { chapterNumber: 2, title: '第二章', content: '正文' },
    sourceHash: 'h',
    writingLanguage: 'zh-CN',
    uiLocale: 'zh-CN',
    config: {
      worldSetting: '作者手写的世界观设定原文。',
      coreOutline: '核心大纲。',
      globalGuidance: '全局创作指导。',
      wordsPerChapter: 3000,
    },
    authorInputs: [],
    characterStates: '（作者填的角色状态）',
    worldbuilding: WORLDBUILDING,
    history: [],
    blueprints: [],
    frozenGoals: {},
    preflightFindings: [],
    ...overrides,
  } as unknown as ReviewRevisionContext
}

describe('reviewRevisionAuthorMaterial · P7 omit', () => {
  it('不传 omit：默认行为不变，两个字段都在（回归锁）', () => {
    const block = reviewRevisionAuthorMaterial(fixture())
    expect(block).toContain('【世界观设定】')
    expect(block).toContain('终极谜团：能力是被「写」进来的。')
    expect(block).toContain('【作者角色状态｜以标注时点为准】')
    expect(block).toContain('（作者填的角色状态）')
  })

  it('omit worldbuilding：不含世界观块，但角色状态仍在', () => {
    const block = reviewRevisionAuthorMaterial(fixture(), { omit: ['worldbuilding'] })
    expect(block).not.toContain('【世界观设定】')
    expect(block).not.toContain('终极谜团：能力是被「写」进来的。')
    expect(block).toContain('【作者角色状态｜以标注时点为准】')
    // 其它块不受影响。
    expect(block).toContain('【作者确认项目配置｜约束而非已发生事实】')
    expect(block).toContain('【作者全局创作指导｜约束而非已发生事实】')
  })

  it('omit characterStates：不含角色状态块，但世界观仍在', () => {
    const block = reviewRevisionAuthorMaterial(fixture(), { omit: ['characterStates'] })
    expect(block).not.toContain('【作者角色状态｜以标注时点为准】')
    expect(block).not.toContain('（作者填的角色状态）')
    expect(block).toContain('【世界观设定】')
  })

  it('omit 两个：两块都省，其余材料完整保留', () => {
    const block = reviewRevisionAuthorMaterial(fixture(), { omit: ['worldbuilding', 'characterStates'] })
    expect(block).not.toContain('【世界观设定】')
    expect(block).not.toContain('【作者角色状态｜以标注时点为准】')
    expect(block).toContain('【作者确认项目配置｜约束而非已发生事实】')
    expect(block).toContain('【作者全局创作指导｜约束而非已发生事实】')
    expect(block).toContain('【本章作者指导｜约束】')
    expect(block).toContain('【后续蓝图/计划｜非既定历史】')
    expect(block).toContain('【本章冻结目标｜须由正文证明】')
  })

  it('★ 边界：worldSetting 是 worldbuilding 的完整前缀时，omit 后**不得**被替成「见…原文」', () => {
    // 构造：worldbuilding 以 worldSetting 开头（前缀关系成立）。
    const prefix = '作者手写的世界观设定原文。'
    const ctx = fixture({
      config: { worldSetting: prefix, coreOutline: '核心大纲。', globalGuidance: '指导。', wordsPerChapter: 3000 },
      worldbuilding: `${prefix}\n\n# 世界观\n\n### 3.【隐喻与深层危机】\n终极谜团。`,
    } as unknown as Partial<ReviewRevisionContext>)

    // ① 不 omit：前缀去重生效 —— worldSetting 被换成「见 worldbuilding 原文」（既有行为）。
    const kept = reviewRevisionAuthorMaterial(ctx)
    expect(kept).toContain('与 worldbuilding 的完整前缀相同')
    // 且被引用的原文确实在同一 prompt 里。
    expect(kept).toContain('【世界观设定】')

    // ② omit worldbuilding：**必须**保留 worldSetting 原文，且不得出现「见 worldbuilding 原文」。
    const omitted = reviewRevisionAuthorMaterial(ctx, { omit: ['worldbuilding'] })
    expect(omitted).not.toContain('【世界观设定】')
    expect(omitted).not.toContain('（本来源原文与 worldbuilding 的完整前缀相同，见该来源原文。）')
    expect(omitted).toContain(prefix)
  })

  it('omit 只影响被点名字段：authorInputs 与人工确认快照不受影响', () => {
    const ctx = fixture({
      authorInputs: [{ id: 'user-prompt', text: '【用户额外指导】写得更紧凑。' }],
    } as unknown as Partial<ReviewRevisionContext>)
    const block = reviewRevisionAuthorMaterial(ctx, { omit: ['worldbuilding', 'characterStates'] })
    expect(block).toContain('【用户额外指导】写得更紧凑。')
  })
})
