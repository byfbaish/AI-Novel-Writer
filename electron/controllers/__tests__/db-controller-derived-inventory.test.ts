import { createRequire } from 'node:module'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `db:derived-inventory` 的四组验收（S7，2026-11-01）。
 *
 * ## 这一层守的是「清点页和强提醒不许自相矛盾」
 *
 * 两条通道都走 `computeInvalidationPlan`，差别只在 `overrides`：
 * plan 传一个假想版本（「再改一版会怎样」），清点传空数组（「现在已经怎样」）。
 * 所以本文件里**每一个"原来旧了"的用例，都同时用 `db:invalidation-plan` 复核一遍** ——
 * 两份判据若哪天分家，这里会先红。
 *
 * ## 三条失败面不许合并（主稿 §9.2）
 *
 * 「版本表不存在」「这次读崩了」「确实没有要处置的」是三个不同的事实。
 * 折成一份空清单，作者会把「不知道」读成「没问题」—— 那是 blast radius 最危险的低估。
 *
 * ## `at` 只能来自流水
 *
 * `upstream_revisions.updated_at` 是**当前态**被覆盖的时间。有版本行但没有流水
 * （M27 之前的老库）时必须给 `null`，拿 `updated_at` 冒充会说成一件没发生的事。
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
  getCurrentProjectPath: () => 'C:/projects/p7',
  getProjectDb: mocks.getProjectDb,
  closeProjectDatabase: vi.fn(),
}))

vi.mock('../../services/project-access', () => ({
  projectAccess: {
    assertCurrentProjectContext: vi.fn(),
    assertCurrentSession: vi.fn(),
    captureCurrentSession: vi.fn(() => ({ projectId: 'p7', leaseId: 'l7', rootPath: 'C:/projects/p7' })),
    invalidateCurrentSession: vi.fn(),
  },
}))

import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { BlueprintRepository, type BlueprintData } from '../../repositories/blueprint-repository'
import { UpstreamRevisionRepository } from '../../repositories/upstream-revision-repository'
import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'
import { BOOK_SCOPE } from '../../../src/shared/upstream-revisions'
import { registerDatabaseController } from '../db-controller'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
type Handle = import('better-sqlite3').Database

const PROJECT = 'C:/projects/p7'

function migratedDb(): Handle {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  return db
}

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

/** 造一条已定稿正文（S6 的 `drafts.outline_rev` 就是清点页要判的那一列）。 */
function seedFinalizedDraft(db: Handle, chapterNumber: number, outlineRev: number): number {
  const contentId = chapterNumber * 100
  db.prepare('INSERT INTO contents(id, body) VALUES(?, ?)').run(contentId, `第${chapterNumber}章正文`)
  const result = db.prepare(`
    INSERT INTO drafts(chapter_number, version, status, content_id, word_count, outline_rev)
    VALUES(?, 1, 'finalized', ?, 100, ?)
  `).run(chapterNumber, contentId, outlineRev)
  return Number(result.lastInsertRowid)
}

function call(channel: string, ...args: unknown[]): Promise<unknown> {
  const registered = mocks.handlers.get(channel)
  if (!registered) throw new Error(`Missing IPC handler: ${channel}`)
  return registered({}, ...args, PROJECT)
}

interface InventoryResult {
  success: boolean
  inventory?: {
    groups: Array<{ kind: string; count: number; items: Array<{ label: string }> }>
    unseen: { count: number; kinds: string[] }
    upstream: Array<{ domain: string; scope: string; rev: number; at: string | null; reason: string }>
    finalizedDrafts: Array<{ chapterNumber: number; draftId: number }>
    scannedAt: string
  }
  missing?: boolean
  error?: string
}

interface PlanResult {
  success: boolean
  plan?: { groups: Array<{ kind: string; count: number }>; unseen: { count: number } }
}

function inventoryFor(db: Handle): Promise<InventoryResult> {
  mocks.getProjectDb.mockReturnValue(db)
  return call('db:derived-inventory') as Promise<InventoryResult>
}

beforeAll(() => { registerDatabaseController() })

beforeEach(() => {
  mocks.getProjectDb.mockReset()
})

describe('db:derived-inventory —— 拿不到就报拿不到', () => {
  it('库没开 ⇒ missing，不是空清单', async () => {
    mocks.getProjectDb.mockReturnValue(null)
    await expect(call('db:derived-inventory')).resolves.toEqual({ success: false, missing: true })
  })

  it('版本表不存在 ⇒ missing（v24 之前的老项目）', async () => {
    const db = openDb()
    try {
      db.exec('DROP TABLE upstream_revisions')
      mocks.getProjectDb.mockReturnValue(db)
      await expect(call('db:derived-inventory')).resolves.toEqual({ success: false, missing: true })
    } finally { db.close() }
  })
})

describe('db:derived-inventory —— 判的是现状，不是假想', () => {
  it('蓝图落后 ⇒ 清单里有它，且与「再改一版」的清单同源', async () => {
    const db = openDb()
    try {
      UpstreamRevisionRepository.ensure('outline', BOOK_SCOPE, db)
      BlueprintRepository.upsertMany([card(1)])
      // 第 1 章被改过 ⇒ 基于第 1 版写的那张卡真的旧了。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1], reason: 'author-edit' }, db)

      const inventory = await inventoryFor(db)
      expect(inventory.success).toBe(true)
      expect(inventory.inventory?.groups.map(group => group.kind)).toEqual(['blueprint'])
      expect(inventory.inventory?.groups[0]?.items[0]?.label).toBe('第 1 章')

      // 复核：同一份判定在 plan 通道里也得说「第 1 章旧了」，否则两条通道已经分家。
      const plan = await call('db:invalidation-plan', { domain: 'outline', rev: 0 }) as PlanResult
      expect(plan.success).toBe(true)
      expect(plan.plan?.groups.map(group => group.kind)).toContain('blueprint')
    } finally { db.close() }
  })

  it('刚写完的蓝图不算旧：groups 为空，只有没记过来源的剧情树进 unseen', async () => {
    const db = openDb()
    try {
      UpstreamRevisionRepository.ensure('outline', BOOK_SCOPE, db)
      BlueprintRepository.upsertMany([card(4), card(5)])

      const inventory = await inventoryFor(db)
      expect(inventory.inventory?.groups).toEqual([])
      // 剧情树从未记过来源 ⇒ legacy；**如实报**，不折成 0。
      expect(inventory.inventory?.unseen).toEqual({ count: 1, kinds: ['plot-tree'] })
    } finally { db.close() }
  })
})

describe('db:derived-inventory —— 抬头行（为什么旧了）', () => {
  it('有流水 ⇒ rev / 时间 / 原因都带上', async () => {
    const db = openDb()
    try {
      // 两次 bump：清点页要报的是**最近一版**，只 bump 一次的话「上一版」和「当前版」
      // 分不开，这条断言就测不出「取的是最后一条流水」。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1], reason: 'author-edit' }, db)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2], reason: 'regenerate' }, db)

      const inventory = await inventoryFor(db)
      const line = inventory.inventory?.upstream.find(entry => entry.domain === 'outline')
      expect(line?.rev).toBe(2)
      expect(line?.reason).toBe('regenerate')
      expect(typeof line?.at).toBe('string')
      expect(line?.at?.length).toBeGreaterThan(0)
    } finally { db.close() }
  })

  it('有版本行但没有流水（M27 之前的老库）⇒ at 是 null，不许拿 updated_at 冒充', async () => {
    const db = openDb()
    try {
      db.prepare(`
        INSERT INTO upstream_revisions(domain, scope, rev, digest, changed_chapters, updated_at)
        VALUES('outline', ?, 3, '', '[]', datetime('now'))
      `).run(BOOK_SCOPE)

      const inventory = await inventoryFor(db)
      const line = inventory.inventory?.upstream.find(entry => entry.domain === 'outline')
      expect(line?.rev).toBe(3)
      expect(line?.at).toBeNull()
      expect(line?.reason).toBe('unknown')
    } finally { db.close() }
  })
})

describe('db:derived-inventory —— 定稿章（S6 / M28）', () => {
  it('定稿于旧大纲 ⇒ 进 finalized 组，并带上跳转要用的 draftId', async () => {
    const db = openDb()
    try {
      // 第 1 版：定稿那一章记的就是它。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1], reason: 'author-edit' }, db)
      const draftId = seedFinalizedDraft(db, 3, 1)
      // 第 2 版：只改第 3 章 ⇒ 这一章定稿时依据的第 1 版已过时。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [3], reason: 'author-edit' }, db)

      const inventory = await inventoryFor(db)
      const group = inventory.inventory?.groups.find(entry => entry.kind === 'finalized')
      expect(group?.count).toBe(1)
      expect(group?.items[0]?.label).toBe('第 3 章')
      expect(inventory.inventory?.finalizedDrafts).toEqual([{ chapterNumber: 3, draftId }])
    } finally { db.close() }
  })
})
