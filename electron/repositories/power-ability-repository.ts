import { randomUUID } from 'node:crypto'
import type BetterSqlite3 from 'better-sqlite3'
import {
  ABILITY_EVIDENCE_MAX,
  ABILITY_TEXT_MAX,
  isAbilityEvidenceScope,
  type AbilityDeleteResult,
  type AbilityEvidenceScope,
  type AbilityWriteResult,
  type PowerAbilityDefinition,
  type PowerAbilityInput,
} from '../../src/shared/power-ability'

/**
 * P1-1 能力仓储（M17）。
 *
 * 与关键物品、制度、知情同一条降级纪律：
 * - **表不存在就降级成空结果**：M17 之前的库读路径返回 `[]`，不抛错；
 * - **重名就地拒绝**：`name` 在表上是 UNIQUE，但裸 SQLite 约束错误对用户不可读，
 *   所以先查一次给出 `ABILITY_NAME_DUPLICATED`；
 * - **删除是真删**：一条能力规则不是历史账本，删了不需要留痕。
 *
 * ## 可空列写 NULL 而不是空串
 *
 * 「没登记」与「登记了一个空串」在渲染层必须一样（都是零字节），但在数据层是两件事：
 * 存空串会让「作者填过又清空」与「从没填过」无法区分。所以可选文本一律 `value || null`。
 *
 * ## `form` 不校验词表
 *
 * 只限制长度，不校验取值：混合形态是真实数据（规则 + 功法 + 天赋寄生），词表只做面板提示。
 * 词表外的值读回来必须一字不差 —— 有专门用例钉住。
 */

const SELECT_ABILITY = `ability_id AS abilityId, name,
  COALESCE(form,'') AS form, COALESCE(hard_limit,'') AS hardLimit,
  COALESCE(weakness,'') AS weakness, COALESCE(cost_note,'') AS costNote,
  stage_chapter AS stageChapter, COALESCE(stage_note,'') AS stageNote,
  COALESCE(evidence,'') AS evidence, evidence_scope AS evidenceScope,
  source, COALESCE(created_at,'') AS createdAt, COALESCE(updated_at,'') AS updatedAt`

function hasTable(db: BetterSqlite3.Database, name: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name))
}

/** M17 之前的库没有这张表 —— 全链路据此降级，不抛错。 */
export function hasPowerAbilitySchema(db: BetterSqlite3.Database): boolean {
  return hasTable(db, 'power_abilities')
}

function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`ABILITY_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`ABILITY_INVALID:${label}`)
  return normalized
}

function optionalText(value: unknown, max = ABILITY_TEXT_MAX): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized.length > max ? normalized.slice(0, max) : normalized
}

/** `null` / `undefined` ⇒ null（缺失）；否则必须是正整数（0 会被读成「序章」）。 */
function optionalChapter(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('ABILITY_INVALID:stageChapter')
  return value as number
}

function optionalScope(value: unknown): AbilityEvidenceScope | null {
  if (value === undefined || value === null || value === '') return null
  if (!isAbilityEvidenceScope(value)) throw new Error('ABILITY_INVALID:evidenceScope')
  return value
}

function nowIso(): string {
  return new Date().toISOString()
}

/** 按名称的码元序列出（与提示词里的排序同一口径，作者扫表时不用来回跳）。 */
export function listPowerAbilities(db: BetterSqlite3.Database): PowerAbilityDefinition[] {
  if (!hasPowerAbilitySchema(db)) return []
  return db.prepare(`SELECT ${SELECT_ABILITY} FROM power_abilities ORDER BY name, ability_id`)
    .all() as PowerAbilityDefinition[]
}

export function getPowerAbility(
  db: BetterSqlite3.Database,
  abilityId: string,
): PowerAbilityDefinition | undefined {
  if (!hasPowerAbilitySchema(db)) return undefined
  return db.prepare(`SELECT ${SELECT_ABILITY} FROM power_abilities WHERE ability_id=?`)
    .get(abilityId) as PowerAbilityDefinition | undefined
}

export function upsertPowerAbility(
  db: BetterSqlite3.Database,
  input: PowerAbilityInput,
): AbilityWriteResult {
  if (!hasPowerAbilitySchema(db)) return { success: false, error: 'ABILITY_SCHEMA_MISSING' }
  try {
    const name = requireText(input?.name, 'name', ABILITY_TEXT_MAX)
    // `form` 只限长度，不校验词表（见文件头）。
    const form = optionalText(input?.form)
    const hardLimit = optionalText(input?.hardLimit)
    const weakness = optionalText(input?.weakness)
    const costNote = optionalText(input?.costNote)
    const stageChapter = optionalChapter(input?.stageChapter)
    const stageNote = optionalText(input?.stageNote)
    const evidence = optionalText(input?.evidence, ABILITY_EVIDENCE_MAX)
    const evidenceScope = optionalScope(input?.evidenceScope)

    const abilityId = typeof input?.abilityId === 'string' && input.abilityId.trim()
      ? input.abilityId.trim()
      : `ability:${randomUUID()}`
    // 重名必须就地拒绝，而不是让 UNIQUE 约束抛出裸 SQLite 错误。
    const owner = db.prepare('SELECT ability_id AS abilityId FROM power_abilities WHERE name=?')
      .get(name) as { abilityId: string } | undefined
    if (owner && owner.abilityId !== abilityId) return { success: false, error: 'ABILITY_NAME_DUPLICATED' }

    const timestamp = nowIso()
    db.prepare(`INSERT INTO power_abilities
      (ability_id,name,form,hard_limit,weakness,cost_note,stage_chapter,stage_note,
       evidence,evidence_scope,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(ability_id) DO UPDATE SET
        name=excluded.name, form=excluded.form, hard_limit=excluded.hard_limit,
        weakness=excluded.weakness, cost_note=excluded.cost_note,
        stage_chapter=excluded.stage_chapter, stage_note=excluded.stage_note,
        evidence=excluded.evidence, evidence_scope=excluded.evidence_scope,
        updated_at=excluded.updated_at`).run(
      abilityId, name, form || null, hardLimit || null, weakness || null, costNote || null,
      stageChapter, stageNote || null, evidence || null, evidenceScope,
      'author', timestamp, timestamp,
    )
    return { success: true, abilityId }
  } catch (error) {
    return { success: false, error: String(error instanceof Error ? error.message : error) }
  }
}

export function deletePowerAbility(db: BetterSqlite3.Database, abilityId: string): AbilityDeleteResult {
  if (!hasPowerAbilitySchema(db)) return { success: false, error: 'ABILITY_SCHEMA_MISSING' }
  if (typeof abilityId !== 'string' || !abilityId.trim()) return { success: false, error: 'ABILITY_INVALID:abilityId' }
  const removed = db.prepare('DELETE FROM power_abilities WHERE ability_id=?').run(abilityId.trim()).changes
  return removed === 0 ? { success: false, error: 'ABILITY_NOT_FOUND' } : { success: true }
}
