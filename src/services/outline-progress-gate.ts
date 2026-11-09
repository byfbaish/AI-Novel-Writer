/**
 * 大纲领先正文闸门的**读侧与确认写入**（P1-2 期 1，2026-10-25）。
 *
 * 只做四件事：并发读卷结构 / 正文权威序列 / 已确认清单 / **卷末交接单** → 交给
 * `outlineProgressGateOf` 判定 → 作者点头时往 `consistency_exemptions` 写一条带理由的确认。
 *
 * **第四路读是 2026-11-06 补的（D3）**：原来只判「上一卷正文写完没」，而 L3 拿到实际还是计划
 * 取决于交接单在不在、能不能用。两个降级口子（已定稿但没登记单 / 单过期）因此被判 `aligned`、
 * 界面零提示。判定口径见 `handoffAvailabilityOf` 的注释 —— **必须与 `outline-prefix-context.ts`
 * 一致**，否则闸门说「会用实际」而投影用的是计划，比不说更糟。
 *
 * **fail-open 是刻意的**：这是一道「提醒你先看看」的闸，不是数据校验。读失败、老项目没有
 * 卷表（`db:volumes-list` 返回 `state: 'empty'`），都不该让作者规划不了下一卷大纲。
 * 判定不出 ⇒ `gate: null`（= 本次不拦），并把原因放进 `warning` 供调用方打日志。
 *
 * **修法 C（2026-11-09，D21）**：卷结构表 `stale`（改过大纲、没重建）**不再短路**。
 * 表只是「计划边界的缓存」，它过期不代表判不出：区间改由 `project_core` 的
 * `plotStructurePlan / synopsis / totalChapters` 现算（`materializeVolumeStructure` →
 * `liveVolumeRanges`），表只剩两个用途 —— 提供 `actualLast`（进度，大纲里投影不出来）
 * 与 `volumeId`（确认键宿主）。只有 `unparsed`（连卷行都没有）仍按「判不出」处理。
 *
 * 现算不可用（读失败 / 物化失败 / 与表对不上 / 本批起点在现算结果里不是卷末）⇒ 退回表边界，
 * 但必须把这件事写进 `warning` 与 `gate.boundarySource = 'table'`，由面板如实告知。
 * **绝不退回 `gate: null`** —— 那等于把 D21 的静默放行又请回来。
 *
 * 确认键前缀 `outline-progress:` 与开写闸门的 `volume-handoff:` **分开**：同表共存、
 * 互不串扰，撤销一条不影响另一条。
 */
import type { AuthoritativeChapterSequence } from '../shared/author-manuscript-import'
import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { ConsistencyExemption } from '../shared/consistency-preflight'
import {
  outlineProgressAckKey,
  outlineProgressGateOf,
  type OutlineProgressGate,
  type PreviousHandoffAvailability,
} from '../shared/outline-progress-gate'
import type { VolumeHandoffDefinition } from '../shared/volume-handoff'
import { isVolumeHandoffEmpty, renderVolumeHandoffSection, VOLUME_HANDOFF_MAX_CHARS } from '../shared/volume-handoff'
import { liveVolumeRanges, materializeVolumeStructure, volumeRangeEndingAt, type VolumeDefinition } from '../shared/volume-structure'
import { ipc } from './ipc-client'

/**
 * `db:project-core-get` 里本闸门要用的三个字段。
 *
 * 刻意只取切片、不 import `ProjectCoreData`：后者住在 `electron/repositories/`，渲染层只为三个
 * 字符串去拉整个主进程仓库类型，等于把两层耦合在一根不要紧的线上。
 */
type ProjectCoreSlice = {
  plotStructurePlan?: string | null
  synopsis?: string | null
  totalChapters?: number | null
}

export interface OutlineProgressGateReadResult {
  /** `null` = 这一章不是任何一卷的第一章（不适用），或读取失败（见 `warning`）。 */
  gate: OutlineProgressGate | null
  /** 读取失败/降级时的可读原因（调用方决定要不要 log）。 */
  warning?: string
}

/**
 * 第二维：上一卷的交接单能不能用。
 *
 * **判定口径必须与 `outline-prefix-context.ts` + `projectSynopsisForOutline` 一致**，否则闸门说
 * 「会用实际」而投影用的是计划，比不说更糟：
 * - 按**卷号精确匹配**，绝不回退到更早的卷（回退会把第 n−2 卷的交接当成第 n−1 卷）；
 * - `validity.state === 'stale'` ⇒ 读取侧不注入 ⇒ 这里也必须算 `stale`；
 * - 六栏全空 ⇒ `missing`；
 * - **能过前面几关还不够**：投影真正的判据是 `renderVolumeHandoffSection(...) !== ''`
 *   （`synopsis-projection.ts:497`）。单条内容超过 1500 字预算时渲染结果为空节，投影走 plan。
 *   2026-11-06 独立复核抓到的正是这条：只判「空不空」会让「单在但太长」重演 D3 原缺陷。
 *   两种语言都渲染、任一为空即算不可用 —— 取严，因为读侧拿不到项目语言，
 *   少报一次可用最多让作者多点一次确认，多报一次可用就是界面撒谎。
 */
function handoffAvailabilityOf(
  handoffs: readonly VolumeHandoffDefinition[],
  previousVolumeIndex: number | null,
  chapterNumber: number,
): PreviousHandoffAvailability {
  if (previousVolumeIndex === null) return 'unknown'
  const entry = handoffs.find(candidate => candidate.volumeIndex === previousVolumeIndex)
  if (!entry) return 'missing'
  if (entry.validity?.state === 'stale') return 'stale'
  if (isVolumeHandoffEmpty(entry)) return 'missing'
  const renders = (language: 'zh-CN' | 'en-US') =>
    renderVolumeHandoffSection(entry, language, chapterNumber, VOLUME_HANDOFF_MAX_CHARS) !== ''
  return renders('zh-CN') && renders('en-US') ? 'usable' : 'unusable'
}

export async function readOutlineProgressGate(input: {
  projectSession: ProjectSessionContext
  /** 本批起始章（= 新卷第一章）。 */
  chapterNumber: number
}): Promise<OutlineProgressGateReadResult> {
  if (!Number.isSafeInteger(input.chapterNumber) || input.chapterNumber < 2) {
    return { gate: null }
  }
  const projectPath = input.projectSession.projectPath
  try {
    const [volumesResult, authority, exemptions, handoffsResult, coreResult] = await Promise.all([
      ipc.invokeWithProjectSession(input.projectSession, 'db:volumes-list', projectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:draft-authority-sequence', projectPath),
      ipc.invokeWithProjectSession(input.projectSession, 'db:consistency-exemption-list', projectPath),
      // D3（2026-11-06）：第二维。**单独 catch** —— 读失败不算失败（`unknown` 会让这一维不打扰，
      // 与扩维之前一致），但也不能让它把整条 `Promise.all` 拖进 catch：那会把原本会报的
      // `prose-unfinalized` 一起吞掉（复核抓到的回归面）。
      ipc.invokeWithProjectSession(input.projectSession, 'db:volume-handoffs-list', projectPath)
        .catch(() => null),
      // 修法 C（2026-11-09）：第五路读。同样单独 catch —— 现算只是「让边界更准」，
      // 它失败不该把本来能报的结论一起吞掉（与第四路同一条教训）。
      ipc.invokeWithProjectSession(input.projectSession, 'db:project-core-get', projectPath)
        .catch(() => null),
    ])
    if (!volumesResult?.success) return { gate: null, warning: volumesResult?.error }
    // `unparsed` = 连卷行都没有（解析没跑过 / 解析失败）：没有可判的对象，仍按「判不出」处理。
    // `stale` 不再短路 —— 那是修法 C 的核心，见文件头。
    // 判据用白名单而不是黑名单：将来多一档状态时默认「不判」，不会默认「照判」。
    const volumeState = (volumesResult as { state?: string }).state
    if (volumeState === 'unparsed') {
      return { gate: null, warning: '卷结构尚未解析（unparsed），本次不判' }
    }
    if (volumeState && volumeState !== 'ready' && volumeState !== 'empty' && volumeState !== 'stale') {
      return { gate: null, warning: `卷结构状态为 ${volumeState}，本次不判` }
    }
    if (!authority || typeof authority !== 'object' || typeof authority.status !== 'string') {
      return { gate: null, warning: '正文权威序列不可读' }
    }
    const structureStale = volumeState === 'stale'
    const volumes = (volumesResult.volumes ?? []) as VolumeDefinition[]
    // mock / 老库可能返回非数组：直接 .filter 会 TypeError，而外层 catch 会把它变成
    // 「静默不拦」—— 于是这道闸看起来时灵时不灵。判类型，不判真值。
    const acknowledged = (Array.isArray(exemptions) ? exemptions as ConsistencyExemption[] : [])
      .filter(entry => !entry.revoked)
      .map(entry => entry.stableFactKey)
    const handoffs = handoffsResult?.success && Array.isArray(handoffsResult.entries)
      ? handoffsResult.entries as VolumeHandoffDefinition[]
      : null

    // ---- 修法 C：边界优先按当前大纲现算 ----
    const core = coreResult as ProjectCoreSlice | null | undefined
    const totalChapters = typeof core?.totalChapters === 'number' && Number.isSafeInteger(core.totalChapters)
      ? core.totalChapters
      : 0
    const projection = core
      ? materializeVolumeStructure({
          plan: core.plotStructurePlan,
          synopsis: core.synopsis,
          totalChapters,
        })
      : null
    const liveRanges = liveVolumeRanges(volumes, projection)
    // 现算给出的卷末**必须**正好是「本批起点 − 1」，否则按现算就判不出这一批是哪一卷的卷首
    // （常见于大纲改过之后、本批起点其实落在卷中间）。这种情况退回表边界并如实标注来源：
    // 宁可带着「可能落后」的标注提醒一次，也不要因为边界搬了家而静默放行。
    const useLive = liveRanges?.some(range => range.last === input.chapterNumber - 1) ?? false
    const boundarySource: 'live' | 'table' = useLive ? 'live' : 'table'
    const warning = structureStale && !useLive
      ? (liveRanges
          ? `卷结构表为 stale，且按当前大纲第 ${input.chapterNumber - 1} 章不是任何一卷的卷末，本次按旧表边界判定`
          : '卷结构表为 stale，且当前大纲未能物化卷结构，本次按旧表边界判定')
      : undefined
    const ranges = useLive ? liveRanges! : undefined
    const previousRange = ranges
      ? ranges.find(range => range.last === input.chapterNumber - 1) ?? null
      : volumeRangeEndingAt(volumes, input.chapterNumber - 1)
    return {
      gate: outlineProgressGateOf({
        volumes,
        ranges,
        structureStale,
        boundarySource,
        authority: authority as Pick<AuthoritativeChapterSequence, 'status' | 'lastChapterNumber'>,
        acknowledged,
        chapterNumber: input.chapterNumber,
        handoff: handoffs
          ? handoffAvailabilityOf(handoffs, previousRange?.volumeIndex ?? null, input.chapterNumber)
          : 'unknown',
      }),
      warning,
    }
  } catch (error) {
    return { gate: null, warning: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 记一次「我知道，仍按计划继续」。写的是 `consistency_exemptions`（稳定键 + 理由 + 可撤销）。
 *
 * 撤销入口在「卷末交接」页的已确认清单：删掉这条，下次规划同一卷时会重新提醒。
 */
export async function acknowledgeOutlineProgress(input: {
  projectSession: ProjectSessionContext
  volumeId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await ipc.invokeWithProjectSession(
      input.projectSession,
      'db:consistency-exemption-save',
      outlineProgressAckKey(input.volumeId),
      input.reason,
      input.projectSession.projectPath,
    )
    return result?.success ? { success: true } : { success: false, error: result?.error }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
