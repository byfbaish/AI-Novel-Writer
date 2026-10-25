import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorldStatePage from '../WorldStatePage'
import { useProjectStore } from '../../../stores/project-store'
import { useLocaleStore } from '../../../stores/locale-store'
import { useWorldStateStore } from '../../../stores/world-state-store'
import { emptyWorldStateView, type WorldStateView } from '../../../shared/world-state-view'
import type { SpaceLocationAudit } from '../../../shared/space-machine-line'
import type { ProjectData } from '../../../shared/ipc-channels'
import { setActiveProjectSessionContext } from '../../../shared/project-session-context'

/**
 * 「空间检查」分类（第五区）的渲染契约。
 *
 * 只验证两件事：检查结果能逐条落到 DOM 上；`unreadable` 时是「未检查」而不是「0 处待确认」。
 * 数据来自 world-state:read 的返回，页面自身不写库 —— 顺带断言空间检查里没有可编辑控件。
 */
const project = { id: 'w5-space', path: 'C:\\novels\\w5-space', sessionLease: 'lease-w5-space' } as ProjectData
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const audited: SpaceLocationAudit = {
  tableSpaces: 2,
  machineLines: 1,
  issues: [
    { kind: 'missing-machine-line', severity: 'attention', space: '藏经阁', detail: '表格里写了这个空间的规则，但机读行里没有它 ⇒ 窗口无法参与判定。' },
    { kind: 'window-semantics-ambiguous', severity: 'attention', space: '执法殿·审讯室', detail: '表格里的时间是「申请/受理/办理」窗口，机读行却当成空间开放时段。' },
    // 设计内提示：不进计数，单独一组渲染（作者实测「7 处待确认」里 7 条全是这一类）。
    { kind: 'rule-not-encoded', severity: 'info', space: '试药房', detail: '规则含「禁止/离开限制」，机读行装不下 ⇒ 只能靠 prompt 里的规则原文。' },
  ],
  unreadable: false,
}

function viewOf(spaceAudit: SpaceLocationAudit): WorldStateView {
  return { ...emptyWorldStateView(project.path), spaceAudit }
}

const originals = {
  project: useProjectStore.getState(),
  locale: useLocaleStore.getState(),
}
let root: Root
let container: HTMLDivElement
let invoke: ReturnType<typeof vi.fn>
let testLease = 0

async function settle() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
}

async function mount(spaceAudit: SpaceLocationAudit) {
  invoke = vi.fn().mockImplementation((channel: string) => Promise.resolve(
    channel === 'world-state:read' ? viewOf(spaceAudit) : null,
  ))
  Object.defineProperty(window, 'aiNovelAPI', {
    configurable: true,
    value: { invoke, on: vi.fn(() => () => {}), once: vi.fn(), send: vi.fn() },
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  // 先切分类再挂载：分类是页面级 UI 状态，不属于被渲染的数据。
  useWorldStateStore.getState().setSection('space')
  await act(async () => root.render(<WorldStatePage />))
  await settle()
}

beforeEach(() => {
  vi.clearAllMocks()
  useWorldStateStore.getState().reset()
  project.sessionLease = `lease-${++testLease}`
  useLocaleStore.setState({ locale: 'zh-CN', initialized: true })
  useProjectStore.setState({ currentProject: project })
  setActiveProjectSessionContext({ projectId: project.id, projectPath: project.path, leaseId: project.sessionLease! })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'aiNovelAPI')
  setActiveProjectSessionContext(null)
  useWorldStateStore.getState().reset()
  useProjectStore.setState(originals.project)
  useLocaleStore.setState(originals.locale)
  vi.restoreAllMocks()
})

describe('世界状态页 · 空间检查', () => {
  it('渲染计数、逐条 issue（空间名 + 类型徽标 + 说明）与两项人工复核', async () => {
    await mount(audited)

    const text = container.textContent ?? ''
    expect(text).toContain('空间检查')
    // 只数 attention（2 条），info（1 条）另附 —— 混数会让这一行永远清不零。
    expect(text).toContain('表格 2 个空间 · 机读行 1 条 · 2 处待确认（另 1 条设计内提示）')
    // 每条 issue 必须带空间名 + kind 中文标签 + detail。
    expect(text).toContain('藏经阁')
    expect(text).toContain('缺机读行')
    expect(text).toContain('但机读行里没有它')
    expect(text).toContain('执法殿·审讯室')
    expect(text).toContain('窗口语义待确认')
    expect(text).toContain('当成空间开放时段')
    // 设计内提示独立成组，带「不需要处理」的口径。
    expect(text).toContain('设计内提示（1 条，不需要处理）')
    expect(text).toContain('约束装不下')
    // 机器判不了的两条固定提示。
    expect(text).toContain('机器判不了，需人工确认')
    expect(text).toContain('申请/办理窗口')
    expect(text).toContain('机读行装不下')
  })

  it('只有设计内提示时，待确认数为 0 且不渲染「未发现结构问题」以外的待办', async () => {
    await mount({
      tableSpaces: 1,
      machineLines: 1,
      issues: [
        { kind: 'rule-not-encoded', severity: 'info', space: '试药房', detail: '机读行装不下。' },
      ],
      unreadable: false,
    })

    const text = container.textContent ?? ''
    expect(text).toContain('0 处待确认（另 1 条设计内提示）')
    expect(text).toContain('未发现需确认的结构问题')
    expect(text).toContain('设计内提示（1 条，不需要处理）')
  })

  it('未检查时写明「本次未检查」，不渲染任何计数', async () => {
    await mount({ tableSpaces: 0, machineLines: 0, issues: [], unreadable: true })

    const text = container.textContent ?? ''
    expect(text).toContain('世界观里没识别到空间表格或机读行，本次未检查')
    expect(text).not.toContain('处待确认')
    expect(text).not.toContain('机器判不了')
  })

  it('空间检查里没有编辑控件，也没有多发 IPC', async () => {
    await mount(audited)

    expect(container.querySelectorAll('input').length).toBe(0)
    expect(container.querySelectorAll('textarea').length).toBe(0)
    expect(container.querySelectorAll('[contenteditable="true"]').length).toBe(0)
    expect(invoke.mock.calls.every(([channel]) => channel === 'world-state:read')).toBe(true)
  })
})
