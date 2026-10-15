import type BetterSqlite3 from 'better-sqlite3'

/**
 * 锚点人物（功能配角）的 **append-only 作者决定日志**。
 *
 * 语义（设计稿 §9.7 / 实施清单 T12–T14）：
 * - `register` = 作者确认「这个名字有引用键、但没有卡槽」；该名字因此退出待建卡候选集。
 * - `revoke`   = 撤销那条登记；该名字重新回到待建卡候选集（蓝图仍声明他 ⇒ 清单自然带回）。
 * - 当前态 = **按 name 取最后一条**（追加现状，不重写历史）。
 *
 * 为什么不改写已批准批次：批次收据是历史事实，与 `reopen` 同一原则 —— 只追加现状，
 * 不重写历史。撤销因此必须是一条新记录，而不是对旧记录的 UPDATE/DELETE。
 *
 * 撤销行仍然携带登记时的 `anchor_role` / `catchphrase` / `relation_to_protagonist`：
 * 「引用键」与「卡槽」在数据形状上分开（判据 ④），撤销卡槽不连带丢失已声明的口吻与定位。
 */

export type CharacterCastDecisionAction = 'register' | 'revoke'

/** 日志中的一条记录（append-only，永不改写）。 */
export interface CharacterCastDecision {
  decisionId: string
  name: string
  anchorRole: string
  catchphrase: string
  relationToProtagonist: string
  action: CharacterCastDecisionAction
  sourceRevision: number
  operationId: string
  createdAt: string
}

export interface CharacterCastDecisionWrite {
  name: string
  anchorRole: string
  catchphrase?: string
  relationToProtagonist?: string
  action: CharacterCastDecisionAction
  sourceRevision: number
  operationId: string
  createdAt: string
}

/** 名字、定位与口吻的长度上限：这是作者手输文本，不是模型产物。 */
const MAX_NAME = 200
const MAX_TEXT = 500

/**
 * M08 之前的库没有这张表。读路径据此回退到旧派生（见 `declinedCandidateNames`），
 * 这样未升级的项目不会因为一张表而整条候选链失败。
 */
export function hasCharacterCastDecisionSchema(db: BetterSqlite3.Database): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='character_cast_decisions'").get())
}

function requireText(value: unknown, label: string, max = MAX_TEXT): string {
  if (typeof value !== 'string') throw new Error(`CAST_DECISION_INVALID:${label}`)
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`CAST_DECISION_INVALID:${label}`)
  return normalized
}

function optionalText(value: unknown, label: string): string {
  if (value === undefined) return ''
  if (typeof value !== 'string') throw new Error(`CAST_DECISION_INVALID:${label}`)
  const normalized = value.trim()
  if (normalized.length > MAX_TEXT) throw new Error(`CAST_DECISION_INVALID:${label}`)
  return normalized
}

const SELECT_COLUMNS = `decision_id AS decisionId, name, anchor_role AS anchorRole, catchphrase,
  relation_to_protagonist AS relationToProtagonist, action, source_revision AS sourceRevision,
  operation_id AS operationId, created_at AS createdAt`

export class CharacterCastDecisionRepository {
  /** 回填只在空表时发生一次；非空即说明这段历史已被固化。 */
  static count(db: BetterSqlite3.Database): number {
    return (db.prepare('SELECT COUNT(*) AS count FROM character_cast_decisions').get() as { count: number }).count
  }

  /**
   * 当前有效态：每个名字取其最后一条记录。
   * `rowid` 是真正的追加顺序，因此用它而不是 `created_at` 排序 —— 同毫秒的两条记录
   * 也必须分得出先后（撤销紧跟登记时就是这种情形）。
   */
  static current(db: BetterSqlite3.Database): CharacterCastDecision[] {
    return db.prepare(`SELECT ${SELECT_COLUMNS} FROM character_cast_decisions
      WHERE rowid IN (SELECT MAX(rowid) FROM character_cast_decisions GROUP BY name)
      ORDER BY name`).all() as CharacterCastDecision[]
  }

  static currentForName(db: BetterSqlite3.Database, name: string): CharacterCastDecision | undefined {
    return db.prepare(`SELECT ${SELECT_COLUMNS} FROM character_cast_decisions
      WHERE name=? ORDER BY rowid DESC LIMIT 1`).get(name) as CharacterCastDecision | undefined
  }

  /** 当前仍处于「已登记」的名字 —— 待建卡候选集据此排除。 */
  static declinedNames(db: BetterSqlite3.Database): string[] {
    return CharacterCastDecisionRepository.current(db)
      .filter(decision => decision.action === 'register')
      .map(decision => decision.name)
  }

  /**
   * 追加一条记录，并保证幂等。
   *
   * 两种「不产生第二条同义记录」的情形：
   * 1. **同一作者操作重放** —— `operation_id` 已是主键的一部分，重放不再写行；
   * 2. **结果态未变** —— 例如对已撤销的名字再撤一次，或把口吻改成与现值相同的值。
   *
   * 返回是否真的追加了新行，供调用方区分「这次操作改变了现状」与「本来就已是这个状态」。
   */
  static append(db: BetterSqlite3.Database, request: CharacterCastDecisionWrite): boolean {
    const name = requireText(request.name, 'name', MAX_NAME)
    // 定位允许为空：回填无法知道作者当初写的是什么（派生来源里只有名字与角色值），
    // 与其编一个假定位，不如留空让作者补。作者路径的非空校验在 service 层。
    const anchorRole = optionalText(request.anchorRole, 'anchorRole')
    const operationId = requireText(request.operationId, 'operationId')
    const catchphrase = optionalText(request.catchphrase, 'catchphrase')
    const relationToProtagonist = optionalText(request.relationToProtagonist, 'relationToProtagonist')
    if (request.action !== 'register' && request.action !== 'revoke') throw new Error('CAST_DECISION_INVALID:action')
    if (!Number.isSafeInteger(request.sourceRevision) || request.sourceRevision < 0) throw new Error('CAST_DECISION_INVALID:sourceRevision')
    const createdAt = requireText(request.createdAt, 'createdAt')

    if (db.prepare('SELECT 1 FROM character_cast_decisions WHERE operation_id=?').get(operationId)) return false
    const current = CharacterCastDecisionRepository.currentForName(db, name)
    if (current) {
      if (request.action === 'revoke' && current.action === 'revoke') return false
      if (request.action === 'register' && current.action === 'register'
        && current.anchorRole === anchorRole && current.catchphrase === catchphrase
        && current.relationToProtagonist === relationToProtagonist) return false
    }
    db.prepare(`INSERT INTO character_cast_decisions
      (decision_id,name,anchor_role,catchphrase,relation_to_protagonist,action,source_revision,operation_id,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(`cast:${operationId}`, name, anchorRole, catchphrase,
      relationToProtagonist, request.action, request.sourceRevision, operationId, createdAt)
    return true
  }
}
