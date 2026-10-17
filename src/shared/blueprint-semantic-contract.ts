import { StructuredContractDiagnostic } from './structured-contract-diagnostic'
import { CHARACTER_ROLES, type CharacterRole } from './character-role'
import { normalizeKeyEvents, type BlueprintKeyEvent } from './blueprint-key-events'
import { normalizeBlueprintSpaceRefs, type BlueprintSpaceRefRaw } from './space-time-consistency'
import type { WritingLanguage } from './writing-language'

export interface BlueprintRelationshipFact {
  from: string
  to: string
  relation: string
}

/** A recurring named character first introduced by this blueprint. */
export interface BlueprintNewCharacterCandidate {
  name: string
  role: CharacterRole
}

/** Stable provenance input; validation code and qualification hash this same manifest. */
export const BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST = Object.freeze({
  schemaVersion: 1,
  requiredFields: Object.freeze([
    'chapterNumber',
    'title',
    'role',
    'purpose',
    'keyEvents',
    'characters',
    'relationships',
    'suspenseHook',
  ] as const),
  characters: Object.freeze({ minimumItems: 1, unique: true } as const),
  relationships: Object.freeze({
    required: true,
    emptyAllowed: true,
    requiredFields: Object.freeze(['from', 'to', 'relation'] as const),
    endpointsMustAppearInCharacters: true,
  } as const),
  exactChapterCoverage: true,
} as const)

export function blueprintSemanticGenerationContract(writingLanguage: WritingLanguage): string {
  if (writingLanguage === 'en-US') {
    return `[Immutable blueprint JSON contract]
Output {"blueprints":[...]} only. Every item must contain all of these fields: ${BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST.requiredFields.join(', ')}.
chapterNumber must cover every target chapter exactly once, without duplicates or out-of-range values. title, role, purpose, and suspenseHook must be non-empty strings. keyEvents must be an ordered array of 2-5 items, each with id (like "1:E1"), event (30-80 characters describing what concretely happens), and estimatedUnits (a positive integer: the manuscript units that event is expected to take). Ids are advisory; the runtime rewrites them from the chapter number.
suspenseHook is always required; even without a mystery, state one concrete unresolved decision, threat, revelation, or consequence that creates forward pressure.
suspenseHook and keyEvents must not overlap: every keyEvents item is an event that happens and concludes within this chapter, while suspenseHook states only what is still unresolved when the chapter ends. suspenseHook is not an event: never restate, summarize, or rephrase any keyEvents item (including the last one). The reverse also holds: anything left open for later chapters belongs in suspenseHook, never in keyEvents -- in particular, never append the suspenseHook content again as the final keyEvents item.
characters must be an array containing at least one unique, non-empty full character name.
newCharacterCandidates is optional. When present, include only important named characters first introduced by this blueprint and expected to recur. Every item must contain name and role, name must exactly copy one entry from characters, and role must be protagonist, antagonist, supporting, or minor. Omit it or use [] when there are no candidates; never include incidental figures.
spaceRefs is optional and may be []. When present, each item must contain space (a space name copied verbatim from dimension 4 of the world setting) and may contain timeRef (24-hour HH:MM or HH:MM-HH:MM) and beat (what happens there). Only emit it when the chapter genuinely has a place and, if stated, a time; omit the field or use [] otherwise. Never invent a space that the world setting does not register.
attacks is optional and is attached to a keyEvents item, not to the blueprint: {"kind":"slot","space":"a registered space name","hour":"21:00","rationale":"why this action breaks that slot"}. kind must be slot; space must copy a space name registered in dimension 4 of the world setting; hour must be the 24-hour clock time of the SLOT BEING ATTACKED — not the time this chapter acts (these often differ); rationale is one optional sentence. Whenever the chapter invalidates, disproves, or scrambles a slot (a space + clock-time pair), it must declare attacks — otherwise the action has no checkable target. Never declare attacks for merely passing through a space, or for prose unrelated to that slot.
relationships is required and may be []; every item must contain non-empty from, to, and relation fields. from and to must exactly copy full names from the same item's characters array and may not self-reference.
Preserve complete narrative content.
Do not omit required fields, combine chapters, rename fields, explain, or output Markdown or code fences.`
  }
  return `【不可变蓝图 JSON 合同】
只输出 {"blueprints":[...]}，每项必须完整包含：${BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST.requiredFields.join('、')}。
chapterNumber 必须覆盖本批每个目标章节且不得重复或越界；title、role、purpose、suspenseHook 必须是非空字符串；keyEvents 必须是有序数组，2-5 条，每条含 id（形如 "1:E1"）、event（30-80 字，写清具体发生了什么）、estimatedUnits（正整数：该事件预计占用的正文单位数）。id 仅供参考，运行时会按章号重写。
suspenseHook 始终必填；即使本章没有谜团，也要写明一个制造推进压力的具体未决决定、威胁、揭示或后果。
suspenseHook 与 keyEvents 必须严格分工、不得重叠：keyEvents 的每一条都是**本章内发生并写出结果**的事件；suspenseHook 只写「本章结束时仍未决的那个问题/威胁/代价」，它不是事件，不得复述、摘要或改写 keyEvents 的任何一条（含最后一条）。反向同样成立：凡「留下悬念、待后文揭晓、结果尚未落定」的内容都属于 suspenseHook，不得写进 keyEvents —— 尤其不得把 suspenseHook 的内容再加一遍，当作 keyEvents 的最后一条。
characters 必须是至少含一个唯一非空角色名的字符串数组。
newCharacterCandidates 可选；提供时只声明由本章首次引入且预计后续复用的重要具名角色，每项必须包含 name、role，name 必须逐字复制 characters 中的一个完整姓名，role 只能是 protagonist、antagonist、supporting、minor。无候选时可省略或传 []，一次性路人不得声明为候选。
spaceRefs 可选，无空间/钟点时传 [] 或省略；提供时每项必须含 space（逐字复制世界观第 4 维登记的空间名），可含 timeRef（24 小时制 HH:MM 或 HH:MM-HH:MM）与 beat（在那里发生了什么）。只在**确有**空间时输出；不得发明世界观未登记的空间名。
attacks 可选，挂在 keyEvents 的**条目**上（不是蓝图顶层）：{"kind":"slot","space":"世界观登记的空间名","hour":"21:00","rationale":"为什么这个动作能破坏该格"}。kind 只能是 slot；space 必须逐字复制世界观第 4 维登记的空间名；hour 必须是**被攻击那一格**的 24 小时制钟点，**不是这一章动手的钟点**（两者常常不同：要作废「晚九点」那一格，白天准备也算）；rationale 可选，一句话说明机制。凡本章要作废、证伪或搅乱某一格（某个「空间 + 钟点」组合），必须声明 attacks —— 否则这个动作没有可核对的目标。只是路过该空间、或与该格无关的叙事，不得声明 attacks。
relationships 必须是数组，无关系时传 []；每项必须含非空 from、to、relation，from/to 必须精确出现在同项 characters 中且不能自指。
from/to 必须逐字复制同一项 characters 中的完整字符串；任一端点不在 characters 时，删除该关系或使用 []，不得发明别名、简称或补写角色。
叙述内容须保持完整。
不得省略必填字段、合并章节、输出近义字段、解释、Markdown 或代码围栏。`
}

/**
 * Provider-neutral generation fact. Persistence-only fields are deliberately
 * absent: callers add those after the model result has crossed this seam.
 */
export interface BlueprintSemanticItem {
  chapterNumber: number
  title: string
  role: string
  purpose: string
  /** 结构化事件清单（归一化入口见 `blueprint-key-events.ts`）。 */
  keyEvents: BlueprintKeyEvent[]
  /**
   * B′ 空间引用（可选伴随字段，归一化入口见 `space-time-consistency.ts`）。
   *
   * `space` 必须**逐字**命中世界观第 4 维登记的空间名；`timeRef` 为 24 小时制单点或区间。
   * 只在确有空间/钟点时输出，没有就空数组（fail-open，不逼模型编）。
   */
  spaceRefs: BlueprintSpaceRefRaw[]
  characters: string[]
  newCharacterCandidates: BlueprintNewCharacterCandidate[]
  relationshipHints: BlueprintRelationshipFact[]
  suspenseHook: string
}

export interface BlueprintAuthorItem extends BlueprintSemanticItem {
  userGuidance: string
  notes: string
  notesUpdatedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function fieldValue(
  value: Record<string, unknown>,
  canonical: string,
  aliases: readonly string[] = [],
): unknown {
  if (Object.hasOwn(value, canonical)) return value[canonical]
  for (const alias of aliases) {
    if (Object.hasOwn(value, alias)) return value[alias]
  }
  return undefined
}

function requiredText(value: unknown, path: string): string {
  if (value === undefined) throw new StructuredContractDiagnostic('missing_field', path)
  if (typeof value !== 'string') throw new StructuredContractDiagnostic('invalid_type', path)
  if (!value.trim()) throw new StructuredContractDiagnostic('empty_value', path)
  return value.trim()
}

/**
 * `keyEvents` 的双形态入口（阶段 1）。
 *
 * 模型产出仍是字符串，但**已解码的领域对象**（`keyEvents: BlueprintKeyEvent[]`）会被
 * `structured-batch-executor.ts` 的 `validateItem` 再校验一次；若只接受字符串，
 * 二次校验必然抛 `invalid_type`，整条蓝图生成链路失败。两种形态都在这里放行，
 * 具体切分/归一化交给 `normalizeKeyEvents`。
 *
 * 空字符串仍按原规则报 `empty_value`（保持既有诊断口径）。
 */
function requiredKeyEvents(value: unknown, path: string): unknown {
  if (Array.isArray(value)) return value
  return requiredText(value, path)
}

function normalizedChapterNumber(value: Record<string, unknown>, path: string): number {
  const candidate = fieldValue(value, 'chapterNumber', ['chapter_number'])
  if (candidate === undefined) throw new StructuredContractDiagnostic('missing_field', `${path}.chapterNumber`)
  if (typeof candidate !== 'number' && typeof candidate !== 'string') {
    throw new StructuredContractDiagnostic('invalid_type', `${path}.chapterNumber`)
  }
  const chapterNumber = Number(candidate)
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) {
    throw new StructuredContractDiagnostic('invalid_value', `${path}.chapterNumber`)
  }
  return chapterNumber
}

function normalizedCharacters(value: unknown, path: string): string[] {
  if (value === undefined) throw new StructuredContractDiagnostic('missing_field', path)
  if (!Array.isArray(value)) throw new StructuredContractDiagnostic('invalid_type', path)
  if (value.length === 0) throw new StructuredContractDiagnostic('invalid_value', path)
  const characters = value.map((candidate, index) => requiredText(candidate, `${path}[${index}]`))
  if (new Set(characters).size !== characters.length) {
    throw new StructuredContractDiagnostic('duplicate_item', path)
  }
  return characters
}

function normalizedRelationships(
  value: unknown,
  path: string,
  characters: readonly string[],
): BlueprintRelationshipFact[] {
  if (value === undefined) throw new StructuredContractDiagnostic('missing_field', path)
  if (!Array.isArray(value)) throw new StructuredContractDiagnostic('invalid_type', path)
  const characterSet = new Set(characters)
  const seen = new Set<string>()
  return value.map((candidate, index) => {
    const relationshipPath = `${path}[${index}]`
    if (!isRecord(candidate)) {
      throw new StructuredContractDiagnostic('invalid_type', relationshipPath)
    }
    const from = requiredText(fieldValue(candidate, 'from', ['source']), `${relationshipPath}.from`)
    const to = requiredText(fieldValue(candidate, 'to', ['target']), `${relationshipPath}.to`)
    const relation = requiredText(candidate.relation, `${relationshipPath}.relation`)
    if (from === to) {
      throw new StructuredContractDiagnostic('relationship_self_reference', relationshipPath)
    }
    if (!characterSet.has(from) || !characterSet.has(to)) {
      throw new StructuredContractDiagnostic('relationship_endpoint_not_in_characters', relationshipPath)
    }
    const key = `${from}\u0000${to}\u0000${relation}`
    if (seen.has(key)) throw new StructuredContractDiagnostic('duplicate_item', path)
    seen.add(key)
    return { from, to, relation }
  })
}

function normalizedNewCharacterCandidates(
  value: unknown,
  path: string,
  characters: readonly string[],
): BlueprintNewCharacterCandidate[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new StructuredContractDiagnostic('invalid_type', path)
  const characterSet = new Set(characters)
  const seen = new Set<string>()
  return value.map((candidate, index) => {
    const candidatePath = `${path}[${index}]`
    if (!isRecord(candidate)) throw new StructuredContractDiagnostic('invalid_type', candidatePath)
    const name = requiredText(candidate.name, `${candidatePath}.name`)
    if (!characterSet.has(name)) {
      throw new StructuredContractDiagnostic('invalid_value', `${candidatePath}.name`)
    }
    if (seen.has(name)) throw new StructuredContractDiagnostic('duplicate_item', path)
    seen.add(name)
    const role = requiredText(candidate.role, `${candidatePath}.role`)
    if (!CHARACTER_ROLES.includes(role as CharacterRole)) {
      throw new StructuredContractDiagnostic('invalid_value', `${candidatePath}.role`)
    }
    return { name, role: role as CharacterRole }
  })
}

export function validateBlueprintSemanticItem(value: unknown): string | undefined {
  try {
    normalizeBlueprintSemanticItem(value)
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function normalizeBlueprintSemanticItem(value: unknown, path = 'blueprint'): BlueprintSemanticItem {
  if (!isRecord(value)) throw new StructuredContractDiagnostic('invalid_type', path)
  const chapterNumber = normalizedChapterNumber(value, path)
  const characters = normalizedCharacters(value.characters, `${path}.characters`)
  const newCharacterCandidates = normalizedNewCharacterCandidates(
    fieldValue(value, 'newCharacterCandidates', ['new_character_candidates']),
    `${path}.newCharacterCandidates`,
    characters,
  )
  const relationshipHints = normalizedRelationships(
    fieldValue(value, 'relationships', ['relationshipHints', 'relations']),
    `${path}.relationships`,
    characters,
  )
  return {
    chapterNumber,
    title: requiredText(value.title, `${path}.title`),
    role: requiredText(value.role, `${path}.role`),
    purpose: requiredText(value.purpose, `${path}.purpose`),
    // 阶段 1：模型产出字符串，已解码产出是数组 —— 两者都接受（见 requiredKeyEvents）。
    keyEvents: normalizeKeyEvents(
      requiredKeyEvents(fieldValue(value, 'keyEvents', ['key_events']), `${path}.keyEvents`),
      { chapterNumber },
    ),
    // B′：可选伴随字段。缺失 / 非法一律收敛为 [] —— 它坏了不该废掉整条蓝图提交。
    spaceRefs: normalizeBlueprintSpaceRefs(
      fieldValue(value, 'spaceRefs', ['space_refs', 'structuredRefs']),
    ),
    characters,
    newCharacterCandidates,
    relationshipHints,
    suspenseHook: requiredText(
      fieldValue(value, 'suspenseHook', ['suspense_hook']),
      `${path}.suspenseHook`,
    ),
  }
}

export function decodeBlueprintSemanticPayload(
  payload: unknown,
  expectedChapterNumbers: readonly number[],
): BlueprintSemanticItem[] {
  const candidates = isRecord(payload) && Object.hasOwn(payload, 'blueprints')
    ? payload.blueprints
    : payload
  if (!Array.isArray(candidates)) throw new StructuredContractDiagnostic('invalid_envelope', 'blueprints')

  const expected = new Set(expectedChapterNumbers)
  if (
    expected.size !== expectedChapterNumbers.length
    || expectedChapterNumbers.some(chapter => !Number.isSafeInteger(chapter) || chapter < 1)
  ) {
    throw new StructuredContractDiagnostic('invalid_value', 'expectedChapterNumbers')
  }

  const decoded = candidates.map((candidate, index) => normalizeBlueprintSemanticItem(candidate, `blueprints[${index}]`))
  const seen = new Set<number>()
  for (const blueprint of decoded) {
    if (seen.has(blueprint.chapterNumber)) {
      throw new StructuredContractDiagnostic('duplicate_item', 'blueprints')
    }
    seen.add(blueprint.chapterNumber)
    if (!expected.has(blueprint.chapterNumber)) {
      throw new StructuredContractDiagnostic('unexpected_item', 'blueprints')
    }
  }
  const missing = expectedChapterNumbers.filter(chapter => !seen.has(chapter))
  if (missing.length > 0) {
    throw new StructuredContractDiagnostic('missing_item', 'blueprints')
  }
  return decoded.sort((left, right) => left.chapterNumber - right.chapterNumber)
}

/**
 * Accepts exactly one JSON root or one complete Markdown JSON fence. It never
 * searches narrative prose for a nested JSON fragment.
 */
function parseBlueprintJsonText(text: string): unknown {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  const candidate = fenced ? fenced[1].trim() : trimmed
  if (!candidate || !/^[{[]/u.test(candidate)) {
    throw new StructuredContractDiagnostic('invalid_envelope', '$')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new StructuredContractDiagnostic('invalid_json', '$')
  }
  return parsed
}

export function parseBlueprintSemanticResponseText(text: string, expectedChapterNumbers: readonly number[]): BlueprintSemanticItem[] {
  return decodeBlueprintSemanticPayload(parseBlueprintJsonText(text), expectedChapterNumbers)
}

export function decodeBlueprintAuthorPayload(payload: unknown, expectedChapterNumbers: readonly number[]): BlueprintAuthorItem[] {
  const decoded = decodeBlueprintSemanticPayload(payload, expectedChapterNumbers)
  const candidates = isRecord(payload) && Object.hasOwn(payload, 'blueprints') ? payload.blueprints : payload
  if (!Array.isArray(candidates)) throw new StructuredContractDiagnostic('invalid_envelope', 'blueprints')
  const authorFields = new Map(candidates.map((candidate, index) => {
    const path = `blueprints[${index}]`
    if (!isRecord(candidate)) throw new StructuredContractDiagnostic('invalid_type', path)
    const optionalText = (key: 'userGuidance' | 'notes' | 'notesUpdatedAt'): string => {
      const value = candidate[key]
      if (value === undefined) return ''
      if (typeof value !== 'string') throw new StructuredContractDiagnostic('invalid_type', `${path}.${key}`)
      return value
    }
    return [normalizedChapterNumber(candidate, path), {
      userGuidance: optionalText('userGuidance'), notes: optionalText('notes'), notesUpdatedAt: optionalText('notesUpdatedAt'),
    }] as const
  }))
  return decoded.map(item => ({ ...item, ...authorFields.get(item.chapterNumber)! }))
}

export function parseBlueprintAuthorResponseText(text: string, expectedChapterNumbers: readonly number[]): BlueprintAuthorItem[] {
  return decodeBlueprintAuthorPayload(parseBlueprintJsonText(text), expectedChapterNumbers)
}
