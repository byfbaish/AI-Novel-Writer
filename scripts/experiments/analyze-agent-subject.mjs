#!/usr/bin/env node
/**
 * 子 Agent 被试结果判分 —— 手册四层（L0 可复现 / L1 区分度 / L2 反身性 / L3 一致性）
 *
 * 输入：jsonl，每行 {group, run, chapter, tag, declaration, action}
 *   group: A(无模板) / B(范例无编号) / C(规则式) / D(范例+编号)
 *   run  : 第几遍（同一 group 跑多遍 ⇒ 可算 L0）
 *
 * 用法：node scripts/experiments/analyze-agent-subject.mjs [文件名]
 *       默认 scripts/experiments/out/agent-subject.jsonl
 *
 * 与 analyze-golden-trait-loop.mjs 同口径（二字 gram Jaccard），便于跟本地 9B 数据直接比。
 */

import fs from 'node:fs'
import path from 'node:path'

const FILE = path.join(process.cwd(), 'scripts', 'experiments', 'out', process.argv[2] ?? 'agent-subject.jsonl')
const rows = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
const GROUPS = ['A', 'B', 'C', 'D']

// ── 相似度（与既有脚本同口径）─────────────────────────────
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

// ── 方向判定（手册 §4 方向词表；否定式优先）───────────────────
const REJECT = ['不动', '不接', '不答', '不认', '不担', '不垫', '不帮', '不站', '不交', '不出', '不给', '不去', '不跟', '不救', '不开口', '不应', '不算', '岔开', '避开', '退开', '后退', '沉默', '摇头', '摆手', '躲', '闭嘴', '咽', '僵住', '顿住', '缩', '按住不动', '没动', '不松', '不挪']
const ACCEPT = ['应下', '答应', '应了', '认下', '担下', '接下', '交出', '递出', '给出', '垫出', '点头', '伸手', '接过来', '压住', '抬眼', '走去', '跟上去', '救', '帮', '站到', '开口说', '迈步', '上前', '握住', '松口', '让步']

function dir(text) {
  for (const w of REJECT) if (text.includes(w)) return '拒'
  for (const w of ACCEPT) if (text.includes(w)) return '应'
  return '?'
}

// ── 自创设定名词（材料里一个字都没给）────────────────────────
const INVENTED = ['护身符', '袖口', '旧痕', '灵石', '宗门', '丹田', '灵气', '玉简', '令牌', '丹药', '法诀', '阵盘', '银两', '银子', '铜钱', '掌门', '长老', '师兄', '师姐', '师门', '内门', '外门', '修为', '境界', '功法', '符箓']

// 章号 → tag（与 golden-trait-minimal-loop.mjs 的 CHAPTERS 一致；被试只需写章号）
const TAGS = { 1: 'baseline-daily', 2: 'daily', 3: 'daily', 4: 'costed', 5: 'costed', 6: 'costed-guarantee', 7: 'pressure', 8: 'costed-trade', 9: 'costed-rescue', 10: 'daily', 11: 'R-costed-trade', 12: 'R-costed-guarantee', 13: 'anchor-object', 14: 'GENERALIZE', 15: 'costed', 16: 'anchor-object', 17: 'exception', 18: 'exception-repeat', 19: 'final', 20: 'final' }

const byGroup = g => rows.filter(r => r.group === g)
const runsOf = g => [...new Set(byGroup(g).map(r => r.run))].sort()

// ───────────────── 逐组输出 ─────────────────
for (const g of GROUPS) {
  const rs = byGroup(g)
  if (!rs.length) continue
  console.log(`\n${'═'.repeat(70)}\n【${g} 组】${rs.length} 条 · run=${runsOf(g).join(',')}`)

  for (const run of runsOf(g)) {
    const seq = rs.filter(r => r.run === run).sort((a, b) => a.chapter - b.chapter)
    console.log(`\n  ── run ${run} 逐章 ──`)
    for (const r of seq) {
      const d = dir(r.action)
      console.log(`   ${String(r.chapter).padStart(2)} [${TAGS[r.chapter] ?? '-'}] ${d} ${r.declaration ? `申报=${r.declaration}` : ''} | ${r.action}`)
    }

    // L3 塌缩：归一化后完全相同的最大簇
    const norm = s => s.replace(/[，。、：；！？\s]/g, '')
    const cnt = new Map()
    for (const r of seq) { const k = norm(r.action); cnt.set(k, (cnt.get(k) ?? 0) + 1) }
    const top = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]
    const exactSame = top[1] - 1 // 与最多的那一句重复的章数（不含自身）
    let sum = 0, n = 0
    for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) { sum += jac(seq[i].action, seq[j].action); n++ }
    const flat = sum / n

    console.log(`  ─ 塌缩 ─ 同一句最多 ${top[1]} 章（重复 ${exactSame} 章）: 「${top[0].slice(0, 30)}」`)
    console.log(`  ─ 扁平度 ─ ${flat.toFixed(3)}（平均两两相似度）· 平均长度 ${(seq.reduce((s, r) => s + r.action.length, 0) / seq.length).toFixed(1)} 字`)

    // 申报分布
    if (g === 'C' || g === 'D') {
      const dist = {}
      for (const r of seq) {
        const m = /D\d/.exec(r.declaration ?? '')
        const k = m ? m[0] : (r.declaration ?? '空')
        dist[k] = (dist[k] ?? 0) + 1
      }
      console.log(`  ─ 申报分布 ─ ${JSON.stringify(dist)}  D3=${dist.D3 ?? 0} 次（合理 ≤3）`)
    }

    // 同类处境
    const at = n => seq.find(r => r.chapter === n)
    const p = (x, y) => (at(x) && at(y)) ? jac(at(x).action, at(y).action).toFixed(3) : '-'
    const d8 = at(8) ? dir(at(8).action) : '?', d11 = at(11) ? dir(at(11).action) : '?'
    const d6 = at(6) ? dir(at(6).action) : '?', d12 = at(12) ? dir(at(12).action) : '?'
    console.log(`  ─ 反身性 ─ 8(${d8})→11(${d11}) 相似=${p(8, 11)} ｜ 6(${d6})→12(${d12}) 相似=${p(6, 12)}`)
    console.log(`  ─ 一致性 ─ 17vs18 相似=${p(17, 18)}（此值高是对的）`)
    const g14 = at(14)
    if (g14) console.log(`  ─ 泛化(14章) ─ 申报=${g14.declaration} 方向=${dir(g14.action)} | ${g14.action}`)

    // 自创设定
    const inv = INVENTED.map(w => [w, seq.filter(r => r.action.includes(w)).length]).filter(([, c]) => c > 0)
    console.log(`  ─ 自创设定名词 ─ ${inv.length ? inv.map(([w, c]) => `${w}×${c}`).join('  ') : '无'}`)
  }

  // L0：跨 run 方向稳定
  const runs = runsOf(g)
  if (runs.length >= 2) {
    const [r1, r2] = runs
    const a = rs.filter(r => r.run === r1), b = rs.filter(r => r.run === r2)
    let stable = 0, same = 0, sim = 0, n = 0
    const flips = []
    for (let ch = 1; ch <= 20; ch++) {
      const x = a.find(r => r.chapter === ch), y = b.find(r => r.chapter === ch)
      if (!x || !y) continue
      const dx = dir(x.action), dy = dir(y.action)
      if (dx === dy && dx !== '?') stable++
      if (dx !== dy) flips.push(`${ch}:${dx}→${dy}`)
      if (x.action.replace(/[，。、\s]/g, '') === y.action.replace(/[，。、\s]/g, '')) same++
      sim += jac(x.action, y.action); n++
    }
    console.log(`  ─ L0 可复现 ─ 方向稳定 ${stable}/${n} · 逐字相同 ${same}/${n} · 平均相似 ${(sim / n).toFixed(3)}`)
    console.log(`  ─ L0 方向翻转 ─ ${flips.length ? flips.join('  ') : '无'}`)
  }
}

// ───────────────── L1 区分度：A vs D ─────────────────
console.log(`\n${'═'.repeat(70)}\n【L1 区分度】A(无模板) vs D(范例+编号) 逐章方向对照`)
const aRows = byGroup('A').filter(r => r.run === runsOf('A')[0])
const dRows = byGroup('D').filter(r => r.run === runsOf('D')[0])
let diff = 0, tot = 0
for (let ch = 1; ch <= 20; ch++) {
  const x = aRows.find(r => r.chapter === ch), y = dRows.find(r => r.chapter === ch)
  if (!x || !y) continue
  tot++
  const dx = dir(x.action), dy = dir(y.action)
  const same = dx === dy && dx !== '?'
  if (!same) diff++
  console.log(`  ${String(ch).padStart(2)}  A=${dx}  D=${dy}  ${same ? '同' : '★异'}`)
}
console.log(`  ⇒ 方向不同 ${diff}/${tot} 章`)
