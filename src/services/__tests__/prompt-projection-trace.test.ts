import { afterEach, describe, expect, it } from 'vitest'

import {
  configurePromptTrace,
  notePromptProjection,
  recordFragments,
  resetPromptTrace,
} from '../prompts/prompt-trace'
import { buildTraceMarkdown } from '../prompts/prompt-trace-markdown'
import type { PromptTemplate } from '../prompt-templates'
import { projectArchitectureForDraft } from '../../shared/architecture-projection'
import { buildBoundaryNotice } from '../../shared/chapter-boundary'

/**
 * P1-3′ 可观测性：变量投影元数据的端到端链路
 * 「投影函数返回元数据 → notePromptProjection 登记 → recordFragments 吸附 → markdown 呈现」。
 *
 * 设计依据：`docs/design/p1-3-variable-export-scoping-design.md` §6（附录 D 的 `projection` 元数据）。
 * 本测试只验证**诊断元数据**，不改任何请求内容。
 */

const ARCH_WITH_FAR_TERM = `# 世界观
### 1.【核心规则与体系漏洞】
本世界运转的核心规则：写在纸上的陈述会被现实采纳。
### 3.【隐喻与深层危机】
终极谜团：能力不是天降的，是被「写」进来的。
埋在城市里的三条线索：零号档案、合照里少一个人。
主角的终极抉择：留住自己还是世界。
### 4.【空间结构（地图与区域）】
老陈记｜hours=07:00-09:00`

function template(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    key: 'synopsis',
    name: 'Plot synopsis',
    description: 'test',
    content: '正文 {{architecture}} 结尾',
    variables: {},
    ...overrides,
  }
}

function enableTrace(): void {
  configurePromptTrace({ enabled: () => true, runHandle: () => 'run/test' })
}

afterEach(() => {
  resetPromptTrace()
  configurePromptTrace({ enabled: () => false, runHandle: () => undefined })
})

describe('projectArchitectureForDraft · 元数据', () => {
  it('整节边界化时给出投影元数据（含被边界化的标题、省下的字数）', () => {
    const result = projectArchitectureForDraft(ARCH_WITH_FAR_TERM, 'zh-CN')
    expect(result.projection).toEqual({
      variable: 'architecture',
      kind: 'far-term-section-collapse',
      beforeChars: ARCH_WITH_FAR_TERM.length,
      afterChars: result.text.length,
      droppedSections: ['### 3.【隐喻与深层危机】'],
    })
    // fail-open 之外，投影必须真的更短。
    expect(result.projection!.afterChars).toBeLessThan(result.projection!.beforeChars)
  })

  it('fail-open 时 projection 为 null（没有该节 / 空输入 / 已投影过）', () => {
    expect(projectArchitectureForDraft('# 世界观\n### 1.【核心规则与体系漏洞】\n规则一。', 'zh-CN').projection).toBeNull()
    expect(projectArchitectureForDraft('', 'zh-CN').projection).toBeNull()
    expect(projectArchitectureForDraft(undefined, 'zh-CN').projection).toBeNull()

    const once = projectArchitectureForDraft(ARCH_WITH_FAR_TERM, 'zh-CN').text
    expect(projectArchitectureForDraft(once, 'zh-CN').projection).toBeNull()
  })
})

describe('buildBoundaryNotice · 元数据', () => {
  it('收敛后续计划时给出投影元数据（输入为事件逐字文本总长）', () => {
    const result = buildBoundaryNotice('zh-CN', {
      chapters: [{
        chapterNumber: 2,
        title: '升职第一天',
        keyEvents: [{ id: 'ch2:E1', event: '他回到大厦。又走了很远很远的路，一路都在想事情。', estimatedUnits: 0 }],
      }],
    })
    expect(result.projection).toMatchObject({
      variable: 'future_blueprints',
      kind: 'future-plan-boundary-notice',
    })
    expect(result.projection!.beforeChars).toBeGreaterThan(result.projection!.afterChars)
    expect(result.projection!.droppedSections).toEqual([])
  })

  it('没有可列事件 ⇒ 空串且 projection 为 null', () => {
    const result = buildBoundaryNotice('zh-CN', { chapters: [] })
    expect(result.text).toBe('')
    expect(result.projection).toBeNull()
  })
})

describe('prompt trace · 投影吸附', () => {
  it('正向：登记的投影被吸附到紧随其后的快照', () => {
    enableTrace()
    const note = projectArchitectureForDraft(ARCH_WITH_FAR_TERM, 'zh-CN').projection!
    notePromptProjection(note)

    const snapshot = recordFragments({
      template: template(),
      variables: { architecture: '投影后的正文' },
      built: '投影后的正文',
      writingLanguage: 'zh-CN',
    })

    expect(snapshot?.projections).toEqual([note])
  })

  it('无登记时快照不带 projections 字段（旧文件形状，向后兼容）', () => {
    enableTrace()
    const snapshot = recordFragments({
      template: template(),
      variables: { architecture: 'x' },
      built: 'x',
      writingLanguage: 'zh-CN',
    })
    expect(snapshot).not.toBeNull()
    expect('projections' in (snapshot as object)).toBe(false)
  })

  it('消费后清空：下一次快照不再重复携带上一次的投影', () => {
    enableTrace()
    notePromptProjection({
      variable: 'architecture',
      kind: 'far-term-section-collapse',
      beforeChars: 10,
      afterChars: 5,
      droppedSections: ['### 3.x'],
    })
    const first = recordFragments({ template: template(), variables: {}, built: 'a', writingLanguage: 'zh-CN' })
    const second = recordFragments({ template: template(), variables: {}, built: 'b', writingLanguage: 'zh-CN' })
    expect(first?.projections).toHaveLength(1)
    expect(second?.projections).toBeUndefined()
  })

  it('追踪关闭时：登记被静默丢弃，且不产生快照（零开销/零副作用）', () => {
    expect(() => notePromptProjection({
      variable: 'architecture',
      kind: 'far-term-section-collapse',
      beforeChars: 10,
      afterChars: 5,
      droppedSections: [],
    })).not.toThrow()

    const snapshot = recordFragments({
      template: template(),
      variables: {},
      built: 'a',
      writingLanguage: 'zh-CN',
    })
    expect(snapshot).toBeNull()
  })
})

describe('trace markdown · 投影呈现', () => {
  it('渲染「变量投影」区块，含改写前后字数与被边界化的块', () => {
    const markdown = buildTraceMarkdown({
      operation: 'draft',
      writtenAt: 0,
      snapshots: [{
        promptKey: 'next_chapter_draft',
        writingLanguage: 'zh-CN',
        capturedAt: 0,
        builtLength: 120,
        built: '拼装后的正文',
        fragments: [{
          order: 1,
          sourceKind: 'override-content',
          label: '模板正文',
          editable: true,
          rawText: '正文 {{architecture}}',
          variables: [{ key: 'architecture', value: 'x' }],
        }],
        projections: [{
          variable: 'architecture',
          kind: 'far-term-section-collapse',
          beforeChars: 6854,
          afterChars: 5958,
          droppedSections: ['### 3.【隐喻与深层危机】'],
        }],
      }],
    })

    expect(markdown).toContain('变量投影')
    expect(markdown).toContain('6854 → 5958 字')
    expect(markdown).toContain('### 3.【隐喻与深层危机】')
  })

  it('无投影时渲染结果不出现该区块（不制造噪声）', () => {
    const markdown = buildTraceMarkdown({
      operation: 'draft',
      writtenAt: 0,
      snapshots: [{
        promptKey: 'next_chapter_draft',
        writingLanguage: 'zh-CN',
        capturedAt: 0,
        builtLength: 10,
        built: 'x',
        fragments: [],
      }],
    })
    expect(markdown).not.toContain('变量投影')
  })
})
