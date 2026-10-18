import { describe, expect, it } from 'vitest'

import { composeGenreLabel } from '../genre-label'

describe('composeGenreLabel', () => {
  it('把细分类型拼进类型标签，并去掉重复的主类型', () => {
    expect(composeGenreLabel('都市', '都市/脑洞/轻喜剧')).toBe('都市 · 脑洞 · 轻喜剧')
  })

  it('细分类型不含主类型时两者都保留', () => {
    expect(composeGenreLabel('都市', '脑洞')).toBe('都市 · 脑洞')
  })

  it('任一侧缺失时退化为另一侧，不产生分隔符', () => {
    expect(composeGenreLabel('都市', '')).toBe('都市')
    expect(composeGenreLabel('', '脑洞/轻喜剧')).toBe('脑洞 · 轻喜剧')
    expect(composeGenreLabel(undefined, null)).toBe('')
  })

  it('认全角与常见分隔符', () => {
    expect(composeGenreLabel('玄幻', '东方玄幻／热血、升级')).toBe('玄幻 · 东方玄幻 · 热血 · 升级')
  })
})
