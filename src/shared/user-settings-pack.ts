import { WRITING_LANGUAGES, type WritingLanguage } from './writing-language'

/**
 * 用户级「创作资产包」契约。
 *
 * 作用域说明：本包只承载**可跨项目复用、可分享**的创作资产（提示词覆盖 / 写作 Skill）。
 * 个人环境（`models.json` 含明文密钥、`config.json`、`recent-projects.json`）与外观皮肤
 * **永不进包**——这三类与「番茄文风」不属于同一类东西，混装既有外泄风险，也无法跨用户交换。
 */

export const USER_SETTINGS_PACK_EXTENSION = 'vela-pack'
export const USER_SETTINGS_PACK_FORMAT_VERSION = 1

export const USER_SETTINGS_PACK_KINDS = ['creative-assets'] as const
export type UserSettingsPackKind = (typeof USER_SETTINGS_PACK_KINDS)[number]

/** 包内**永不包含**的内容类别；导入侧据此向作者说明，不靠猜文件名。 */
export const USER_SETTINGS_PACK_EXCLUDES = Object.freeze([
  'models',
  'config',
  'recent-projects',
  'skins',
] as const)

export type UserSettingsPackConflictStrategy = 'overwrite' | 'skip' | 'rename'

export const USER_SETTINGS_PACK_CONFLICT_STRATEGIES =
  ['overwrite', 'skip', 'rename'] as const satisfies readonly UserSettingsPackConflictStrategy[]

export interface UserSettingsPackPromptEntry {
  /** 包内文件名：`<key>.<lang>.json` 或（历史无语言标记）`<key>.json`。 */
  fileName: string
  key: string
  writingLanguage: WritingLanguage | null
  byteSize: number
}

export interface UserSettingsPackSkillEntry {
  name: string
  byteSize: number
}

export interface UserSettingsPackSummary {
  formatVersion: number
  kind: UserSettingsPackKind
  createdAt: string
  appVersion: string | null
  prompts: UserSettingsPackPromptEntry[]
  skills: UserSettingsPackSkillEntry[]
  entryCount: number
  totalBytes: number
}

/** 冲突标识：提示词用包内文件名，Skill 用名称；两侧都保证唯一。 */
export interface UserSettingsPackConflictReport {
  prompts: string[]
  skills: string[]
}

export interface UserSettingsPackDiagnostic {
  path: string
  error: string
}

export type UserSettingsPackErrorCode =
  | 'USER_PACK_INVALID'
  | 'USER_PACK_LIMIT_EXCEEDED'
  | 'USER_PACK_VERSION_UNSUPPORTED'
  | 'USER_PACK_GRANT_INVALID'
  | 'USER_PACK_TARGET_EXISTS'
  | 'USER_PACK_SOURCE_UNSAFE'
  | 'USER_PACK_EMPTY'
  | 'USER_PACK_CONTENT_REJECTED'

export interface UserSettingsPackFailure {
  success: false
  error: string
  errorCode?: UserSettingsPackErrorCode
}

export interface UserSettingsPackExportRequest {
  /** 来自 `dialog:select-settings-pack-export` 的一次性授权；渲染层永不携带路径。 */
  targetGrantId: string
}

export interface UserSettingsPackExportReceipt {
  summary: UserSettingsPackSummary
  targetSha256: string
  targetByteSize: number
  /** 因无语言标记而未写入的遗留文件等；只提示，不阻断。 */
  diagnostics: UserSettingsPackDiagnostic[]
}

export interface UserSettingsPackInspectRequest {
  /** 来自 `dialog:select-settings-pack-import` 的一次性授权。 */
  archiveGrantId: string
}

/**
 * 检查结果即「待导入快照」。导入只使用本次检查时读到的字节，
 * 因此作者确认的内容与实际写入的内容逐字节相同（避免检查后被替换的 TOCTOU 空档）。
 */
export interface UserSettingsPackInspectReceipt {
  inspectId: string
  summary: UserSettingsPackSummary
  conflicts: UserSettingsPackConflictReport
  diagnostics: UserSettingsPackDiagnostic[]
}

export interface UserSettingsPackImportRequest {
  inspectId: string
  conflictStrategy: UserSettingsPackConflictStrategy
  importPrompts: boolean
  importSkills: boolean
}

export interface UserSettingsPackImportReceipt {
  importedPrompts: number
  importedSkills: number
  skippedPrompts: number
  skippedSkills: number
  overwrittenPrompts: number
  overwrittenSkills: number
  renamedPrompts: number
  renamedSkills: number
  /** 覆盖前落下的备份目录（相对数据根），与既有 `prompts.bak-*` 惯例一致。 */
  backupDirectories: string[]
  /** 导入的提示词 key 会按 `project > global > builtin` 静默遮蔽内置模板，这里显式回报。 */
  shadowedPromptKeys: string[]
  warnings: string[]
}

const PROMPT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isValidPromptKey(key: string): boolean {
  return PROMPT_KEY_PATTERN.test(key) && key !== '.' && key !== '..'
}

function isWritingLanguage(value: string): value is WritingLanguage {
  return (WRITING_LANGUAGES as readonly string[]).includes(value)
}

/** 生成提示词在用户级 `prompts/` 下的文件名（不含扩展名之外的部分）。 */
export function promptFileNameOf(key: string, writingLanguage: WritingLanguage | null): string {
  return writingLanguage ? `${key}.${writingLanguage}.json` : `${key}.json`
}

export interface ParsedPromptFileName {
  key: string
  writingLanguage: WritingLanguage | null
}

/** 严格解析包内/目录内的提示词文件名；非法返回 null（不做任何宽松猜测）。 */
export function parsePromptFileName(fileName: string): ParsedPromptFileName | null {
  if (!fileName.endsWith('.json') || fileName.length > 200) return null
  const stem = fileName.slice(0, -'.json'.length)
  const separator = stem.lastIndexOf('.')
  if (separator > 0) {
    const candidate = stem.slice(separator + 1)
    if (isWritingLanguage(candidate)) {
      const key = stem.slice(0, separator)
      return isValidPromptKey(key) ? { key, writingLanguage: candidate } : null
    }
  }
  return isValidPromptKey(stem) ? { key: stem, writingLanguage: null } : null
}

const WRITING_SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isValidWritingSkillName(name: string): boolean {
  return WRITING_SKILL_NAME_PATTERN.test(name) && name !== '.' && name !== '..'
}
