import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { M01_GENERATION_SQL } from '../../migrations/m01-generation-runs'
import { GenerationRunRepository, type RunBinding } from '../generation-run-repository'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/** 64 位十六进制假哈希：只为满足来源指纹的形状，不参与任何比较语义。 */
const hash = (seed: string) => seed.padEnd(64, '0').slice(0, 64)

/**
 * 一份「合法形状」的绑定。`synopsis` 那一项代表本链自己写出去的上游内容 ——
 * D1 的现场就是它在批次内被自己改写，进而让第二次调用判成「来源已变更」。
 */
function bindingAt(synopsis: string, refs: readonly { sourceId: string; revision: number }[] = []): RunBinding {
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
    sourceManifest: { operation: 'generate-plot-outline', synopsis },
    sourceRefs: refs.map(ref => ({
      sourceId: ref.sourceId,
      revision: ref.revision,
      contentHash: hash(ref.sourceId),
      projectId: 'project-1',
      epoch: 'epoch-1',
    })) as RunBinding['sourceRefs'],
  }
}

function fixture(options: { runEffects?: unknown } = {}) {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => { initializeLegacyBaselineSchema(db); db.exec(M01_GENERATION_SQL) })()
  db.prepare('INSERT INTO generation_roots(root_action_id,idempotency_key,action_json,budget_json) VALUES(?,?,?,?)')
    .run('root-1', 'idem-1', '{}', '{}')
  const seeded = bindingAt('第13章大纲')
  const payload = options.runEffects === undefined ? seeded : { ...seeded, $runEffects: options.runEffects }
  db.prepare('INSERT INTO generation_runs(run_id,root_action_id,binding_json,status,created_at_ms,open_key) VALUES(?,?,?,?,?,?)')
    .run('run-1', 'root-1', JSON.stringify(payload), 'running', 1, 'open-1')
  const raw = () => JSON.parse(db.prepare('SELECT binding_json FROM generation_runs WHERE run_id=?').pluck().get('run-1') as string)
  return { db, repository: new GenerationRunRepository(() => db), raw }
}

describe('GenerationRunRepository.advanceBinding', () => {
  it('推进成功后绑定换成「执行之后」的那份，本链自写的上游不再判冲突', () => {
    const { repository, raw } = fixture()
    repository.advanceBinding('run-1', bindingAt('第13章大纲 + 第14章大纲'))
    expect(raw().sourceManifest.synopsis).toBe('第13章大纲 + 第14章大纲')
  })

  it('推进只改绑定，不动 run 状态（状态机归别的路径管）', () => {
    const { repository } = fixture()
    repository.advanceBinding('run-1', bindingAt('推进后'))
    expect(repository.get('run-1').status).toBe('running')
  })

  it('`$runEffects` 是运行副作用记录、不参与指纹：推进时必须原样保留', () => {
    const effects = { drafts: [{ chapterNumber: 13 }], sealed: false }
    const { repository, raw } = fixture({ runEffects: effects })
    repository.advanceBinding('run-1', bindingAt('推进后'))
    expect(raw().$runEffects).toEqual(effects)
    // 反过来，get() 不该把副作用混进 binding，否则指纹比对会把它算进去。
    expect(repository.get('run-1').binding).not.toHaveProperty('$runEffects')
  })

  it('没有副作用记录时不会凭空造一个 `$runEffects`', () => {
    const { repository, raw } = fixture()
    repository.advanceBinding('run-1', bindingAt('推进后'))
    expect(raw()).not.toHaveProperty('$runEffects')
  })

  // 说明：`GENERATION_BINDING_ADVANCE_CONFLICT` 是「SELECT 之后、UPDATE 之前被别人改过」才走的
  // 防御分支。better-sqlite3 同步执行，同进程内这两个语句之间没有可插入的窗口，因此**这条分支
  // 在单测里造不出来**（要造只能把 db 层打桩，那测的是桩不是仓储）。这里改为验证它依赖的前提：
  // 每次推进都以**库里的当前绑定**为基线，而不是调用方手里那份快照。
  it('每次推进都以库里的当前绑定为基线：连续推进后以最后一次为准', () => {
    const { repository, raw } = fixture()
    repository.advanceBinding('run-1', bindingAt('第一次推进'))
    repository.advanceBinding('run-1', bindingAt('第二次推进'))
    expect(raw().sourceManifest.synopsis).toBe('第二次推进')
  })

  it('run 不存在 ⇒ GENERATION_RUN_MISSING（不静默当成功）', () => {
    const { repository } = fixture()
    expect(() => repository.advanceBinding('run-missing', bindingAt('推进后'))).toThrow('GENERATION_RUN_MISSING')
  })

  it('绑定没变化时推进是幂等的，不报错', () => {
    const { repository, raw } = fixture()
    const same = repository.get('run-1').binding
    repository.advanceBinding('run-1', same)
    repository.advanceBinding('run-1', same)
    expect(raw().sourceManifest.synopsis).toBe('第13章大纲')
  })

  it('来源引用随推进一起换（下游读的是这份，不是调用方手里的旧对象）', () => {
    const { repository } = fixture()
    repository.advanceBinding('run-1', bindingAt('推进后', [{ sourceId: 'outline:book', revision: 11 }]))
    expect(repository.get('run-1').binding.sourceRefs.map(ref => [ref.sourceId, ref.revision]))
      .toEqual([['outline:book', 11]])
  })
})
