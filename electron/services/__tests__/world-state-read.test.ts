import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { initializeLegacyBaselineSchema } from '../../migrations/baseline-schema'
import { getDesktopMigrationRegistry, CURRENT_DESKTOP_SCHEMA_VERSION } from '../../migrations/desktop-registry'
import { SqliteSchemaAdapter } from '../../migrations/sqlite-schema-adapter'
import { migrateSchema } from '../../migrations/runner'
import { listCurrentReviewStateDeltaMentions } from '../../repositories/review-cycle-repository'
import { readWorldState } from '../world-state-read'

const Database = createRequire(import.meta.url)('better-sqlite3') as typeof import('better-sqlite3')
type Db = import('better-sqlite3').Database

const open: Db[] = []
afterEach(() => { for (const db of open.splice(0)) db.close() })

const prose = '林岚走进北塔。陆沉收起木牌。'

function fixture(options: { characters?: string[] } = {}) {
  const db = new Database(':memory:')
  open.push(db)
  initializeLegacyBaselineSchema(db)
  for (const name of options.characters ?? []) db.prepare('INSERT INTO characters(name) VALUES(?)').run(name)
  migrateSchema(new SqliteSchemaAdapter(db), getDesktopMigrationRegistry(), CURRENT_DESKTOP_SCHEMA_VERSION)
  const id = (name: string) => db.prepare('SELECT character_id FROM characters WHERE name=?').pluck().get(name) as string
  return { db, id }
}

function addDraft(db: Db, options: { chapterNumber: number; body?: string; version?: number; status?: string }) {
  const contentId = Number(db.prepare('INSERT INTO contents(body) VALUES(?)').run(options.body ?? '').lastInsertRowid)
  const draftId = Number(db.prepare('INSERT INTO drafts(chapter_number,version,status,content_id) VALUES(?,?,?,?)')
    .run(options.chapterNumber, options.version ?? 1, options.status ?? 'finalized', contentId).lastInsertRowid)
  return { draftId, contentId }
}

function addSnapshot(db: Db, draft: { draftId: number }, options: {
  chapterNumber: number
  chapterNotes?: string | null
  storyDayOffset?: number | null
  storyDayLabel?: string | null
  candidates?: unknown
  facts?: unknown
  candidatesRaw?: string
  factsRaw?: string
}) {
  db.prepare(`INSERT INTO summary_snapshots(draft_id,chapter_number,chapter_notes,continuity_facts,
    character_state_candidates,story_day_offset,story_day_label) VALUES(?,?,?,?,?,?,?)`).run(
    draft.draftId,
    options.chapterNumber,
    options.chapterNotes === undefined ? '本章摘要' : options.chapterNotes,
    options.factsRaw ?? JSON.stringify(options.facts ?? []),
    options.candidatesRaw ?? JSON.stringify(options.candidates ?? []),
    options.storyDayOffset ?? null,
    options.storyDayLabel ?? null,
  )
}

function addBlueprint(db: Db, chapterNumber: number, characters: unknown, raw = false) {
  db.prepare('INSERT INTO blueprints(chapter_number,title,characters) VALUES(?,?,?)')
    .run(chapterNumber, '合成章节', raw ? characters as string : JSON.stringify(characters))
}

const report = (stateDelta?: unknown) => ({
  summary: '整体通过。',
  items: [{ category: '连贯性', severity: 'pass', description: '未见矛盾。' }],
  goalReview: { version: 1, chapterNumber: 1, coverage: 'not_configured', items: [] },
  ...(stateDelta === undefined ? {} : { stateDelta }),
})

function addReview(db: Db, options: { draftId: number; chapterNumber: number; stateDelta?: unknown; sourceContent?: string | null }) {
  const contentId = Number(db.prepare('INSERT INTO contents(body) VALUES(?)').run(JSON.stringify(report(options.stateDelta))).lastInsertRowid)
  db.prepare(`INSERT INTO reviews(base_draft_id,review_index,source_draft_chapter_number,source_draft_version,
    source_draft_status,source_content,content_id) VALUES(?,?,?,?,?,?,?)`).run(
    options.draftId, 1, options.chapterNumber, 1, 'finalized', options.sourceContent ?? null, contentId,
  )
}

function addAlias(db: Db, characterId: string, name: string) {
  db.prepare('INSERT INTO character_aliases(character_id,name,source_key,valid_from,valid_through) VALUES(?,?,?,0,NULL)')
    .run(characterId, name, `test:${name}`)
}

function addAnchor(db: Db, name: string, action: 'register' | 'revoke' = 'register', anchorRole = 'mentor') {
  db.prepare(`INSERT INTO character_cast_decisions(decision_id,name,anchor_role,catchphrase,
    relation_to_protagonist,action,source_revision,operation_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    `decision-${name}-${action}`, name, anchorRole, '', '', action, 0, `operation-${name}`, '2026-10-22T00:00:00.000Z',
  )
}

const statusOf = (view: ReturnType<typeof readWorldState>, name: string) => {
  const entry = view.castLedger.entries.find(item => item.name === name)
  if (!entry) throw new Error(`归位表缺少条目: ${name}`)
  return entry
}

describe('W5 world state read service', () => {
  it('collects mentions from blueprint, finalized candidates and review stateDelta', () => {
    const { db } = fixture({ characters: ['林岚'] })
    const draft = addDraft(db, { chapterNumber: 1, body: prose })
    addSnapshot(db, draft, {
      chapterNumber: 1,
      candidates: [{ characterName: '周研', field: 'location', value: '北塔' }],
      facts: [{ category: 'timeline', entities: ['林岚'], statement: '当夜停电。', sourceChapter: 1, evidence: '林岚走进北塔。' }],
    })
    addReview(db, {
      draftId: draft.draftId,
      chapterNumber: 1,
      stateDelta: [{ characterName: '陆沉', field: 'keyItems', observed: '半块木牌', quote: '陆沉收起木牌。' }],
      sourceContent: prose,
    })
    addBlueprint(db, 1, ['顾星'])

    const view = readWorldState(db, 'C:/projects/A')

    expect(view.projectPath).toBe('C:/projects/A')
    expect(new Set(view.castLedger.entries.map(entry => entry.name))).toEqual(new Set(['顾星', '周研', '陆沉']))
    expect(statusOf(view, '顾星').mentions).toContainEqual({ name: '顾星', source: 'blueprint', chapterNumber: 1 })
    expect(statusOf(view, '周研').mentions).toContainEqual({ name: '周研', source: 'finalized-proposal', chapterNumber: 1 })
    expect(statusOf(view, '陆沉').mentions).toContainEqual({ name: '陆沉', source: 'review-state-delta', chapterNumber: 1 })
    expect(view.unreadableMentions).toEqual({ review: 0, finalized: 0, blueprint: 0 })
    expect(view.chapters).toHaveLength(1)
    expect(view.chapters[0].observations).toEqual([{
      characterName: '周研', characterId: null, field: 'location', value: '北塔',
      evidence: null, reviewObserved: null, reviewQuote: null, reason: null,
    }])
    expect(view.continuityFacts).toEqual([{ chapterNumber: 1, text: '当夜停电。' }])
  })

  it('treats aliases as equivalent display names and never lands on a retired card', () => {
    const { db, id } = fixture({ characters: ['林岚', '沈舟'] })
    addAlias(db, id('林岚'), '阿岚')
    db.prepare('UPDATE characters SET retired=1 WHERE character_id=?').run(id('沈舟'))
    addBlueprint(db, 1, ['阿岚', '沈舟'])

    const view = readWorldState(db, 'C:/projects/A')

    expect(statusOf(view, '阿岚')).toMatchObject({ status: 'carded', characterIds: [id('林岚')] })
    // 退休卡不是落点：名字被点名过、但没有任何可用卡接住 → orphan。
    expect(statusOf(view, '沈舟')).toMatchObject({ status: 'orphan', characterIds: [] })
    expect(view.characters.map(character => character.name)).toEqual(['林岚'])
  })

  it('anchors register decisions, flags multiple cards as ambiguous and sorts by status', () => {
    const { db, id } = fixture({ characters: ['周研', '陆沉甲', '陆沉乙'] })
    addAlias(db, id('陆沉甲'), '陆沉')
    addAlias(db, id('陆沉乙'), '陆沉')
    addAnchor(db, '顾星')
    addAnchor(db, '韩青', 'register')
    addAnchor(db, '韩青', 'revoke')
    addBlueprint(db, 1, ['顾星', '韩青', '陆沉', '路人', '周研'])

    const view = readWorldState(db, 'C:/projects/A')

    expect(statusOf(view, '顾星')).toMatchObject({ status: 'anchored', anchorRole: 'mentor' })
    // 最后一次决定是 revoke：不构成锚点。
    expect(statusOf(view, '韩青').status).toBe('orphan')
    expect(statusOf(view, '陆沉')).toMatchObject({ status: 'ambiguous' })
    expect(new Set(statusOf(view, '陆沉').characterIds)).toEqual(new Set([id('陆沉甲'), id('陆沉乙')]))
    expect(statusOf(view, '路人').status).toBe('orphan')
    expect(statusOf(view, '周研')).toMatchObject({ status: 'carded', characterIds: [id('周研')] })
    const ranks: Record<string, number> = { orphan: 0, ambiguous: 1, anchored: 2, carded: 3 }
    const order = view.castLedger.entries.map(entry => ranks[entry.status])
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(view.castLedger.counts).toEqual({ orphan: 2, ambiguous: 1, anchored: 1, carded: 1 })
  })

  it('does not trust a review written against different prose and counts the chapter as unreadable', () => {
    const { db } = fixture()
    const draft = addDraft(db, { chapterNumber: 1, body: '定稿正文。' })
    addReview(db, {
      draftId: draft.draftId, chapterNumber: 1,
      stateDelta: [{ characterName: '陆沉', field: 'keyItems', observed: '半块木牌', quote: '陆沉收起木牌。' }],
      sourceContent: '审稿时读到的旧正文。',
    })

    const view = readWorldState(db, 'C:/projects/A')

    expect(view.castLedger.entries).toEqual([])
    expect(view.unreadableMentions.review).toBe(1)
    expect(listCurrentReviewStateDeltaMentions(db)).toEqual({ mentions: [], unreadableChapters: [1] })
  })

  it('survives malformed JSON and counts the unreadable rows', () => {
    const { db } = fixture()
    const draft = addDraft(db, { chapterNumber: 1, body: prose })
    addSnapshot(db, draft, { chapterNumber: 1, candidatesRaw: '这不是 JSON' })
    addBlueprint(db, 1, '这不是 JSON', true)

    const view = readWorldState(db, 'C:/projects/A')

    expect(view.unreadableMentions).toEqual({ review: 0, finalized: 1, blueprint: 1 })
    expect(view.castLedger.entries).toEqual([])
    expect(view.chapters).toHaveLength(1)
    expect(view.chapters[0].observations).toEqual([])
  })

  it('keeps a NULL story day as null instead of zero', () => {
    const { db } = fixture()
    const first = addDraft(db, { chapterNumber: 1, body: prose })
    addSnapshot(db, first, { chapterNumber: 1 })
    const second = addDraft(db, { chapterNumber: 2, body: prose })
    addSnapshot(db, second, { chapterNumber: 2, storyDayOffset: 0, storyDayLabel: '第0日' })

    const view = readWorldState(db, 'C:/projects/A')

    expect(view.chapters).toHaveLength(2)
    expect(view.chapters[0].storyDayOffset).toBeNull()
    expect(view.chapters[0].storyDayOffset).not.toBe(0)
    expect(view.chapters[0].storyDayLabel).toBeNull()
    // 0 是合法日序，不能被当成「未知」抹掉。
    expect(view.chapters[1].storyDayOffset).toBe(0)
    expect(view.chapters[1].storyDayLabel).toBe('第0日')
  })

  it('returns null currentState for empty slots and maps author/derived provenance', () => {
    const { db, id } = fixture({ characters: ['林岚', '周研'] })
    const contentHash = 'a'.repeat(64)
    db.prepare('UPDATE characters SET cs_location=?,cs_updated_at_chapter=?,cs_provenance=? WHERE character_id=?').run(
      '北塔', 3,
      JSON.stringify({
        location: { kind: 'author', chapterNumber: 2 },
        recentEvents: { kind: 'derived', revision: 1,
          source: { draftId: 1, finalizationId: 'finalization-1', chapterNumber: 3, contentHash } },
      }),
      id('周研'),
    )

    const view = readWorldState(db, 'C:/projects/A')
    const linlan = view.characters.find(character => character.name === '林岚')
    const zhouyan = view.characters.find(character => character.name === '周研')

    expect(linlan?.currentState).toBeNull()
    expect(zhouyan?.currentState).toMatchObject({ location: '北塔', updatedAtChapter: 3 })
    expect(zhouyan?.provenance).toEqual({
      location: { kind: 'author', chapterNumber: 2 },
      recentEvents: { kind: 'derived', chapterNumber: 3 },
    })
  })

  it('returns an empty view for an empty database and a null project path', () => {
    const { db } = fixture()

    const view = readWorldState(db, null)

    expect(view.projectPath).toBeNull()
    expect(view.castLedger).toEqual({ entries: [], counts: { orphan: 0, ambiguous: 0, anchored: 0, carded: 0 } })
    expect(view.chapters).toEqual([])
    expect(view.characters).toEqual([])
    expect(view.continuityFacts).toEqual([])
    expect(view.unreadableMentions).toEqual({ review: 0, finalized: 0, blueprint: 0 })
    expect(view.notes).toEqual([])
    expect(typeof view.fetchedAt).toBe('string')
    // 没有项目 = 没有检查过，不是「0 个问题」。
    expect(view.spaceAudit.unreadable).toBe(true)
  })

  it('audits the space table and machine lines read from project_core.worldbuilding', () => {
    const { db } = fixture()
    db.prepare('INSERT INTO project_core(worldbuilding) VALUES(?)').run([
      '## 4. 空间结构（地图与区域）',
      '',
      '| 空间定位 | 一句话描述 | 关键规则 |',
      '|---------|-----------|---------|',
      '| **执法殿·审讯室** | 审讯要地 | 每日14:00-16:00 受理申请，须持令牌 |',
      '| **藏经阁** | 典籍存放 | 每日08:00-10:00 开放 |',
      '',
      '执法殿·审讯室｜hours=14:00-16:00｜entry=持令牌',
    ].join('\n'))

    const view = readWorldState(db, 'C:/projects/A')

    expect(view.spaceAudit.unreadable).toBe(false)
    expect(view.spaceAudit.tableSpaces).toBe(2)
    expect(view.spaceAudit.machineLines).toBe(1)
    // 表格里有「藏经阁」、机读行里没有 —— 必须点名到具体空间。
    expect(view.spaceAudit.issues).toContainEqual(expect.objectContaining({
      kind: 'missing-machine-line',
      space: '藏经阁',
    }))
    // 规则里的时间是「受理申请」窗口，被压成 hours ⇒ 语义待确认。
    expect(view.spaceAudit.issues.map(issue => issue.kind)).toContain('window-semantics-ambiguous')
  })

  it('marks the space audit unreadable when the world-building has no space structure', () => {
    const { db } = fixture()
    // 有世界观正文，但既没有「空间结构」段也没有机读行。
    db.prepare('INSERT INTO project_core(worldbuilding) VALUES(?)').run('这个世界只有一条灵气稀薄的街区。')

    const view = readWorldState(db, 'C:/projects/A')

    // 关键：不能退化成「0 个 issue」——没检查过和查过没问题必须分开。
    expect(view.spaceAudit).toEqual({ tableSpaces: 0, machineLines: 0, issues: [], unreadable: true })
  })

  it('读取资源登记表；缺表时标记 unreadable 而不是「0 个资源」', () => {
    const { db } = fixture()
    db.prepare(`INSERT INTO resources(resource_id,family_id,name,tier,unit,anchor_value,period)
      VALUES(?,?,?,?,?,?,?)`).run('res:stone-low', '灵石', '下品灵石', 0, '枚', null, '卷')
    db.prepare(`INSERT INTO resources(resource_id,family_id,name,tier,unit,anchor_value,period)
      VALUES(?,?,?,?,?,?,?)`).run('res:stone-high', '灵石', '上品灵石', 2, '枚', 100, '卷')

    const readable = readWorldState(db, 'C:/projects/A')

    expect(readable.resources.unreadable).toBe(false)
    // 读取层已按族、品阶排序（同族相邻），W6c 直接按族分组。
    expect(readable.resources.items.map(item => item.name)).toEqual(['下品灵石', '上品灵石'])
    expect(readable.resources.items[0]).toMatchObject({ unit: '枚', familyId: '灵石' })
    // 不可通兑是 null，不是 0。
    expect(readable.resources.items[0].anchorValue).toBeNull()
    expect(readable.resources.items[1].anchorValue).toBe(100)

    // M11 之前的库：两张表都没有。必须显式不可读。
    db.exec('DROP TABLE resource_movements')
    db.exec('DROP TABLE resources')
    const unreadable = readWorldState(db, 'C:/projects/A')

    expect(unreadable.resources).toEqual({ unreadable: true, items: [] })
  })

  it('没有项目上下文时资源侧是「未登记」，不是已读到的空表', () => {
    const { db } = fixture()

    expect(readWorldState(db, null).resources).toEqual({ unreadable: true, items: [] })
  })
})
