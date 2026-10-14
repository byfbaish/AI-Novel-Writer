import type { CharacterRole } from './character-role'
import { CHARACTER_ROLES } from './character-role'
import { repairUnescapedStringQuotes } from './json-text-repair'

/**
 * 「为指定角色补全背景」的产物解析。
 *
 * 放在 shared 是因为**两侧都要用**：渲染层（命令）用它把产物变成预览，
 * 主进程（`proveCharacterProposal` 的合成分支）用**同一份**解析从冻结产物重建候选
 * —— 否则"作者看到的候选"与"证明算出的候选"会各自漂移。
 */
export interface ParsedCharacterCard {
  name: string
  role?: CharacterRole
  gender?: string
  age?: string
  appearance?: string
  personality?: string
  background?: string
  abilities?: string
  motivation?: string
  arc?: string
  notes?: string
}

export interface ParsedBackgroundSynthesis {
  characterCard: ParsedCharacterCard
  relationships: { targetName: string; relation: string }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Accepts exactly one JSON root or one complete fenced JSON block; never scans prose. */
function parseJsonRoot(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed)
  const candidate = fenced ? fenced[1].trim() : trimmed
  if (!candidate || !/^[{[]/u.test(candidate)) throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  try {
    return JSON.parse(candidate) as unknown
  } catch (error) {
    // 语法级容错（不含任何语义判断）：模型常在字符串值里直接写英文引号，
    // 合法的 JSON 需要 \"。只在严格解析失败后尝试一次，失败仍按原样报错。
    try {
      return JSON.parse(repairUnescapedStringQuotes(candidate)) as unknown
    } catch {
      throw error
    }
  }
}

export function parseCharacterBackgroundSynthesis(raw: string): ParsedBackgroundSynthesis {
  const parsed = parseJsonRoot(raw)
  const record = isRecord(parsed) && isRecord(parsed.character) ? parsed.character : parsed
  if (!isRecord(record)) throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  const name = optionalText(record.name)
  if (!name) throw new Error('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  const role = optionalText(record.role)
  const characterCard: ParsedCharacterCard = {
    name,
    ...(role && CHARACTER_ROLES.includes(role as CharacterRole) ? { role: role as CharacterRole } : {}),
    ...(optionalText(record.gender) ? { gender: optionalText(record.gender)! } : {}),
    ...(optionalText(record.age) ? { age: optionalText(record.age)! } : {}),
    ...(optionalText(record.appearance) ? { appearance: optionalText(record.appearance)! } : {}),
    ...(optionalText(record.personality) ? { personality: optionalText(record.personality)! } : {}),
    ...(optionalText(record.background) ? { background: optionalText(record.background)! } : {}),
    ...(optionalText(record.abilities) ? { abilities: optionalText(record.abilities)! } : {}),
    ...(optionalText(record.motivation) ? { motivation: optionalText(record.motivation)! } : {}),
    ...(optionalText(record.arc) ? { arc: optionalText(record.arc)! } : {}),
    ...(optionalText(record.notes) ? { notes: optionalText(record.notes)! } : {}),
  }
  const rawRelationships = isRecord(parsed) ? (parsed.relationships ?? parsed.relationshipCandidates) : undefined
  const relationships = Array.isArray(rawRelationships)
    ? rawRelationships.flatMap(candidate => {
      if (!isRecord(candidate)) return []
      const targetName = optionalText(candidate.target) ?? optionalText(candidate.targetName)
      const relation = optionalText(candidate.relation)
      return targetName && relation ? [{ targetName, relation }] : []
    })
    : []
  return { characterCard, relationships }
}
