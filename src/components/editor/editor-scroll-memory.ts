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
 * - `topPos`：顶部可见行首的文档偏移（修正四）。CodeMirror 是虚拟滚动，像素值在
 *   内容长度变化 / 字体晚到时会被夹住，靠文档位置才摆得准；
 * - `selection`：光标/选区，成本几乎为零、体验差别明显；
 * - `savedAt`：用于按容量裁剪（只保最近 N 个）。
 */

export interface EditorScrollMemoryEntry {
  scrollTop: number
  /** 选区，`{ from, to }` 偏移；`from === to` 即光标位置 */
  anchor: number
  head: number
  savedAt: number
  /**
   * 顶部可见行首的文档偏移。恢复时先用它把视口摆到正确位置，再写像素做微调。
   * 旧记录可能没有这个字段，缺省时退化成纯像素恢复。
   */
  topPos?: number
}

/** 最多记住多少个 tab 的浏览进度（超出按最久未用裁剪）。 */
export const EDITOR_SCROLL_MEMORY_LIMIT = 20

/** 恢复时允许的像素误差；小于它就认为已经落位。 */
const RESTORE_TOLERANCE = 2

/** 偏差超过这个像素才值得先按文档位置摆一次（省掉无谓的 `scrollIntoView`）。 */
const SNAP_BACK_THRESHOLD = 24

/** 连续多少帧落位才算恢复完成（CodeMirror 的测量常常滞后一两帧）。 */
const RESTORE_SETTLE_FRAMES = 3

/**
 * 恢复最多守望多少帧（约 4 秒）。内容晚到、字体晚到、外部 `setEditorContent`
 * 都会在挂载后把 `scrollTop` 打回 0，只恢复一次是挡不住的。
 */
const RESTORE_MAX_FRAMES = 240

const memory = new Map<string, EditorScrollMemoryEntry>()

/**
 * 尚未落位的恢复目标（key → 目标 scrollTop）。
 *
 * 存在的理由是**夹取回写**：内容还没铺满时写 `scrollTop` 只能到当前内容底部，
 * 这个被夹过的值如果又存回去，作者每切一次 Tab 就往下滑一截 —— 现象就是
 * 「反复切换几次甚至会停留到最底下」。恢复未完成就切走时，按**目标值**记账。
 */
const pendingRestores = new Map<string, number>()

/** 记录当前视图的浏览进度。`view` 为空时静默跳过（卸载期可能已销毁）。 */
export function rememberEditorScroll(key: string | undefined, view: EditorView | null | undefined): void {
  if (!key || !view) return
  const scroller = view.scrollDOM
  if (!scroller) return
  const selection = view.state.selection.main
  const pending = pendingRestores.get(key)
  const previous = memory.get(key)
  memory.set(key, {
    // 恢复没落位就切走：记目标，不记被夹住的中间值。
    scrollTop: pending ?? scroller.scrollTop
    , anchor: selection.anchor
    , head: selection.head
    , savedAt: Date.now()
    // 位置是夹取出来的话，行锚点也跟着不可信，沿用上一条记录的。
    , topPos: pending !== undefined ? previous?.topPos : topVisiblePos(view) ?? undefined
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

function topVisiblePos(view: EditorView): number | null {
  const scroller = view.scrollDOM
  const lineBlockAtHeight = (view as unknown as { lineBlockAtHeight?: (height: number) => { from: number } }).lineBlockAtHeight
  if (!scroller || typeof lineBlockAtHeight !== 'function') return null
  try {
    return lineBlockAtHeight.call(view, Math.max(0, scroller.scrollTop)).from
  } catch {
    return null
  }
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
  memory.set(key, {
    scrollTop: pendingRestores.get(key) ?? element.scrollTop,
    anchor: 0,
    head: 0,
    savedAt: Date.now(),
  })
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

/** 读一条记录（单测与调试用；生产代码只用 remember/restore/startScrollRestore）。 */
export function readEditorScrollMemory(key: string): EditorScrollMemoryEntry | undefined {
  return memory.get(key)
}

/** 清空（切项目时调用，避免跨项目串进度）。 */
export function clearEditorScrollMemory(): void {
  memory.clear()
  pendingRestores.clear()
}

export interface ScrollRestoreOptions {
  /** 记忆键；没有记录或记录是 0 时直接返回空操作。 */
  key: string | undefined
  /** 读当前 `scrollTop`；容器还没准备好时返回 null。 */
  read: () => number | null
  /** 写 `scrollTop`。 */
  write: (scrollTop: number) => void
  /** 偏差较大时先用「文档位置」摆一次（CodeMirror 专用，可选）。 */
  snapBack?: () => void
  /** 用户交互要挂监听的元素；一旦挂上，用户一动手就放弃恢复（可选）。 */
  interactionHost?: () => EventTarget | null
  /** 已经落位或被用户接管时回调（调用方通常用来标记「有进度可记」）。 */
  onLive?: () => void
}

/**
 * 持续守望式恢复：在若干帧内反复比对目标位置并落位，直到稳定或被用户接管。
 *
 * 为什么不是「一次 rAF」：`scrollTop` 会在挂载后反复被打回 0 ——
 * ① 内容晚到（`ArchFileViewer` 异步 `setEditorContent` 重建文档）；
 * ② CodeMirror 自身测量滞后（文档高度先按估算、后按真实值）；
 * ③ 浏览器给过长文档做的滚动锚定。
 * 单次写入只能碰运气，作者看到的就是「时灵时不灵、落不到准确位置」。
 *
 * 返回停止函数（组件卸载时调用；**不**清理已落位的记录）。
 */
export function startScrollRestore(options: ScrollRestoreOptions): () => void {
  const key = options.key
  if (!key) return () => {}
  const entry = memory.get(key)
  if (!entry || entry.scrollTop <= 0) return () => {}

  pendingRestores.set(key, entry.scrollTop)
  let stopped = false
  let frame = 0
  let frames = 0
  let settledFrames = 0
  let announcedLive = false
  let detachInteraction: (() => void) | null = null

  const announceLive = () => {
    if (announcedLive) return
    announcedLive = true
    pendingRestores.delete(key)
    options.onLive?.()
  }

  const attachInteraction = () => {
    if (detachInteraction) return
    const host = options.interactionHost?.()
    if (!host) return
    // 用户一动手就让位：不和作者抢滚动条。
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    const onUserIntent = () => {
      announceLive()
      stop()
    }
    for (const name of events) host.addEventListener(name, onUserIntent, { passive: true })
    detachInteraction = () => {
      for (const name of events) host.removeEventListener(name, onUserIntent)
    }
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(frame)
    detachInteraction?.()
    detachInteraction = null
    // 没落位就停：保留 pending，让「被夹住的值」永远不回写。
    if (!announcedLive) pendingRestores.delete(key)
  }

  const tick = () => {
    if (stopped) return
    attachInteraction()
    const current = options.read()
    frames += 1
    if (current === null) {
      if (frames >= RESTORE_MAX_FRAMES) stop()
      else frame = requestAnimationFrame(tick)
      return
    }
    const deviation = current - entry.scrollTop
    if (Math.abs(deviation) > RESTORE_TOLERANCE) {
      if (options.snapBack && Math.abs(deviation) > SNAP_BACK_THRESHOLD) options.snapBack()
      options.write(entry.scrollTop)
      const applied = options.read()
      settledFrames = applied !== null && Math.abs(applied - entry.scrollTop) <= RESTORE_TOLERANCE
        ? settledFrames + 1
        : 0
    } else {
      settledFrames += 1
    }
    if (settledFrames >= RESTORE_SETTLE_FRAMES) announceLive()
    // 落位后继续守望到窗口结束：晚到的内容重建仍可能把位置打回 0。
    if (frames >= RESTORE_MAX_FRAMES) stop()
    else frame = requestAnimationFrame(tick)
  }

  frame = requestAnimationFrame(tick)
  return stop
}
