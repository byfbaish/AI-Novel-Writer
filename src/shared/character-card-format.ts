/**
 * 角色卡「三格」的文本格式 —— 解析 / 渲染 / 增量 / 引用索引。
 *
 * ## 为什么是文本标记，不是新列
 *
 * 三格（禁区 / 筹码 / 处境）与软肋都寄生在 `characters.personality` 这一个 TEXT 列里。
 * 这样避开了三个独立的失败面：迁移 lane、便携归档 field-policy 登记、以及
 * entry 整串参与 `fact_hash` 带来的历史哈希变更。代价是必须有一套**稳定且可机读**
 * 的分段约定 —— 就是这个文件。
 *
 * ## 只规定三样，句子内部一个字都不规定
 *
 * 1. 段标记：`【禁区】`/`【筹码】`/`【处境】`/`【软肋】`，独占一行
 * 2. 行首编号：禁区 `X1..X3`，软肋 `S1..S5`
 * 3. 名字分隔：筹码与软肋该行**第一个** `：:—｜|` 之前是名字，之后自由
 *
 * 项目两次实测（见设计稿 §12）：一旦规定「答案长什么样」，模型交出的就是那个样子，
 * 而不是那个人的样子。所以这里的正则只锚定**记录边界**，不锚定句式。
 *
 * ## 判据不在这里
 *
 * 「这条禁区是否可证伪」「筹码能不能被夺走」是**语义**判断，由 prompt 的判法与
 * 人工过目负责。本文件只回答「能不能被解析出来」。
 */

import { CHARACTER_ROLE_LABELS } from './character-role'

export type CardFormat = 'v3' | 'legacy'

export interface ForbiddenLine {
  /** `X1`…`X3`，大写。编号只是条目号，不代表轻重。 */
  id: string
  text: string
}

export interface ChipLine {
  /** 归一化后的名字。**筹码没有编号** —— 它们每章都可能增减替换，编号必然失效。 */
  name: string
  text: string
}

export interface SoftSpotLine {
  /** `S1`…`S5`。软肋在章末回写登记时分配编号，章纲可以提前引用（预告）。 */
  id: string
  name: string
  text: string
}

export type CardIssue =
  | 'too-many-forbidden'
  | 'too-many-chips'
  | 'too-many-soft-spots'
  | 'empty-name'
  | 'duplicate-id'
  /**
   * 筹码被写成了编号（`X1：……`）。模型偶尔会把筹码段当成禁区段续写。
   * 不替它猜语义（那行可能是禁区内容，也可能是筹码），只上报，由作者或重抽处理。
   */
  | 'numbered-chip'

export interface PersonalityCard {
  /**
   * `v3` = 有【禁区】段且至少一条 X。
   * `legacy` = 旧四层卡（或任何没有 X 的卡）—— 审计对它只能报一条汇总，不能逐条校验。
   */
  format: CardFormat
  /**
   * 原文用的是哪套段标记。渲染回文本时沿用它 —— 英文项目的卡不能写着写着变成中文标记。
   * 无段标记时默认 `zh`。
   */
  markerStyle: 'zh' | 'en'
  forbidden: ForbiddenLine[]
  chips: ChipLine[]
  situation: { given: boolean; text: string }
  softSpots: SoftSpotLine[]
  issues: CardIssue[]
}

export const CARD_LIMITS = Object.freeze({
  forbidden: 3,
  chips: 5,
  softSpots: 5,
})

/**
 * 段标记行。中英双认：中文项目写 `【禁区】`，英文项目写 `[Forbidden]`，
 * 同一套解析器必须都吃得下 —— 否则英文项目的卡全部退化成 `legacy`，
 * 而且**不报错**（只是审计静默不校验），是最难发现的那种失效。
 */
const SECTION_LINE = /^[\t ]*(?:【(禁区|筹码|处境|软肋)】|\[(forbidden|chips|situation|soft[\t ]*spots?)\])[\t ]*$/iu
/** 中文标记 → 内部段名。 */
const SECTION_ZH: Record<string, '禁区' | '筹码' | '处境' | '软肋'> = {
  禁区: '禁区', 筹码: '筹码', 处境: '处境', 软肋: '软肋',
}
/** 英文标记（小写比较）→ 内部段名。 */
const SECTION_EN: Record<string, '禁区' | '筹码' | '处境' | '软肋'> = {
  forbidden: '禁区', chips: '筹码', situation: '处境', 'soft spot': '软肋', 'soft spots': '软肋',
}
/** 禁区条目：`X1` 后可跟任意标点/空白，正文从此开始，**不规定句式**。 */
const FORBIDDEN_LINE = /^[\t ]*X[\t ]*(\d{1,2})(?!\d)[\t ]*[：:、.·,，\-—]*[\t ]*/u
/** 软肋条目：同上，`S<n>`。 */
const SOFT_SPOT_LINE = /^[\t ]*S[\t ]*(\d{1,2})(?!\d)[\t ]*[：:、.·,，\-—]*[\t ]*/u
/** 处境段的 `given` 前缀 —— 标记「这是材料给定的，不是我编的」。 */
const GIVEN_PREFIX = /^[\t ]*given\b[\t ]*[：:、.·\-—]*[\t ]*/iu
/** 名字分隔符。取**第一个**命中的位置切，右侧永远自由。 */
const NAME_SEPARATOR = /[：:—｜|]/u
/**
 * 行首的 Markdown 列表符。模型经常用 `- 他的手记本：…` 这种写法 ——
 * 不剥掉的话破折号会被当成名字的一部分，卡上就凭空多出一个叫「- 他的手记本」的筹码。
 * 项目要求「标记归标记、句式不管」，所以这里只剥列表符，不动正文。
 */
const LIST_MARKER = /^[-*+][\t ]+/u

/**
 * 名字归一化 —— 章纲引用与卡上条目**必须用同一个函数比较**。
 *
 * 去掉的只有装饰（引号、尾随标点、多余空白），不做同义词归并：
 * 「母亲」与「娘」是两个名字，是否同指由作者决定，机器不猜。
 */
export function normalizeEntryName(name: string): string {
  let value = name.trim()
  // 成对剥外层引号/括号，最多两层（`「『母亲』」` 这种手写情况也能处理）
  for (let round = 0; round < 2; round += 1) {
    const first = value[0]
    const last = value[value.length - 1]
    if (!first || !last) break
    const paired = (first === '「' && last === '」') || (first === '『' && last === '』')
      || (first === '“' && last === '”') || (first === '"' && last === '"')
      || (first === '《' && last === '》') || (first === '(' && last === ')')
      || (first === '（' && last === '）') || (first === "'" && last === "'")
    if (!paired) break
    value = value.slice(1, -1).trim()
  }
  return value.replace(/[，。、,.;；:：\s]+$/u, '').replace(/\s+/gu, ' ').trim()
}

/** 按第一个分隔符切出「名字 + 自由文本」。没有分隔符时整行即名字。 */
function splitNameText(line: string): { name: string; text: string } | null {
  const match = NAME_SEPARATOR.exec(line)
  if (!match) {
    const name = normalizeEntryName(line)
    return name ? { name, text: '' } : null
  }
  const name = normalizeEntryName(line.slice(0, match.index))
  // 右侧把连续分隔符一起剥掉（`——` 会先命中第一个 `—`，剩下那个要清）
  const text = line.slice(match.index + 1).replace(/^[\s：:—\-｜|]+/u, '').trim()
  return name ? { name, text } : null
}

type SectionName = '禁区' | '筹码' | '处境' | '软肋'

/**
 * 解析一张卡。**永不抛错** —— 无法解析时退化成 `legacy`，让上层走「旧卡」分支。
 */
export function parsePersonalityCard(personality: string | null | undefined): PersonalityCard {
  const card: PersonalityCard = {
    format: 'legacy',
    markerStyle: 'zh',
    forbidden: [],
    chips: [],
    situation: { given: false, text: '' },
    softSpots: [],
    issues: [],
  }
  if (!personality) return card

  const forbiddenIds = new Set<string>()
  const softSpotIds = new Set<string>()
  const situationLines: string[] = []
  let section: SectionName | undefined

  for (const rawLine of personality.split(/\r?\n/u)) {
    // 先剥列表符：模型很爱用 `- `，而它一旦进了名字或正文就会污染引用比对。
    const line = rawLine.trim().replace(LIST_MARKER, '').trim()
    if (!line) continue
    const sectionMatch = SECTION_LINE.exec(line)
    if (sectionMatch) {
      const zh = sectionMatch[1]
      const en = sectionMatch[2]
      section = zh ? SECTION_ZH[zh] : SECTION_EN[(en ?? '').toLowerCase().replace(/\s+/gu, ' ')]
      if (!zh) card.markerStyle = 'en'
      continue
    }
    switch (section) {
      case '禁区': {
        const match = FORBIDDEN_LINE.exec(line)
        if (!match) break
        const id = `X${Number(match[1])}`
        if (forbiddenIds.has(id)) { card.issues.push('duplicate-id'); break }
        forbiddenIds.add(id)
        card.forbidden.push({ id, text: line.slice(match[0].length).trim() })
        break
      }
      case '软肋': {
        const match = SOFT_SPOT_LINE.exec(line)
        if (!match) break
        const id = `S${Number(match[1])}`
        if (softSpotIds.has(id)) { card.issues.push('duplicate-id'); break }
        const rest = splitNameText(line.slice(match[0].length).trim())
        if (!rest) { card.issues.push('empty-name'); break }
        softSpotIds.add(id)
        card.softSpots.push({ id, name: rest.name, text: rest.text })
        break
      }
      case '筹码': {
        const chip = splitNameText(line)
        if (!chip) { card.issues.push('empty-name'); break }
        if (/^[XS]\s*\d+$/iu.test(chip.name)) card.issues.push('numbered-chip')
        card.chips.push(chip)
        break
      }
      case '处境': {
        const given = GIVEN_PREFIX.exec(line)
        if (given) card.situation.given = true
        const text = given ? line.slice(given[0].length).trim() : line
        if (text) situationLines.push(text)
        break
      }
      default:
        // 段外内容一律忽略：作者可能在卡上写总述，解析只取结构。
        break
    }
  }

  card.situation.text = situationLines.join('\n')

  // 上限不靠拒收：超出就截断并记 issue，让上层报「超限」而不是「格式错」。
  if (card.forbidden.length > CARD_LIMITS.forbidden) {
    card.forbidden = card.forbidden.slice(0, CARD_LIMITS.forbidden)
    card.issues.push('too-many-forbidden')
  }
  if (card.chips.length > CARD_LIMITS.chips) {
    card.chips = card.chips.slice(0, CARD_LIMITS.chips)
    card.issues.push('too-many-chips')
  }
  if (card.softSpots.length > CARD_LIMITS.softSpots) {
    card.softSpots = card.softSpots.slice(0, CARD_LIMITS.softSpots)
    card.issues.push('too-many-soft-spots')
  }

  // 唯一的 v3 判据：有禁区段且至少一条 X。零条 X 的卡与旧四层卡同待遇。
  card.format = card.forbidden.length > 0 ? 'v3' : 'legacy'
  return card
}

/**
 * 渲染回文本。**空段不渲染** —— 空标记会让模型误以为该填。
 *
 * 只用于 `v3` 卡；`legacy` 卡调本函数返回空串，调用方必须先判格式（`applyCardDelta` 已代劳）。
 */
export function renderPersonalityCard(card: PersonalityCard): string {
  const zh = card.markerStyle !== 'en'
  const marker = {
    forbidden: zh ? '【禁区】' : '[Forbidden]',
    chips: zh ? '【筹码】' : '[Chips]',
    situation: zh ? '【处境】' : '[Situation]',
    softSpots: zh ? '【软肋】' : '[Soft spots]',
  }
  const blocks: string[] = []
  if (card.forbidden.length > 0) {
    blocks.push([marker.forbidden, ...card.forbidden.map(line => `${line.id} ${line.text}`.trimEnd())].join('\n'))
  }
  if (card.chips.length > 0) {
    blocks.push([marker.chips, ...card.chips.map(line => (line.text ? `${line.name}：${line.text}` : line.name))].join('\n'))
  }
  if (card.situation.text) {
    const prefix = card.situation.given ? 'given ' : ''
    const lines = card.situation.text.split('\n')
    blocks.push([marker.situation, `${prefix}${lines[0]}`, ...lines.slice(1)].join('\n'))
  }
  if (card.softSpots.length > 0) {
    blocks.push([
      marker.softSpots,
      ...card.softSpots.map(line => `${line.id} ${line.name}${line.text ? `：${line.text}` : ''}`),
    ].join('\n'))
  }
  return blocks.join('\n')
}

export interface CardCitationIndex {
  forbiddenIds: string[]
  softSpotIds: string[]
  chipNames: string[]
}

/** 审计用的白名单。软肋为空时返回空数组 —— 上层据此**跳过**软肋校验。 */
export function cardCitationIndex(card: PersonalityCard): CardCitationIndex {
  return {
    forbiddenIds: card.forbidden.map(line => line.id),
    softSpotIds: card.softSpots.map(line => line.id),
    chipNames: card.chips.map(line => line.name),
  }
}

/* ------------------------------------------------------------------ */
/* 章末增量                                                            */
/* ------------------------------------------------------------------ */

export interface CardDeltaInput {
  kind: 'soft-spot' | 'chip'
  name?: string
  text?: string
  /** chip 专用。`add` 默认；`replace` 需要 `replaces`；`lose` 表示失去某样东西。 */
  change?: 'add' | 'replace' | 'lose'
  replaces?: string
}

export type CardDeltaDrop = 'soft-spot-cap' | 'chip-cap' | 'chip-not-found' | 'empty-name'

export interface CardDeltaResult {
  /** 应用后的卡面文本。被拒绝时返回**原文本**，一字不动。 */
  personality: string
  dropped?: CardDeltaDrop
}

/**
 * 把一条增量应用到卡上，返回新文本。
 *
 * 行为约定：
 * - `legacy` 卡**拒绝**（抛 `CARD_FORMAT_LEGACY`）：不往作者原文里插半套新结构。
 * - 超出上限时不覆盖原文，返回原文本 + `dropped`，由上层显式上报 —— 静默截断会让
 *   「登记了一条」与「卡上有一条」变成两份真相。
 */
export function applyCardDelta(current: string, delta: CardDeltaInput): CardDeltaResult {
  const card = parsePersonalityCard(current)
  if (card.format !== 'v3') throw new Error('CARD_FORMAT_LEGACY')

  const name = normalizeEntryName(delta.name ?? '')
  const text = (delta.text ?? '').trim()

  if (delta.kind === 'soft-spot') {
    if (!name) return { personality: current, dropped: 'empty-name' }
    if (card.softSpots.some(line => normalizeEntryName(line.name) === name)) {
      // 同一接口重复登记 = 同一件事又被按了一次，不新增编号（收敛规则）。
      return { personality: current }
    }
    if (card.softSpots.length >= CARD_LIMITS.softSpots) return { personality: current, dropped: 'soft-spot-cap' }
    const nextId = `S${card.softSpots.length + 1}`
    card.softSpots.push({ id: nextId, name, text })
    return { personality: renderPersonalityCard(card) }
  }

  const change = delta.change ?? 'add'
  if (change === 'lose') {
    const index = card.chips.findIndex(line => normalizeEntryName(line.name) === name)
    if (index < 0) return { personality: current, dropped: 'chip-not-found' }
    card.chips.splice(index, 1)
    return { personality: renderPersonalityCard(card) }
  }
  if (change === 'replace') {
    const target = normalizeEntryName(delta.replaces ?? '')
    const index = card.chips.findIndex(line => normalizeEntryName(line.name) === target)
    if (!target || index < 0) return { personality: current, dropped: 'chip-not-found' }
    if (!name) return { personality: current, dropped: 'empty-name' }
    card.chips[index] = { name, text }
    return { personality: renderPersonalityCard(card) }
  }
  if (!name) return { personality: current, dropped: 'empty-name' }
  if (card.chips.some(line => normalizeEntryName(line.name) === name)) {
    return { personality: current }
  }
  if (card.chips.length >= CARD_LIMITS.chips) return { personality: current, dropped: 'chip-cap' }
  card.chips.push({ name, text })
  return { personality: renderPersonalityCard(card) }
}

/* ------------------------------------------------------------------ */
/* 顶撞账本                                                            */
/* ------------------------------------------------------------------ */

export interface CardDeltaHit {
  /** 被顶到（或被破）的禁区编号，如 `X1`。 */
  forbidden: string
  /** 代价，≤60 字。账本条目不是场景描写。 */
  cost: string
  chapter: number
  broken: boolean
}

export interface CharacterHitLedger {
  /** 全部顶撞条数。 */
  count: number
  /** 其中「破了」的条数（含同一禁区多次）。 */
  brokenCount: number
  lastChapter: number
  lastCost: string
  /** 最近 3 条明细，按章号降序。更老的不留文字 —— 见设计稿 §20.5。 */
  recent: CardDeltaHit[]
  /** 按禁区分组，供 `REPEAT_BREAK` 判断「同一条线被破了几次」。 */
  byForbidden: Record<string, { count: number; brokenCount: number }>
}

/**
 * 折叠顶撞记录。**读时计算，不落第二份真相** —— 重定稿会换 `finalizationId`，
 * 存下来的聚合立刻变脏，还得再写一套失效逻辑。
 */
export function summarizeCharacterHits(hits: readonly CardDeltaHit[]): CharacterHitLedger {
  const ledger: CharacterHitLedger = {
    count: 0, brokenCount: 0, lastChapter: 0, lastCost: '', recent: [], byForbidden: {},
  }
  if (hits.length === 0) return ledger

  const ordered = [...hits].sort((a, b) => a.chapter - b.chapter)
  for (const hit of ordered) {
    ledger.count += 1
    if (hit.broken) ledger.brokenCount += 1
    const bucket = ledger.byForbidden[hit.forbidden] ?? { count: 0, brokenCount: 0 }
    bucket.count += 1
    if (hit.broken) bucket.brokenCount += 1
    ledger.byForbidden[hit.forbidden] = bucket
  }
  const latest = ordered[ordered.length - 1]
  ledger.lastChapter = latest.chapter
  ledger.lastCost = latest.cost
  ledger.recent = ordered.slice(-3).reverse().map(hit => ({ ...hit }))
  return ledger
}

/* ------------------------------------------------------------------ */
/* 从角色图谱 Markdown 里取主角卡                                        */
/* ------------------------------------------------------------------ */

const PERSONALITY_LABEL = /^-\s*(?:性格|Personality)\s*[:：]\s*(.*)$/u
const ANY_FIELD_LINE = /^-\s*\S+\s*[:：]/u

/**
 * 从 `renderCharacterRosterMarkdown` 的产物里取出**主角那一条**的 personality。
 *
 * 为什么需要它：审计现在拿到的是整份 `charactersArch`，所有角色的编号会被并成一个
 * 白名单 —— 那抓不到「引用了另一个角色的 X3」。取主角块是这个问题的最小缓解，
 * 不需要把角色卡结构化。
 *
 * 注意投影的形状：personality 含换行时，首行带 `- 性格：` 前缀，**后续行是裸行**，
 * 所以取值要一直读到下一个 `- 字段：` 行为止。
 */
export function protagonistCardFromRoster(
  markdown: string | null | undefined,
  language: 'zh-CN' | 'en-US' = 'zh-CN',
): PersonalityCard | null {
  if (!markdown) return null
  const label = language === 'en-US'
    ? CHARACTER_ROLE_LABELS.protagonist.enUS
    : CHARACTER_ROLE_LABELS.protagonist.zhCN
  const heading = language === 'en-US' ? `## ${label}: ` : `## ${label}：`

  const blocks = markdown.split(/\n(?=##[\t ])/u)
  for (const block of blocks) {
    const lines = block.split(/\r?\n/u)
    if (!lines[0]?.trim().startsWith(heading)) continue

    const collected: string[] = []
    let inside = false
    for (const line of lines.slice(1)) {
      const match = PERSONALITY_LABEL.exec(line.trim())
      if (match) {
        inside = true
        if (match[1]) collected.push(match[1])
        continue
      }
      if (!inside) continue
      // 下一个字段行即结束；裸行是 personality 的续行。
      if (ANY_FIELD_LINE.test(line.trim())) break
      collected.push(line)
    }
    return parsePersonalityCard(collected.join('\n'))
  }
  return null
}
