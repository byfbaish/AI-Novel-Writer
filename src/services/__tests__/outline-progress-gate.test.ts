import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../ipc-client', () => ({
  ipc: { invokeWithProjectSession: mocks.invoke },
}))

import { readOutlineProgressGate } from '../outline-progress-gate'
import type { VolumeHandoffDefinition } from '../../shared/volume-handoff'
import { renderVolumeHandoffSection, VOLUME_HANDOFF_MAX_CHARS } from '../../shared/volume-handoff'
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

const handoff = (over: Record<string, unknown> = {}): VolumeHandoffDefinition => ({
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
  /** `db:project-core-get` 的返回；`undefined` ⇒ 返回 `null`（模拟读失败/老库）。 */
  core?: unknown
  volumesState?: string
}) {
  mocks.invoke.mockImplementation(async (_session: unknown, channel: string) => {
    if (channel === 'db:volumes-list') {
      return { success: true, state: input.volumesState, volumes }
    }
    if (channel === 'db:volume-handoffs-list') {
      return input.handoffs === undefined ? { success: true, entries: [] } : input.handoffs
    }
    if (channel === 'db:draft-authority-sequence') return input.authority ?? authority(20)
    if (channel === 'db:consistency-exemption-list') return input.exemptions ?? []
    if (channel === 'db:project-core-get') return input.core ?? null
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

  it('交接单有内容但装不进篇幅预算 ⇒ unusable，不是 usable（复核抓的缝隙）', async () => {
    // 单条 1,600 字：六栏非空 ⇒ 旧实现会判 usable，但 renderVolumeHandoffSection 会整条丢、
    // 渲染成空节，投影仍走 plan。这一档就是为它存在的。
    mockChannels({ handoffs: { success: true, entries: [handoff({ worldState: '灰'.repeat(1600) })] } })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.reason).toBe('handoff-unusable')
    expect(gate?.handoff).toBe('unusable')
  })

  it('「usable ⟺ 投影能渲染出内容」这条等价式本身也要钉住', async () => {
    // 闸门与投影必须同一个真值：投影的判据是 renderVolumeHandoffSection(...) !== ''，
    // 这里反过来验证「判决 usable 的那张单，渲染一定非空」。
    const usable = handoff()
    mockChannels({ handoffs: { success: true, entries: [usable] } })
    const ok = await readOutlineProgressGate(input)
    expect(ok.gate?.handoff).toBe('usable')
    expect(renderVolumeHandoffSection(usable, 'zh-CN', 21, VOLUME_HANDOFF_MAX_CHARS)).not.toBe('')

    const tooLong = handoff({ worldState: '灰'.repeat(1600) })
    mockChannels({ handoffs: { success: true, entries: [tooLong] } })
    const bad = await readOutlineProgressGate(input)
    expect(bad.gate?.handoff).toBe('unusable')
    expect(renderVolumeHandoffSection(tooLong, 'zh-CN', 21, VOLUME_HANDOFF_MAX_CHARS)).toBe('')
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

  it('交接单通道抛异常 ⇒ 也不能把第一维一起吞掉（复核抓的回归面）', async () => {
    // 第四路读单独 catch：否则 Promise.all 整体 reject，连「正文没写完」都报不出来。
    mocks.invoke.mockImplementation(async (_session: unknown, channel: string) => {
      if (channel === 'db:volumes-list') return { success: true, volumes }
      if (channel === 'db:volume-handoffs-list') throw new Error('handler 未注册')
      if (channel === 'db:draft-authority-sequence') return authority(12)
      if (channel === 'db:consistency-exemption-list') return []
      return null
    })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.reason).toBe('prose-unfinalized')
    expect(gate?.missingChapters).toBe(8)
  })

  it('卷表 stale ⇒ 照判，不再整体短路（修法 C，D21）', async () => {
    // 原来这里断言 `gate === null`（「判不出就不拦」）—— 那正是 D21 的静默放行：
    // 改过大纲没重建卷结构是**正常状态**，闸门在最常见的状态下闭嘴。
    mockChannels({
      volumesState: 'stale',
      handoffs: {
        success: true,
        entries: [handoff({ validity: { state: 'stale', behind: [{ key: 'outline:book', have: 1, need: 2 }] } })],
      },
    })
    const result = await readOutlineProgressGate(input)
    expect(result.gate?.state).toBe('ahead')
    expect(result.gate?.reason).toBe('handoff-stale')
    expect(result.gate?.structureStale).toBe(true)
    // 拿不到 project_core（老库 / 读失败）⇒ 退回表边界，但必须如实标注来源
    expect(result.gate?.boundarySource).toBe('table')
    expect(result.warning).toContain('stale')
  })

  it('卷表 unparsed ⇒ 仍判不出（连卷行都没有，判也无从判）', async () => {
    mockChannels({ volumesState: 'unparsed' })
    const result = await readOutlineProgressGate(input)
    expect(result.gate).toBeNull()
    expect(result.warning).toContain('unparsed')
  })

  it('卷表 stale + 当前大纲能物化 ⇒ 用现算边界，不用旧表边界', async () => {
    // 表说第 1 卷 1–20（旧），当前大纲说第 1 卷只到第 8 章 ⇒ 本批起点应是第 9 章。
    mockChannels({
      volumesState: 'stale',
      core: {
        plotStructurePlan: '# 卷 / 单元结构\n\n## 卷一：杂役处\n### 单元一：挨一脚\n## 卷二：百草园\n### 单元一：进园\n',
        synopsis: '## 第1卷第1单元第1章（全书第1章）：起\n\n## 第1卷第1单元第8章（全书第8章）：止\n\n'
          + '## 第2卷第1单元第1章（全书第9章）：进园\n\n## 第2卷第1单元第7章（全书第15章）：出园\n',
        totalChapters: 0,
      },
      authority: authority(20),
    })
    const result = await readOutlineProgressGate({ ...input, chapterNumber: 9 })
    expect(result.gate?.boundarySource).toBe('live')
    expect(result.gate?.structureStale).toBe(true)
    // 现算：第 1 卷 = 1–8；正文定稿到 20 ⇒ 这一维过了，交接单缺失才是原因
    expect(result.gate?.range.last).toBe(8)
    expect(result.gate?.reason).toBe('handoff-missing')
    expect(result.warning).toBeUndefined()
  })

  it('project_core 通道抛异常 ⇒ 退回表边界，且不吞掉其它结论', async () => {
    mocks.invoke.mockImplementation(async (_session: unknown, channel: string) => {
      if (channel === 'db:volumes-list') return { success: true, state: 'stale', volumes }
      if (channel === 'db:volume-handoffs-list') return { success: true, entries: [] }
      if (channel === 'db:draft-authority-sequence') return authority(12)
      if (channel === 'db:consistency-exemption-list') return []
      if (channel === 'db:project-core-get') throw new Error('handler 未注册')
      return null
    })
    const result = await readOutlineProgressGate(input)
    expect(result.gate?.reason).toBe('prose-unfinalized')
    expect(result.gate?.missingChapters).toBe(8)
    expect(result.gate?.boundarySource).toBe('table')
    expect(result.warning).toContain('旧表边界')
  })

  it('旧确认压不住过期提醒（过期优先于已确认）', async () => {
    // 确认是对某一版上游的确认；上游改了以后那次确认描述的现实已经不在。
    mockChannels({
      handoffs: {
        success: true,
        entries: [handoff({ validity: { state: 'stale', behind: [{ key: 'outline:book', have: 1, need: 2 }] } })],
      },
      exemptions: [{ stableFactKey: 'outline-progress:volume:1', revoked: false }],
    })
    const { gate } = await readOutlineProgressGate(input)
    expect(gate?.state).toBe('ahead')
    expect(gate?.reason).toBe('handoff-stale')
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
