import { describe, expect, it } from 'vitest'
import type { ModelProfile } from '../../../src/shared/ipc-channels'
import type { BeginGenerationRequest } from '../../../src/shared/generation-owner-contract'
import { newMainGenerationPolicy, readMainGenerationPolicy } from '../main-generation-plan'

// E3 T3（e3-unit-batch-implementation-plan.md §3）：
// 逐单元批次的根预算按「本卷剩余章数」冻结，不按 maxChapters × 1.1。
function model(): ModelProfile {
  return { id: '合成模型', name: '合成预算模型', provider: 'openai', protocol: 'openai', modelName: 'gpt-4.1',
    apiKey: '', baseUrl: 'https://api.openai.com/v1', temperature: 0.7, maxTokens: 8192, purposes: ['generation'] }
}

function selection(intent: Record<string, unknown>, totalChapters = 150): BeginGenerationRequest {
  return {
    operation: 'generate-plot-outline',
    uiActionNonce: 'unit',
    modelId: '合成模型',
    selectedDraftIds: [],
    selectedFinalizedDraftIds: [],
    promptKeys: [],
    skillStages: [],
    output: 'visible-text',
    authorInputs: [
      { id: 'architecture:author-config', text: JSON.stringify({ totalChapters }) },
      { id: 'architecture:planning-intent', text: JSON.stringify({ version: 'architecture-action-v1', priorSteps: [], synopsisRange: null, ...intent }) },
    ],
  }
}

const unit = (overrides: Record<string, unknown> = {}) =>
  ({ from: 11, unitIndex: 2, maxChapters: 5, volumeRemaining: 30, ...overrides })

describe('E3 逐单元批次：主进程预算', () => {
  it('单元模式：根预算按本卷剩余章数冻结（2 × 30 = 60 次）', () => {
    const policy = newMainGenerationPolicy(selection({ synopsisUnit: unit() }), model())
    expect(policy.planning).toMatchObject({ kind: 'architecture', intent: { synopsisRange: null, synopsisUnit: unit() } })
    expect(policy.budget.maxPhysicalRequests).toBe(60)
  })

  it('旧的章号区间模式不变：5 章仍落在基础 32 次内', () => {
    const policy = newMainGenerationPolicy(selection({ synopsisRange: { from: 1, to: 5 } }), model())
    expect(policy.planning).toMatchObject({ kind: 'architecture', intent: { synopsisRange: { from: 1, to: 5 } } })
    expect(policy.budget.maxPhysicalRequests).toBe(32)
  })

  it('两种形态并存 ⇒ 拒绝', () => {
    expect(() => newMainGenerationPolicy(selection({ synopsisRange: { from: 1, to: 5 }, synopsisUnit: unit() }), model()))
      .toThrow('GENERATION_PLANNING_INTENT_INVALID')
  })

  it('名义上界超过本卷剩余 ⇒ 拒绝', () => {
    expect(() => newMainGenerationPolicy(selection({ synopsisUnit: unit({ maxChapters: 31 }) }), model()))
      .toThrow('GENERATION_PLANNING_INTENT_INVALID')
  })

  it('本章 + 名义上界越过全书 ⇒ 拒绝', () => {
    expect(() => newMainGenerationPolicy(selection({ synopsisUnit: unit({ from: 148, maxChapters: 5 }) }, 150), model()))
      .toThrow('GENERATION_PLANNING_INTENT_INVALID')
  })

  it('非整数 / 越界字段 ⇒ 拒绝', () => {
    for (const broken of [unit({ from: 0 }), unit({ unitIndex: 0 }), unit({ maxChapters: 0 }), unit({ volumeRemaining: 0 }), unit({ from: 1.5 })]) {
      expect(() => newMainGenerationPolicy(selection({ synopsisUnit: broken }), model()))
        .toThrow('GENERATION_PLANNING_INTENT_INVALID')
    }
  })

  it('readMainGenerationPolicy 可回读单元模式策略（JSON 往返）', () => {
    const policy = newMainGenerationPolicy(selection({ synopsisUnit: unit() }), model())
    const roundTrip = readMainGenerationPolicy(JSON.parse(JSON.stringify(policy)))
    expect(roundTrip.planning).toMatchObject({ kind: 'architecture', intent: { synopsisUnit: unit() } })
    expect(roundTrip.budget).toEqual(policy.budget)
  })
})
