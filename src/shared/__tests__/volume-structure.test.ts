import { describe, expect, it } from 'vitest'
import {
  materializeVolumeStructure,
  volumeEffectiveRanges,
  type VolumeDefinition,
} from '../volume-structure'

/** 三本真实项目的形态，各占一档来源。 */
const PLAN_NO_COUNTS = `# 卷 / 单元结构

## 卷一：杂役处的百日毒
### 单元一：十枚灵石买不到一副棺材
### 单元二：跪着把药捡起来
## 卷二：百草园的阵法
### 单元一：阵法与人
### 单元二：药园管事
## 卷三：执法殿
### 单元一：制度的围猎
### 单元二：赵家的人
`

/** 旧格式：大弧 / 中弧，**带**章数。`（约 1–50 章）` 会被解析成 50 章。 */
const PLAN_DECLARED = `## 大弧一：我随口一说就成真（约 1–50 章）
### 中弧 1：被裁那天（约 25 章）
### 中弧 2：我给命运写个剧本（约 25 章）
## 大弧二：我先说的（约 51–100 章）
### 中弧 1：第一笔账（约 25 章）
### 中弧 2：第二笔账（约 25 章）
## 大弧三：所以我是真的（约 101–150 章）
### 中弧 1：代价（约 25 章）
### 中弧 2：收束（约 25 章）
`

/** 新格式：只写到第 1 卷第 1 单元的 1–8 章。 */
const SYNOPSIS_PARTIAL = `# 情节大纲

## 第1卷第1单元第1章（全书第1章）：杂役铺里挨了一脚
正文……

## 第1卷第1单元第2章（全书第2章）：十枚灵石到手
正文……

## 第1卷第1单元第8章（全书第8章）：最后一条
正文……
`

/** 新格式：第 1 卷 1–8、第 2 卷 9–15（两卷都有归属，能钉住第 1 卷末章）。 */
const SYNOPSIS_TWO_VOLUMES = `${SYNOPSIS_PARTIAL}
## 第2卷第1单元第1章（全书第9章）：进百草园
正文……

## 第2卷第1单元第7章（全书第15章）：出园
正文……
`

const OLD_SYNOPSIS = `# 情节大纲

## 第1章：被裁第三天
## 第2章：升职第一天
`

describe('materializeVolumeStructure', () => {
  it('空 plan / 只有一级标题 ⇒ 返回 null（不返回空骨架）', () => {
    expect(materializeVolumeStructure({ plan: '', synopsis: '', totalChapters: 100 })).toBeNull()
    expect(materializeVolumeStructure({ plan: '# 卷 / 单元结构', synopsis: null, totalChapters: 100 })).toBeNull()
    expect(materializeVolumeStructure({ plan: null, synopsis: null, totalChapters: 0 })).toBeNull()
  })

  it('卷没有单元 ⇒ 返回 null（parseArcStructure 的可用性规则）', () => {
    expect(materializeVolumeStructure({
      plan: '## 卷一：只有卷没有单元\n- 叙事任务：……\n',
      synopsis: null,
      totalChapters: 100,
    })).toBeNull()
  })

  it('plan 无章数 + 只有第 1 卷的部分归属 ⇒ 均分（even），第 1 卷区间包含 1–8', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_PARTIAL, totalChapters: 150,
    })
    expect(projection).not.toBeNull()
    expect(projection!.volumes).toHaveLength(3)
    expect(projection!.volumes.map(volume => volume.plannedSource)).toEqual(['even', 'even', 'even'])
    expect(projection!.volumes.map(volume => [volume.plannedFirst, volume.plannedLast]))
      .toEqual([[1, 50], [51, 100], [101, 150]])
    const first = projection!.volumes[0]!
    expect(first.plannedFirst!).toBeLessThanOrEqual(1)
    expect(first.plannedLast!).toBeGreaterThanOrEqual(8)
  })

  it('plan 每卷都自报章数 ⇒ 折算（declared），边界按自报比例', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_DECLARED, synopsis: OLD_SYNOPSIS, totalChapters: 150,
    })
    expect(projection!.volumes.map(volume => volume.plannedSource)).toEqual(['declared', 'declared', 'declared'])
    expect(projection!.volumes.map(volume => [volume.plannedFirst, volume.plannedLast]))
      .toEqual([[1, 50], [51, 100], [101, 150]])
  })

  it('两卷都有归属标题 ⇒ 第 1 卷末章被第 2 卷首章钉住（headings）', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_TWO_VOLUMES, totalChapters: 150,
    })
    expect(projection!.volumes[0]!.plannedLast).toBe(8)
    expect(projection!.volumes[0]!.plannedSource).toBe('headings')
    // 第 2 卷没有「第 3 卷」的标题可钉，退回均分 —— 名字与来源都要如实。
    expect(projection!.volumes[1]!.plannedSource).toBe('even')
  })

  it('部分归属不能钉卷末：只有第 1 卷标题时末章不取该卷最大章号（8）', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_PARTIAL, totalChapters: 150,
    })
    // 这条是本期最关键的反例：8 只是「已写到哪儿」，不是「这一卷到哪儿为止」。
    expect(projection!.volumes[0]!.plannedLast).not.toBe(8)
    expect(projection!.volumes[0]!.plannedSource).not.toBe('headings')
  })

  it('totalChapters 未知（0）⇒ 没有 headings 边界的卷末章为 null，不伪造', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: null, totalChapters: 0,
    })
    expect(projection!.volumes[0]!.plannedFirst).toBe(1)
    expect(projection!.volumes[0]!.plannedLast).toBeNull()
  })

  it('单元数量与顺序对齐大纲，且每个单元区间落在卷区间内、首尾相接', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_DECLARED, synopsis: OLD_SYNOPSIS, totalChapters: 150,
    })
    const first = projection!.volumes[0]!
    expect(first.units).toHaveLength(2)
    expect(first.units.map(unit => unit.index)).toEqual([1, 2])
    expect(first.units[0]!.plannedFirst).toBe(1)
    expect(first.units[1]!.plannedFirst).toBe(first.units[0]!.plannedLast! + 1)
    expect(first.units[1]!.plannedLast).toBe(first.plannedLast)
  })

  it('卷数多于总章数 ⇒ 后面卷的末章为 null，不出现倒置区间', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: null, totalChapters: 2,
    })
    for (const volume of projection!.volumes) {
      if (volume.plannedFirst !== null && volume.plannedLast !== null) {
        expect(volume.plannedLast).toBeGreaterThanOrEqual(volume.plannedFirst)
      }
    }
  })

  it('观测章号落在算出的区间外 ⇒ warnings 记 VOLUME_OBSERVED_OUT_OF_RANGE，不抛错', () => {
    // 全书只有 6 章，3 卷均分 ⇒ 第 1 卷 1–2；但 synopsis 已经写到第 8 章。
    // 这是「大纲与实际不同步」的真实形态：算得出区间，但观测跨越了它。
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_PARTIAL, totalChapters: 6,
    })
    expect(projection!.warnings.some(warning => warning.startsWith('VOLUME_OBSERVED_OUT_OF_RANGE:'))).toBe(true)
  })

  it('signature 只看边界：synopsis 只改章正文（标题不变）时签名不变', () => {
    const before = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_TWO_VOLUMES, totalChapters: 150,
    })!
    const after = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS,
      synopsis: SYNOPSIS_TWO_VOLUMES.replace('正文……', '换了完全不同的一整段正文，标题一个字没动'),
      totalChapters: 150,
    })!
    expect(after.signature).toBe(before.signature)
  })

  it('signature 看边界：totalChapters 改变导致边界变化时签名才变', () => {
    const before = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: null, totalChapters: 150,
    })!
    const after = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: null, totalChapters: 160,
    })!
    expect(after.signature).not.toBe(before.signature)
  })

  it('单元有归属标题时用它（headings），没有时用折算', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_TWO_VOLUMES, totalChapters: 150,
    })
    const firstUnit = projection!.volumes[0]!.units[0]!
    expect(firstUnit.plannedSource).toBe('headings')
    expect(firstUnit.plannedFirst).toBe(1)
    expect(firstUnit.plannedLast).toBe(8)
    // 第 1 卷第 2 单元没有归属标题 ⇒ 折算，且来源不能是 headings。
    const secondUnit = projection!.volumes[0]!.units[1]!
    expect(secondUnit.plannedSource).not.toBe('headings')
  })
})

function volume(over: Partial<VolumeDefinition> = {}): VolumeDefinition {
  return {
    volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
    plannedFirst: 1, plannedLast: 20, plannedSource: 'headings',
    actualLast: null, actualSource: null,
    outlineHash: 'hash:1', source: 'outline', createdAt: '', updatedAt: '',
    ...over,
  }
}

describe('volumeEffectiveRanges', () => {
  it('第一卷起点用计划起点，后续卷起点 = 上一卷有效末章 + 1', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 20 }),
      volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 21, plannedLast: 40 }),
    ])
    expect(ranges.map(range => [range.first, range.last])).toEqual([[1, 20], [21, 40]])
  })

  it('actual 优先：实际末章覆盖计划末章，basis 变 actual', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeIndex: 1, plannedLast: 20, actualLast: 25, actualSource: 'finalized' }),
    ])
    expect(ranges[0]!.last).toBe(25)
    expect(ranges[0]!.basis).toBe('actual')
    expect(ranges[0]!.actualLast).toBe(25)
  })

  it('actual 覆盖后，下一卷起点跟着后移（区间天然不重叠）', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 20, actualLast: 25, actualSource: 'finalized' }),
      volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 21, plannedLast: 40 }),
    ])
    expect(ranges[1]!.first).toBe(26)
    expect(ranges[1]!.basis).toBe('headings')
  })

  it('没有 actual 时 basis 取 planned_source：even 不许被报成 headings', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeIndex: 1, plannedSource: 'even' }),
      volume({ volumeId: 'volume:2', volumeIndex: 2, plannedSource: 'declared' }),
    ])
    expect(ranges.map(range => range.basis)).toEqual(['even', 'declared'])
  })

  it('按 volume_index 排序，输入乱序不影响结果', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 21, plannedLast: 40 }),
      volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 20 }),
    ])
    expect(ranges.map(range => range.volumeIndex)).toEqual([1, 2])
  })
})
