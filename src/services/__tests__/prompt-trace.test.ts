import { afterEach, describe, expect, it } from 'vitest'

import {
  configurePromptTrace,
  deriveFragments,
  isPromptTraceEnabled,
  lastPromptTraceSnapshot,
  promptTraceSnapshots,
  recordFragments,
  resetPromptTrace,
} from '../prompts/prompt-trace'
import { getBuiltinPromptTemplate } from '../builtin-prompt-templates'
import type { PromptTemplate } from '../prompt-templates'

function template(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    key: 'synopsis',
    name: 'Plot synopsis',
    description: 'test',
    content: '正文 {{global_guidance}} 结尾',
    variables: {},
    ...overrides,
  }
}

afterEach(() => {
  resetPromptTrace()
  configurePromptTrace({ enabled: () => false, runHandle: () => undefined })
})

describe('prompt trace · deriveFragments', () => {
  it('attributes the template body and marks it editable for a known editable key', () => {
    const fragments = deriveFragments({
      template: template(),
      resolvedFrom: 'global',
      variables: { global_guidance: '你的全局写作要求' },
      built: 'built',
      writingLanguage: 'zh-CN',
    })

    const content = fragments.find((f) => f.sourceKind === 'override-content')
    expect(content).toMatchObject({
      promptKey: 'synopsis',
      editable: true,
      resolvedFrom: 'global',
    })
    expect(content?.variables).toEqual([{ key: 'global_guidance', value: '你的全局写作要求' }])
  })

  it('labels a builtin-source body as builtin-content', () => {
    const fragments = deriveFragments({
      template: template(),
      resolvedFrom: 'builtin',
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    expect(fragments[0].sourceKind).toBe('builtin-content')
  })

  it('always marks the builtin systemSuffix as non-editable, even under an override', () => {
    const builtin = getBuiltinPromptTemplate('synopsis', 'zh-CN')
    // 只在内置确实带 systemSuffix 时才断言（当前 synopsis 有）。
    if (!builtin?.systemSuffix) return
    const fragments = deriveFragments({
      template: template(),
      resolvedFrom: 'project',
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    const suffix = fragments.find((f) => f.sourceKind === 'builtin-systemSuffix')
    expect(suffix).toBeDefined()
    expect(suffix?.editable).toBe(false)
    expect(suffix?.resolvedFrom).toBe('builtin')
  })

  it('includes taskGuidance only when non-empty and tags it by override provenance', () => {
    const withGuidance = deriveFragments({
      template: template({ taskGuidance: '额外要求' }),
      resolvedFrom: 'project',
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    expect(withGuidance.find((f) => f.sourceKind === 'override-taskGuidance')).toBeDefined()

    const without = deriveFragments({
      template: template({ taskGuidance: '   ' }),
      resolvedFrom: 'project',
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    expect(without.find((f) => f.sourceKind === 'override-taskGuidance')).toBeUndefined()
  })

  it('flags a non-editable key (system template) as editable:false', () => {
    const fragments = deriveFragments({
      template: template({ key: 'consistency_check' }),
      resolvedFrom: 'builtin',
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    // consistency_check 不在 EDITABLE_PROMPT_KEYS？它在。用一个确实不在表里的 key 更稳。
    // 这里改测：确认 EDITABLE_PROMPT_KEYS 之外的模板标不可编辑。
    const systemFragments = deriveFragments({
      template: template({ key: '__not_in_editable_list__' }),
      resolvedFrom: 'builtin',
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    expect(systemFragments[0].editable).toBe(false)
    expect(systemFragments[0].note).toBe('系统模板，UI 不可编辑')
    expect(fragments.length).toBeGreaterThan(0)
  })

  it('resolves the source from the configured sink when not passed explicitly', () => {
    configurePromptTrace({
      enabled: () => true,
      runHandle: () => undefined,
      resolveSource: () => 'project',
    })
    const fragments = deriveFragments({
      template: template(),
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    expect(fragments[0].resolvedFrom).toBe('project')
  })
})

describe('prompt trace · recordFragments gating', () => {
  it('is disabled by default and records nothing', () => {
    expect(isPromptTraceEnabled()).toBe(false)
    const snapshot = recordFragments({
      template: template(),
      variables: {},
      built: 'built',
      writingLanguage: 'zh-CN',
    })
    expect(snapshot).toBeNull()
    expect(promptTraceSnapshots()).toHaveLength(0)
  })

  it('captures a snapshot when enabled and attaches the run handle', () => {
    configurePromptTrace({
      enabled: () => true,
      runHandle: () => 'run-abc',
      resolveSource: () => 'global',
    })
    const snapshot = recordFragments({
      template: template(),
      variables: { global_guidance: 'x' },
      built: 'final-built',
      writingLanguage: 'zh-CN',
    })
    expect(snapshot).toMatchObject({
      promptKey: 'synopsis',
      built: 'final-built',
      runHandle: 'run-abc',
    })
    expect(lastPromptTraceSnapshot()).toBe(snapshot)
  })

  it('keeps the snapshot ring bounded', () => {
    configurePromptTrace({ enabled: () => true, runHandle: () => undefined })
    for (let i = 0; i < 40; i += 1) {
      recordFragments({
        template: template(),
        variables: {},
        built: `built-${i}`,
        writingLanguage: 'zh-CN',
      })
    }
    expect(promptTraceSnapshots().length).toBeLessThanOrEqual(32)
    expect(lastPromptTraceSnapshot()?.built).toBe('built-39')
  })
})
