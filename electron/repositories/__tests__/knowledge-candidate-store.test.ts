import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { countDraftUnits } from '../../../src/shared/draft-units'
import type { KnowledgeCandidate } from '../../../src/shared/knowledge-candidate'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { FinalizationRepository } from '../finalization-repository'
import { SummaryRepository } from '../summary-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * P20-3 章末知情候选的宿体（M22）。
 *
 * 这一组守的是「候选只是建议」这件事在**存储层**的四个后果：
 * 1. **覆盖不合并** —— 同章重跑不许越堆越多（否则重试一次就多一批）；
 * 2. **没有快照行就拒绝** —— 绝不 INSERT 占位，那会造出「有候选、没有事实」的投影；
 * 3. **不动 `projection_generation`** —— 候选不是连续性投影的一部分，改了会让改稿连锁误判；
 * 4. **失效可见而不是消失** —— 改稿后旧候选标 `stale` / `orphaned`，作者才知道「这条曾提议过」。
 *
 * 外加一条与全项目同口径的降级纪律：M22 之前的库读出来是 `[]`、写入给可读原因，不崩。
 */
const PROJECT_CACHE = path.resolve('.runtime/.cache/p20-3-knowledge-candidate-tests')
let projectRoot = ''

const QUOTE = '灵根检测结果被人改过'

function projectionGeneration(): number {
  return (getProjectDb()!.prepare(
    "SELECT generation FROM continuity_projection_meta WHERE id = 'main'",
  ).get() as { generation: number }).generation
}

/** 造一章定稿且投影为 `current` 的正文，返回 draftId。`evidences` 决定这批事实。 */
function finalizeChapter(chapterNumber: number, content: string, evidences: readonly string[]): number {
  const db = getProjectDb()!
  const contentId = Number(db.prepare('INSERT INTO contents(body) VALUES(?)').run(content).lastInsertRowid)
  // 同一章可以有多个版本（UNIQUE(chapter_number, version)），重定稿就是 +1。
  const version = (db.prepare('SELECT COALESCE(MAX(version),0) FROM drafts WHERE chapter_number=?')
    .pluck().get(chapterNumber) as number) + 1
  const draftId = Number(db.prepare(
    "INSERT INTO drafts(chapter_number,version,status,content_id,word_count) VALUES(?,?,'draft',?,?)",
  ).run(chapterNumber, version, contentId, countDraftUnits(content)).lastInsertRowid)
  const finalizationId = `finalization-${chapterNumber}-${draftId}`
  const contentHash = createHash('sha256').update(content).digest('hex')
  FinalizationRepository.commit({
    draftId, finalizationId, chapterNumber, chapterTitle: `第${chapterNumber}章`, content, contentHash, contentRevision: 1,
    targetFileName: `第${chapterNumber}章.txt`,
  })
  SummaryRepository.saveFinalizedContinuity({
    draftId, chapterNumber, chapterNotes: `第${chapterNumber}章情节要点`, projectionGeneration: projectionGeneration(),
    source: { draftId, finalizationId, chapterNumber, contentHash },
    facts: evidences.map(evidence => ({
      category: 'plot' as const, entities: [], statement: `要点：${evidence}。`,
      sourceChapter: chapterNumber, evidence,
    })),
  })
  return draftId
}

function candidate(overrides: Partial<KnowledgeCandidate> = {}): KnowledgeCandidate {
  return {
    factChapter: 1,
    factEvidence: QUOTE,
    statement: '检测结果被人改过。',
    characterId: 'character:guchangfeng',
    characterName: '顾长风',
    learnedChapter: 1,
    ...overrides,
  }
}

function addCharacter(characterId: string, name: string): void {
  getProjectDb()!.prepare("INSERT INTO characters (character_id,name,role) VALUES (?,?,'supporting')").run(characterId, name)
}

beforeEach(() => {
  fs.mkdirSync(PROJECT_CACHE, { recursive: true })
  projectRoot = fs.mkdtempSync(path.join(PROJECT_CACHE, 'case-'))
  openCanonicalProjectFixture(projectRoot)
  addCharacter('character:guchangfeng', '顾长风')
  addCharacter('character:xiaozheng', '小郑')
})

afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('knowledge candidate store (M22)', () => {
  it('M22 之前的库：读降级成空数组，写入给可读原因（不假装写了）', () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      expect(SummaryRepository.readKnowledgeCandidates(1, db)).toEqual([])
      expect(SummaryRepository.listKnowledgeCandidateViews(db)).toEqual([])
      expect(() => SummaryRepository.saveKnowledgeCandidates({ draftId: 1, candidates: [candidate()] }, db))
        .toThrow('KNOWLEDGE_CANDIDATE_SCHEMA_MISSING')
    } finally { db.close() }
  })

  it('没有快照行就拒绝：绝不 INSERT 一行只有候选的占位', () => {
    const db = getProjectDb()!
    const before = db.prepare('SELECT COUNT(*) FROM summary_snapshots').pluck().get() as number
    expect(() => SummaryRepository.saveKnowledgeCandidates({ draftId: 999, candidates: [candidate()] }, db))
      .toThrow('KNOWLEDGE_CANDIDATE_SNAPSHOT_MISSING')
    expect(db.prepare('SELECT COUNT(*) FROM summary_snapshots').pluck().get()).toBe(before)
  })

  it('同章重跑覆盖而不是合并：条数只由最近一次决定', () => {
    const db = getProjectDb()!
    const draftId = finalizeChapter(1, `第一章正文：${QUOTE}。`, [QUOTE])
    SummaryRepository.saveKnowledgeCandidates({
      draftId, candidates: [candidate(), candidate({ characterId: 'character:xiaozheng', characterName: '小郑' })],
    }, db)
    expect(SummaryRepository.readKnowledgeCandidates(draftId, db)).toHaveLength(2)

    // 重跑给出更少、更准的一批。
    SummaryRepository.saveKnowledgeCandidates({ draftId, candidates: [candidate()] }, db)
    const after = SummaryRepository.readKnowledgeCandidates(draftId, db)
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ characterId: 'character:guchangfeng', factEvidence: QUOTE })
  })

  it('写候选不推进 projection_generation（候选不是投影的一部分）', () => {
    const db = getProjectDb()!
    const draftId = finalizeChapter(1, `第一章正文：${QUOTE}。`, [QUOTE])
    const generation = projectionGeneration()
    SummaryRepository.saveKnowledgeCandidates({ draftId, candidates: [candidate()] }, db)
    expect(projectionGeneration()).toBe(generation)
  })

  it('事实还在 ⇒ 视图标 valid，并带上该事实的分类', () => {
    const db = getProjectDb()!
    const draftId = finalizeChapter(1, `第一章正文：${QUOTE}。`, [QUOTE])
    SummaryRepository.saveKnowledgeCandidates({ draftId, candidates: [candidate()] }, db)

    const views = SummaryRepository.listKnowledgeCandidateViews(db)
    expect(views).toHaveLength(1)
    expect(views[0]).toMatchObject({
      characterId: 'character:guchangfeng', characterName: '顾长风',
      factChapter: 1, factEvidence: QUOTE, learnedChapter: 1,
      refState: 'valid', category: 'plot',
    })
  })

  it('改稿重定稿 ⇒ 旧候选标 stale 且仍在列表里（不自动删）', () => {
    const db = getProjectDb()!
    const firstDraft = finalizeChapter(1, `第一章正文：${QUOTE}。`, [QUOTE])
    SummaryRepository.saveKnowledgeCandidates({ draftId: firstDraft, candidates: [candidate()] }, db)

    // 重写这一章：旧引文不再存在，投影换成新的。
    const secondDraft = finalizeChapter(1, '第一章正文：他换了个说法，检测结果其实没问题。', ['他换了个说法'])
    expect(secondDraft).not.toBe(firstDraft)

    const views = SummaryRepository.listKnowledgeCandidateViews(db)
    expect(views).toHaveLength(1)
    expect(views[0]!.refState).toBe('stale')
    // 不自动删：作者要能看到「这条曾提议过」。
    expect(SummaryRepository.readKnowledgeCandidates(firstDraft, db)).toHaveLength(1)
  })

  it('坏数据（手工改库 / 旧格式）整列降级成空数组，登记页照常打开', () => {
    const db = getProjectDb()!
    const draftId = finalizeChapter(1, `第一章正文：${QUOTE}。`, [QUOTE])
    for (const broken of ['{', '"not-an-array"', '[null,{"factEvidence":"缺字段"}]', '']) {
      db.prepare('UPDATE summary_snapshots SET knowledge_candidates=? WHERE draft_id=?').run(broken, draftId)
      expect(SummaryRepository.readKnowledgeCandidates(draftId, db)).toEqual([])
      expect(SummaryRepository.listKnowledgeCandidateViews(db)).toEqual([])
    }
  })

  it('候选与作者登记互不干涉：采纳只是另写 knowledge_states，候选自己不会消失', () => {
    const db = getProjectDb()!
    const draftId = finalizeChapter(1, `第一章正文：${QUOTE}。`, [QUOTE])
    SummaryRepository.saveKnowledgeCandidates({ draftId, candidates: [candidate()] }, db)
    // 模拟作者已采纳（知情状态由另一张表承载）。
    db.prepare(`INSERT INTO knowledge_states (character_id,fact_chapter,fact_evidence,fact_evidence_hash,fact_key,learned_chapter,source)
      VALUES ('character:guchangfeng',1,?,'deadbeef','kf:0000000000000000',1,'author')`).run(QUOTE)
    expect(SummaryRepository.listKnowledgeCandidateViews(db)).toHaveLength(1)
  })
})
