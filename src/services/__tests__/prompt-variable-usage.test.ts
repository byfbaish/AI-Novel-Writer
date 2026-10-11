import { describe, expect, it } from 'vitest'

import { extractTemplateVariables, findDuplicatedBodyVariables } from '../prompt-variable-usage'

describe('extractTemplateVariables', () => {
  it('按出现顺序返回变量名并去重', () => {
    expect(extractTemplateVariables('{{b}} 与 {{a}} 与 {{b}}')).toEqual(['b', 'a'])
  })

  it('忽略不是变量的花括号', () => {
    expect(extractTemplateVariables('{ 单个花括号 } {{}} {{ 带空格 }} {{ok_1}}')).toEqual(['ok_1'])
  })

  it('空文本没有变量', () => {
    expect(extractTemplateVariables('')).toEqual([])
  })
})

describe('findDuplicatedBodyVariables', () => {
  it('正文与补充指导都写了的变量会被识别出来', () => {
    expect(findDuplicatedBodyVariables('题材：{{genre}}', '依据 {{genre}} 写故事前提。')).toEqual(['genre'])
  })

  it('只在补充指导里出现的变量不算重复（它是唯一出口）', () => {
    expect(findDuplicatedBodyVariables('题材：{{genre}}', '补充指令：{{step_guidance}}')).toEqual([])
  })

  it('返回顺序跟随补充指导里的书写顺序，且同一变量只报一次', () => {
    expect(findDuplicatedBodyVariables(
      '{{genre}} {{sub_genre}} {{topic}}',
      '依据 {{topic}}、{{genre}}、又 {{topic}} 生成。',
    )).toEqual(['topic', 'genre'])
  })

  it('补充指导为空时没有重复', () => {
    expect(findDuplicatedBodyVariables('{{genre}}', '')).toEqual([])
  })
})
