/**
 * world-state-view-model — W5「世界状态」只读视图的纯函数与标签表。
 *
 * 为什么单独抽出来：
 * - 这些映射属于「视图语义」（中英文案、日序缺省、提及聚合），与 React 渲染无关；
 * - 纯函数可以直接单测，避免为了测试去改组件签名或渲染整棵组件树；
 * - 组件只负责布局，不在这里做任何数据推断或写入。
 *
 * 只读契约：本文件不访问 IPC、不拼 SQL、不修改入参。
 */
import type { CastLedgerEntry, CastLedgerMentionSource, CastLedgerStatus } from '../../../shared/cast-ledger'
import type { CharacterStateTextField } from '../../../shared/character-roster'
import type { WorldStateFieldProvenance, WorldStateObservation } from '../../../shared/world-state-view'

export type WorldStateLanguage = 'zh-CN' | 'en-US'

/** 归位表固定四档顺序（读取层按 orphan→ambiguous→anchored→carded 排序）。 */
export const WORLD_STATE_STATUS_ORDER: readonly CastLedgerStatus[] = [
  'orphan',
  'ambiguous',
  'anchored',
  'carded',
]

/** 四档状态徽标文案。 */
export const WORLD_STATE_STATUS_LABELS: Record<CastLedgerStatus, { zh: string; en: string }> = {
  orphan: { zh: '孤儿', en: 'Orphan' },
  ambiguous: { zh: '多卡命中', en: 'Multiple matches' },
  anchored: { zh: '已判锚点', en: 'Anchored' },
  carded: { zh: '已建卡', en: 'Carded' },
}

/** 提及来源短标签。 */
export const MENTION_SOURCE_LABELS: Record<CastLedgerMentionSource, { zh: string; en: string }> = {
  'review-state-delta': { zh: '审稿', en: 'Review' },
  'finalized-proposal': { zh: '定稿', en: 'Finalized' },
  blueprint: { zh: '蓝图', en: 'Blueprint' },
}

/**
 * 角色状态六槽字段标签。
 * 措辞与 src/components/characters/FinalizedCharacterStateCandidatePanel.tsx:12-15 保持一致，
 * 避免同一字段在不同面板出现两种中文名。
 */
export const STATE_FIELD_LABELS: Record<CharacterStateTextField, { zh: string; en: string }> = {
  location: { zh: '位置', en: 'Location' },
  powerLevel: { zh: '能力等级', en: 'Power level' },
  physicalState: { zh: '身体状态', en: 'Physical state' },
  mentalState: { zh: '心理状态', en: 'Mental state' },
  keyItems: { zh: '关键物品', en: 'Key items' },
  recentEvents: { zh: '近期事件', en: 'Recent events' },
}

/** observations 的 reason 徽标文案。 */
const OBSERVATION_REASON_LABELS: Record<NonNullable<WorldStateObservation['reason']>, { zh: string; en: string }> = {
  'author-protected': { zh: '作者已保护', en: 'Author-protected' },
  'legacy-protected': { zh: '旧数据保护', en: 'Legacy-protected' },
  'review-conflict': { zh: '审稿冲突', en: 'Review conflict' },
}

function pick(label: { zh: string; en: string }, language: WorldStateLanguage): string {
  return language === 'zh-CN' ? label.zh : label.en
}

/**
 * 故事日展示：
 * - storyDayLabel 优先（作者手写的相对日序，例如「第三天清晨」）；
 * - offset 为 null 时返回 null（调用方显示「未定」），绝不当作第 0 日；
 * - offset 为 0 时正常返回「第0日」——0 是合法日序，与「未知」必须区分。
 */
export function formatStoryDay(
  chapter: { storyDayOffset: number | null; storyDayLabel: string | null },
  language: WorldStateLanguage,
): string | null {
  const label = chapter.storyDayLabel?.trim()
  if (label) return label
  if (chapter.storyDayOffset === null) return null
  return language === 'zh-CN' ? `第${chapter.storyDayOffset}日` : `Day ${chapter.storyDayOffset}`
}

/**
 * 归位表一行的提及摘要，例如「审稿 2 次 · 蓝图 1 次（第 3、5 章）」。
 *
 * 去重键是 (source, chapterNumber)：读取层可能把同一来源、同一章节的同一提及
 * 重复塞进数组（例如同章多处 delta），这里只算一次；没有章节号的提及只计次数。
 * 来源分组按首次出现顺序，章节号升序、去重、最多 5 个。
 */
export function summarizeMentions(entry: CastLedgerEntry, language: WorldStateLanguage): string {
  const seen = new Set<string>()
  const buckets = new Map<CastLedgerMentionSource, { count: number; chapters: number[] }>()

  for (const mention of entry.mentions) {
    const dedupeKey = `${mention.source}:${mention.chapterNumber ?? 'none'}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const bucket = buckets.get(mention.source) ?? { count: 0, chapters: [] }
    bucket.count += 1
    if (mention.chapterNumber !== undefined && !bucket.chapters.includes(mention.chapterNumber)) {
      bucket.chapters.push(mention.chapterNumber)
    }
    buckets.set(mention.source, bucket)
  }

  if (buckets.size === 0) {
    return language === 'zh-CN' ? '无提及' : 'No mentions'
  }

  const chapters: number[] = []
  const parts: string[] = []
  for (const [source, bucket] of buckets) {
    const label = pick(MENTION_SOURCE_LABELS[source], language)
    parts.push(language === 'zh-CN' ? `${label} ${bucket.count} 次` : `${label} ×${bucket.count}`)
    for (const chapter of bucket.chapters) {
      if (!chapters.includes(chapter)) chapters.push(chapter)
    }
  }

  chapters.sort((a, b) => a - b)
  const visibleChapters = chapters.slice(0, 5)
  if (visibleChapters.length === 0) return parts.join(' · ')

  const suffix = language === 'zh-CN'
    ? `（第 ${visibleChapters.join('、')} 章）`
    : ` (ch. ${visibleChapters.join(', ')})`
  return parts.join(' · ') + suffix
}

/**
 * 提及读取失败警示；三项都为 0 时返回 null（视图正常，不打扰用户）。
 */
export function summarizeUnreadable(
  counts: { review: number; finalized: number; blueprint: number },
  language: WorldStateLanguage,
): string | null {
  const total = counts.review + counts.finalized + counts.blueprint
  if (total <= 0) return null

  if (language === 'zh-CN') {
    return `有 ${total} 条人物提及没能读出来（审稿 ${counts.review} 条、定稿 ${counts.finalized} 条、蓝图 ${counts.blueprint} 条），归位表与世界状态可能不完整。`
  }
  return `${total} character mention(s) could not be read (review ${counts.review}, finalized ${counts.finalized}, blueprint ${counts.blueprint}); the cast ledger and world state may be incomplete.`
}

/** observations 的 reason 徽标；无 reason 返回 null。 */
export function describeObservationReason(
  reason: WorldStateObservation['reason'],
  language: WorldStateLanguage,
): string | null {
  if (!reason) return null
  return pick(OBSERVATION_REASON_LABELS[reason], language)
}

/** 单槽来源徽标：作者 / 定稿派生 / 旧数据。 */
export function describeFieldProvenance(
  provenance: WorldStateFieldProvenance | null | undefined,
  language: WorldStateLanguage,
): string | null {
  if (!provenance) return null

  if (provenance.kind === 'author') {
    return language === 'zh-CN' ? `作者 ch${provenance.chapterNumber}` : `Author ch${provenance.chapterNumber}`
  }
  if (provenance.kind === 'derived') {
    return language === 'zh-CN'
      ? `定稿派生 ch${provenance.chapterNumber}`
      : `Finalized-derived ch${provenance.chapterNumber}`
  }
  return language === 'zh-CN' ? '旧数据' : 'Legacy'
}

/**
 * 归位表分组：固定四档顺序，空档也返回（UI 需要稳定的分区骨架）。
 * 档内保持入参顺序（读取层已按首次出现 / 名字排序）。
 */
export function groupCastLedgerEntries(
  entries: readonly CastLedgerEntry[],
): { status: CastLedgerStatus; entries: CastLedgerEntry[] }[] {
  return WORLD_STATE_STATUS_ORDER.map((status) => ({
    status,
    entries: entries.filter((entry) => entry.status === status),
  }))
}
