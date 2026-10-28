#!/usr/bin/env node
/**
 * 分析 golden-trait-loop.jsonl —— 复读率 / 一致性 / 申报合规 / 自创道具
 */
import fs from 'node:fs'
import path from 'node:path'

const FILE = path.join(process.cwd(), 'scripts', 'experiments', 'out', process.argv.includes('--round2') ? 'golden-trait-loop-v2.jsonl' : 'golden-trait-loop.jsonl')
const rows = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const groups = ['A', 'B', 'C', 'D']

const grams = s => {
  const t = s.replace(/[，。、：；！？""''「」（）\s]/g, '')
  const out = new Set()
  for (let i = 0; i + 2 <= t.length; i++) out.add(t.slice(i, i + 2))
  return out
}
const jac = (a, b) => {
  const A = grams(a), B = grams(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

// 自创道具/专名候选（这些词我们一个字都没给）
const INVENTED = ['护身符','袖口','旧痕','灵石','宗门','丹田','灵气','符','丹','诀','阵','剑','刀','令牌','玉简','丹药','法诀','阵盘']

for (const g of groups) {
  const rs = rows.filter(r => r.group === g).sort((a, b) => a.chapter - b.chapter)
  if (!rs.length) continue
  console.log(`\n${'='.repeat(72)}\n【${g} 组】 ${rs.length} 章`)
  console.log('─ 应对全文 ─')
  for (const r of rs) console.log(`  ${String(r.chapter).padStart(2)} [${r.tag}] ${r.action}`)

  // 申报
  if (g === 'C' || g === 'D') {
    const dist = {}
    for (const r of rs) {
      const m = /D\d/.exec(r.declaration || '')
      const k = m ? m[0] : (r.declaration || '空/无法解析')
      dist[k] = (dist[k] || 0) + 1
    }
    console.log('─ 申报分布 ─', JSON.stringify(dist))
  }

  // 复读：高频 3-gram
  const cnt = new Map()
  for (const r of rs) {
    const t = r.action.replace(/[，。、：；！？\s]/g, '')
    for (let i = 0; i + 3 <= t.length; i++) {
      const k = t.slice(i, i + 3)
      cnt.set(k, (cnt.get(k) || 0) + 1)
    }
  }
  const top = [...cnt.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log('─ 高频三字串（≥3 次） ─', top.length ? top.map(([k, c]) => `${k}×${c}`).join('  ') : '无')

  // 自创道具
  const inv = INVENTED.map(w => [w, rs.filter(r => r.action.includes(w)).length]).filter(([, c]) => c > 0)
  console.log('─ 自创道具/专名 ─', inv.length ? inv.map(([w, c]) => `${w}×${c}`).join('  ') : '无')

  // 平均两两相似度（扁平度）
  let sum = 0, n = 0
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { sum += jac(rs[i].action, rs[j].action); n++ }
  console.log(`─ 平均两两相似度 ─ ${(sum / n).toFixed(3)}（越高越扁平）`)

  // 同类型对（反身性 / 复读）
  const pair = (x, y) => {
    const a = rs.find(r => r.chapter === x), b = rs.find(r => r.chapter === y)
    return a && b ? jac(a.action, b.action).toFixed(3) : '-'
  }
  console.log(`─ 同类处境相似度 ─ 8vs11(反身性)=${pair(8, 11)}  6vs12(反身性)=${pair(6, 12)}  17vs18(复读)=${pair(17, 18)}`)
  console.log(`─ 平均长度 ─ ${(rs.reduce((s, r) => s + r.action.length, 0) / rs.length).toFixed(1)} 字`)
}
