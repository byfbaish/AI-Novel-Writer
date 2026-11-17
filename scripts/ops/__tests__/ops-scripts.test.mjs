// CARD-1117-A 机检：两条硬要求各有用例
//   ① 生成件正文不得出现三元组自报字段（字节／md5／sha256／行数＝数值）
//   ② 脚本不得把「行数相等」当 pass 判据（源码级守卫）
// 另覆盖合并后的 no-at-count 口径与 pointer-metrics 指标。

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildLedgerV7 } from '../make-ledger-v7.mjs'
import { applyLedgerV7Fixes, LEDGER_V7_EDITS } from '../fix-ledger-v7.mjs'
import { applyEdits, PATCHES } from '../patch-reboot.mjs'
import { countNoAt, inWindow, selectSpeech, summarize } from '../no-at-count.mjs'
import { computeMetrics } from '../pointer-metrics.mjs'

const OPS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const V6_FIXTURE = [
  'ledger v6',
  '本 v2 取代 v1：口径 A。',
  '## 7. 当日口径',
  '旧 §7 正文',
  '## 8. 口径 A 的两处更正与补充',
  '旧 §8 正文',
  '**更正 1·旧写法**：旧块第一行',
  '旧块第二行',
  '旧块第三行',
  '尾部不变的行',
].join('\n')

/** 三元组自报字段：`bytes=` / `md5=` / `sha256=` / `行数=数字` 这类「字段＝值」 */
const SELF_REPORT_RE = /\b(?:bytes|md5|sha256|lines)\s*=|[（(]?\s*(?:字节|行数)\s*[=:：]\s*\d|md5[=:：]\s*[0-9a-f]{8}/i

describe('① 生成件正文无三元组自报字段', () => {
  it('make-ledger-v7 输出不含三元组字段', () => {
    const out = buildLedgerV7(V6_FIXTURE)
    expect(out).not.toMatch(SELF_REPORT_RE)
    // 变换本身仍然生效：编号归位 + 更正块替换
    expect(out).toContain('## 11. 当日口径')
    expect(out).toContain('## 12. 口径 A 的两处更正与补充')
    expect(out).toContain('**更正 1·不得写成「已经堵住」')
    expect(out).toContain('尾部不变的行')
    expect(out).not.toContain('旧块第二行')
  })

  it('fix-ledger-v7 输出不含三元组字段，且三处替换各命中一次', () => {
    const input = LEDGER_V7_EDITS.map(([from]) => '前缀 ' + from + ' 后缀').join('\n')
    const out = applyLedgerV7Fixes(input)
    expect(out).not.toMatch(SELF_REPORT_RE)
    expect(out).not.toContain('已堵住')
    expect(out).not.toContain('潜在风险')
    for (const [, to] of LEDGER_V7_EDITS) expect(out).toContain(to)
  })
})

describe('② 机检不再比对行数', () => {
  // 范围＝A 卡自己的五件产出脚本（CARD-1117-E 判据 5；项目总负责人 16:14 裁定）：
  // 判据约束的是这五件产出物，不是整个 scripts/ops/ 目录——检查器自身会在注释里引述这些字眼。
  const OWN_FILES = [
    'make-ledger-v7.mjs',
    'fix-ledger-v7.mjs',
    'patch-reboot.mjs',
    'no-at-count.mjs',
    'pointer-metrics.mjs',
  ]

  it('A 卡五件产出脚本都在 scripts/ops/ 下（防文件名写错后空转）', () => {
    for (const name of OWN_FILES) {
      expect(readdirSync(OPS_DIR)).toContain(name)
    }
  })

  it('A 卡五件产出脚本里没有行数比对惯用法', () => {
    const idioms = ["split('\\n').length", 'wc -l', 'awk NR']
    for (const name of OWN_FILES) {
      const source = readFileSync(path.join(OPS_DIR, name), 'utf8')
      for (const idiom of idioms) {
        expect(source.includes(idiom), name + ' 含「' + idiom + '」').toBe(false)
      }
    }
  })
})

describe('applyEdits 锚点纪律', () => {
  it('命中 0 次抛错', () => {
    expect(() => applyEdits('abc', [['zzz', 'yyy', 'x']])).toThrow('命中 0 次')
  })

  it('命中 2 次抛错（不猜改哪一处）', () => {
    expect(() => applyEdits('a a', [['a', 'b', 'x']])).toThrow('命中 2 次')
  })

  it('patch-reboot 的补丁集仍是两份文件、逐条带标签', () => {
    expect(PATCHES.map(patch => patch.rel)).toEqual([
      'scripts/workbuddy/model-policy.mjs',
      'scripts/workbuddy/__tests__/model-policy.test.mjs',
    ])
    for (const patch of PATCHES) {
      expect(patch.edits.length).toBeGreaterThan(0)
      for (const edit of patch.edits) expect(edit[2]).toBeTruthy()
    }
  })
})

describe('no-at-count 合并口径（B 分母 + who 排除）', () => {
  const at = (h, m, who = 'QA', text = '有@') => ({
    time: new Date(2026, 10, 17, h, m, 0).getTime(),
    who,
    text,
  })
  const rows = [
    at(12, 10, 'QA', '@developer 看这里'),
    at(12, 20, 'QA', '没有 at 的一句'),
    at(13, 0, 'DS Bot', '系统自身记录'),
    at(13, 10, 'QA', '   '),
    { time: new Date(2026, 10, 17, 12, 30, 0).getTime(), who: 'QA', text: '', event: 'done' },
    at(19, 0, 'QA', '@x 窗口外'),
    at(12, 40, 'QA', '[PASS]'),
  ]

  it('只把有正文、非系统发送者计入分母', () => {
    const speech = selectSpeech(rows)
    expect(speech.length).toBe(4)
    expect(speech.some(record => record.who === 'DS Bot')).toBe(false)
  })

  it('窗口两端包含、跨日排除', () => {
    expect(inWindow(rows[0], { win: '12:00-13:00', day: '2026-11-17' })).toBe(true)
    expect(inWindow(rows[5], { win: '12:00-13:00', day: '2026-11-17' })).toBe(false)
    expect(inWindow(rows[0], { day: '2026-11-16' })).toBe(false)
  })

  it('无@率与 byBot 汇总', () => {
    expect(countNoAt(selectSpeech(rows))).toEqual({ n: 4, noAt: 2, pct: 50 })
    const summary = summarize(rows, { win: '12:00-13:00', day: '2026-11-17' })
    expect(summary.inWindow.n).toBe(3)
    expect(summary.byBot.QA.n).toBe(3)
  })
})

describe('pointer-metrics 指标', () => {
  const rows = [
    { time: new Date(2026, 10, 17, 12, 0, 0).getTime(), who: 'QA', text: 'hash 0123456789abcdef0123456789abcdef' },
    { time: new Date(2026, 10, 17, 12, 5, 0).getTime(), who: 'QA', text: '普通发言' },
    { time: new Date(2026, 10, 17, 12, 10, 0).getTime(), who: 'QA', text: '这条作废' },
  ]

  it('三项占比按窗口内发言计', () => {
    const metrics = computeMetrics(rows, { win: '12:00-13:00', day: '2026-11-17' })
    expect(metrics.N).toBe(3)
    expect(metrics.hash).toEqual({ n: 1, pct: 33.33 })
    expect(metrics.stale).toEqual({ n: 1, pct: 33.33 })
  })
})
