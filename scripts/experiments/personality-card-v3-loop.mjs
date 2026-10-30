#!/usr/bin/env node
/**
 * 三格卡生成实验 —— **只验「模型产物能不能被解析器解析」，不验语义质量**。
 *
 * ## 与前几轮实验的分工
 *
 * 前几轮（`personality-card-prompt-loop.mjs`）测的是「prompt 措辞能不能让模型写出对的卡」，
 * 靠人读产物判。这一轮只回答一个更窄、更硬的问题：
 *
 * > 把四层换成三格之后，模型吐出来的东西，`parsePersonalityCard` 认不认？
 *
 * 判据交给 `src/shared/__tests__/card-format-fixture.test.ts` 用**真解析器**跑，
 * 本脚本只负责产数据。**不要在脚本里写正则** —— 那会养出第二份解析器，
 * 而两份解析器必然漂移（项目红线，见 `disposition-citation.ts` 对章标题的注释）。
 *
 * ## 为什么必须先跑这一轮
 *
 * §12 的结论是「给判法，不给例子」；三格条款是照那条结论写的，但**标记语法是新的**。
 * 标记一旦不被模型遵守，后面接审计、接回写全部白做，而且失败是静默的
 * （`format:'legacy'` 会让审计走「旧卡」分支，不报错）。
 *
 * ## 用法
 *
 *   node scripts/experiments/personality-card-v3-loop.mjs --model qwen3.5:9b-128k
 *   node scripts/experiments/personality-card-v3-loop.mjs --model nemotron-3.5-lightning:30b --runs 3
 *   node scripts/experiments/personality-card-v3-loop.mjs --dry        # 只打印 prompt
 *
 * 产物：`scripts/experiments/out/personality-v3-<model>.jsonl`
 */
import fs from 'node:fs'
import path from 'node:path'

const ARGS = process.argv.slice(2)
const arg = (name, fallback) => (ARGS.includes(name) ? ARGS[ARGS.indexOf(name) + 1] : fallback)
const MODEL = arg('--model', 'qwen3.5:9b-128k')
const RUNS = Number(arg('--runs', '3'))
const ONLY_CASE = arg('--case', null) ? Number(arg('--case')) : null
const DRY = ARGS.includes('--dry')
const OUT_DIR = path.join(process.cwd(), 'scripts', 'experiments', 'out')
const OUT_FILE = path.join(OUT_DIR, `personality-v3-${MODEL.replace(/[^a-z0-9.]/gi, '')}.jsonl`)

/**
 * 三个前提，各自承担一个验证目标：
 * - 1 散修查账：筹码丰不丰，测「能不能按名字落地」
 * - 2 边关守卒：与 1 倾向相反，测「两前提会不会写出同一张卡」
 * - 3 荒野光棍：**故意没有可失去的东西**，测「筹码允许为空」会不会被模型强行填满
 */
const CASES = [
  {
    id: 1,
    label: '散修查账（自保·算）',
    context: `【故事前提】一个资源匮乏的修行世界。底层修士靠替门派查账、辨伪契据换取修炼资源；账目即权力，写错一笔可能要命。
【主角档案】主角自幼被家族撇清，靠替人核算账目活下来，对数字和条文极敏感，极度自保，不信口头承诺。`,
  },
  {
    id: 2,
    label: '边关守卒（护人·莽）',
    context: `【故事前提】边关小城年年被围，守军靠轮换与屯田撑着；城破过一次，活下来的人至今记得。
【主角档案】主角是守城队里最年轻的一个，力气大、反应快、识字不多，答应过带他入队的老兵要守住这道墙。`,
  },
  {
    id: 3,
    label: '荒野光棍（无可失去）',
    context: `【故事前提】末世之后的荒野，秩序没重建起来。人靠拾荒和换命活着，谁欠了谁当场结清。
【主角档案】主角一个人从废墟里长起来，不知道父母是谁，也没有固定的同伴。他不怕死，因为他没什么可失去的；他也不急着活，因为他没想过要活成什么样。`,
  },
]

/** 被测条款：三格。**只给判法，不给例句** —— 给了例句就会被逐字抄成内容（§12 实测）。 */
const SPEC = `【主角的三格（只写 role 为 protagonist 的那一条，其余角色不套此格式）】
性格不是形容词清单。只写他会怎么动，而且要能让别人在另一章里一眼认出这是同一个人。

一【禁区】1–3 条，不可空。每条单独一行，以 X1、X2… 开头（编号只是条目号，不代表轻重）。
- 判法：说得出「他宁可输、宁可死，也不用这种办法」。
- 写的是他不肯做什么，不是他常做什么，也不是他擅长什么。
- 禁区不是道德底线：恶人同样有，而且往往更硬 —— 那是他唯一的自我认同。
- 相邻两条之间，要能构造出一个他必须选一个的场面。
- 三条是上限。凑不满就写两条；编一条来补位，比少一条更糟。

二【筹码】0–5 条，可空、可换。每条单独一行：先写那样东西叫什么，再接一句话说清它为什么能拿住他。
- 判法：说得出「谁拿走了这个，他就得让步」。
- 必须能在上面那段材料原文里指出是哪一样具体东西、哪一个人；指不出来的，那是你替作者编的设定，不许写。
- 材料里的比喻不能当物件：档案说"恩和仇分两本账记"，讲的是他记账的习惯，不等于他真有一本账册。
- 一条都没有是正常状态 —— 光脚的人不怕被拿走东西。
- 这里写的不是「他拥有的东西」，是「别人能拿走、拿走他就得让步」的那些。

三【处境】材料已经给定的开场截面：他站在哪、手上有什么、被什么卡住。每行以 given 开头。
- 这一格只描述第 1 章之前，不写他后来怎么变。
- 只写材料里有的，不许补。

【不一致的分寸】
禁区上的行为必须始终一致；两处对不上，就是崩人设。
筹码会变、会丢、会被换掉 —— 那些是情节的事，不用在这里写死。

【输出形状】只输出上面这三段。段标记（【禁区】【筹码】【处境】）各占一行，不要标题、不要解释、不要 JSON、不要代码块。`

function buildMessages(context) {
  return [
    {
      role: 'system',
      content: '你在为一部小说补全主角的角色卡。只输出 personality 字段的内容，不要 JSON、不要解释、不要标题。',
    },
    {
      role: 'user',
      content: `【故事上下文】\n${context}\n\n${SPEC}\n\n现在按上面的格式，写出这个主角的三格。`,
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
      options: {
        temperature: 0.2,
        seed,
        num_predict: 1200,
        // 模型自带 presence_penalty 会强行惩罚重复用词，是前几轮不稳定的主因，必须归零。
        presence_penalty: 0,
        num_ctx: 8192,
      },
    }),
  })
  const json = await res.json()
  return { text: json.message?.content ?? '', ms: Date.now() - t0, evalCount: json.eval_count ?? 0 }
}

const picks = CASES.filter(item => !ONLY_CASE || item.id === ONLY_CASE)

if (DRY) {
  for (const item of picks) {
    console.log(`\n===== case ${item.id} ${item.label} =====\n`)
    console.log(buildMessages(item.context)[1].content)
  }
  process.exit(0)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const record = (row) => fs.appendFileSync(OUT_FILE, `${JSON.stringify(row)}\n`, 'utf8')

console.log(`model=${MODEL} runs=${RUNS} cases=${picks.map(item => item.id).join(',')}`)
console.log(`out=${path.relative(process.cwd(), OUT_FILE)}`)

let done = 0
for (const item of picks) {
  for (let run = 1; run <= RUNS; run += 1) {
    const seed = 1000 + item.id * 100 + run
    try {
      const result = await chat(buildMessages(item.context), seed)
      record({ model: MODEL, caseId: item.id, label: item.label, run, seed, ms: result.ms, evalCount: result.evalCount, personality: result.text.trim() })
      done += 1
      console.log(`  case ${item.id} run ${run} ok (${result.ms}ms, ${result.text.length} chars)`)
    } catch (error) {
      record({ model: MODEL, caseId: item.id, label: item.label, run, seed, error: String(error), personality: '' })
      console.log(`  case ${item.id} run ${run} FAILED: ${String(error)}`)
    }
  }
}
console.log(`\nwrote ${done}/${picks.length * RUNS} rows to ${OUT_FILE}`)
