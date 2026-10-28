/**
 * 性格引用的体检 —— 让"性格驱动选择"这件事**可查**，而不只是"被描述"。
 *
 * ## 为什么需要这个
 *
 * 章节大纲的「选择：」行原本写「因为 <他的哪一条>」。这句话永远能过关：
 * 模型随手写一句"因为他谨慎"就是一个理由，机器也没法反驳。
 * 改成「因为 D2」之后就有了可寻址的锚：**写编号可以被查，写形容词不能。**
 *
 * 编号即档位（见 `golden-traits.ts` / `docs/design/prompt/protagonist-golden-traits.md`）：
 * - `D1` 日常档、`D2` 代价档、`D3` 破例档
 * - `D0` 是**显式声明**"这一章没有他的性格戏"，合法，不算缺引用
 *
 * ## 三条判据（只报信号，不判质量）
 *
 * | 码 | 含义 | 治什么 |
 * |---|---|---|
 * | `ARC_CHOICE_NO_D` | 这一章的选择行没有出现任何 `D<n>` | 模型绕过性格自由发挥 |
 * | `ARC_CHOICE_UNKNOWN_D` | 引用了角色卡上不存在的编号 | 引用是编的 |
 * | `ARC_CHOICE_SAME_D` | 连续 N 章引用同一条 | 一条倾向推所有局面 ⇒ 角色扁平 |
 *
 * 这是**必要条件**，不是充分条件：全都不报不等于写得好，但报出来的一定有问题。
 *
 * ## 口径
 *
 * 只读「选择：」行（英文 `Choice:`），不猜语义、不做 NLP。
 * 与 `arc-position.ts` 的拍子体检同族：**只读标注，不推断内容**。
 */

export type DispositionCitationCode =
  | 'ARC_CHOICE_NO_D'
  | 'ARC_CHOICE_UNKNOWN_D'
  | 'ARC_CHOICE_SAME_D'

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
  /** 连续多少章引用同一条就报，默认 3 */
  readonly repeatThreshold?: number
}

/** 章节标题行：`## 第12章：xxx` / `### Chapter 7: xxx`。 */
const CHAPTER_HEADING = /^#{2,4}\s*(第\s*[0-9一二三四五六七八九十百零]+\s*章[^\n]*|[Cc]hapter\s+\d+[^\n]*)$/
/** 选择行：中文「选择：」/ 英文 `Choice:`。 */
const CHOICE_LINE = /^(?:[-*+]\s*)?(?:选择|[Cc]hoice)\s*[:：]\s*(.*)$/
/** 行内编号：`D2` / `D 2`，大小写不敏感。 */
const CITATION = /\bD\s*(\d{1,2})\b/i

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

function citationOf(body: string): string | undefined {
  for (const line of body.split(/\r?\n/u)) {
    const match = CHOICE_LINE.exec(line.trim())
    if (!match) continue
    const found = CITATION.exec(match[1] ?? '')
    // D0 = 显式声明「本章没有性格戏」，合法；返回大写形态以便比较
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
  const { synopsis, dispositionIds, repeatThreshold = 3 } = input
  const known = new Set(dispositionIds.map(id => id.toUpperCase()))
  const blocks = splitChapters(synopsis)
  if (blocks.length === 0 && synopsis.trim()) blocks.push({ heading: '（整份大纲）', body: synopsis })

  const findings: DispositionCitationFinding[] = []
  let previousCitation: string | undefined
  let runLength = 0

  for (const block of blocks) {
    const citation = citationOf(block.body)
    if (!citation) {
      findings.push({
        code: 'ARC_CHOICE_NO_D',
        chapter: block.heading,
        zh: `${block.heading}：选择行没有写 D 编号 —— 模型绕过了角色卡。补上 \`因为 D<n>\`；这一章确实没有性格戏时写 \`D0\` 并说明理由。`,
        en: `${block.heading}: the choice line carries no D-number — the model routed around the character card. Add \`because D<n>\`; write \`D0\` with a reason when the chapter truly has no disposition scene.`,
      })
    } else if (citation !== 'D0' && !known.has(citation)) {
      findings.push({
        code: 'ARC_CHOICE_UNKNOWN_D',
        chapter: block.heading,
        zh: `${block.heading}：引用了 ${citation}，但角色卡上只有 ${[...known].join(' / ')} —— 这个编号是编的。`,
        en: `${block.heading}: cites ${citation}, but the character card only carries ${[...known].join(' / ')} — the number is invented.`,
      })
    }

    // 连续同一条：D0（无戏）不参与，避免把"连续几章没性格戏"算成扁平
    const comparable = citation && citation !== 'D0' ? citation : undefined
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
