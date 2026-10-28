#!/usr/bin/env node
/**
 * 金色词条最小闭环实验 —— 四组对照 × 20 章长轮
 *
 * ## 要验的四条假设
 * H1 范例 vs 规则：给 3 条**行为样例**，比给 3 条**触发条件式规则**，在没见过的处境上
 *    更能"像同一个人"（规则式会找不到匹配的触发条件 ⇒ 退回通用反应）。
 * H2 一致性：长轮之后同一类处境下反应可辨认（底色在），但不是复制粘贴。
 * H3 申报可靠性：带编号的那组能不能正确申报 `因为 D<n>`，标错多少。
 * H4 反身性：第 11 章注入"门槛移动"后，同类型处境（第 8/6 章）的反应有没有变，且仍是同一人。
 *
 * ## 四组信息量完全相同，只有**组织形态**不同 ⇒ 结果才能归因到形态
 *   A 基线       ：只有性格描述 + 锚点
 *   B 范例无编号 ：三条行为样例，无编号
 *   C 规则式     ：三条「触发：当…时 / 应对：…」，即现有 detailTask 的形态
 *   D 范例+编号  ：三条带 D1/D2/D3 的行为样例（本轮讨论的落点）
 *
 * ## 用法
 *   node scripts/experiments/golden-trait-minimal-loop.mjs            # 全跑（断点续跑）
 *   node scripts/experiments/golden-trait-minimal-loop.mjs --dry      # 只打印 prompt 不调模型
 *   node scripts/experiments/golden-trait-minimal-loop.mjs --group D  # 只跑一组
 */

import fs from 'node:fs'
import path from 'node:path'

const MODEL = process.env.EXPERIMENT_MODEL ?? 'qwen3.5:9b'
const OUT_DIR = path.join(process.cwd(), 'scripts', 'experiments', 'out')
const ARGS = process.argv.slice(2)
const DRY = ARGS.includes('--dry')
/** 第一轮只给「对方 + 要求」；第二轮补上「他要付出 / 不做会怎样」（作者指出的缺失那一半） */
const ROUND = ARGS.includes('--round2') ? 2 : 1
const ONLY = ARGS.includes('--group') ? ARGS[ARGS.indexOf('--group') + 1] : null
/** seed 基数：同一条卡跑多次才能分清"响应"与"抖动" */
const PP = ARGS.includes('--pp') ? Number(ARGS[ARGS.indexOf('--pp') + 1]) : 1.5
const CTX = ARGS.includes('--ctx') ? Number(ARGS[ARGS.indexOf('--ctx') + 1]) : 0
const TEMP = ARGS.includes('--temp') ? Number(ARGS[ARGS.indexOf('--temp') + 1]) : 0.7
const SEED_BASE = ARGS.includes('--seed') ? Number(ARGS[ARGS.indexOf('--seed') + 1]) : 42
const OUT_FILE = path.join(OUT_DIR, `golden-trait-loop${ROUND === 2 ? '-v2' : ''}${SEED_BASE === 42 ? '' : `-s${SEED_BASE}`}${TEMP === 0.7 ? '' : `-t${TEMP}`}${PP === 1.5 ? '' : `-pp${PP}`}${CTX ? `-c${CTX}` : ''}${MODEL === 'qwen3.5:9b' ? '' : `-${MODEL.replace(/[^a-z0-9.]/gi, '')}`}.jsonl`)

// ──────────────────────────────── 人物卡：四组唯一变量 ────────────────────────────────

const IDENTITY = `他谨慎、怕麻烦，能力平庸，在人群里不显眼。
他的锚点：他答应过一个人，要护住另一个人；那句话还没兑现。`

/** 三条样例的**内容**，四组共用（B 去编号、C 改写成规则、D 保编号） */
const SAMPLE_BODIES = [
  {
    id: 'D1',
    subject: '有人跟他讨一句口头承诺、说凭据以后补',
    action: '他不接话，先问凭据在哪；答不上来就把话岔开，手指在桌沿敲两下',
  },
  {
    id: 'D2',
    subject: '要他放弃一样自己攒了很久的东西、换一条省事的捷径',
    action: '他不动那样东西，宁可多绕两天路，喉咙发紧也不动',
  },
  {
    id: 'D3',
    subject: '有人拿他要护的那个人当筹码，逼他改主意',
    action: '他不算了，直接应下；应下之后手掌在桌面上压了一会儿才抬起来',
  },
]

const CARDS = {
  // 基线：什么样例都不给
  A: IDENTITY,

  // 范例式（无编号）：给三条"他总是这样"，但不给可寻址的名字
  B: `${IDENTITY}

他大致是这么个人：
- ${SAMPLE_BODIES[0].subject}：${SAMPLE_BODIES[0].action}。
- ${SAMPLE_BODIES[1].subject}：${SAMPLE_BODIES[1].action}。
- ${SAMPLE_BODIES[2].subject}：${SAMPLE_BODIES[2].action}。`,

  // 规则式：现有 detailTask 的形态（触发条件句 + 应对），带编号
  C: `${IDENTITY}

- ${SAMPLE_BODIES[0].id}〔日常〕
  触发：当有人向他讨一句口头承诺、而凭据要以后再补时
  应对：${SAMPLE_BODIES[0].action}
- ${SAMPLE_BODIES[1].id}〔代价〕
  触发：当守规矩要多耗掉一样他攒了很久的东西、且绕开只要他闭嘴不问时
  应对：${SAMPLE_BODIES[1].action}
- ${SAMPLE_BODIES[2].id}〔破例〕
  触发：当有人拿他要护的那个人当筹码、逼他改主意时
  应对：${SAMPLE_BODIES[2].action}`,

  // 范例式 + 编号：本轮讨论的落点（可泛化 + 可寻址）
  D: `${IDENTITY}

他大致是这么个人：
- ${SAMPLE_BODIES[0].id}　${SAMPLE_BODIES[0].subject}：${SAMPLE_BODIES[0].action}。
- ${SAMPLE_BODIES[1].id}　${SAMPLE_BODIES[1].subject}：${SAMPLE_BODIES[1].action}。
- ${SAMPLE_BODIES[2].id}　${SAMPLE_BODIES[2].subject}：${SAMPLE_BODIES[2].action}。`,
}

const HAS_IDS = new Set(['C', 'D'])

// ──────────────────────────────── 20 章处境序列（模拟卷纲给的"命运"） ────────────────────────────────
// 命运：他是小人物，为了兑现一句承诺，最终走进一个必死之地。终点固定，路径由他选。

const CHAPTERS = [
  { n: 1, who: '一个跟他没什么干系的同门', ask: '口头许诺事后有好处，让他先帮着做一件事，凭据说以后补', cost: '帮他跑三天腿，自己那份活只能熬夜补', risk: '不帮，这人往后在外头说他小气', tag: 'baseline-daily' },
  { n: 2, who: '一个跟他同住的人', ask: '借他攒了很久的一样东西，说用完就还，没提期限', cost: '那样东西他攒了两年，借出去多半回不来', risk: '不借，往后同住低头不见抬头见', tag: 'daily' },
  { n: 3, who: '两个都跟他有来往的人', ask: '各执一词，都要他当场站一边，都不肯落纸', cost: '站错一边，另一边从此把他当对头', risk: '不站，两边都觉得他不可信', tag: 'daily' },
  { n: 4, who: '一个管事的人', ask: '让他替一件不是他做的事担个名，说只是走个过场', cost: '真追下来，责任全落在他头上', risk: '不担，往后有差事不再想到他', tag: 'costed' },
  { n: 5, who: '一个不熟但开口求他的人', ask: '要他先垫出一样他自己也不够用的东西，说回头补', cost: '垫出去，他自己这一段就不够用', risk: '不垫，那人当场下不来台，旁人都看着', tag: 'costed' },
  { n: 6, who: '一个跟他没交情的人', ask: '要他出面替这个人担保，担保的后果全落在他身上', cost: '这个后果全落在他身上，跑不掉', risk: '不担，这人立刻被处置', tag: 'costed-guarantee' },
  { n: 7, who: '一个知道他底细的人', ask: '拿他过去做过的一件事说事，要他让一步', cost: '让这一步，等于把那件事认下来', risk: '不让，那人把这件事捅到明面上', tag: 'pressure' },
  { n: 8, who: '他自己', ask: '放弃一样他攒了很久的东西，换一条能省很多事的捷径', cost: '那样东西攒了很久，放手就再没有', risk: '不走捷径，要多耗两个月', tag: 'costed-trade' },
  { n: 9, who: '一个不熟的人', ask: '求他救命，但救这个人会把他自己暴露出去', cost: '救他，自己这些年的遮掩全部作废', risk: '不救，这人就死在他眼前', tag: 'costed-rescue' },
  { n: 10, who: '一群看着他的人', ask: '当众质疑他，要他现在就给个说法', cost: '当场说错一句，就坐实了对方的说法', risk: '不说，众人都当他心虚', tag: 'daily' },
  // ← 卷末：门槛移动注入点
  { n: 11, who: '他自己', ask: '放弃一样他攒了很久的东西，换一条能省很多事的捷径', cost: '那样东西攒了很久，放手就再没有', risk: '不走捷径，要多耗两个月', tag: 'R-costed-trade' },
  { n: 12, who: '一个跟他没交情的人', ask: '要他出面替这个人担保，担保的后果全落在他身上', cost: '这个后果全落在他身上，跑不掉', risk: '不担，这人立刻被处置', tag: 'R-costed-guarantee' },
  { n: 13, who: '他答应过要护住的那个人', ask: '这个人求他救命，救他会把他自己暴露出去', cost: '救他，自己这些年的遮掩全部作废', risk: '不救，这人就死在他眼前', tag: 'anchor-object' },
  { n: 14, who: '一个跟他毫不相干的人', ask: '要他交出这个毫不相干的人的信息，换自己脱身', cost: '交出去，那人会因此遭殃', risk: '不交，他自己脱不了身', tag: 'GENERALIZE' },
  { n: 15, who: '一个当众指认他的人', ask: '要他认下一件不是他做的事，认了就没事', cost: '认下来，名声和往后的路都搭进去', risk: '不认，当众下不来台，走不出这道门', tag: 'costed' },
  { n: 16, who: '他答应过要护住的那个人', ask: '这个人执意要去送死，让他别跟着', cost: '跟着去，他自己也多半回不来', risk: '不跟，这人十成会死', tag: 'anchor-object' },
  { n: 17, who: '一个拿住他把柄的人', ask: '拿他要护的那个人当筹码，要他改口', cost: '改口，等于把那句应下的话吞回去', risk: '不改口，那人立刻被处置', tag: 'exception' },
  { n: 18, who: '另一个拿住他把柄的人', ask: '同样拿他要护的那个人当筹码，要他当场表态', cost: '表态，等于把那句应下的话吞回去', risk: '不表态，那人立刻被处置', tag: 'exception-repeat' },
  { n: 19, who: '他自己', ask: '必死之地在前，有人要他把最后的退路先交出来', cost: '交出去，他就再没有回头的路', risk: '不交，他此刻就进不去', tag: 'final' },
  { n: 20, who: '他自己', ask: '已经退无可退，只剩怎么走完这段路', cost: '这条路的尽头是他自己的死', risk: '不去，那件事就永远没人办', tag: 'final' },
]

const THRESHOLD_SHIFT = `【这一卷之后他变了】
他底色没变（依然谨慎、怕麻烦），但门槛下移了：以前要付出很大代价才动的事，现在小一点他也动。
尤其遇到"放弃自己攒的东西去换省事"这类事，他比以前更愿意先牺牲自己。
`

// ──────────────────────────────── 调用 ────────────────────────────────

const SYSTEM = '你是一个小说角色的行为推演器。你只写这个人物在当下会怎么做，不写旁白，不解释，不评价。'

function buildMessages(group, ch, history) {
  const card = CARDS[group] + (ch.n >= 11 ? `\n${THRESHOLD_SHIFT}` : '')
  const past = history.length
    ? `【这之前他做过的事】\n${history.slice(-3).map(h => `第${h.n}章：${h.action}`).join('\n')}\n\n`
    : ''
  const format = HAS_IDS.has(group)
    ? `请严格输出两行，不要多写：
申报：D<n>      （必须是 ${SAMPLE_BODIES.map(s => s.id).join(' / ')} 之一；若这一章确实与哪一条都不沾边，写 申报：无）
应对：<他第一秒做的事>，<一个身体反应>（不超过 45 字）`
    : `请严格输出两行，不要多写：
申报：无
应对：<他第一秒做的事>，<一个身体反应>（不超过 45 字）`

  const stakes = ROUND === 2
    ? `他要付出：${ch.cost}
不做会怎样：${ch.risk}
`
    : ''

  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `【人物】
${card}
${past}【这一章他遇到的】
对方：${ch.who}
要求：${ch.ask}
${stakes}
${format}`,
    },
  ]
}

async function chat(messages, seed) {
  const t0 = Date.now()
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      think: false,
      options: { temperature: TEMP, seed, num_predict: 300, presence_penalty: PP, ...(CTX ? { num_ctx: CTX } : {}) },
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const j = await res.json()
  return { text: j.message?.content ?? '', ms: Date.now() - t0, pe: j.prompt_eval_count ?? 0 }
}

// ──────────────────────────────── 主流程 ────────────────────────────────

function loadDone() {
  if (!fs.existsSync(OUT_FILE)) return new Set()
  return new Set(
    fs.readFileSync(OUT_FILE, 'utf8').split('\n').filter(Boolean).map(l => {
      try { const r = JSON.parse(l); return `${r.group}#${r.chapter}` } catch { return null }
    }).filter(Boolean),
  )
}

const done = loadDone()
const groups = ONLY ? [ONLY] : ['A', 'B', 'C', 'D']
const total = groups.length * CHAPTERS.length
let step = 0

for (const group of groups) {
  if (!CARDS[group]) throw new Error(`未知分组 ${group}`)
  const history = []
  for (const ch of CHAPTERS) {
    step++
    const key = `${group}#${ch.n}`
    if (done.has(key)) {
      console.log(`[${step}/${total}] ${key} 已有，跳过`)
      continue
    }
    const messages = buildMessages(group, ch, history)
    if (DRY) {
      console.log(`\n===== ${key} =====\n${messages[1].content}`)
      history.push({ n: ch.n, action: '(dry)' })
      continue
    }
    const { text, ms, pe } = await chat(messages, SEED_BASE + ch.n)
    const decl = /申报[：:]\s*([^\n]*)/.exec(text)?.[1]?.trim() ?? ''
    const act = /应对[：:]\s*([^\n]*)/.exec(text)?.[1]?.trim() ?? text.trim()
    const row = {
      group, chapter: ch.n, tag: ch.tag, who: ch.who, ask: ch.ask,
      declaration: decl, action: act, raw: text, ms, promptTokens: pe,
      ts: new Date().toISOString(),
    }
    fs.appendFileSync(OUT_FILE, JSON.stringify(row) + '\n')
    history.push({ n: ch.n, action: act })
    console.log(`[${step}/${total}] ${key} ${ms}ms  申报=${decl} | ${act.slice(0, 40)}`)
  }
}

console.log(`\n完成。结果：${OUT_FILE}`)
