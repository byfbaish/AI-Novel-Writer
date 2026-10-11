/**
 * 「大纲生成后，去补一次角色卡」提醒（W1 之后的作者决策，替代原 C2 方案）。
 *
 * 作者定调（2026-10-11）：
 * - 弧光**不**作为「AI 生成角色卡」的来源。合理的顺序是**大纲先出、角色随后补**；
 * - 因此大纲生成完成后要有**显著**提示，强烈建议补一次角色；
 * - 但**绝不能自动执行** —— 大纲可能还要改，什么时候补由作者决定。
 *
 * 本模块只负责"该不该提示"与"提醒是否已被处理"，不做任何写入、不碰项目数据。
 * 提醒状态按**项目路径**记忆；新的大纲生成完成后调用 `rearm` 重新武装。
 */

export interface CharacterNudgeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_PREFIX = 'vela:outline-character-nudge:'
const DISMISSED_VALUE = 'dismissed'

/** 与架构状态判定一致：正文超过该长度才算「已生成」。 */
export const OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS = 50

export const OUTLINE_CHARACTER_NUDGE_COPY = {
  toast: {
    zh: '情节大纲已生成。大纲里通常会出现尚未建卡的角色 —— 强烈建议现在补一次角色卡。这一步不会自动执行：大纲可能还需要修改，时机由你决定。',
    en: 'The plot outline is ready. It usually introduces characters that have no card yet — strongly consider adding character cards now. Nothing runs automatically: the outline may still change, so the timing is yours.',
  },
  banner: {
    zh: '情节大纲已完成，但还没有系统地补过角色卡。大纲里出现的角色不会自动建卡 —— 建议核对大纲、定稿后再补一次（顺序颠倒会造成返工）。',
    en: 'The plot outline is complete, but character cards have not been systematically added yet. Characters that appear in the outline are not turned into cards automatically — review the outline and add them once it settles (doing it earlier causes rework).',
  },
  action: { zh: '去补角色卡', en: 'Add character cards' },
  later: { zh: '稍后', en: 'Later' },
  dismiss: { zh: '不再提示', en: 'Do not show again' },
} as const

export function outlineCharacterNudgeKey(projectPath: string): string {
  return `${STORAGE_PREFIX}${projectPath}`
}

/**
 * 正文是否已经算「有内容」。
 * 逐字符扫描并在够数后立即返回，避免对大段大纲反复 `trim()` 复制。
 */
export function hasOutlineContent(synopsis: string | null | undefined): boolean {
  if (!synopsis) return false
  let seen = 0
  for (let index = 0; index < synopsis.length; index += 1) {
    const code = synopsis.charCodeAt(index)
    // 空格 / 制表 / 换行 / 回车 不计入有效字数
    if (code !== 32 && code !== 9 && code !== 10 && code !== 13) {
      seen += 1
      if (seen > OUTLINE_CHARACTER_NUDGE_MIN_CHARACTERS) return true
    }
  }
  return false
}

/** 大纲已有正文、且作者尚未处理过这条提醒时才提示。 */
export function shouldNudgeOutlineCharacterSupplement(input: {
  synopsis: string | null | undefined
  dismissed: boolean
}): boolean {
  return hasOutlineContent(input.synopsis) && !input.dismissed
}

function defaultStorage(): CharacterNudgeStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** 作者已经处理过（点了「去补角色卡」或「不再提示」）该项目的这条提醒。 */
export function readOutlineCharacterNudgeDismissed(
  projectPath: string | null | undefined,
  storage: CharacterNudgeStorage | null = defaultStorage(),
): boolean {
  if (!projectPath || !storage) return false
  try {
    return storage.getItem(outlineCharacterNudgeKey(projectPath)) === DISMISSED_VALUE
  } catch {
    return false
  }
}

export function dismissOutlineCharacterNudge(
  projectPath: string | null | undefined,
  storage: CharacterNudgeStorage | null = defaultStorage(),
): void {
  if (!projectPath || !storage) return
  try {
    storage.setItem(outlineCharacterNudgeKey(projectPath), DISMISSED_VALUE)
  } catch {
    // 存储不可用（隐私模式等）时静默降级：最多是下次启动再提示一次，不影响功能。
  }
}

/** 新的大纲生成完成后重新武装，让作者在下一次大纲变动后再被提醒一次。 */
export function rearmOutlineCharacterNudge(
  projectPath: string | null | undefined,
  storage: CharacterNudgeStorage | null = defaultStorage(),
): void {
  if (!projectPath || !storage) return
  try {
    storage.removeItem(outlineCharacterNudgeKey(projectPath))
  } catch {
    // 同上：静默降级。
  }
}
