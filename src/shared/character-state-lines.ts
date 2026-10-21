/**
 * 角色当前状态的**行式投影**：生成链与审稿链共用的唯一渲染入口。
 *
 * 存在理由（2026-10-21，W0 接线）：
 * 定稿后 `finalized-character:commit` 已经把状态写进 `characters.cs_*`，带字段级
 * provenance（`author` / `derived` / `legacy`）、来源定稿身份与更新章号。但两条
 * 消费路径都读不到：
 * - 正文链 `generate-draft.command.ts` 在 `character_states` 上硬编码空串；
 * - 审稿链 `review-revision-context.ts` 只放行 `kind==='author'`，而库内全是 `derived`。
 * 于是状态被生产、被存储、带证据链、带章号，两条路径一条都不读 ——
 * 这不是设计缺陷，是**接线遗漏**。本模块把「怎么渲染」收成一份，避免第三条路径
 * 再各自发明一遍格式。
 *
 * 四条契约：
 * 1. `author` 与 `derived` 都注入，`legacy` 一律跳过 —— 来源未知的旧值不能当事实。
 * 2. `derived` 逐字段标注「派生」：它是上一章正文的抽取结果，不是作者声明，
 *    允许被后文修正，不得被当成永久约束。
 * 3. `upToChapter` 之外的状态一律不注入：状态是「**截至某章**」的快照。拿第 8 章
 *    的伤势去精修第 2 章，既是剧透，也是错误约束。
 * 4. 格式沿用 `field@chapterN: value`，派生项为 `field@chapterN·派生: value`。
 *    author 分支逐字保持旧格式（既有 prompt 断言依赖它）。
 */
import { CHARACTER_STATE_TEXT_FIELDS, type CharacterRosterCharacterState } from './character-roster'
import type { WritingLanguage } from './writing-language'

export interface CharacterStateLineSource {
  name: string
  role?: string
  currentState?: CharacterRosterCharacterState
}

export interface CharacterStateLinesOptions {
  writingLanguage: WritingLanguage
  /** 当前正在写 / 正在审的章号。晚于它的状态不注入（快照是「截至该章」）。 */
  upToChapter?: number
  /** 是否包含派生状态，默认包含（W0 的核心目的就是把派生项接上）。 */
  includeDerived?: boolean
}

/** 取某个字段的「事实章号 + 是否派生」；无 provenance 或来源未知时返回 undefined。 */
function fieldAuthority(
  provenance: CharacterRosterCharacterState['provenance'],
  field: (typeof CHARACTER_STATE_TEXT_FIELDS)[number],
): { chapterNumber: number; derived: boolean } | undefined {
  const entry = provenance?.[field]
  if (!entry) return undefined
  if (entry.kind === 'legacy') return undefined
  const chapterNumber = entry.kind === 'author' ? entry.chapterNumber : entry.source?.chapterNumber
  if (!Number.isSafeInteger(chapterNumber)) return undefined
  return { chapterNumber, derived: entry.kind === 'derived' }
}

/**
 * 把一张角色卡的状态渲染成 `field@chapterN: value` 形式的**事实行**。
 *
 * 用途：正文链把它并进角色档案事实（作者材料块），审稿链把它排成多行状态块。
 * 两处共用同一份筛选规则，但排版各自适配 —— 规则只有一份，格式有两种。
 */
export function characterStateFacts(
  state: CharacterRosterCharacterState | undefined,
  options: { writingLanguage: WritingLanguage; upToChapter?: number; includeDerived?: boolean },
): string[] {
  if (!state) return []
  const isEn = options.writingLanguage === 'en-US'
  const includeDerived = options.includeDerived !== false
  const upToChapter = options.upToChapter
  const facts: string[] = []
  for (const field of CHARACTER_STATE_TEXT_FIELDS) {
    const value = typeof state[field] === 'string' ? state[field].trim() : ''
    if (!value) continue
    const authority = fieldAuthority(state.provenance, field)
    if (!authority) continue
    if (authority.derived && !includeDerived) continue
    // 关键：只给「截至本章」的事实。晚于本章的状态属于未来，注入即剧透 + 错约束。
    if (upToChapter !== undefined && authority.chapterNumber > upToChapter) continue
    const suffix = authority.derived ? (isEn ? '·derived' : '·派生') : ''
    // author 分支逐字沿用旧格式：既有 prompt 断言（`keyItems@chapter1: …`）依赖它。
    facts.push(`${field}@chapter${authority.chapterNumber}${suffix}: ${value}`)
  }
  return facts
}

/**
 * 渲染角色状态行。返回空串表示「没有任何可注入的状态」，由调用方决定兜底文案
 * （生成侧与审稿侧的兜底不同，故不在这里写死）。
 */
export function formatCharacterStateLines(
  cards: readonly CharacterStateLineSource[],
  options: CharacterStateLinesOptions,
): string {
  const isEn = options.writingLanguage === 'en-US'
  const lines: string[] = []
  for (const card of cards) {
    const name = card.name?.trim()
    if (!name) continue
    const facts = characterStateFacts(card.currentState, options)
    if (!facts.length) continue
    const role = card.role?.trim()
    const head = isEn
      ? `${name} (${role || 'unknown'}) state (read as of the annotated chapter, not permanent):`
      : `${name}（${role || '未知'}）状态（按标注章节理解，非永久约束）：`
    lines.push([head, ...facts.map(fact => `  - ${fact}`)].join('\n'))
  }
  return lines.join('\n')
}
