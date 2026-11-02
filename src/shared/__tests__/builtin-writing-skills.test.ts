import { describe, expect, it } from 'vitest'
import { getBuiltinWritingSkills, readBuiltinWritingSkill } from '../builtin-writing-skills'
import type { WritingLanguage } from '../writing-language'

describe('builtin-writing-skills 注册表', () => {
  it('注册表非空且技能名唯一', () => {
    const skills = getBuiltinWritingSkills()
    expect(skills.length).toBeGreaterThan(0)
    const names = skills.map(skill => skill.metadata.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('每个技能都有一份非空默认正文', () => {
    for (const skill of getBuiltinWritingSkills()) {
      expect(skill.content, skill.metadata.name).toBeTruthy()
    }
  })

  it('readBuiltinWritingSkill 按名+语言取回 frontmatter + 本地化正文', () => {
    const body = readBuiltinWritingSkill('long-form-continuity', 'zh-CN')
    expect(body).toContain('name:')
    expect(body).toContain('以作者已经确认的事实为最高依据')
  })

  it('未知名返回 undefined', () => {
    expect(readBuiltinWritingSkill('no-such-skill', 'zh-CN')).toBeUndefined()
  })

  const allNames = getBuiltinWritingSkills().map(skill => skill.metadata.name)
  it.each(
    allNames.flatMap(name => (['zh-CN', 'en-US'] as WritingLanguage[]).map(language => [name, language] as const)),
  )('表格驱动：%s / %s 均能取回非空正文', (name, language) => {
    const body = readBuiltinWritingSkill(name, language)
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(0)
  })
})
