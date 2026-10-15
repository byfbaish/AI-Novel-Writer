/**
 * 【后续计划边界】清单正文生成（P1-1）。
 *
 * 设计依据：`docs/design/p1-1-boundary-notice-design.md`（§3 契约 / §4 提取规则 / §5 输出形态）。
 * 上级稿：`docs/design/prompt-payload-scoping-design.md` 附录 B（`toBoundaryNotice` 派生机制）。
 *
 * 目的：后续章节的 `keyEvents` 原先被**逐字**塞进正文请求的 user 消息（实机 1,598 字），
 * 模型把它当「可写素材」⇒ 续写越界下一章。本模块把它重新定性为「**不可写事件要点**」：
 * 只做机械收敛（按章分组 + 首句截断），**不做**语义判断、不改写、不合并、不排序、
 * 不调模型、不写库。归属由蓝图自身的章节编号保证，因此无需 NER。
 *
 * 与 `blueprint-key-events.ts` 同层同风格：纯函数、不抛错、零副作用。
 */

import { normalizeKeyEvents, type BlueprintKeyEvent } from './blueprint-key-events'
import { writingLanguageText, type WritingLanguage } from './writing-language'

/**
 * 单条边界要点的长度上限（汉字数）。超出即截断并加省略号。
 *
 * 80 字足以容纳「谁 + 在哪儿 + 做了什么」的一个完整首句，又不至于把整段故事搬回来；
 * 仅在极端长句（整章只有一句话）时才触发。
 */
export const BOUNDARY_EVENT_MAX_CHARS = 80

/** 一章后续蓝图。调用方负责按 `n+1..n+N` 过滤并升序。 */
export interface BoundaryChapter {
  chapterNumber: number
  title: string
  keyEvents: readonly BlueprintKeyEvent[] | string | null | undefined
}

export interface BoundaryNoticeInput {
  /** 后续章节，已按章号升序。没有任何可列事件 ⇒ 返回空串。 */
  chapters: readonly BoundaryChapter[]
}

/**
 * 首句终止标点。
 * - 中文/全角：`。！？；`
 * - 英文/半角：`.!?;`，但必须紧跟空白或行尾 —— 否则 `3.5` / `v1.2` / 网址会被误切。
 *   （`Mr. Smith` 这类缩写仍会被切；边界标签只需示出「从哪件事开始」，代价可接受。）
 */
const SENTENCE_END = /[。！？；]|[.!?;](?=\s|$)/u

/** 压成一条短标签：截到首个终止标点，再套 80 字上限。 */
function boundaryLabel(event: string): string {
  const text = event.trim()
  if (!text) return ''
  const end = text.search(SENTENCE_END)
  const firstSentence = end >= 0 ? text.slice(0, end + 1) : text
  return firstSentence.length > BOUNDARY_EVENT_MAX_CHARS
    ? `${firstSentence.slice(0, BOUNDARY_EVENT_MAX_CHARS)}…`
    : firstSentence
}

/**
 * 生成边界清单正文（**不含**标题与说明——那两块留在 `chapter-materials.ts`）。
 *
 * 输出形态（中文；英文对称，`第N章《title》` ⇄ `Chapter N — title`）：
 *
 * ```
 * - 第2章《标题》：首句要点。
 * - 第6章《标题》：
 *   - 首句要点一。
 *   - 首句要点二。
 * ```
 *
 * 单条事件并入章标题行；多条事件改为章标题行 + 缩进子项。
 * 无事件的章整章略去（「什么都别写」的章贡献不了边界）。
 */
export function toBoundaryNotice(language: WritingLanguage, input: BoundaryNoticeInput): string {
  const lines: string[] = []
  for (const chapter of input.chapters ?? []) {
    const events = normalizeKeyEvents(chapter.keyEvents, { chapterNumber: chapter.chapterNumber })
      .map(item => boundaryLabel(item.event))
      .filter(Boolean)
    if (events.length === 0) continue
    const head = writingLanguageText(
      language,
      `第${chapter.chapterNumber}章《${chapter.title}》`,
      `Chapter ${chapter.chapterNumber} — ${chapter.title}`,
    )
    if (events.length === 1) {
      // 行内分隔符在英文里要带尾随空格（`Chapter 2 — Echo: He returns.`）。
      lines.push(`- ${head}${writingLanguageText(language, '：', ': ')}${events[0]}`)
      continue
    }
    // 块式分隔符不带尾随空格，避免章标题行以空白结尾。
    lines.push(`- ${head}${writingLanguageText(language, '：', ':')}`)
    for (const event of events) lines.push(`  - ${event}`)
  }
  return lines.join('\n')
}
