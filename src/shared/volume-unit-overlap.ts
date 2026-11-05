/**
 * 卷单元区间互斥校验（D15）。
 *
 * 卷内单元必须把章号区间切分成互不重叠的连续段；区间重叠会让同一章归属多个单元
 * （实测第 2 卷 7–9 / 8–9 / 10–10，第 8、9 章归属不唯一，落库前完全没有校验）。
 *
 * ## 接线（2026-11-05）
 *
 * 由 `volume-structure.ts` 的 `unitOverlapWarnings()` 在**每卷建完时**调用，
 * 结果并入 `VolumePlanProjection.warnings`，走既有告警通道：
 * 预览（`db:volumes-list`）与重建（`db:volumes-rebuild`）都会带出来，
 * 面板按 `VOLUME_UNIT_*` 前缀单独成句（见 `VolumeHandoffRegistryPanel`）。
 * **只报，不夹紧、不阻断** —— 理由写在 `unitOverlapWarnings` 的注释里。
 *
 * ## 判定口径
 *
 * - `inverted-range`：`from > to`，区间倒置。倒置单元**不参与后续重叠 / 覆盖计算**。
 * - `overlap`：两个单元的 `[from, to]` 区间有交集 ⇒ 报交集章号（含端点）。
 * - `ambiguous-chapter`：某章被 ≥2 个单元覆盖 ⇒ 单独报出（D15 的直接症状，与 overlap 分开列）。
 *   覆盖单元集合相同的章合并为同一条 finding。
 *
 * 输出顺序固定为 `inverted-range` → `overlap` → `ambiguous-chapter`；同一 `kind`
 * 内按 `chapters[0]` 升序（次级按 chapters 字典序、units 字典序，保证输出稳定）。
 */
export type UnitRange = { label: string; from: number; to: number }
export type OverlapFinding = {
  kind: 'overlap' | 'ambiguous-chapter' | 'inverted-range'
  chapters: number[]
  units: string[]
}

const KIND_ORDER: OverlapFinding['kind'][] = ['inverted-range', 'overlap', 'ambiguous-chapter']

function intersection(a: UnitRange, b: UnitRange): [number, number] | null {
  const lo = Math.max(a.from, b.from)
  const hi = Math.min(a.to, b.to)
  return lo <= hi ? [lo, hi] : null
}

function chapterList(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let c = lo; c <= hi; c++) out.push(c)
  return out
}

/** 稳定排序：先按 kind 固定顺序，再按 chapters[0] 升序，次级 chapters / units 字典序。 */
function sortFindings(findings: OverlapFinding[]): OverlapFinding[] {
  return [...findings].sort((a, b) => {
    const kindDiff = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    if (kindDiff !== 0) return kindDiff
    const len = Math.min(a.chapters.length, b.chapters.length)
    for (let i = 0; i < len; i++) {
      if (a.chapters[i] !== b.chapters[i]) return a.chapters[i] - b.chapters[i]
    }
    if (a.chapters.length !== b.chapters.length) return a.chapters.length - b.chapters.length
    return a.units.join('|').localeCompare(b.units.join('|'))
  })
}

export function findUnitOverlaps(units: UnitRange[]): OverlapFinding[] {
  // 1) 倒置区间单独报，且不参与后续计算。
  const inverted: OverlapFinding[] = []
  const valid: UnitRange[] = []
  for (const u of units) {
    if (u.from > u.to) {
      inverted.push({ kind: 'inverted-range', chapters: [u.from, u.to], units: [u.label] })
    } else {
      valid.push(u)
    }
  }

  // 2) 两两求交 ⇒ overlap。
  const overlap: OverlapFinding[] = []
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const hit = intersection(valid[i], valid[j])
      if (hit) {
        overlap.push({
          kind: 'overlap',
          chapters: chapterList(hit[0], hit[1]),
          units: [valid[i].label, valid[j].label],
        })
      }
    }
  }

  // 3) 逐章统计覆盖单元 ⇒ ambiguous-chapter，按覆盖单元集合分组。
  const cover = new Map<number, number[]>()
  valid.forEach((u, idx) => {
    for (let c = u.from; c <= u.to; c++) {
      const list = cover.get(c) ?? []
      list.push(idx)
      cover.set(c, list)
    }
  })
  const groups = new Map<string, { chapters: number[]; idxs: number[] }>()
  for (const chapter of [...cover.keys()].sort((a, b) => a - b)) {
    const idxs = cover.get(chapter)!
    if (idxs.length < 2) continue
    const key = idxs.join(',')
    const group = groups.get(key) ?? { chapters: [], idxs }
    group.chapters.push(chapter)
    groups.set(key, group)
  }
  const ambiguous: OverlapFinding[] = [...groups.values()].map((g) => ({
    kind: 'ambiguous-chapter',
    chapters: g.chapters,
    units: g.idxs.map((i) => valid[i].label),
  }))

  return [...sortFindings(inverted), ...sortFindings(overlap), ...sortFindings(ambiguous)]
}
