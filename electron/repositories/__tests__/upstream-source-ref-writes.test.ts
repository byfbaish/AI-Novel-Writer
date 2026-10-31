import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentProjectPath, getProjectDb } from '../../database'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'
import { derivedStatus, derivedStatusForChapters, describeDrift } from '../../../src/shared/upstream-revisions'
import { BlueprintRepository, type BlueprintData } from '../blueprint-repository'
import { rewriteBlueprintCharacters } from '../blueprint-character-rewrite'
import { parseSourceRefValue } from '../derived-source-ref'
import { PlotTreeRepository } from '../plot-tree-repository'
import { ProjectClearRepository } from '../project-clear-repository'
import { ProjectCoreRepository } from '../project-core-repository'
import { UpstreamRevisionRepository } from '../upstream-revision-repository'
import { readVolumeHandoffSourceRef, upsertVolumeHandoff } from '../volume-handoff-repository'

vi.mock('../../database', () => ({
  getProjectDb: vi.fn(),
  getCurrentProjectPath: vi.fn(),
}))

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')

/**
 * P2-2 期 2 的**写入侧**：三处列写入、三条 bump 通道、两条裸 UPDATE、清除。
 *
 * ## 这批用例守的不是「值对不对」，是四件会静默出错的事
 *
 * 1. **一次保存只推进一版**。`upsertMany(10)` 若在循环里 bump，一次「保存全部」
 *    推进 10 版，`changed_chapters` 立刻长到溢出 —— 溢出后按章收窄永久失效。
 * 2. **刚写完的行必须立刻 `valid`**。章集按 rev 分段存就是为了这个：写于 rev2 的行，
 *    在 rev3 只改了别的章时必须有效。若实现成"累积并集"，作者改完一次就被拒。
 * 3. **列探针在循环外**。`PRAGMA table_info(blueprints)` 每行一次是纯浪费，
 *    而且这是写入侧唯一的放大点（读侧是另一处，见 `§5.6`）。
 * 4. **改角色名 = 改上游**。`characters` 列进正文 prompt；裸 `UPDATE` 不 bump
 *    就会「内容变了版本不变」⇒ 派生仍判 valid ⇒ 静默用旧阵容写正文。
 *
 * 剧情树那条额外守 R9：**来源写新列，不动 JSON** —— `plot_tree_snapshot` 被整体
 * sha256 当 `targetBaselineHash`、又被逐字节比旧串，JSON 一变，正在跑的生成会失败。
 */
function migratedDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.transaction(() => initializeLegacyBaselineSchema(db))()
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  // `project_core` 的 main 行由应用启动流程插，基线 schema 只建表 —— 剧情树与
  // 清除两条路径都要求它存在（`PlotTreeRepository.read` 缺行直接抛）。
  db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
  return db
}

function blueprintFor(chapterNumber: number): BlueprintData {
  return {
    chapterNumber,
    title: `第${chapterNumber}章`,
    role: '推进',
    purpose: `推进第${chapterNumber}章`,
    keyEvents: normalizeKeyEvents(`第${chapterNumber}章发生关键事件`, { chapterNumber }),
    characters: ['主角'],
    suspenseHook: '',
    userGuidance: '',
    notes: '',
    notesUpdatedAt: '',
  }
}

function storedSourceRef(db: InstanceType<typeof Database>, chapterNumber: number) {
  return parseSourceRefValue(
    db.prepare('SELECT source_ref FROM blueprints WHERE chapter_number = ?').pluck().get(chapterNumber),
  )
}

function outlineRev(db: InstanceType<typeof Database>): number | null {
  return UpstreamRevisionRepository.readRev('outline', 'book', db)
}

/** 按读取侧的口径判这一章：快照 + 章集 + 本章章号。 */
function validityOf(db: InstanceType<typeof Database>, chapterNumber: number) {
  return derivedStatusForChapters(
    storedSourceRef(db, chapterNumber),
    UpstreamRevisionRepository.snapshot(db),
    UpstreamRevisionRepository.changeLog(db),
    [chapterNumber],
  )
}

function seedVolume(db: InstanceType<typeof Database>, index: number, first: number, last: number): string {
  const volumeId = `volume:${index}`
  db.prepare(`INSERT INTO volumes(volume_id,volume_index,name,planned_first,planned_last,
    planned_source,actual_last,actual_source,outline_hash,source)
    VALUES(?,?,?,?,?,'headings',NULL,NULL,'hash','outline')`).run(
    volumeId, index, `第${index}卷`, first, last,
  )
  return volumeId
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('派生来源的写入侧（P2-2 期 2）', () => {
  it('保存 10 章只推进 1 版，且这 10 行全部立刻 valid', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      expect(outlineRev(db)).toBeNull()

      BlueprintRepository.upsertMany(Array.from({ length: 10 }, (_, index) => blueprintFor(index + 1)))

      expect(outlineRev(db)).toBe(1)
      for (let chapter = 1; chapter <= 10; chapter += 1) {
        expect(storedSourceRef(db, chapter)).toEqual({ 'outline:book': 1 })
        expect(validityOf(db, chapter).state).toBe('valid')
      }
    } finally { db.close() }
  })

  it('整段提交只推进 1 版，幂等重放不再推进', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      const request = {
        mode: 'replace-range' as const,
        operationId: 'op-phase2',
        startChapter: 1,
        endChapter: 3,
        blueprints: [1, 2, 3].map(blueprintFor),
      }

      BlueprintRepository.commitRange(request, undefined, db)
      expect(outlineRev(db)).toBe(1)
      for (const chapter of [1, 2, 3]) expect(validityOf(db, chapter).state).toBe('valid')

      // 重放：已有操作直接回执、不写行也不 bump（没有产生新内容，版本不该动）。
      BlueprintRepository.commitRange(request, undefined, db)
      expect(outlineRev(db)).toBe(1)
    } finally { db.close() }
  })

  it('单章卡保存推进 1 版，来源指向新版本', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsert(blueprintFor(5), undefined, { bumpOutline: true })

      expect(outlineRev(db)).toBe(1)
      expect(storedSourceRef(db, 5)).toEqual({ 'outline:book': 1 })
      expect(validityOf(db, 5).state).toBe('valid')
    } finally { db.close() }
  })

  it('批量保存 10 行时只探一次 blueprints 列（探针在循环外）', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      const prepare = db.prepare.bind(db)
      let probes = 0
      const spy = vi.spyOn(db, 'prepare').mockImplementation(((sql: string) => {
        if (typeof sql === 'string' && sql.includes('PRAGMA table_info(blueprints)')) probes += 1
        return prepare(sql)
      }) as typeof db.prepare)

      BlueprintRepository.upsertMany(Array.from({ length: 10 }, (_, index) => blueprintFor(index + 1)))
      spy.mockRestore()

      expect(probes).toBe(1)
    } finally { db.close() }
  })

  it('改角色名 = 改上游：推进版本并刷新被改行的来源', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsertMany([blueprintFor(1), blueprintFor(2)])
      expect(outlineRev(db)).toBe(1)

      const changed = rewriteBlueprintCharacters(
        db,
        names => names.map(name => (name === '主角' ? '阿岚' : name)),
      )

      expect(changed).toEqual([1, 2])
      expect(outlineRev(db)).toBe(2)
      for (const chapter of [1, 2]) {
        // 关键：写于 rev2 的行在 rev2 口径下必须 valid —— 章集若取累积并集就会判脏，
        // 变成「每改一次角色名，刚保存的卡立刻被拒」。
        expect(validityOf(db, chapter).state).toBe('valid')
      }
      const names = db.prepare('SELECT characters FROM blueprints WHERE chapter_number = 1').pluck().get() as string
      expect(JSON.parse(names)).toEqual(['阿岚'])
    } finally { db.close() }
  })

  it('角色名没变时不写行、也不推进版本', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsertMany([blueprintFor(1)])
      expect(outlineRev(db)).toBe(1)

      const changed = rewriteBlueprintCharacters(db, names => [...names])

      expect(changed).toEqual([])
      expect(outlineRev(db)).toBe(1)
    } finally { db.close() }
  })

  it('交接单保存写入来源列（保存时刻的版本快照）', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsertMany([blueprintFor(1)])
      const volumeId = seedVolume(db, 1, 1, 10)

      const saved = upsertVolumeHandoff(db, { volumeId, worldState: '卷末世界' })

      expect(readVolumeHandoffSourceRef(db, saved.handoffId)).toEqual({ 'outline:book': 1 })
    } finally { db.close() }
  })

  it('剧情树保存写来源列，且 JSON 字节不变（hash 基准不动）', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsertMany([blueprintFor(1)])
      const sources = PlotTreeRepository.read(db)
      const snapshot = {
        version: 1,
        generatedAt: '2030-01-02T03:04:05.000Z',
        writingLanguage: 'zh-CN',
        sourceRevision: sources.sourceRevision,
        tracks: [{
          id: 'main',
          title: '主线',
          role: 'main',
          startChapter: 1,
          endChapter: 1,
          summary: '主线梗概',
          events: [{
            status: 'planned' as const,
            chapterNumber: 1,
            summary: '开局',
            sources: [{ type: 'blueprint' as const, chapterNumber: 1 }],
          }],
        }],
      }

      PlotTreeRepository.save(snapshot as never, sources.sourceRevision, db)

      expect(PlotTreeRepository.readSourceRef(db)).toEqual({ 'outline:book': 1 })
      // 来源**不在** JSON 里：写进去就会改掉 `targetBaselineHash` 的基准。
      const raw = db.prepare("SELECT plot_tree_snapshot FROM project_core WHERE id = 'main'").pluck().get() as string
      expect(raw).toBe(JSON.stringify(snapshot))
      expect(raw).not.toContain('sourceRef')
    } finally { db.close() }
  })

  it('剧情树重新生成后徽标回到 valid —— JSON 变了不算过期，来源跟着走', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsertMany([blueprintFor(1)])
      const first = PlotTreeRepository.read(db)
      const snapshot = (summary: string) => ({
        version: 1,
        generatedAt: '2030-01-02T03:04:05.000Z',
        writingLanguage: 'zh-CN',
        sourceRevision: first.sourceRevision,
        tracks: [{
          id: 'main', title: '主线', role: 'main', startChapter: 1, endChapter: 1, summary: '主线梗概',
          events: [{
            status: 'planned' as const, chapterNumber: 1, summary,
            sources: [{ type: 'blueprint' as const, chapterNumber: 1 }],
          }],
        }],
      })

      PlotTreeRepository.save(snapshot('开局') as never, first.sourceRevision, db)
      const validityOfTree = () => derivedStatusForChapters(
        PlotTreeRepository.readSourceRef(db),
        UpstreamRevisionRepository.snapshot(db),
        UpstreamRevisionRepository.changeLog(db),
        null,
      )
      expect(validityOfTree()).toEqual({ state: 'valid' })

      // 上游又改了一版（作者改了章节卡 / 加了伏笔）。
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)
      expect(validityOfTree()).toMatchObject({ state: 'stale', behind: [{ key: 'outline:book', have: 1, need: 2 }] })

      // 重新生成剧情树：JSON 内容真的变了（新伏笔进了 events），但**徽标必须回到
      // valid** —— 保存写的是"此刻的上游版本"，而不是"和上次一样的 hash"。
      // 反过来说：如果哪天有人把判定改成比 hash，这一步会永远停在 stale，
      // 作者每次重新生成后都看到"已过期"，那就没人再信这个徽标了（设计稿 R10）。
      const second = PlotTreeRepository.read(db)
      PlotTreeRepository.save(snapshot('开局 + 新伏笔') as never, second.sourceRevision, db)
      expect(validityOfTree()).toEqual({ state: 'valid' })

      const raw = db.prepare("SELECT plot_tree_snapshot FROM project_core WHERE id = 'main'").pluck().get() as string
      expect(raw).toContain('开局 + 新伏笔')
      expect(raw).not.toContain('sourceRef')
    } finally { db.close() }
  })

  it('清除创作字段后版本账与剧情树来源一起归零，重建的章集不含清除前章号', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(null)
      BlueprintRepository.upsertMany([blueprintFor(1), blueprintFor(2)])
      expect(outlineRev(db)).toBe(1)

      ProjectClearRepository.clearGeneratedData({ creativeFields: true, blueprints: true })

      expect(UpstreamRevisionRepository.list(db)).toEqual([])
      expect(db.prepare("SELECT plot_tree_source_ref FROM project_core WHERE id = 'main'").pluck().get()).toBe('')

      // 重建后第一次 bump 是第 1 版，且章集只有新写的章 —— 若版本账没清，
      // `changed_chapters` 会留着清除前的 1、2 章，按章收窄永久噪声。
      BlueprintRepository.upsertMany([blueprintFor(99)])
      const row = UpstreamRevisionRepository.read('outline', 'book', db)
      expect(row?.rev).toBe(1)
      expect(row?.changedChapters.byRev.get(1)).toEqual([99])
      expect(row?.changedChapters.legacyChapters).toEqual([])
    } finally { db.close() }
  })
})

/**
 * `bump` 的 CAS（§十二「并发」）。
 *
 * ## 为什么这条必须写，而不是"同进程撞不上就不测"
 *
 * better-sqlite3 是同步的、单主进程天然串行 —— 这句话在**应用内**成立，但版本账
 * 会被三类外部写入碰：工坊脚本、迁移任务、第三方直接开库。`fenceProjectSession`
 * 是**身份栅栏不是文件锁**，挡不住它们。撞车时的行为只有两种可能，都必须钉死：
 *
 * 1. **悄悄覆盖**：`UPDATE ... SET rev = rev + 1` 不带 `AND rev = ?` ⇒ 两边的
 *    改动被合并成一版，`changed_chapters` 少记一半章 ⇒ 那些章永久不判脏。
 * 2. **抛错**：`changes === 0` 时直接抛 ⇒ 版本是**旁路账本**，它失败会连带
 *    业务写入失败。宁可放弃记版本（派生退回 `legacy`）也不能拦人保存。
 *
 * 实现用「代理 db + 在 `prepare` 时先跑一次竞争写入」来制造撞车 —— 真实并发
 * 无法在单进程同步驱动里复现，但 CAS 的判定条件（`changes === 0`）与真实撞车
 * 完全一致，所以这是**桩注入判定条件**，不是模拟线程。
 */
describe('bump 的 CAS（跨进程并发）', () => {
  /** 让下一次 `UPDATE upstream_revisions` 之前，先有"另一个进程"把它推进一版。 */
  function racingDb(real: InstanceType<typeof Database>, collisions: number) {
    let pending = collisions
    return new Proxy(real, {
      get(target, property, receiver) {
        if (property !== 'prepare') return Reflect.get(target, property, receiver)
        return (sql: string) => {
          if (pending > 0 && sql.includes('UPDATE upstream_revisions')) {
            pending -= 1
            // 竞争者的写入：只动 rev（真实场景里它还会写自己的 changed_chapters，
            // 但这里只要让 CAS 的 `AND rev = ?` 落空就够了）。
            target.prepare("UPDATE upstream_revisions SET rev = rev + 1 WHERE domain = 'outline'").run()
          }
          return target.prepare(sql)
        }
      },
    }) as InstanceType<typeof Database>
  }

  it('撞一次车 ⇒ 重试一次并成功，返回的是重读后的新版本号', () => {
    const db = migratedDb()
    try {
      expect(UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)).toBe(1)
      const racing = racingDb(db, 1)
      // 竞争者把 rev 1 → 2，本次理应写成 3。
      expect(UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2] }, racing)).toBe(3)
      expect(outlineRev(db)).toBe(3)
    } finally { db.close() }
  })

  it('连撞两次 ⇒ 返回 null 且不抛，版本账保持竞争者写下的样子', () => {
    const db = migratedDb()
    try {
      expect(UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)).toBe(1)
      const racing = racingDb(db, 2)
      let result: number | null = 0
      // 旁路账本失败不许变成业务失败：这里要的是 null，不是 reject。
      expect(() => {
        result = UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2] }, racing)
      }).not.toThrow()
      expect(result).toBeNull()
      // 竞争者两次推进：1 → 2 → 3。
      expect(outlineRev(db)).toBe(3)
      // 本次的章集**一条都没记**（没写 rev3 的键）。这是被接受的代价：派生会
      // 判 stale，不会静默 valid —— 宁可多判脏，不可漏判。反过来说，如果这里
      // 出现了 `byRev.get(3) === [2]`，说明 CAS 没生效、我们把别人的版本当自己写的。
      expect(UpstreamRevisionRepository.read('outline', 'book', db)?.changedChapters.byRev.has(3)).toBe(false)
      expect(UpstreamRevisionRepository.read('outline', 'book', db)?.changedChapters.byRev.get(1)).toEqual([1])
    } finally { db.close() }
  })
})

/**
 * 中间环的写侧（P2-3 期 3b · M26）：**大纲自己**也要记一条「基于哪一版世界观/弧光」。
 *
 * 这一条不写，`S6a` 把蓝图收窄成只记 `outline` 之后，「世界改了」在整条链路上
 * 就彻底静默了 —— 作者明确要求补这一环。
 *
 * 三条容易写反的：
 * 1. **必须在 bump 之后算**。同一次 `update` 既改世界观又改大纲时，先算会让
 *    新大纲记成旧世界观的版本 ⇒ 刚写完就判自己旧了（或反过来，记成新版本却
 *    实际基于旧文本）。
 * 2. **空大纲不记来源**。清空之后没有「基于什么」可言；记一个新鲜的版本号会让
 *    「重新生成大纲」永远不提示。
 * 3. 记的是 world + arc，**不记 outline**（派生不记自己）。
 */
describe('大纲的上游来源（M26 中间环）', () => {
  function synopsisRef(db: InstanceType<typeof Database>) {
    return parseSourceRefValue(
      db.prepare("SELECT synopsis_source_ref FROM project_core WHERE id = 'main'").pluck().get(),
    )
  }

  it('落大纲时记下当时的世界观/弧光版本，且不含 outline', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db)
      UpstreamRevisionRepository.bump({ domain: 'arc' }, db)
      UpstreamRevisionRepository.bump({ domain: 'arc' }, db)

      ProjectCoreRepository.update({ synopsis: '第1章：大纲' })

      expect(synopsisRef(db)).toEqual({ 'worldbuilding:book': 1, 'arc:book': 2 })
    } finally { db.close() }
  })

  it('同一次 update 既改世界观又改大纲：记下的是**新**的世界观版本（不是旧的）', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db) // 世界到 1
      ProjectCoreRepository.update({ worldbuilding: '新的世界设定', synopsis: '第1章：按新世界写的大纲' })

      // 世界在这一笔里被推到 2；大纲基于的就是第 2 版。
      expect(UpstreamRevisionRepository.readRev('worldbuilding', 'book', db)).toBe(2)
      expect(synopsisRef(db)).toEqual({ 'worldbuilding:book': 2, 'arc:book': 0 })
    } finally { db.close() }
  })

  it('生成链落盘（commitSynopsis）：CAS 成功才写，且写的是当时的上游', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db)
      const core = ProjectCoreRepository.get(db)!
      const expected = {
        synopsis: core.synopsis, premise: core.premise, charactersArch: core.charactersArch,
        worldbuilding: core.worldbuilding, plotStructurePlan: core.plotStructurePlan,
        genre: core.genre, totalChapters: core.totalChapters, wordsPerChapter: core.wordsPerChapter,
        writingLanguage: core.writingLanguage, plotStructure: core.plotStructure,
        narrativePov: core.narrativePov, globalGuidance: core.globalGuidance,
      }

      expect(ProjectCoreRepository.commitSynopsis({ synopsis: '第1章：生成的大纲', expected }, db)).toBe(true)
      expect(synopsisRef(db)).toEqual({ 'worldbuilding:book': 1, 'arc:book': 0 })

      // 世界观再改一版 ⇒ 大纲这一段就旧了（判定侧据此提示「重建大纲」，不硬拦）。
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db)
      const verdict = derivedStatus(synopsisRef(db), UpstreamRevisionRepository.snapshot(db))
      expect(verdict.state).toBe('stale')
      expect(describeDrift(verdict.state === 'stale' ? verdict.behind : [])).toBe('世界观 第1版→第2版')
    } finally { db.close() }
  })

  it('空大纲清空来源：不留一个「我是最新」的假记录', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      ProjectCoreRepository.update({ synopsis: '第1章：大纲' })
      expect(synopsisRef(db)).not.toBeNull()

      ProjectCoreRepository.update({ synopsis: '   ' })
      // `null`（解析空串）= legacy = 「不知道」，不是「基于最新」。
      expect(synopsisRef(db)).toBeNull()
    } finally { db.close() }
  })
})

/**
 * S6c / M27：溯源流水 `upstream_revision_log`。
 *
 * ## 守的是三件「事后才发现就晚了」的事
 *
 * 1. **每一版都要有行**。版本账只留当前态，`updated_at` 一涨就被覆盖 ——
 *    漏一版就是一段永远取不回来的历史。作者问「它凭什么说我的大纲旧了」，答不上来。
 * 2. **`unknown` 必须是显式值**。空串会被读成「没有这一栏」，于是所有读取方
 *    各写一层兜底；显式 `unknown` 让"还没接线"变成一道可数的待办。
 * 3. **`replace` 不能被读成「一章没改」**。整本重生成改的是全部章，
 *    用空数组兼职表达会被反向理解 —— 所以 `covers_all` 独立成列。
 */
describe('溯源流水（S6c / M27）', () => {
  function migratedDbAt(version: number) {
    const db = new Database(':memory:')
    db.pragma('foreign_keys=ON')
    db.transaction(() => initializeLegacyBaselineSchema(db))()
    migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), version)
    db.prepare("INSERT OR IGNORE INTO project_core(id) VALUES('main')").run()
    return db
  }

  it('每 bump 一版就追加一行：版本号、时间、缺省原因 unknown', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      BlueprintRepository.upsertMany([blueprintFor(1)])
      BlueprintRepository.upsertMany([blueprintFor(2)])

      const history = UpstreamRevisionRepository.history('outline', 'book', db)
      expect(history.map(entry => entry.rev)).toEqual([1, 2])
      expect(history.map(entry => entry.reason)).toEqual(['unknown', 'unknown'])
      // 时间必须真落下来（`datetime('now')`，UTC，与 updated_at 同一口径）。
      for (const entry of history) expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u)
      // 章集逐版独立：第 2 版不该把第 1 章的章号带进来。
      expect(history.map(entry => entry.changedChapters)).toEqual([[1], [2]])
      expect(history.every(entry => entry.coversAll === false)).toBe(true)
    } finally { db.close() }
  })

  it('显式传原因就记下来；整段替换标 coversAll —— 「全部章」不许用空数组兼职', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      UpstreamRevisionRepository.bump({ domain: 'worldbuilding', reason: 'author-edit' }, db)
      UpstreamRevisionRepository.bump({ domain: 'arc', reason: 'regenerate', mode: 'replace' }, db)

      expect(UpstreamRevisionRepository.latestLog('worldbuilding', 'book', db)?.reason).toBe('author-edit')
      const arc = UpstreamRevisionRepository.latestLog('arc', 'book', db)!
      expect(arc.reason).toBe('regenerate')
      // replace ⇒ 改动了**全部**章；`changedChapters: []` 在这里是「说不出具体章」，不是「没改」。
      expect(arc.coversAll).toBe(true)
      expect(arc.changedChapters).toEqual([])
    } finally { db.close() }
  })

  it('表不存在（v27 的老库）⇒ 版本照常推进，只是没有流水；不抛不拦', () => {
    const db = migratedDbAt(27)
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      // 关键：**返回值仍必须是 1 版本号**。若这里因为流水表缺失而返回 null，
      // 调用方会以为「没有版本账」而把 source_ref 留空 ⇒ 整库退回 legacy。
      expect(UpstreamRevisionRepository.bump({ domain: 'worldbuilding' }, db)).toBe(1)
      expect(UpstreamRevisionRepository.hasLog(db)).toBe(false)
      expect(UpstreamRevisionRepository.history('worldbuilding', 'book', db)).toEqual([])
      expect(UpstreamRevisionRepository.readRev('worldbuilding', 'book', db)).toBe(1)
    } finally { db.close() }
  })

  it('清除创作字段 ⇒ 流水一起归零（不许留着上一世的版本史）', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      vi.mocked(getCurrentProjectPath).mockReturnValue(null)
      BlueprintRepository.upsertMany([blueprintFor(1)])
      expect(UpstreamRevisionRepository.history('outline', 'book', db)).toHaveLength(1)

      ProjectClearRepository.clearGeneratedData({ creativeFields: true, blueprints: true })

      expect(UpstreamRevisionRepository.history('outline', 'book', db)).toEqual([])
      expect(UpstreamRevisionRepository.latestLog('worldbuilding', 'book', db)).toBeNull()
    } finally { db.close() }
  })

  it('rev 撞号（导入更早备份后回退再涨）⇒ 两行都留着，最近一条按 id 取', () => {
    const db = migratedDb()
    try {
      vi.mocked(getProjectDb).mockReturnValue(db)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [1] }, db)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [2] }, db)
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [3] }, db)
      expect(UpstreamRevisionRepository.history('outline', 'book', db).map(entry => entry.rev)).toEqual([1, 2, 3])

      // 模拟「导入更早的便携包」：当前态被整行覆盖回 rev1（流水是 D 类，一起被带回来，
      // 但这里只回退当前态就够了 —— 重点是 rev 会再次涨到 2）。
      db.prepare("UPDATE upstream_revisions SET rev = 1 WHERE domain = 'outline' AND scope = 'book'").run()
      UpstreamRevisionRepository.bump({ domain: 'outline', changedChapters: [9], reason: 'import-restore' }, db)

      // **不加唯一约束**是刻意的：加了这一步会让业务写入事务直接失败（见 M27 迁移注释）。
      const revs = UpstreamRevisionRepository.history('outline', 'book', db).map(entry => entry.rev)
      expect(revs).toEqual([1, 2, 2, 3])
      const latest = UpstreamRevisionRepository.latestLog('outline', 'book', db)!
      expect(latest.rev).toBe(2)
      expect(latest.reason).toBe('import-restore')
      expect(latest.changedChapters).toEqual([9])
    } finally { db.close() }
  })
})
