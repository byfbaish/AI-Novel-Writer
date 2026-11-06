import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import { globalEventBus } from '../../../shared/event-bus'
import {
  applySynopsisRouteSubmit,
  discardSynopsisCandidate,
  notifySynopsisCandidateDiscarded,
  SYNOPSIS_CANDIDATE_DISCARD_KEYS,
  synopsisCandidateDiscardPlan,
} from '../synopsis-candidate-discard'

/**
 * D8 第八轮：把「完成态记账不许被清」钉死。
 *
 * 事故模型：第七轮设计稿把 `synopsis_range` / `synopsis_result` 列进无条件清场键，
 * 而卷单元路线下一批续批要拿 `synopsis_range` 复算指纹（命令侧 :3516/:3532/:3944）。
 * 照那份清单实现 ⇒ 作者不再被残本堵，改被「续批检查点缺少上一批范围」堵，
 * 而且堵在 04:53 定死不许碰的反馈收敛链上。这里逐键验收。
 */

const doubles = vi.hoisted(() => ({
  invokeWithProjectSession: vi.fn(),
}))

vi.mock('../../ipc-client', () => ({
  ipc: { invokeWithProjectSession: doubles.invokeWithProjectSession },
}))

const projectSession = {
  projectPath: 'C:\\novels\\d8-discard',
} as unknown as ProjectSessionContext

/** 一份「上一批正常跑完」的检查点：这些键全是下一批要用的记账，不是残本。 */
const completedCheckpoint = {
  synopsis_result: '## 第10章：已经落库的正文',
  synopsis_incomplete: false,
  synopsis_covered_to: 10,
  synopsis_range: { from: 9, to: 10 },
  synopsis_unit_cursor: { volumeIndex: 1, unitIndex: 2, writtenInVolume: 10 },
  synopsis_volume_deviations: [{ volumeIndex: 1, planned: 30, actual: 10 }],
  synopsis_generation_handle: { runId: '上一批' },
  synopsis_facts_fingerprint: 'combined',
  synopsis_source_fingerprint: 'source',
  synopsis_template_fingerprint: 'template',
  synopsis_body_hash: 'body',
  synopsis_db_hash: 'db',
  synopsis_protocol: 'v1',
  synopsis_step_guidance: '写紧凑些',
  world_building_partial_result: '世界观候选，不许连坐',
}

function harness(read: unknown, writeOk = true) {
  const written: Record<string, unknown>[] = []
  doubles.invokeWithProjectSession.mockImplementation(async (_context: unknown, channel: string, ...rest: unknown[]) => {
    if (channel === 'fs:read-json') return read
    if (channel === 'fs:write-json') {
      if (!writeOk) return { success: false, error: 'EACCES' }
      written.push(rest[1] as Record<string, unknown>)
      return { success: true }
    }
    return { success: false }
  })
  return written
}

beforeEach(() => {
  doubles.invokeWithProjectSession.mockReset()
})

describe('synopsisCandidateDiscardPlan（纯函数）', () => {
  it('完成态 ⇒ 不写检查点（空操作），键集为空', () => {
    expect(synopsisCandidateDiscardPlan({ ...completedCheckpoint }))
      .toEqual({ discard: false, keys: [] })
    expect(synopsisCandidateDiscardPlan({})).toEqual({ discard: false, keys: [] })
    expect(synopsisCandidateDiscardPlan({ synopsis_incomplete: 'true' }))
      .toEqual({ discard: false, keys: [] })
  })

  it('中断态 ⇒ 只作废旗标 / handle / 残本正文，绝不碰下一批记账', () => {
    const incomplete = { ...completedCheckpoint, synopsis_incomplete: true }
    const plan = synopsisCandidateDiscardPlan(incomplete)
    expect(plan.discard).toBe(true)
    expect(plan.keys).toEqual([...SYNOPSIS_CANDIDATE_DISCARD_KEYS, 'synopsis_result'])
    for (const key of [
      'synopsis_range', 'synopsis_covered_to', 'synopsis_unit_cursor',
      'synopsis_volume_deviations', 'synopsis_facts_fingerprint',
      'synopsis_source_fingerprint', 'synopsis_template_fingerprint',
      'synopsis_body_hash', 'synopsis_db_hash', 'synopsis_protocol',
      'synopsis_step_guidance', 'world_building_partial_result',
    ]) expect(plan.keys).not.toContain(key)
  })

  it('mainOwned 形态（检查点里没有残本正文）⇒ 只删两个键', () => {
    const { synopsis_result: _unused, ...rest } = completedCheckpoint
    expect(synopsisCandidateDiscardPlan({ ...rest, synopsis_incomplete: true }).keys)
      .toEqual([...SYNOPSIS_CANDIDATE_DISCARD_KEYS])
  })
})

describe('discardSynopsisCandidate', () => {
  it('★ 完成态：一次 fs:write-json 都不发，上一批正文 / 范围 / 游标全部原样', async () => {
    const written = harness({ success: true, data: { ...completedCheckpoint } })
    expect(await discardSynopsisCandidate(projectSession)).toEqual({ ok: true, discarded: 0 })
    expect(written).toHaveLength(0)
    expect(doubles.invokeWithProjectSession.mock.calls.map(([, channel]) => channel))
      .toEqual(['fs:read-json'])
  })

  it('★ 中断态：只删三个键，`synopsis_range` 与全部进度 / 指纹 / 偏差账保留', async () => {
    const written = harness({ success: true, data: { ...completedCheckpoint, synopsis_incomplete: true } })
    expect(await discardSynopsisCandidate(projectSession)).toEqual({ ok: true, discarded: 3 })
    expect(written).toHaveLength(1)
    const next = written[0]
    expect(next).not.toHaveProperty('synopsis_incomplete')
    expect(next).not.toHaveProperty('synopsis_generation_handle')
    expect(next).not.toHaveProperty('synopsis_result')
    expect(next.synopsis_range).toEqual({ from: 9, to: 10 })
    expect(next.synopsis_covered_to).toBe(10)
    expect(next.synopsis_unit_cursor).toEqual(completedCheckpoint.synopsis_unit_cursor)
    expect(next.synopsis_volume_deviations).toEqual(completedCheckpoint.synopsis_volume_deviations)
    expect(next.synopsis_facts_fingerprint).toBe('combined')
    expect(next.synopsis_step_guidance).toBe('写紧凑些')
    expect(next.world_building_partial_result).toBe('世界观候选，不许连坐')
  })

  it('文件不存在 ⇒ 成功且空操作；文件读坏 ⇒ 不覆盖、报错', async () => {
    harness({ success: false, reason: 'missing' })
    expect(await discardSynopsisCandidate(projectSession)).toEqual({ ok: true, discarded: 0 })
    harness({ success: false, reason: 'invalid-json' })
    expect(await discardSynopsisCandidate(projectSession)).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('写盘失败 ⇒ 返回 ok:false（提交侧据此拦住本次生成）', async () => {
    harness({ success: true, data: { ...completedCheckpoint, synopsis_incomplete: true } }, false)
    expect(await discardSynopsisCandidate(projectSession)).toEqual({ ok: false, error: 'EACCES' })
  })
})

describe('applySynopsisRouteSubmit / notifySynopsisCandidateDiscarded', () => {
  it('提交清场后发一次界面失效事件（reason=submit）', async () => {
    harness({ success: true, data: { ...completedCheckpoint } })
    const seen: string[] = []
    const unsub = globalEventBus.on('SYNOPSIS_CANDIDATE_DISCARDED', payload => {
      seen.push(payload.reason ?? '')
      expect(payload.projectSession).toBe(projectSession)
    })
    try {
      await applySynopsisRouteSubmit(projectSession)
      expect(seen).toEqual(['submit'])
    } finally { unsub() }
  })

  it('清场失败 ⇒ 抛错且绝不发界面失效事件（没起 run 就别把屏幕上的稿清掉）', async () => {
    harness({ success: false, reason: 'invalid-json' })
    let emitted = false
    const unsub = globalEventBus.on('SYNOPSIS_CANDIDATE_DISCARDED', () => { emitted = true })
    try {
      await expect(applySynopsisRouteSubmit(projectSession)).rejects.toThrow('情节大纲候选清场失败')
      expect(emitted).toBe(false)
    } finally { unsub() }
  })

  it('★ 级联清空 = 读侧失效：只发事件，一次文件写入都不做（数据层照既有语义）', () => {
    const written = harness({ success: true, data: { ...completedCheckpoint } })
    const seen: string[] = []
    const unsub = globalEventBus.on('SYNOPSIS_CANDIDATE_DISCARDED', payload => {
      seen.push(payload.reason ?? '')
    })
    try {
      notifySynopsisCandidateDiscarded(projectSession)
      expect(seen).toEqual(['upstream-clear'])
      expect(written).toHaveLength(0)
      expect(doubles.invokeWithProjectSession).not.toHaveBeenCalled()
    } finally { unsub() }
  })
})
