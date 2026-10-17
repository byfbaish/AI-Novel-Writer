import type { PromptProjectionNote } from './prompt-projection'
import { writingLanguageText, type WritingLanguage } from './writing-language'

/**
 * 故事架构 → 正文的「远期节边界化」投影（P1-2a，2026-10-16）。
 *
 * 设计依据：`docs/design/prompt/p1-2-architecture-projection-design.md`（§3 范式 / §4 方案 A / §5 输出形态）。
 * 上级稿：`docs/design/prompt/prompt-payload-scoping-design.md`（P1-2 行 / §5.5 契约表 / §6 L2）。
 *
 * ## 为什么需要它
 *
 * 正文链把 `premise + worldbuilding + 设定段大纲` 拼成变量 `{{architecture}}` 全量下发
 *（实机 ch2：6,854 字 = user 消息的 **39.9%**，单块最大的材料）。其中
 * `### 3.【隐喻与深层危机】` 按**模板自己的定义**就是「世界背后的终极灾变或最大谜团」
 *「被掩盖的真相」——本质是剧透：写第 2 章时，请求里已经躺着「终极谜团：能力是被『写』
 * 进来的」「零号档案」「终极抉择」。
 *
 * ## 做什么 / 不做什么
 *
 * 只做「按**模板固定标题**定位整节 + 整节替换为一行远期声明」这类**结构对结构**的事：
 * 不解析语义、不判断哪句属于远期、不做节内挑段、不改写、不调模型、不写库。
 *
 * ⚠️ 远期/近期的分界**大多落在同一节内部**（实测：`### 1` 的可操作漏洞清单里
 *「前期…中期…**本作后期**最危险的实验区」并陈）⇒ 本模块只能覆盖「整节远期」这一种形态，
 * 载荷削减上限约 5%（ch2 实测省 896 字 = user 的 5.2%）。要做到上级稿设想的「只给事实源」，
 * 必须给设定加**期次结构**（P1-2b，另立小项）。
 *
 * ## fail-open
 *
 * 任何一步不成立（输入为空、找不到该标题、该节正文为空、已投影过）都返回**原文**：
 * 不注入、不告警、不中止生成。作者在覆盖版改了标题 ⇒ 静默 no-op，
 * **只会少省，不会多删**。
 *
 * ## 唯一注入入口 = 改写变量值
 *
 * 与 `withSpaceConstraints`（B′ 段二）同构：作者全局覆盖版会静默遮蔽内置模板（红线 3），
 * 新增 `requiredContextVariables` 对未引用它的覆盖版只会追加到正文末尾（红线 16）。
 * 改写变量值则对内置与覆盖版**同样生效**。
 */

/**
 * 远期节标题（按**模板固定标题**定位，不按语义判断）。
 *
 * `world_building` 模板强制输出四个固定标题，其中第 3 维被定义为「终极灾变或最大谜团」
 *「被掩盖的真相」——模板自己写明了它是远期层。
 */
const FAR_TERM_SECTION_PATTERNS: readonly RegExp[] = [
  // zh: `### 3.【隐喻与深层危机】` / `## 隐喻与深层危机`
  /^#{1,6}\s*(?:\d+[.、)]\s*)?(?:【)?[^【】\n]*隐喻与深层危机[^【】\n]*(?:】)?\s*$/u,
  // en: `### 3. Hidden history and deep crisis`
  /^#{1,6}\s*(?:\d+[.、)]\s*)?[^\n]*\bhidden history and deep crisis\b[^\n]*$/iu,
]

/** 节结束 = 下一个 markdown 标题（任意级别）。 */
const SECTION_END = /^#{1,6}\s/u

/** 水平分割线：`---`。变量值里各段用 `\n\n---\n\n` 连接，替换时不得把它吃掉。 */
const THEMATIC_BREAK = /^\s*-{3,}\s*$/u

/** 幂等判据（zh / en 两形态）。 */
const NOTICE_MARKERS: readonly string[] = [
  '（本节属于后文才展开的远期设定',
  '(This section is a later-stage setting',
]

/** 替换远期节正文的声明。措辞与运行时合同（方案 C）同义，但作用域只在节内。 */
function farTermNotice(language: WritingLanguage): string {
  return writingLanguageText(
    language,
    '（本节属于后文才展开的远期设定，正文只保留要点；本章不得提前写出其结论或明示，也不得写出相反内容）',
    '(This section is a later-stage setting: keep only the gist; do not state or reveal its conclusions in this chapter, and do not contradict it.)',
  )
}

/**
 * 投影结果 + 元数据（P1-3′ 可观测性）。
 *
 * `projection` 只在**真的发生了整节边界化**时给出；任何 fail-open（逐字返回原文）时为 `null`
 * —— 这样 trace 能区分「这一步投影生效了」与「这一步没动」。
 */
export interface ArchitectureProjectionResult {
  text: string
  projection: PromptProjectionNote | null
}

/**
 * 把整节远期的设定段压成「标题 + 一行声明」，并附带投影元数据。
 *
 * 找不到该节、该节正文为空、或已经投影过时，**逐字返回原文**且 `projection` 为 `null`（fail-open）。
 */
export function projectArchitectureForDraft(
  architecture: string | null | undefined,
  language: WritingLanguage,
): ArchitectureProjectionResult {
  const source = architecture ?? ''
  if (!source.trim()) return { text: source, projection: null }
  if (NOTICE_MARKERS.some(marker => source.includes(marker))) return { text: source, projection: null }

  const lines = source.replace(/\r\n?/gu, '\n').split('\n')
  const start = lines.findIndex(line => (
    FAR_TERM_SECTION_PATTERNS.some(pattern => pattern.test(line.trim()))
  ))
  if (start < 0) return { text: source, projection: null }

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (SECTION_END.test(lines[index]!.trim())) { end = index; break }
  }

  // 尾部收缩：分隔线与空行不属于该节正文，必须留给后续段落。
  let bodyEnd = end
  const trimTail = () => {
    while (bodyEnd > start + 1 && !lines[bodyEnd - 1]!.trim()) bodyEnd -= 1
    if (bodyEnd > start + 1 && THEMATIC_BREAK.test(lines[bodyEnd - 1]!)) {
      bodyEnd -= 1
      while (bodyEnd > start + 1 && !lines[bodyEnd - 1]!.trim()) bodyEnd -= 1
    }
  }
  trimTail()

  const body = lines.slice(start + 1, bodyEnd)
  if (!body.some(line => line.trim())) return { text: source, projection: null }

  const projected = [
    ...lines.slice(0, start + 1),
    farTermNotice(language),
    ...lines.slice(bodyEnd),
  ]
  const text = projected.join('\n')
  return {
    text,
    projection: {
      variable: 'architecture',
      kind: 'far-term-section-collapse',
      beforeChars: source.length,
      afterChars: text.length,
      droppedSections: [lines[start]!.trim()],
    },
  }
}

/**
 * 兼容入口：只要投影后的文本（既有调用点与测试继续可用）。
 *
 * 需要投影元数据的调用点请改用 `projectArchitectureForDraft`。
 */
export function withArchitectureDraftProjection(
  architecture: string | null | undefined,
  language: WritingLanguage,
): string {
  return projectArchitectureForDraft(architecture, language).text
}
