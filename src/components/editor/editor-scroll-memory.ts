import type { EditorView } from '@codemirror/view'

/**
 * 编辑器浏览进度记忆（E4j-2，2026-10-19）。
 *
 * 设计稿：`docs/design/architecture/volume-quota-context-budget-design.md` §7A.3。
 *
 * ## 为什么需要它
 *
 * `EditorArea` 只渲染**当前** tab，切走即卸载整个子树；`CodeMirrorEditor` 在 effect 里
 * `new EditorView`、卸载时销毁。于是**切 Tab 回来必然回到顶部** —— 作者原话：
 * 「最常利用这个功能的，反倒是审稿以后要对照审稿建议和原文来看，每次一切，浏览进度就没了，
 * 这个才是最破坏体验的。」
 *
 * ## 为什么存在模块级而不是 React state
 *
 * 卸载时写、挂载时读，跨越了组件生命周期；放进 store 会触发重渲染（滚动是高频事件）。
 * 这里只做**旁路记忆**，不参与任何渲染决策。
 *
 * ## 记住什么
 *
 * - `scrollTop`：必存，解决「回到顶部」；
 * - `selection`：光标/选区，成本几乎为零、体验差别明显；
 * - `savedAt`：用于按容量裁剪（只保最近 N 个）。
 */

export interface EditorScrollMemoryEntry {
  scrollTop: number
  /** 选区，`{ from, to }` 偏移；`from === to` 即光标位置 */
  anchor: number
  head: number
  savedAt: number
}

/** 最多记住多少个 tab 的浏览进度（超出按最久未用裁剪）。 */
export const EDITOR_SCROLL_MEMORY_LIMIT = 20

const memory = new Map<string, EditorScrollMemoryEntry>()

/** 记录当前视图的浏览进度。`view` 为空时静默跳过（卸载期可能已销毁）。 */
export function rememberEditorScroll(key: string | undefined, view: EditorView | null | undefined): void {
  if (!key || !view) return
  const scroller = view.scrollDOM
  if (!scroller) return
  const selection = view.state.selection.main
  memory.set(key, {
    scrollTop: scroller.scrollTop
    , anchor: selection.anchor
    , head: selection.head
    , savedAt: Date.now()
  })
  pruneEditorScrollMemory()
}

/** 恢复浏览进度。没有记录时返回 false（调用方不必做任何事）。 */
export function restoreEditorScroll(key: string | undefined, view: EditorView | null | undefined): boolean {
  if (!key || !view) return false
  const entry = memory.get(key)
  if (!entry) return false
  const docLength = view.state.doc.length
  const anchor = Math.min(Math.max(0, entry.anchor), docLength)
  const head = Math.min(Math.max(0, entry.head), docLength)
  if (entry.scrollTop > 0) view.scrollDOM.scrollTop = entry.scrollTop
  if (anchor !== 0 || head !== 0) {
    view.dispatch({ selection: { anchor, head } })
  }
  return true
}

function pruneEditorScrollMemory(limit = EDITOR_SCROLL_MEMORY_LIMIT): void {
  if (memory.size <= limit) return
  const oldest = [...memory.entries()].sort((left, right) => left[1].savedAt - right[1].savedAt)
  for (const [key] of oldest.slice(0, memory.size - limit)) memory.delete(key)
}

/**
 * 非 CodeMirror 容器的变体（`review-report` 是 `overflow-y-auto` 的普通 div）。
 *
 * 只记 `scrollTop`：这类容器没有「光标」，但**恰恰是审稿对照场景里最需要记住的那个**
 * （作者原话：切 Tab 回来浏览进度就没了）。
 */
export function rememberElementScroll(key: string | undefined, element: { scrollTop: number } | null | undefined): void {
  if (!key || !element) return
  memory.set(key, { scrollTop: element.scrollTop, anchor: 0, head: 0, savedAt: Date.now() })
  pruneEditorScrollMemory()
}

/** 恢复普通容器的滚动位置；没有记录返回 false。 */
export function restoreElementScroll(key: string | undefined, element: { scrollTop: number } | null | undefined): boolean {
  if (!key || !element) return false
  const entry = memory.get(key)
  if (!entry) return false
  if (entry.scrollTop > 0) element.scrollTop = entry.scrollTop
  return true
}

/** 读一条记录（单测与调试用；生产代码只用 remember/restore）。 */
export function readEditorScrollMemory(key: string): EditorScrollMemoryEntry | undefined {
  return memory.get(key)
}

/** 清空（切项目时调用，避免跨项目串进度）。 */
export function clearEditorScrollMemory(): void {
  memory.clear()
}
