import { describe, expect, it } from 'vitest'
import {
  describeWorldBuildingCompleteness,
  inspectWorldBuildingCompleteness,
} from '../worldbuilding-completeness'

/** 取自内置模板（`builtin-prompt-templates.ts:584-589`）的五维标题与起点行要求（`:628-634`）。 */
const COMPLETE_ZH = `### 1.【核心规则与体系漏洞】
能力的触发条件与代价。

### 2.【阶层断层与资源战场】
阶层与资源。

### 3.【隐喻与深层危机】
城市是一座没有出口的钟。

### 4.【空间结构（地图与区域）】
城市沿一条纵贯线分布。

### 5.【时间历法（日序与周期）】
历法、日序与周期。

起点：大历三年三月初七，辰时`

const COMPLETE_EN = `### 1. Core rules and exploitable asymmetry
What the rules make possible, and where they leak.

### 2. Factions, hierarchy, and scarce resources
Who holds what.

### 3. Hidden history and deep crisis
What the city is trying not to remember.

### 4. Spatial structure (map and regions)
The city runs along one line.

### 5. Calendar (day order and cycles)
The calendar and its cycles.

Origin: Third year of the Great Calendar, third month, seventh day, morning`

const FIRST_THREE = `### 1.【核心规则与体系漏洞】
略

### 2.【阶层断层与资源战场】
略

### 3.【隐喻与深层危机】
略`

describe('inspectWorldBuildingCompleteness', () => {
  it('五维齐全且第 5 维带起点行时判定为齐备', () => {
    const result = inspectWorldBuildingCompleteness(COMPLETE_ZH)
    expect(result).toEqual({
      present: [1, 2, 3, 4, 5],
      missing: [],
      missingStoryStart: false,
      unreadable: false,
    })
  })

  it('只有前三维时列出缺失的第 4、5 维', () => {
    const result = inspectWorldBuildingCompleteness(FIRST_THREE)
    expect(result.present).toEqual([1, 2, 3])
    expect(result.missing).toEqual([4, 5])
    expect(result.missingStoryStart).toBe(false)
    expect(result.unreadable).toBe(false)
  })

  it('第 5 维命中但节内没有起点行时标记 missingStoryStart', () => {
    const withoutStart = COMPLETE_ZH.replace('起点：大历三年三月初七，辰时', '历法、日序与周期。')
    const result = inspectWorldBuildingCompleteness(withoutStart)
    expect(result.present).toEqual([1, 2, 3, 4, 5])
    expect(result.missing).toEqual([])
    expect(result.missingStoryStart).toBe(true)
  })

  it('第 5 维未命中时 missingStoryStart 保持 false', () => {
    const result = inspectWorldBuildingCompleteness(FIRST_THREE + '\n\n起点：大历三年三月初七，辰时')
    expect(result.missingStoryStart).toBe(false)
  })

  it('「## 空间结构」这类无编号简化标题也能识别', () => {
    const result = inspectWorldBuildingCompleteness('## 空间结构\n\n城市沿一条纵贯线分布。')
    expect(result.present).toEqual([4])
    expect(result.missing).toEqual([1, 2, 3, 5])
    expect(result.unreadable).toBe(false)
  })

  it('识别英文覆盖模板的五个标题与 Origin 起点行', () => {
    const result = inspectWorldBuildingCompleteness(COMPLETE_EN)
    expect(result).toEqual({
      present: [1, 2, 3, 4, 5],
      missing: [],
      missingStoryStart: false,
      unreadable: false,
    })
  })

  it('识别任务别名风格的英文标题与 Start point 变体', () => {
    const text = `### 1. Systemic holes
略
### 2. Class fault lines and resource battlegrounds
略
### 3. Metaphor and deep crisis
略
### 4. Map and regions
略
### 5. Day order and cycles
略
Start point: the first bell of the year`
    const result = inspectWorldBuildingCompleteness(text)
    expect(result.present).toEqual([1, 2, 3, 4, 5])
    expect(result.missing).toEqual([])
    expect(result.missingStoryStart).toBe(false)
  })

  it('起点行允许列表符号、故事前缀与全角/半角冒号', () => {
    const withBullet = COMPLETE_ZH.replace('起点：', '- 故事起点: ')
    expect(inspectWorldBuildingCompleteness(withBullet).missingStoryStart).toBe(false)
    const withStoryStart = COMPLETE_EN.replace('Origin:', 'Story start date:')
    expect(inspectWorldBuildingCompleteness(withStoryStart).missingStoryStart).toBe(false)
  })

  it('空文本视为 unreadable 且不列缺失', () => {
    for (const empty of ['', '   ', '\n\t\n']) {
      expect(inspectWorldBuildingCompleteness(empty)).toEqual({
        present: [],
        missing: [],
        missingStoryStart: false,
        unreadable: true,
      })
    }
  })

  it('纯自由文本视为 unreadable（五维全都无法确认，但不逐维列缺失理由）', () => {
    const result = inspectWorldBuildingCompleteness('一段没有结构的草稿。核心规则与体系漏洞还没想好。')
    expect(result.unreadable).toBe(true)
    expect(result.present).toEqual([])
    expect(result.missing).toEqual([1, 2, 3, 4, 5])
    expect(result.missingStoryStart).toBe(false)
  })

  it('正文提及维度名但不是标题行时不算命中', () => {
    const text = `世界观草稿

1. 【核心规则与体系漏洞】只是列表项
标题：空间结构（地图与区域）
时间历法（日序与周期）也不应被识别
> ### 引用里的标题也不算`
    const result = inspectWorldBuildingCompleteness(text)
    expect(result.present).toEqual([])
    expect(result.unreadable).toBe(true)
  })

  it('重复标题去重、乱序标题排序，且起点行只在第 5 维节内生效', () => {
    const text = `### 5.【时间历法（日序与周期）】
### 2.【阶层断层与资源战场】
略
### 4. 空间结构
### 4. 地图与区域
### 6. 其他
起点：大历三年三月初七，辰时`
    const result = inspectWorldBuildingCompleteness(text)
    expect(result.present).toEqual([2, 4, 5])
    expect(result.missing).toEqual([1, 3])
    expect(result.missingStoryStart).toBe(true)
  })

  it('兼容 CRLF 换行', () => {
    const result = inspectWorldBuildingCompleteness(COMPLETE_ZH.replace(/\n/gu, '\r\n'))
    expect(result.present).toEqual([1, 2, 3, 4, 5])
    expect(result.missingStoryStart).toBe(false)
  })
})

describe('describeWorldBuildingCompleteness', () => {
  it('五维齐全时返回 undefined', () => {
    expect(describeWorldBuildingCompleteness(inspectWorldBuildingCompleteness(COMPLETE_ZH), 'zh-CN')).toBeUndefined()
    expect(describeWorldBuildingCompleteness(inspectWorldBuildingCompleteness(COMPLETE_EN), 'en-US')).toBeUndefined()
  })

  it('缺维度时说明缺第几维并声明本次不影响使用', () => {
    const result = inspectWorldBuildingCompleteness(FIRST_THREE)
    expect(describeWorldBuildingCompleteness(result, 'zh-CN')).toBe(
      '世界观已写入，但五个维度不齐备：缺第 4 维【空间结构（地图与区域）】、第 5 维【时间历法（日序与周期）】。补写后再生成即可，本次不影响使用。',
    )
    const en = describeWorldBuildingCompleteness(result, 'en-US')
    expect(en).toContain('The world setting was written, but the five dimensions are incomplete')
    expect(en).toContain('dimension 4 [Spatial structure (map and regions)]')
    expect(en).toContain('dimension 5 [Calendar (day order and cycles)]')
    expect(en).toContain('this run is not affected')
  })

  it('第 5 维缺起点行时说明 t0 无法确定', () => {
    const withoutStart = COMPLETE_ZH.replace('起点：大历三年三月初七，辰时', '历法、日序与周期。')
    const result = inspectWorldBuildingCompleteness(withoutStart)
    expect(describeWorldBuildingCompleteness(result, 'zh-CN')).toBe(
      '第 5 维【时间历法（日序与周期）】里没找到「起点：<纪年与日期>，<时段名>」这一行，日序原点（t0）无法确定。',
    )
    expect(describeWorldBuildingCompleteness(result, 'en-US')).toContain('origin (t0) cannot be determined')
  })

  it('缺维度与缺起点同时出现时连接成一条', () => {
    const text = `### 1.【核心规则与体系漏洞】
略
### 2.【阶层断层与资源战场】
略
### 5.【时间历法（日序与周期）】
略`
    const description = describeWorldBuildingCompleteness(inspectWorldBuildingCompleteness(text), 'zh-CN')
    expect(description).toContain('缺第 3 维【隐喻与深层危机】、第 4 维【空间结构（地图与区域）】')
    expect(description).toContain('日序原点（t0）无法确定')
    expect(description?.startsWith('世界观已写入')).toBe(true)
  })

  it('空文本不产生提示', () => {
    const result = inspectWorldBuildingCompleteness('')
    expect(describeWorldBuildingCompleteness(result, 'zh-CN')).toBeUndefined()
    expect(describeWorldBuildingCompleteness(result, 'en-US')).toBeUndefined()
  })

  it('纯自由文本提示未能识别标题结构且不逐维列缺失', () => {
    const result = inspectWorldBuildingCompleteness('一段没有结构的草稿。')
    const zh = describeWorldBuildingCompleteness(result, 'zh-CN')
    expect(zh).toBe('未能识别五维标题结构，本次未做齐备性检查。')
    expect(zh).not.toContain('缺第')
    expect(describeWorldBuildingCompleteness(result, 'en-US')).toContain('Could not recognize the five-dimension heading structure')
  })
})
