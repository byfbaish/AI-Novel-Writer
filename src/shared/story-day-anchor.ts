/**
 * 故事日序（story day offset）：**把「今天是第几天」从散文里拎出来，交给算术**。
 *
 * 存在理由（2026-10-21，W2）：
 * - `consistency_check` 已经把「日序」列为第 8 检查维度，但没有权威值 ——
 *   模型每章各自去推「二月廿三距今几天」，第 2 章推错一次，后面全跟着错。
 * - 药剩几天、百日倒计时、开园倒计时这类硬算术，**没有整数就做不了**。
 *
 * 但历法维刻意不设机读行（§11.1：第 4 维 8 条机读行有 4 条解析不出来，
 * 解析失败会静默变成「未发现冲突」）。所以这里换产出者而不是换格式：
 *
 * | 谁 | 做什么 |
 * |---|---|
 * | 历法维（人读） | 只写纪年、月长、时辰、周期事件、t0 |
 * | 章节要点（模型） | 从正文里读出一个**整数**：本章距 t0 多少天，外加书中写法 |
 * | 本模块（纯算术） | 只解析这个整数；取不到就返回 null，**绝不填 0** |
 *
 * 三条契约：
 * 1. **取不到就是取不到**（返回 null）。填 0 会让「第 1 章」与「没算出来」同形，
 *    等于把缺失伪装成一个合法的锚点 —— AC5 就是这么死的。
 * 2. **只认冒号后紧跟的整数**。模型写成「2月27日」时宁可判缺失，也不能把「2」
 *    当偏移量（那会让全书日序整体错到二月里去）。
 * 3. 日序是**算术锚**，不是情节禁令：正文可以写「三日后」，只要日序不自相矛盾。
 */
import type { WritingLanguage } from './writing-language'

/** 章节要点里承载日序的栏目名（中英双语，解析器两套都认）。 */
export const STORY_DAY_SECTION_HEADINGS = ['时间定位', 'Time anchor'] as const

export interface StoryDayAnchor {
  /** 距 t0 的天数，t0 = 0（开篇当日）。 */
  offset: number
  /** 书中写法（如「二月廿七」）；模型没给时为空串。 */
  label: string
}

/** 章节投影里与日序有关的三个字段（`summary_snapshots` 的列）。 */
export interface StoryDaySource {
  chapterNumber: number
  storyDayOffset?: number | null
  storyDayLabel?: string | null
}

const SECTION_HEADING_PATTERN = /^#{1,6}\s*(时间定位|Time anchor)\s*$/i
const ANY_HEADING_PATTERN = /^#{1,6}\s+/
/**
 * 只接受「冒号 → 可选『第』→ 整数 → 可选『日/天』→ 行尾或标点」。
 * 「2月27日」的「2」后面跟的是「月」，不匹配 ⇒ 判缺失，而不是错抓成第 2 日。
 */
const OFFSET_PATTERN = /(?:故事日|Story day)[^\n:：]*[:：]\s*(?:第\s*)?(-?\d+)\s*(?:日|天|days?)?\s*(?:$|[（(，,。；;、|])/im
const LABEL_PATTERN = /(?:书中写法|In-world label|In-world date)[^\n:：]*[:：]\s*([^\n（(]+)/i

/**
 * 从章节要点里取出日序。栏目不存在、栏目里写「未定」、或整数格式不合规，一律返回 null。
 *
 * 注意：**不跨栏目搜索**。整份笔记里别处也可能出现整数（条目序号、字数），
 * 只在「时间定位 / Time anchor」这一节内找，是这里唯一安全的做法。
 */
export function parseStoryDayAnchor(notes: string): StoryDayAnchor | null {
  if (!notes || !notes.trim()) return null
  const lines = notes.split(/\r?\n/)
  let start = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (!SECTION_HEADING_PATTERN.test(lines[index].trim())) continue
    start = index + 1
    break
  }
  if (start < 0) return null
  let end = lines.length
  for (let index = start; index < lines.length; index += 1) {
    if (ANY_HEADING_PATTERN.test(lines[index])) { end = index; break }
  }
  const section = lines.slice(start, end).join('\n')
  const offsetMatch = OFFSET_PATTERN.exec(section)
  if (!offsetMatch) return null
  const offset = Number(offsetMatch[1])
  if (!Number.isSafeInteger(offset) || offset < 0) return null
  const labelMatch = LABEL_PATTERN.exec(section)
  return { offset, label: labelMatch ? labelMatch[1].trim().replace(/[。；;，,]\s*$/, '') : '' }
}

/** 日序缺失时的显式降级文本：**不写 0，不写「无」**，要能被人看见并去补。 */
function missingText(isEn: boolean): string {
  return isEn
    ? '(missing — this chapter has no computable story-day offset; do not infer it from chapter numbers)'
    : '（缺失——本章没有可计算的日序，不得按章号臆测）'
}

function anchorText(anchor: StoryDaySource, isEn: boolean): string {
  const offset = anchor.storyDayOffset
  if (offset === null || offset === undefined || !Number.isSafeInteger(offset)) return missingText(isEn)
  const label = anchor.storyDayLabel?.trim()
  const dayText = isEn ? `day ${offset}` : `第${offset}日`
  return label ? `${dayText}（${label}）` : dayText
}

/**
 * 生成链用：一行「时间锚点」，并进作者材料块。
 *
 * 只给最近一个有日序的定稿章 + 当前这一章 —— 给全书日序表既超预算，
 * 也把「各章各自第几天」误当成任务清单。
 */
export function formatStoryDayAnchorLine(
  anchors: readonly StoryDaySource[],
  options: { writingLanguage: WritingLanguage; currentChapter: number },
): string {
  const isEn = options.writingLanguage === 'en-US'
  const previous = [...anchors]
    .filter(anchor => anchor.chapterNumber < options.currentChapter)
    .sort((left, right) => right.chapterNumber - left.chapterNumber)[0]
  if (!previous) return ''
  const usable = previous.storyDayOffset !== null && previous.storyDayOffset !== undefined
    && Number.isSafeInteger(previous.storyDayOffset)
  const offset = usable ? previous.storyDayOffset as number : null
  if (isEn) {
    const head = `[Story-day anchor] The story starts at day 0. Chapter ${previous.chapterNumber}: ${anchorText(previous, true)}.`
    return offset === null
      ? `${head} Its offset is missing, so do not invent day numbers or count days from the chapter number.`
      : `${head} This chapter must not fall earlier than day ${offset}; if the prose explicitly jumps forward, state the elapsed interval in the text.`
  }
  const head = `【故事日锚点】故事从第0日开始计。第${previous.chapterNumber}章：${anchorText(previous, false)}。`
  return offset === null
    ? `${head}该章日序缺失，不要凭空编日序、也不要按章号推算天数。`
    : `${head}本章不得早于第${offset}日；正文若明确跳过时间，要把跨过的天数写出来。`
}

/**
 * 审稿链用：多行日序块（只列有定稿快照的章）。
 *
 * 审稿要判的是「本章的时间表述能不能和前面算上」，所以给的是**每一章的锚**，
 * 而不是只有最近一个 —— 第 4 章对不上时，需要第 1 章的 t0 才能定位是哪一章开始错的。
 */
export function formatStoryDayAnchorLines(
  anchors: readonly StoryDaySource[],
  options: { writingLanguage: WritingLanguage; currentChapter?: number },
): string {
  const isEn = options.writingLanguage === 'en-US'
  const ordered = [...anchors]
    .filter(anchor => options.currentChapter === undefined || anchor.chapterNumber <= options.currentChapter)
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
  if (!ordered.length) return ''
  const lines = ordered.map(anchor => (isEn
    ? `  - Chapter ${anchor.chapterNumber}: ${anchorText(anchor, true)}`
    : `  - 第${anchor.chapterNumber}章：${anchorText(anchor, false)}`))
  const head = isEn
    ? '[Story-day anchors: the story starts at day 0; offsets are computed from the prose, not from chapter numbers]'
    : '【故事日锚点（第0日为开篇当日；日序取自正文，不按章号推算）】'
  const tail = isEn
    ? '  Check: offsets must not decrease; an interval stated in this chapter must equal the difference between its own offset and the chapter it refers to. A missing entry is unknown, not zero.'
    : '  核对：日序不得倒退；本章明示的间隔必须等于两章日序之差。标「缺失」的是未知，不是 0。'
  return [head, ...lines, tail].join('\n')
}

/**
 * 单调性校验：日序倒退是**硬矛盾**（正文可以写「昨日」，但不能比上一章还早）。
 * 返回 undefined 表示没有可比对象或本章缺失，由调用方决定如何处理缺失。
 */
export function storyDayRegression(
  previous: StoryDaySource | undefined,
  current: StoryDaySource,
): { previousChapter: number; previousOffset: number; currentOffset: number } | undefined {
  const previousOffset = previous?.storyDayOffset
  const currentOffset = current.storyDayOffset
  if (previousOffset === null || previousOffset === undefined || !Number.isSafeInteger(previousOffset)) return undefined
  if (currentOffset === null || currentOffset === undefined || !Number.isSafeInteger(currentOffset)) return undefined
  if (currentOffset >= previousOffset) return undefined
  return { previousChapter: previous!.chapterNumber, previousOffset, currentOffset }
}
