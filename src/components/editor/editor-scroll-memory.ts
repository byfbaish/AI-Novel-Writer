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
  /**
   * 保存时顶部那行行首距视口顶的像素偏移（通常 ≤ 0：长段落被视口切成半截）。
   * 恢复后用它校验「旧像素有没有落在同一行」—— 新挂载时 CodeMirror 的高度图是
   * 估算值，同一个像素可能对应另一行，作者实测偏差能到一章（约 1000px）。
   */
  topOffset?: number
  /**
   * 保存时 scroller 的换行宽度（像素）。恢复时宽度变了 ⇒ 旧像素属于另一套换行，
   * 只能认内容锚点；宽度没变则像素仍然精确，不该被锚点覆盖。
   */
  editorWidth?: number
  /** 保存时的文档长度。长度变了（内容替换/晚到）像素同样不可信。 */
  docLength?: number
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
  const anchorPos = pending !== undefined ? undefined : topVisibleAnchor(view)
  memory.set(key, {
    // 恢复没落位就切走：记目标，不记被夹住的中间值。
    scrollTop: pending ?? scroller.scrollTop
    , anchor: selection.anchor
    , head: selection.head
    , savedAt: Date.now()
    // 位置是夹取出来的话，行锚点也跟着不可信，沿用上一条记录的。
    , topPos: pending !== undefined ? previous?.topPos : anchorPos?.pos
    , topOffset: pending !== undefined ? previous?.topOffset : anchorPos?.offset
    , editorWidth: Number.isFinite(scroller.clientWidth) ? Math.round(scroller.clientWidth) : previous?.editorWidth
    , docLength: view.state.doc.length
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

/**
 * 目标行距 scroller 视口顶部还差多少像素：正值 ⇒ 还要往下滚。
 *
 * `view.documentTop` 是**屏幕坐标**（见 `@codemirror/view` 的 `documentTop` getter
 * 注释：「may be negative when the editor is scrolled down」），滚动之后会变成负数。
 * 早先的写法把它当文档坐标系原点（`scrollTop = documentTop + block.top`），于是滚到位
 * 以后 `documentTop` 变成 `-scrollTop`，下一帧又算出一个离谱的目标 —— 实测跳行时
 * `scrollTop` 会在目标值和 0 之间逐帧来回跳，最后停在 0。
 *
 * 这里改成**差分**：用屏幕坐标量出「现在差多少」，只对 `scrollTop` 做增量，与当前
 * 滚动位置无关。
 */
function scrollPosToTopDelta(view: EditorView, pos: number, topMargin: number): number | null {
  const scroller = view.scrollDOM
  if (!scroller) return null
  const docLength = view.state.doc.length
  const safePos = Math.min(Math.max(0, pos), docLength)
  const block = view.lineBlockAt(safePos)
  // 行首的屏幕 Y − scroller 视口顶部 Y = 该行距视口顶部的像素距离。
  const lineOffset = view.documentTop + block.top - scroller.getBoundingClientRect().top
  const delta = lineOffset - topMargin
  return Number.isFinite(delta) ? delta : null
}

/**
 * 目标行当前距视口顶（减去 `topMargin`）还差多少像素：正 ⇒ 还要往下滚。
 * 恢复落位后用它校验「旧像素有没有落在同一行」。
 */
export function scrollPosToTopRemaining(
  view: EditorView | null | undefined,
  pos: number,
  topMargin = 0,
): number | null {
  return view ? scrollPosToTopDelta(view, pos, topMargin) : null
}

/**
 * 把**文档位置**对应的行摆到视口顶部，只动 CodeMirror 自己的 scroller。
 *
 * ⚠️ 不要用 `EditorView.scrollIntoView`：它的 `scrollRectIntoView`
 * （`node_modules/@codemirror/view/dist/index.js:524-600`）会从 `.cm-scroller` 起
 * 沿 `parentNode` 逐级往上，把**每一个** `scrollHeight > clientHeight` 的祖先都滚一遍
 * —— 包括 Tailwind 的 `overflow-hidden` 布局容器（它们同样可以被程序化滚动）。
 * 作者实测到的「切几次之后整个 Frame 往上移、连顶部工具栏都被切掉一截」就是它
 * 一次几像素地把 `ArchFileViewer` / `EditorArea` 的外层容器滚走了。
 *
 * 这里只改自己的 `scrollTop`，一个祖先都不碰。
 */
export function scrollPosToTop(
  view: EditorView | null | undefined,
  pos: number,
  topMargin = 0,
): boolean {
  if (!view) return false
  const scroller = view.scrollDOM
  if (!scroller) return false
  const delta = scrollPosToTopDelta(view, pos, topMargin)
  if (delta === null) return false
  if (Math.abs(delta) > 0.5) scroller.scrollTop = Math.max(0, scroller.scrollTop + delta)
  return true
}

/** 跳行定位最多纠正多少帧（每次 rAF 一帧，约 130ms）。 */
export const SCROLL_POS_MAX_FRAMES = 12

/**
 * 把文档位置摆到视口顶部，并**纠正到 CodeMirror 实测高度为止**。
 *
 * 为什么单次算术不够：`lineBlockAt` 对**视口外、还没渲染过**的行只能给估算高度
 * （`HeightOracle`）。先跳到估算位置，CodeMirror 渲染并实测那一带以后高度会变，
 * 同一个文档位置算出的目标也就跟着变，所以要**逐帧增量逼近**：每帧只补「还差多少
 * 像素」（见 `scrollPosToTopDelta`），连续两帧都差不到 1px 才算落位。
 *
 * 为什么不能「每帧直接写绝对目标」：估算误差大时（实测最多几百像素）来回绝对写会
 * 把 CodeMirror 的测量循环带进振荡，越纠越偏。
 *
 * 仍然只写自己的 scroller、不碰祖先（理由见 `scrollPosToTop` 的注释）。
 * 返回取消函数：重新跳行 / 卸载时调用。
 */
export function scrollPosToTopConverge(
  view: EditorView | null | undefined,
  pos: number,
  topMargin = 0,
): () => void {
  if (!view) return () => {}
  let frame = 0
  let cancelled = false
  let frames = 0
  let stableFrames = 0
  const step = () => {
    if (cancelled) return
    try {
      const scroller = view.scrollDOM
      if (!scroller || view.state.doc.length === 0) return
      if (!scrollPosToTop(view, pos, topMargin)) return
      const remaining = scrollPosToTopDelta(view, pos, topMargin)
      stableFrames = remaining !== null && Math.abs(remaining) <= 1 ? stableFrames + 1 : 0
      frames += 1
      if (stableFrames >= 2 || frames >= SCROLL_POS_MAX_FRAMES) return
      frame = requestAnimationFrame(step)
    } catch {
      // 视图已销毁（切 Tab）：静默收手。
      cancelled = true
    }
  }
  step()
  return () => {
    cancelled = true
    cancelAnimationFrame(frame)
  }
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

/**
 * 顶部可见行首 + 它距视口顶的像素偏移（≤ 0：该长段落被视口切成半截）。
 *
 * 两个值必须**成对**保存：恢复时旧像素在新挂载的估算高度图里可能落到另一行，
 * 靠 `pos` 找出「本来该在顶部的那行」，靠 `offset` 还原它被切掉的那一截。
 */
export function topVisibleAnchor(view: EditorView): { pos: number; offset: number } | null {
  const pos = topVisiblePos(view)
  if (pos === null) return null
  const offset = scrollPosToTopDelta(view, pos, 0)
  return offset === null ? null : { pos, offset }
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
  /**
   * 偏差较大时先用「文档位置」摆一次（CodeMirror 专用，可选）。每帧都会被调用。
   *
   * 返回值语义：
   * - **数字** = 已经摆稳，回传摆完之后的实际 `scrollTop`；
   * - **`null`** = 还在收敛（`lineBlockAt` 对视口外的行只有估算高度），这一帧别判落位；
   * - **`void`** = 这个容器没有可用的文档锚点，退回纯像素。
   *
   * 这一步不只是「省点像素」：**换行宽度变了**（树面板抽屉 ↔ 固定侧栏、窗口缩放）时，
   * 旧像素属于另一套换行，写回去就会落在错的行上 —— 作者报的「关了树以后位置也存不住」。
   * 所以只在地理几何变了时才认它（见 `geometryChanged`）。
   */
  snapBack?: () => number | null | void
  /**
   * 换行几何是否变了（宽度或文档长度）。只有变了才应该认 `snapBack` 的落点。
   *
   * 为什么需要：顶部那一行如果是**一块几百像素高的长段落**，它经常被视口切成半截。
   * 「把行首摆到视口顶」会把这半截也补回去，位置整体挪掉几百像素 —— 表现得就像
   * 「切几次之后进度自己跑掉了」。宽度和文档都没变时，旧像素才是准确的。
   */
  geometryChanged?: () => boolean
  /** 用户交互要挂监听的元素；一旦挂上，用户一动手就放弃恢复（可选）。 */
  interactionHost?: () => EventTarget | null
  /**
   * 已经落位或被用户接管时回调（调用方通常用来标记「有进度可记」）。
   *
   * 参数区分两种原因：`settled` = 恢复守望自己摆稳了；`user` = 作者动手打断了恢复。
   * 调用方的「落位后内容锚点校验」只能在 `settled` 时做 —— 用户接管后再去纠偏
   * 就是抢滚动条（实测会把用户刚滚到的位置拽回旧位置）。
   */
  onLive?: (reason: 'settled' | 'user') => void
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

  const announceLive = (reason: 'settled' | 'user') => {
    if (announcedLive) return
    announcedLive = true
    pendingRestores.delete(key)
    options.onLive?.(reason)
  }

  const attachInteraction = () => {
    if (detachInteraction) return
    const host = options.interactionHost?.()
    if (!host) return
    // 用户一动手就让位：不和作者抢滚动条。
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    const onUserIntent = () => {
      announceLive('user')
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
      const geometryChanged = options.geometryChanged?.() ?? true
      const anchored = options.snapBack && geometryChanged && Math.abs(deviation) > SNAP_BACK_THRESHOLD
        ? options.snapBack()
        : undefined
      // `null`：文档锚点还没收敛（那一带的行还是估算高度），这一帧不判落位，
      // 让它继续逐帧逼近 —— 否则会把估算出来的错位置当成落位点。
      if (anchored === null) {
        settledFrames = 0
      } else {
        let target = entry.scrollTop
        // 摆出来的位置和旧像素明显不同 ⇒ 这套换行里旧像素已经无意义（宽度变了），
        // 认内容锚点；宽度没变时它俩应当接近，继续按记忆像素做微调。
        if (typeof anchored === 'number' && Number.isFinite(anchored) && Math.abs(anchored - entry.scrollTop) > RESTORE_TOLERANCE) {
          target = anchored
        }
        pendingRestores.set(key, target)
        options.write(target)
        const applied = options.read()
        settledFrames = applied !== null && Math.abs(applied - target) <= RESTORE_TOLERANCE
          ? settledFrames + 1
          : 0
      }
    } else {
      settledFrames += 1
    }
    if (settledFrames >= RESTORE_SETTLE_FRAMES) announceLive('settled')
    // 落位后继续守望到窗口结束：晚到的内容重建仍可能把位置打回 0。
    if (frames >= RESTORE_MAX_FRAMES) stop()
    else frame = requestAnimationFrame(tick)
  }

  frame = requestAnimationFrame(tick)
  return stop
}
