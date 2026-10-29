#!/usr/bin/env node
/**
 * 角色卡「具体所指」验证 —— 用**真机同款材料**测括号里的东西是不是材料里有的。
 *
 * ## 为什么要有这个脚本
 *
 * 2026-10-29 真机生成（trace `20261029-190212-387`）的 B 项括号不合格：
 * B2「老魁托付的那句话」、B3「那本只记日期不记名字的旧账」—— 材料里两样都没有；
 * 锚点与 B1 括号又都指向「灵配袋空着的那一格」。上一轮实验没测出来，因为它
 * ①喂的是两行最小前提（真机是 5.9k tokens 的整套材料）②判据只判形状（含不含事件词），
 * 判不出「串项」与「编造」。
 *
 * 本脚本补上这两处：
 * - 材料取自真机 trace 的 `manifestContextJson`，不是编的前提；
 * - 判据从「形状」改成「**能不能在材料里找到**」——括号里的三字片段有多少比例
 *   在材料原文里出现过，低于阈值就是模型自己造的。
 *
 * 用法：
 *   node scripts/experiments/referent-bracket-check.mjs                # 用现版 prompt 跑
 *   node scripts/experiments/referent-bracket-check.mjs --legacy       # 对照：把旧的四类举例塞回去
 *   node scripts/experiments/referent-bracket-check.mjs --runs 3 --model qwen3.5:9b-128k
 */
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const ARGS = process.argv.slice(2)
const arg = (name, fallback) => (ARGS.includes(name) ? ARGS[ARGS.indexOf(name) + 1] : fallback)
const MODEL = arg('--model', 'qwen3.5:9b-128k')
const RUNS = Number(arg('--runs', '2'))
const LEGACY = ARGS.includes('--legacy')
const TRACE = arg('--trace', 'C:/develop/workspace/AI-writer/师父派我来除魔，幕后真凶竟是小师妹/debug/prompt-trace/20261029-190212-387-character-architecture-915a70b7.md')

/** 从 trace 里取真机材料：那一行就是喂给详情批次的 `manifestContextJson`。 */
function readMachineContext() {
  const text = fs.readFileSync(TRACE, 'utf8')
  const line = text.split('\n').find(row => row.startsWith('{"premise":'))
  if (!line) throw new Error('trace 里找不到材料行')
  return line
}

/** 把 TS 的 prompt 模块 bundle 成可 import 的 ESM —— 保证测的是**当前代码**，不是脚本里复制的副本。 */
async function loadPromptModule() {
  const out = path.join(process.cwd(), 'scripts', 'experiments', 'out', 'prompt-language.mjs')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  await build({ entryPoints: ['src/services/prompt-language.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' })
  return import(`file://${out.replace(/\\/g, '/')}`)
}

/** 旧版那段四类举例 —— 用于对照「删掉举例」到底有没有用。 */
const LEGACY_BLOCK = `  括号里写的是**一直在的东西**（一个人、一本账、一格位置、一句没兑现的话），不是发生一次的事（谁在哪天递来什么、哪张纸被谁顶到脸上）。`

async function ask(prompt, system) {
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, options: { temperature: 0.7, num_ctx: 32768 },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
  })
  if (!response.ok) throw new Error(`ollama ${response.status}`)
  const body = await response.json()
  return body.message?.content ?? ''
}

/** 括号里的内容有多少能在材料原文里找到：三字滑窗命中率。 */
function groundedness(referent, context) {
  const clean = referent.replace(/[（）()「」“”"'、，。：:；;\s]/g, '')
  if (clean.length < 3) return { ratio: 0, hits: [], misses: [clean] }
  const hits = [], misses = []
  for (let i = 0; i + 3 <= clean.length; i++) {
    const gram = clean.slice(i, i + 3)
    if (context.includes(gram)) hits.push(gram); else misses.push(gram)
  }
  return { ratio: hits.length / (hits.length + misses.length), hits, misses }
}

/** 两段文字共享的最长连续片段长度 —— 用来判「锚点和括号是不是同一个东西」。 */
function sharedRun(a, b) {
  const x = a.replace(/[（）()「」“”"'、，。：:；;\s]/g, ''), y = b.replace(/[（）()「」“”"'“”、，。：:；;\s]/g, '')
  let best = 0
  for (let i = 0; i < x.length; i++)
    for (let len = best + 1; i + len <= x.length; len++)
      if (y.includes(x.slice(i, i + len))) best = len; else break
  return best
}

function parseCard(output) {
  const match = output.match(/\{[\s\S]*"entries"[\s\S]*\}/)
  if (!match) return null
  try {
    const entries = JSON.parse(match[0]).entries
    return entries.find(entry => entry.role === 'protagonist') ?? entries[0] ?? null
  } catch { return null }
}

/** 从四层文本里抠出 B 项的括号与锚点行。模型经常把 B1…B4 挤在同一行，不能按行切。 */
function brackets(personality) {
  const items = []
  for (const part of personality.split(/(?=B\d)/).slice(1)) {
    const head = part.match(/^(B\d)\s*([\s\S]*)$/)
    if (!head) continue
    const body = head[2].replace(/锚点[：:][\s\S]*$/, '').trim()
    const bracket = body.match(/[（(]([^（()）]*)[）)]\s*$/) ?? body.match(/[（(]([^（()）]*)[）)]/)
    items.push({ id: head[1], text: body.replace(/[（(][^（()）]*[）)]\s*$/, '').trim().slice(0, 40), referent: bracket?.[1]?.trim() ?? null })
  }
  const anchor = personality.match(/锚点[：:]\s*(.+)/)?.[1]?.trim() ?? null
  return { items, anchor }
}

const main = async () => {
  const context = readMachineContext()
  const { characterArchitecturePrompts } = await loadPromptModule()
  const prompts = characterArchitecturePrompts('zh-CN')
  const manifest = JSON.stringify({ slots: [{ slotId: 'chen_yan', name: '陈砚', role: 'protagonist' }] })
  let task = prompts.detailTask({ context, manifest, slotIds: 'chen_yan', validatedPrefix: '' })

  if (LEGACY) {
    // 把旧举例塞回它原本的位置：新版把那一行换成了判法，这里在判法后面追加旧串。
    const marker = '  括号里写的是**一直在的东西**，不是发生一次的事。'
    if (!task.includes(marker)) throw new Error('新版 prompt 结构变了，--legacy 对照需要同步')
    task = task.replace(marker, LEGACY_BLOCK)
  }

  console.log(`模型 ${MODEL} · ${RUNS} 次 · ${LEGACY ? '旧版（带四类举例）' : '现版（给判法）'}`)
  console.log(`材料 ${context.length} 字符（真机同款）\n`)

  const summary = []
  const raw = []
  for (let run = 1; run <= RUNS; run++) {
    const output = await ask(task, prompts.detailSystem)
    raw.push({ run, output })
    const card = parseCard(output)
    if (!card) { console.log(`第 ${run} 次：输出不是合法 JSON，跳过\n`); continue }
    const { items, anchor } = brackets(card.personality ?? '')
    console.log(`── 第 ${run} 次 ──`)
    for (const item of items) {
      if (!item.referent) { console.log(`${item.id} 没有括号`); continue }
      const score = groundedness(item.referent, context)
      const flag = score.ratio >= 0.5 ? '有据' : '编造?'
      console.log(`${item.id} [${flag} ${(score.ratio * 100).toFixed(0)}%] ${item.text.slice(0, 28)}… →（${item.referent}）`)
      if (score.ratio < 0.5) console.log(`      材料里找不到：${[...new Set(score.misses)].slice(0, 6).join(' / ')}`)
    }
    if (anchor) {
      const worst = items.map(item => ({ id: item.id, overlap: item.referent ? sharedRun(anchor, item.referent) : 0 }))
        .sort((a, b) => b.overlap - a.overlap)[0]
      console.log(`锚点：${anchor.slice(0, 48)}…`)
      console.log(`      与 ${worst?.id} 括号共享 ${worst?.overlap} 字${(worst?.overlap ?? 0) >= 4 ? '  ← 同一个东西' : ''}`)
    } else console.log('锚点：缺失')
    console.log('')
    summary.push({ run, items, anchor })
  }

  const withBracket = summary.flatMap(entry => entry.items.filter(item => item.referent))
  const grounded = withBracket.filter(item => groundedness(item.referent, context).ratio >= 0.5).length
  console.log(`合计 ${withBracket.length} 个括号，可溯源 ${grounded} 个（${withBracket.length ? Math.round(grounded / withBracket.length * 100) : 0}%）`)
  const collisions = summary.filter(entry => entry.anchor && entry.items.some(item => item.referent && sharedRun(entry.anchor, item.referent) >= 4)).length
  console.log(`锚点与括号撞车：${collisions}/${summary.length} 次`)
  const dump = path.join(process.cwd(), 'scripts', 'experiments', 'out',
    `referent-${LEGACY ? 'legacy' : 'current'}-${MODEL.replace(/[^a-z0-9.]/gi, '')}.json`)
  fs.writeFileSync(dump, JSON.stringify(raw, null, 2))
  console.log(`原文已存 ${dump}`)
}

main().catch(error => { console.error(error); process.exit(1) })
