import { describe, expect, it } from 'vitest'

import { summarizeArcCoverFindings, summarizeArcDensity } from '../architecture.command'

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

describe('summarizeArcDensity（P13：弧光生成时的分层体检）', () => {
  /** 大弧有「中弧推进」，小弧带必然事件 —— 完整形态，体检应闭嘴。 */
  const HEALTHY = `# 弧光结构

## 大弧一：门牌错位与三方围猎（约 50 章）
- 类型：A 因果驱动型
- 接续理由：开篇起点
- 中弧推进：因为 中弧1 的物证被三家抢，所以 中弧2 转向摸清谁在定价
- 核心冲突：想撑到零点不开口，三方轮流逼他开口
- 结束状态：鲁传福背上第一笔登记账（中弧2）、韩九畴首次报价（中弧2）
### 中弧 1：门牌错位与第一页报告（约 25 章）
- 类型：A 因果驱动型
- 因果：因为"我马上到"成真，所以门牌集体错位，观察科把程实写进报告。
- 时序：本中弧起点 = 程实刚醒。
- 转折：物证同时被三家抢，围猎从偶然变系统。
- 小弧：
  - 错位门牌（约 8 章）：17 号换成 71 号 → 街坊说法不一 → 找周德胜对质 → 拿到排班单 → 手里有物证但不知能证明什么
  - 第一页报告（约 8 章）：观察科递来登记回执 → 沈砚上门问话 → 回执被拍照 → 被写进第一页报告
  - 三家人抢一张排班表（约 9 章）：庄家找上门 → 自媒体直播围堵 → 物证被三家同时认领
### 中弧 2：沉默也被标价（约 25 章）
- 类型：B 目标驱动型
- 目标：从"撑过今天别开口"到"摸清谁在替他定价"
- 尝试 1：用录音棚加班拖第一句 → 鲁传福替他挡电话被登记 → 因此必须再试
- 转折：韩九畴报出"干净一天"的价。
- 小弧：
  - 录音棚加班（约 12 章）：老鲁让程实少接电话 → 程实躲在棚里录旁白 → 观察科登记来电记录 → 老鲁替他挡了一次 → 程实发现躲不掉
  - 面摊直播（约 13 章）：借庞大勇面摊人流打掩护 → 姜小满蹲点直播 → 逼出第二句抢位险情 → 韩九畴报价
`

  it('完整形态（大弧有中弧推进、小弧带必然事件）时闭嘴', () => {
    expect(summarizeArcDensity(HEALTHY, zh)).toBeNull()
  })

  it('小弧只有名字 ⇒ 点名「这些小弧覆盖的 N 章拿不到本层材料」', () => {
    const nameless = HEALTHY.replace(
      /  - 错位门牌（约 8 章）：.*\n  - 第一页报告（约 8 章）：.*\n  - 三家人抢一张排班表（约 9 章）：.*/u,
      '- 小弧：错位门牌（约 8 章）；第一页报告（约 8 章）；三家人抢一张排班表（约 9 章）',
    )
    const note = summarizeArcDensity(nameless, zh)!
    expect(note).toContain('弧光分层体检')
    expect(note).toContain('没有必然事件')
    expect(note).toContain('25 章')
  })

  it('大弧缺「中弧推进」时单独报一条，不与小弧问题互相遮蔽', () => {
    const noProgression = HEALTHY.replace(/^- 中弧推进：.*\n/mu, '').replace(
      /  - 错位门牌（约 8 章）：.*/u,
      '  - 错位门牌（约 8 章）',
    )
    const note = summarizeArcDensity(noProgression, zh)!
    expect(note).toContain('没有「中弧推进」')
    expect(note).toContain('没有必然事件')
  })

  it('结束状态没点名任何中弧 ⇒ 报「这一卷的收尾没有落点」', () => {
    const unassigned = HEALTHY.replace(
      /^- 结束状态：.*$/mu,
      '- 结束状态：门牌错位被定性为集体错觉，程实被迫接受一次"换"。',
    )
    expect(summarizeArcDensity(unassigned, zh)).toContain('收尾没有落点')
  })

  it('结构不可解析时闭嘴（枚举故事结构行为与从前一致）', () => {
    expect(summarizeArcDensity('第一幕：建置', zh)).toBeNull()
    expect(summarizeArcDensity(null, zh)).toBeNull()
  })
})
