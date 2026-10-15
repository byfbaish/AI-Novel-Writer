import type { ProjectSessionContext } from '../shared/ipc-channels'
import type {
  BlueprintForPreflight, ConsistencyExemption, ConsistencyFinding, ConsistencyPreflightCoverage,
} from '../shared/consistency-preflight'
import {
  describeSpaceTimeCoverage, findBlueprintContinuityRisks, findBlueprintSpaceTimeRisks,
} from '../shared/consistency-preflight'
import { normalizeSpaceRefs, parseSpaceRules } from '../shared/space-time-consistency'
import { ipc } from './ipc-client'

// 覆盖度的类型与格式化器在 shared（纯函数、可单测）；这里再导出，调用方只认一处入口。
export { describeSpaceTimeCoverage, type ConsistencyPreflightCoverage }

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
  const findings = (await Promise.all(blueprints.map(async blueprint => {
    const projections = await ipc.invokeWithProjectSession(
      session, 'db:continuity-list-before', blueprint.chapterNumber, session.projectPath,
    )
    return [
      ...findBlueprintContinuityRisks(projections, blueprint, exemptions),
      ...findBlueprintSpaceTimeRisks(worldBuildingText, blueprint, exemptions),
    ]
  }))).flat()
  const coverage: ConsistencyPreflightCoverage = {
    registeredSpaces: worldBuildingText === undefined ? null : parseSpaceRules(worldBuildingText).length,
    blueprintSpaceRefs: blueprints.reduce(
      (total, blueprint) => total + normalizeSpaceRefs(blueprint.structuredRefs).length, 0,
    ),
  }
  return { findings, exemptions, coverage }
}
