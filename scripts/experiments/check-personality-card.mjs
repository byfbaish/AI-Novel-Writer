#!/usr/bin/env node
/**
 * 角色卡生成实验的**结构判读**。
 *
 * 只判「结构对不对」，不判「写得好不好」——后者要人读。
 * 五条硬指标，每条都直接对应一处实机毛病或下游契约：
 *
 * | 指标 | 为什么是硬的 |
 * |---|---|
 * | B 项 4–5 且编号连续 | 排不出先后时，V1/V4 全废，第四层没有地基 |
 * | D 项 3–4 且编号连续 | 同上，且下游要按 D<n> 引用 |
 * | **编号是 `D1` 不是 `D<1>`** | `disposition-citation` 的正则 `\bD\s*\d\b` 匹配不了 `D<1>` ⇒ 整章被当成"没写编号" |
 * | 每条 D 都有「不适用」 | 少一条就变成引力中心（实测 D1 吸走三个不相干处境） |
 * | 有例外段、且指明挂第几条底线 | 没挂底线 = 不是例外，是写崩了（X1） |
 *
 * 另加两条启发式（**只提示，不下结论**）：
 * - 日常档：D 里有没有一条的"什么事"不含高压词
 * - 人称：出现「我」说明串了视角
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.join(process.cwd(), 'scripts', 'experiments', 'out')
const files = fs.existsSync(OUT_DIR)
  ? fs.readdirSync(OUT_DIR).filter(name => name.startsWith('personality-card-') && name.endsWith('.jsonl'))
  : []
if (files.length === 0) {
  console.error('没有找到 personality-card-*.jsonl，先跑 personality-card-prompt-loop.mjs')
  process.exit(1)
}

const rows = files.flatMap(name =>
  fs
    .readFileSync(path.join(OUT_DIR, name), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        return { ...JSON.parse(line), file: name }
      } catch {
        return null
      }
    })
    .filter(Boolean),
)

/** 高压词 —— 用来判「这条做法是不是只在大压力下才成立」。 */
const PRESSURE = ['逼', '当众', '生死', '刀', '杀', '血', '追杀', '围', '险', '威胁', '要挟', '当街', '追杀', '拼命']

function inspect(text) {
  const bRows = [...text.matchAll(/^B\s*(\d{1,2})/gm)].map(m => Number(m[1]))
  // D 编号：正常写法 D1，错误写法 D<1> / D[1] / D（1）
  const dNormal = [...text.matchAll(/^D\s*(\d{1,2})(?!\s*[<\[])/gm)].map(m => Number(m[1]))
  const dBad = [...text.matchAll(/^D\s*[<[(]\s*(\d{1,2})\s*[>\])]/gm)].map(m => Number(m[1]))
  const dRows = dNormal.length ? dNormal : dBad
  const notApplicable = (text.match(/不适用/g) ?? []).length
  const exceptionIndex = text.search(/例外/)
  const exceptionText = exceptionIndex >= 0 ? text.slice(exceptionIndex) : ''
  const exceptionCitesBottom = /B\s*\d|第\s*[一二三四五1-5]\s*条/.test(exceptionText)

  // 日常档：按 D 切块，看"什么事"那一句有没有高压词
  const blocks = text.split(/^D\s*[<\[]?\s*\d{1,2}\s*[>\]]?/m).slice(1)
  const dailyLike = blocks.filter(block => {
    const head = block.split(/不适用/)[0] ?? ''
    return !PRESSURE.some(word => head.includes(word))
  }).length

  // 人称：只看叙述里的「我」——**引号内的对话不算**（「我核，不签」是台词，不是视角串了）。
  const narrativeOnly = text.replace(/「[^」]*」|『[^』]*』|"[^"]*"|“[^”]*”/g, '')
  const firstPerson = (narrativeOnly.match(/我/g) ?? []).length
  const jsonish = /[{}]|```/.test(text)

  // 锚点体检（2026-10-29 作者质疑后新增）：
  // 括号里该写「一直在的东西」，不是「发生一次的事」。用动词表做启发式。
  const brackets = [...text.matchAll(/[（(]([^）)]{1,80})[）)]/g)].map(m => m[1])
  const bracketSaysAnchor = brackets.filter(item => item.includes('锚点')).length
  const EVENT_VERBS = ['递', '塞', '顶', '划进', '逼', '送', '那天', '那次', '那回', '抬']
  const bracketLooksEvent = brackets.filter(item => EVENT_VERBS.some(verb => item.includes(verb))).length
  const hasAnchorLine = /^\s*锚点\s*[:：]/m.test(text)
  const anchorCitesB1 = /锚点\s*[:：][^\n]*B\s*1/.test(text)

  const continuous = (list) => list.every((value, index) => value === index + 1)

  return {
    bCount: bRows.length,
    bOk: bRows.length >= 4 && bRows.length <= 5 && continuous(bRows),
    dCount: dRows.length,
    dOk: dRows.length >= 3 && dRows.length <= 4 && continuous(dRows),
    badNumbering: dBad.length,
    numberingOk: dBad.length === 0 && dNormal.length > 0,
    naOk: notApplicable === dRows.length && dRows.length > 0,
    hasException: exceptionIndex >= 0,
    exceptionCitesBottom,
    dailyLike,
    firstPerson,
    jsonish,
    bracketCount: brackets.length,
    bracketSaysAnchor,
    bracketLooksEvent,
    hasAnchorLine,
    anchorCitesB1,
  }
}

const mark = ok => (ok ? '✅' : '❌')
console.log('组 前提 B项 D项 编号 不适用 例外 挂底线 日常 我 | 括号 含锚点字 疑似事件 锚点行 挂B1 | 结论')
console.log('─'.repeat(104))
for (const row of rows) {
  const r = inspect(row.text)
  const fails = [
    !r.bOk && 'B项',
    !r.dOk && 'D项',
    !r.numberingOk && `编号(D<${r.badNumbering})`,
    !r.naOk && '不适用',
    !r.hasException && '缺例外',
    !r.exceptionCitesBottom && '例外未挂底线',
    r.firstPerson > 0 && `我×${r.firstPerson}`,
  ].filter(Boolean)
  console.log(
    [
      String(row.group).padEnd(7),
      String(row.case).padEnd(4),
      String(r.bCount).padEnd(4),
      String(r.dCount).padEnd(4),
      mark(r.numberingOk).padEnd(4),
      mark(r.naOk).padEnd(6),
      mark(r.hasException).padEnd(4),
      mark(r.exceptionCitesBottom).padEnd(6),
      String(r.dailyLike).padEnd(4),
      String(r.firstPerson).padEnd(1),
      '|',
      String(r.bracketCount).padEnd(4),
      (r.bracketSaysAnchor ? `❌${r.bracketSaysAnchor}` : '✅').padEnd(9),
      (r.bracketLooksEvent ? `⚠️${r.bracketLooksEvent}` : '✅').padEnd(8),
      (r.hasAnchorLine ? '✅' : '❌').padEnd(6),
      (r.anchorCitesB1 ? '✅' : '—').padEnd(5),
      '|',
      fails.length ? `❌ ${fails.join(' / ')}` : '✅ 结构合格',
    ].join(' '),
  )
}

console.log(`\n日常档：数字 = 不含高压词的做法条数（启发式）。0 表示四条全在「被逼 / 当众 / 生死」上。`)
console.log(`锚点列：括号 = 出现了几处括号；含锚点字 = 括号里还写着"锚点"（应为 0）；`)
console.log(`        疑似事件 = 括号里含"递/塞/顶/划进/逼/那天/那次"等事件词（启发式，需人工复核）；`)
console.log(`        锚点行 = 有没有单独一行「锚点：」；挂B1 = 该行是否点名 B1。`)
console.log(`\n=== 原文（人工判 V1 排序 / V4 相邻冲突 / X2 例外方向）===`)
for (const row of rows) {
  console.log(`\n----- 组 ${row.group} / 前提 ${row.case}（${row.caseLabel}）-----`)
  console.log(row.text.trim())
}
