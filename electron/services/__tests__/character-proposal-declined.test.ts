import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { isAdoptedCharacterDecision, type CharacterProposalDecision } from '../../../src/shared/character-proposal'
import { CharacterProposalService } from '../character-proposal-service'
import { textHash } from '../../repositories/generation-run-repository'

/**
 * `declinedCandidateNames` 是「已确认不建卡」的唯一出口：待建卡候选集靠它才可能清空。
 * 这里用最小假库直接构造 envelope，只验证读取语义，不重放完整的 stage/approve 链路。
 */
function fixture() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE character_identity_proposals(proposal_id TEXT PRIMARY KEY, owner_character_id TEXT,
    source_key TEXT, source_hash TEXT, raw_value TEXT, candidate_ids_json TEXT)`)
  // 注入的证明与落库的 proof 逐字相同，`readEnvelope` 的重算比对才会通过。
  const service = new CharacterProposalService(db, 'project', () => ({ items: [], sourceHash: 'stable', provenance: null }))
  return { db, service }
}

function insertBatch(
  db: Database.Database,
  proposalId: string,
  names: readonly string[],
  selections?: CharacterProposalDecision[],
  tamper = false,
) {
  const batch = {
    proposalBatchId: proposalId, revision: 0, status: 'pending-approval',
    items: names.map((name, index) => ({
      selectionKey: `1:${index}`, sourceId: `chapter:1:${index}`, fields: { name },
      relationships: [], resolution: { status: 'unresolved', candidateIds: [] },
    })),
    source: { kind: 'directory', operationId: 'blueprint-sync-op' },
  }
  const envelope = {
    version: 1, projectId: 'project',
    proof: { items: [], sourceHash: 'stable', provenance: null },
    batch,
    ...(selections ? { decision: { proposalBatchId: proposalId, expectedRevision: 0, operationId: `op:${proposalId}`, selections } } : {}),
  }
  const raw = JSON.stringify(envelope)
  db.prepare('INSERT INTO character_identity_proposals(proposal_id,owner_character_id,source_key,source_hash,raw_value,candidate_ids_json) VALUES(?,NULL,?,?,?,?)')
    .run(proposalId, 'character-proposal-v1:project', tamper ? textHash('tampered') : textHash(raw), raw, null)
}

describe('角色候选 · 功能配角声明', () => {
  it('只有新建与映射会产生角色；功能配角与暂不采用都不会', () => {
    expect(isAdoptedCharacterDecision('create')).toBe(true)
    expect(isAdoptedCharacterDecision('map')).toBe(true)
    expect(isAdoptedCharacterDecision('functional')).toBe(false)
    expect(isAdoptedCharacterDecision('keep-unresolved')).toBe(false)
  })

  it('只收已确认为功能配角的名字，未确认的候选不受影响', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:1', ['陈默', '老陈', '赵启明'],
      [{ selectionKey: '1:0', action: 'create' }, { selectionKey: '1:1', action: 'functional' }, { selectionKey: '1:2', action: 'keep-unresolved' }])
    insertBatch(db, 'cpb:2', ['李慧兰'], [{ selectionKey: '1:0', action: 'keep-unresolved' }])
    expect(service.declinedCandidateNames()).toEqual(['老陈'])
  })

  it('没有任何决策的批次不贡献名字', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:3', ['周砚'])
    expect(service.declinedCandidateNames()).toEqual([])
  })

  it('证据不符的批次被跳过而不是抛错（它仍可在收件箱里被读取或取消）', () => {
    const { db, service } = fixture()
    insertBatch(db, 'cpb:4', ['老陈'], [{ selectionKey: '1:0', action: 'functional' }], true)
    insertBatch(db, 'cpb:5', ['赵启明'], [{ selectionKey: '1:0', action: 'functional' }])
    expect(service.declinedCandidateNames()).toEqual(['赵启明'])
  })
})
