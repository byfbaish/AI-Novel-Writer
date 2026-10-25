import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { generationOutputContract, generationOutputForPurpose, generationPrimaryOutput } from '../generation-owner-contract'
import { withoutComments } from '../../../test/source-contract'

const selection = (output: 'visible-text' | 'structured-data', overrides?: { purpose: string; output: 'visible-text' | 'structured-data' }[]) => ({
  output, ...(overrides ? { outputOverrides: overrides } : {}),
}) as Parameters<typeof generationOutputContract>[0]

/**
 * 输出合同有两种形态，判形态只能走解析函数：
 * - 无例外 ⇒ 字符串
 * - 有例外 ⇒ `{ primary, overrides }` 对象
 *
 * 2026-10-26 实机：W6 波 1 给世界观加了自审 + 资源抽取两个 structured-data 例外后，
 * 世界观主产物的 `composeVisible` 必然抛 `GENERATION_COMPOSITION_OUTPUT_INVALID`，
 * 因为仓库层当时用 `contract !== 'visible-text'` 硬比字符串。主产物本身完全合法。
 */
describe('generation output contract resolution', () => {
  it('keeps a bare string contract as the primary output', () => {
    expect(generationPrimaryOutput('visible-text')).toBe('visible-text')
    expect(generationPrimaryOutput('structured-data')).toBe('structured-data')
  })

  it('reads primary out of an overridden contract instead of failing the whole comparison', () => {
    const contract = generationOutputContract(selection('visible-text', [
      { purpose: 'world-building-self-review', output: 'structured-data' },
      { purpose: 'world-building-resource-extract', output: 'structured-data' },
    ]))

    // 合同已不是字符串 —— 这正是硬比字符串的调用点集体失效的形态。
    expect(typeof contract).not.toBe('string')
    expect(generationPrimaryOutput(contract)).toBe('visible-text')
  })

  it('resolves a purpose to its explicit exception and falls back to primary otherwise', () => {
    const contract = generationOutputContract(selection('structured-data', [
      { purpose: 'generate-global-guidance-replacement', output: 'visible-text' },
    ]))

    expect(generationOutputForPurpose(contract, 'generate-global-guidance-replacement')).toBe('visible-text')
    expect(generationOutputForPurpose(contract, 'generate-global-config')).toBe('structured-data')
  })

  it('resolves every purpose to the bare string when there are no exceptions', () => {
    expect(generationOutputForPurpose('visible-text', 'generate-world-building')).toBe('visible-text')
  })

  it('returns undefined for a malformed or missing contract instead of guessing a shape', () => {
    expect(generationPrimaryOutput(undefined)).toBeUndefined()
    expect(generationPrimaryOutput({ overrides: [] })).toBeUndefined()
    expect(generationPrimaryOutput(42)).toBeUndefined()
    expect(generationOutputForPurpose({ primary: 'visible-text', overrides: 'nope' }, 'x')).toBe('visible-text')
  })
})

/**
 * 源码守卫：合同形态解析只许走 `generationPrimaryOutput` / `generationOutputForPurpose`。
 * 直接拿 `outputContract` 与形态字面量比较，等于把「带例外的 run」一律判非法。
 */
describe('output contract is never compared as a raw string', () => {
  const files = [
    'electron/repositories/generation-run-repository.ts',
    'electron/services/main-generation-owner.ts',
  ]

  it.each(files)('%s resolves the contract through the shared helper', file => {
    const source = withoutComments(file, readFileSync(resolve(file), 'utf8'))
    const raw = /outputContract\s*[!=]==?\s*'(?:visible-text|structured-data)'/u.test(source)
    expect(raw, `${file} 用字符串硬比 outputContract；带 outputOverrides 的 run 会整批失败`).toBe(false)
  })
})
