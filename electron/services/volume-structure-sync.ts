import type BetterSqlite3 from 'better-sqlite3'
import { ProjectCoreRepository } from '../repositories/project-core-repository'
import {
  hasVolumeStructureSchema,
  listVolumes,
  markVolumeDone,
  rebuildVolumes,
} from '../repositories/volume-structure-repository'

/**
 * 卷结构的自动同步（D14）。
 *
 * ## 为什么需要这个文件
 *
 * 2026-11-01 实机验收发现：`volumes` / `volume_units` / `volume_handoffs` 三张表
 * **在第 1 卷 6 章全部定稿之后仍然是 0 行**。原因不是写库失败，而是这两个动作
 * 全库只有「卷末交接」面板里那一次手动点击会触发
 * （`VolumeHandoffRegistryPanel.tsx:269/293/317`），生成流程一次都不调用。
 * 结果是 `l3-handoff-missing` 成为任何没手动点过的项目的**必然状态**，
 * 而不是某次失败留下的疤痕。完整取证见
 * `docs/design/product/live-pipeline-acceptance-defects-assessment.md` D14。
 *
 * ## 这里只做「零决策」的两步
 *
 * 1. **建卷结构**：把 `project_core.plot_structure_plan` 解析成卷 / 单元行。
 *    输入是作者已有的架构文本，产物是同一份文本的结构化投影，不新增任何信息。
 * 2. **推进 `actual_last`**：`markVolumeDone` 本身是纯查询
 *    （`SELECT MAX(chapter_number) FROM drafts WHERE status='finalized' AND 落在本卷区间`），
 *    **不判断「这一卷写完没有」**，只记录「已定稿到第几章」。也没有决策成分。
 *
 * **登记卷末交接（`volume_handoffs`）不在这里做。** 那一栏问的是「下一卷必须承接什么」，
 * 是作者的取舍判断；让模型代写等于再造一份摘要，而 L3 现在正是用卷计划摘要顶替的，
 * 作者已指出「这个提醒太软」。自动化的边界停在「把状态建对 + 把缺口指出来」。
 *
 * ## 失败一律吞掉，不阻断主流程
 *
 * 这两个动作都是**派生视图的维护**：架构提交和章节定稿本身已经成功，
 * 卷结构同步失败不该把成功的写操作回滚成失败。下次提交会重试。
 * 但错误会打到 stderr，便于排查（不静默）。
 */

function warn(scope: string, error: unknown): void {
  console.error(`[volume-structure-sync] ${scope} 失败（已忽略，不影响主流程）:`, error)
}

/**
 * 把一卷的 `actual_last` 对齐到「本卷区间内已定稿的最大章号」。
 *
 * 三种「什么都不用做」的返回都是正常状态，不写日志：
 * - `VOLUME_MARK_DONE_NO_FINALIZED`：本卷还没有定稿章；
 * - `VOLUME_MARK_DONE_NO_PLANNED_START`：本卷没有计划起点（大纲里这一卷没写章号区间）；
 * - `VOLUME_MARK_DONE_NOT_FOUND`：卷行在两次查询之间被删掉了（重建并发）。
 *
 * 其余错误打到 stderr —— 吞掉是「不阻断主流程」，不是「不让人知道」。
 */
function advanceVolume(db: BetterSqlite3.Database, volumeId: string): boolean {
  try {
    markVolumeDone(db, volumeId)
    return true
  } catch (error) {
    const message = String(error)
    const normal = message.includes('VOLUME_MARK_DONE_NO_FINALIZED')
      || message.includes('VOLUME_MARK_DONE_NO_PLANNED_START')
      || message.includes('VOLUME_MARK_DONE_NOT_FOUND')
    if (!normal) warn(`markVolumeDone(${volumeId})`, error)
    return false
  }
}

/**
 * 按当前 `drafts` 重算**所有**卷的 `actual_last`。
 *
 * 与 `markVolumeProgressForChapter` 的分工：那个是「刚定稿了一章，把受影响的
 * 那一卷推一下」（事件驱动，一次一卷）；这个是「把已有事实整体对一遍」
 * （批量对账，一次全卷）。两者的写入语义完全相同 —— 都是 `markVolumeDone`
 * 的纯查询结果，所以重复调用、交错调用都不会把 `actual_last` 改坏。
 *
 * 为什么必须有这个：事件驱动的修复只对**修复上线之后**发生的定稿生效。
 * 实机验收时第 1 卷 6 章早在改代码之前就定稿了，`volumes` 行却是后建的，
 * 于是 `actual_last` 永远停在 `null` —— 只补事件不回填，老项目看起来和没修一样。
 */
export function refreshVolumeProgress(db: BetterSqlite3.Database): number {
  try {
    if (!hasVolumeStructureSchema(db)) return 0
    const volumes = listVolumes(db)
    if (!volumes.length) return 0
    let touched = 0
    for (const volume of volumes) {
      if (advanceVolume(db, volume.volumeId)) touched += 1
    }
    return touched
  } catch (error) {
    warn('refreshVolumeProgress', error)
    return 0
  }
}

/**
 * 从 `project_core` 重建卷 / 单元结构。
 *
 * 幂等：`rebuildVolumes` 只 upsert 计划列，`actual_*` 一列都不碰
 * （见 `volume-structure-repository.ts` 顶部不变量 1），重复调用不会把
 * 折算出来的 `planned_last` 抄成事实。
 *
 * @returns 重建结果摘要；架构尚未解析成卷时返回 `null`（不是错误）。
 */
export function syncVolumeStructureFromCore(db: BetterSqlite3.Database): {
  volumes: number
  warnings: string[]
} | null {
  try {
    if (!hasVolumeStructureSchema(db)) return null
    const core = ProjectCoreRepository.get(db)
    if (!core) return null
    // 没有卷 / 单元文本就没什么可投影的。**提前返回而不是让它去抛**
    // —— 空文本是正常状态（架构还没生成到这一步），不该在日志里留下"失败"。
    if (!core.plotStructurePlan?.trim() && !core.synopsis?.trim()) return null
    const result = rebuildVolumes(db, {
      plan: core.plotStructurePlan,
      synopsis: core.synopsis,
      totalChapters: core.totalChapters,
    })
    if (!result.volumes.length) return null
    for (const warning of result.warnings ?? []) {
      console.error(`[volume-structure-sync] rebuild 警告: ${warning}`)
    }
    // 重建只动计划列（`actual_*` 一列不碰），所以刚建出来的卷进度一定是空的。
    // 在这里立刻按正文对一遍，作者点完「重新解析」看到的就是真实进度，
    // 而不是「全都 0」再等他逐卷点「标记完成」。
    refreshVolumeProgress(db)
    return { volumes: result.volumes.length, warnings: result.warnings ?? [] }
  } catch (error) {
    warn('syncVolumeStructureFromCore', error)
    return null
  }
}

/**
 * 定稿之后推进「已定稿到第几章」。
 *
 * 只处理**该章所属的那一卷**：`chapterNumber` 落在
 * `[planned_first, 下一卷 planned_first)` 区间内的卷。其余卷不受影响 ——
 * 尤其不能顺手把后面那些卷也标了，那会把「还没写」变成「已写到」。
 *
 * @returns 被推进的卷数（0 表示这一章不属于任何已解析的卷，属正常情况）
 */
export function markVolumeProgressForChapter(
  db: BetterSqlite3.Database,
  chapterNumber: number,
): number {
  try {
    if (!hasVolumeStructureSchema(db)) return 0
    const volumes = listVolumes(db)
    if (!volumes.length) return 0

    let touched = 0
    for (let index = 0; index < volumes.length; index += 1) {
      const volume = volumes[index]!
      const first = volume.plannedFirst
      if (first === null) continue
      const nextFirst = volumes[index + 1]?.plannedFirst ?? null
      const inRange = chapterNumber >= first && (nextFirst === null || chapterNumber < nextFirst)
      if (!inRange) continue
      if (advanceVolume(db, volume.volumeId)) touched += 1
      break
    }
    return touched
  } catch (error) {
    warn('markVolumeProgressForChapter', error)
    return 0
  }
}
