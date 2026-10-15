import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { CharacterProposalService } from '../character-proposal-service'
import { CharacterCastDecisionRepository } from '../../repositories/character-cast-decision-repository'
import { textHash } from '../../repositories/generation-run-repository'
import type { CharacterProposalDecision } from '../../../src/shared/character-proposal'

/**
 * 段三（R6）：锚点人物登记从「扫已批准批次派生」改为 **append-only 决定日志**。
 *
 * 这里用最小假库直接构造 envelope，只验证读取/追加语义，不重放完整的 stage/approve 链路。
 * 表结构逐字取自 M08 迁移，保证测试与真实 lane 同形。
 */
const CAST_TABLE_SQL = `
CREATE TABLE character_cast_decisions (
 decision_id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 anchor_role TEXT NOT NULL,
 catchphrase TEXT NOT NULL DEFAULT '',
 relation_to_protagonist TEXT NOT NULL DEFAULT '',
 action TEXT NOT NULL CHECK(action IN ('register','revoke')),
 source_revision INTEGER NOT NULL CHECK(source_revision >= 0),
 operation_id TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_character_cast_decisions_name ON character_cast_decisions(name);
`

/** `withCastTable: false` 模拟未升级到 M08 的库（读路径必须回退到旧派生）。 */
function fixture(options: { withCastTable?: boolean } = {}) {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE character_identity_proposals(proposal_id TEXT PRIMARY KEY, owner_character_id TEXT,
    source_key TEXT, source_hash TEXT, raw_value TEXT, candidate_ids_json TEXT)`)
  db.exec("CREATE TABLE character_identity_meta(id TEXT PRIMARY KEY, revision INTEGER NOT NULL)")
  db.prepare("INSERT INTO character_identity_meta VALUES('main', 7)").run()
  if (options.withCastTable !== false) db.exec(CAST_TABLE_SQL)
  const service = new CharacterProposalService(db, 'project', () => ({ items: [], sourceHash: 'stable', provenance: null }))
  return { db, service }
}

function insertBatch(
  db: Database.Database,
  proposalId: string,
  names: readonly string[],
  selections?: CharacterProposalDecision[],
  tamper = false,
  proofSourceHash = 'stable',
) {
  const batch = {
    proposalBatchId: proposalId, revision: 0, status: 'pending-approval',
    items: names.map((name, index) => ({
      selectionKey: `1:${index}`, sourceId: `chapter:1:${index}`, fields: { name, role: 'minor' },
      relationships: [], resolution: { status: 'unresolved', candidateIds: [] },
    })),
    source: { kind: 'directory', operationId: 'blueprint-sync-op' },
  }
  const envelope = {
    version: 1, projectId: 'project',
    proof: { items: [], sourceHash: proofSourceHash, provenance: null },
    batch,
    ...(selections ? { decision: { proposalBatchId: proposalId, expectedRevision: 0, operationId: `op:${proposalId}`, selections } } : {}),
  }
  const raw = JSON.stringify(envelope)
  db.prepare('INSERT INTO character_identity_proposals(proposal_id,owner_character_id,source_key,source_hash,raw_value,candidate_ids_json) VALUES(?,NULL,?,?,?,?)')
    .run(proposalId, 'character-proposal-v1:project', tamper ? textHash('tampered') : textHash(raw), raw, null)
}

/** 直接往日志里塞一条记录，用于构造「已有历史」的起点。 */
function appendDecision(db: Database.Database, name: string, action: 'register' | 'revoke', operationId: string, extra: { anchorRole?: string; catchphrase?: string } = {}) {
  CharacterCastDecisionRepository.append(db, {
    name, anchorRole: extra.anchorRole ?? '摊主', catchphrase: extra.catchphrase ?? '', action,
    sourceRevision: 1, operationId, createdAt: '2026-10-15T00:00:00.000Z',
  })
}

describe('段三 · 锚点人物决定日志', () => {
  it('空表时把历史 functional 登记回填进日志，老陈这类现存登记不丢', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:1', ['陈默', '老陈', '赵启明'],
      [{ selectionKey: '1:0', action: 'create' }, { selectionKey: '1:1', action: 'functional' }, { selectionKey: '1:2', action: 'keep-unresolved' }])
    insertBatch(db, 'cpb:2', ['李慧兰'], [{ selectionKey: '1:0', action: 'keep-unresolved' }])

    expect(service.declinedCandidateNames()).toEqual(['老陈'])
    // 回填确实落了库（而不是每次读取都重算）。
    expect(CharacterCastDecisionRepository.count(db)).toBe(1)
    expect(CharacterCastDecisionRepository.current(db)[0]).toMatchObject({ name: '老陈', action: 'register' })
  })

  it('回填只发生一次：再次读取不追加同义记录', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:1', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }])
    service.declinedCandidateNames()
    service.declinedCandidateNames()
    service.listCastDecisions()
    expect(CharacterCastDecisionRepository.count(db)).toBe(1)
  })

  it('撤销后名字回到待建卡候选集（决定日志追加一条 revoke）', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:1', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }])
    expect(service.declinedCandidateNames()).toEqual(['老陈'])

    service.revokeCastDecision({ name: '老陈', operationId: 'revoke-1' })
    expect(service.declinedCandidateNames()).toEqual([])
    expect(service.listCastDecisions()).toEqual([])
    // 日志是追加的：登记那条仍在，历史没有被改写。
    expect(CharacterCastDecisionRepository.count(db)).toBe(2)
    expect(CharacterCastDecisionRepository.current(db)[0].action).toBe('revoke')
  })

  it('撤销保留已声明的口吻与定位（撤销卡槽 ≠ 丢引用键，判据 ④）', () => {
    const { db, service } = fixture()
    appendDecision(db, '老陈', 'register', 'op-1', { anchorRole: '早餐摊摊主', catchphrase: '来碗豆浆' })
    service.revokeCastDecision({ name: '老陈', operationId: 'revoke-1' })
    const latest = CharacterCastDecisionRepository.current(db)[0]
    expect(latest).toMatchObject({ action: 'revoke', anchorRole: '早餐摊摊主', catchphrase: '来碗豆浆' })
  })

  it('撤销后的名字不会因再次读取而被回填"复活"', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:1', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }])
    service.declinedCandidateNames()
    service.revokeCastDecision({ name: '老陈', operationId: 'revoke-1' })
    // 已批准批次仍然声明着 functional，但日志里已有记录 ⇒ 永不回填。
    expect(service.declinedCandidateNames()).toEqual([])
    expect(service.listCastDecisions()).toEqual([])
  })

  it('对已撤销的名字再撤一次是幂等空操作', () => {
    const { db, service } = fixture()
    appendDecision(db, '老陈', 'register', 'op-1')
    service.revokeCastDecision({ name: '老陈', operationId: 'revoke-1' })
    const after = CharacterCastDecisionRepository.count(db)
    service.revokeCastDecision({ name: '老陈', operationId: 'revoke-2' })
    expect(CharacterCastDecisionRepository.count(db)).toBe(after)
  })

  it('同一操作重放不产生第二条记录（operation_id 即幂等键）', () => {
    const { db, service } = fixture()
    service.registerCastDecision({ name: '老陈', anchorRole: '摊主', operationId: 'same-op' })
    const after = CharacterCastDecisionRepository.count(db)
    service.registerCastDecision({ name: '老陈', anchorRole: '摊主', operationId: 'same-op' })
    expect(CharacterCastDecisionRepository.count(db)).toBe(after)
  })

  it('结果态未变时不追加记录（把口吻改成相同值）', () => {
    const { db, service } = fixture()
    service.registerCastDecision({ name: '老陈', anchorRole: '摊主', catchphrase: '来碗豆浆', operationId: 'op-1' })
    const after = CharacterCastDecisionRepository.count(db)
    service.registerCastDecision({ name: '老陈', anchorRole: '摊主', catchphrase: '来碗豆浆', operationId: 'op-2' })
    expect(CharacterCastDecisionRepository.count(db)).toBe(after)
  })

  it('改口吻定位 = 追加一条 register，当前态取最后一条', () => {
    const { db, service } = fixture()
    service.registerCastDecision({ name: '老陈', anchorRole: '摊主', catchphrase: '来碗豆浆', operationId: 'op-1' })
    service.registerCastDecision({ name: '老陈', anchorRole: '守夜人', catchphrase: '早些回', operationId: 'op-2' })
    expect(service.listCastDecisions()).toEqual([
      expect.objectContaining({ name: '老陈', anchorRole: '守夜人', catchphrase: '早些回', action: 'register' }),
    ])
    // 登记仍是登记的（不是撤销），且只有两条记录。
    expect(CharacterCastDecisionRepository.count(db)).toBe(2)
    expect(service.declinedCandidateNames()).toEqual(['老陈'])
  })

  it('撤销一个从未登记过的名字是幂等空操作，不伪造记录', () => {
    const { db, service } = fixture()
    expect(service.revokeCastDecision({ name: '查无此人', operationId: 'revoke-x' })).toEqual([])
    expect(CharacterCastDecisionRepository.count(db)).toBe(0)
  })

  it('先登记新名字也不会漏掉历史回填（按"该名字无记录"判断，而非"表为空"）', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:1', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }])
    service.registerCastDecision({ name: '门卫老李', anchorRole: '门卫', operationId: 'op-new' })
    expect(service.declinedCandidateNames().sort()).toEqual(['门卫老李', '老陈'].sort())
  })

  it('证据不符的批次被跳过而不是抛错（它仍可在收件箱里被读取或取消）', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:4', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }], true)
    insertBatch(db, 'cpb:5', ['赵启明'], [{ selectionKey: '1:0', action: 'functional' }])
    expect(service.declinedCandidateNames()).toEqual(['赵启明'])
  })

  it('来源已不可证但封存决定完好时，登记仍然回填（判据 ⑮）', () => {
    const { db, service } = fixture()
    // 信封自身完好（哈希对得上），但重算证明与封存证明不一致 —— readEnvelope 在此必抛
    // SOURCE_CHANGED。回填问的是"作者当初决定了什么"，不该被"来源还能不能重算"否定：
    // 否则任何一次来源漂移都会让已定稿的登记静默消失，名字随即回到候选集。
    insertBatch(db, 'cpb:9', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }], false, 'drifted')
    expect(() => service.read('cpb:9')).toThrow('CHARACTER_PROPOSAL_SOURCE_CHANGED')
    expect(service.declinedCandidateNames()).toEqual(['老陈'])
    expect(service.listCastDecisions().map(decision => decision.name)).toEqual(['老陈'])
    // 篡改（行哈希对不上）仍然一律跳过 —— 放行不是后门。
    insertBatch(db, 'cpb:10', ['伪造者'], [{ selectionKey: '1:0', action: 'functional' }], true)
    expect(service.declinedCandidateNames()).toEqual(['老陈'])
  })

  it('未升级到 M08 的库（无新表）回退到旧派生，不抛错', () => {
    const { db, service } = fixture({ withCastTable: false })
    insertBatch(db, 'cpb:1', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }])
    expect(service.declinedCandidateNames()).toEqual(['老陈'])
    expect(service.listCastDecisions()).toEqual([])
    // 写入路径在没有表时必须显式报错，而不是静默丢弃作者的决定。
    expect(() => service.registerCastDecision({ name: '老陈', anchorRole: '摊主', operationId: 'op-1' }))
      .toThrow('CAST_DECISION_SCHEMA_REQUIRED')
    expect(() => service.revokeCastDecision({ name: '老陈', operationId: 'op-2' }))
      .toThrow('CAST_DECISION_SCHEMA_REQUIRED')
  })

  it('非法输入被拒（空名字 / 空定位 / 未知字段）', () => {
    const { service } = fixture()
    expect(() => service.registerCastDecision({ name: '  ', anchorRole: '摊主', operationId: 'op' })).toThrow('CAST_DECISION_INVALID')
    expect(() => service.registerCastDecision({ name: '老陈', anchorRole: ' ', operationId: 'op' })).toThrow('CAST_DECISION_INVALID')
    expect(() => service.revokeCastDecision({ name: '老陈', operationId: 'op' })).not.toThrow()
    expect(() => service.registerCastDecision({ name: '老陈', anchorRole: '摊主', operationId: 'op', extra: 1 } as never))
      .toThrow('CAST_DECISION_INVALID')
  })
})
