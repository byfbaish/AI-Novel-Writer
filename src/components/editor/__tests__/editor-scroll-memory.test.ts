import { describe, expect, it, beforeEach } from 'vitest'
import {
  EDITOR_SCROLL_MEMORY_LIMIT,
  clearEditorScrollMemory,
  readEditorScrollMemory,
  rememberEditorScroll,
  rememberElementScroll,
  restoreElementScroll,
  restoreEditorScroll,
  scrollPosToTop,
  scrollPosToTopConverge,
  scrollPosToTopRemaining,
  startScrollRestore,
} from '../editor-scroll-memory'

// node 环境没有 rAF：这两个用例要驱动「逐帧纠正」，用 setTimeout 等价物顶上。
const globalWithRaf = globalThis as typeof globalThis & {
  requestAnimationFrame?: (callback: (time: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
}
if (typeof globalWithRaf.requestAnimationFrame !== 'function') {
  const handles = new Map<number, ReturnType<typeof setTimeout>>()
  let nextHandle = 1
  globalWithRaf.requestAnimationFrame = (callback) => {
    const handle = nextHandle
    nextHandle += 1
    handles.set(handle, setTimeout(() => { handles.delete(handle); callback(Date.now()) }, 0))
    return handle
  }
  globalWithRaf.cancelAnimationFrame = (handle) => {
    const timer = handles.get(handle)
    if (timer !== undefined) { clearTimeout(timer); handles.delete(handle) }
  }
}

/** 放行若干帧（每帧一个宏任务）。 */
const frames = async (count: number) => {
  for (let index = 0; index < count; index += 1) await new Promise(resolve => setTimeout(resolve, 0))
}

// E4j-2：浏览进度记忆。旁路 Map，不依赖真实 CodeMirror 实例——
// 用最小假视图验证「记住 / 恢复 / 夹住 / 裁剪」。
type FakeView = {
  // scrollDOM 要能回答「视口顶部在屏幕上的 Y」——`scrollPosToTop` 用屏幕坐标差分定位。
  scrollDOM: { scrollTop: number; clientWidth: number; getBoundingClientRect: () => { top: number } };
  state: { doc: { length: number }; selection: { main: { anchor: number; head: number } } };
  dispatch: (spec: { selection: { anchor: number; head: number } }) => void;
};

function fakeView(scrollTop = 0, anchor = 0, head = 0, docLength = 1000, clientWidth = 726): FakeView {
  const view: FakeView = {
    scrollDOM: { scrollTop, clientWidth, getBoundingClientRect: () => ({ top: 0 }) },
    state: { doc: { length: docLength }, selection: { main: { anchor, head } } },
    dispatch: spec => { view.state.selection.main = { ...spec.selection }; },
  };
  return view;
}

const asView = (view: FakeView) => view as unknown as Parameters<typeof rememberEditorScroll>[1];

describe('editor-scroll-memory：浏览进度记忆', () => {
  beforeEach(() => clearEditorScrollMemory());

  it('没有键或没有视图时静默跳过', () => {
    expect(() => rememberEditorScroll(undefined, asView(fakeView()))).not.toThrow();
    expect(() => rememberEditorScroll('a', null)).not.toThrow();
    expect(restoreEditorScroll(undefined, asView(fakeView()))).toBe(false);
    expect(restoreEditorScroll('missing', asView(fakeView()))).toBe(false);
  })

  it('记住并恢复 scrollTop 与光标', () => {
    rememberEditorScroll('tab-1', asView(fakeView(480, 120, 130)));
    expect(readEditorScrollMemory('tab-1')).toMatchObject({ scrollTop: 480, anchor: 120, head: 130 });
    const target = fakeView(0, 0, 0);
    expect(restoreEditorScroll('tab-1', asView(target))).toBe(true);
    expect(target.scrollDOM.scrollTop).toBe(480);
    expect(target.state.selection.main).toEqual({ anchor: 120, head: 130 });
  })

  it('文档变短时光标位置被夹住，不抛错', () => {
    rememberEditorScroll('tab-2', asView(fakeView(100, 900, 950)));
    const target = fakeView(0, 0, 0, 200);
    expect(restoreEditorScroll('tab-2', asView(target))).toBe(true);
    expect(target.state.selection.main).toEqual({ anchor: 200, head: 200 });
  })

  it('滚动位置为 0 时不覆盖当前滚动', () => {
    rememberEditorScroll('tab-3', asView(fakeView(0, 0, 0)));
    const target = fakeView(300, 0, 0);
    restoreEditorScroll('tab-3', asView(target));
    expect(target.scrollDOM.scrollTop).toBe(300);
  })

  it('同一个键覆盖写，不重复堆积', () => {
    rememberEditorScroll('tab-4', asView(fakeView(100)));
    rememberEditorScroll('tab-4', asView(fakeView(200)));
    expect(readEditorScrollMemory('tab-4')!.scrollTop).toBe(200);
  })

  it('超过上限时按最久未用裁剪', () => {
    for (let index = 0; index < EDITOR_SCROLL_MEMORY_LIMIT + 5; index += 1) {
      rememberEditorScroll('k-' + index, asView(fakeView(index)));
    }
    // 最早的 5 个被裁掉，最新的还在
    expect(readEditorScrollMemory('k-0')).toBeUndefined();
    expect(readEditorScrollMemory('k-4')).toBeUndefined();
    expect(readEditorScrollMemory('k-5')).toBeDefined();
    expect(readEditorScrollMemory('k-' + (EDITOR_SCROLL_MEMORY_LIMIT + 4))).toBeDefined();
  })

  it('普通容器变体：只记 scrollTop（审稿报告用它）', () => {
    rememberElementScroll('report-1', { scrollTop: 720 });
    expect(readEditorScrollMemory('report-1')).toMatchObject({ scrollTop: 720, anchor: 0, head: 0 });
    const target = { scrollTop: 0 };
    expect(restoreElementScroll('report-1', target)).toBe(true);
    expect(target.scrollTop).toBe(720);
  })

  it('普通容器变体：缺键/缺元素时静默跳过', () => {
    expect(restoreElementScroll('nope', { scrollTop: 0 })).toBe(false);
    expect(() => rememberElementScroll(undefined, { scrollTop: 1 })).not.toThrow();
  })

  it('scrollPosToTop：只写自己的 scroller，不调 EditorView.scrollIntoView', () => {
    const view = fakeView(0) as FakeView & {
      // 真实 CodeMirror 的 `documentTop` 是**屏幕坐标**：滚动后变负。这里如实模拟。
      documentTop: number;
      lineBlockAt: (pos: number) => { top: number };
    };
    Object.defineProperty(view, 'documentTop', { get: () => 12 - view.scrollDOM.scrollTop });
    view.lineBlockAt = pos => ({ top: pos * 2 });
    expect(scrollPosToTop(view as never, 480)).toBe(true);
    // 文档坐标 480*2 加上 documentTop 才是 scroller 的像素坐标。
    expect(view.scrollDOM.scrollTop).toBe(972);
    expect(scrollPosToTop(view as never, 480, 40)).toBe(true);
    expect(view.scrollDOM.scrollTop).toBe(932);
    // 顶到文档开头时不能出现负 scrollTop。
    expect(scrollPosToTop(view as never, 0, 40)).toBe(true);
    expect(view.scrollDOM.scrollTop).toBe(0);
    // 超出文档长度要夹住，不能读到越界行。
    expect(scrollPosToTop(view as never, 99_999)).toBe(true);
    expect(view.scrollDOM.scrollTop).toBe(2012);
    // 没有视图时返回 false（卸载期）。
    expect(scrollPosToTop(null, 10)).toBe(false);
  })

  it('scrollPosToTopConverge：视口外的行只有估算高度，也能纠正到实测位置', async () => {
    // 真实读数（Playwright + 真 Electron）：726px 宽时估算多滚 228px、470px 窄宽时
    // 少滚 452px —— 树面板点章跳不准就是这个。收敛版应当纠正到实测位置。
    const scroller = { scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }) }
    const measuredTop = 720
    const view = {
      scrollDOM: scroller,
      state: { doc: { length: 1000 } },
      // 屏幕坐标：滚动后文档顶部上移。
      get documentTop() { return -scroller.scrollTop },
      // 还没滚到附近时只有估算值（268）；一旦写进去，CodeMirror 就量出真实高度。
      lineBlockAt: () => ({ top: scroller.scrollTop === 0 ? 268 : measuredTop }),
    }
    const cancel = scrollPosToTopConverge(view as never, 480, 40)
    await frames(8)
    cancel()
    expect(scroller.scrollTop).toBe(measuredTop - 40)
  })

  it('恢复：宽度变了（snapBack 报出的位置与旧像素不符）时以内容锚点为准', async () => {
    // 作者场景：窄宽（树 fixed，470px）下停在 680，开/关树换了换行宽度后再切回来。
    // 旧实现先按「顶部行」摆到 400，又用旧像素 680 覆盖回去 —— 位置就落在错的行上。
    rememberEditorScroll('tab-width', asView(fakeView(680)))
    let current = 0
    let snaps = 0
    const stop = startScrollRestore({
      key: 'tab-width',
      read: () => current,
      write: value => { current = value },
      snapBack: () => { snaps += 1; current = 400; return 400 },
    })
    await frames(8)
    stop()
    expect(snaps).toBeGreaterThan(0)
    expect(current).toBe(400)
  })

  it('恢复：宽度没变时仍按记忆像素做微调（锚点接近就听旧像素）', async () => {
    rememberEditorScroll('tab-same-width', asView(fakeView(680)))
    let current = 0
    const stop = startScrollRestore({
      key: 'tab-same-width',
      read: () => current,
      write: value => { current = value },
      snapBack: () => { current = 681; return 681 },
    })
    await frames(8)
    stop()
    expect(current).toBe(680)
  })

  it('恢复：几何没变就不许内容锚点覆盖像素（顶部长段落被切成半截时它会挪掉一整块）', async () => {
    // 作者场景：卷纲 tab 顶部是一块 403px 高的长段落，切 Tab 时它被视口切成半截。
    // 「行首摆到视口顶」会补回那 403px —— 现象就是「切几次进度自己跑了」。
    rememberEditorScroll('tab-tall-block', asView(fakeView(1979)))
    expect(readEditorScrollMemory('tab-tall-block')).toMatchObject({ editorWidth: 726, docLength: 1000 })
    let current = 0
    let snaps = 0
    const stop = startScrollRestore({
      key: 'tab-tall-block',
      read: () => current,
      write: value => { current = value },
      snapBack: () => { snaps += 1; current = 2382; return 2382 },
      geometryChanged: () => false,
    })
    await frames(8)
    stop()
    expect(snaps).toBe(0)
    expect(current).toBe(1979)
  })

  it('恢复：宽度真的变了（树抽屉 ↔ 固定侧栏）才认内容锚点', async () => {
    rememberEditorScroll('tab-tree-pin', asView(fakeView(680, 0, 0, 1000, 726)))
    let current = 0
    const stop = startScrollRestore({
      key: 'tab-tree-pin',
      read: () => current,
      write: value => { current = value },
      snapBack: () => { current = 400; return 400 },
      geometryChanged: () => true,
    })
    await frames(8)
    stop()
    expect(current).toBe(400)
  })

  it('记住顶部行锚点 + 行内偏移（恢复后核对「旧像素有没有落在同一行」）', () => {
    const view = fakeView(200, 0, 0, 2000) as FakeView & {
      documentTop: number;
      lineBlockAtHeight: (height: number) => { from: number };
      lineBlockAt: (pos: number) => { top: number };
    };
    Object.defineProperty(view, 'documentTop', { get: () => 12 - view.scrollDOM.scrollTop })
    // 顶部可见行 = 文档偏移 1200；它行首距视口顶 100px（被切成半截 ⇒ 保存的偏移为负）。
    view.lineBlockAtHeight = () => ({ from: 1200 })
    view.lineBlockAt = pos => ({ top: pos - 1100 })
    expect(scrollPosToTopRemaining(view as never, 1200, 0)).toBe(-88)
    rememberEditorScroll('tab-anchor', asView(view))
    expect(readEditorScrollMemory('tab-anchor')).toMatchObject({ topPos: 1200, topOffset: -88 })
  })

  it('恢复未落位就切走：像素记目标值，锚点沿用上一条（不被夹取位置骗走）', async () => {
    const saved = fakeView(200, 0, 0, 2000) as FakeView & {
      documentTop: number;
      lineBlockAtHeight: (height: number) => { from: number };
      lineBlockAt: (pos: number) => { top: number };
    };
    Object.defineProperty(saved, 'documentTop', { get: () => 12 - saved.scrollDOM.scrollTop })
    saved.lineBlockAtHeight = () => ({ from: 1200 })
    saved.lineBlockAt = pos => ({ top: pos - 1100 })
    rememberEditorScroll('tab-anchor-pending', asView(saved))
    // 恢复途中内容还没铺开：read 返回 null ⇒ pending 建立。
    const stop = startScrollRestore({ key: 'tab-anchor-pending', read: () => null, write: () => {}, snapBack: () => {} })
    await frames(1)
    // 此刻卸载记账：像素要被夹过的 50 覆盖成目标 200，锚点不能跟着变成当前（未铺开）视图。
    const clamped = fakeView(50) as FakeView & typeof saved
    Object.defineProperty(clamped, 'documentTop', { get: () => 12 - clamped.scrollDOM.scrollTop })
    clamped.lineBlockAtHeight = () => ({ from: 0 })
    clamped.lineBlockAt = () => ({ top: 0 })
    rememberEditorScroll('tab-anchor-pending', asView(clamped))
    stop()
    expect(readEditorScrollMemory('tab-anchor-pending')).toMatchObject({ scrollTop: 200, topPos: 1200, topOffset: -88 })
  })

  it('clearEditorScrollMemory 清空全部（切项目用）', () => {
    rememberEditorScroll('tab-5', asView(fakeView(10)));
    clearEditorScrollMemory();
    expect(readEditorScrollMemory('tab-5')).toBeUndefined();
  })
})
