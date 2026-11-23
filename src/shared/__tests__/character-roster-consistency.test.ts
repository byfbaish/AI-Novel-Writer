import { describe, expect, it } from 'vitest'
import {
  CHARACTER_ROSTER_DRIFT_KEY_PREFIX,
  characterRosterDriftStableFactKey,
  findCharacterRosterRisks,
} from '../character-roster-consistency'

/**
 * AC1/S1：角色名册投影状态自洽（设计稿 §5 S1.1 裁定后形态）。
 *
 * 组织方式沿用 B′ 校验器的两类断言：
 * - **正向**：`status === 'inconsistent'` 确实要判，且键／章号／层级都对；
 * - **负向（更重要）**：其余三态、读不到快照、缺 factHash、没有可挂靠章号、
 *   已豁免 —— **一律不判**（fail-open，不产 info，不做「散文 vs 表」比对）。
 *
 * 被判对象只有快照里的 `status`，本模块**不重算任何哈希**。
 */
describe('findCharacterRosterRisks', () => {
  // #1 正向：inconsistent ⇒ 一条 warning，键不含章号，不带 sourceLayer
  it('status=inconsistent 时报一条 warning，键为 factHash 前缀形式', () => {
    const findings = findCharacterRosterRisks(
      { status: 'inconsistent', factHash: 'abc123' },
      { chapterNumber: 7 },
    )
    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding.severity).toBe('warning')
    expect(finding.sourceChapter).toBe(7)
    expect(finding.stableFactKey).toBe('roster:projection-drift:abc123')
    expect(finding.sourceLayer).toBeUndefined()
  })

  // #2 正向：同键豁免生效 ⇒ 不判
  it('同 stableFactKey 的未撤销豁免生效', () => {
    const findings = findCharacterRosterRisks(
      { status: 'inconsistent', factHash: 'abc123' },
      { chapterNumber: 7 },
      [{ stableFactKey: 'roster:projection-drift:abc123', reason: '刻意', revoked: false }],
    )
    expect(findings).toEqual([])
  })

  // #3 负向：已撤销的豁免不生效
  it('revoked=true 的豁免不生效', () => {
    const findings = findCharacterRosterRisks(
      { status: 'inconsistent', factHash: 'abc123' },
      { chapterNumber: 7 },
      [{ stableFactKey: 'roster:projection-drift:abc123', reason: '刻意', revoked: true }],
    )
    expect(findings).toHaveLength(1)
  })

  // #4 负向：ready ⇒ 不判（三哈希一致，没有可报的事）
  it('status=ready 时不判', () => {
    expect(findCharacterRosterRisks({ status: 'ready', factHash: 'abc123' }, { chapterNumber: 7 }))
      .toEqual([])
  })

  // #5 负向：empty ⇒ 不判（新项目还没名册，不是问题）
  it('status=empty 时不判', () => {
    expect(findCharacterRosterRisks({ status: 'empty', factHash: 'abc123' }, { chapterNumber: 7 }))
      .toEqual([])
  })

  // #6 负向：legacy_repair_required ⇒ 不判（迁移进行中，由迁移流程负责）
  it('status=legacy_repair_required 时不判', () => {
    expect(findCharacterRosterRisks(
      { status: 'legacy_repair_required', factHash: 'abc123' },
      { chapterNumber: 7 },
    )).toEqual([])
  })

  // #7 负向：读不到快照（IPC 失败 / 旧项目元数据未初始化）
  it('快照为 null / undefined 时不判', () => {
    expect(findCharacterRosterRisks(null, { chapterNumber: 7 })).toEqual([])
    expect(findCharacterRosterRisks(undefined, { chapterNumber: 7 })).toEqual([])
  })

  // #8 负向：缺 factHash ⇒ 不判（否则键会退化成空尾的前缀）
  it('缺 factHash 时不判', () => {
    expect(findCharacterRosterRisks({ status: 'inconsistent', factHash: '' }, { chapterNumber: 7 }))
      .toEqual([])
    expect(findCharacterRosterRisks(
      { status: 'inconsistent', factHash: undefined as unknown as string },
      { chapterNumber: 7 },
    )).toEqual([])
  })

  // #9 负向：没有可挂靠的章号 ⇒ 不判（sourceChapter 必填，塞 0 / 负数会污染面板）
  it('章号为 0 或负数时不判', () => {
    expect(findCharacterRosterRisks({ status: 'inconsistent', factHash: 'abc123' }, { chapterNumber: 0 }))
      .toEqual([])
    expect(findCharacterRosterRisks({ status: 'inconsistent', factHash: 'abc123' }, { chapterNumber: -1 }))
      .toEqual([])
  })

  // #10 键稳定性：同 factHash 下章号不同 ⇒ 键全等（一次豁免对全书生效）；factHash 前后空格被 trim
  it('同 factHash 不同章号的键全等，且 factHash 两端空白被 trim', () => {
    const [first] = findCharacterRosterRisks({ status: 'inconsistent', factHash: 'abc123' }, { chapterNumber: 3 })
    const [second] = findCharacterRosterRisks({ status: 'inconsistent', factHash: 'abc123' }, { chapterNumber: 9 })
    expect(first.stableFactKey).toBe(second.stableFactKey)
    expect(characterRosterDriftStableFactKey('  abc123  ')).toBe(`${CHARACTER_ROSTER_DRIFT_KEY_PREFIX}abc123`)
    expect(first.stableFactKey).toBe(characterRosterDriftStableFactKey('abc123'))
  })
})
