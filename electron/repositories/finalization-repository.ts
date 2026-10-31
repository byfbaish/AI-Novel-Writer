import { createHash } from 'node:crypto'
import { getCurrentProjectPath, getProjectDb } from '../database'
import { readPortableRuntimeFreeze } from '../services/portable-runtime-freeze'
import { countDraftUnits } from '../../src/shared/draft-units'
import { BOOK_SCOPE } from '../../src/shared/upstream-revisions'
import { M28_DRAFT_OUTLINE_REV_UNKNOWN } from '../migrations/m28-draft-outline-rev'
import { freezeFinalizedCharacterSnapshot, invalidateContinuityProjectionFrom } from './summary-repository'
import { hasColumn } from './derived-source-ref'
import { UpstreamRevisionRepository } from './upstream-revision-repository'

export type PublicationStatus = 'pending' | 'published'

export interface FinalizationCommitInput {
  finalizationId: string
  draftId: number
  chapterNumber: number
  chapterTitle: string
  content: string
  contentHash: string
  contentRevision: number
  targetFileName: string
}

export interface FinalizationRecord {
  finalizationId: string
  draftId: number
  chapterNumber: number
  chapterTitle: string
  /** outbox 内冻结的不可变正文；发布和重试绝不回读 contents.body。 */
  contentSnapshot: string
  contentHash: string
  contentRevision: number
  targetFileName: string
  knowledgeDocumentId: string
  publicationStatus: PublicationStatus
  lastError: string
  publishedAt: string | null
}

interface FinalizationRow {
  finalization_id: string
  draft_id: number
  chapter_number: number
  chapter_title: string
  content_hash: string
  content_revision: number
  target_file_name: string
  knowledge_document_id: string
  publication_status: PublicationStatus
  last_error: string
  published_at: string | null
  content_snapshot: string
}

export interface FinalizedDraftExportSnapshot {
  draftId: number
  chapterNumber: number
  version: number
  title: string
  content: string
  finalizationId: string | null
  contentHash: string
}

export type FinalizedDraftExportAuthorityReceipt = ReadonlyArray<Readonly<{
  draftId: number
  chapterNumber: number
  version: number
  finalizationId: string | null
  contentHash: string
}>>

interface FinalizedDraftExportRow {
  draft_id: number
  chapter_number: number
  version: number
  body: string
  finalization_id: string | null
  outbox_chapter_number: number | null
  chapter_title: string | null
  content_hash: string | null
  content_snapshot: string | null
}

interface AuthoritativeFinalizedDraftExport {
  snapshot: FinalizedDraftExportSnapshot
  receipt: FinalizedDraftExportAuthorityReceipt[number]
}

function rowToRecord(row: FinalizationRow): FinalizationRecord {
  return {
    finalizationId: row.finalization_id,
    draftId: row.draft_id,
    chapterNumber: row.chapter_number,
    chapterTitle: row.chapter_title,
    contentSnapshot: row.content_snapshot ?? '',
    contentHash: row.content_hash,
    contentRevision: row.content_revision,
    targetFileName: row.target_file_name,
    knowledgeDocumentId: row.knowledge_document_id ?? '',
    publicationStatus: row.publication_status,
    lastError: row.last_error ?? '',
    publishedAt: row.published_at ?? null,
  }
}

function requireDatabase() {
  const db = getProjectDb()
  if (!db) throw new Error('项目数据库未打开')
  return db
}

/** 与 `derived-source-ref.ts` 里那份同名类型同源（`better-sqlite3` 的库句柄）。 */
type ProjectDatabase = ReturnType<typeof requireDatabase>

function hasSameFinalizationInput(
  existing: FinalizationRow,
  input: FinalizationCommitInput,
): boolean {
  return existing.draft_id === input.draftId
    && existing.chapter_number === input.chapterNumber
    && existing.chapter_title === input.chapterTitle
    && existing.content_hash === input.contentHash
    && existing.content_revision === input.contentRevision
    && existing.content_snapshot === input.content
}

function selectAuthoritativeExportRows(
  rows: readonly FinalizedDraftExportRow[],
): AuthoritativeFinalizedDraftExport[] {
  const selected: AuthoritativeFinalizedDraftExport[] = []
  const selectedVersions = new Map<number, number>()
  for (const row of rows) {
    const selectedVersion = selectedVersions.get(row.chapter_number)
    if (selectedVersion !== undefined) {
      if (selectedVersion === row.version) {
        throw new Error(`第 ${row.chapter_number} 章存在重复定稿版本，无法确定导出正文`)
      }
      continue
    }
    if (
      !Number.isSafeInteger(row.draft_id) || row.draft_id < 1
      || !Number.isSafeInteger(row.chapter_number) || row.chapter_number < 1
      || !Number.isSafeInteger(row.version) || row.version < 1
    ) throw new Error('定稿导出快照身份无效')
    if (typeof row.body !== 'string' || row.body.trim().length === 0) {
      throw new Error(`第 ${row.chapter_number} 章定稿正文为空`)
    }

    const contentHash = createHash('sha256').update(row.body, 'utf8').digest('hex')
    if (row.finalization_id !== null) {
      if (typeof row.finalization_id !== 'string' || row.finalization_id.trim().length === 0) {
        throw new Error('定稿导出快照身份无效')
      }
      if (row.outbox_chapter_number !== row.chapter_number) {
        throw new Error('定稿导出快照身份不一致')
      }
      if (row.content_snapshot !== row.body) {
        throw new Error('定稿导出快照正文不一致')
      }
      if (row.content_hash !== contentHash) {
        throw new Error('定稿导出快照摘要不一致')
      }
    }

    selectedVersions.set(row.chapter_number, row.version)
    const authority = {
      draftId: row.draft_id,
      chapterNumber: row.chapter_number,
      version: row.version,
      finalizationId: row.finalization_id,
      contentHash,
    }
    selected.push({
      receipt: authority,
      snapshot: {
        ...authority,
        title: row.chapter_title?.trim() ?? '',
        content: row.body,
      },
    })
  }
  return selected
}

function readAuthoritativeExportRows(): AuthoritativeFinalizedDraftExport[] {
  const db = requireDatabase()
  return db.transaction(() => selectAuthoritativeExportRows(db.prepare(`
    SELECT drafts.id AS draft_id, drafts.chapter_number, drafts.version,
           contents.body, finalization_outbox.finalization_id,
           finalization_outbox.chapter_number AS outbox_chapter_number,
           finalization_outbox.chapter_title, finalization_outbox.content_hash,
           finalization_outbox.content_snapshot
    FROM drafts
    JOIN contents ON contents.id = drafts.content_id
    LEFT JOIN finalization_outbox ON finalization_outbox.draft_id = drafts.id
    WHERE drafts.status = 'finalized'
    ORDER BY drafts.chapter_number ASC, drafts.version DESC, drafts.id DESC
  `).all() as FinalizedDraftExportRow[]))()
}

/**
 * 定稿的数据库事实源。正文、字数、定稿状态与发布 outbox 必须由同一个 SQLite
 * transaction 共同提交；任何一个 statement 失败都会回滚其余变化。
 */
export class FinalizationRepository {
  /** One transactionally frozen, highest-version finalized fact per chapter. */
  static listAuthoritativeForExport(): FinalizedDraftExportSnapshot[] {
    return readAuthoritativeExportRows().map(({ snapshot }) => snapshot)
  }

  /**
   * 已定稿章节的「定稿时大纲版本」（M28 / S6）。
   *
   * 每章只取**最高版本**那一行 —— 与 `listAuthoritativeForExport` 同一口径：
   * 一章可能有多条 `finalized` 行（旧版本在重新定稿时不会被回退），
   * 把它们逐条报出来会让清单里出现「第 8 章」好几遍。
   *
   * 列不存在（v28 之前的库）时**照样返回章号、版本记 `-1`**：直接返回空数组会让
   * 「已定稿章节」这一组凭空消失，而作者会据此以为「这一刀不影响正文」。
   * 报「N 章判断不了」是保守方向，报「0 章受影响」是反向。
   */
  static readFinalizedOutlineRevs(
    database?: ProjectDatabase | null,
  ): Array<{ chapterNumber: number; outlineRev: number; draftId: number }> {
    const db = database ?? getProjectDb()
    if (!db) return []
    const revColumn = hasColumn(db, 'drafts', 'outline_rev')
      ? 'outline_rev' : `${M28_DRAFT_OUTLINE_REV_UNKNOWN} AS outline_rev`
    // `id` 一并取是给清点页跳转用的（`ai-novel://draft/<id>`），**不是判据**：
    // 多一次回查（按章号再问一次「哪条是定稿」）会让「清单里看到的章」与
    // 「跳过去打开的章」在重新定稿的一瞬间对不上。
    const rows = db.prepare(`
      SELECT id, chapter_number, ${revColumn}
      FROM drafts
      WHERE status = 'finalized'
      ORDER BY chapter_number ASC, version DESC, id DESC
    `).all() as Array<{ id: number; chapter_number: number; outline_rev: number }>
    const seen = new Set<number>()
    const result: Array<{ chapterNumber: number; outlineRev: number; draftId: number }> = []
    for (const row of rows) {
      if (seen.has(row.chapter_number)) continue
      seen.add(row.chapter_number)
      result.push({ chapterNumber: row.chapter_number, outlineRev: row.outline_rev, draftId: row.id })
    }
    return result
  }

  static matchesAuthoritativeExportReceipt(receipt: FinalizedDraftExportAuthorityReceipt): boolean {
    if (!Array.isArray(receipt)) return false
    const seenChapters = new Set<number>()
    for (const item of receipt) {
      if (
        !item || typeof item !== 'object'
        || !Number.isSafeInteger(item.draftId) || item.draftId < 1
        || !Number.isSafeInteger(item.chapterNumber) || item.chapterNumber < 1
        || !Number.isSafeInteger(item.version) || item.version < 1
        || !(item.finalizationId === null
          || (typeof item.finalizationId === 'string' && item.finalizationId.trim().length > 0))
        || typeof item.contentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(item.contentHash)
        || seenChapters.has(item.chapterNumber)
      ) return false
      seenChapters.add(item.chapterNumber)
    }

    try {
      const current = readAuthoritativeExportRows().map(({ receipt: item }) => item)
      return current.length === receipt.length && current.every((item, index) => (
        item.draftId === receipt[index]?.draftId
        && item.chapterNumber === receipt[index]?.chapterNumber
        && item.version === receipt[index]?.version
        && item.finalizationId === receipt[index]?.finalizationId
        && item.contentHash === receipt[index]?.contentHash
      ))
    } catch {
      return false
    }
  }

  static commit(input: FinalizationCommitInput): FinalizationRecord {
    const db = requireDatabase()
    const transaction = db.transaction(() => {
      const existing = db.prepare(`
        SELECT * FROM finalization_outbox WHERE draft_id = ?
      `).get(input.draftId) as FinalizationRow | undefined
      if (existing) {
        // renderer 可能在主进程已提交而响应丢失后重发同一冻结快照。此时新生成的
        // finalizationId/碰撞候选文件名都不能破坏幂等性，必须返回原提交。
        if (hasSameFinalizationInput(existing, input)) {
          return rowToRecord(existing)
        }
        throw new Error('该草稿已有不可替换的定稿提交')
      }

      const draft = db.prepare(`
        SELECT id, chapter_number, status, content_id FROM drafts WHERE id = ?
      `).get(input.draftId) as {
        id: number
        chapter_number: number
        status: string
        content_id: number
      } | undefined
      if (!draft) throw new Error(`草稿不存在：${input.draftId}`)
      if (draft.chapter_number !== input.chapterNumber) {
        throw new Error('草稿与定稿章节不匹配')
      }
      if (draft.status === 'finalized') {
        throw new Error('草稿已定稿但缺少可恢复发布记录')
      }

      const replacesFinalized = db.prepare(`
        SELECT 1 FROM drafts
        WHERE chapter_number = ? AND status = 'finalized' AND id <> ?
        LIMIT 1
      `).get(input.chapterNumber, input.draftId)
      if (replacesFinalized) invalidateContinuityProjectionFrom(db, input.chapterNumber)

      db.prepare('UPDATE contents SET body = ? WHERE id = ?')
        .run(input.content, draft.content_id)
      // ── M28（S6）：定稿这一刻的大纲版本 ──────────────────────────────
      //
      // **必须在同一个事务里读**：跨事务读会让「大纲刚被改过」这件事有窗口 ——
      // 正文已经按旧大纲写完，读到的却是新版本号，于是这一章永远判 `valid`，
      // 而它其实是用过期依据写的。这是仅有的一次能记准的机会，过去就补不回来。
      //
      // 读不到（v28 之前的库 / 没生成过大纲）⇒ `-1`（显式的「没有记录」），
      // **不是 0**：0 已被 `HYPOTHETICAL_NEXT_REV` 占用表示「假想下一版」。
      const outlineRev = hasColumn(db, 'drafts', 'outline_rev')
        ? UpstreamRevisionRepository.readRev('outline', BOOK_SCOPE, db) ?? M28_DRAFT_OUTLINE_REV_UNKNOWN
        : null
      if (outlineRev === null) {
        db.prepare(`
          UPDATE drafts
          SET status = 'finalized', word_count = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(countDraftUnits(input.content), input.draftId)
      } else {
        db.prepare(`
          UPDATE drafts
          SET status = 'finalized', word_count = ?, outline_rev = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(countDraftUnits(input.content), outlineRev, input.draftId)
      }
      db.prepare(`
        INSERT INTO finalization_outbox (
          finalization_id, draft_id, chapter_number, chapter_title,
          content_hash, content_revision, content_snapshot, target_file_name, publication_status,
          last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '')
      `).run(
        input.finalizationId,
        input.draftId,
        input.chapterNumber,
        input.chapterTitle,
        input.contentHash,
        input.contentRevision,
        input.content,
        input.targetFileName,
      )
      freezeFinalizedCharacterSnapshot(db, { draftId: input.draftId, finalizationId: input.finalizationId,
        chapterNumber: input.chapterNumber, contentHash: input.contentHash })

      return {
        finalizationId: input.finalizationId,
        draftId: input.draftId,
        chapterNumber: input.chapterNumber,
        chapterTitle: input.chapterTitle,
        contentSnapshot: input.content,
        contentHash: input.contentHash,
        contentRevision: input.contentRevision,
        targetFileName: input.targetFileName,
        knowledgeDocumentId: '',
        publicationStatus: 'pending' as const,
        lastError: '',
        publishedAt: null,
      }
    })
    return transaction()
  }

  static get(finalizationId: string): FinalizationRecord | null {
    const db = requireDatabase()
    const row = db.prepare(`
      SELECT * FROM finalization_outbox WHERE finalization_id = ?
    `).get(finalizationId) as FinalizationRow | undefined
    return row ? rowToRecord(row) : null
  }

  static getByDraftId(draftId: number): FinalizationRecord | null {
    const db = requireDatabase()
    const row = db.prepare(`
      SELECT * FROM finalization_outbox WHERE draft_id = ?
    `).get(draftId) as FinalizationRow | undefined
    return row ? rowToRecord(row) : null
  }

  static linkKnowledgeDocument(draftId: number, documentId: string): FinalizationRecord {
    const normalizedDocumentId = documentId.trim()
    if (!normalizedDocumentId) throw new Error('知识库文档身份不能为空')
    const db = requireDatabase()
    const existing = db.prepare(`
      SELECT finalization_id FROM finalization_outbox WHERE draft_id = ?
    `).get(draftId) as { finalization_id: string } | undefined
    if (!existing) throw new Error(`草稿缺少定稿提交：${draftId}`)
    readPortableRuntimeFreeze(getCurrentProjectPath()).assertMutable('finalization_outbox', existing.finalization_id)
    const result = db.prepare(`
      UPDATE finalization_outbox
      SET knowledge_document_id = ?, updated_at = datetime('now')
      WHERE draft_id = ? AND finalization_id = ?
    `).run(normalizedDocumentId, draftId, existing.finalization_id)
    if (result.changes !== 1) throw new Error(`草稿缺少定稿提交：${draftId}`)
    const record = FinalizationRepository.getByDraftId(draftId)
    if (!record) throw new Error(`草稿缺少定稿提交：${draftId}`)
    return record
  }

  static markPublicationPending(finalizationId: string, error: string): FinalizationRecord {
    const db = requireDatabase()
    const result = db.prepare(`
      UPDATE finalization_outbox
      SET publication_status = 'pending', last_error = ?, updated_at = datetime('now')
      WHERE finalization_id = ?
    `).run(error, finalizationId)
    if (result.changes !== 1) throw new Error(`定稿提交不存在：${finalizationId}`)
    const record = FinalizationRepository.get(finalizationId)
    if (!record) throw new Error(`定稿提交不存在：${finalizationId}`)
    return record
  }

  static markPublished(finalizationId: string): FinalizationRecord {
    const db = requireDatabase()
    const result = db.prepare(`
      UPDATE finalization_outbox
      SET publication_status = 'published', last_error = '',
          published_at = datetime('now'), updated_at = datetime('now')
      WHERE finalization_id = ?
    `).run(finalizationId)
    if (result.changes !== 1) throw new Error(`定稿提交不存在：${finalizationId}`)
    const record = FinalizationRepository.get(finalizationId)
    if (!record) throw new Error(`定稿提交不存在：${finalizationId}`)
    return record
  }
}
