import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  RULES,
  UNSUPPORTED,
  a1,
  a2,
  a3,
  analyzeSentences,
  b1,
  b2,
  c1,
  countUnits,
  d1,
  f1,
  g1,
  h1,
  narrativeReadings,
  normalizeForMatch,
} from '../lib/syntax/rules.mjs'
import { evaluateGate, tierOf } from '../lib/syntax/gate.mjs'
import { extractRejects, parseInputs, scoreCoverage } from '../lib/syntax/corpus.mjs'

// 全部例句为自造，不含任何批语/语料原句。
const CLI = fileURLToPath(new URL('../syntax-check.mjs', import.meta.url))
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-check-test-'))

function ctxOf(text, phrases = { H: [], G: [] }) {
  const { sentences } = analyzeSentences(text)
  return { text, sentences, phrases }
}

afterAll(() => {
  fs.rmSync(temporaryRoot, { recursive: true, force: true })
})

describe('计数与断句口径', () => {
  it('中文单位只算汉字，标点与空白不计', () => {
    expect(countUnits('你好，世界。')).toBe(4)
    // 拉丁字母串按「词」计一个单位：'ab' 与 'c' 合计 2。
    expect(countUnits('  ab c  ')).toBe(2)
  })

  it('断句沿用 SENTENCE_PATTERN，行号与列号可指回原文', () => {
    const { sentences } = analyzeSentences('第一句。第二句！\n第三句？')
    expect(sentences.map(sentence => sentence.text)).toEqual(['第一句。', '第二句！', '第三句？'])
    expect(sentences[2].lineNo).toBe(2)
    expect(sentences[0].col).toBe(1)
  })

  it('含引导号即视为对白，其余算叙述', () => {
    const { sentences } = analyzeSentences('他点头。“走吧。”')
    expect(sentences[0].narrative).toBe(true)
    expect(sentences[1].narrative).toBe(false)
  })
})

describe('A/B/C/D 清单规则', () => {
  it('A1 抓极短句紧跟长句', () => {
    const ctx = ctxOf('风从巷口灌进来，把檐下的灯笼吹得来回打转。他停住。')
    const hits = a1(ctx)
    expect(hits).toHaveLength(1)
    expect(hits[0].category).toBe('A')
    expect(hits[0].confidence).toBe(0.4)
  })

  it('A2 抓句末悬空功能词，A3 抓单字叙述句', () => {
    expect(a2(ctxOf('他抬手，把。'))).toHaveLength(1)
    expect(a2(ctxOf('他把门关上。'))).toHaveLength(0)
    expect(a3(ctxOf('好。'))).toHaveLength(1)
    expect(a3(ctxOf('“好。”'))).toHaveLength(0)
  })

  it('B1 只对无外壳的裸短叙述句生效，B2 只管对白', () => {
    expect(b1(ctxOf('他点头。'))).toHaveLength(1)
    expect(b1(ctxOf('他点头了。'))).toHaveLength(0)
    expect(b2(ctxOf('“走。”'))).toHaveLength(1)
  })

  it('C1 只留章内高频复现的 2–4 字片段，最多四个候选', () => {
    const hits = c1(ctxOf('灵石在袋里。灵石很沉。又一块灵石。灵石压着腿。'))
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.length).toBeLessThanOrEqual(4)
    expect(hits[0].hint).toContain('count=4')
  })

  it('D1 抓「有比喻标记、极短、无落点」的残缺比喻', () => {
    expect(d1(ctxOf('像刀割。'))).toHaveLength(1)
    expect(d1(ctxOf('像刀割一样。'))).toHaveLength(0)
    expect(d1(ctxOf('他想起那年冬天在北边见过的雪，像刀割似的落在肩上。'))).toHaveLength(0)
  })
})

describe('F 称谓规则', () => {
  const padding = '山上的雾散得慢。'.repeat(30)

  it('姓+称谓首次出现且前 300 字无引入时报', () => {
    const hits = f1(ctxOf(`${padding}李执事把账本推开。`))
    expect(hits).toHaveLength(1)
    expect(hits[0].hint).toContain('term=李执事')
  })

  it('自称与普通名词靠姓表过滤，不报', () => {
    expect(f1(ctxOf(`${padding}老身不便多留。`))).toHaveLength(0)
    expect(f1(ctxOf(`${padding}老师站在门口。`))).toHaveLength(0)
    expect(f1(ctxOf(`${padding}跟执事房对线没好处。`))).toHaveLength(0)
    expect(f1(ctxOf(`${padding}他看见一只老鼠跑过去。`))).toHaveLength(0)
  })

  it('有引入动作词时不报；章首 200 字内不报', () => {
    expect(f1(ctxOf(`${padding}有人叫他老周。`))).toHaveLength(0)
    expect(f1(ctxOf('老周推门进来。'))).toHaveLength(0)
  })
})

describe('H/G 词表规则', () => {
  it('H 逐条计数，G 命中带 requires=setting-domain', () => {
    const hits = h1(ctxOf('他占位词条。', { H: ['占位词条'], G: [] }))
    expect(hits).toHaveLength(1)
    expect(hits[0].confidence).toBe(0.9)
    const twice = h1(ctxOf('他占位词条，占位词条。', { H: ['占位词条'], G: [] }))
    expect(twice).toHaveLength(2)
    const system = g1(ctxOf('额度已经超了。', { H: [], G: ['额度'] }))
    expect(system[0].requires).toBe('setting-domain')
  })

  it('词表为空时两条规则都零命中（默认骨架是零词表）', () => {
    expect(h1(ctxOf('他占位词条。'))).toHaveLength(0)
    expect(g1(ctxOf('额度已经超了。'))).toHaveLength(0)
  })
})

describe('读数与闸门', () => {
  it('A 类读数含均长、P50 与 ≤5 字占比', () => {
    const readings = narrativeReadings(analyzeSentences('他点头。风把门吹开了，檐下的灯笼撞在柱子上响了一下。').sentences)
    expect(readings.count).toBe(2)
    expect(readings.p50).toBeGreaterThan(0)
    expect(readings.shortRatio).toBe(0.5)
  })

  it('两臂密度不过 1/3 线即降 report 并产 WARN', () => {
    const gate = evaluateGate([
      { arm: 'human', units: 1000, hits: [{ category: 'H' }] },
      { arm: 'ai-baseline', units: 1000, hits: [{ category: 'H' }] },
    ])
    expect(gate.hasArms).toBe(true)
    expect(gate.decisions.get('H').passes).toBe(false)
    expect(tierOf('H', gate)).toBe('report')
    expect(gate.warnings[0]).toMatch(/^WARN: category H below false-positive gate \(human=1 ai=1\)$/)
  })

  it('过线时保持设计口径 tier；没有臂标签时按设计口径', () => {
    const gate = evaluateGate([
      { arm: 'human', units: 1000, hits: [] },
      { arm: 'ai-baseline', units: 1000, hits: [{ category: 'H' }, { category: 'H' }, { category: 'H' }] },
    ])
    expect(gate.decisions.get('H').passes).toBe(true)
    expect(tierOf('H', gate)).toBe('verdict')
    const noArms = evaluateGate([{ arm: null, units: 1000, hits: [{ category: 'H' }] }])
    expect(noArms.hasArms).toBe(false)
    expect(tierOf('H', noArms)).toBe('verdict')
    expect(tierOf('A', noArms)).toBe('report')
  })

  it('规则表与不落清单的字段齐全且类目一致', () => {
    for (const rule of RULES) {
      expect(typeof rule.id).toBe('string')
      expect('ABCDEFGHIJ').toContain(rule.category)
      expect(['verdict', 'report']).toContain(rule.tier)
      expect(rule.evidence.length).toBeGreaterThan(8)
      expect(typeof rule.impl).toBe('function')
    }
    expect(RULES.length).toBe(10)
    expect(UNSUPPORTED.map(item => item.category)).toEqual(['E', 'I', 'J'])
  })
})

describe('语料解析与召回', () => {
  const corpusText = [
    '# 自造对照',
    '',
    '## P01',
    '',
    '山上的雾散得慢，檐下的水一滴一滴砸在石阶上。',
    '他推门出来，看见院子里那棵老槐树。',
    '',
    '- Q1：　无',
    '- ”檐下的水一滴一滴砸在石阶上“，这句断得不对。',
    '',
    '## P02',
    '',
    '他占位词条。',
    '',
    '- Q1：　有',
    '- 整体画面感弱。',
  ].join('\n')

  it('按篇切分且行号与文件一致，批语只取被引片段', () => {
    const inputs = parseInputs('fixture.md', corpusText)
    expect(inputs.map(input => input.id)).toEqual(['P01', 'P02'])
    const items = extractRejects(inputs)
    expect(items).toHaveLength(2)
    expect(items.filter(item => item.countable)).toHaveLength(1)
    expect(items[0].chapter).toBe('P01')
  })

  it('命中句前后各一句归一化后包含片段即算覆盖', () => {
    const inputs = parseInputs('fixture.md', corpusText)
    const items = extractRejects(inputs)
    const sentences = new Map(inputs.map(input => [input.id, analyzeSentences(input.text).sentences]))
    const hits = new Map([[ 'P01', [{ sentenceIndex: 0, category: 'A' }] ], ['P02', []]])
    const coverage = scoreCoverage(items, hits, sentences, new Set(['H']))
    expect(coverage.total).toBe(1)
    expect(coverage.covered).toBe(1)
    expect(coverage.verdictCovered).toBe(0)
  })
})

describe('CLI 契约', () => {
  const fixtureDir = path.join(temporaryRoot, 'cli')
  fs.mkdirSync(fixtureDir, { recursive: true })
  const corpusPath = path.join(fixtureDir, 'fixture.md')
  fs.writeFileSync(corpusPath, [
    '## P01',
    '',
    '他推门出来，风把檐下的灯笼吹得打转。',
    '',
    '- Q1：　无',
    '- ”风把檐下的灯笼吹得打转“，这句不自然。',
    '',
    '## P02',
    '',
    '他占位词条。',
    '',
    '- Q1：　有',
    '- ”占位词条“，套路。',
  ].join('\n'), 'utf8')
  fs.writeFileSync(`${fixtureDir}/fixture.key.json`, JSON.stringify({
    items: [{ id: 'P01', arm: 'human' }, { id: 'P02', arm: 'ai-baseline' }],
  }, null, 2), 'utf8')
  const phrasesPath = path.join(fixtureDir, 'phrases.json')
  fs.writeFileSync(phrasesPath, JSON.stringify({ version: 'test', H: ['占位词条'], G: [] }), 'utf8')

  function run(args) {
    return spawnSync(process.execPath, [CLI, ...args], { cwd: fixtureDir, encoding: 'utf8' })
  }

  it('同一输入跑两次 --json 输出逐字节相同', () => {
    const first = run(['fixture.md', '--json', '--phrases', 'phrases.json'])
    const second = run(['fixture.md', '--json', '--phrases', 'phrases.json'])
    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(first.stdout).toBe(second.stdout)
    const document = JSON.parse(first.stdout)
    expect(document.schemaVersion).toBe(1)
    expect(document.tool.phrasesVersion).toBe('test')
    expect(document.unsupported.map(item => item.category)).toEqual(['E', 'I', 'J'])
  })

  it('没有 --phrases 时打 H: disabled 并把 H 移出判定集', () => {
    const result = run(['fixture.md', '--stats'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('H: disabled (no phrase table)')
    expect(result.stdout).toMatch(/denominator: T=2 \(2 quoted fragments - 0 summary-only, non-countable\)/)
    expect(result.stdout).not.toMatch(/verdict_covered=1/)
  })

  it('--extract-rejects 拒绝写成 .runtime/ 之外的路径', () => {
    const result = run(['fixture.md', '--extract-rejects', 'leak.json'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('refusing to write outside .runtime')
    expect(fs.existsSync(path.join(fixtureDir, 'leak.json'))).toBe(false)
  })

  it('未知参数与缺失输入都退出 2', () => {
    expect(run(['fixture.md', '--only', 'H,F']).status).toBe(2)
    expect(run(['missing.md', '--json']).status).toBe(2)
  })

  it('归一化只去空白与标点，保留汉字与字母', () => {
    expect(normalizeForMatch('他说：“走吧——快！”')).toBe('他说走吧快')
  })
})
