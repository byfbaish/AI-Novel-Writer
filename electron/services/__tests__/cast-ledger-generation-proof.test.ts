import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { M01_GENERATION_SQL } from '../../migrations/m01-generation-runs'
import { GenerationRunRepository } from '../../repositories/generation-run-repository'
import {
  CAST_LEDGER_COMPLETION_OPERATION,
  CAST_LEDGER_NAME_INPUT_PREFIX,
  readCastLedgerGenerationProof,
} from '../cast-ledger-generation-proof'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')

const PROJECT_ID = 'project'
const EPOCH = 'epoch-1'
const ROOT_ACTION_ID = 'root-1'
const RUN_ID = 'run-1'
const ATTEMPT_ID = 'attempt-1'
const ARTIFACT_ID = 'artifact-1'
const REVISION = 1

/** 与架构详情同构的补全条目：11 个静态字段 + slotId + currentState 全非空。 */
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

interface FixtureOptions {
  names?: string[]
  authorInputNames?: string[]
  operation?: string
  finishReason?: string
  attemptStatus?: string
  failureCode?: string
  artifactStatus?: string
  modelRevision?: string | null
}

/**
 * 手工插 generation_roots/runs/attempts/artifacts 四行：
 * 证明层读的是「冻结产物 + 运行回执」，没有真实生成也能覆盖全部闸门。
 */
function buildFixture(options: FixtureOptions = {}) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => {
    initializeLegacyBaselineSchema(db)
    db.exec(M01_GENERATION_SQL)
  })()

  const names = options.names ?? ['林岚', '韩素']
  const text = JSON.stringify({ entries: names.map(detailEntry) })
  const textHashValue = hash(text)
  const fingerprint = {
    chapterBriefHash: hash('chapter-brief'), authorGuidanceHash: hash('guidance'),
    dependencyHash: hash('dependency'), contextSnapshotHash: hash('snapshot'),
    templateHash: hash('template'), skillSnapshotHash: hash('skill'),
    modelLeaseRevision: hash('lease'), policyHash: hash('policy'),
    outputContractHash: hash('contract'),
  }
  const manifest: Record<string, unknown> = {
    operation: options.operation ?? CAST_LEDGER_COMPLETION_OPERATION,
    authorInputs: (options.authorInputNames ?? names).map((name, index) => ({
      id: `${CAST_LEDGER_NAME_INPUT_PREFIX}${index}`, text: name })),
  }
  if (options.modelRevision !== null) manifest.modelReceipt = { modelRevision: options.modelRevision ?? hash('model') }
  const binding = { projectId: PROJECT_ID, epoch: EPOCH, fingerprint, contextSnapshotId: 'ctx-1', sourceManifest: manifest, sourceRefs: [] }
  const attemptJson = { attemptId: ATTEMPT_ID, reservationId: 'reservation-1', rootActionId: ROOT_ACTION_ID,
    status: options.attemptStatus ?? 'settled', reservedTokens: 100, requestedOutputTokens: 100, actualTokens: 1 }
  const usageReceipt = {
    purpose: CAST_LEDGER_COMPLETION_OPERATION,
    artifactIdentity: { artifactId: ARTIFACT_ID, epoch: EPOCH, fingerprint },
    result: { usage: null, finishReason: options.finishReason ?? 'stop',
      ...(options.failureCode ? { failureCode: options.failureCode } : {}) },
    budgetDecision: null,
  }
  const artifactJson = { artifactId: ARTIFACT_ID, attemptId: ATTEMPT_ID, rootActionId: ROOT_ACTION_ID,
    projectId: PROJECT_ID, epoch: EPOCH, fingerprint, revision: REVISION, text, textHash: textHashValue }

  db.prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json) VALUES(?,?,?,?)')
    .run(ROOT_ACTION_ID, 'idempotency-1', JSON.stringify({ rootActionId: ROOT_ACTION_ID }), '{}')
  db.prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
    .run(RUN_ID, ROOT_ACTION_ID, JSON.stringify(binding), 'completed', 1, 'open-key-1')
  db.prepare('INSERT INTO generation_attempts(attempt_id,reservation_id,run_id,root_action_id,attempt_json,usage_receipt_json,invocation_nonce) VALUES(?,?,?,?,?,?,?)')
    .run(ATTEMPT_ID, 'reservation-1', RUN_ID, ROOT_ACTION_ID, JSON.stringify(attemptJson), JSON.stringify(usageReceipt), 'nonce-1')
  db.prepare('INSERT INTO generation_artifacts(artifact_id,attempt_id,run_id,artifact_json,revision,status) VALUES(?,?,?,?,?,?)')
    .run(ARTIFACT_ID, ATTEMPT_ID, RUN_ID, JSON.stringify(artifactJson), REVISION, options.artifactStatus ?? 'settled')

  const source = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    kind: 'cast-ledger',
    names,
    handle: { projectId: PROJECT_ID, epoch: EPOCH, rootActionId: ROOT_ACTION_ID, runId: RUN_ID },
    artifacts: [{ artifactId: ARTIFACT_ID, revision: REVISION, textHash: textHashValue }],
    ...overrides,
  })
  const read = (overrides: Record<string, unknown> = {}) =>
    readCastLedgerGenerationProof(db, new GenerationRunRepository(() => db), PROJECT_ID, source(overrides))
  return { db, names, text, textHash: textHashValue, source, read }
}

function expectCode(run: () => unknown, code: string): void {
  try {
    run()
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(code)
    return
  }
  throw new Error(`期望抛出 ${code}`)
}

describe('readCastLedgerGenerationProof', () => {
  it('正常路径：从冻结产物重算 items，并给出规范化 source/currentHandle/provenance', () => {
    // 名单故意逆序：规范化后必须排序，否则 proposalBatchId 会随调用方顺序漂移。
    const fixture = buildFixture({ names: ['韩素', '林岚'] })
    const result = fixture.read({ names: ['韩素', '林岚'] })
    expect(result.proof.items.map(item => item.fields.name)).toEqual(['韩素', '林岚'])
    expect(result.names).toEqual(['林岚', '韩素'])
    expect(result.source).toEqual({
      kind: 'cast-ledger', names: ['林岚', '韩素'],
      handle: { projectId: PROJECT_ID, epoch: EPOCH, rootActionId: ROOT_ACTION_ID, runId: RUN_ID },
      artifacts: [{ artifactId: ARTIFACT_ID, revision: REVISION, textHash: fixture.textHash }],
    })
    expect(result.currentHandle).toEqual({ projectId: PROJECT_ID, epoch: EPOCH, rootActionId: ROOT_ACTION_ID, runId: RUN_ID })
    expect(result.artifactTexts).toEqual([fixture.text])
    expect(result.proof.sourceHash).toMatch(/^[0-9a-f]{64}$/)
    expect(result.proof.provenance).toEqual({
      kind: 'generated', modelRevision: hash('model'),
      source: { projectId: PROJECT_ID, epoch: EPOCH, sourceId: RUN_ID, revision: 0, contentHash: result.proof.sourceHash },
    })
  })

  it('run.binding.sourceManifest.operation 不符时报 SOURCE_INVALID', () => {
    const fixture = buildFixture({ operation: 'legacy-roster-generation' })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
  })

  it('authorInputs 的名字集合与 names 不等时报 NAMES_MISMATCH', () => {
    const fixture = buildFixture({ authorInputNames: ['林岚'] })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_NAMES_MISMATCH')
  })

  it('产物引用的 textHash 与真实回执不符时报 ARTIFACT_INVALID', () => {
    const fixture = buildFixture()
    expectCode(() => fixture.read({ artifacts: [{ artifactId: ARTIFACT_ID, revision: REVISION, textHash: hash('other') }] }),
      'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('产物引用的 revision 与真实回执不符时报 ARTIFACT_INVALID', () => {
    const fixture = buildFixture()
    expectCode(() => fixture.read({ artifacts: [{ artifactId: ARTIFACT_ID, revision: 7, textHash: fixture.textHash }] }),
      'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('finishReason 不是 stop（截断）时报 ARTIFACT_INVALID', () => {
    const fixture = buildFixture({ finishReason: 'length' })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('attempt 未 settled（如 reserved）时报 ARTIFACT_INVALID', () => {
    const fixture = buildFixture({ attemptStatus: 'reserved' })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('artifact 行被 discarded 时报 ARTIFACT_INVALID', () => {
    const fixture = buildFixture({ artifactStatus: 'discarded' })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('attempt 回执带 failureCode 时报 ARTIFACT_INVALID', () => {
    const fixture = buildFixture({ failureCode: 'GENERATION_ABORTED' })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID')
  })

  it('source 形状越界（多余键 / kind 错 / handle 缺键 / epoch 不符 / projectId 不符）报 SOURCE_INVALID', () => {
    const fixture = buildFixture()
    expectCode(() => fixture.read({ extra: 1 }), 'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
    expectCode(() => fixture.read({ kind: 'legacy-roster-generation' }), 'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
    expectCode(() => fixture.read({ handle: { projectId: PROJECT_ID, epoch: EPOCH, runId: RUN_ID } }),
      'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
    expectCode(() => fixture.read({ handle: { projectId: PROJECT_ID, epoch: 'epoch-2', rootActionId: ROOT_ACTION_ID, runId: RUN_ID } }),
      'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
    expectCode(() => fixture.read({ handle: { projectId: 'other-project', epoch: EPOCH, rootActionId: ROOT_ACTION_ID, runId: RUN_ID } }),
      'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
  })

  it('names 空/重复/含空项时报 NAMES_REQUIRED', () => {
    const fixture = buildFixture()
    expectCode(() => fixture.read({ names: [] }), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
    expectCode(() => fixture.read({ names: ['林岚', '林岚'] }), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
    expectCode(() => fixture.read({ names: ['林岚', '  '] }), 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED')
  })

  it('modelReceipt 缺 modelRevision 时报 SOURCE_INVALID（没有模型版本就没有可审计的 provenance）', () => {
    const fixture = buildFixture({ modelRevision: null })
    expectCode(() => fixture.read(), 'CHARACTER_CAST_LEDGER_SOURCE_INVALID')
  })
})
