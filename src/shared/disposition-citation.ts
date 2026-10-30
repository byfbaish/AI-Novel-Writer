/**
 * 性格引用的体检 —— 让"性格驱动选择"这件事**可查**，而不只是"被描述"。
 *
 * ## 为什么需要这个
 *
 * 章节大纲的「选择：」行原本写「因为 <他的哪一条>」。这句话永远能过关：
 * 模型随手写一句"因为他谨慎"就是一个理由，机器也没法反驳。
 * 改成「因为 X2」之后就有了可寻址的锚：**写编号/名字可以被查，写形容词不能。**
 *
 * ## 2026-10-29 深夜：对象从「做法编号」改成三格
 *
 * 角色卡从四层改成三格之后，「第三层做法 D<n>」不存在了，取而代之：
 * - `X<n>` = 角色卡【禁区】段里的第 n 条（**全书恒定，可跨章引用**）
 * - `筹码：<名字>` = 【筹码】段里某一样东西（**不编号** —— 它们会增减替换，编号必然失效）
 * - `软肋：<名字>` = 【软肋】段里某一个接口（同样按名字；**允许在登记前先引用**）
 * - `顶撞X<n>` = 这一章他破了第 n 条禁区，且写了代价
 * - `无` = 这一章确实没有他的戏（纯他人视角、时间跳跃）
 *
 * 禁区之所以能编号，是因为它「只增不删、不覆盖」（设计稿 §20.2）；
 * 筹码与软肋之所以按名字，是因为它们每章都可能变 —— 编号一变，跨章引用必然失效。
 *
 * ## 六条判据（只报信号，不判质量）
 *
 * | 码 | 含义 | 治什么 |
 * |---|---|---|
 * | `ARC_CHOICE_NO_BASIS` | 选择行没写任何依据 | 模型绕过性格自由发挥 |
 * | `ARC_CHOICE_UNKNOWN_X` | 引用了卡上不存在的禁区编号 | 引用是编的 |
 * | `ARC_CHOICE_UNKNOWN_CHIP` | 引用了卡上不存在的筹码/软肋名字 | 名字是编的 |
 * | `ARC_CHOICE_SAME_X` | 连续 N 章指向同一条禁区 | 一条线推所有局面 ⇒ 角色扁平 |
 * | `ARC_CHOICE_MISMATCH` | 定性行与选择行的依据对不上 | 一边定类一边落动作，两处没想在一起 |
 * | `ARC_CHOICE_REPEAT_BREAK` | 同一条禁区被破 ≥2 次 | 那条线已经不硬，该删或改成筹码 |
 *
 * 这是**必要条件**，不是充分条件：全都不报不等于写得好，但报出来的一定有问题。
 *
 * ## 口径
 *
 * 只读「定性：」行（英文 `Qualify:`）与「选择：」行（英文 `Choice:`），不猜语义、不做 NLP。
 * 与 `arc-position.ts` 的拍子体检同族：**只读标注，不推断内容**。
 * 没有定性行时不做一致性比较 —— 那是旧格式的大纲，不是错误。
 *
 * `SAME_X` 阈值是 **5** 而不是 3：禁区只有 1–3 条，三章连着写同一条在百章的书里是常态，
 * 阈值 3 一上线就会被作者整片忽略，等于把审计关掉。
 *
 * ## 消费方
 *
 * 生产调用点只有一处：`architecture.command.ts` 的 `summarizeDispositionFindings`，
 * 挂在大纲**落盘之前**，**只报告不阻断**（与 P12-1 结构位对账同族）。
 *
 * - 分批生成时传 `chapterRange`，只报本批新增的问题；`SAME_X` 的计数仍跨全文累积。
 * - 卡由 `protagonistCardFromRoster` 从角色图谱里取**主角那一块**，不再是整份图谱 ——
 *   旧办法把所有角色的编号并成一个白名单，抓不到「引用了别人卡上的 X3」。
 * - 卡是 `legacy`（旧四层）时本函数返回空数组，由调用方报**一条汇总**（见设计稿 §2.4）：
 *   逐条报 `UNKNOWN_X` 会在百章大纲上产出上百条噪声，反而把真信号埋掉。
 */

import { parseOutlineChapterHeading } from './chapter-heading'
import { cardCitationIndex, normalizeEntryName, type PersonalityCard } from './character-card-format'

export type DispositionCitationCode =
  | 'ARC_CHOICE_NO_BASIS'
  | 'ARC_CHOICE_UNKNOWN_X'
  | 'ARC_CHOICE_UNKNOWN_CHIP'
  | 'ARC_CHOICE_SAME_X'
  | 'ARC_CHOICE_MISMATCH'
  | 'ARC_CHOICE_REPEAT_BREAK'

export interface DispositionCitationFinding {
  readonly code: DispositionCitationCode
  /** 出问题的章节标题，如 `第 7 章：……` */
  readonly chapter: string
  readonly zh: string
  readonly en: string
}

export interface DispositionCitationInput {
  /** 情节大纲全文（每章含一行「定性：」与一行「选择：」） */
  readonly synopsis: string
  /** 主角的角色卡（已解析成三格）。`format === 'legacy'` 时本函数返回空数组。 */
  readonly card: PersonalityCard
  /**
   * 只报这个章号区间内的问题。分批生成时用：`synopsis` 可能是累积全文，
   * 但作者只该看到**本批**新增的问题。
   * 连续同一条（`SAME_X`）的计数**不受区间影响** —— 它要跨批累积才有意义。
   */
  readonly chapterRange?: Readonly<{ from: number; to: number }>
  /** 连续多少章指向同一条禁区就报，默认 5。 */
  readonly repeatThreshold?: number
  /** 同一条禁区被破几次就报，默认 2。 */
  readonly breakThreshold?: number
}

/** 章节标题行：`## 第12章：xxx` / `### Chapter 7: xxx`。 */
const CHAPTER_HEADING = /^#{2,4}\s*(第\s*[0-9一二三四五六七八九十百零]+\s*章[^\n]*|[Cc]hapter\s+\d+[^\n]*)$/
/** 选择行：中文「选择：」/ 英文 `Choice:`。 */
const CHOICE_LINE = /^(?:[-*+]\s*)?(?:选择|[Cc]hoice)\s*[:：]\s*(.*)$/
/** 定性行：中文「定性：」/ 英文 `Qualify:`。 */
const QUALIFY_LINE = /^(?:[-*+]\s*)?(?:定性|[Qq]ualify)\s*[:：]\s*(.*)$/
/**
 * 定性写「无」/ `none`。
 * 不用 `\b` 收尾：中文不是 `\w`，「无 — …」里 \b 在"无"与空格之间不成立（两边都非词字符）。
 * 改用"后面不能紧跟拉丁字母"把 none 与 nonexistent 区分开。
 */
const NONE_VALUE = /^\s*(?:无|none)(?![A-Za-z])/i
/**
 * 依据里写「无」：`因为 无：他在山里` / `because none: absent`。
 * 不能复用 `NONE_VALUE` —— 那个只锚行首，而依据在「因为/ because」之后。
 */
const BASIS_NONE = /(?:因为|[Bb]ecause)[\t ]*[:：]?[\t ]*(?:无|none)(?![A-Za-z])/u
/** 破禁区：`顶撞X2` / `break X2`。**必须先于 X 编号判** —— 否则"顶撞X2"会被当成普通引用。 */
const BREAK_CITATION = /(?:顶撞|[Bb]reak)\s*X\s*(\d{1,2})(?!\d)/u
/** 禁区编号：`X2` / `X 2`。前面不能紧贴字母，避免把 "MAX2" 之类当编号。 */
const X_CITATION = /(?<![A-Za-z])X[\t ]*(\d{1,2})(?!\d)/u
/**
 * 筹码/软肋的名字。
 *
 * 名字**可以含空格**（英文 `chip: his mother`），所以不能用 `\s` 收尾；
 * 按分隔符收：破折号、竖线、中英文逗号分号。取到之后 trim。
 */
const NAMED_CITATION = /(筹码|软肋|[Cc]hip|[Ss]oft[\t ]*spot)\s*[:：]\s*([^—｜|，。；;,]+)/u

/**
 * 从章标题取全书章号。**复用 `chapter-heading.ts` 的那一份解析** ——
 * 项目红线：章标题只有一份解析，自己写一份第二套必然与它漂移。
 */
function chapterNumberOf(heading: string): number | null {
  const parsed = parseOutlineChapterHeading(heading)
  return parsed ? parsed.chapter : null
}

interface ChapterBlock {
  heading: string
  body: string
}

function splitChapters(synopsis: string): ChapterBlock[] {
  const blocks: ChapterBlock[] = []
  let current: ChapterBlock | undefined
  for (const line of synopsis.split(/\r?\n/u)) {
    const heading = line.trim()
    if (CHAPTER_HEADING.test(heading)) {
      if (current) blocks.push(current)
      current = { heading: heading.replace(/^#+\s*/u, '').trim(), body: '' }
      continue
    }
    if (current) current.body += `${line}\n`
  }
  if (current) blocks.push(current)
  return blocks
}

/** 一条依据的形态。三种合法形态 + `none`（显式声明他不在场）+ 全空（没写）。 */
interface Basis {
  /** `X<n>`：这一章对应第 n 条禁区 */
  x?: string
  /** `顶撞X<n>`：这一章破了第 n 条禁区 */
  brokenX?: string
  /** `筹码：名字` 或 `软肋：名字` */
  name?: string
  /** 名字属于哪一类。**软肋不校验存在性** —— 它允许在章末登记前先被引用。 */
  nameKind?: 'chip' | 'soft'
  /** 显式写「无」 */
  none?: boolean
}

/** 取某类声明行的冒号后内容（每章只取第一次出现）。 */
function declaredLine(body: string, pattern: RegExp): string | undefined {
  for (const line of body.split(/\r?\n/u)) {
    const match = pattern.exec(line.trim())
    if (match) return match[1] ?? ''
  }
  return undefined
}

/**
 * 取选择行的依据。**优先级不能换**：`顶撞X2` 里含 `X2`，
 * 先判破再判普通引用，才能区分「守住」与「越过」。
 */
function basisOf(body: string): Basis {
  const rest = declaredLine(body, CHOICE_LINE)
  if (rest === undefined) return {}
  if (NONE_VALUE.test(rest) || BASIS_NONE.test(rest)) return { none: true }
  const broken = BREAK_CITATION.exec(rest)
  if (broken) return { brokenX: `X${Number(broken[1])}` }
  const citation = X_CITATION.exec(rest)
  if (citation) return { x: `X${Number(citation[1])}` }
  const named = NAMED_CITATION.exec(rest)
  if (named) return namedBasis(named)
  return {}
}

function namedBasis(match: RegExpExecArray): Basis {
  const name = normalizeEntryName(match[2] ?? '')
  if (!name) return {}
  return { name, nameKind: /筹码|[Cc]hip/u.test(match[1]) ? 'chip' : 'soft' }
}

/** 定性行申报的对象。`undefined` = 没有定性行（旧格式大纲，不参与一致性比较）。 */
interface Qualification {
  x?: string
  name?: string
  none?: boolean
}

function qualifyOf(body: string): Qualification | undefined {
  const rest = declaredLine(body, QUALIFY_LINE)
  if (rest === undefined) return undefined
  if (NONE_VALUE.test(rest)) return { none: true }
  const citation = X_CITATION.exec(rest)
  if (citation) return { x: `X${Number(citation[1])}` }
  const named = NAMED_CITATION.exec(rest)
  if (named) {
    const basis = namedBasis(named)
    if (basis.name) return { name: basis.name }
  }
  return {}
}

function isEmptyBasis(basis: Basis): boolean {
  return !basis.x && !basis.brokenX && !basis.name && !basis.none
}

function describeQualification(qualify: Qualification, language: 'zh' | 'en' = 'zh'): string {
  if (qualify.none) return language === 'zh' ? '「无」' : '"none"'
  return qualify.x ?? (qualify.name ? (language === 'zh' ? `「${qualify.name}」` : `"${qualify.name}"`) : '—')
}

function describeBasis(basis: Basis, language: 'zh' | 'en' = 'zh'): string {
  if (basis.none) return language === 'zh' ? '「无」' : '"none"'
  if (basis.brokenX) return language === 'zh' ? `顶撞${basis.brokenX}` : `break ${basis.brokenX}`
  return basis.x ?? (basis.name ? (language === 'zh' ? `「${basis.name}」` : `"${basis.name}"`) : '—')
}

/**
 * 定性与依据是否相容。
 *
 * - 定性 `X{n}` ⇒ 依据必须是同一个 `X{n}`（守着）或 `顶撞X{n}`（破了）—— 都算同一条线；
 * - 定性 筹码/软肋 名字 ⇒ 依据可以是同名，也可以是任意一条禁区
 *   （他是被那样东西逼着动，但动的时候仍守着某条线）；
 * - 定性 `无` ⇒ 依据只能是 `无`。
 */
function agreeOf(qualify: Qualification, basis: Basis): boolean {
  if (qualify.none) return basis.none === true
  if (qualify.x) return (basis.brokenX ?? basis.x) === qualify.x
  if (qualify.name) {
    const sameName = basis.name !== undefined
      && normalizeEntryName(basis.name) === normalizeEntryName(qualify.name)
    return sameName || basis.x !== undefined || basis.brokenX !== undefined
  }
  return false
}

/**
 * 扫描整份大纲，返回引用问题清单。
 *
 * 没有章节标题时退化成"整份当一个块"，仍能查出"完全没有依据"这类问题。
 */
export function auditDispositionCitations(input: DispositionCitationInput): DispositionCitationFinding[] {
  const { synopsis, card, chapterRange, repeatThreshold = 5, breakThreshold = 2 } = input
  // 旧卡（四层）没有 X 编号可校验：逐条报 UNKNOWN_X 会在百章大纲上产出上百条噪声，
  // 由调用方统一报一条「请重跑角色详情」的汇总。
  if (card.format !== 'v3') return []

  const index = cardCitationIndex(card)
  const knownX = new Set(index.forbiddenIds)
  // 只收筹码名。软肋**故意不参与存在性校验** —— 它允许在章末登记之前先被章纲引用
  // （否则「第一次破戒」这一章永远写不出来：那时软肋还不存在）。
  const knownChipNames = new Set(index.chipNames.map(normalizeEntryName))

  const blocks = splitChapters(synopsis)
  if (blocks.length === 0 && synopsis.trim()) blocks.push({ heading: '（整份大纲）', body: synopsis })

  const findings: DispositionCitationFinding[] = []
  /** 每条禁区被破的次数 —— `REPEAT_BREAK` 用。 */
  const breakCounts = new Map<string, number>()
  let previousCitation: string | undefined
  let runLength = 0

  for (const block of blocks) {
    const basis = basisOf(block.body)
    const chapterNo = chapterNumberOf(block.heading)
    const inRange = !chapterRange || chapterNo === null
      || (chapterNo >= chapterRange.from && chapterNo <= chapterRange.to)
    const report = (finding: DispositionCitationFinding): void => {
      if (inRange) findings.push(finding)
    }

    if (isEmptyBasis(basis)) {
      report({
        code: 'ARC_CHOICE_NO_BASIS',
        chapter: block.heading,
        zh: `${block.heading}：选择行没有写依据。对上他的禁区就写 \`因为 X<n>\`；破了他的禁区写 \`因为 顶撞X<n>：<代价>\`；被某样筹码或软肋拿住写 \`因为 筹码：<名字>\` / \`软肋：<名字>\`；这一章确实没有他的戏才写 \`无\`。`,
        en: `${block.heading}: the choice line carries no basis. Write \`because X<n>\` when it lines up with one of his forbidden lines; \`because break X<n>: <cost>\` when he breaks one; \`because chip: <name>\` / \`soft spot: <name>\` when one of those is held; write \`none\` only when the chapter truly has no scene of his.`,
      })
    } else if (basis.x && !knownX.has(basis.x)) {
      report({
        code: 'ARC_CHOICE_UNKNOWN_X',
        chapter: block.heading,
        zh: `${block.heading}：引用了 ${basis.x}，但主角卡【禁区】段只有 ${index.forbiddenIds.join(' / ') || '（空）'} —— 这个编号是编的。`,
        en: `${block.heading}: cites ${basis.x}, but the protagonist's [Forbidden] block carries only ${index.forbiddenIds.join(' / ') || '(none)'} — the number is invented.`,
      })
    }
    if (basis.brokenX) {
      if (!knownX.has(basis.brokenX)) {
        report({
          code: 'ARC_CHOICE_UNKNOWN_X',
          chapter: block.heading,
          zh: `${block.heading}：写的是顶撞 ${basis.brokenX}，但主角卡【禁区】段只有 ${index.forbiddenIds.join(' / ') || '（空）'} —— 破的那条线不存在。`,
          en: `${block.heading}: breaks ${basis.brokenX}, but the protagonist's [Forbidden] block carries only ${index.forbiddenIds.join(' / ') || '(none)'} — the line being broken does not exist.`,
        })
      } else {
        const count = (breakCounts.get(basis.brokenX) ?? 0) + 1
        breakCounts.set(basis.brokenX, count)
        if (count === breakThreshold) {
          report({
            code: 'ARC_CHOICE_REPEAT_BREAK',
            chapter: block.heading,
            zh: `${block.heading}：${basis.brokenX} 已经被破 ${breakThreshold} 次 —— 一条能被反复越过的线，就不是禁区。把它删掉，或者改成筹码（他失不起的东西）。`,
            en: `${block.heading}: ${basis.brokenX} has now been broken ${breakThreshold} times — a line crossed this often is not a forbidden line. Delete it, or turn it into a chip (something he cannot afford to lose).`,
          })
        }
      }
    }
    if (basis.name && basis.nameKind === 'chip' && !knownChipNames.has(basis.name)) {
      report({
        code: 'ARC_CHOICE_UNKNOWN_CHIP',
        chapter: block.heading,
        zh: `${block.heading}：引用了筹码「${basis.name}」，但主角卡【筹码】段里没有这个名字 —— 它是编的。`,
        en: `${block.heading}: cites chip "${basis.name}", but the protagonist's [Chips] block carries no such name — it is invented.`,
      })
    }

    // 定性与依据必须对得上。四种定性各有允许的依据集合，见设计稿 §19.5。
    const qualify = qualifyOf(block.body)
    if (qualify && !isEmptyBasis(basis) && !agreeOf(qualify, basis)) {
      report({
        code: 'ARC_CHOICE_MISMATCH',
        chapter: block.heading,
        zh: `${block.heading}：定性写 ${describeQualification(qualify)}，选择行的依据却是 ${describeBasis(basis)} —— 两处对不上。定性写 X 就必须与它同一条；定性写筹码/软肋时，依据可以是同名的筹码/软肋，或任意一条禁区；定性写「无」时依据只能是「无」。`,
        en: `${block.heading}: the qualify line says ${describeQualification(qualify, 'en')} but the choice line falls back on ${describeBasis(basis, 'en')} — they do not agree. With an X the two must match; with a chip or soft spot the basis may be that same name or any forbidden line; with "none" the basis may only be "none".`,
      })
    }

    // 连续指向同一条禁区：只有 X 参与 —— 筹码/软肋本来就会连着出现（同一件事在推进），
    // 「无」也不参与（他不在场，不是一条线推所有局面）。
    const comparable = qualify?.x ?? basis.x
    if (comparable && comparable === previousCitation) {
      runLength += 1
      if (runLength === repeatThreshold) {
        report({
          code: 'ARC_CHOICE_SAME_X',
          chapter: block.heading,
          zh: `${block.heading}：连续 ${repeatThreshold} 章指向同一条禁区 ${comparable} —— 要么这几章的局面本来同类（该压成一场戏），要么换一条真正对应的。`,
          en: `${block.heading}: ${repeatThreshold} chapters in a row point at ${comparable} — either these scenes are genuinely the same kind (compress them), or cite the line that actually applies.`,
        })
      }
    } else {
      previousCitation = comparable
      runLength = 1
    }
  }

  return findings
}
