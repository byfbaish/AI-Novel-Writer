import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConsistencyExemption } from '../../../shared/consistency-preflight'
import type { SecretDefinition } from '../../../shared/secret'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { SecretGuardDisposition } from '../SecretGuardDisposition'

/**
 * 审稿报告里的「秘密守卫处置」块（2026-10-26 作者要求）。
 *
 * 这个块存在的理由：审稿员判「本章写出了真相」是对的，但作者可能是**故意**提前揭穿，
 * 或者真相已人尽皆知。没有出口，作者只能每章看着同一条问题重复出现，最后无视整个守卫节。
 *
 * 钉住的边界：
 * 1. **期界先于豁免** —— 已揭穿的秘密不在这里出现（否则作者会以为豁免把他从「已揭穿」捞回来了）；
 * 2. 临时豁免写的是 `secret-exempt:<id>#ch<N>`，永久豁免写的是 `secret-exempt:<id>`，两者不能混；
 * 3. 临时豁免必须显示「欠一条知情登记 + 名单」—— 知情登记本阶段写不进库（定稿前没有逐字引文）；
 * 4. 没有可守卫的秘密时**整块不渲染**，不给每份审稿报告加噪音；
 * 5. 章号缺失/非法时整块不渲染（章级豁免没有章号就是错键）。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'secret-project',
  leaseId: 'secret-lease',
  projectPath: 'C:\\synthetic\\secret-project',
}

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: SecretDefinition[]
let exemptions: ConsistencyExemption[]
let saveOutcome: { success: boolean; error?: string }

function definition(overrides: Partial<SecretDefinition> = {}): SecretDefinition {
  return {
    secretId: 'secret:trial',
    title: '柳长老拿弟子试药',
    detail: '试药房里的残篇是从外门弟子身上取的',
    holders: ['柳长老'],
    unaware: ['众弟子'],
    revealChapter: 40,
    evidence: '',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="secret-guard-row"]')]
}

function row(title: string): HTMLElement {
  const target = rows().find(node => node.textContent?.includes(title))
  if (!target) throw new Error(`Missing guard row ${title}`)
  return target
}

function button(label: string, scope: HTMLElement = container): HTMLButtonElement {
  const target = [...scope.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

/** 注意：没有默认参数。`render(undefined)` 必须真的是「章号缺失」，否则这条测试会静默退化成 30。 */
async function render(chapterNumber: number | undefined) {
  await act(async () => {
    root.render(<SecretGuardDisposition projectKey={session.projectPath} chapterNumber={chapterNumber} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  // 章号非法时组件在挂载阶段就返回 null，**不会**发任何 IPC —— 所以只在章号合法时等这一次调用。
  if (Number.isSafeInteger(chapterNumber) && (chapterNumber ?? 0) > 0) {
    await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:secrets-list')).toBe(true))
  }
  // 让 load() 的 setState 落地
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

function saveCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:consistency-exemption-save')
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  exemptions = []
  saveOutcome = { success: true }
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '秘密测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:secrets-list') return { success: true, entries: stored }
    if (channel === 'db:consistency-exemption-list') return exemptions
    if (channel === 'db:consistency-exemption-save') {
      if (!saveOutcome.success) return saveOutcome
      const key = String(args[0])
      exemptions = [...exemptions, { stableFactKey: key, reason: String(args[1]), revoked: false }]
      return { success: true }
    }
    if (channel === 'db:consistency-exemption-revoke') {
      const key = String(args[0])
      exemptions = exemptions.map(entry => (entry.stableFactKey === key ? { ...entry, revoked: true } : entry))
      return { success: true }
    }
    throw new Error(`Unexpected IPC ${channel}`)
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
  setActiveProjectSessionContext(null)
  delete (window as typeof window & { aiNovelAPI?: unknown }).aiNovelAPI
})

describe('秘密守卫处置（审稿报告内）', () => {
  it('有可守卫的秘密 ⇒ 列出秘密与计划揭穿章，默认「照常守卫」', async () => {
    stored = [definition()]
    await render(30)
    expect(container.textContent).toContain('秘密守卫处置（第 30 章）')
    expect(rows()).toHaveLength(1)
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('none')
    expect(row('柳长老拿弟子试药').textContent).toContain('计划揭穿：第 40 章')
  })

  it('★ 期界先于豁免：已揭穿的秘密不出现（豁免不是把「已揭穿」捞回来的手段）', async () => {
    stored = [definition({ revealChapter: 9 })]
    await render(30)
    expect(rows()).toHaveLength(0)
    expect(container.textContent).not.toContain('秘密守卫处置')
  })

  it('临时豁免 ⇒ 写章级键，并显示「欠一条知情登记 + 名单」', async () => {
    stored = [definition()]
    await render(30)
    await click(button('临时豁免本章', row('柳长老拿弟子试药')))

    expect(saveCalls()).toHaveLength(1)
    expect(saveCalls()[0]!.slice(0, 2)).toEqual([
      'db:consistency-exemption-save', 'secret-exempt:secret:trial#ch30',
    ])
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('chapter')
    expect(row('柳长老拿弟子试药').textContent).toContain('已临时豁免（本章）')
    expect(row('柳长老拿弟子试药').textContent).toContain('欠一条知情登记：柳长老、众弟子 从第 30 章起知道')
  })

  it('永久豁免 ⇒ 写秘密级键（不带章号），并给撤销入口', async () => {
    stored = [definition()]
    await render(30)
    await click(button('永久豁免', row('柳长老拿弟子试药')))

    expect(saveCalls()).toHaveLength(1)
    expect(saveCalls()[0]!.slice(0, 2)).toEqual([
      'db:consistency-exemption-save', 'secret-exempt:secret:trial',
    ])
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('permanent')
    expect(button('撤销豁免', row('柳长老拿弟子试药'))).toBeTruthy()
  })

  it('撤销 ⇒ 撤销的正是生效的那个键（临时撤销章级、永久撤销秘密级）', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial#ch30', reason: 'x', revoked: false }]
    await render(30)
    await click(button('撤销豁免', row('柳长老拿弟子试药')))
    const revokeCalls = invoke.mock.calls.filter(([channel]) => channel === 'db:consistency-exemption-revoke')
    expect(revokeCalls[0]!.slice(0, 2)).toEqual(['db:consistency-exemption-revoke', 'secret-exempt:secret:trial#ch30'])
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('none')
  })

  it('章级豁免只在被免的那一章显示为已豁免；下一章回到照常守卫', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial#ch30', reason: 'x', revoked: false }]
    await render(30)
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('chapter')

    await act(async () => {
      root.render(<SecretGuardDisposition projectKey={session.projectPath} chapterNumber={31} />)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('none')
  })

  it('没有登记秘密 ⇒ 整块不渲染（不给每份审稿报告加噪音）', async () => {
    await render(30)
    expect(container.querySelector('[data-testid="secret-guard-disposition"]')).toBeNull()
  })

  it('章号缺失或非法 ⇒ 不渲染（章级豁免没有章号就是错键）', async () => {
    stored = [definition()]
    for (const chapterNumber of [undefined, 0, -1, 2.5]) {
      await render(chapterNumber)
      expect(container.querySelector('[data-testid="secret-guard-disposition"]'), String(chapterNumber)).toBeNull()
    }
  })

  it('写入失败要显示出来，且不能假装已豁免', async () => {
    saveOutcome = { success: false, error: 'PROJECT_NOT_OPEN' }
    stored = [definition()]
    await render(30)
    await click(button('临时豁免本章', row('柳长老拿弟子试药')))
    expect(container.textContent).toContain('没能记下这次豁免')
    expect(row('柳长老拿弟子试药').dataset.scope).toBe('none')
  })
})
