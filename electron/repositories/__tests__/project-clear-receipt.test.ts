import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getCurrentProjectPath, getProjectDb } from '../../database'
import { ProjectClearRepository } from '../project-clear-repository'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { M01_GENERATION_SQL } from '../../migrations/m01-generation-runs'
import { M03_REVIEW_CYCLE_SQL } from '../../migrations/m03-review-cycle'

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

  // D10：生成账四表是单稿卡／批次卡／目录进度卡的宿主，清空后四表必须归零，且四表各算一类。
  it('clears the four generation_* host tables and counts them as four categories', () => {
    const db = new Database(':memory:')
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-clear-receipt-'))
    const hostTables = ['generation_artifacts', 'generation_attempts', 'generation_runs', 'generation_roots']
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()
      db.prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json) VALUES(?,?,?,?)')
        .run('root-1', 'idem-1', '{}', '{}')
      db.prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
        .run('run-1', 'root-1', '{}', 'running', 1, 'open-1')
      db.prepare('INSERT INTO generation_attempts(attempt_id,reservation_id,run_id,root_action_id,attempt_json,invocation_nonce) VALUES(?,?,?,?,?,?)')
        .run('attempt-1', 'res-1', 'run-1', 'root-1', '{}', 'nonce-1')
      db.prepare('INSERT INTO generation_artifacts(artifact_id,attempt_id,run_id,artifact_json,revision) VALUES(?,?,?,?,?)')
        .run('artifact-1', 'attempt-1', 'run-1', '{}', 0)
      for (const table of hostTables) expect(countRows(db, table)).toBe(1)

      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(projectPath)

      const result = ProjectClearRepository.clearGeneratedData({ generatedText: true })

      for (const table of hostTables) expect(countRows(db, table)).toBe(0)
      // 四表各 1 行，一表一类：行数 +4、类数 ≥ 4。
      expect(result.counts.generatedText.rows).toBe(4)
      expect(result.counts.generatedText.categories).toBeGreaterThanOrEqual(4)
    } finally {
      db.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })

  // D10 老库守门：没有 M01 四表时清空必须照常成功（hasTable 守卫），不能把正文清不掉。
  it('does not fail on legacy databases that never ran M01', () => {
    const db = new Database(':memory:')
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-clear-receipt-'))
    try {
      initializeLegacyBaselineSchema(db)
      for (const table of ['generation_artifacts', 'generation_attempts', 'generation_runs', 'generation_roots']) {
        const found = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
        expect(found).toBeUndefined()
      }
      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(projectPath)

      expect(() => ProjectClearRepository.clearGeneratedData({ generatedText: true })).not.toThrow()
    } finally {
      db.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })

  // D10 次序守门（结论以实测为准，含反面）：
  // electron/migrations/m03-review-cycle.ts:61 的 confirmation_review_id 是 `REFERENCES reviews(id)`，
  // 无 ON DELETE 子句 = NO ACTION（不是 RESTRICT，检查发生在语句结束时）；
  // electron/repositories/review-cycle-repository.ts:762 会把 confirmation_review_id 更新成另一条 review，
  // 所以 confirmation_review_id != review_id 是常态。实测两种删法：
  //   a) `DELETE FROM reviews WHERE id=<confirmation>`：子行还活着 → FOREIGN KEY constraint failed；
  //   b) `DELETE FROM reviews`（整表）：不抛 —— review_id 那条被删时 CASCADE 把子行一起带走，
  //      语句结束检查时已无引用。
  // 故当前生产语句（整表删）下「挪回必红」的反例造不出来，兜底删除属保险：
  // 它守住的是「将来若把 reviews 改成按条件删」这条路径，不是今天这条。
  function seedReviewPair(db: ReturnType<typeof Database>, tag: string, chapter: number): void {
    const contentId = db.prepare('INSERT INTO contents(body) VALUES(?)').run(`正文-${tag}`).lastInsertRowid
    const draftId = db.prepare('INSERT INTO drafts(chapter_number,version,content_id) VALUES(?,?,?)')
      .run(chapter, 1, contentId).lastInsertRowid
    // 先插 confirmation 目标（rowid 更小），再插 review_id 指向的那条 —— 造出 confirmation_review_id != review_id
    const confirmationReviewId = db.prepare('INSERT INTO reviews(base_draft_id,review_index,content_id) VALUES(?,?,?)')
      .run(draftId, 1, contentId).lastInsertRowid
    const reviewId = db.prepare('INSERT INTO reviews(base_draft_id,review_index,content_id) VALUES(?,?,?)')
      .run(draftId, 2, contentId).lastInsertRowid
    expect(Number(confirmationReviewId)).toBeLessThan(Number(reviewId))
    db.prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json) VALUES(?,?,?,?)')
      .run(`root-${tag}`, `idem-${tag}`, '{}', '{}')
    db.prepare(`INSERT INTO review_cycles(cycle_id,root_action_id,review_id,review_content_hash,
      confirmation_review_id,confirmation_content_hash,source_hash,finding_set_hash,comparison_version,
      revision_status,recheck_count) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(`cycle-${tag}`, `root-${tag}`, reviewId, 'h1', confirmationReviewId, 'h2', 's1', 'f1', 1, 'not-generated', 0)
  }

  it('clears review_cycles before reviews so the confirmation_review_id foreign key can never bite', () => {
    const db = new Database(':memory:')
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'writer-clear-receipt-'))
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => {
        initializeLegacyBaselineSchema(db)
        db.exec(M01_GENERATION_SQL)
        db.exec(M03_REVIEW_CYCLE_SQL)
      })()
      seedReviewPair(db, 'probe', 1)
      expect(countRows(db, 'review_cycles')).toBe(1)
      const confirmationReviewId = db.prepare('SELECT confirmation_review_id AS id FROM review_cycles').get() as { id: number }

      // a) 按 id 删 confirmation 那条 review：子行还在，NO ACTION 挡住
      expect(() => db.prepare('DELETE FROM reviews WHERE id=?').run(confirmationReviewId.id))
        .toThrow(/FOREIGN KEY constraint failed/)
      expect(countRows(db, 'reviews')).toBe(2)
      expect(countRows(db, 'review_cycles')).toBe(1)

      // b) 整表删 reviews：不抛（CASCADE 在同语句里带走子行）——「挪回必红」造不出来，如实记录
      expect(() => db.prepare('DELETE FROM reviews').run()).not.toThrow()
      expect(countRows(db, 'reviews')).toBe(0)
      expect(countRows(db, 'review_cycles')).toBe(0)
      db.prepare('DELETE FROM generation_roots').run()

      // 生产路径：同一形态（confirmation_review_id != review_id）下 clearGeneratedData 不抛，相关表归 0
      seedReviewPair(db, 'prod', 2)
      expect(countRows(db, 'review_cycles')).toBe(1)
      expect(countRows(db, 'generation_roots')).toBe(1)

      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(projectPath)

      expect(() => ProjectClearRepository.clearGeneratedData({ generatedText: true })).not.toThrow()
      expect(countRows(db, 'review_cycles')).toBe(0)
      expect(countRows(db, 'reviews')).toBe(0)
      expect(countRows(db, 'generation_roots')).toBe(0)
    } finally {
      db.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
