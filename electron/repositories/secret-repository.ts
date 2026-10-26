import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import {
  SECRET_DETAIL_MAX,
  SECRET_TEXT_MAX,
  type SecretDefinition,
  type SecretDeleteResult,
  type SecretInput,
  type SecretWriteResult,
} from '../../src/shared/secret'

/**
 * P20-2 秘密宿体仓储（M21：谁在捂什么、谁还不知道、第几章穿）。
 *
 * 与关键物品、制度、知情、能力同一条降级纪律：
 * - **表不存在就降级成空结果**：M21 之前的库读路径返回 `[]`，不抛错；
 * - **同名就地拒绝**：`UNIQUE(title)` 的裸约束错误对用户不可读，所以先查一次给 `SECRET_DUPLICATED`；
 * - **删除是真删**：一条秘密登记不是历史账本，删了不需要留痕。
 *
 * ## 名字数组存 JSON TEXT，读时容错解析
 *
 * `holder_names` / `unaware_names` 是 JSON 数组字符串。读的时候**坏 JSON 一律当空数组**：
 * 一条秘密的隐瞒者列表坏掉，不该让整张登记页读不出来（fail-open 在读取侧，
 * 但写入侧必须严格 —— 见 `toStringList` 的抛错分支）。
 *
 * ## 为什么这些函数是同步的（与 M16 仓储的 async 不同）
 *
 * M16 的 async 是**被迫**的：它的引用键要用 `crypto.subtle`（共享层禁用 `node:crypto`）。
 * 本表没有任何哈希，不需要异步；看着别人 async 就跟着 async，等于凭空给调用方加一层
 * `await`、给「忘记 await 就拿到 Promise」这种 bug 开口子。
 */

const SELECT_SECRET = `secrets.secret_id AS secretId,
  secrets.title AS title,
  secrets.detail AS detail,
  secrets.holder_names AS holderNames,
  secrets.unaware_names AS unawareNames,
  secrets.reveal_chapter AS revealChapter,
  COALESCE(secrets.evidence, '') AS evidence,
  secrets.source AS source,
  COALESCE(secrets.created_at, '') AS createdAt,
  COALESCE(secrets.updated_at, '') AS updatedAt`

type StoredSecret = Omit<SecretDefinition, 'holders' | 'unaware'> & {
  holderNames: string
  unawareNames: string
}

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M21 之前的库没有这张表 —— 全链路据此降级，不抛错。 */
export function hasSecretSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'secrets')
}

/** 读取侧容错：坏 JSON / 非数组 / 非字符串项一律丢掉，绝不让一行坏数据拖垮整页。 */
function parseNameList(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 32)
  } catch { return [] }
}

/**
 * 写入侧严格：调用方给了非法结构就报错，不静默转成空数组。
 *
 * 静默转换会让「作者填的三个隐瞒者全丢了」表现为「保存成功但列表空了」——
 * 那是最难查的一类 bug：界面上看不出任何错误。
 */
function toStringList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new Error(`SECRET_INVALID:${label}`)
  const names: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') throw new Error(`SECRET_INVALID:${label}`)
    const name = item.trim()
    if (!name) continue
    if (name.length > SECRET_TEXT_MAX) throw new Error(`SECRET_INVALID:${label}`)
    names.push(name)
  }
  return [...new Set(names)]
}

function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`SECRET_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`SECRET_INVALID:${label}`)
  return normalized
}

/** 揭穿章：`null` / `undefined` = 作者还没决定（**不是**错误），有值时必须为正整数。 */
function optionalChapter(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('SECRET_INVALID:revealChapter')
  return value as number
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * 列出全部秘密。
 *
 * 排序：**揭穿章升序、未定的排最后**，再按秘密名。
 * 「最近要穿的」是作者最需要盯的；未定揭穿章的放后面，因为它们还没进任何一章的守卫。
 */
export function listSecrets(db: BetterSqlite3.Database): SecretDefinition[] {
  if (!hasSecretSchema(db)) return []
  const rows = db.prepare(`SELECT ${SELECT_SECRET}
    FROM secrets
    ORDER BY secrets.reveal_chapter IS NULL, secrets.reveal_chapter, secrets.title, secrets.secret_id`)
    .all() as StoredSecret[]
  return rows.map(row => ({
    secretId: row.secretId,
    title: row.title,
    detail: row.detail,
    holders: parseNameList(row.holderNames),
    unaware: parseNameList(row.unawareNames),
    revealChapter: typeof row.revealChapter === 'number' ? row.revealChapter : null,
    evidence: row.evidence,
    source: row.source === 'derived' ? 'derived' : 'author',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

/**
 * 写入（新建或改已有行）。
 *
 * 「同名就地拒绝」：同一个秘密只该登记一条。改已有行时若改了名字、且新名字已属于另一个
 * `secret_id`，同样拒绝 —— 否则会悄悄合并两条登记，丢掉其中一条的隐瞒者。
 */
export function upsertSecret(db: BetterSqlite3.Database, input: SecretInput): SecretWriteResult {
  if (!hasSecretSchema(db)) return { success: false, error: 'SECRET_SCHEMA_MISSING' }
  try {
    const title = requireText(input?.title, 'title', SECRET_TEXT_MAX)
    const detail = requireText(input?.detail, 'detail', SECRET_DETAIL_MAX)
    const holders = toStringList(input?.holders, 'holders')
    const unaware = toStringList(input?.unaware, 'unaware')
    const revealChapter = optionalChapter(input?.revealChapter)
    const evidence = typeof input?.evidence === 'string' && input.evidence.trim()
      ? input.evidence.trim().slice(0, SECRET_DETAIL_MAX)
      : ''

    const secretId = typeof input?.secretId === 'string' && input.secretId.trim()
      ? input.secretId.trim()
      : `secret:${randomUUID()}`
    const owner = db.prepare('SELECT secret_id AS secretId FROM secrets WHERE title=?')
      .get(title) as { secretId: string } | undefined
    if (owner && owner.secretId !== secretId) return { success: false, error: 'SECRET_DUPLICATED' }

    const timestamp = nowIso()
    db.prepare(`INSERT INTO secrets
      (secret_id,title,detail,holder_names,unaware_names,reveal_chapter,evidence,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(secret_id) DO UPDATE SET
        title=excluded.title, detail=excluded.detail,
        holder_names=excluded.holder_names, unaware_names=excluded.unaware_names,
        reveal_chapter=excluded.reveal_chapter, evidence=excluded.evidence,
        updated_at=excluded.updated_at`).run(
      secretId, title, detail, JSON.stringify(holders), JSON.stringify(unaware),
      revealChapter, evidence || null, 'author', timestamp, timestamp,
    )
    return { success: true, secretId }
  } catch (error) {
    return { success: false, error: String(error instanceof Error ? error.message : error) }
  }
}

export function deleteSecret(db: BetterSqlite3.Database, secretId: string): SecretDeleteResult {
  if (!hasSecretSchema(db)) return { success: false, error: 'SECRET_SCHEMA_MISSING' }
  if (typeof secretId !== 'string' || !secretId.trim()) return { success: false, error: 'SECRET_INVALID:secretId' }
  const removed = db.prepare('DELETE FROM secrets WHERE secret_id=?').run(secretId.trim()).changes
  return removed === 0 ? { success: false, error: 'SECRET_NOT_FOUND' } : { success: true }
}
