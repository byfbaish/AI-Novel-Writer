import type { ProjectSessionContext } from '../shared/ipc-channels'
import { resolveWritingLanguage, type WritingLanguage } from '../shared/writing-language'
import { getActiveProjectSessionContext } from '../shared/project-session-context'
import { PromptCatalog, ipcPromptPersistence } from './prompt-catalog'
import { BUILTIN_PROMPTS, getBuiltinPromptTemplate, type PromptTemplate } from './builtin-prompt-templates'
export * from './builtin-prompt-templates'

/** 提示词生命周期唯一所有者；工作流通过 async resolve 自动完成水合。 */
export const promptCatalog = new PromptCatalog(
  BUILTIN_PROMPTS,
  ipcPromptPersistence,
  getActiveProjectSessionContext,
)

/** 项目关闭、切换或新加载开始时立即失效，绝不沿用旧 lease 的覆盖。 */
export function clearProjectCustomPrompts(): void {
  promptCatalog.clearProject()
}

/**
 * 重新从磁盘读取全局覆盖，丢弃内存快照。
 *
 * 用于「改了要重启」的调优痛点：`ensureGlobalLoaded` 首次读入后
 * 就锁死不再重读，外部（IDE / 记事本 / 脚本换版本）改动的
 * `~/.vela/prompts/` 不会自动生效。UI 里保存本就走 `commit()` 即时生效；
 * 这里补的是外部文件改动的重载通道。返回当前生效的全局覆盖条数。
 */
export async function reloadGlobalCustomPrompts(): Promise<number> {
  return promptCatalog.reloadGlobal()
}

/** 重新从磁盘读取当前项目的提示词覆盖（与 reloadGlobalCustomPrompts 对应）。 */
export async function reloadProjectCustomPrompts(
  projectSession: ProjectSessionContext,
): Promise<boolean> {
  return promptCatalog.reloadProject(projectSession)
}

/** 加载全局自定义 Prompt 覆盖（从 ~/.vela/prompts/ 目录） */
export async function loadCustomPrompts(writingLanguage: WritingLanguage = 'zh-CN'): Promise<void> {
  await promptCatalog.list(undefined, writingLanguage)
}

/** 加载项目级自定义 Prompt 覆盖（从 {projectPath}/.vela/prompts/ 目录） */
export async function loadProjectCustomPrompts(
  projectSession: ProjectSessionContext,
  writingLanguage: WritingLanguage = 'zh-CN',
): Promise<boolean> {
  return promptCatalog.loadProject(projectSession, writingLanguage)
}

/** 根据 key 获取 Prompt 模板（三级优先级：当前 session 项目级 > 全局级 > 内置） */
export function getPromptTemplate(
  key: string,
  projectSession?: ProjectSessionContext,
  writingLanguage: WritingLanguage = 'zh-CN',
): PromptTemplate | undefined {
  const resolved = promptCatalog.peek(key, projectSession, resolveWritingLanguage(writingLanguage))
  if (!resolved || resolved.source === 'builtin') return getBuiltinPromptTemplate(key, writingLanguage)
  return resolved.template
}

/** 工作流读取入口：首次调用会自动等待全局与当前项目覆盖水合。 */
export async function resolvePromptTemplate(
  key: string,
  projectSession: ProjectSessionContext | undefined,
  writingLanguage: WritingLanguage,
): Promise<PromptTemplate | undefined> {
  const language = resolveWritingLanguage(writingLanguage)
  const resolved = await promptCatalog.resolve(key, projectSession, language)
  if (!resolved) return undefined
  return resolved.source === 'builtin'
    ? getBuiltinPromptTemplate(key, writingLanguage)
    : resolved.template
}

/** 获取指定模板当前生效的来源 */
export function getPromptSource(
  key: string,
  projectSession?: ProjectSessionContext,
  writingLanguage: WritingLanguage = 'zh-CN',
): 'builtin' | 'global' | 'project' {
  return promptCatalog.peek(key, projectSession, resolveWritingLanguage(writingLanguage))?.source ?? 'builtin'
}

/** 获取所有模板（合并自定义，保留三级覆盖优先级） */
export function getAllPromptTemplates(
  projectSession?: ProjectSessionContext,
  writingLanguage: WritingLanguage = 'zh-CN',
): PromptTemplate[] {
  return BUILTIN_PROMPTS.map((template) => (
    getPromptTemplate(template.key, projectSession, writingLanguage) ?? template
  ))
}

/** 保存全局自定义 Prompt 到 ~/.vela/prompts/ */
export async function saveCustomPrompt(template: PromptTemplate): Promise<boolean> {
  return promptCatalog.commit({ action: 'save', scope: 'global', template })
}

/** 保存项目级自定义 Prompt 到 {projectPath}/.vela/prompts/ */
export async function saveProjectCustomPrompt(
  projectSession: ProjectSessionContext,
  template: PromptTemplate,
): Promise<boolean> {
  return promptCatalog.commit({ action: 'save', scope: 'project', projectSession, template })
}

/** 删除全局自定义 Prompt（恢复为内置版本） */
export async function deleteCustomPrompt(
  key: string,
  writingLanguage: WritingLanguage = 'zh-CN',
): Promise<boolean> {
  return promptCatalog.commit({ action: 'delete', scope: 'global', key, writingLanguage })
}

/** 删除项目级自定义 Prompt（恢复为全局/内置版本） */
export async function deleteProjectCustomPrompt(
  projectSession: ProjectSessionContext,
  key: string,
  writingLanguage: WritingLanguage = 'zh-CN',
): Promise<boolean> {
  return promptCatalog.commit({ action: 'delete', scope: 'project', projectSession, key, writingLanguage })
}

export { appendRequiredPromptContext, renderPromptTaskGuidance, renderPrompt } from '../shared/render-prompt'
