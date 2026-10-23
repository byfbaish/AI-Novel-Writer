import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import {
  KEY_ITEM_LABEL_MAX,
  KEY_ITEM_TEXT_MAX,
  type KeyItemDefinition,
  type KeyItemDeleteResult,
  type KeyItemInput,
  type KeyItemWriteResult,
} from '../../src/shared/key-item'

/**
 * P1-1 关键物品仓储（M14）。
 *
 * 与资源账本仓储同一条降级纪律，但没有账本那套算术纪律（它本来就不算）：
 * - **表不存在就降级成空结果**：M14 之前的库读路径返回 `[]`，不抛错；
 * - **重名就地拒绝**：`name` 在表上是 UNIQUE，但裸 SQLite 约束错误对用户不可读，
 *   所以先查一次给出 `KEY_ITEM_NAME_DUPLICATED`；
 * - **删除是真删**：物品不是历史账本，没有「删了就丢历史」的问题。
 */

const SELECT_ITEM = `item_id AS itemId, name, COALESCE(holder_character,'') AS holderCharacter,
  holder_label AS holderLabel, COALESCE(status_note,'') AS statusNote,
  chapter_number AS chapterNumber, COALESCE(evidence,'') AS evidence, source,
  COALESCE(created_at,'') AS createdAt, COALESCE(updated_at,'') AS updatedAt`

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M14 之前的库没有这张表 —— 全链路据此降级，不抛错。 */
export function hasKeyItemSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'key_items')
}

function requireText(value: unknown, label: string, max = KEY_ITEM_TEXT_MAX): string {
  if (typeof value !== 'string') throw new Error(`KEY_ITEM_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`KEY_ITEM_INVALID:${label}`)
  return normalized
}

function optionalText(value: unknown, max = KEY_ITEM_TEXT_MAX): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized.length > max ? normalized.slice(0, max) : normalized
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 按持有者、名称排序：同一持有者的物品挨在一起，作者扫表时不用来回跳。
 *
 * 中文本身的先后是 SQLite 的 BINARY（码点）序，不是拼音序 —— 这里只承诺「分组」，
 * 不承诺「甲乙丙」的读法顺序；要拼音序得另加排序键，那是显示层的事。
 */
export function listKeyItems(db: BetterSqlite3.Database): KeyItemDefinition[] {
  if (!hasKeyItemSchema(db)) return []
  return db.prepare(`SELECT ${SELECT_ITEM} FROM key_items
    ORDER BY COALESCE(holder_character,''), holder_label, name`).all() as KeyItemDefinition[]
}

/** 读取单件（供注入侧按需取，避免整表进内存 —— 目前条数很少，但仍保持口径一致）。 */
export function getKeyItem(db: BetterSqlite3.Database, itemId: string): KeyItemDefinition | undefined {
  if (!hasKeyItemSchema(db)) return undefined
  return db.prepare(`SELECT ${SELECT_ITEM} FROM key_items WHERE item_id=?`).get(itemId) as KeyItemDefinition | undefined
}

export function upsertKeyItem(db: BetterSqlite3.Database, input: KeyItemInput): KeyItemWriteResult {
  if (!hasKeyItemSchema(db)) return { success: false, error: 'KEY_ITEM_SCHEMA_MISSING' }
  try {
    const name = requireText(input?.name, 'name')
    const holderLabel = requireText(input?.holderLabel, 'holderLabel', KEY_ITEM_LABEL_MAX)
    const holderCharacter = optionalText(input?.holderCharacter, KEY_ITEM_LABEL_MAX)
    const statusNote = optionalText(input?.statusNote)
    const evidence = optionalText(input?.evidence)
    // 章号只允许正整数或空：0 与 null 语义不同（0 会被读成「序章」），所以 0 直接拒。
    const rawChapter = input?.chapterNumber
    if (rawChapter !== undefined && rawChapter !== null
      && (!Number.isSafeInteger(rawChapter) || (rawChapter as number) <= 0)) {
      return { success: false, error: 'KEY_ITEM_INVALID:chapterNumber' }
    }
    const chapterNumber = rawChapter === undefined || rawChapter === null ? null : rawChapter as number

    const itemId = typeof input?.itemId === 'string' && input.itemId.trim() ? input.itemId.trim() : `item:${randomUUID()}`
    // 重名必须就地拒绝，而不是让 UNIQUE 约束抛出裸 SQLite 错误。
    const owner = db.prepare('SELECT item_id AS itemId FROM key_items WHERE name=?').get(name) as
      { itemId: string } | undefined
    if (owner && owner.itemId !== itemId) return { success: false, error: 'KEY_ITEM_NAME_DUPLICATED' }

    const timestamp = nowIso()
    db.prepare(`INSERT INTO key_items
      (item_id,name,holder_character,holder_label,status_note,chapter_number,evidence,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(item_id) DO UPDATE SET
        name=excluded.name, holder_character=excluded.holder_character, holder_label=excluded.holder_label,
        status_note=excluded.status_note, chapter_number=excluded.chapter_number, evidence=excluded.evidence,
        updated_at=excluded.updated_at`).run(
      itemId, name, holderCharacter || null, holderLabel, statusNote || null, chapterNumber,
      evidence || null, 'author', timestamp, timestamp,
    )
    return { success: true, itemId }
  } catch (error) {
    return { success: false, error: String(error instanceof Error ? error.message : error) }
  }
}

export function deleteKeyItem(db: BetterSqlite3.Database, itemId: string): KeyItemDeleteResult {
  if (!hasKeyItemSchema(db)) return { success: false, error: 'KEY_ITEM_SCHEMA_MISSING' }
  if (typeof itemId !== 'string' || !itemId.trim()) return { success: false, error: 'KEY_ITEM_INVALID:itemId' }
  const removed = db.prepare('DELETE FROM key_items WHERE item_id=?').run(itemId.trim()).changes
  return removed === 0 ? { success: false, error: 'KEY_ITEM_NOT_FOUND' } : { success: true }
}
