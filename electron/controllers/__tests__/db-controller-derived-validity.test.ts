import { createRequire } from 'node:module'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 读取侧的**三条早退分支**（§十二「读取」）。
 *
 * ## 这一层守的不是"值对不对"，是三条分支不许再被折成同一个 null
 *
 * `db:volume-handoffs-before` 与 `db:blueprint-get` 都是正文链的输入口。期 2 之前
 * 「库没开 / 表缺 / 这卷没有前置 / 读到了但它旧了」**四种情况压成一个 `null`**，
 * 于是调用方拿到 null 只能当"不用注入" —— 已知过期的交接单照样进每一次正文请求。
 * 折回去的写法很自然（`entry ?? null` 一行就够），所以必须有用例钉住：
 *
 * | 情况 | 返回 | 调用方该做什么 |
 * |---|---|---|
 * | 库没开 / 表缺 | `success:true, entry:null, missing:true` | fail-open，不抛 |
 * | 这卷没有前置 | 同上 | fail-open，不抛 |
 * | 读的过程中抛了 | `success:false` | fail-open，但**不是**"没有前置" |
 * | 读到了但它旧了 | `success:true, entry, validity.stale` | **必拦** |
 *
 * ## 为什么用真库而不是 mock 仓储
 *
 * 判定要跨三张表（`blueprints.source_ref` / `upstream_revisions` / `volumes`），
 * mock 仓储等于把"仓储怎么拼来源"也一起 mock 掉 —— 那样测的是 mock，不是实现。
 * 这里只 mock 进程边界（`electron`、`../database`），仓储与 SQL 全部真跑。
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

// 会话门禁本身不在这批用例的射程内（它有自己的套件）。这里放行，是为了让
// 拔掉门禁之后**被测的那几条分支**能真正跑到 —— 否则每个用例都停在同一个
// `ProjectSessionContextMissing` 上，测不到任何东西。
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
import { PlotTreeRepository } from '../../repositories/plot-tree-repository'
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

beforeAll(() => { registerDatabaseController() })

beforeEach(() => {
  mocks.getProjectDb.mockReset()
})

describe('db:blueprint-get —— 缺失与过期是两件事', () => {
  it('这一章没有卡 ⇒ null（调用方据此早退，不许合成一张空卡）', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      BlueprintRepository.upsertMany([card(1)])
      await expect(call('db:blueprint-get', 9)).resolves.toBeNull()
    } finally { db.close() }
  })

  it('上游改的是别的章 ⇒ 这张卡仍 valid（否则作者改一章就被全本卡住）', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      BlueprintRepository.upsertMany([card(1), card(2)])
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2] }, db)

      const result = await call('db:blueprint-get', 1) as { validity?: { state: string } }
      expect(result.validity).toEqual({ state: 'valid' })
    } finally { db.close() }
  })

  it('上游改的就是本章 ⇒ 带 stale 与「哪一域变了」，让调用方去拦', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      BlueprintRepository.upsertMany([card(1)])
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)

      const result = await call('db:blueprint-get', 1) as {
        validity?: { state: string; behind: Array<{ key: string }> }
      }
      expect(result.validity?.state).toBe('stale')
      expect(result.validity?.behind.map(item => item.key)).toEqual(['outline:book'])
    } finally { db.close() }
  })
})

describe('db:volume-handoffs-before —— 失败 / 没有 / 过期 三态可分辨', () => {
  it('这卷还没有交接单 ⇒ success:true + missing:true（fail-open，不抛）', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      await expect(call('db:volume-handoffs-before', 12)).resolves.toEqual({
        success: true, entry: null, missing: true,
      })
    } finally { db.close() }
  })

  it('库没开 ⇒ 也是 missing（不是 stale，正文链照常能写）', async () => {
    mocks.getProjectDb.mockReturnValue(null)
    await expect(call('db:volume-handoffs-before', 12)).resolves.toEqual({
      success: true, entry: null, missing: true,
    })
  })

  it('读的过程中抛了 ⇒ success:false，且不许伪装成 missing', async () => {
    // 库句柄被换成一个一碰就炸的桩：真实的失败形态是"库正在被关闭/文件被独占"。
    mocks.getProjectDb.mockReturnValue({
      prepare: () => { throw new Error('database is locked') },
    })
    const result = await call('db:volume-handoffs-before', 12) as { success: boolean; missing: boolean }
    expect(result.success).toBe(false)
    expect(result.missing).toBe(false)
  })

  it('交接单读到了但过期 ⇒ success:true + entry + validity.stale', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      BlueprintRepository.upsertMany([card(1)])
      const volumeId = seedVolume(db, 1, 1, 10)
      upsertVolumeHandoff(db, { volumeId, worldState: '卷末世界' })
      // 之后上游又改了一版：来源快照落在旧 rev 上。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)

      const result = await call('db:volume-handoffs-before', 12) as {
        success: boolean
        entry: { handoffId: string } | null
        missing: boolean
        validity?: { state: string }
      }
      expect(result.success).toBe(true)
      expect(result.missing).toBe(false)
      expect(result.entry?.handoffId).toEqual(expect.any(String))
      expect(result.validity?.state).toBe('stale')
    } finally { db.close() }
  })

  it('列表里每一行都带 validity —— 面板靠它出「已过期」徽标', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      BlueprintRepository.upsertMany([card(1)])
      const volumeId = seedVolume(db, 1, 1, 10)
      upsertVolumeHandoff(db, { volumeId, worldState: '卷末世界' })

      const fresh = await call('db:volume-handoffs-list') as {
        entries: Array<{ validity?: { state: string } }>
      }
      expect(fresh.entries.map(entry => entry.validity?.state)).toEqual(['valid'])

      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)
      const stale = await call('db:volume-handoffs-list') as {
        entries: Array<{ validity?: { state: string } }>
      }
      expect(stale.entries.map(entry => entry.validity?.state)).toEqual(['stale'])
    } finally { db.close() }
  })
})

describe('db:plot-tree-read —— 徽标只看 rev，不碰快照 JSON', () => {
  it('生成时上游没变过 ⇒ valid；之后上游改了 ⇒ stale，且快照串一个字节没动', async () => {
    const db = migratedDb()
    try {
      mocks.getProjectDb.mockReturnValue(db)
      BlueprintRepository.upsertMany([card(1)])
      const sources = PlotTreeRepository.read(db)
      PlotTreeRepository.save({
        version: 1,
        generatedAt: '2030-01-02T03:04:05.000Z',
        writingLanguage: 'zh-CN',
        sourceRevision: sources.sourceRevision,
        tracks: [{
          id: 'main', title: '主线', role: 'main', startChapter: 1, endChapter: 1, summary: '主线梗概',
          events: [{
            status: 'planned' as const, chapterNumber: 1, summary: '开局',
            sources: [{ type: 'blueprint' as const, chapterNumber: 1 }],
          }],
        }],
      } as never, sources.sourceRevision, db)

      const fresh = await call('db:plot-tree-read') as {
        validity?: { state: string }; snapshot: unknown; sourceRevision: string
      }
      expect(fresh.validity?.state).toBe('valid')

      const rawBefore = db.prepare("SELECT plot_tree_snapshot FROM project_core WHERE id='main'").pluck().get() as string
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)

      const stale = await call('db:plot-tree-read') as {
        validity?: { state: string; behind: Array<{ key: string }> }
      }
      expect(stale.validity?.state).toBe('stale')
      expect(stale.validity?.behind.map(item => item.key)).toEqual(['outline:book'])

      // 判定结果挂在返回值外层：写进 JSON 会改掉 `targetBaselineHash`，正在跑的生成当场失败（R9）。
      const rawAfter = db.prepare("SELECT plot_tree_snapshot FROM project_core WHERE id='main'").pluck().get() as string
      expect(rawAfter).toBe(rawBefore)
      expect(rawAfter).not.toContain('validity')
    } finally { db.close() }
  })
})
