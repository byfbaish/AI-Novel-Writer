import { describe, expect, it } from 'vitest'

import { summarizeUnitBudget } from '../architecture.command'

/**
 * `summarizeUnitBudget` 的职责边界：**只把 `planProgress` 的数字翻译成一行可读日志**。
 * 配给算法本身在 `src/shared/__tests__/arc-position.test.ts` 已覆盖，这里只断言
 * 「什么时候说话、说什么、什么时候闭嘴」。
 *
 * 本文件的弧光不含章数声明 ⇒ 两卷等权折算，全书 60 章时卷一 = 1–30、卷二 = 31–60；
 * 卷一有 2 个单元（各 15 章）、卷二有 1 个单元 —— 正好覆盖 `m = 2` 与 `m = 1` 两种分母。
 */
const PLAN = [
  '# 卷 / 单元结构',
  '',
  '【全书问题】程实能不能在零点前不把第一句话交出去？',
  '',
  '## 卷一：一句我马上到，整条巷门牌全歪了',
  '- 卷叙事任务：让读者看清第一句话是账单，不是许愿。',
  '- 进入状态：他把日子压到最小。',
  '- 离开状态：观察科立卷，黑市报价。',
  '',
  '### 单元一：老陈问还是老样子，他点头点歪门牌',
  '- 叙事任务：立规则，代价落在最近的人身上。',
  '- 离开状态：门牌错位，观察科第一次写进报告。',
  '- 逼法：老陈用关心逼他接话 → 结束时变成周德胜拿房租报新价',
  '',
  '### 单元二：鲁传福拿机器故障挡笔录，挡不住',
  '- 叙事任务：把代价从自己挪到鲁传福。',
  '- 离开状态：笔录落在鲁传福名下。',
  '- 逼法：沈砚要他写书面说明 → 结束时变成把笔录落在鲁传福名下',
  '',
  '## 卷二：想销档案，先给观察科凑三处细节',
  '- 卷叙事任务：销档是拿三处细节换的。',
  '- 进入状态：工卡没了。',
  '- 离开状态：会用假合同把成真引到现成路径。',
  '',
  '### 单元一：沈砚拿销档表，换他一次配合',
  '- 叙事任务：把销档从愿望变成交易。',
  '- 离开状态：销档表变成债务。',
  '- 逼法：沈砚拿销档表换配合 → 结束时变成按三处细节补时间线',
].join('\n')

const TOTAL = 60
/** 少参函数在 TS 里可赋给 `UiText`，这样就不必写一个用不到的英文参数。 */
const zh = (zhText: string) => zhText

describe('summarizeUnitBudget', () => {
  it('均衡：已写踩在进度线上时 Z≈0，并标注不注入', () => {
    // 本批从第 16 章起（= 卷一单元二的第一章），已确认覆盖到 15 章 ⇒ 卷内已写 15 = 进度线 15。
    const note = summarizeUnitBudget(PLAN, TOTAL, 15, 16, zh)
    expect(note).toContain('单元 2/2')
    expect(note).toContain('卷 1「一句我马上到，整条巷门牌全歪了」')
    expect(note).toContain('本卷预算 30 章 ÷ 2 单元 ≈ 15.0 章/单元')
    expect(note).toContain('已写 15 章')
    expect(note).toContain('进度线 15.0 章')
    expect(note).toContain('Z = +0.0%（均衡）')
    // 「只读」必须写在明面上，避免后来的人以为它已经接进提示词
    expect(note).toContain('只读，不写进提示词')
  })

  it('不足：超前消耗时给出正 Z 与「不足」', () => {
    // 单元二应已写 15 章，实际已写到 20 章 ⇒ Z = +16.7%
    const note = summarizeUnitBudget(PLAN, TOTAL, 20, 16, zh)
    expect(note).toContain('已写 20 章')
    expect(note).toContain('Z = +16.7%（不足）')
  })

  it('充足：落后时给出负 Z 与「充足」', () => {
    const note = summarizeUnitBudget(PLAN, TOTAL, 10, 16, zh)
    expect(note).toContain('已写 10 章')
    expect(note).toContain('Z = -16.7%（充足）')
  })

  it('批从单元中间起时不给 Z —— 否则会印出固定的假「不足」', () => {
    // 卷一 = 1–30，单元一 1–15、单元二 16–30。第 21 章起批仍在单元二内部：
    // 已写 20 章 vs 进度线 15.0（单元**起点**），差额来自「批没对齐单元」，不是超前。
    // 实机同形：第 11 章起批（单元二 6–11）算成 +22.6%（不足）。
    const note = summarizeUnitBudget(PLAN, TOTAL, 20, 21, zh)
    expect(note).toContain('单元 2/2')
    expect(note).toContain('批内')
    expect(note).toContain('已写 20 章')
    expect(note).toContain('Z 不适用（本批起点第 21 章 ≠ 单元首章第 16 章）')
    expect(note).not.toContain('（不足）')
    // 预算与各卷清单不依赖 Z，仍要照常给出
    expect(note).toContain('本卷预算 30 章 ÷ 2 单元 ≈ 15.0 章/单元')
    expect(note).toContain('各卷（章/单元）：1: 30/2 · 2: 30/1')
  })

  it('单元 1 尚未开始：进度线为 0（j=1 不除错）', () => {
    const note = summarizeUnitBudget(PLAN, TOTAL, 0, 1, zh)
    expect(note).toContain('单元 1/2')
    expect(note).toContain('已写 0 章')
    expect(note).toContain('进度线 0.0 章')
    expect(note).toContain('Z = +0.0%（均衡）')
  })

  it('只有一个单元的卷不除零，且卷内已写按卷首重新起算', () => {
    // 卷二从第 31 章起；已覆盖到 30 章 ⇒ 卷二内已写 0，而不是 30
    const note = summarizeUnitBudget(PLAN, TOTAL, 30, 31, zh)
    expect(note).toContain('单元 1/1')
    expect(note).toContain('本卷预算 30 章 ÷ 1 单元 ≈ 30.0 章/单元')
    expect(note).toContain('已写 0 章')
  })

  it('已确认章数跨过本卷末端时按卷末截断，不产生越界读数', () => {
    // from 在卷一，却传了 999 章已覆盖 ⇒ 卷内已写只能到 30
    const note = summarizeUnitBudget(PLAN, TOTAL, 999, 16, zh)
    expect(note).toContain('已写 30 章')
    expect(note).toContain('Z = +50.0%（不足）')
  })

  it('同时列出各卷的「章/单元」，用于发现荒谬配比（不写卷名，避免长行占屏）', () => {
    const note = summarizeUnitBudget(PLAN, TOTAL, 15, 16, zh)
    expect(note).toContain('各卷（章/单元）：1: 30/2 · 2: 30/1')
    // 卷名只在首行的「所在卷」出现一次；各卷清单里不再重复
    expect((note ?? '').match(/一句我马上到/g)).toHaveLength(1)
  })

  it('结构不可解析时闭嘴（老项目的单层或空结构）', () => {
    expect(summarizeUnitBudget(null, TOTAL, 15, 16, zh)).toBeNull()
    expect(summarizeUnitBudget('', TOTAL, 15, 16, zh)).toBeNull()
    expect(summarizeUnitBudget('# 随便一段没有卷单元的文字', TOTAL, 15, 16, zh)).toBeNull()
  })

  it('章号越界或总章数非法时闭嘴', () => {
    expect(summarizeUnitBudget(PLAN, TOTAL, 15, 61, zh)).toBeNull()
    expect(summarizeUnitBudget(PLAN, 0, 15, 16, zh)).toBeNull()
  })
})
