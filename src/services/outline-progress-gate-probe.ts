/**
 * 大纲领先正文闸门的**实机取证探针**（A2-6，dev-only）。
 *
 * ## 为什么需要它
 *
 * `readOutlineProgressGate` 是 `src/services/outline-progress-gate.ts` 的模块导出，**没有挂到
 * `window`**，生产上只有 `ArchitectureConfirmDialog` 在内部调用。A2-6 要求「在 CDP 里直接调它，
 * 看返回并逐条排除四条 fail-open 候选」——没有探针就只能靠点界面反推，而反过来推出来的结论
 * 强度不够（D3 到底是不是被判成 `aligned`，只有看到返回值才算知道）。
 *
 * ## 设计上的两条自我约束
 *
 * 1. **只转发，不重判**。探针内部**不复制**任何判定逻辑：判定一律走真实的
 *    `readOutlineProgressGate`。若探针自己再算一遍，就会出现「探针说 ahead、界面说 aligned」
 *    的两套真相 —— 那正是这个仓库反复踩过的坑（见 `outline-prefix-context.ts` 与闸门口径
 *    必须一致的那条注释）。`gate` 里已经带了 `reason / handoff / authorityStatus /
 *    missingChapters`，足够逐条排除候选，不需要额外读。
 * 2. **不进生产**。安装点有 `import.meta.env.DEV` 门，`__outlineProgressGateProbe` 只在
 *    dev 构建里存在；生产包不留调试入口（先例：`__e3UnitProbe` 是常驻的，因为它服务生成链
 *    自诊断，本探针只服务一次验收）。
 *
 * ## 用法（CDP 控制台）
 *
 * ```js
 * await window.__outlineProgressGateProbe(7)
 * ```
 *
 * 返回 `ok: false` 时 `detail` 说明卡在哪（没开项目 / 会话不是活动会话）；返回 `ok: true` 而
 * `gate: null` 时看 `warning` —— `undefined` 表示**这一章不是任何一卷的卷首章**（不适用），
 * 有值表示读取降级（卷一维不判）。
 */
import { captureProjectSession } from '../components/project-session-gate'
import { ipc } from './ipc-client'
import { useProjectStore } from '../stores/project-store'
import { readOutlineProgressGate } from './outline-progress-gate'
import type { OutlineProgressGate } from '../shared/outline-progress-gate'
import type { ProjectData, ProjectSessionContext } from '../shared/ipc-channels'

/** 探针在 `window` 上的键名。 */
export const OUTLINE_PROGRESS_GATE_PROBE = '__outlineProgressGateProbe'

export interface OutlineProgressGateProbeReport {
  /** `false` = 探针自身没能发起判定（无项目 / 会话不匹配），`gate` 无意义。 */
  ok: boolean
  chapterNumber: number
  projectPath: string | null
  /** 真实闸门返回值，探针不改写。 */
  gate: OutlineProgressGate | null
  /** `readOutlineProgressGate` 的降级原因（读取失败 / 卷状态未就绪）。 */
  warning?: string
  /** `ok: false` 时的原因。 */
  detail?: string
  /**
   * 闸门的**输入**原始读数（A2-6 要逐条排除四条 fail-open 候选，只看 `gate=null` 分不清
   * 「不适用」与「读失败/降级」）。**只读、不参与判定** —— 判定仍以 `gate` 为准。
   */
  debug?: OutlineProgressGateProbeDebug
}

export interface OutlineProgressGateProbeDebug {
  /** `db:volumes-list` 的 `state`。非 `ready`/`empty` ⇒ 闸门在入口就返回 null（候选 ②③ 的关键面）。 */
  volumesState?: string
  volumes?: unknown[]
  /** `db:draft-authority-sequence`。`status='invalid'` 会被按未定稿处理。 */
  authority?: { status?: string; lastChapterNumber?: number }
  /** `db:consistency-exemption-list` 里未撤销的稳定键（含 `outline-progress:` 前缀）。 */
  acknowledgedKeys?: string[]
  /** `db:volume-handoffs-list` 的条目数（第二维）。 */
  handoffEntries?: number
  /** 取这些读数时出的错（不影响 `gate`）。 */
  debugError?: string
}

/** 便于单测替换的真实依赖。 */
export interface OutlineProgressGateProbeDeps {
  currentProject: () => ProjectData | null | undefined
  resolveSession: (project: ProjectData | null | undefined) => ProjectSessionContext | null
  readGate: typeof readOutlineProgressGate
  /** 省略 = 不采输入读数（单测默认走这条，避免为 debug 造桩）。 */
  readDebug?: (session: ProjectSessionContext) => Promise<OutlineProgressGateProbeDebug>
}

function defaultDeps(): OutlineProgressGateProbeDeps {
  return {
    currentProject: () => useProjectStore.getState().currentProject,
    resolveSession: project => captureProjectSession(project),
    readGate: readOutlineProgressGate,
    readDebug: readGateInputs,
  }
}

/**
 * 采闸门的四个输入（只读）。刻意**不复用** `readOutlineProgressGate` 的内部结果 ——
 * 那个函数只吐 `gate`/`warning`，看不出是哪一路降级；这里重读一次是为了把原因摊开。
 * 任何一路失败都不抛，记进 `debugError`：取证失败不该让探针整体失败。
 */
async function readGateInputs(session: ProjectSessionContext): Promise<OutlineProgressGateProbeDebug> {
  const path = session.projectPath
  const debug: OutlineProgressGateProbeDebug = {}
  const errors: string[] = []
  const [volumes, authority, exemptions, handoffs] = await Promise.all([
    ipc.invokeWithProjectSession(session, 'db:volumes-list', path)
      .catch(error => { errors.push(`volumes: ${String(error)}`); return null }),
    ipc.invokeWithProjectSession(session, 'db:draft-authority-sequence', path)
      .catch(error => { errors.push(`authority: ${String(error)}`); return null }),
    ipc.invokeWithProjectSession(session, 'db:consistency-exemption-list', path)
      .catch(error => { errors.push(`exemptions: ${String(error)}`); return null }),
    ipc.invokeWithProjectSession(session, 'db:volume-handoffs-list', path)
      .catch(error => { errors.push(`handoffs: ${String(error)}`); return null }),
  ])
  if (volumes && typeof volumes === 'object') {
    debug.volumesState = (volumes as { state?: string }).state
    const list = (volumes as { volumes?: unknown[] }).volumes
    debug.volumes = Array.isArray(list) ? list : []
  }
  if (authority && typeof authority === 'object') {
    const entry = authority as { status?: string; lastChapterNumber?: number }
    debug.authority = { status: entry.status, lastChapterNumber: entry.lastChapterNumber }
  }
  if (Array.isArray(exemptions)) {
    debug.acknowledgedKeys = (exemptions as { stableFactKey?: string; revoked?: boolean }[])
      .filter(entry => !entry.revoked)
      .map(entry => String(entry.stableFactKey ?? ''))
  }
  if (handoffs && typeof handoffs === 'object' && Array.isArray((handoffs as { entries?: unknown[] }).entries)) {
    debug.handoffEntries = (handoffs as { entries: unknown[] }).entries.length
  }
  if (errors.length > 0) debug.debugError = errors.join(' | ')
  return debug
}

/**
 * 发起一次真实判定并把结果整理成可读报告。
 *
 * **章节号必须由调用方给**，不从界面状态反推 —— A2-6 要核对的就是「界面发起时的 chapterNumber
 * 与闸门判定用的 chapterNumber 是不是同一个」（候选之一正是两者错位）。
 */
export async function runOutlineProgressGateProbe(
  chapterNumber: number,
  deps: OutlineProgressGateProbeDeps = defaultDeps(),
): Promise<OutlineProgressGateProbeReport> {
  const base = { chapterNumber, projectPath: null, gate: null } as const
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 2) {
    return { ...base, ok: false, detail: `章节号不合法：${String(chapterNumber)}（应为 ≥2 的整数）` }
  }
  const project = deps.currentProject()
  if (!project) {
    return { ...base, ok: false, detail: '当前没有打开的项目' }
  }
  const session = deps.resolveSession(project)
  if (!session) {
    return {
      ...base,
      ok: false,
      detail: '当前项目不是活动会话（captureProjectSession 返回 null）：切换项目后旧窗口的会话不算',
    }
  }
  const { gate, warning } = await deps.readGate({ projectSession: session, chapterNumber })
  const debug = deps.readDebug
    ? await deps.readDebug(session).catch((error: unknown) => ({ debugError: String(error) }))
    : undefined
  return { ok: true, chapterNumber, projectPath: session.projectPath, gate, warning, debug }
}

/** dev-only 安装：把探针挂到 `window` 上，并在控制台留一句用法。 */
export function installOutlineProgressGateProbe(): void {
  if (typeof window === 'undefined') return
  const target = window as unknown as Record<string, unknown>
  target[OUTLINE_PROGRESS_GATE_PROBE] = (chapterNumber: number) =>
    runOutlineProgressGateProbe(chapterNumber)
  console.warn(
    `[A2-6] 闸门探针已就绪：await window.${OUTLINE_PROGRESS_GATE_PROBE}(7)`
    + '（返回真实 gate；gate=null 且 warning 为空 = 该章不是卷首章）',
  )
}
