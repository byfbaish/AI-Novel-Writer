/**
 * P3b：「重写一个单元」= 整单元回退（2026-10-21）。
 *
 * ## 语义（作者裁定）
 *
 * 「一个单元是一个完整的局面，由大模型整体规划」⇒ **只做整单元回退**，
 * 不做「从单元内第 k 章重写」。
 *
 * ## 单元边界从哪来（⚠️ 不能用 `arcSpanForChapters` 反查）
 *
 * `architecture.command` 里有一条明确的禁令：**不得用 `arcSpanForChapters` 反查单元**
 * —— 那是计划等分映射，实际章数一偏离就整体错位（2026-10-20 实测：单元实际写 12 章
 * 而计划 15 章时，反查会把它判成"还在单元 1"）。
 *
 * 所以这里只用**正文里的事实**：P2 之后章标题自带归属
 * `## 第1卷第2单元第3章（全书第 8 章）：…`，直接读出「哪些章属于哪个单元」。
 * 正文里一条归属都没有（老项目 / 全程漂成旧格式）⇒ **fail-closed 拒绝**，
 * 不去猜边界。
 *
 * ## 只删正文，不动输入
 *
 * 弧结构、世界观、前提、步骤指导一个字不动；删掉的只是这个单元的章条目。
 * 卷偏差累计（`synopsis_volume_deviations`）暂不回退 —— 它只是信号带提示，
 * 且回退需要该单元的真实字数，等真要做时按正文重算。
 */

import { parseOutlineChapterHeading } from '../../shared/chapter-heading'
import {
  renderPlotOutlineSynopsis,
  stripPlotOutlineWrapper,
} from '../../shared/plot-outline-contract'
import { removeOutlineChapterEntries } from '../../shared/synopsis-unit-rewind'
import type { ProjectCoreSynopsisExpected } from '../../../electron/repositories/project-core-repository'
import { ipc } from '../ipc-client'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import type { WritingLanguage } from '../../shared/writing-language'
import {
  synopsisFactsFingerprint,
  type SynopsisUnitCursor,
} from './commands/architecture.command'

/** 检查点里与本动作相关的键（其余键一概不碰）。 */
const REWIND_CHECKPOINT_KEYS = [
  'synopsis_result',
  'synopsis_incomplete',
  'synopsis_covered_to',
  'synopsis_range',
  'synopsis_unit_cursor',
  'synopsis_generation_handle',
  'synopsis_body_hash',
  'synopsis_db_hash',
] as const

export type SynopsisUnitRewindFailure =
  /** 正文里没有任何章条目 ⇒ 没有可回退的东西 */
  | 'nothing-written'
  /** 正文里没有任何带归属的章标题 ⇒ 定不了单元边界（不去猜） */
  | 'no-attribution'
  /** 有归属，但读不出章号 */
  | 'bad-heading'

export interface SynopsisUnitRewindPlan {
  volumeIndex: number
  unitIndex: number
  /** 被重写的单元在全书里的章号区间 */
  range: Readonly<{ from: number; to: number }>
  /** 回退后的覆盖水位（= range.from − 1） */
  coveredTo: number
  /** 回退前的覆盖水位（给界面说"从第 X 章退回第 Y 章"） */
  previousCoveredTo: number
  cursor: SynopsisUnitCursor
  /** 新的落库正文（含 `# 情节大纲` 头与新进度行） */
  outlineText: string
  /** 新的纯 body（算 `synopsis_body_hash` 用） */
  bodyText: string
  removedChapters: number[]
  removedChars: number
}

export type SynopsisUnitRewindResult =
  | { readonly ok: true; readonly plan: SynopsisUnitRewindPlan }
  | { readonly ok: false; readonly reason: SynopsisUnitRewindFailure }

interface ParsedEntry {
  chapter: number
  volumeIndex: number | null
  unitIndex: number | null
}

function parseEntries(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const fields = parseOutlineChapterHeading(line)
    if (fields) entries.push({ chapter: fields.chapter, volumeIndex: fields.volumeIndex, unitIndex: fields.unitIndex })
  }
  return entries
}

/**
 * 定位「最后写过的那个单元」。**纯函数**，不读写任何状态。
 *
 * 目标单元 = 正文里**最后一个带归属的章**所属的 (卷, 单元)。
 * 范围 = 正文里所有归属到该单元的章号的最小/最大值。
 */
export function planSynopsisUnitRewind(input: {
  readonly outlineText: string
  readonly writingLanguage: WritingLanguage
  readonly totalChapters: number
  readonly coveredTo: number
  readonly expected: ProjectCoreSynopsisExpected
}): SynopsisUnitRewindResult {
  const body = stripPlotOutlineWrapper(input.outlineText, input.writingLanguage)
  const entries = parseEntries(body)
  if (entries.length === 0) return { ok: false, reason: 'nothing-written' }

  const attributed = entries.filter(entry => entry.volumeIndex !== null && entry.unitIndex !== null)
  if (attributed.length === 0) return { ok: false, reason: 'no-attribution' }
  const last = attributed[attributed.length - 1]!
  const volumeIndex = last.volumeIndex!
  const unitIndex = last.unitIndex!

  const chapters = attributed
    .filter(entry => entry.volumeIndex === volumeIndex && entry.unitIndex === unitIndex)
    .map(entry => entry.chapter)
  if (chapters.length === 0) return { ok: false, reason: 'bad-heading' }

  // 章组会让同一行贡献多个章号；这里只需要边界，用章标题行自身记录的 chapter 即可。
  const from = Math.min(...chapters)
  const to = Math.max(...chapters)
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to < from) {
    return { ok: false, reason: 'bad-heading' }
  }
  const coveredTo = Math.max(0, from - 1)

  // `writtenInVolume` = 本卷内已写章数 = 新水位 − (本卷首章 − 1)。
  // 本卷首章取「正文里归属为第 V 卷的最小章号」；该卷在正文里只出现本单元时，
  // 它正好等于 `from` ⇒ 卷内已写 0 章（正确：这一卷前面还没写）。
  const volumeFirst = Math.min(
    ...attributed.filter(entry => entry.volumeIndex === volumeIndex).map(entry => entry.chapter),
  )
  const writtenInVolume = Math.max(0, coveredTo - (volumeFirst - 1))

  const removal = removeOutlineChapterEntries(body, { from, to })
  const nextBody = removal.text
  const outlineText = renderPlotOutlineSynopsis(nextBody, coveredTo, {
    ...input.expected,
    writingLanguage: input.writingLanguage,
    totalChapters: input.totalChapters,
  })

  return {
    ok: true,
    plan: {
      volumeIndex,
      unitIndex,
      range: Object.freeze({ from, to }),
      coveredTo,
      previousCoveredTo: input.coveredTo,
      cursor: Object.freeze({ volumeIndex, unitIndex, writtenInVolume }),
      outlineText,
      bodyText: nextBody,
      removedChapters: removal.removed,
      removedChars: removal.removedChars,
    },
  }
}

export interface SynopsisUnitRewindApplyResult {
  readonly ok: boolean
  readonly error?: string
  readonly plan?: SynopsisUnitRewindPlan
}

/**
 * 执行整单元回退：删正文条目 → 落库 → 把检查点退到该单元起点。
 *
 * 顺序是刻意的：
 * 1. 先算 plan（纯函数，失败就不动任何状态）；
 * 2. 再提交数据库正文（带乐观锁 `expected`，别人改过就整件事失败）；
 * 3. 最后写检查点。**第 3 步失败时**数据库已经回退，检查点还指着旧水位 ——
 *    这种状态与「作者手工删了大纲」同形，探针会判 `checkpoint-lost`，不会静默重写。
 */
interface RewindContext {
  outlineText: string
  writingLanguage: WritingLanguage
  totalChapters: number
  expected: ProjectCoreSynopsisExpected
  coveredTo: number
  partial: Record<string, unknown>
}

async function readRewindContext(projectSession: ProjectSessionContext): Promise<RewindContext | null> {
  const core = await ipc.invokeWithProjectSession(
    projectSession,
    'db:project-core-get',
    projectSession.projectPath,
  )
  const outlineText = typeof core?.synopsis === 'string' ? core.synopsis : ''
  const writingLanguage: WritingLanguage = core?.writingLanguage === 'en-US' ? 'en-US' : 'zh-CN'
  const totalChapters = Number(core?.totalChapters) || 0
  if (!outlineText.trim() || totalChapters < 1) return null
  const partial = await readCheckpoint(projectSession)
  const entries = parseEntries(stripPlotOutlineWrapper(outlineText, writingLanguage))
  const coveredTo = Number.isSafeInteger(partial.synopsis_covered_to)
    ? Number(partial.synopsis_covered_to)
    : entries.reduce((max, entry) => Math.max(max, entry.chapter), 0)
  return {
    outlineText,
    writingLanguage,
    totalChapters,
    coveredTo,
    partial,
    expected: {
      synopsis: outlineText,
      premise: core?.premise ?? '',
      charactersArch: core?.charactersArch ?? '',
      worldbuilding: core?.worldbuilding ?? '',
      plotStructurePlan: core?.plotStructurePlan ?? '',
      genre: core?.genre ?? '',
      totalChapters,
      wordsPerChapter: Number(core?.wordsPerChapter) || 0,
      writingLanguage,
      plotStructure: core?.plotStructure ?? '',
      narrativePov: core?.narrativePov ?? '',
      globalGuidance: core?.globalGuidance ?? '',
    },
  }
}

function describeFailure(reason: SynopsisUnitRewindFailure): string {
  switch (reason) {
    case 'no-attribution':
      return '这份大纲的章标题没有卷/单元归属，无法确定单元边界。先按单元生成一批，或把标题改成「第N卷第N单元第N章（全书第N章）」后再试。'
    case 'nothing-written':
      return '当前情节大纲里还没有任何章条目'
    default:
      return '章标题解析失败，无法确定要重写的范围'
  }
}

/** 只读预览：给确认弹窗用，不写数据库、不写检查点。 */
export async function previewSynopsisUnitRewind(
  projectSession: ProjectSessionContext,
): Promise<SynopsisUnitRewindApplyResult> {
  try {
    const context = await readRewindContext(projectSession)
    if (!context) return { ok: false, error: '当前情节大纲为空，没有可重写的单元' }
    const planned = planSynopsisUnitRewind({
      outlineText: context.outlineText,
      writingLanguage: context.writingLanguage,
      totalChapters: context.totalChapters,
      coveredTo: context.coveredTo,
      expected: context.expected,
    })
    return planned.ok ? { ok: true, plan: planned.plan } : { ok: false, error: describeFailure(planned.reason) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 执行整单元回退：删正文条目 → 落库 → 把检查点退到该单元起点。
 *
 * 顺序是刻意的：
 * 1. 先算 plan（纯函数，失败就不动任何状态）；
 * 2. 再提交数据库正文（带乐观锁 `expected`，别人改过就整件事失败）；
 * 3. 最后写检查点。**第 3 步失败时**数据库已经回退，检查点还指着旧水位 ——
 *    这种状态与「作者手工删了大纲」同形，探针会判 `checkpoint-lost`，不会静默重写。
 */
export async function rewindSynopsisUnit(
  projectSession: ProjectSessionContext,
): Promise<SynopsisUnitRewindApplyResult> {
  try {
    const context = await readRewindContext(projectSession)
    if (!context) return { ok: false, error: '当前情节大纲为空，没有可重写的单元' }
    const planned = planSynopsisUnitRewind({
      outlineText: context.outlineText,
      writingLanguage: context.writingLanguage,
      totalChapters: context.totalChapters,
      coveredTo: context.coveredTo,
      expected: context.expected,
    })
    if (!planned.ok) return { ok: false, error: describeFailure(planned.reason) }
    const { plan } = planned

    const commit = await ipc.invokeWithProjectSession(
      projectSession,
      'db:project-core-synopsis-commit',
      { synopsis: plan.outlineText, expected: context.expected },
      projectSession.projectPath,
    )
    if (!commit?.success) {
      return {
        ok: false,
        error: commit?.error === '项目数据已变化，已拒绝覆盖情节大纲'
          ? '项目数据已变化，已拒绝回退（请刷新后重试）'
          : commit?.error || '写回情节大纲失败',
      }
    }

    await writeCheckpoint(projectSession, context.partial, plan)
    return { ok: true, plan }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function checkpointPath(projectPath: string): string {
  return `${projectPath.replace(/[\\/]+$/u, '')}/.ai-novel/partial_arch.json`
}

async function readCheckpoint(projectSession: ProjectSessionContext): Promise<Record<string, unknown>> {
  const read = await ipc.invokeWithProjectSession(
    projectSession,
    'fs:read-json',
    checkpointPath(projectSession.projectPath),
    projectSession.projectPath,
  )
  if (read?.success && read.data && typeof read.data === 'object') {
    return { ...(read.data as Record<string, unknown>) }
  }
  return {}
}

async function writeCheckpoint(
  projectSession: ProjectSessionContext,
  partial: Record<string, unknown>,
  plan: SynopsisUnitRewindPlan,
): Promise<void> {
  // 先把与本动作相关的键清干净（旧 handle 不清，下次续写会接到一个已经不存在的 run 上）。
  for (const key of REWIND_CHECKPOINT_KEYS) delete partial[key]
  partial.synopsis_covered_to = plan.coveredTo
  partial.synopsis_incomplete = false
  partial.synopsis_range = { from: plan.range.from, to: plan.range.to }
  partial.synopsis_unit_cursor = plan.cursor
  partial.synopsis_body_hash = synopsisFactsFingerprint([plan.bodyText])
  partial.synopsis_db_hash = synopsisFactsFingerprint([plan.outlineText])
  const write = await ipc.invokeWithProjectSession(
    projectSession,
    'fs:write-json',
    checkpointPath(projectSession.projectPath),
    partial,
    projectSession.projectPath,
  )
  if (write?.success === false) throw new Error(write.error || '写入情节大纲检查点失败')
}
