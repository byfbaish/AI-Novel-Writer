import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { countDraftUnits } from '../../../src/shared/draft-units'
import { knowledgeFactKey } from '../../../src/shared/knowledge-state'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { FinalizationRepository } from '../finalization-repository'
import { invalidateContinuityProjectionFrom, SummaryRepository } from '../summary-repository'
import {
  deleteKnowledgeState,
  hasKnowledgeSchema,
  listFactCandidates,
  listKnowledgeStates,
  upsertKnowledgeState,
} from '../knowledge-state-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * P1-1 期 3 信息流仓储（M16）。
 *
 * 这一组守的是五条纪律：
 * 1. **缺表降级成 `[]`**，不抛（M16 之前的库照常能打开项目）；
 * 2. **同角色同 key 就地拒**、不同角色同 key 允许（`UNIQUE(character_id, fact_key)` 的语义）；
 * 3. **`learned_chapter < fact_chapter` 被拒**（不得先于事实存在就知道）；
 * 4. **`refState` 三态**各一条：`valid` / `stale` / `unverifiable`；
 * 5. **显示名来自 JOIN**（表里没有名字列），且可空列存的是 NULL 不是空串。
 */
const PROJECT_CACHE = path.resolve('.runtime/.cache/p1-1-knowledge-tests')
let projectRoot = ''

const FACT_QUOTE = '灵根检测结果被人改过'

function projectionGeneration(): number {
  return (getProjectDb()!.prepare(
    "SELECT generation FROM continuity_projection_meta WHERE id = 'main'",
  ).get() as { generation: number }).generation
}

/** 造一章**定稿且投影为 current** 的正文，并写入若干条事实（引文由调用方给）。 */
function finalizeChapter(chapterNumber: number, title: string, content: string, evidences: readonly string[]): number {
  const db = getProjectDb()!
  const contentId = Number(db.prepare('INSERT INTO contents(body) VALUES(?)').run(content).lastInsertRowid)
  const draftId = Number(db.prepare(
    "INSERT INTO drafts(chapter_number,version,status,content_id,word_count) VALUES(?,1,'draft',?,?)",
  ).run(chapterNumber, contentId, countDraftUnits(content)).lastInsertRowid)
  const finalizationId = `finalization-${chapterNumber}`
  const contentHash = createHash('sha256').update(content).digest('hex')
  FinalizationRepository.commit({
    draftId, finalizationId, chapterNumber, chapterTitle: title, content, contentHash, contentRevision: 1,
    targetFileName: `第${chapterNumber}章.txt`,
  })
  SummaryRepository.saveFinalizedContinuity({
    draftId, chapterNumber, chapterNotes: `第${chapterNumber}章情节要点`, projectionGeneration: projectionGeneration(),
    source: { draftId, finalizationId, chapterNumber, contentHash },
    // entities 留空：本组测的是引用判失效，不是身份投影（那是另一条用例的事）。
    facts: evidences.map(evidence => ({
      category: 'plot' as const, entities: [], statement: `要点：${evidence}。`,
      sourceChapter: chapterNumber, evidence,
    })),
  })
  return draftId
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

describe('knowledge state repository', () => {
  it('M16 之前的库降级成空结果，不抛错（写入给可读原因）', async () => {
    const db = new Database(':memory:')
    try {
      db.pragma('foreign_keys=ON')
      db.transaction(() => initializeLegacyBaselineSchema(db))()
      expect(hasKnowledgeSchema(db)).toBe(false)
      expect(await listKnowledgeStates(db)).toEqual([])
      expect(await listFactCandidates(db)).toEqual([])
      expect(await upsertKnowledgeState(db, {
        characterId: 'character:x', factChapter: 1, factEvidence: '引文', learnedChapter: 2,
      })).toEqual({ success: false, error: 'KNOWLEDGE_SCHEMA_MISSING' })
      expect(deleteKnowledgeState(db, 'knowledge:x')).toEqual({ success: false, error: 'KNOWLEDGE_SCHEMA_MISSING' })
    } finally { db.close() }
  })

  it('新建后按 id 回读：显示名来自 JOIN，可空列是 NULL 不是空串', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    const result = await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })
    expect(result.success).toBe(true)

    const [entry] = await listKnowledgeStates(db)
    expect(entry).toMatchObject({
      knowledgeId: result.knowledgeId,
      characterId: 'character:guchangfeng',
      // 表里不存名字：这个名字只能是 JOIN 出来的。
      characterName: '顾长风',
      factChapter: 1,
      factEvidence: FACT_QUOTE,
      learnedChapter: 2,
      // 关系出处没填 ⇒ 读回来是空串，库里存的是 NULL。
      evidence: '',
      source: 'author',
      refState: 'valid',
    })
    // 键由主进程算：`kf:` + 16 hex，与共享层同一函数。
    expect(entry!.factKey).toBe(await knowledgeFactKey(1, FACT_QUOTE))
    expect(entry!.factEvidenceHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(db.prepare('SELECT evidence FROM knowledge_states WHERE knowledge_id=?').pluck().get(entry!.knowledgeId))
      .toBeNull()
    // 表里没有名字列：显示名只可能来自 JOIN。
    const columns = (db.prepare('PRAGMA table_info(knowledge_states)').all() as Array<{ name: string }>).map(column => column.name)
    expect(columns).not.toContain('character_name')
  })

  it('同角色同 key 就地拒绝；不同角色同 key 允许（UNIQUE 的语义是「人 + 事实」）', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    expect((await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })).success).toBe(true)
    // 同一角色、同一事实、只是空白不同 ⇒ 归一化后同一个 key ⇒ 拒。
    expect(await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: `  ${FACT_QUOTE}  `, learnedChapter: 3,
    })).toEqual({ success: false, error: 'KNOWLEDGE_DUPLICATED' })
    // 换一个角色，同一条事实照常允许。
    expect((await upsertKnowledgeState(db, {
      characterId: 'character:xiaozheng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 3,
    })).success).toBe(true)
    expect(await listKnowledgeStates(db)).toHaveLength(2)
  })

  it('learned_chapter < fact_chapter 被拒（不得先于事实存在就知道）', async () => {
    const db = getProjectDb()!
    finalizeChapter(3, '检测', `第三章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    // 仓储先给可读原因
    expect(await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 3, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })).toEqual({ success: false, error: 'KNOWLEDGE_INVALID:learnedChapter' })
    // 表上的 CHECK 是最后一道闸：绕过仓储也写不进去。
    expect(() => db.prepare(`INSERT INTO knowledge_states
      (knowledge_id,character_id,fact_chapter,fact_evidence,fact_evidence_hash,fact_key,learned_chapter,source)
      VALUES('k:bad','character:guchangfeng',3,'引文','h','kf:0000000000000000',2,'author')`).run()).toThrow()
    expect(await listKnowledgeStates(db)).toEqual([])
  })

  it('refState 三态：current 且 key 在 ⇒ valid；current 但 key 不在 ⇒ stale；没有 current 投影 ⇒ unverifiable', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })
    // 该章索引在、但没有这条引文 ⇒ 可能被重抽/改稿
    await upsertKnowledgeState(db, {
      characterId: 'character:xiaozheng', factChapter: 1, factEvidence: '这条引文不在索引里', learnedChapter: 2,
    })
    // 第 5 章根本没有定稿投影 ⇒ 读不到，不能断定
    await upsertKnowledgeState(db, {
      characterId: 'character:xiaozheng', factChapter: 5, factEvidence: '第五章的某句话', learnedChapter: 6,
    })

    const byCharacter = Object.fromEntries(
      (await listKnowledgeStates(db)).map(entry => [`${entry.characterName}:${entry.factChapter}`, entry.refState]),
    )
    expect(byCharacter).toEqual({
      '顾长风:1': 'valid',
      '小郑:1': 'stale',
      '小郑:5': 'unverifiable',
    })
  })

  it('投影被作废后同一行从 valid 变 unverifiable（不自动改键、不自动删行）', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    const created = await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })
    const before = (await listKnowledgeStates(db))[0]!
    expect(before.refState).toBe('valid')

    invalidateContinuityProjectionFrom(db, 1)
    const after = (await listKnowledgeStates(db))[0]!
    expect(after.refState).toBe('unverifiable')
    // 引用本身一字未动：判失效不改键、不删行。
    expect(after.knowledgeId).toBe(created.knowledgeId)
    expect(after.factKey).toBe(before.factKey)
    expect(after.factEvidence).toBe(FACT_QUOTE)
  })

  it('改已有行：同 id 改得知章可行；改成别人的 key 仍被拒', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。第一章末：他又想起旧事。`, [FACT_QUOTE, '他又想起旧事'])
    const first = await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })
    const second = await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: '他又想起旧事', learnedChapter: 3,
    })
    expect(second.success).toBe(true)
    // 同一条登记改得知章：允许（key 没变）
    expect((await upsertKnowledgeState(db, {
      knowledgeId: first.knowledgeId, characterId: 'character:guchangfeng',
      factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 4,
    })).success).toBe(true)
    // 把第一条改成指向第二条事实 ⇒ 会与第二条撞 key ⇒ 拒（否则悄悄合并两条登记）
    expect(await upsertKnowledgeState(db, {
      knowledgeId: first.knowledgeId, characterId: 'character:guchangfeng',
      factChapter: 1, factEvidence: '他又想起旧事', learnedChapter: 4,
    })).toEqual({ success: false, error: 'KNOWLEDGE_DUPLICATED' })
  })

  it('删除是真删；删不存在的给明确原因；角色不在表里时拒绝写入', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    const created = await upsertKnowledgeState(db, {
      characterId: 'character:guchangfeng', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })
    expect(deleteKnowledgeState(db, created.knowledgeId!)).toEqual({ success: true })
    expect(deleteKnowledgeState(db, created.knowledgeId!)).toEqual({ success: false, error: 'KNOWLEDGE_NOT_FOUND' })
    expect(await listKnowledgeStates(db)).toEqual([])
    // 外键目标不存在：给可读错误，不是裸 SQLite 异常
    expect(await upsertKnowledgeState(db, {
      characterId: 'character:ghost', factChapter: 1, factEvidence: FACT_QUOTE, learnedChapter: 2,
    })).toEqual({ success: false, error: 'KNOWLEDGE_CHARACTER_NOT_FOUND' })
  })

  it('事实候选只来自 current 投影，且键与面板/仓储同一套算法', async () => {
    const db = getProjectDb()!
    finalizeChapter(1, '检测', `第一章正文：${FACT_QUOTE}。`, [FACT_QUOTE])
    const candidates = await listFactCandidates(db)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      chapterNumber: 1,
      factEvidence: FACT_QUOTE,
      statement: `要点：${FACT_QUOTE}。`,
      category: 'plot',
    })
    expect(candidates[0]!.factKey).toBe(await knowledgeFactKey(1, FACT_QUOTE))

    // 投影作废后候选消失：拿它当引用目标等于让作者登记一条查不到出处的引用。
    invalidateContinuityProjectionFrom(db, 1)
    expect(await listFactCandidates(db)).toEqual([])
  })
})
