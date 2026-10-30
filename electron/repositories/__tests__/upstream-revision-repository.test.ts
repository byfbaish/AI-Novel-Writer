import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

import { getProjectDb } from '../../database'
import { ProjectCoreRepository, type ProjectCoreSynopsisExpected } from '../project-core-repository'
import { UpstreamRevisionRepository } from '../upstream-revision-repository'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'

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
 * - `changed_chapters` 取并集而不是覆盖。
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

function revisions(): Array<{ domain: string; scope: string; rev: number; changed: string }> {
  return db.prepare(
    'SELECT domain, scope, rev, changed_chapters AS changed FROM upstream_revisions ORDER BY domain, scope',
  ).all() as Array<{ domain: string; scope: string; rev: number; changed: string }>
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
    expect(revisions()).toEqual([{ domain: 'worldbuilding', scope: 'book', rev: 1, changed: '[]' }])
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
    expect(revisions()).toEqual([{ domain: 'worldbuilding', scope: 'book', rev: 1, changed: '[]' }])
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
    expect(JSON.parse(rows[0].changed)).toEqual([3, 4, 5])
  })

  it('CAS 失败（expected 对不上）⇒ 不 bump —— 版本只描述真的发生了的写入', () => {
    const committed = ProjectCoreRepository.commitSynopsis({
      synopsis: '新大纲',
      expected: synopsisExpected({ synopsis: '库里不是这个值' }),
    })
    expect(committed).toBe(false)
    expect(revisions()).toEqual([])
  })

  it('没有作者手改记录时 changed_chapters 为空数组（= 全部覆盖，宁可多判脏）', () => {
    ProjectCoreRepository.commitSynopsis({ synopsis: '新大纲', expected: synopsisExpected({ synopsis: '' }) })
    expect(revisions()).toEqual([{ domain: 'outline', scope: 'book', rev: 1, changed: '[]' }])
  })
})

describe('UpstreamRevisionRepository', () => {
  it('bump 的 changed_chapters 取并集：同一批连改两段，两段都留', () => {
    UpstreamRevisionRepository.bump({ domain: 'outline', scope: 'u07', changedChapters: [31, 33] })
    UpstreamRevisionRepository.bump({ domain: 'outline', scope: 'u07', changedChapters: [33, 35] })
    const row = UpstreamRevisionRepository.read('outline', 'u07')
    expect(row?.rev).toBe(2)
    // 覆盖成 [33,35] 的话，依赖第 31 章的那条派生会在 rev 已变的情况下被判 valid
    expect(row?.changedChapters).toEqual([31, 33, 35])
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
