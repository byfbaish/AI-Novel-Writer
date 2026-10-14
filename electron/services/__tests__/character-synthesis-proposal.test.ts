import { describe, expect, it } from 'vitest'
import { characterSynthesisProposalItems } from '../generation-character-proposal-proof'

/**
 * 「为指定角色补全背景」这条路的形状合同。
 *
 * 实机背景（2026-10-15）：命令用 `inputKind: 'planning-material'` 暂存，而证明的分块分支
 * 要求运行 operation 必须是 `planning-material-character-extraction` ⇒ 该路的 stage
 * **从未成功过**（报 CHARACTER_PROPOSAL_SOURCE_INVALID，此前被解析错误挡在前面没暴露）。
 */
describe('单角色补全的候选重建', () => {
  it('从冻结产物重建一张卡，key/关系与渲染层同源', () => {
    const text = '{"character":{"name":"老陈","role":"supporting","background":"经营「老陈记」早餐摊多年。"},"relationships":[{"target":"陈默","relation":"熟客"}]}'
    const items = characterSynthesisProposalItems(text)
    expect(items).toHaveLength(1)
    expect(items[0].selectionKey).toBe('background:老陈')
    expect(items[0].sourceId).toBe('character-background:老陈')
    expect(items[0].fields).toMatchObject({ name: '老陈', role: 'supporting' })
    expect(items[0].relationships).toEqual([
      { targetName: '陈默', relation: '熟客', raw: { targetName: '陈默', relation: '熟客' } },
    ])
    // 原始产物整段保留，供审阅与溯源（rawValue 是 structuredClone 的快照）。
    expect((items[0].rawValue as { characterCard: { name: string } }).characterCard.name).toBe('老陈')
  })

  it('未转义引号的产物同样重建成功（与解析器容错共用一条路径）', () => {
    const text = '{"character":{"name":"老陈","background":"在梅林坳巷口经营"老陈记"早餐摊多年。"},"relationships":[]}'
    const items = characterSynthesisProposalItems(text)
    expect(items[0].fields).toMatchObject({ name: '老陈' })
    expect(items[0].relationships).toEqual([])
  })

  it('缺少姓名或非 JSON 时按契约拒绝（失败语义不变）', () => {
    expect(() => characterSynthesisProposalItems('{"character":{}}')).toThrow('CHARACTER_BACKGROUND_CONTRACT_INVALID')
    expect(() => characterSynthesisProposalItems('先说一句：{"character":{"name":"老陈"}}')).toThrow('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  })
})
