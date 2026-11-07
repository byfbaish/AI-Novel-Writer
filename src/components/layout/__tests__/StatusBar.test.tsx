import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import StatusBar from '../StatusBar'

/**
 * 底部工具窗入口的回归钉子。
 *
 * 2026-10-22：W5 宽屏改造移除左栏四按钮时，全应用没有任何「任务/日志/模型」入口
 * 残留（原状态栏注释还写着「不放入口」），作者实际看到的是「下方什么都没有」。
 * 这三条断言钉住：状态栏左下角必须常驻这三个入口 —— 它们会消失的唯一方式是这里红。
 */
describe('StatusBar bottom tool-window entries', () => {
  it('renders 任务/日志/模型 entries in the status bar', () => {
    const html = renderToString(<StatusBar />)
    for (const label of ['>任务<', '>日志<', '>模型<']) {
      expect(html).toContain(label)
    }
  })
})

/**
 * D16：状态栏模型指示器读「实际调用事实源」，不读配置当前选中值。
 * 通过可选 props 注入（renderToString 下 zustand useSyncExternalStore 取初始态，
 * 直接 setState 不影响服务端快照，与 D4 同一适配手法）。
 */
describe('StatusBar model indicator (D16)', () => {
  const actualModel = { modelId: 'model-b', modelName: '实际模型B' }

  it('配置 A / 实际调用 B ⇒ 界面显示 B，不显示 A（zh）', () => {
    const html = renderToString(
      <StatusBar configuredModelName="配置模型A" actualModel={actualModel} locale="zh-CN" />,
    )
    expect(html).toContain('实际模型B')
    expect(html).toContain('当前模型：实际模型B')
    expect(html).not.toContain('配置模型A')
    expect(html).not.toContain('Current model')
  })

  it('配置 A / 实际调用 B ⇒ 界面显示 B，不显示 A（en，zh/en 不串）', () => {
    const html = renderToString(
      <StatusBar configuredModelName="配置模型A" actualModel={actualModel} locale="en-US" />,
    )
    expect(html).toContain('实际模型B')
    expect(html).toContain('Current model: 实际模型B')
    expect(html).not.toContain('配置模型A')
    expect(html).not.toContain('当前模型')
  })

  it('尚无实际调用记录时退回配置选中值（不打坏原有显示）', () => {
    const html = renderToString(<StatusBar configuredModelName="配置模型A" actualModel={null} locale="zh-CN" />)
    expect(html).toContain('配置模型A')
    expect(html).toContain('当前模型：配置模型A')
  })

  it('两者皆无时显示空态「未配置模型」', () => {
    const html = renderToString(<StatusBar configuredModelName={null} actualModel={null} locale="zh-CN" />)
    expect(html).toContain('未配置模型')
  })
})
