import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LeftToolWindowBar from '../LeftToolWindowBar'
import { useLayoutStore } from '../../../stores/layout-store'

function countActiveRailButtons(html: string) {
  return [...html.matchAll(/<button\b[^>]*\bclass="([^"]*)"[^>]*>/g)]
    .filter(([, className]) => {
      const classTokens = className.split(/\s+/)
      return classTokens.includes('left-nav-button') && classTokens.includes('is-active')
    })
    .length
}

describe('LeftToolWindowBar', () => {
  it('renders visible Chinese labels for every left navigation item', () => {
    const html = renderToString(<LeftToolWindowBar />)

    for (const label of ['首页', '项目', '小说', '蓝图', '角色', '世界', '世界状态', '剧情']) {
      expect(html).toContain(label)
    }
  })

  it('keeps bottom-panel tabs and settings out of the left rail', () => {
    // 任务 / 日志 / 模型 的唯一入口是下方 BottomToolWindowBar（28px 图标栏）；
    // 设置只在标题栏。左栏再放一份既挤占扩展位，又让两个入口指向同一视图。
    const html = renderToString(<LeftToolWindowBar />)

    for (const label of ['>任务<', '>日志<', '>模型<', '>设置<']) {
      expect(html).not.toContain(label)
    }
  })

  it('does not render legacy sidebar labels as primary nav labels', () => {
    const html = renderToString(<LeftToolWindowBar />)

    expect(html).not.toContain('项目结构</span>')
    expect(html).not.toContain('知识库</span>')
    expect(html).not.toContain('角色管理</span>')
  })

  it('keeps exactly one primary rail item visually active', () => {
    useLayoutStore.setState({
      sidebarOpen: true,
      sidebarView: 'project',
      aiPanelOpen: true,
      rightView: 'agent',
      bottomPanelOpen: true,
      bottomTab: 'models',
    })
    const html = renderToString(<LeftToolWindowBar />)

    expect(countActiveRailButtons(html)).toBe(1)
  })

  it('replaces the duplicate AI settings entry with the plot tree', () => {
    const source = renderToString(<LeftToolWindowBar />)

    expect(source).toContain('剧情树')
    expect(source).not.toContain('配置模型 API')
  })
})
