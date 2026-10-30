#!/usr/bin/env node
// 文档放置体检：状态行 / 索引登记 / 命名 / 目录存在性 / 禁放区 / 断链。
//
// 用法：
//   node scripts/check-doc-placement.mjs                  # 报告模式，退出码恒 0
//   node scripts/check-doc-placement.mjs --strict         # 出现「新增」违规时退出 1
//   node scripts/check-doc-placement.mjs --update-baseline # 重写基线
//   node scripts/check-doc-placement.mjs --status-of "期 2" # 列出所有写着该状态的文档（收口用）
//
// 为什么默认不阻断：首次运行必然命中存量违规（缺状态行 / 未进索引），硬阻断会把
// 正在进行的文档改造卡死。存量进基线，只对新增报警 —— 规则见
// docs/agents/documentation-charter.md §9。
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs')
const INDEX_FILE = path.join(DOCS, 'README.md')
const BASELINE_FILE = path.join(DOCS, 'agents', 'doc-placement-baseline.json')

const SKIP_DIRS = new Set(['node_modules', '.git', '.runtime', '.worktrees', '.pnpm-store', '.workbuddy'])

// 根目录允许存在的 md（公共文档）。新增前先读 docs/README.md §6「文档权威层级」。
const ROOT_MD_ALLOW = new Set(['README.md', 'README_en.md', 'README_zh.md', 'CONTRIBUTING.md', 'AGENTS.md'])

// 归档目录豁免 C1/C2/C3：归档件的状态与索引由归档时那一份指针负责。
const ARCHIVE_SEGMENT = '/archive/'

// 说明性路径：设计稿里用作「示例目录」的假路径，与 check-doc-links.mjs 的 IGNORE 保持同源。
const LINK_IGNORE = ['debug-prompt-trace-design.md:8f3a21c0/']

const C = {
  C1: '缺状态行',
  C1b: '状态行取值不合规',
  C2: '未进索引',
  C3: '命名不合规',
  C4: '目录不存在',
  C5: '放在禁放区',
  C6: '断链',
  C7: '章程版本不一致',
}

// ── 状态行取值（2026-10-31 起从"只查有没有"升级为"还查取值"）────────────────
//
// 词表本身不是新造的：docs/agents/documentation-charter.md §5.2 从 2026-10-25 就写着
// 这 5 个取值，只是**从来没有脚本校验过**，于是实际长出了 20 多种写法
// （`草案 v1，待作者多轮评审` / `待评审 ｜ 日期：…` / `部分否决` / `已列入待办`…）。
//
// 为什么只查"含受控词"而不是"以受控词开头"：
// 真实写法大量是「期 1 已落地（2026-10-30 · M24…）」「P15 已实施 · P16 已实施」，
// 强制前缀会逼着改一堆本来读得懂的句子；而"含"已经足够把「草案 v1」这类
// 完全脱离词表的写法拦下来 —— 那才是要拦的东西。
const STATUS_LINE = /^\s*>\s*\*{0,2}\s*状态\s*\*{0,2}\s*[:：]\s*(.+)$/m
const STATUS_VALUES = ['待裁定', '已裁定', '已实施', '已落地', '已搁置', '已结项']
const STATUS_DATE = /20\d{2}-\d{2}-\d{2}/
const stripMarkup = (text) => text
  .replace(/[*`]/g, '')
  .replace(/\p{Extended_Pictographic}/gu, '')
  .replace(/\uFE0F/gu, '')
  .trim()

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.md$/i.test(entry.name)) out.push(full)
  }
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/')

const files = []
walk(DOCS, files)
for (const name of fs.readdirSync(ROOT)) {
  if (/\.md$/i.test(name)) files.push(path.join(ROOT, name))
}

const indexText = fs.existsSync(INDEX_FILE) ? fs.readFileSync(INDEX_FILE, 'utf8') : ''
const isArchive = (p) => p.includes(ARCHIVE_SEGMENT)
// 目录自带的 README 是索引件，不是设计稿：不要求状态行、不进索引、不套设计稿命名规则。
const isDirIndex = (p) => path.basename(p).toLowerCase() === 'readme.md'
const isDesignDoc = (p) => p.startsWith('docs/design/') && !isArchive(p) && !isDirIndex(p)

const findings = []
const add = (code, file, detail) => findings.push({ code, file, detail })
// 全部状态行（含合规的），供 --status-of 使用
const statusLines = []

for (const file of files) {
  const p = rel(file)
  if (!p.startsWith('docs/') && !ROOT_MD_ALLOW.has(p) && /^[^/]+\.md$/i.test(p)) {
    // 根目录出现白名单之外的 md
    add('C5', p, '根目录只允许 README / README_en / README_zh / CONTRIBUTING / AGENTS')
  }

  const text = fs.readFileSync(file, 'utf8')

  // C1 状态行：docs/design 下的现行设计稿必须有 `> 状态：`
  if (isDesignDoc(p)) {
    // 兼容 `> 状态：`、`> **状态**：`、`> **状态**:` 三种真实写法
    const hasStatus = /^\s*>\s*\*{0,2}\s*状态\s*\*{0,2}\s*[:：]/m.test(text)
    if (!hasStatus) add('C1', p, '缺少头部 `> 状态：…` 行（docs/README.md §3.2 第 3 条）')

    // C1b 取值：必须在章程 §5.2 的受控词表内，且带日期
    const statusMatch = hasStatus ? text.match(STATUS_LINE) : null
    if (statusMatch) {
      const raw = statusMatch[1]
      const clean = stripMarkup(raw)
      statusLines.push({ file: p, clean })
      const hits = STATUS_VALUES.filter((value) => clean.includes(value))
      if (hits.length === 0) {
        add('C1b', p, `状态行取值不在受控词表 [${STATUS_VALUES.join(' / ')}]：${clean.slice(0, 30)}`)
      } else if (hits.length > 1) {
        add('C1b', p, `状态行同时出现多个受控词（${hits.join(' + ')}），无法判定：${clean.slice(0, 30)}`)
      } else if (!STATUS_DATE.test(raw)) {
        add('C1b', p, `状态行缺日期（YYYY-MM-DD）：${clean.slice(0, 30)}`)
      }
    }
  }

  // C2 索引登记：设计稿必须出现在 docs/README.md 的索引里
  if (isDesignDoc(p)) {
    const base = path.basename(p)
    if (!indexText.includes(base)) add('C2', p, '未在 docs/README.md §4 索引中登记')
  }

  // C3 命名：小写 ASCII + 数字 + 连字符/点，不允许中文与空格
  if (isDesignDoc(p)) {
    const base = path.basename(p)
    if (!/^[a-z0-9][a-z0-9.-]*\.md$/.test(base)) {
      add('C3', p, '文件名需为小写 ASCII（数字/连字符/点），见 docs/README.md §3.3')
    }
  }

  // C5 禁放区：docs/plans 下不得新增设计稿/评估稿
  if (p.startsWith('docs/plans/') && /-(design|assessment)\.md$/.test(p)) {
    add('C5', p, 'plans/ 只放台账与冻结合同，设计稿应进 docs/design/<主题>/')
  }

  // C4 + C6 链接：目标目录必须存在；其余相对链接不得断链
  for (const match of text.matchAll(/\]\(([^)\s#]+)(#[^)\s]*)?\)/g)) {
    const target = match[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/') || target.startsWith('#')) continue
    if (LINK_IGNORE.some((rule) => p.endsWith(rule.split(':')[0]) && target.startsWith(rule.split(':')[1]))) continue
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target))
    if (target.endsWith('/')) {
      if (!fs.existsSync(resolved)) add('C4', p, `指向的目录不存在：${target}`)
      continue
    }
    if (!fs.existsSync(resolved)) add('C6', p, `断链：${target}`)
  }
}

// C7：本机 AGENTS.md 与章程的 charter-version 必须一致（两边都是手写的常驻规则，最容易漂）
const AGENTS_FILE = path.join(ROOT, 'AGENTS.md')
const CHARTER_FILE = path.join(DOCS, 'agents', 'documentation-charter.md')
const versionOf = (file) => {
  if (!fs.existsSync(file)) return null
  const m = fs.readFileSync(file, 'utf8').match(/charter-version\s*[:：]\s*([0-9][0-9-]*)/)
  return m ? m[1] : null
}
const agentsVersion = versionOf(AGENTS_FILE)
const charterVersion = versionOf(CHARTER_FILE)
if (agentsVersion && charterVersion && agentsVersion !== charterVersion) {
  add('C7', 'AGENTS.md', `charter-version ${agentsVersion} ≠ 章程 ${charterVersion}`)
}

// 同一文件同一码同一细节只报一次
const seen = new Set()
const unique = findings.filter((f) => {
  const key = `${f.code}|${f.file}|${f.detail}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
unique.sort((a, b) => a.code.localeCompare(b.code) || a.file.localeCompare(b.file))

// ── --status-of "<文本>"：把「写着某个状态」的位置列全 ─────────────────────────
//
// 硬规则 3 要求「收口一期要改所有写着该期状态的位置 —— 顶部状态行、分期表、台账、
// 路线图表」。靠记忆找必然漏（2026-10-30 就漏了：`e704a697` 说期 2 完成，主稿与
// 子稿的状态行还写着未开工/未改代码）。这条命令只负责**把该看的地方列全**，
// 不判定谁对谁错 —— 真假要人（或将来 B 档的登记表）判。
//
// 它扫的是**整份文档**里的状态行，不止头部那一行。
const statusOfIndex = process.argv.indexOf('--status-of')
if (statusOfIndex !== -1) {
  const needle = process.argv[statusOfIndex + 1]
  if (!needle) {
    console.error('用法：node scripts/check-doc-placement.mjs --status-of "期 2"')
    process.exit(2)
  }
  const all = []
  for (const file of files) {
    const p = rel(file)
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      if (!/状态/u.test(line) || !line.includes(needle)) continue
      if (!/^\s*[>|]|^\s*\|/u.test(line) && !/^\s*>/u.test(line)) continue
      all.push({ file: p, line: stripMarkup(line).slice(0, 100) })
    }
  }
  console.log(`含「${needle}」的状态表述共 ${all.length} 处，分布在 ${new Set(all.map((item) => item.file)).size} 个文件：`)
  for (const item of all) console.log(`  ${item.file}\n    ${item.line}`)
  console.log('\n收口口径（硬规则 3）：逐处确认是「该改」还是「历史记录不必改」，改完再跑一次本命令，直到列表为空或只剩历史记录。')
  process.exit(0)
}

const keyOf = (f) => `${f.code} ${f.file}`
const rawBaseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : null
const baselineItems = Array.isArray(rawBaseline) ? rawBaseline : (rawBaseline?.items ?? [])
const baseline = new Set(baselineItems.map((item) => item.key))

if (process.argv.includes('--update-baseline')) {
  const payload = {
    updatedAt: new Date().toISOString().slice(0, 10),
    note: '存量违规基线。只允许随违规修复而缩小；新增违规不得写入本文件。',
    items: unique.map((f) => ({ key: keyOf(f), code: f.code, file: f.file, detail: f.detail })),
  }
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`doc placement: baseline 已更新，登记存量违规 ${unique.length} 条 -> ${rel(BASELINE_FILE)}`)
  process.exit(0)
}

const fresh = unique.filter((f) => !baseline.has(keyOf(f)))
const fixed = [...baseline].filter((key) => !unique.some((f) => keyOf(f) === key))

console.log(`doc placement: 扫描 ${files.length} 份 md，当前违规 ${unique.length} 条，基线内 ${unique.length - fresh.length} 条，新增 ${fresh.length} 条`)
for (const code of Object.keys(C)) {
  const group = unique.filter((f) => f.code === code)
  if (group.length === 0) continue
  console.log(`\n[${code}] ${C[code]}（${group.length}）`)
  for (const f of group) console.log(`  ${baseline.has(keyOf(f)) ? '·' : '+'} ${f.file}${f.detail ? ` — ${f.detail}` : ''}`)
}
if (fresh.length > 0) {
  console.log('\n新增违规（必须修，或先补进基线并写明理由）：')
  for (const f of fresh) console.log(`  + [${f.code}] ${f.file} — ${f.detail}`)
}
if (fixed.length > 0) {
  console.log(`\n基线里已修复 ${fixed.length} 条，建议跑 --update-baseline 收窄基线：`)
  for (const key of fixed) console.log(`  - ${key}`)
}

const strict = process.argv.includes('--strict')
if (strict && fresh.length > 0) process.exit(1)
process.exit(0)
