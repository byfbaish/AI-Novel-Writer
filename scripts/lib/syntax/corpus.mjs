/**
 * 盲评语料的解析与反例库抽取（确定性，无模型调用）。
 *
 * 只读 `.runtime/` 下的语料；本模块不写任何文件，语料原句只经 stdout 流出，不入库。
 * 章节正文与批语行按「同一份行号」切：批语行与分隔线在正文里被置空，
 * 因此 `analyzeSentences` 出来的行号就是文件里的真实行号。
 */

import fs from 'node:fs'
import path from 'node:path'
import { normalizeForMatch } from './rules.mjs'

const CHAPTER_HEADING = /^##\s+(P\d\d)\b/u
const COMMENT_LINE = /^-\s+/u
const ANSWER_LINE = /^-\s+Q\d/u
const SEPARATOR_LINE = /^---\s*$/u
const QUOTE_FRAGMENT = /[”“"]([^”“"]{4,120})[”“"]/gu

/** 读旁挂的 key 文件（`<corpus-stem>.key.json`，兼容 `<corpus>.key.json`）取每篇的臂标签；没有就返回 null。 */
export function loadArms(filePath) {
  const directory = path.dirname(filePath)
  const stem = path.basename(filePath).replace(/\.[^.]+$/u, '')
  const candidates = [path.join(directory, `${stem}.key.json`), `${filePath}.key.json`]
  const keyPath = candidates.find(candidate => fs.existsSync(candidate))
  if (!keyPath) return null
  const parsed = JSON.parse(fs.readFileSync(keyPath, 'utf8'))
  const arms = new Map()
  for (const item of parsed.items ?? []) {
    if (typeof item.id === 'string' && typeof item.arm === 'string') arms.set(item.id, item.arm)
  }
  return arms.size > 0 ? arms : null
}

/**
 * 解析一份文件。盲评格式（含 `## P\d\d`）按篇切；其它文件整份算一篇。
 * 返回 [{ id, text, commentLines: [{ lineNo, text }] }]。
 */
export function parseInputs(filePath, text) {
  const lines = text.split(/\r?\n/)
  const headings = []
  lines.forEach((line, index) => {
    const match = CHAPTER_HEADING.exec(line)
    if (match) headings.push({ id: match[1], lineNo: index + 1 })
  })
  if (headings.length === 0) {
    const id = filePath.split(/[\\/]/u).pop().replace(/\.[^.]+$/u, '')
    return [{ id, text, commentLines: [] }]
  }
  const inputs = []
  for (const [position, heading] of headings.entries()) {
    const endLine = position + 1 < headings.length ? headings[position + 1].lineNo : lines.length + 1
    const body = []
    const commentLines = []
    for (let lineNo = heading.lineNo; lineNo < endLine; lineNo += 1) {
      const line = lines[lineNo - 1] ?? ''
      const isComment = COMMENT_LINE.test(line)
      if (isComment && !ANSWER_LINE.test(line)) commentLines.push({ lineNo, text: line })
      const isStructural = isComment || SEPARATOR_LINE.test(line) || CHAPTER_HEADING.test(line)
      body.push(isStructural ? '' : line)
    }
    inputs.push({
      id: heading.id,
      text: `${'\n'.repeat(heading.lineNo - 1)}${body.join('\n')}`,
      commentLines,
    })
  }
  return inputs
}

/**
 * 从批语行抽反例库：一行可有多个引号片段；没有引号片段的综述行算 `countable: false`。
 * `categoryGuess` 只按形态提示词粗分，不参与召回判定。
 */
export function extractRejects(inputs) {
  const items = []
  for (const input of inputs) {
    for (const comment of input.commentLines) {
      const body = comment.text.replace(COMMENT_LINE, '')
      const quotes = [...body.matchAll(new RegExp(QUOTE_FRAGMENT.source, 'gu'))]
      const texts = quotes.length > 0 ? quotes.map(match => match[1]) : []
      if (texts.length === 0) {
        items.push({
          id: `${input.id}-L${comment.lineNo}-0`,
          chapter: input.id,
          lineNo: comment.lineNo,
          text: body,
          countable: false,
          categoryGuess: guessCategory(body),
        })
      } else {
        texts.forEach((fragment, index) => {
          items.push({
            id: `${input.id}-L${comment.lineNo}-${index + 1}`,
            chapter: input.id,
            lineNo: comment.lineNo,
            text: fragment,
            countable: true,
            categoryGuess: guessCategory(fragment),
          })
        })
      }
    }
  }
  return items
}

function guessCategory(text) {
  if (/断句|句号|断在半句|不该断/u.test(text)) return 'A'
  if (/四不像|简短|短句|省字|不咽/u.test(text)) return 'B'
  if (/冒出|哪里来|凭空/u.test(text)) return 'F'
  if (/比喻|像/u.test(text)) return 'D'
  if (/系统|预警|上限|额度/u.test(text)) return 'G'
  if (/信息量|信息密度|水字/u.test(text)) return 'I'
  return null
}

/**
 * 召回：一条反例被覆盖 ⇔ 命中句及其前后各一句拼接归一化后包含该片段（或反之）。
 * `verdictCategories` 决定哪些类的命中算「判定项覆盖」。
 */
export function scoreCoverage(items, hitsByChapter, sentencesByChapter, verdictCategories) {
  const windows = new Map()
  for (const [id, hits] of hitsByChapter) {
    const sentences = sentencesByChapter.get(id) ?? []
    const all = []
    const verdict = []
    const seen = new Set()
    for (const hit of hits) {
      const from = Math.max(0, hit.sentenceIndex - 1)
      const to = Math.min(sentences.length - 1, hit.sentenceIndex + 1)
      const key = `${hit.sentenceIndex}|${verdictCategories.has(hit.category) ? 'v' : 'r'}`
      if (seen.has(key)) continue
      seen.add(key)
      const window = normalizeForMatch(
        sentences.slice(from, to + 1).map(sentence => sentence.text).join('\n'),
      )
      all.push(window)
      if (verdictCategories.has(hit.category)) verdict.push(window)
    }
    windows.set(id, { all, verdict })
  }

  const countable = items.filter(item => item.countable)
  let covered = 0
  let verdictCovered = 0
  for (const item of countable) {
    const needle = normalizeForMatch(item.text)
    const bucket = windows.get(item.chapter) ?? { all: [], verdict: [] }
    if (hitsMatch(bucket.all, needle)) covered += 1
    if (hitsMatch(bucket.verdict, needle)) verdictCovered += 1
  }
  return { covered, verdictCovered, total: countable.length }
}

function hitsMatch(windows, needle) {
  return windows.some((window) => {
    if (window.includes(needle)) return true
    return needle.length > window.length && window.length >= 6 && needle.includes(window)
  })
}
