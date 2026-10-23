import { describe, expect, it } from 'vitest'
import { CHAPTER_ROLE_LABELS, CHAPTER_ROLES } from '../../../shared/chapter-role'
import { matchChapterRole, resolveChapterRoleGuidance } from '../chapter-role-guidance'

describe('matchChapterRole', () => {
  it('整串等于七档任一中文档名时命中', () => {
    for (const role of CHAPTER_ROLES) {
      expect(matchChapterRole(role)).toBe(role)
    }
  })

  it('空值不命中', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(matchChapterRole(value)).toBeNull()
    }
  })

  it('认不出的自定义值不命中（不猜、不回显）', () => {
    for (const value of ['开端', '双线交汇', '非高潮', '小高潮/转折——为第7章蓄压', 'Conflict with the guild']) {
      expect(matchChapterRole(value)).toBeNull()
    }
  })

  it('前导档名 + 分隔符 + 说明时按前导标签命中', () => {
    expect(matchChapterRole('发展——承接第5章门牌篡改的物证')).toBe('发展')
    expect(matchChapterRole('转折（小高潮：底牌翻出）')).toBe('转折')
    expect(matchChapterRole('建置：开局')).toBe('建置')
    expect(matchChapterRole('冲突/高潮')).toBe('冲突')
    expect(matchChapterRole(' 高潮 ')).toBe('高潮')
  })

  it('剥掉一层成对包裹符后仍能命中', () => {
    expect(matchChapterRole('【收尾】')).toBe('收尾')
    expect(matchChapterRole('[铺垫]')).toBe('铺垫')
    expect(matchChapterRole('「冲突」')).toBe('冲突')
  })

  it('英文档名只在整串（大小写不敏感）时命中', () => {
    expect(matchChapterRole('Setup')).toBe('建置')
    expect(matchChapterRole('turning point')).toBe('转折')
    expect(matchChapterRole('RESOLUTION')).toBe('收尾')
    expect(matchChapterRole('Setup and payoff')).toBeNull()
  })
})

describe('resolveChapterRoleGuidance', () => {
  it('七档在中英两种语言下都给出一前导 + 四条成对条款', () => {
    for (const role of CHAPTER_ROLES) {
      for (const language of ['zh-CN', 'en-US'] as const) {
        const text = resolveChapterRoleGuidance(role, language)
        const lines = text.split('\n')
        expect(lines).toHaveLength(5)
        if (language === 'zh-CN') {
          expect(text).toContain(`本章按「${CHAPTER_ROLE_LABELS[role].zhCN}」定位取舍`)
          expect(lines.slice(1).filter(line => line.startsWith('承担：'))).toHaveLength(2)
          expect(lines.slice(1).filter(line => line.startsWith('不做：'))).toHaveLength(2)
        } else {
          expect(text).toContain(`positioned as "${CHAPTER_ROLE_LABELS[role].enUS}"`)
          expect(lines.slice(1).filter(line => line.startsWith('Own:'))).toHaveLength(2)
          expect(lines.slice(1).filter(line => line.startsWith("Don't:"))).toHaveLength(2)
        }
      }
    }
  })

  it('空值与认不出的值零字节（调用方据此不留空标题）', () => {
    for (const value of ['', '   ', null, undefined, '开端', '双线交汇', '非高潮']) {
      expect(resolveChapterRoleGuidance(value, 'zh-CN')).toBe('')
      expect(resolveChapterRoleGuidance(value, 'en-US')).toBe('')
    }
  })

  it('英文项目输出英文文案，不夹中文档名', () => {
    const text = resolveChapterRoleGuidance('建置', 'en-US')
    expect(text).toContain('Own:')
    expect(text).not.toMatch(/[\u3400-\u9fff]/u)
  })

  it('中文项目不夹英文条款', () => {
    const text = resolveChapterRoleGuidance('发展', 'zh-CN')
    expect(text).toContain('承担：')
    expect(text).not.toContain('Own:')
    expect(text).not.toContain("Don't:")
  })

  it('七档文案互不相同（防复制粘贴写重）', () => {
    const texts = CHAPTER_ROLES.map(role => resolveChapterRoleGuidance(role, 'zh-CN'))
    expect(new Set(texts).size).toBe(CHAPTER_ROLES.length)
  })

  it('单档体积不膨胀成第二份合同', () => {
    for (const role of CHAPTER_ROLES) {
      expect(resolveChapterRoleGuidance(role, 'zh-CN').length).toBeLessThan(400)
      expect(resolveChapterRoleGuidance(role, 'en-US').length).toBeLessThan(900)
    }
  })
})
