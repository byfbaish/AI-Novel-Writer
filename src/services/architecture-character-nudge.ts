/**
 * 「大纲生成后，去补一次角色卡」提醒（W1 之后的作者决策，替代原 C2 方案）。
 *
 * 作者定调（2026-10-11）：
 * - 弧光**不**作为「AI 生成角色卡」的来源。合理的顺序是**大纲先出、角色随后补**；
 * - 因此大纲生成完成后要有**显著**提示，强烈建议补一次角色；
 * - 但**绝不能自动执行** —— 大纲可能还要改，什么时候补由作者决定。
 *
 * 作者修订（2026-10-20）：「一次点掉、永久消失」不符合常理。现在分三档：
 * 1. **×（关闭）**：只关掉**这一稿**（本项目 + 大纲稿本指纹），大纲一更新就重新提示；
 * 2. **不再提示**：关掉**全局**开关 `autoPromptOutlineCharacterSupplement`
 *    —— 与「设置 → 生成」里那个开关是同一份状态，随时可以在那里打开回来；
 * 3. **去补角色卡**：视为这一稿已处理（同样只对当前稿本生效）。
 *
 * 本模块只负责"该不该提示"与"提醒是否已被处理"，不做任何写入、不碰项目数据。
 */

export interface CharacterNudgeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** 仅 `localStorage` 这类可枚举的存储才有；用来「一键恢复所有项目的提示」。 */
  readonly length?: number
  key?(index: number): string | null
}

const STORAGE_PREFIX = 'vela:outline-character-nudge:'
/** 旧版语义的存储值（一次点掉、永久消失）。新版读到它按「未处理」返回，让它重新提示一次。 */
const LEGACY_DISMISSED_VALUE = 'dismissed'

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
  /** 关闭本次（×）：只对当前这一稿生效，大纲更新后会再出现。 */
  close: { zh: '关闭（大纲更新后会再提示）', en: 'Close (returns after the outline changes)' },
  /** 点过「不再提示」之后告诉作者怎么恢复 —— 不给恢复入口就等于永久消失。 */
  dismissedHint: {
    zh: '已关闭「大纲后补角色卡」提示。可在 设置 → 编辑器 里重新打开。',
    en: 'The “character cards after the outline” reminder is now off. Re-enable it in Settings → Editor.',
  },
} as const

/**
 * 全局开关变化时广播一下：横幅（ArchFileViewer）与 toast（App）分处两个组件，
 * 谁改了开关都要让另一个立刻跟上 —— 否则点了「不再提示」，横幅还挂在那里。
 */
export const OUTLINE_CHARACTER_NUDGE_CONFIG_EVENT = 'vela:outline-character-nudge-config'

export function publishOutlineCharacterNudgeConfig(globallyDisabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(OUTLINE_CHARACTER_NUDGE_CONFIG_EVENT, { detail: { globallyDisabled } }))
  } catch {
    // 非浏览器环境（测试 / SSR）：没有监听者，也就不需要广播。
  }
}

export function subscribeOutlineCharacterNudgeConfig(
  listener: (globallyDisabled: boolean) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ globallyDisabled?: boolean }>).detail
    listener(detail?.globallyDisabled === true)
  }
  window.addEventListener(OUTLINE_CHARACTER_NUDGE_CONFIG_EVENT, handler)
  return () => window.removeEventListener(OUTLINE_CHARACTER_NUDGE_CONFIG_EVENT, handler)
}

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

/**
 * 大纲的「稿本指纹」：章级覆盖数 + 正文长度。
 *
 * 用途单一：区分「同一次大纲」和「改过的大纲」。任何一次真实更新（新批次、增删章节、
 * 大段改写）都会改变它；重复打开/保存同一份内容不会。章号规则与大纲回填同一套宽松口径
 * （`第 1 章` / `第1章` 都认）。
 */
export function outlineNudgeDraftVersion(synopsis: string | null | undefined): string {
  const text = synopsis ?? ''
  if (!text) return 'empty'
  let covered = 0
  const pattern = /^[\t ]*(?:#{1,6}[\t ]+|[-*+][\t ]+)?第[\t ]*(\d{1,5})(?:[\t ]*[–—-][\t ]*(\d{1,5}))?[\t ]*章/gmu
  for (const match of text.matchAll(pattern)) {
    const to = Number(match[2] ?? match[1])
    if (Number.isSafeInteger(to) && to > covered) covered = to
  }
  return `c${covered}:l${text.length}`
}

/** 大纲已有正文、且**这一稿**还没被处理过、且全局开关没关时才提示。 */
export function shouldNudgeOutlineCharacterSupplement(input: {
  synopsis: string | null | undefined
  /** 已关闭的稿本指纹（`null` = 从没关过）。只对同一个指纹生效。 */
  dismissedVersion: string | null
  /** 全局开关（`autoPromptOutlineCharacterSupplement === false` 时整条提醒不出现）。 */
  globallyDisabled?: boolean
}): boolean {
  if (input.globallyDisabled === true) return false
  if (!hasOutlineContent(input.synopsis)) return false
  return input.dismissedVersion !== outlineNudgeDraftVersion(input.synopsis)
}

function defaultStorage(): CharacterNudgeStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * 这个项目「已处理到哪一稿」。返回 `null` 表示从没处理过。
 *
 * ⚠️ 旧版存的 `dismissed`（一次点掉、永久消失）**按未处理返回**：
 * 换语义时不能把作者的旧决定当永久承诺，宁可再提示一次。
 */
export function readOutlineCharacterNudgeDismissedVersion(
  projectPath: string | null | undefined,
  storage: CharacterNudgeStorage | null = defaultStorage(),
): string | null {
  if (!projectPath || !storage) return null
  try {
    const value = storage.getItem(outlineCharacterNudgeKey(projectPath))
    if (!value || value === LEGACY_DISMISSED_VALUE) return null
    return value
  } catch {
    return null
  }
}

/** 把「这一稿已处理」记下来（关闭 / 去补角色卡都走这里）。 */
export function dismissOutlineCharacterNudge(
  projectPath: string | null | undefined,
  synopsis: string | null | undefined,
  storage: CharacterNudgeStorage | null = defaultStorage(),
): void {
  if (!projectPath || !storage) return
  try {
    storage.setItem(outlineCharacterNudgeKey(projectPath), outlineNudgeDraftVersion(synopsis))
  } catch {
    // 存储不可用（隐私模式等）时静默降级：最多是下次启动再提示一次，不影响功能。
  }
}

/** 清掉本项目的处理记录（恢复提示 / 新大纲后重新武装）。 */
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

/**
 * 清掉**所有项目**的处理记录 —— 把全局开关重新打开时用。
 *
 * 开关关掉时各项目各自记下了「这一稿处理过」；只把开关拨回来而不清记录，
 * 横幅要等大纲下次更新才回来，等于「打开了也没用」。设置面板不知道当前项目
 * （甚至可能一个项目都没开），所以按前缀一次性清干净。
 */
export function rearmAllOutlineCharacterNudges(
  storage: CharacterNudgeStorage | null = defaultStorage(),
): void {
  if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') return
  try {
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    // 同上：静默降级。
  }
}
