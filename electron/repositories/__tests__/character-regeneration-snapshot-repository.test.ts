import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import type BetterSqlite3 from 'better-sqlite3'

import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import type { CharacterIdentityCommitRequest } from '../character-roster-repository'
import { CharacterRosterRepository, commitCharacterIdentities, refreshCharacterIdentityProjection } from '../character-roster-repository'
import {
  hasCharacterRegenerationSnapshotSchema,
  readCharacterIdentityRevision,
  readCharacterRegenerationSnapshot,
  readCharacterRegenerationSnapshots,
  rollbackCharacterRegenerationFields,
  writeCharacterRegenerationSnapshots,
} from '../character-regeneration-snapshot-repository'
import type { ApproveCharacterProposalRequest, CharacterProposalBatch, CharacterProposalItem } from '../../../src/shared/character-proposal'
import type { CharacterProposalSource } from '../../../src/shared/character-proposal'
import { CharacterProposalService, type CharacterProposalProof } from '../../services/character-proposal-service'
import { textHash } from '../generation-run-repository'

vi.mock('../../database', () => ({ getProjectDb: () => state.db }))
const state = vi.hoisted(() => ({ db: null as BetterSqlite3.Database | null }))
const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * J6–J8（仓储层）：快照写入 / 按 `operation_id` 读取 / 逐字段回退 / 版本不符拒绝 / 旧批次无入口。
 *
 * 这里的夹具刻意走**真实的** `CharacterProposalService.approve()` 与真实的
 * `commitCharacterIdentities`，只把「生成证据」`prove` 换成固定值（没有真实模型调用，见派单 §9）。
 * 这样「快照写入时机」被真的覆盖到：写早了、写晚了、写错事务里，都会体现在结果上。
 */

const PROJECT_ID = 'proj-c1b'
const EPOCH = 'epoch-c1b'
const HASH = 'a'.repeat(64)
const MODEL_REVISION = 'b'.repeat(64)
const SOURCE_HASH = 'c'.repeat(64)

function fixture(): { db: BetterSqlite3.Database; ids: { chenmo: string; laochen: string }; revision: number } {
  const db = new Database(':memory:')
  state.db = db
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  // `project_core` 的 `main` 行由真实建库路径写入；基线 fixture 只建表，这里补上，
  // 否则 `refreshCharacterIdentityProjection` 的 UPDATE 落空、roster 永远 inconsistent。
  db.prepare("INSERT OR IGNORE INTO project_core (id, writing_language) VALUES ('main','zh-CN')").run()
  // M02 之后写角色只能走 ID 通道。这里用 **真实的** identity 提交通道建两张卡（固定 approval 收据），
  // 随后重建投影把 roster 置为 `ready` —— `approve()` 的前置检查才成立。
  const base = { role: 'protagonist', gender: '男', age: '三十岁', appearance: '灰袍', personality: '克制',
    abilities: '做饭', motivation: '守住摊子', arc: '从摊主到掌柜', notes: '左手有旧伤' }
  const creation = (selectionKey: string, name: string, overrides: Record<string, string>) => ({
    selectionKey, fields: { name, ...base, ...overrides } as never,
  })
  db.transaction(() => {
    commitCharacterIdentities(db, {
      approval: { operationId: 'roster-init', expectedRevision: 0, action: 'author-edit',
        source: { kind: 'author', source: { projectId: PROJECT_ID, epoch: EPOCH, sourceId: 'roster-init', revision: 0, contentHash: HASH } } },
      creations: [
        creation('seed-chenmo', '陈默', { background: '清平里的旧摊主。后来进了城。' }),
        creation('seed-laochen', '老陈', { role: 'supporting', age: '五十岁', appearance: '驼背',
          personality: '絮叨', background: '茶摊老板', abilities: '算账', motivation: '守住茶摊',
          arc: '', notes: '' }),
      ],
      changes: [], retireIds: [], relationships: [], resolutions: [],
    }, () => true)
    refreshCharacterIdentityProjection(db)
  })()
  const rows = db.prepare('SELECT character_id,name FROM characters ORDER BY rowid').all() as { character_id: string; name: string }[]
  if (CharacterRosterRepository.read(db).status !== 'ready') throw new Error('ROSTER_NOT_READY_IN_FIXTURE')
  const ids = { chenmo: rows.find(row => row.name === '陈默')!.character_id, laochen: rows.find(row => row.name === '老陈')!.character_id }
  return { db, ids, revision: readCharacterIdentityRevision(db) }
}

const batchSource = {
  kind: 'generation', inputKind: 'architecture',
  handle: { projectId: PROJECT_ID, epoch: EPOCH, runId: 'run-1', stage: 'architecture', modelRevision: MODEL_REVISION },
} as unknown as CharacterProposalSource

const proof: CharacterProposalProof = {
  items: [], sourceHash: SOURCE_HASH,
  provenance: { kind: 'generated', modelRevision: MODEL_REVISION,
    source: { projectId: PROJECT_ID, epoch: EPOCH, sourceId: 'run-1', revision: 1, contentHash: 'd'.repeat(64) } },
}

function rebuildBatch(revision: number, ids: { chenmo: string; laochen: string }): CharacterProposalBatch {
  const item = (selectionKey: string, name: string, role: CharacterProposalItem['fields']['role'],
    candidateId: string, background: string): CharacterProposalItem => ({
    selectionKey, sourceId: `来源-${selectionKey}`,
    fields: { name, role, background }, rawValue: {}, relationships: [],
    resolution: { status: 'unresolved', candidateIds: [candidateId] },
  })
  void ids
  return {
    proposalBatchId: '批次-重建', revision, status: 'pending-approval', source: batchSource,
    items: [
      item('a', '陈默', 'protagonist', ids.chenmo, '清平里的老摊主。后来进城做了掌柜。'),
      item('b', '老陈', 'supporting', ids.laochen, '茶摊老板'),
    ],
  }
}

/** 把批次封进 `character_identity_proposals`（readEnvelope 只认这一份封存原文）。 */
function stageBatch(db: BetterSqlite3.Database, batch: CharacterProposalBatch): void {
  const envelope = { version: 1, projectId: PROJECT_ID, proof, batch }
  const encoded = JSON.stringify(envelope)
  db.prepare(`INSERT INTO character_identity_proposals
    (proposal_id,owner_character_id,source_key,source_hash,raw_value,candidate_ids_json) VALUES(?,NULL,?,?,?,?)`)
    .run(batch.proposalBatchId, `character-proposal-v1:${PROJECT_ID}`, textHash(encoded), encoded, '[]')
}

function applyRebuild(db: BetterSqlite3.Database, ids: { chenmo: string; laochen: string }): {
  batch: CharacterProposalBatch; revision: number
} {
  const revision = readCharacterIdentityRevision(db)
  const batch = rebuildBatch(revision, ids)
  stageBatch(db, batch)
  const service = new CharacterProposalService(db, PROJECT_ID, () => structuredClone(proof))
  const request: ApproveCharacterProposalRequest = { proposalBatchId: batch.proposalBatchId, expectedRevision: revision,
    operationId: 'op-重建-1', selections: [
      { selectionKey: 'a', action: 'map', characterId: ids.chenmo },
      { selectionKey: 'b', action: 'map', characterId: ids.laochen },
    ] }
  service.approve(request)
  return { batch, revision: readCharacterIdentityRevision(db) }
}

describe('J6/J7 架构重建快照与逐字段回退', () => {
  it('覆盖后可按 operation_id 读到快照；回退某字段→该字段回旧值、revision 自增、别的卡不动', () => {
    const f = fixture()
    try {
      const { revision: before } = applyRebuild(f.db, f.ids)
      const snapshots = readCharacterRegenerationSnapshots(f.db, 'op-重建-1')
      // 只有真被改动的卡才写快照：老陈这次的候选值与现值完全相同 ⇒ 不覆盖 ⇒ 无快照。
      expect(snapshots.map(snapshot => snapshot.characterId)).toEqual([f.ids.chenmo])
      const snapshot = readCharacterRegenerationSnapshot(f.db, 'op-重建-1', f.ids.chenmo)!
      expect(snapshot.fields.background).toBe('清平里的旧摊主。后来进了城。')
      expect(snapshot.sourceRevision).toBe(before)

      const result = rollbackCharacterRegenerationFields(f.db,
        { operationId: 'op-重建-1', characterId: f.ids.chenmo, fields: ['background'] },
        { projectId: PROJECT_ID, epoch: EPOCH })
      expect(result.fields).toEqual({ background: '清平里的旧摊主。后来进了城。' })
      expect(result.revision).toBe(before + 1)
      expect(readCharacterIdentityRevision(f.db)).toBe(before + 1)
      expect(f.db.prepare('SELECT background FROM characters WHERE character_id=?').pluck().get(f.ids.chenmo))
        .toBe('清平里的旧摊主。后来进了城。')
      // 别的卡一个字不动。
      expect(f.db.prepare('SELECT background FROM characters WHERE character_id=?').pluck().get(f.ids.laochen)).toBe('茶摊老板')
      // 其他字段也不动（只回退点名的那个）。
      expect(f.db.prepare('SELECT notes FROM characters WHERE character_id=?').pluck().get(f.ids.chenmo)).toBe('左手有旧伤')
    } finally { f.db.close() }
  })

  it('连续回退两个字段：第一个回退不把自己判成「已被人手改」', () => {
    const f = fixture()
    try {
      applyRebuild(f.db, f.ids)
      rollbackCharacterRegenerationFields(f.db, { operationId: 'op-重建-1', characterId: f.ids.chenmo, fields: ['background'] },
        { projectId: PROJECT_ID, epoch: EPOCH })
      const second = rollbackCharacterRegenerationFields(f.db,
        { operationId: 'op-重建-1', characterId: f.ids.chenmo, fields: ['personality'] }, { projectId: PROJECT_ID, epoch: EPOCH })
      expect(second.fields).toEqual({ personality: '克制' })
    } finally { f.db.close() }
  })
})

describe('J7 source_revision 与当前 revision 不一致 ⇒ 拒绝回退', () => {
  it('覆盖后有人手改过 ⇒ 抛 CHARACTER_REGENERATION_ROLLBACK_STALE 且名册内容不变', () => {
    const f = fixture()
    try {
      applyRebuild(f.db, f.ids)
      const revision = readCharacterIdentityRevision(f.db)
      // 模拟「作者后来手改过这张卡」（走同一条作者手改通道）。
      const edit: CharacterIdentityCommitRequest = {
        approval: { operationId: 'op-手改-1', expectedRevision: revision, action: 'author-edit',
          source: { kind: 'author', source: { projectId: PROJECT_ID, epoch: EPOCH, sourceId: 'author-edit', revision, contentHash: HASH } } },
        changes: [{ characterId: f.ids.chenmo, fields: { notes: '作者后来补的一条' } }],
        creations: [], retireIds: [], relationships: [], resolutions: [],
      }
      commitCharacterIdentities(f.db, edit, () => true)
      const before = f.db.prepare('SELECT background,notes,role FROM characters WHERE character_id=?').get(f.ids.chenmo)
      expect(() => rollbackCharacterRegenerationFields(f.db,
        { operationId: 'op-重建-1', characterId: f.ids.chenmo, fields: ['background'] }, { projectId: PROJECT_ID, epoch: EPOCH }))
        .toThrow('CHARACTER_REGENERATION_ROLLBACK_STALE')
      expect(f.db.prepare('SELECT background,notes,role FROM characters WHERE character_id=?').get(f.ids.chenmo)).toEqual(before)
      expect(readCharacterIdentityRevision(f.db)).toBe(revision + 1)
    } finally { f.db.close() }
  })
})

describe('J8 无快照的旧批次', () => {
  it('读不到快照：读取返回空、回退抛 MISSING（不报别的错、不写任何一行）', () => {
    const f = fixture()
    try {
      expect(hasCharacterRegenerationSnapshotSchema(f.db)).toBe(true)
      expect(readCharacterRegenerationSnapshots(f.db, 'op-旧批次')).toEqual([])
      expect(readCharacterRegenerationSnapshot(f.db, 'op-旧批次', f.ids.chenmo)).toBeUndefined()
      const revision = readCharacterIdentityRevision(f.db)
      expect(() => rollbackCharacterRegenerationFields(f.db,
        { operationId: 'op-旧批次', characterId: f.ids.chenmo, fields: ['background'] }, { projectId: PROJECT_ID, epoch: EPOCH }))
        .toThrow('CHARACTER_REGENERATION_SNAPSHOT_MISSING')
      expect(readCharacterIdentityRevision(f.db)).toBe(revision)
    } finally { f.db.close() }
  })

  it('M31 未装（没有那张表）时读取退化为空、写快照明确报 schema 缺失', () => {
    const f = fixture()
    try {
      f.db.exec('DROP TABLE character_regeneration_snapshots')
      expect(hasCharacterRegenerationSnapshotSchema(f.db)).toBe(false)
      expect(readCharacterRegenerationSnapshots(f.db, 'op-重建-1')).toEqual([])
      expect(() => writeCharacterRegenerationSnapshots(f.db, 'op-1',
        [{ characterId: f.ids.chenmo, sourceRevision: 1, fields: { name: '陈默' } }]))
        .toThrow('CHARACTER_REGENERATION_SNAPSHOT_SCHEMA_REQUIRED')
    } finally { f.db.close() }
  })
})

describe('快照写入的重复与越界', () => {
  it('同一操作重放不追加第二份快照（PN 幂等）', () => {
    const f = fixture()
    try {
      const input = [{ characterId: f.ids.chenmo, sourceRevision: 3, fields: { name: '陈默' } }]
      expect(writeCharacterRegenerationSnapshots(f.db, 'op-dup', input)).toBe(1)
      expect(writeCharacterRegenerationSnapshots(f.db, 'op-dup', input)).toBe(0)
      expect(readCharacterRegenerationSnapshots(f.db, 'op-dup')).toHaveLength(1)
      expect(readCharacterRegenerationSnapshots(f.db, 'op-dup')[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u)
    } finally { f.db.close() }
  })

  it('回退只接受静态字段：关系边 / 动态状态没有回退通道', () => {
    const f = fixture()
    try {
      applyRebuild(f.db, f.ids)
      expect(() => rollbackCharacterRegenerationFields(f.db,
        { operationId: 'op-重建-1', characterId: f.ids.chenmo, fields: ['relationships'] as never },
        { projectId: PROJECT_ID, epoch: EPOCH })).toThrow('CHARACTER_REGENERATION_ROLLBACK_INVALID:field')
      expect(() => rollbackCharacterRegenerationFields(f.db,
        { operationId: 'op-重建-1', characterId: f.ids.chenmo, fields: ['currentState'] as never },
        { projectId: PROJECT_ID, epoch: EPOCH })).toThrow('CHARACTER_REGENERATION_ROLLBACK_INVALID:field')
    } finally { f.db.close() }
  })
})
