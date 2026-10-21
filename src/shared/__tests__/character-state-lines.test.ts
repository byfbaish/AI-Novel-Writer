import { describe, expect, it } from 'vitest'
import { characterStateFacts, formatCharacterStateLines } from '../character-state-lines'
import type { CharacterRosterCharacterState } from '../character-roster'

/** 定稿来源身份（derived 字段必须带它，否则无法判断时效）。 */
const source = (chapterNumber: number) => ({
  draftId: chapterNumber * 10,
  finalizationId: `fin-${chapterNumber}`,
  chapterNumber,
  contentHash: `hash-${chapterNumber}`,
})

function state(patch: Partial<CharacterRosterCharacterState>): CharacterRosterCharacterState {
  return {
    location: '', powerLevel: '', physicalState: '', mentalState: '', keyItems: '', recentEvents: '',
    updatedAtChapter: 1,
    ...patch,
  }
}

describe('formatCharacterStateLines', () => {
  it('作者字段沿用旧的 @chapterN 格式', () => {
    const text = formatCharacterStateLines([{
      name: '顾长风', role: '杂役',
      currentState: state({
        location: '百草园外园',
        provenance: { location: { kind: 'author', chapterNumber: 3 } },
      }),
    }], { writingLanguage: 'zh-CN', upToChapter: 4 })

    expect(text).toContain('顾长风（杂役）状态')
    // 旧格式逐字保留：既有 prompt 断言依赖它。
    expect(text).toContain('location@chapter3: 百草园外园')
  })

  it('派生字段注入并标注「派生」', () => {
    const text = formatCharacterStateLines([{
      name: '顾长风',
      currentState: state({
        keyItems: '四枚下品灵石、三天量活气散',
        provenance: { keyItems: { kind: 'derived', source: source(3) } },
      }),
    }], { writingLanguage: 'zh-CN', upToChapter: 4 })

    expect(text).toContain('keyItems@chapter3·派生: 四枚下品灵石、三天量活气散')
  })

  it('legacy 来源一律跳过（来源未知不能当事实）', () => {
    const text = formatCharacterStateLines([{
      name: '顾长风',
      currentState: state({
        location: '旧值',
        provenance: { location: { kind: 'legacy' } },
      }),
    }], { writingLanguage: 'zh-CN', upToChapter: 4 })

    expect(text).toBe('')
  })

  it('晚于本章的状态不注入（快照是「截至该章」，不是永久约束）', () => {
    const text = formatCharacterStateLines([{
      name: '顾长风',
      currentState: state({
        physicalState: '左臂骨裂',
        mentalState: '强撑',
        provenance: {
          physicalState: { kind: 'derived', source: source(8) },
          mentalState: { kind: 'author', chapterNumber: 2 },
        },
      }),
    }], { writingLanguage: 'zh-CN', upToChapter: 4 })

    expect(text).not.toContain('左臂骨裂')
    expect(text).toContain('mentalState@chapter2: 强撑')
  })

  it('includeDerived: false 时只留作者声明', () => {
    const text = formatCharacterStateLines([{
      name: '顾长风',
      currentState: state({
        keyItems: '派生值',
        location: '作者值',
        provenance: {
          keyItems: { kind: 'derived', source: source(3) },
          location: { kind: 'author', chapterNumber: 3 },
        },
      }),
    }], { writingLanguage: 'zh-CN', upToChapter: 4, includeDerived: false })

    expect(text).toContain('作者值')
    expect(text).not.toContain('派生值')
  })

  it('无 provenance 的字段不注入（无法判断时效）', () => {
    const text = formatCharacterStateLines([{
      name: '顾长风',
      currentState: state({ location: '有值但无来源' }),
    }], { writingLanguage: 'zh-CN', upToChapter: 4 })

    expect(text).toBe('')
  })

  it('没有任何状态时返回空串，由调用方决定兜底文案', () => {
    expect(formatCharacterStateLines([{ name: '顾长风' }], { writingLanguage: 'zh-CN' })).toBe('')
    expect(formatCharacterStateLines([], { writingLanguage: 'zh-CN' })).toBe('')
  })

  it('英文口径用 derived 标记', () => {
    const text = formatCharacterStateLines([{
      name: 'Gu Changfeng',
      currentState: state({
        location: 'outer garden',
        provenance: { location: { kind: 'derived', source: source(3) } },
      }),
    }], { writingLanguage: 'en-US', upToChapter: 4 })

    expect(text).toContain('state (read as of the annotated chapter')
    expect(text).toContain('location@chapter3·derived: outer garden')
  })
})

describe('characterStateFacts', () => {
  it('材料块用「字段@章号: 值」，派生标记紧跟章号', () => {
    const facts = characterStateFacts(state({
      location: '码头',
      keyItems: '四枚灵石',
      provenance: {
        location: { kind: 'author', chapterNumber: 1 },
        keyItems: { kind: 'derived', source: source(3) },
      },
    }), { writingLanguage: 'zh-CN', upToChapter: 4 })

    expect(facts).toEqual(['location@chapter1: 码头', 'keyItems@chapter3·派生: 四枚灵石'])
  })

  it('状态缺失或全无来源时返回空数组，不产生空行', () => {
    expect(characterStateFacts(undefined, { writingLanguage: 'zh-CN' })).toEqual([])
    expect(characterStateFacts(state({ location: '无来源' }), { writingLanguage: 'zh-CN' })).toEqual([])
  })
})
