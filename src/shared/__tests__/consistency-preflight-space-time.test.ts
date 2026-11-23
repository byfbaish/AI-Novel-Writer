import { describe, expect, it } from 'vitest'
import { normalizeKeyEvents } from '../blueprint-key-events'
import {
  describeSpaceTimeCoverage, findBlueprintSlotAttackRisks, findBlueprintSpaceTimeRisks,
  findDuplicateSlotAttackRisks,
} from '../consistency-preflight'
import { findSlotAttackConflicts, findSpaceTimeConflicts } from '../space-time-consistency'

/**
 * T11：B′ 规则接进**既有预检关卡**（新增规则 ≠ 新增流程）。
 *
 * 这里只测「接线」的三件事：豁免生效、info 不进 finding、wordbuilding 缺失时 fail-open。
 * 判定本身（空间名、钟点包含、缺字段不判）由 `space-time-consistency.test.ts` 覆盖。
 */
const WORLD = [
  '### 4.【空间结构（地图与区域）】',
  '老陈记｜hours=07:00-09:00｜entry=直接进入',
  '市立图书馆｜hours=09:00-17:00｜entry=需刷闸机',
].join('\n')

describe('findBlueprintSpaceTimeRisks', () => {
  it('未登记的空间名 ⇒ warning，并带上冲突源层级', () => {
    const findings = findBlueprintSpaceTimeRisks(WORLD,
      { chapterNumber: 6, structuredRefs: [{ space: '查无此店', timeRef: '08:00' }] })
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', sourceChapter: 6, sourceLayer: 'blueprint' })
    expect(findings[0]!.suggestion.zhCN).toContain('世界观')
  })

  it('钟点越界 ⇒ warning', () => {
    const findings = findBlueprintSpaceTimeRisks(WORLD,
      { chapterNumber: 6, structuredRefs: [{ space: '老陈记', timeRef: '14:00' }] })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.issue.zhCN).toContain('07:00-09:00')
  })

  it('★ 接受存储列 JSON 串形态（真机读到的就是这一种）', () => {
    const findings = findBlueprintSpaceTimeRisks(WORLD,
      { chapterNumber: 6, structuredRefs: '[{"space":"老陈记","timeRef":"14:00"}]' })
    expect(findings).toHaveLength(1)
    expect(findings[0]!.sourceLayer).toBe('blueprint')
  })

  it('★ info 级不进 finding（「没有可判定形式」不是冲突，不该进审稿报告）', () => {
    // 车站只登记了 entry、没有 hours ⇒ 钟点不可判定；不得变成长度>0 的 finding 列表。
    const world = '车站｜entry=凭票进入'
    expect(findBlueprintSpaceTimeRisks(world,
      { chapterNumber: 1, structuredRefs: [{ space: '车站', timeRef: '08:00' }] })).toEqual([])
  })

  it('★ 豁免生效：按 stableFactKey 精确跳过（作者已填理由放行）', () => {
    const blueprint = { chapterNumber: 6, structuredRefs: [{ space: '老陈记', timeRef: '14:00' }] }
    const [finding] = findBlueprintSpaceTimeRisks(WORLD, blueprint)
    expect(finding).toBeTruthy()
    expect(findBlueprintSpaceTimeRisks(WORLD, blueprint,
      [{ stableFactKey: finding!.stableFactKey, reason: '刻意安排：闪回', revoked: false }])).toEqual([])
  })

  it('撤销的豁免不再放行', () => {
    const blueprint = { chapterNumber: 6, structuredRefs: [{ space: '老陈记', timeRef: '14:00' }] }
    const [finding] = findBlueprintSpaceTimeRisks(WORLD, blueprint)
    expect(findBlueprintSpaceTimeRisks(WORLD, blueprint,
      [{ stableFactKey: finding!.stableFactKey, reason: '旧理由', revoked: true }])).toHaveLength(1)
  })

  it('豁免键与其他规则的命名空间隔离（同一 stableFactKey 前缀不同）', () => {
    const [finding] = findBlueprintSpaceTimeRisks(WORLD,
      { chapterNumber: 1, structuredRefs: [{ space: '不存在', timeRef: '08:00' }] })
    expect(finding!.stableFactKey.startsWith('space:')).toBe(true)
  })

  it('★ fail-open：没有 worldbuilding（未推演架构 / 读取失败）⇒ 不判', () => {
    for (const world of [undefined, null, '', '   ', '只有散文，没有机读行。']) {
      expect(findBlueprintSpaceTimeRisks(world,
        { chapterNumber: 1, structuredRefs: [{ space: '老陈记', timeRef: '14:00' }] }), String(world)).toEqual([])
    }
  })

  it('★ fail-open：蓝图没有 structuredRefs ⇒ 不判', () => {
    for (const refs of [undefined, null, [], '[]', 'not json']) {
      expect(findBlueprintSpaceTimeRisks(WORLD, { chapterNumber: 1, structuredRefs: refs }), String(refs)).toEqual([])
    }
  })

  it('合法引用不产生 finding', () => {
    expect(findBlueprintSpaceTimeRisks(WORLD, {
      chapterNumber: 2,
      structuredRefs: [{ space: '老陈记', timeRef: '08:00' }, { space: '市立图书馆', timeRef: '10:00-16:00' }],
    })).toEqual([])
  })

  it('与校验器同源：warning 条数与 findSpaceTimeConflicts 的 warning 数一致', () => {
    const refs = '[{"space":"查无此店","timeRef":"08:00"},{"space":"老陈记","timeRef":"20:00"}]'
    const direct = findSpaceTimeConflicts({ chapterNumber: 8, worldBuildingText: WORLD, spaceRefs: refs })
      .filter(finding => finding.severity === 'warning')
    expect(findBlueprintSpaceTimeRisks(WORLD, { chapterNumber: 8, structuredRefs: refs })).toHaveLength(direct.length)
  })
})

/**
 * 缺陷 2 的补丁（2026-10-15）：静默 ≠ 通过。
 *
 * 实机场景：「世界观有机读行」与「本次根本没判」在界面上完全同形 —— 都是安静地继续写。
 * `describeSpaceTimeCoverage` 负责让前者说「已完成」、后者说「未参与判定 + 补救」。
 */
describe('describeSpaceTimeCoverage', () => {
  it('不带覆盖度 ⇒ 什么都不说（初始化路径不谎报）', () => {
    expect(describeSpaceTimeCoverage(undefined)).toBeUndefined()
  })

  it('★ 实机复现：世界观无机读行 ⇒ 明说「未参与判定」并给出补救', () => {
    const note = describeSpaceTimeCoverage({ registeredSpaces: 0, blueprintSpaceRefs: 0, registeredNamedPeople: 0, blueprintCharacterRefs: 0 })!
    expect(note.zhCN).toContain('未参与判定')
    expect(note.zhCN).toContain('hours=')
    expect(note.zhCN).toContain('重新生成世界观')
    expect(note.enUS).toContain('did not run')
  })

  it('设定层已登记、蓝图无结构化引用 ⇒ 指名是蓝图侧缺字段', () => {
    const note = describeSpaceTimeCoverage({ registeredSpaces: 2, blueprintSpaceRefs: 0, registeredNamedPeople: 0, blueprintCharacterRefs: 0 })!
    expect(note.zhCN).toContain('未参与判定')
    expect(note.zhCN).toContain('2 个空间')
    expect(note.zhCN).toContain('蓝图')
  })

  it('两侧都有 ⇒ 报「已完成」并带出覆盖量（作者能确证它真跑过）', () => {
    const note = describeSpaceTimeCoverage({ registeredSpaces: 3, blueprintSpaceRefs: 5, registeredNamedPeople: 0, blueprintCharacterRefs: 0 })!
    expect(note.zhCN).toContain('已完成')
    expect(note.zhCN).toContain('3 个空间')
    expect(note.zhCN).toContain('5 条蓝图引用')
    expect(note.zhCN).not.toContain('未参与判定')
  })

  it('设定层读取失败（null）与「一条都没登记」区分开', () => {
    const note = describeSpaceTimeCoverage({ registeredSpaces: null, blueprintSpaceRefs: 1, registeredNamedPeople: 0, blueprintCharacterRefs: 0 })!
    expect(note.zhCN).toContain('读取设定层失败')
    expect(note.zhCN).not.toContain('还没有可判定的机读行')
  })

  it('每条说明都有中英两版且非空', () => {
    for (const coverage of [
      { registeredSpaces: null, blueprintSpaceRefs: 0, registeredNamedPeople: 0, blueprintCharacterRefs: 0 },
      { registeredSpaces: 0, blueprintSpaceRefs: 0, registeredNamedPeople: 0, blueprintCharacterRefs: 0 },
      { registeredSpaces: 2, blueprintSpaceRefs: 0, registeredNamedPeople: 0, blueprintCharacterRefs: 0 },
      { registeredSpaces: 2, blueprintSpaceRefs: 3, registeredNamedPeople: 0, blueprintCharacterRefs: 0 },
    ]) {
      const note = describeSpaceTimeCoverage(coverage)!
      expect(note.zhCN.trim().length, JSON.stringify(coverage)).toBeGreaterThan(0)
      expect(note.enUS.trim().length, JSON.stringify(coverage)).toBeGreaterThan(0)
    }
  })
})

/**
 * attacks 族（FACT S2）的**接线**：豁免生效、撤销后仍报、设定层缺失时 R1/R2 fail-open
 * 但 R3 照判、不可判定不产 finding。判定本身由 `space-time-consistency.test.ts` 覆盖。
 */
const SLOT_WORLD = [
  '### 4.【空间结构（地图与区域）】',
  '老陈记｜hours=07:00-09:00｜entry=直接进入',
  '车站｜hours=none｜entry=凭票进入',
  '夜市｜hours=每月3日 21:00-22:00｜entry=自由进出',
].join('\n')

function slotEvents(chapterNumber: number, slots: { space: string; hour?: string }[]) {
  return normalizeKeyEvents(
    slots.map((slot, index) => ({
      event: `第 ${index + 1} 个事件`,
      attacks: { kind: 'slot', space: slot.space, ...(slot.hour === undefined ? {} : { hour: slot.hour }) },
    })),
    { chapterNumber },
  )
}

describe('findBlueprintSlotAttackRisks（R1/R2 接线）', () => {
  it('未登记的空间名 ⇒ warning，并带上冲突源层级与 slot: 键', () => {
    const findings = findBlueprintSlotAttackRisks(SLOT_WORLD,
      { chapterNumber: 6, keyEvents: slotEvents(6, [{ space: '查无此店', hour: '08:00' }]) })

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', sourceChapter: 6, sourceLayer: 'blueprint' })
    expect(findings[0]!.stableFactKey.startsWith('slot:')).toBe(true)
  })

  it('★ 豁免生效：按 stableFactKey 精确跳过', () => {
    const blueprint = { chapterNumber: 6, keyEvents: slotEvents(6, [{ space: '查无此店', hour: '08:00' }]) }
    const [finding] = findBlueprintSlotAttackRisks(SLOT_WORLD, blueprint)
    expect(finding).toBeTruthy()
    expect(findBlueprintSlotAttackRisks(SLOT_WORLD, blueprint,
      [{ stableFactKey: finding!.stableFactKey, reason: '刻意安排', revoked: false }])).toEqual([])
  })

  it('撤销的豁免不再放行', () => {
    const blueprint = { chapterNumber: 6, keyEvents: slotEvents(6, [{ space: '查无此店', hour: '08:00' }]) }
    const [finding] = findBlueprintSlotAttackRisks(SLOT_WORLD, blueprint)
    expect(findBlueprintSlotAttackRisks(SLOT_WORLD, blueprint,
      [{ stableFactKey: finding!.stableFactKey, reason: '旧理由', revoked: true }])).toHaveLength(1)
  })

  it('★ fail-open：worldBuildingText 缺失 / 无机读行 ⇒ R1/R2 一条都不判', () => {
    for (const world of [undefined, null, '', '只有散文，没有机读行。']) {
      expect(findBlueprintSlotAttackRisks(world,
        { chapterNumber: 1, keyEvents: slotEvents(1, [{ space: '查无此店', hour: '21:00' }]) }), String(world)).toEqual([])
    }
  })

  it('不可判定（hours=none / 按月窗口）⇒ 连 info 都不产，不进 finding 列表', () => {
    expect(findBlueprintSlotAttackRisks(SLOT_WORLD,
      { chapterNumber: 2, keyEvents: slotEvents(2, [{ space: '车站', hour: '21:00' }]) })).toEqual([])
    expect(findBlueprintSlotAttackRisks(SLOT_WORLD,
      { chapterNumber: 2, keyEvents: slotEvents(2, [{ space: '夜市', hour: '03:00' }]) })).toEqual([])
  })

  it('与校验器同源：warning 条数与 findSlotAttackConflicts 的 warning 数一致', () => {
    const keyEvents = slotEvents(8, [{ space: '查无此店', hour: '08:00' }, { space: '老陈记', hour: '20:00' }])
    const direct = findSlotAttackConflicts({ chapterNumber: 8, worldBuildingText: SLOT_WORLD, keyEvents })
      .filter(finding => finding.severity === 'warning')
    expect(findBlueprintSlotAttackRisks(SLOT_WORLD, { chapterNumber: 8, keyEvents })).toHaveLength(direct.length)
  })
})

describe('findDuplicateSlotAttackRisks（R3 接线）', () => {
  const ch3 = { chapterNumber: 3, keyEvents: slotEvents(3, [{ space: '老陈记', hour: '08:00' }]) }
  const ch7 = { chapterNumber: 7, keyEvents: slotEvents(7, [{ space: '老陈记', hour: '08:00' }]) }

  it('两章作废同一格 ⇒ 1 条 warning', () => {
    const findings = findDuplicateSlotAttackRisks([ch3, ch7])
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', sourceChapter: 7 })
  })

  it('★ 设定层缺失时 R1/R2 fail-open，但 R3 仍判（R3 只做跨章字面对账）', () => {
    expect(findBlueprintSlotAttackRisks(undefined,
      { chapterNumber: 7, keyEvents: ch7.keyEvents })).toEqual([])
    expect(findDuplicateSlotAttackRisks([ch3, ch7])).toHaveLength(1)
  })

  it('单章传入 ⇒ []', () => {
    expect(findDuplicateSlotAttackRisks([ch3])).toEqual([])
  })

  it('豁免生效：一次「我知悉」对该格永久生效（键不含章号）', () => {
    const [finding] = findDuplicateSlotAttackRisks([ch3, ch7])
    expect(findDuplicateSlotAttackRisks([ch3, ch7],
      [{ stableFactKey: finding!.stableFactKey, reason: '已知悉', revoked: false }])).toEqual([])
  })
})
