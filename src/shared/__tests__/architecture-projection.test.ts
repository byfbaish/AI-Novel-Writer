import { describe, expect, it } from 'vitest'
import { withArchitectureDraftProjection } from '../architecture-projection'

/** 按形状取自 ch2 实机 trace 的架构变量值（`- 故事架构：` 与 `- 小说配置：` 之间）。 */
const REAL_ARCHITECTURE = `# 故事前提
## 一句话前提（Logline）
陈默拿到一支能把写下的谎话变成真的笔。

## 核心冲突链
调令失效 → 他想重回报社 → 每一步都在付出代价。

## 悬念骨架
- 显性冲突线（当前最大威胁）：调令被人撤销，他失去身份。
- 隐藏主线暗示（终极悬念/深层真相）：有些东西不太对劲。

# 世界观
### 1.【核心规则与体系漏洞】
本世界运转的核心规则：写在纸上的陈述会被现实采纳。
漏洞五：这条边界是本作后期最危险的实验区。

### 2.【阶层断层与资源战场】
最稀缺的核心资源：可被采信的真话。

### 3.【隐喻与深层危机】
终极谜团：能力不是天降的，是被「写」进来的。
埋在城市里的三条线索：零号档案、合照里少一个人。
主角的终极抉择：留住自己还是世界。

### 4.【空间结构（地图与区域）】
老陈记｜hours=07:00-09:00｜entry=直接进入`

const NOTICE_ZH = '（本节属于后文才展开的远期设定，正文只保留要点；本章不得提前写出其结论或明示，也不得写出相反内容）'
const NOTICE_EN = '(This section is a later-stage setting: keep only the gist; do not state or reveal its conclusions in this chapter, and do not contradict it.)'

/** 取 `from` 到 `to` 之间的片段；`to` 省略时取到结尾。 */
function sliceBetween(text: string, from: string, to?: string): string {
  const start = text.indexOf(from)
  const end = to === undefined ? text.length : text.indexOf(to)
  return text.slice(start, end)
}

describe('withArchitectureDraftProjection', () => {
  it('把 §3【隐喻与深层危机】整节压成标题 + 一行声明，其余部分逐字不变', () => {
    const projected = withArchitectureDraftProjection(REAL_ARCHITECTURE, 'zh-CN')

    // 标题保留（执行合同与下游按名引用它），正文换成声明。
    expect(projected).toContain('### 3.【隐喻与深层危机】')
    expect(projected).toContain(NOTICE_ZH)

    // 其余节逐字不变：§1/§2 区间、§4、悬念骨架。
    expect(sliceBetween(projected, '### 1.', '### 3.'))
      .toBe(sliceBetween(REAL_ARCHITECTURE, '### 1.', '### 3.'))
    expect(sliceBetween(projected, '### 4.')).toBe(sliceBetween(REAL_ARCHITECTURE, '### 4.'))
    expect(projected).toContain('## 悬念骨架')
    expect(projected).toContain('- 显性冲突线（当前最大威胁）：调令被人撤销，他失去身份。')
    expect(projected).toContain('漏洞五：这条边界是本作后期最危险的实验区。')

    // 声明紧跟标题。
    const titleIndex = projected.indexOf('### 3.【隐喻与深层危机】')
    const noticeIndex = projected.indexOf(NOTICE_ZH)
    expect(titleIndex).toBeGreaterThanOrEqual(0)
    expect(noticeIndex).toBeGreaterThan(titleIndex)
    expect(projected.slice(titleIndex, noticeIndex).trim()).toBe('### 3.【隐喻与深层危机】')
  })

  it('负向：压缩后严格短于原文，且终局词全部不再进请求', () => {
    const projected = withArchitectureDraftProjection(REAL_ARCHITECTURE, 'zh-CN')

    expect(projected.length).toBeLessThan(REAL_ARCHITECTURE.length)
    for (const endgameWord of ['终极谜团', '零号档案', '终极抉择', '埋在城市里']) {
      expect(REAL_ARCHITECTURE).toContain(endgameWord)
      expect(projected).not.toContain(endgameWord)
    }
  })

  it('fail-open：没有该节时逐字返回原文（按节点作者手工删掉 ⇒ 静默 no-op）', () => {
    const withoutSection = `# 世界观
### 1.【核心规则与体系漏洞】
规则一。
### 2.【阶层断层与资源战场】
资源一。
### 4.【空间结构（地图与区域）】
老陈记｜hours=07:00-09:00｜entry=直接进入`

    expect(withArchitectureDraftProjection(withoutSection, 'zh-CN')).toBe(withoutSection)
    expect(withArchitectureDraftProjection('', 'zh-CN')).toBe('')
    expect(withArchitectureDraftProjection(undefined, 'zh-CN')).toBe('')
    expect(withArchitectureDraftProjection('   \n  ', 'zh-CN')).toBe('   \n  ')
  })

  it('fail-open：标题在但该节没有正文时，不加声明（不制造空壳节）', () => {
    const emptySection = `### 3.【隐喻与深层危机】
### 4.【空间结构（地图与区域）】
老陈记｜hours=07:00-09:00｜entry=直接进入`
    expect(withArchitectureDraftProjection(emptySection, 'zh-CN')).toBe(emptySection)
  })

  it('标题形态：无编号（## 隐喻与深层危机）与带空格编号（### 3. 【…】）都识别', () => {
    for (const heading of ['## 隐喻与深层危机', '### 3. 【隐喻与深层危机】']) {
      const source = `${heading}\n终极谜团：答案在此。\n\n### 4.【空间结构（地图与区域）】\n老陈记`
      const projected = withArchitectureDraftProjection(source, 'zh-CN')
      expect(projected).toContain(heading)
      expect(projected).toContain(NOTICE_ZH)
      expect(projected).not.toContain('终极谜团')
    }
  })

  it('英文形态对称（Hidden history and deep crisis）', () => {
    const source = `# World building
### 1. Core rules and exploitable asymmetry
Rule one.
### 3. Hidden history and deep crisis
The central mystery: the ability was written into him.
### 4. Spatial structure (map and regions)
Chen's Corner｜hours=07:00-09:00｜entry=walk right in`

    const projected = withArchitectureDraftProjection(source, 'en-US')
    expect(projected).toContain('### 3. Hidden history and deep crisis')
    expect(projected).toContain(NOTICE_EN)
    expect(projected).not.toContain('the ability was written into him')
    expect(projected).toContain('### 1. Core rules and exploitable asymmetry')
    expect(projected).toContain("Chen's Corner｜hours=07:00-09:00｜entry=walk right in")
  })

  it('幂等：重复应用不叠加声明（链路上装配两次也安全）', () => {
    const once = withArchitectureDraftProjection(REAL_ARCHITECTURE, 'zh-CN')
    const twice = withArchitectureDraftProjection(once, 'zh-CN')
    expect(twice).toBe(once)
    expect(once.split(NOTICE_ZH)).toHaveLength(2)
  })

  it('远期节位于末节时，保留其后的分隔线与后续段落', () => {
    const source = `### 1.【核心规则与体系漏洞】
规则一。

### 3.【隐喻与深层危机】
终极谜团：答案在此。

---

# 情节大纲
## 全书禁则
不得写成已完成。`

    const projected = withArchitectureDraftProjection(source, 'zh-CN')
    expect(projected).toContain('### 3.【隐喻与深层危机】')
    expect(projected).toContain(NOTICE_ZH)
    expect(projected).not.toContain('终极谜团')
    expect(projected).toContain('---')
    expect(projected).toContain('# 情节大纲')
    expect(projected).toContain('不得写成已完成。')
  })
})
