import { describe, expect, it } from 'vitest'

import { summarizeDispositionFindings } from '../architecture.command'

/**
 * `summarizeDispositionFindings` 的职责边界：**只把已判定的问题翻译成人话**。
 * 判定本身在 `auditDispositionCitations`（`src/shared/__tests__/disposition-citation.test.ts` 已覆盖），
 * 这里只断言「哪些情况会说话、说什么、什么时候闭嘴」。
 *
 * 闭嘴（返回 null）是最重要的行为之一：判据刚接通，噪声会让作者直接忽略整片提示。
 */
const CARD = `第一层【他在乎什么】
B1 他答应过要护住的那个人
B2 自己的命
B3 不欠人东西

第三层【他对各类事的做法】
D1 有人讨承诺 → 先要凭据
D2 借他攒的东西 → 不动
`

/** 没按四层写的旧卡：一个 D 编号都没有。 */
const LEGACY_CARD = '他很谨慎，怕麻烦，先要凭据。'

const zh = (_zh: string, _en: string) => _zh

function chapter(index: number, choice: string): string {
  return [`## 第${index}章：门口`, '', choice, '', '正文一段。', '', '收尾：门没关。', ''].join('\n')
}

describe('summarizeDispositionFindings', () => {
  it('角色卡上还没有编号时闭嘴 —— 旧项目不该被这片噪声刷屏', () => {
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为 D9：编的')
    expect(summarizeDispositionFindings(synopsis, LEGACY_CARD, 1, 3, zh)).toBeNull()
    expect(summarizeDispositionFindings(synopsis, '', 1, 3, zh)).toBeNull()
    expect(summarizeDispositionFindings(synopsis, null, 1, 3, zh)).toBeNull()
  })

  it('全部合规时闭嘴', () => {
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为 D2：他不动那样东西')
    expect(summarizeDispositionFindings(synopsis, CARD, 1, 3, zh)).toBeNull()
  })

  it('引用了卡上不存在的编号时说话，并点出章名', () => {
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为 D9：编的')
    const note = summarizeDispositionFindings(synopsis, CARD, 1, 3, zh)
    expect(note).not.toBeNull()
    expect(note).toContain('性格引用体检')
    expect(note).toContain('第1章')
    expect(note).toContain('D9')
    // 必须说清「不影响保存」，否则作者会以为大纲没存上
    expect(note).toContain('不阻断')
  })

  it('本批之前的章不重复报 —— 只报区间内的问题', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— A｜否掉了 B，因为 D9：编的'),
      chapter(5, '选择：规则 —— A｜否掉了 B，因为 D2：他不动那样东西'),
    ].join('\n')
    // 只生成本批第 4–8 章：第 1 章的老问题不该再刷一遍
    expect(summarizeDispositionFindings(synopsis, CARD, 4, 8, zh)).toBeNull()
  })

  it('超过 3 条时折叠成「另有 N 处」', () => {
    // 每章用一个**不同的**编造编号：若都用 D9，会额外触发「连续三章同一条」，
    // 那就变成 5 + 1 条，折叠数对不上 —— 这里要单独验折叠。
    const synopsis = [7, 8, 9, 6, 5]
      .map((bad, index) => chapter(index + 1, `选择：规则 —— A｜否掉了 B，因为 D${bad}：编的`))
      .join('\n')
    const note = summarizeDispositionFindings(synopsis, CARD, 1, 5, zh)
    expect(note).toContain('另有 2 处')
  })

  it('兜底的位次超出卡上底线条数时说话 —— 卡上只有 3 条，写底线9 是编的', () => {
    const synopsis = chapter(1, '选择：守 —— A｜否掉了 B，因为 底线9：编的')
    const note = summarizeDispositionFindings(synopsis, CARD, 1, 3, zh)
    expect(note).not.toBeNull()
    expect(note).toContain('底线9')
  })

  it('合法的兜底（底线2）不报', () => {
    const synopsis = chapter(1, '选择：守 —— A｜否掉了 B，因为 底线2：他欠着的人还没还完')
    expect(summarizeDispositionFindings(synopsis, CARD, 1, 3, zh)).toBeNull()
  })
})
