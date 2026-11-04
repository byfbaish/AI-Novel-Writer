/**
 * 大纲侧钩子行校验（D18 的 C1 / C1b / C2 / C4）。
 *
 * 全部**只报不改**，除 C1 外不阻断：craft 判断（类型选得对不对、断点够不够强）机器判不了，
 * 见 `docs/design/prompt/d18-chapter-hook-contract-design.md` §7。
 *
 * ## 三档的边界（别在这里扩到"判得好不好"）
 * - C1（accident）：结构缺失 —— 没有钩子行、新格式的类型不认识、新格式缺「种在：」。
 *   **旧名「收尾：」不报**：历史大纲是作者资产，别名永久兼容（设计稿 §9.2-1）。
 * - C1b（report）：版式偏离 —— 问号、心理动词作谓语、解释/总结词。只提示，不重跑。
 * - C2（report）：断点与本章正文**没有任何共享实词**。机器分不清是"空钩"还是"外挂"，
 *   所以只报事实 + 让作者判，不假装能定性（设计稿 §3.2 第 1 条末注）。
 * - C4（report）：自称 `落点` 却指不到本章「选择：」行。
 */

import { outlineChapterHeading } from './chapter-heading'
import { parseHookLine, type ParsedHookLine } from './synopsis-hook-line'
import { tokenize } from './suspense-hook-alignment'

export type HookFindingLevel = 'accident' | 'report'
export type HookFindingCode = 'C1-structure' | 'C1b-format' | 'C2-anchor' | 'C4-landing'

export type HookFinding = {
  code: HookFindingCode
  level: HookFindingLevel
  /** 全书章号；切不出章号时为 `null`。 */
  chapter: number | null
  /** 给作者看的一句话，说清"哪里不对 + 怎么处理"。 */
  message: string
  /** 出问题的原文（钩子行或那一章的开头），便于定位。 */
  excerpt: string
}

export type HookAuditResult = {
  findings: HookFinding[]
  /** 有钩子行（新名或旧名）的章数 —— 清点页用。 */
  chaptersWithHook: number
  /** 检查过的章数。 */
  chaptersChecked: number
}

/** 问号：中文与半角都算（设计稿 §3.1 版式第 1 条）。 */
const QUESTION_MARK_RE = /[？?]/

/**
 * 心理动词作谓语。
 *
 * **判的是句法位置，不是内容词表**（P11-1 红线的边界）：只抓"施事 + 认知/感知动词"这种
 * 叙述者代替人物下判断的形态，不做"出现某词即违规"的匹配。所以要求动词前有人称或
 * 紧跟在句首，避免把 `他知道的那条规矩`（定语）也算进来。
 */
const MENTAL_PREDICATE_RE =
  /(?:^|[，。；：！？\s])(?:他|她|它|我|你|众人|对方|老人|那人|其)?(?:此刻|忽然|忽然间|这才|才|仍|还|就|已经|十分|有些)?(?:想|要)?(?:知道|明白|疑惑|怀疑|担心|害怕|察觉|意识到)(?:着|了|道)?(?![的之])/

/** 解释 / 总结 / 补因果（设计稿 §3.1 版式第 4 条）。 */
const EXPLANATION_RE = /(?:原来|这意味着|这一切都|因此|于是|所以|终于明白|从此|也就是说|换句话说)/

function tokensOf(text: string): Set<string> {
  return new Set(tokenize(text))
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const token of left) if (right.has(token)) count += 1
  return count
}

/** 从一章的块里取「选择：」行的冒号后内容（没有返回 `null`）。 */
function choiceLineOf(chapterText: string): string | null {
  const match = /^[ \t>*-]*选择[：:][ \t]*(.+)$/m.exec(chapterText)
  return match ? match[1]!.trim() : null
}

/**
 * 校验**一章**。
 *
 * @param hook 该章的钩子行（用 `parseHookLine` 解析好的）；`null` 表示这一章没有。
 * @param chapterText 这一章的整块文本（含章标题、声明行、正文），用于 C2 与 C4 取证。
 */
export function auditChapterHook(
  chapter: number | null,
  hook: ParsedHookLine | null,
  chapterText: string,
): HookFinding[] {
  const findings: HookFinding[] = []
  const where = chapter === null ? '这一章' : `第 ${chapter} 章`

  if (!hook) {
    findings.push({
      code: 'C1-structure',
      level: 'accident',
      chapter,
      message: `${where}没有钩子行。每章都必须有，缺了它下一章的承接没有接口。`,
      excerpt: chapterText.split(/\r?\n/).slice(0, 2).join(' / ').slice(0, 120),
    })
    return findings
  }

  // C1：结构。旧名「收尾：」只要求"有这一行"，不要求新格式 —— 历史大纲不逼重生成。
  if (!hook.legacy) {
    if (!hook.type) {
      findings.push({
        code: 'C1-structure',
        level: 'accident',
        chapter,
        message: `${where}的钩子行没有合法类型。类型只能是六值之一：悬念截断 / 危机降临 / 信息炸弹 / 两难选择 / 情绪断裂 / 落点。`,
        excerpt: hook.raw,
      })
    }
    if (!hook.plantedIn) {
      findings.push({
        code: 'C1-structure',
        level: 'accident',
        chapter,
        message: `${where}的钩子行缺「种在：」。它要指认本章正文里的一段（用一个具名对象），指不出来就是外挂。`,
        excerpt: hook.raw,
      })
    }
  }

  const breakPoint = hook.breakPoint.trim()
  if (!breakPoint) {
    findings.push({
      code: 'C1-structure',
      level: 'accident',
      chapter,
      message: `${where}的钩子行只有类型、没有断点。断点要写一件纸上已经发生的事，停在下一步之前。`,
      excerpt: hook.raw,
    })
    return findings
  }

  // C1b：版式。只报不重跑 —— 指令层的形态问题（设计稿 §3.5）。
  const formatProblems: string[] = []
  if (QUESTION_MARK_RE.test(breakPoint)) formatProblems.push('出现问号（疑问句是替读者问）')
  if (MENTAL_PREDICATE_RE.test(breakPoint)) formatProblems.push('用心理活动作谓语（把读者要做的推理替他做完了）')
  if (EXPLANATION_RE.test(breakPoint)) formatProblems.push('含解释/总结/补因果的收束语句')
  if (formatProblems.length > 0) {
    findings.push({
      code: 'C1b-format',
      level: 'report',
      chapter,
      message: `${where}的断点版式偏离：${formatProblems.join('；')}。只提示 —— 这一行可能被正文照抄，落盘时核对末段。`,
      excerpt: hook.raw,
    })
  }

  // C2：断点与本章正文有没有共享实词。0 ⇒ 报，但**不判是空钩还是外挂**（机器分不清）。
  const bodyTokens = tokensOf(chapterText)
  const breakTokens = tokensOf(breakPoint)
  if (breakTokens.size > 0 && overlapCount(breakTokens, bodyTokens) === 0) {
    findings.push({
      code: 'C2-anchor',
      level: 'report',
      chapter,
      message: `${where}的断点与本章正文没有任何共享实词：要么断点里没有可指认的对象（空钩），要么那个对象不在本章（外挂）。机器分不清这两种，请作者判。`,
      excerpt: hook.raw,
    })
  }

  // C4：自称「落点」时，要能指到本章「选择：」行或一次具名的状态改变。
  if (hook.type === '落点') {
    const choice = choiceLineOf(chapterText)
    if (!choice) {
      findings.push({
        code: 'C4-landing',
        level: 'report',
        chapter,
        message: `${where}标为「落点」，但本章没有「选择：」行可承接。落点要落在一次已经做出的决定或一次具名改变上，不是纯情绪。`,
        excerpt: hook.raw,
      })
    } else if (overlapCount(breakTokens, tokensOf(choice)) === 0) {
      findings.push({
        code: 'C4-landing',
        level: 'report',
        chapter,
        message: `${where}标为「落点」，但断点与本章「选择：」行没有共享实词。若那件变了的事另有出处（具名状态改变），可忽略本条。`,
        excerpt: hook.raw,
      })
    }
  }

  return findings
}

type OutlineBlock = { chapter: number | null; lines: string[] }

/**
 * 按章切块。切块复用 `chapter-heading.ts` 的唯一解析（红线 22：章标题只有一个解析处）。
 * 第一个章标题之前的设定层不参与 —— 那里不该有钩子行。
 */
function splitOutlineBlocks(synopsis: string): OutlineBlock[] {
  const lines = synopsis.split(/\r?\n/)
  const blocks: OutlineBlock[] = []
  let current: OutlineBlock | null = null

  for (const line of lines) {
    const heading = outlineChapterHeading(line)
    if (heading) {
      current = { chapter: heading.chapter, lines: [line] }
      blocks.push(current)
      continue
    }
    if (current) current.lines.push(line)
  }
  return blocks
}

/**
 * 找出指定章在大纲里的钩子行原文（新名「钩子：」或旧名「收尾：」都算）。
 *
 * 给产出层的 C5 做**蓝图缺失时的回退输入**用：C5 的首选输入是蓝图 `suspenseHook`，
 * 蓝图没有该章时才回退到大纲钩子行（设计稿 §7 C5 行）。
 */
export function findOutlineHookLine(synopsis: string, chapter: number): string | null {
  const block = splitOutlineBlocks(synopsis).find(item => item.chapter === chapter)
  if (!block) return null
  let raw: string | null = null
  for (const line of block.lines) {
    if (parseHookLine(line)) raw = line
  }
  return raw
}

/**
 * 校验一段（可能跨多章的）大纲文本。
 */
export function auditOutlineHooks(synopsis: string): HookAuditResult {
  const findings: HookFinding[] = []
  const blocks = splitOutlineBlocks(synopsis)

  let chaptersWithHook = 0
  for (const block of blocks) {
    let hook: ParsedHookLine | null = null
    let hookLineIndex = -1
    block.lines.forEach((line, index) => {
      const parsed = parseHookLine(line)
      if (parsed) {
        hook = parsed
        hookLineIndex = index
      }
    })
    if (hook) chaptersWithHook += 1
    // 钩子行本身不属于「本章正文」：比对 C2 / C4 时必须把它排除，否则断点永远与
    // 自己所在的这一行共享实词，C2 变成恒不报的空判据（2026-11-04 接线时发现）。
    const chapterText = block.lines.filter((_, index) => index !== hookLineIndex).join('\n')
    findings.push(...auditChapterHook(block.chapter, hook, chapterText))
  }

  return { findings, chaptersWithHook, chaptersChecked: blocks.length }
}
