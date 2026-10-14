import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture as initProjectDatabase } from '../../../test/helpers/canonical-project-fixture'
import { ProjectCoreRepository } from '../../repositories/project-core-repository'
import { ImportRunRepository } from '../../repositories/import-run-repository'
import { BlueprintRepository } from '../../repositories/blueprint-repository'
import { proveCharacterProposal } from '../generation-character-proposal-proof'
import { GenerationRunRepository } from '../../repositories/generation-run-repository'
import { projectAccess } from '../project-access'

let root = ''
const content = 'reference'

const blueprint = {
  chapterNumber: 1,
  title: 'Chapter One',
  role: 'setup',
  purpose: 'Introduce the conflict',
  keyEvents: normalizeKeyEvents('The protagonist discovers a clue'),
  characters: ['Protagonist', 'Old Chen'],
  suspenseHook: 'Someone knocks at the door',
  userGuidance: '',
  notes: '',
  notesUpdatedAt: '',
}

/**
 * 走真实的落库路径：import 蓝图收据提交时同步冻结 character_sync_input，
 * 与大纲/蓝图命令产出的批次同构。返回同步操作 id 供 prove 使用。
 */
function commitBlueprintReceipt(): string {
  const batchId = `1-1-${createHash('sha256').update(content).digest('hex').slice(0, 8)}`
  const started = ImportRunRepository.startOrResume('receipt-run', 'renderer-a')
  getProjectDb()!.prepare(`
    UPDATE import_runs
    SET stage = 'blueprints', completed_batches_json = '{"knowledge":["1-1"],"global":["done"],"style":["done"]}'
    WHERE id = 'receipt-run'
  `).run()
  ImportRunRepository.prepareEffectReceipt({
    runId: 'receipt-run',
    stage: 'blueprints',
    batchId,
    effectKey: `blueprints:${batchId}`,
    kind: 'chapter-blueprint-range',
    payload: {
      mode: 'replace-range',
      operationId: 'import-blueprints-receipt-run-1-1',
      startChapter: 1,
      endChapter: 1,
      blueprints: [blueprint],
    },
  }, started.execution)
  ImportRunRepository.commitEffectReceipt('receipt-run', 'blueprints', batchId, started.execution)
  const operation = BlueprintRepository.getCommittedRangeOperation('import-blueprints-receipt-run-1-1')
  if (!operation) throw new Error('fixture missing commit operation')
  return operation.characterSyncOperation.operationId
}

function prove(operationId: string) {
  const db = getProjectDb()!
  const project = projectAccess.probeExistingProject(root)
  if (project.kind !== 'manifest') throw new Error('test project identity missing')
  return proveCharacterProposal(db, new GenerationRunRepository(() => db), project.projectId,
    { kind: 'directory', operationId }, true, () => {})
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-directory-proof-'))
  initProjectDatabase(root)
  ProjectCoreRepository.init('Directory Proof Test')
  ImportRunRepository.prepare({
    runId: 'receipt-run',
    purpose: 'reference',
    sourceFingerprint: 'a'.repeat(64),
    sourceDisplay: [{ displayName: 'book.txt', mediaType: 'text/plain', size: content.length }],
    locale: 'en-US',
    chapters: [{
      number: 1,
      title: 'One',
      content,
      contentFingerprint: createHash('sha256').update(content).digest('hex'),
      contentSize: Buffer.byteLength(content),
    }],
  })
}, 20_000)

afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(root, { recursive: true, force: true })
})

it('derives candidates from the frozen roster and approves while only cosmetic fields drifted', () => {
  const operationId = commitBlueprintReceipt()
  const proof = prove(operationId)
  const names = proof.items.map(item => item.fields.name).sort()
  // newCharacterCandidates 为空时 items 为空 —— 本夹具不声明候选人，只验证证明本身。
  expect(proof.items).toEqual([])
  expect(names).toEqual([])
  // 作者在确认前补写章指导 / 改标题钩子事件：候选是谁没有变，必须仍然可保存。
  getProjectDb()!.prepare("UPDATE blueprints SET user_guidance='前 300 字必须有冲突', title='第一章（改）', suspense_hook='新钩子' WHERE chapter_number=1").run()
  expect(prove(operationId).items).toEqual([])
})

it('rejects approval only when the roster the candidates derive from actually changed', () => {
  const operationId = commitBlueprintReceipt()
  getProjectDb()!.prepare("UPDATE blueprints SET characters = '[\"Protagonist\"]' WHERE chapter_number=1").run()
  try {
    prove(operationId)
    throw new Error('must reject a changed roster')
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes('CHARACTER_PROPOSAL_SOURCE_CHANGED')) throw cause
  }
  // 整章被删同样判过期。
  getProjectDb()!.prepare('DELETE FROM blueprints WHERE chapter_number=1').run()
  try {
    prove(operationId)
    throw new Error('must reject a missing chapter')
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes('CHARACTER_PROPOSAL_SOURCE_CHANGED')) throw cause
  }
})

it('keeps a legacy non-JSON roster cell from crashing the proof', () => {
  const operationId = commitBlueprintReceipt()
  getProjectDb()!.prepare("UPDATE blueprints SET characters = 'Protagonist、Old Chen' WHERE chapter_number=1").run()
  try {
    prove(operationId)
    throw new Error('must reject an unreadable roster')
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes('CHARACTER_PROPOSAL_SOURCE_CHANGED')) throw cause
  }
})

it('never gates directory candidates on the originating run lineage (assertSources must not fire)', () => {
  const operationId = commitBlueprintReceipt()
  // 实机教训：作者在生成目录后正常编辑了世界观/前提，旧运行的谱系必然失配 ——
  // 但候选是谁只由「本章角色名单」决定。目录证明绝不能调用 assertSources，
  // 否则任何一次正常的设定编辑都会把待确认批次永久卡死（保存与重提取双炸）。
  const db = getProjectDb()!
  const project = projectAccess.probeExistingProject(root)
  if (project.kind !== 'manifest') throw new Error('test project identity missing')
  const proof = proveCharacterProposal(db, new GenerationRunRepository(() => db), project.projectId,
    { kind: 'directory', operationId }, true, () => { throw new Error('GENERATION_SOURCE_CHANGED') })
  expect(proof.items).toEqual([])
})
