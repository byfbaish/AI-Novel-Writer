// pointer-metrics.mjs — 指针化三项指标基线（developer，2026-11-16）
//
// 口径完全复用同目录 no-at-count.mjs（原 staging/no-at-count.v2 口径的合并版）：
// 同源 bot ledger、分母＝event 缺省且 text 非空的记录（真发言）、不剔纯 [PASS]、
// 不去重、窗口按记录 time；另按 v1 口径排除 DS Bot 自身记录。
//
// 指标：H＝含 32 位 hex 哈希；S＝含字节/行数量值；O＝含旧回合/过期/作废/撤回。
// 输出为 JSON 指标，不含「行数相等即通过」这类判据。
//
// 用法：node scripts/ops/pointer-metrics.mjs [win] [YYYY-MM-DD]

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { DEFAULT_EXCLUDE_WHO, DEFAULT_LEDGER, inWindow, localDay, parseLedger, selectSpeech } from './no-at-count.mjs'

const RE_HASH = /\b[0-9a-fA-F]{32}\b/
const RE_SIZE = /\d+\s*(?:B|字节|行)\b|\bbytes=|\blines=/
const RE_STALE = /旧回合|过期|作废|撤回|已失效/

export function computeMetrics(rows, { win = '', day = localDay(), excludeWho = DEFAULT_EXCLUDE_WHO } = {}) {
  const speech = selectSpeech(rows, { excludeWho })
  const inWin = speech.filter(record => inWindow(record, { win, day }))
  const share = re => {
    const n = inWin.filter(record => re.test(record.text)).length
    return { n, pct: +(inWin.length ? (n / inWin.length) * 100 : 0).toFixed(2) }
  }
  return {
    day,
    window: win || 'ALL',
    N: inWin.length,
    noAt: inWin.filter(record => !record.text.includes('@')).length,
    hash: share(RE_HASH),
    size: share(RE_SIZE),
    stale: share(RE_STALE),
  }
}

function main(argv) {
  const win = argv[0] || ''
  const day = argv[1] || localDay()
  const rows = parseLedger(readFileSync(process.env.LEDGER || DEFAULT_LEDGER, 'utf8'))
  console.log(JSON.stringify(computeMetrics(rows, { win, day }), null, 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
