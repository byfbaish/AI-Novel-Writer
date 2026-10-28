import { describe, expect, it } from 'vitest'
import { getPlotStructureGuide, resolveStageStructureGuide } from '../architecture-workflow'
import { STORY_BEATS } from '../../../shared/story-beats'

/**
 * 全书这一层的引导（2026-10-28 改）。
 *
 * 旧实现的形状是「严格按以下结构组织大纲 + 第一幕第 1–30 章」。150 章的书由此拿到
 * 「第二幕：对抗与发展（第 31–112 章）」——**82 章共用一句职责**，中段没有任何分段依据，
 * 只能靠同构循环填。读者读到的就是"拖沓 + 全都一个套路"。
 *
 * 新口径只有两条，都在这组测试里钉死：
 * 1. 装不下整本书的拍子，只定两端（起点 / 终点状态），中间交给卷 / 单元；
 * 2. 一律不再输出「第 X 章～第 Y 章、占 XX%」这种按百分比切的段落。
 */
describe('全书拍子引导', () => {
  it('150 章用三幕：写「只定两端」，且不出现百分比分段', () => {
    const guide = getPlotStructureGuide('three_act', 150, 'zh-CN')
    expect(guide).toContain('全书拍子：三幕')
    expect(guide).toContain('两端')
    expect(guide).toContain('不要在这里按百分比切章')
    // 旧文本的三个标志性串一个都不许回来
    expect(guide).not.toContain('严格按以下结构组织大纲')
    expect(guide).not.toContain('第二幕：对抗与发展')
    expect(guide).not.toMatch(/占[总]?篇幅约?\s*\d+%/u)
  })

  it('装得下时保留这套拍子自己的拍序（三幕的五个拍点）', () => {
    const guide = getPlotStructureGuide('three_act', 20, 'zh-CN')
    expect(guide).toContain('拐点一')
    expect(guide).toContain('拐点二')
    expect(guide).toContain('不要按百分比切章')
  })

  it('每一套拍子都能出引导，且都带上可选表与四条使用规则', () => {
    for (const beat of STORY_BEATS) {
      const guide = getPlotStructureGuide(beat.key, 150, 'zh-CN')
      expect(guide, beat.key).toContain('每一层只准一套')
      expect(guide, beat.key).toContain('相邻两个单元不许同拍')
      // 可选表的表头在，说明整张库表都注进去了
      expect(guide, beat.key).toContain('原生跨度')
    }
  })

  it('认不出的写法回退到三幕，不抛错', () => {
    expect(getPlotStructureGuide('三幕式', 150, 'zh-CN')).toContain('全书拍子：三幕')
    expect(getPlotStructureGuide('', 150, 'zh-CN')).toContain('全书拍子：')
  })

  it('英文版同样不给百分比分段', () => {
    const guide = getPlotStructureGuide('three_act', 150, 'en-US')
    expect(guide).toContain('[Whole-book beat: Three-act]')
    expect(guide).not.toContain('Act II — confrontation and development')
  })

  it('自由弧文本非空时仍然优先于枚举引导', () => {
    const custom = '# 阶段结构\n\n## 第一幕：建置'
    expect(resolveStageStructureGuide(custom, 'three_act', 150, 'zh-CN')).toBe(custom)
    expect(resolveStageStructureGuide('', 'three_act', 150, 'zh-CN')).toContain('全书拍子：三幕')
  })
})
