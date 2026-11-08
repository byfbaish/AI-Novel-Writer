#!/usr/bin/env node
/**
 * 直连本地模型复跑 trace 里的「正文生成」请求 —— 绕开 App 的全部 check，只测模型本身。
 *
 * 输入：trace JSON 里 purpose === 'chapter-draft' 的那一次请求（system + user 逐字照搬）。
 * 输出：`direct-runs/run-NN.txt` 只放正文，`runs.jsonl` 记元数据，`summary.md` 是汇总表。
 *
 * 用法：
 *   node scripts/experiments/d12-direct-rerun.mjs                     # 默认 041539，10 次
 *   node scripts/experiments/d12-direct-rerun.mjs --runs 20
 *   node scripts/experiments/d12-direct-rerun.mjs --trace <json 文件名>
 *
 * 参数与 App 侧一致（`models.json` 里 `Ollama/qwen3.5:9b-128k`）：temperature 0.7、max_tokens 65536、
 * `http://localhost:11434/v1/chat/completions`（openai 兼容）。**不传 seed** ——
 * App 也没传，传了就变成「固定一条路径」，测不出分布。
 */
import fs from 'node:fs'
import path from 'node:path'

const ARGS = process.argv.slice(2)
const arg = (name, fallback) => (ARGS.includes(name) ? ARGS[ARGS.indexOf(name) + 1] : fallback)

const TRACE_DIR = 'C:/develop/workspace/AI-writer/.batch-a/proj/debug/prompt-trace'
const TRACE_FILE = arg('trace', '20261108-041539-506-正文-ch2-85ff29fd.json')
const RUNS = Number(arg('runs', '10'))
const OUT_DIR = 'C:/develop/workspace/AI-writer/.batch-a/d12-manual-test/direct-runs'
const CH1_PATH = 'C:/develop/workspace/AI-writer/develop/scripts/.tmp/ch1-db.txt'
const MODEL = 'qwen3.5:9b-128k'
const TEMPERATURE = 0.7
const MAX_TOKENS = 65536

// 与生产判据 hasSubstantialPreviousChapterReuse 完全同款
const NGRAM = 8
const HEAD = 1200
const LONG_RUN = 80

const norm = (t) => t.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

const ch1 = fs.readFileSync(CH1_PATH, 'utf8')
const prevEnding = norm(ch1.slice(-1000))
const endingGrams = new Set()
for (let i = 0; i + NGRAM <= prevEnding.length; i++) endingGrams.add(prevEnding.slice(i, i + NGRAM))

const normCh1 = norm(ch1)
const ch1Grams = new Set()
for (let i = 0; i + NGRAM <= normCh1.length; i++) ch1Grams.add(normCh1.slice(i, i + NGRAM))

/** 生产口径：头部 1200 字 vs 上一章结尾 1000 字，8-gram，连续覆盖 ≥80 字 */
function guardReading(draft) {
  const head = norm(draft.slice(0, HEAD))
  const covered = new Uint8Array(head.length)
  for (let i = 0; i + NGRAM <= head.length; i++) {
    if (!endingGrams.has(head.slice(i, i + NGRAM))) continue
    for (let o = i; o < i + NGRAM; o++) covered[o] = 1
  }
  let run = 0
  let longest = 0
  let count = 0
  for (let i = 0; i <= covered.length; i++) {
    if (covered[i]) {
      run++
      count++
      continue
    }
    if (run > longest) longest = run
    run = 0
  }
  return { coverPct: (count / Math.max(1, head.length)) * 100, longest, replay: longest >= LONG_RUN }
}

/** 全篇 vs 整章第 1 章 */
function chapterReading(draft) {
  const body = norm(draft)
  let hit = 0
  let total = 0
  for (let i = 0; i + NGRAM <= body.length; i++) {
    total++
    if (ch1Grams.has(body.slice(i, i + NGRAM))) hit++
  }
  let longest = 0
  for (let i = 0; i < body.length; i++) {
    let k = 0
    while (i + k < body.length && normCh1.includes(body.slice(i, i + k + 1))) k++
    if (k > longest) longest = k
  }
  return { coverPct: (hit / Math.max(1, total)) * 100, longest }
}

/** 复读：任一 30 字连续片段出现 ≥3 次 */
function verbatimRepeat(draft) {
  const body = norm(draft)
  const seen = new Map()
  for (let i = 0; i + 30 <= body.length; i++) {
    const gram = body.slice(i, i + 30)
    const n = (seen.get(gram) ?? 0) + 1
    seen.set(gram, n)
    if (n >= 3) return true
  }
  return false
}

const trace = JSON.parse(fs.readFileSync(path.join(TRACE_DIR, TRACE_FILE), 'utf8'))
const call = (trace.ioCalls || []).find((item) => item.purpose === 'chapter-draft')
if (!call) throw new Error('trace 里没有 chapter-draft 调用')
const messages = call.messages.map((m) => ({ role: m.role, content: m.content }))

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, 'ch1.txt'), ch1, 'utf8')
fs.writeFileSync(path.join(OUT_DIR, 'prompt-system.txt'), messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n'), 'utf8')
fs.writeFileSync(path.join(OUT_DIR, 'prompt-user.txt'), messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n'), 'utf8')

console.log(`trace=${TRACE_FILE} model=${MODEL} temp=${TEMPERATURE} runs=${RUNS}`)
console.log(`prompt: system ${messages.filter((m) => m.role === 'system')[0]?.content.length ?? 0} 字 / user ${messages.filter((m) => m.role === 'user')[0]?.content.length ?? 0} 字`)

const rows = []
const summaryPath = path.join(OUT_DIR, 'summary.md')
const jsonlPath = path.join(OUT_DIR, 'runs.jsonl')

// 续跑：已有 runs.jsonl 的行数决定从第几次接着跑，避免覆盖已经跑出来的样本
if (fs.existsSync(jsonlPath)) {
  for (const line of fs.readFileSync(jsonlPath, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      rows.push(JSON.parse(line))
    } catch {
      /* 尾行可能写了一半，忽略 */
    }
  }
}
const START = rows.length + 1
console.log(`已有 ${rows.length} 次，从第 ${START} 次开始，目标 ${RUNS} 次`)

for (let n = START; n <= RUNS; n += 1) {
  const tag = String(n).padStart(2, '0')
  const started = Date.now()
  let text = ''
  let finishReason = ''
  let error = ''
  let completionTokens = 0
  try {
    const res = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer 123456' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        stream: false,
      }),
      signal: AbortSignal.timeout(30 * 60 * 1000),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
    text = json.choices?.[0]?.message?.content ?? ''
    finishReason = json.choices?.[0]?.finish_reason ?? ''
    completionTokens = json.usage?.completion_tokens ?? 0
  } catch (e) {
    error = String(e && e.message ? e.message : e)
  }

  const chars = Array.from(text).length
  const g = guardReading(text)
  const c = chapterReading(text)
  const repeat = verbatimRepeat(text)
  const flags = []
  if (error) flags.push('请求失败')
  if (!error && !text.trim()) flags.push('空输出')
  if (!error && finishReason && finishReason !== 'stop') flags.push(`finish=${finishReason}`)
  if (chars > 3000) flags.push(`超长 ${chars} 字`)
  if (!error && chars > 0 && chars < 800) flags.push(`过短 ${chars} 字`)
  if (g.replay) flags.push(`重演上一章结尾（连续 ${g.longest} 字）`)
  if (repeat) flags.push('复读（30 字片段重复 ≥3 次）')

  const file = `run-${tag}.txt`
  fs.writeFileSync(path.join(OUT_DIR, file), text, 'utf8')

  const row = {
    run: n,
    file,
    chars,
    finishReason,
    ms: Date.now() - started,
    completionTokens,
    headCoverPct: Number(g.coverPct.toFixed(1)),
    headLongest: g.longest,
    replay: g.replay,
    chapterCoverPct: Number(c.coverPct.toFixed(1)),
    chapterLongest: c.longest,
    repeat,
    flags,
    error,
  }
  rows.push(row)
  fs.appendFileSync(path.join(OUT_DIR, 'runs.jsonl'), `${JSON.stringify(row)}\n`, 'utf8')

  console.log(
    `#${tag} ${chars} 字 | 头部 ${row.headCoverPct}%/${g.longest} 字 | 全篇 ${row.chapterCoverPct}%/${c.longest} 字 | finish=${finishReason || '-'} | ${(row.ms / 1000).toFixed(0)}s${flags.length ? ' | ' + flags.join('；') : ''}${error ? ' | ' + error : ''}`,
  )

  // 每轮都刷新汇总表，中途被中断也留得下
  const ok = rows.filter((r) => !r.flags.length).length
  fs.writeFileSync(
    summaryPath,
    [
      `# 直连复跑汇总（${TRACE_FILE}）`,
      '',
      `模型 \`${MODEL}\`，temperature ${TEMPERATURE}，max_tokens ${MAX_TOKENS}，未传 seed。正文 prompt 逐字照搬 trace 的 \`chapter-draft\` 请求。`,
      '',
      `进度 ${rows.length}/${RUNS} · 无异常 ${ok} · 有异常 ${rows.length - ok}`,
      '',
      '| # | 字数 | 头部覆盖/最长 | 全篇覆盖/最长 | finish | 耗时 | 异常 |',
      '|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.run} | ${r.chars} | ${r.headCoverPct}% / ${r.headLongest} | ${r.chapterCoverPct}% / ${r.chapterLongest} | ${r.finishReason || '-'} | ${(r.ms / 1000).toFixed(0)}s | ${r.flags.join('；') || '—'} |`),
      '',
      '头部覆盖 = 生产判据同款（正文头 1,200 字被「上一章结尾 1,000 字」的 8-gram 覆盖比例，连续 ≥80 字判重演）；',
      '全篇覆盖 = 整篇正文被「第 1 章全文」的 8-gram 覆盖比例。',
      '',
      '正文文件：`run-NN.txt`（只有正文）。第 1 章正文：`ch1.txt`。',
    ].join('\n'),
    'utf8',
  )
}

console.log(`\n完成 ${rows.length} 次。异常 ${rows.filter((r) => r.flags.length).length} 次。输出目录 ${OUT_DIR}`)
