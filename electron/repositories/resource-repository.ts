import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import type {
  ResourceDefinition,
  ResourceDefinitionInput,
  ResourceDeleteResult,
  ResourceMovement,
  ResourceMovementInput,
  ResourceMovementReplaceResult,
  ResourceMovementSource,
  ResourceWriteResult,
} from '../../src/shared/resource-ledger'

/**
 * W6 资源账本仓储（设计稿 §3.2 / §5.1 / §5.3）。
 *
 * 三条纪律都写在函数边界上，而不是留给调用方自觉：
 * - **表不存在就降级成空结果**：M11 之前的库没有这两张表，读路径返回 `[]` 而不是抛错，
 *   免得一个未升级的项目把整条世界状态链路带崩。
 * - **删资源不级联删历史**：已有账本行时拒绝并给明确原因（§5.1 外键 `ON DELETE RESTRICT`）。
 *   历史是既成事实，误删定义不该抹掉「作者当初记了什么」。
 * - **整章重建必须幂等**：`runPostProcessPipeline` 的 `withRetry` 让同一段抽取最多跑 3 次，
 *   所以先 `DELETE WHERE chapter_number=? AND source=?` 再整章写入（§5.1 第二条 ★）。
 *   漏了这条不会报错，只会让余额越滚越大 —— 账本看起来还一切正常。
 */

const MOVEMENT_SOURCES: readonly ResourceMovementSource[] = ['finalized-extract', 'author']

const SELECT_RESOURCE = `resource_id AS resourceId, family_id AS familyId, name, tier, unit,
  anchor_value AS anchorValue, period, COALESCE(earn_note,'') AS earnNote, COALESCE(cost_note,'') AS costNote,
  COALESCE(scarcity_note,'') AS scarcityNote, COALESCE(anchor_note,'') AS anchorNote,
  COALESCE(created_at,'') AS createdAt, COALESCE(updated_at,'') AS updatedAt`

const SELECT_MOVEMENT = `id, chapter_number AS chapterNumber, resource_id AS resourceId, delta, unit, evidence,
  source, COALESCE(created_at,'') AS createdAt`

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M11 之前的库没有这两张表 —— 全链路据此降级，不抛错。 */
export function hasResourceLedgerSchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'resources') && hasTable(db, 'resource_movements')
}

function requireText(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string') throw new Error(`RESOURCE_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`RESOURCE_INVALID:${label}`)
  return normalized
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function nowIso(): string {
  return new Date().toISOString()
}

/** 未登记资源时返回 `[]`（设计稿 §9「resources 空时全链路降级」）。 */
export function listResources(db: BetterSqlite3.Database): ResourceDefinition[] {
  if (!hasTable(db, 'resources')) return []
  return db.prepare(`SELECT ${SELECT_RESOURCE} FROM resources
    ORDER BY COALESCE(family_id,''), tier, name`).all() as ResourceDefinition[]
}

/**
 * 新建或修改一条资源定义。
 *
 * `anchor_value` 只允许 null 或正数：**0 不是「不可通兑」的同义词**，它会被读成
 * 「1 单位 = 0 基准值」（等价于免费兑换）。不可通兑必须留空。
 */
export function upsertResource(db: BetterSqlite3.Database, input: ResourceDefinitionInput): ResourceWriteResult {
  if (!hasTable(db, 'resources')) return { success: false, error: 'RESOURCE_LEDGER_SCHEMA_MISSING' }
  try {
    const name = requireText(input.name, 'name')
    const unit = requireText(input.unit, 'unit', 40)
    const period = requireText(input.period, 'period', 40)
    const tier = input.tier ?? 0
    if (!Number.isSafeInteger(tier) || tier < 0) return { success: false, error: 'RESOURCE_INVALID:tier' }
    const anchorValue = input.anchorValue ?? null
    if (anchorValue !== null && (typeof anchorValue !== 'number' || !Number.isFinite(anchorValue) || anchorValue <= 0)) {
      return { success: false, error: 'RESOURCE_INVALID:anchorValue' }
    }
    const resourceId = input.resourceId?.trim() || `res:${randomUUID()}`

    // 重名必须就地拒绝，而不是让 UNIQUE 约束抛出裸 SQLite 错误。
    const owner = db.prepare('SELECT resource_id AS resourceId FROM resources WHERE name=?').get(name) as
      { resourceId: string } | undefined
    if (owner && owner.resourceId !== resourceId) return { success: false, error: 'RESOURCE_NAME_DUPLICATED' }

    const timestamp = nowIso()
    const familyId = input.familyId?.trim() || null
    db.prepare(`INSERT INTO resources
      (resource_id,family_id,name,tier,unit,anchor_value,period,earn_note,cost_note,scarcity_note,anchor_note,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(resource_id) DO UPDATE SET
        family_id=excluded.family_id, name=excluded.name, tier=excluded.tier, unit=excluded.unit,
        anchor_value=excluded.anchor_value, period=excluded.period, earn_note=excluded.earn_note,
        cost_note=excluded.cost_note, scarcity_note=excluded.scarcity_note, anchor_note=excluded.anchor_note,
        updated_at=excluded.updated_at`).run(resourceId, familyId, name, tier, unit, anchorValue, period,
      optionalText(input.earnNote), optionalText(input.costNote), optionalText(input.scarcityNote),
      optionalText(input.anchorNote), timestamp, timestamp)
    return { success: true, resourceId }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/** 已有账本行的资源**拒绝删除**（不级联）：返回明确原因，供 UI 就地提示。 */
export function deleteResource(db: BetterSqlite3.Database, resourceId: string): ResourceDeleteResult {
  if (!hasResourceLedgerSchema(db)) return { success: false, error: 'RESOURCE_LEDGER_SCHEMA_MISSING' }
  try {
    const id = requireText(resourceId, 'resourceId')
    const movementCount = db.prepare('SELECT COUNT(*) FROM resource_movements WHERE resource_id=?').pluck().get(id) as number
    if (movementCount > 0) return { success: false, error: 'RESOURCE_HAS_MOVEMENTS', movementCount }
    const removed = db.prepare('DELETE FROM resources WHERE resource_id=?').run(id).changes
    if (removed === 0) return { success: false, error: 'RESOURCE_NOT_FOUND' }
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * 整章重建某一来源的全部变动 —— **幂等**（§5.1 第二条 ★）。
 *
 * 先删 `(chapter_number, source)` 再写入：同一章连跑三次，结果与跑一次相同。
 * 删除范围只限本来源，所以「作者补登」不会被「定稿抽取」覆盖掉。
 * `unit` 是写库当刻的快照；作者日后改单位不会改写历史行的语义。
 */
export function replaceChapterMovements(
  db: BetterSqlite3.Database,
  chapterNumber: number,
  rows: readonly ResourceMovementInput[],
  source: ResourceMovementSource,
): ResourceMovementReplaceResult {
  if (!hasResourceLedgerSchema(db)) return { success: false, error: 'RESOURCE_LEDGER_SCHEMA_MISSING' }
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 0) return { success: false, error: 'RESOURCE_INVALID:chapterNumber' }
  if (!MOVEMENT_SOURCES.includes(source)) return { success: false, error: 'RESOURCE_INVALID:source' }
  // 第 0 章只表示「开篇起点」，且只允许作者登记（§5.1）。抽取永远从第 1 章起，
  // 否则「起点」会变成模型产物，余额的锚点就不再是作者的声明。
  if (chapterNumber === 0 && source !== 'author') return { success: false, error: 'RESOURCE_INVALID:origin-source' }

  // 校验与单位快照都在事务外完成：任何一条不合法就整章不落库，而不是删完再失败。
  const prepared: Array<{ resourceId: string; delta: number; unit: string; evidence: string }> = []
  for (const row of rows) {
    const resourceId = typeof row?.resourceId === 'string' ? row.resourceId.trim() : ''
    const resource = resourceId
      ? db.prepare('SELECT unit FROM resources WHERE resource_id=?').get(resourceId) as { unit: string } | undefined
      : undefined
    if (!resource) return { success: false, error: `RESOURCE_NOT_FOUND:${resourceId}` }
    if (!Number.isSafeInteger(row.delta) || row.delta === 0) return { success: false, error: 'RESOURCE_INVALID:delta' }
    const unit = row.unit?.trim() || resource.unit
    const evidence = typeof row.evidence === 'string' ? row.evidence.trim() : ''
    if (!unit || !evidence) return { success: false, error: 'RESOURCE_INVALID:movement' }
    prepared.push({ resourceId, delta: row.delta, unit, evidence })
  }

  const createdAt = nowIso()
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM resource_movements WHERE chapter_number=? AND source=?').run(chapterNumber, source)
      const insert = db.prepare(`INSERT INTO resource_movements
        (chapter_number,resource_id,delta,unit,evidence,source,created_at) VALUES(?,?,?,?,?,?,?)`)
      for (const row of prepared) {
        insert.run(chapterNumber, row.resourceId, row.delta, row.unit, row.evidence, source, createdAt)
      }
    })()
    return { success: true, inserted: prepared.length }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * 截至第 `chapterNumber` 章（**含该章**）的全部变动，按 `chapter_number ASC, id ASC`。
 *
 * 含端点是因为余额公式 `余额(章 n) = Σ movements(≤ n)` 直接吃这个结果（§5.3）；
 * 开篇起点是 `chapter_number=0` 的行，天然落在结果最前面。
 */
export function listMovementsThrough(db: BetterSqlite3.Database, chapterNumber: number): ResourceMovement[] {
  if (!hasTable(db, 'resource_movements')) return []
  return db.prepare(`SELECT ${SELECT_MOVEMENT} FROM resource_movements
    WHERE chapter_number <= ? ORDER BY chapter_number ASC, id ASC`).all(chapterNumber) as ResourceMovement[]
}
