import type { PromptTemplate } from '../prompt-templates'
import {
  ARCHITECTURE_PROMPT_KEYS,
  EDITABLE_PROMPT_KEYS,
  getBuiltinPromptTemplate,
} from '../builtin-prompt-templates'
import type { WritingLanguage } from '../../shared/writing-language'

/**
 * Prompt 片段追踪记录器（P1：片段层）。
 *
 * 背景：`BasePromptBuilder.build()` 会把 `content` + `taskGuidance` +
 * 内置 `systemSuffix` + `requiredContext` + 变量替换一路 `replaceAll` 合并成
 * 一个最终字符串。合并之后，**"这段来自 UI 设置 / 那段是代码硬编码的
 * systemSuffix / 那段是 NovelConfig 的 globalGuidance" 这些来源信息全部丢失**，
 * 无法从最终串反推。所以必须在 `build()` 内部、合并之前把原件抓出来逐块打标。
 *
 * 本模块是 P1 的最小可用形态：
 * - `recordFragments()` 由 `build()` 内部调用（side-channel，不改 `build()` 返回值）。
 * - 追写"最近一次 / 最近 N 次"快照，供 P2 与 IO 层对齐后落盘。
 * - 开关关闭时 `recordFragments` 首行即返回，零开销。
 *
 * P1 阶段用 `console.log` 输出结构化摘要，供人工核对来源标签是否正确；
 * 落盘、索引、correlation 是 P2/P3。
 */

/** 片段来源枚举（与设计稿 §3 对齐）。 */
export type PromptFragmentSourceKind =
  | 'builtin-content'
  | 'builtin-taskGuidance'
  | 'builtin-systemRole'
  | 'builtin-systemSuffix'
  | 'override-content'
  | 'override-taskGuidance'
  | 'override-systemRole'
  | 'required-context'
  | 'variable-value'

export interface PromptFragment {
  /** 组装顺序（从 1 起）。 */
  order: number
  sourceKind: PromptFragmentSourceKind
  /** 该片段归属的模板 key。 */
  promptKey: string
  /** 人读归属说明（如「出厂设定（模板正文）」）。 */
  label: string
  /** 能否在 UI 修改。 */
  editable: boolean
  /** 当前生效来源（模板级）；变量片段无此概念时为 undefined。 */
  resolvedFrom?: 'builtin' | 'global' | 'project'
  /** 原始文本（变量未替换）。 */
  rawText: string
  /** 该片段里出现、且被替换的变量 → 值。 */
  variables: Array<{ key: string; value: string }>
  /** 补充说明（硬编码、来源 UI 入口等）。 */
  note?: string
}

export interface PromptTraceSnapshot {
  promptKey: string
  writingLanguage: WritingLanguage
  /** 组装后的最终字符串（供与 IO 层对账，P2 用）。 */
  built: string
  fragments: PromptFragment[]
  /** 捕获时刻（毫秒时间戳）。 */
  capturedAt: number
  /**
   * 调用方注入的关联句柄（如 `mainGenerationRunHandle` 的字符串形式）。
   * P1 阶段通常为空；P2 由命令作用域注入。
   */
  runHandle?: string
}

export interface PromptTraceSink {
  enabled: () => boolean
  runHandle: () => string | undefined
  /**
   * 解析模板当前生效来源。由装配方注入（渲染层读 `promptCatalog.peek().source`），
   * 避免 `prompt-builder` 反向依赖 catalog 造成循环。
   */
  resolveSource?: (key: string) => PromptResolvedFrom
  /** 当前作用域是否带有项目会话（决定能否定位落盘目录）。仅用于诊断提示。 */
  hasProjectSession?: () => boolean
}

/** 依赖注入的默认探测：渲染层读 debug-store，其余环境默认关闭。 */
let traceSink: PromptTraceSink = {
  enabled: () => false,
  runHandle: () => undefined,
}

/**
 * 装配追踪开关的来源。渲染层启动时注入一次（读 `debug-store`）；
 * 测试可注入内存实现。未注入时默认关闭。
 */
export function configurePromptTrace(sink: PromptTraceSink): void {
  traceSink = sink
}

const MAX_SNAPSHOTS = 32
const snapshots: PromptTraceSnapshot[] = []

/** 是否开启追踪（供 `build()` 快速短路）。 */
export function isPromptTraceEnabled(): boolean {
  try {
    return traceSink.enabled() === true
  } catch {
    return false
  }
}

/** 提取模板正文里出现的 `{{var}}` 名（用于标注变量出口，不关心是否留空）。 */
function extractVariableNames(text: string): string[] {
  const names: string[] = []
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  return names
}

/** 模板级生效来源（`builtin` | `global` | `project`）。 */
export type PromptResolvedFrom = 'builtin' | 'global' | 'project'

export interface RecordFragmentsInput {
  template: PromptTemplate
  /** 调用方已解析出的生效来源；缺省时由 sink 的 `resolveSource` 补。 */
  resolvedFrom?: PromptResolvedFrom
  variables: Record<string, string>
  /** `build()` 最终返回的合并串。 */
  built: string
  writingLanguage: WritingLanguage
}

/**
 * 从一次 `build()` 的输入，归因出逐片段清单。
 *
 * 纯函数（除读取 `runHandle` 外无副作用），便于单测：给定模板 + 变量 + 生效来源，
 * 产出稳定排序的片段数组。
 */
export function deriveFragments(input: RecordFragmentsInput): PromptFragment[] {
  const { template, variables, writingLanguage } = input
  const resolvedFrom = input.resolvedFrom ?? safeResolveSource(template.key)
  const builtin = getBuiltinPromptTemplate(template.key, writingLanguage)
  const editable = EDITABLE_PROMPT_KEYS.includes(template.key)
  const fragments: PromptFragment[] = []
  let order = 0

  const collectVariables = (text: string): Array<{ key: string; value: string }> =>
    extractVariableNames(text).map((key) => ({ key, value: variables[key] ?? '' }))

  // ① 模板正文
  fragments.push({
    order: ++order,
    sourceKind: resolvedFrom === 'builtin' ? 'builtin-content' : 'override-content',
    promptKey: template.key,
    label: '这个步骤的提示词模板正文',
    editable,
    resolvedFrom,
    rawText: template.content,
    variables: collectVariables(template.content),
    note: editable ? undefined : '系统模板，UI 不可编辑',
  })

  // ② 用户补充创作指导（taskGuidance）
  if (template.taskGuidance?.trim()) {
    fragments.push({
      order: ++order,
      sourceKind: resolvedFrom === 'builtin' ? 'builtin-taskGuidance' : 'override-taskGuidance',
      promptKey: template.key,
      label: '补充创作指导',
      editable,
      resolvedFrom,
      rawText: template.taskGuidance,
      variables: collectVariables(template.taskGuidance),
    })
  }

  // ③ systemRole（进 system message，不在 user content 里）
  const systemRole = template.systemRole?.trim()
  if (systemRole) {
    fragments.push({
      order: ++order,
      sourceKind: resolvedFrom === 'builtin' ? 'builtin-systemRole' : 'override-systemRole',
      promptKey: template.key,
      label: '创作角色定位（system）',
      editable,
      resolvedFrom,
      rawText: systemRole,
      variables: collectVariables(systemRole),
    })
  }

  // ④ 内置 systemSuffix（代码硬编码，override 无效 → 恒 editable:false）
  const suffix = builtin?.systemSuffix
  if (suffix) {
    fragments.push({
      order: ++order,
      sourceKind: 'builtin-systemSuffix',
      promptKey: template.key,
      label: '输出格式与判定标准（自动追加）',
      editable: false,
      resolvedFrom: 'builtin',
      rawText: suffix,
      variables: collectVariables(suffix),
      note: '硬编码于内置模板，UI 无法覆盖',
    })
  }

  // ⑤ requiredContext（内置模板声明、自定义正文若漏引用则自动补回 → 恒 editable:false）
  const requiredKeys: readonly string[] = builtin?.requiredContextVariables ?? []
  if (requiredKeys.length > 0) {
    const referenced = [template.content, template.taskGuidance ?? '', suffix ?? '']
    const appended = requiredKeys.filter((key: string) => !referenced.some((src) => src.includes(`{{${key}}}`)))
    if (appended.length > 0) {
      fragments.push({
        order: ++order,
        sourceKind: 'required-context',
        promptKey: template.key,
        label: '系统补回的权威项目设定',
        editable: false,
        resolvedFrom: 'builtin',
        rawText: appended.map((key: string) => `{{${key}}}`).join('\n'),
        variables: appended.map((key: string) => ({ key, value: variables[key] ?? '' })),
        note: '自定义正文未引用、但必须遵循的权威上下文',
      })
    }
  }

  return fragments
}

/**
 * `build()` 内部调用：捕获一次快照。
 *
 * 首行 `isPromptTraceEnabled()` 短路——关闭时零开销，符合设计稿"关时 no-op"。
 * 返回本次快照（便于调用方/测试直接拿到）；未开启时返回 null。
 */
export function recordFragments(input: RecordFragmentsInput): PromptTraceSnapshot | null {
  if (!isPromptTraceEnabled()) return null
  const fragments = deriveFragments(input)
  const snapshot: PromptTraceSnapshot = {
    promptKey: input.template.key,
    writingLanguage: input.writingLanguage,
    built: input.built,
    fragments,
    capturedAt: Date.now(),
  }
  const handle = safeRunHandle()
  if (handle) snapshot.runHandle = handle

  logScopeDiagnostic(input.template.key, handle, safeHasProjectSession())

  snapshots.push(snapshot)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS)

  logSnapshot(snapshot)
  notifySnapshotCaptured()
  return snapshot
}

/**
 * 诊断：把「捕获时的作用域上下文」打出来一次。
 *
 * 落盘需要 `scope.projectSession` 才能定位项目根；若提示词装配发生在
 * `executeWithGenerationRuntime` 作用域**之外**（例如运行前预构建），
 * 句柄与会话都会缺失，落盘会被安全跳过——而过去这种情况完全静默。
 * 这里把「有/无作用域」明确写进控制台，避免再去猜。
 */
let scopeDiagnosticLogged = false

function logScopeDiagnostic(promptKey: string, runHandle: string | undefined, hasProjectSession: boolean): void {
  if (scopeDiagnosticLogged) return
  scopeDiagnosticLogged = true
  if (runHandle && hasProjectSession) return
  console.warn(
    '[PromptTrace] 提示词装配发生在生成作用域之外，本次无法定位落盘目录。',
    `promptKey=${promptKey}`,
    `runHandle=${runHandle ?? '（无）'}`,
    `projectSession=${hasProjectSession ? '有' : '（无）'}`,
    '—— 需要把提示词构建放进 executeWithGenerationRuntime 内。',
  )
}

/** 仅测试用：允许重新打印一次诊断。 */
export function resetScopeDiagnostic(): void {
  scopeDiagnosticLogged = false
}

/**
 * 快照捕获钩子。默认空实现（保持本模块零依赖、可被主进程/单测单独引用）；
 * 渲染层启动时通过 `setSnapshotSink` 接到落盘器。
 */
let snapshotSink: (() => void) | null = null

/** 注入快照捕获回调（渲染层落盘用）。 */
export function setSnapshotSink(sink: (() => void) | null): void {
  snapshotSink = sink
}

function notifySnapshotCaptured(): void {
  try {
    snapshotSink?.()
  } catch { /* 落盘调度失败不得影响提示词装配。 */ }
}

function safeRunHandle(): string | undefined {
  try {
    const handle = traceSink.runHandle()
    return handle && handle.trim() ? handle : undefined
  } catch {
    return undefined
  }
}

function safeResolveSource(key: string): PromptResolvedFrom {
  try {
    return traceSink.resolveSource?.(key) ?? 'builtin'
  } catch {
    return 'builtin'
  }
}

function safeHasProjectSession(): boolean {
  try {
    return traceSink.hasProjectSession?.() === true
  } catch {
    return false
  }
}

/** 取最近一次快照（P2 用于与 IO 层配对）。 */
export function lastPromptTraceSnapshot(): PromptTraceSnapshot | null {
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
}

/** 取全部保留的快照（调试用）。 */
export function promptTraceSnapshots(): readonly PromptTraceSnapshot[] {
  return snapshots
}

/** 清空快照（测试/会话切换用）。 */
export function resetPromptTrace(): void {
  snapshots.length = 0
}

/** 架构链标记（供日志/将来落盘展示）。 */
export function promptIsArchitectureChain(key: string): boolean {
  return ARCHITECTURE_PROMPT_KEYS.includes(key)
}

/**
 * P1 阶段的人工核对输出：一屏看清"这次 prompt 由哪几块拼成、每块能不能改"。
 * P3 起改为写 `input.prompt.md`，此函数退化为 console 兜底。
 */
function logSnapshot(snapshot: PromptTraceSnapshot): void {
  const editableCount = snapshot.fragments.filter((f) => f.editable).length
  const header = `[PromptTrace] ${snapshot.promptKey} · 由 ${snapshot.fragments.length} 块拼成 · 可改 ${editableCount} 块`
  const rows = snapshot.fragments.map((f) => ({
    order: f.order,
    sourceKind: f.sourceKind,
    label: f.label,
    editable: f.editable,
    resolvedFrom: f.resolvedFrom ?? '-',
    bytes: f.rawText.length,
    variables: f.variables.map((v) => v.key).join(',') || '-',
  }))
  // console.table 是浏览器/Node 都支持的结构化核对视图。
  // eslint-disable-next-line no-console
  console.groupCollapsed(header)
  // eslint-disable-next-line no-console
  console.table(rows)
  // eslint-disable-next-line no-console
  console.groupEnd()
}
