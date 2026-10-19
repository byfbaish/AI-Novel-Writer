/**
 * 卷 / 单元 树的**只读视图模型**（E4j-3，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §7A.1b。
 *
 * ## 为什么是另一个模块而不是改 `parseArcStructure`
 *
 * `parseArcStructure` 的职责是「把文本解析成结构」，弧位块 / 结构位对账 / 预算都吃它；
 * 树视图需要的额外信息只有一个：**这个节点在原文的哪一行**（点击跳转用）。
 * 所以这里复用它的解析结果 + 独立扫一遍行号，**不往核心解析器里塞视图字段**。
 *
 * ## 硬规则：树只读
 *
 * 树一旦可编辑就出现「文本一份、树一份」，而 markdown 的自由格式（多行小弧、各种别名）
 * 不可能无损往返。所以本模块只**读**，不产生任何可写回的结构。
 */

import { parseArcStructure, isTwoLevelArcStructure } from './arc-position'

export interface ArcTreeUnit {
  /** 单元序号，1 起 */
  index: number
  name: string
  /** 单元标题所在的行号（0 起），用于点击跳转；解析不到为 null */
  line: number | null;
  /** 交手类型（`（交手：堵门；档：关心→标价）` 的第一段）；没有标注为 null */
  hand: string | null;
  /** 档位变化，如 `关心→标价`；没有标注为 null */
  tier: string | null;
}

export interface ArcTreeVolume {
  /** 卷序号，1 起 */
  index: number
  name: string
  /** 卷标题所在的行号（0 起）；解析不到为 null */
  line: number | null
  units: readonly ArcTreeUnit[]
}

export interface ArcTree {
  volumes: readonly ArcTreeVolume[]
  /** 两级结构（卷 / 单元）为 true；旧三代结构（大弧/中弧/小弧）为 false */
  twoLevel: boolean
}

/** 从「逼法」字段里抠出交手类型与档位（与 `auditTwoLevelDensity` 用同一份正则语义）。 */
const PRESSURE_TAG = /（\s*交手[：:]\s*([^；;）]+?)\s*[；;]\s*档[：:]\s*([^→）]+?)\s*(?:→|->)\s*([^）]+?)\s*）/u

interface PositionedLine { line: number; kind: 'volume' | 'unit'; name: string }

/** 扫一遍原文，把每个卷/单元标题的行号与名字按出现顺序记下来。 */
function scanArcHeadings(plan: string): PositionedLine[] {
  const out: PositionedLine[] = []
  const lines = plan.split(/\r?\n/u)
  for (let line = 0; line < lines.length; line += 1) {
    const raw = lines[line]!.trim()
    const volume = /^#{2,3}[\t ]*(?:大弧|卷)[^：:]*[：:][\t ]*(.+?)[\t ]*$/u.exec(raw)
    if (volume) { out.push({ line, kind: 'volume', name: volume[1]!.replace(/^【|】$/gu, '').trim() }); continue }
    const unit = /^#{3,4}[\t ]*(?:中弧|单元)[\t ]*[0-9一二三四五六七八九十百]*[\t ]*[：:][\t ]*(.+?)[\t ]*$/u.exec(raw)
    if (unit) out.push({ line, kind: 'unit', name: unit[1]!.replace(/^【|】$/gu, '').trim() })
  }
  return out
}

/**
 * 构造只读树。结构不可解析时返回 `null`（调用方据此不渲染树，而不是渲染半棵树）。
 */
export function buildArcTree(plan: string | null | undefined): ArcTree | null {
  if (!plan?.trim()) return null
  const parsed = parseArcStructure(plan)
  if (!parsed || parsed.majors.length === 0) return null
  const headings = scanArcHeadings(plan)
  // 标题扫描与解析结果必须能对上：对不上就说明文本形态超出预期，宁可不出树。
  const volumeLines = headings.filter(item => item.kind === 'volume')
  if (volumeLines.length !== parsed.majors.length) return null

  let cursor = 0
  const volumes: ArcTreeVolume[] = parsed.majors.map((major, majorOffset) => {
    const volumeLine = volumeLines[majorOffset]!.line
    // 本卷的单元标题：从本卷标题之后开始，到下一个卷标题之前
    const nextVolumeLine = volumeLines[majorOffset + 1]?.line ?? Number.POSITIVE_INFINITY
    const unitLines = headings.filter(item => item.kind === 'unit' && item.line > volumeLine && item.line < nextVolumeLine)
    const units: ArcTreeUnit[] = major.mids.map((mid, midOffset) => {
      const line = unitLines[midOffset]?.line ?? null
      const value = mid.fields.find(([field]) => /^(逼法|pressure method)$/iu.test(field))?.[1] ?? ''
      const tag = PRESSURE_TAG.exec(value)
      return Object.freeze({
        index: midOffset + 1,
        name: mid.name,
        line,
        hand: tag ? tag[1]!.trim() : null,
        tier: tag ? `${tag[2]!.trim()}→${tag[3]!.trim()}` : null,
      })
    })
    cursor += units.length
    return Object.freeze({ index: majorOffset + 1, name: major.name, line: volumeLine, units: Object.freeze(units) })
  })
  void cursor
  return Object.freeze({ volumes: Object.freeze(volumes), twoLevel: isTwoLevelArcStructure(parsed) })
}

/** 树的统计口径（折叠时显示「12 单元」用）。 */
export function arcTreeUnitCount(tree: ArcTree | null): number {
  if (!tree) return 0
  return tree.volumes.reduce((sum, volume) => sum + volume.units.length, 0)
}
