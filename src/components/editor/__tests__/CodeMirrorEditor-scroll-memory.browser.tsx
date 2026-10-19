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

  it('跳行（树面板点章）把目标行摆到顶部边距内 —— 视口外的估算高度必须被纠正', async () => {
    await render()
    await waitFrames(4)
    // 目标行在视口外：CodeMirror 只有它的估算高度（真实 Electron 里估算能偏几百像素）。
    const targetLine = 200
    await act(async () => root.render(
      <CodeMirrorEditor
        content={longText}
        mode="document"
        scrollMemoryKey={KEY}
        revealLine={{ line: targetLine - 1, nonce: 1 }}
      />,
    ))
    // 收敛定位要好几帧：写估算位置 → CodeMirror 渲染/测量 → 再纠正。
    await waitFrames(16)

    const view = editorView()
    const block = view.lineBlockAt(view.state.doc.line(targetLine).from)
    // documentTop 是**屏幕坐标**（滚动后为负），所以差值必须对 scroller 的视口顶算，
    // 不能减 scrollTop——那会把滚动量算两遍。
    const offsetInScroller = view.documentTop + block.top - scroller().getBoundingClientRect().top
    expect(Math.abs(offsetInScroller - 40)).toBeLessThanOrEqual(4)
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

  it('恢复只动编辑器自己的 scroller，不滚动外层布局容器（Frame 整体上移的真凶）', async () => {
    // 真实布局里 ArchFileViewer / EditorArea 都是 `overflow-hidden` 的 flex 容器：
    // 只要 scrollHeight 比 clientHeight 大一点，它们就是「可滚动容器」，
    // 而 `EditorView.scrollIntoView` 会沿 parentNode 把每个这样的祖先都滚一遍
    // （`node_modules/@codemirror/view/dist/index.js:524-600`）。
    // 作者看到的就是它一次几像素地把整个 Frame 滚上去、连顶部工具栏都被切掉。
    const outer = document.createElement('div')
    outer.style.height = '160px'
    outer.style.overflow = 'hidden'
    const spacer = document.createElement('div')
    // 编辑器被放在容器可视区之外：任何「把目标行摆进视野」的祖先滚动都会把它拉进来。
    spacer.style.height = '300px'
    outer.append(spacer)
    container.style.height = '160px'
    document.body.append(outer)
    outer.append(container)
    outer.scrollTop = 0

    await render()
    await waitFrames(4)
    scroller().scrollTop = 900
    await waitFrames(2)
    // 记忆里的 topPos 指向正文深处，但先渲染短内容 —— 像素写入会被夹住，
    // 这正是触发 snapBack（按行回摆）的条件。
    await act(async () => root.unmount())
    root = createRoot(container)
    await renderWith('第 1 行\n第 2 行')
    await waitFrames(10)

    expect(outer.scrollTop).toBe(0)
    outer.remove()
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
