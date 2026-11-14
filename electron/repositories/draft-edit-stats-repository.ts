/**
 * DraftEditStatsRepository — 草稿编辑计量（M30 `draft_edit_stats`）。
 *
 * 只追加，不改写：每次 `db:draft-update-content` 成功覆盖正文后落一行。
 * `save_count` 是该草稿到这次保存为止的序号，由同一个写事务算出。
 */
import { getProjectDb } from '../database'
import type { DraftEditChapterStatRow } from '../../src/shared/ipc-channels'

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

  /**
   * P48：本项目最近 `chapterLimit` 章（按 `chapter_number` 降序）的原始计量行。
   *
   * 只做取窗与投影，不筛 `origin`、不算计数 —— 中位数口径归渲染层。
   * 章的边界由 `draft_edit_stats` 自身界定：一行都没有的章不进入结果，
   * 因此「全 ai 章」仍是样本（动作数 0），「从未保存过的章」不是样本。
   * 同一章的多版本草稿行会一起返回，由渲染层按章累加。
   */
  static listRecentChaptersForProject(
    chapterLimit: number,
    db = getProjectDb(),
  ): DraftEditChapterStatRow[] {
    if (!db) return []
    const limit = Number.isSafeInteger(chapterLimit) && chapterLimit > 0 ? chapterLimit : 10
    return db.prepare(`
      SELECT d.chapter_number AS chapter_number, s.origin AS origin, s.changed_chars AS changed_chars
      FROM draft_edit_stats s
      JOIN drafts d ON d.id = s.draft_id
      WHERE d.chapter_number IN (
        SELECT DISTINCT r.chapter_number
        FROM draft_edit_stats rs
        JOIN drafts r ON r.id = rs.draft_id
        ORDER BY r.chapter_number DESC
        LIMIT ?
      )
      ORDER BY d.chapter_number ASC, s.id ASC
    `).all(limit) as DraftEditChapterStatRow[]
  }
}
