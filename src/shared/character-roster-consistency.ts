import type { CharacterRosterSnapshot, CharacterRosterStatus } from './character-roster'
import type { ConsistencyExemption, ConsistencyFinding } from './consistency-preflight'

/**
 * AC1/S1（设计稿 §5 S1.1 裁定后形态）：角色**投影状态**的层内自洽。
 *
 * 校验对象是 `db:character-roster-read` 快照里的 `status`——它由主进程
 * `deriveRosterStatus()`（electron/repositories/character-roster-repository.ts:817）
 * 在读取时按「持久化三哈希 vs 实时事实」算出；渲染层不重算任何哈希
 * （设计稿 `:201`「二选一，禁止两处各判一遍」）。
 *
 * 不做「散文 vs 表」双向对比：`characters_arch` 是派生投影、不是真相源
 * （`:199`，主人 2026-11-23 裁定 1）。
 */
export const CHARACTER_ROSTER_DRIFT_KEY_PREFIX = 'roster:projection-drift:'

export function characterRosterDriftStableFactKey(factHash: string): string {
  return `${CHARACTER_ROSTER_DRIFT_KEY_PREFIX}${factHash.trim()}`
}

export interface CharacterRosterPreflightScope {
  /**
   * 当次审核的章节号。名册状态是**项目级**事实，但 `ConsistencyFinding.sourceChapter`
   * 必填、面板按章渲染（本卡不改面板），故借它落到现有报告；
   * stableFactKey **不含**章号，所以一次豁免对全书生效。
   */
  chapterNumber: number
}

export function findCharacterRosterRisks(
  snapshot: Pick<CharacterRosterSnapshot, 'status' | 'factHash'> | null | undefined,
  scope: CharacterRosterPreflightScope,
  exemptions: readonly ConsistencyExemption[] = [],
): ConsistencyFinding[] {
  // fail-open：读不到快照、缺 status、缺 factHash、没有可挂靠的章号 —— 一律不判。
  if (!snapshot) return []
  const status: CharacterRosterStatus | undefined = snapshot.status
  if (status !== 'inconsistent') return []
  const factHash = typeof snapshot.factHash === 'string' ? snapshot.factHash.trim() : ''
  if (!factHash) return []
  if (!Number.isInteger(scope.chapterNumber) || scope.chapterNumber <= 0) return []

  const stableFactKey = characterRosterDriftStableFactKey(factHash)
  const activeExemptions = new Set(
    exemptions.filter(exemption => !exemption.revoked).map(exemption => exemption.stableFactKey),
  )
  if (activeExemptions.has(stableFactKey)) return []

  return [{
    stableFactKey,
    severity: 'warning' as const,
    sourceChapter: scope.chapterNumber,
    evidence: `角色名册投影状态=inconsistent（factHash ${factHash.slice(0, 8)}…）：名册投影与表内角色事实不一致——可能是三哈希不符，也可能是迁移态（旧角色卡／旧 Markdown）尚未收尾。`,
    issue: {
      zhCN: '角色名册的派生投影与表内角色事实不一致：改过角色卡、结构化关系或动态状态后投影没有刷新，或旧项目的名单迁移还没收尾，下游读到的是过时的人物群像。',
      enUS: 'The derived character roster projection is out of sync with the character facts in the table: either the projection was not refreshed after an edit, or a legacy roster migration is still unfinished.',
    },
    suggestion: {
      zhCN: '到「角色管理」核对名单：界面提示迁移未收尾的，先按提示修完迁移（旧角色卡保留／旧 Markdown 待重建两种情形处理方式不同）；迁移已就绪或没有提示的，提交一次名单，由提交重建投影与其哈希。',
      enUS: 'Open Character Management and review the roster: if the UI reports an unfinished legacy migration, finish it first (preserved cards and pending legacy Markdown are repaired differently); otherwise submit the roster once and the commit rebuilds the projection and its hashes.',
    },
  }]
}
