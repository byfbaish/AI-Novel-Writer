import { createHash } from 'node:crypto'

import { getProjectDb } from '../database'
import { NarrativeThreadRepository } from './narrative-thread-repository'
import { normalizeKeyEvents } from '../../src/shared/blueprint-key-events'
import {
  assertPlotTreeSnapshot,
  assertStoredPlotTreeSnapshot,
  type PlotTreeSnapshot,
  type PlotTreeSourceBundle,
} from '../../src/shared/plot-tree'
import { resolveWritingLanguage } from '../../src/shared/writing-language'
import type { DerivedSourceRef } from '../../src/shared/upstream-revisions'
import { currentSourceRefValue, hasColumn, parseSourceRefValue } from './derived-source-ref'

function requireDb(): NonNullable<ReturnType<typeof getProjectDb>> {
  const db = getProjectDb()
  if (!db) throw new Error('项目数据库未打开')
  return db
}

function sourceRevision(
  sources: Omit<PlotTreeSourceBundle, 'sourceRevision' | 'snapshot'>,
): string {
  return createHash('sha256').update(JSON.stringify(sources)).digest('hex')
}

export class PlotTreeRepository {
  static read(db = requireDb()): PlotTreeSourceBundle {
    const core = db.prepare(`
      SELECT writing_language, synopsis, plot_tree_snapshot
      FROM project_core WHERE id = 'main'
    `).get() as {
      writing_language: string
      synopsis: string
      plot_tree_snapshot: string
    } | undefined
    if (!core) throw new Error('项目配置不存在')

    const blueprintRows = db.prepare(`
      SELECT chapter_number, title, purpose, key_events
      FROM blueprints ORDER BY chapter_number ASC
    `).all() as Array<{
      chapter_number: number
      title: string
      purpose: string
      key_events: string
    }>
    const finalizedRows = db.prepare(`
      SELECT drafts.id AS draft_id,
             drafts.chapter_number,
             COALESCE(finalization_outbox.chapter_title, blueprints.title, '') AS title,
             COALESCE(
               NULLIF(summary_snapshots.chapter_notes, ''),
               CASE WHEN TRIM(COALESCE(blueprints.notes_updated_at, '')) <> ''
                 THEN blueprints.notes ELSE '' END
             ) AS summary
      FROM drafts
      LEFT JOIN finalization_outbox ON finalization_outbox.draft_id = drafts.id
      LEFT JOIN summary_snapshots ON summary_snapshots.draft_id = drafts.id
      LEFT JOIN blueprints ON blueprints.chapter_number = drafts.chapter_number
      WHERE drafts.status = 'finalized'
        AND NOT EXISTS (
          SELECT 1 FROM drafts newer
          WHERE newer.chapter_number = drafts.chapter_number
            AND newer.status = 'finalized'
            AND (newer.version > drafts.version
              OR (newer.version = drafts.version AND newer.id > drafts.id))
        )
      ORDER BY drafts.chapter_number ASC
    `).all() as Array<{
      draft_id: number
      chapter_number: number
      title: string
      summary: string
    }>
    const narrativeThreads = NarrativeThreadRepository.list(db).map(thread => ({
      id: thread.id,
      title: thread.title,
      type: thread.type,
      targetStartChapter: thread.targetStartChapter,
      targetEndChapter: thread.targetEndChapter,
      authorIntent: thread.authorIntent,
      status: thread.status,
      events: thread.events.map(event => ({
        id: event.id,
        chapterNumber: event.chapterNumber,
        type: event.type,
        evidence: event.evidence,
        reason: event.reason,
      })),
    }))
    const blueprints = blueprintRows.map(row => ({
      chapterNumber: row.chapter_number,
      title: row.title,
      purpose: row.purpose,
      keyEvents: normalizeKeyEvents(row.key_events, { chapterNumber: row.chapter_number }),
    }))
    const finalizedChapters = finalizedRows.map(row => ({
      draftId: row.draft_id,
      chapterNumber: row.chapter_number,
      title: row.title,
      summary: row.summary,
    }))
    const facts = {
      writingLanguage: resolveWritingLanguage(core.writing_language),
      synopsis: {
        content: core.synopsis,
      },
      blueprints,
      finalizedChapters,
      narrativeThreads,
    }
    const bundle: PlotTreeSourceBundle = {
      ...facts,
      sourceRevision: sourceRevision(facts),
      snapshot: null,
    }
    if (core.plot_tree_snapshot) {
      try {
        bundle.snapshot = assertStoredPlotTreeSnapshot(JSON.parse(core.plot_tree_snapshot))
      } catch {
        bundle.snapshot = null
        bundle.storedSnapshotInvalid = true
      }
    }
    return bundle
  }

  static save(snapshot: PlotTreeSnapshot, expectedSourceRevision: string, db = requireDb()): PlotTreeSnapshot {
    const sources = this.read(db)
    if (sources.sourceRevision !== expectedSourceRevision) {
      throw new Error('剧情资料在生成期间已更新')
    }
    const validated = assertPlotTreeSnapshot(snapshot, sources)
    // 来源列（M25）**必须写列，不能写进 `plot_tree_snapshot` 这个 JSON**：
    // `graph-generation-source.ts:34/44` 把快照串整体 sha256 当 `targetBaselineHash`，
    // `graph-generation.ts:114` 又逐字节比旧串 —— JSON 一变，正在跑的生成会被判
    // 「素材在生成期间已更新」并当场失败（设计稿 R9）。
    const writeSourceRef = hasColumn(db, 'project_core', 'plot_tree_source_ref')
    const result = writeSourceRef
      ? db.prepare(`
      UPDATE project_core SET plot_tree_snapshot = ?, plot_tree_source_ref = ? WHERE id = 'main'
    `).run(JSON.stringify(validated), currentSourceRefValue(db))
      : db.prepare(`
      UPDATE project_core SET plot_tree_snapshot = ? WHERE id = 'main'
    `).run(JSON.stringify(validated))
    if (result.changes !== 1) throw new Error('剧情树快照保存失败')
    return validated
  }

  static clear(db = requireDb()): void {
    // 快照没了，来源也该归零：留着 `plot_tree_source_ref` 会让「清除后重新生成」
    // 的徽标继续引用一份已不存在的派生（设计稿 §十一 同一条纪律）。
    const withSourceRef = hasColumn(db, 'project_core', 'plot_tree_source_ref')
    const result = withSourceRef
      ? db.prepare(`
      UPDATE project_core SET plot_tree_snapshot = '', plot_tree_source_ref = '' WHERE id = 'main'
    `).run()
      : db.prepare(`
      UPDATE project_core SET plot_tree_snapshot = '' WHERE id = 'main'
    `).run()
    if (result.changes !== 1) throw new Error('剧情树快照清除失败')
  }

  /**
   * 剧情树快照的来源快照（M25 新列）。没有快照、列不存在、解析失败一律 `null`。
   *
   * 与 `sourceRevision`（内容 sha256）**各管一段，不取严**（设计稿裁定 5）：
   * hash 管「这次的素材与生成时是否同一批」，rev 管「我基于的上游是哪一版」。
   */
  static readSourceRef(db = requireDb()): DerivedSourceRef | null {
    if (!hasColumn(db, 'project_core', 'plot_tree_source_ref')) return null
    const raw = db.prepare(
      "SELECT plot_tree_source_ref FROM project_core WHERE id = 'main'",
    ).pluck().get() as string | undefined
    return parseSourceRefValue(raw)
  }
}
