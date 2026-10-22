import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { closeProjectDatabase, getProjectDb } from '../../database'
import { openCanonicalProjectFixture } from '../../../test/helpers/canonical-project-fixture'
import { ProjectCoreRepository } from '../../repositories/project-core-repository'
import { GenerationRunRepository } from '../../repositories/generation-run-repository'
import { CastLedgerCompletionError } from '../../../src/shared/cast-ledger-completion'
import type { CharacterProposalSource } from '../../../src/shared/character-proposal'
import type { MainGenerationRunHandle } from '../../../src/services/generation/generation-runtime'
import { CAST_LEDGER_COMPLETION_OPERATION, CAST_LEDGER_NAME_INPUT_PREFIX } from '../cast-ledger-generation-proof'
import { CharacterProposalService } from '../character-proposal-service'
import { proveCharacterProposal } from '../generation-character-proposal-proof'
import { projectAccess } from '../project-access'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const EPOCH = 'epoch-1'
const MODEL_REVISION = 'a'.repeat(64)

type CastLedgerSource = Extract<CharacterProposalSource, { kind: 'cast-ledger' }>

/** 与架构详情同构的补全条目：11 个静态字段 + slotId + currentState（validateCharacterDetail 要求齐全）。 */
function detailEntry(name: string): Record<string, unknown> {
  return {
    slotId: `cast-${name}`,
    name,
    role: 'supporting',
    gender: '女',
    age: '成年',
    appearance: `${name}的外貌`,
    personality: `${name}的性格`,
    background: `${name}的背景`,
    abilities: `${name}的能力`,
    motivation: `${name}的动机`,
    arc: `${name}的弧光`,
    notes: `${name}的备注`,
    currentState: { location: '城里', powerLevel: '普通', physicalState: '健康', mentalState: '冷静',
      keyItems: '钥匙', recentEvents: '抵达', updatedAtChapter: 0 },
  }
}

let root = ''
let projectId = ''
let sequence = 0

function db(): Database.Database {
  const value = getProjectDb()
  if (!value) throw new Error('project database missing')
  return value
}

/**
 * 一个「已完成的②补全运行」：手工插 generation_roots/runs/attempts/artifacts 四行。
 * 证明层读的是冻结产物 + 运行回执，因此不需要真实模型调用；必须走真实证明层，
 * 不能用 stub 绕过 —— 本文件的重点就是证明层与 service 的接线。
 */
function completionRun(names: string[], entries?: unknown[]): {
  source: CastLedgerSource
  rootActionId: string
  runId: string
  artifactId: string
  text: string
  textHash: string
} {
  sequence += 1
  const runId = `run-${sequence}`
  const rootActionId = `root-${sequence}`
  const attemptId = `attempt-${sequence}`
  const artifactId = `artifact-${sequence}`
  const text = JSON.stringify({ entries: entries ?? names.map(detailEntry) })
  const textHashValue = hash(text)
  const fingerprint = {
    chapterBriefHash: hash('chapter-brief'), authorGuidanceHash: hash('guidance'),
    dependencyHash: hash('dependency'), contextSnapshotHash: hash('snapshot'),
    templateHash: hash('template'), skillSnapshotHash: hash('skill'),
    modelLeaseRevision: hash('lease'), policyHash: hash('policy'),
    outputContractHash: hash('contract'),
  }
  const binding = {
    projectId, epoch: EPOCH, fingerprint, contextSnapshotId: `ctx-${sequence}`,
    sourceManifest: {
      operation: CAST_LEDGER_COMPLETION_OPERATION,
      authorInputs: names.map((name, index) => ({ id: `${CAST_LEDGER_NAME_INPUT_PREFIX}${index}`, text: name })),
      modelReceipt: { modelRevision: MODEL_REVISION },
    },
    sourceRefs: [],
  }
  const attemptJson = { attemptId, reservationId: `reservation-${sequence}`, rootActionId,
    status: 'settled', reservedTokens: 100, requestedOutputTokens: 100, actualTokens: 1 }
  const usageReceipt = {
    purpose: CAST_LEDGER_COMPLETION_OPERATION,
    artifactIdentity: { artifactId, epoch: EPOCH, fingerprint },
    result: { usage: null, finishReason: 'stop' },
    budgetDecision: null,
  }
  const artifactJson = { artifactId, attemptId, rootActionId, projectId, epoch: EPOCH, fingerprint,
    revision: 1, text, textHash: textHashValue }

  db().prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json) VALUES(?,?,?,?)')
    .run(rootActionId, `idempotency-${sequence}`, JSON.stringify({ rootActionId }), '{}')
  db().prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
    .run(runId, rootActionId, JSON.stringify(binding), 'completed', 1, `open-key-${sequence}`)
  db().prepare('INSERT INTO generation_attempts(attempt_id,reservation_id,run_id,root_action_id,attempt_json,usage_receipt_json,invocation_nonce) VALUES(?,?,?,?,?,?,?)')
    .run(attemptId, `reservation-${sequence}`, runId, rootActionId, JSON.stringify(attemptJson), JSON.stringify(usageReceipt), `nonce-${sequence}`)
  db().prepare('INSERT INTO generation_artifacts(artifact_id,attempt_id,run_id,artifact_json,revision,status) VALUES(?,?,?,?,?,?)')
    .run(artifactId, attemptId, runId, JSON.stringify(artifactJson), 1, 'settled')

  return {
    source: { kind: 'cast-ledger', names,
      handle: { projectId, epoch: EPOCH, rootActionId, runId },
      artifacts: [{ artifactId, revision: 1, textHash: textHashValue }] },
    rootActionId, runId, artifactId, text, textHash: textHashValue,
  }
}

function serviceWith(calls: MainGenerationRunHandle[] = []): CharacterProposalService {
  const handle = db()
  const runs = new GenerationRunRepository(() => handle)
  return new CharacterProposalService(handle, projectId, (source, forWrite, version) =>
    proveCharacterProposal(handle, runs, projectId, source, forWrite, current => { calls.push(current) }, version))
}

function proposalCount(): number {
  return db().prepare('SELECT COUNT(*) FROM character_identity_proposals WHERE source_key=?').pluck()
    .get(`character-proposal-v1:${projectId}`) as number
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-novel-cast-ledger-'))
  openCanonicalProjectFixture(root)
  ProjectCoreRepository.init('Cast Ledger Test')
  const project = projectAccess.probeExistingProject(root)
  if (project.kind !== 'manifest') throw new Error('test project identity missing')
  projectId = project.projectId
  sequence = 0
}, 30_000)

afterEach(() => {
  closeProjectDatabase()
  fs.rmSync(root, { recursive: true, force: true })
})

describe('cast-ledger stage', () => {
  it('同一 source 重复 stage 返回同一批次、只写一行，且封存的 source 是 canonical 形式', () => {
    const calls: MainGenerationRunHandle[] = []
    const service = serviceWith(calls)
    const run = completionRun(['林岚', '韩素'])

    const first = service.stage(run.source)
    const second = service.stage(run.source)

    expect(first.status).toBe('pending-approval')
    expect(second.proposalBatchId).toBe(first.proposalBatchId)
    expect(second.items.map(item => item.fields.name)).toEqual(['林岚', '韩素'])
    expect(proposalCount()).toBe(1)
    expect(calls[0]).toEqual({ projectId, epoch: EPOCH, rootActionId: run.rootActionId, runId: run.runId })
    // 封存的 source 必须与证明层重算的 canonical source 逐字相同，否则 readEnvelope 会判 SOURCE_CHANGED。
    const stored = JSON.parse(db().prepare('SELECT raw_value FROM character_identity_proposals WHERE proposal_id=?').pluck()
      .get(first.proposalBatchId) as string) as { batch: { source: unknown } }
    expect(stored.batch.source).toEqual({
      kind: 'cast-ledger', names: ['林岚', '韩素'],
      handle: { projectId, epoch: EPOCH, rootActionId: run.rootActionId, runId: run.runId },
      artifacts: [{ artifactId: run.artifactId, revision: 1, textHash: run.textHash }],
    })
  })

  it('名字顺序不影响批次身份：同一 run 逆序 stage 仍命中同一批次', () => {
    const service = serviceWith()
    const run = completionRun(['林岚', '韩素'])
    const first = service.stage(run.source)
    const reversed = service.stage({ ...run.source, names: [...run.source.names].reverse() })
    expect(reversed.proposalBatchId).toBe(first.proposalBatchId)
    expect(proposalCount()).toBe(1)
  })

  it('不同 run、同一份名字集合：复用既有 pending 批次而不是新建', () => {
    const service = serviceWith()
    const first = service.stage(completionRun(['林岚', '韩素']).source)
    const replay = service.stage(completionRun(['韩素', '林岚']).source)
    expect(replay.proposalBatchId).toBe(first.proposalBatchId)
    expect(replay.source).toEqual(first.source)
    expect(proposalCount()).toBe(1)
  })

  it('名字集合相交但不相等时报 PENDING_CONFLICT（避免先批准的那批把相交名字变成重复建卡）', () => {
    const service = serviceWith()
    service.stage(completionRun(['林岚', '韩素']).source)
    expect(() => service.stage(completionRun(['韩素', '顾青']).source)).toThrow('CHARACTER_CAST_LEDGER_PENDING_CONFLICT')
    expect(proposalCount()).toBe(1)
  })

  it('只有名字、没有静态资料的产物被证明层拒绝，且不写入任何批次', () => {
    const service = serviceWith()
    const run = completionRun(['林岚'], [{ name: '林岚' }])
    let thrown: unknown
    try { service.stage(run.source) } catch (error) { thrown = error }
    expect(thrown).toBeInstanceOf(CastLedgerCompletionError)
    expect((thrown as CastLedgerCompletionError).code).toBe('CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
    expect((thrown as CastLedgerCompletionError).detail).toContain('第 1 段产物第 1 条无效')
    // 证明层在 INSERT 之前失败：不存在「只有名字的可批准批次」。
    expect(proposalCount()).toBe(0)
  })
})

describe('cast-ledger approve', () => {
  it('走 adopt-generated 落库：字段非空、provenance generated、批准回执可查、重放幂等', () => {
    const calls: MainGenerationRunHandle[] = []
    const service = serviceWith(calls)
    const run = completionRun(['林岚', '韩素'])
    const batch = service.stage(run.source)
    const request = {
      proposalBatchId: batch.proposalBatchId,
      expectedRevision: batch.revision,
      operationId: 'op-cast-1',
      selections: batch.items.map(item => ({ selectionKey: item.selectionKey, action: 'create' as const })),
    }

    const approved = service.approve(request)
    expect(approved.batch.status).toBe('approved')
    expect(approved.created).toHaveLength(2)
    // approve 也必须走证明层并拿到现行 handle：写闸与 stage 同一份证据。
    expect(calls.at(-1)).toEqual({ projectId, epoch: EPOCH, rootActionId: run.rootActionId, runId: run.runId })

    const rows = db().prepare('SELECT name,role,gender,age,appearance,personality,background,abilities,motivation,arc,notes,retired,static_provenance FROM characters ORDER BY name')
      .all() as Record<string, unknown>[]
    expect(rows.map(row => row.name)).toEqual(['林岚', '韩素'])
    const textFields = ['name', 'role', 'gender', 'age', 'appearance', 'personality', 'background', 'abilities', 'motivation', 'arc', 'notes']
    for (const row of rows) {
      for (const field of textFields) expect(typeof row[field] === 'string' && (row[field] as string).trim().length > 0).toBe(true)
      expect(row.retired).toBe(0)
      const provenance = JSON.parse(row.static_provenance as string) as { kind: string; modelRevision?: string; approvalId?: string }
      expect(provenance.kind).toBe('generated')
      expect(provenance.modelRevision).toBe(MODEL_REVISION)
      expect(provenance.approvalId).toBe('op-cast-1')
    }

    const approval = db().prepare('SELECT payload_hash,receipt_json FROM character_identity_approvals WHERE operation_id=?')
      .get('op-cast-1') as { payload_hash: string; receipt_json: string }
    expect(approval.payload_hash).toMatch(/^[0-9a-f]{64}$/)
    const receipt = JSON.parse(approval.receipt_json) as { operationId: string; created: unknown[]; revision: number }
    expect(receipt.operationId).toBe('op-cast-1')
    expect(receipt.created).toHaveLength(2)
    expect(receipt.revision).toBe(1)
    expect(db().prepare("SELECT revision FROM character_identity_meta WHERE id='main'").pluck().get()).toBe(1)

    // 同一 operationId + 同一决策重放：返回封存回执，不重复建卡。
    const replay = service.approve(request)
    expect(replay.batch.status).toBe('approved')
    expect(replay.created).toHaveLength(2)
    expect((db().prepare('SELECT COUNT(*) FROM characters').pluck().get() as number)).toBe(2)
  })
})
