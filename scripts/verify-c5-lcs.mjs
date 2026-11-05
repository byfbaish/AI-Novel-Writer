/* global process */
/**
 * C5 最长公共连续片段 · 独立复算（只读，可复跑）
 *
 * ## 与生产同向（复用，不另造）
 * - 长度算法：`src/shared/hook-payoff-audit.ts:88-106` 的 `longestCommonRunLength`
 *   （按 `[...str]` Unicode 码点 DP，求最长公共**连续子串**）。本脚本自写的 DP 只为
 *   额外取出片段文本，每组都用生产函数校验长度一致，不一致直接抛错。
 * - 钩子行解析：`src/shared/synopsis-hook-line.ts:69-107` 的 `parseHookLine`
 *   （两代行名「钩子：」/「收尾：」都认，剥「｜种在：」后缀、剥类型段）。
 * - C5 判据用**全文** draft（`hook-payoff-audit.ts:167`），只有 C3 才截末 200 字（`:152`）。
 *   本脚本按全文比对，不截断。
 * - 阈值常量 `HOOK_PLANTED_MIN_RUN`（`hook-payoff-audit.ts:49`）= 3，仅用于「过线」标注，
 *   不参与任何判定。
 *
 * ## 任务书口径（逐条落地）
 * 1) 蓝图端 = `blueprints.suspense_hook`，去掉开头「钩子：<类型> — 」前缀（若有）与
 *    「｜种在：」后缀。实现：先剥自带行名，再合成「钩子：<rest>」走生产 `parseHookLine`
 *    —— 类型段/后缀剥离与生产完全同源。
 * 2) 大纲端 = 该章块「收尾：」行冒号后的正文；若行名已是「钩子：」则取 `parseHookLine`
 *    的断点部分。章块按 `## ` 切分，章号取「全书第 N 章」，无该字样时取「## 第 N 章：」。
 * 3) 正文 = `drafts.status='finalized'` 关联 `contents.body`，**全文**。
 * 4) 最长公共连续片段按**字符**（`Array.from`，含标点），不分词。
 * 5) 「过线段文本」= 最长片段去标点/空白后、且长度 ≥ HOOK_PLANTED_MIN_RUN 的文本；
 *    「粗判」= 该文本 ≤4 字且整体落在角色名/地点名列表内 ⇒ 是（附命中名），否则否。
 *
 * ## 只读与运行时前提
 * 源库用 **`VACUUM INTO` 生成一致快照**到 `.runtime/db-copy/project.db`（默认每次重建），
 * 再以 `{ readonly: true, fileMustExist: true }` 打开。**不要改回 `fs.copyFileSync`**：
 * 源库是 WAL 模式、且常被 dev / APP 同时打开着，直接拷主库会读到撕裂状态
 * （实测 `--refresh` 后 `SQLITE_CORRUPT: orphan index`），也会读到过期旧副本
 * 导致 22 组全 N/A 却不报错。`VACUUM INTO` 在只读连接上可执行，产出的单文件含 WAL 内容。
 * WorkBuddy 自带 Node 22 / ABI 127；若切到 Electron ABI 145，改用
 *   ELECTRON_RUN_AS_NODE=1 <electron.exe> scripts/verify-c5-lcs.mjs
 *
 * ## ⚠️ 内置 2026-11-05 作者库快照参数（换项目必须先改，否则「粗判」列不可信）
 * - `LOCATION_CONSTANTS` 16 个地点名逐字取自该作者库 `project_core.world_setting`「地点：」段；
 * - 角色名**不**硬编码（读 `characters` / `character_aliases`）；地点名是「常量 ∪ `characters.cs_location`」，
 *   常量只补库内拿不到的场所；
 * - 章范围**不再写死**：默认取快照里 finalized 正文的最小–最大章号，`--from` / `--to` 可覆盖
 *   （原版写死 1–11，作者库继续写章后会漏章）。
 * ⇒ 本脚本定位是**标定快照复算**，不是可跨项目复用的工具。换库请改地点常量并重标阈值。
 *
 * ## 用法（工作目录 = 仓库根）
 *   node scripts/verify-c5-lcs.mjs                    # 人读表
 *   node scripts/verify-c5-lcs.mjs --json             # 机器可读
 *   node scripts/verify-c5-lcs.mjs --from 1 --to 11   # 指定章范围
 *   node scripts/verify-c5-lcs.mjs --source <db> --copy <db> [--reuse]
 *   （`--reuse` 复用已有快照；默认每次重建，避免读到过期副本）
 */
import { createRequire } from 'node:module'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const DEFAULT_SOURCE = 'C:/develop/workspace/AI-writer/师父派我来除魔，幕后真凶竟是小师妹/.ai-novel/project.db'
const DEFAULT_COPY = path.join(repositoryRoot, '.runtime', 'db-copy', 'project.db')

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[index + 1]
    : fallback
}
const has = (name) => process.argv.includes(name)
const source = option('--source', DEFAULT_SOURCE)
const copyPath = option('--copy', DEFAULT_COPY)
const jsonOnly = has('--json')
const reuseCopy = has('--reuse')
const chapterFromOverride = option('--from', null)
const chapterToOverride = option('--to', null)

// ─── 1. 一致快照 + 只读打开 ──────────────────────────────────────────────────
// 见文件头：不用 copyFileSync（WAL 撕裂 / 读到过期副本都会静默失真）。
if (!fs.existsSync(source)) throw new Error(`项目库不存在：${source}`)

let Database
try {
  Database = require('better-sqlite3')
} catch (error) {
  throw new Error(`better-sqlite3 加载失败（当前 ABI=${process.versions.modules}）：${error.message}`)
}

/** 用 VACUUM INTO 从源库生成单文件一致快照（源库只读打开，绝不写源库）。 */
function snapshotDatabase() {
  fs.mkdirSync(path.dirname(copyPath), { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${copyPath}${suffix}`, { force: true })
  const from = new Database(source, { readonly: true, fileMustExist: true })
  try {
    from.exec(`VACUUM INTO '${copyPath.replace(/'/g, "''")}'`)
  } finally {
    from.close()
  }
}

/** 打开快照；若命中历史遗留的损坏副本（copyFileSync 半截文件），重建一次再开，不静默降级。 */
function openSnapshot() {
  try {
    return new Database(copyPath, { readonly: true, fileMustExist: true })
  } catch (error) {
    const signature = `${error.code ?? ''} ${error.message ?? ''}`
    if (!/SQLITE_CORRUPT|SQLITE_NOTADB|malformed/u.test(signature)) throw error
    console.error(`⚠️ 已有快照不可读（${error.code}），重新生成：${copyPath}`)
    snapshotDatabase()
    return new Database(copyPath, { readonly: true, fileMustExist: true })
  }
}

if (!reuseCopy || !fs.existsSync(copyPath)) snapshotDatabase()
const db = openSnapshot()

// ─── 2. 复用生产 TS 模块（esbuild 内存打包，与 measure-ai-flavor-baseline.mjs 同法）──
const bundled = await build({
  stdin: {
    contents: [
      "export { longestCommonRunLength, HOOK_PLANTED_MIN_RUN } from './src/shared/hook-payoff-audit.ts';",
      "export { parseHookLine } from './src/shared/synopsis-hook-line.ts';",
    ].join('\n'),
    resolveDir: repositoryRoot,
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
})
const { longestCommonRunLength, HOOK_PLANTED_MIN_RUN, parseHookLine } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

// ─── 3. 最长公共连续片段：与生产同算法，额外返回片段文本 ──────────────────────
/** DP 求最长公共连续子串。并列时取 A 中最先结束的那个，并返回全部并列片段（去重）。 */
function longestCommonRun(a, b) {
  const A = Array.from(a)
  const B = Array.from(b)
  if (A.length === 0 || B.length === 0) return { length: 0, segment: '', allMaxSegments: [] }
  let previous = new Array(B.length + 1).fill(0)
  let best = 0
  const segments = new Set()
  for (let i = 1; i <= A.length; i += 1) {
    const current = new Array(B.length + 1).fill(0)
    for (let j = 1; j <= B.length; j += 1) {
      if (A[i - 1] === B[j - 1]) {
        const run = previous[j - 1] + 1
        current[j] = run
        if (run > best) {
          best = run
          segments.clear()
          segments.add(A.slice(i - run, i).join(''))
        } else if (run === best && best > 0) {
          segments.add(A.slice(i - run, i).join(''))
        }
      }
    }
    previous = current
  }
  const all = [...segments]
  return { length: best, segment: all[0] ?? '', allMaxSegments: all }
}

// ─── 4. 钩子取数 ────────────────────────────────────────────────────────────
/** 蓝图端：剥自带行名前缀 → 合成钩子行走生产解析（剥类型段 / ｜种在：后缀）。 */
function blueprintBreakPoint(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return ''
  const withoutLineName = text.replace(/^[ \t>*\-—]*?钩子[：:][ \t]*/u, '').trim()
  const parsed = parseHookLine(`钩子：${withoutLineName}`)
  return (parsed?.breakPoint ?? withoutLineName).trim()
}

/** 大纲章块切分：`## ` 开头；章号优先「全书第 N 章」，退化「## 第 N 章：」。 */
function synopsisBlocks(synopsis) {
  const lines = String(synopsis ?? '').split(/\r?\n/u)
  const blocks = []
  let current = null
  for (const line of lines) {
    if (/^##\s+/u.test(line)) {
      const fromWhole = /全书第\s*(\d+)\s*章/u.exec(line)
      const fromShort = /^##\s*第\s*(\d+)\s*章[：:]/u.exec(line)
      const match = fromWhole ?? fromShort
      current = match ? { chapter: Number(match[1]), header: line.trim(), lines: [] } : null
      if (current) blocks.push(current)
    } else if (current) {
      current.lines.push(line)
    }
  }
  return blocks
}

/** 大纲端：「收尾：」取冒号后正文；「钩子：」走生产解析取断点。 */
function outlineBreakPoint(block) {
  if (!block) return { text: '', lineName: null, rawLine: null }
  for (const line of block.lines) {
    const match = /^[ \t>*\-—]*?(钩子|收尾)[：:][ \t]*(.*)$/u.exec(line.trim())
    if (!match) continue
    const name = match[1]
    const rest = (match[2] ?? '').trim()
    if (name === '收尾') return { text: rest, lineName: name, rawLine: line.trim() }
    const parsed = parseHookLine(line.trim())
    return { text: (parsed?.breakPoint ?? '').trim(), lineName: name, rawLine: line.trim() }
  }
  return { text: '', lineName: null, rawLine: null }
}

// ─── 5. 角色名 / 地点名列表（人名全部来自库内结构化表；地点词表注明来源）───────
const characterNames = new Set()
for (const row of db.prepare('select name from characters').all()) {
  const name = String(row.name ?? '').trim()
  if (name) characterNames.add(name)
}
for (const row of db.prepare('select name from character_aliases').all()) {
  const name = String(row.name ?? '').trim()
  if (name) characterNames.add(name)
}
const csLocations = new Set()
for (const row of db.prepare('select distinct cs_location from characters').all()) {
  const loc = String(row.cs_location ?? '').trim()
  if (loc) csLocations.add(loc)
}
/** 地点常量：逐字取自 `project_core.world_setting`「地点：」/「账目：」段与大纲中出现的场所名，
 *  非结构化字段，可用 grep 对 world_setting 复核；只用于「粗判」，不参与长度计算。 */
const LOCATION_CONSTANTS = [
  '玄阙宗', '山门', '内门', '外门', '碑坪', '矿洞', '断脉岭', '度支房', '戒律堂',
  '药房', '试药房', '废料区', '长老殿', '内门峰顶', '长老会', '宗门',
]
const locationNames = new Set([...LOCATION_CONSTANTS, ...csLocations])

function coarseJudge(segment, length) {
  const cleaned = String(segment).replace(/[\s\p{P}\p{S}]/gu, '')
  const cleanedLen = Array.from(cleaned).length
  const passed = length >= HOOK_PLANTED_MIN_RUN
  const overLineText = passed ? cleaned : '—(未过线)'
  if (!passed) return { overLineText, verdict: `否（长度 ${length} < ${HOOK_PLANTED_MIN_RUN}，不过线）`, hits: [] }
  if (cleanedLen > 4) return { overLineText, verdict: `否（去标点后 ${cleanedLen} 字 > 4）`, hits: [] }
  // 「整体落在」= 片段完整落在某个名字里（精确相等优先于子串）。
  // 全部命中都列出，避免一个长角色名（如「度支房书吏」）抢走地名精确匹配的判读。
  const hits = []
  for (const name of characterNames) {
    if (name === cleaned) hits.push({ kind: '人名', name, match: '精确' })
    else if (name.includes(cleaned)) hits.push({ kind: '人名', name, match: '子串' })
  }
  for (const name of locationNames) {
    if (name === cleaned) hits.push({ kind: '地名', name, match: '精确' })
    else if (name.includes(cleaned)) hits.push({ kind: '地名', name, match: '子串' })
  }
  hits.sort((a, b) => (a.match === b.match ? 0 : a.match === '精确' ? -1 : 1))
  if (hits.length === 0) return { overLineText, verdict: '否（不在角色名/地点名列表内）', hits }
  const main = hits[0]
  const others = hits.slice(1).map((h) => `${h.kind}:${h.name}(${h.match})`).join('、')
  return {
    overLineText,
    verdict: `是（${main.kind}：${main.name}，${main.match}）${others ? `；另命中 ${others}` : ''}`,
    hits,
  }
}

// ─── 6. 组装 22 组 ──────────────────────────────────────────────────────────
const synopsis = String(db.prepare('select synopsis from project_core where id = ?').get('main')?.synopsis ?? '')
const blocks = new Map(synopsisBlocks(synopsis).map((b) => [b.chapter, b]))
const blueprintRows = db.prepare('select chapter_number, suspense_hook from blueprints').all()
const blueprints = new Map(blueprintRows.map((r) => [Number(r.chapter_number), String(r.suspense_hook ?? '')]))
const bodies = new Map()
for (const row of db.prepare(`
  select d.chapter_number, c.body
  from drafts d join contents c on c.id = d.content_id
  where d.status = 'finalized'
  order by d.chapter_number, d.version
`).all()) {
  // 同章多版本取最后一版（本库每章 1 版，写明规则）
  bodies.set(Number(row.chapter_number), String(row.body ?? ''))
}
const worldSetting = String(db.prepare('select world_setting from project_core where id = ?').get('main')?.world_setting ?? '')
db.close()

// ─── 6.5 章范围：默认取快照里 finalized 正文的最小–最大章号（`--from` / `--to` 可覆盖）──────
const finalizedChapters = [...bodies.keys()].sort((a, b) => a - b)
if (finalizedChapters.length === 0) {
  console.error(`快照里没有 finalized 正文，无法确定章范围：${copyPath}`)
  console.error('请确认 --source 指向的库正确、且该库确有定稿章节（本脚本不会静默输出全 N/A）。')
  process.exit(2)
}
const CHAPTER_MIN = chapterFromOverride ? Number(chapterFromOverride) : finalizedChapters[0]
const CHAPTER_MAX = chapterToOverride ? Number(chapterToOverride) : finalizedChapters[finalizedChapters.length - 1]
if (!Number.isFinite(CHAPTER_MIN) || !Number.isFinite(CHAPTER_MAX) || CHAPTER_MIN > CHAPTER_MAX) {
  console.error(`章范围非法：--from ${chapterFromOverride} / --to ${chapterToOverride}`)
  process.exit(2)
}

const groups = []
for (let chapter = CHAPTER_MIN; chapter <= CHAPTER_MAX; chapter += 1) {
  const body = bodies.get(chapter)
  for (const side of ['蓝图', '大纲']) {
    const hook = side === '蓝图'
      ? blueprintBreakPoint(blueprints.get(chapter))
      : outlineBreakPoint(blocks.get(chapter)).text
    const missing = side === '蓝图' ? !blueprints.has(chapter) : !blocks.has(chapter)
    if (missing || !hook || body === undefined) {
      groups.push({
        chapter, side, hook, bodyLength: body?.length ?? null,
        available: false, naReason: [missing && `缺${side}`, !hook && '钩子为空', body === undefined && '缺 finalized 正文'].filter(Boolean).join(' + ') || 'N/A',
        segment: 'N/A', length: null, overLineText: 'N/A', verdict: 'N/A',
      })
      continue
    }
    const run = longestCommonRun(hook, body)
    // 与生产函数交叉校验（长度必须一致，否则说明算法不同向）
    const productionLength = longestCommonRunLength(hook, body)
    if (run.length !== productionLength) {
      throw new Error(`算法不同向：ch${chapter}/${side} 本脚本=${run.length} 生产=${productionLength}`)
    }
    const judge = coarseJudge(run.segment, run.length)
    groups.push({
      chapter, side, hook, bodyLength: Array.from(body).length,
      available: true, naReason: null,
      segment: run.segment, length: run.length,
      allMaxSegments: run.allMaxSegments,
      productionLength,
      ...judge,
    })
  }
}

const lengths = groups.filter((g) => g.available).map((g) => g.length)
const availableCount = lengths.length
const sourceStat = fs.statSync(source)
const copyStat = fs.statSync(copyPath)
const meta = {
  generatedAt: new Date().toISOString(),
  sourcePath: source,
  sourceBytes: sourceStat.size,
  sourceMtime: sourceStat.mtime.toISOString(),
  copyPath,
  copyBytes: copyStat.size,
  copyMtime: copyStat.mtime.toISOString(),
  databaseOpenedReadonly: true,
  runtime: { node: process.version, modulesABI: process.versions.modules, isElectronRuntime: process.versions.electron !== undefined },
  reusedModules: [
    'src/shared/hook-payoff-audit.ts:88-106 longestCommonRunLength',
    'src/shared/hook-payoff-audit.ts:49 HOOK_PLANTED_MIN_RUN',
    'src/shared/synopsis-hook-line.ts:69-107 parseHookLine',
  ],
  lcsDefinition: '最长公共连续子串，按 Array.from() Unicode 码点、含标点、不分词；正文全文不截断',
  productionCrossCheck: '每组均调用生产 longestCommonRunLength 校验长度一致',
  hookPlantedMinRun: HOOK_PLANTED_MIN_RUN,
  chapterRange: [CHAPTER_MIN, CHAPTER_MAX],
  outlineBlocksFound: blocks.size,
  blueprintCount: blueprintRows.length,
  finalizedBodyCount: bodies.size,
  characterNameCount: characterNames.size,
  locationNameCount: locationNames.size,
  locationConstants: LOCATION_CONSTANTS,
  csLocations: [...csLocations],
  worldSettingLocationLine: worldSetting.split(/\r?\n/u).find((l) => l.startsWith('地点：')) ?? null,
  totals: {
    groups: groups.length,
    available: availableCount,
    na: groups.length - availableCount,
    min: lengths.length ? Math.min(...lengths) : null,
    max: lengths.length ? Math.max(...lengths) : null,
    median: lengths.length
      ? [...lengths].sort((a, b) => a - b)[Math.floor((lengths.length - 1) / 2)]
      : null,
    belowMinRun: lengths.filter((l) => l < HOOK_PLANTED_MIN_RUN).length,
    distribution: lengths.reduce((acc, l) => { acc[l] = (acc[l] ?? 0) + 1; return acc }, {}),
  },
  comparison: (() => {
    const firstTen = groups.filter((g) => g.chapter <= 10 && g.available)
    const firstTenLengths = firstTen.map((g) => g.length)
    const ch11 = groups.filter((g) => g.chapter === 11)
    return {
      firstTenGroups: firstTen.length,
      firstTenMin: firstTenLengths.length ? Math.min(...firstTenLengths) : null,
      firstTenMax: firstTenLengths.length ? Math.max(...firstTenLengths) : null,
      firstTenDistribution: firstTenLengths.reduce((acc, l) => { acc[l] = (acc[l] ?? 0) + 1; return acc }, {}),
      firstTenWithin3to8: firstTenLengths.every((l) => l >= 3 && l <= 8),
      ch11Blueprint: ch11.find((g) => g.side === '蓝图')?.length ?? null,
      ch11Outline: ch11.find((g) => g.side === '大纲')?.length ?? null,
      ch11Max: Math.max(...ch11.filter((g) => g.available).map((g) => g.length)),
      all22Within3to8: lengths.every((l) => l >= 3 && l <= 8),
    }
  })(),
}

// ─── 7. 输出 ────────────────────────────────────────────────────────────────
if (jsonOnly) {
  console.log(JSON.stringify({ meta, groups }, null, 2))
} else {
  const esc = (s) => String(s).replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ')
  console.log('# C5 最长公共连续片段 · 独立复算（只读）')
  console.log('\n## 口径')
  console.log(`- 算法：${meta.lcsDefinition}`)
  console.log(`- 复用：${meta.reusedModules.join(' · ')}`)
  console.log(`- 交叉校验：${meta.productionCrossCheck}（${availableCount} 组全部通过）`)
  console.log(`- 过线阈值：HOOK_PLANTED_MIN_RUN=${HOOK_PLANTED_MIN_RUN}，仅用于标注，不参与判定`)
  console.log(`- 章范围：ch${CHAPTER_MIN}–${CHAPTER_MAX} × 蓝图/大纲 = ${groups.length} 组`)
  console.log(`- 数据：源 ${sourceBytes()} bytes / 副本 ${copyBytes()} bytes；只读打开`)
  console.log(`- 运行时：node ${meta.runtime.node} / ABI ${meta.runtime.modulesABI} / isElectronRuntime=${meta.runtime.isElectronRuntime}`)
  console.log(`- 名单：角色名 ${meta.characterNameCount} 个（characters.name + character_aliases.name）；地点名 ${meta.locationNameCount} 个（cs_location + 常量）`)
  console.log(`- 地点常量来源：world_setting「地点：」段 → ${meta.worldSettingLocationLine ?? '(未找到)'}`)

  console.log('\n## 逐组表')
  console.log('| 章 | 端 | 最长片段 | 长度 | 过线段文本 | 粗判 |')
  console.log('|---:|---|---|---:|---|---|')
  for (const g of groups) {
    console.log(`| ${g.chapter} | ${g.side} | ${g.available ? `\`${esc(g.segment)}\`` : 'N/A'} | ${g.length ?? 'N/A'} | ${g.available ? `\`${esc(g.overLineText)}\`` : 'N/A'} | ${g.verdict} |`)
  }

  console.log('\n## 钩子原文（供复核剥离结果）')
  console.log('| 章 | 端 | 剥离后钩子 | 正文长度(字符) |')
  console.log('|---:|---|---|---:|')
  for (const g of groups) console.log(`| ${g.chapter} | ${g.side} | ${esc(g.hook) || '(空)'} | ${g.bodyLength ?? 'N/A'} |`)

  console.log('\n## 并列最长片段（同章同长度有多个不同片段时列出）')
  let multi = 0
  for (const g of groups) {
    if (g.available && g.allMaxSegments.length > 1) {
      multi += 1
      console.log(`- ch${g.chapter}/${g.side} 长度 ${g.length}：${g.allMaxSegments.map((s) => `\`${esc(s)}\``).join(' / ')}`)
    }
  }
  if (multi === 0) console.log('- 无（每组最长片段唯一）')

  console.log('\n## 汇总（我的复算值）')
  console.log(`- 可算组 ${meta.totals.available} / ${meta.totals.groups}，N/A ${meta.totals.na}`)
  console.log(`- 长度：min=${meta.totals.min} / 中位数=${meta.totals.median} / max=${meta.totals.max}`)
  console.log(`- 分布（长度:组数）：${JSON.stringify(meta.totals.distribution)}`)
  console.log(`- 低于 ${HOOK_PLANTED_MIN_RUN} 字的组：${meta.totals.belowMinRun}`)

  console.log('\n## 口径对照（纯复算数字，不引用外部结论）')
  const c = meta.comparison
  console.log(`- 前 10 章 × 2 端 = ${c.firstTenGroups} 组：min=${c.firstTenMin} / max=${c.firstTenMax} / 分布=${JSON.stringify(c.firstTenDistribution)} / 全部落在 3–8 字 = ${c.firstTenWithin3to8}`)
  console.log(`- 第 11 章：蓝图端 ${c.ch11Blueprint} 字 / 大纲端 ${c.ch11Outline} 字 / 两端最大 ${c.ch11Max} 字`)
  console.log(`- 全部 22 组落在 3–8 字 = ${c.all22Within3to8}`)
  console.log('- 复跑：`node scripts/verify-c5-lcs.mjs`（`--json` 出机器可读；`--from`/`--to` 指定章范围；默认每次重建一致快照）')
}
function sourceBytes() { return meta.sourceBytes }
function copyBytes() { return meta.copyBytes }
