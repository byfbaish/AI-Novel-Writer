/**
 * 性格引用的体检 —— 让"性格驱动选择"这件事**可查**，而不只是"被描述"。
 *
 * ## 为什么需要这个
 *
 * 章节大纲的「选择：」行原本写「因为 <他的哪一条>」。这句话永远能过关：
 * 模型随手写一句"因为他谨慎"就是一个理由，机器也没法反驳。
 * 改成「因为 D2」之后就有了可寻址的锚：**写编号可以被查，写形容词不能。**
 *
 * **编号只是条目号，不是档位**（2026-10-29 起：角色卡改为四层，旧的三档
 * 〔日常〕/〔代价〕/〔破例〕已取消，编号指向第三层「他对各类事的做法」里的一条）：
 * - `D1`…`D4` = 第三层里的第几条做法（条目号，不代表轻重）
 * - `底线<n>`（英文 `bottom <n>`）= **兜底路径**：第三层一条做法都对不上，但这一章确实
 *   碰到了第一层的第 n 条底线（B1 最重）。**没有现成做法不等于没有性格** —— 做法是他平日
 *   的习惯，底线是他这个人，所以这里要兜底，而不是宣布"没有他的戏"。这是 try / catch 里的 catch。
 * - `D0` = **显式声明**"这一章确实没有他的性格戏"（纯他人视角、时间跳跃、他全程不在场）。
 *   ⚠️ 它不能拿来替代兜底：做法对不上要先退到 `底线<n>`，只有他真不在场才写 `D0`。
 *
 * ## 五条判据（只报信号，不判质量）
 *
 * | 码 | 含义 | 治什么 |
 * |---|---|---|
 * | `ARC_CHOICE_NO_D` | 选择行没写任何依据（`D<n>` / `底线<n>` / `D0` 都没有） | 模型绕过性格自由发挥 |
 * | `ARC_CHOICE_UNKNOWN_D` | 引用了角色卡上不存在的编号 | 引用是编的 |
 * | `ARC_CHOICE_UNKNOWN_BOTTOM` | 引用了不存在的底线位次（仅当传入 `bottomLineCount` 时校验） | 兜底也是编的 |
 * | `ARC_CHOICE_SAME_D` | 连续 N 章引用同一条做法 | 一条倾向推所有局面 ⇒ 角色扁平 |
 * | `ARC_CHOICE_MISMATCH` | 定性行与选择行的依据对不上 | 一边定类一边落动作，两处没想在一起 |
 *
 * MISMATCH 的两条规则（兜底让"对不上"有了合法形态）：
 * - 定性 `D<n>` ⇒ 依据必须是同一个 `D<n>`；
 * - 定性「无」⇒ 依据可以是 `底线<n>`（兜底）或 `D0`（他不在场），**不能**是 `D<n>`。
 *
 * 这是**必要条件**，不是充分条件：全都不报不等于写得好，但报出来的一定有问题。
 *
 * ## 口径
 *
 * 只读「定性：」行（英文 `Qualify:`）与「选择：」行（英文 `Choice:`），不猜语义、不做 NLP。
 * 与 `arc-position.ts` 的拍子体检同族：**只读标注，不推断内容**。
 * 没有定性行时不做一致性比较 —— 那是旧格式的大纲，不是错误。
 */

export type DispositionCitationCode =
  | 'ARC_CHOICE_NO_D'
  | 'ARC_CHOICE_UNKNOWN_D'
  | 'ARC_CHOICE_UNKNOWN_BOTTOM'
  | 'ARC_CHOICE_SAME_D'
  | 'ARC_CHOICE_MISMATCH'

export interface DispositionCitationFinding {
  readonly code: DispositionCitationCode
  /** 出问题的章节标题，如 `第 7 章：……` */
  readonly chapter: string
  readonly zh: string
  readonly en: string
}

export interface DispositionCitationInput {
  /** 情节大纲全文（每章含一行「选择：」） */
  readonly synopsis: string
  /** 角色卡上实际存在的编号，如 ['D1','D2','D3'] */
  readonly dispositionIds: readonly string[]
  /**
   * 角色卡第一层有几条底线（B1…Bn）。给了才校验 `底线<n>` 的序号是否存在；
   * 不给只校验格式 —— 底线条数在章纲里读不到，硬要求会误报。
   */
  readonly bottomLineCount?: number
  /** 连续多少章引用同一条就报，默认 3 */
  readonly repeatThreshold?: number
}

/** 章节标题行：`## 第12章：xxx` / `### Chapter 7: xxx`。 */
const CHAPTER_HEADING = /^#{2,4}\s*(第\s*[0-9一二三四五六七八九十百零]+\s*章[^\n]*|[Cc]hapter\s+\d+[^\n]*)$/
/** 选择行：中文「选择：」/ 英文 `Choice:`。 */
const CHOICE_LINE = /^(?:[-*+]\s*)?(?:选择|[Cc]hoice)\s*[:：]\s*(.*)$/
/** 行内编号：`D2` / `D 2`，大小写不敏感。 */
const CITATION = /\bD\s*(\d{1,2})\b/i
/** 定性行：中文「定性：」/ 英文 `Qualify:`。 */
const QUALIFY_LINE = /^(?:[-*+]\s*)?(?:定性|[Qq]ualify)\s*[:：]\s*(.*)$/
/**
 * 定性行写「无」/ `none` —— 显式声明这一章不沾任何一条。
 * 不用 `\b` 收尾：中文不是 `\w`，「无 — …」里 \b 在"无"与空格之间不成立（两边都非词字符）。
 * 改用"后面不能紧跟拉丁字母"来把 none 与 nonexistent 区分开。
 */
const QUALIFY_NONE = /^\s*(?:无|none)(?![A-Za-z])/i
/**
 * 底线兜底：中文 `底线2` / 英文 `bottom 2`、`bottom line 2`。
 * 这是 try / catch 里的 catch —— 第三层做法对不上时退到第一层底线，不是"没有性格"。
 */
const BOTTOM_CITATION = /(?:底线|bottom\s*(?:line\s*)?)\s*(\d{1,2})/i

interface ChapterBlock {
  heading: string
  body: string
}

function splitChapters(synopsis: string): ChapterBlock[] {
  const blocks: ChapterBlock[] = []
  const lines = synopsis.split(/\r?\n/u)
  let current: ChapterBlock | undefined
  for (const line of lines) {
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

/** 从选择行的内容里取 D 编号；`D0` = 显式声明本章没有他的戏，合法，返回大写形态以便比较。 */
function citationOfLine(rest: string): string | undefined {
  const found = CITATION.exec(rest)
  return found ? `D${Number(found[1])}` : undefined
}

/** 选择行的依据 —— 三种合法形态里只会命中一种。 */
interface ChoiceBasis {
  /** `D<n>`（含 `D0`）；没写 D 编号时 undefined */
  readonly disposition?: string
  /** 底线位次 n（兜底路径）；没写底线时 undefined */
  readonly bottomLine?: number
}

/**
 * 取这一章选择行的依据。
 *
 * `D<n>` 与 `底线<n>` 同时出现时**以 D 优先**：兜底是"没有现成做法"时才走的路，
 * 写了编号就说明有做法可套，那一行里的"底线"只是叙述，不算兜底。
 */
function basisOf(body: string): ChoiceBasis {
  for (const line of body.split(/\r?\n/u)) {
    const match = CHOICE_LINE.exec(line.trim())
    if (!match) continue
    const rest = match[1] ?? ''
    const disposition = citationOfLine(rest)
    if (disposition) return { disposition }
    const bottom = BOTTOM_CITATION.exec(rest)
    return bottom ? { bottomLine: Number(bottom[1]) } : {}
  }
  return {}
}

/**
 * 取定性行申报的编号。定性行只回答「这是哪一类事」，**不许写他做了什么**。
 * 写「无」/ `none` 视为 D0（显式声明不沾任何一条）。
 * 没有定性行、或定性行里解析不出编号时返回 undefined（不参与一致性比较）。
 */
function qualifyOf(body: string): string | undefined {
  for (const line of body.split(/\r?\n/u)) {
    const match = QUALIFY_LINE.exec(line.trim())
    if (!match) continue
    const rest = match[1] ?? ''
    if (QUALIFY_NONE.test(rest)) return 'D0'
    const found = CITATION.exec(rest)
    return found ? `D${Number(found[1])}` : undefined
  }
  return undefined
}

/**
 * 扫描整份大纲，返回引用问题清单。
 *
 * 没有章节标题时退化成"整份当一个块"，仍能查出"完全没有编号"这类问题。
 */
export function auditDispositionCitations(input: DispositionCitationInput): DispositionCitationFinding[] {
  const { synopsis, dispositionIds, bottomLineCount, repeatThreshold = 3 } = input
  const known = new Set(dispositionIds.map(id => id.toUpperCase()))
  const blocks = splitChapters(synopsis)
  if (blocks.length === 0 && synopsis.trim()) blocks.push({ heading: '（整份大纲）', body: synopsis })

  const findings: DispositionCitationFinding[] = []
  let previousCitation: string | undefined
  let runLength = 0

  for (const block of blocks) {
    const { disposition, bottomLine } = basisOf(block.body)
    const hasBasis = disposition !== undefined || bottomLine !== undefined

    if (!hasBasis) {
      findings.push({
        code: 'ARC_CHOICE_NO_D',
        chapter: block.heading,
        zh: `${block.heading}：选择行没有写依据。做法对得上就写 \`因为 D<n>\`；一条都对不上但碰到了底线时写 \`因为 底线<n>\`（兜底）；这一章确实没有他的戏才写 \`D0\` 并说明理由。`,
        en: `${block.heading}: the choice line carries no basis. Write \`because D<n>\` when a practice applies; when none applies but a bottom line does, write \`because bottom <n>\` (fallback); write \`D0\` with a reason only when the chapter truly has no scene of his.`,
      })
    } else if (disposition && disposition !== 'D0' && !known.has(disposition)) {
      findings.push({
        code: 'ARC_CHOICE_UNKNOWN_D',
        chapter: block.heading,
        zh: `${block.heading}：引用了 ${disposition}，但角色卡上只有 ${[...known].join(' / ')} —— 这个编号是编的。`,
        en: `${block.heading}: cites ${disposition}, but the character card only carries ${[...known].join(' / ')} — the number is invented.`,
      })
    }
    if (bottomLine !== undefined && bottomLineCount !== undefined && bottomLine > bottomLineCount) {
      findings.push({
        code: 'ARC_CHOICE_UNKNOWN_BOTTOM',
        chapter: block.heading,
        zh: `${block.heading}：写的是底线${bottomLine}，但角色卡第一层只有 ${bottomLineCount} 条底线 —— 兜底的对象是编的。`,
        en: `${block.heading}: writes bottom ${bottomLine}, but layer 1 of the card carries only ${bottomLineCount} bottom lines — the fallback target is invented.`,
      })
    }

    // 定性行与选择行的依据必须对得上。兜底让"对不上"有了合法形态：
    // 定性写「无」时，依据可以是 底线<n>（兜底）或 D0（他不在场），但不能是 D<n>。
    const qualify = qualifyOf(block.body)
    if (qualify && hasBasis) {
      const agree = qualify === 'D0'
        ? disposition === 'D0' || bottomLine !== undefined
        : disposition === qualify
      if (!agree) {
        const basisZh = disposition ?? `底线${bottomLine}`
        const basisEn = disposition ?? `bottom ${bottomLine}`
        const qualifyZh = qualify === 'D0' ? '无' : qualify
        const qualifyEn = qualify === 'D0' ? 'none' : qualify
        findings.push({
          code: 'ARC_CHOICE_MISMATCH',
          chapter: block.heading,
          zh: `${block.heading}：定性行写 ${qualifyZh}，选择行的依据却是 ${basisZh} —— 两处对不上。定性写「无」时依据只能是 \`底线<n>\`（兜底）或 \`D0\`（他不在场）；定性写了 \`D<n>\` 就必须与它同一条。`,
          en: `${block.heading}: the qualify line says ${qualifyEn} but the choice line falls back on ${basisEn} — they do not agree. With "none" the basis may only be \`bottom <n>\` (fallback) or \`D0\` (he is absent); with a \`D<n>\` the two must match.`,
        })
      }
    }

    // 连续同一条：D0（他不在场）与底线兜底都不参与 ——
    // 前者是"没戏"，后者是"做法覆盖不足"，都不等于"一条倾向推所有局面"。
    const comparable = disposition && disposition !== 'D0' ? disposition : undefined
    if (comparable && comparable === previousCitation) {
      runLength += 1
      if (runLength === repeatThreshold) {
        findings.push({
          code: 'ARC_CHOICE_SAME_D',
          chapter: block.heading,
          zh: `${block.heading}：连续 ${repeatThreshold} 章引用 ${comparable} —— 一条倾向推所有局面，角色会扁平。要么这几章的局面本来同类（该压成一场戏），要么换成那条真正对应的倾向。`,
          en: `${block.heading}: ${repeatThreshold} chapters in a row cite ${comparable} — one tendency is driving every scene, which flattens the character. Either these scenes are genuinely the same kind (compress them), or cite the entry that actually applies.`,
        })
      }
    } else {
      previousCitation = comparable
      runLength = 1
    }
  }

  return findings
}
