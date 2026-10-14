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
    userGuidance: input.userGuidance,
    wordsTarget: normalizeChapterWordsTarget(input.wordsTarget, input.defaultWordsTarget),
    knowledgeQueryHint: input.knowledgeQueryHint.trim() || undefined,
  }
}
