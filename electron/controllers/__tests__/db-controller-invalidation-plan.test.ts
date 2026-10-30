import { createRequire } from 'node:module'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `db:invalidation-plan` 的四条验收（期 3a · S2）。
 *
 * ## 这一层守的不是"算法对不对"，是三条边界不许被折回去
 *
 * | 情况 | 返回 | 谁依赖它 |
 * |---|---|---|
 * | 库没开 / 版本表不存在 | `success:false, missing:true` | UI 显示「拿不到清单」 |
 * | 算得出 | `success:true, plan` | 三档确认框 |
 * | **调用前后一点没写** | 全表逐字节相同 | 「取消」必须是真取消（§8.1 红线） |
 *
 * 第一条最容易被"顺手优化"掉：返回一份空 plan 也能让 UI 正常渲染，而 UI 会把空清单
 * 读成「影响 0 项」—— 作者据此判断"这一刀没有代价"。所以 `missing` 必须是一个
 * 独立的返回值，不能退化成 plan。
 *
 * ## 为什么第三条最重要
 *
 * plan 是**预告**：它问「如果再改一版会怎样」。一旦 plan 自己动了版本表，取消就不是
 * 取消 —— 取消之后所有派生真的都旧了。这不是"写脏数据"，是把作者的决策作废掉。
 *
 * ## 为什么用真库
 *
 * 判定要跨 `blueprints.source_ref` / `upstream_revisions` / `handoffs.source_ref`
 * 三张表，mock 仓储等于把"来源怎么拼"也一起 mock 掉。这里只 mock 进程边界。
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

/**
 * 开库并立刻挂到 mock 上。
 *
 * **必须在这里挂，不能只在实际调 IPC 那一步挂**：`upsertMany` / `upsertVolumeHandoff`
 * 内部走 `requireProjectDb()` 取默认库，晚挂一步会拿到 `beforeEach` 刚 reset 出来的空值。
 */
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

interface PlanResult {
  success: boolean
  plan?: {
    groups: Array<{ kind: string; count: number; items: Array<{ label: string }> }>
    unseen: { count: number; kinds: string[] }
    tier: string
    unaffected: { from: number; to: number } | null
  }
  missing?: boolean
  error?: string
}

/** 问一句「如果 outline 再改到 `rev` 会怎样」。**plan 不落库，所以 rev 可以随便给。 */
function planFor(db: Handle, rev: number): Promise<PlanResult> {
  mocks.getProjectDb.mockReturnValue(db)
  return call('db:invalidation-plan', { domain: 'outline', rev }) as Promise<PlanResult>
}

beforeAll(() => { registerDatabaseController() })

beforeEach(() => {
  mocks.getProjectDb.mockReset()
})

describe('db:invalidation-plan —— 拿不到清单不许装作「没影响」', () => {
  it('库没开 ⇒ missing，不是空 plan', async () => {
    mocks.getProjectDb.mockReturnValue(null)
    await expect(call('db:invalidation-plan', { domain: 'outline', rev: 2 })).resolves.toEqual({
      success: false,
      missing: true,
    })
  })

  it('版本表不存在 ⇒ missing（未升到 v26 的旧库走这里）', async () => {
    const db = openDb()
    try {
      db.exec('DROP TABLE upstream_revisions')
      mocks.getProjectDb.mockReturnValue(db)
      await expect(call('db:invalidation-plan', { domain: 'outline', rev: 2 })).resolves.toEqual({
        success: false,
        missing: true,
      })
    } finally { db.close() }
  })
})

describe('db:invalidation-plan —— 清单内容', () => {
  it('蓝图 + 交接单算得出；没有来源记录的存量项进 unseen 不进 groups', async () => {
    const db = openDb()
    try {
      const volumeId = seedVolume(db, 1, 1, 20)
      BlueprintRepository.upsertMany([card(1), card(2)])
      upsertVolumeHandoff(db, { volumeId, worldState: '卷末世界' })

      const result = await planFor(db, 99)
      expect(result.success).toBe(true)
      expect(result.plan?.groups.map(group => group.kind)).toEqual(['blueprint', 'handoff'])
      expect(result.plan?.tier).toBe('strong')
      // 剧情树从未记过来源 ⇒ legacy ⇒ 只进 unseen，不混进要处置的清单里。
      expect(result.plan?.unseen.count).toBe(1)
      expect(result.plan?.unseen.kinds).toEqual(['plot-tree'])
    } finally { db.close() }
  })

  it('假想 rev 等于当前 rev ⇒ 组全空；tier 由 unseen 决定，不是无脑 silent', async () => {
    const db = openDb()
    try {
      BlueprintRepository.upsertMany([card(1)])
      const current = UpstreamRevisionRepository.snapshot(db).get('outline:book') ?? 0
      const result = await planFor(db, current)
      expect(result.plan?.groups).toEqual([])
      // `silent` 的条件是「组空**且**看不见的派生也是 0」（主稿 §8.3）。这个库里剧情树
      // 从来没记过来源 ⇒ legacy ⇒ unseen 有一条 ⇒ once。想看到 silent，得先让剧情树
      // 也有来源记录（补登记的那一环在 S6c，本期不做）。
      expect(result.plan?.unseen.kinds).toEqual(['plot-tree'])
      expect(result.plan?.tier).toBe('once')
    } finally { db.close() }
  })

  it('改别的章 ⇒ 只有被改到的那张蓝图进清单（不是全本）', async () => {
    const db = openDb()
    try {
      BlueprintRepository.upsertMany([card(1), card(2)])
      const current = UpstreamRevisionRepository.snapshot(db).get('outline:book') ?? 0
      // 假想「再改一版，动第 2 章」：changes 里不会有这一版的记录 ⇒ 无法收窄 ⇒
      // 按全部章处理 ⇒ 两张都进清单。这条钉的是"收窄只在有原料时发生"。
      const withNoTrace = await planFor(db, current + 1)
      expect(withNoTrace.plan?.groups[0].count).toBe(2)

      // 有了改动章记录之后，只被改到的那一章进清单。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2] }, db)
      BlueprintRepository.upsertMany([card(2)])
      const next = UpstreamRevisionRepository.snapshot(db).get('outline:book') ?? 0
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2] }, db)
      const narrowed = await planFor(db, next + 1)
      expect(narrowed.plan?.groups[0].items.map(item => item.label)).toEqual(['第 2 章'])
    } finally { db.close() }
  })
})

describe('db:invalidation-plan —— 红线：plan 一个字节都不写', () => {
  it('调用前后 upstream_revisions 的 rev / updated_at / changed_chapters 逐字节不变', async () => {
    const db = openDb()
    try {
      BlueprintRepository.upsertMany([card(1), card(2)])
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)

      const before = UpstreamRevisionRepository.list(db)
      const result = await planFor(db, 999)
      const after = UpstreamRevisionRepository.list(db)

      expect(result.success).toBe(true)
      expect(after).toEqual(before)
    } finally { db.close() }
  })
})
