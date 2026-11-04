/* global process */
/**
 * A-1.1 基线测量：在既有 prose-shape 口径上扩 4 项 AI 味指标，对已定稿正文跑分布。
 *
 * ## 复用，不另造
 * - `src/shared/prose-shape.ts` 的 `measureProseShape`：既有三项（段长 ≤120 / 句长 ≤40 /
 *   对话占比 25%–40%）**只读取**它的 metrics / violations，不改源码、不改阈值
 *   （阈值在 prose-shape.ts:102-105，dialogueRatio 在 :270 只报数不判）。
 * - `src/shared/draft-units.ts` 的 `countDraftUnits`：全部字数与「每千字」归一化的同源计数。
 * - 两个 TS 模块用 esbuild 内存打包成 ESM 再 import —— 照抄
 *   `scripts/draft-generation-startup-acceptance.mjs:26-28` 与
 *   `scripts/check-prompt-wiring.mjs:141-149` 的既有做法，零新增依赖。
 * - 句子切分用 prose-shape.ts:115 的同一 `SENTENCE_PATTERN`（见下方注释）。
 *
 * ## 单章样本
 * `singleChapterSample: true` 是 prose-shape.ts:78-79 的既有结论（C8 / P8 复验 #3），
 * 不是可关掉的开关。本脚本只报分布与极值章号，**不判好坏、不给阈值**。
 *
 * ## 归因
 * 研究稿 §5 风险 3（`docs/research/2026-11-04-ai-flavor-measurement-and-intervention.md:113`）
 * 要求基线报告同时读上游产物；本脚本没有读，因此顶层固定输出 `attribution: "归因不清"`，
 * 任何分布差异都不得记到文风账上。
 *
 * ## 用法（工作目录 = 仓库根）
 *   node scripts/measure-ai-flavor-baseline.mjs
 *   node scripts/measure-ai-flavor-baseline.mjs --json
 *   node scripts/measure-ai-flavor-baseline.mjs --source <project.db 路径>
 *   node scripts/measure-ai-flavor-baseline.mjs --files <p1,p2,...> [--labels <l1,l2,...>]
 *        [--pairs <oldIdx:newIdx:chapter,...>] [--profile fanqie] [--json]
 *
 * ## --files 模式（把 A-1.1 口径复用到任意正文文本，不另造词表）
 * - 复用**同一个** `measureChapter()`、同一套词表常量（EXPLANATION_MARKERS /
 *   MENTAL_PREDICATE / CONNECTIVE_PATTERN / fourGramRepeat）、同一个
 *   `measureProseShape` 与 `countDraftUnits`；口径与阈值均未改动。
 * - `fs.readFileSync(..., 'utf8')` 只读打开输入，不复制、不写回；跳过项目库复制与
 *   better-sqlite3 加载（因此本模式不触发 ABI 分支）。有 BOM 时剥掉并在 JSON 里标记。
 * - `profileId` 默认 `fanqie`：批次 1 报告 §3.1 记录 `project_core.rhythm_profile='fanqie'`；
 *   且 prose-shape.ts:102-105 两档（qidian/fanqie）阈值同为 120/40。可用 `--profile` 覆盖；
 *   未知 id 会让 `measureProseShape` 返回 null（既有三项变 NA），**不猜**。
 * - `--labels` 与 `--files` 等长、逗号分隔；`--pairs` 用 0-based 索引声明「旧,新,章名」；
 *   不给 `--pairs` 时按相邻两两自动配对。差值一律 = 新 − 旧。
 * - 样本量小：`n=2 章/2 对，只作方向参考，不做显著性结论`；`归因不清：两版正文的生成参数、
 *   模型、模板版本均不同，不能把差异全记在模板上`。本模式**不产出 P95/基线分布**。
 *
 * 说明：better-sqlite3 是原生模块。当前工作区编译产物是 Node ABI 127，
 * 因此默认用裸 Node 跑；若切到 Electron ABI 145，则改用
 *   ELECTRON_RUN_AS_NODE=1 <electron.exe> scripts/measure-ai-flavor-baseline.mjs
 * （见 scripts/run-tests-electron.mjs:41-52 的调用方式）。脚本不做 ABI 重建。
 *
 * ## 运行时前提（WorkBuddy 槽位）
 * WorkBuddy 自带 Node 22 / ABI 127 —— 直接 `node scripts/…` 即可；
 * 若本机 `.node` 被重建到 Electron ABI 145，改用
 *   ELECTRON_RUN_AS_NODE=1 <electron.exe> scripts/measure-ai-flavor-baseline.mjs
 * 启动时把 `process.version / process.versions.modules` 打到 **stderr**（不污染 `--json` 的 stdout）。
 * 若 better-sqlite3 因 ABI 不匹配加载失败，打印「本槽位 ABI / 需要 ABI / 可用运行方式」并以 exit 2 退出；
 * **其它异常一律原样抛出**（不包装、不吞）。脚本不做 ABI 重建，也不切 ABI
 * （worktree 并行时禁 `pnpm test:node`，见 AGENTS.md 硬规则 5）。
 */
import { createRequire } from 'node:module'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

// ─── 0. 运行时提示：写 stderr，保证 --json 的 stdout 仍是纯 JSON ─────────────
fs.writeSync(2, `[measure-ai-flavor-baseline] node ${process.version} / ABI ${process.versions.modules}\n`)

const DEFAULT_SOURCE = 'C:/develop/workspace/AI-writer/师父派我来除魔，幕后真凶竟是小师妹/.ai-novel/project.db'
const DEFAULT_COPY = path.join(repositoryRoot, '.runtime', 'db-copy', 'project.db')

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[index + 1]
    : fallback
}

const source = option('--source', DEFAULT_SOURCE)
const copyPath = option('--copy', DEFAULT_COPY)
const jsonOnly = process.argv.includes('--json')

// --files 模式：只读文本，不打开项目库。
const filesArg = option('--files', null)
const filesMode = filesArg !== null
const filePaths = filesArg ? filesArg.split(',').map(value => value.trim()).filter(Boolean) : []
const labelsArg = option('--labels', '')
const fileLabels = labelsArg ? labelsArg.split(',').map(value => value.trim()) : []
const pairsArg = option('--pairs', '')
const pairDefs = pairsArg
  ? pairsArg.split(',').map(chunk => {
    const parts = chunk.trim().split(':')
    if (parts.length !== 3 || !/^\d+$/u.test(parts[0]) || !/^\d+$/u.test(parts[1])) {
      throw new Error(`--pairs 格式应为 oldIdx:newIdx:chapter，收到：${chunk}`)
    }
    return { oldIndex: Number(parts[0]), newIndex: Number(parts[1]), chapter: parts[2] }
  })
  : filePaths.length % 2 === 0
    ? filePaths.flatMap((_, index) => index % 2 === 0
      ? [{ oldIndex: index, newIndex: index + 1, chapter: `第 ${index / 2 + 1} 对` }]
      : [])
    : []

// ─── 1. 只读复制 + 只读打开（绝不写作者项目库；--files 模式不需要项目库）──────
if (!filesMode) {
  if (!fs.existsSync(source)) throw new Error(`项目库不存在：${source}`)
  fs.mkdirSync(path.dirname(copyPath), { recursive: true })
  fs.copyFileSync(source, copyPath)
}

/**
 * 只把「ABI 不匹配」当成可操作提示；其它异常（文件不存在、readonly 打开失败、SQL 错误、
 * 缺 binding 文件…）一律原样抛出，绝不包装、绝不吞。
 */
function isAbiLoadError(error) {
  const message = String(error?.message ?? error)
  // 只认两条**明确指向 ABI 版本**的特征。故意不匹配笼统的 ERR_DLOPEN_FAILED：
  // 缺 VC++ 运行库 / 缺 DLL 也会报它，当成 ABI 问题会给出错误的运行方式（不猜根因）。
  return /NODE_MODULE_VERSION|compiled against a different Node\.js version|Module version mismatch/iu.test(message)
}

/** 打印「本槽位 ABI=X，需要 ABI=Y，可用的运行方式」并 exit 2。数字只从错误信息解析，不猜。 */
function reportAbiFailure(error) {
  const message = String(error?.message ?? error)
  const versions = [...message.matchAll(/NODE_MODULE_VERSION\s+(\d+)/gu)].map((m) => Number(m[1]))
  const current = process.versions.modules
  const needed = versions.find((v) => String(v) !== String(current)) ?? null
  // 统一用正斜杠，保证 Windows 上也能直接复制执行。
  const scriptRel = path.relative(repositoryRoot, fileURLToPath(import.meta.url)).split(path.sep).join('/')
  const lines = [
    '',
    '=== better-sqlite3 加载失败：ABI 不匹配 ===',
    `本槽位 ABI=${current}（node ${process.version}；isElectronRuntime=${process.versions.electron !== undefined}）`,
    `需要 ABI=${needed ?? '无法从错误信息解析（不猜）'}`,
    ...(versions.length ? [`错误信息中的 NODE_MODULE_VERSION：${versions.join(' / ')}`] : []),
    '',
    '可用的运行方式：',
    `  · 若 .node 编译在 ABI 127（WorkBuddy 自带 Node 22）：node ${scriptRel}`,
    `  · 若 .node 编译在 ABI 145（Electron 41）：ELECTRON_RUN_AS_NODE=1 <electron.exe> ${scriptRel}`,
    '  · 让 `pnpm dev` 的 predev 自动探测并重建 better-sqlite3（AGENTS.md:36）；脚本本身不做 ABI 重建',
    '  · worktree 并行时不要跑 `pnpm test:node`（切 ABI 会打断其它槽位的 dev，AGENTS.md 硬规则 5）',
    ...(needed !== null
      ? [`  ⇒ 本次需要的运行方式：${String(needed) === '127' ? '裸 Node 22（ABI 127）' : String(needed) === '145' ? 'ELECTRON_RUN_AS_NODE=1 + electron.exe（ABI 145）' : `ABI ${needed} 对应的运行时`}`]
      : []),
    '',
    `原始错误：${message.split('\n')[0]}`,
    '',
  ]
  fs.writeSync(2, `${lines.join('\n')}\n`)
  process.exit(2)
}

let db = null
if (!filesMode) {
  let Database
  try {
    Database = require('better-sqlite3')
  } catch (error) {
    if (isAbiLoadError(error)) reportAbiFailure(error)
    throw error
  }
  try {
    db = new Database(copyPath, { readonly: true, fileMustExist: true })
  } catch (error) {
    if (isAbiLoadError(error)) reportAbiFailure(error)
    throw error
  }
}

// ─── 2. 复用生产侧 TS 模块（esbuild 内存打包 + data URL）─────────────────────
const bundled = await build({
  stdin: {
    contents: "export { measureProseShape } from './src/shared/prose-shape.ts'; export { countDraftUnits } from './src/shared/draft-units.ts';",
    resolveDir: repositoryRoot,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
})
const { measureProseShape, countDraftUnits } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

// ─── 3. 新增 4 项的可操作化定义（词表 = 可调整的报告项，不是阈值）─────────────

/** 与 prose-shape.ts:115 完全相同的句子切分。统计域为全章所有句子（含对白）：
 *  prose-shape.ts:224-226 的「只判非对白句」只服务于句长违规定位，不是通用的句子定义。 */
const SENTENCE_PATTERN = /[^。！？…；!?;]+[。！？…；!?;]*/gu

/** ① 解释/总结句：归因／总结标志，命中一句计 1（同句多标志不重复计）。 */
const EXPLANATION_MARKERS = [
  /原来/u, /这意味着/u, /因为[\s\S]{0,40}?所以/u, /终于明白/u,
  /也就是说/u, /换句话说/u, /由此可见/u, /归根结底/u, /说到底/u,
  /这才(?:明白|知道|意识到|发现|清楚)/u, /总而言之|综上所述|总之/u,
  /不难看出/u, /原因是|原因在于/u, /这说明了|这说明/u,
]

/** ② 心理直陈：任务书给的 7 个动词 + 否定式（不/没/未 + 动词，同一谓语的否定）。 */
const MENTAL_VERBS = ['意识到', '察觉', '疑惑', '担心', '害怕', '知道', '想']
const MENTAL_ALTERNATION = '(?:意识到|察觉|疑惑|担心|害怕|不知道|没知道|知道|不想|没想|想)'
/**
 * 「谓语位置」是**代理**：纯代码没有句法分析，这里用
 * 「动词位于句首/标点后，前面至多 4 个汉字（主语或副词）」近似谓语位置，
 * 并排除把「想」变成复合词的后缀（想道/想要/想起/想到/想象/想法…）。
 * 失效点：人名/代词识别粗糙、引语内心理描写、被字句、名词化用法；
 * 因此只作相对分布，不做拦截、不给阈值。
 */
const MENTAL_PREDICATE = new RegExp(
  `(?:^|[^\\u4e00-\\u9fff])(?:[\\u4e00-\\u9fff]{0,4})?${MENTAL_ALTERNATION}(?![道要起象法念必来去出见头望])`,
  'u',
)

/** ③ 连接词：任务书给的 6 个 + 同一类的少量常见项（"等"的落地，词表可调整）。 */
const CONNECTIVES = ['但是', '然而', '因此', '于是', '接着', '然后', '所以', '因为', '不过', '而且', '并且', '随后', '与此同时']
const CONNECTIVE_PATTERN = new RegExp(CONNECTIVES.join('|'), 'gu')

/** ④ 4-gram 自重复率：去空白/标点/符号后按 Unicode 字（含字母数字）滑 4 字窗；
 *  重复占比 =（总 gram 数 − 不同 gram 数）/ 总 gram 数，即"非首次出现的实例占比"。
 *  这是同章内字面重复的**代理**，不是语言模型概率，也不是 AI 味的充分证据。 */
function fourGramRepeat(text) {
  const chars = Array.from(text.replace(/[\s\p{P}\p{S}]/gu, ''))
  if (chars.length < 4) return { total: 0, distinct: 0, repeatedTypes: 0, ratio: 0 }
  const counts = new Map()
  for (let i = 0; i + 4 <= chars.length; i++) {
    const gram = chars.slice(i, i + 4).join('')
    counts.set(gram, (counts.get(gram) ?? 0) + 1)
  }
  const total = chars.length - 3
  const distinct = counts.size
  let repeatedTypes = 0
  for (const count of counts.values()) if (count > 1) repeatedTypes += 1
  return { total, distinct, repeatedTypes, ratio: total === 0 ? 0 : (total - distinct) / total }
}

function sentencesOf(text) {
  const sentences = []
  for (const line of text.split(/\r?\n/u)) {
    const paragraph = line.trim()
    if (!paragraph) continue
    for (const sentence of paragraph.match(SENTENCE_PATTERN) ?? []) {
      if (sentence.trim()) sentences.push(sentence)
    }
  }
  return sentences
}

/** 每章测一次，返回 4 项新增指标 + 既有三项的只读读数。--files 模式复用同一函数。 */
function measureChapter(text, profileId) {
  const units = countDraftUnits(text)
  const perThousand = units === 0 ? 0 : 1000 / units
  const sentences = sentencesOf(text)

  // ① 解释/总结句密度
  const explanationSentenceCount = sentences.filter(sentence =>
    EXPLANATION_MARKERS.some(marker => marker.test(sentence))).length

  // ② 心理直陈密度（句子占比）
  const mentalSentenceCount = sentences.filter(sentence => MENTAL_PREDICATE.test(sentence)).length

  // ③ 连接词密度（按出现次数）
  const connectiveCount = (text.match(CONNECTIVE_PATTERN) ?? []).length

  // ④ 4-gram 自重复率
  const grams = fourGramRepeat(text)

  // 既有三项：只读取，不改口径与阈值
  const shape = measureProseShape(text, profileId)
  const paragraphOver120 = shape?.violations.filter(v => v.metric === 'paragraph-too-long').length ?? null
  const sentenceOver40 = shape?.violations.filter(v => v.metric === 'sentence-too-long').length ?? null
  const dialogueRatio = shape?.metrics.dialogueRatio ?? null

  return {
    units,
    sentenceCount: sentences.length,
    shapeReportAvailable: shape !== null,
    explanationSentenceCount,
    mentalSentenceCount,
    connectiveCount,
    gram4: grams,
    metrics: {
      explanationDensityPer1k: explanationSentenceCount * perThousand,
      mentalPredicateRatio: sentences.length === 0 ? 0 : mentalSentenceCount / sentences.length,
      connectiveDensityPer1k: connectiveCount * perThousand,
      gram4RepeatRatio: grams.ratio,
      paragraphOver120Count: paragraphOver120,
      sentenceOver40Count: sentenceOver40,
      dialogueRatio,
    },
  }
}

// ─── 4. 指标定义（两种模式共用；标签/单位，不是词表）─────────────────────────
const METRIC_DEFS = [
  { key: 'explanationDensityPer1k', label: '① 解释/总结句密度', unit: '句/千字', kind: 'new' },
  { key: 'mentalPredicateRatio', label: '② 心理直陈密度', unit: '句占比', kind: 'new', proxy: true },
  { key: 'connectiveDensityPer1k', label: '③ 连接词密度', unit: '次/千字', kind: 'new' },
  { key: 'gram4RepeatRatio', label: '④ 4-gram 自重复率', unit: '重复实例占比', kind: 'new', proxy: true },
  { key: 'paragraphOver120Count', label: '既有·段长>120 段落数', unit: '段/章', kind: 'existing', threshold: '≤120' },
  { key: 'sentenceOver40Count', label: '既有·句长>40 句数', unit: '句/章', kind: 'existing', threshold: '≤40' },
  { key: 'dialogueRatio', label: '既有·对话占比', unit: '0–1', kind: 'existing', threshold: '25%–40%（只报数不判）' },
]

/** 逐篇 9 项：字数、句数 + 7 项指标。差值 = 新 − 旧。 */
const FILE_METRIC_KEYS = [
  { key: 'units', label: '字数', unit: '字', integer: true },
  { key: 'sentenceCount', label: '句数', unit: '句', integer: true },
  ...METRIC_DEFS.map(def => ({ ...def, integer: def.key.endsWith('Count') && def.kind === 'existing' })),
]

function valueOf(file, key) {
  if (key === 'units') return file.units
  if (key === 'sentenceCount') return file.sentenceCount
  return file.metrics[key]
}

const fmt = (value, digits = 4) => value === null || value === undefined
  ? 'NA' : (typeof value === 'number' ? Number(value.toFixed(digits)) : value)

// ─── 5. 基线模式：取数（只要 finalized）+ 汇总 + 报告 ────────────────────────
function percentile(values, p) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * p
  const low = Math.floor(position)
  const high = Math.ceil(position)
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low)
}

function buildBaselineReport() {
  const core = db.prepare('select rhythm_profile, writing_language, project_name from project_core where id = ?').get('main')
  const profileId = core?.rhythm_profile ?? ''
  const rows = db.prepare(`
    select d.id as draft_id, d.chapter_number, d.version, d.status, d.word_count, c.body
    from drafts d join contents c on c.id = d.content_id
    where d.status = 'finalized'
    order by d.chapter_number, d.version
  `).all()
  db.close()

  const chapters = rows.map(row => {
    const measured = measureChapter(String(row.body ?? ''), profileId)
    return {
      chapterNumber: row.chapter_number,
      version: row.version,
      draftId: row.draft_id,
      storedWordCount: row.word_count,
      ...measured,
    }
  })

  const totalUnits = chapters.reduce((sum, chapter) => sum + chapter.units, 0)
  const totalSentences = chapters.reduce((sum, chapter) => sum + chapter.sentenceCount, 0)
  const totalGrams = chapters.reduce((sum, chapter) => sum + chapter.gram4.total, 0)

  const summary = METRIC_DEFS.map(def => {
    const valued = chapters
      .map(chapter => ({ chapterNumber: chapter.chapterNumber, value: chapter.metrics[def.key] }))
      .filter(entry => entry.value !== null && Number.isFinite(entry.value))
    const values = valued.map(entry => entry.value)
    let minChapter = null
    let maxChapter = null
    if (values.length > 0) {
      const min = Math.min(...values)
      const max = Math.max(...values)
      minChapter = valued.filter(e => e.value === min).map(e => e.chapterNumber)
      maxChapter = valued.filter(e => e.value === max).map(e => e.chapterNumber)
    }
    return {
      key: def.key,
      label: def.label,
      unit: def.unit,
      kind: def.kind,
      ...(def.proxy ? { proxy: true } : {}),
      ...(def.threshold ? { existingThreshold: def.threshold } : {}),
      nChapters: valued.length,
      totalUnits,
      median: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      minChapter,
      maxChapter,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    source: '只读复制，不写作者项目库',
    sourcePath: source,
    copyPath,
    databaseOpenedReadonly: true,
    runtime: {
      node: process.version,
      modulesABI: process.versions.modules,
      isElectronRuntime: process.versions.electron !== undefined,
      execPath: process.execPath,
      electronRunAsNodeEnv: process.env.ELECTRON_RUN_AS_NODE ?? null,
    },
    reusedModules: ['src/shared/prose-shape.ts#measureProseShape', 'src/shared/draft-units.ts#countDraftUnits'],
    reusedPattern: 'src/shared/prose-shape.ts:115 SENTENCE_PATTERN',
    filter: "drafts.status='finalized'",
    projectName: core?.project_name ?? null,
    rhythmProfile: profileId,
    writingLanguage: core?.writing_language ?? null,
    singleChapterSample: true,
    attribution: '归因不清',
    attributionNote: '未读上游产物（单元任务/蓝图要点），不把任何分布差异记到文风账上',
    percentileMethod: 'linear interpolation, position=(n-1)*p',
    existingMetricsPolicy: '只读取 measureProseShape 的 metrics/violations；段长≤120 / 句长≤40 / 对话占比 25%–40% 的口径与阈值均未改动',
    markerWordLists: {
      explanationMarkers: EXPLANATION_MARKERS.map(m => m.source),
      mentalVerbs: MENTAL_VERBS,
      connectives: CONNECTIVES,
      gramN: 4,
    },
    totals: { chapters: chapters.length, totalUnits, totalSentences, totalGrams },
    summary,
    chapters,
  }
}

function printBaselineReport(report) {
  const chapters = report.chapters
  const totalUnits = report.totals.totalUnits
  const totalSentences = report.totals.totalSentences
  console.log('# A-1.1 基线测量（只读复制 + 只读打开）')
  console.log(`\n- 项目：${report.projectName} · rhythm_profile=${report.rhythmProfile} · 语言=${report.writingLanguage}`)
  console.log(`- 过滤：${report.filter} → ${chapters.length} 章；总字数(countDraftUnits)=${totalUnits}；总句数=${totalSentences}`)
  console.log(`- 运行时：node ${report.runtime.node} / ABI ${report.runtime.modulesABI} / isElectronRuntime=${report.runtime.isElectronRuntime} / ELECTRON_RUN_AS_NODE=${report.runtime.electronRunAsNodeEnv ?? 'undefined'}`)
  console.log(`- 复用：${report.reusedModules.join(' · ')}；句子切分 ${report.reusedPattern}`)
  console.log(`- singleChapterSample: ${report.singleChapterSample}（C8/P8，只报极端偏离，不判好坏）`)
  console.log(`- attribution: ${report.attribution}（未读上游产物，不记文风账）`)
  console.log(`- P95：${report.percentileMethod}`)

  console.log('\n## 基线表')
  console.log('| 指标 | 单位 | n 章 | 总字数 | 中位数 | P95 | min 章号 | max 章号 | 类别 |')
  console.log('|---|---|---:|---:|---:|---:|---|---|---|')
  for (const row of report.summary) {
    const category = row.kind === 'new' ? `新增${row.proxy ? '（代理）' : ''}` : `既有只读${row.existingThreshold ? `（${row.existingThreshold}）` : ''}`
    console.log(`| ${row.label} | ${row.unit} | ${row.nChapters} | ${row.totalUnits} | ${fmt(row.median)} | ${fmt(row.p95)} | ${row.minChapter?.join(',') ?? 'NA'} | ${row.maxChapter?.join(',') ?? 'NA'} | ${category} |`)
  }

  console.log('\n## 逐章明细（新增 4 项）')
  console.log('| 章 | 字数 | 句数 | ①解释句数 | ①密度/千字 | ②心理直陈句数 | ②占比 | ③连接词次 | ③密度/千字 | ④gram 总数 | ④重复占比 |')
  console.log('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const chapter of chapters) {
    console.log(`| ${chapter.chapterNumber} | ${chapter.units} | ${chapter.sentenceCount} | ${chapter.explanationSentenceCount} | ${fmt(chapter.metrics.explanationDensityPer1k)} | ${chapter.mentalSentenceCount} | ${fmt(chapter.metrics.mentalPredicateRatio)} | ${chapter.connectiveCount} | ${fmt(chapter.metrics.connectiveDensityPer1k)} | ${chapter.gram4.total} | ${fmt(chapter.metrics.gram4RepeatRatio)} |`)
  }

  console.log('\n## 逐章明细（既有三项，只读）')
  console.log('| 章 | 段长>120 段数 | 句长>40 句数 | 对话占比 | measureProseShape 可用 |')
  console.log('|---:|---:|---:|---:|---|')
  for (const chapter of chapters) {
    console.log(`| ${chapter.chapterNumber} | ${fmt(chapter.metrics.paragraphOver120Count, 0)} | ${fmt(chapter.metrics.sentenceOver40Count, 0)} | ${fmt(chapter.metrics.dialogueRatio)} | ${chapter.shapeReportAvailable} |`)
  }

  console.log('\n## 词表（可调整的报告项，不是阈值）')
  console.log(`- 解释/总结标志：${report.markerWordLists.explanationMarkers.join(' / ')}`)
  console.log(`- 心理动词：${MENTAL_VERBS.join(' / ')}（含否定式的谓语位置代理）`)
  console.log(`- 连接词：${CONNECTIVES.join(' / ')}`)
  console.log(`- 4-gram：去空白/标点/符号后按 Unicode 字滑窗；重复占比=(总数−不同数)/总数`)
  console.log('\n## JSON（机器可读，--json 可只输出这一段）')
  console.log(JSON.stringify(report, null, 2))
}

// ─── 6. --files 模式：只读文本 → 同一 measureChapter → 逐篇 + 配对差值 ────────
function buildFilesReport() {
  if (filePaths.length === 0) throw new Error('--files 至少需要一个路径')
  const profileId = option('--profile', 'fanqie')
  const files = filePaths.map((input, index) => {
    const filePath = path.isAbsolute(input) ? input : path.resolve(repositoryRoot, input)
    const raw = fs.readFileSync(filePath, 'utf8')
    const bomRemoved = raw.charCodeAt(0) === 0xFEFF
    const text = bomRemoved ? raw.slice(1) : raw
    const measured = measureChapter(text, profileId)
    return {
      index,
      label: fileLabels[index] ?? path.basename(filePath),
      filePath: filePath.split(path.sep).join('/'),
      byteLength: Buffer.byteLength(raw, 'utf8'),
      bomRemoved,
      ...measured,
    }
  })

  const pairs = pairDefs.map(pair => {
    const oldFile = files[pair.oldIndex]
    const newFile = files[pair.newIndex]
    if (!oldFile || !newFile) throw new Error(`--pairs 索引越界：${pair.oldIndex}:${pair.newIndex}`)
    const metrics = {}
    for (const def of FILE_METRIC_KEYS) {
      const oldValue = valueOf(oldFile, def.key)
      const newValue = valueOf(newFile, def.key)
      metrics[def.key] = {
        old: oldValue,
        new: newValue,
        delta: (oldValue === null || newValue === null) ? null : newValue - oldValue,
      }
    }
    return {
      chapter: pair.chapter,
      oldIndex: pair.oldIndex,
      newIndex: pair.newIndex,
      oldLabel: oldFile.label,
      newLabel: newFile.label,
      metrics,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    mode: 'files',
    source: '只读文本文件；未复制、未写回，未打开项目库',
    databaseOpenedReadonly: false,
    runtime: {
      node: process.version,
      modulesABI: process.versions.modules,
      isElectronRuntime: process.versions.electron !== undefined,
      execPath: process.execPath,
      electronRunAsNodeEnv: process.env.ELECTRON_RUN_AS_NODE ?? null,
    },
    reusedModules: ['src/shared/prose-shape.ts#measureProseShape', 'src/shared/draft-units.ts#countDraftUnits'],
    reusedPattern: 'src/shared/prose-shape.ts:115 SENTENCE_PATTERN',
    sameMeasurementFunction: 'measureChapter()（与基线模式同一个函数、同一套词表常量，未另造）',
    profileId,
    profileIdNote: "默认 fanqie：批次 1 报告 §3.1 project_core.rhythm_profile='fanqie'；prose-shape.ts:102-105 两档阈值同为 120/40",
    singleChapterSample: true,
    sampleNote: `n=${pairs.length} 章/${pairs.length} 对，只作方向参考，不做显著性结论`,
    attribution: '归因不清',
    attributionNote: '两版正文的生成参数、模型、模板版本均不同，不能把差异全记在模板上',
    existingMetricsPolicy: '只读取 measureProseShape 的 metrics/violations；段长≤120 / 句长≤40 / 对话占比 25%–40% 的口径与阈值均未改动',
    markerWordLists: {
      explanationMarkers: EXPLANATION_MARKERS.map(m => m.source),
      mentalVerbs: MENTAL_VERBS,
      connectives: CONNECTIVES,
      gramN: 4,
    },
    metricKeys: FILE_METRIC_KEYS.map(def => ({ key: def.key, label: def.label, unit: def.unit })),
    deltaDefinition: '差值 = 新 − 旧；任一侧为 null 则该项差值为 null（不猜）',
    files,
    pairs,
  }
}

function printFilesReport(report) {
  console.log('# A-1.1 口径 · --files 新旧正文对读（只读文本，未打开项目库）')
  console.log(`\n- 运行时：node ${report.runtime.node} / ABI ${report.runtime.modulesABI} / isElectronRuntime=${report.runtime.isElectronRuntime}`)
  console.log(`- profileId=${report.profileId}（${report.profileIdNote}）`)
  console.log(`- 复用：${report.reusedModules.join(' · ')}；句子切分 ${report.reusedPattern}`)
  console.log(`- ${report.sameMeasurementFunction}`)
  console.log(`- 样本：${report.sampleNote}`)
  console.log(`- attribution: ${report.attribution}（${report.attributionNote}）`)
  console.log(`- 差值：${report.deltaDefinition}`)
  console.log('- 本模式不产出 P95 / 基线分布（不是 11 章分布测量）')

  console.log('\n## 逐篇指标（9 项）')
  console.log('| 文件 | 标签 | 字数 | 句数 | ①解释/千字 | ②心理直陈占比 | ③连接词/千字 | ④4-gram 重复占比 | 段长>120 | 句长>40 | 对话占比 |')
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const file of report.files) {
    const m = file.metrics
    console.log(`| ${file.index}:${path.basename(file.filePath)} | ${file.label} | ${file.units} | ${file.sentenceCount} | ${fmt(m.explanationDensityPer1k)} | ${fmt(m.mentalPredicateRatio)} | ${fmt(m.connectiveDensityPer1k)} | ${fmt(m.gram4RepeatRatio)} | ${fmt(m.paragraphOver120Count, 0)} | ${fmt(m.sentenceOver40Count, 0)} | ${fmt(m.dialogueRatio)} |`)
  }

  console.log('\n## 旧 vs 新 两章对照 + 差值（新 − 旧）')
  console.log(`| 指标 | 单位 | ${report.pairs.map(pair => `${pair.chapter}·旧 | ${pair.chapter}·新 | Δ`).join(' | ')} |`)
  console.log(`|---|---|${report.pairs.map(() => '---:|---:|---:').join('|')}|`)
  for (const def of FILE_METRIC_KEYS) {
    const cells = report.pairs.map(pair => {
      const entry = pair.metrics[def.key]
      const digits = def.integer ? 0 : 4
      return `${fmt(entry.old, digits)} | ${fmt(entry.new, digits)} | ${fmt(entry.delta, digits)}`
    })
    console.log(`| ${def.label} | ${def.unit} | ${cells.join(' | ')} |`)
  }

  console.log('\n## 词表（与 A-1.1 同一套，逐字相同）')
  console.log(`- 解释/总结标志：${report.markerWordLists.explanationMarkers.join(' / ')}`)
  console.log(`- 心理动词：${MENTAL_VERBS.join(' / ')}（含否定式的谓语位置代理）`)
  console.log(`- 连接词：${CONNECTIVES.join(' / ')}`)
  console.log(`- 4-gram：去空白/标点/符号后按 Unicode 字滑窗；重复占比=(总数−不同数)/总数`)
  console.log('\n## JSON（--json 可只输出这一段）')
  console.log(JSON.stringify(report, null, 2))
}

// ─── 7. 分派：默认模式输出与批次 1/3 完全一致 ───────────────────────────────
const report = filesMode ? buildFilesReport() : buildBaselineReport()
if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2))
} else if (filesMode) {
  printFilesReport(report)
} else {
  printBaselineReport(report)
}
