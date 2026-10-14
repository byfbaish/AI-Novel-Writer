import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture as initProjectDatabase } from '../../../test/helpers/canonical-project-fixture'
import { searchKnowledge } from '../../knowledge-base'
import { BlueprintRepository } from '../blueprint-repository'
import { CharacterRepository } from '../character-repository'
import { DraftRepository } from '../draft-repository'
import { FinalizationRepository } from '../finalization-repository'
import { RecoveryCandidateRepository } from '../recovery-candidate-repository'
import { SummaryRepository } from '../summary-repository'

let projectRoot = ''

const source = {
  chapterNumber: 3,
  title: '失控列车',
  role: '发展',
  purpose: '揭示追踪者',
  keyEvents: normalizeKeyEvents('林岚发现列车没有司机'),
  characters: ['林岚'],
  suspenseHook: '隧道尽头出现第二辆列车',
  userGuidance: '保持封闭空间压迫感',
}

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-recovery-'))
  initProjectDatabase(projectRoot)
  BlueprintRepository.upsert({
    ...source,
    notes: '',
    notesUpdatedAt: '',
  })
})

function freezeCandidate(candidateId: string): void {
  fs.writeFileSync(path.join(projectRoot, '.ai-novel', 'portable-runtime-freeze.json'), JSON.stringify({
    version: 1, originProjectId: '11111111-1111-4111-8111-111111111111', snapshotGeneration: 'snapshot-1',
    nonReplayable: true, requiresRuntimeFreezeGuard: true, avatarReferenceProjections: [], records: [{
      projectionId: `history:recovery_candidates:${candidateId}`, table: 'recovery_candidates', recordId: candidateId,
      terminalState: 'pending', projection: {}, projectionHash: 'a'.repeat(64), excludedFields: [],
      nonReplayable: true, originalReceiptVerified: false,
    }],
  }), { mode: 0o600 })
}

afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(projectRoot, { recursive: true, force: true })
})

describe('RecoveryCandidateRepository project-local seam', () => {
  it('keeps imported pending history visible but refuses every old-state mutation', () => {
    const old = RecoveryCandidateRepository.record({ runId: 'old-run', stepId: 'generate-draft', projectId: 'project-recovery', chapterNumber: 3,
      chapterTitle: source.title, source, sourceDraft: null, visibleText: '历史恢复正文', failureCode: 'NETWORK_ERROR', failureReason: 'old' })
    freezeCandidate(old.candidateId)
    expect(RecoveryCandidateRepository.listPending()).toEqual([expect.objectContaining({ candidateId: old.candidateId })])
    expect(() => RecoveryCandidateRepository.updatePending(old.candidateId, '不应写入')).toThrow('PORTABLE_RUNTIME_FROZEN')
    expect(() => RecoveryCandidateRepository.resolve(old.candidateId, 'discarded')).toThrow('PORTABLE_RUNTIME_FROZEN')
    const fresh = RecoveryCandidateRepository.record({ runId: 'new-run', stepId: 'generate-draft', projectId: 'project-recovery', chapterNumber: 3,
      chapterTitle: source.title, source, sourceDraft: null, visibleText: '新恢复正文', failureCode: 'NETWORK_ERROR', failureReason: 'new' })
    expect(() => RecoveryCandidateRepository.resolve(fresh.candidateId, 'discarded')).not.toThrow()
    expect(RecoveryCandidateRepository.listPending().map(item => item.candidateId)).toEqual([old.candidateId])
  })

  it('persists only visible prose, survives reopen, and stays outside formal facts and search', async () => {
    const recorded = RecoveryCandidateRepository.record({
      runId: 'run-interrupted',
      stepId: 'generate-draft',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: null,
      visibleText: 'reasoning: private chain</think>林岚推开驾驶室的门。',
      failureCode: 'PROVIDER_REQUEST_FAILED',
      failureReason: 'connection reset',
    })

    closeProjectDatabase()
    initProjectDatabase(projectRoot)

    expect(RecoveryCandidateRepository.listPending()).toEqual([
      expect.objectContaining({
        candidateId: recorded.candidateId,
        runId: 'run-interrupted',
        stepId: 'generate-draft',
        projectId: 'project-recovery',
        chapterNumber: 3,
        chapterTitle: source.title,
        visibleText: '林岚推开驾驶室的门。',
        failureCode: 'PROVIDER_REQUEST_FAILED',
        failureReason: 'connection reset',
        status: 'pending',
        sourceCurrent: true,
        replacesCandidateId: null,
      }),
    ])

    expect(DraftRepository.listAll()).toEqual([])
    expect(FinalizationRepository.listAuthoritativeForExport()).toEqual([])
    expect(CharacterRepository.getAll()).toEqual([])
    expect(SummaryRepository.listFinalizedContinuityBefore(4)).toEqual([])
    await expect(searchKnowledge(
      '驾驶室',
      projectRoot,
      'openai',
      { baseUrl: '', apiKey: '' },
    )).resolves.toEqual([])
  })

  it('drops every prefix before an orphan thinking close tag', () => {
    const recorded = RecoveryCandidateRepository.record({
      runId: 'run-hidden-prefix',
      stepId: 'generate-draft',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: null,
      visibleText: 'Let me inspect the scene constraints first.</think>林岚推开驾驶室的门。',
      failureCode: 'PROVIDER_REQUEST_FAILED',
      failureReason: 'connection reset',
    })

    expect(recorded.visibleText).toBe('林岚推开驾驶室的门。')
  })

  it('updates a pending candidate durably without creating formal project facts', async () => {
    const recorded = RecoveryCandidateRepository.record({
      runId: 'run-editable',
      stepId: 'generate-draft',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: null,
      visibleText: '初始恢复正文',
      failureCode: 'PROVIDER_REQUEST_FAILED',
      failureReason: 'connection reset',
    })

    RecoveryCandidateRepository.updatePending(recorded.candidateId, '作者编辑后的恢复正文')
    closeProjectDatabase()
    initProjectDatabase(projectRoot)

    expect(RecoveryCandidateRepository.listPending()).toEqual([
      expect.objectContaining({
        candidateId: recorded.candidateId,
        visibleText: '作者编辑后的恢复正文',
        status: 'pending',
      }),
    ])
    expect(DraftRepository.listAll()).toEqual([])
    expect(FinalizationRepository.listAuthoritativeForExport()).toEqual([])
    expect(CharacterRepository.getAll()).toEqual([])
    expect(SummaryRepository.listFinalizedContinuityBefore(4)).toEqual([])
    await expect(searchKnowledge(
      '作者编辑后的恢复正文',
      projectRoot,
      'openai',
      { baseUrl: '', apiKey: '' },
    )).resolves.toEqual([])
  })

  it('marks a candidate stale when its frozen chapter source changes', () => {
    const recorded = RecoveryCandidateRepository.record({
      runId: 'run-stale',
      stepId: 'generate-draft',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: null,
      visibleText: '候选正文',
      failureCode: 'INCOMPLETE_LENGTH',
      failureReason: 'length',
    })
    BlueprintRepository.upsert({
      ...source,
      keyEvents: normalizeKeyEvents('作者已经修改关键事件'),
      notes: '',
      notesUpdatedAt: '',
    })

    expect(RecoveryCandidateRepository.listPending()[0]?.sourceCurrent).toBe(false)
    expect(() => RecoveryCandidateRepository.resolve(recorded.candidateId, 'continued'))
      .toThrow(/源章节已变化/u)
    expect(() => RecoveryCandidateRepository.resolve(recorded.candidateId, 'discarded'))
      .not.toThrow()
  })

  it('rejects update and continue after the generation-start draft changes', () => {
    const sourceDraftId = DraftRepository.create({
      chapterNumber: 3,
      source: 'write',
      content: '生成开始时的草稿',
      wordCount: 8,
    })
    const recorded = RecoveryCandidateRepository.record({
      runId: 'run-draft-stale',
      stepId: 'generate-draft',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: { id: sourceDraftId, version: 1 },
      visibleText: '候选正文',
      failureCode: 'INCOMPLETE_LENGTH',
      failureReason: 'length',
    })

    expect(recorded.sourceCurrent).toBe(true)
    DraftRepository.create({
      chapterNumber: 3,
      source: 'rewrite',
      content: '后来保存的新版本',
      wordCount: 8,
    })

    expect(RecoveryCandidateRepository.listPending()[0]?.sourceCurrent).toBe(false)
    expect(() => RecoveryCandidateRepository.updatePending(recorded.candidateId, '编辑后的候选'))
      .toThrow(/源章节已变化/u)
    expect(() => RecoveryCandidateRepository.resolve(recorded.candidateId, 'continued'))
      .toThrow(/源章节已变化/u)
  })

  it('keeps the original-to-replacement relation and resolves explicitly', () => {
    const original = RecoveryCandidateRepository.record({
      runId: 'run-rewrite',
      stepId: 'generate-draft',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: null,
      visibleText: '原始候选',
      failureCode: 'LENGTH_REPAIR_FAILED',
      failureReason: 'replacement failed',
    })
    const replacement = RecoveryCandidateRepository.record({
      runId: 'run-rewrite',
      stepId: 'length-repair',
      projectId: 'project-recovery',
      chapterNumber: 3,
      chapterTitle: source.title,
      source,
      sourceDraft: null,
      visibleText: '替代候选',
      failureCode: 'LENGTH_REPAIR_FAILED',
      failureReason: 'replacement failed',
      replacesCandidateId: original.candidateId,
    })

    expect(RecoveryCandidateRepository.listPending().map(candidate => ({
      candidateId: candidate.candidateId,
      replacesCandidateId: candidate.replacesCandidateId,
    }))).toEqual([
      { candidateId: original.candidateId, replacesCandidateId: null },
      { candidateId: replacement.candidateId, replacesCandidateId: original.candidateId },
    ])

    RecoveryCandidateRepository.resolve(original.candidateId, 'discarded')
    RecoveryCandidateRepository.resolve(replacement.candidateId, 'continued')

    expect(RecoveryCandidateRepository.listPending()).toEqual([])
  })
})

/**
 * ★ 升级兼容回归（keyEvents 自由文本 → 结构化数组）
 * `source_hash` 是对整份快照取 sha256：旧库按**自由文本**算，新代码按**数组**算 —— 若不管，
 * 升级后历史 pending 候选会被一律判 stale（全改造唯一可能造成用户可见行为变化的点）。
 * 这里手写 SQL 造出"升级前落库"的旧形态，验证旧候选仍能命中，且蓝图真被改写后照常判 stale。
 */
describe('RecoveryCandidateRepository legacy source_hash compatibility', () => {
  const legacyKeyEventsText = '林岚发现列车没有司机'
  const legacyCandidateId = 'legacy-hash-candidate'

  function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex')
  }

  /** 复刻改造前 `sourceSnapshot()` 的形状与字段顺序（keyEvents 为自由文本）。 */
  function legacySnapshot(keyEvents: string): string {
    return JSON.stringify({
      chapterNumber: source.chapterNumber,
      title: source.title,
      role: source.role,
      purpose: source.purpose,
      keyEvents,
      characters: [...source.characters],
      suspenseHook: source.suspenseHook ?? '',
      userGuidance: source.userGuidance ?? '',
    })
  }

  /** 把蓝图列与候选行都拨回"升级前落库"的形态。 */
  function seedLegacyPersistedState(persistedKeyEvents: string): void {
    const db = getProjectDb()
    if (!db) throw new Error('项目数据库未打开')
    db.prepare('UPDATE blueprints SET key_events = ? WHERE chapter_number = ?')
      .run(persistedKeyEvents, source.chapterNumber)
    const snapshot = legacySnapshot(legacyKeyEventsText)
    db.prepare(`
      INSERT INTO recovery_candidates (
        candidate_id, run_id, step_id, project_id, chapter_number, chapter_title,
        source_snapshot, source_hash, source_draft_id, source_draft_version,
        source_draft_identity_captured, visible_text, content_hash,
        failure_code, failure_reason, status, replaces_candidate_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1, ?, ?, ?, ?, 'pending', NULL)
    `).run(
      legacyCandidateId, 'legacy-run', 'generate-draft', 'project-recovery', source.chapterNumber, source.title,
      snapshot, sha256(snapshot), '旧候选正文', sha256('旧候选正文'),
      'PROVIDER_REQUEST_FAILED', 'connection reset',
    )
  }

  it('still treats a pre-upgrade candidate as current while the chapter keeps its legacy text', () => {
    seedLegacyPersistedState(legacyKeyEventsText)

    expect(RecoveryCandidateRepository.listPending()).toEqual([
      expect.objectContaining({ candidateId: legacyCandidateId, sourceCurrent: true }),
    ])
    expect(() => RecoveryCandidateRepository.resolve(legacyCandidateId, 'continued')).not.toThrow()
  })

  it('marks the pre-upgrade candidate stale once the chapter is genuinely rewritten', () => {
    seedLegacyPersistedState(JSON.stringify(
      normalizeKeyEvents('作者已经修改关键事件', { chapterNumber: source.chapterNumber }),
    ))

    expect(RecoveryCandidateRepository.listPending()[0]?.sourceCurrent).toBe(false)
    expect(() => RecoveryCandidateRepository.resolve(legacyCandidateId, 'continued'))
      .toThrow(/源章节已变化/u)
  })
})
