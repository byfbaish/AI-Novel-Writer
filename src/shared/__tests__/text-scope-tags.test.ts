import { describe, expect, it } from 'vitest'

import {
  projectScopedConfigFields,
  projectScopedText,
  summarizeScopedText,
  textScopeTagToken,
  TEXT_SCOPE_TAG_CHOICES,
} from '../text-scope-tags'

describe('projectScopedText · 向后兼容', () => {
  it('无标签时逐字返回原文（旧数据零改动的第一保证）', () => {
    const raw = '维持 pulp 爽文基调。\n\n\n  少比喻、少通感。\n'
    const result = projectScopedText(raw, 'architecture')
    // 走快路径：连首尾空白与连续空行都不规范化 —— 投影前后必须**逐字相同**。
    expect(result.text).toBe(raw)
    expect(result.dropped).toBe(0)
    expect(projectScopedText(raw, 'draft').text).toBe(raw)
    expect(projectScopedText(raw, 'all').text).toBe(raw)
  })

  it('无标签时统计为「全部步骤」', () => {
    const stats = summarizeScopedText('第一段\n\n第二段')
    expect(stats).toMatchObject({ architecture: 1, outline: 1, draft: 1, everyStep: 1, total: 1 })
    expect(stats.unknownTags).toEqual([])
  })
})

describe('projectScopedText · 段级归属', () => {
  const tagged = [
    '共同段：两边都要看。',
    '',
    '【适用：架构】',
    '架构段：体系与机制的借鉴。',
    '',
    '【适用：正文】',
    '正文段：一句一段、弹幕用【】。',
  ].join('\n')

  it('按档位只保留该侧内容', () => {
    const architecture = projectScopedText(tagged, 'architecture')
    expect(architecture.text).toContain('共同段')
    expect(architecture.text).toContain('架构段')
    expect(architecture.text).not.toContain('正文段')
    expect(architecture.dropped).toBe(1)

    const draft = projectScopedText(tagged, 'draft')
    expect(draft.text).toContain('共同段')
    expect(draft.text).not.toContain('架构段')
    expect(draft.text).toContain('正文段')
  })

  it('架构档不会顺流到大纲（作者裁定：大纲蓝图不该重复吃上层材料）', () => {
    const outline = projectScopedText(tagged, 'outline')
    expect(outline.text).toContain('共同段')
    expect(outline.text).not.toContain('架构段')
    expect(outline.text).not.toContain('正文段')
    expect(outline.dropped).toBe(2)
  })

  it('段继承：标签作用于其后所有内容，直到下一个标签行', () => {
    const raw = '【适用：架构】\nA\n\nB\n\nC'
    const draft = projectScopedText(raw, 'draft')
    expect(draft.text).toBe('')
    expect(draft.dropped).toBe(1)
    expect(projectScopedText(raw, 'architecture').text).toBe('A\n\nB\n\nC')
  })

  it('组合值：一段可同时给多侧（架构,正文）', () => {
    const raw = '【适用：架构,正文】\n基调：口语直白。'
    expect(projectScopedText(raw, 'architecture').text).toBe('基调：口语直白。')
    expect(projectScopedText(raw, 'draft').text).toBe('基调：口语直白。')
    expect(projectScopedText(raw, 'outline').text).toBe('')
  })

  it('显式「全部」等价于不打标签', () => {
    const raw = '【适用：全部】\n两边都能看。'
    expect(projectScopedText(raw, 'architecture').text).toBe('两边都能看。')
    expect(projectScopedText(raw, 'draft').text).toBe('两边都能看。')
    expect(summarizeScopedText(raw).everyStep).toBe(1)
  })

  it('未知标签按全量处理并告警（绝不静默丢材料）', () => {
    const raw = '【适用：蓝图】\n这段归属没被识别。'
    const result = projectScopedText(raw, 'draft')
    // 内容**不丢**（按全量），且标签行本身不进 prompt。
    expect(result.text).toBe('这段归属没被识别。')
    expect(result.stats.unknownTags).toEqual(['蓝图'])
  })

  it('已知值 + 未知值混写时整段按全量并告警', () => {
    const raw = '【适用：架构,蓝图】\n混写。'
    const result = projectScopedText(raw, 'draft')
    expect(result.text).toBe('混写。')
    expect(result.stats.unknownTags).toEqual(['蓝图'])
  })
})

describe('projectScopedText · 硬边界与容错', () => {
  it('行内【】一律不是标签（作者文本里本就有「弹幕语言用【】括起来」）', () => {
    const raw = [
      '弹幕语言用【】括起来。',
      '正文里出现【适用：架构】也不算标签，因为它不在行首独立成行。',
      '   【适用：正文】',
      '只有正文看得到。',
    ].join('\n')
    const draft = projectScopedText(raw, 'draft')
    expect(draft.text).toContain('弹幕语言用【】括起来。')
    expect(draft.text).toContain('正文里出现【适用：架构】也不算标签')
    // 前导空白不影响识别：整行独立的标签仍然生效。
    expect(draft.text).toContain('只有正文看得到。')

    const architecture = projectScopedText(raw, 'architecture')
    // 行内那句是普通正文，属于未标注段 —— 两侧都要保留，绝不能因为"看起来像标签"被吃掉。
    expect(architecture.text).toContain('正文里出现【适用：架构】也不算标签')
    expect(architecture.text).not.toContain('只有正文看得到。')
  })

  it('标签行永不进 prompt，且投影可重复施加（幂等）', () => {
    const raw = '【适用：架构】\n只剩这一行。'
    const once = projectScopedText(raw, 'architecture').text
    expect(once).not.toContain('【适用')
    expect(projectScopedText(once, 'architecture').text).toBe(once)
  })

  it('CRLF 容错', () => {
    const raw = '【适用：架构】\r\n架构段\r\n\r\n【适用：正文】\r\n正文段'
    expect(projectScopedText(raw, 'architecture').text).toBe('架构段')
    expect(projectScopedText(raw, 'draft').text).toBe('正文段')
  })

  it('剔除整段后不留三连空行（段间最多一个空行）', () => {
    const raw = 'A\n\n【适用：正文】\nB\n\n【适用：架构】\nC'
    expect(projectScopedText(raw, 'architecture').text).toBe('A\n\nC')
  })

  it("'all' 档位保留全部内容，只剔标签行", () => {
    const raw = 'A\n\n【适用：正文】\nB'
    expect(projectScopedText(raw, 'all').text).toBe('A\n\nB')
    expect(projectScopedText(raw, 'all').dropped).toBe(0)
  })

  it('标签行写了却没写值时按全量处理', () => {
    const raw = '【适用：】\n没写值。'
    expect(projectScopedText(raw, 'draft').text).toBe('没写值。')
    expect(projectScopedText(raw, 'draft').stats.unknownTags).toEqual([])
  })
})

describe('段统计与 chip 字面量', () => {
  it('按档位统计「会进入该链的段数」', () => {
    const raw = [
      '未标注段。',
      '【适用：架构】',
      '架构段。',
      '【适用：大纲】',
      '大纲段。',
      '【适用：正文】',
      '正文段。',
    ].join('\n')
    expect(summarizeScopedText(raw)).toMatchObject({
      architecture: 2,
      outline: 2,
      draft: 2,
      everyStep: 1,
      total: 4,
    })
  })

  it('chip 字面量与解析表同源', () => {
    expect(TEXT_SCOPE_TAG_CHOICES.map(textScopeTagToken)).toEqual([
      '【适用：架构】',
      '【适用：大纲】',
      '【适用：正文】',
      '【适用：全部】',
    ])
    // 反向：chip 插入的文本必须能被解析器识别（否则就是"写了永远不生效"的静默陷阱）。
    for (const choice of TEXT_SCOPE_TAG_CHOICES) {
      const raw = `${textScopeTagToken(choice)}\n内容`
      const parsed = summarizeScopedText(raw)
      if (choice === 'all') expect(parsed.everyStep).toBe(1)
      else expect(parsed[choice]).toBe(1)
    }
  })
})

describe('projectScopedConfigFields · 整份 config 直灌 prompt 的注入点', () => {
  const tagged = {
    genre: '悬疑',
    totalChapters: 845,
    globalGuidance: '【适用：正文】\n正文形态纪律。',
    referenceWorks: [
      '参考《A》：规则依托实物线索。',
      '【适用：架构】',
      '参考《B》：休整区编号标记入场批次。',
      '【适用：架构,大纲】',
      '参考《C》：规则条文自带矛盾。',
      '【适用：架构,正文】',
      '参考《D》：主角无线索看破天赋。',
    ].join('\n'),
  }

  it('只投影自由文本字段，其它字段原样保留', () => {
    const projected = projectScopedConfigFields(tagged, 'outline')
    expect(projected.genre).toBe('悬疑')
    expect(projected.totalChapters).toBe(845)
    // 大纲档：未标注段 + 【适用：架构,大纲】段保留；架构专享与正文专享都被剔除。
    expect(projected.referenceWorks).toContain('参考《A》')
    expect(projected.referenceWorks).toContain('参考《C》')
    expect(projected.referenceWorks).not.toContain('参考《B》')
    expect(projected.referenceWorks).not.toContain('参考《D》')
    expect(projected.globalGuidance).toBe('')
  })

  it('标签行永不进 prompt（含被保留下来的段）', () => {
    const projected = projectScopedConfigFields(tagged, 'outline')
    expect(JSON.stringify(projected)).not.toContain('【适用')
  })

  it('无标签的旧配置逐字不变', () => {
    const legacy = {
      genre: '悬疑',
      globalGuidance: '基调：口语直白。\n\n\n  压迫感强。',
      referenceWorks: '参考《A》：规则依托实物线索。',
    }
    const projected = projectScopedConfigFields(legacy, 'draft')
    expect(projected.globalGuidance).toBe(legacy.globalGuidance)
    expect(projected.referenceWorks).toBe(legacy.referenceWorks)
  })

  it('不该碰的字段类型原样透传（非字符串）', () => {
    const projected = projectScopedConfigFields({ ...tagged, narrativeThreadDormantChapterThreshold: 3 }, 'draft')
    expect(projected.narrativeThreadDormantChapterThreshold).toBe(3)
  })
})
