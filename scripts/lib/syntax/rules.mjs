/**
 * S1 句法体检器件的规则表（十类 A–J）。
 *
 * 三条口径（与 `.batch/night/reports/s1-syntax-check-design-20261127.md` §1 一致）：
 *  - 单位 = 汉字/词/可见码位（口径同 `src/shared/draft-units.ts:62-72` 的 countDraftUnits）；
 *  - 断句 = 复刻 `src/shared/prose-shape.ts:115` 的 SENTENCE_PATTERN（`.mjs` 无法 import `.ts`，
 *    这是本仓唯一允许的第二份，改动必须两边同步）；
 *  - 对白 = 句中含任一引号（`「『“"”`）。语料里出现过反写闭引号，故 `”` 一并算对白标记。
 *
 * 只检不生成：这里没有任何模型调用，也没有任何批语原句。
 */

export const RULESET_VERSION = '1.0.0'

/** 同 `src/shared/prose-shape.ts:115`。 */
export const SENTENCE_PATTERN = /[^。！？…；!?;]+[。！？…；!?;]*/gu

const HAN_PATTERN = /\p{Script=Han}/gu
const WORD_PATTERN = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}[\p{L}\p{M}]*)*/gu
const WHITESPACE_OR_PUNCTUATION_OR_SYMBOL = /[\s\p{P}\p{S}]/gu
const DIALOGUE_MARKER = /[「『“"”]/
const HAN_ONLY_RUN = /\p{Script=Han}+/gu

/** 同 `countDraftUnits`：汉字、Unicode 词、其余可见码位各计一；空白/标点/符号不计。 */
export function countUnits(text) {
  const normalized = text.normalize('NFC')
  const han = normalized.match(HAN_PATTERN)?.length ?? 0
  const withoutHan = normalized.replace(HAN_PATTERN, ' ')
  const words = withoutHan.match(WORD_PATTERN)?.length ?? 0
  const others = [...withoutHan
    .replace(WORD_PATTERN, '')
    .replace(WHITESPACE_OR_PUNCTUATION_OR_SYMBOL, '')]
    .length
  return han + words + others
}

/**
 * 把正文切成句，带行号、列号与绝对偏移（偏移用于回看前 300 字）。
 * 返回 { sentences, units }，units = 全文可见单位数。
 */
export function analyzeSentences(text) {
  const sentences = []
  const lines = text.split(/\r?\n/)
  let lineOffset = 0
  for (const [index, line] of lines.entries()) {
    const pattern = new RegExp(SENTENCE_PATTERN.source, 'gu')
    let match
    while ((match = pattern.exec(line)) !== null) {
      const raw = match[0]
      const leading = raw.length - raw.trimStart().length
      const trimmed = raw.trim()
      if (trimmed === '') continue
      // 断句正则会把收尾的闭引号单独切出来（"…”），零单位残片不算句，否则 B2 会重复计数。
      const units = countUnits(trimmed)
      if (units === 0) continue
      sentences.push({
        text: trimmed,
        lineNo: index + 1,
        col: match.index + leading + 1,
        start: lineOffset + match.index + leading,
        end: lineOffset + match.index + leading + trimmed.length,
        units,
        narrative: !DIALOGUE_MARKER.test(trimmed),
      })
    }
    lineOffset += line.length + 1
  }
  return { sentences, units: countUnits(text) }
}

function excerpt(text) {
  return countUnits(text) <= 80 ? text : `${text.slice(0, 160)}…`
}

function hit(ctx, sentenceIndex, category, confidence, hint, requires = null) {
  const sentence = ctx.sentences[sentenceIndex]
  return {
    category,
    confidence,
    sentenceIndex,
    line_no: sentence.lineNo,
    col: sentence.col,
    sentence: excerpt(sentence.text),
    hint,
    requires,
  }
}

function sentenceIndexAt(ctx, offset) {
  return ctx.sentences.findIndex(item => item.start <= offset && offset < item.end)
}

/** A2 的句末悬空功能词（设计件 §1 A 的清单原样）。 */
const A2_DANGLING_WORDS = [
  '跟着', '把', '被', '让', '给', '从', '向', '往', '跟', '和', '与', '在', '就', '也',
  '还', '却', '才', '都', '又', '为', '对', '朝', '沿', '顺', '等', '要是', '既然',
]

/** B1/B2 的状语/补语外壳标记。 */
const B_SHELL_MARKERS = ['了', '着', '过', '在', '往', '向', '里', '上', '下', '得', '地', '，']

/** F 的称谓排除表（v1 十四条：自称类四条 + 实测误报十条，来源见说明件 §F）。 */
const F_EXCLUSIONS = [
  '老身', '老朽', '老夫', '老子',
  '老眼', '老规矩', '老账', '老派', '老教主', '老齐', '老就', '老写', '老教', '老鼠',
]

/** 常见姓（只用于「老+姓」「姓+称谓」两项称谓形态，不是分词器）。 */
const SURNAMES = new Set([
  ...'赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳唐薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧',
])

/**
 * F 的引入动作词。设计件的 300 字窗口里若塞进裸「是」，几乎恒真、F 永不命中，
 * 故只留结构性引入词（含「便是/正是」，不含单字「是」）。
 */
const F_INTRO_MARKERS = ['叫', '走进', '跟着', '身后', '旁边', '身边', '来了', '便是', '正是', '喊', '见过']

/** C1 复现片段的起始字排除表（虚词/代词开头的不算候选）。 */
const C1_STOP_CHARS = new Set([
  ...'的了着过是在有和与或而而且便才只把被给让从向对往于他她它我你您这那其之一个们不也都就又还',
  '，', '。',
])

/** D1 的比喻标记与落点收尾词。 */
const D_METAPHOR_MARKERS = ['像', '如', '似', '仿佛', '宛如', '犹如']
const D_LANDING_WORDS = ['一样', '似的', '般', '那样']

/** A1：极短句（≤4）紧跟长句（≥15）。 */
export function a1(ctx) {
  const hits = []
  for (let index = 1; index < ctx.sentences.length; index += 1) {
    const sentence = ctx.sentences[index]
    if (sentence.units <= 4 && ctx.sentences[index - 1].units >= 15) {
      hits.push(hit(ctx, index, 'A', 0.4, `A1:units=${sentence.units} prev=${ctx.sentences[index - 1].units}`))
    }
  }
  return hits
}

/** A2：句体（去尾部标点）以悬空功能词结尾。 */
export function a2(ctx) {
  const hits = []
  ctx.sentences.forEach((sentence, index) => {
    const body = sentence.text.replace(/[。！？…；!?;\s]+$/u, '')
    if (A2_DANGLING_WORDS.some(word => body.endsWith(word))) {
      hits.push(hit(ctx, index, 'A', 0.5, `A2:ends=${body.slice(-3)}`))
    }
  })
  return hits
}

/** A3：叙述句 ≤2 字。 */
export function a3(ctx) {
  const hits = []
  ctx.sentences.forEach((sentence, index) => {
    if (sentence.narrative && sentence.units <= 2) {
      hits.push(hit(ctx, index, 'A', 0.3, `A3:units=${sentence.units}`))
    }
  })
  return hits
}

/** B1：叙述句 2–6 字且无状语外壳。 */
export function b1(ctx) {
  const hits = []
  ctx.sentences.forEach((sentence, index) => {
    if (!sentence.narrative) return
    if (sentence.units < 2 || sentence.units > 6) return
    if (B_SHELL_MARKERS.some(marker => sentence.text.includes(marker))) return
    hits.push(hit(ctx, index, 'B', 0.3, `B1:units=${sentence.units}`))
  })
  return hits
}

/** B2：对白句 ≤5 字且无状语外壳。 */
export function b2(ctx) {
  const hits = []
  ctx.sentences.forEach((sentence, index) => {
    if (sentence.narrative) return
    if (sentence.units > 5) return
    if (B_SHELL_MARKERS.some(marker => sentence.text.includes(marker))) return
    hits.push(hit(ctx, index, 'B', 0.35, `B2:units=${sentence.units}`))
  })
  return hits
}

/** C1：章内 2–4 字中文片段出现 ≥3 次，取次数最高 4 个。 */
export function c1(ctx) {
  const counts = new Map()
  const runs = ctx.text.normalize('NFC').match(new RegExp(HAN_ONLY_RUN.source, 'gu')) ?? []
  for (const run of runs) {
    for (let length = 2; length <= 4; length += 1) {
      for (let index = 0; index + length <= run.length; index += 1) {
        const gram = run.slice(index, index + length)
        if (C1_STOP_CHARS.has(gram[0])) continue
        counts.set(gram, (counts.get(gram) ?? 0) + 1)
      }
    }
  }
  const candidates = [...counts]
    .filter(([, count]) => count >= 3)
    .sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1))
    .slice(0, 4)
  const hits = []
  for (const [gram, count] of candidates) {
    const index = sentenceIndexAt(ctx, ctx.text.indexOf(gram))
    if (index < 0) continue
    hits.push(hit(ctx, index, 'C', 0.3, `C1:gram=${gram} count=${count}`))
  }
  return hits
}

/** D1：含比喻标记、≤14 字、无落点收尾。 */
export function d1(ctx) {
  const hits = []
  ctx.sentences.forEach((sentence, index) => {
    if (!D_METAPHOR_MARKERS.some(marker => sentence.text.includes(marker))) return
    if (sentence.units > 14) return
    if (D_LANDING_WORDS.some(word => sentence.text.includes(word))) return
    hits.push(hit(ctx, index, 'D', 0.3, `D1:units=${sentence.units}`))
  })
  return hits
}

/** F1：称谓首现前 300 字内无同词复现、无引入动作词（章首 200 字内不报）。 */
export function f1(ctx) {
  const exclusions = new Set([...F_EXCLUSIONS, ...(ctx.exclusions ?? [])])
  const patterns = [/老(\p{Script=Han})/gu, /(\p{Script=Han})(?:执事|师兄|师侄|管事|掌柜)/gu]
  const firstOffsets = new Map()
  for (const source of patterns) {
    const regex = new RegExp(source.source, 'gu')
    let match
    while ((match = regex.exec(ctx.text)) !== null) {
      // 只有「姓」才可能是称谓：「老师」「老眼」「跟执事」这类靠首字过滤掉。
      if (!SURNAMES.has(match[1])) continue
      const word = match[0]
      if (exclusions.has(word)) continue
      const offset = match.index
      if (offset < 200 || firstOffsets.has(word)) continue
      const lookback = ctx.text.slice(Math.max(0, offset - 300), offset)
      if (F_INTRO_MARKERS.some(marker => lookback.includes(marker))) continue
      firstOffsets.set(word, offset)
    }
  }
  const hits = []
  for (const [word, offset] of firstOffsets) {
    const index = sentenceIndexAt(ctx, offset)
    if (index < 0) continue
    hits.push(hit(ctx, index, 'F', 0.5, `F1:term=${word}`))
  }
  return hits
}

/** G1：系统腔词表命中（默认零词表，由 --phrases 加载）。 */
export function g1(ctx) {
  const hits = []
  for (const phrase of ctx.phrases?.G ?? []) {
    ctx.sentences.forEach((sentence, index) => {
      if (sentence.text.includes(phrase)) {
        hits.push(hit(ctx, index, 'G', 0.3, `G1:phrase=${phrase}`, 'setting-domain'))
      }
    })
  }
  return hits
}

/** H1：套路词组逐条计数（默认零词表，由 --phrases 加载）。 */
export function h1(ctx) {
  const hits = []
  for (const phrase of ctx.phrases?.H ?? []) {
    ctx.sentences.forEach((sentence, index) => {
      const count = sentence.text.split(phrase).length - 1
      for (let occurrence = 0; occurrence < count; occurrence += 1) {
        hits.push(hit(ctx, index, 'H', 0.9, `H1:phrase=${phrase} count=${count}`))
      }
    })
  }
  return hits
}

/**
 * 十类规则表。`tier` 是**设计口径**；`--stats` 若实测不过误报闸门，运行时会降为 report。
 * `evidence` 一句话写依据（都指设计件实测表，不写「可能/大概」）。
 */
export const RULES = [
  { id: 'A1', category: 'A', tier: 'report', evidence: '极短句紧跟长句：句号落在不该断的地方（逐章区间重叠，只作清单）', impl: a1 },
  { id: 'A2', category: 'A', tier: 'report', evidence: '句末悬空功能词：句体停在连接词上，是「断在半句」的可检形态', impl: a2 },
  { id: 'A3', category: 'A', tier: 'report', evidence: '叙述句 ≤2 字：单字成句，与「断句切碎」同源（只出读数，不作判定）', impl: a3 },
  { id: 'B1', category: 'B', tier: 'report', evidence: '裸短叙述句 2–6 字且无状语外壳：主谓宾极简（逐章不判，仅语料级聚合可判）', impl: b1 },
  { id: 'B2', category: 'B', tier: 'report', evidence: '裸短对白 ≤5 字且无状语外壳：同上，对白子规则', impl: b2 },
  { id: 'C1', category: 'C', tier: 'report', evidence: '章内 2–4 字片段高频复现：清单式描写的旁证（实测比 1.00，零区分度）', impl: c1 },
  { id: 'D1', category: 'D', tier: 'report', evidence: '比喻标记出现但极短且无落点：残缺比喻的唯一可检形态', impl: d1 },
  { id: 'F1', category: 'F', tier: 'verdict', evidence: '称谓首现前 300 字无同词复现、无引入动作：凭空冒出（本卡语料名家 0 / 生成 5）', impl: f1 },
  { id: 'G1', category: 'G', tier: 'report', evidence: '系统腔词表命中：设定域无法自动判，必须人审（requires=setting-domain）', impl: g1 },
  { id: 'H1', category: 'H', tier: 'verdict', evidence: '套路词组按篇计数：主人点名的高置信提示（本卡语料 v2 词表名家 0 / 生成 17）', impl: h1 },
]

/** 纯规则抓不到的三类，只留 schema 占位，不建空规则。 */
export const UNSUPPORTED = [
  { category: 'E', reason: 'needs-spatial-model' },
  { category: 'I', reason: 'needs-event-graph' },
  { category: 'J', reason: 'needs-syntax' },
]

/** 跑全部规则；`categories` 可限子集（如只跑判定项）。 */
export function runRules(ctx, categories = null) {
  const hits = []
  for (const rule of RULES) {
    if (categories && !categories.includes(rule.category)) continue
    hits.push(...rule.impl(ctx))
  }
  return hits
}

/** A 类读数（只报数，不产 violation）：叙述句均长 / P50 / ≤5 字占比。 */
export function narrativeReadings(sentences) {
  const units = sentences.filter(sentence => sentence.narrative).map(sentence => sentence.units)
  if (units.length === 0) return { mean: 0, p50: 0, shortRatio: 0, count: 0 }
  const sorted = [...units].sort((left, right) => left - right)
  const mean = units.reduce((sum, value) => sum + value, 0) / units.length
  const short = units.filter(value => value <= 5).length
  return {
    mean: Math.round(mean * 100) / 100,
    p50: sorted[Math.floor((sorted.length - 1) / 2)],
    shortRatio: Math.round((short / units.length) * 1000) / 1000,
    count: units.length,
  }
}

/** 文本归一化：NFC → 去全部空白与标点符号（含引号、破折号、省略号）。 */
export function normalizeForMatch(text) {
  return text.normalize('NFC').replace(WHITESPACE_OR_PUNCTUATION_OR_SYMBOL, '')
}
