import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { M01_GENERATION_SQL } from '../../migrations/m01-generation-runs'
import { applyM29GenerationRunLease } from '../../migrations/m29-generation-run-lease'
import { GenerationRunRepository, type RunBinding } from '../generation-run-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/** 64 位十六进制假哈希：只为满足来源指纹的形状，不参与任何比较语义。 */
const hash = (seed: string) => seed.padEnd(64, '0').slice(0, 64)

const BUDGET = { maxPhysicalRequests: 8, maxTokenLiability: 200_000, maxOutputPerRequest: 8_000, maxActiveElapsedMs: 3_600_000 }

const rootAction = (status: string, operation: string) => ({
  projectId: 'project-1',
  epoch: 'epoch-1',
  operation,
  uiActionNonce: 'nonce-1',
  frozenInputHash: hash('i'),
  rootActionId: 'root-1',
  status,
})

function bindingAt(operation: string): RunBinding {
  return {
    projectId: 'project-1',
    epoch: 'epoch-1',
    contextSnapshotId: 'snapshot-1',
    fingerprint: {
      chapterBriefHash: hash('a'),
      authorGuidanceHash: hash('b'),
      dependencyHash: hash('c'),
      contextSnapshotHash: hash('d'),
      templateHash: hash('e'),
      skillSnapshotHash: hash('f'),
      modelLeaseRevision: hash('m'),
      policyHash: hash('g'),
      outputContractHash: hash('h'),
    },
    sourceManifest: { operation },
    sourceRefs: [],
  }
}

/**
 * 一个 root + N 个 run（+ 可选一个 attempt）。
 *
 * 这是**仓储层**的测试，所以只造账本事实，不造渲染层的工作流 —— D2 的因果链是
 * 「workflow run 收尾 → seal IPC → 这里写终态」，前两段在渲染层和控制器测试里覆盖。
 */
function fixture(options: {
  rootStatus?: string
  operation?: string
  blockedCode?: string | null
  runs?: { id: string; status: string }[]
  attemptStatus?: string
} = {}) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()
  // 真实老库就是「M01 建表 + M29 补租约列」这条路径，fixture 必须走同一条，
  // 否则测的是一个生产环境不存在的表形状。
  applyM29GenerationRunLease(db)
  const operation = options.operation ?? 'chapter-draft'
  db.prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json,blocked_code) VALUES(?,?,?,?,?)')
    .run('root-1', 'idem-1', JSON.stringify(rootAction(options.rootStatus ?? 'active', operation)), JSON.stringify(BUDGET), options.blockedCode ?? null)
  for (const run of options.runs ?? [{ id: 'run-1', status: 'running' }]) {
    db.prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
      .run(run.id, 'root-1', JSON.stringify(bindingAt(operation)), run.status, 1, `open-${run.id}`)
  }
  if (options.attemptStatus) {
    db.prepare('INSERT INTO generation_attempts(attempt_id,reservation_id,run_id,root_action_id,attempt_json,usage_receipt_json,invocation_nonce) VALUES(?,?,?,?,?,?,?)')
      .run('attempt-1', 'reservation-1', 'run-1', 'root-1', JSON.stringify({ attemptId: 'attempt-1', status: options.attemptStatus, reservedTokens: 100 }), JSON.stringify({}), 'nonce-attempt-1')
  }
  const repository = new GenerationRunRepository(() => db)
  const runStatus = (runId: string) => db.prepare('SELECT status FROM generation_runs WHERE run_id=?').pluck().get(runId) as string
  return { db, repository, runStatus, rootStatus: () => repository.budget('root-1').root.status as string }
}

describe('GenerationRunRepository.seal', () => {
  // D2 的主症状：21:41 批次写完、covered_to=15，到 21:46 两个 run 仍是 running。
  it('Tier 1：成功批次把 running 写成 completed', () => {
    const { repository, runStatus } = fixture()
    const receipt = repository.seal('root-1', 'completed')
    expect(runStatus('run-1')).toBe('completed')
    expect(receipt.runStatus).toBe('completed')
    expect(receipt.settledRuns).toBe(1)
  })

  it('Tier 1 连 paused 一起收口：进程重启留下的 paused 不该被当成「还在跑」', () => {
    const { repository, runStatus } = fixture({ runs: [{ id: 'run-1', status: 'paused' }, { id: 'run-2', status: 'running' }] })
    expect(repository.seal('root-1', 'failed').settledRuns).toBe(2)
    expect(runStatus('run-1')).toBe('failed')
    expect(runStatus('run-2')).toBe('failed')
  })

  it('幂等：重放不再改写，回 already-terminal', () => {
    const { repository, runStatus } = fixture()
    repository.seal('root-1', 'completed')
    const again = repository.seal('root-1', 'failed')
    expect(again.verdict).toBe('already-terminal')
    expect(again.settledRuns).toBe(0)
    // 重放不得翻转已有终态 —— 否则「先完成再报错」会把成功的批次记成失败。
    expect(runStatus('run-1')).toBe('completed')
  })

  it('cancelled 的 root 什么都不改（取消本身就是终态）', () => {
    const { repository, runStatus, rootStatus } = fixture({ runs: [{ id: 'run-1', status: 'cancelled' }] })
    repository.pause('root-1', true)
    const receipt = repository.seal('root-1', 'completed')
    expect(receipt.verdict).toBe('already-terminal')
    expect(runStatus('run-1')).toBe('cancelled')
    expect(rootStatus()).toBe('cancelled')
  })

  it('Tier 2：sealRoot 为真且结构性可封时，root 变 sealed', () => {
    const { repository, rootStatus } = fixture({ operation: 'batch-chapters' })
    const receipt = repository.seal('root-1', 'completed', { sealRoot: true })
    expect(receipt.verdict).toBe('sealed')
    expect(rootStatus()).toBe('sealed')
  })

  // 这两级必须能各自独立成立：封不了 root 不是因为 run 没写终态，而是因为「还能接着写」。
  it('Tier 1 与 Tier 2 分离：sealRoot 为假时 run 照样收口，root 保持 active', () => {
    const { repository, runStatus, rootStatus } = fixture({ operation: 'batch-chapters' })
    const receipt = repository.seal('root-1', 'completed', { sealRoot: false })
    expect(receipt.verdict).toBe('runs-settled')
    expect(runStatus('run-1')).toBe('completed')
    expect(rootStatus()).toBe('active')
  })

  it('有 blocked_code 时不封 root，但 run 仍写终态', () => {
    const { repository, runStatus, rootStatus } = fixture({ blockedCode: 'USAGE_EXCEEDED_RESERVATION' })
    const receipt = repository.seal('root-1', 'failed', { sealRoot: true })
    expect(receipt.verdict).toBe('runs-settled')
    expect(runStatus('run-1')).toBe('failed')
    expect(rootStatus()).toBe('active')
    // blocked_code 是门禁字段：收口不许把它抹掉，否则这一批会重新变回「可继续」。
    expect(repository.budget('root-1').blockedCode).toBe('USAGE_EXCEEDED_RESERVATION')
  })

  it.each(['reserved', 'dispatch-marked'])('有在飞的 attempt（%s）时不封 root', attemptStatus => {
    const { repository, rootStatus } = fixture({ attemptStatus })
    expect(repository.seal('root-1', 'completed', { sealRoot: true }).verdict).toBe('runs-settled')
    expect(rootStatus()).toBe('active')
  })

  // 回归锁：`recoverInterrupted()` 每次启动都会对每个 root 调 pause()。少了
  // `AND status IN ('running','paused')` 就会把刚写好的 completed 打回 paused —— 改了等于没改。
  it('回归：pause() 不把已收口的 completed 打回 paused', () => {
    const { repository, runStatus } = fixture()
    repository.seal('root-1', 'completed')
    repository.pause('root-1')
    expect(runStatus('run-1')).toBe('completed')
  })

  it('回归：recoverInterrupted() 跑完整表，已收口的终态一个都不变', () => {
    const { repository, runStatus } = fixture({ runs: [{ id: 'run-1', status: 'running' }, { id: 'run-2', status: 'running' }] })
    repository.seal('root-1', 'failed', { sealRoot: true })
    repository.recoverInterrupted()
    expect(runStatus('run-1')).toBe('failed')
    expect(runStatus('run-2')).toBe('failed')
  })

  // 说明：`root.status === 'sealed'` 正是 `open({ parentRootActionId })` 拒绝续写的那一条判据
  // （`generation-run-repository.ts` 里 `parent.root.status !== 'active'` → GENERATION_PARENT_INVALID）。
  // 这里不真跑 open()：它要一整套合法 binding + policy 构造，而它读的就是这个字段，
  // 真跑只会重复验证同一行 if —— 维护成本高于它带来的信息。
  it('封口后 root 不再是 active（这正是续写会被拒的条件）', () => {
    const { repository, rootStatus } = fixture({ operation: 'chapter-blueprint-directory' })
    repository.seal('root-1', 'completed', { sealRoot: true })
    expect(rootStatus()).toBe('sealed')
    expect(rootStatus()).not.toBe('active')
  })
})
