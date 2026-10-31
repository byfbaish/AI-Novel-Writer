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
import { ProjectCoreRepository } from '../../repositories/project-core-repository'
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
    reason: string
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

  it('rev 传 0 ⇒ 折算成「当前版 + 1」，`behind.need` 不许出现 0', async () => {
    // UI 手边没有当前版本号，用 0 表达「假想再改一版」（见施工图 §六 施工期口径）。
    // 这条钉的是：那个 0 只能在**请求侧**存在，绝不能漏进 `behind.need` ——
    // 一旦漏进去，硬拒文案会写成「第2版→第0版」（S4b 把 need 渲染成"第几版"之后尤其刺眼）。
    const db = openDb()
    try {
      BlueprintRepository.upsertMany([card(1)])
      const current = UpstreamRevisionRepository.snapshot(db).get('outline:book') ?? 0
      const zero = await planFor(db, 0)
      const explicit = await planFor(db, current + 1)
      expect(zero.plan?.groups[0].count).toBe(explicit.plan?.groups[0].count)
      expect(zero.plan).toEqual(explicit.plan)
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

/**
 * 中间环（P2-3 期 3b）：世界观/弧光改了 ⇒ 先报「情节大纲旧了」。
 *
 * 这一环由 M26 的 `project_core.synopsis_source_ref` 提供原料。两条边界要在这里钉：
 * ① 有大纲、有来源 ⇒ 按来源判；② 有大纲、没来源 ⇒ 进 unseen（不准当「没事」）；
 * ③ 压根没有大纲 ⇒ 不进候选（不准报「1 项判断不了」）。
 */
describe('db:invalidation-plan —— 中间环（大纲自己记 world/arc）', () => {
  it('世界观再改一版 ⇒ 清单里出现「情节大纲」，而蓝图不在（那是它的下游）', async () => {
    const db = openDb()
    try {
      // 先有世界/弧光，再落大纲 —— 现实里的顺序就是架构生成先写世界，再写大纲。
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db)
      ProjectCoreRepository.update({ synopsis: '第1章：大纲' })
      BlueprintRepository.upsertMany([card(1)])

      const current = UpstreamRevisionRepository.snapshot(db).get('worldbuilding:book') ?? 0
      mocks.getProjectDb.mockReturnValue(db)
      const result = await call('db:invalidation-plan', {
        domain: 'worldbuilding', rev: current + 1,
      }) as PlanResult

      expect(result.success).toBe(true)
      expect(result.plan?.groups.map(group => group.kind)).toEqual(['outline'])
      expect(result.plan?.groups[0].items[0].label).toBe('情节大纲')
      // 提示但不硬拦：这一档只到 `once`。
      expect(result.plan?.tier).toBe('once')
    } finally { db.close() }
  })

  it('有大纲但没记过来源（存量项目）⇒ 进 unseen，不冒充「没事」', async () => {
    const db = openDb()
    try {
      // 直接写文本、绕开 `update` 的来源登记，模拟 M26 之前留下的存量大纲。
      db.prepare("UPDATE project_core SET synopsis = '第1章：老项目的大纲' WHERE id = 'main'").run()

      const result = await planFor(db, 9)

      expect(result.plan?.groups).toEqual([])
      expect(result.plan?.unseen.kinds).toContain('outline')
    } finally { db.close() }
  })

  it('压根没有大纲 ⇒ 不许出现 outline 那一项（连 unseen 都不行）', async () => {
    const db = openDb()
    try {
      const result = await planFor(db, 9)
      expect(result.plan?.unseen.kinds).not.toContain('outline')
    } finally { db.close() }
  })
})

/**
 * 已定稿章节（S6 / M28）：正文层也要进清单。
 *
 * 这一组的判据全在「定稿那一刻记下的 outline_rev」，所以测试必须**从库里读**，
 * 不能直接给 plan 塞一个假值 —— 真正会坏的地方是写入侧漏记（`-1`），
 * 而漏记的表现恰恰是「清单里安静得像没事」。
 */
describe('db:invalidation-plan —— 已定稿章节（S6 / M28）', () => {
  function seedFinalized(db: Handle, chapterNumber: number, outlineRev: number): void {
    const contentId = 7000 + chapterNumber
    db.prepare('INSERT INTO contents (id, body) VALUES (?, ?)').run(contentId, `第${chapterNumber}章正文`)
    db.prepare(`INSERT INTO drafts (chapter_number, version, status, source, content_id, word_count, source_dependencies, outline_rev)
      VALUES (?, 1, 'finalized', 'write', ?, 1200, '[]', ?)`).run(chapterNumber, contentId, outlineRev)
  }

  function ask(db: Handle, request: Record<string, unknown>): Promise<PlanResult> {
    mocks.getProjectDb.mockReturnValue(db)
    return call('db:invalidation-plan', { domain: 'outline', rev: 0, ...request }) as Promise<PlanResult>
  }

  it('定稿过第 8 章、大纲改到第 9 章 ⇒ 清单里出现「第 8 章」，且强度是 strong', async () => {
    const db = openDb()
    try {
      for (let rev = 1; rev <= 8; rev += 1) {
        UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [8] }, db)
      }
      seedFinalized(db, 8, 8)

      const result = await ask(db, { rev: 9 })
      const finalized = result.plan!.groups.find(group => group.kind === 'finalized')!
      expect(finalized.items.map(item => item.label)).toEqual(['第 8 章'])
      // 只有正文这一组也不许降级：定稿行可能已经发布出去了。
      expect(result.plan!.tier).toBe('strong')
    } finally { db.close() }
  })

  it('落后的那几版都没改过这一章 ⇒ 定稿正文不报（收窄在正文层同样成立）', async () => {
    const db = openDb()
    try {
      // 大纲走了两版：第 2 版动第 12 章，第 3 版动第 13 章。第 8 章定稿于第 1 版。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [12] }, db)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [13] }, db)
      seedFinalized(db, 8, 1)

      // 假想「再改到第 3 版」= 与当前同版。区间 (1, 3] 里两版都有章集记录，
      // 都不含第 8 章 ⇒ 判 valid。
      const result = await ask(db, { rev: 3 })
      expect(result.plan!.groups.map(group => group.kind)).not.toContain('finalized')
      expect(result.plan!.unseen.kinds).not.toContain('finalized')
    } finally { db.close() }
  })

  it('假想「再改一版」而这一版还没有章集记录 ⇒ 按全改算（保守方向，不是「一章没改」）', async () => {
    const db = openDb()
    try {
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [12] }, db)
      seedFinalized(db, 8, 1)

      // `rev: 0` 折算成 current + 1，而那一版**还没发生**，流水里自然没有它的章集。
      // 这里必须报，不能因为「查不到改了哪些章」就当作没事 —— 那是最危险的低估。
      const result = await ask(db, { rev: 0 })
      expect(result.plan!.groups.find(group => group.kind === 'finalized')!.items.map(item => item.label))
        .toEqual(['第 8 章'])
    } finally { db.close() }
  })

  it('M28 之前定稿的（outline_rev = -1）⇒ 进 unseen 的 kinds 里，不冒充「没事」', async () => {
    const db = openDb()
    try {
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [8] }, db)
      seedFinalized(db, 8, -1)

      const result = await ask(db, { rev: 2 })
      expect(result.plan!.groups.map(group => group.kind)).not.toContain('finalized')
      expect(result.plan!.unseen.kinds).toContain('finalized')
    } finally { db.close() }
  })

  it('reason 原样回显；来路不明的值收敛成 unknown（渲染侧只该认取值表那六个）', async () => {
    const db = openDb()
    try {
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [8] }, db)
      seedFinalized(db, 8, 1)

      expect((await ask(db, { rev: 2, reason: 'rollback' })).plan!.reason).toBe('rollback')
      expect((await ask(db, { rev: 2, reason: 'author-edit' })).plan!.reason).toBe('author-edit')
      // 没传 ⇒ unknown（不是空串）；传了乱值也一样。
      expect((await ask(db, { rev: 2 })).plan!.reason).toBe('unknown')
      expect((await ask(db, { rev: 2, reason: '因为我想改' })).plan!.reason).toBe('unknown')
    } finally { db.close() }
  })
})
