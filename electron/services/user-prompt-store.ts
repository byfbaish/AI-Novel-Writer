import fs from 'node:fs'
import path from 'node:path'

import type {
  AppPromptLoadReceipt,
  AppPromptTemplate,
  PromptLoadDiagnostic,
} from '../../src/shared/ipc-channels'
import type { WritingLanguage } from '../../src/shared/writing-language'
import { VELA_HOME, writeJsonFile } from '../utils/config-utils'
import { isContainedPath, promptKeyPath, promptsDirectory, text } from './user-asset-paths'

/**
 * 用户级提示词覆盖（`VELA_HOME/prompts/*.json`）的读写判据。
 *
 * `prompt:load-global` / `prompt:save-global` 与「创作资产包」导入共用这一份实现，
 * 避免"导入时宽松、保存时严格"造成两套可写入的形态。
 */

export function isPromptTemplate(value: unknown): value is AppPromptTemplate {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as AppPromptTemplate).key === 'string'
    && (
      (value as AppPromptTemplate).writingLanguage === undefined
      || (value as AppPromptTemplate).writingLanguage === 'zh-CN'
      || (value as AppPromptTemplate).writingLanguage === 'en-US'
    )
}

export function promptFilename(template: AppPromptTemplate): string {
  return `${template.key}${template.writingLanguage ? `.${template.writingLanguage}` : ''}`
}

export function promptKeyFromFilename(filename: string): string {
  return path.basename(filename, '.json').replace(/\.(?:zh-CN|en-US)$/u, '')
}

export function promptLanguageFromFilename(filename: string): WritingLanguage | undefined {
  const match = filename.match(/\.(zh-CN|en-US)\.json$/u)
  return match?.[1] as WritingLanguage | undefined
}

export function readGlobalPromptTemplates(): AppPromptLoadReceipt {
  const directory = promptsDirectory()
  if (!fs.existsSync(directory)) return { templates: [], diagnostics: [] }

  const templates: AppPromptTemplate[] = []
  const diagnostics: PromptLoadDiagnostic[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    return {
      templates: [],
      diagnostics: [{
        path: 'prompts',
        error: error instanceof Error ? error.message : String(error),
      }],
    }
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const candidatePath = path.join(directory, entry.name)
      const canonicalPath = fs.realpathSync.native(candidatePath)
      if (!isContainedPath(fs.realpathSync.native(directory), canonicalPath)) continue
      const parsed = JSON.parse(fs.readFileSync(canonicalPath, 'utf8')) as unknown
      if (!isPromptTemplate(parsed)) {
        throw new Error(text('提示词内容结构无效', 'The prompt content shape is invalid'))
      }
      const filenameKey = path.basename(entry.name, '.json')
      if (promptFilename(parsed) !== filenameKey) {
        throw new Error(text('提示词标识或语言与文件名不一致', 'The prompt identifier or language does not match its filename'))
      }
      templates.push(parsed)
    } catch (error) {
      diagnostics.push({
        key: promptKeyFromFilename(entry.name),
        ...(promptLanguageFromFilename(entry.name)
          ? { writingLanguage: promptLanguageFromFilename(entry.name) }
          : {}),
        path: entry.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { templates, diagnostics }
}

/** 写入用户级覆盖；中文写入成功后移除同 key 的无语言标记遗留文件（与既有行为一致）。 */
export function writeGlobalPromptTemplate(template: AppPromptTemplate): void {
  if (!isPromptTemplate(template)) {
    throw new Error(text('提示词内容无效', 'The prompt content is invalid'))
  }
  const writingLanguage = template.writingLanguage ?? 'zh-CN'
  writeJsonFile(promptKeyPath(template.key, writingLanguage), { ...template, writingLanguage })
  if (writingLanguage === 'zh-CN') {
    const legacyPath = promptKeyPath(template.key)
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath)
  }
}

export function deleteGlobalPromptTemplate(key: string, writingLanguage: WritingLanguage): void {
  const filePaths = [promptKeyPath(key, writingLanguage)]
  if (writingLanguage === 'zh-CN') filePaths.push(promptKeyPath(key))
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
}

/** 用户级提示词目录下的现存文件名集合（用于冲突判定）。 */
export function listGlobalPromptFileNames(): string[] {
  const directory = promptsDirectory()
  if (!fs.existsSync(directory)) return []
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => entry.name)
  } catch {
    return []
  }
}

export { VELA_HOME }
