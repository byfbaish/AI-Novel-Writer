import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../ipc-client', () => ({
  ipc: { invokeWithProjectSession: mocks.invoke },
}))

import { readOutlinePrefixContext } from '../outline-prefix-context'
import type { VolumeDefinition } from '../../shared/volume-structure'

/**
 * P2-2 期 2：过期交接单**不注入**，但要留一句 warning。
 *
 * 这里守的是「早退分支不能排在判定之前」：原来的写法
 * `handoffResult?.success ? entries : []` 会把读失败静默成空表，
 * 而整块 `catch` 只返回 warning 字符串、不参与"要不要注入"。
 * 于是「读到了、但它是旧的」这条路径根本走不到 —— 现在它必须走到。
 *
 * 为什么不注入而不是拦截：这一节是给架构期当参考的（B 类，提示不阻断）。
 * 但注入一份基于旧大纲的跨卷事实比不注入更糟 —— 模型会当它是当前事实往下推。
 */
const volume = (index: number, first: number, last: number): VolumeDefinition => ({
  volumeId: `volume:${index}`, volumeIndex: index, name: `第${index}卷`,
  plannedFirst: first, plannedLast: last, plannedSource: 'headings',
  actualLast: null, actualSource: null, outlineHash: `hash:${index}`, source: 'outline',
  createdAt: '', updatedAt: '',
})

const volumes = [volume(1, 1, 20), volume(2, 21, 40), volume(3, 41, 60)]

const handoff = (over: Record<string, unknown> = {}) => ({
  handoffId: 'handoff:2', volumeId: 'volume:2', volumeIndex: 2,
  firstChapter: 21, lastChapter: 40, boundaryBasis: 'actual',
  worldState: '围城', heroState: '重伤', events: [], items: [], debts: [], openThread: '',
  source: 'author', createdAt: '', updatedAt: '',
  ...over,
})

function mockChannels(entries: unknown[]) {
  mocks.invoke.mockImplementation((_session: unknown, channel: string) => {
    if (channel === 'db:volumes-list') return { success: true, volumes }
    if (channel === 'db:volume-handoffs-list') return { success: true, entries }
    if (channel === 'db:draft-authority-sequence') return null
    return null
  })
}

const input = {
  projectSession: { projectPath: 'C:/p', projectId: 'p' } as never,
  expectedProjectPath: 'C:/p',
  volumeIndex: 3,
}

beforeEach(() => { vi.clearAllMocks() })

describe('readOutlinePrefixContext — 交接单过期', () => {
  it('过期 ⇒ 不注入并给出 warning（哪一域变了要说清楚）', async () => {
    mockChannels([handoff({
      validity: { state: 'stale', behind: [{ key: 'outline:book', have: 1, need: 2 }] },
    })])
    const context = await readOutlinePrefixContext(input)
    expect(context.previousHandoff).toBeNull()
    expect(context.warning).toContain('情节大纲')
  })

  it('没过期 ⇒ 照常注入，不留 warning', async () => {
    mockChannels([handoff({ validity: { state: 'valid' } })])
    const context = await readOutlinePrefixContext(input)
    expect(context.previousHandoff?.handoffId).toBe('handoff:2')
    expect(context.warning).toBeUndefined()
  })

  it('legacy（存量行没有来源记录）⇒ 照常注入：它不是"过期"，不该被吞掉', async () => {
    mockChannels([handoff({ validity: { state: 'legacy' } })])
    const context = await readOutlinePrefixContext(input)
    expect(context.previousHandoff?.handoffId).toBe('handoff:2')
  })

  it('读那一侧失败 ⇒ 静默成空表（fail-open，但只针对读失败）', async () => {
    mockChannels([])
    mocks.invoke.mockImplementation((_session: unknown, channel: string) => {
      if (channel === 'db:volumes-list') return { success: true, volumes }
      if (channel === 'db:volume-handoffs-list') return { success: false, error: 'boom' }
      return null
    })
    const context = await readOutlinePrefixContext(input)
    expect(context.previousHandoff).toBeNull()
  })
})
