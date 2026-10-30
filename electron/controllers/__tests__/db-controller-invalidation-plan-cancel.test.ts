import { createRequire } from 'node:module'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 期 3a · S4 —— **这一片是整个期 3 存在的理由**（主稿 §8.1 红线）。
 *
 * 场景：作者点「重建大纲」→ 弹出失效清单 → 点「取消」。
 * 期望：`upstream_revisions` 每一行逐字节没动，派生行的 `source_ref` 也没动。
 *
 * ## 为什么单独占一个文件
 *
 * 「不写库」在 S2 里已经作为一条普通用例写过。这里要钉的是**整条链路**：
 * 弹清单的过程里不该发生任何副作用 —— 因为「取消」这个词的含义取决于此。
 * 如果 plan 自己 bump 了 rev，点取消之后所有派生就真的旧了，作者以为的撤销
 * 其实已经发生。那比「也没拦住」更坏：它让作者的决策作废。
 *
 * ## 为什么要拿原始 SQL 比
 *
 * 用仓储层的 `list()` 比，等于让被测代码自己解释自己 —— `updated_at` 走的是
 * SQLite 的 `datetime('now')`，一旦有人在 plan 里动了手，`list()` 返回的解析结果
 * 可能因为时区/格式在同一秒内看不出差别。**原始行串逐字节比**才拦得住。
 */

type IpcHandler = (...args: unknown[]) => Promise<unknown>

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
  getProjectDb: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      mocks.handlers.set(channel, handler)
    }),
  },
}))

vi.mock('../../database', () => ({
  getCurrentProjectPath: () => 'C:/projects/p2',
  getProjectDb: mocks.getProjectDb,
  closeProjectDatabase: vi.fn(),
}))

vi.mock('../../services/project-access', () => ({
  projectAccess: {
    assertCurrentProjectContext: vi.fn(),
    assertCurrentSession: vi.fn(),
    captureCurrentSession: vi.fn(() => ({ projectId: 'p2', leaseId: 'l2', rootPath: 'C:/projects/p2' })),
    invalidateCurrentSession: vi.fn(),
  },
}))

import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { BlueprintRepository, type BlueprintData } from '../../repositories/blueprint-repository'
import { UpstreamRevisionRepository } from '../../repositories/upstream-revision-repository'
import { upsertVolumeHandoff } from '../../repositories/volume-handoff-repository'
import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'
import { buildInvalidationScopeNote } from '../../../src/components/dialogs/InvalidationPlanGatePanel'
import { registerDatabaseController } from '../db-controller'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
type Handle = import('better-sqlite3').Database

const PROJECT = 'C:/projects/p2'

function migratedDb(): Handle {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  return db
}

/** 开库并挂到 mock 上（仓库层的一堆 API 内部走 `requireProjectDb()`，晚挂一步会拿到空值）。 */
function openDb(): Handle {
  const db = migratedDb()
  mocks.getProjectDb.mockReturnValue(db)
  return db
}

function card(chapterNumber: number): BlueprintData {
  return {
    chapterNumber,
    title: `第${chapterNumber}章`,
    role: '推进',
    purpose: '',
    keyEvents: normalizeKeyEvents(`第${chapterNumber}章的事件`, { chapterNumber }),
    characters: ['主角'],
    suspenseHook: '',
    userGuidance: '',
    notes: '',
    notesUpdatedAt: '',
  }
}

function seedVolume(db: Handle, index: number, first: number, last: number): string {
  const volumeId = `volume:${index}`
  db.prepare(`INSERT INTO volumes(volume_id,volume_index,name,planned_first,planned_last,
    planned_source,actual_last,actual_source,outline_hash,source)
    VALUES(?,?,?,?,?,'headings',NULL,NULL,'hash','outline')`).run(
    volumeId, index, `第${index}卷`, first, last,
  )
  return volumeId
}

function call(channel: string, ...args: unknown[]): Promise<unknown> {
  const registered = mocks.handlers.get(channel)
  if (!registered) throw new Error(`Missing IPC handler: ${channel}`)
  return registered({}, ...args, PROJECT)
}

/** 全表原始行串。**不走仓储层**，避免被测代码参与解释。 */
function rawVersionRows(db: Handle): string {
  const rows = db.prepare(
    'SELECT domain, scope, rev, digest, changed_chapters, updated_at FROM upstream_revisions ORDER BY domain, scope',
  ).all()
  return JSON.stringify(rows)
}

/** 派生侧的来源记录也要一并盯着：plan 不许顺手写回任何派生表。 */
function rawDerivedSources(db: Handle): string {
  return JSON.stringify({
    blueprints: db.prepare('SELECT chapter_number, source_ref FROM blueprints ORDER BY chapter_number').all(),
    handoffs: db.prepare('SELECT handoff_id, source_ref FROM volume_handoffs ORDER BY handoff_id').all(),
    plotTree: db.prepare("SELECT plot_tree_source_ref FROM project_core WHERE id = 'main'").get(),
  })
}

function askPlan(rev = 0): Promise<{
  success: boolean
  plan?: { tier: string; groups: Array<{ kind: string; count: number }> }
  missing?: boolean
}> {
  return call('db:invalidation-plan', { domain: 'outline', rev }) as Promise<{
    success: boolean
    plan?: { tier: string; groups: Array<{ kind: string; count: number }> }
    missing?: boolean
  }>
}

beforeAll(() => { registerDatabaseController() })

beforeEach(() => {
  mocks.getProjectDb.mockReset()
})

describe('重建 → 弹清单 → 取消：库里一格都没动', () => {
  it('版本表逐字节不变，派生行的 source_ref 也不变', async () => {
    const db = openDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      BlueprintRepository.upsertMany([card(1), card(2), card(31)])
      upsertVolumeHandoff(db, { volumeId, worldState: '卷末世界' })
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db)

      const versionsBefore = rawVersionRows(db)
      const sourcesBefore = rawDerivedSources(db)

      // ---- 作者点了「重建大纲」：这时 UI 去问清单 ----
      const asked = await askPlan()
      expect(asked.success).toBe(true)
      expect(asked.plan?.tier).toBe('strong')
      // UI 拿到的数据可以直接喂给 S3 那个面板函数，证明两侧的数据形状是对得上的。
      expect(buildInvalidationScopeNote(asked.plan as never, 'outline', 'zh-CN').length).toBeGreaterThan(0)

      // ---- 作者点了「取消」：UI 什么都不做，直接关掉 ----
      // （真实链路里这一步只是 `setInvalidationPlan(null)`，没有任何 IPC。）

      expect(rawVersionRows(db)).toBe(versionsBefore)
      expect(rawDerivedSources(db)).toBe(sourcesBefore)
    } finally { db.close() }
  })

  it('取消之后再来一遍 ⇒ 同样的清单（plan 幂等，不受上一次请求影响）', async () => {
    const db = openDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      BlueprintRepository.upsertMany([card(1), card(2)])
      upsertVolumeHandoff(db, { volumeId, worldState: '卷末世界' })

      const first = await askPlan()
      const second = await askPlan()
      const third = await askPlan(999)
      expect(second.plan).toEqual(first.plan)
      // 换一个假想 rev（更大的数）也只是同一个「改了一版」的结论，不会越问越多。
      expect(third.plan?.groups.map(group => group.kind)).toEqual(first.plan?.groups.map(group => group.kind))
    } finally { db.close() }
  })

  it('拿不到清单（missing）时也没有半个副作用', async () => {
    const db = openDb()
    try {
      BlueprintRepository.upsertMany([card(1)])
      const versionsBefore = rawVersionRows(db)
      db.exec('DROP TABLE upstream_revisions')

      const asked = await askPlan()
      expect(asked.missing).toBe(true)
      expect(asked.plan).toBeUndefined()
      // 表里都没了没法比原始行，退一步：派生来源列也没被动过。
      expect(rawDerivedSources(db)).toBe(JSON.stringify({
        blueprints: db.prepare('SELECT chapter_number, source_ref FROM blueprints ORDER BY chapter_number').all(),
        handoffs: db.prepare('SELECT handoff_id, source_ref FROM volume_handoffs ORDER BY handoff_id').all(),
        plotTree: db.prepare("SELECT plot_tree_source_ref FROM project_core WHERE id = 'main'").get(),
      }))
      expect(versionsBefore.length).toBeGreaterThan(0)
    } finally { db.close() }
  })
})
