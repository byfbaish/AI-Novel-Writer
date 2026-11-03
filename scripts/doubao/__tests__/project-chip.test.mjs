import { describe, expect, it } from 'vitest'

import { PROJECT_CHIP_PLACEHOLDERS, isUnsetProjectChip, pickProjectRow } from '../project-chip.mjs'

/**
 * 用例全部取自 2026-11-04 那次真实误判：两个话题都没选项目，
 * `bootstrap` 却对两个都输出了 `项目路径 ✓ AI-writer-wt-1 C:\...`。
 */
describe('isUnsetProjectChip', () => {
  it('chip 只剩占位文本「项目」= 没选项目（本次要修的故障）', () => {
    expect(isUnsetProjectChip('项目')).toBe(true)
  })

  it('空 / 空白 / undefined 都算没选', () => {
    expect(isUnsetProjectChip('')).toBe(true)
    expect(isUnsetProjectChip('   ')).toBe(true)
    expect(isUnsetProjectChip(undefined)).toBe(true)
    expect(isUnsetProjectChip(null)).toBe(true)
  })

  it('大小写不敏感（英文界面是 Project）', () => {
    expect(isUnsetProjectChip('Project')).toBe(true)
    expect(isUnsetProjectChip('PROJECT')).toBe(true)
    expect(PROJECT_CHIP_PLACEHOLDERS).toContain('project')
  })

  it('真项目名不算没选 —— 名字里带「项目」两个字也不行', () => {
    expect(isUnsetProjectChip('AI-writer-wt-1')).toBe(false)
    expect(isUnsetProjectChip('项目组-小说')).toBe(false)
  })
})

describe('pickProjectRow', () => {
  const rows = [
    { name: 'harness-learn D:\\learn', active: false },
    { name: 'AI-writer-wt-1 C:\\develop\\workspace\\AI-writer\\wt-1', active: false },
  ]

  it('按 chip 上的名字取行，路径来自菜单（唯一能答「动哪个目录」的证据）', () => {
    expect(pickProjectRow('AI-writer-wt-1', rows)?.name).toBe(rows[1].name)
  })

  it('名字是另一个项目的前缀时不会被抢走（要 `名字 + 空格`）', () => {
    const prefixRows = [
      { name: 'AI-writer-wt-10 C:\\other', active: true },
      { name: 'AI-writer-wt-1 C:\\develop\\workspace\\AI-writer\\wt-1', active: false },
    ]
    expect(pickProjectRow('AI-writer-wt-1', prefixRows)?.name).toBe(prefixRows[1].name)
  })

  it('`active` 只是兜底：chip 有名字且菜单里没这条时才用', () => {
    const onlyActive = [{ name: '别的项目 C:\\x', active: true }]
    expect(pickProjectRow('AI-writer-wt-1', onlyActive)?.name).toBe('别的项目 C:\\x')
  })

  it('`active` 不能压过 chip：菜单里同时存在两条时，选 chip 那条', () => {
    const both = [
      { name: '别的项目 C:\\x', active: true },
      { name: 'AI-writer-wt-1 C:\\develop\\workspace\\AI-writer\\wt-1', active: false },
    ]
    expect(pickProjectRow('AI-writer-wt-1', both)?.name).toBe(both[1].name)
  })

  it('chip 为空直接返回 null —— 不许退回 active（否则就是本次的误判）', () => {
    expect(pickProjectRow('', [{ name: '别的项目 C:\\x', active: true }])).toBeNull()
  })

  it('菜单项为空数组 / 非数组都不炸', () => {
    expect(pickProjectRow('AI-writer-wt-1', [])).toBeNull()
    expect(pickProjectRow('AI-writer-wt-1', undefined)).toBeNull()
  })
})
