import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import { WRITING_LANGUAGES, type WritingLanguage } from '../../src/shared/writing-language'
import { mainText } from '../i18n'
import { VELA_HOME } from '../utils/config-utils'
import { assertGlobalDataReady } from './app-data-locator'

/**
 * 用户级创作资产的**唯一**路径守卫。
 *
 * `prompt:save-global`、`skills:install-github` 与「创作资产包」导入都经由此处，
 * 以保证同一套边界判据只存在一份：包内路径永远只用于**选择**，实际落点永远是
 * `VELA_HOME` 下重新推导出的合法子路径。
 */

export function text(zhCNText: string, enUSText: string): string {
  return mainText(app.getLocale(), zhCNText, enUSText)
}

export function isContainedPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath)
  return !(
    relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  )
}

export const WRITING_SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
export const MAX_WRITING_SKILL_BYTES = 64 * 1024
export const WRITING_SKILL_FILE_NAME = 'SKILL.md'

export function promptsDirectory(): string {
  return path.join(VELA_HOME, 'prompts')
}

export function skillsDirectory(): string {
  return path.join(VELA_HOME, 'skills')
}

export function skinsDirectory(): string {
  return path.join(VELA_HOME, 'skins')
}

function isWritingLanguage(value: string): value is WritingLanguage {
  return (WRITING_LANGUAGES as readonly string[]).includes(value)
}

export function promptKeyPath(key: string, writingLanguage?: WritingLanguage): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(key)
    || key === '.'
    || key === '..'
  ) {
    throw new Error(text('提示词标识无效', 'The prompt identifier is invalid'))
  }
  const directory = promptsDirectory()
  const suffix = writingLanguage ? `.${writingLanguage}` : ''
  const candidatePath = path.resolve(directory, `${key}${suffix}.json`)
  if (!isContainedPath(directory, candidatePath)) {
    throw new Error(text('提示词目标超出应用目录', 'The prompt target is outside the app directory'))
  }
  return candidatePath
}

export function writingSkillDirectory(name: string): string {
  if (!WRITING_SKILL_NAME.test(name) || name === '.' || name === '..') {
    throw new Error(text('写作 Skill 名称无效', 'The writing skill name is invalid'))
  }
  const root = skillsDirectory()
  const candidate = path.resolve(root, name)
  if (!isContainedPath(root, candidate)) {
    throw new Error(text('写作 Skill 目标超出应用目录', 'The writing skill target is outside the app directory'))
  }
  return candidate
}

export function ensureOwnedSkillsRoot(): string {
  assertGlobalDataReady()
  if (fs.existsSync(VELA_HOME)) {
    const homeInfo = fs.lstatSync(VELA_HOME)
    if (homeInfo.isSymbolicLink() || !homeInfo.isDirectory()) {
      throw new Error(text('应用数据目录不是受信任的本地目录', 'The app data root is not a trusted local directory'))
    }
  } else {
    fs.mkdirSync(VELA_HOME, { recursive: true })
  }
  const canonicalVelaHome = fs.realpathSync.native(VELA_HOME)
  const root = skillsDirectory()
  if (fs.existsSync(root)) {
    const rootInfo = fs.lstatSync(root)
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
      throw new Error(text('用户 Skill 目录不是受信任的本地目录', 'The user skill root is not a trusted local directory'))
    }
  } else {
    fs.mkdirSync(root)
  }
  const canonicalRoot = fs.realpathSync.native(root)
  if (!isContainedPath(canonicalVelaHome, canonicalRoot)) {
    throw new Error(text('用户 Skill 目录超出应用目录', 'The user skill root is outside the app directory'))
  }
  return canonicalRoot
}

export function ensureOwnedSkillTarget(name: string): { directory: string; filePath: string } {
  const canonicalRoot = ensureOwnedSkillsRoot()
  const requestedDirectory = writingSkillDirectory(name)
  if (fs.existsSync(requestedDirectory)) {
    const directoryInfo = fs.lstatSync(requestedDirectory)
    if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory()) {
      throw new Error(text('拒绝写入链接或非目录 Skill 目标', 'Refusing to write to a linked or non-directory skill target'))
    }
  } else {
    fs.mkdirSync(requestedDirectory)
  }
  const directory = fs.realpathSync.native(requestedDirectory)
  if (!isContainedPath(canonicalRoot, directory)) {
    throw new Error(text('写作 Skill 目标超出应用目录', 'The writing skill target is outside the app directory'))
  }
  const filePath = path.join(directory, WRITING_SKILL_FILE_NAME)
  if (fs.existsSync(filePath)) {
    const fileInfo = fs.lstatSync(filePath)
    if (fileInfo.isSymbolicLink() || !fileInfo.isFile()) {
      throw new Error(text('拒绝覆盖链接或非文件 SKILL.md', 'Refusing to overwrite a linked or non-file SKILL.md'))
    }
    const canonicalFile = fs.realpathSync.native(filePath)
    if (!isContainedPath(directory, canonicalFile)) {
      throw new Error(text('SKILL.md 超出 Skill 目录', 'SKILL.md is outside its skill directory'))
    }
  }
  return { directory, filePath }
}

export { isWritingLanguage }
