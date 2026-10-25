import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import type { M03FindingDescriptor } from '../m03-review-cycle'
import { canonicalM03FindingSetHash } from '../m03-review-cycle'
import { applyM20ReviewClass, verifyM20ReviewClass, M20_REVIEW_CLASS_SQL } from '../m20-review-class'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

/** 只建 M20 用到的两张表：本文件测的是迁移函数本身，不牵动 M03 的全量不变量。 */
function bare() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE review_cycles(cycle_id TEXT PRIMARY KEY, finding_set_hash TEXT NOT NULL)`)
  db.exec(`CREATE TABLE review_findings(cycle_id TEXT NOT NULL, finding_id TEXT NOT NULL, source_project_id TEXT NOT NULL,
    source_epoch TEXT NOT NULL, source_id TEXT NOT NULL, source_revision INTEGER NOT NULL, source_content_hash TEXT NOT NULL,
    span_start INTEGER, span_end INTEGER, span_unit TEXT, excerpt_hash TEXT, occurrence INTEGER, category TEXT NOT NULL,
    target_id TEXT, kind TEXT NOT NULL CHECK(kind IN ('objective','literary')), problem_text TEXT NOT NULL, expected_text TEXT,
    status TEXT NOT NULL, evidence_hash TEXT, confirmation_item_index INTEGER, PRIMARY KEY(cycle_id,finding_id))`)
  return db
}

function seed(db: import('better-sqlite3').Database): M03FindingDescriptor {
  const span = { start: 3, end: 9, unit: 'utf16-code-unit' as const }
  const finding: M03FindingDescriptor = {
    findingId: 'finding-1',
    source: { projectId: 'project', epoch: 'epoch', sourceId: 'draft:1', revision: 1, contentHash: hash('source'), span },
    excerptHash: hash('excerpt'), occurrence: 1, category: 'continuity', targetId: 'target-1', kind: 'objective',
    problemText: '门闩仍然敞开', expectedText: '门闩必须保持关闭', status: 'unresolved', evidenceHash: null,
    confirmationItemIndex: null,
  }
  db.prepare('INSERT INTO review_cycles(cycle_id,finding_set_hash) VALUES(?,?)')
    .run('cycle-1', hash('old-shape'))
  db.prepare(`INSERT INTO review_findings(cycle_id,finding_id,source_project_id,source_epoch,source_id,source_revision,
    source_content_hash,span_start,span_end,span_unit,excerpt_hash,occurrence,category,target_id,kind,problem_text,
    expected_text,status,evidence_hash,confirmation_item_index) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('cycle-1', finding.findingId, finding.source.projectId, finding.source.epoch, finding.source.sourceId,
      finding.source.revision, finding.source.contentHash, span.start, span.end,
      span.unit, finding.excerptHash, finding.occurrence, finding.category, finding.targetId, finding.kind,
      finding.problemText, finding.expectedText, finding.status, finding.evidenceHash, finding.confirmationItemIndex)
  return finding
}

/** M20 之前的口径：immutable 对象里没有 `reviewClass` 这个键。重算是否必要，全靠这条钉住。 */
function legacyFindingSetHash(finding: M03FindingDescriptor): string {
  return hash(JSON.stringify([{
    findingId: finding.findingId, sourceProjectId: finding.source.projectId, sourceEpoch: finding.source.epoch,
    sourceId: finding.source.sourceId, sourceRevision: finding.source.revision,
    sourceContentHash: finding.source.contentHash, spanStart: finding.source.span?.start ?? null,
    spanEnd: finding.source.span?.end ?? null, spanUnit: finding.source.span?.unit ?? null,
    excerptHash: finding.excerptHash, occurrence: finding.occurrence, category: finding.category,
    targetId: finding.targetId, kind: finding.kind, problemText: finding.problemText,
    expectedText: finding.expectedText,
  }]))
}

describe('M20 review class migration', () => {
  it('adds the axis column and recomputes the finding set hash of existing cycles', () => {
    const db = bare()
    try {
      const finding = seed(db)
      const legacy = legacyFindingSetHash(finding)
      db.prepare('UPDATE review_cycles SET finding_set_hash=? WHERE cycle_id=?').run(legacy, 'cycle-1')

      db.transaction(() => applyM20ReviewClass(db))()

      // 轴进了指纹 ⇒ 旧口径的哈希必然对不上，所以迁移必须重算，不能只是加列。
      expect(canonicalM03FindingSetHash([finding])).not.toBe(legacy)
      expect(db.prepare('SELECT finding_set_hash FROM review_cycles WHERE cycle_id=?').pluck().get('cycle-1'))
        .toBe(canonicalM03FindingSetHash([finding]))
      expect(db.prepare("PRAGMA table_info(review_findings)").all() as { name: string }[])
        .toContainEqual(expect.objectContaining({ name: 'review_class' }))
      expect(verifyM20ReviewClass(db)).toBe(true)
    } finally { db.close() }
  })

  it('leaves legacy findings unclassified instead of guessing from the category', () => {
    const db = bare()
    try {
      seed(db)
      db.transaction(() => applyM20ReviewClass(db))()
      expect(db.prepare('SELECT review_class FROM review_findings').pluck().all()).toEqual([null])
    } finally { db.close() }
  })

  it('is idempotent and refuses to run outside a transaction', () => {
    const db = bare()
    try {
      seed(db)
      expect(() => applyM20ReviewClass(db)).toThrow('REVIEW_CLASS_MIGRATION_TRANSACTION_REQUIRED')
      db.transaction(() => applyM20ReviewClass(db))()
      const first = db.prepare('SELECT finding_set_hash FROM review_cycles').pluck().get()
      db.transaction(() => applyM20ReviewClass(db))()
      expect(db.prepare('SELECT finding_set_hash FROM review_cycles').pluck().get()).toBe(first)
    } finally { db.close() }
  })

  it('rejects a column without the value check', () => {
    const db = bare()
    try {
      seed(db)
      db.exec('ALTER TABLE review_findings ADD COLUMN review_class TEXT')
      expect(verifyM20ReviewClass(db)).toBe(false)
      expect(M20_REVIEW_CLASS_SQL).toContain("CHECK(review_class IS NULL OR review_class IN ('mechanical','semantic'))")
    } finally { db.close() }
  })

  it('rejects an out-of-range axis value', () => {
    const db = bare()
    try {
      seed(db)
      db.transaction(() => applyM20ReviewClass(db))()
      expect(() => db.prepare("UPDATE review_findings SET review_class='guess'").run()).toThrow()
      db.prepare("UPDATE review_findings SET review_class='mechanical'").run()
      expect(db.prepare('SELECT review_class FROM review_findings').pluck().get()).toBe('mechanical')
    } finally { db.close() }
  })
})
