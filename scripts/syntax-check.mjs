#!/usr/bin/env node
/**
 * S1 句法体检器件 · CLI（只检不生成，纯规则、确定性、零新依赖）。
 *
 * 用法：
 *   node scripts/syntax-check.mjs <path...> [--json] [--stats]
 *                               [--phrases <json>] [--extract-rejects <out.json>]
 *
 * 退出码：0 正常完成（有无命中都 0，测量仪不阻断）；2 参数/输入/词表错误。
 * 语料纪律：反例库只能写到 `.runtime/` 下，其它目标直接拒写；语料原句只经 stdout 流出。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createHash } from 'node:crypto'
import {
  RULES,
  RULESET_VERSION,
  UNSUPPORTED,
  analyzeSentences,
  narrativeReadings,
  normalizeForMatch,
  runRules,
} from './lib/syntax/rules.mjs'
import { extractRejects, loadArms, parseInputs, scoreCoverage } from './lib/syntax/corpus.mjs'
import { evaluateGate, tierOf } from './lib/syntax/gate.mjs'

const COVERAGE_RANGE = ['A', 'B', 'H', 'F']
const USAGE = 'node scripts/syntax-check.mjs <path...> [--json] [--stats] [--phrases <json>] [--extract-rejects <out.json>]'

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(2)
}

function parseArgs(argv) {
  const paths = []
  const flags = { json: false, stats: false, phrases: null, extractRejects: null }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--json') flags.json = true
    else if (argument === '--stats') flags.stats = true
    else if (argument === '--phrases' || argument === '--extract-rejects') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`missing value for ${argument}\n用法：${USAGE}`)
      index += 1
      if (argument === '--phrases') flags.phrases = value
      else flags.extractRejects = value
    } else if (argument.startsWith('--')) {
      fail(`unknown option: ${argument}\n用法：${USAGE}`)
    } else {
      paths.push(argument)
    }
  }
  if (paths.length === 0) fail(`至少给一个输入路径\n用法：${USAGE}`)
  return { paths, flags }
}

function relativePath(filePath) {
  return path.relative(process.cwd(), path.resolve(filePath)).split(path.sep).join('/')
}

function loadPhraseTable(filePath) {
  if (!fs.existsSync(filePath)) fail(`phrase table not found: ${filePath}`)
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    fail(`phrase table is not valid JSON: ${filePath}`)
  }
  const entries = { H: [], G: [] }
  for (const category of ['H', 'G']) {
    const list = parsed?.[category] ?? []
    if (!Array.isArray(list) || list.some(item => typeof item !== 'string' || item === '')) {
      fail(`phrase table category ${category} must be an array of non-empty strings`)
    }
    entries[category] = [...list]
  }
  return { version: typeof parsed?.version === 'string' ? parsed.version : null, entries }
}

function readInput(filePath, phraseEntries) {
  if (!fs.existsSync(filePath)) fail(`input not found: ${filePath}`)
  const text = fs.readFileSync(filePath, 'utf8').normalize('NFC')
  const sourcePath = relativePath(filePath)
  const arms = loadArms(path.resolve(filePath))
  const parsed = parseInputs(sourcePath, text)
  const chapters = []
  for (const input of parsed) {
    const { sentences, units } = analyzeSentences(input.text)
    const context = { text: input.text, sentences, phrases: phraseEntries }
    const hits = runRules(context).map(item => ({ ...item, inputId: input.id }))
    chapters.push({
      id: input.id,
      arm: arms?.get(input.id) ?? null,
      units,
      sentences,
      hits,
      readings: narrativeReadings(sentences),
      commentLines: input.commentLines,
    })
  }
  return { sourcePath, arms, chapters }
}

// 误报闸门与 tier 裁定见 `scripts/lib/syntax/gate.mjs`（evaluateGate / tierOf）。

function buildDocument(results, phraseTable, gate) {
  const inputs = []
  const hits = []
  const readings = []
  for (const result of results) {
    for (const chapter of result.chapters) {
      inputs.push({
        source_path: result.sourcePath,
        id: chapter.id,
        arm: chapter.arm,
        chars: chapter.units,
        sentences: chapter.sentences.length,
      })
      const density = {}
      for (const category of [...new Set(RULES.map(rule => rule.category))].sort()) {
        const count = chapter.hits.filter(hit => hit.category === category).length
        density[category] = chapter.units === 0 ? 0 : Math.round((count / chapter.units) * 1000 * 1000) / 1000
      }
      readings.push({
        source_path: result.sourcePath,
        id: chapter.id,
        narrativeSentenceUnitsMean: chapter.readings.mean,
        narrativeSentenceUnitsP50: chapter.readings.p50,
        shortSentenceRatio: chapter.readings.shortRatio,
        categoryDensityPer1k: density,
      })
      for (const chapterHit of chapter.hits) {
        hits.push({
          source_path: result.sourcePath,
          id: chapter.id,
          arm: chapter.arm,
          line_no: chapterHit.line_no,
          col: chapterHit.col,
          category: chapterHit.category,
          tier: tierOf(chapterHit.category, gate),
          confidence: chapterHit.confidence,
          sentence: chapterHit.sentence,
          hint: chapterHit.hint,
          requires: chapterHit.requires,
        })
      }
    }
  }
  hits.sort((left, right) => compare(left.source_path, right.source_path)
    || left.line_no - right.line_no
    || left.col - right.col
    || compare(left.category, right.category))
  return {
    schemaVersion: 1,
    tool: {
      name: 'syntax-check',
      version: RULESET_VERSION,
      phrasesVersion: phraseTable?.version ?? null,
      ruleIds: RULES.map(rule => rule.id),
    },
    inputs,
    hits,
    readings,
    unsupported: UNSUPPORTED,
  }
}

function compare(left, right) {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function printStats(results, gate, phraseTable, out = text => process.stdout.write(text)) {
  const lines = []
  const items = results.flatMap(result => extractRejects(
    result.chapters.map(chapter => ({ id: chapter.id, commentLines: chapter.commentLines })),
  ))
  const countable = items.filter(item => item.countable).length
  const total = items.length
  const verdictCategories = new Set(
    [...new Set(RULES.map(rule => rule.category))]
      .filter(category => tierOf(category, gate) === 'verdict'),
  )
  const hitsByChapter = new Map()
  const sentencesByChapter = new Map()
  for (const result of results) {
    for (const chapter of result.chapters) {
      hitsByChapter.set(chapter.id, chapter.hits)
      sentencesByChapter.set(chapter.id, chapter.sentences)
    }
  }
  const hitsInRange = [...hitsByChapter].map(([id, chapterHits]) => [
    id,
    chapterHits.filter(hit => COVERAGE_RANGE.includes(hit.category)),
  ])
  const coverage = scoreCoverage(items, new Map(hitsInRange), sentencesByChapter,
    new Set([...verdictCategories].filter(category => COVERAGE_RANGE.includes(category))))
  lines.push(`covered=${coverage.covered}/${countable} (readings only, range=A/B/H/F)`)
  lines.push(`verdict_covered=${coverage.verdictCovered}/${countable}`)
  lines.push(`denominator: T=${countable} (${total} quoted fragments - ${total - countable} summary-only, non-countable)`)
  if (!phraseTable) lines.push('H: disabled (no phrase table)')

  if (gate.hasArms) {
    lines.push('')
    lines.push('arm totals:')
    const humanChars = gate.humanChars
    const aiChars = gate.aiChars
    lines.push(`  human: chars=${humanChars}`)
    lines.push(`  ai: chars=${aiChars}`)
    lines.push('category  human/1k  ai/1k  gate  tier')
    for (const [category, decision] of [...gate.decisions].sort((left, right) => compare(left[0], right[0]))) {
      lines.push(`  ${category}        ${decision.humanPer1k}      ${decision.aiPer1k}   `
        + `${decision.passes ? 'pass' : 'FAIL'}  ${decision.tier}`)
    }
    lines.push('')
    lines.push('per-chapter counts (verdict categories and A/B readings):')
    for (const result of results) {
      for (const chapter of result.chapters) {
        const counts = ['A', 'B', 'H', 'F']
          .map(category => `${category}=${chapter.hits.filter(hit => hit.category === category).length}`)
          .join(' ')
        lines.push(`  ${chapter.id} arm=${chapter.arm ?? 'null'} units=${chapter.units} ${counts}`)
      }
    }
  } else {
    lines.push('')
    lines.push('arm gate: skipped (no arm labels next to the input)')
  }
  const text = `${lines.join('\n')}\n`
  out(text)
  for (const warning of gate.warnings) process.stderr.write(`${warning}\n`)
}

function extractPathGuard(filePath) {
  const resolved = path.resolve(filePath)
  const relative = path.relative(process.cwd(), resolved).split(path.sep).join('/')
  if (!(relative === '.runtime' || relative.startsWith('.runtime/'))) {
    fail(`refusing to write outside .runtime: ${relative}（语料纪律：反例库只能落 .runtime/）`)
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  return resolved
}

function main() {
  const { paths, flags } = parseArgs(process.argv.slice(2))
  const phraseTable = flags.phrases ? loadPhraseTable(flags.phrases) : null
  const results = paths.map(filePath => readInput(filePath, phraseTable?.entries ?? { H: [], G: [] }))
  const gate = evaluateGate(results.flatMap(result => result.chapters))

  if (flags.extractRejects) {
    const target = extractPathGuard(flags.extractRejects)
    const items = []
    for (const result of results) {
      const chapterComments = result.chapters.map(chapter => ({
        id: chapter.id,
        commentLines: chapter.commentLines,
      }))
      const armOf = new Map(result.chapters.map(chapter => [chapter.id, chapter.arm]))
      for (const item of extractRejects(chapterComments)) {
        items.push({ ...item, arm: armOf.get(item.chapter) ?? null, normalized: normalizeForMatch(item.text) })
      }
    }
    const sourceSha256 = createHash('sha256')
      .update(fs.readFileSync(path.resolve(paths[0])))
      .digest('hex')
    const payload = {
      version: 'v1',
      source: relativePath(paths[0]),
      sourceSha256,
      denominator: {
        fragments: items.length,
        countable: items.filter(item => item.countable).length,
      },
      items,
    }
    fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    process.stdout.write(`rejects written: ${relativePath(flags.extractRejects)} `
      + `fragments=${payload.denominator.fragments} countable=${payload.denominator.countable}\n`)
  }

  if (flags.json) {
    const document = buildDocument(results, phraseTable, gate)
    const render = `${JSON.stringify(document, null, 2)}\n`
    if (!listIsSorted(document.hits)) fail('internal: hits are not sorted')
    process.stdout.write(render)
    if (flags.stats) printStats(results, gate, phraseTable, text => process.stderr.write(text))
    return
  }

  if (flags.stats) {
    printStats(results, gate, phraseTable)
    return
  }

  const document = buildDocument(results, phraseTable, gate)
  const humanReadable = document.hits
    .map(hit => `${hit.source_path}:${hit.line_no}:${hit.col} [${hit.category}/${hit.tier}] ${hit.hint}`)
  process.stdout.write(`${humanReadable.join('\n')}${humanReadable.length > 0 ? '\n' : ''}`)
  process.stdout.write(`hits=${document.hits.length} inputs=${document.inputs.length}\n`)
}

function listIsSorted(hits) {
  for (let index = 1; index < hits.length; index += 1) {
    const previous = hits[index - 1]
    const current = hits[index]
    const key = item => [item.source_path, item.line_no, item.col, item.category]
    const left = key(previous)
    const right = key(current)
    for (let part = 0; part < left.length; part += 1) {
      if (left[part] === right[part]) continue
      const ordered = typeof left[part] === 'number'
        ? left[part] < right[part]
        : compare(left[part], right[part]) < 0
      if (!ordered) return false
      break
    }
  }
  return true
}

main()
