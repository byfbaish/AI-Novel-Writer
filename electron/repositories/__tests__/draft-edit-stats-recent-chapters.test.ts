import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { DraftEditStatsRepository } from '../draft-edit-stats-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

function fixture(): InstanceType<typeof Database> {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  return db
}

/**
 * P48：`listRecentChaptersForProject` 的取窗语义。
 *
 * 这条 join 是「近 10 章」唯一的数据入口，写错（取成最旧 10 章、丢掉 AI 行、
 * 或把多版本草稿拆成两章）都不会报错，只会让 A2 读数悄悄偏掉，所以单独立在仓储层测。
 */
describe('DraftEditStatsRepository.listRecentChaptersForProject', () => {
  it('returns only the newest 10 chapters and keeps AI rows', () => {
    const db = fixture()
    try {
      const insertContent = db.prepare('INSERT INTO contents (body) VALUES (?)')
      const insertDraft = db.prepare('INSERT INTO drafts (chapter_number, version, content_id) VALUES (?, ?, ?)')
      const stats: Array<{ draftId: number; chapter: number; origin: 'human' | 'ai'; changed: number }> = []
      for (let chapter = 1; chapter <= 12; chapter += 1) {
        const contentId = Number(insertContent.run(`chapter ${chapter}`).lastInsertRowid)
        const draftId = Number(insertDraft.run(chapter, 1, contentId).lastInsertRowid)
        stats.push({ draftId, chapter, origin: 'human', changed: 10 })
        if (chapter === 12) stats.push({ draftId, chapter, origin: 'ai', changed: 900 })
      }
      for (const stat of stats) {
        DraftEditStatsRepository.record({
          draftId: stat.draftId,
          origin: stat.origin,
          changedChars: stat.changed,
          oldChars: 100,
          newChars: 100 + stat.changed,
        }, db)
      }

      const rows = DraftEditStatsRepository.listRecentChaptersForProject(10, db)
      expect(rows.map(row => row.chapter_number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12])
      expect(rows.at(-1)).toEqual({ chapter_number: 12, origin: 'ai', changed_chars: 900 })
    } finally { db.close() }
  })
})
