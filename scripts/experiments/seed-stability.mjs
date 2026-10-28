#!/usr/bin/env node
/** 同一条卡跑多个 seed —— 分清「响应」与「抖动」 */
import fs from 'node:fs'
import path from 'node:path'
const DIR = path.join(process.cwd(), 'scripts', 'experiments', 'out')
const load = f => fs.existsSync(path.join(DIR, f))
  ? fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []

const grams = s => { const t = s.replace(/[，。、：；！？""''「」（）\s]/g, ''); const o = new Set(); for (let i = 0; i + 2 <= t.length; i++) o.add(t.slice(i, i + 2)); return o }
const jac = (a, b) => { const A = grams(a), B = grams(b); let i = 0; for (const x of A) if (B.has(x)) i++; return A.size + B.size - i ? i / (A.size + B.size - i) : 0 }

// 方向词：同一章跨 seed 若方向词不同 ⇒ 抖动；相同 ⇒ 响应稳定
const DIRS = [['应', '应下|认下|担|答|给|交出|递'], ['拒', '不动|不接|不答|岔开|退|避开|沉默|摇']]
const dirOf = s => DIRS.filter(([, re]) => new RegExp(re).test(s)).map(([k]) => k).join('+') || '?'

for (const g of (process.argv.includes('--temp') ? ['D'] : ['C', 'D'])) {
  const T = process.argv.includes('--temp') ? `-t${process.argv[process.argv.indexOf('--temp') + 1]}` : ''
  const sets = [load(`golden-trait-loop-v2${T}.jsonl`), load(`golden-trait-loop-v2-s101${T}.jsonl`), load(`golden-trait-loop-v2-s202${T}.jsonl`)]
  const runs = sets.map(rows => rows.filter(r => r.group === g).sort((a, b) => a.chapter - b.chapter)).filter(r => r.length)
  if (runs.length < 2) { console.log(`${g}: 数据不足`); continue }
  console.log(`\n${'='.repeat(70)}\n【${g} 组】跨 seed 稳定性（${runs.length} 次）`)
  let simSum = 0, simN = 0, dirStable = 0
  const lines = []
  for (const ch of runs[0]) {
    const acts = runs.map(r => r.find(x => x.chapter === ch.chapter)?.action ?? '').filter(Boolean)
    if (acts.length < 2) continue
    let s = 0, n = 0
    for (let i = 0; i < acts.length; i++) for (let j = i + 1; j < acts.length; j++) { s += jac(acts[i], acts[j]); n++ }
    const avg = s / n; simSum += avg; simN++
    const dirs = acts.map(dirOf)
    const stable = new Set(dirs).size === 1
    if (stable) dirStable++
    lines.push(`  ${String(ch.chapter).padStart(2)} [${ch.tag}] 相似=${avg.toFixed(2)} 方向=${dirs.join('/')} ${stable ? '✓一致' : '✗摆动'}  ${acts[0].slice(0, 34)}`)
  }
  console.log(lines.join('\n'))
  console.log(`  ─ 跨 seed 平均相似度 ${(simSum / simN).toFixed(3)}`)
  console.log(`  ─ 方向稳定章数 ${dirStable}/${simN}`)
}
