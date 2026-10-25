import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ABILITY_FORM_HINTS, type PowerAbilityDefinition, type PowerAbilityInput } from '../../../shared/power-ability'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'
import { useProjectStore } from '../../../stores/project-store'
import { AbilityRegistryPanel } from '../AbilityRegistryPanel'

/**
 * P1-1 期 4b 能力登记面板（11 条）。验收口径：
 * - 可增删改、**保存前不落库**、重名整批不提交、删除要确认；
 * - `form` 用 `datalist` 提示但允许自由输入（词表外值原样提交）；
 * - **`name` 有「从金手指原文取名字」入口**（取样里 2/3 的书没有现成名字）；
 * - 三类限制全空时只有本页黄条，**不进提示词**（黄条不得混进提交载荷）；
 * - **候选区（P20-1a）**：第 1 维等级表抽出候选 ⇒ **勾选后才登记**，入参不带 `source`，
 *   已登记同名的候选行不给再勾一次。
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = {
  projectId: 'ability-project',
  leaseId: 'ability-lease',
  projectPath: 'C:\\synthetic\\ability-project',
}

const GOLDEN_FINGER = '**金手指名称：噬魂推演录**\n\n掠夺后可推演，代价是雷劫。\n另有一个「每日一次的现实编辑权」的旧版本。'

/** P20-1a：一份带第 1 维四列等级表的世界观（候选的唯一输入）。 */
const LADDER_WORLD = [
  '### 1.【核心规则与体系漏洞】',
  '',
  '| 等级名 | 相邻差距 | 卡点 | 升级代价 |',
  '| --- | --- | --- | --- |',
  '| **练气一层** | 略 | 需引气入体 | 三年苦修 |',
  '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
  '| **金丹期** | 百倍 | 需渡三劫 | 损耗三十年寿元 |',
  '',
  '### 2.【阶层断层与资源战场】',
  '',
  '外门与内门隔着三道考核。',
].join('\n')

/** 有第 1 维标题、但节内没有表格 ⇒ 走「没找到四列等级表」那一档空态。 */
const PROSE_ONLY_WORLD = [
  '### 1.【核心规则与体系漏洞】',
  '',
  '本界的灵气有上限，一人一生只能结一次丹。',
  '',
  '### 2.【阶层断层与资源战场】',
  '',
  '外门与内门隔着三道考核。',
].join('\n')

let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let stored: PowerAbilityDefinition[]
let deleteOutcome: { success: boolean; error?: string }

function definition(overrides: Partial<PowerAbilityDefinition> = {}): PowerAbilityDefinition {
  return {
    abilityId: 'ability:soul',
    name: '噬魂推演录',
    form: '规则·功法·天赋混合',
    hardLimit: '必须击杀仇敌后方可掠夺功法记忆',
    weakness: '蚀毒未清时强注灵力即经脉爆裂',
    costNote: '每次吞噬向天道发送一次坐标',
    stageChapter: null,
    stageNote: '开局',
    evidence: '「限制代价：每一次掠夺都会向天道意志发送强烈信号」',
    evidenceScope: 'golden-finger',
    source: 'author',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

function rows(): HTMLTableRowElement[] {
  return [...container.querySelectorAll<HTMLTableRowElement>('tr[data-testid="ability-row"]')]
}

function field(rowIndex: number, name: string): HTMLInputElement | HTMLTextAreaElement {
  const target = rows()[rowIndex]?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${name}"]`)
  if (!target) throw new Error(`Missing field ${name} on row ${rowIndex}`)
  return target
}

function select(rowIndex: number, name: string): HTMLSelectElement {
  const target = rows()[rowIndex]?.querySelector<HTMLSelectElement>(`select[data-field="${name}"]`)
  if (!target) throw new Error(`Missing select ${name} on row ${rowIndex}`)
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

async function choose(rowIndex: number, name: string, value: string) {
  await act(async () => {
    const target = select(rowIndex, name)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(target, value)
    target.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function click(target: HTMLElement) {
  await act(async () => target.click())
}

function upsertCalls(): Array<[string, PowerAbilityInput, string]> {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:abilities-upsert') as Array<
    [string, PowerAbilityInput, string]
  >
}

function deleteCalls(): unknown[][] {
  return invoke.mock.calls.filter(([channel]) => channel === 'db:abilities-delete') as unknown[][]
}

async function renderPanel(worldbuilding = '') {
  await act(async () => {
    root.render(<AbilityRegistryPanel projectKey={session.projectPath} worldbuilding={worldbuilding} />)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  await vi.waitFor(() => expect(invoke.mock.calls.some(([channel]) => channel === 'db:abilities-list')).toBe(true))
}

function candidateRows(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="ability-candidate-row"]')]
}

function candidateField(rowIndex: number, name: string): HTMLElement {
  const target = candidateRows()[rowIndex]?.querySelector<HTMLElement>(`[data-field="${name}"]`)
  if (!target) throw new Error(`Missing candidate field ${name} on row ${rowIndex}`)
  return target
}

function candidateCheckbox(rowIndex: number): HTMLInputElement {
  const target = candidateRows()[rowIndex]?.querySelector<HTMLInputElement>('input[data-field="candidate-select"]')
  if (!target) throw new Error(`Missing candidate checkbox on row ${rowIndex}`)
  return target
}

beforeEach(() => {
  vi.clearAllMocks()
  stored = []
  deleteOutcome = { success: true }
  useProjectStore.setState({
    currentProject: {
      id: session.projectId,
      name: '能力测试',
      path: session.projectPath,
      sessionLease: session.leaseId,
      novelConfig: { genre: '', targetAudience: '', coreOutline: '' },
    } as never,
  })
  setActiveProjectSessionContext(session)
  invoke = vi.fn(async (channel: string, ...args: unknown[]) => {
    if (channel === 'db:abilities-list') return { success: true, abilities: stored }
    if (channel === 'db:golden-finger-read') return { success: true, goldenFinger: GOLDEN_FINGER }
    if (channel === 'db:abilities-upsert') {
      const input = args[0] as PowerAbilityInput
      return { success: true, abilityId: input.abilityId ?? `ability:new-${invoke.mock.calls.length}` }
    }
    if (channel === 'db:abilities-delete') return deleteOutcome
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

describe('能力登记面板', () => {
  it('挂载只读两个通道，不写库；空表给出引导', async () => {
    await renderPanel()
    expect(new Set(invoke.mock.calls.map(([channel]) => channel))).toEqual(new Set([
      'db:abilities-list', 'db:golden-finger-read',
    ]))
    expect(container.textContent).toContain('还没有登记任何能力规则')
    expect(rows()).toHaveLength(0)
  })

  it('已有行原样回显；三档出处 + 空档都可选；限制全空时给黄条', async () => {
    stored = [definition(), definition({
      abilityId: 'ability:empty', name: '只有名字的能力', form: '规则',
      hardLimit: '', weakness: '', costNote: '', stageChapter: 7, evidenceScope: null,
    })]
    await renderPanel()
    expect(rows()).toHaveLength(2)
    expect(field(0, 'name')).toHaveProperty('value', '噬魂推演录')
    expect(field(0, 'form')).toHaveProperty('value', '规则·功法·天赋混合')
    expect(field(0, 'hardLimit')).toHaveProperty('value', '必须击杀仇敌后方可掠夺功法记忆')
    expect(select(0, 'evidenceScope').value).toBe('golden-finger')
    expect([...select(0, 'evidenceScope').options].map(option => option.value))
      .toEqual(['', 'golden-finger', 'worldbuilding', 'chapter'])
    expect(field(1, 'stageChapter')).toHaveProperty('value', '7')
    expect(container.querySelectorAll('[data-testid="ability-empty-limits"]')).toHaveLength(1)
    expect(container.querySelector('[data-testid="ability-empty-limits"]')?.textContent)
      .toContain('不会带任何约束进提示词')
  })

  it('新增一行并保存：空字段提交空串 / null，不夹带任何黄条文案', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await fill(0, 'name', '每日一次的现实编辑权')
    await fill(0, 'form', '规则')
    await fill(0, 'hardLimit', '一天只有第一句、不可撤销')
    await fill(0, 'costNote', '成真素材从最近的记忆里挪用')
    await fill(0, 'evidence', '「每日一次的现实编辑权」')
    await choose(0, 'evidenceScope', 'worldbuilding')
    // 章号留空 ⇒ undated 主路径
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(1)
    const input = upsertCalls()[0]![1]
    expect(input).toMatchObject({
      name: '每日一次的现实编辑权', form: '规则', hardLimit: '一天只有第一句、不可撤销',
      costNote: '成真素材从最近的记忆里挪用', stageChapter: null,
      evidence: '「每日一次的现实编辑权」', evidenceScope: 'worldbuilding',
    })
    expect(input.weakness).toBe('')
    expect(JSON.stringify(input)).not.toContain('黄条')
    expect(container.textContent).toContain('已保存 1 条能力')
  })

  it('「从金手指原文取名字」两个候选：首行标题与引号短语都能一键填入', async () => {
    await renderPanel()
    await click(button('新增一条'))
    // 首行标题：去掉「金手指名称：」与 ** 装饰
    await click(button('取首行标题', 0))
    expect(field(0, 'name')).toHaveProperty('value', '噬魂推演录')
    // 引号短语：作者可以改成另一条候选
    await click(button('取引号短语', 0))
    expect(field(0, 'name')).toHaveProperty('value', '每日一次的现实编辑权')
    // 只作候选：点完仍可自由修改
    await fill(0, 'name', '作者自己改的名字')
    expect(field(0, 'name')).toHaveProperty('value', '作者自己改的名字')
  })

  it('重名：整批不提交（本地先拦，不等数据库报 UNIQUE）', async () => {
    await renderPanel()
    await click(button('新增一条'))
    await click(button('新增一条'))
    for (const index of [0, 1]) {
      await fill(index, 'name', '噬魂推演录')
      await fill(index, 'hardLimit', '必须击杀仇敌')
    }
    await click(button('保存'))

    expect(upsertCalls()).toHaveLength(0)
    expect(container.textContent).toContain('有 1 行还需要修改，本次没有提交')
    expect(container.textContent).toContain('这个能力名在本页重复了')
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
    expect(deleteCalls()[0]!.slice(0, 3)).toEqual(['db:abilities-delete', 'ability:soul', session.projectPath])
  })

  it('form 是 datalist 提示 + 自由输入：词表外的值原样提交', async () => {
    await renderPanel()
    const datalist = container.querySelector('datalist#ability-form-hints')
    expect(datalist).not.toBeNull()
    expect([...(datalist?.querySelectorAll('option') ?? [])].map(option => option.getAttribute('value')))
      .toEqual([...ABILITY_FORM_HINTS])

    await click(button('新增一条'))
    await fill(0, 'name', '噬魂推演录')
    await fill(0, 'form', '规则·功法·天赋混合（寄生于重生神魂）')
    await click(button('保存'))
    expect(upsertCalls()[0]![1].form).toBe('规则·功法·天赋混合（寄生于重生神魂）')
  })

  it('候选区：第 1 维四列等级表抽出 3 行，等级名逐字对上', async () => {
    await renderPanel(LADDER_WORLD)
    expect(container.querySelector('[data-testid="ability-candidate-zone"]')).not.toBeNull()
    expect(candidateRows()).toHaveLength(3)
    expect([0, 1, 2].map(index => candidateField(index, 'candidate-name').textContent))
      .toEqual(['练气一层', '筑基期', '金丹期'])
    expect(candidateField(0, 'candidate-hard-limit').textContent).toBe('需引气入体')
    expect(candidateField(0, 'candidate-cost').textContent).toBe('三年苦修')
    // 引文必须带两侧竖线（整行原文，不是 squash 后的片段）。
    expect(container.querySelector('[data-testid="candidate-evidence"]')?.textContent)
      .toBe('| **练气一层** | 略 | 需引气入体 | 三年苦修 |')
  })

  it('候选不写库：勾选后点「采纳所选（1）」才走 db:abilities-upsert，且入参不带 source', async () => {
    await renderPanel(LADDER_WORLD)
    expect(upsertCalls()).toHaveLength(0)

    await click(candidateCheckbox(1))
    await click(button('采纳所选（1）'))

    expect(upsertCalls()).toHaveLength(1)
    const payload = upsertCalls()[0]![1]
    expect(payload).toMatchObject({
      name: '筑基期',
      hardLimit: '需筑基丹一枚',
      costNote: '一枚中品灵石',
      evidence: '| **筑基期** | 十倍 | 需筑基丹一枚 | 一枚中品灵石 |',
      evidenceScope: 'worldbuilding',
      stageChapter: null,
    })
    // source 由仓储硬编码成 'author'，前端传不进去也不该传。
    expect('source' in payload).toBe(false)
    expect(container.textContent).toContain('已登记 1 条候选')
  })

  it('已登记同名的候选行不给再勾一次（勾选框 disabled）', async () => {
    stored = [definition({ name: '筑基期' })]
    await renderPanel(LADDER_WORLD)
    expect(candidateRows()).toHaveLength(3)
    expect(candidateCheckbox(1).disabled).toBe(true)
    expect(candidateCheckbox(0).disabled).toBe(false)
    expect(candidateRows()[1]?.textContent).toContain('已登记：改上面那一行')
    // 按钮只数可勾选的那几条：选不了的行不该算进「采纳所选（N）」。
    expect(button('采纳所选（0）')).toBeDefined()
  })

  it('第 1 维没有表格 ⇒ 走「没找到四列等级表」那一档空态，不产占位行', async () => {
    await renderPanel(PROSE_ONLY_WORLD)
    expect(candidateRows()).toHaveLength(0)
    expect(container.textContent).toContain('世界观第 1 维里没找到四列等级表')
    expect(upsertCalls()).toHaveLength(0)
  })
})
