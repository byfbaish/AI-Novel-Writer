import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import type { VolumeHandoffDefinition, VolumeHandoffInput } from '../../src/shared/volume-handoff'
import { volumeEffectiveRanges, type VolumeRange } from '../../src/shared/volume-structure'
import { listVolumes } from './volume-structure-repository'

/**
 * P1-2 期 1b · 卷末交接单仓储（M19 之后：区间外置到 `volumes`）。
 *
 * ## 五条纪律
 *
 * 1. **两张表都在才可用**：读路径要 join `volumes` 拿区间。只探 `volume_handoffs` 会怎样？
 *    `prepare()` 抛 `no such table: volumes`，而正文链那侧 `catch { return null }` 会把它
 *    吞成「没有上一卷」—— **跨卷记忆静默消失，没有任何测试会红**。这是本文件最容易漏的一处。
 * 2. `findPreviousHandoff` **只返回一条**：有效末章（`actual_last ?? planned_last`）小于本章里
 *    最大的那一条。返回数组交给调用方筛，等于把「只注入上一卷」这条铁律交给运气；
 * 3. `upsert` 前校验：卷不存在 ⇒ `VOLUME_HANDOFF_VOLUME_NOT_FOUND`；同一卷已有别的行 ⇒
 *    `VOLUME_HANDOFF_VOLUME_TAKEN`。**区间冲突校验已删除** —— 区间不再由作者输入，
 *    它由 `volumeEffectiveRanges()` 构造为连续不重叠，作者无法制造重叠；
 * 4. 读用 `COALESCE(...,'')`；写时文本列空 ⇒ `null`，JSON 列永远写 `'[]'` 或数组字符串
 *    （列是 `NOT NULL DEFAULT '[]'`，写 NULL 会约束失败）；
 * 5. JSON 解析失败、或解析出非字符串数组 ⇒ 当 `[]` 处理，**不抛**。
 *
 * ## 区间不在 SQL 里算
 *
 * `volumeIndex` / `firstChapter` / `lastChapter` / `boundaryBasis` 全部由
 * `volumeEffectiveRanges()` 填。SQL 里再写一遍 `COALESCE` / `LAG` 就等于有了第二份起点规则，
 * 与 `arc-position.ts:419-422` 明令禁止的「复写折算」是同一种错误。
 *
 * ## 交接单指向已删的卷
 *
 * 外键 `RESTRICT` 让正常路径删不掉；但如果真出现（外部写入绕过外键），`list` **保留该行**
 * 且区间字段为 `null`，让面板显示并删除它。`findPreviousHandoff` 跳过它（`lastChapter` 为 null）。
 * 静默消失比显示一条坏数据更糟 —— 作者会以为交接单没了。
 */

const VOLUMES_TABLE = 'volumes'
const HANDOFFS_TABLE = 'volume_handoffs'

const SELECT_HANDOFF = `handoff_id AS handoffId, volume_id AS volumeId,
  COALESCE(world_state,'') AS worldState, COALESCE(hero_state,'') AS heroState,
  events_json AS eventsJson, items_json AS itemsJson, debts_json AS debtsJson,
  COALESCE(open_thread,'') AS openThread, source,
  COALESCE(created_at,'') AS createdAt, COALESCE(updated_at,'') AS updatedAt`

interface HandoffRow {
  handoffId: string
  volumeId: string
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

/** `volumes` 缺失同样算「没有 schema」—— 没有它就算不出区间，读下去只会抛 `no such table`。 */
export function hasVolumeHandoffSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, VOLUMES_TABLE) && hasTable(db, HANDOFFS_TABLE)
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

function toDefinition(row: HandoffRow, range: VolumeRange | undefined): VolumeHandoffDefinition {
  return {
    handoffId: row.handoffId,
    volumeId: row.volumeId,
    // 卷记录不见了：区间全 null，面板据此标「这一卷已不在卷结构里」。
    volumeIndex: range?.volumeIndex ?? null,
    firstChapter: range?.first ?? null,
    lastChapter: range?.last ?? null,
    boundaryBasis: range?.basis ?? null,
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

/** 面板按卷号升序读；区间由 `volumeEffectiveRanges()` 统一填。 */
export function listVolumeHandoffs(db: BetterSqlite3.Database): VolumeHandoffDefinition[] {
  if (!hasVolumeHandoffSchema(db)) return []
  const rows = db.prepare(`SELECT ${SELECT_HANDOFF} FROM ${HANDOFFS_TABLE}`).all() as HandoffRow[]
  const ranges = new Map(volumeEffectiveRanges(listVolumes(db)).map(range => [range.volumeId, range]))
  return rows
    .map(row => toDefinition(row, ranges.get(row.volumeId)))
    // 卷已删的行排最后：它们需要作者处理，但不该插在正常行中间。
    .sort((left, right) => (left.volumeIndex ?? Number.MAX_SAFE_INTEGER)
      - (right.volumeIndex ?? Number.MAX_SAFE_INTEGER))
}

/**
 * 本章的「上一卷交接单」：**有效末章**在本章之前的那一条里末章最大的，**只返回一条**。
 *
 * 第 1 章必然返回 `null`（没有任何区间结束在它之前）。缺表同样返回 `null`。
 * 末章等于本章**不算**上一卷（严格小于）—— 本章还属于那一卷。
 */
export function findPreviousHandoff(
  db: BetterSqlite3.Database,
  beforeChapter: number,
): VolumeHandoffDefinition | null {
  if (!hasVolumeHandoffSchema(db)) return null
  if (!Number.isSafeInteger(beforeChapter) || beforeChapter < 1) return null
  const candidates = listVolumeHandoffs(db)
    .filter(entry => entry.lastChapter !== null && entry.lastChapter < beforeChapter)
    .sort((left, right) => (right.lastChapter! - left.lastChapter!)
      || ((right.volumeIndex ?? 0) - (left.volumeIndex ?? 0)))
  return candidates[0] ?? null
}

/**
 * 新建或改写一份交接单；返回落库后的真实行（含派生区间与时间戳）。
 *
 * 校验只看「其他行」：否则「只改一句话」的保存会被自己占着的卷判成冲突。
 */
export function upsertVolumeHandoff(
  db: BetterSqlite3.Database,
  input: VolumeHandoffInput,
): VolumeHandoffDefinition {
  if (!hasVolumeHandoffSchema(db)) throw new Error('VOLUME_HANDOFF_SCHEMA_MISSING')
  const volumeId = typeof input?.volumeId === 'string' ? input.volumeId.trim() : ''
  if (!volumeId) throw new Error('VOLUME_HANDOFF_INVALID:volumeId')
  const exists = db.prepare(`SELECT 1 FROM ${VOLUMES_TABLE} WHERE volume_id=?`).get(volumeId)
  if (!exists) throw new Error('VOLUME_HANDOFF_VOLUME_NOT_FOUND')

  const handoffId = typeof input?.handoffId === 'string' && input.handoffId.trim()
    ? input.handoffId.trim()
    : `handoff:${randomUUID()}`

  const taken = db.prepare(`SELECT handoff_id AS handoffId FROM ${HANDOFFS_TABLE}
    WHERE volume_id=? AND handoff_id<>?`).get(volumeId, handoffId) as { handoffId: string } | undefined
  if (taken) throw new Error('VOLUME_HANDOFF_VOLUME_TAKEN')

  const worldState = optionalText(input?.worldState)
  const heroState = optionalText(input?.heroState)
  const openThread = optionalText(input?.openThread)
  const events = listText(input?.events)
  const items = listText(input?.items)
  const debts = listText(input?.debts)
  const source = optionalText(input?.source) || 'author'
  const timestamp = nowIso()

  db.prepare(`INSERT INTO volume_handoffs
    (handoff_id,volume_id,world_state,hero_state,events_json,items_json,debts_json,
     open_thread,source,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(handoff_id) DO UPDATE SET
      volume_id=excluded.volume_id, world_state=excluded.world_state,
      hero_state=excluded.hero_state, events_json=excluded.events_json,
      items_json=excluded.items_json, debts_json=excluded.debts_json,
      open_thread=excluded.open_thread, source=excluded.source,
      updated_at=excluded.updated_at`).run(
    handoffId, volumeId,
    worldState || null, heroState || null,
    JSON.stringify(events), JSON.stringify(items), JSON.stringify(debts),
    openThread || null, source, timestamp, timestamp,
  )

  const saved = listVolumeHandoffs(db).find(entry => entry.handoffId === handoffId)
  if (!saved) throw new Error('VOLUME_HANDOFF_NOT_PERSISTED')
  return saved
}

/** 删除是真删：一条交接单不是历史账本（与能力、物品同一口径）。 */
export function deleteVolumeHandoff(db: BetterSqlite3.Database, handoffId: string): boolean {
  if (!hasVolumeHandoffSchema(db)) return false
  if (typeof handoffId !== 'string' || !handoffId.trim()) return false
  return db.prepare(`DELETE FROM ${HANDOFFS_TABLE} WHERE handoff_id=?`).run(handoffId.trim()).changes > 0
}
