import { afterEach, describe, expect, it } from 'vitest'
import {
  classifyLlmProbePurpose,
  inspectLlmProbeMessages,
  isLlmProbeEnabled,
  probeLlmRequest,
} from '../llm-probe'

const ORIGINAL = process.env.AI_NOVEL_LLM_PROBE

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AI_NOVEL_LLM_PROBE
  else process.env.AI_NOVEL_LLM_PROBE = ORIGINAL
})

describe('isLlmProbeEnabled', () => {
  it('默认关闭', () => {
    delete process.env.AI_NOVEL_LLM_PROBE
    expect(isLlmProbeEnabled()).toBe(false)
  })

  it('仅显式开启值生效', () => {
    process.env.AI_NOVEL_LLM_PROBE = '1'
    expect(isLlmProbeEnabled()).toBe(true)
    process.env.AI_NOVEL_LLM_PROBE = 'off'
    expect(isLlmProbeEnabled()).toBe(false)
    process.env.AI_NOVEL_LLM_PROBE = 'false'
    expect(isLlmProbeEnabled()).toBe(false)
  })
})

describe('classifyLlmProbePurpose', () => {
  it('按用途归类', () => {
    expect(classifyLlmProbePurpose('chapter-blueprint-directory:compact-single:chapter-1')).toBe('blueprint')
    expect(classifyLlmProbePurpose('plot-outline:chapter:12:normal')).toBe('outline')
    expect(classifyLlmProbePurpose('chapter-draft')).toBe('draft')
    expect(classifyLlmProbePurpose('plot-structure-generation')).toBe('arc')
    expect(classifyLlmProbePurpose('something-else')).toBe('other')
  })
})

describe('inspectLlmProbeMessages', () => {
  it('识别整份大纲注入与章级条目范围', () => {
    const outline = [
      '# 情节大纲',
      '',
      '## 第1章：开场',
      '正文一',
      '',
      '## 第2章：推进',
      '正文二',
    ].join('\n')
    const signals = inspectLlmProbeMessages([{ role: 'user', content: outline }])
    expect(signals.hasPlotOutlineTitle).toBe(true)
    expect(signals.chapterEntries).toBe(2)
    expect(signals.firstChapter).toBe(1)
    expect(signals.lastChapter).toBe(2)
  })

  it('按章切片时只计一条', () => {
    const sliced = ['# 情节大纲', '', '## 第7章：潜入', '正文'].join('\n')
    const signals = inspectLlmProbeMessages([{ role: 'user', content: sliced }])
    expect(signals.chapterEntries).toBe(1)
    expect(signals.firstChapter).toBe(7)
    expect(signals.lastChapter).toBe(7)
  })

  it('兼容英文章标题', () => {
    const signals = inspectLlmProbeMessages([
      { role: 'user', content: '# Plot Outline\n\n## Chapter 3: Turn\nbody' },
    ])
    expect(signals.hasPlotOutlineTitle).toBe(true)
    expect(signals.chapterEntries).toBe(1)
    expect(signals.firstChapter).toBe(3)
  })

  it('不计入非章级标题（例如小弧的「第3–5章」范围不作为独立条目标题）', () => {
    const signals = inspectLlmProbeMessages([
      { role: 'user', content: '## 第1章：开场\n正文\n\n这是第 4 章的伏笔。' },
    ])
    expect(signals.chapterEntries).toBe(1)
  })

  it('识别弧光标志与蓝图字段', () => {
    const prompt = [
      '【篇幅预算】总 800 章',
      '## 大弧一：开局',
      '### 中弧 1：起步',
      '【本章写作方向与核心任务】',
      '{"chapterNumber":1,"keyEvents":"主角做了什么","suspenseHook":"钩子"}',
    ].join('\n')
    const signals = inspectLlmProbeMessages([{ role: 'user', content: prompt }])
    expect(signals.arcMarkers).toBeGreaterThanOrEqual(3)
    expect(signals.blueprintFields).toBeGreaterThanOrEqual(2)
    expect(signals.hasBlueprintHeading).toBe(true)
    expect(signals.hasPlotOutlineTitle).toBe(false)
  })

  it('统计每条 message 的字符数', () => {
    const signals = inspectLlmProbeMessages([
      { role: 'system', content: 'abc' },
      { role: 'user', content: 'defgh' },
    ])
    expect(signals.chars).toBe(9)
    expect(signals.messageSizes).toEqual([
      { role: 'system', chars: 3 },
      { role: 'user', chars: 5 },
    ])
  })
})

describe('probeLlmRequest', () => {
  it('未开启时返回 null，不做任何记录', () => {
    delete process.env.AI_NOVEL_LLM_PROBE
    const handle = probeLlmRequest(
      { modelId: 'm', messages: [{ role: 'user', content: 'hi' }] },
      'invoke',
    )
    expect(handle).toBeNull()
  })
})
