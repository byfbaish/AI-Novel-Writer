// no-at-count.mjs — 无@率唯一出处
//
// 三段历史版本（staging/no-at-count.mjs、.v2、.v3）合并为本文件：
//   分母口径取 **v3 的 B 口径**：ledger 中 event 缺省、text 去空白后非空即「发言」，
//   不按 kind 过滤（done/resumed/cut 等系统标记多为空正文，不构成发言）；
//   另收 v1 的 `who` 排除（DS Bot 自身记录不计入）。
//   不按注入副本去重；窗口按本地日期＋时分。
//
// 本文件不把「行数／字节／哈希」当 pass 判据，也不向 stdout 自报三元组。
//
// 用法：node scripts/ops/no-at-count.mjs [win e.g. 12:00-18:30] [YYYY-MM-DD]

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const DEFAULT_LEDGER =
  'C:/Users/<用户名>/.dsh/bot/ledger/group-session-4f78136d-2080-4806-ba83-0e5295209594.jsonl'

/** 这些发送者不是「群内发言」，按 v1 口径排除。 */
export const DEFAULT_EXCLUDE_WHO = ['DS Bot']

/** 本地日期（sv-SE = YYYY-MM-DD），与 `new Date().toLocaleDateString('sv-SE')` 同口径。 */
export function localDay(date = new Date()) {
  return date.toLocaleDateString('sv-SE')
}

/** JSONL → 记录数组；坏行跳过。 */
export function parseLedger(text) {
  const rows = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      // 半行/损坏行不参与统计
    }
  }
  return rows
}

/** B 口径：有正文的记录即发言，再按发送者排除。 */
export function selectSpeech(rows, { excludeWho = DEFAULT_EXCLUDE_WHO } = {}) {
  const excluded = new Set(excludeWho)
  return rows.filter(
    row => row.event === undefined && typeof row.text === 'string' && row.text.trim() && !excluded.has(row.who),
  )
}

/**
 * 窗口判定：先按本地日期，再按时分区间（含两端）；`win` 空表示全天。
 * @param {{time: number|string}} record
 * @param {{win?: string, day?: string}} options
 */
export function inWindow(record, { win = '', day = localDay() } = {}) {
  const at = new Date(record.time)
  if (at.toLocaleDateString('sv-SE') !== day) return false
  if (!win) return true
  const [from, to] = win.split('-')
  const seconds = clock => {
    const [h, m] = clock.split(':').map(Number)
    return h * 3600 + m * 60
  }
  const atSeconds = at.getHours() * 3600 + at.getMinutes() * 60 + at.getSeconds()
  return atSeconds >= seconds(from) && atSeconds <= seconds(to)
}

/** 无@率：n / noAt / pct。 */
export function countNoAt(list) {
  const n = list.length
  const noAt = list.filter(record => !record.text.includes('@')).length
  return { n, noAt, pct: +(n ? (noAt / n) * 100 : 0).toFixed(2) }
}

export function summarize(rows, { win = '', day = localDay(), excludeWho = DEFAULT_EXCLUDE_WHO } = {}) {
  const speech = selectSpeech(rows, { excludeWho })
  const inWin = speech.filter(record => inWindow(record, { win, day }))
  const perBot = new Map()
  for (const record of inWin) {
    const who = record.who || '?'
    if (!perBot.has(who)) perBot.set(who, [])
    perBot.get(who).push(record)
  }
  const byBot = {}
  for (const [who, list] of [...perBot.entries()].sort((a, b) => b[1].length - a[1].length)) {
    byBot[who] = countNoAt(list)
  }
  return { day, window: win || 'ALL', all: countNoAt(speech), inWindow: countNoAt(inWin), byBot }
}

function main(argv) {
  const win = argv[0] || ''
  const day = argv[1] || localDay()
  const rows = parseLedger(readFileSync(process.env.LEDGER || DEFAULT_LEDGER, 'utf8'))
  console.log(JSON.stringify(summarize(rows, { win, day }), null, 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
