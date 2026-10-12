/**
 * Prompt 追踪落盘（P2）。
 *
 * 把一次生成的「输入面」（片段清单 + 组装后文本）与「输出面」（最终 messages + 模型输出）
 * 按 `runHandle` 归并，写成人类可读的 markdown + 机器可读的 json，落在项目根内固定目录：
 *
 *     <项目根>/debug/prompt-trace/<时间戳>-<operation>-<runId>.md
 *     <项目根>/debug/prompt-trace/<时间戳>-<operation>-<runId>.json
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
import { promptTraceSnapshots, type PromptTraceSnapshot } from './prompt-trace'
import { useDebugStore } from '../../stores/debug-store'

/** 项目内落盘目录（相对项目根，用 `/` 分隔，由调用方与项目根拼接）。 */
export const PROMPT_TRACE_DIR_SEGMENTS = ['debug', 'prompt-trace'] as const

/** 追踪目录的相对路径（用于 UI 展示）。 */
export function promptTraceRelativeDir(): string {
  return PROMPT_TRACE_DIR_SEGMENTS.join('/')
}

interface TraceFilePayload {
  runHandle?: string
  operation?: string
  chapterNumber?: number
  writtenAt: number
  snapshots: Array<{
    promptKey: string
    writingLanguage: string
    capturedAt: number
    builtLength: number
    fragments: PromptTraceSnapshot['fragments']
    built: string
  }>
  io?: {
    messages: Array<{ role: string; content: string }>
    output: string
    finishReason?: string
  }
}

/** 本次作用域的开始时刻（缺失时退化为 0，即不过滤——宁多写不丢）。 */
function scopeStartedAt(scope: TraceScope): number {
  return scope.startedAt ?? 0
}

/** 把项目根与相对段拼成平台路径。不引入 node:path（渲染层无此依赖）。 */function joinProjectPath(root: string, ...segments: string[]): string {
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

function buildMarkdown(payload: TraceFilePayload): string {
  const lines: string[] = []
  lines.push('# Prompt 追踪快照', '')
  lines.push(`- 生成任务：\`${payload.operation ?? '未知'}\``)
  lines.push(`- 关联句柄：\`${payload.runHandle ?? '（无，未进入命令作用域）'}\``)
  if (payload.chapterNumber !== undefined) lines.push(`- 章节：第 ${payload.chapterNumber} 章`)
  lines.push(`- 记录时刻：${new Date(payload.writtenAt).toLocaleString('zh-CN')}`)
  lines.push(`- 片段批次：${payload.snapshots.length}`, '')

  for (const [index, snapshot] of payload.snapshots.entries()) {
    lines.push('---', '')
    lines.push(`## ${index + 1}. \`${snapshot.promptKey}\``)
    lines.push(`组装后长度：${snapshot.builtLength} 字 · 共 ${snapshot.fragments.length} 块`)
    lines.push('')
    lines.push('| 序号 | 来源 | 名称 | 可改 | 生效来源 | 变量 |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    for (const fragment of snapshot.fragments) {
      const variables = fragment.variables.map(v => `{{${v.key}}}`).join(' ') || '—'
      lines.push(`| ${fragment.order} | ${fragment.sourceKind} | ${fragment.label} | ${fragment.editable ? '可改' : '锁定'} | ${fragment.resolvedFrom ?? '—'} | ${variables} |`)
    }
    lines.push('')
    for (const fragment of snapshot.fragments) {
      lines.push(`### 第 ${fragment.order} 块 · ${fragment.label}`, '')
      lines.push(`- 来源：\`${fragment.sourceKind}\`${fragment.resolvedFrom ? ` · 生效于 \`${fragment.resolvedFrom}\`` : ''}`)
      if (fragment.note) lines.push(`- 说明：${fragment.note}`)
      lines.push('')
      lines.push('```text')
      lines.push(fragment.rawText.replace(/\r\n/g, '\n').replace(/```/g, "'''"))
      lines.push('```', '')
    }
  }

  if (payload.io) {
    lines.push('---', '')
    lines.push('## 实际发出的请求与输出', '')
    for (const message of payload.io.messages) {
      lines.push(`### ${message.role}`, '')
      lines.push('```text')
      lines.push(message.content.replace(/\r\n/g, '\n').replace(/```/g, "'''"))
      lines.push('```', '')
    }
    lines.push(`### 模型输出${payload.io.finishReason ? `（finishReason=${payload.io.finishReason}）` : ''}`, '')
    lines.push('```text')
    lines.push(payload.io.output.replace(/\r\n/g, '\n').replace(/```/g, "'''"))
    lines.push('```', '')
  }

  return lines.join('\n')
}

/** 记录 IO 面（由 `GenerationSession.complete` 调用）。 */
export interface TraceIoRecord {
  messages: Array<{ role: string; content: string }>
  output: string
  finishReason?: string
}

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

const pendingIo = new Map<string, TraceIoRecord>()
let lastFlushWarning = ''

/**
 * 主进程-渲染层归并落盘。
 *
 * 之所以要"攒一下再写"：一次命令可能触发多次 `build()`（分批/多步），
 * 每步都写一份文件会碎片化。这里在微任务里合并同一作用域内的全部快照，一次成文。
 */
async function flushTraceFile(scope: TraceScope): Promise<void> {
  const session = scope.projectSession
  const store = useDebugStore.getState()
  if (!store.promptTraceEnabled) {
    reportOutcome(scope, { status: 'skipped', reason: '追踪已关闭' })
    return
  }
  if (!session) {
    // 渲染层拿不到项目会话 = 工作流未走项目作用域（如纯本地步骤），无从确定项目根。
    reportOutcome(scope, { status: 'skipped', reason: '当前作用域没有项目会话，无法确定项目根目录' })
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

  const io = pendingIo.get(runKey)
  const writtenAt = Date.now()
  const payload: TraceFilePayload = {
    ...(scope.runHandle ? { runHandle: scope.runHandle } : {}),
    ...(scope.operation ? { operation: scope.operation } : {}),
    ...(scope.chapterNumber !== undefined ? { chapterNumber: scope.chapterNumber } : {}),
    writtenAt,
    snapshots: fresh.map(snapshot => ({
      promptKey: snapshot.promptKey,
      writingLanguage: snapshot.writingLanguage,
      capturedAt: snapshot.capturedAt,
      builtLength: snapshot.built.length,
      fragments: snapshot.fragments,
      built: snapshot.built,
    })),
    ...(io ? { io } : {}),
  }

  const fileName = `${compactTimestamp(writtenAt)}-${sanitizeFileSegment(scope.operation ?? 'unknown')}-${sanitizeFileSegment(scope.runHandle?.split('/').pop() ?? 'run')}`
  const dir = joinProjectPath(session.projectPath, ...PROMPT_TRACE_DIR_SEGMENTS)
  const relativeBase = `${promptTraceRelativeDir()}/${fileName}`

  // 目录创建失败要分辨「已存在」与「真失败」：前者照常写文件，后者必须暴露。
  let mkdirFailure: string | null = null
  try {
    await ipc.invokeWithProjectSession(session, 'fs:mkdir', dir, session.projectPath)
  } catch (error) {
    mkdirFailure = error instanceof Error ? error.message : String(error)
  }

  try {
    const markdown = buildMarkdown(payload)
    await ipc.invokeWithProjectSession(session, 'fs:write-file', `${dir}/${fileName}.md`, markdown, session.projectPath)
    await ipc.invokeWithProjectSession(session, 'fs:write-file', `${dir}/${fileName}.json`, JSON.stringify(payload, null, 2), session.projectPath)
    lastFlushWarning = ''
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
  } finally {
    pendingIo.delete(runKey)
  }
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

export function scheduleTraceFlush(): void {
  const scope = currentTraceScope()
  if (!scope) return
  pendingScope = scope
  if (flushTimer !== null) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    const target = pendingScope
    pendingScope = null
    if (target) void flushTraceFile(target)
  }, FLUSH_DELAY_MS)
}

/** 记录 IO 面，等待与片段快照一起落盘。 */
export function recordTraceIo(record: TraceIoRecord): void {
  const scope = currentTraceScope()
  if (!scope) return
  pendingIo.set(scope.runHandle ?? 'unscoped', record)
  scheduleTraceFlush()
}

/** 仅测试用：清空待落盘的 IO 缓存与计时器。 */
export function resetTraceIoQueue(): void {
  pendingIo.clear()
  pendingScope = null
  if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null }
  lastFlushWarning = ''
  lastOutcome = null
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
