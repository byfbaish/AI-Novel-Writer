/**
 * DraftEditStatsRepository — 草稿编辑计量（M30 `draft_edit_stats`）。
 *
 * 只追加，不改写：每次 `db:draft-update-content` 成功覆盖正文后落一行。
 * `save_count` 是该草稿到这次保存为止的序号，由同一个写事务算出。
 */
import { getProjectDb } from '../database'

export type DraftEditOrigin = 'human' | 'ai'

export interface DraftEditStatInput {
  draftId: number
  origin: DraftEditOrigin
  changedChars: number
  oldChars: number
  newChars: number
}

export interface DraftEditStatRow {
  id: number
  draft_id: number
  at: string
  origin: DraftEditOrigin
  changed_chars: number
  old_chars: number
  new_chars: number
  save_count: number
}

export class DraftEditStatsRepository {
  /** 记录一次保存；同一草稿的 save_count 依次累加为 1、2、3… */
  static record(input: DraftEditStatInput, db = getProjectDb()): void {
    if (!db) return
    db.transaction(() => {
      const nextRow = db.prepare(`
        SELECT COALESCE(MAX(save_count), 0) + 1 AS next FROM draft_edit_stats WHERE draft_id = ?
      `).get(input.draftId) as { next: number } | undefined
      const nextSaveCount = Number(nextRow?.next ?? 1)
      db.prepare(`
        INSERT INTO draft_edit_stats
          (draft_id, origin, changed_chars, old_chars, new_chars, save_count)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        input.draftId,
        input.origin,
        input.changedChars,
        input.oldChars,
        input.newChars,
        nextSaveCount,
      )
    })()
  }

  /** 读取某草稿的全部计量行（按保存顺序），供测试与后续报表使用。 */
  static listForDraft(draftId: number, db = getProjectDb()): DraftEditStatRow[] {
    if (!db) return []
    return db.prepare(`
      SELECT id, draft_id, at, origin, changed_chars, old_chars, new_chars, save_count
      FROM draft_edit_stats WHERE draft_id = ? ORDER BY id ASC
    `).all(draftId) as DraftEditStatRow[]
  }
}
