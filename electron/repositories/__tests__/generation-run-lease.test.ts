import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { M01_GENERATION_SQL } from '../../migrations/m01-generation-runs'
import { applyM29GenerationRunLease } from '../../migrations/m29-generation-run-lease'
import {
  GenerationRunRepository, GENERATION_RUN_LEASE_TTL_MS,
  type OpenGenerationRunRequest, type RunBinding,
} from '../generation-run-repository'

/**
 * D2 方案甲的验收：执行租约与启动时 fence。
 *
 * 要证明的只有一件事 —— **「主人已死」能被判成终态 `aborted`，而不是被抹成 `paused`**。
 * `paused` 承载不了这个语义：它同时是「等作者继续」的写法，所以「这批结束了没有」
 * 在库里没有答案，这正是 D2 的主症状。
 *
 * 另一半（工作流正常收尾时写终态）是方案乙的事，见 `generation-run-seal.test.ts`。
 */
const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
/** 64 位小写十六进制：`isContentHash` 是 `/^[a-f0-9]{64}$/`，不能直接拿字母种子补零。 */
const hash = (seed: string) => seed.charCodeAt(0).toString(16).padStart(2, '0').repeat(32).slice(0, 64)
const BUDGET = { maxPhysicalRequests: 8, maxTokenLiability: 200_000, maxOutputPerRequest: 8_000, maxActiveElapsedMs: 3_600_000 }

function openRequest(nonce: string, operation = 'chapter-draft'): OpenGenerationRunRequest {
  const binding: RunBinding = {
    projectId: 'project-1',
    epoch: 'epoch-1',
    contextSnapshotId: 'snapshot-1',
    fingerprint: {
      chapterBriefHash: hash('a'), authorGuidanceHash: hash('b'), dependencyHash: hash('c'),
      contextSnapshotHash: hash('d'), templateHash: hash('e'), skillSnapshotHash: hash('f'),
      modelLeaseRevision: hash('m'), policyHash: hash('g'), outputContractHash: hash('h'),
    },
    sourceManifest: { operation },
    sourceRefs: [],
  }
  return { ...binding, operation, uiActionNonce: nonce, frozenInputHash: hash('i'), budget: BUDGET }
}

function fixture(owner = 'owner-A') {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()
  // 真实老库 = M01 建表 + M29 补列，fixture 走同一条路径。
  applyM29GenerationRunLease(db)
  let clock = 1_000_000
  const leaseOf = (runId: string) => db.prepare('SELECT execution_owner, execution_epoch, lease_expires_at FROM generation_runs WHERE run_id=?')
    .get(runId) as { execution_owner: string; execution_epoch: number; lease_expires_at: number }
  const statusOf = (runId: string) => db.prepare('SELECT status FROM generation_runs WHERE run_id=?').pluck().get(runId) as string
  return {
    db, leaseOf, statusOf,
    repository: new GenerationRunRepository(() => db, () => clock, () => false, () => owner),
    /** 造一个「上一个进程留下的 run」：owner 空串 + 租约 0，与 M29 的老数据形状一致。 */
    legacyRun(runId: string, status = 'running') {
      db.prepare('INSERT OR IGNORE INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json) VALUES(?,?,?,?)')
        .run('root-legacy', 'idem-legacy', JSON.stringify({ projectId: 'project-1', epoch: 'epoch-1', operation: 'chapter-draft', uiActionNonce: 'legacy', frozenInputHash: hash('i'), rootActionId: 'root-legacy', status: 'active' }), JSON.stringify(BUDGET))
      db.prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
        .run(runId, 'root-legacy', JSON.stringify(openRequest('legacy')), status, 1, `open-${runId}`)
    },
    advance: (ms: number) => { clock += ms },
  }
}

describe('D2 甲 · 执行租约', () => {
  it('open() 当场认领：写 owner、epoch=1、租约 = now + TTL', () => {
    const { repository, leaseOf } = fixture()
    const run = repository.open(openRequest('n1'))
    expect(leaseOf(run.runId)).toEqual({
      execution_owner: 'owner-A',
      execution_epoch: 1,
      lease_expires_at: 1_000_000 + GENERATION_RUN_LEASE_TTL_MS,
    })
  })

  it('续租把到期时刻往后推；不续租它不变', () => {
    const { repository, leaseOf, advance } = fixture()
    const run = repository.open(openRequest('n1'))
    advance(60_000)
    expect(leaseOf(run.runId).lease_expires_at).toBe(1_000_000 + GENERATION_RUN_LEASE_TTL_MS)
    expect(repository.renewLease(run.runId)).toBe(true)
    expect(leaseOf(run.runId).lease_expires_at).toBe(1_060_000 + GENERATION_RUN_LEASE_TTL_MS)
  })

  it('别人续不动我的租约：返回 false 且库里一个字不改', () => {
    const { repository, leaseOf, advance, db } = fixture()
    const run = repository.open(openRequest('n1'))
    advance(60_000)
    const intruder = new GenerationRunRepository(() => db, () => 1_060_000, () => false, () => 'owner-B')
    expect(intruder.renewLease(run.runId)).toBe(false)
    expect(leaseOf(run.runId).execution_owner).toBe('owner-A')
    expect(leaseOf(run.runId).lease_expires_at).toBe(1_000_000 + GENERATION_RUN_LEASE_TTL_MS)
  })
})

describe('D2 甲 · 启动时 fence', () => {
  it('租约过期 ⇒ aborted（而不是被抹成 paused）', () => {
    const { repository, statusOf, advance } = fixture()
    const run = repository.open(openRequest('n1'))
    advance(GENERATION_RUN_LEASE_TTL_MS + 1)
    repository.recoverInterrupted()
    expect(statusOf(run.runId)).toBe('aborted')
  })

  it('租约仍有效 ⇒ 不判死，走原来的 paused（作者还能接着写）', () => {
    const { repository, statusOf } = fixture()
    const run = repository.open(openRequest('n1'))
    repository.recoverInterrupted()
    expect(statusOf(run.runId)).toBe('paused')
  })

  it('老数据 owner 为空 ⇒ 判死（迁移不回填，如实说「无人持有」）', () => {
    const { repository, statusOf, legacyRun } = fixture()
    legacyRun('run-legacy')
    repository.recoverInterrupted()
    expect(statusOf('run-legacy')).toBe('aborted')
  })

  it('不误杀已有终态：completed / failed / cancelled 一个都不动', () => {
    const { repository, statusOf, advance, db, legacyRun } = fixture()
    // 三种终态各造一条，owner 为空、租约 0 —— 最容易被误判的形状。
    for (const [id, status] of [['run-ok', 'completed'], ['run-bad', 'failed'], ['run-cancel', 'cancelled']] as const) {
      legacyRun(id, status)
    }
    void db
    advance(GENERATION_RUN_LEASE_TTL_MS * 100)
    repository.recoverInterrupted()
    expect(statusOf('run-ok')).toBe('completed')
    expect(statusOf('run-bad')).toBe('failed')
    expect(statusOf('run-cancel')).toBe('cancelled')
  })

  it('aborted 是终态：后来的 seal 不会把它翻成 completed', () => {
    const { repository, statusOf, advance } = fixture()
    const run = repository.open(openRequest('n1'))
    advance(GENERATION_RUN_LEASE_TTL_MS + 1)
    repository.recoverInterrupted()
    expect(statusOf(run.runId)).toBe('aborted')
    const receipt = repository.seal(run.rootActionId, 'completed')
    expect(statusOf(run.runId)).toBe('aborted')
    expect(receipt.settledRuns).toBe(0)
  })
})
