import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getCurrentProjectPath, getProjectDb } from '../../database'
import { ProjectClearRepository } from '../project-clear-repository'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'

vi.mock('../../database', async importOriginal => ({
  ...await importOriginal<typeof import('../../database')>(),
  getCurrentProjectPath: vi.fn(),
  getProjectDb: vi.fn(),
}))

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

function countRows(db: ReturnType<typeof Database>, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
  return row.count
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('D10 project clear receipt counts', () => {
  it('reports blueprints rows equal to the DB rows actually deleted', () => {
    const db = new Database(':memory:')
    try {
      initializeLegacyBaselineSchema(db)
      for (let i = 1; i <= 3; i++) {
        db.prepare('INSERT INTO blueprints(chapter_number,title) VALUES(?,?)').run(i, `第${i}章`)
      }
      const before = countRows(db, 'blueprints')
      expect(before).toBe(3)

      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(null)

      const result = ProjectClearRepository.clearGeneratedData({ blueprints: true })

      const after = countRows(db, 'blueprints')
      expect(after).toBe(0)
      // 回执计数与 DB 删除计数一致：行数差 = before - after = 3。
      expect(result.counts.blueprints.rows).toBe(before - after)
      expect(result.counts.blueprints.rows).toBe(3)
      // 只有 blueprints 表有实删记录 ⇒ 算一「类」。
      expect(result.counts.blueprints.categories).toBe(1)
      // 未选中的档不误计。
      expect(result.counts.generatedText.rows).toBe(0)
      expect(result.counts.creativeFields.rows).toBe(0)
      expect(result.counts).toEqual({
        creativeFields: { categories: 0, rows: 0 },
        blueprints: { categories: 1, rows: 3 },
        generatedText: { categories: 0, rows: 0 },
      })
    } finally { db.close() }
  })

  it('reports generatedText rows/categories from the real deletes and keeps scopes separated', () => {
    const db = new Database(':memory:')
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-clear-receipt-'))
    try {
      initializeLegacyBaselineSchema(db)
      const contentId = db.prepare("INSERT INTO contents(body) VALUES('正文')").run().lastInsertRowid
      db.prepare('INSERT INTO drafts(chapter_number,version,content_id) VALUES(1,1,?)').run(contentId)
      db.prepare('INSERT INTO drafts(chapter_number,version,content_id) VALUES(2,1,?)').run(contentId)
      const beforeDrafts = countRows(db, 'drafts')
      const beforeContents = countRows(db, 'contents')
      expect(beforeDrafts).toBe(2)
      expect(beforeContents).toBe(1)

      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(projectPath)

      const result = ProjectClearRepository.clearGeneratedData({ generatedText: true })

      expect(countRows(db, 'drafts')).toBe(0)
      expect(countRows(db, 'contents')).toBe(0)
      // 2 条 drafts + 1 条 contents = 3 条实删；两张表各算一类。
      expect(result.counts.generatedText.rows).toBe(3)
      expect(result.counts.generatedText.categories).toBe(2)
      // 与独立统计的 DB 删除计数一致。
      const deletedTotal = (beforeDrafts - countRows(db, 'drafts')) + (beforeContents - countRows(db, 'contents'))
      expect(result.counts.generatedText.rows).toBe(deletedTotal)
      // 只清了正文档，蓝图/架构档不计。
      expect(result.counts.blueprints.rows).toBe(0)
      expect(result.counts.creativeFields.rows).toBe(0)
      expect(result.physicalFilesDeleted).toBe(0)
    } finally {
      db.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
