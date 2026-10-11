import type { PromptTemplate } from './builtin-prompt-templates'

/**
 * 内置模板摘要（W1）。
 *
 * 背景：`promptCatalog.resolve` 的优先级是 `project > global > builtin`，
 * 而用户在设置界面「保存自定义」时，落盘的是 `{ ...内置模板, systemRole, taskGuidance }`
 * —— 也就是**把当时的内置正文整份冻结进覆盖文件**。于是从旧版本升级上来的覆盖
 * 会长期沿用旧版内置内容，新版内置模板的任何改进都被静默屏蔽。
 *
 * 做法：保存覆盖时把**当时内置模板自身**的摘要写进 `builtinRevision`；
 * 加载时与当前内置模板的摘要比对，不一致即提示「有新版内置模板可用」。
 *
 * ★ 摘要取的是**内置模板自身**，不是保存下来的覆盖 —— 因此作者对自己可编辑字段
 *   （systemRole / taskGuidance）所做的修改不会改变摘要，不会造成假警报。
 * ★ 只提示、不自动改：无法区分「作者有意定制」与「旧版原样副本」，
 *   静默自动合并会毁掉真实定制（见 `prompt-assembly-backlog.md` W1）。
 */
type RevisionInput = Pick<
  PromptTemplate,
  'name' | 'description' | 'content' | 'systemRole' | 'taskGuidance' | 'variables' | 'requiredContextVariables'
>

/** 不参与摘要的字段：身份、语言标记，以及始终取内置版本的输出合同。 */
type RevisionExcluded = 'key' | 'writingLanguage' | 'systemSuffix' | 'builtinRevision'

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_ALTERNATE_SEED = 0x01000193
const FNV_PRIME = 16777619

function hash32(value: string, seed: number): number {
  let hash = seed
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

function sortedEntries(record: Record<string, string> | undefined): [string, string][] {
  return Object.entries(record ?? {})
    .map(([name, description]) => [name, description] as [string, string])
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
}

/**
 * 内容摘要：只覆盖用户**不能编辑**的部分（正文、说明、变量、内置角色定位与指导）。
 * `systemSuffix`（内置输出合同）不参与：渲染时始终取内置版本，覆盖改了也不生效，
 * 因此它的变化不需要提醒。
 */
export function promptBuiltinRevision(template: RevisionInput): string {
  const canonical = JSON.stringify([
    template.name ?? '',
    template.description ?? '',
    template.content ?? '',
    template.systemRole ?? '',
    template.taskGuidance ?? '',
    sortedEntries(template.variables),
    [...(template.requiredContextVariables ?? [])],
  ])
  return `${hash32(canonical, FNV_OFFSET_BASIS).toString(16).padStart(8, '0')}${hash32(canonical, FNV_ALTERNATE_SEED).toString(16).padStart(8, '0')}`
}

/**
 * 当前生效的覆盖是否落后于内置模板。
 * 覆盖没有摘要（旧版本写入的文件）时同样视为落后 —— 但只提示，不自动改。
 */
export function isBuiltinOverrideStale(
  override: Pick<PromptTemplate, 'builtinRevision'>,
  builtin: RevisionInput,
): boolean {
  return override.builtinRevision !== promptBuiltinRevision(builtin)
}

/** 供调试与文档引用的排除集合；类型层面由 `RevisionInput` 保证。 */
export const PROMPT_REVISION_EXCLUDED_FIELDS: readonly RevisionExcluded[] = Object.freeze([
  'key',
  'writingLanguage',
  'systemSuffix',
  'builtinRevision',
])
