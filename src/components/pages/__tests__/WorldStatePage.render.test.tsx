import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import WorldStatePage from '../WorldStatePage'
import { useProjectStore } from '../../../stores/project-store'
import { useWorldStateStore } from '../../../stores/world-state-store'

/**
 * 只覆盖「没有打开项目」分支：zustand v5 的 SSR 快照读的是 getInitialState，
 * 因此 renderToString 不适合再造「已打开项目」的 store 状态；有项目路径的
 * 加载/渲染/工作流启动由 WorldStatePage.completion.browser.tsx 覆盖。
 */
function renderPage(): string {
  return renderToString(<WorldStatePage />)
}

describe('WorldStatePage (read-only)', () => {
  afterEach(() => {
    useProjectStore.setState({ currentProject: null })
    useWorldStateStore.getState().reset()
  })

  it('renders the empty state when no project is open', () => {
    useProjectStore.setState({ currentProject: null })
    useWorldStateStore.getState().reset()

    const html = renderPage()

    expect(html).toContain('世界状态')
    expect(html).toContain('只读')
    expect(html).toContain('请先打开项目')
    expect(html).toContain('刷新')
  })

  it('renders no editable control and no write affordance', () => {
    useProjectStore.setState({ currentProject: null })
    useWorldStateStore.getState().reset()

    const html = renderPage()

    expect(html).not.toMatch(/<input\b/i)
    expect(html).not.toMatch(/<textarea\b/i)
    expect(html).not.toMatch(/<select\b/i)
    expect(html).not.toMatch(/contenteditable/i)
  })

  it('does not throw while rendering the shell', () => {
    useProjectStore.setState({ currentProject: null })
    useWorldStateStore.getState().reset()

    expect(() => renderPage()).not.toThrow()
  })
})
