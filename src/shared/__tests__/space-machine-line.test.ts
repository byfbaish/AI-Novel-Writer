import { describe, expect, it } from 'vitest'
import {
  auditSpaceLocations,
  describeSpaceReviewChecklist,
  extractSpaceMachineLines,
  parseSpaceHours,
  spaceAuditCounts,
} from '../space-machine-line'

/** 作者真实第 4 维（2026-10-22）：三列表格 + 末尾机读行。 */
const AUTHORED = `### 4.【空间结构（地图与区域）】

| 空间定位 | 一句话描述 | 关键规则 |
|---------|-----------|---------|
| **青阳山·杂役处** | 底层修士居住区，无围墙的临时落脚点 | 每日06:00-06:30 需签到否则扣除灵石额度；未经许可不得擅自离开山体范围 |
| **外门广场** | 内门巡视检查区，杂役必经之地 | 工作时间08:00-17:00 开放；其余时间禁入；巡查队出现时必须低头回避 |
| **试炼峰·聚气台** | 每月开放一次的晋升考核点 | 需在当月25日前登记报名；通过凝元境测试者获得转正资格；未通过者扣除三月贡献点 |
| **百草园·禁地方块** | 九转回魂草所在地，九重阵法环绕 | 每月1日起三天有效窗口期；需持有内门令牌且通过三重符阵验证；无权限者靠近即触发警报 |
| **执法殿·审讯室** | 宗门裁决争议的场所，阴森压抑 | 申请时间为每日14:00-16:00；提交材料需包含两名见证人签名；证据不足者当场定罪 |
| **藏书阁·外楼** | 普通功法存放地，残缺不全 | 阅览时间09:00-12:00；取阅时需归还等额价值物品作为押金；涉及禁忌内容者直接上报高层 |
| **废弃矿洞·地下三层** | 古战场遗迹，充满危险气息 | 无任何准入限制；夜间温度骤降至零下二十度；存在未知生物活动迹象 |
| **青冥海·边缘岛屿** | 神魔封印残余能量聚集地，后期重要场景 | 需金丹期修为方可抵御海水侵蚀；每月十五月圆之夜开启传送通道 |

**机读约束行：**

\`\`\`
青阳山·杂役处｜hours=06:00-06:30｜entry=需签到打卡
外门广场｜hours=08:00-17:00｜entry=禁止擅入
试炼峰·聚气台｜hours=当日00:00-24:00｜entry=需登记并通过考核
百草园·禁地方块｜hours=每月01日08:00-03日18:00｜entry=需内门令牌+三道符阵
执法殿·审讯室｜hours=14:00-16:00｜entry=需两名见证人签字
藏书阁·外楼｜hours=09:00-12:00｜entry=需支付押金
废弃矿洞·地下三层｜entry=自由进出（危险警告）
青冥海·边缘岛屿｜hours=每月15日00:00-00:10｜entry=需金丹期修为
\`\`\`
`

function kinds(space?: string) {
  return auditSpaceLocations(AUTHORED).issues
    .filter(issue => (space ? issue.space === space : true))
    .map(issue => issue.kind)
}

describe('parseSpaceHours', () => {
  it('parses a plain daily window', () => {
    expect(parseSpaceHours('06:00-06:30')).toEqual({ kind: 'daily', start: 360, end: 390 })
    expect(parseSpaceHours('当日00:00-24:00')).toEqual({
      kind: 'daily', start: 0, end: 1440, note: '24:00 已按当日结束处理',
    })
  })

  it('parses monthly and day-range windows', () => {
    expect(parseSpaceHours('每月15日00:00-00:10')).toMatchObject({ kind: 'monthly', day: 15, start: 0, end: 10 })
    expect(parseSpaceHours('每月01日08:00-03日18:00')).toMatchObject({
      kind: 'day-range', startDay: 1, start: 480, endDay: 3, end: 1080,
    })
  })

  it('rejects out-of-range clock values instead of guessing', () => {
    expect(parseSpaceHours('25:00-26:00')).toMatchObject({ kind: 'unreadable' })
    expect(parseSpaceHours('12:70-13:00')).toMatchObject({ kind: 'unreadable' })
    expect(parseSpaceHours('白天')).toMatchObject({ kind: 'unreadable' })
  })
})

describe('extractSpaceMachineLines', () => {
  it('reads every authored machine line and its fields', () => {
    const lines = extractSpaceMachineLines(AUTHORED)

    expect(lines).toHaveLength(8)
    expect(lines[0]).toMatchObject({ name: '青阳山·杂役处', hours: '06:00-06:30', entry: '需签到打卡' })
    // 没有 hours 的那条要保留 entry
    const mine = lines.find(line => line.name.includes('废弃矿洞'))
    expect(mine?.hours).toBeNull()
    expect(mine?.entry).toContain('自由进出')
  })

  it('never treats a markdown table row as a machine line', () => {
    const lines = extractSpaceMachineLines(AUTHORED)

    expect(lines.every(line => !line.name.includes('空间定位'))).toBe(true)
    // 表格里 8 行、机读行 8 条 —— 若表格被误吃会翻倍
    expect(lines).toHaveLength(8)
  })
})

describe('auditSpaceLocations · 作者真实数据', () => {
  it('counts both carriers', () => {
    const audit = auditSpaceLocations(AUTHORED)

    expect(audit.tableSpaces).toBe(8)
    expect(audit.machineLines).toBe(8)
    expect(audit.unreadable).toBe(false)
  })

  it('flags the 24:00 normalization and the ten-minute window', () => {
    expect(kinds('试炼峰·聚气台')).toContain('end-of-day-2400')
    expect(kinds('青冥海·边缘岛屿')).toContain('short-window')
  })

  it('flags the application-window compression on 执法殿', () => {
    expect(kinds('执法殿·审讯室')).toContain('window-semantics-ambiguous')
  })

  it('flags rules that the machine line cannot carry', () => {
    // 不得擅自离开 / 必须低头回避 / 25 日前登记
    expect(kinds('青阳山·杂役处')).toContain('rule-not-encoded')
    expect(kinds('外门广场')).toContain('rule-not-encoded')
    expect(kinds('试炼峰·聚气台')).toContain('rule-not-encoded')
  })

  it('accepts a missing window when entry says free access', () => {
    expect(kinds('废弃矿洞·地下三层')).not.toContain('no-hours')
  })

  it('reports nothing missing when table and machine lines cover the same spaces', () => {
    const audit = auditSpaceLocations(AUTHORED)

    expect(audit.issues.filter(issue => issue.kind === 'missing-machine-line')).toEqual([])
    expect(audit.issues.filter(issue => issue.kind === 'missing-table-entry')).toEqual([])
  })
})

describe('describeSpaceReviewChecklist', () => {
  it('names the concrete spaces the author must review', () => {
    const text = describeSpaceReviewChecklist(auditSpaceLocations(AUTHORED), 'zh-CN')

    expect(text).toContain('表格 8 个空间')
    expect(text).toContain('机读行 8 条')
    expect(text).toContain('执法殿·审讯室')
    expect(text).toContain('申请')
    expect(text).toContain('人工复核固定项')
  })

  it('stays quiet about structure but keeps the one manual check when nothing is wrong', () => {
    const clean = [
      '### 4.【空间结构】',
      '',
      '| 空间定位 | 关键规则 |',
      '|---|---|',
      '| **某空间** | 每日08:00-18:00 开放。 |',
      '',
      '某空间｜hours=08:00-18:00｜entry=需登记',
    ].join('\n')

    const text = describeSpaceReviewChecklist(auditSpaceLocations(clean), 'zh-CN')

    expect(text).toContain('未发现需确认的结构问题')
    expect(text).toContain('申请')
  })
})

/**
 * 舞台分级与「无时段」声明（2026-10-26，作者两轮实测后定）。
 *
 * 契约四条：
 * ① 缺 `hours` 一律报（不论长期舞台还是一次性）—— 机器分不清「漏写」与「不适用」，必须问；
 * ② 分级只影响**措辞**（一次性场景多给一句「若确实没有时段概念就写 hours=none」），不是免检；
 * ③ 显式 `hours=none` = 作者做过决定 ⇒ 不报、不参与窗口判定；
 * ④ 抽不到分级声明 ⇒ 措辞退回通用版，判定不变（fail-open）。
 */
const STAGED = `### 4.【空间结构（地图与区域）】

**碑坪**：外门弟子居所。关键规则：凭外门腰牌进入；每月初一小考（05:00–07:00）。长期舞台。

碑坪｜hours=05:00-21:00｜entry=需外门腰牌

**试药房**：试药灌残篇的地方。关键规则：凭试药名额进入；试药期间不得外出。一次性/低频场景。

试药房｜entry=需试药名额

**山门**：玄阙宗对外出入口。关键规则：凭宗门令牌进出。一次性场景。

山门｜hours=none｜entry=需宗门令牌或执事以上引荐`

describe('parseSpaceHours · 显式无时段', () => {
  it('reads `none` as an explicit "no window concept", not as unreadable', () => {
    expect(parseSpaceHours('none')).toEqual({ kind: 'none' })
    expect(parseSpaceHours(' NONE ')).toEqual({ kind: 'none' })
  })
})

describe('auditSpaceLocations · 缺窗口与分级', () => {
  it('still reports a missing window on a one-off scene, with a shorter path to clear it', () => {
    const noHours = auditSpaceLocations(STAGED).issues.filter(issue => issue.kind === 'no-hours')

    // 只有「试药房」缺字段；「山门」写了 hours=none ⇒ 不报。
    expect(noHours.map(issue => issue.space)).toEqual(['试药房'])
    expect(noHours[0].severity).toBe('attention')
    // 分级只改措辞：多给「若确实没有时段概念就写 none」这条路。
    expect(noHours[0].detail).toContain('一次性/低频')
    expect(noHours[0].detail).toContain('hours=none')
  })

  it('never lets the model-authored staging label waive the check', () => {
    // 作者当面指出：只要「低频」就能免检，这期功能就名存实亡。
    const allOneOff = STAGED.replace('。长期舞台。', '。一次性场景。')
    const noHours = auditSpaceLocations(allOneOff).issues.filter(issue => issue.kind === 'no-hours')

    expect(noHours.map(issue => issue.space)).toEqual(['试药房'])
    expect(auditSpaceCounts(allOneOff).attention).toBeGreaterThan(0)
  })

  it('counts the explicit `none` line as neither missing nor unreadable', () => {
    const audit = auditSpaceLocations(STAGED)

    expect(audit.issues.some(issue => issue.space === '山门')).toBe(false)
    expect(audit.issues.some(issue => issue.kind === 'hours-unreadable')).toBe(false)
  })

  it('keeps the window-semantics check off `none` lines', () => {
    const text = STAGED.replace('凭试药名额进入；试药期间不得外出。',
      '申请时间 14:00-16:00；试药期间不得外出。')
    const audit = auditSpaceLocations(text)

    // 试药房仍是缺字段（没写 hours），不能因为规则里有「申请」二字就报语义压缩。
    expect(audit.issues.filter(issue => issue.kind === 'window-semantics-ambiguous')).toHaveLength(0)
  })

  it('falls back to the generic wording when no staging is declared (fail-open)', () => {
    const unstaged = STAGED.replace('。一次性/低频场景。', '。')
    const noHours = auditSpaceLocations(unstaged).issues.filter(issue => issue.kind === 'no-hours')

    expect(noHours).toHaveLength(1)
    expect(noHours[0].detail).not.toContain('自评')
    expect(noHours[0].detail).toContain('hours=none')
  })

  it('keeps rule-not-encoded informational and counts one item', () => {
    const audit = auditSpaceLocations(STAGED)

    expect(spaceAuditCounts(audit)).toEqual({ attention: 1, info: 1 })
    expect(audit.issues.find(issue => issue.kind === 'rule-not-encoded')?.severity).toBe('info')
  })
})

function auditSpaceCounts(text: string) {
  return spaceAuditCounts(auditSpaceLocations(text))
}
