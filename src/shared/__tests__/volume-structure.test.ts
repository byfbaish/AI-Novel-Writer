import { describe, expect, it } from 'vitest'
import {
  materializeVolumeStructure,
  volumeEffectiveRanges,
  volumeRangeEndingAt,
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

/** 两卷各三单元 —— D15 用，单元数 ≥3 才可能出现「u1 吃进 u2」。 */
const PLAN_THREE_UNITS = `# 卷 / 单元结构

## 卷一：七日的塌方
### 单元一：重生
### 单元二：残简
### 单元三：状纸
## 卷二：配给的算盘
### 单元一：账簿漏洞
### 单元二：草木人情
### 单元三：灵石月结
## 卷三：执法殿
### 单元一：制度的围猎
### 单元二：赵家的人
`

/**
 * 复现作者库第 2 卷的重叠形态：卷 2 是第 7–10 章，单元 1 的标题跨到了第 9 章
 * （排在单元 2 的第 8 章之前被观测到）⇒ 观测区间 7–9 与单元 2 的 8–8 相交。
 * 这不是构造出来的假数据：写成 7、9、8 这个顺序，就是作者按章回填标题时
 * 单元归属写岔一次会留下的痕迹。
 */
const SYNOPSIS_UNIT_OVERLAP = `# 情节大纲

## 第1卷第1单元第1章（全书第1章）：起
## 第1卷第1单元第2章（全书第2章）：承
## 第2卷第1单元第1章（全书第7章）：甲
## 第2卷第1单元第3章（全书第9章）：丙
## 第2卷第2单元第2章（全书第8章）：乙
## 第3卷第1单元第1章（全书第11章）：新卷
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

  // ── D15：卷内单元区间互斥 ────────────────────────────────────────────────
  // 作者库第 2 卷的真实形态是 7–9 / 8–9 / 10–10（单元 1 与单元 2 在 8、9 章重叠）。
  // 成因：`buildUnits` 的 headings 分支直接用观测区间、even 分支按整卷均分，两者互不扣减。
  // 下面这条 synopsis 复现同一形态 —— 单元 1 的标题跨到了单元 2 之后（第 9 章排在
  // 第 8 章之前被观测到），观测区间就吃进了邻居的章。

  it('单元观测区间互相吃进 ⇒ 报 VOLUME_UNIT_OVERLAP + VOLUME_UNIT_AMBIGUOUS，且不抛错', () => {
    const projection = materializeVolumeStructure({
      plan: PLAN_THREE_UNITS, synopsis: SYNOPSIS_UNIT_OVERLAP, totalChapters: 30,
    })
    const overlap = projection!.warnings.filter(warning => warning.startsWith('VOLUME_UNIT_OVERLAP:'))
    const ambiguous = projection!.warnings.filter(warning => warning.startsWith('VOLUME_UNIT_AMBIGUOUS:'))
    expect(overlap).toContain('VOLUME_UNIT_OVERLAP:2:1-2:8')
    expect(ambiguous).toContain('VOLUME_UNIT_AMBIGUOUS:2:1-2:8')
  })

  it('单元区间互斥时不产出 VOLUME_UNIT_* 告警（不制造假阳性）', () => {
    // 旧格式大纲没有归属标题，单元全走 declared 均分 ⇒ 首尾相接、必然不重叠。
    const projection = materializeVolumeStructure({
      plan: PLAN_DECLARED, synopsis: OLD_SYNOPSIS, totalChapters: 150,
    })
    expect(projection!.warnings.filter(warning => warning.startsWith('VOLUME_UNIT_'))).toEqual([])
  })

  it('★ 第二条成因：单元 1 的观测吃满整卷 ⇒ 后面 even 兜底的单元必然与它重叠', () => {
    // SYNOPSIS_PARTIAL 只写了「第 1 卷第 1 单元」的第 1、2、8 章 —— 观测按 min/max
    // 聚合成 1–8，正好是整卷。而卷 1 有 2 个单元，单元 2 走 even ⇒ 5–8。
    // 这不是数据脏，是**口径**问题：观测区间表达的是「这一单元已写到哪儿」，
    // 折叠成一段连续区间就被读成「这一单元覆盖到哪儿」。告警照实报出，不夹紧。
    const projection = materializeVolumeStructure({
      plan: PLAN_NO_COUNTS, synopsis: SYNOPSIS_TWO_VOLUMES, totalChapters: 150,
    })
    expect(projection!.warnings).toContain('VOLUME_UNIT_OVERLAP:1:1-2:5-8')
  })

  it('单元区间只报不改：重叠时区间逐字保留观测值，不用估算夹紧', () => {
    // 「夹紧等于拿估算改事实」—— 与卷级的 VOLUME_OBSERVED_OUT_OF_RANGE 同一条纪律。
    const projection = materializeVolumeStructure({
      plan: PLAN_THREE_UNITS, synopsis: SYNOPSIS_UNIT_OVERLAP, totalChapters: 30,
    })
    const units = projection!.volumes[1]!.units
    expect([units[0]!.plannedFirst, units[0]!.plannedLast]).toEqual([7, 9])
    expect([units[1]!.plannedFirst, units[1]!.plannedLast]).toEqual([8, 8])
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

  it('进度不改边界：actual_last 只落在 actualLast 上，last 仍是计划末章（D19）', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeIndex: 1, plannedLast: 20, actualLast: 25, actualSource: 'finalized' }),
    ])
    expect(ranges[0]!.last).toBe(20)
    expect(ranges[0]!.actualLast).toBe(25)
    // basis 描述的是**边界**的来源，进度不参与 ⇒ 仍是计划来源。
    expect(ranges[0]!.basis).toBe('headings')
  })

  it('进度不推下一卷起点：第 2 卷起点仍是计划末章 + 1（D19 实机形态 7–10 / 已写 9）', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 6, actualLast: 6, actualSource: 'finalized' }),
      volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 7, plannedLast: 10, actualLast: 9, actualSource: 'finalized' }),
      volume({ volumeId: 'volume:3', volumeIndex: 3, plannedFirst: 11, plannedLast: 15 }),
    ])
    expect(ranges.map(range => [range.first, range.last])).toEqual([[1, 6], [7, 10], [11, 15]])
    expect(ranges[1]!.actualLast).toBe(9)
  })

  it('计划末章缺失时才用 actual_last 兜底，此时 basis 报 actual', () => {
    const ranges = volumeEffectiveRanges([
      volume({ volumeIndex: 1, plannedFirst: 1, plannedLast: null, actualLast: 12, actualSource: 'author' }),
    ])
    expect(ranges[0]!.last).toBe(12)
    expect(ranges[0]!.basis).toBe('actual')
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

describe('volumeRangeEndingAt（P1-2 期 2 的「卷末章」判定）', () => {
  const twoVolumes = () => [
    volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 20 }),
    volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 21, plannedLast: 40 }),
  ]

  it('命中有效末章所在的那一卷', () => {
    expect(volumeRangeEndingAt(twoVolumes(), 20)?.volumeId).toBe('volume:1')
    expect(volumeRangeEndingAt(twoVolumes(), 40)?.volumeId).toBe('volume:2')
  })

  it('按计划末章判，不认进度（D19 回归：第 9 章不是第 2 卷末章，第 10 章才是）', () => {
    const volumes = [
      volume({ volumeId: 'volume:1', volumeIndex: 1, plannedFirst: 1, plannedLast: 6, actualLast: 6, actualSource: 'finalized' }),
      volume({ volumeId: 'volume:2', volumeIndex: 2, plannedFirst: 7, plannedLast: 10, actualLast: 9, actualSource: 'finalized' }),
    ]
    // 修前：actual_last=9 ⇒ 第 2 卷有效末章变 9 ⇒ 第 9 章判卷末、第 10 章被算成第 3 卷首章。
    expect(volumeRangeEndingAt(volumes, 9)).toBeNull()
    expect(volumeRangeEndingAt(volumes, 10)?.volumeId).toBe('volume:2')
    expect(volumeRangeEndingAt(volumes, 10)?.first).toBe(7)
  })

  it('非末章、空结构、非法章号一律 null（调用方据此「本次不触发」）', () => {
    expect(volumeRangeEndingAt(twoVolumes(), 19)).toBeNull()
    expect(volumeRangeEndingAt([], 1)).toBeNull()
    for (const chapterNumber of [0, -1, 3.5, Number.NaN]) {
      expect(volumeRangeEndingAt(twoVolumes(), chapterNumber)).toBeNull()
    }
  })

  it('起止未定的卷（计划与实际都为空）不会被误判成「末章 = null」的命中', () => {
    const volumes = [volume({ plannedFirst: null, plannedLast: null, plannedSource: 'even' })]
    expect(volumeRangeEndingAt(volumes, 1)).toBeNull()
  })
})
