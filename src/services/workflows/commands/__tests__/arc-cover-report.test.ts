import { describe, expect, it } from 'vitest'

import { summarizeArcCoverFindings } from '../architecture.command'

/**
 * `summarizeArcCoverFindings` 的职责边界：**只把已判定的违规翻译成人话**。
 * 判定本身在 `auditArcCovers`（`src/shared/__tests__/arc-node.test.ts` 已覆盖），
 * 这里只断言「哪些情况会说话、说什么、什么时候闭嘴」。
 */
const PLAN = `# 弧光结构

## 大弧一：睁眼十秒（约 1–52 章）
### 中弧 1：门牌错位（约 1–26 章）
- 因果：那句敷衍的"我马上到"落地。
- 时序：开篇那个清晨。
- 转折：闭嘴比说谎更贵。
- 小弧：睁眼十秒（约 13 章）；纸门牌（约 13 章）

### 中弧 2：三方上门（约 27–52 章）
- 目标：有一套能重复用的拖字诀。
- 尝试 2：用记事本和纸条跟人笔谈。
- 转折：他第一次主动说了一句精心设计的谎。
`
/** 全书 52 章 = 本测试弧光的自报合计，避免等比折算干扰章号断言。 */
const TOTAL = 52
const zh = (_zh: string, _en: string) => _zh

describe('summarizeArcCoverFindings', () => {
  it('全部合规时闭嘴（返回 null）', () => {
    // 小弧是「归属」：本章落在哪个小弧区间就写哪个；转折是一次性额度，只在它真正
    // 发生的那一章写。「覆盖：无」是明确声明，不算「没有写声明」。
    // 本批只走到第 3 章，中弧 1 的转折（区间到第 26 章）还没到期 ⇒ 不该被报成漏覆盖。
    const body = [
      '## 第1章：开篇',
      '覆盖：M1-1/小弧:睁眼十秒',
      '## 第2章：闭嘴',
      '覆盖：M1-1/小弧:睁眼十秒',
      '## 第3章：时序',
      '覆盖：无',
    ].join('\n')
    expect(summarizeArcCoverFindings(body, PLAN, TOTAL, 1, 3, zh)).toBeNull()
  })

  it('把整段规格字段当额度声明时说人话（实机第 6/7 章的形态）', () => {
    const body = '## 第1章：时序\n覆盖：M1-1/时序'
    const note = summarizeArcCoverFindings(body, PLAN, TOTAL, 1, 1, zh)
    expect(note).toContain('M1-1/时序')
    expect(note).toContain('整段规格')
  })

  it('把「提前消耗后续中弧」说成一句人话，并带上提前了多少章', () => {
    const body = '## 第2章：笔谈\n覆盖：M1-2/尝试 2'
    const note = summarizeArcCoverFindings(body, PLAN, TOTAL, 2, 2, zh)
    expect(note).toContain('M1-2/尝试 2')
    expect(note).toContain('提前了 25 章')
    expect(note).toContain('不阻断')
  })

  it('缺「覆盖：」行时提示章数，而不是静默通过', () => {
    const body = '## 第1章：开篇\n正文。'
    const note = summarizeArcCoverFindings(body, PLAN, TOTAL, 1, 1, zh)
    expect(note).toContain('1 章没有写「覆盖：」声明')
  })

  it('「缺声明」与「漏覆盖」是两个独立问题，必须同一条提示里都出现', () => {
    // 实测形态（2026-10-18 作者库 ch1–5）：第 4 章整行没写「覆盖：」，
    // 同一批里一个小弧也从没被任何章声明。旧代码 `if (problems.length === 0)`
    // 让前一句把后一句整段吞掉 —— 修好一个看得见的，掩盖一个看不见的。
    const body = [
      '## 第1章：开篇',
      '覆盖：无',
      '## 第2章：沉默',
    ].join('\n')
    const note = summarizeArcCoverFindings(body, PLAN, TOTAL, 1, 2, zh)!
    expect(note).toContain('1 章没有写「覆盖：」声明')
    expect(note).toContain('结构位没有任何一章声明')
    // 第 1–2 章落在「睁眼十秒」[1,13] 里却都写「覆盖：无」⇒ 归属缺失，这才是本批的漏覆盖。
    expect(note).toContain('M1-1/小弧:睁眼十秒')
  })

  it('弧光不可解析（无结构位）时闭嘴 —— 枚举故事结构不该被这套规则骚扰', () => {
    const body = '## 第1章：开篇\n正文。'
    expect(summarizeArcCoverFindings(body, '(非弧光结构)', TOTAL, 1, 1, zh)).toBeNull()
    expect(summarizeArcCoverFindings(body, null, TOTAL, 1, 1, zh)).toBeNull()
  })
})
