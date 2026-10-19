import { describe, expect, it } from 'vitest'
import {
  OUTLINE_OVERSHOOT_FACTOR,
  OUTLINE_OVERSHOOT_RUN,
  OUTLINE_TOTAL_OVERSHOOT_FACTOR,
  auditOutlineLength,
  outlineLengthOf,
  renderOutlineLengthReport,
  type OutlineChapterLength,
} from '../outline-budget'

// 设计稿 volume-quota-context-budget-design.md §8（探针）
// 真实项目实测：目标 300 字/章，实际 591 字/章（含结构行），正文 469。
const chapter = (n: number, chars: number): OutlineChapterLength => ({ chapter: n, chars })
const overshoot = (findings: ReturnType<typeof auditOutlineLength>) =>
  findings.filter(f => f.code === 'OUTLINE_OVERSHOOT')
const totalOvershoot = (findings: ReturnType<typeof auditOutlineLength>) =>
  findings.filter(f => f.code === 'OUTLINE_TOTAL_OVERSHOOT')

describe('outlineLengthOf：去空白计字', () => {
  it('空白不计入', () => {
    expect(outlineLengthOf('  他 走 进 门 \n\n 坐 下 ')).toBe(6)
  })
  it('空串为 0', () => {
    expect(outlineLengthOf('')).toBe(0)
    expect(outlineLengthOf('   \n\t ')).toBe(0)
  })
})

describe('auditOutlineLength：单章超写（OUTLINE_OVERSHOOT）', () => {
  it('连续 3 章超 1.5 倍才报', () => {
    const findings = auditOutlineLength([chapter(1, 300), chapter(2, 500), chapter(3, 500), chapter(4, 500)], 300)
    const hits = overshoot(findings)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.where).toBe('第 2–4 章')
  })

  it('只连续 2 章不报（避免单章波动误报）', () => {
    const findings = auditOutlineLength([chapter(1, 500), chapter(2, 500), chapter(3, 300), chapter(4, 300)], 300)
    expect(overshoot(findings)).toEqual([])
  })

  it('正好 1.5 倍不算超（边界归中）', () => {
    const findings = auditOutlineLength([chapter(1, 450), chapter(2, 450), chapter(3, 450), chapter(4, 450)], 300)
    expect(overshoot(findings)).toEqual([])
  })

  it('只报最长的一段，不刷多条', () => {
    const findings = auditOutlineLength([
      chapter(1, 500), chapter(2, 500), chapter(3, 500), // 3 章
      chapter(4, 100),
      chapter(5, 500), chapter(6, 500), chapter(7, 500), chapter(8, 500), // 4 章（更长）
    ], 300)
    const hits = overshoot(findings)
    expect(hits).toHaveLength(1)
    expect(hits[0]!.where).toBe('第 5–8 章')
  })
})

describe('auditOutlineLength：总量超写（OUTLINE_TOTAL_OVERSHOOT）', () => {
  it('总量超 1.3 倍报，且带倍数', () => {
    const chapters = Array.from({ length: 10 }, (_, i) => chapter(i + 1, 591))
    const total = totalOvershoot(auditOutlineLength(chapters, 300))
    expect(total).toHaveLength(1)
    expect(total[0]!.where).toBe('全书 10 章')
    // 5910 / 3000 = 1.97
    expect(total[0]!.zh).toContain('1.97 倍')
  })

  it('贴着目标写不报', () => {
    const chapters = Array.from({ length: 10 }, (_, i) => chapter(i + 1, 300))
    expect(auditOutlineLength(chapters, 300)).toEqual([])
  })

  it('两条可以同时出现', () => {
    const chapters = Array.from({ length: 10 }, (_, i) => chapter(i + 1, 600))
    const codes = auditOutlineLength(chapters, 300).map(f => f.code)
    expect(codes).toContain('OUTLINE_OVERSHOOT')
    expect(codes).toContain('OUTLINE_TOTAL_OVERSHOOT')
  })
})

describe('auditOutlineLength：fail-open', () => {
  it('目标非法时闭嘴', () => {
    expect(auditOutlineLength([chapter(1, 999)], 0)).toEqual([])
    expect(auditOutlineLength([chapter(1, 999)], -1)).toEqual([])
    expect(auditOutlineLength([chapter(1, 999)], Number.NaN)).toEqual([])
    expect(auditOutlineLength([chapter(1, 999)], 300.5)).toEqual([])
  })

  it('没有章节时闭嘴', () => {
    expect(auditOutlineLength([], 300)).toEqual([])
  })

  it('非法条目被过滤，不影响其余判定', () => {
    const findings = auditOutlineLength([
      { chapter: Number.NaN, chars: 999 },
      { chapter: 0, chars: 999 },
      { chapter: 1, chars: Number.NaN },
      chapter(2, 500), chapter(3, 500), chapter(4, 500),
    ], 300)
    expect(overshoot(findings)).toHaveLength(1)
    expect(overshoot(findings)[0]!.where).toBe('第 2–4 章')
  })
})

describe('renderOutlineLengthReport：渲染', () => {
  it('空结果返回 null（调用方不打印）', () => {
    expect(renderOutlineLengthReport([], 'zh-CN')).toBeNull()
  })

  it('中英文各自成段，含「只提示」口径', () => {
    const findings = auditOutlineLength(Array.from({ length: 5 }, (_, i) => chapter(i + 1, 600)), 300)
    const zh = renderOutlineLengthReport(findings, 'zh-CN')!
    const en = renderOutlineLengthReport(findings, 'en-US')!
    expect(zh).toContain('只提示')
    expect(en).toContain('advisory only')
    expect(zh).not.toContain('advisory only')
  })
})

describe('阈值常量：与设计稿一致', () => {
  it('三章 / 1.5 倍 / 1.3 倍', () => {
    expect(OUTLINE_OVERSHOOT_RUN).toBe(3)
    expect(OUTLINE_OVERSHOOT_FACTOR).toBe(1.5)
    expect(OUTLINE_TOTAL_OVERSHOOT_FACTOR).toBe(1.3)
  })
})
