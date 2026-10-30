import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentProjectPath, getProjectDb } from '../../database'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { CURRENT_DESKTOP_SCHEMA_VERSION, getDesktopMigrationRegistry } from '../../migrations/desktop-registry'
import { migrateSchema } from '../../migrations/runner'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { normalizeKeyEvents } from '../../../src/shared/blueprint-key-events'
import { derivedStatusForChapters } from '../../../src/shared/upstream-revisions'
import { BlueprintRepository, type BlueprintData } from '../blueprint-repository'
import { rewriteBlueprintCharacters } from '../blueprint-character-rewrite'
import { parseSourceRefValue } from '../derived-source-ref'
import { PlotTreeRepository } from '../plot-tree-repository'
import { ProjectClearRepository } from '../project-clear-repository'
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
