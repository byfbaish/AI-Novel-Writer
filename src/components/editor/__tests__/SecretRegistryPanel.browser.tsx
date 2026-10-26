import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ConsistencyExemption } from '../../../shared/consistency-preflight'
import type { SecretDefinition, SecretInput } from '../../../shared/secret'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { SecretRegistryPanel } from '../SecretRegistryPanel'

/**
 * P20-2 秘密宿体登记面板（11 条）。验收口径：
 * - 挂载只读两个通道（`db:secrets-list` + `db:consistency-exemption-list`），不写库；空表给引导而不是空白；
 * - **保存前不落库**、页内重名整批不提交、删除要确认；
 * - 名字用顿号/逗号分隔，提交前拆成数组；**揭穿章留空提交 `null`**（不是 0、不是空串）；
 * - 真相互填：没有真相的登记，审稿员没有判定依据，所以本地就拦下；
 * - 豁免（2026-10-26 加）**不走「保存」**：撤销立即生效，且章级豁免要显示「欠一条知情登记」。
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
let writeOutcome: { success: boolean; error?: string }
let deleteOutcome: { success: boolean; error?: string }
let revokeOutcome: { success: boolean; error?: string }

function definition(overrides: Partial<SecretDefinition> = {}): SecretDefinition {
  return {
    secretId: 'secret:trial',
    title: '柳长老拿弟子试药',
    detail: '试药房里的残篇是从外门弟子身上取的',
    holders: ['柳长老'],
    unaware: ['众弟子'],
    revealChapter: 12,
    evidence: '谁在隐瞒什么：柳长老捂试药残篇',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="secret-row"]')]
}

function field(rowIndex: number, name: string): HTMLInputElement | HTMLTextAreaElement {
  const target = rows()[rowIndex]?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on row ${rowIndex}`)
  return target
}

function button(label: string, rowIndex?: number): HTMLButtonElement {
  const scope = rowIndex === undefined ? container : rows()[rowIndex]!
  const target = [...scope.querySelectorAll('button')].find(node => node.textContent?.includes(label))
  if (!target) throw new Error(`Missing button ${label}`)
  return target as HTMLButtonElement
}

async function fill(rowIndex: number, name: string, value: string) {
  await act(async () => {
    const input = field(rowIndex, name)
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, SecretInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:secrets-upsert') as Array<
    [string, SecretInput, string]
  >
}

function deleteCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:secrets-delete') as unknown[][]
}

async function renderPanel() {
  await act(async () => {
    root.render(<SecretRegistryPanel projectKey={session.projectPath} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:secrets-list')).toBe(true))
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  exemptions = []
  writeOutcome = { success: true }
  deleteOutcome = { success: true }
  revokeOutcome = { success: true }
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
    if (channel === 'db:secrets-upsert') {
      if (!writeOutcome.success) return writeOutcome
      const input = args[0] as SecretInput
      return { success: true, secretId: input.secretId ?? `secret:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:secrets-delete') return deleteOutcome
    if (channel === 'db:consistency-exemption-list') return exemptions
    if (channel === 'db:consistency-exemption-revoke') {
      if (!revokeOutcome.success) return revokeOutcome
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

describe('秘密宿体登记面板', () => {
  it('挂载只读两个通道，不写库；空表给出引导', async () => {
    await renderPanel()
    expect(new Set(invoke.mock.calls.map(([channel]) => channel)))
      .toEqual(new Set(['db:secrets-list', 'db:consistency-exemption-list']))
    expect(rows()).toHaveLength(0)
    expect(container.textContent).toContain('还没有登记任何秘密')
  })

  it('已有行原样回显（名字数组按顿号拼回，揭穿章回显数字）', async () => {
    stored = [definition(), definition({
      secretId: 'secret:ledger', title: '宗主改账', holders: ['宗主', '账房'],
      unaware: [], revealChapter: null,
    })]
    await renderPanel()
    expect(rows()).toHaveLength(2)
    expect(field(0, 'title')).toHaveProperty('value', '柳长老拿弟子试药')
    expect(field(0, 'detail')).toHaveProperty('value', '试药房里的残篇是从外门弟子身上取的')
    expect(field(0, 'holders')).toHaveProperty('value', '柳长老')
    expect(field(0, 'revealChapter')).toHaveProperty('value', '12')
    expect(field(1, 'holders')).toHaveProperty('value', '宗主、账房')
    expect(field(1, 'revealChapter')).toHaveProperty('value', '')
    // 揭穿章未定的行要显式提示（它不是漏填，是保守处理）
    expect(container.querySelectorAll('[data-testid="secret-undecided"]')).toHaveLength(1)
  })

  it('新增并保存：名字拆成数组、揭穿章留空提交 null', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'title', '试药残篇')
    await fill(0, 'detail', '残篇是柳长老从外门弟子身上取的')
    await fill(0, 'holders', '柳长老、药童')
    await fill(0, 'unaware', '众弟子, 内门执事')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    const input = upsertCalls()[0]![1]
    expect(input).toMatchObject({
      title: '试药残篇',
      detail: '残篇是柳长老从外门弟子身上取的',
      holders: ['柳长老', '药童'],
      unaware: ['众弟子', '内门执事'],
      revealChapter: null,
    })
    // 新建不许带 secretId（那是「改已有行」的标记）
    expect('secretId' in input).toBe(false)
  })

  it('页内重名：整批不提交（本地先拦，不等数据库报 UNIQUE）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await click(button('新增一条'))
    for (const index of [0, 1]) {
      await fill(index, 'title', '试药残篇')
      await fill(index, 'detail', '真相')
    }
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 1 行还需要修改，本次没有提交')
    expect(container.textContent).toContain('这个秘密名在本页重复了')
  })

  it('真相必填：只填名字就保存 ⇒ 拦下并说明为什么（审稿要靠它判泄密）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'title', '只有名字的秘密')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('真相是必填项')
  })

  it('揭穿章填 0 或小数 ⇒ 拦下（0 会被读成序章）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'title', '章号非法')
    await fill(0, 'detail', '真相')
    await fill(0, 'revealChapter', '0')
    await click(button('保存'))
    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('只能填正整数')
  })

  it('删除要确认：第一次点击只进入确认态，确认并保存后才真删', async () => {
    stored = [definition()]
    await renderPanel()
    await click(button('删除'))
    expect(deleteCalls()).toHaveLength(0)
    expect([...container.querySelectorAll('button')].some(node => node.textContent?.includes('确认删除'))).toBe(true)

    await click(button('确认删除'))
    await click(button('保存'))
    expect(deleteCalls()).toHaveLength(1)
    // 前三个参数是通道 / id / 项目路径（其后是会话上下文，不属于契约）。
    expect(deleteCalls()[0]!.slice(0, 3)).toEqual(['db:secrets-delete', 'secret:trial', session.projectPath])
  })

  it('后端报 SECRET_DUPLICATED ⇒ 翻成中文并保留该行不丢', async () => {
    writeOutcome = { success: false, error: 'SECRET_DUPLICATED' }
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'title', '库里已存在的秘密')
    await fill(0, 'detail', '真相')
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    expect(container.textContent).toContain('这个名字的秘密已经登记过了')
    // 失败的行留在页面上，作者不用重填
    expect(rows()).toHaveLength(1)
    expect(field(0, 'title')).toHaveProperty('value', '库里已存在的秘密')
  })
})

/**
 * 豁免状态（2026-10-26 作者要求）。
 *
 * 三条边界：① 永久与章级分开显示，章级要带章号；② 撤销**立即**写库（不跟着「保存」走，
 * 否则作者会以为坏了）；③ 章级豁免要显示「欠一条知情登记」—— 因为 M16 的引用键要求
 * 定稿逐字引文，审稿阶段写不进去，只能提醒。
 */
describe('秘密宿体登记面板 · 豁免状态', () => {
  it('永久豁免 ⇒ 显示「已永久豁免」，并给撤销入口', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial', reason: '真相人尽皆知', revoked: false }]
    await renderPanel()
    expect(container.textContent).toContain('已永久豁免')
    expect(container.querySelectorAll('[data-testid="secret-exemption-revoke"]')).toHaveLength(1)
  })

  it('章级豁免 ⇒ 显示章号 + 欠知情名单（隐瞒者 ∪ 尚不知情）', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial#ch30', reason: '第30章提前揭穿', revoked: false }]
    await renderPanel()
    expect(container.textContent).toContain('已在第 30 章临时豁免')
    expect(container.textContent).toContain('欠知情登记：柳长老、众弟子 自第 30 章起知道')
  })

  it('撤销立即写库，且不经过「保存」', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial', reason: 'x', revoked: false }]
    await renderPanel()
    await click(container.querySelector<HTMLElement>('[data-testid="secret-exemption-revoke"]')!)

    const revokeCalls = invoke.mock.calls.filter(([channel]) => channel === 'db:consistency-exemption-revoke')
    expect(revokeCalls).toHaveLength(1)
    expect(revokeCalls[0]!.slice(0, 2)).toEqual(['db:consistency-exemption-revoke', 'secret-exempt:secret:trial'])
    // 撤销后不该顺手提交秘密本身
    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('已撤销豁免')
    // 重读后徽标消失（守卫恢复）
    expect(container.textContent).not.toContain('已永久豁免')
  })

  it('已撤销（revoked=1）的豁免不显示 —— 守卫已经恢复了', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial', reason: 'x', revoked: true }]
    await renderPanel()
    expect(container.querySelectorAll('[data-testid="secret-exemption"]')).toHaveLength(0)
  })

  it('别人的豁免键（volume-handoff:）不会被认成本秘密的豁免', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'volume-handoff:vol-1', reason: '已人工复查', revoked: false }]
    await renderPanel()
    expect(container.querySelectorAll('[data-testid="secret-exemption"]')).toHaveLength(0)
  })

  it('撤销失败要说出来，不能静默', async () => {
    stored = [definition()]
    exemptions = [{ stableFactKey: 'secret-exempt:secret:trial', reason: 'x', revoked: false }]
    revokeOutcome = { success: false, error: 'PROJECT_NOT_OPEN' }
    await renderPanel()
    await click(container.querySelector<HTMLElement>('[data-testid="secret-exemption-revoke"]')!)
    expect(container.textContent).toContain('没能撤销豁免')
  })
})
