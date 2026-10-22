import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { listScannedLedgerChapters } from '../resource-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

function migratedDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  return db
}

let nextDraftVersion = new Map<number, number>()

/** 一条定稿草稿 + 它的 outbox 行（同一次定稿事务的产物）。 */
function finalizeChapter(db: ReturnType<typeof migratedDb>, chapterNumber: number) {
  const version = (nextDraftVersion.get(chapterNumber) ?? 0) + 1
  nextDraftVersion.set(chapterNumber, version)
  const contentId = db.prepare("INSERT INTO contents(body) VALUES('正文')").run().lastInsertRowid as number
  const draftId = db.prepare(
    'INSERT INTO drafts(chapter_number,version,status,content_id) VALUES(?,?,?,?)',
  ).run(chapterNumber, version, 'finalized', contentId).lastInsertRowid as number
  const finalizationId = `fin-${chapterNumber}-${version}`
  db.prepare(`INSERT INTO finalization_outbox
    (finalization_id,draft_id,chapter_number,chapter_title,content_hash,content_revision,target_file_name)
    VALUES(?,?,?,?,?,?,?)`).run(finalizationId, draftId, chapterNumber, `第${chapterNumber}章`, `hash-${finalizationId}`, 1, `${chapterNumber}.txt`)
  return { draftId, finalizationId }
}

/**
 * 一次后处理跑批。`source` 决定 `trigger_source_id` 的写法：
 * 正常定稿写 `finalization:<id>`，老库/无 finalizedSource 的跑批写裸章号。
 */
function createRun(
  db: ReturnType<typeof migratedDb>,
  runId: string,
  source: { finalizationId?: string; chapterNumber: number },
  steps: Array<{ key: string; ok: boolean }>,
  createdAt = '2026-10-22 10:00:00',
) {
  const triggerSourceId = source.finalizationId
    ? `finalization:${source.finalizationId}`
    : String(source.chapterNumber)
  db.prepare(`INSERT INTO post_process_runs
    (id,trigger_source_type,trigger_source_id,source_label,created_at)
    VALUES(?,'chapter_finalize',?,'定稿',?)`).run(runId, triggerSourceId, createdAt)
  for (const step of steps) {
    db.prepare(`INSERT INTO post_process_steps(run_id,step_key,label,critical,ok)
      VALUES(?,?,?,0,?)`).run(runId, step.key, step.key, step.ok ? 1 : 0)
  }
}

describe('listScannedLedgerChapters (§5.2 判定表)', () => {
  it('has no scan state before the ledger tables exist', () => {
    const db = new Database(':memory:')
    try {
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      expect(listScannedLedgerChapters(db)).toEqual([])
    } finally { db.close() }
  })

  it('treats ok=1 as scanned and is reached through finalization:<id>', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      const chapter = finalizeChapter(db, 2)
      createRun(db, 'run-2', { finalizationId: chapter.finalizationId, chapterNumber: 2 }, [
        { key: 'chapter_notes', ok: true },
        { key: 'resource-ledger', ok: true },
      ])
      // run 上没有章号：章号只能从 finalization_outbox 反查出来。
      expect(db.prepare("SELECT trigger_source_id FROM post_process_runs WHERE id='run-2'").pluck().get())
        .toBe(`finalization:${chapter.finalizationId}`)
      expect(listScannedLedgerChapters(db)).toEqual([2])
    } finally { db.close() }
  })

  it('treats ok=0 and a missing step row as unscanned', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      const failed = finalizeChapter(db, 1)
      createRun(db, 'run-1', { finalizationId: failed.finalizationId, chapterNumber: 1 }, [
        { key: 'resource-ledger', ok: false },
      ])
      // 没跑过的步骤根本没有行（baseline-schema.ts:292）——不能因为「没有失败记录」就算扫过。
      const never = finalizeChapter(db, 2)
      createRun(db, 'run-2', { finalizationId: never.finalizationId, chapterNumber: 2 }, [
        { key: 'chapter_notes', ok: true },
      ])
      expect(listScannedLedgerChapters(db)).toEqual([])
    } finally { db.close() }
  })

  it('accepts the legacy bare-chapter-number trigger source', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      finalizeChapter(db, 3)
      createRun(db, 'legacy-3', { chapterNumber: 3 }, [
        { key: 'resource-ledger', ok: true },
      ])
      expect(listScannedLedgerChapters(db)).toEqual([3])
    } finally { db.close() }
  })

  it('only counts the latest finalized draft of a chapter', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      const v1 = finalizeChapter(db, 4)
      createRun(db, 'run-4-v1', { finalizationId: v1.finalizationId, chapterNumber: 4 }, [
        { key: 'resource-ledger', ok: true },
      ])
      // 重定稿：新 draft/outbox 是本章最新定稿，它的账本还没跑 ⇒ 余额必须回到 unknown。
      const v2 = finalizeChapter(db, 4)
      createRun(db, 'run-4-v2', { finalizationId: v2.finalizationId, chapterNumber: 4 }, [
        { key: 'resource-ledger', ok: false },
      ])
      expect(listScannedLedgerChapters(db)).toEqual([])
    } finally { db.close() }
  })

  it('only counts the latest run of the same finalization', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      const chapter = finalizeChapter(db, 5)
      createRun(db, 'run-5-old', { finalizationId: chapter.finalizationId, chapterNumber: 5 }, [
        { key: 'resource-ledger', ok: true },
      ], '2026-10-22 10:00:00')
      // 回填/重跑新开了一次跑批且失败：不能沿用旧跑批的成功记录。
      createRun(db, 'run-5-new', { finalizationId: chapter.finalizationId, chapterNumber: 5 }, [
        { key: 'resource-ledger', ok: false },
      ], '2026-10-22 11:00:00')
      expect(listScannedLedgerChapters(db)).toEqual([])

      const ok = finalizeChapter(db, 6)
      createRun(db, 'run-6-old', { finalizationId: ok.finalizationId, chapterNumber: 6 }, [
        { key: 'resource-ledger', ok: false },
      ], '2026-10-22 10:00:00')
      createRun(db, 'run-6-new', { finalizationId: ok.finalizationId, chapterNumber: 6 }, [
        { key: 'chapter_notes', ok: true },
        { key: 'resource-ledger', ok: true },
      ], '2026-10-22 11:00:00')
      expect(listScannedLedgerChapters(db)).toEqual([6])
    } finally { db.close() }
  })

  it('keeps an earlier successful scan when a later run never touched the ledger', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      const chapter = finalizeChapter(db, 8)
      createRun(db, 'run-8-ledger', { finalizationId: chapter.finalizationId, chapterNumber: 8 }, [
        { key: 'resource-ledger', ok: true },
      ], '2026-10-22 10:00:00')
      // 只修角色卡的过滤跑批（stepKey='character_cards'）不含账本步骤：
      // 它没碰账本，不该把这一章判成中断。
      createRun(db, 'run-8-cards', { finalizationId: chapter.finalizationId, chapterNumber: 8 }, [
        { key: 'character_cards', ok: false },
      ], '2026-10-22 11:00:00')
      expect(listScannedLedgerChapters(db)).toEqual([8])

      // 但一次**真的跑了账本且失败**的跑批必须把这一章翻回未扫。
      createRun(db, 'run-8-ledger-retry', { finalizationId: chapter.finalizationId, chapterNumber: 8 }, [
        { key: 'resource-ledger', ok: false },
      ], '2026-10-22 12:00:00')
      expect(listScannedLedgerChapters(db)).toEqual([])
    } finally { db.close() }
  })

  it('ignores unrelated trigger source types and other chapters', () => {
    nextDraftVersion = new Map()
    const db = migratedDb()
    try {
      const chapter = finalizeChapter(db, 7)
      db.prepare(`INSERT INTO post_process_runs(id,trigger_source_type,trigger_source_id)
        VALUES('arch-1','arch_extract','7')`).run()
      db.prepare(`INSERT INTO post_process_steps(run_id,step_key,label,critical,ok)
        VALUES('arch-1','resource-ledger','resource-ledger',0,1)`).run()
      expect(listScannedLedgerChapters(db)).toEqual([])
      createRun(db, 'run-7', { finalizationId: chapter.finalizationId, chapterNumber: 7 }, [
        { key: 'resource-ledger', ok: true },
      ])
      expect(listScannedLedgerChapters(db)).toEqual([7])
    } finally { db.close() }
  })
})
