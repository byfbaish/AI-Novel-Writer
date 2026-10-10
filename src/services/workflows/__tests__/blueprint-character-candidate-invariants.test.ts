import { describe, expect, it } from 'vitest'
import {
  BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST,
  decodeBlueprintSemanticPayload,
  normalizeBlueprintSemanticItem,
  parseBlueprintSemanticResponseText,
  validateBlueprintSemanticItem,
} from '../../../shared/blueprint-semantic-contract'
import {
  blueprintCharacterSyncFactError,
  type BlueprintCharacterSyncRosterFact,
} from '../../../shared/blueprint-character-sync-evidence'
import { syncBlueprintCharacterCandidates } from '../blueprint-character-sync'

/**
 * Step 0 guardrails for P1 (`docs/plans/p1-blueprint-roster-sync.md`).
 *
 * P1 only adds a trigger and a UI entry on top of the existing durability
 * skeleton. These tests freeze the candidate-set contract that the new entry
 * point will consume, so a later refactor cannot silently widen or weaken it.
 * No production code is exercised beyond the already-existing seams.
 */

function semanticItem(overrides: Record<string, unknown> = {}) {
  return {
    chapterNumber: 3,
    title: '第 3 章',
    role: 'setup',
    purpose: '建立关系',
    keyEvents: '两人相遇',
    characters: ['林岚', '周砚'],
    relationships: [],
    suspenseHook: '周砚的态度未明',
    ...overrides,
  }
}

describe('P1 · 蓝图新角色候选集契约（只读不变量）', () => {
  it('契约清单把 newCharacterCandidates 定为可选字段', () => {
    // newCharacterCandidates is intentionally absent from requiredFields: a
    // blueprint with no first-introduced recurring character is still valid.
    expect([...BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST.requiredFields]).not.toContain('newCharacterCandidates')
    expect([...BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST.requiredFields]).toContain('characters')
    expect(BLUEPRINT_SEMANTIC_CONTRACT_MANIFEST.characters).toMatchObject({ minimumItems: 1, unique: true })
  })

  it('缺省或不声明候选时回落为空数组，而不是报错', () => {
    const omitted = normalizeBlueprintSemanticItem(semanticItem())
    expect(omitted.newCharacterCandidates).toEqual([])

    const explicitEmpty = normalizeBlueprintSemanticItem(semanticItem({ newCharacterCandidates: [] }))
    expect(explicitEmpty.newCharacterCandidates).toEqual([])
  })

  it('候选名必须逐字出现在同项 characters 中', () => {
    const valid = normalizeBlueprintSemanticItem(semanticItem({
      newCharacterCandidates: [{ name: '周砚', role: 'supporting' }],
    }))
    expect(valid.newCharacterCandidates).toEqual([{ name: '周砚', role: 'supporting' }])

    // A near-miss alias instead of the exact declared name must be rejected:
    // the candidate set may never invent a name the chapter did not declare.
    const alias = validateBlueprintSemanticItem(semanticItem({
      newCharacterCandidates: [{ name: '阿砚', role: 'supporting' }],
    }))
    expect(alias).toBeDefined()
    expect(alias).toContain('newCharacterCandidates[0].name')
  })

  it('候选 role 只接受四个既定取值', () => {
    for (const role of ['protagonist', 'antagonist', 'supporting', 'minor']) {
      const accepted = normalizeBlueprintSemanticItem(semanticItem({
        newCharacterCandidates: [{ name: '周砚', role }],
      }))
      expect(accepted.newCharacterCandidates[0].role).toBe(role)
    }

    const rejected = validateBlueprintSemanticItem(semanticItem({
      newCharacterCandidates: [{ name: '周砚', role: 'cameo' }],
    }))
    expect(rejected).toBeDefined()
    expect(rejected).toContain('newCharacterCandidates[0].role')
  })

  it('同一项内重复声明同一候选会报重复项', () => {
    const duplicate = validateBlueprintSemanticItem(semanticItem({
      newCharacterCandidates: [
        { name: '周砚', role: 'supporting' },
        { name: '周砚', role: 'minor' },
      ],
    }))
    expect(duplicate).toBeDefined()
    expect(duplicate).toContain('duplicate')
  })

  it('候选集不要求同项的 characters 全部建卡（仅候选需建卡）', () => {
    // 林岚 has a card but is not a candidate; 周砚 is the only candidate.
    const roster: BlueprintCharacterSyncRosterFact[] = [
      { name: '林岚', relationships: [] },
      { name: '周砚', relationships: [] },
    ]
    const blueprints = [{ chapterNumber: 3, characters: ['林岚', '周砚'], newCharacterCandidates: [{ name: '周砚', role: 'supporting' as const }] }]
    expect(blueprintCharacterSyncFactError(blueprints, roster)).toBeUndefined()
  })

  it('候选缺少对应角色卡时给出可定位的错误，且不隐式建卡', () => {
    const roster: BlueprintCharacterSyncRosterFact[] = [{ name: '林岚', relationships: [] }]
    const blueprints = [{ chapterNumber: 3, characters: ['林岚', '周砚'], newCharacterCandidates: [{ name: '周砚', role: 'supporting' as const }] }]
    const error = blueprintCharacterSyncFactError(blueprints, roster)
    expect(error).toBeDefined()
    expect(error).toContain('周砚')
    expect(error).toContain('3')
  })

  it('仅出现在蓝图、未被声明为候选的一次性路人不得被要求建卡', () => {
    const roster: BlueprintCharacterSyncRosterFact[] = [{ name: '林岚', relationships: [] }]
    // 茶馆小二 is chapter-scoped scenery: not a candidate, so no card required.
    const blueprints = [{ chapterNumber: 3, characters: ['林岚', '茶馆小二'], newCharacterCandidates: [] }]
    expect(blueprintCharacterSyncFactError(blueprints, roster)).toBeUndefined()
  })

  it('身份比较忽略首尾空白，避免同一人分裂成两个候选', () => {
    const roster: BlueprintCharacterSyncRosterFact[] = [{ name: '周砚', relationships: [] }]
    const blueprints = [{ chapterNumber: 3, characters: ['周砚'], newCharacterCandidates: [{ name: ' 周砚 ', role: 'supporting' as const }] }]
    const normalized = normalizeBlueprintSemanticItem(semanticItem({
      characters: ['周砚'],
      newCharacterCandidates: [{ name: ' 周砚 ', role: 'supporting' }],
    }))
    expect(normalized.newCharacterCandidates[0].name).toBe('周砚')
    expect(blueprintCharacterSyncFactError(blueprints, roster)).toBeUndefined()
  })

  it('解码按章节号排序并拒绝缺失/越界章节', () => {
    const decoded = decodeBlueprintSemanticPayload({
      blueprints: [
        semanticItem({ chapterNumber: 4, characters: ['林岚'], newCharacterCandidates: [] }),
        semanticItem({ chapterNumber: 2, characters: ['林岚'], newCharacterCandidates: [] }),
      ],
    }, [2, 4])
    expect(decoded.map(item => item.chapterNumber)).toEqual([2, 4])

    expect(() => decodeBlueprintSemanticPayload({
      blueprints: [semanticItem({ chapterNumber: 2, characters: ['林岚'], newCharacterCandidates: [] })],
    }, [2, 4])).toThrow()
  })

  it('只接受单一 JSON 根或一个完整代码围栏，不从散文里抓 JSON', () => {
    const payload = { blueprints: [semanticItem({ characters: ['林岚'], newCharacterCandidates: [] })] }
    const fenced = parseBlueprintSemanticResponseText(
      '```json\n' + JSON.stringify(payload) + '\n```',
      [3],
    )
    expect(fenced).toHaveLength(1)

    expect(() => parseBlueprintSemanticResponseText(
      `先说明一下：\n${JSON.stringify(payload)}\n以上。`,
      [3],
    )).toThrow()
  })
})

describe('P1 · 落卡入口只认持久化 operationId', () => {
  it('渲染层缺 operationId 时拒绝暂存（名字不构成授权）', async () => {
    const session = { projectId: 'p', leaseId: 'l' }
    await expect(syncBlueprintCharacterCandidates(
      [{ chapterNumber: 1, characters: ['林岚'] }],
      '/tmp/project',
      session as never,
      '',
    )).rejects.toThrow('CHARACTER_PROPOSAL_DIRECTORY_OPERATION_REQUIRED')
  })

  it('持有 operationId 时只发 directory 来源，绝不把角色名当授权凭据', async () => {
    const invoke = viFn()
    const batch = await syncBlueprintCharacterCandidates(
      [{ chapterNumber: 1, characters: ['林岚', '周砚'], newCharacterCandidates: [{ name: '周砚', role: 'supporting' }] }],
      '/tmp/project',
      { projectId: 'p', leaseId: 'l' } as never,
      'blueprint-sync-op-1',
    )
    expect(batch).toMatchObject({ status: 'pending-approval' })
    const call = invoke.mock.calls.find(([channel]) => channel === 'character-proposal:stage')
    expect(call).toBeDefined()
    const request = call![1] as { source: unknown }
    expect(request.source).toEqual({ kind: 'directory', operationId: 'blueprint-sync-op-1' })
    // The candidate names must not leak into the authorizing request.
    expect(JSON.stringify(request)).not.toContain('周砚')
  })
})

/** Minimal spied `window.aiNovelAPI.invoke` harness, mirroring the production IPC shape. */
function viFn() {
  const calls: [string, ...unknown[]][] = []
  const invoke = (channel: string, ...args: unknown[]) => {
    calls.push([channel, ...args])
    if (channel === 'character-proposal:stage') {
      return Promise.resolve({
        proposalBatchId: 'cpb:test',
        revision: 0,
        status: 'pending-approval',
        items: [],
        source: (args[0] as { source: unknown }).source,
      })
    }
    return Promise.resolve({ success: true })
  }
  const stub = Object.assign(invoke, { mock: { calls } })
  ;(globalThis as { window?: unknown }).window = {
    aiNovelAPI: { invoke: stub, on: () => {}, once: () => {}, send: () => {} },
  }
  return stub
}
