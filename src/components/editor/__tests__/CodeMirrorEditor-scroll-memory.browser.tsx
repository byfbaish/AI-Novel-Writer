import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'

import CodeMirrorEditor from '../CodeMirrorEditor'
import { clearEditorScrollMemory, readEditorScrollMemory } from '../editor-scroll-memory'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * E4j-2（修正三）回归测试：**切 Tab 回来必须回到原浏览位置**。
 *
 * 这条测试存在的理由是一个真实踩过的坑：remember 原先写在 `useEffect` 的 cleanup 里，
 * 而 React 卸载删子树时先跑 layout cleanup、再摘 DOM/摘 ref、最后才跑 passive cleanup，
 * 所以 cleanup 里 `editorRef.current` 恒为 null，记忆模块静默返回 —— 进度从来没被存过。
 * 于是这里不测「函数返回了什么」，而是测**真挂载 → 真卸载 → 真重挂载**的端到端行为。
 */

const KEY = 'browser:scroll-memory'

const longText = Array.from({ length: 240 }, (_, index) => (
  `第 ${index + 1} 行：这是一段用于验证浏览进度记忆的正文，长度足够撑出滚动条。`
)).join('\n')

let root: Root
let container: HTMLDivElement
let styleElement: HTMLStyleElement

/**
 * 让编辑器成为真正可滚动的容器（测试环境不加载项目 CSS）。
 *
 * 仅给 `.cm-scroller` 设高是不够的：CodeMirror 自身的样式把它撑到内容高度（实测
 * `clientHeight === scrollHeight === 6225`），此时写 `scrollTop` 会被夹回 0，测试
 * 会误判成「修复没生效」。必须先把 `.cm-editor` 钉死高度，scroller 的百分比高度才有参照。
 */
function installScrollableStyle() {
  styleElement = document.createElement('style')
  styleElement.textContent = [
    '.cm-editor { height: 160px !important; }',
    '.cm-scroller { overflow: auto !important; }',
  ].join('\n')
  document.head.append(styleElement)
}

function scroller(): HTMLElement {
  const element = container.querySelector('.cm-scroller')
  if (!(element instanceof HTMLElement)) throw new Error('cm-scroller not found')
  return element
}

async function nextFrame() {
  await act(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
}

async function waitFrames(count: number) {
  for (let index = 0; index < count; index += 1) await nextFrame()
}

function renderWith(content: string) {
  return act(async () => root.render(
    <CodeMirrorEditor content={content} mode="document" scrollMemoryKey={KEY} />,
  ))
}

function render() {
  return renderWith(longText)
}

/** 拿真实 EditorView（模拟「光标停在文末」这类外部状态要直接 dispatch）。 */
function editorView(): EditorView {
  const dom = container.querySelector('.cm-editor')
  if (!(dom instanceof HTMLElement)) throw new Error('cm-editor not found')
  const view = EditorView.findFromDOM(dom)
  if (!view) throw new Error('EditorView not found')
  return view
}

beforeEach(() => {
  clearEditorScrollMemory()
  installScrollableStyle()
  container = document.createElement('div')
  container.style.height = '160px'
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  styleElement.remove()
  clearEditorScrollMemory()
})

describe('CodeMirrorEditor 浏览进度记忆', () => {
  it('滚到中途切走再回来，阅读位置还在（取消挂在 passive cleanup 的旧实现会回到顶部）', async () => {
    await render()
    await waitFrames(4)

    const before = scroller()
    before.scrollTop = 900
    // 滚动事件是异步派发的：等它跑完，`scrollLiveRef` 才会被标记。
    await waitFrames(2)
    expect(before.scrollTop).toBeGreaterThan(400)

    // 切 Tab ⇒ EditorArea 卸载整棵子树。
    await act(async () => root.unmount())
    expect(readEditorScrollMemory(KEY)?.scrollTop).toBeGreaterThan(400)

    root = createRoot(container)
    await render()
    // 恢复逻辑连续两帧内容稳定后才写入，这里给足帧数。
    await waitFrames(6)

    expect(scroller().scrollTop).toBeGreaterThan(400)
  })

  it('滚回顶部再切走，记的是顶部（否则下次会莫名跳回旧位置）', async () => {
    await render()
    await waitFrames(4)

    const element = scroller()
    element.scrollTop = 900
    await waitFrames(2)
    element.scrollTop = 0
    await waitFrames(2)

    await act(async () => root.unmount())
    expect(readEditorScrollMemory(KEY)?.scrollTop ?? 0).toBe(0)
  })

  it('没滚动过就不落账，避免把旧进度覆盖成 0', async () => {
    await render()
    await waitFrames(4)
    await act(async () => root.unmount())

    expect(readEditorScrollMemory(KEY)).toBeUndefined()
  })

  it('反复切换四次也不漂移（旧实现在内容未铺满时把夹取后的位置写回，越切越靠下）', async () => {
    await render()
    await waitFrames(4)
    scroller().scrollTop = 900
    await waitFrames(2)

    for (let cycle = 0; cycle < 4; cycle += 1) {
      await act(async () => root.unmount())
      root = createRoot(container)
      await render()
      await waitFrames(8)
      expect(scroller().scrollTop).toBeGreaterThan(700)
      expect(scroller().scrollTop).toBeLessThan(1_100)
    }
  })

  it('光标在文末时也不把视口拽到底部（恢复的是阅读位置，不是光标位置）', async () => {
    await render()
    await waitFrames(4)
    scroller().scrollTop = 900
    await waitFrames(2)
    // 模拟「作者刚才在文末输入过」：光标落在文档末尾。
    const view = editorView()
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    await waitFrames(2)

    await act(async () => root.unmount())
    root = createRoot(container)
    await render()
    await waitFrames(8)

    expect(scroller().scrollTop).toBeGreaterThan(400)
    expect(scroller().scrollTop).toBeLessThan(1_100)
  })

  it('内容晚到（先空后填）仍能落回原位 —— ArchFileViewer 异步 setEditorContent 的真实时序', async () => {
    await render()
    await waitFrames(4)
    scroller().scrollTop = 900
    await waitFrames(2)

    await act(async () => root.unmount())
    root = createRoot(container)
    // 先渲染空文档（真实场景里「加载中」这一帧），再换成完整内容。
    await renderWith('')
    await waitFrames(3)
    await renderWith(longText)
    await waitFrames(10)

    expect(scroller().scrollTop).toBeGreaterThan(400)
  })

  it('恢复期间用户自己滚动，恢复立刻让位（不抢滚动条）', async () => {
    await render()
    await waitFrames(4)
    scroller().scrollTop = 900
    await waitFrames(2)

    await act(async () => root.unmount())
    root = createRoot(container)
    await render()
    await waitFrames(1)
    // 恢复正在守望时，作者自己滚轮 / 拖滚动条把位置拉走。
    editorView().dom.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    scroller().scrollTop = 120
    await waitFrames(10)

    // 让位之后不再被拉回 900（恢复守望窗口约 4 秒，这里等足够久）。
    expect(scroller().scrollTop).toBeLessThan(400)
  })
})
