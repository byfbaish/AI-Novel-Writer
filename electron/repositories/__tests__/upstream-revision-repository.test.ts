import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

import { getProjectDb } from '../../database'
import { ProjectCoreRepository, type ProjectCoreSynopsisExpected } from '../project-core-repository'
import { UpstreamRevisionRepository } from '../upstream-revision-repository'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { changedChaptersBetween, type UpstreamDomain } from '../../../src/shared/upstream-revisions'

vi.mock('../../database', () => ({
  getProjectDb: vi.fn(),
}))

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

/**
 * `upstream_revisions` 的写入侧（P2-2 期 1）。
 *
 * 期 1 的验收就一句话：**上游改一次，版本 +1；没改，一动不动。**
 * 但"改"的判定有几个容易做错的岔路，这里逐条钉住：
 *
 * - 按**实际传入的字段**分派域，不按"调了一次接口"（一次 update 可能同时改两个域）；
 * - 配料字段（`writingStyle` / `worldSetting` / `goldenFinger`）**不 bump** —— 它们的
 *   消费者是架构生成，而生成落盘会另走 `worldbuilding` / `synopsis` 的写入点；
 * - `commitSynopsis` **CAS 失败不 bump** —— 版本必须描述真的发生了的写入；
 * - `changed_chapters` 记「**哪一版**改了哪些章」，不取并集（并集会让刚手改的那行被判脏）；
 * - 表不存在时 `bump` 返回 `null` 而不是 `0`（`0` 是合法的「第 0 版」）。
 */
let db: InstanceType<typeof Database>

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  vi.mocked(getProjectDb).mockReturnValue(db)
})

afterEach(() => {
  vi.mocked(getProjectDb).mockReturnValue(null)
  db.close()
})

/**
 * 版本行 + **合并后的章集**（`upstream_revisions.changed_chapters` ∪ 流水）。
 *
 * 不直查 `changed_chapters` 列：S6c 期 2 起章集只记流水，那一列冻结成
 * 「流水建立之前的历史尾巴」。断言列内容等于断言「新代码没干活」。
 */
function revisions(): Array<{ domain: string; scope: string; rev: number; changed: string }> {
  const rows = db.prepare(
    'SELECT domain, scope, rev FROM upstream_revisions ORDER BY domain, scope',
  ).all() as Array<{ domain: string; scope: string; rev: number }>
  return rows.map((row) => {
    const parsed = UpstreamRevisionRepository.read(row.domain as UpstreamDomain, row.scope)
    return { ...row, changed: JSON.stringify(Object.fromEntries(parsed!.changedChapters.byRev)) }
  })
}

/** 构造 commitSynopsis 的 expected —— 默认值与 `project_core` 的 DDL 一致。 */
function synopsisExpected(overrides: Partial<ProjectCoreSynopsisExpected> = {}): ProjectCoreSynopsisExpected {
  return {
    synopsis: '', premise: '', charactersArch: '', worldbuilding: '', plotStructurePlan: '',
    genre: '', totalChapters: 100, wordsPerChapter: 3000, writingLanguage: 'zh-CN',
    plotStructure: 'three_act', narrativePov: 'third_limited', globalGuidance: '',
    ...overrides,
  }
}

describe('ProjectCoreRepository.update 的版本分派', () => {
  it('改世界观 ⇒ worldbuilding:book 到第 1 版，其余域不出现', () => {
    ProjectCoreRepository.update({ worldbuilding: '新的世界观' })
    expect(revisions()).toEqual([{ domain: 'worldbuilding', scope: 'book', rev: 1, changed: '{"1":[]}' }])
  })

  it('再改一次 ⇒ 同一行 +1，不新增行', () => {
    ProjectCoreRepository.update({ worldbuilding: '第一版' })
    ProjectCoreRepository.update({ worldbuilding: '第二版' })
    expect(revisions()).toHaveLength(1)
    expect(revisions()[0].rev).toBe(2)
  })

  it('一次改两个域 ⇒ 两行各 +1（不能按「调了一次接口」只 bump 一个）', () => {
    ProjectCoreRepository.update({ worldbuilding: '世界观', plotStructurePlan: '弧光' })
    expect(revisions().map(row => `${row.domain}:${row.rev}`)).toEqual(['arc:1', 'worldbuilding:1'])
  })

  it('premise 归 worldbuilding 域：故事前提变了，世界观依据也变', () => {
    ProjectCoreRepository.update({ premise: '新的前提' })
    expect(revisions()).toEqual([{ domain: 'worldbuilding', scope: 'book', rev: 1, changed: '{"1":[]}' }])
  })

  it('改配料字段（文风/世界设定/金手指）一律不 bump', () => {
    ProjectCoreRepository.update({
      writingStyle: '冷硬', worldSetting: '作者配的世界', goldenFinger: '系统', coreOutline: '作者的大纲',
    })
    expect(revisions()).toEqual([])
  })

  it('setClauses 为空时直接 return，不留版本行', () => {
    ProjectCoreRepository.update({})
    expect(revisions()).toEqual([])
  })
})

describe('commitSynopsis 的版本分派', () => {
  it('CAS 成功 ⇒ outline:book +1，并记下作者手改覆盖的章区间', () => {
    const committed = ProjectCoreRepository.commitSynopsis({
      synopsis: '新大纲',
      expected: synopsisExpected({ synopsis: '' }),
      authorRecovery: {
        sourceHandle: {} as never, leaseEpoch: 'epoch', operationId: 'op-1',
        committedRange: { from: 3, to: 5 },
      },
    } as never)
    expect(committed).toBe(true)
    const rows = revisions()
    expect(rows).toHaveLength(1)
    expect(rows[0].domain).toBe('outline')
    expect(rows[0].rev).toBe(1)
    expect(JSON.parse(rows[0].changed)).toEqual({ 1: [3, 4, 5] })
  })

  it('CAS 失败（expected 对不上）⇒ 不 bump —— 版本只描述真的发生了的写入', () => {
    const committed = ProjectCoreRepository.commitSynopsis({
      synopsis: '新大纲',
      expected: synopsisExpected({ synopsis: '库里不是这个值' }),
    })
    expect(committed).toBe(false)
    expect(revisions()).toEqual([])
  })

  it('D17：生成落盘带 writtenRange ⇒ 章集只记这些章，不再退化成「全改」', () => {
    ProjectCoreRepository.commitSynopsis({
      synopsis: '新大纲',
      expected: synopsisExpected({ synopsis: '' }),
      writtenRange: { from: 10, to: 10 },
    })
    expect(revisions()).toEqual([{ domain: 'outline', scope: 'book', rev: 1, changed: '{"1":[10]}' }])
    const row = UpstreamRevisionRepository.read('outline', 'book')
    // 收窄真的生效：第 7 章（写于 rev0）不被第 10 章的改动判脏。
    expect(changedChaptersBetween(row!.changedChapters, 0, 1)).toEqual([10])
  })

  it('D17：authorRecovery 优先于 writtenRange（两者不该同时出现，但优先级要钉死）', () => {
    ProjectCoreRepository.commitSynopsis({
      synopsis: '新大纲',
      expected: synopsisExpected({ synopsis: '' }),
      writtenRange: { from: 10, to: 10 },
      authorRecovery: {
        sourceHandle: {} as never, leaseEpoch: 'epoch', operationId: 'op-1',
        committedRange: { from: 3, to: 5 },
      },
    } as never)
    const row = UpstreamRevisionRepository.read('outline', 'book')
    expect(changedChaptersBetween(row!.changedChapters, 0, 1)).toEqual([3, 4, 5])
  })

  it('D17：不传 writtenRange（中断落盘 / 设置面板直写）⇒ 章集为空（= 全部覆盖，宁可多判脏）', () => {
    ProjectCoreRepository.commitSynopsis({ synopsis: '新大纲', expected: synopsisExpected({ synopsis: '' }) })
    expect(revisions()).toEqual([{ domain: 'outline', scope: 'book', rev: 1, changed: '{"1":[]}' }])
  })
})

describe('UpstreamRevisionRepository', () => {
  it('bump 把章集挂在**新 rev 那个键**上，不与旧键取并集', () => {
    // 取并集会让「改 31 → 改 33」之后，写于 rev2 的第 31 章那行被判脏 ——
    // 也就是拒绝作者刚改完的卡（方向反了）。按 rev 存才能只取 (have, need]。
    UpstreamRevisionRepository.bump({ domain: 'outline', scope: 'u07', changedChapters: [31] })
    UpstreamRevisionRepository.bump({ domain: 'outline', scope: 'u07', changedChapters: [33] })
    const row = UpstreamRevisionRepository.read('outline', 'u07')
    expect(row?.rev).toBe(2)
    expect([...row!.changedChapters.byRev.entries()]).toEqual([[1, [31]], [2, [33]]])
  })

  it('mode=replace 在新 rev 上记「全改」（空章集），不改写历史版本', () => {
    UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [31] })
    UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [], mode: 'replace' })
    const row = UpstreamRevisionRepository.read('outline')
    expect(row?.rev).toBe(2)
    // 期 1 时 replace 会**清掉**历史章集；S6c 期 2 起清不掉了 —— 流水是只追加的，
    // 那一版改过 31 章是发生过的事实。判定不受影响：区间 (1, 2] 只取 rev2。
    expect([...row!.changedChapters.byRev.entries()]).toEqual([[1, [31]], [2, []]])
    expect(row!.changedChapters.legacyChapters).toEqual([])
    // 「这一版改动了全部章」的表达就是收窄不了 ⇒ 按全改算。
    expect(changedChaptersBetween(row!.changedChapters, 1, 2)).toBeNull()
  })

  it('表不存在时 bump 返回 null（不是 0）—— 0 是「第 0 版」，两者不能混', () => {
    db.exec('DROP TABLE upstream_revisions')
    expect(UpstreamRevisionRepository.bump({ domain: 'arc' })).toBeNull()
    expect(UpstreamRevisionRepository.ensure('arc')).toBeNull()
  })

  it('ensure 建 rev=0 占位，且幂等', () => {
    expect(UpstreamRevisionRepository.ensure('arc')).toBe(0)
    expect(UpstreamRevisionRepository.ensure('arc')).toBe(0)
    expect(UpstreamRevisionRepository.read('arc')?.rev).toBe(0)
  })

  it('read 对不存在的域返回 null，不返回 0（「没有版本」≠「第 0 版」）', () => {
    expect(UpstreamRevisionRepository.read('worldbuilding')).toBeNull()
    expect(UpstreamRevisionRepository.readRev('worldbuilding')).toBeNull()
  })

  it('snapshot 的键与派生侧 source_ref 同构', () => {
    UpstreamRevisionRepository.bump({ domain: 'worldbuilding' })
    UpstreamRevisionRepository.bump({ domain: 'outline', scope: 'u07' })
    const snapshot = UpstreamRevisionRepository.snapshot()
    expect([...snapshot.keys()].sort()).toEqual(['outline:u07', 'worldbuilding:book'])
  })

  it('snapshotWithOverride 只在键已存在时覆盖 —— 不凭空造域', () => {
    UpstreamRevisionRepository.bump({ domain: 'arc' })
    const snapshot = UpstreamRevisionRepository.snapshotWithOverride([
      { domain: 'arc', rev: 9 },
      // outline 表里没有这一行 ⇒ 忽略，否则会让所有派生都不匹配，报出「全军覆没」的假警报
      { domain: 'outline', scope: 'u99', rev: 9 },
    ])
    expect(snapshot.get('arc:book')).toBe(9)
    expect(snapshot.has('outline:u99')).toBe(false)
  })
})
