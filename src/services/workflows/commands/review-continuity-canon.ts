/**
 * 审稿链的「连续性核对基准」读侧（P2-1 期 1，2026-10-24）。
 *
 * ## 为什么单独一个文件
 *
 * 四条 IPC 与降级纪律和正文链的 `readKeyItems` / `readCadences` / `readKnowledgeStates` /
 * `readAbilities`（`generate-draft.command.ts:2447-2548`）**逐条同源**，但审稿链跑在另一条命令里，
 * 不能去调生成命令的私有方法。抽成一个不依赖命令的读侧，两侧各取一份、口径靠同一批 channel 保证。
 *
 * ## fail-open 是本文件的全部要点
 *
 * 两类事实都不该让审稿停摆：① 老项目根本没有这几张表（`has*Schema` 为假，IPC 返回 `success:false`）；
 * ② 一次读失败。所以每类**各自**降级成空数组，并记进 `failures` 让调用方说一句人话 ——
 * 「本次没判」与「判了没问题」必须能分开（`ConsistencyPreflightCoverage` 的同一条教训）。
 */
import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import type { InstitutionCadence } from '../../../shared/institution-cadence'
import type { KeyItemDefinition } from '../../../shared/key-item'
import type { KnowledgeStateDefinition } from '../../../shared/knowledge-state'
import type { PowerAbilityDefinition } from '../../../shared/power-ability'
import { ipc } from '../../ipc-client'

export type ReviewContinuityCanonClass = 'items' | 'cadences' | 'knowledge' | 'abilities'

export interface ReviewContinuityCanonSources {
  items: KeyItemDefinition[]
  cadences: InstitutionCadence[]
  knowledge: KnowledgeStateDefinition[]
  abilities: PowerAbilityDefinition[]
  /** 读取失败（或表不存在）的类别；调用方据此打一行可见说明，不阻断审稿。 */
  failures: ReviewContinuityCanonClass[]
}

type ReadResult<T> = { ok: true; value: T[] } | { ok: false }

async function readItems(session: ProjectSessionContext, projectPath: string): Promise<ReadResult<KeyItemDefinition>> {
  try {
    const result = await ipc.invokeWithProjectSession(session, 'db:key-items-list', projectPath)
    return result?.success ? { ok: true, value: result.items ?? [] } : { ok: false }
  } catch {
    return { ok: false }
  }
}

async function readCadences(session: ProjectSessionContext, projectPath: string): Promise<ReadResult<InstitutionCadence>> {
  try {
    const result = await ipc.invokeWithProjectSession(session, 'db:cadences-list', projectPath)
    return result?.success ? { ok: true, value: result.cadences ?? [] } : { ok: false }
  } catch {
    return { ok: false }
  }
}

async function readKnowledge(session: ProjectSessionContext, projectPath: string): Promise<ReadResult<KnowledgeStateDefinition>> {
  try {
    const result = await ipc.invokeWithProjectSession(session, 'db:knowledge-list', projectPath)
    return result?.success ? { ok: true, value: result.entries ?? [] } : { ok: false }
  } catch {
    return { ok: false }
  }
}

async function readAbilities(session: ProjectSessionContext, projectPath: string): Promise<ReadResult<PowerAbilityDefinition>> {
  try {
    const result = await ipc.invokeWithProjectSession(session, 'db:abilities-list', projectPath)
    return result?.success ? { ok: true, value: result.abilities ?? [] } : { ok: false }
  } catch {
    return { ok: false }
  }
}

/**
 * 并发读四类登记。**期界过滤不在这里做**（需要本章号，在 `buildReviewContinuityBibleBlock` 里统一做），
 * 本函数只负责「拿回来 + 失败可见」。
 */
export async function readReviewContinuityCanon(input: {
  projectPath: string
  projectSession: ProjectSessionContext
}): Promise<ReviewContinuityCanonSources> {
  const { projectPath, projectSession } = input
  const [items, cadences, knowledge, abilities] = await Promise.all([
    readItems(projectSession, projectPath),
    readCadences(projectSession, projectPath),
    readKnowledge(projectSession, projectPath),
    readAbilities(projectSession, projectPath),
  ])
  // 失败清单按固定顺序汇总：并发完成顺序不确定，日志不能跟着抖。
  const failures: ReviewContinuityCanonClass[] = []
  if (!items.ok) failures.push('items')
  if (!cadences.ok) failures.push('cadences')
  if (!knowledge.ok) failures.push('knowledge')
  if (!abilities.ok) failures.push('abilities')
  return {
    items: items.ok ? items.value : [],
    cadences: cadences.ok ? cadences.value : [],
    knowledge: knowledge.ok ? knowledge.value : [],
    abilities: abilities.ok ? abilities.value : [],
    failures,
  }
}
