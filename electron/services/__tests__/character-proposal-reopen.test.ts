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
import { CharacterProposalService } from '../character-proposal-service'
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

function service(): CharacterProposalService {
  const db = getProjectDb()!
  const project = projectAccess.probeExistingProject(root)
  if (project.kind !== 'manifest') throw new Error('test project identity missing')
  return new CharacterProposalService(db, project.projectId, source => proveCharacterProposal(db,
    new GenerationRunRepository(() => db), project.projectId, source, false, () => {}))
}

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

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-proposal-reopen-'))
  initProjectDatabase(root)
  ProjectCoreRepository.init('Reopen Test')
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

it('cancelling keeps candidates, and reopening returns them to pending-approval for a new decision', () => {
  const owner = service()
  const batch = owner.stage({ kind: 'directory', operationId: commitBlueprintReceipt() })
  expect(batch.status).toBe('pending-approval')
  const cancelled = owner.cancel({ proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision })
  expect(cancelled.status).toBe('cancelled')
  // 取消不落任何身份效果，重开必须把同一批候选放回决策队列（实机：作者因保存报错被迫取消）。
  const reopened = owner.reopen({ proposalBatchId: batch.proposalBatchId, expectedRevision: cancelled.revision })
  expect(reopened.status).toBe('pending-approval')
  expect(reopened.items.map(item => item.fields.name)).toEqual(batch.items.map(item => item.fields.name))
  // 重开是幂等的：待确认批次重复重开拿回同一批候选（名册未变时 revision 不变）。
  expect(owner.reopen({ proposalBatchId: batch.proposalBatchId, expectedRevision: reopened.revision }).status)
    .toBe('pending-approval')
  // 重开后的批次可再次取消 —— 取消/重开都不落身份效果，作者可以反复改变主意。
  expect(owner.cancel({ proposalBatchId: batch.proposalBatchId, expectedRevision: reopened.revision }).status)
    .toBe('cancelled')
})
