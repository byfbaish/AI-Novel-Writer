import type { ProjectSessionContext } from '../shared/ipc-channels'
import type { BlueprintForPreflight, ConsistencyExemption, ConsistencyFinding } from '../shared/consistency-preflight'
import { findBlueprintContinuityRisks, findBlueprintSpaceTimeRisks } from '../shared/consistency-preflight'
import { ipc } from './ipc-client'

export interface ConsistencyPreflightResult {
  findings: ConsistencyFinding[]
  exemptions: ConsistencyExemption[]
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
  return { findings, exemptions }
}
