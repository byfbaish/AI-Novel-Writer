import { characterRosterIdentityKey } from './character-roster'
import type { CharacterProposalItem, CharacterStaticFields } from './character-proposal'
import { decodeCharacterDetails, extractSingleCompleteJsonObject, validateCharacterDetail } from './character-proposal-parser'

/**
 * 归位表补全（cast-ledger completion）产物的**纯**解析器。
 *
 * 归位表（src/shared/cast-ledger.ts）列出「被提到但还没有卡」的名字；②补全段让模型为这些名字补齐
 * 静态资料。产物是多段 `{ entries: [...] }`（与架构详情的形状一致），但**没有** slotId 清单可对照：
 * 名字就是唯一身份键。因此这里做三件事，且只做这三件事：
 *  1. 每段产物必须是一个完整 JSON 对象、`entries` 数组、每条通过 validateCharacterDetail（无效立即报错，
 *     绝不静默丢弃 —— 丢掉一条会让名字集合悄悄缺项，最终变成一张没有资料的空壳卡）；
 *  2. 合并所有产物后，名字集合必须与 expectedNames 集合**恰好相等**（缺/多/重复都报错）；
 *  3. 按 expectedNames 顺序产出条目，身份键用 characterRosterIdentityKey，使仅大小写不同的同名项必然撞键而报重复。
 *
 * 该函数不读库、不校验 run/artifact 绑定：那是 cast-ledger-generation-proof.ts 的职责。
 */

/** 单个条目的结构：`resolution` 由 character-proposal-service 结合当前库解析后补齐。 */
export type CastLedgerCompletionItem = Omit<CharacterProposalItem, 'resolution'>

export interface CastLedgerCompletionParse {
  /** 与 expectedNames 一一对应、同顺序。 */
  items: CastLedgerCompletionItem[]
  /** 已校验的名字（trim 后与 expectedNames 同集合），供调用方派生 canonical source。 */
  names: string[]
}

export type CastLedgerCompletionErrorCode =
  | 'CHARACTER_CAST_LEDGER_NAMES_REQUIRED'
  | 'CHARACTER_CAST_LEDGER_NAMES_MISMATCH'
  | 'CHARACTER_CAST_LEDGER_ARTIFACT_INVALID'

/**
 * message 必须是**裸错误码**：generation-controller 只透传 `^CHARACTER_[A-Z_]+$` 的 message，
 * 把「缺哪些名字」拼进 message 会让整条错误退化成 GENERATION_REQUEST_FAILED。
 * 因此诊断放在 `detail`（测试与日志可读），code 保持可透传。
 */
export class CastLedgerCompletionError extends Error {
  readonly code: CastLedgerCompletionErrorCode
  readonly detail: string
  constructor(code: CastLedgerCompletionErrorCode, detail: string) {
    super(code)
    this.name = 'CastLedgerCompletionError'
    this.code = code
    this.detail = detail
  }
}

/** 规范化名字集合：trim、去空、去重、排序。 */
export function canonicalCastLedgerNames(names: readonly string[]): string[] {
  const unique = new Set<string>()
  for (const name of names) {
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (trimmed) unique.add(trimmed)
  }
  // 码元序而非 localeCompare：canonical 形式会进入持久化的 sourceHash，必须跨语言环境稳定；
  // 展示顺序由界面自己排。
  return [...unique].sort()
}

const MAX_NAME_LIST = 8
const describe = (values: readonly string[]): string => values.length
  ? values.slice(0, MAX_NAME_LIST).join('、') + (values.length > MAX_NAME_LIST ? ` 等 ${values.length} 个` : '')
  : '无'
const staticText = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const artifactInvalid = (detail: string) => new CastLedgerCompletionError('CHARACTER_CAST_LEDGER_ARTIFACT_INVALID', detail)
const namesMismatch = (missing: readonly string[], extra: readonly string[], duplicated: readonly string[]) =>
  new CastLedgerCompletionError('CHARACTER_CAST_LEDGER_NAMES_MISMATCH',
    `缺少 ${describe(missing)}；多出 ${describe(extra)}；重复 ${describe(duplicated)}`)

export function parseCastLedgerCompletion(artifactTexts: readonly string[], expectedNames: readonly string[]): CastLedgerCompletionParse {
  const expected: string[] = []
  for (const name of expectedNames) {
    const trimmed = typeof name === 'string' ? name.trim() : ''
    if (!trimmed) throw new CastLedgerCompletionError('CHARACTER_CAST_LEDGER_NAMES_REQUIRED', '期望名字列表包含空项')
    expected.push(trimmed)
  }
  if (!expected.length) throw new CastLedgerCompletionError('CHARACTER_CAST_LEDGER_NAMES_REQUIRED', '期望名字列表为空')
  const expectedKeys = new Set(expected.map(characterRosterIdentityKey))
  if (expectedKeys.size !== expected.length) {
    throw new CastLedgerCompletionError('CHARACTER_CAST_LEDGER_NAMES_REQUIRED', '期望名字列表包含仅大小写不同的重复项')
  }
  if (!artifactTexts.length) throw artifactInvalid('没有可解析的补全产物')

  // 第一遍：解析 + 逐条校验，收集原始名字序列（此处不判重，重复留给下面的集合比较）。
  const decoded: { name: string; entry: ReturnType<typeof decodeCharacterDetails>[number] }[] = []
  for (const [index, text] of artifactTexts.entries()) {
    let entries: ReturnType<typeof decodeCharacterDetails>
    try {
      const root = JSON.parse(extractSingleCompleteJsonObject(text)) as Record<string, unknown>
      // 与架构详情同构：只允许 `entries`，防止把别的结构化产物（清单/骨架）当成补全结果采纳。
      if (!root || typeof root !== 'object' || Array.isArray(root) || Object.keys(root).some(key => key !== 'entries')) {
        throw new Error('envelope')
      }
      entries = decodeCharacterDetails(text)
    } catch { throw artifactInvalid(`第 ${index + 1} 段产物不是可解析的角色补全 JSON`) }
    for (const [position, entry] of entries.entries()) {
      const invalid = validateCharacterDetail(entry)
      if (invalid) throw artifactInvalid(`第 ${index + 1} 段产物第 ${position + 1} 条无效：${invalid}`)
      decoded.push({ name: staticText(entry.name), entry })
    }
  }

  // 第二遍：名字集合比较。缺、多、重复都必须失败 —— 任何一种都是「模型没按名单补齐」。
  const counts = new Map<string, number>()
  for (const { name } of decoded) counts.set(name, (counts.get(name) ?? 0) + 1)
  const expectedSet = new Set(expected)
  const missing = expected.filter(name => !counts.has(name))
  const extra = [...counts.keys()].filter(name => !expectedSet.has(name))
  const duplicated = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name)
  if (missing.length || extra.length || duplicated.length) throw namesMismatch(missing, extra, duplicated)

  // 第三遍：按 expectedNames 顺序产出条目（产物里的顺序不属于合同）。
  const byName = new Map(decoded.map(item => [item.name, item.entry]))
  const items = expected.map(name => {
    const entry = byName.get(name)!
    const key = characterRosterIdentityKey(name)
    const fields: CharacterStaticFields = {
      name, role: entry.role,
      gender: staticText(entry.gender), age: staticText(entry.age),
      appearance: staticText(entry.appearance), personality: staticText(entry.personality),
      background: staticText(entry.background), abilities: staticText(entry.abilities),
      motivation: staticText(entry.motivation), arc: staticText(entry.arc), notes: staticText(entry.notes),
    }
    // currentState 故意不投影：新卡不是「第 0 章观测过的卡」，状态应保持「未观测」。
    return { selectionKey: `cast-ledger:${key}`, sourceId: `cast-ledger:${name}`, fields, relationships: [] }
  })
  return { items, names: expected }
}
