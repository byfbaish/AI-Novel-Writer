import { describe, expect, it } from 'vitest'

import type { GenerationBatchHistory } from '../../shared/generation-owner-contract'
import { evaluateBatchRecoveryGate, firstChapterWithoutDraft } from '../batch-interrupt-resume'

function makeBatch(overrides: Partial<GenerationBatchHistory> = {}): GenerationBatchHistory {
  return {
    batchId: '批次-12-14',
    rootHandle: { projectId: 'project', epoch: 'lease', rootActionId: '批次根', runId: '批次-12-14' },
    mode: 'draft_review',
    range: { startChapter: 12, endChapter: 14 },
    targetUnits: 900,
    modelId: 'model',
    authorInputs: [],
    completedChapters: [],
    nextChapterNumber: 13,
    sourceCurrent: true,
    ...overrides,
  }
}

describe('firstChapterWithoutDraft（重新开批的起始章）', () => {
  it('① 完全没有草稿 → 仍等于权威下一章', () => {
    expect(firstChapterWithoutDraft(12, [])).toBe(12)
  })

  it('② 权威下一章已有草稿（含草稿待审）→ 顺延到下一章', () => {
    expect(firstChapterWithoutDraft(12, [12])).toBe(13)
  })

  it('③ 连续多章有草稿 → 顺延到第一个空章', () => {
    expect(firstChapterWithoutDraft(12, [12, 13, 14])).toBe(15)
  })

  it('④ 有草稿但中间某章无草稿 → 停在该章，不跳到最大章号之后', () => {
    expect(firstChapterWithoutDraft(12, [12, 14, 15])).toBe(13)
  })

  it('权威下一章之前的草稿不改变起点', () => {
    expect(firstChapterWithoutDraft(12, [1, 10, 11])).toBe(12)
  })
})

describe('evaluateBatchRecoveryGate（继续此批次）', () => {
  it('① 进行中 / 暂停的批次 → 可继续，无出路文案', () => {
    for (const status of ['running', 'paused'] as const) {
      const gate = evaluateBatchRecoveryGate({ batch: makeBatch(), rootRunStatus: status })
      expect(gate).toEqual({ terminated: false, sourceChanged: false, canContinue: true, wayOut: null })
    }
  })

  it.each(['failed', 'cancelled', 'aborted'] as const)('② root run = %s → 阻断且给出路文案键与章号', status => {
    const gate = evaluateBatchRecoveryGate({ batch: makeBatch({ nextChapterNumber: 13 }), rootRunStatus: status })
    expect(gate.canContinue).toBe(false)
    expect(gate.terminated).toBe(true)
    expect(gate.wayOut).toEqual({ noticeKey: 'batch-terminated-reopen', chapterNumber: 13 })
  })

  it('③ 两条理由同时成立时各判各的，原提示不被终止判定覆盖', () => {
    const gate = evaluateBatchRecoveryGate({
      batch: makeBatch({ sourceCurrent: false, nextChapterNumber: 13 }),
      rootRunStatus: 'failed',
    })
    expect(gate.canContinue).toBe(false)
    expect(gate.sourceChanged).toBe(true)
    expect(gate.terminated).toBe(true)
    expect(gate.wayOut).toEqual({ noticeKey: 'batch-terminated-reopen', chapterNumber: 13 })
  })

  it('sourceCurrent=false 且批次进行中 → 只走原提示，不出现出路文案', () => {
    const gate = evaluateBatchRecoveryGate({ batch: makeBatch({ sourceCurrent: false }), rootRunStatus: 'running' })
    expect(gate.sourceChanged).toBe(true)
    expect(gate.terminated).toBe(false)
    expect(gate.canContinue).toBe(false)
    expect(gate.wayOut).toBeNull()
  })

  it('取不到 root run 状态 → 不擅自阻断，保持改动前行为', () => {
    const gate = evaluateBatchRecoveryGate({ batch: makeBatch(), rootRunStatus: undefined })
    expect(gate.canContinue).toBe(true)
    expect(gate.wayOut).toBeNull()
  })
})
