import type BetterSqlite3 from 'better-sqlite3'
import { createHash } from 'node:crypto'
import {
  REGENERATION_ROLLBACK_FIELDS,
  type CharacterRegenerationFieldRollbackRequest,
  type CharacterRegenerationFieldRollbackResult,
  type CharacterRegenerationSnapshotView,
} from '../../src/shared/character-regeneration-diff'
import { commitCharacterIdentities, type CharacterIdentityCommitRequest } from './character-roster-repository'

/**
 * C1-b：架构重建覆盖前的**逐字段回退快照**（表 `character_regeneration_snapshots`，M31）。
 *
 * ## 三条纪律
 *
 * 1. **快照必须在覆盖之前写、且与覆盖同一事务**：写晚了（覆盖后）一旦覆盖本身没提交，
 *    快照就会描述一个从未发生的状态；写早一拍但不在同一事务里，中途回滚会留下孤儿行。
 * 2. **回退复用作者手改通道**（`commitCharacterIdentities` + `author-edit`），不新增第二条
 *    写名册的路径：revision 自增、审批收据、投影刷新全部由那条通道负责。
 * 3. **版本不符就拒绝，不强制覆盖**：`source_revision` 与当前身份 revision 不等，说明这张卡
 *    在那次覆盖之后被人动过 —— 此时把「覆盖前的旧值」写回去会吞掉作者后来的修改。
 */

export const CHARACTER_REGENERATION_SNAPSHOTS_TABLE = 'character_regeneration_snapshots'

export interface CharacterRegenerationSnapshotInput {
  characterId: string
  /** 覆盖**后**的身份版本号（见 shared 契约里 `sourceRevision` 的说明）。 */
  sourceRevision: number
  fields: Record<string, string>
  currentState?: Record<string, unknown>
  relationships?: unknown[]
}

interface SnapshotRow {
  operationId: string
  characterId: string
  sourceRevision: number
  fieldJson: string
  createdAt: string
}

const SELECT_COLUMNS = `operation_id AS operationId, character_id AS characterId,
  source_revision AS sourceRevision, field_json AS fieldJson, created_at AS createdAt`

/**
 * M31 之前的库没有这张表。读路径据此回退到「只读差异、不出回退按钮」
 * （判据 J8：功能上线前的旧批次不渲染回退入口、也不报错）。
 */
export function hasCharacterRegenerationSnapshotSchema(db: BetterSqlite3.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(CHARACTER_REGENERATION_SNAPSHOTS_TABLE))
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`CHARACTER_REGENERATION_SNAPSHOT_INVALID:${label}`)
  return value
}

/** 当前名册身份版本号（`commitCharacterIdentities` 校验/自增的那一个）。 */
export function readCharacterIdentityRevision(db: BetterSqlite3.Database): number {
  const row = db.prepare("SELECT revision FROM character_identity_meta WHERE id='main'").get() as { revision: number } | undefined
  if (!row) throw new Error('CHARACTER_ID_SCHEMA_REQUIRED')
  return row.revision
}

/**
 * 写快照行（覆盖前调用）。同一 `(operationId, characterId)` 只留一行：
 * 重放同一操作不追加第二份快照，后写的也不覆盖先写的那份历史事实。
 */
export function writeCharacterRegenerationSnapshots(
  db: BetterSqlite3.Database,
  operationId: string,
  inputs: readonly CharacterRegenerationSnapshotInput[],
  createdAt = new Date().toISOString(),
): number {
  if (!hasCharacterRegenerationSnapshotSchema(db)) throw new Error('CHARACTER_REGENERATION_SNAPSHOT_SCHEMA_REQUIRED')
  const operation = requireText(operationId, 'operationId')
  if (!Array.isArray(inputs) || !inputs.length) return 0
  const stamp = requireText(createdAt, 'createdAt')
  const insert = db.prepare(`INSERT OR IGNORE INTO character_regeneration_snapshots
    (operation_id, character_id, source_revision, field_json, created_at) VALUES (?,?,?,?,?)`)
  let written = 0
  for (const input of inputs) {
    const characterId = requireText(input.characterId, 'characterId')
    if (!Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
      throw new Error('CHARACTER_REGENERATION_SNAPSHOT_INVALID:sourceRevision')
    }
    const fieldJson = JSON.stringify({
      fields: input.fields ?? {},
      ...(input.currentState ? { currentState: input.currentState } : {}),
      ...(input.relationships ? { relationships: input.relationships } : {}),
    })
    written += insert.run(operation, characterId, input.sourceRevision, fieldJson, stamp).changes
  }
  return written
}

/**
 * 把该批快照的 `source_revision` 落到权威值（`commitCharacterIdentities` 收据里的那个）。
 *
 * 写入时只能按「当前 + 1」预估 —— 真值要等通道返回。预估与真值万一不等（例如同一批里
 * 另有写入），以收据为准校正；不校正的话，正常回退会被自己的预估误差判成 stale。
 */
export function retargetCharacterRegenerationSnapshotRevision(
  db: BetterSqlite3.Database, operationId: string, sourceRevision: number,
): void {
  if (!hasCharacterRegenerationSnapshotSchema(db)) return
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 0) throw new Error('CHARACTER_REGENERATION_SNAPSHOT_INVALID:sourceRevision')
  db.prepare(`UPDATE ${CHARACTER_REGENERATION_SNAPSHOTS_TABLE} SET source_revision=? WHERE operation_id=?`)
    .run(sourceRevision, requireText(operationId, 'operationId'))
}

function parseFieldJson(fieldJson: string): Pick<CharacterRegenerationSnapshotView, 'fields' | 'currentState' | 'relationships'> {  const parsed = JSON.parse(fieldJson) as { fields?: Record<string, string>; currentState?: Record<string, unknown>; relationships?: unknown[] }
  return { fields: parsed.fields ?? {}, ...(parsed.currentState ? { currentState: parsed.currentState } : {}),
    ...(parsed.relationships ? { relationships: parsed.relationships } : {}) }
}

export function readCharacterRegenerationSnapshots(db: BetterSqlite3.Database, operationId: string): CharacterRegenerationSnapshotView[] {
  if (!hasCharacterRegenerationSnapshotSchema(db)) return []
  const rows = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${CHARACTER_REGENERATION_SNAPSHOTS_TABLE}
    WHERE operation_id=? ORDER BY character_id`).all(requireText(operationId, 'operationId')) as SnapshotRow[]
  return rows.map(row => ({ operationId: row.operationId, characterId: row.characterId,
    sourceRevision: row.sourceRevision, createdAt: row.createdAt, ...parseFieldJson(row.fieldJson) }))
}

export function readCharacterRegenerationSnapshot(
  db: BetterSqlite3.Database, operationId: string, characterId: string,
): CharacterRegenerationSnapshotView | undefined {
  if (!hasCharacterRegenerationSnapshotSchema(db)) return undefined
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${CHARACTER_REGENERATION_SNAPSHOTS_TABLE}
    WHERE operation_id=? AND character_id=?`).get(requireText(operationId, 'operationId'),
    requireText(characterId, 'characterId')) as SnapshotRow | undefined
  return row ? { operationId: row.operationId, characterId: row.characterId, sourceRevision: row.sourceRevision,
    createdAt: row.createdAt, ...parseFieldJson(row.fieldJson) } : undefined
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

const SNAPSHOT_STATIC_FIELDS = ['name', 'role', 'gender', 'age', 'appearance', 'personality', 'background',
  'abilities', 'motivation', 'arc', 'notes'] as const

/**
 * 覆盖前读出的「这张卡现在长什么样」：11 个静态字段 + 动态状态（如有）+ 出边。
 *
 * 关系与动态状态进快照只作**只读证据**（对比屏与人工比对用）—— 它们没有逐字段回退通道
 * （关系是只能追加的图，状态是只能推进的派生事实）。写进快照是为了「回退时能看到当时
 * 那张卡的全貌」，不是为了回滚它们。
 */
export function readCharacterRegenerationSnapshotSource(
  db: BetterSqlite3.Database, characterId: string,
): Omit<CharacterRegenerationSnapshotInput, 'sourceRevision'> {
  const row = db.prepare('SELECT * FROM characters WHERE character_id=?').get(requireText(characterId, 'characterId')) as
    Record<string, unknown> | undefined
  if (!row) throw new Error('CHARACTER_REGENERATION_SNAPSHOT_INVALID:characterId')
  const fields = Object.fromEntries(SNAPSHOT_STATIC_FIELDS.map(field => [field, String(row[field] ?? '')])) as Record<string, string>
  const updatedChapter = row.cs_updated_at_chapter as number | null
  const currentState = updatedChapter === null || updatedChapter === undefined ? undefined : {
    location: String(row.cs_location ?? ''), powerLevel: String(row.cs_power_level ?? ''),
    physicalState: String(row.cs_physical_state ?? ''), mentalState: String(row.cs_mental_state ?? ''),
    keyItems: String(row.cs_key_items ?? ''), recentEvents: String(row.cs_recent_events ?? ''),
    updatedAtChapter: updatedChapter,
  }
  const target = db.prepare(`SELECT c.name AS target, r.relation FROM character_relationships r
    JOIN characters c ON c.character_id=r.target_character_id WHERE r.source_character_id=? ORDER BY r.relationship_id`)
    .all(characterId) as { target: string; relation: string }[]
  return { characterId, fields,
    ...(currentState ? { currentState: currentState as unknown as Record<string, unknown> } : {}),
    ...(target.length ? { relationships: target } : {}) }
}

/**
 * 逐字段回退。
 *
 * 1. 取快照；读不到 ⇒ `CHARACTER_REGENERATION_SNAPSHOT_MISSING`（旧批次没有回退入口）。
 * 2. `source_revision` 与当前身份 revision 不等 ⇒ `CHARACTER_REGENERATION_ROLLBACK_STALE`，
 *    **不写任何一行**（不强制覆盖）。
 * 3. 走作者手改通道写回旧值：revision 自增、审批收据落库、投影刷新全部由其负责。
 * 4. 成功后把该行 `source_revision` 提到新 revision：否则作者连续回退第二个字段时，
 *    第一个字段的回退本身就会把自己判成「已被人手改」—— 那是我们自己的写入，不是别人的手改。
 */
export function rollbackCharacterRegenerationFields(
  db: BetterSqlite3.Database,
  request: CharacterRegenerationFieldRollbackRequest,
  session: { projectId: string; epoch: string },
): CharacterRegenerationFieldRollbackResult {
  const snapshot = readCharacterRegenerationSnapshot(db, request.operationId, request.characterId)
  if (!snapshot) throw new Error('CHARACTER_REGENERATION_SNAPSHOT_MISSING')
  if (!Array.isArray(request.fields) || !request.fields.length) throw new Error('CHARACTER_REGENERATION_ROLLBACK_INVALID:fields')
  const fields = [...new Set(request.fields)]
  for (const field of fields) {
    if (!(REGENERATION_ROLLBACK_FIELDS as readonly string[]).includes(field)) {
      throw new Error('CHARACTER_REGENERATION_ROLLBACK_INVALID:field')
    }
    if (typeof snapshot.fields[field] !== 'string') throw new Error('CHARACTER_REGENERATION_ROLLBACK_INVALID:missing')
  }
  return db.transaction(() => {
    const current = readCharacterIdentityRevision(db)
    if (snapshot.sourceRevision !== current) throw new Error('CHARACTER_REGENERATION_ROLLBACK_STALE')
    const restored = Object.fromEntries(fields.map(field => [field, snapshot.fields[field]!]))
    const sourceId = `character-regeneration-rollback:${request.operationId}`
    const approval: CharacterIdentityCommitRequest = {
      approval: { operationId: `character-regeneration-rollback:${request.operationId}:${request.characterId}:${fields.slice().sort().join(',')}`,
        expectedRevision: current, action: 'author-edit',
        source: { kind: 'author', source: { projectId: requireText(session.projectId, 'projectId'),
          epoch: requireText(session.epoch, 'epoch'), sourceId, revision: current,
          contentHash: sha256(JSON.stringify({ operationId: request.operationId, characterId: request.characterId, fields })) } } },
      changes: [{ characterId: request.characterId, fields: restored }],
      creations: [], retireIds: [], relationships: [], resolutions: [],
    }
    const frozen = JSON.stringify(approval)
    const receipt = commitCharacterIdentities(db, approval, candidate => JSON.stringify(candidate) === frozen)
    db.prepare(`UPDATE ${CHARACTER_REGENERATION_SNAPSHOTS_TABLE} SET source_revision=?
      WHERE operation_id=? AND character_id=?`).run(receipt.revision, request.operationId, request.characterId)
    return { operationId: request.operationId, characterId: request.characterId, fields: restored, revision: receipt.revision }
  }).immediate()
}
