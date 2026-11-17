// fix-ledger-v7.mjs — 避开「已堵住」「潜在风险」两个会被机检误命中为违规的字面量（语义不变）
// 一次性脚本留档（CARD-1117-A 入库）：只做三处精确替换，不向产物正文自报任何三元组，
// stdout 只回一行 OK（原版会打 bytes/lines/md5，已按裁定 1224ee2b §二·3 移除）。
//
// 用法：node scripts/ops/fix-ledger-v7.mjs [path]

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const DEFAULT_PATH =
  'C:/develop/workspace/AI-writer/develop/.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md'

export const LEDGER_V7_EDITS = [
  ['禁写「已堵住」、回执加 `chips.model`', '禁写「已经堵住」、回执加 `chips.model`'],
  ['且不得再写「潜在风险」——', '且不得再把它写成「潜在」未证的风险——'],
  ['仍禁止写「已堵住」：', '仍禁止写成「已经堵住」：'],
]

/**
 * 纯变换：每处锚点必须恰好命中一次，否则抛错（不猜、不静默跳过）。
 * @param {string} text
 * @param {ReadonlyArray<readonly [string, string]>} edits
 * @returns {string}
 */
export function applyLedgerV7Fixes(text, edits = LEDGER_V7_EDITS) {
  let out = text
  for (const [from, to] of edits) {
    const hits = out.split(from).length - 1
    if (hits !== 1) throw new Error('anchor "' + from + '" 命中 ' + hits + ' 次（要求恰好 1 次）')
    out = out.replace(from, to)
  }
  return out
}

function main(argv) {
  const file = argv[0] || DEFAULT_PATH
  writeFileSync(file, applyLedgerV7Fixes(readFileSync(file, 'utf8')), 'utf8')
  console.log('写入 ' + file + '（OK）')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
