import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import type BetterSqlite3 from 'better-sqlite3'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getCurrentProjectPath, getProjectDb } from '../../database'
import { countDraftUnits } from '../../../src/shared/draft-units'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { FinalizationRepository } from '../finalization-repository'
import { UpstreamRevisionRepository } from '../upstream-revision-repository'

vi.mock('../../database', () => ({
  getProjectDb: vi.fn(),
  getCurrentProjectPath: vi.fn(() => null),
}))

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

let db: BetterSqlite3.Database
const roots: string[] = []

function seedDraft(): void {
  db.prepare('INSERT INTO contents (id, body) VALUES (?, ?)').run(11, '数据库中的旧正文')
  db.prepare(`
    INSERT INTO drafts (id, chapter_number, status, content_id, word_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(17, 1, 'draft', 11, 7)
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function commitSnapshot(contentRevision = 8): ReturnType<typeof FinalizationRepository.commit> {
  return FinalizationRepository.commit({
    finalizationId: 'finalization-1',
    draftId: 17,
    chapterNumber: 1,
    chapterTitle: '第一章',
    content: 'Finalized snapshot shown to the user',
    contentHash: hash('Finalized snapshot shown to the user'),
    contentRevision,
    targetFileName: '第1章 第一章.txt',
  })
}

beforeEach(() => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE contents (id INTEGER PRIMARY KEY, body TEXT NOT NULL);
    CREATE TABLE drafts (
      id INTEGER PRIMARY KEY,
      chapter_number INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      content_id INTEGER NOT NULL,
      word_count INTEGER NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE finalization_outbox (
      finalization_id TEXT PRIMARY KEY,
      draft_id INTEGER NOT NULL UNIQUE,
      chapter_number INTEGER NOT NULL,
      chapter_title TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content_revision INTEGER NOT NULL,
      content_snapshot TEXT NOT NULL,
      target_file_name TEXT NOT NULL,
      publication_status TEXT NOT NULL,
      last_error TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      knowledge_document_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT
    );
  `)
  vi.mocked(getProjectDb).mockReturnValue(db)
  vi.mocked(getCurrentProjectPath).mockReturnValue(null)
  seedDraft()
})

afterEach(() => {
  db.close()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  vi.clearAllMocks()
})

function freezeFinalization(id: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-finalization-freeze-'))
  roots.push(root)
  const storage = path.join(root, '.ai-novel')
  fs.mkdirSync(storage)
  fs.writeFileSync(path.join(storage, 'portable-runtime-freeze.json'), JSON.stringify({
    version: 1, originProjectId: '11111111-1111-4111-8111-111111111111', snapshotGeneration: 'snapshot-1',
    nonReplayable: true, requiresRuntimeFreezeGuard: true, avatarReferenceProjections: [], records: [{
      projectionId: `history:finalization_outbox:${id}`, table: 'finalization_outbox', recordId: id,
      terminalState: 'pending', projection: {}, projectionHash: 'a'.repeat(64), excludedFields: [],
      nonReplayable: true, originalReceiptVerified: false,
    }],
  }), { mode: 0o600 })
  return root
}

describe('FinalizationRepository transaction seam', () => {
  it('persists the first positive source revision unchanged in the outbox', () => {
    expect(commitSnapshot(1).contentRevision).toBe(1)
    expect(db.prepare('SELECT content_revision FROM finalization_outbox WHERE draft_id=17').get())
      .toEqual({ content_revision: 1 })
  })

  it('does not link a knowledge document to a frozen imported outbox', () => {
    commitSnapshot()
    const root = freezeFinalization('finalization-1')
    vi.mocked(getCurrentProjectPath).mockReturnValue(root)
    expect(() => FinalizationRepository.linkKnowledgeDocument(17, 'knowledge-document')).toThrow('PORTABLE_RUNTIME_FROZEN')
    expect(db.prepare('SELECT knowledge_document_id FROM finalization_outbox WHERE draft_id=17').get())
      .toEqual({ knowledge_document_id: '' })
  })

  it('commits content, word count, finalized status, and pending publication outbox as one fact', () => {
    const committed = commitSnapshot()

    expect(committed).toMatchObject({
      finalizationId: 'finalization-1',
      draftId: 17,
      contentHash: hash('Finalized snapshot shown to the user'),
      contentRevision: 8,
      publicationStatus: 'pending',
    })
    expect(db.prepare('SELECT body FROM contents WHERE id = 11').get())
      .toEqual({ body: 'Finalized snapshot shown to the user' })
    expect(db.prepare('SELECT status, word_count FROM drafts WHERE id = 17').get())
      .toEqual({ status: 'finalized', word_count: countDraftUnits('Finalized snapshot shown to the user') })
    expect(db.prepare('SELECT * FROM finalization_outbox').get())
      .toMatchObject({
        finalization_id: 'finalization-1',
        draft_id: 17,
        content_hash: hash('Finalized snapshot shown to the user'),
        content_revision: 8,
        content_snapshot: 'Finalized snapshot shown to the user',
        target_file_name: '第1章 第一章.txt',
        publication_status: 'pending',
      })
  })

  it('returns the original submission when a lost response retries the same frozen snapshot', () => {
    commitSnapshot()

    const retried = FinalizationRepository.commit({
      finalizationId: 'response-lost-retry-id',
      draftId: 17,
      chapterNumber: 1,
      chapterTitle: '第一章',
      content: 'Finalized snapshot shown to the user',
      contentHash: hash('Finalized snapshot shown to the user'),
      contentRevision: 8,
      // 第二次调用在物理文件已经出现时可能计算出不同的碰撞候选；不能因此破坏幂等。
      targetFileName: '第1章 第一章 (retry).txt',
    })

    expect(retried.finalizationId).toBe('finalization-1')
    expect(retried.targetFileName).toBe('第1章 第一章.txt')
    expect(db.prepare('SELECT COUNT(*) AS count FROM finalization_outbox').get())
      .toEqual({ count: 1 })
  })

  it('rolls back content and status when writing the outbox fails', () => {
    db.exec(`
      CREATE TRIGGER reject_finalization_outbox
      BEFORE INSERT ON finalization_outbox
      BEGIN
        SELECT RAISE(ABORT, 'outbox rejected');
      END;
    `)

    expect(() => commitSnapshot()).toThrow('outbox rejected')
    expect(db.prepare('SELECT body FROM contents WHERE id = 11').get())
      .toEqual({ body: '数据库中的旧正文' })
    expect(db.prepare('SELECT status, word_count FROM drafts WHERE id = 17').get())
      .toEqual({ status: 'draft', word_count: 7 })
    expect(db.prepare('SELECT * FROM finalization_outbox').all()).toEqual([])
  })

  it('returns one frozen authoritative export row per sparse finalized chapter without blueprints', () => {
    commitSnapshot()
    db.prepare('INSERT INTO contents (id, body) VALUES (?, ?)').run(12, 'obsolete chapter one')
    db.prepare(`
      INSERT INTO drafts (id, chapter_number, version, status, content_id, word_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(18, 1, 0, 'finalized', 12, 20)
    db.prepare('INSERT INTO contents (id, body) VALUES (?, ?)').run(13, '第三章定稿')
    db.prepare(`
      INSERT INTO drafts (id, chapter_number, version, status, content_id, word_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(19, 3, 4, 'finalized', 13, 5)

    expect(FinalizationRepository.listAuthoritativeForExport()).toEqual([
      {
        draftId: 17,
        chapterNumber: 1,
        version: 1,
        title: '第一章',
        content: 'Finalized snapshot shown to the user',
        finalizationId: 'finalization-1',
        contentHash: hash('Finalized snapshot shown to the user'),
      },
      {
        draftId: 19,
        chapterNumber: 3,
        version: 4,
        title: '',
        content: '第三章定稿',
        finalizationId: null,
        contentHash: hash('第三章定稿'),
      },
    ])
  })

  it('revalidates the exact finalized draft, outbox identity, and body integrity frozen for export', () => {
    commitSnapshot()
    const receipt = FinalizationRepository.listAuthoritativeForExport()
      .map(({ draftId, chapterNumber, version, finalizationId, contentHash }) => ({
        draftId,
        chapterNumber,
        version,
        finalizationId,
        contentHash,
      }))

    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(true)

    db.prepare('INSERT INTO contents (id, body) VALUES (?, ?)').run(12, 'conflicting final')
    db.prepare(`
      INSERT INTO drafts (id, chapter_number, version, status, content_id, word_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(18, 1, 1, 'finalized', 12, 17)
    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(false)
    db.prepare('DELETE FROM drafts WHERE id = 18').run()
    db.prepare('DELETE FROM contents WHERE id = 12').run()

    db.prepare("UPDATE finalization_outbox SET content_snapshot = 'other body' WHERE draft_id = 17").run()
    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(false)
    db.prepare(`
      UPDATE finalization_outbox SET content_snapshot = ?, content_hash = 'bad-hash' WHERE draft_id = 17
    `).run('Finalized snapshot shown to the user')
    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(false)
    db.prepare('UPDATE finalization_outbox SET content_hash = ?, finalization_id = ? WHERE draft_id = 17')
      .run(hash('Finalized snapshot shown to the user'), 'replacement-finalization')
    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(false)
    db.prepare('UPDATE finalization_outbox SET finalization_id = ? WHERE draft_id = 17')
      .run('finalization-1')
    db.prepare('UPDATE drafts SET version = 2 WHERE id = 17').run()
    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(false)
    db.prepare('UPDATE drafts SET version = 1, id = 18 WHERE id = 17').run()
    expect(FinalizationRepository.matchesAuthoritativeExportReceipt(receipt)).toBe(false)
  })

  it('rejects a finalized export snapshot whose outbox identity or body disagrees with the draft fact', () => {
    commitSnapshot()
    db.prepare(`
      UPDATE finalization_outbox
      SET chapter_number = 2
      WHERE draft_id = 17
    `).run()

    expect(() => FinalizationRepository.listAuthoritativeForExport())
      .toThrow('定稿导出快照身份不一致')

    db.prepare(`
      UPDATE finalization_outbox
      SET chapter_number = 1, content_snapshot = 'other body'
      WHERE draft_id = 17
    `).run()
    expect(() => FinalizationRepository.listAuthoritativeForExport())
      .toThrow('定稿导出快照正文不一致')
  })

  it('rejects an authoritative finalized draft with no body instead of silently omitting it', () => {
    commitSnapshot()
    db.prepare('UPDATE contents SET body = ? WHERE id = 11').run('')
    db.prepare('UPDATE finalization_outbox SET content_snapshot = ? WHERE draft_id = 17').run('')

    expect(() => FinalizationRepository.listAuthoritativeForExport())
      .toThrow('第 1 章定稿正文为空')
  })
})

/**
 * M28（S6）：定稿时把「大纲是第几版」记下来。
 *
 * 这个文件的其余用例用的是**手写最小 schema**（没有 `outline_rev`、没有版本账），
 * 那条路径本身就在守「老库不许因为缺列而炸掉定稿」—— 一个旁路判据没有资格弄失败
 * 定稿这种核心动作。这里另建一个走完整迁移的库，守「有列时真的记准了」。
 *
 * 记准的判据只有一条：**记的是定稿那一刻的版本，不是之后某一刻的**。所以断言
 * 必须在「定稿之后又改了大纲」还不许变 —— 一旦写成「读的时候现查当前版本」，
 * 这个字段就退化成「永远等于当前版」，而它存在的理由正好是「证明它不等于」。
 */
describe('M28 定稿记录大纲版本', () => {
  function migratedDb(): BetterSqlite3.Database {
    const full = new Database(':memory:') as BetterSqlite3.Database
    full.pragma('foreign_keys=ON')
    full.transaction(() => initializeLegacyBaselineSchema(full))()
    migrateSchema(new SqliteSchemaAdapter(full), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
    full.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
    return full
  }

  function seedFinalizable(target: BetterSqlite3.Database, chapterNumber: number): number {
    const contentId = 5000 + chapterNumber
    target.prepare('INSERT INTO contents (id, body) VALUES (?, ?)').run(contentId, '待定稿正文')
    const inserted = target.prepare(`INSERT INTO drafts (chapter_number, version, status, content_id, word_count)
      VALUES (?, 1, 'draft', ?, 0)`).run(chapterNumber, contentId)
    return Number(inserted.lastInsertRowid)
  }

  function finalize(draftId: number, chapterNumber: number): void {
    FinalizationRepository.commit({
      finalizationId: `finalization-${chapterNumber}-${draftId}`,
      draftId,
      chapterNumber,
      chapterTitle: `第${chapterNumber}章`,
      content: `第${chapterNumber}章正文`,
      contentHash: hash(`第${chapterNumber}章正文`),
      contentRevision: 1,
      targetFileName: `第${chapterNumber}章.txt`,
    })
  }

  it('记下定稿那一刻的大纲版本；之后再改大纲也不许变', () => {
    const full = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(full)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, full)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, full)
      const draftId = seedFinalizable(full, 1)

      finalize(draftId, 1)
      expect(full.prepare('SELECT outline_rev FROM drafts WHERE id = ?').pluck().get(draftId)).toBe(2)

      // 定稿之后作者又改了一版大纲 —— 那一版与「这一章的定稿依据」无关。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [9] }, full)
      expect(full.prepare('SELECT outline_rev FROM drafts WHERE id = ?').pluck().get(draftId)).toBe(2)
    } finally { full.close() }
  })

  it('没有版本账（从没改过大纲）⇒ 记 -1，不是 0', () => {
    const full = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(full)
      const draftId = seedFinalizable(full, 2)
      finalize(draftId, 2)
      // `-1` = 显式的「没有记录」。`0` 在别处表示「假想再造一版」，两义共用会让
      // 「还没记」被读成「按下一版算」。
      expect(full.prepare('SELECT outline_rev FROM drafts WHERE id = ?').pluck().get(draftId)).toBe(-1)
    } finally { full.close() }
  })

  it('读取侧每章只取最高版本那一行（一章多版定稿不该在清单里出现两遍）', () => {
    const full = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(full)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [3] }, full)
      const first = seedFinalizable(full, 3)
      finalize(first, 3)

      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [3] }, full)
      // 第 2 版重新定稿同一章：旧版行按业务是不动的，两行都还在。
      full.prepare("UPDATE drafts SET status = 'revised' WHERE id = ?").run(first)
      const second = full.prepare(`INSERT INTO drafts (chapter_number, version, status, content_id, word_count)
        VALUES (3, 2, 'draft', ?, 0)`).run(5003)
      const secondId = Number(second.lastInsertRowid)
      finalize(secondId, 3)

      // `draftId` 是给清点页跳转用的（S7）：清单说「第 3 章旧了」，点过去要能打开那一版正文。
      expect(FinalizationRepository.readFinalizedOutlineRevs(full))
        .toEqual([{ chapterNumber: 3, outlineRev: 2, draftId: secondId }])
    } finally { full.close() }
  })

  it('缺这一列的老库 ⇒ 照样返回章号、版本记 -1（不许让正文层从清单里凭空消失）', () => {
    // 这个文件 beforeEach 建的手写 schema 正好没有 `outline_rev`。
    expect(FinalizationRepository.readFinalizedOutlineRevs(db)).toEqual([])
    db.prepare("UPDATE drafts SET status = 'finalized' WHERE id = 17").run()
    expect(FinalizationRepository.readFinalizedOutlineRevs(db))
      .toEqual([{ chapterNumber: 1, outlineRev: -1, draftId: 17 }])
  })
})
