import { describe, expect, it } from 'vitest'
import { arcTreeUnitCount, buildArcTree } from '../arc-tree'

// E4j-3：卷 / 单元 只读树。设计稿 §7A.1b。
const PLAN = [
  '# 卷 / 单元结构',
  '',
  '## 卷一：一句我马上到，整条巷门牌全歪了',
  '- 卷叙事任务：让读者看清第一句话是账单。',
  '',
  '### 单元一：老陈问还是老样子',
  '- 叙事任务：立规则。',
  '- 逼法：老陈用关心逼他接话 → 结束时变成按天标价（交手：堵门；档：关心→标价）',
  '',
  '### 单元二：鲁传福拿机器故障挡笔录',
  '- 叙事任务：把代价挪到鲁传福。',
  '- 逼法：沈砚要他写说明 → 结束时变成笔录落在他名下（交手：取证；档：标价→立卷）',
  '',
  '## 卷二：想销档案，先给观察科凑三处细节',
  '- 卷叙事任务：销档是拿三处细节换的。',
  '',
  '### 单元一：沈砚拿销档表',
  '- 叙事任务：把销档从愿望变成交易。',
  '- 逼法：沈砚拿销档表换配合 → 结束时变成按三处细节补时间线（交手：取证；档：立卷→债务）',
].join('\n')

describe('buildArcTree：卷 → 单元', () => {
  it('解析出 2 卷 3 单元，顺序与原文一致', () => {
    const tree = buildArcTree(PLAN)!
    expect(tree.volumes.map(v => v.index)).toEqual([1, 2])
    expect(tree.volumes.map(v => v.units.length)).toEqual([2, 1])
    expect(arcTreeUnitCount(tree)).toBe(3)
    expect(tree.volumes[0]!.units.map(u => u.name)).toEqual(['老陈问还是老样子', '鲁传福拿机器故障挡笔录'])
  })

  it('每个节点带原文行号，且卷/单元行号互不错位', () => {
    const tree = buildArcTree(PLAN)!
    const lines = PLAN.split('\n')
    for (const volume of tree.volumes) {
      expect(volume.line).not.toBeNull()
      expect(lines[volume.line!]!).toContain(volume.name)
      for (const unit of volume.units) {
        expect(unit.line).not.toBeNull()
        expect(lines[unit.line!]!).toContain(unit.name)
      }
    }
  })

  it('单元的交接手/档位从「逼法」标注里读出来', () => {
    const tree = buildArcTree(PLAN)!
    expect(tree.volumes[0]!.units[0]).toMatchObject({ hand: '堵门', tier: '关心→标价' })
    expect(tree.volumes[1]!.units[0]).toMatchObject({ hand: '取证', tier: '立卷→债务' })
  })

  it('没有标注的单元 hand/tier 为 null（不编）', () => {
    const noTag = PLAN.replace('（交手：堵门；档：关心→标价）', '')
    const tree = buildArcTree(noTag)!
    expect(tree.volumes[0]!.units[0]!.hand).toBeNull()
    expect(tree.volumes[0]!.units[0]!.tier).toBeNull()
  })

  it('两级结构标记为 true', () => {
    expect(buildArcTree(PLAN)!.twoLevel).toBe(true)
  })

  it('空文本 / 不可解析时返回 null（不渲染半棵树）', () => {
    expect(buildArcTree('')).toBeNull()
    expect(buildArcTree('   ')).toBeNull()
    expect(buildArcTree('一段没有标题的散文')).toBeNull()
    expect(buildArcTree(null)).toBeNull()
  })

  it('标题扫描与解析结果对不上时返回 null（安全兜底）', () => {
    // 人为塞一个多余的卷标题，但解析器会因为「没有单元」而丢掉它
    const broken = PLAN + '\n## 卷三：空的\n### 单元一：也没有\n- 叙事任务：x';
    // 这条其实解析得出来（有单元），所以用另一种破坏：只有标题没有单元
    expect(buildArcTree('## 卷一：只有标题\n- 卷叙事任务：x')).toBeNull()
    void broken
  })
})

describe('arcTreeUnitCount', () => {
  it('null 时为 0', () => {
    expect(arcTreeUnitCount(null)).toBe(0)
  })
})
