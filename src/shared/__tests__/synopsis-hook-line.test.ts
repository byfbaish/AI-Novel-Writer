import { describe, expect, it } from 'vitest'
import {
  HOOK_TYPES,
  extractLastHookLine,
  formatHookLineForPrompt,
  parseHookLine,
} from '../synopsis-hook-line'

describe('parseHookLine', () => {
  it('解析新格式：类型 + 断点 + 种在', () => {
    const parsed = parseHookLine('钩子：悬念截断 — 刀停在半空｜种在：赵铎的尸骨')
    expect(parsed).not.toBeNull()
    expect(parsed!.type).toBe('悬念截断')
    expect(parsed!.breakPoint).toBe('刀停在半空')
    expect(parsed!.plantedIn).toBe('赵铎的尸骨')
    expect(parsed!.legacy).toBe(false)
  })

  it('兼容旧名「收尾：」：type 与 plantedIn 都是 null', () => {
    const parsed = parseHookLine('收尾：门没关。')
    expect(parsed).not.toBeNull()
    expect(parsed!.legacy).toBe(true)
    expect(parsed!.type).toBeNull()
    expect(parsed!.plantedIn).toBeNull()
    expect(parsed!.breakPoint).toBe('门没关。')
  })

  it('六值全部可识别，且分隔符不影响判定', () => {
    for (const type of HOOK_TYPES) {
      expect(parseHookLine(`钩子：${type} — 某一件事｜种在：某物`)!.type).toBe(type)
      expect(parseHookLine(`钩子：${type}——某一件事`)!.type).toBe(type)
      expect(parseHookLine(`钩子：${type}-某一件事`)!.type).toBe(type)
    }
  })

  it('不带破折号、只写类型也算（断点为空，由校验去报）', () => {
    const parsed = parseHookLine('钩子：落点｜种在：那四块灵石')
    expect(parsed!.type).toBe('落点')
    expect(parsed!.breakPoint).toBe('')
    expect(parsed!.plantedIn).toBe('那四块灵石')
  })

  it('六值以外的词不当类型，整段算断点（作者手写不算错）', () => {
    const parsed = parseHookLine('钩子：他把账本合上了 — 但没锁')
    expect(parsed!.type).toBeNull()
    expect(parsed!.breakPoint).toBe('他把账本合上了 — 但没锁')
  })

  it('半角冒号与半角竖线同样认', () => {
    const parsed = parseHookLine('钩子: 危机降临 - 门外的脚步声|种在: 门房')
    expect(parsed!.type).toBe('危机降临')
    expect(parsed!.breakPoint).toBe('门外的脚步声')
    expect(parsed!.plantedIn).toBe('门房')
  })

  it('行首有列表符 / 引用符 / 缩进时仍能识别', () => {
    expect(parseHookLine('- 钩子：信息炸弹 — 纸条上的字｜种在：袖子')!.type).toBe('信息炸弹')
    expect(parseHookLine('> 钩子：情绪断裂 — 他笑了｜种在：茶碗')!.type).toBe('情绪断裂')
    expect(parseHookLine('   钩子：两难选择 — 两份都收进袖子')!.type).toBe('两难选择')
  })

  it('不是钩子行时返回 null', () => {
    expect(parseHookLine('选择：他人 —— 他去求了赵铎')).toBeNull()
    expect(parseHookLine('正文一段，收尾要写得好。')).toBeNull()
    expect(parseHookLine('')).toBeNull()
  })

  it('行名后为空时保留结构、断点为空串', () => {
    const parsed = parseHookLine('钩子：')
    expect(parsed).not.toBeNull()
    expect(parsed!.type).toBeNull()
    expect(parsed!.breakPoint).toBe('')
  })
})

describe('extractLastHookLine', () => {
  it('取文本里最后一条钩子行（即末章那条）', () => {
    const text = [
      '## 第1章：门口',
      '选择：他人 —— 他去求了赵铎',
      '钩子：悬念截断 — 刀停在半空｜种在：赵铎的尸骨',
      '## 第2章：门里',
      '钩子：危机降临 — 门外站着的那个人｜种在：门房',
    ].join('\n')
    const parsed = extractLastHookLine(text)
    expect(parsed!.type).toBe('危机降临')
    expect(parsed!.plantedIn).toBe('门房')
  })

  it('混入旧名「收尾：」时同样能取到', () => {
    const text = ['## 第1章：门口', '收尾：门没关。'].join('\n')
    expect(extractLastHookLine(text)!.legacy).toBe(true)
  })

  it('没有钩子行 / 空文本时返回 null', () => {
    expect(extractLastHookLine('## 第1章：门口\n正文一段。')).toBeNull()
    expect(extractLastHookLine('')).toBeNull()
    expect(extractLastHookLine(null)).toBeNull()
    expect(extractLastHookLine(undefined)).toBeNull()
  })
})

describe('formatHookLineForPrompt', () => {
  it('压成单行，保留原文措辞', () => {
    const parsed = parseHookLine('钩子：落点 — 他把四块灵石推过去了｜种在：柜台')
    expect(formatHookLineForPrompt(parsed!)).toBe('钩子：落点 — 他把四块灵石推过去了｜种在：柜台')
  })
})
