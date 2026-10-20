/**
 * 单元模式下的**章标题格式段**（2026-10-20，`chapter-position-format-design.md` P2）。
 *
 * ## 为什么要把归属写进标题
 *
 * 大纲正文里原本没有任何字段表达「这一章属于哪一卷哪个单元」。`outline-tree` 只能靠
 * 「覆盖：」声明（真实项目 10 章里 8 章写「覆盖：无」）或按计划等分折算反推；后者
 * **一旦某个单元实际写超，后续章号与单元的对齐整体错位，且无从发现**。
 *
 * 让模型把归属写进标题，等于给每章补上那个**真值**，`outline-tree` 因此有了第四种
 * 来源 `heading`（优先级高于声明与折算）。
 *
 * ## 为什么是「追加一节」而不是整段换掉内置 suffix
 *
 * 三层结构的内置 `systemSuffix` 有 70 行（弧光口径的完整合同）。整段复制一份只改
 * ① 那一行，等于把这 70 行维护成两份 —— 内置改一个字，副本就静默过期。
 * 所以这里只产出**新增的一节**，由 `withSystemSuffixOverride(suffix => suffix + 本节)`
 * 拼在 suffix 末尾，并在开场明确写「取代上文任何与之不同的写法」，把两条规则并存
 * 变成一条明确覆盖。
 *
 * ⚠️ 本节**不进模板对象**（走渲染期替换，红线 19）：`synopsisInputsFingerprint` 对模板
 * 整体 `JSON.stringify`，动内置会让所有既有大纲检查点判「源事实已变化」。
 *
 * ## 为什么给两个具体示例
 *
 * 「示例即形态」（判据：模型抄示例形状而非读规则）。只写格式模板，模型会把
 * `第<卷>卷` 当字面量抄下来，或者只写其中一段。给本批前两章的完整标题行，
 * 再给一句「两者同步 +1」，它照着推就行。
 */
import type { WritingLanguage } from '../../shared/writing-language'

export interface SynopsisUnitHeadingPosition {
  /** 本批所在卷号（1 起） */
  volumeIndex: number
  /** 本批所在单元号（1 起） */
  unitIndex: number
  /** 本批第一章的**全书**章号 */
  from: number
}

/** 按本批位置渲染一行带归属的章标题（`章名` 原样占位，仅用于给模型看形状）。 */
export function formatAttributedChapterHeading(
  position: SynopsisUnitHeadingPosition,
  chapterInUnit: number,
  language: WritingLanguage,
  title = '章名',
): string {
  const volume = position.volumeIndex
  const unit = position.unitIndex
  const chapter = position.from + chapterInUnit - 1
  return language === 'en-US'
    ? `## Vol ${volume} Unit ${unit} Ch ${chapterInUnit} (Book Ch ${chapter}): ${title === '章名' ? 'Title' : title}`
    : `## 第${volume}卷第${unit}单元第${chapterInUnit}章（全书第${chapter}章）：${title}`
}

/**
 * 本批的章标题格式段。**只用于三层结构（有单元层）的单元批次** ——
 * 两级结构（`naming === 'volume'`）不进入单元模式（`planUnitStats` 要求 mids 非空），
 * 走的是按章批次，标题格式不在这里管。
 */
export function getSynopsisUnitHeadingSection(
  language: WritingLanguage,
  position: SynopsisUnitHeadingPosition,
): string {
  const volume = position.volumeIndex
  const unit = position.unitIndex
  const first = position.from
  const second = position.from + 1
  const firstHeading = formatAttributedChapterHeading(position, 1, language)
  const secondHeading = formatAttributedChapterHeading(position, 2, language)

  return language === 'en-US'
    ? [
      '[Chapter heading format for this batch — overrides any different wording above, including the example in the per-chapter format section]',
      `Every chapter heading in this batch must carry its position before the colon:`,
      `## Vol ${volume} Unit ${unit} Ch <index within this unit> (Book Ch <book chapter number>): <chapter title>`,
      `- Everything before the colon is position; everything after the colon is the chapter title only. Do not put the position into the title, and do not repeat the chapter number inside the title.`,
      `- The "(Book Ch N)" bracket is mandatory. A heading such as "## Chapter ${first}: <title>" that omits the position is invalid for this batch.`,
      `This batch is fixed at volume ${volume}, unit ${unit}. The first chapter of this unit is book chapter ${first}, so its heading line is:`,
      firstHeading,
      `The second chapter is book chapter ${second}:`,
      secondHeading,
      `From then on the index within the unit and the book chapter number both increase by exactly 1 per chapter, in lockstep; only the chapter title changes.`,
    ].join('\n')
    : [
      '【本批章标题格式（取代上文任何与之不同的写法，包括上文格式段里的章标题示例）】',
      '本批每一章的标题行都必须在冒号前带出位置，写成：',
      `## 第${volume}卷第${unit}单元第<单元内序号>章（全书第<全书章号>章）：<章名>`,
      '- 冒号之前是位置，冒号之后只写章名 —— 位置不得写进章名，章名里也不得重复章号；',
      `- 「（全书第N章）」括号不可省略；写成「## 第${first}章：章名」这种省掉位置的形式，本批一律算格式错误；`,
      `本批固定为第 ${volume} 卷第 ${unit} 单元。本单元第一章是全书第 ${first} 章，它的标题行就是：`,
      firstHeading,
      `第二章是全书第 ${second} 章：`,
      secondHeading,
      '之后每章：单元内序号 +1、全书章号 +1，两者同步递增；章名照常替换即可。',
    ].join('\n')
}
