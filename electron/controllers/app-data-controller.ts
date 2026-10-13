import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { ipcMain } from 'electron'
import type { AppPromptTemplate } from '../../src/shared/ipc-channels'
import type { WritingLanguage } from '../../src/shared/writing-language'
import {
  inspectWritingSkillMarkdown,
  parseGitHubWritingSkillUrl,
  type InstalledWritingSkill,
  type RemoteWritingSkillInspection,
} from '../../src/shared/writing-skills'
import { assertGlobalDataReady } from '../services/app-data-locator'
import {
  MAX_WRITING_SKILL_BYTES,
  WRITING_SKILL_FILE_NAME,
  WRITING_SKILL_NAME,
  ensureOwnedSkillTarget,
  ensureOwnedSkillsRoot,
  isContainedPath,
  skillsDirectory,
  text,
  writingSkillDirectory,
} from '../services/user-asset-paths'
import {
  deleteGlobalPromptTemplate,
  readGlobalPromptTemplates,
  writeGlobalPromptTemplate,
} from '../services/user-prompt-store'

function githubRawUrl(owner: string, repo: string, ref: string, filePath: string): string {
  const segments = [owner, repo, ref, ...filePath.split('/')].map(encodeURIComponent)
  return `https://raw.githubusercontent.com/${segments.join('/')}`
}

async function fetchGitHubWritingSkill(sourceUrl: string): Promise<{
  raw: string
  inspection: RemoteWritingSkillInspection
}> {
  const location = parseGitHubWritingSkillUrl(sourceUrl)
  let ref = location.ref
  if (!ref) {
    const repositoryResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}`,
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AI-Novel-Writer' },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!repositoryResponse.ok) throw new Error(`GitHub repository lookup failed (${repositoryResponse.status})`)
    const repository = await repositoryResponse.json() as { default_branch?: unknown }
    if (typeof repository.default_branch !== 'string' || !WRITING_SKILL_NAME.test(repository.default_branch)) {
      throw new Error('GitHub returned an unsupported default branch name')
    }
    ref = repository.default_branch
  }

  const resolvedUrl = githubRawUrl(location.owner, location.repo, ref, location.path)
  const response = await fetch(resolvedUrl, {
    headers: { Accept: 'text/plain', 'User-Agent': 'AI-Novel-Writer' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`SKILL.md download failed (${response.status})`)
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_WRITING_SKILL_BYTES) throw new Error('SKILL.md is larger than 64 KiB')
  const raw = await response.text()
  if (Buffer.byteLength(raw, 'utf8') > MAX_WRITING_SKILL_BYTES) {
    throw new Error('SKILL.md is larger than 64 KiB')
  }
  const inspected = inspectWritingSkillMarkdown(raw)
  const contentSha256 = createHash('sha256').update(raw, 'utf8').digest('hex')
  const publicInspection = {
    metadata: inspected.metadata,
    compatible: inspected.compatible,
    reasons: inspected.reasons,
    suggestedStage: inspected.suggestedStage,
    utf8Bytes: inspected.utf8Bytes,
  }
  return {
    raw,
    inspection: {
      ...publicInspection,
      sourceUrl,
      resolvedUrl,
      contentSha256,
    },
  }
}

/**
 * 已准入全局 generation 的提示词和用户 Skill 只能由此固定根目录控制器访问；渲染层不接收
 * 任意 app-data 路径，也不借用外部文件授权。
 *
 * 路径守卫与提示词读写判据已抽到 `user-asset-paths` / `user-prompt-store`，
 * 与「创作资产包」导入共用同一份实现。
 */
export function registerAppDataController(): void {
  assertGlobalDataReady()
  const inspectedWritingSkills = new Map<string, Pick<RemoteWritingSkillInspection, 'contentSha256' | 'resolvedUrl'>>()
  ipcMain.handle('prompt:load-global', async () => readGlobalPromptTemplates())

  ipcMain.handle('prompt:save-global', async (_event, template: AppPromptTemplate) => {
    try {
      writeGlobalPromptTemplate(template)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('prompt:delete-global', async (_event, key: string, writingLanguage: WritingLanguage) => {
    try {
      deleteGlobalPromptTemplate(key, writingLanguage)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('skills:list-user', async () => {
    const directory = skillsDirectory()
    if (!fs.existsSync(directory)) return []

    const canonicalSkillsDirectory = ensureOwnedSkillsRoot()
    const skills: Array<{ name: string; content: string; baseDir: string; filePath: string }> = []
    for (const entry of fs.readdirSync(canonicalSkillsDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      try {
        const baseDir = fs.realpathSync.native(path.join(canonicalSkillsDirectory, entry.name))
        if (!isContainedPath(canonicalSkillsDirectory, baseDir)) continue
        const filePath = fs.realpathSync.native(path.join(baseDir, WRITING_SKILL_FILE_NAME))
        if (!isContainedPath(baseDir, filePath) || !fs.statSync(filePath).isFile()) continue
        skills.push({
          name: entry.name,
          content: fs.readFileSync(filePath, 'utf8'),
          baseDir,
          filePath,
        })
      } catch {
        // 单个用户 Skill 无效时不阻断其余 Skill。
      }
    }
    return skills
  })

  ipcMain.handle('skills:inspect-github', async (_event, sourceUrl: string) => {
    try {
      if (typeof sourceUrl !== 'string' || sourceUrl.length > 2_048) {
        throw new Error(text('GitHub 地址无效', 'The GitHub URL is invalid'))
      }
      const { inspection } = await fetchGitHubWritingSkill(sourceUrl)
      inspectedWritingSkills.set(sourceUrl, {
        contentSha256: inspection.contentSha256,
        resolvedUrl: inspection.resolvedUrl,
      })
      return { success: true, inspection }
    } catch (error) {
      if (typeof sourceUrl === 'string') inspectedWritingSkills.delete(sourceUrl)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('skills:install-github', async (_event, sourceUrl: string) => {
    try {
      if (typeof sourceUrl !== 'string' || sourceUrl.length > 2_048) {
        throw new Error(text('GitHub 地址无效', 'The GitHub URL is invalid'))
      }
      const confirmedInspection = inspectedWritingSkills.get(sourceUrl)
      if (!confirmedInspection) {
        throw new Error(text(
          '请先检查该 GitHub Writing Skill，再确认安装',
          'Inspect this GitHub Writing Skill before confirming installation',
        ))
      }
      inspectedWritingSkills.delete(sourceUrl)
      // Refetch after confirmation. Renderer-provided inspection data is never trusted as install input.
      const { raw, inspection } = await fetchGitHubWritingSkill(sourceUrl)
      if (
        inspection.contentSha256 !== confirmedInspection.contentSha256
        || inspection.resolvedUrl !== confirmedInspection.resolvedUrl
      ) {
        throw new Error(text(
          'Writing Skill 在检查后已发生变化，请重新检查',
          'The Writing Skill changed after inspection; inspect it again',
        ))
      }
      if (!inspection.compatible) {
        throw new Error(text(
          `该 Skill 不是自包含提示词：${inspection.reasons.join(', ')}`,
          `This is not a self-contained prompt skill: ${inspection.reasons.join(', ')}`,
        ))
      }
      const requestedDirectory = writingSkillDirectory(inspection.metadata.name)
      if (fs.existsSync(requestedDirectory)) {
        throw new Error(text(
          `同名 Writing Skill 已安装：${inspection.metadata.name}`,
          `A Writing Skill with this name is already installed: ${inspection.metadata.name}`,
        ))
      }
      const { filePath } = ensureOwnedSkillTarget(inspection.metadata.name)
      fs.writeFileSync(filePath, raw, { encoding: 'utf8', mode: 0o600 })
      const skill: InstalledWritingSkill = {
        name: inspection.metadata.name,
        source: 'user',
        version: inspection.metadata.version,
        language: inspection.metadata.language,
        compatible: true,
        utf8Bytes: inspection.utf8Bytes,
      }
      return { success: true, skill }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('skills:uninstall-user', async (_event, name: string) => {
    try {
      const directory = writingSkillDirectory(name)
      const root = skillsDirectory()
      if (!fs.existsSync(root)) return { success: true }
      const canonicalRoot = ensureOwnedSkillsRoot()
      if (!fs.existsSync(directory)) return { success: true }
      if (fs.lstatSync(directory).isSymbolicLink()) {
        throw new Error(text('拒绝删除符号链接 Skill', 'Refusing to delete a symlinked skill'))
      }
      const canonicalDirectory = fs.realpathSync.native(directory)
      if (!isContainedPath(canonicalRoot, canonicalDirectory)) {
        throw new Error(text('写作 Skill 目标超出应用目录', 'The writing skill target is outside the app directory'))
      }
      fs.rmSync(canonicalDirectory, { recursive: true, force: false })
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
