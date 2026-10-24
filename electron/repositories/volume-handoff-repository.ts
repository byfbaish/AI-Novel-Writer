import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import type { VolumeHandoffDefinition, VolumeHandoffInput } from '../../src/shared/volume-handoff'

/**
 * P1-2 期 1 · 卷末交接单仓储（M18）。
 *
 * ## 五条纪律
 *
 * 1. **表不存在就降级**：M18 之前的库 `list` 返回 `[]`、`findPreviousHandoff` 返回 `null`，
 *    **不抛错**（与资源、物品、制度、知情、能力同一条纪律）；
 * 2. `findPreviousHandoff` **只返回一条**：`last_chapter < ? ORDER BY last_chapter DESC LIMIT 1`。
 *    返回数组交给调用方筛，等于把「只注入上一卷」这条铁律交给运气；
 * 3. `upsert` 前做两道校验：卷号被**其他行**占用 ⇒ `VOLUME_HANDOFF_VOLUME_TAKEN`；
 *    区间与**其他行**重叠 ⇒ `VOLUME_HANDOFF_RANGE_CONFLICT`。
 *    区间重叠 = 同一章落在两条记录里 = 静默注入错卷，所以它是硬错误，不是提示；
 * 4. 读用 `COALESCE(...,'')`；写时文本列空 ⇒ `null`，JSON 列永远写 `'[]'` 或数组字符串
 *    （列是 `NOT NULL DEFAULT '[]'`，写 NULL 会约束失败）；
 * 5. JSON 解析失败、或解析出非字符串数组 ⇒ 当 `[]` 处理，**不抛**。
 *
 * ## 为什么不是「编年史」
 *
 * 一条记录 = 一卷的交接单。逐章摘要的家是 `summary_snapshots`；这里再登一份就是第二套账。
 * 所以本仓储没有「按章查」的入口 —— 正文链要的只有「上一卷是哪一份」。
 */

const SELECT_HANDOFF = `handoff_id AS handoffId, volume_index AS volumeIndex,
  first_chapter AS firstChapter, last_chapter AS lastChapter,
  COALESCE(world_state,'') AS worldState, COALESCE(hero_state,'') AS heroState,
  events_json AS eventsJson, items_json AS itemsJson, debts_json AS debtsJson,
  COALESCE(open_thread,'') AS openThread, source,
  COALESCE(created_at,'') AS createdAt, COALESCE(updated_at,'') AS updatedAt`

interface HandoffRow {
  handoffId: string
  volumeIndex: number
  firstChapter: number
  lastChapter: number
  worldState: string
  heroState: string
  eventsJson: string
  itemsJson: string
  debtsJson: string
  openThread: string
  source: string
  createdAt: string
  updatedAt: string
}

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M18 之前的库没有这张表 —— 全链路据此降级，不抛错。 */
export function hasVolumeHandoffSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'volume_handoffs')
}

/** JSON 列 → 字符串数组；解析失败、非数组、非字符串元素一律丢弃（不抛）。 */
function parseList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch { return [] }
}

function toDefinition(row: HandoffRow): VolumeHandoffDefinition {
  return {
    handoffId: row.handoffId,
    volumeIndex: row.volumeIndex,
    firstChapter: row.firstChapter,
    lastChapter: row.lastChapter,
    worldState: row.worldState,
    heroState: row.heroState,
    events: parseList(row.eventsJson),
    items: parseList(row.itemsJson),
    debts: parseList(row.debtsJson),
    openThread: row.openThread,
    source: row.source,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function requireChapter(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(`VOLUME_HANDOFF_INVALID:${label}`)
  return value as number
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function listText(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
}

function nowIso(): string {
  return new Date().toISOString()
}

/** 面板按卷号升序读；同一卷号不可能有两条（表上 UNIQUE）。 */
export function listVolumeHandoffs(db: BetterSqlite3.Database): VolumeHandoffDefinition[] {
  if (!hasVolumeHandoffSchema(db)) return []
  const rows = db.prepare(`SELECT ${SELECT_HANDOFF} FROM volume_handoffs ORDER BY volume_index`)
    .all() as HandoffRow[]
  return rows.map(toDefinition)
}

/**
 * 本章的「上一卷交接单」：`last_chapter < 本章` 里章号最大的那一条，**只返回一条**。
 *
 * 第 1 章必然返回 `null`（没有任何区间结束在它之前）。缺表同样返回 `null`。
 */
export function findPreviousHandoff(
  db: BetterSqlite3.Database,
  beforeChapter: number,
): VolumeHandoffDefinition | null {
  if (!hasVolumeHandoffSchema(db)) return null
  if (!Number.isSafeInteger(beforeChapter) || beforeChapter < 1) return null
  const row = db.prepare(`SELECT ${SELECT_HANDOFF} FROM volume_handoffs
    WHERE last_chapter < ? ORDER BY last_chapter DESC LIMIT 1`).get(beforeChapter) as HandoffRow | undefined
  return row ? toDefinition(row) : null
}

/**
 * 新建或改写一份交接单；返回落库后的真实行（含时间戳）。
 *
 * 两道校验都只看**其他行**：`others` 排除了本次写入的 `handoffId`，
 * 否则「只改一句话」的保存会被自己的旧区间判成冲突。
 */
export function upsertVolumeHandoff(
  db: BetterSqlite3.Database,
  input: VolumeHandoffInput,
): VolumeHandoffDefinition {
  if (!hasVolumeHandoffSchema(db)) throw new Error('VOLUME_HANDOFF_SCHEMA_MISSING')
  const volumeIndex = requireChapter(input?.volumeIndex, 'volumeIndex')
  const firstChapter = requireChapter(input?.firstChapter, 'firstChapter')
  const lastChapter = requireChapter(input?.lastChapter, 'lastChapter')
  if (lastChapter < firstChapter) throw new Error('VOLUME_HANDOFF_INVALID:range')

  const handoffId = typeof input?.handoffId === 'string' && input.handoffId.trim()
    ? input.handoffId.trim()
    : `handoff:${randomUUID()}`

  const others = (db.prepare('SELECT handoff_id AS handoffId, volume_index AS volumeIndex, first_chapter AS firstChapter, last_chapter AS lastChapter FROM volume_handoffs')
    .all() as Array<Pick<HandoffRow, 'handoffId' | 'volumeIndex' | 'firstChapter' | 'lastChapter'>>)
    .filter(row => row.handoffId !== handoffId)
  if (others.some(row => row.volumeIndex === volumeIndex)) throw new Error('VOLUME_HANDOFF_VOLUME_TAKEN')
  // 区间重叠 = 同一章落进两条记录 = 静默注入错卷；相邻（20 / 21）不算重叠。
  const conflict = others.find(row => firstChapter <= row.lastChapter && row.firstChapter <= lastChapter)
  if (conflict) throw new Error('VOLUME_HANDOFF_RANGE_CONFLICT')

  const worldState = optionalText(input?.worldState)
  const heroState = optionalText(input?.heroState)
  const openThread = optionalText(input?.openThread)
  const events = listText(input?.events)
  const items = listText(input?.items)
  const debts = listText(input?.debts)
  const source = optionalText(input?.source) || 'author'
  const timestamp = nowIso()

  db.prepare(`INSERT INTO volume_handoffs
    (handoff_id,volume_index,first_chapter,last_chapter,world_state,hero_state,
     events_json,items_json,debts_json,open_thread,source,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(handoff_id) DO UPDATE SET
      volume_index=excluded.volume_index, first_chapter=excluded.first_chapter,
      last_chapter=excluded.last_chapter, world_state=excluded.world_state,
      hero_state=excluded.hero_state, events_json=excluded.events_json,
      items_json=excluded.items_json, debts_json=excluded.debts_json,
      open_thread=excluded.open_thread, source=excluded.source,
      updated_at=excluded.updated_at`).run(
    handoffId, volumeIndex, firstChapter, lastChapter,
    worldState || null, heroState || null,
    JSON.stringify(events), JSON.stringify(items), JSON.stringify(debts),
    openThread || null, source, timestamp, timestamp,
  )

  const saved = db.prepare(`SELECT ${SELECT_HANDOFF} FROM volume_handoffs WHERE handoff_id=?`)
    .get(handoffId) as HandoffRow | undefined
  if (!saved) throw new Error('VOLUME_HANDOFF_NOT_PERSISTED')
  return toDefinition(saved)
}

/** 删除是真删：一条交接单不是历史账本（与能力、物品同一口径）。 */
export function deleteVolumeHandoff(db: BetterSqlite3.Database, handoffId: string): boolean {
  if (!hasVolumeHandoffSchema(db)) return false
  if (typeof handoffId !== 'string' || !handoffId.trim()) return false
  return db.prepare('DELETE FROM volume_handoffs WHERE handoff_id=?').run(handoffId.trim()).changes > 0
}
