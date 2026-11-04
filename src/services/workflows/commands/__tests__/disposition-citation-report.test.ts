import { describe, expect, it } from 'vitest'

import { summarizeDispositionFindings } from '../architecture.command'

/**
 * `summarizeDispositionFindings` 的职责边界：**只把已判定的问题翻译成人话**。
 * 判定本身在 `auditDispositionCitations`（`src/shared/__tests__/disposition-citation.test.ts` 已覆盖），
 * 这里只断言「哪些情况会说话、说什么、什么时候闭嘴」。
 *
 * 闭嘴（返回 null）是最重要的行为之一：判据刚接通，噪声会让作者直接忽略整片提示。
 *
 * 2026-10-29 深夜：卡从四层改成三格。旧卡不再「闭嘴」，而是**报一条汇总**
 * （逐条报 UNKNOWN_X 会在百章大纲上产出上百条噪声，折叠后信息量反而更低）。
 */
const ARCH = `# 角色图谱

## 主角：陈砚
- 性别：男
- 性格：【禁区】
X1 不替人作保 —— 宁可不接这趟活，也不在保状上按手印
X2 不当众认错 —— 宁可挨断一根肋骨
【筹码】
母亲：镖行洗衣，咳血
【处境】
given 站在灰渠废码头

## 配角：赵铎
- 性别：男
- 性格：【禁区】
X1 另一张卡的线 —— 跟他无关
`

/** 旧四层卡：没有【禁区】段。 */
const LEGACY_ARCH = `# 角色图谱

## 主角：陈砚
- 性别：男
- 性格：第一层【他在乎什么】
B1 他答应过要护住的那个人
第三层【他对各类事的做法】
D1 有人讨承诺 → 先要凭据
`

// 只取中文那一条：`summarizeDispositionFindings` 会调 `text(zh, en)`，多传的参数被忽略。
const zh = (value: string) => value

function chapter(index: number, choice: string): string {
  return [`## 第${index}章：门口`, '', choice, '', '正文一段。', '', '钩子：门没关。', ''].join('\n')
}

describe('summarizeDispositionFindings', () => {
  it('旧四层卡只说一条汇总，并说清影响多少章', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— A｜否掉了 B，因为 X1：不替人作保'),
      chapter(2, '选择：规则 —— A｜否掉了 B，因为 X2：不当众认错'),
      chapter(3, '选择：自己 —— A｜否掉了 B，因为 无：他不在场'),
    ].join('\n')
    const note = summarizeDispositionFindings(synopsis, LEGACY_ARCH, 1, 3, zh)
    expect(note).not.toBeNull()
    expect(note).toContain('旧格式')
    expect(note).toContain('2 章')
    // 逐条 UNKNOWN_X 会把真信号埋掉 —— 汇总里不许出现具体编号
    expect(note).not.toContain('X1')
  })

  it('旧卡但整批根本没引用时闭嘴', () => {
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为他谨慎')
    expect(summarizeDispositionFindings(synopsis, LEGACY_ARCH, 1, 3, zh)).toBeNull()
    expect(summarizeDispositionFindings(synopsis, '', 1, 3, zh)).toBeNull()
    expect(summarizeDispositionFindings(synopsis, null, 1, 3, zh)).toBeNull()
  })

  it('全部合规时闭嘴', () => {
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为 X2：不当众认错')
    expect(summarizeDispositionFindings(synopsis, ARCH, 1, 3, zh)).toBeNull()
  })

  it('引用了卡上不存在的编号时说话，并点出章名', () => {
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为 X9：编的')
    const note = summarizeDispositionFindings(synopsis, ARCH, 1, 3, zh)
    expect(note).not.toBeNull()
    expect(note).toContain('性格引用体检')
    expect(note).toContain('第1章')
    expect(note).toContain('X9')
    // 必须说清「不影响保存」，否则作者会以为大纲没存上
    expect(note).toContain('不阻断')
  })

  it('只读主角那一块 —— 配角卡上的编号不算数', () => {
    // 赵铎卡上有 X1，但主角卡上的 X1 是「不替人作保」；引用 X1 必须按主角的判。
    // 旧办法把整份图谱的编号并成一个白名单，连「引用了别人卡上的编号」都抓不到。
    const synopsis = chapter(1, '选择：规则 —— A｜否掉了 B，因为 X1：不替人作保')
    expect(summarizeDispositionFindings(synopsis, ARCH, 1, 3, zh)).toBeNull()

    const broken = chapter(1, '选择：规则 —— A｜否掉了 B，因为 X3：主角卡上没有')
    expect(summarizeDispositionFindings(broken, ARCH, 1, 3, zh)).toContain('X3')
  })

  it('本批之前的章不重复报 —— 只报区间内的问题', () => {
    const synopsis = [
      chapter(1, '选择：规则 —— A｜否掉了 B，因为 X9：编的'),
      chapter(5, '选择：规则 —— A｜否掉了 B，因为 X2：不当众认错'),
    ].join('\n')
    expect(summarizeDispositionFindings(synopsis, ARCH, 4, 8, zh)).toBeNull()
  })

  it('超过 3 条时折叠成「另有 N 处」', () => {
    // 每章用一个**不同的**编造编号：若都用 X9，会额外触发「连续五章同一条」，
    // 那就变成 5 + 1 条，折叠数对不上 —— 这里要单独验折叠。
    const synopsis = [7, 8, 9, 6, 5]
      .map((bad, index) => chapter(index + 1, `选择：规则 —— A｜否掉了 B，因为 X${bad}：编的`))
      .join('\n')
    const note = summarizeDispositionFindings(synopsis, ARCH, 1, 5, zh)
    expect(note).toContain('另有 2 处')
  })

  it('筹码名字编的时候说话', () => {
    const synopsis = chapter(1, '选择：交换 —— A｜否掉了 B，因为 筹码：隔壁老王')
    const note = summarizeDispositionFindings(synopsis, ARCH, 1, 3, zh)
    expect(note).toContain('隔壁老王')
  })

  it('合法的筹码引用不报', () => {
    const synopsis = chapter(1, '选择：交换 —— A｜否掉了 B，因为 筹码：母亲')
    expect(summarizeDispositionFindings(synopsis, ARCH, 1, 3, zh)).toBeNull()
  })
})
