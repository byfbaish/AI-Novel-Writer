import { createRequire } from 'node:module'
import { describe, it, expect, vi } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { applyM02CharacterIdentity } from '../../migrations/m02-character-identity'
import { commitCharacterIdentities, type CharacterIdentityCommitRequest } from '../character-roster-repository'
import { CharacterRepository } from '../character-repository'

/**
 * R6 验收点 5（作者 2026-10-15 裁定）：
 * **复活 = 复用原 `character_id`（重开别名窗口）**，而不是新建孪生身份。
 *
 * 背景：`character_aliases` 主键含 `character_id`，没有全局同名约束 ⇒ 今天对已退休身份
 * 同名建卡会造出 `老陈(retired=1) + 老陈(retired=0)` 两条并存。行为无害，但语义上应明确。
 */
const state = vi.hoisted(() => ({ db: null as import('better-sqlite3').Database | null }))
vi.mock('../../database', () => ({ getProjectDb: () => state.db }))
const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

function fixture() {
  const db = new Database(':memory:'); state.db = db; db.pragma('foreign_keys=ON')
  db.transaction(() => {
    initializeLegacyBaselineSchema(db)
    db.exec("INSERT INTO characters(name,notes,cs_provenance) VALUES('老陈','摊主笔记','{\"kind\":\"legacy\"}'),('李慧兰','','{}')")
    applyM02CharacterIdentity(db)
  })()
  const rows = db.prepare('SELECT character_id,name FROM characters ORDER BY rowid').all() as { character_id: string; name: string }[]
  const request: CharacterIdentityCommitRequest = {
    approval: { operationId: 'approval-1', expectedRevision: 0, action: 'author-edit',
      source: { kind: 'author', source: { projectId: 'p', epoch: 'e', sourceId: 'author-edit', revision: 1, contentHash: 'a'.repeat(64) } } },
    changes: [], creations: [], retireIds: [], relationships: [], resolutions: [],
  }
  return { db, rows, request }
}

/** 退休一个身份，返回退休后的 identityRevision。 */
function retire(db: import('better-sqlite3').Database, characterId: string, revision: number, operationId = 'retire-1') {
  return commitCharacterIdentities(db, {
    approval: { operationId, expectedRevision: revision, action: 'author-edit',
      source: { kind: 'author', source: { projectId: 'p', epoch: 'e', sourceId: 'author-edit', revision, contentHash: 'a'.repeat(64) } } },
    changes: [], creations: [], retireIds: [characterId], relationships: [], resolutions: [],
  }, () => true)
}

describe('R6 · 复活 vs 孪生', () => {
  it('对已退休同名身份建卡 = 复用原 character_id，而不是新建孪生', () => {
    const f = fixture(); try {
      const retired = f.rows[0]
      const afterRetire = retire(f.db, retired.character_id, 0)
      expect(f.db.prepare('SELECT retired FROM characters WHERE character_id=?').pluck().get(retired.character_id)).toBe(1)

      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-1'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈', role: 'minor' } }]
      const receipt = commitCharacterIdentities(f.db, f.request, () => true)

      // 复用原 ID，库里仍然只有两条身份（没有孪生）。
      expect(receipt.created).toEqual([{ selectionKey: 'candidate', characterId: retired.character_id }])
      expect(receipt.revived).toEqual([{ selectionKey: 'candidate', characterId: retired.character_id, name: '老陈' }])
      expect(f.db.prepare('SELECT COUNT(*) FROM characters').pluck().get()).toBe(2)
      expect(f.db.prepare('SELECT retired FROM characters WHERE character_id=?').pluck().get(retired.character_id)).toBe(0)
    } finally { f.db.close() }
  })

  it('复活重开别名窗口：新增一条当前生效别名，旧的仍带 valid_through', () => {
    const f = fixture(); try {
      const retired = f.rows[0]
      const afterRetire = retire(f.db, retired.character_id, 0)
      const closed = f.db.prepare('SELECT valid_through FROM character_aliases WHERE character_id=? AND name=?')
        .pluck().get(retired.character_id, '老陈') as number | null
      expect(closed).not.toBeNull()

      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-1'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈' } }]
      commitCharacterIdentities(f.db, f.request, () => true)

      const aliases = f.db.prepare('SELECT name,valid_through FROM character_aliases WHERE character_id=? ORDER BY valid_from').all(retired.character_id) as { name: string; valid_through: number | null }[]
      // 历史别名未被改写（valid_through 仍在），另加一条当前生效的。
      expect(aliases.filter(alias => alias.valid_through === null)).toHaveLength(1)
      expect(aliases).toHaveLength(2)
      // 解析路径（getByName 要求 valid_through IS NULL 且 retired=0）重新认得这个名字。
      // 别名按写入它的 operationId 作 source_key，与新建路径同一约定。
      expect(CharacterRepository.getByName('老陈', 'revive-1')?.characterId).toBe(retired.character_id)
    } finally { f.db.close() }
  })

  it('复活保留历史静态字段与既有 provenance，只覆盖作者这次给的字段', () => {
    const f = fixture(); try {
      const retired = f.rows[0]
      const afterRetire = retire(f.db, retired.character_id, 0)
      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-1'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈', role: 'minor' } }]
      commitCharacterIdentities(f.db, f.request, () => true)

      // 没碰过的 notes 原样保留（采用生成文本绝不改写作者字段）。
      expect(f.db.prepare('SELECT notes FROM characters WHERE character_id=?').pluck().get(retired.character_id)).toBe('摊主笔记')
      const provenance = JSON.parse(f.db.prepare('SELECT static_provenance FROM characters WHERE character_id=?').pluck().get(retired.character_id) as string)
      expect(provenance.kind).toBe('legacy')
      expect(provenance.fields.name).toBeTruthy()
      expect(provenance.fields.role).toBeTruthy()
    } finally { f.db.close() }
  })

  it('改名后退场的身份也能按旧名复活（匹配同时看别名历史）', () => {
    const f = fixture(); try {
      const target = f.rows[0]
      // 先改名：老陈 → 陈掌柜（旧别名带 valid_through）。
      commitCharacterIdentities(f.db, { ...f.request, approval: { ...f.request.approval, operationId: 'rename-1' },
        changes: [{ characterId: target.character_id, fields: { name: '陈掌柜' } }] }, () => true)
      const afterRetire = retire(f.db, target.character_id, 1)
      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-1'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈' } }]
      const receipt = commitCharacterIdentities(f.db, f.request, () => true)

      expect(receipt.revived).toEqual([{ selectionKey: 'candidate', characterId: target.character_id, name: '老陈' }])
      expect(f.db.prepare('SELECT COUNT(*) FROM characters').pluck().get()).toBe(2)
    } finally { f.db.close() }
  })

  it('没有同名退休身份时照常新建（不误复活）', () => {
    const f = fixture(); try {
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '全新的名字' } }]
      const receipt = commitCharacterIdentities(f.db, f.request, () => true)
      expect(receipt.revived).toEqual([])
      expect(receipt.created).toHaveLength(1)
      expect(f.db.prepare('SELECT COUNT(*) FROM characters').pluck().get()).toBe(3)
    } finally { f.db.close() }
  })

  it('同名退休身份有两个时不猜，宁可新建（避免把候选挂到错误的那一个）', () => {
    const f = fixture(); try {
      const target = f.rows[0]
      const afterRetire = retire(f.db, target.character_id, 0)
      // 再造一个同名退休身份（直接落库，模拟历史孪生）。
      f.db.prepare("INSERT INTO characters(character_id,name,retired,static_provenance,identity_revision) VALUES('twin','老陈',1,'{}',?)").run(afterRetire.revision)
      f.db.prepare('INSERT INTO character_aliases VALUES(?,?,?,?,NULL)').run('twin', '老陈', 'legacy', afterRetire.revision)
      f.db.prepare("UPDATE characters SET retired=1 WHERE character_id='twin'").run()

      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-ambiguous'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈' } }]
      const receipt = commitCharacterIdentities(f.db, f.request, () => true)
      expect(receipt.revived).toEqual([])
      expect(f.db.prepare('SELECT COUNT(*) FROM characters').pluck().get()).toBe(4)
    } finally { f.db.close() }
  })

  it('活跃（未退休）的同名身份不受影响：仍然新建独立身份', () => {
    const f = fixture(); try {
      // 老陈是活跃的 ⇒ 现有语义（同名不自动合并）必须保持。
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈' } }]
      const receipt = commitCharacterIdentities(f.db, f.request, () => true)
      expect(receipt.revived).toEqual([])
      expect(receipt.created).toHaveLength(1)
      expect(receipt.created[0].characterId).not.toBe(f.rows[0].character_id)
      expect(f.db.prepare('SELECT COUNT(*) FROM characters').pluck().get()).toBe(3)
    } finally { f.db.close() }
  })

  it('复活是幂等的：同一 operationId 重放不产生第二条别名或第二个身份', () => {
    const f = fixture(); try {
      const retired = f.rows[0]
      const afterRetire = retire(f.db, retired.character_id, 0)
      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-1'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈' } }]
      const first = commitCharacterIdentities(f.db, f.request, () => true)
      const replay = commitCharacterIdentities(f.db, f.request, () => true)

      expect(replay).toEqual({ ...first, idempotent: true })
      expect(f.db.prepare('SELECT COUNT(*) FROM characters').pluck().get()).toBe(2)
      expect(f.db.prepare('SELECT COUNT(*) FROM character_aliases WHERE character_id=?').pluck().get(retired.character_id)).toBe(2)
    } finally { f.db.close() }
  })

  it('复活后可与既有活跃角色建立关系（身份是活跃的）', () => {
    const f = fixture(); try {
      const retired = f.rows[0], other = f.rows[1]
      const afterRetire = retire(f.db, retired.character_id, 0)
      f.request.approval.expectedRevision = afterRetire.revision
      f.request.approval.operationId = 'revive-1'
      f.request.creations = [{ selectionKey: 'candidate', fields: { name: '老陈' } }]
      f.request.relationships = [{ sourceCharacterId: retired.character_id, targetCharacterId: other.character_id, relation: '旧识' }]
      commitCharacterIdentities(f.db, f.request, () => true)
      expect(f.db.prepare('SELECT COUNT(*) FROM character_relationships').pluck().get()).toBe(1)
      expect(f.db.pragma('foreign_key_check')).toEqual([])
    } finally { f.db.close() }
  })
})
