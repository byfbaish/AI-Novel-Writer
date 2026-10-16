import { normalizeKeyEvents } from '../../shared/blueprint-key-events'
import type { ChapterInfo } from './chapter-workflow'

export const CHAPTER_WORDS_TARGET_MIN = 100
export const CHAPTER_WORDS_TARGET_MAX = 20_000
export const DEFAULT_CHAPTER_WORDS_TARGET = 3000

export interface ChapterCreationDialogInput {
  projectPath: string
  chapterNumber: number | ''
  title: string
  role: string
  purpose: string
  keyEvents: string
  /**
   * 本章结尾钩子（悬置点）。
   *
   * ⚠️ 与 `keyEvents` 语义分开：keyEvents 是「本章必须发生并完成的事件」，
   * 钩子是「结尾要留下的未决点」。此前单章入口漏了该字段 ⇒ 正文链收到的
   * `chapter_info` 里没有它 ⇒ 蓝图设计的钩子从未进入正文请求。
   */
  suspenseHook: string
  characters: string
  userGuidance: string
  knowledgeQueryHint: string
  wordsTarget: number | ''
  defaultWordsTarget: number
}

function finiteInteger(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Math.trunc(Number(value))
  return Number.isFinite(parsed) ? parsed : null
}

/** Normalize UI, persisted, and workflow targets to the supported chapter range. */
export function normalizeChapterWordsTarget(value: unknown, fallback: unknown = DEFAULT_CHAPTER_WORDS_TARGET): number {
  const requested = finiteInteger(value)
  if (requested !== null) {
    return Math.min(CHAPTER_WORDS_TARGET_MAX, Math.max(CHAPTER_WORDS_TARGET_MIN, requested))
  }

  const fallbackValue = finiteInteger(fallback)
  if (fallbackValue !== null) {
    return Math.min(CHAPTER_WORDS_TARGET_MAX, Math.max(CHAPTER_WORDS_TARGET_MIN, fallbackValue))
  }

  return DEFAULT_CHAPTER_WORDS_TARGET
}

/** Convert the dialog's string-oriented form state into the workflow's stable input. */
export function createChapterInfoFromDialogInput(input: ChapterCreationDialogInput): ChapterInfo {
  const requestedChapterNumber = finiteInteger(input.chapterNumber)
  const chapterNumber = requestedChapterNumber && requestedChapterNumber >= 1 ? requestedChapterNumber : 1

  return {
    projectPath: input.projectPath,
    chapterNumber,
    title: input.title || `第${chapterNumber}章`,
    role: input.role,
    purpose: input.purpose,
    characters: input.characters.split(/[、,，]/).map(s => s.trim()).filter(Boolean),
    // 弹窗里的「关键事件」是 Textarea 文本（每行一条）；在这里归一化为事件数组，
    // 使 `ChapterInfo` 之后一律持有结构化清单（阶段 1 不改编辑器形态，见设计稿 D4）。
    keyEvents: normalizeKeyEvents(input.keyEvents, { chapterNumber }),
    // 结尾钩子：空白收敛为 undefined，避免在 `chapter_info` JSON 里留下空字段。
    suspenseHook: input.suspenseHook.trim() || undefined,
    userGuidance: input.userGuidance,
    wordsTarget: normalizeChapterWordsTarget(input.wordsTarget, input.defaultWordsTarget),
    knowledgeQueryHint: input.knowledgeQueryHint.trim() || undefined,
  }
}
