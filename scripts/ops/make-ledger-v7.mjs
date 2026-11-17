// make-ledger-v7.mjs — v6 → v7 的确定性重排（一次性脚本留档，CARD-1117-A 入库）
//
// 原脚本住在 `.batch/night/staging/`（从未被 git 跟踪），跑完会把
// 字节／md5／行数 打到 stdout，群里再靠这三个数对账。裁定 1224ee2b §二·3
// 已废止该做法：版本由 git 承担，汇报只报提交 sha 前 8 位。
// 现版本：只写目标文件，不向产物正文、也不向 stdout 自报任何三元组。
//
// 用法：node scripts/ops/make-ledger-v7.mjs [src] [dst]
// 默认 src/dst 仍是 11-17 那次运行的两个路径（留档口径，可改）。

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const DEFAULT_ROOT = 'C:/develop/workspace/AI-writer/develop/.batch/night/org/'
const DEFAULT_SRC = DEFAULT_ROOT + 'ledger-append-1117-hy4flash-auth.v6.md'
const DEFAULT_DST = DEFAULT_ROOT + 'ledger-append-1117-hy4flash-auth.v7.md'

const VERSION_NOTES = [
  'v3：新增 §9 安全项升级 + 冻结期派活口径（01:50，实测复核后裁定）。',
  'v4：补 §10 数字自纠（02:02，重数为 8 棵＝1 新 + 1 严 + 6 旧）。',
  'v5：新增 §7 当日口径（11-17 10:10，派活脚本路径唯一化·口径 A）。',
  'v6：新增 §8 口径 A 的两处更正与补充（11-17 10:16，禁写「已堵住」、回执加 `chips.model`）。',
  'v7＝由 v6 改来：编号 `:62`→§11、`:70`→§12；`:70` 口径改为『夜间 23:00–08:00＋跑了旧树脚本』（实测定性），v6 原件不动。',
]

const SECTION_11 = '## 11. 当日口径（11-17 10:10 增补，即时生效，不动盘）'
const SECTION_12 = '## 12. 口径 A 的两处更正与补充（11-17 10:20，按 developer 实测定性重写）'

const CORRECTION_BLOCK = [
  '**更正 1·不得写成「已经堵住」，且不得再写「潜在风险」——暴露段已用 `pickModel(date)` 注入时间点实测穷尽**：旧树（`8e0167aa…`）行为逐点为——',
  '- `23:30`／`02:00` → `model="Hy4"`（`window=hy4-free-night`）',
  '- `12:30`／`20:00` → `DeepSeek-V4.1-Flash`（`window=deepseek-off-peak`）',
  '- `15:00` → `blocked:true`（高峰闸门先拦，不落任何型号）',
  '- 周六 `20:00` → `DeepSeek-V4.1-Flash`（周末无高峰段）',
  '定性定死为：**旧树只在 23:00–08:00 返回 `Hy4`**，成因是「夜间窗 + 跑了旧树脚本」；`HY4_PROMO_ALL_DAY_UNTIL=\'2026-11-15\'` 已过期，走不到「全天限免」分支。',
  '仍禁止写「已经堵住」：7 份旧副本按复工首卡 §2④ **一律不动**，洞仍在树上，只是被口径 A（只跑 `develop` 树脚本）绕开；口径 A 的性质是「把跑哪棵树固定下来，不依赖各树策略版本」。',
]

function findAnchor(lines, predicate, label) {
  const index = lines.findIndex(predicate)
  if (index < 0) throw new Error('anchor not found: ' + label)
  return index
}

/**
 * 纯变换：输入 v6 全文，输出 v7 全文。不做任何行数/字节/哈希计算。
 * @param {string} raw
 * @returns {string}
 */
export function buildLedgerV7(raw) {
  const lines = raw.split('\n')
  const iVer = findAnchor(lines, line => line.startsWith('本 v2 取代 v1'), '版本说明')
  const iSec7 = findAnchor(lines, line => line.startsWith('## 7. 当日口径'), '§7')
  const iSec8 = findAnchor(lines, line => line.startsWith('## 8. 口径 A 的两处更正与补充'), '§8')
  const iNext = findAnchor(
    lines,
    (line, index) => index > iSec8 && line.startsWith('**更正 1'),
    '§8 更正 1',
  )

  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === iVer) {
      out.push(line, ...VERSION_NOTES)
      continue
    }
    if (i === iSec7) {
      out.push(SECTION_11)
      continue
    }
    if (i === iSec8) {
      out.push(SECTION_12)
      continue
    }
    // 原 71/72/73 三行（「更正 1」起）整体替换为实测定性块，只在首行处吐一次
    if (i > iSec8 && i <= iNext + 2) {
      if (i === iNext) out.push(...CORRECTION_BLOCK)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

function main(argv) {
  const src = argv[0] || DEFAULT_SRC
  const dst = argv[1] || DEFAULT_DST
  const text = buildLedgerV7(readFileSync(src, 'utf8'))
  writeFileSync(dst, text, 'utf8')
  console.log('写入 ' + dst + '（OK）')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2))
