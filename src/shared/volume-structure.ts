import { arcWeight, parseArcStructure, scaledBoundaries } from './arc-position'
import { parseOutlineChapterHeading } from './chapter-heading'

/** 卷 / 单元的物化与有效区间（P1-2 期 1b）。
 *
 * ## 这个文件解决什么
 *
 * 在此之前，「第 57 章属第几卷第几单元」每次都要把 Markdown 大纲重新解析、再按权重等比
 * 折算。本文件把它变成一次物化 + 一次区间计算，结果落进 `volumes` / `volume_units`。
 *
 * ## 三档来源，按精度从高到低（判据：能读到事实就别用估算）
 *
 * 1. **`headings`**：`synopsis` 里写了 `第V卷第U单元第Z章（全书第N章）`，章号是作者/模型
 *    写下的**精确归属**。第 V 卷末章 = 第 V+1 卷首个归属章的章号 − 1。
 * 2. **`declared`**：`plot_structure_plan` 里每一卷都自报「（约 N 章）」，用
 *    `scaledBoundaries` 折算。自报总和等于全书章数时它就是精确的。
 * 3. **`even`**：以上都没有，按卷数均分。**这是估算**，界面必须标出来。
 *
 * ## 两条铁律
 *
 * - **部分归属不能钉卷末**。只有第 1 卷有归属标题、第 2 卷没有时，第 1 卷末章**不能**取
 *   该卷标题的最大章号 —— 那只是「已经写到哪儿」，不是「这一卷到哪儿为止」。标题能钉的
 *   只有「下一卷从第几章开始」这一个边界。
 * - **`declared` 只在每一卷都自报章数时启用**。半份章数会把折算比例带偏，比均分还差。
 *
 * ## 为什么不复写折算
 *
 * `arc-position.ts:419-422` 明令「不要在别处复写这套折算」：弧光自报章数与全书章数不等时
 * （实测 880 vs 845），两份实现必然漂移，于是「结构位归属哪一章」会出现两个矛盾答案。
 * 所以本文件只调 `arcWeight` / `scaledBoundaries`。
 *
 * ## 这一期刻意没有 `resolveVolumeOfChapter`
 *
 * 本期没有消费方（正文链走 `findPreviousHandoff`，面板只要区间）。按「谁消费」的纪律，
 * 没有消费方的函数不写 —— W6 的死法就是「只存不读」。
 */

export type VolumePlannedSource = 'headings' | 'declared' | 'even'
export type VolumeActualSource = 'finalized' | 'author'
/** 一条区间的权威来源：`actual` 是事实，`headings` 是精确观测，`declared`/`even` 是估算。 */
export type VolumeBoundaryBasis = 'actual' | VolumePlannedSource

export interface VolumeDefinition {
  volumeId: string
  volumeIndex: number
  name: string
  plannedFirst: number | null
  plannedLast: number | null
  plannedSource: VolumePlannedSource
  /** 唯一事实：该卷已定稿章的最大章号。只由「标记本卷已完成」写入。 */
  actualLast: number | null
  actualSource: VolumeActualSource | null
  outlineHash: string
  /** `'outline'` = 从大纲物化；`'retained'` = 大纲里已无此卷，但被交接单引用而保留。 */
  source: string
  createdAt: string
  updatedAt: string
}

export interface VolumeUnitDefinition {
  unitId: string
  volumeId: string
  unitIndex: number
  name: string
  plannedFirst: number | null
  plannedLast: number | null
  plannedSource: VolumePlannedSource
  createdAt: string
  updatedAt: string
}

export interface VolumePlannedUnit {
  index: number
  name: string
  plannedFirst: number | null
  plannedLast: number | null
  plannedSource: VolumePlannedSource
}

export interface VolumePlannedNode {
  index: number
  name: string
  plannedFirst: number | null
  plannedLast: number | null
  plannedSource: VolumePlannedSource
  units: VolumePlannedUnit[]
}

export interface VolumePlanProjection {
  volumes: VolumePlannedNode[]
  /** 规范化 JSON；主进程再 sha256 成 `outline_hash`。不含原文、不含 `totalChapters` 原值。 */
  signature: string
  /** 机器可读告警，如 `VOLUME_OBSERVED_OUT_OF_RANGE:1`。 */
  warnings: string[]
}

export interface VolumeRange {
  volumeId: string
  volumeIndex: number
  name: string
  first: number | null
  last: number | null
  basis: VolumeBoundaryBasis
  actualLast: number | null
}

interface ObservedRange { first: number; last: number }

/** 扫 `synopsis` 的章标题，按卷 / 单元收集**章号观测**。只收带归属的（`attributed`）。 */
function observeHeadings(synopsis: string | null | undefined): {
  volumes: Map<number, ObservedRange>
  units: Map<string, ObservedRange>
} {
  const volumes = new Map<number, ObservedRange>()
  const units = new Map<string, ObservedRange>()
  if (!synopsis) return { volumes, units }

  const grow = (map: Map<unknown, ObservedRange>, key: unknown, chapter: number) => {
    const previous = map.get(key)
    map.set(key, previous
      ? { first: Math.min(previous.first, chapter), last: Math.max(previous.last, chapter) }
      : { first: chapter, last: chapter })
  }

  for (const line of synopsis.replace(/\r\n?/gu, '\n').split('\n')) {
    const fields = parseOutlineChapterHeading(line)
    if (!fields || !fields.attributed || fields.volumeIndex === null) continue
    grow(volumes, fields.volumeIndex, fields.chapter)
    if (fields.unitIndex !== null) grow(units, `${fields.volumeIndex}:${fields.unitIndex}`, fields.chapter)
  }
  return { volumes, units }
}

function declaredEverywhere(chapters: readonly (number | undefined)[]): boolean {
  return chapters.length > 0
    && chapters.every(value => Number.isSafeInteger(value) && (value ?? 0) > 0)
}

/**
 * 从大纲物化「卷 / 单元」骨架。
 *
 * 返回 `null` 表示**大纲里没有可识别的卷结构**（空、或只有标题没有单元）—— 调用方据此
 * 不建表、界面报「无法建立」。**绝不在解析失败时返回空骨架**：那会让「没有卷」与
 * 「有七卷但都没解析出来」变成同一个状态。
 */
export function materializeVolumeStructure(input: {
  plan: string | null | undefined
  synopsis: string | null | undefined
  totalChapters: number
}): VolumePlanProjection | null {
  const parsed = parseArcStructure(input.plan)
  if (!parsed || parsed.majors.length === 0) return null

  const total = Number.isSafeInteger(input.totalChapters) && input.totalChapters > 0
    ? input.totalChapters
    : 0
  const observed = observeHeadings(input.synopsis)

  const volumeCounts = parsed.majors.map(major => arcWeight(major.chapters))
  // `declared` 只在**每一卷**都自报章数时启用：半份章数会把折算比例带偏。
  const declaredBounds = total > 0 && declaredEverywhere(parsed.majors.map(major => major.chapters))
    ? scaledBoundaries(volumeCounts, total)
    : null

  const warnings: string[] = []
  const volumes: VolumePlannedNode[] = []
  let start: number | null = 1

  for (let offset = 0; offset < parsed.majors.length; offset += 1) {
    const major = parsed.majors[offset]!
    const volumeIndex = offset + 1
    let last: number | null = null
    let source: VolumePlannedSource = 'even'

    if (start !== null) {
      // ① headings：被**下一卷**的首个归属章钉住（只有这一条边界是精确的）。
      const nextObserved = observed.volumes.get(volumeIndex + 1)
      if (nextObserved && nextObserved.first > start && (total === 0 || nextObserved.first - 1 <= total)) {
        last = nextObserved.first - 1
        source = 'headings'
      } else if (declaredBounds) {
        const candidate = declaredBounds[offset + 1]!
        if (candidate >= start && (total === 0 || candidate <= total)) {
          last = candidate
          source = 'declared'
        }
      } else if (total > 0) {
        const candidate = offset === parsed.majors.length - 1
          ? total
          : Math.round((offset + 1) * total / parsed.majors.length)
        if (candidate >= start && candidate <= total) {
          last = candidate
          source = 'even'
        }
      }
    }

    // 观测与算出的区间矛盾：只记告警，不夹紧 —— 夹紧等于用估算改事实。
    const selfObserved = observed.volumes.get(volumeIndex)
    if (selfObserved && start !== null && last !== null
      && (selfObserved.first < start || selfObserved.last > last)) {
      warnings.push(`VOLUME_OBSERVED_OUT_OF_RANGE:${volumeIndex}`)
    }

    volumes.push({
      index: volumeIndex,
      name: major.name,
      plannedFirst: start,
      plannedLast: last,
      plannedSource: source,
      units: buildUnits(major, volumeIndex, start, last, observed),
    })
    start = last === null ? null : last + 1
  }

  return { volumes, warnings, signature: projectionSignature(volumes) }
}

function buildUnits(
  major: { mids: ReadonlyArray<{ name: string; chapters?: number }> },
  volumeIndex: number,
  volumeFirst: number | null,
  volumeLast: number | null,
  observed: { units: Map<string, ObservedRange> },
): VolumePlannedUnit[] {
  if (major.mids.length === 0) return []
  const span = volumeFirst !== null && volumeLast !== null ? volumeLast - volumeFirst + 1 : 0
  const bounds = span > 0 && volumeFirst !== null
    ? scaledBoundaries(major.mids.map(mid => arcWeight(mid.chapters)), span)
    : null
  const unitSource: VolumePlannedSource = declaredEverywhere(major.mids.map(mid => mid.chapters))
    ? 'declared'
    : 'even'

  return major.mids.map((mid, offset) => {
    const unitIndex = offset + 1
    // 单元自己的归属标题比折算准 —— 但它只覆盖「已经写出来的部分」，所以只当区间用，不当边界推导。
    const hit = observed.units.get(`${volumeIndex}:${unitIndex}`)
    if (hit) {
      return { index: unitIndex, name: mid.name, plannedFirst: hit.first, plannedLast: hit.last, plannedSource: 'headings' }
    }
    if (bounds && volumeFirst !== null) {
      return {
        index: unitIndex,
        name: mid.name,
        plannedFirst: volumeFirst + bounds[offset]!,
        plannedLast: volumeFirst + bounds[offset + 1]! - 1,
        plannedSource: unitSource,
      }
    }
    return { index: unitIndex, name: mid.name, plannedFirst: null, plannedLast: null, plannedSource: 'even' }
  })
}

/** 物化投影的规范化签名。
 *
 * **刻意不含**：`totalChapters` 原值（150→160 但边界没动时不该标 stale）、`synopsis` 正文
 * （每写一章追加一条标题不该让整张表过期）。只含边界与来源 —— 只有真正改变边界的编辑才变。
 */
function projectionSignature(volumes: readonly VolumePlannedNode[]): string {
  return JSON.stringify({
    v: 1,
    volumes: volumes.map(volume => [
      volume.index, volume.name, volume.plannedFirst, volume.plannedLast, volume.plannedSource,
      volume.units.map(unit => [unit.index, unit.name, unit.plannedFirst, unit.plannedLast, unit.plannedSource]),
    ]),
  })
}

/**
 * 卷的**有效区间**（唯一实现）。
 *
 * - 起点 = 上一卷有效末章 + 1（第一卷用计划起点）。这样相邻卷天然不重叠，不需要另做校验。
 * - 末章 = `actual_last ?? planned_last`：**实际优先**，因为它是事实；没有实际才用物化的计划值。
 * - `basis` 四态必须分开：`actual` / `headings` / `declared` / `even`。**不许把 `even` 报成 `headings`**
 *   —— 调用方（面板、渲染）要靠它决定说「实际」「全书」「计划」还是「估算」。
 */
export function volumeEffectiveRanges(volumes: readonly VolumeDefinition[]): VolumeRange[] {
  const sorted = [...volumes].sort((left, right) => left.volumeIndex - right.volumeIndex)
  const ranges: VolumeRange[] = []
  let previousLast: number | null = null

  for (const volume of sorted) {
    const first = previousLast !== null ? previousLast + 1 : volume.plannedFirst
    const last = volume.actualLast ?? volume.plannedLast
    ranges.push({
      volumeId: volume.volumeId,
      volumeIndex: volume.volumeIndex,
      name: volume.name,
      first,
      last,
      basis: volume.actualLast !== null ? 'actual' : volume.plannedSource,
      actualLast: volume.actualLast,
    })
    previousLast = last
  }
  return ranges
}

/**
 * 有效末章正好是 `chapterNumber` 的那一卷（P1-2 期 2 的「卷末章」判定）。
 *
 * 判定完全走 `volumeEffectiveRanges()`：末章 = `actual_last ?? planned_last`，
 * 起点由上一卷推出。**不在这里重算区间** —— 一旦有两份区间算法，面板显示的卷末章
 * 与触发条件就会不一致，而这类不一致不会报错，只会表现为「某一卷的交接单永远不生成」。
 *
 * 三个 `null` 分支都由调用方自己决定怎么解释（通常是「本次不触发」）：
 * 章号非法 / 卷结构为空 / 该卷起止未定（`planned_*` 与 `actual_*` 都是 NULL）。
 */
export function volumeRangeEndingAt(
  volumes: readonly VolumeDefinition[],
  chapterNumber: number,
): VolumeRange | null {
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return null
  return volumeEffectiveRanges(volumes).find(range => range.last === chapterNumber) ?? null
}
