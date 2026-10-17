/**
 * Prompt 追踪落盘（P2）。
 *
 * 把一次生成的「输入面」（片段清单 + 组装后文本）与「输出面」（最终 messages + 模型输出）
 * 按 `runHandle` 归并，写成人类可读的 markdown + 机器可读的 json，落在项目根内固定目录：
 *
 *     <项目根>/debug/prompt-trace/<时间戳>-<业务标签>-<章节段>-<runId 前 8 位>.md
 *     <项目根>/debug/prompt-trace/<时间戳>-<业务标签>-<章节段>-<runId 前 8 位>.json
 *
 * 文件名为什么不用 `operation`：`operation` 是**执行器类型**（`text` / `structured` /
 * `chapter-draft`），大纲与蓝图都落成 `text`/`structured`，人无法从文件名判断
 * "这一步在业务上是干什么的"。故改用模板 key 还原的业务标签（`大纲` / `蓝图` / …），
 * 并附章节定位段（`ch6-7`），使同类文件可按时间戳排序、按标签分类。
 *
 * 为什么放在项目内：`fs:write-file` 强制目标位于项目根内（`assertProjectFilePath`），
 * 这是既有的沙箱边界。放到项目外需要新增一条专用受控 IPC，收益不足以抵消新增攻击面。
 *
 * 设计约束（对齐设计稿 §10）：
 * - 追踪关闭时零开销（调用方首行短路）。
 * - 落盘失败绝不阻断生成：全部 try/catch 吞掉，只在 console 留一行提示。
 * - 同一次 run 的多次 `build()`（如分批生成）归并到同一份文件，追加而非覆盖。
 */

import { ipc } from '../ipc-client'
import { currentTraceScope, type TraceScope } from './trace-scope'
import { promptTraceSnapshots, lastPromptTraceSnapshot } from './prompt-trace'
import { buildTraceMarkdown, type PromptTraceMarkdownPayload } from './prompt-trace-markdown'
import { useDebugStore } from '../../stores/debug-store'
import { markMemory } from '../debug/memory-probe'

/** 项目内落盘目录（相对项目根，用 `/` 分隔，由调用方与项目根拼接）。 */
export const PROMPT_TRACE_DIR_SEGMENTS = ['debug', 'prompt-trace'] as const

/** 追踪目录的相对路径（用于 UI 展示）。 */
export function promptTraceRelativeDir(): string {
  return PROMPT_TRACE_DIR_SEGMENTS.join('/')
}

/** 落盘结构 = 渲染模块的输入结构（渲染规则见 `prompt-trace-markdown.ts`）。 */
type TraceFilePayload = PromptTraceMarkdownPayload

/** 本次作用域的开始时刻（缺失时退化为 0，即不过滤——宁多写不丢）。 */
function scopeStartedAt(scope: TraceScope): number {
  return scope.startedAt ?? 0
}

/** 把项目根与相对段拼成平台路径。不引入 node:path（渲染层无此依赖）。 */
function joinProjectPath(root: string, ...segments: string[]): string {
  const separator = root.includes('\\') ? '\\' : '/'
  const trimmed = root.replace(/[\\/]+$/, '')
  return [trimmed, ...segments].join(separator)
}

/** 文件名安全化：去掉路径分隔符与 Windows 保留字符。 */
function sanitizeFileSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'trace'
}

/** 时间戳 → 可排序且文件名安全的 `YYYYMMDD-HHmmss-SSS`。 */
function compactTimestamp(at: number): string {
  const date = new Date(at)
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  return [
    date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate()),
    '-',
    pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds()),
    '-', pad(date.getMilliseconds(), 3),
  ].join('')
}

/**
 * 模板 key → 文件名业务标签。
 *
 * 为什么要这张表：落盘层的 `operation` 是执行器类型（`text`/`structured`/`chapter-draft`），
 * 不含业务语义——实测 `synopsis`（大纲）与 `chapter_blueprint_chunk`（蓝图）**都**落成
 * `text`/`structured`，人从文件名分不出类别，也看不出同类之间的先后。
 * 模板 key 是装配期就确定的业务标识，用它还原标签即可。
 */
const TRACE_FILE_LABELS: Readonly<Record<string, string>> = {
  premise: '前提',
  character_dynamics: '角色图谱',
  character_background_synthesis: '角色补全',
  extract_initial_characters: '角色提取',
  world_building: '世界观',
  plot_structure: '弧光',
  synopsis: '大纲',
  infer_single_chapter_blueprint: '单章蓝图',
  chapter_blueprint: '蓝图',
  chapter_blueprint_chunk: '蓝图',
  first_chapter_draft: '正文',
  next_chapter_draft: '正文',
  refine_chapter: '精修',
  refine_from_review: '审稿精修',
  consistency_check: '审稿',
  edit_selected_text: '改稿',
  analyze_writing_style: '文风',
  generate_chapter_notes: '章注',
  generate_global_config: '全局配置',
  generate_novel_config_field: '配置字段',
  infer_novel_config: '小说配置',
  infer_novel_config_with_vectors: '小说配置',
  update_character_cards: '角色卡',
  assistant_writing_identity: '助手人设',
  planning_material_character_extraction: '素材角色提取',
}

/** 业务标签：取第一个可识别的 `promptKey`；都不认识时回退 `operation`（宁粗不丢）。 */
function traceSubjectLabel(payload: TraceFilePayload): string {
  for (const snapshot of payload.snapshots) {
    const label = TRACE_FILE_LABELS[snapshot.promptKey]
    if (label) return label
  }
  return payload.operation ?? 'unknown'
}

/** 章节号序列 → 紧凑段（`ch6-7` / `ch1`）。 */
function formatChapterSegment(chapters: ReadonlyArray<number>): string {
  const sorted = [...new Set(chapters)].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return first === last ? `ch${first}` : `ch${first}-${last}`
}

/**
 * 章节定位段（如 `ch6-7`）。
 *
 * 四级取证，命中即止：
 * ⓪ `chapterRange` —— 命令在装配前**显式声明**的本批范围（最可靠）。大纲链只能靠它：
 *    它既没有 `chapterNumber`，模板变量里也没有 `n`/`m`，章节号原本只存在于
 *    `ioCalls[].purpose` 里——而 `purpose` 要等 IO 回传，**首次落盘时还没有**，
 *    名字一旦钉住就永久缺段（作者反馈"分不清同类之间的先后"正是因为这一段）。
 * ① `chapterNumber` —— 正文/定稿链会带，实测大纲/蓝图作用域**为空**；
 * ② `ioCalls[].purpose` —— 大纲逐章生成时形如 `plot-outline:chapter:6`；
 * ③ 模板变量 `n`/`m` —— 蓝图分块形如 `n=6, m=7`（未声明范围时唯一来源）。
 * 都取不到时返回 null（该段整体省略，文件名仍然可用）。
 */
function traceChapterSegment(payload: TraceFilePayload): string | null {
  if (payload.chapterRange) return formatChapterSegment([payload.chapterRange.from, payload.chapterRange.to])
  if (typeof payload.chapterNumber === 'number') return formatChapterSegment([payload.chapterNumber])
  const fromPurpose: number[] = []
  for (const call of payload.ioCalls ?? []) {
    for (const match of (call.purpose ?? '').matchAll(/chapter[:=](\d+)/gi)) {
      fromPurpose.push(Number(match[1]))
    }
  }
  if (fromPurpose.length > 0) return formatChapterSegment(fromPurpose)
  const fromVariables: number[] = []
  for (const snapshot of payload.snapshots) {
    for (const fragment of snapshot.fragments) {
      for (const variable of fragment.variables) {
        if (variable.key !== 'n' && variable.key !== 'm') continue
        const value = Number(variable.value)
        // `n`/`m` 也用作"第几块/共几块"，故仅接受正整数，且交给格式化去重排序。
        if (Number.isInteger(value) && value > 0) fromVariables.push(value)
      }
    }
  }
  return fromVariables.length > 0 ? formatChapterSegment(fromVariables) : null
}

/** 记录一次真实请求的 IO 面（由 harness / main transport 观察点调用）。 */
export interface TraceIoRecord {
  /** `task.purpose`：一轮内区分多次请求（短纲 / 正文 / 续写 / 压缩…）。 */
  purpose?: string
  messages: Array<{ role: string; content: string }>
  output: string
  finishReason?: string
  /** 记录时刻，用于按序展示与排查时序。 */
  at: number
}

/** 调用方传入的形状：`at` 由落盘器统一打点，调用方无需关心。 */
export type TraceIoInput = Omit<TraceIoRecord, 'at'>

/** 一次落盘尝试的结果，供开发者面板回显——避免「静默失败」只能靠翻控制台。 */
export interface TraceFlushOutcome {
  /** `ok` 写了文件；`skipped` 是条件不满足（正常）；`failed` 是真出错。 */
  status: 'ok' | 'skipped' | 'failed'
  at: number
  /** 已写文件的项目内相对路径（`status==='ok'` 时）。 */
  files?: string[]
  /** 跳过/失败的可读原因。 */
  reason?: string
  operation?: string
  runHandle?: string
}

let lastOutcome: TraceFlushOutcome | null = null
const outcomeListeners = new Set<(outcome: TraceFlushOutcome) => void>()

/** 最近一次落盘结果（未落过盘时为 null）。 */
export function lastTraceFlushOutcome(): TraceFlushOutcome | null {
  return lastOutcome
}

/** 订阅落盘结果变化，返回取消订阅函数。 */
export function subscribeTraceFlushOutcome(listener: (outcome: TraceFlushOutcome) => void): () => void {
  outcomeListeners.add(listener)
  return () => { outcomeListeners.delete(listener) }
}

function reportOutcome(scope: TraceScope, outcome: Omit<TraceFlushOutcome, 'at' | 'operation' | 'runHandle'>): void {
  const full: TraceFlushOutcome = {
    ...outcome,
    at: Date.now(),
    ...(scope.operation ? { operation: scope.operation } : {}),
    ...(scope.runHandle ? { runHandle: scope.runHandle } : {}),
  }
  lastOutcome = full
  for (const listener of outcomeListeners) {
    try { listener(full) } catch { /* 订阅方出错不影响落盘。 */ }
  }
}

/**
 * 待落盘的 IO 面：**按作用域累积的多次调用**。
 *
 * 一轮生成常常发多次请求（正文 = 短纲 → 正文 → 续写），旧实现用单值记录，
 * 后一次直接覆盖前一次 —— 人看到的"模型输出"只有最后一次，中间请求的提示词
 * 与产出全部丢失，无法评估。现在按序累积，全部落盘。
 */
const pendingIo = new Map<string, TraceIoRecord[]>()

/**
 * 作用域数量上限（防御性）。正常路径由作用域收尾显式清理（`releaseTraceScopeState`），
 * 这里只兜住"收尾信号没到"的异常路径（进程被杀、作用域泄漏），避免长会话按 runKey 累积。
 */
const MAX_PENDING_SCOPES = 32

function rememberPendingIo(runKey: string, record: TraceIoRecord): void {
  let records = pendingIo.get(runKey)
  if (!records) {
    records = []
    if (pendingIo.size >= MAX_PENDING_SCOPES) {
      const oldest = pendingIo.keys().next().value
      if (oldest !== undefined && oldest !== runKey) {
        pendingIo.delete(oldest)
        flushedWatermark.delete(oldest)
      }
    }
    pendingIo.set(runKey, records)
  }
  records.push(record)
}

let lastFlushWarning = ''

/**
 * 已落盘过的「作用域标识 → 内容水位」。
 *
 * 一次命令里落盘会被触发多次：① 片段捕获后的 30ms 短定时器（可能还没 IO）；
 * ② 命令退出作用域前的确定时序收尾（片段 + IO 都齐）；③ 一轮内多次 LLM 调用
 * 各自回报 IO（如正文的短纲 + 正文）。
 *
 * 水位 = `快照数 + IO 面签名`：内容变了就重写**同一份文件**（文件名按作用域稳定），
 * 完全没变则跳过，避免无意义的重复写。
 */
const flushedWatermark = new Map<string, string>()

/** 内容水位：任一分量变化即代表有新内容值得重写。 */
function watermarkOf(runKey: string, snapshotSignature: string): string {
  const records = pendingIo.get(runKey)
  const ioSignature = records && records.length > 0
    ? records.map((record, index) => [
      index,
      record.messages.length,
      contentFingerprint(record.messages.map(message => `${message.role}\u0000${message.content}`).join('\u0001')),
      contentFingerprint(record.output),
      record.finishReason ?? '',
    ].join(':')).join('|')
    : 'noio'
  return `${snapshotSignature}|${ioSignature}`
}

/**
 * 轻量内容指纹（FNV-1a）。
 *
 * 必须**基于内容本身**而非长度：一轮生成的两跳请求长度可能恰好相同
 * （如「第一跳：短纲」与「第二跳：正文」），只比长度会把真正的变化判成"没变"而丢弃。
 */
function contentFingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16)
}

/** 同一作用域内内容未变则不重复写。文件名按作用域稳定，故变化时是覆盖写而非新增文件。 */
function shouldWrite(key: string, watermark: string): boolean {
  return flushedWatermark.get(key) !== watermark
}

/**
 * 主进程-渲染层归并落盘。
 *
 * 之所以要"攒一下再写"：一次命令可能触发多次 `build()`（分批/多步），
 * 每步都写一份文件会碎片化。这里在微任务里合并同一作用域内的全部快照，一次成文。
 */
async function flushTraceFile(scope: TraceScope): Promise<void> {
  // 内存打点：落盘要对全部 messages 做 join + 指纹（读的是完整提示词），
  // 是渲染层少数会反复触碰大字符串的路径之一。
  markMemory('trace.flush', scope.operation ?? undefined)
  const session = scope.projectSession
  const store = useDebugStore.getState()
  if (!store.promptTraceEnabled) {
    reportOutcome(scope, { status: 'skipped', reason: '追踪已关闭' })
    return
  }
  if (!session) {
    // 渲染层拿不到项目会话 = 工作流未走项目作用域（如纯本地步骤），无从确定项目根。
    reportOutcome(scope, {
      status: 'skipped',
      reason: `当前作用域没有项目会话，无法确定项目根目录（operation=${scope.operation ?? '未知'}，runHandle=${scope.runHandle ?? '无'}）`,
    })
    return
  }

  const snapshots = promptTraceSnapshots()
  // 只落盘本次作用域内新捕获的快照：
  // ① 环形缓冲是全局的，含历史任务的快照，必须按时间水位过滤；
  // ② 同一作用域可能多次触发 flush（片段先到、IO 后到），后一次应包含前一次的片段。
  // 水位比较放宽 1s：同一毫秒内 push 作用域与捕获快照会让 capturedAt 与 startedAt 相等，
  // 而时钟回拨/粗粒度时间源可能让 capturedAt 略小——宁可多写也不丢证据。
  const since = scopeStartedAt(scope) - 1000
  const fresh = snapshots.filter(snapshot => snapshot.capturedAt >= since)
  const runKey = scope.runHandle ?? 'unscoped'
  if (fresh.length === 0 && !pendingIo.has(runKey)) {
    reportOutcome(scope, { status: 'skipped', reason: '本次任务没有捕获到提示词片段（可能未走提示词装配）' })
    return
  }

  // 同一作用域可能被触发多次（短定时器 + 作用域收尾 + 一轮内多次 LLM 调用）。
  // 内容没变就不重复写；变了则覆盖写同一份文件，也不让后一次的 skipped 覆盖掉 ok 回显。
  const snapshotSignature = fresh.map(snapshot => `${snapshot.promptKey}:${contentFingerprint(snapshot.built)}`).join(',')
  const watermark = watermarkOf(runKey, snapshotSignature)
  if (!shouldWrite(runKey, watermark)) return

  const ioCalls = pendingIo.get(runKey)
  const writtenAt = Date.now()
  const payload: TraceFilePayload = {
    ...(scope.runHandle ? { runHandle: scope.runHandle } : {}),
    ...(scope.operation ? { operation: scope.operation } : {}),
    ...(scope.chapterNumber !== undefined ? { chapterNumber: scope.chapterNumber } : {}),
    ...(scope.chapterRange ? { chapterRange: scope.chapterRange } : {}),
    writtenAt,
    snapshots: fresh.map(snapshot => ({
      promptKey: snapshot.promptKey,
      writingLanguage: snapshot.writingLanguage,
      capturedAt: snapshot.capturedAt,
      builtLength: snapshot.built.length,
      fragments: snapshot.fragments,
      built: snapshot.built,
      systemMessage: snapshot.systemMessage,
      ...(snapshot.projections && snapshot.projections.length > 0 ? { projections: snapshot.projections } : {}),
    })),
    ...(ioCalls && ioCalls.length > 0 ? { ioCalls } : {}),
  }

  // 文件名按**作用域**稳定（而非写入时刻）：一轮生成只对应一份文件，
  // IO 后到、多次 LLM 调用等增量都覆盖写同一个文件，不会留下一堆半成品。
  // 命名 = `<时间戳>-<业务标签>-<章节段>-<runId 前 8 位>`（章节段与 runId 缺失时省略）。
  // runId 截到 8 位：此处只用于"同秒同标签"时区分，完整值仍保留在 json 的 runHandle。
  //
  // ⚠️ 名字必须在**首次落盘时钉住**（2026-10-13 修复回归）：
  // 章节段是从"当前已收到的 ioCalls"现算的，而一次生成会多次落盘、ioCalls 逐次增多
  // （大纲逐章生成：先 0 次 → ch11 → ch11-12）。若每次重算，同一作用域会写出
  // `…-大纲-<runId>` / `…-大纲-ch11-<runId>` / `…-大纲-ch11-12-<runId>` **三份文件**，
  // 每份都是不完整快照（旧的不会被清掉）。钉住后只覆盖写同一份。
  //
  // ⚠️ 钉住带来一个代价：首次落盘时若还取不到章节号，名字里就永久没有该段。
  // 大纲链正是这种情况（章节号只在后到的 `purpose` 里）→ 现在由命令在装配前
  // `declareTraceScopeChapterRange(from, to)` 显式声明，段落不再丢。
  const startedAt = scopeStartedAt(scope)
  const stamp = compactTimestamp(startedAt > 0 ? startedAt : writtenAt)
  const fileName = scope.traceFileName ?? [
    stamp,
    sanitizeFileSegment(traceSubjectLabel(payload)),
    traceChapterSegment(payload),
    sanitizeFileSegment((scope.runHandle?.split('/').pop() ?? 'run').slice(0, 8)),
  ].filter((part): part is string => !!part).join('-')
  scope.traceFileName = fileName
  const dir = joinProjectPath(session.projectPath, ...PROMPT_TRACE_DIR_SEGMENTS)
  const relativeBase = `${promptTraceRelativeDir()}/${fileName}`

  // 目录创建失败要分辨「已存在」与「真失败」：前者照常写文件，后者必须暴露。
  // 注意：`fs:mkdir` 失败时主进程**返回 `{success:false}` 而非抛错**，必须显式判 success。
  let mkdirFailure: string | null = null
  try {
    const result = await ipc.invokeWithProjectSession(session, 'fs:mkdir', dir, session.projectPath)
    if (!result.success) mkdirFailure = result.error ?? '主进程未说明原因'
  } catch (error) {
    mkdirFailure = error instanceof Error ? error.message : String(error)
  }

  try {
    const markdown = buildTraceMarkdown(payload)
    // 同上：`fs:write-file` 失败也是返回 `{success:false}`，不判 success 会把失败当成功。
    const mdResult = await ipc.invokeWithProjectSession(session, 'fs:write-file', `${dir}/${fileName}.md`, markdown, session.projectPath)
    if (!mdResult.success) throw new Error(mdResult.error ?? '写入 markdown 失败（主进程未说明原因）')
    const jsonResult = await ipc.invokeWithProjectSession(session, 'fs:write-file', `${dir}/${fileName}.json`, JSON.stringify(payload, null, 2), session.projectPath)
    if (!jsonResult.success) throw new Error(jsonResult.error ?? '写入 json 失败（主进程未说明原因）')
    lastFlushWarning = ''
    flushedWatermark.set(runKey, watermark)
    reportOutcome(scope, { status: 'ok', files: [`${relativeBase}.md`, `${relativeBase}.json`] })
  } catch (error) {
    // 落盘失败不得影响生成；把原因同时交给面板与（首次出现的）控制台。
    const message = error instanceof Error ? error.message : String(error)
    const reason = mkdirFailure ? `建目录失败：${mkdirFailure}` : message
    if (reason !== lastFlushWarning) {
      lastFlushWarning = reason
      console.warn('[PromptTrace] 快照落盘失败（不影响生成）:', reason)
    }
    reportOutcome(scope, { status: 'failed', reason: `写入失败：${reason}` })
  }
  // 注意：这里**不清理** `pendingIo`。一轮生成会连续发多次请求，每次完成都触发一次落盘；
  // 若在此清空，后一次请求就看不到前一次的 IO —— 正是"只剩最后一次"的根因。
  // 该作用域的内存态统一在退出作用域时由 `releaseTraceScopeState()` 释放。
}

/**
 * 安排一次落盘。
 *
 * 时序上必须容忍「片段先捕获、IO 后到达」：`build()` 期间捕获片段，而真实请求的
 * messages/输出要等 `complete()` 返回才拿到，中间隔着 await。因此不能用微任务
 * （会在 IO 写入前就落盘），而用一个极短的定时器把同一个命令作用域内的片段与 IO
 * 聚拢成一份文件。重复调用只重置计时器，不会写出多份。
 */
const FLUSH_DELAY_MS = 30
let flushTimer: ReturnType<typeof setTimeout> | null = null
let pendingScope: TraceScope | null = null

/**
 * 服务端（主进程）上次看到的**运行期**追踪失败原因，用于在面板上给出可操作提示。
 * 与 `lastOutcome.reason` 分开：前者是"还没到落盘就失败"，后者是"落盘本身失败"。
 */
let lastScheduleSkip: string | null = null

/** 最近一次"未进入落盘"的原因（作用域缺失/无会话等），落盘成功后清空。 */
export function lastTraceScheduleSkip(): string | null {
  return lastScheduleSkip
}

export function scheduleTraceFlush(): void {
  const scope = currentTraceScope()
  if (!scope) {
    // 关键诊断：装配发生在生成作用域之外时，落盘无从定位项目根。
    // 顺带报出最近一次捕获的 promptKey——它能直接指出是哪条生成链路没广播作用域，
    // 不必再去翻代码猜是哪一步。
    const last = lastPromptTraceSnapshot()
    lastScheduleSkip = last
      ? `提示词装配发生在生成作用域之外（promptKey=${last.promptKey}），无法定位落盘目录`
      : '提示词装配发生在生成作用域之外（无 runHandle/项目会话），无法定位落盘目录'
    reportSynthetic('skipped', lastScheduleSkip)
    return
  }
  if (!scope.projectSession) {
    lastScheduleSkip = `当前生成作用域缺少项目会话（operation=${scope.operation ?? '未知'}），无法定位落盘目录`
    reportSynthetic('skipped', lastScheduleSkip, scope)
    return
  }
  lastScheduleSkip = null
  pendingScope = scope
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    const target = pendingScope
    pendingScope = null
    if (!target) return
    // 定时器回调里必须兜底：`flushTraceFile` 内部已 try/catch，
    // 但 `reportOutcome` 之外的任何意外（如 store 读取抛错）都不能静默成"永远等待落盘"。
    void flushTraceFile(target).catch((error) => {
      reportOutcome(target, {
        status: 'failed',
        reason: `落盘任务异常：${error instanceof Error ? error.message : String(error)}`,
      })
    })
  }, FLUSH_DELAY_MS)
}

/** 在没有作用域/会话时也能产生一条可见结果（保持面板不再停在"等待落盘"）。 */
function reportSynthetic(
  status: TraceFlushOutcome['status'],
  reason: string,
  scope?: TraceScope,
): void {
  const full: TraceFlushOutcome = {
    status,
    at: Date.now(),
    reason,
    ...(scope?.operation ? { operation: scope.operation } : {}),
    ...(scope?.runHandle ? { runHandle: scope.runHandle } : {}),
  }
  lastOutcome = full
  for (const listener of outcomeListeners) {
    try { listener(full) } catch { /* 订阅方出错不影响。 */ }
  }
}

/** 记录 IO 面，等待与片段快照一起落盘（同一作用域内按序累积，不覆盖）。 */
export function recordTraceIo(record: TraceIoInput): void {
  const scope = currentTraceScope()
  if (!scope) return
  rememberPendingIo(scope.runHandle ?? 'unscoped', { ...record, at: Date.now() })
  scheduleTraceFlush()
}

/**
 * 释放某个作用域的内存态（由命令在退出作用域时调用）。
 *
 * 作用域结束时该轮的 IO 已落盘完毕，留着只会让长会话按 runKey 累积；
 * 但 `pendingIo` 不能在每次落盘后就清（见 `flushTraceFile` 末尾说明），
 * 所以清理点必须落在"作用域退出"这个确定时刻。
 */
export function releaseTraceScopeState(scope?: TraceScope): void {
  const key = scope?.runHandle ?? currentTraceScope()?.runHandle ?? 'unscoped'
  pendingIo.delete(key)
  flushedWatermark.delete(key)
}

/** 仅测试用：清空待落盘的 IO 缓存与计时器。 */
export function resetTraceIoQueue(): void {
  pendingIo.clear()
  flushedWatermark.clear()
  pendingScope = null
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null }
  lastFlushWarning = ''
  lastOutcome = null
  lastScheduleSkip = null
  capturedSinceEnable = 0
}

/**
 * 「自上次开启追踪以来捕获过多少块」。
 *
 * 用于区分两种"没生成文件"：① 开关开了但压根没跑生成（计数为 0）；
 * ② 跑了但落盘没成功（计数 > 0 且最近结果是 failed/skipped）。
 */
let capturedSinceEnable = 0

export function traceCapturedCount(): number {
  return capturedSinceEnable
}

/** 片段捕获时递增（由装配层调用）。 */
export function noteTraceCapture(): void {
  capturedSinceEnable += 1
}

/** 开关切换时的重置：开启即清零，便于"这一轮到底有没有抓到"可判读。 */
export function resetTraceCaptureCount(): void {
  capturedSinceEnable = 0
}

/**
 * 立即落盘当前待写内容（供「命令结束/应用退出」等需要确定性时序的场合）。
 * 返回是否真的写了文件。
 */
export async function flushTraceNow(): Promise<void> {
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null }
  const target = pendingScope ?? currentTraceScope()
  pendingScope = null
  if (target) await flushTraceFile(target)
}
