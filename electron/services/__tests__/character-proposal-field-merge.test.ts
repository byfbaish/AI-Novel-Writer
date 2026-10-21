import { describe, expect, it } from 'vitest'

import { mergeAdoptedCharacterFields } from '../character-proposal-service'

describe('采用到已有角色时的字段合并', () => {
  it('空字段直接采用候选（补全仍然生效）', () => {
    expect(mergeAdoptedCharacterFields({ background: '' }, { background: '新的背景' }))
      .toEqual({ background: '新的背景' })
  })

  it('已有非空叙述性字段改为追加，不覆盖原文', () => {
    expect(mergeAdoptedCharacterFields(
      { background: '正文第 2 章引用的原有背景。' },
      { background: '候选补充：他是药铺学徒。' },
    )).toEqual({ background: '正文第 2 章引用的原有背景。\n\n候选补充：他是药铺学徒。' })
  })

  it('候选已经包含在现有文本里时不重复追加（重复导入幂等）', () => {
    expect(mergeAdoptedCharacterFields(
      { background: '他是药铺学徒，常年在城里跑腿。' },
      { background: '他是药铺学徒' },
    )).toEqual({})
  })

  it('忽略空白与标点差异后仍判定为重复', () => {
    expect(mergeAdoptedCharacterFields(
      { personality: '沉稳，寡言。' },
      { personality: '沉稳 寡言' },
    )).toEqual({})
  })

  it('标识字段保留现有值，不覆盖也不拼接', () => {
    expect(mergeAdoptedCharacterFields(
      { name: '赵无妄', gender: '男', age: '三十', role: 'antagonist' },
      { name: '赵妄', gender: '女', age: '四十', role: 'protagonist' },
    )).toEqual({})
  })

  it('候选为空或与现有值相同则不产生差异', () => {
    expect(mergeAdoptedCharacterFields({ notes: '现有备注' }, { notes: '现有备注', arc: '   ' })).toEqual({})
  })
})
