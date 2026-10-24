import { createHash } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import {
  materializeVolumeStructure,
  type VolumeDefinition,
  type VolumeUnitDefinition,
} from '../../src/shared/volume-structure'
import { ProjectCoreRepository } from './project-core-repository'

/** 卷 / 单元结构仓储（P1-2 期 1b）。
 *
 * ## 两条不变量，都靠「只写该写的那几列」保证
 *
 * 1. **`rebuildVolumes` 只 upsert 计划列**（`name` / `planned_*` / `planned_source` /
 *    `outline_hash` / `source` / `updated_at`），`actual_last` 与 `actual_source` 一列都不碰。
 *    把 `planned_last` 顺手抄进 `actual_last` 是最容易犯的错 —— 那个值是折算出来的估算，
 *    一抄就变成「事实」，以后再也分不清哪些卷是真的写完了。
 * 2. **`markVolumeDone` 只写 `actual_*`**，绝不改计划列。值来自 `drafts.status='finalized'`
 *    的最大章号，是**查询出来的事实**，不是推算。
 *
 * ## 为什么 `volume_id` 用 `volume:<index>` 而不是 UUID
 *
 * 重建是常态（作者每改一次大纲都可能重建）。UUID 会让每次重建都换主键，挂在 `volume_handoffs`
 * 上的外键立刻断掉。用卷序号当稳定键，重建只是改内容。
 *
 * ## 「大纲里没有但被交接单引用」的卷
 *
 * **保留**（`source='retained'`），不删。删了会让交接单指向一个不存在的卷 —— 虽然外键
 * `RESTRICT` 会挡住删除动作，但重建是先删后插，顺序一变就出事。保留 + 面板标注「大纲已无此卷」
 * 比「悄悄删掉跨卷记忆」安全得多。
 */

const VOLUMES_TABLE = 'volumes'
const UNITS_TABLE = 'volume_units'
const HANDOFFS_TABLE = 'volume_handoffs'

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** 三张表都在才算有结构。**不收窄成只探 `volumes`**：读路径要 join 单元与交接单。 */
export function hasVolumeStructureSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, VOLUMES_TABLE) && hasTable(db, UNITS_TABLE) && hasTable(db, HANDOFFS_TABLE)
}

function nowIso(): string {
  return new Date().toISOString()
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

type VolumeRow = {
  volumeId: string; volumeIndex: number; name: string | null
  plannedFirst: number | null; plannedLast: number | null; plannedSource: string
  actualLast: number | null; actualSource: string | null; outlineHash: string
  source: string; createdAt: string | null; updatedAt: string | null
}

type UnitRow = {
  unitId: string; volumeId: string; unitIndex: number; name: string | null
  plannedFirst: number | null; plannedLast: number | null; plannedSource: string
  createdAt: string | null; updatedAt: string | null
}

const SELECT_VOLUME = `volume_id AS volumeId, volume_index AS volumeIndex, name,
  planned_first AS plannedFirst, planned_last AS plannedLast, planned_source AS plannedSource,
  actual_last AS actualLast, actual_source AS actualSource, outline_hash AS outlineHash,
  source, created_at AS createdAt, updated_at AS updatedAt`

const SELECT_UNIT = `unit_id AS unitId, volume_id AS volumeId, unit_index AS unitIndex, name,
  planned_first AS plannedFirst, planned_last AS plannedLast, planned_source AS plannedSource,
  created_at AS createdAt, updated_at AS updatedAt`

function toVolume(row: VolumeRow): VolumeDefinition {
  return {
    volumeId: row.volumeId,
    volumeIndex: row.volumeIndex,
    name: row.name ?? '',
    plannedFirst: row.plannedFirst,
    plannedLast: row.plannedLast,
    plannedSource: row.plannedSource as VolumeDefinition['plannedSource'],
    actualLast: row.actualLast,
    actualSource: (row.actualSource ?? null) as VolumeDefinition['actualSource'],
    outlineHash: row.outlineHash,
    source: row.source,
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
  }
}

function toUnit(row: UnitRow): VolumeUnitDefinition {
  return {
    unitId: row.unitId,
    volumeId: row.volumeId,
    unitIndex: row.unitIndex,
    name: row.name ?? '',
    plannedFirst: row.plannedFirst,
    plannedLast: row.plannedLast,
    plannedSource: row.plannedSource as VolumeUnitDefinition['plannedSource'],
    createdAt: row.createdAt ?? '',
    updatedAt: row.updatedAt ?? '',
  }
}

/** 缺表降级成空数组，不抛 —— 老项目还没升到 v20 时面板要能打开。 */
export function listVolumes(db: BetterSqlite3.Database): VolumeDefinition[] {
  if (!hasVolumeStructureSchema(db)) return []
  const rows = db.prepare(`SELECT ${SELECT_VOLUME} FROM ${VOLUMES_TABLE} ORDER BY volume_index`).all() as VolumeRow[]
  return rows.map(toVolume)
}

export function listVolumeUnits(db: BetterSqlite3.Database, volumeId?: string): VolumeUnitDefinition[] {
  if (!hasVolumeStructureSchema(db)) return []
  const rows = volumeId
    ? db.prepare(`SELECT ${SELECT_UNIT} FROM ${UNITS_TABLE} WHERE volume_id=? ORDER BY unit_index`).all(volumeId) as UnitRow[]
    : db.prepare(`SELECT ${SELECT_UNIT} FROM ${UNITS_TABLE} ORDER BY volume_id, unit_index`).all() as UnitRow[]
  return rows.map(toUnit)
}

export interface RebuildResult {
  volumes: VolumeDefinition[]
  warnings: string[]
  removed: number
  retained: number[]
}

/** 面板要的四态：`empty` 需要自动建；`stale` 只提示；`unparsed` 禁用新增；`ready` 正常。 */
export type VolumeStructureState = 'ready' | 'stale' | 'empty' | 'unparsed'

/** 读卷结构 + 判断新鲜度。**只读**：不建表、不重建。 */
export function readVolumeStructure(db: BetterSqlite3.Database): {
  volumes: VolumeDefinition[]
  state: VolumeStructureState
  warnings: string[]
} {
  if (!hasVolumeStructureSchema(db)) return { volumes: [], state: 'unparsed', warnings: [] }
  const volumes = listVolumes(db)
  const core = ProjectCoreRepository.get(db)
  const projection = core
    ? materializeVolumeStructure({
      plan: core.plotStructurePlan, synopsis: core.synopsis, totalChapters: core.totalChapters,
    })
    : null
  // 大纲解析不出来：库里已有行就标过期（别删），没有就标「建不起来」。
  if (!projection) return { volumes, state: volumes.length === 0 ? 'unparsed' : 'stale', warnings: [] }
  if (volumes.length === 0) return { volumes, state: 'empty', warnings: projection.warnings }
  const outlineHash = sha256(projection.signature)
  // `retained` 行不参与过期判定：它们本来就不在大纲里。
  const stale = volumes.some(volume => volume.source === 'outline' && volume.outlineHash !== outlineHash)
  return { volumes, state: stale ? 'stale' : 'ready', warnings: projection.warnings }
}

/** 从大纲重建**计划列**。
 *
 * 顺序是「先算后写」：`materializeVolumeStructure` 返回 `null` 时**立刻抛**，
 * 一行都不动。解析失败时清空表是最糟的失败形态（作者会以为卷结构丢了）。
 */
export function rebuildVolumes(db: BetterSqlite3.Database, input: {
  plan: string | null
  synopsis: string | null
  totalChapters: number
}): RebuildResult {
  if (!hasVolumeStructureSchema(db)) throw new Error('VOLUME_STRUCTURE_SCHEMA_MISSING')
  const projection = materializeVolumeStructure(input)
  if (!projection) throw new Error('VOLUME_STRUCTURE_UNPARSED')

  const outlineHash = sha256(projection.signature)
  const warnings = [...projection.warnings]
  const existing = listVolumes(db)
  const referenced = new Set(
    (db.prepare(`SELECT volume_id AS volumeId FROM ${HANDOFFS_TABLE}`).all() as Array<{ volumeId: string }>)
      .map(row => row.volumeId),
  )
  const existingById = new Map(existing.map(volume => [volume.volumeId, volume]))
  const projectedIndexes = new Set(projection.volumes.map(volume => volume.index))
  const retained: number[] = []
  let removed = 0

  const upsertVolume = db.prepare(`INSERT INTO volumes(
      volume_id, volume_index, name, planned_first, planned_last, planned_source,
      outline_hash, source, created_at, updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(volume_id) DO UPDATE SET
      volume_index=excluded.volume_index,
      name=excluded.name,
      planned_first=excluded.planned_first,
      planned_last=excluded.planned_last,
      planned_source=excluded.planned_source,
      outline_hash=excluded.outline_hash,
      source=excluded.source,
      updated_at=excluded.updated_at`)
  const deleteUnit = db.prepare(`DELETE FROM ${UNITS_TABLE} WHERE volume_id=?`)
  const insertUnit = db.prepare(`INSERT INTO volume_units(
      unit_id, volume_id, unit_index, name, planned_first, planned_last, planned_source,
      created_at, updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)`)

  db.transaction(() => {
    const timestamp = nowIso()
    for (const node of projection.volumes) {
      const volumeId = `volume:${node.index}`
      const previous = existingById.get(volumeId)
      // 改名且有交接单：只提示，不阻断 —— 可能是正常改名，也可能是作者重排了卷。
      if (previous && referenced.has(volumeId) && previous.name && previous.name !== node.name) {
        warnings.push(`VOLUME_NAME_CHANGED:${node.index}`)
      }
      upsertVolume.run(volumeId, node.index, node.name || null,
        node.plannedFirst, node.plannedLast, node.plannedSource,
        outlineHash, 'outline', previous?.createdAt || timestamp, timestamp)
      deleteUnit.run(volumeId)
      for (const unit of node.units) {
        insertUnit.run(`unit:${node.index}:${unit.index}`, volumeId, unit.index, unit.name || null,
          unit.plannedFirst, unit.plannedLast, unit.plannedSource, timestamp, timestamp)
      }
    }

    // 大纲里已经没有的卷：被交接单引用就保留，否则删除（单元级联）。
    for (const volume of existing) {
      if (projectedIndexes.has(volume.volumeIndex)) continue
      if (referenced.has(volume.volumeId)) {
        if (volume.source !== 'retained') {
          db.prepare(`UPDATE volumes SET source='retained', updated_at=? WHERE volume_id=?`)
            .run(nowIso(), volume.volumeId)
        }
        retained.push(volume.volumeIndex)
        continue
      }
      db.prepare(`DELETE FROM ${VOLUMES_TABLE} WHERE volume_id=?`).run(volume.volumeId)
      removed += 1
    }
  })()

  return { volumes: listVolumes(db), warnings, removed, retained }
}

/** 标记「本卷已完成」：写入 `actual_last`，值 = 该卷区间内**已定稿章的最大章号**。
 *
 * 上界取「下一卷的计划起点」：超写跨过下一卷起点时，那些章按计划归下一卷。没有逐章记账时
 * 这是唯一确定的口径 —— **不要为了把超写章算进来去改 `planned_*`**（那是伪造计划边界）。
 */
export function markVolumeDone(db: BetterSqlite3.Database, volumeId: string): {
  volume: VolumeDefinition
  actualLast: number
} {
  if (!hasVolumeStructureSchema(db)) throw new Error('VOLUME_STRUCTURE_SCHEMA_MISSING')
  const row = db.prepare(`SELECT ${SELECT_VOLUME} FROM ${VOLUMES_TABLE} WHERE volume_id=?`)
    .get(volumeId) as VolumeRow | undefined
  if (!row) throw new Error('VOLUME_MARK_DONE_NOT_FOUND')
  const volume = toVolume(row)
  if (volume.plannedFirst === null) throw new Error('VOLUME_MARK_DONE_NO_PLANNED_START')

  const next = db.prepare(`SELECT planned_first AS plannedFirst FROM ${VOLUMES_TABLE}
    WHERE volume_index > ? ORDER BY volume_index LIMIT 1`).get(volume.volumeIndex) as
    { plannedFirst: number | null } | undefined
  const upper = next?.plannedFirst ?? null

  const max = db.prepare(`SELECT MAX(chapter_number) AS chapterNumber FROM drafts
    WHERE status = 'finalized' AND chapter_number >= ?
      AND (? IS NULL OR chapter_number < ?)`).get(volume.plannedFirst, upper, upper) as
    { chapterNumber: number | null }
  if (max.chapterNumber === null) throw new Error('VOLUME_MARK_DONE_NO_FINALIZED')

  db.prepare(`UPDATE volumes SET actual_last=?, actual_source='finalized', updated_at=?
    WHERE volume_id=?`).run(max.chapterNumber, nowIso(), volumeId)

  const saved = listVolumes(db).find(item => item.volumeId === volumeId)
  if (!saved) throw new Error('VOLUME_MARK_DONE_NOT_PERSISTED')
  return { volume: saved, actualLast: max.chapterNumber }
}
