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
 * - 理由空 ⇒ 确认键禁用且零写入；写库失败 ⇒ 错误可见且不放行。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const SESSION: ProjectSessionContext = {
  projectId: 'outline-gate-project',
  leaseId: 'outline-gate-lease',
  projectPath: 'C:\\synthetic\\outline-gate-project',
}

const GATE: OutlineProgressGate = {
  state: 'ahead',
  range: {
    volumeId: 'volume:1', volumeIndex: 1, name: '第1卷',
    first: 1, last: 20, basis: 'headings', actualLast: null,
  },
  authorityStatus: 'continuous',
  draftLastChapter: 12,
  missingChapters: 8,
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

  it('账本有断章时额外说一句「按未定稿处理」，不让作者以为是还差几章', async () => {
    await renderPanel({ ...GATE, authorityStatus: 'invalid', missingChapters: 0 })
    expect(container.querySelector('[data-testid="outline-progress-gate-invalid"]')?.textContent)
      .toContain('断章或重复')
  })
})
