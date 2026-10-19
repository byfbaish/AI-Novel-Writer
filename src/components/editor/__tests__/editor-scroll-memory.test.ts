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
} from '../editor-scroll-memory'

// E4j-2：浏览进度记忆。旁路 Map，不依赖真实 CodeMirror 实例——
// 用最小假视图验证「记住 / 恢复 / 夹住 / 裁剪」。
type FakeView = {
  scrollDOM: { scrollTop: number };
  state: { doc: { length: number }; selection: { main: { anchor: number; head: number } } };
  dispatch: (spec: { selection: { anchor: number; head: number } }) => void;
};

function fakeView(scrollTop = 0, anchor = 0, head = 0, docLength = 1000): FakeView {
  const view: FakeView = {
    scrollDOM: { scrollTop },
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
      documentTop: number;
      lineBlockAt: (pos: number) => { top: number };
    };
    view.documentTop = 12;
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

  it('clearEditorScrollMemory 清空全部（切项目用）', () => {
    rememberEditorScroll('tab-5', asView(fakeView(10)));
    clearEditorScrollMemory();
    expect(readEditorScrollMemory('tab-5')).toBeUndefined();
  })
})
