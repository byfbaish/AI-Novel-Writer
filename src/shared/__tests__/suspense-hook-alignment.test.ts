import { describe, expect, it } from 'vitest'
import { alignSuspenseHook } from '../suspense-hook-alignment'

describe('alignSuspenseHook', () => {
  it('真实漂移样本：钩子「寿元将尽的秘密被揭开」不在大纲收尾行 ⇒ drifted，sharedTokens 为空', () => {
    const result = alignSuspenseHook('他退到门口，看着那道门缓缓合上。', '寿元将尽的秘密被揭开')
    expect(result.verdict).toBe('drifted')
    expect(result.sharedTokens).toEqual([])
  })

  it('对齐样本：`律条` 同时在两侧出现 ⇒ aligned，含 律条', () => {
    const result = alignSuspenseHook('他把律条拍在案上，赵铎的脸色变了。', '律条上的名字被人篡改')
    expect(result.verdict).toBe('aligned')
    expect(result.sharedTokens).toContain('律条')
  })

  it('两边都为空串 ⇒ drifted（不是 aligned）', () => {
    const result = alignSuspenseHook('', '')
    expect(result.verdict).toBe('drifted')
    expect(result.sharedTokens).toEqual([])
  })

  it('停用词不算交集：`这是他自己的选择` vs `这是他们自己的东西` ⇒ drifted', () => {
    const result = alignSuspenseHook('这是他自己的选择', '这是他们自己的东西')
    expect(result.verdict).toBe('drifted')
    expect(result.sharedTokens).toEqual([])
  })

  it('单字不参与：`他走了` vs `他来了` ⇒ drifted', () => {
    const result = alignSuspenseHook('他走了', '他来了')
    expect(result.verdict).toBe('drifted')
    expect(result.sharedTokens).toEqual([])
  })

  it('hookTokens 是钩子文本的 token，按出现顺序去重', () => {
    const result = alignSuspenseHook('他把律条拍在案上，赵铎的脸色变了。', '律条上的名字被人篡改')
    expect(result.hookTokens).toContain('律条')
    expect(new Set(result.hookTokens).size).toBe(result.hookTokens.length)
  })
})
