import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import type { OutlineProgressGate } from '../../../shared/outline-progress-gate'
import { useLocaleStore } from '../../../stores/locale-store'
import OutlineProgressGatePanel from '../OutlineProgressGatePanel'

/**
 * 大纲领先正文的闸门面板（P1-2 期 1）。验收口径：
 * - 说清「上一卷停在第几章、还差几章」，因为作者要据此决定先去写正文还是继续铺大纲；
 * - **取消**：一个字都不写库，也不放行；
 * - **仍按计划继续**：写一条带理由的豁免（键 `outline-progress:<volumeId>`），然后才放行；
 * - 理由空 ⇒ 确认键禁用且零写入；写库失败 ⇒ 错误可见且不放行；
 * - **四档各说各的话**（D3，2026-11-06）：`prose-unfinalized` 讲还差几章、出口是「去补正文」；
 *   `handoff-missing` 讲「已定稿但没登记交接单」、出口是「去登记」；`handoff-stale` 讲
 *   「单过期、本次不用它」、出口是「去更新」；`handoff-unusable` 讲「单超预算、渲染成空节」、
 *   出口是「去精简」。四档共用同一套确认/豁免机制，不新增交互范式。
 * - **第一档内部还要分岔**：`handoff === 'usable'` 时投影用的是实际（只是部分定稿），
 *   不能说「只能基于计划」——`invalid` 组合同理（2026-11-06 独立复核抓出的自相矛盾）。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SESSION: ProjectSessionContext = {
  projectId: 'outline-gate-project',
  leaseId: 'outline-gate-lease',
  projectPath: 'C:\\synthetic\\outline-gate-project',
}

const GATE: OutlineProgressGate = {
  state: 'ahead',
  reason: 'prose-unfinalized',
  range: {
    volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
    first: 1, last: 20, basis: 'headings', actualLast: null,
  },
  authorityStatus: 'continuous',
  draftLastChapter: 12,
  missingChapters: 8,
  // 未定稿 + 没有交接单 = 第一档的常态形态（正文都没写完，交接单自然也谈不上可用）
  handoff: 'missing',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let saves: Array<[string, string]>
let saveReply: unknown

function button(label: string): HTMLButtonElement {
  const target = [...container.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`missing button ${label}`)
  return target as HTMLButtonElement
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

async function renderPanel(gate: OutlineProgressGate = GATE) {
  const onProceed = vi.fn()
  const onDismiss = vi.fn()
  await act(async () => {
    root.render(
      <OutlineProgressGatePanel
        gate={gate}
        projectSession={SESSION}
        onProceed={onProceed}
        onDismiss={onDismiss}
      />,
    )
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return { onProceed, onDismiss }
}

beforeEach(() => {
  vi.clearAllMocks()
  saves = []
  saveReply = { success: true }
  useLocaleStore.setState({ locale: 'zh-CN' })
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:consistency-exemption-save') {
      saves.push([String(args[0]), String(args[1])])
      return saveReply
    }
    throw new Error(`Unexpected IPC: ${channel}`)
  })
  Object.defineProperty(window, 'aiNovelAPI', {
    configurable: true,
    value: { invoke, on: vi.fn(), once: vi.fn(), send: vi.fn() },
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete (window as typeof window & { aiNovelAPI?: unknown }).aiNovelAPI
})

describe('大纲领先正文的闸门面板', () => {
  it('说清上一卷停在第几章、还差几章', async () => {
    await renderPanel()
    const reason = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(reason).toContain('第12章')
    expect(reason).toContain('还差 8 章')
    expect(reason).toContain('只能基于计划')
    // 没有「生成初稿」这个出口：缺的是正文，不是能当场生成的产物
    expect(container.textContent).not.toContain('生成初稿')
  })

  it('取消：一个字都不写，也不放行', async () => {
    const { onProceed, onDismiss } = await renderPanel()
    await click(button('取消，我先去补正文'))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onProceed).not.toHaveBeenCalled()
    expect(saves).toEqual([])
  })

  it('「我知道，仍按计划继续」写一条带理由的豁免，然后才放行', async () => {
    const { onProceed } = await renderPanel()
    await click(button('我知道，仍按计划继续'))
    expect(saves).toHaveLength(1)
    expect(saves[0]![0]).toBe('outline-progress:volume:1')
    expect(saves[0]![1]).toContain('第12章')
    expect(onProceed).toHaveBeenCalledOnce()
  })

  it('理由被清空 ⇒ 确认键禁用，一个字都不写', async () => {
    await renderPanel()
    const box = container.querySelector<HTMLTextAreaElement>('textarea')!
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(box, '   ')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(button('我知道，仍按计划继续').disabled).toBe(true)
    expect(saves).toEqual([])
  })

  it('写豁免失败 ⇒ 错误可见，不放行', async () => {
    saveReply = { success: false, error: '数据库只读' }
    const { onProceed } = await renderPanel()
    await click(button('我知道，仍按计划继续'))
    expect(onProceed).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('数据库只读')
  })

  it('账本有断章时说「按未定稿处理」，且**不许**同时说「还差 0 章」', async () => {
    await renderPanel({ ...GATE, authorityStatus: 'invalid', missingChapters: 0, draftLastChapter: 20 })
    const body = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(body).toContain('断章或重复')
    expect(body).toContain('按「未定稿」处理')
    // 复核对出来的自相矛盾：标题说「还没定稿」、正文却说「还差 0 章」
    expect(body).not.toContain('还差 0 章')
  })

  it('未定稿但交接单可用 ⇒ 说清「会用它，但只覆盖部分定稿」（不能再说只能基于计划）', async () => {
    await renderPanel({ ...GATE, handoff: 'usable' })
    const body = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(body).toContain('卷末交接单已经登记好了')
    expect(body).toContain('部分定稿')
    expect(body).not.toContain('只能基于计划')
  })

  it('账本有洞 + 交接单可用 ⇒ 也要承认「会用交接单」，不能只说拿不到结局', async () => {
    await renderPanel({ ...GATE, authorityStatus: 'invalid', handoff: 'usable', draftLastChapter: 20, missingChapters: 0 })
    const body = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(body).toContain('断章或重复')
    expect(body).toContain('卷末交接单已经登记好了')
    expect(body).not.toContain('拿不到这一卷的实际结局')
  })

  // ---- D3（2026-11-06）：正文写完了、但交接单不可用的两档 ----

  it('正文已定稿但没登记交接单 ⇒ 说「本卷只能用计划」，出口是「去登记交接单」', async () => {
    const { onDismiss } = await renderPanel({
      ...GATE,
      reason: 'handoff-missing',
      draftLastChapter: 20,
      missingChapters: 0,
      handoff: 'missing',
    })
    const body = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(body).toContain('已经整卷定稿')
    expect(body).toContain('没有登记卷末交接单')
    expect(body).toContain('只能基于卷纲计划')
    // 这一档不该再讲「还差几章」，也不该讲账本断章
    expect(body).not.toContain('还差')
    expect(body).not.toContain('断章或重复')
    await click(button('取消，我先去登记交接单'))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(saves).toEqual([])
  })

  it('交接单过期 ⇒ 标题与正文都说清「过期、不会使用它」，出口是「去更新交接单」', async () => {
    await renderPanel({
      ...GATE,
      reason: 'handoff-stale',
      draftLastChapter: 20,
      missingChapters: 0,
      handoff: 'stale',
    })
    expect(container.textContent).toContain('卷末交接单过期了')
    const body = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(body).toContain('更早写的')
    expect(body).toContain('不会使用它')
    expect(container.textContent).toContain('取消，我先去更新交接单')
  })

  it('交接单装不进预算 ⇒ 说「超过篇幅预算、渲染出来只剩空节」，出口是「去精简」', async () => {
    await renderPanel({
      ...GATE,
      reason: 'handoff-unusable',
      draftLastChapter: 20,
      missingChapters: 0,
      handoff: 'unusable',
    })
    expect(container.textContent).toContain('卷末交接单装不进去')
    const body = container.querySelector('[data-testid="outline-progress-gate-reason"]')?.textContent ?? ''
    expect(body).toContain('超过单份篇幅预算')
    expect(body).toContain('空节')
    expect(container.textContent).toContain('取消，我先去精简交接单')
  })

  it('这一档的确认理由默认值也不提「定稿至第N章」', async () => {
    await renderPanel({
      ...GATE, reason: 'handoff-missing', draftLastChapter: 20, missingChapters: 0, handoff: 'missing',
    })
    await click(button('我知道，仍按计划继续'))
    expect(saves).toHaveLength(1)
    expect(saves[0]![0]).toBe('outline-progress:volume:1')
    expect(saves[0]![1]).toContain('未登记卷末交接单')
    // 负断言：串档就会红（原版只断言了正向，实现若拼上「定稿至第20章」照样绿）
    expect(saves[0]![1]).not.toContain('定稿至第')
  })
})
