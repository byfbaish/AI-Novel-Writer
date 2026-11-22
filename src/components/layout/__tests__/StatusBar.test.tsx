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
 * 2026-11-22 作者裁定 C（取代 D16 的「只显示实际」）：
 * 常态显示配置（默认）模型；实际调用与默认不同时并列成「默认A（实际 B）」。
 * 通过可选 props 注入（renderToString 下 zustand useSyncExternalStore 取初始态，
 * 直接 setState 不影响服务端快照，与 D4 同一适配手法）。
 */
describe('StatusBar model indicator (2026-11-22 C)', () => {
  const actualModel = { modelId: 'model-b', modelName: '实际模型B' }

  it('配置 A / 实际调用 B ⇒ 并列显示「A（实际 B）」（zh）', () => {
    const html = renderToString(
      <StatusBar configuredModelName="配置模型A" actualModel={actualModel} locale="zh-CN" />,
    )
    expect(html).toContain('配置模型A（实际 实际模型B）')
    expect(html).toContain('当前模型（配置）：配置模型A ｜ 实际调用：实际模型B')
    expect(html).not.toContain('Current model')
  })

  it('配置 A / 实际调用 B ⇒ 并列显示，zh/en 不串（en）', () => {
    const html = renderToString(
      <StatusBar configuredModelName="配置模型A" actualModel={actualModel} locale="en-US" />,
    )
    expect(html).toContain('配置模型A（实际 实际模型B）')
    expect(html).toContain('Current model (configured): 配置模型A | actual: 实际模型B')
    expect(html).not.toContain('当前模型')
  })

  it('配置与实际是同一模型 ⇒ 只显示一次，不出现「（实际」', () => {
    const sameModel = { modelId: 'model-a', modelName: '配置模型A' }
    const html = renderToString(
      <StatusBar configuredModelName="配置模型A" actualModel={sameModel} locale="zh-CN" />,
    )
    expect(html).toContain('当前模型：配置模型A（配置与实际调用一致）')
    expect(html).not.toContain('（实际')
  })

  it('尚无实际调用记录时显示配置值（配置档）', () => {
    const html = renderToString(<StatusBar configuredModelName="配置模型A" actualModel={null} locale="zh-CN" />)
    expect(html).toContain('配置模型A')
    expect(html).toContain('当前模型（配置）：配置模型A')
  })

  it('只有实际调用、没有配置时显示实际值（实际档）', () => {
    const html = renderToString(<StatusBar configuredModelName={null} actualModel={actualModel} locale="zh-CN" />)
    expect(html).toContain('当前模型（实际调用）：实际模型B')
    expect(html).not.toContain('（实际 实际模型B）')
  })

  it('两者皆无时显示空态「未配置模型」', () => {
    const html = renderToString(<StatusBar configuredModelName={null} actualModel={null} locale="zh-CN" />)
    expect(html).toContain('未配置模型')
  })
})
