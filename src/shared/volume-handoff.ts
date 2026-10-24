/**
 * 卷末交接单的**唯一**渲染入口（P1-2 期 1，2026-10-24）。
 *
 * ## 它解决什么
 *
 * 写到第 4 卷时，第 1–3 卷正文早已退出上下文，只剩几百字大纲。工具没有「跨卷记忆」，
 * 这是评审认定的三处硬伤之一。本模块把作者手填的一份「下一卷必须承接的几件事」
 * 渲染成提示词里的一节，由正文链在**每一次正文请求**里注入（含续写轮、压缩轮）。
 *
 * ## 一条记录 = 一卷的交接单，不是编年史
 *
 * 只记「下一卷要用的」六件事：卷末世界、卷末主角、待承接的事件、关键物品、未结清的债、
 * 卷末未决。逐章摘要的家是 `summary_snapshots`，这里再登一份就是第二套账。
 *
 * ## 为什么用章号区间而不是卷号
 *
 * 正文链靠 `lastChapter < 本章` 找「上一卷」，所以节首必须写出「第几卷 · 全书第 a–b 章」——
 * 卷号只是给人看的名字，**区间才是机器判据**。这也意味着区间必须连续、不重叠：
 * 重叠 = 同一章落在两条记录里 = 静默注入错卷。
 *
 * ## 五条字数口径（写死，不许自己定）
 *
 * 1. `maxChars` 只算**正文行**，**不含**节标题与说明句（与 `prewrite-consultation.ts:61-62` 同口径）；
 * 2. 用 `String.length`（UTF-16），不用 `Array.from().length`（与既有各节一致）；
 * 3. 「省略行」本身**不计入** `maxChars` —— 它是提示，不是内容；
 * 4. 超限用 `break`（后续项全丢），不是跳过该项继续 —— 顺序即重要性；
 * 5. **一项都没装进去 ⇒ 整节返回 `''`**，否则会出现「注入了 1 条，内容却是省略说明」。
 *
 * 装入顺序：`worldState → heroState → events[] → items[] → debts[] → openThread`。
 * 每项内部：`events` / `items` / `debts` 逐条装入，**单条超预算就 `break`**（不截半句）。
 */
import type { WritingLanguage } from './writing-language'
import { VOLUME_HANDOFF_CHARS } from './outline-prefix-budget'

/**
 * 一卷的交接单。
 *
 * - `firstChapter` / `lastChapter` 是**写入那一刻的真实章号**，不是计划章数（超写是常态）；
 * - `events` / `items` / `debts` 是字符串数组，JSON 编解码由仓储负责，本模块只见数组。
 */
export interface VolumeHandoffDefinition {
  handoffId: string
  volumeIndex: number
  firstChapter: number
  lastChapter: number
  worldState: string
  heroState: string
  events: string[]
  items: string[]
  debts: string[]
  openThread: string
  source: string
  createdAt: string
  updatedAt: string
}

/** 别名：语义同 `VOLUME_HANDOFF_CHARS`，不重复字面量（架构侧的大纲预算也读那一个）。 */
export const VOLUME_HANDOFF_MAX_CHARS = VOLUME_HANDOFF_CHARS

/**
 * 写入入参：`handoffId` 缺省表示新建。
 *
 * 三个数组字段由仓储负责 `JSON.stringify`；面板传数组，不传 JSON 字符串 ——
 * 让「编码」只有一处，少一个半角引号逃逸的机会。
 */
export interface VolumeHandoffInput {
  handoffId?: string
  volumeIndex: number
  firstChapter: number
  lastChapter: number
  worldState?: string
  heroState?: string
  events?: readonly string[]
  items?: readonly string[]
  debts?: readonly string[]
  openThread?: string
  /** 来源标记；本期只有 `author`。**不校验取值**（见计划 §7 限制 5）。 */
  source?: string
}

/** 三个数组字段的条数上限：超出的部分不进正文（不是不保存）。 */
export const VOLUME_HANDOFF_MAX_EVENTS = 5
export const VOLUME_HANDOFF_MAX_ITEMS = 5
export const VOLUME_HANDOFF_MAX_DEBTS = 3

const ZH_OMITTED = '（本条已按篇幅省略，未列出的内容以定稿原文为准）'
const EN_OMITTED = '(Trimmed to fit; anything not listed above follows the finalized text)'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => text(item)).filter(Boolean) : []
}

/**
 * 六项是否全空（面板判「这份交接单是不是空的」）。
 *
 * 空白字符也算空：作者敲了一串空格再保存，不该被当成「有内容」而注入一节空壳。
 */
export function isVolumeHandoffEmpty(handoff: VolumeHandoffDefinition | null | undefined): boolean {
  if (!handoff) return true
  return !text(handoff.worldState) && !text(handoff.heroState)
    && strings(handoff.events).length === 0 && strings(handoff.items).length === 0
    && strings(handoff.debts).length === 0 && !text(handoff.openThread)
}

/**
 * 渲染【上一卷交接】整节；六项全空（或一项都装不进预算）返回空串。
 *
 * @param chapterNumber 本章章号：节首明写「本章为第 N 章」，让模型知道交接的是**上一卷**。
 * @param maxChars 正文行总字数上限；预算外**整条丢弃**，并补一行省略说明。
 */
export function renderVolumeHandoffSection(
  handoff: VolumeHandoffDefinition | null,
  writingLanguage: WritingLanguage,
  chapterNumber: number,
  maxChars: number = VOLUME_HANDOFF_CHARS,
): string {
  if (!handoff || isVolumeHandoffEmpty(handoff)) return ''
  const isEn = writingLanguage === 'en-US'
  const volumeIndex = Number.isSafeInteger(handoff.volumeIndex) && handoff.volumeIndex > 0 ? handoff.volumeIndex : null
  if (volumeIndex === null) return ''
  const firstChapter = Number.isSafeInteger(handoff.firstChapter) ? handoff.firstChapter : 0
  const lastChapter = Number.isSafeInteger(handoff.lastChapter) ? handoff.lastChapter : 0
  const currentChapter = Number.isSafeInteger(chapterNumber) && chapterNumber > 0 ? chapterNumber : 1

  const world = text(handoff.worldState)
  const hero = text(handoff.heroState)
  const events = strings(handoff.events)
  const items = strings(handoff.items)
  const debts = strings(handoff.debts)
  const openThread = text(handoff.openThread)

  const body: string[] = []
  let used = 0
  let dropped = false
  let aborted = false

  /** 追加一行正文；超预算返回 false（调用方据此 break）。 */
  const take = (line: string): boolean => {
    const cost = line.length + (body.length > 0 ? 1 : 0)
    if (used + cost > maxChars) return false
    body.push(line)
    used += cost
    return true
  }

  /** 单个文本项。 */
  const takeField = (value: string, render: (value: string) => string): void => {
    if (!value || aborted) return
    if (!take(render(value))) aborted = true
  }

  /** 一个「标签 + 若干子项」的组：标签与**至少一条**子项都要装得下，否则整组丢弃。 */
  const takeGroup = (label: string, entries: readonly string[], limit: number): void => {
    if (entries.length === 0 || aborted) return
    if (entries.length > limit) dropped = true
    const candidates = [label, ...entries.slice(0, limit).map(entry => `  - ${entry}`)]
    let simUsed = used
    let simCount = body.length
    const accepted: string[] = []
    for (const line of candidates) {
      const cost = line.length + (simCount > 0 ? 1 : 0)
      if (simUsed + cost > maxChars) break
      accepted.push(line)
      simUsed += cost
      simCount += 1
    }
    // 只有标签装得下、一条子项都装不进 ⇒ 悬空标签没有信息量，按超预算处理。
    if (accepted.length <= 1) { aborted = true; return }
    if (accepted.length < candidates.length) dropped = true
    for (const line of accepted) take(line)
  }

  takeField(world, value => (isEn ? `- World at volume end: ${value}` : `- 卷末世界：${value}`))
  takeField(hero, value => (isEn ? `- Protagonist at volume end: ${value}` : `- 卷末主角：${value}`))
  takeGroup(isEn ? '- Events to carry forward:' : '- 待承接的事件：', events, VOLUME_HANDOFF_MAX_EVENTS)
  takeGroup(isEn ? '- Key items:' : '- 关键物品：', items, VOLUME_HANDOFF_MAX_ITEMS)
  takeGroup(isEn ? '- Outstanding debts:' : '- 未结清的债：', debts, VOLUME_HANDOFF_MAX_DEBTS)
  takeField(openThread, value => (isEn ? `- Unresolved at volume end: ${value}` : `- 卷末未决：${value}`))

  // 规则 5：一项都没装进去 ⇒ 整节不出现（不是「注入了 1 条，内容是省略说明」）。
  if (body.length === 0) return ''

  const heading = isEn
    ? `[Previous volume handoff (Volume ${volumeIndex} · chapters ${firstChapter}–${lastChapter} of the book)]`
    : `【上一卷交接（第${volumeIndex}卷 · 全书第${firstChapter}–${lastChapter}章）】`
  const lead = isEn
    ? `These facts were handed over from Volume ${volumeIndex}; this chapter is Chapter ${currentChapter}; keep only what the next volume needs — this is not a chronicle. Where it conflicts with the finalized text, the finalized text prevails.`
    : `以下是从第${volumeIndex}卷交接下来的事实，本章为第${currentChapter}章；只写下一卷要用的，不是编年史。与已定稿原文冲突时以定稿原文为准。`
  const lines = [heading, lead, ...body]
  // 规则 3：省略行不计入 maxChars。
  if (dropped) lines.push(isEn ? EN_OMITTED : ZH_OMITTED)
  return lines.join('\n')
}
