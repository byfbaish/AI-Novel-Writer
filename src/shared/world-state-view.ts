/**
 * W5 世界状态视图（只读契约）
 *
 * 这一层只负责把「已经落库的事实」摊平成渲染层可以直接消费的形状：
 * - 不出现任何写操作（无 UPDATE / INSERT / DELETE），也不推断正文里没被点名过的角色。
 * - NULL 就是 NULL：story_day_offset 未知时保持 null，绝不用 0 顶替；六个状态槽全空时不伪造 currentState。
 * - 读不出来的来源不静默丢弃：计数进 unreadableMentions，人类可读的原因进 notes。
 *
 * 渲染层（W5 UI）只依赖本文件的类型，不要自己去拼 SQL。
 */
import type { CastLedgerEntry, CastLedgerStatus } from './cast-ledger'
import type { CharacterStateTextField } from './character-roster'
import type { SpaceLocationAudit } from './space-machine-line'

/**
 * notes 的取值清单（渲染层可据此做中文/英文文案映射）：
 * - 'cast-decision-schema-missing'：当前库还没有 character_cast_decisions 表（M08 之前的老库），锚点按空处理。
 * - 'project-not-open'：项目库尚未打开，返回的是空视图（projectPath 为 null）。
 */
export const WORLD_STATE_NOTES = {
  castDecisionSchemaMissing: 'cast-decision-schema-missing',
  projectNotOpen: 'project-not-open',
} as const

export type WorldStateNote = (typeof WORLD_STATE_NOTES)[keyof typeof WORLD_STATE_NOTES]

export interface CastLedgerView {
  /** 归位表条目，已按 orphan → ambiguous → anchored → carded 排序（同档按名字）。 */
  entries: CastLedgerEntry[]
  /** 每一档的条目数，四档都会出现（含 0）。 */
  counts: Record<CastLedgerStatus, number>
}

export interface WorldStateObservation {
  /** 定稿后处理给出的角色名（可能是显示名或别名原文）。 */
  characterName: string
  /** 角色卡 id；未绑定角色卡时为 null。 */
  characterId: string | null
  /** 六个状态槽之一。 */
  field: CharacterStateTextField
  /** 候选值（不一定已落库：author-protected / review-conflict 等会停在候选状态）。 */
  value: string
  /** 候选引用的正文片段；没有证据时为 null。 */
  evidence: string | null
  /** 审稿报告里同一字段的观察值；没有审稿冲突时为 null。 */
  reviewObserved: string | null
  /** 审稿报告引用的原文；没有审稿冲突时为 null。 */
  reviewQuote: string | null
  /** 为什么没有直接落库；正常候选为 null。 */
  reason: 'author-protected' | 'legacy-protected' | 'review-conflict' | null
}

export interface WorldStateChapter {
  chapterNumber: number
  /** 定稿时的章节标题；没有快照标题时为 null。 */
  title: string | null
  /** 故事内日序偏移；NULL/未知保持 null（不要当 0）。 */
  storyDayOffset: number | null
  /** 故事内日期标签（如「第三天清晨」）；未知保持 null。 */
  storyDayLabel: string | null
  /** 本章最新一稿的状态（可能比此快照新：定稿后又开了修订稿）；没有草稿时为 null。 */
  draftStatus: string | null
  observations: WorldStateObservation[]
}

export type WorldStateFieldProvenance =
  | { kind: 'author'; chapterNumber: number }
  | { kind: 'derived'; chapterNumber: number }
  | { kind: 'legacy' }

export interface WorldStateCharacter {
  characterId: string
  /** 显示名（character_aliases 里 valid_through 为 NULL 的那条若与显示名不同，由归位表负责等价匹配）。 */
  name: string
  /** 角色身份修订号；老库无该列时按 0。 */
  revision: number
  /** 六个状态槽全空（或 cs_updated_at_chapter 为 NULL）时为 null，不返回全空串对象。 */
  currentState: {
    location: string
    powerLevel: string
    physicalState: string
    mentalState: string
    keyItems: string
    recentEvents: string
    updatedAtChapter: number
  } | null
  /** 逐槽来源；没有记录的槽不出现（legacy 没有章号）。 */
  provenance: Partial<Record<CharacterStateTextField, WorldStateFieldProvenance>>
}

export interface WorldStateContinuityFact {
  chapterNumber: number
  text: string
}

export interface WorldStateView {
  /** 读取时刻（ISO 8601）；渲染层可用于「数据可能过期」的提示。 */
  fetchedAt: string
  /** 当前项目根目录；没有打开项目时为 null。 */
  projectPath: string | null
  castLedger: CastLedgerView
  chapters: WorldStateChapter[]
  /** 未退休角色卡（退休卡的落点语义由归位表体现）。 */
  characters: WorldStateCharacter[]
  continuityFacts: WorldStateContinuityFact[]
  /** 三来源里读不出来的条数：review=整章不可采信，finalized/blueprint=JSON 坏行数。 */
  unreadableMentions: { review: number; finalized: number; blueprint: number }
  /**
   * 空间检查：世界观「空间结构」表格 × 末尾机读行的结构对账。
   * `unreadable` 为 true 表示**没检查**（世界观读不出来，或里面一个空间都没识别到），
   * 与「检查过、0 个问题」必须分开显示。
   */
  spaceAudit: SpaceLocationAudit
  notes: WorldStateNote[]
}

/** 空视图：没有打开项目 / 数据库不可用时返回它，既不抛错也不伪造数据。 */
export function emptyWorldStateView(projectPath: string | null = null, notes: WorldStateNote[] = []): WorldStateView {
  return {
    fetchedAt: new Date().toISOString(),
    projectPath,
    castLedger: {
      entries: [],
      counts: { orphan: 0, ambiguous: 0, anchored: 0, carded: 0 },
    },
    chapters: [],
    characters: [],
    continuityFacts: [],
    unreadableMentions: { review: 0, finalized: 0, blueprint: 0 },
    // 空视图 = 没读过世界观 ⇒ 空间检查标记为「未检查」，不是「0 个问题」。
    spaceAudit: { tableSpaces: 0, machineLines: 0, issues: [], unreadable: true },
    notes: [...notes],
  }
}
