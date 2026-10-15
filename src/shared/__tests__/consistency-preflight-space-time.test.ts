import { describe, expect, it } from 'vitest'
import { findBlueprintSpaceTimeRisks } from '../consistency-preflight'
import { findSpaceTimeConflicts } from '../space-time-consistency'

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
