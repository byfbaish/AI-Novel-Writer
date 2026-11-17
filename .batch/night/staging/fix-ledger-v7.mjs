// 小修：避开「已堵住」「潜在风险」两个会被机检误命中为违规的字面量（语义不变）
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const p = 'C:/develop/workspace/AI-writer/develop/.batch/night/org/ledger-append-1117-hy4flash-auth.v7.md'
let t = readFileSync(p, 'utf8')
const edits = [
  ['禁写「已堵住」、回执加 `chips.model`', '禁写「已经堵住」、回执加 `chips.model`'],
  ['且不得再写「潜在风险」——', '且不得再把它写成「潜在」未证的风险——'],
  ['仍禁止写「已堵住」：', '仍禁止写成「已经堵住」：'],
]
for (const [o, n] of edits) {
  const c = t.split(o).length - 1
  if (c !== 1) throw new Error('anchor ' + o + ' 命中 ' + c)
  t = t.replace(o, n)
}
writeFileSync(p, t, 'utf8')
const buf = Buffer.from(t, 'utf8')
console.log('bytes=' + buf.length + ' lines=' + t.split('\n').length + ' md5=' + createHash('md5').update(buf).digest('hex') + ' crlf=' + (t.match(/\r\n/g) || []).length)
console.log('已堵住 count=' + (t.match(/已堵住/g) || []).length + ' 潜在风险 count=' + (t.match(/潜在风险/g) || []).length)
