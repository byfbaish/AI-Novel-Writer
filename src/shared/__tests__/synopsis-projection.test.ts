import { describe, expect, it } from 'vitest'
import {
  projectSynopsisForBlueprint,
  renderBlueprintArchitecture,
  synopsisSettingSectionsForDraft,
  type BlueprintArchitecturePart,
} from '../synopsis-projection'

const OUTLINE = [
  '# 情节大纲',
  '',
  '## 第1章：失钟',
  '顾舟遗失潮汐钟。',
  '',
  '## 第2章：回港',
  '顾舟在退潮前回到月桂港。',
  '',
  '## 第3章：潮门',
  '顾舟找到潮门。',
  '',
  '## 第4章：守钟',
  '守钟人交出钥匙。',
  '',
  '## 第5章：终局',
  '潮门真相揭晓。',
].join('\n')

const zh = (options: Omit<Parameters<typeof projectSynopsisForBlueprint>[1], 'writingLanguage'>) => (
  projectSynopsisForBlueprint(OUTLINE, { ...options, writingLanguage: 'zh-CN' })
)

describe('projectSynopsisForBlueprint · 三段切分', () => {
  it('剔前序 / 留本批 / 后续降级为边界声明', () => {
    const projected = zh({ from: 3, to: 4, coveredChapters: new Set([1, 2]) })

    // 前序（被 chapter_list 覆盖）→ 剔除
    expect(projected).not.toContain('## 第1章：失钟')
    expect(projected).not.toContain('顾舟遗失潮汐钟')
    expect(projected).not.toContain('## 第2章：回港')
    expect(projected).not.toContain('顾舟在退潮前回到月桂港')

    // 本批 → 原样保留（含事件细节）
    expect(projected).toContain('## 第3章：潮门')
    expect(projected).toContain('顾舟找到潮门')
    expect(projected).toContain('## 第4章：守钟')
    expect(projected).toContain('守钟人交出钥匙')

    // 后续 → 只留章标题 + 边界声明，事件细节不得进入
    expect(projected).toContain('## 第5章：终局')
    expect(projected).toContain('后续第 5 章，仅作边界声明')
    expect(projected).not.toContain('潮门真相揭晓')
  })

  it('前序章若不在 chapter_list 覆盖范围内则保留（超 100 章项目不净损失信息）', () => {
    // chapter_list 窗口 = previous.slice(-100)：更早的章不在其中 → 不得剔除
    const projected = zh({ from: 3, to: 4, coveredChapters: new Set([2]) })

    expect(projected).toContain('## 第1章：失钟')
    expect(projected).toContain('顾舟遗失潮汐钟')
    // 被覆盖的第 2 章仍然剔除
    expect(projected).not.toContain('## 第2章：回港')
  })

  it('跨章范围标题（第2-3章）必须整段覆盖才剔除', () => {
    const outline = '# 情节大纲\n\n## 第2-3章：合并段\n两章合并。\n\n## 第4章：四\n四。\n'
    const covered = projectSynopsisForBlueprint(outline, {
      from: 4, to: 4, coveredChapters: new Set([2]), writingLanguage: 'zh-CN',
    })
    // 只覆盖了 2 而未覆盖 3 → 整段保留
    expect(covered).toContain('两章合并')
    const fully = projectSynopsisForBlueprint(outline, {
      from: 4, to: 4, coveredChapters: new Set([2, 3]), writingLanguage: 'zh-CN',
    })
    expect(fully).not.toContain('两章合并')
  })

  it('设定层段落始终原样保留（与章级无关）', () => {
    const outline = '# 全书总纲\n潮门只能由守钟人开启。\n\n## 第1章：失钟\n顾舟遗失潮汐钟。\n\n## 全局禁则\n潮门真相只能在终章揭晓。\n'
    const projected = projectSynopsisForBlueprint(outline, {
      from: 3, to: 4, coveredChapters: new Set([1, 2]), writingLanguage: 'zh-CN',
    })
    expect(projected).toContain('潮门只能由守钟人开启')
    expect(projected).toContain('潮门真相只能在终章揭晓')
    expect(projected).not.toContain('顾舟遗失潮汐钟')
  })

  it('结构不可解析时原样返回（含代码围栏 / 层级不一致 / 章号乱序）', () => {
    const fenced = '全局说明\n```text\n## 第1章：示例\n不可丢事实甲\n```\n尾部'
    expect(projectSynopsisForBlueprint(fenced, {
      from: 2, to: 3, coveredChapters: new Set([1]), writingLanguage: 'zh-CN',
    })).toBe(fenced.trim())

    const inconsistent = '## 第1章：甲\n事实甲。\n\n### 第2章：乙\n事实乙。'
    expect(projectSynopsisForBlueprint(inconsistent, {
      from: 3, to: 4, coveredChapters: new Set([1, 2]), writingLanguage: 'zh-CN',
    })).toBe(inconsistent.trim())

    const outOfOrder = '## 第3章：丙\n事实丙。\n\n## 第1章：甲\n事实甲。'
    expect(projectSynopsisForBlueprint(outOfOrder, {
      from: 5, to: 6, coveredChapters: new Set([1, 3]), writingLanguage: 'zh-CN',
    })).toBe(outOfOrder.trim())

    // 一条章标题都没有 = 老项目手写大纲形态 → 原样保留
    const prose = '全局说明：第2章发生的事将在未来改变潮门归属。'
    expect(projectSynopsisForBlueprint(prose, {
      from: 2, to: 3, coveredChapters: new Set(), writingLanguage: 'zh-CN',
    })).toBe(prose)
  })

  it('英文写作语言产出英文边界声明', () => {
    const outline = '# Outline\n\n## Chapter 1: Lost\nLost the bell.\n\n## Chapter 5: End\nTruth revealed.\n'
    const projected = projectSynopsisForBlueprint(outline, {
      from: 3, to: 4, coveredChapters: new Set([1, 2]), writingLanguage: 'en-US',
    })
    expect(projected).toContain('later chapter 5 — boundary declaration only')
    expect(projected).not.toContain('Truth revealed')
  })
})

describe('renderBlueprintArchitecture · 只投影 synopsis 段', () => {
  const parts: BlueprintArchitecturePart[] = [
    { kind: 'premise', text: '故事前提：潮门与守钟人的契约。' },
    { kind: 'characters-arch', text: '角色图谱：顾舟、守钟人。' },
    { kind: 'worldbuilding', text: '世界观：潮门只能由守钟人开启。' },
    { kind: 'synopsis', text: OUTLINE },
  ]

  it('设定事实源（前提/角色/世界观）全量保留，仅 synopsis 做三段切分', () => {
    const rendered = renderBlueprintArchitecture(parts, {
      from: 3, to: 4, coveredChapters: new Set([1, 2]), writingLanguage: 'zh-CN',
    })
    expect(rendered).toContain('故事前提：潮门与守钟人的契约。')
    expect(rendered).toContain('角色图谱：顾舟、守钟人。')
    expect(rendered).toContain('世界观：潮门只能由守钟人开启。')
    expect(rendered).toContain('## 第3章：潮门')
    expect(rendered).not.toContain('顾舟遗失潮汐钟')
    expect(rendered).not.toContain('潮门真相揭晓')
    // 连接符与 directory-workflow 既有口径一致
    expect(rendered).toContain('\n\n---\n\n')
  })

  it('没有 synopsis 段时只拼设定段', () => {
    const rendered = renderBlueprintArchitecture([parts[0]!], {
      from: 1, to: 5, coveredChapters: new Set(), writingLanguage: 'zh-CN',
    })
    expect(rendered).toBe('故事前提：潮门与守钟人的契约。')
  })
})

describe('synopsisSettingSectionsForDraft · 正文侧行为未变（回归）', () => {
  it('剔除全部章级条目，只留设定层', () => {
    const outline = '# 全书总纲\n潮门只能由守钟人开启。\n\n## 第1章：失钟\n顾舟遗失潮汐钟。\n\n## 全局禁则\n潮门真相只能在终章揭晓。'
    const projected = synopsisSettingSectionsForDraft(outline)
    expect(projected).toContain('潮门只能由守钟人开启')
    expect(projected).toContain('潮门真相只能在终章揭晓')
    expect(projected).not.toContain('顾舟遗失潮汐钟')
  })

  it('只剩悬空标题时不注入', () => {
    expect(synopsisSettingSectionsForDraft('# 情节大纲\n\n## 第1章：零点\n爆发。\n\n## 第2章：回港\n回港。')).toBe('')
  })

  it('含代码围栏时整体原样保留', () => {
    const fenced = '全局说明\n```text\n## 第1章：示例\n不可丢事实甲\n## 第2章：示例\n不可丢事实乙\n```\n全局尾部'
    expect(synopsisSettingSectionsForDraft(fenced)).toBe(fenced)
  })
})
