/**
 * 自由文本按步骤分区（段级标签）。
 *
 * 背景：作者自由文本（`globalGuidance` / `referenceWorks` / …）此前被**无差别**注入到
 * 所有步骤 —— 结果一头是**该看它的看不到**（世界观的体系/机制参考没进世界观模板），
 * 另一头是**不该每章吃它的每章吃**（"一句一段""弹幕用【】"这类正文排版规则被当成设定层约束）。
 * 根因是框架没有「这段文字属于哪一步」的表达手段。
 *
 * 本模块给自由文本加一段极小的段级语法：
 *
 * ```
 * 【适用：架构】      ← 整行独立，其后内容只给架构链
 * 【适用：大纲】
 * 【适用：正文】
 * 【适用：全部】      ← 等价于不打标签
 * ```
 *
 * 设计取舍（详见 `docs/design/prompt/free-text-scoping-design.md`）：
 * - **显式归属、无继承**：作者裁定"架构标签的内容仅供主架构使用，大纲蓝图是根据架构生成的，
 *   不应该重复吃上层材料" —— 所以打了 `架构` 的段**不会**顺流到大纲/正文。
 *   要同时给两侧，就写组合值（`【适用：架构,正文】`）。
 * - **无标签 = 全量**：旧数据行为**逐字不变**（`projectScopedText` 对无标签输入走快路径直接返回原文）。
 * - **未知标签 = 全量 + 告警**：绝不静默丢材料（守 `chapter-materials.ts` 那条"材料不得静默截断"）。
 * - **标签行永不进 prompt**：投影时剔除；DB 里保留原文，作者随时可改。
 * - 零依赖纯函数：`workflows` 与渲染层共用（与 `synopsis-projection.ts` 同族）。
 */

/** 三个真实读取点对应的工作档位。 */
export type TextScopeTag = 'architecture' | 'outline' | 'draft'

/** 全部档位（含"全部"这一伪档位），供 UI chip 按固定顺序渲染。 */
export const TEXT_SCOPE_TAG_CHOICES = ['architecture', 'outline', 'draft', 'all'] as const

export type TextScopeChoice = TextScopeTag | 'all'

/** 档位的内部键 → 作者书写的中文标签。UI chip 与解析共用同一张表，避免两处口径。 */
export const TEXT_SCOPE_TAG_LABELS: Readonly<Record<TextScopeTag, string>> = {
  architecture: '架构',
  outline: '大纲',
  draft: '正文',
}

/** 作者书写的中文标签 → 内部键。`全部` 与"不打标签"等价（全量注入）。 */
export const TEXT_SCOPE_TAG_VALUES: Readonly<Record<string, TextScopeChoice>> = {
  架构: 'architecture',
  大纲: 'outline',
  正文: 'draft',
  全部: 'all',
}

/**
 * 标签行的识别式。
 *
 * ⚠️ **必须整行独立**（两端锚定）：作者的自由文本里本来就有「弹幕语言用【】括起来」这类
 * 行内方括号，若允许行内匹配就会静默吃掉正文。这条是硬边界，已被单测钉住。
 */
const TAG_LINE = /^[\t ]*【适用[：:][\t ]*([^】]{0,120})】[\t ]*$/

/** 组合值分隔符：中英文逗号 / 顿号 / 分号 / 空白。 */
const VALUE_SEPARATOR = /[,，、;；\t ]+/

export interface TextScopeStats {
  /** 会进入架构链的段数（含未标注段）。 */
  architecture: number
  /** 会进入大纲/蓝图链的段数（含未标注段）。 */
  outline: number
  /** 会进入正文链的段数（含未标注段）。 */
  draft: number
  /** 未标注（或显式写 `全部`）的段数。 */
  everyStep: number
  /** 总段数。 */
  total: number
  /** 未识别的标签值原文（非空 → UI 必须告警，且该段按全量处理）。 */
  unknownTags: string[]
}

export interface ScopedTextResult {
  /** 投影后的文本（标签行已剔除）。无标签输入时逐字等于原文。 */
  text: string
  /** 被采纳的段数。 */
  kept: number
  /** 被剔除的段数。 */
  dropped: number
  /** 段归属统计（UI 的可观测性兜底）。 */
  stats: TextScopeStats
}

interface ParsedSegment {
  /** 该段归属；`all` = 全量（未标注、显式 `全部`、或标签值未识别）。 */
  values: TextScopeTag[] | 'all'
  lines: string[]
}

/**
 * 切段。⚠️ **接受 `undefined`**：本函数是 UI 组件（`ScopeTagBar`）的渲染路径，
 * 而配置字段在旧项目/未填时为 undefined（类型写 `string` 也挡不住运行时）。若不防御，
 * `undefined.split` 会在渲染期抛错、把整棵编辑器树打挂（2026-10-15 实测 f05 旅程 5 例）。
 * 语义：`undefined` 等价空串（空文本 → 0 段 + 0 标签）。
 */
function parseSegments(raw: string | undefined): {
  segments: ParsedSegment[]
  unknownTags: string[]
  hasTag: boolean
} {
  const lines = (raw ?? '').split(/\r?\n/)
  const segments: ParsedSegment[] = []
  const unknownTags: string[] = []
  let current: ParsedSegment = { values: 'all', lines: [] }
  let hasTag = false

  for (const line of lines) {
    const matched = TAG_LINE.exec(line)
    if (!matched) {
      current.lines.push(line)
      continue
    }
    hasTag = true
    if (current.lines.length > 0) segments.push(current)

    const written = (matched[1] ?? '').split(VALUE_SEPARATOR).map(value => value.trim()).filter(Boolean)
    const tags: TextScopeTag[] = []
    let unresolved = written.length === 0
    let everything = written.length === 0
    for (const value of written) {
      const mapped = TEXT_SCOPE_TAG_VALUES[value]
      if (!mapped) {
        // 未识别的值：整段按全量处理（不静默丢材料），并把原文交给 UI 告警。
        unresolved = true
        if (!unknownTags.includes(value)) unknownTags.push(value)
        continue
      }
      if (mapped === 'all') everything = true
      else if (!tags.includes(mapped)) tags.push(mapped)
    }
    current = { values: unresolved || everything ? 'all' : tags, lines: [] }
  }
  if (current.lines.length > 0) segments.push(current)

  return { segments, unknownTags, hasTag }
}

function buildStats(segments: readonly ParsedSegment[], unknownTags: string[]): TextScopeStats {
  const stats: TextScopeStats = {
    architecture: 0,
    outline: 0,
    draft: 0,
    everyStep: 0,
    total: segments.length,
    unknownTags,
  }
  for (const segment of segments) {
    if (segment.values === 'all') {
      stats.everyStep += 1
      stats.architecture += 1
      stats.outline += 1
      stats.draft += 1
      continue
    }
    for (const tag of segment.values) stats[tag] += 1
  }
  return stats
}

/**
 * 按工作档位投影自由文本。
 *
 * @param step 目标档位；`'all'` = 不过滤（仅剔标签行），用于"统计"与测试对照。
 *
 * 无标签输入 → **逐字返回原文**（快路径）：这是"旧数据零改动"的第一保证，
 * 也避免纯文本被换行规范化碰到。
 */
export function projectScopedText(raw: string | undefined, step: TextScopeChoice): ScopedTextResult {
  const { segments, unknownTags, hasTag } = parseSegments(raw)
  const stats = buildStats(segments, unknownTags)
  if (!hasTag) return { text: raw ?? '', kept: segments.length, dropped: 0, stats }

  const kept: ParsedSegment[] = []
  let dropped = 0
  for (const segment of segments) {
    if (step === 'all' || segment.values === 'all' || segment.values.includes(step)) kept.push(segment)
    else dropped += 1
  }
  const text = kept
    .flatMap(segment => segment.lines)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/, '')

  return { text, kept: kept.length, dropped, stats }
}

/** 段归属统计（不过滤内容），供 UI 常驻提示。 */
export function summarizeScopedText(raw: string | undefined): TextScopeStats {
  return projectScopedText(raw, 'all').stats
}

/**
 * 参与段级分区的**作者自由文本**配置字段。
 *
 * ⚠️ 与 `generate-draft.command.ts` 的 `promptOnlyConfigKeys` 是两件事：那张表管
 * 「不要把这几项塞进 novel_config JSON」（**排除**），本表管「这几项按档位投影」（**过滤**）。
 * 两者的交集正是这套机制覆盖的三个变量。
 *
 * 为什么必须集中成一张表：`architecture.command.ts` 的「其余冻结作者配置」块是把
 * 整个 config `JSON.stringify` 进 prompt 的 —— 那是**第 7 个注入点**，不走模板变量，
 * 极易漏掉。实测漏掉时，大纲请求里会出现带 `【适用：架构】` 的原始文本（2026-10-13 实机取证）。
 */
export const SCOPED_FREE_TEXT_CONFIG_KEYS = ['globalGuidance', 'referenceWorks', 'writingStyle'] as const

/**
 * 按档位投影配置里的自由文本字段，其余字段原样保留。
 *
 * 无标签输入逐字不变（走 `projectScopedText` 快路径），故对未标注的旧数据是零风险动作。
 * 用在「整份 config 直灌 prompt」的注入点上，替代裸 `JSON.stringify(config)`。
 */
export function projectScopedConfigFields<T extends object>(
  config: T,
  step: TextScopeChoice,
): T {
  const projected = Object.assign({} as Record<string, unknown>, config) as Record<string, unknown>
  for (const key of SCOPED_FREE_TEXT_CONFIG_KEYS) {
    const value = projected[key]
    if (typeof value === 'string') projected[key] = projectScopedText(value, step).text
  }
  return projected as unknown as T
}

/** chip 要插入的字面量，如 `【适用：架构】`。 */
export function textScopeTagToken(choice: TextScopeChoice): string {
  const label = choice === 'all' ? '全部' : TEXT_SCOPE_TAG_LABELS[choice]
  return `【适用：${label}】`
}
