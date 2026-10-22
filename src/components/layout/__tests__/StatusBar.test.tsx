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
