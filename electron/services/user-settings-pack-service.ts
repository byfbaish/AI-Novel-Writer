import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

import { inspectWritingSkillMarkdown } from '../../src/shared/writing-skills'
import type {
  UserSettingsPackConflictReport,
  UserSettingsPackConflictStrategy,
  UserSettingsPackDiagnostic,
  UserSettingsPackImportReceipt,
  UserSettingsPackPromptEntry,
  UserSettingsPackSkillEntry,
  UserSettingsPackSummary,
} from '../../src/shared/user-settings-pack'
import {
  USER_SETTINGS_PACK_FORMAT_VERSION,
  isValidPromptKey,
  parsePromptFileName,
  promptFileNameOf,
} from '../../src/shared/user-settings-pack'
import { VELA_HOME } from '../utils/config-utils'
import {
  MAX_WRITING_SKILL_BYTES,
  WRITING_SKILL_FILE_NAME,
  ensureOwnedSkillTarget,
  isContainedPath,
  promptsDirectory,
  skillsDirectory,
  text,
} from './user-asset-paths'
import {
  USER_SETTINGS_PACK_LIMITS,
  fail,
  parseUserSettingsPackManifest,
  type UserSettingsPackManifest,
} from './user-settings-pack-format'
import {
  isPromptTemplate,
  listGlobalPromptFileNames,
  promptFilename,
  readGlobalPromptTemplates,
  writeGlobalPromptTemplate,
} from './user-prompt-store'

/**
 * 「创作资产包」的业务层：收集本地创作资产 → 组装 manifest；校验并落盘导入内容。
 *
 * 本层不直接拼任何来自包内的路径：所有落点都先经 `user-asset-paths` 的守卫重新推导。
 */

export interface CollectedCreativeAssets {
  manifest: UserSettingsPackManifest
  files: Array<{ path: string; bytes: Buffer }>
  diagnostics: UserSettingsPackDiagnostic[]
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * 冲突与写入都以**归一化后的**提示词文件名为准：无语言标记的历史文件在写入时会被
 * 归一化为 `zh-CN`（与 `prompt:save-global` 完全一致），因此冲突判定也必须按同一判据。
 */
function normalizedPromptFileName(fileName: string): string | null {
  const parsed = parsePromptFileName(fileName)
  if (!parsed) return null
  return promptFileNameOf(parsed.key, parsed.writingLanguage ?? 'zh-CN')
}

function readUserSkillsForExport(): {
  skills: Array<{ name: string; bytes: Buffer }>
  diagnostics: UserSettingsPackDiagnostic[]
} {
  const root = skillsDirectory()
  const skills: Array<{ name: string; bytes: Buffer }> = []
  const diagnostics: UserSettingsPackDiagnostic[] = []
  if (!fs.existsSync(root)) return { skills, diagnostics }
  const canonicalRoot = fs.realpathSync.native(root)
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(canonicalRoot, { withFileTypes: true })
  } catch (error) {
    diagnostics.push({ path: 'skills', error: error instanceof Error ? error.message : String(error) })
    return { skills, diagnostics }
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const relativePath = `skills/${entry.name}/${WRITING_SKILL_FILE_NAME}`
    try {
      const baseDir = fs.realpathSync.native(path.join(canonicalRoot, entry.name))
      if (!isContainedPath(canonicalRoot, baseDir)) continue
      const filePath = fs.realpathSync.native(path.join(baseDir, WRITING_SKILL_FILE_NAME))
      if (!isContainedPath(baseDir, filePath) || !fs.statSync(filePath).isFile()) continue
      const bytes = fs.readFileSync(filePath)
      if (bytes.length > MAX_WRITING_SKILL_BYTES) throw new Error('SKILL.md 超过 64 KiB')
      const inspection = inspectWritingSkillMarkdown(bytes.toString('utf8'))
      if (!inspection.compatible) {
        throw new Error(`不是自包含提示词：${inspection.reasons.join(', ')}`)
      }
      skills.push({ name: entry.name, bytes })
    } catch (error) {
      diagnostics.push({ path: relativePath, error: error instanceof Error ? error.message : String(error) })
    }
  }
  skills.sort((left, right) => compareText(left.name, right.name))
  return { skills, diagnostics }
}

export function collectCreativeAssetsPack(options: {
  appVersion: string | null
  createdAt?: string
}): CollectedCreativeAssets {
  const { templates, diagnostics: promptDiagnostics } = readGlobalPromptTemplates()
  const diagnostics: UserSettingsPackDiagnostic[] = promptDiagnostics.map(item => ({
    path: `prompts/${item.path}`,
    error: item.error,
  }))

  const files: Array<{ path: string; bytes: Buffer }> = []
  const promptFileNames: string[] = []
  for (const template of templates) {
    const fileName = `${promptFilename(template)}.json`
    try {
      const bytes = fs.readFileSync(path.join(promptsDirectory(), fileName))
      files.push({ path: `prompts/${fileName}`, bytes })
      promptFileNames.push(fileName)
    } catch (error) {
      diagnostics.push({ path: `prompts/${fileName}`, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const skillResult = readUserSkillsForExport()
  diagnostics.push(...skillResult.diagnostics)
  const skillNames: string[] = []
  for (const skill of skillResult.skills) {
    files.push({ path: `skills/${skill.name}/${WRITING_SKILL_FILE_NAME}`, bytes: skill.bytes })
    skillNames.push(skill.name)
  }

  const ordered = [...files].sort((left, right) => compareText(left.path, right.path))
  if (ordered.length === 0) fail('USER_PACK_EMPTY')
  if (promptFileNames.length > USER_SETTINGS_PACK_LIMITS.maxPrompts
    || skillNames.length > USER_SETTINGS_PACK_LIMITS.maxSkills
    || ordered.length > USER_SETTINGS_PACK_LIMITS.maxEntries) {
    fail('USER_PACK_LIMIT_EXCEEDED')
  }
  const entries = ordered.map(file => ({
    path: file.path,
    byteSize: file.bytes.length,
    sha256: sha256(file.bytes),
  }))
  const manifest = parseUserSettingsPackManifest({
    formatVersion: USER_SETTINGS_PACK_FORMAT_VERSION,
    kind: 'creative-assets',
    createdAt: options.createdAt ?? new Date().toISOString(),
    appVersion: options.appVersion,
    entryCount: entries.length,
    declaredUncompressedBytes: entries.reduce((sum, entry) => sum + entry.byteSize, 0),
    promptFileNames,
    skillNames,
    entries,
  })
  return { manifest, files: ordered, diagnostics }
}

function listLocalSkillNames(): string[] {
  const root = skillsDirectory()
  if (!fs.existsSync(root)) return []
  try {
    const canonicalRoot = fs.realpathSync.native(root)
    return fs.readdirSync(canonicalRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
      .map(entry => entry.name)
  } catch {
    return []
  }
}

export function summarizePack(manifest: UserSettingsPackManifest): UserSettingsPackSummary {
  const prompts: UserSettingsPackPromptEntry[] = []
  const skills: UserSettingsPackSkillEntry[] = []
  for (const entry of manifest.entries) {
    if (entry.path.startsWith('prompts/')) {
      const fileName = entry.path.slice('prompts/'.length)
      const parsed = parsePromptFileName(fileName)
      if (!parsed) continue
      prompts.push({ fileName, key: parsed.key, writingLanguage: parsed.writingLanguage, byteSize: entry.byteSize })
    } else {
      const name = entry.path.split('/')[1]
      if (!name) continue
      skills.push({ name, byteSize: entry.byteSize })
    }
  }
  return {
    formatVersion: manifest.formatVersion,
    kind: manifest.kind,
    createdAt: manifest.createdAt,
    appVersion: manifest.appVersion,
    prompts,
    skills,
    entryCount: manifest.entryCount,
    totalBytes: manifest.declaredUncompressedBytes,
  }
}

export function findPackConflicts(manifest: UserSettingsPackManifest): UserSettingsPackConflictReport {
  const localPromptFiles = new Set(
    listGlobalPromptFileNames()
      .map(normalizedPromptFileName)
      .filter((name): name is string => name !== null)
      .map(name => name.toLowerCase()),
  )
  const localSkillNames = new Set(listLocalSkillNames().map(name => name.toLowerCase()))
  const prompts: string[] = []
  const skills: string[] = []
  for (const entry of manifest.entries) {
    if (entry.path.startsWith('prompts/')) {
      const fileName = entry.path.slice('prompts/'.length)
      const normalized = normalizedPromptFileName(fileName)
      if (normalized && localPromptFiles.has(normalized.toLowerCase())) prompts.push(fileName)
    } else {
      const name = entry.path.split('/')[1]
      if (name && localSkillNames.has(name.toLowerCase())) skills.push(name)
    }
  }
  return { prompts: prompts.sort(compareText), skills: skills.sort(compareText) }
}

function backupStamp(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

/** 覆盖前按既有的 `<name>.bak-<stamp>` 同目录惯例留档；备份目录不会被任何读取面扫描。 */
function backupInto(rootName: string, stamp: string, sourcePath: string, relativePath: string): string {
  const directoryName = `${rootName}.bak-${stamp}`
  const target = path.join(VELA_HOME, directoryName, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(sourcePath, target)
  return directoryName
}

function renameKey(baseKey: string, taken: Set<string>): string {
  let candidate = `${baseKey}-imported`
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    if (isValidPromptKey(candidate) && !taken.has(candidate.toLowerCase())) return candidate
    candidate = `${baseKey}-imported-${suffix}`
  }
  return fail('USER_PACK_LIMIT_EXCEEDED')
}

function renameSkill(baseName: string, taken: Set<string>): string {
  let candidate = `${baseName}-imported`
  for (let suffix = 2; suffix <= 999; suffix += 1) {
    if (!taken.has(candidate.toLowerCase())) return candidate
    candidate = `${baseName}-imported-${suffix}`
  }
  return fail('USER_PACK_LIMIT_EXCEEDED')
}

export interface ApplyUserSettingsPackInput {
  manifest: UserSettingsPackManifest
  files: Map<string, Buffer>
  conflictStrategy: UserSettingsPackConflictStrategy
  importPrompts: boolean
  importSkills: boolean
  /** @internal 仅供测试冻结备份目录名。 */
  now?: Date
}

export function applyUserSettingsPack(input: ApplyUserSettingsPackInput): UserSettingsPackImportReceipt {
  const receipt: UserSettingsPackImportReceipt = {
    importedPrompts: 0,
    importedSkills: 0,
    skippedPrompts: 0,
    skippedSkills: 0,
    overwrittenPrompts: 0,
    overwrittenSkills: 0,
    renamedPrompts: 0,
    renamedSkills: 0,
    backupDirectories: [],
    shadowedPromptKeys: [],
    warnings: [],
  }
  const stamp = backupStamp(input.now ?? new Date())
  const backupDirectories = new Set<string>()

  const localPromptFiles = new Set(
    listGlobalPromptFileNames()
      .map(normalizedPromptFileName)
      .filter((name): name is string => name !== null)
      .map(name => name.toLowerCase()),
  )
  const localPromptKeys = new Set<string>()
  for (const fileName of localPromptFiles) {
    const parsed = parsePromptFileName(fileName)
    if (parsed) localPromptKeys.add(parsed.key.toLowerCase())
  }
  const localSkillNames = new Set(listLocalSkillNames().map(name => name.toLowerCase()))

  for (const entry of input.manifest.entries) {
    const bytes = input.files.get(entry.path)
    if (!bytes) fail('USER_PACK_INVALID')

    if (entry.path.startsWith('prompts/')) {
      if (!input.importPrompts) {
        receipt.skippedPrompts += 1
        continue
      }
      const fileName = entry.path.slice('prompts/'.length)
      const parsedName = parsePromptFileName(fileName)
      const targetFileName = normalizedPromptFileName(fileName)
      if (!parsedName || !targetFileName) fail('USER_PACK_INVALID')
      let template: unknown
      try {
        template = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      } catch {
        fail('USER_PACK_CONTENT_REJECTED')
      }
      if (!isPromptTemplate(template) || template.key !== parsedName.key) fail('USER_PACK_CONTENT_REJECTED')
      const inheritedLanguage = template.writingLanguage ?? 'zh-CN'
      if (parsedName.writingLanguage !== null && parsedName.writingLanguage !== inheritedLanguage) {
        fail('USER_PACK_CONTENT_REJECTED')
      }

      let key = template.key
      if (localPromptFiles.has(targetFileName.toLowerCase())) {
        if (input.conflictStrategy === 'skip') {
          receipt.skippedPrompts += 1
          continue
        }
        if (input.conflictStrategy === 'overwrite') {
          const existing = path.join(promptsDirectory(), targetFileName)
          if (fs.existsSync(existing)) {
            backupDirectories.add(backupInto('prompts', stamp, existing, path.join('prompts', targetFileName)))
          }
          receipt.overwrittenPrompts += 1
        } else {
          key = renameKey(template.key, localPromptKeys)
          receipt.renamedPrompts += 1
          receipt.warnings.push(text(
            `重命名导入的提示词 ${key} 不会命中任何内置槽位，需手动改回原 key 才会生效`,
            `Renamed prompt ${key} matches no built-in slot and only takes effect after you rename its key back`,
          ))
        }
      }
      writeGlobalPromptTemplate({ ...template, key })
      const writtenName = promptFileNameOf(key, inheritedLanguage)
      localPromptFiles.add(writtenName.toLowerCase())
      localPromptKeys.add(key.toLowerCase())
      receipt.importedPrompts += 1
      receipt.shadowedPromptKeys.push(key)
      if (writtenName !== fileName) {
        receipt.warnings.push(text(
          `无语言标记的 ${fileName} 已按 ${writtenName} 归一化写入`,
          `Untagged ${fileName} was normalized to ${writtenName}`,
        ))
      }
      continue
    }

    if (!input.importSkills) {
      receipt.skippedSkills += 1
      continue
    }
    const entryName = entry.path.split('/')[1]
    if (!entryName) fail('USER_PACK_INVALID')
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (Buffer.byteLength(raw, 'utf8') > MAX_WRITING_SKILL_BYTES) fail('USER_PACK_CONTENT_REJECTED')
    const inspection = inspectWritingSkillMarkdown(raw)
    if (!inspection.compatible) fail('USER_PACK_CONTENT_REJECTED')
    if (inspection.metadata.name !== entryName) {
      receipt.warnings.push(text(
        `Skill ${entryName} 的 frontmatter 名称是 ${inspection.metadata.name}，已按包内目录名安装`,
        `Skill ${entryName} declares "${inspection.metadata.name}" in frontmatter but was installed under its packaged directory name`,
      ))
    }

    let installName = entryName
    if (localSkillNames.has(entryName.toLowerCase())) {
      if (input.conflictStrategy === 'skip') {
        receipt.skippedSkills += 1
        continue
      }
      if (input.conflictStrategy === 'overwrite') {
        const existing = path.join(skillsDirectory(), entryName, WRITING_SKILL_FILE_NAME)
        if (fs.existsSync(existing)) {
          backupDirectories.add(backupInto('skills', stamp, existing, path.join('skills', entryName, WRITING_SKILL_FILE_NAME)))
        }
        receipt.overwrittenSkills += 1
      } else {
        installName = renameSkill(entryName, localSkillNames)
        receipt.renamedSkills += 1
      }
    }
    const { filePath } = ensureOwnedSkillTarget(installName)
    fs.writeFileSync(filePath, raw, { encoding: 'utf8', mode: 0o600 })
    localSkillNames.add(installName.toLowerCase())
    receipt.importedSkills += 1
  }

  receipt.backupDirectories = [...backupDirectories].sort(compareText)
  return receipt
}
