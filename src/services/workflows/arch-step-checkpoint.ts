/**
 * 清空某一步故事架构后，把**它在检查点里留下的进度**一起作废（2026-10-21）。
 *
 * ## 为什么必须做
 *
 * 左侧项目树每行的垃圾桶走的是 `writeCoreContent(file, '')`：**只把产物写空**，
 * 根本不碰 `.ai-novel/partial_arch.json`。于是出现两个症状（2026-10-21 实机）：
 *
 * 1. **界面状态不跟着变**：大纲已经是「待生成」，生成弹窗却还写着
 *    「单元模式：第2卷第1单元第1章（全书第22章）」—— 那是检查点里 `covered_to=21`
 *    加旧游标算出来的。
 * 2. **生成直接失败**：「项目源事实自上次生成后已变化，既有大纲不能与新的源事实拼接。」
 *    `synopsisInputsFingerprint` 拿检查点绑定的旧指纹去比现在的源事实，必然不等。
 *
 * 这两条都不是 bug 的边缘情况，而是「删了产物、没删与它绑定的进度」的必然结果。
 *
 * ## 为什么是级联
 *
 * 架构链是 `前提 → 角色 → 世界观 → 卷/单元 → 情节大纲`，每一步都是下一步的输入，
 * 且**全都被写进了大纲检查点的源事实指纹**。所以清任何一步，它自己和它下游的进度
 * 都必须作废 —— 否则下游会以「源事实变了」为由拒绝续写，作者只能手动删文件。
 *
 * 注意：本动作**只清检查点里的进度**，已经写进数据库的产物正文不动（那是作者财产）。
 */

import { ipc } from '../ipc-client'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { SYNOPSIS_CHECKPOINT_KEYS } from './synopsis-unit-launch'

/** 故事架构链的步骤（顺序即依赖顺序）。 */
export const ARCH_STEP_ORDER = ['premise', 'characters', 'worldbuilding', 'plotStructure', 'synopsis'] as const
export type ArchStepKey = typeof ARCH_STEP_ORDER[number]

/** 各步在检查点里留下的键。`characters` 走数据库表，检查点里没有它的进度。 */
const STEP_CHECKPOINT_KEYS: Readonly<Record<ArchStepKey, readonly string[]>> = {
  premise: ['premise_result'],
  characters: [],
  // `world_building_self_review`（W6a-2）必须跟着一起清：它的每条 finding 都引用世界观原文，
  // 正文被清掉之后这些引文一条都命中不了 —— 留着只会让编辑面挂一条指向不存在文本的提示。
  // `world_building_resource_candidates`（W6a-4）同理，而且更硬：候选的 `quote` / `anchorQuote`
  // 是**落库依据**，正文没了还留在面板上，作者会给一批查无实据的资源建定义。
  worldbuilding: [
    'world_building_result',
    'world_building_generation_handle',
    'world_building_self_review',
    'world_building_resource_candidates',
  ],
  plotStructure: [],
  synopsis: SYNOPSIS_CHECKPOINT_KEYS,
}

/**
 * 清某一步时要作废哪些检查点键（含下游）。纯函数，便于单测。
 *
 * 例：清 `worldbuilding` ⇒ 世界观 + 卷/单元 + 情节大纲三段的进度全部作废。
 */
export function archStepCheckpointKeys(step: ArchStepKey): string[] {
  const index = ARCH_STEP_ORDER.indexOf(step)
  if (index < 0) return []
  const keys = new Set<string>()
  for (const downstream of ARCH_STEP_ORDER.slice(index)) {
    for (const key of STEP_CHECKPOINT_KEYS[downstream]) keys.add(key)
  }
  // `plotStructure` 自己没有检查点字段，但它变了会让大纲失效 —— 上游循环已覆盖。
  return [...keys]
}

export type ArchStepCheckpointClearResult =
  | { readonly ok: true; readonly cleared: number }
  | { readonly ok: false; readonly error: string }

function checkpointPath(projectPath: string): string {
  return `${projectPath.replace(/[\\/]+$/u, '')}/.ai-novel/partial_arch.json`
}

/**
 * 作废「清空该步」后已失效的检查点进度。**只删进度键，其余一概不动。**
 *
 * 文件不存在 ⇒ 视为成功（没有进度可作废）；文件损坏 ⇒ 覆盖成 `{}`（比让作者手改安全）。
 */
export async function clearArchStepCheckpoint(
  projectSession: ProjectSessionContext,
  step: ArchStepKey,
): Promise<ArchStepCheckpointClearResult> {
  const keys = archStepCheckpointKeys(step)
  if (keys.length === 0) return { ok: true, cleared: 0 }
  const path = checkpointPath(projectSession.projectPath)
  let raw: Record<string, unknown>
  try {
    const read = await ipc.invokeWithProjectSession(projectSession, 'fs:read-json', path, projectSession.projectPath)
    if (read?.reason === 'invalid-json' || read?.reason === 'unreadable' || read?.reason === 'denied') {
      raw = {}
    } else if (read?.success && read.data && typeof read.data === 'object') {
      raw = { ...(read.data as Record<string, unknown>) }
    } else {
      // 文件不存在：没有进度可作废，直接成功。
      return { ok: true, cleared: 0 }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  let cleared = 0
  for (const key of keys) {
    if (key in raw) {
      delete raw[key]
      cleared += 1
    }
  }
  if (cleared === 0) return { ok: true, cleared: 0 }
  try {
    const write = await ipc.invokeWithProjectSession(projectSession, 'fs:write-json', path, raw, projectSession.projectPath)
    if (write?.success === false) return { ok: false, error: write.error ?? '写入情节大纲检查点失败' }
    return { ok: true, cleared }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 「清除全部故事架构」时用：整条链的进度一起作废。
 *
 * 语义上等于从链头（前提）清 —— `archStepCheckpointKeys('premise')` 已是全集。
 */
export function clearAllArchProgress(projectSession: ProjectSessionContext): Promise<ArchStepCheckpointClearResult> {
  return clearArchStepCheckpoint(projectSession, 'premise')
}
