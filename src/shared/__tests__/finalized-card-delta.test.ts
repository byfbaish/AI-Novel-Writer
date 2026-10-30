import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import type { FinalizedCharacterContext } from '../finalized-continuity'
import { normalizeForbiddenId, parseFinalizedCharacterCardDeltas } from '../finalized-continuity'

/**
 * `cardDeltas` 的解析契约。
 *
 * 与状态六槽的根本区别：**它永不抛错**。状态错会触发 repair 轮重写整份产物，
 * 而卡片增量是可选增强 —— 一条格式不对只该被丢掉并上报，不该让整章定稿失败。
 */
const CONTENT = '陈砚在保状上按了手印，走出镖行时手还在抖。管事把三百文推给他，他没接。'
const CONTENT_HASH = createHash('sha256').update(CONTENT).digest('hex')

const context = (): FinalizedCharacterContext => ({
  projectId: 'p1',
  epoch: 'lease-1',
  source: { draftId: 8, finalizationId: 'fin-8', chapterNumber: 8, contentHash: CONTENT_HASH },
  content: CONTENT,
  identityRevision: 1,
  identityStatus: 'bound',
  projectionGeneration: 0,
  characters: [{
    characterId: 'c1', displayNameSnapshot: '陈砚', aliases: [], fields: [],
  }],
  sourceOrder: { continuityEpoch: 'p1:0', chapterNumber: 8, authoritativeFinalizationRevision: 1 },
})

const QUOTE = '陈砚在保状上按了手印'
const payload = (cardDeltas: unknown): string => JSON.stringify({ updates: [], cardDeltas })

describe('cardDeltas 解析', () => {
  it('解析三种 kind', () => {
    const result = parseFinalizedCharacterCardDeltas(payload([
      { characterId: 'c1', kind: 'soft-spot', name: '母亲的病', text: '她一流血，他什么手印都肯按', evidence: { text: QUOTE } },
      { characterId: 'c1', kind: 'chip', change: 'lose', name: '三百文', text: '他攒了两年', evidence: { text: '管事把三百文推给他' } },
      { characterId: 'c1', kind: 'hit', forbidden: 'x1', cost: '按了手印', broken: true, evidence: { text: QUOTE } },
    ]), context())

    expect(result.dropped).toEqual([])
    expect(result.deltas.map(delta => delta.kind)).toEqual(['soft-spot', 'chip', 'hit'])
    expect(result.deltas[0]).toMatchObject({ name: '母亲的病', characterId: 'c1' })
    expect(result.deltas[1]).toMatchObject({ change: 'lose', name: '三百文' })
    // forbidden 规范化成大写 X
    expect(result.deltas[2]).toMatchObject({ forbidden: 'X1', broken: true, cost: '按了手印' })
  })

  it('缺 cardDeltas 键时返回空，不报错', () => {
    expect(parseFinalizedCharacterCardDeltas(JSON.stringify({ updates: [] }), context()))
      .toEqual({ deltas: [], dropped: [] })
  })

  it('坏 JSON 返回空，不抛错', () => {
    expect(parseFinalizedCharacterCardDeltas('not json at all', context()))
      .toEqual({ deltas: [], dropped: [] })
    expect(parseFinalizedCharacterCardDeltas('', context())).toEqual({ deltas: [], dropped: [] })
  })

  it('剥得掉 markdown 代码围栏', () => {
    const fenced = '```json\n' + payload([
      { characterId: 'c1', kind: 'hit', forbidden: 'X1', cost: '按了手印', broken: true, evidence: { text: QUOTE } },
    ]) + '\n```'
    expect(parseFinalizedCharacterCardDeltas(fenced, context()).deltas).toHaveLength(1)
  })

  it('丢弃冻结名单里没有的 characterId', () => {
    const result = parseFinalizedCharacterCardDeltas(payload([
      { characterId: 'nobody', kind: 'hit', forbidden: 'X1', cost: 'x', evidence: { text: QUOTE } },
    ]), context())
    expect(result.deltas).toEqual([])
    expect(result.dropped).toEqual([{ index: 0, reason: 'unknown-character' }])
  })

  it('引文不唯一时丢弃该条', () => {
    const repeated = `${CONTENT}${CONTENT}`
    const ctx = { ...context(), content: repeated, source: { ...context().source, contentHash: createHash('sha256').update(repeated).digest('hex') } }
    const result = parseFinalizedCharacterCardDeltas(payload([
      { characterId: 'c1', kind: 'hit', forbidden: 'X1', cost: 'x', evidence: { text: QUOTE } },
    ]), ctx)
    expect(result.deltas).toEqual([])
    expect(result.dropped).toEqual([{ index: 0, reason: 'evidence-invalid' }])
  })

  it('代价超 60 字直接丢弃，不截断', () => {
    const result = parseFinalizedCharacterCardDeltas(payload([
      { characterId: 'c1', kind: 'hit', forbidden: 'X1', cost: '代'.repeat(61), evidence: { text: QUOTE } },
    ]), context())
    expect(result.deltas).toEqual([])
    expect(result.dropped).toEqual([{ index: 0, reason: 'cost-too-long' }])
  })

  it('禁区编号写成别的形态就丢弃', () => {
    for (const forbidden of ['第一条', 'X', 'D1', 1]) {
      const result = parseFinalizedCharacterCardDeltas(payload([
        { characterId: 'c1', kind: 'hit', forbidden, cost: 'x', evidence: { text: QUOTE } },
      ]), context())
      expect(result.deltas, String(forbidden)).toEqual([])
      expect(result.dropped[0]?.reason).toBe('invalid-shape')
    }
  })

  it('软肋超过 5 条就丢弃后来的', () => {
    const deltas = Array.from({ length: 6 }, (_, index) => ({
      characterId: 'c1', kind: 'soft-spot', name: `接口${index + 1}`, text: 'x', evidence: { text: QUOTE },
    }))
    const result = parseFinalizedCharacterCardDeltas(payload(deltas), context())
    expect(result.deltas).toHaveLength(5)
    expect(result.dropped).toEqual([{ index: 5, reason: 'soft-spot-cap' }])
  })

  it('replace 缺 replaces 就丢弃', () => {
    const result = parseFinalizedCharacterCardDeltas(payload([
      { characterId: 'c1', kind: 'chip', change: 'replace', name: '三百文', text: 'x', evidence: { text: QUOTE } },
    ]), context())
    expect(result.deltas).toEqual([])
    expect(result.dropped).toEqual([{ index: 0, reason: 'invalid-shape' }])
  })

  it('change 缺省按 add 处理', () => {
    const result = parseFinalizedCharacterCardDeltas(payload([
      { characterId: 'c1', kind: 'chip', name: '旧路引', text: '他能走盐道的凭据', evidence: { text: QUOTE } },
    ]), context())
    expect(result.deltas[0]).toMatchObject({ change: 'add', name: '旧路引' })
  })

  it('规范化禁区编号的各种写法', () => {
    expect(normalizeForbiddenId('X1')).toBe('X1')
    expect(normalizeForbiddenId('x 2')).toBe('X2')
    expect(normalizeForbiddenId(' X03 ')).toBe('X3')
    expect(normalizeForbiddenId('第一条')).toBeUndefined()
    expect(normalizeForbiddenId(undefined)).toBeUndefined()
  })
})
