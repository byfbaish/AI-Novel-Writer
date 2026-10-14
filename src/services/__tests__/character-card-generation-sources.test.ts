import { describe, expect, it } from 'vitest'
import { blueprintCandidateNote, pendingBlueprintCandidates, selectedCharacterCardSources } from '../character-card-generation-sources'
import { attachSynthesisFallback, blueprintSourceNotes, parseCharacterBackgroundSynthesis } from '../workflows/commands/character-card-generation.command'
import type { CharacterProposalBatch } from '../../shared/character-proposal'

function syncOperation(blueprints: { chapterNumber: number; characters: string[]; newCharacterCandidates?: { name: string; role: string }[] }[]) {
  return [{ operationId: 'blueprint-sync-op', blueprintCommitOperationId: 'op', blueprintCommitPayloadHash: 'a'.repeat(64),
    status: 'pending' as const, startChapter: 1, endChapter: 9, characterSyncInput: blueprints as never,
    createdAt: '2026-01-01 00:00:00', updatedAt: '2026-01-01 00:00:00' }]
}

describe('Step 1 · 待建卡候选集', () => {
  it('只收 newCharacterCandidates，路人名不升级为候选', () => {
    const pending = pendingBlueprintCandidates(syncOperation([
      { chapterNumber: 3, characters: ['林岚', '茶馆小二'], newCharacterCandidates: [{ name: '林岚', role: 'supporting' }] },
    ]), [])
    expect(pending.map(candidate => candidate.name)).toEqual(['林岚'])
  })

  it('已在角色名单中的候选不再算待建', () => {
    const pending = pendingBlueprintCandidates(syncOperation([
      { chapterNumber: 3, characters: ['林岚', '周砚'], newCharacterCandidates: [{ name: '林岚', role: 'supporting' }, { name: '周砚', role: 'minor' }] },
    ]), ['林岚'])
    expect(pending.map(candidate => candidate.name)).toEqual(['周砚'])
  })

  it('跨批次去重并按章号排序，同一角色只出现一次', () => {
    const pending = pendingBlueprintCandidates(syncOperation([
      { chapterNumber: 7, characters: ['周砚'], newCharacterCandidates: [{ name: '周砚', role: 'minor' }] },
      { chapterNumber: 2, characters: ['周砚'], newCharacterCandidates: [{ name: '周砚', role: 'supporting' }] },
    ]), [])
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ chapterNumber: 2, name: '周砚' })
  })

  it('溯源笔记逐字包含章号', () => {
    expect(blueprintCandidateNote(7)).toBe('来源：第 7 章蓝图')
    const notes = blueprintSourceNotes([{ name: '周砚', chapterNumber: 7 }])
    expect(notes.get('周砚')).toBe('来源：第 7 章蓝图')
  })

  it('作者已登记为功能配角的名字不再算待建卡（否则这份派生清单永远清不空）', () => {
    const pending = pendingBlueprintCandidates(syncOperation([
      { chapterNumber: 1, characters: ['陈默', '老陈'], newCharacterCandidates: [{ name: '老陈', role: 'minor' }, { name: '赵启明', role: 'minor' }] },
    ]), [], ['老陈'])
    expect(pending.map(candidate => candidate.name)).toEqual(['赵启明'])
  })

  it('功能配角名单与名册走同一身份键归一化，空白差异不会漏排', () => {
    const pending = pendingBlueprintCandidates(syncOperation([
      { chapterNumber: 1, characters: ['老陈'], newCharacterCandidates: [{ name: '老陈', role: 'minor' }] },
    ]), [], [' 老陈 '])
    expect(pending).toEqual([])
  })
})

describe('Step 1 · 来源多选', () => {
  it('按固定顺序返回已选来源', () => {
    expect(selectedCharacterCardSources({ blueprint: true, premise: false, material: true, character: false }))
      .toEqual(['blueprint', 'material'])
    expect(selectedCharacterCardSources({ blueprint: false, premise: false, material: false, character: false }))
      .toEqual([])
  })
})

describe('Step 1 · 来源 D 解析', () => {
  it('解析 character + relationships 合同', () => {
    const parsed = parseCharacterBackgroundSynthesis(JSON.stringify({
      character: { name: '叶临川', role: 'supporting', personality: '冷静', background: '旧债未清' },
      relationships: [{ target: '沈舟', relation: '债主' }],
    }))
    expect(parsed.characterCard).toMatchObject({ name: '叶临川', role: 'supporting', personality: '冷静' })
    expect(parsed.relationships).toEqual([{ targetName: '沈舟', relation: '债主' }])
  })

  it('接受 relationshipCandidates 别名与顶层 character 形状', () => {
    const parsed = parseCharacterBackgroundSynthesis(JSON.stringify({
      name: '叶临川', role: 'minor', relationshipCandidates: [{ target: '沈舟', relation: '旧识' }],
    }))
    expect(parsed.characterCard.name).toBe('叶临川')
    expect(parsed.relationships).toEqual([{ targetName: '沈舟', relation: '旧识' }])
  })

  it('非法 role 被丢弃而不是写入非法枚举值', () => {
    const parsed = parseCharacterBackgroundSynthesis(JSON.stringify({ character: { name: '叶临川', role: 'cameo' } }))
    expect(parsed.characterCard.role).toBeUndefined()
  })

  it('缺少姓名或非 JSON 时拒绝', () => {
    expect(() => parseCharacterBackgroundSynthesis('{"character":{}}')).toThrow('CHARACTER_BACKGROUND_CONTRACT_INVALID')
    expect(() => parseCharacterBackgroundSynthesis('先说明：{"character":{"name":"X"}}。')).toThrow('CHARACTER_BACKGROUND_CONTRACT_INVALID')
  })

  it('字符串值里混入未转义引号时按语法容错解析（实机原始输出）', () => {
    // 本地 qwen 的真实输出：background 直接写了 "老陈记" —— 严格 JSON.parse 会失败，
    // 整条「为指定角色补全背景」流程因此报废（CHARACTER_BACKGROUND_CONTRACT_INVALID）。
    const raw = '{"character":{"name":"老陈","role":"supporting","background":"在梅林坳巷口经营"老陈记"早餐摊多年。","notes":"关怀全塞进那一勺辣子里。"},"relationships":[{"target":"陈默","relation":"熟客"}]}'
    const parsed = parseCharacterBackgroundSynthesis(raw)
    expect(parsed.characterCard.name).toBe('老陈')
    expect(parsed.characterCard.background).toContain('经营"老陈记"早餐摊多年')
    expect(parsed.relationships).toEqual([{ targetName: '陈默', relation: '熟客' }])
  })

  it('接受代码围栏包裹的 JSON', () => {
    const parsed = parseCharacterBackgroundSynthesis('```json\n{"character":{"name":"叶临川"}}\n```')
    expect(parsed.characterCard.name).toBe('叶临川')
  })

  it('关系不是数组时回落为空而不是崩溃', () => {
    const parsed = parseCharacterBackgroundSynthesis(JSON.stringify({ character: { name: '叶临川' }, relationships: '沈舟→债主' }))
    expect(parsed.relationships).toEqual([])
  })
})

describe('Step 1 · 来源 D 落卡回落', () => {
  const emptyBatch: CharacterProposalBatch = { proposalBatchId: 'cpb:x', revision: 0, status: 'pending-approval', items: [],
    source: { kind: 'directory', operationId: 'op' } }

  it('暂存未产出条目时用解析结果兜底，保证候选可见', () => {
    const parsed = parseCharacterBackgroundSynthesis(JSON.stringify({ character: { name: '叶临川', role: 'minor' } }))
    const batch = attachSynthesisFallback(emptyBatch, parsed)
    expect(batch.items).toHaveLength(1)
    expect(batch.items[0].fields.name).toBe('叶临川')
    expect(batch.items[0].resolution).toEqual({ status: 'unresolved', candidateIds: [] })
    // The frozen batch identity must survive the fallback untouched.
    expect(batch.proposalBatchId).toBe('cpb:x')
    expect(batch.source).toEqual({ kind: 'directory', operationId: 'op' })
  })

  it('暂存已有条目时不覆盖 AI 产出', () => {
    const parsed = parseCharacterBackgroundSynthesis(JSON.stringify({ character: { name: '叶临川' } }))
    const withItems = { ...emptyBatch, items: [{ selectionKey: 'k', sourceId: 's', fields: { name: 'AI 产出' }, relationships: [], resolution: { status: 'unresolved' as const, candidateIds: [] } }] }
    const batch = attachSynthesisFallback(withItems, parsed)
    expect(batch.items).toHaveLength(1)
    expect(batch.items[0].fields.name).toBe('AI 产出')
  })
})
