/**
 * 角色相关性三档命中 + 两档排序（C1-a）。
 *
 * 设计口径见 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md`
 * §3（三档判据）与 §5（两档排序）。这里是那两节的**唯一实现处**：
 * 组件只负责渲染，不自己判命中，否则「列表看到的」与「排序用的」会各算一遍。
 *
 * 约束（判据 J1）：本文件是纯函数模块——不做 IO、不读 store、不碰 `window`，
 * 也不 import `electron/`。数据由调用方读好后以 `CharacterRelevanceContext` 传入，
 * 这样单测可以只喂夹具，不必起主进程。
 */

import { parseRelationshipEdges } from './relationship-presentation'

/** 三档命中来源。顺序即展示顺序（关系 → 蓝图 → 大纲）。 */
export type CharacterRelevanceLayer = 'relationship' | 'blueprint' | 'outline'

/** 档③ 只看项目核心这三串（`synopsis` / `plot_structure_plan` / `worldbuilding`）。 */
export type CharacterRelevanceOutlineField = 'synopsis' | 'plotStructurePlan' | 'worldbuilding'

/** 排序两档（v1 只这两档，「最近出场」不做）。 */
export type CharacterRelevanceSortKey = 'relevance' | 'name'

export const CHARACTER_RELEVANCE_LAYERS: readonly CharacterRelevanceLayer[] = ['relationship', 'blueprint', 'outline']

export const CHARACTER_RELEVANCE_OUTLINE_FIELDS: readonly CharacterRelevanceOutlineField[] = [
  'synopsis',
  'plotStructurePlan',
  'worldbuilding',
]

/** 三档开关（默认全开＝不筛）。 */
export type CharacterRelevanceLayers = Readonly<Record<CharacterRelevanceLayer, boolean>>

export const CHARACTER_RELEVANCE_ALL_LAYERS: CharacterRelevanceLayers = Object.freeze({
  relationship: true,
  blueprint: true,
  outline: true,
})

/**
 * 判命中需要的最小角色面。
 *
 * 刻意不 import `CharacterRosterEntry` / `CharacterData`：列表用的是
 * `characters` 表投影（`relationships` 是自由文本），roster 用结构化数组，
 * 两边都能直接传进来。结构化数组不在本卡范围内（v1 不读它）。
 */
export interface CharacterRelevanceEntry {
  name: string
  /** `characters.relationships`：结构化 JSON 或历史自由文本；空串／undefined 视为无关系。 */
  relationships?: string | null
}

/** 档② 的一条声明：某个名字在哪些章被蓝图点名。 */
export interface CharacterRelevanceBlueprintDeclaration {
  name: string
  /** 升序去重后的章号。 */
  chapters: readonly number[]
}

/**
 * 读库结果，由调用方（组件）填。
 *
 * `blueprintDeclarations` 为空数组或 `undefined` 表示**该档数据未就绪**
 * （新项目还没生成蓝图）：这一档恒不产命中，不报错，也不改变其它档的判断。
 */
export interface CharacterRelevanceContext {
  blueprintDeclarations?: readonly CharacterRelevanceBlueprintDeclaration[] | null
  outline?: CharacterRelevanceOutlineSource | null
}

/** 项目核心三串（只取判命中要用的字段）。 */
export interface CharacterRelevanceOutlineSource {
  synopsis?: string | null
  /** `ProjectCoreData.plotStructurePlan`（库列 `plot_structure_plan`）。 */
  plotStructurePlan?: string | null
  /** 库列原名的别名：调用方直接透传 SQL 行时不用改名。 */
  plot_structure_plan?: string | null
  worldbuilding?: string | null
}

export interface CharacterRelevance {
  /** 命中的档，固定按 关系 → 蓝图 → 大纲 排序。 */
  hits: CharacterRelevanceLayer[]
  /** 档① 解析出的关系条数（自由文本解析不出边时为 0，见 `relationshipHit`）。 */
  relationshipCount: number
  /** 档② 命中的章号（升序去重）。 */
  blueprintChapters: number[]
  /** 档③ 命中的字段。 */
  outlineFields: CharacterRelevanceOutlineField[]
}

/** 一条可读原因。文案由组件按 locale 渲染，本模块只给结构化事实。 */
export type CharacterRelevanceReason =
  | { layer: 'relationship'; count: number }
  | { layer: 'blueprint'; chapters: number[] }
  | { layer: 'outline'; fields: CharacterRelevanceOutlineField[] }

/** `db:blueprint-character-sync-list-all` 的返回项里判命中要用的部分。 */
export interface CharacterRelevanceSyncOperation {
  characterSyncInput?: readonly CharacterRelevanceSyncBlueprint[] | null
}

export interface CharacterRelevanceSyncBlueprint {
  chapterNumber?: number
  characters?: readonly string[] | null
}

/**
 * 名字匹配口径（设计稿 §3.2 第 1 条）：大小写不敏感的子串。
 *
 * 中文没有大小写，`toLowerCase` 对它是恒等变换，所以「中文逐字子串」与
 * 「英文大小写不敏感」用同一条规则就够；v1 **不做**别名／代称。
 */
export function relevanceNameMatches(haystack: string | null | undefined, name: string): boolean {
  const needle = typeof name === 'string' ? name.trim() : ''
  if (!needle) return false
  if (typeof haystack !== 'string' || !haystack) return false
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function relationshipRaw(entry: CharacterRelevanceEntry): string {
  return typeof entry.relationships === 'string' ? entry.relationships : ''
}

/**
 * 档①：`relationships` **非空**即命中（设计稿 §3.1）。
 *
 * 条数另算，且只用于文案：结构化 JSON 与历史自由文本都交给
 * `parseRelationshipEdges` 归一（复用既有解析，避免第二套关系语法）。
 * 文本非空但解析不出任何边（例如整段散文）时仍算命中，文案退化成
 * 「有关系记录」——不把「说不清几条」当成「没有关系」。
 */
function relationshipFacts(entry: CharacterRelevanceEntry): { hit: boolean; count: number } {
  const raw = relationshipRaw(entry).trim()
  if (!raw) return { hit: false, count: 0 }
  return { hit: true, count: parseRelationshipEdges(raw).length }
}

/** 名字相等判定：去空白 + 大小写不敏感（蓝图点名的是一份名单，用相等而非子串，避免"程实"吃下"程实之"）。 */
function sameRelevanceName(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = typeof left === 'string' ? left.trim().toLowerCase() : ''
  const b = typeof right === 'string' ? right.trim().toLowerCase() : ''
  return Boolean(a) && a === b
}

function blueprintChaptersFor(
  name: string,
  declarations: readonly CharacterRelevanceBlueprintDeclaration[] | null | undefined,
): number[] {
  // 未就绪守卫（判据 J2 的「无蓝图不报错」）：同步记录为空 ⇒ 这一档不产命中。
  // 不能抛错（新项目第一次打开列表不应该红屏），也不能恒标命中（会把全部卡说成"声明过"）。
  if (!declarations || declarations.length === 0) return []
  const chapters = new Set<number>()
  for (const declaration of declarations) {
    if (!sameRelevanceName(declaration.name, name)) continue
    for (const chapter of declaration.chapters) {
      if (Number.isSafeInteger(chapter) && chapter > 0) chapters.add(chapter)
    }
  }
  return [...chapters].sort((left, right) => left - right)
}

function outlineFieldsFor(
  name: string,
  outline: CharacterRelevanceOutlineSource | null | undefined,
): CharacterRelevanceOutlineField[] {
  if (!outline) return []
  const texts: Record<CharacterRelevanceOutlineField, string | null | undefined> = {
    synopsis: outline.synopsis,
    plotStructurePlan: outline.plotStructurePlan ?? outline.plot_structure_plan,
    worldbuilding: outline.worldbuilding,
  }
  return CHARACTER_RELEVANCE_OUTLINE_FIELDS.filter(field => relevanceNameMatches(texts[field], name))
}

/** 完整判定：三档并集，一次算全（点标签、排序、筛选共用同一份结果）。 */
export function characterRelevance(
  entry: CharacterRelevanceEntry,
  ctx: CharacterRelevanceContext = {},
): CharacterRelevance {
  const relationship = relationshipFacts(entry)
  const blueprintChapters = blueprintChaptersFor(entry.name, ctx.blueprintDeclarations)
  const outlineFields = outlineFieldsFor(entry.name, ctx.outline)
  const hits: CharacterRelevanceLayer[] = []
  if (relationship.hit) hits.push('relationship')
  if (blueprintChapters.length > 0) hits.push('blueprint')
  if (outlineFields.length > 0) hits.push('outline')
  return { hits, relationshipCount: relationship.count, blueprintChapters, outlineFields }
}

/**
 * 判据 J1 点名的导出：命中哪几档。
 * 与 `characterRelevance` 同一实现，只是把结构体里的 `hits` 摘出来。
 */
export function characterRelevanceHits(
  entry: CharacterRelevanceEntry,
  ctx: CharacterRelevanceContext = {},
): CharacterRelevanceLayer[] {
  return characterRelevance(entry, ctx).hits
}

/**
 * 三档并集 + 只标不勾的显示规则。
 *
 * 1. 命中 ≥1 个**已开启**档 ⇒ 显示；
 * 2. 三档全不中 ⇒ **永远显示**（这正是作者要清理的目标集合，不能被筛掉）；
 * 3. 命中只落在被关掉的档 ⇒ 不显示（关档只能少，不能多）。
 *
 * 因此「三档全开 ⇒ 结果集＝全集」，且关档只会减不会增。
 */
export function characterRelevanceVisible(
  relevance: CharacterRelevance,
  layers: CharacterRelevanceLayers = CHARACTER_RELEVANCE_ALL_LAYERS,
): boolean {
  if (relevance.hits.length === 0) return true
  return relevance.hits.some(layer => layers[layer])
}

/** 命中原因（最多 3 条，按 关系 → 蓝图 → 大纲）。 */
export function characterRelevanceReasons(relevance: CharacterRelevance): CharacterRelevanceReason[] {
  const reasons: CharacterRelevanceReason[] = []
  if (relevance.hits.includes('relationship')) {
    reasons.push({ layer: 'relationship', count: relevance.relationshipCount })
  }
  if (relevance.hits.includes('blueprint')) {
    reasons.push({ layer: 'blueprint', chapters: [...relevance.blueprintChapters] })
  }
  if (relevance.hits.includes('outline')) {
    reasons.push({ layer: 'outline', fields: [...relevance.outlineFields] })
  }
  return reasons
}

/**
 * 每行最多显示 `limit`（默认 2）条原因，其余收成「+N」。
 * 返回 `hidden` 而不是拼接好的字符串，是因为「+N」还要能被点开展开。
 */
export function characterRelevanceReasonSlots(
  relevance: CharacterRelevance,
  limit = 2,
): { shown: CharacterRelevanceReason[]; hidden: number } {
  const reasons = characterRelevanceReasons(relevance)
  const safeLimit = Math.max(0, Math.floor(limit))
  return { shown: reasons.slice(0, safeLimit), hidden: Math.max(0, reasons.length - safeLimit) }
}

function nameCompare(left: string, right: string, locale?: string): number {
  return locale ? left.localeCompare(right, locale) : left.localeCompare(right)
}

/** 排序「有剧情优先」：命中档数降序 → 名字。 */
export function compareCharactersByRelevance(
  left: CharacterRelevanceEntry,
  right: CharacterRelevanceEntry,
  ctx: CharacterRelevanceContext = {},
  locale?: string,
): number {
  const delta = characterRelevance(right, ctx).hits.length - characterRelevance(left, ctx).hits.length
  if (delta !== 0) return delta
  return nameCompare(left.name, right.name, locale)
}

/** 排序「名字」。 */
export function compareCharactersByName(
  left: CharacterRelevanceEntry,
  right: CharacterRelevanceEntry,
  locale?: string,
): number {
  return nameCompare(left.name, right.name, locale)
}

/**
 * 按指定档位排序，**保持稳定**：主键相等时按入参顺序（显式下标兜底，
 * 不依赖运行时的 sort 是否稳定）。
 */
export function sortCharactersForDisplay<T extends CharacterRelevanceEntry>(
  entries: readonly T[],
  key: CharacterRelevanceSortKey,
  ctx: CharacterRelevanceContext = {},
  locale?: string,
): T[] {
  const indexed = entries.map((entry, index) => ({ entry, index }))
  indexed.sort((left, right) => {
    const primary = key === 'name'
      ? compareCharactersByName(left.entry, right.entry, locale)
      : compareCharactersByRelevance(left.entry, right.entry, ctx, locale)
    return primary !== 0 ? primary : left.index - right.index
  })
  return indexed.map(item => item.entry)
}

/**
 * 档② 数据源归一：`db:blueprint-character-sync-list-all` → 名字 → 章号。
 *
 * 跨批次合并（作者可能连着生成好几段蓝图），章号升序去重。
 * 只认蓝图正文的 `characters` 声明；`newCharacterCandidates` 是「待建卡提议」，
 * 属另一条链路，不算"被蓝图声明"，否则档② 会跟提案面板的待办混成一团。
 */
export function blueprintDeclarationsFromSyncOperations(
  operations: readonly CharacterRelevanceSyncOperation[] | null | undefined,
): CharacterRelevanceBlueprintDeclaration[] {
  if (!operations || operations.length === 0) return []
  const chaptersByName = new Map<string, Set<number>>()
  const displayName = new Map<string, string>()
  for (const operation of operations) {
    const blueprints = operation?.characterSyncInput
    if (!Array.isArray(blueprints)) continue
    for (const blueprint of blueprints) {
      const chapter = blueprint?.chapterNumber
      const names = blueprint?.characters
      if (typeof chapter !== 'number' || !Number.isSafeInteger(chapter) || chapter <= 0) continue
      if (!Array.isArray(names)) continue
      for (const raw of names) {
        if (typeof raw !== 'string') continue
        const name = raw.trim()
        if (!name) continue
        const key = name.toLowerCase()
        chaptersByName.set(key, (chaptersByName.get(key) ?? new Set<number>()).add(chapter))
        if (!displayName.has(key)) displayName.set(key, name)
      }
    }
  }
  return [...chaptersByName.entries()]
    .map(([key, chapters]) => ({
      name: displayName.get(key) ?? key,
      chapters: [...chapters].sort((left, right) => left - right),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * 档③ 数据源归一：`db:project-core-get` → 三串。
 * 非字符串一律按空串处理（旧项目／半初始化状态不该让列表崩）。
 */
export function outlineSourceFromProjectCore(
  core: {
    synopsis?: unknown
    plotStructurePlan?: unknown
    plot_structure_plan?: unknown
    worldbuilding?: unknown
  } | null | undefined,
): CharacterRelevanceOutlineSource {
  const stringOrEmpty = (value: unknown): string => (typeof value === 'string' ? value : '')
  return {
    synopsis: stringOrEmpty(core?.synopsis),
    plotStructurePlan: stringOrEmpty(core?.plotStructurePlan ?? core?.plot_structure_plan),
    worldbuilding: stringOrEmpty(core?.worldbuilding),
  }
}
