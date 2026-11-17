// 生成记账件 v7（v6 字节不动）：行级重排 + 版本说明补登 + §12 口径实测定性
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const root = 'C:/develop/workspace/AI-writer/develop/.batch/night/org/'
const src = root + 'ledger-append-1117-hy4flash-auth.v6.md'
const dst = root + 'ledger-append-1117-hy4flash-auth.v7.md'

const raw = readFileSync(src, 'utf8')
const lines = raw.split('\n')

const idx = pred => {
  const i = lines.findIndex(pred)
  if (i < 0) throw new Error('anchor not found: ' + pred)
  return i
}

// ① 版本说明：在「本 v2 取代 v1…」之后补 v3–v6 各一行 + v7 一行
const iVer = idx(l => l.startsWith('本 v2 取代 v1'))
const addVer = [
  'v3：新增 §9 安全项升级 + 冻结期派活口径（01:50，实测复核后裁定）。',
  'v4：补 §10 数字自纠（02:02，重数为 8 棵＝1 新 + 1 严 + 6 旧）。',
  'v5：新增 §7 当日口径（11-17 10:10，派活脚本路径唯一化·口径 A）。',
  'v6：新增 §8 口径 A 的两处更正与补充（11-17 10:16，禁写「已堵住」、回执加 `chips.model`）。',
  'v7＝由 v6 改来：编号 `:62`→§11、`:70`→§12；`:70` 口径改为『夜间 23:00–08:00＋跑了旧树脚本』（实测定性），v6 字节不动。',
]

// ② 编号归位
const iSec7 = idx(l => l.startsWith('## 7. 当日口径'))
const iSec8 = idx(l => l.startsWith('## 8. 口径 A 的两处更正与补充'))
const iNext = idx((l, i) => i > iSec8 && l.startsWith('**更正 1'))

let out = []
for (let i = 0; i < lines.length; i++) {
  let line = lines[i]
  if (i === iVer) {
    out.push(line, ...addVer)
    continue
  }
  if (i === iSec7) { out.push('## 11. 当日口径（11-17 10:10 增补，即时生效，不动盘）'); continue }
  if (i === iSec8) { out.push('## 12. 口径 A 的两处更正与补充（11-17 10:20，按 developer 实测定性重写）'); continue }
  if (i > iSec8 && i <= iNext + 2) {
    // 从「更正 1」那行起，替换连续三行（原 71/72/73）为实测定性块，只在 i===iNext 处吐一次
    if (i === iNext) {
      out.push(
        '**更正 1·不得写成「已经堵住」，且不得再写「潜在风险」——暴露段已用 `pickModel(date)` 注入时间点实测穷尽**：旧树（`8e0167aa…`）行为逐点为——',
        '- `23:30`／`02:00` → `model="Hy4"`（`window=hy4-free-night`）',
        '- `12:30`／`20:00` → `DeepSeek-V4.1-Flash`（`window=deepseek-off-peak`）',
        '- `15:00` → `blocked:true`（高峰闸门先拦，不落任何型号）',
        '- 周六 `20:00` → `DeepSeek-V4.1-Flash`（周末无高峰段）',
        '定性定死为：**旧树只在 23:00–08:00 返回 `Hy4`**，成因是「夜间窗 + 跑了旧树脚本」；`HY4_PROMO_ALL_DAY_UNTIL=\'2026-11-15\'` 已过期，走不到「全天限免」分支。',
        '仍禁止写「已堵住」：7 份旧副本按复工首卡 §2④ **一律不动**，洞仍在树上，只是被口径 A（只跑 `develop` 树脚本）绕开；口径 A 的性质是「把跑哪棵树固定下来，不依赖各树策略版本」。',
      )
    }
    continue
  }
  out.push(line)
}

const text = out.join('\n')
writeFileSync(dst, text, 'utf8')
const buf = Buffer.from(text, 'utf8')
console.log('dst bytes=' + buf.length + ' lines=' + text.split('\n').length + ' md5=' + createHash('md5').update(buf).digest('hex') + ' crlf=' + (text.match(/\r\n/g) || []).length + ' bom=' + (text.charCodeAt(0) === 0xfeff))
const v6md5 = createHash('md5').update(readFileSync(src)).digest('hex')
console.log('v6 bytes=' + Buffer.byteLength(raw, 'utf8') + ' md5=' + v6md5)
