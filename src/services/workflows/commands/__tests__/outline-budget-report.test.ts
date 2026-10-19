import { describe, expect, it } from 'vitest'
import { summarizeOutlineLength, summarizeOutlinePrefix } from '../architecture.command'

// E4c / E4a-1 的**只读预估**：只写日志，不改提示词、不改批次范围。
// 设计稿 volume-quota-context-budget-design.md §3.3 / §8 / §10。
const zhText = (zh: string) => zh

const OUTLINE = [
  '## 第1章：门牌',
  '正'.repeat(600),
  '## 第2章：定价',
  '正'.repeat(600),
  '## 第3章：立卷',
  '正'.repeat(600),
].join('\n')

const OUTLINE_ON_TARGET = [
  '## 第1章：门牌',
  '正'.repeat(300),
  '## 第2章：定价',
  '正'.repeat(300),
  '## 第3章：立卷',
  '正'.repeat(300),
].join('\n')

const ARC = ['## 卷一：开局', '### 单元一：门牌', '### 单元二：定价', '', '## 卷二：销档', '### 单元一：配合'].join('\n')

describe('summarizeOutlineLength：大纲字数体检', () => {
  it('没有大纲 / 没有目标时闭嘴', () => {
    expect(summarizeOutlineLength('', { targetUnits: 300, writingLanguage: 'zh-CN' })).toBeNull()
    expect(summarizeOutlineLength(OUTLINE, { targetUnits: 0, writingLanguage: 'zh-CN' })).toBeNull()
    expect(summarizeOutlineLength(OUTLINE, { targetUnits: null, writingLanguage: 'zh-CN' })).toBeNull()
  })

  it('没有章标题时闭嘴', () => {
    expect(summarizeOutlineLength('只有一段散文，没有章标题。', { targetUnits: 300, writingLanguage: 'zh-CN' })).toBeNull()
  })

  it('贴着目标写不报', () => {
    expect(summarizeOutlineLength(OUTLINE_ON_TARGET, { targetUnits: 300, writingLanguage: 'zh-CN' })).toBeNull()
  })

  it('连续超写时报告，且带「只提示」口径', () => {
    const note = summarizeOutlineLength(OUTLINE, { targetUnits: 150, writingLanguage: 'zh-CN' })
    expect(note).toContain('只提示')
    expect(note).toContain('大纲字数体检')
  })

  it('英文口径', () => {
    const note = summarizeOutlineLength(OUTLINE, { targetUnits: 150, writingLanguage: 'en-US' })
    expect(note).toContain('advisory only')
  })
})

describe('summarizeOutlinePrefix：前缀只读预估', () => {
  it('没有前缀 / 没有目标时闭嘴', () => {
    expect(summarizeOutlinePrefix('', { totalChapters: 60, from: 1, targetUnits: 300 }, zhText)).toBeNull()
    expect(summarizeOutlinePrefix(OUTLINE, { totalChapters: 60, from: 1, targetUnits: null }, zhText)).toBeNull()
  })

  it('有前缀时给出整段与投影两条读数，且标注「只读」', () => {
    const note = summarizeOutlinePrefix(OUTLINE, {
      totalChapters: 60,
      from: 1,
      arcPlan: ARC,
      targetUnits: 300,
    }, zhText)
    expect(note).toContain('只读');
    expect(note).toContain('整段前缀');
    expect(note).toContain('投影后');
  })

  it('英文文案包含 read-only', () => {
    const note = summarizeOutlinePrefix(OUTLINE, {
      totalChapters: 60,
      from: 1,
      targetUnits: 300,
    }, (_zh, en) => en)
    expect(note).toContain('read-only');
  })
})

