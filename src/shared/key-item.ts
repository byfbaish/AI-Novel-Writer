/**
 * 关键物品（P1-1 连续性宿体第一格，2026-10-23）。
 *
 * ## 它回答什么问题
 *
 * 「刀在谁手里」—— possessions continuity。正文里最常见的崩法是：第 5 章把已经交出去的
 * 东西又拿出来用、把已经烧掉的信又读一遍。此前这件事只活在 `characters.cs_key_items`
 * 的自由文本里（而且只有主角那一行常被抽取到），**没有任何东西会报警**。
 *
 * ## 它不是资源
 *
 * 划界只有一条：**有没有数量增减**。资源（`resources`）按单位反复加减；
 * 物品有归属、有状态，但不做算术。所以这里只有「谁拿着 / 什么状态 / 出处」，
 * 没有余额、没有变动表 —— 也因此不违反 ADR-0022（下线的是余额，不是事实）。
 *
 * ## 出处为什么可以是空的
 *
 * 作者登记时常常只记得「刀在他手里」，不记得哪一章写的。空章号/空引文在注入时
 * 会渲染成「作者登记」，**绝不伪造章号**（判据 DN 同型：缺失就说缺失）。
 */
import type { WritingLanguage } from './writing-language'

export type KeyItemSource = 'author' | 'derived'

/** 一件关键物品的完整记录。 */
export interface KeyItemDefinition {
  itemId: string
  name: string
  /**
   * 持有者角色名（与 `characters.name` 同源）；空串 = 非角色持有
   * （地点 / 组织 / 无主），此时靠 `holderLabel` 展示。
   *
   * 刻意不用角色 ID：`characters` 的主键就是名字，而物品归属是「截至某章的快照」，
   * 角色改名或删卡时不该由数据库去改写一件历史物品的归属。
   */
  holderCharacter: string
  /** 展示用持有者：角色名 / 「药铺柜台」/ 「无主」。 */
  holderLabel: string
  /**
   * 状态短语（作者原话）：`已签`、`剩两副`、`被扣在执法殿`、`烧了一半`。
   *
   * **刻意不做枚举**：本书真实物品混着「有无 / 归属 / 剩余份数 / 签署状态」四种形态，
   * 定枚举等于替作者写设定，而四种形态的校验规则彼此不同，这一版根本不做校验。
   */
  statusNote: string
  /** 出处章号；`null` = 作者没标。 */
  chapterNumber: number | null
  /** 出处逐字引文；空串 = 没有引文。 */
  evidence: string
  source: KeyItemSource
  createdAt: string
  updatedAt: string
}

/** 写入入参：`itemId` 缺省表示新建。 */
export interface KeyItemInput {
  itemId?: string
  name: string
  holderCharacter?: string
  holderLabel: string
  statusNote?: string
  chapterNumber?: number | null
  evidence?: string
}

export interface KeyItemWriteResult {
  success: boolean
  itemId?: string
  error?: string
}

export interface KeyItemDeleteResult {
  success: boolean
  error?: string
}

/** 名称 / 状态 / 引文的长度上限（与资源登记的 200 同口径）。 */
export const KEY_ITEM_TEXT_MAX = 200
/** 持有者展示名的长度上限（一个地点名不该比这更长）。 */
export const KEY_ITEM_LABEL_MAX = 40

/**
 * 一条物品在提示词里的**唯一**渲染入口（正文链与将来的审稿链共用，判据 DM 同型）。
 *
 * 出处三段式，缺失就说缺失：
 * - 有章号 + 有引文 ⇒ `第3章：『他按下手印』`
 * - 只有章号       ⇒ `第3章`
 * - 都没有         ⇒ `作者登记`
 */
export function renderKeyItemLine(item: KeyItemDefinition, writingLanguage: WritingLanguage): string {
  const isEn = writingLanguage === 'en-US'
  const holder = item.holderLabel.trim() || (isEn ? 'unassigned' : '未登记持有者')
  const status = item.statusNote.trim()
  const quote = item.evidence.trim()
  const chapter = item.chapterNumber
  const source = chapter !== null && chapter > 0
    ? (quote ? (isEn ? `Chapter ${chapter}: "${quote}"` : `第${chapter}章：『${quote}』`) : (isEn ? `Chapter ${chapter}` : `第${chapter}章`))
    : (isEn ? 'author entry' : '作者登记')
  const head = isEn ? `- ${item.name} — held by ${holder}` : `- ${item.name} — ${holder}持有`
  return `${head}${status ? (isEn ? ` (${status})` : `（${status}）`) : ''}${isEn ? `; source: ${source}` : `；出处：${source}`}`
}
