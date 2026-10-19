import { describe, expect, it, beforeEach, vi } from 'vitest'
import { readArcTreeState, writeArcTreeState } from '../ArcStructureTree'

// node 环境没有 sessionStorage：用最小内存实现顶上（被测代码只用到 getItem/setItem）。
const store = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
})

// E4j-3：树的视图偏好（折叠 / pin）。设计稿 §7A.1b。
// 它存在 sessionStorage：视图偏好不是作品数据，不该进 DB，也不该跨会话永久保留。

describe('arc tree view state', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('没有记录时返回默认：全部折叠、不 pin', () => {
    expect(readArcTreeState('p', '/a.md')).toEqual({ pinned: false, expanded: [] });
  });

  it('写进去能读回来', () => {
    writeArcTreeState('p', '/a.md', { pinned: true, expanded: [1, 3] });
    expect(readArcTreeState('p', '/a.md')).toEqual({ pinned: true, expanded: [1, 3] });
  });

  it('按「项目 + 文件」隔离，互不串味', () => {
    writeArcTreeState('p1', '/a.md', { pinned: true, expanded: [1] });
    expect(readArcTreeState('p2', '/a.md')).toEqual({ pinned: false, expanded: [] });
    expect(readArcTreeState('p1', '/b.md')).toEqual({ pinned: false, expanded: [] });
  });

  it('损坏的 JSON / 非数组 expanded 退回默认，不抛错', () => {
    sessionStorage.setItem('arc-tree:p:/a.md', '{not-json');
    expect(readArcTreeState('p', '/a.md')).toEqual({ pinned: false, expanded: [] });
    sessionStorage.setItem('arc-tree:p:/a.md', JSON.stringify({ pinned: 'yes', expanded: 'x' }));
    expect(readArcTreeState('p', '/a.md')).toEqual({ pinned: false, expanded: [] });
  });

  it('非法卷序号被过滤（0 / 负数 / 小数 / 字符串）', () => {
    sessionStorage.setItem('arc-tree:p:/a.md', JSON.stringify({ pinned: true, expanded: [0, -1, 1.5, '2', 3] }));
    expect(readArcTreeState('p', '/a.md')).toEqual({ pinned: true, expanded: [3] });
  });

  it('pinned 只认严格 true', () => {
    sessionStorage.setItem('arc-tree:p:/a.md', JSON.stringify({ pinned: 1, expanded: [] }));
    expect(readArcTreeState('p', '/a.md').pinned).toBe(false);
  });
});
