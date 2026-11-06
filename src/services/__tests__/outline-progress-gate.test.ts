import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../ipc-client', () => ({
  ipc: { invokeWithProjectSession: mocks.invoke },
}))

import { readOutlineProgressGate } from '../outline-progress-gate'
import type { VolumeDefinition } from '../../shared/volume-structure'

/**
 * D3（2026-11-06）：闸门第二维 —— 上一卷的交接单能不能用。
 *
 * 守的是「闸门说会用实际、投影却用计划」这类**两边各说各话**：判定口径必须与
 * `outline-prefix-context.ts` 一致（按卷号精确匹配、`stale` 视为不可用），
 * 否则提示本身就是新的谎言。
 */
const volume = (index: number, first: number, last: number): VolumeDefinition => ({
  volumeId: `volume:${index}`, volumeIndex: index, name: `第${index}卷`,
  plannedFirst: first, plannedLast: last, plannedSource: 'headings',
  actualLast: null, actualSource: null, outlineHash: `hash:${index}`, source: 'outline',
  createdAt: '', updatedAt: '',
})

const volumes = [volume(1, 1, 20), volume(2, 21, 40)]

const handoff = (over: Record<string, unknown> = {}) => ({
  handoffId: 'handoff:1', volumeId: 'volume:1', volumeIndex: 1,
  firstChapter: 1, lastChapter: 20, boundaryBasis: 'actual',
  worldState: '围城', heroState: '重伤', events: [], items: [], debts: [], openThread: '',
  source: 'author', createdAt: '', updatedAt: '',
  ...over,
})

const authority = (lastChapterNumber: number, status: 'continuous' | 'invalid' = 'continuous') =>
  ({ status, lastChapterNumber })

function mockChannels(input: {
  handoffs?: unknown
  exemptions?: unknown
  authority?: unknown
}) {
  mocks.invoke.mockImplementation((_session: unknown, channel: string) => {
    if (channel === 'db:volumes-list') return { success: true, volumes }
    if (channel === 'db:volume-handoffs-list') {
      return input.handoffs === undefined ? { success: true, entries: [] } : input.handoffs
    }
    if (channel === 'db:draft-authority-sequence') return input.authority ?? authority(20)
    if (channel === 'db:consistency-exemption-list') return input.exemptions ?? []
    return null
  })
}

const input = {
  projectSession: { projectPath: 'C:/p', projectId: 'p' } as never,
  /** 第 21 章 = 第 2 卷第一章 ⇒ 判第 1 卷。 */
  chapterNumber: 21,
}

beforeEach(() => { mocks.invoke.mockReset() })

describe('readOutlineProgressGate — 第二维（交接单可用性）', () => {
  it('正文已定稿 + 没有交接单 ⇒ handoff-missing', async () => {
    mockChannels({ handoffs: { success: true, entries: [] } })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('handoff-missing')
    expect(gate?.handoff).toBe('missing')
  })

  it('正文已定稿 + 交接单过期 ⇒ handoff-stale（不能算可用）', async () => {
    mockChannels({
      handoffs: {
        success: true,
        entries: [handoff({ validity: { state: 'stale', behind: [{ key: 'outline:book', have: 1, need: 2 }] } })],
      },
    })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.reason).toBe('handoff-stale')
  })

  it('正文已定稿 + 交接单可用 ⇒ aligned', async () => {
    mockChannels({ handoffs: { success: true, entries: [handoff()] } })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.state).toBe('aligned')
    expect(gate?.handoff).toBe('usable')
  })

  it('交接单在但六栏全空 ⇒ 按 missing 算（渲染是空节，投影仍走计划）', async () => {
    mockChannels({
      handoffs: {
        success: true,
        entries: [handoff({ worldState: '  ', heroState: '', events: [], items: [], debts: [], openThread: '' })],
      },
    })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.reason).toBe('handoff-missing')
  })

  it('只有别的卷的交接单 ⇒ missing，绝不回退到更早的卷', async () => {
    mockChannels({ handoffs: { success: true, entries: [handoff({ volumeId: 'volume:2', volumeIndex: 2 })] } })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.handoff).toBe('missing')
  })

  it('交接单表读失败 ⇒ unknown，不因这一维打扰（fail-open）', async () => {
    mockChannels({ handoffs: { success: false, error: '库忙' } })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.state).toBe('aligned')
    expect(gate?.handoff).toBe('unknown')
  })

  it('正文未定稿时第二维不改变结论：仍报 prose-unfinalized', async () => {
    mockChannels({ handoffs: { success: true, entries: [] }, authority: authority(12) })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.reason).toBe('prose-unfinalized')
    expect(gate?.missingChapters).toBe(8)
  })

  it('作者已确认过这一卷 ⇒ 两维都放行，不再弹', async () => {
    mockChannels({
      handoffs: { success: true, entries: [] },
      exemptions: [{ stableFactKey: 'outline-progress:volume:1', revoked: false }],
    })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.state).toBe('aligned')
  })

  it('撤销的确认不算数', async () => {
    mockChannels({
      handoffs: { success: true, entries: [] },
      exemptions: [{ stableFactKey: 'outline-progress:volume:1', revoked: true }],
    })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.state).toBe('ahead')
  })
})
