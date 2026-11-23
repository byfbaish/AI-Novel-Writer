import type { ProjectSessionContext } from '../shared/ipc-channels'
import type {
  BlueprintForPreflight, ConsistencyExemption, ConsistencyFinding, ConsistencyPreflightCoverage,
} from '../shared/consistency-preflight'
import {
  describeSpaceTimeCoverage, findBlueprintContinuityRisks, findBlueprintSlotAttackRisks,
  findBlueprintSpaceTimeRisks, findDuplicateSlotAttackRisks,
} from '../shared/consistency-preflight'
import { findCharacterRosterRisks } from '../shared/character-roster-consistency'
import { normalizeSpaceRefs, parseSpaceRules } from '../shared/space-time-consistency'
import {
  describeNamedEntityCoverage, findUnregisteredPersonRisks, parseNamedPersonRegistrations,
} from '../shared/named-registration-consistency'
import { ipc } from './ipc-client'

// 覆盖度的类型与格式化器在 shared（纯函数、可单测）；这里再导出，调用方只认一处入口。
export { describeSpaceTimeCoverage, type ConsistencyPreflightCoverage }
export { describeNamedEntityCoverage }

export interface ConsistencyPreflightResult {
  findings: ConsistencyFinding[]
  exemptions: ConsistencyExemption[]
  /**
   * 覆盖度。**可选** —— 「仅回填已保存豁免」的初始化路径（不判任何东西）不带它；
   * 只有真正跑过 `readConsistencyPreflight` 的结果才有。
   */
  coverage?: ConsistencyPreflightCoverage
}

export async function readConsistencyPreflight(
  session: ProjectSessionContext,
  blueprints: readonly BlueprintForPreflight[],
): Promise<ConsistencyPreflightResult> {
  const exemptions = await ipc.invokeWithProjectSession(
    session, 'db:consistency-exemption-list', session.projectPath,
  )
  /**
   * B′ 设定侧：机读行来自**架构产出的 `worldbuilding`**（AI 写的那份，T8 的模板要求它输出
   * 机读行），不是作者手写的 `worldSetting` —— 后者没有机读行。
   * 读取失败按「没有可判定形式」处理 ⇒ 校验器 fail-open 不判，绝不让一次读取失败阻断创作
   * （与既有 `findBlueprintContinuityRisks` 调用点的 catch 同一纪律）。
   */
  let worldBuildingText: string | undefined
  try {
    const core = await ipc.invokeWithProjectSession(session, 'db:project-core-get', session.projectPath)
    worldBuildingText = (core as { worldbuilding?: string } | null)?.worldbuilding
  } catch { worldBuildingText = undefined }
  /**
   * 角色台账只读**一次**，AC1 与 AC2 共用同一份快照（S4 收口要求：两笔各加一次读取，合并时并成一次）。
   * AC1/S1：角色名册投影状态。走既有 IPC 取主进程算好的 `status`，渲染层不重算哈希
   * （设计稿 `:201`）。读取失败（含旧项目 `角色名单元数据未初始化`）⇒ fail-open 不判，
   * 与上面 `worldbuilding` 的 try/catch 同一纪律。
   * AC2：角色台账只作**交叉核对**（裁定 2）。读不到就不判——登记块按规定只收位置锚定型配角，
   * 主角不在其中，台账缺失时只按登记行判会把主角全报成「未登记」（见实施包 §1.3）。
   */
  let rosterSnapshot: Parameters<typeof findCharacterRosterRisks>[0]
  let rosterNames: string[] | undefined
  try {
    const snapshot = await ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath)
    rosterSnapshot = snapshot
    rosterNames = (snapshot?.entries ?? []).map(entry => entry.name).filter(name => Boolean(name))
  } catch {
    rosterSnapshot = undefined
    rosterNames = undefined
  }
  const findings = [
    ...(await Promise.all(blueprints.map(async blueprint => {
      const projections = await ipc.invokeWithProjectSession(
        session, 'db:continuity-list-before', blueprint.chapterNumber, session.projectPath,
      )
      return [
        ...findBlueprintContinuityRisks(projections, blueprint, exemptions),
        ...findBlueprintSpaceTimeRisks(worldBuildingText, blueprint, exemptions),
        ...findBlueprintSlotAttackRisks(worldBuildingText, blueprint, exemptions),
        ...findUnregisteredPersonRisks(worldBuildingText, {
          chapterNumber: blueprint.chapterNumber,
          characterNames: blueprint.characters,
          rosterNames,
        }, exemptions),
        // P11-1 的「意图词命中 ⇒ 报缺 attacks」提醒**已撤下**（2026-10-30）。
        // 它判的是「文本里有没有作废类动词」，而合同要判的是「某一格有没有被改动」——
        // 既不充分也不必要（「名次作废」有词无格；「他推门进了茶楼」有格无词），
        // 且调用时不看 registeredSpaces，世界观没有可判定空间时也照弹。
        // 承接方见 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md`
        // 的「P11-1 撤下记录」：状态核对归 P11-3（水位 + 接地判定），字段自洽校验随 P11-4。
      ]
    }))).flat(),
    // attacks R3：同一格被两个不同章都声明为作废目标（跨章对账，不依赖设定层）。
    ...findDuplicateSlotAttackRisks(blueprints, exemptions),
    // AC1/S1：角色名册投影自洽。项目级事实一次只报一条，借当次审核的章号落到现有面板；
    // 无蓝图（blueprints 为空）时章号取 0，纯函数内部据此 fail-open 不判。
    ...findCharacterRosterRisks(
      rosterSnapshot, { chapterNumber: blueprints[0]?.chapterNumber ?? 0 }, exemptions,
    ),
  ]
  const coverage: ConsistencyPreflightCoverage = {
    registeredSpaces: worldBuildingText === undefined ? null : parseSpaceRules(worldBuildingText).length,
    blueprintSpaceRefs: blueprints.reduce(
      (total, blueprint) => total + normalizeSpaceRefs(blueprint.structuredRefs).length, 0,
    ),
    // AC2（射程 3：字段加在既有覆盖度上，名单空＝显式未判）
    registeredNamedPeople: worldBuildingText === undefined
      ? null : parseNamedPersonRegistrations(worldBuildingText).length,
    blueprintCharacterRefs: blueprints.reduce(
      (total, blueprint) => total + blueprint.characters.filter(name => Boolean(name?.trim())).length, 0,
    ),
  }
  return { findings, exemptions, coverage }
}
