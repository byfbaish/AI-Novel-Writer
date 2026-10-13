import type { UserSettingsPackErrorCode, UserSettingsPackKind } from '../../src/shared/user-settings-pack'
import {
  USER_SETTINGS_PACK_FORMAT_VERSION,
  USER_SETTINGS_PACK_KINDS,
  isValidWritingSkillName,
  parsePromptFileName,
} from '../../src/shared/user-settings-pack'

/**
 * `.vela-pack` 的 manifest 契约与严格校验。
 *
 * 与项目存档的 manifest **刻意分开**：项目存档 manifest 被 `exactKeys` 冻结在 12 个字段上，
 * 无法承载另一种语义；这里的形状更窄，但校验强度相同（精确键集合 + 逐文件 sha256 + 限额）。
 * 未知字段一律失败，而不是被忽略。
 */

export class UserSettingsPackError extends Error {
  constructor(readonly code: UserSettingsPackErrorCode) {
    super(code)
    this.name = 'UserSettingsPackError'
  }
}

export function fail(code: UserSettingsPackErrorCode): never {
  throw new UserSettingsPackError(code)
}

export interface UserSettingsPackLimits {
  maxPrompts: number
  maxSkills: number
  maxEntries: number
  maxEntryBytes: number
  maxTotalBytes: number
  maxPathBytes: number
}

export const USER_SETTINGS_PACK_LIMITS: Readonly<UserSettingsPackLimits> = Object.freeze({
  maxPrompts: 500,
  maxSkills: 200,
  maxEntries: 1_000,
  maxEntryBytes: 1024 * 1024,
  maxTotalBytes: 16 * 1024 * 1024,
  maxPathBytes: 260,
})

export interface UserSettingsPackManifestEntry {
  path: string
  byteSize: number
  sha256: string
}

export interface UserSettingsPackManifest {
  formatVersion: typeof USER_SETTINGS_PACK_FORMAT_VERSION
  kind: UserSettingsPackKind
  createdAt: string
  appVersion: string | null
  entryCount: number
  declaredUncompressedBytes: number
  promptFileNames: string[]
  skillNames: string[]
  entries: UserSettingsPackManifestEntry[]
}

export type PackEntryKind = 'prompt' | 'skill'

export interface PackEntryClassification {
  kind: PackEntryKind
  /** 提示词为文件名（`<key>.<lang>.json`），Skill 为名称。 */
  id: string
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu
const INVALID_WINDOWS_SEGMENT = /[<>:"|?*]/u

function containsSurrogateCodeUnit(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdfff) return true
  }
  return false
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('USER_PACK_INVALID')
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    fail('USER_PACK_INVALID')
  }
}

function boundedInteger(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    fail('USER_PACK_LIMIT_EXCEEDED')
  }
  return value as number
}

function safeSegments(value: string, maxPathBytes: number): string[] {
  if (containsSurrogateCodeUnit(value) || Buffer.byteLength(value, 'utf8') > maxPathBytes) {
    fail('USER_PACK_INVALID')
  }
  const normalized = value.normalize('NFKC')
  if (normalized.startsWith('/') || normalized.includes('\\') || /^[a-z]:/iu.test(normalized)) {
    fail('USER_PACK_INVALID')
  }
  const segments = normalized.split('/')
  for (const segment of segments) {
    if (
      segment === ''
      || segment === '.'
      || segment === '..'
      || segment.endsWith('.')
      || segment.endsWith(' ')
      || INVALID_WINDOWS_SEGMENT.test(segment)
      || [...segment].some(character => character.charCodeAt(0) <= 31)
      || WINDOWS_RESERVED.test(segment)
    ) {
      fail('USER_PACK_INVALID')
    }
  }
  return segments
}

/**
 * 包内条目只可能是两种形态：`prompts/<file>.json` 与 `skills/<name>/SKILL.md`。
 * 其余一律拒绝（不做"尽力而为"的路径修复）。
 */
export function classifyPackEntryPath(value: unknown, maxPathBytes = USER_SETTINGS_PACK_LIMITS.maxPathBytes): { path: string; classification: PackEntryClassification } {
  if (typeof value !== 'string' || value.length === 0) fail('USER_PACK_INVALID')
  const segments = safeSegments(value, maxPathBytes)
  if (segments.length === 2 && segments[0] === 'prompts') {
    const fileName = segments[1]!
    if (!parsePromptFileName(fileName)) fail('USER_PACK_INVALID')
    return { path: segments.join('/'), classification: { kind: 'prompt', id: fileName } }
  }
  if (segments.length === 3 && segments[0] === 'skills' && segments[2] === 'SKILL.md') {
    const name = segments[1]!
    if (!isValidWritingSkillName(name)) fail('USER_PACK_INVALID')
    return { path: segments.join('/'), classification: { kind: 'skill', id: name } }
  }
  fail('USER_PACK_INVALID')
}

function stringList(value: unknown, maximum: number, validate: (item: string) => boolean): string[] {
  if (!Array.isArray(value) || value.length > maximum) fail('USER_PACK_LIMIT_EXCEEDED')
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !validate(item)) fail('USER_PACK_INVALID')
    const key = item.toLowerCase()
    if (seen.has(key)) fail('USER_PACK_INVALID')
    seen.add(key)
    result.push(item)
  }
  return result
}

export function parseUserSettingsPackManifest(
  value: unknown,
  configuredLimits?: Partial<UserSettingsPackLimits>,
): UserSettingsPackManifest {
  const limits = { ...USER_SETTINGS_PACK_LIMITS, ...configuredLimits }
  const source = record(value)
  exactKeys(source, [
    'formatVersion',
    'kind',
    'createdAt',
    'appVersion',
    'entryCount',
    'declaredUncompressedBytes',
    'promptFileNames',
    'skillNames',
    'entries',
  ])
  if (source.formatVersion !== USER_SETTINGS_PACK_FORMAT_VERSION) fail('USER_PACK_VERSION_UNSUPPORTED')
  if (typeof source.kind !== 'string' || !(USER_SETTINGS_PACK_KINDS as readonly string[]).includes(source.kind)) {
    fail('USER_PACK_INVALID')
  }
  const createdAtMillis = typeof source.createdAt === 'string' ? Date.parse(source.createdAt) : Number.NaN
  if (!Number.isFinite(createdAtMillis) || new Date(createdAtMillis).toISOString() !== source.createdAt) {
    fail('USER_PACK_INVALID')
  }
  let appVersion: string | null = null
  if (source.appVersion !== null) {
    if (typeof source.appVersion !== 'string' || source.appVersion.length === 0 || source.appVersion.length > 64) {
      fail('USER_PACK_INVALID')
    }
    appVersion = source.appVersion
  }

  if (!Array.isArray(source.entries) || source.entries.length > limits.maxEntries) fail('USER_PACK_LIMIT_EXCEEDED')
  if (source.entryCount !== source.entries.length) fail('USER_PACK_INVALID')

  const seenPaths = new Set<string>()
  const promptIds = new Set<string>()
  const skillIds = new Set<string>()
  const entries = source.entries.map(item => {
    const entry = record(item)
    exactKeys(entry, ['path', 'byteSize', 'sha256'])
    const { path, classification } = classifyPackEntryPath(entry.path, limits.maxPathBytes)
    const dedupeKey = path.toLowerCase()
    if (seenPaths.has(dedupeKey)) fail('USER_PACK_INVALID')
    seenPaths.add(dedupeKey)
    if (classification.kind === 'prompt') promptIds.add(classification.id)
    else skillIds.add(classification.id)
    const byteSize = boundedInteger(entry.byteSize, limits.maxEntryBytes)
    if (typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256)) fail('USER_PACK_INVALID')
    return { path, byteSize, sha256: entry.sha256 }
  })

  const total = entries.reduce((sum, entry) => sum + entry.byteSize, 0)
  if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes || total !== source.declaredUncompressedBytes) {
    fail('USER_PACK_LIMIT_EXCEEDED')
  }

  const promptFileNames = stringList(source.promptFileNames, limits.maxPrompts, item => parsePromptFileName(item) !== null)
  const skillNames = stringList(source.skillNames, limits.maxSkills, isValidWritingSkillName)
  if (promptFileNames.length !== promptIds.size || promptFileNames.some(name => !promptIds.has(name))) {
    fail('USER_PACK_INVALID')
  }
  if (skillNames.length !== skillIds.size || skillNames.some(name => !skillIds.has(name))) {
    fail('USER_PACK_INVALID')
  }

  return {
    formatVersion: USER_SETTINGS_PACK_FORMAT_VERSION,
    kind: source.kind as UserSettingsPackKind,
    createdAt: source.createdAt as string,
    appVersion,
    entryCount: entries.length,
    declaredUncompressedBytes: total,
    promptFileNames,
    skillNames,
    entries,
  }
}
