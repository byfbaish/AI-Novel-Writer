import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { reviewExecutionContract } from '../review-execution-contract'

const zh = reviewExecutionContract('zh-CN')
const en = reviewExecutionContract('en-US')

describe('reviewExecutionContract', () => {
  it('标明这是判定标准而非写作指令', () => {
    expect(zh).toContain('用于判定，不是写作指令')
    expect(en).toContain('for judging, not writing instructions')
  })

  it('给出六条可判定口径：兑现 / 可推进 / 定稿优先 / 计划非禁令 / 疑点非结论 / 核对范围', () => {
    for (const key of ['【任务兑现】', '【可推进范围】', '【已定稿事实优先】', '【计划不是禁令】', '【疑点不是结论】', '【核对范围】']) {
      expect(zh).toContain(key)
    }
    for (const key of ['[Task completion]', '[Advancement scope]', '[Established facts prevail]', '[Plans are not prohibitions]', '[Doubt is not conclusion]', '[Scope of checking]']) {
      expect(en).toContain(key)
    }
  })

  it('把写作义务改写成判据：计划/承诺/否定翻转不等于结果已发生', () => {
    expect(zh).toContain('计划、决定、承诺、保证、签字认责、单纯否定翻转，都不等于结果已经发生')
    expect(zh).toContain('同一笔钱款或物品不得同时写成已收回与仍然失去')
    expect(en).toContain('is not evidence that the result occurred')
    expect(en).toContain('the same money or item cannot be both recovered and still lost')
  })

  it('抑制两类已知误报：无代价情节、人物改变计划', () => {
    expect(zh).toContain('普通无代价情节不要求新增代价')
    expect(zh).toContain('不构成矛盾')
    expect(en).toContain('an ordinary event with no cost does not require an added cost')
  })

  it('控制体积：审稿口径不得膨胀成第二份合同', () => {
    // 审稿 prompt 已有大量裁决规则（证据锚点、时间一致性、作者设定优先…）。
    // 口径再涨到四位数就会稀释注意力，所以这里守卫一个上限。
    expect(zh.length).toBeLessThan(1100)
    expect(en.length).toBeLessThan(2800)
  })

  it('不复述已有专门落点的条款（时间承接 / 远期设定 / 续写操作边界）', () => {
    expect(zh).not.toContain('【时间承接】')
    expect(zh).not.toContain('不得写成「昨天」「昨夜」')
    expect(zh).not.toContain('【远期设定边界】')
    expect(zh).not.toContain('续写及无进展恢复只接续已有正文')
    expect(en).not.toContain('[Time continuity]')
    expect(en).not.toContain('[Later-stage setting boundary]')
  })
})

describe('生成侧条款覆盖契约', () => {
  /** 从生成侧某个函数的源码里抓出条款标题（`【…】`）。 */
  const clauseTitlesOf = (file: string, anchor: string): string[] => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    const start = source.indexOf(anchor)
    expect(start, anchor).toBeGreaterThan(-1)
    const body = source.slice(start, source.indexOf('\n}\n', start))
    // 排除两类非条款：合同总标题（容器），以及被引用的材料名（不是规则条目）。
    return [...new Set([...body.matchAll(/【[^】]{2,12}】/g)].map(match => match[0]))]
      .filter(title => !['【本章执行合同】', '【本章写作方向】'].includes(title))
  }

  const generatingClauseTitles = (): string[] => [
    ...clauseTitlesOf('../../services/workflows/commands/generate-draft.command.ts', 'function chapterExecutionContractText'),
    // 时间承接被生成侧拆到独立模块，抓取面必须跟过去，否则它换条款时这里仍然是绿的。
    ...clauseTitlesOf('../chapter-time-continuity.ts', 'export function chapterTimeContinuity'),
  ]

  it('生成侧每条条款都在对照表里表态（进 / 不进 / 改写）', () => {
    const ownSource = readFileSync(new URL('../review-execution-contract.ts', import.meta.url), 'utf8')
    const titles = generatingClauseTitles()
    // 9 条：作者本章任务、本章可推进的事件、远期设定边界、前文已定稿事实、
    // 前文计划与本章决定、本章事件兑现、前文待核实问题、时间承接、操作边界
    expect(titles.length).toBe(9)
    const untracked = titles.filter(title => !ownSource.includes(`| ${title} |`))
    expect(untracked).toEqual([])
  })
})
