import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { M01_GENERATION_SQL } from '../../migrations/m01-generation-runs'
import { applyM29GenerationRunLease } from '../../migrations/m29-generation-run-lease'
import { finalizeFailedGeneration } from '../../services/generation-run-timeout'
import { GenerationRunRepository } from '../generation-run-repository'
import {
  createSingleCallWatchdog,
  DEFAULT_SINGLE_CALL_TIMEOUT_MS,
} from '../../../src/shared/generation-call-timeout'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
const hash = (seed: string) => seed.padEnd(64, '0').slice(0, 64)
const BUDGET = { maxPhysicalRequests: 8, maxTokenLiability: 200_000, maxOutputPerRequest: 8_000, maxActiveElapsedMs: 3_600_000 }

/** 与 generation-run-seal.test.ts 同一套账本 fixture（M01 建表 + M29 补租约列）。 */
function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()
  applyM29GenerationRunLease(db)
  const operation = 'chapter-outline'
  const binding = {
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
  const rootAction = {
    projectId: 'project-1', epoch: 'epoch-1', operation, uiActionNonce: 'nonce-1',
    frozenInputHash: hash('i'), rootActionId: 'root-1', status: 'active',
  }
  db.prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json,blocked_code) VALUES(?,?,?,?,?)')
    .run('root-1', 'idem-1', JSON.stringify(rootAction), JSON.stringify(BUDGET), null)
  db.prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
    .run('run-1', 'root-1', JSON.stringify(binding), 'running', 1, 'open-run-1')
  const repository = new GenerationRunRepository(() => db)
  const runStatus = () => db.prepare('SELECT status FROM generation_runs WHERE run_id=?').pluck().get('run-1') as string
  return { repository, runStatus }
}

afterEach(() => { vi.useRealTimers() })

describe('D9 超时中止复用 D2 失败终态落库', () => {
  it('超时已中止 → generation_runs 不留在 running/paused', () => {
    vi.useFakeTimers()
    const { repository, runStatus } = fixture()
    expect(runStatus()).toBe('running')
    const watchdog = createSingleCallWatchdog({
      onTimeout: () => finalizeFailedGeneration(repository, 'root-1'),
    })
    watchdog.start()
    vi.advanceTimersByTime(DEFAULT_SINGLE_CALL_TIMEOUT_MS)
    expect(watchdog.phase).toBe('timed-out')
    // 复用 seal(rootId,'failed')：run 从 running 直接落到失败终态
    expect(runStatus()).toBe('failed')
    expect(['running', 'paused']).not.toContain(runStatus())
  })

  it('调用失败 → 同一条 seal 路径把 run 写成终态', () => {
    vi.useFakeTimers()
    const { repository, runStatus } = fixture()
    const watchdog = createSingleCallWatchdog({
      onFailure: () => finalizeFailedGeneration(repository, 'root-1'),
    })
    watchdog.start()
    watchdog.fail()
    expect(watchdog.phase).toBe('failed')
    expect(runStatus()).toBe('failed')
    expect(['running', 'paused']).not.toContain(runStatus())
  })
})
