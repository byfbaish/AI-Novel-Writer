#!/usr/bin/env node
// 只读机检：协作介质（.batch/night/**）的卫生规则。**不改任何文件**（`--write-baseline` 除外，它只写 baseline 文件）。
//
// 三条规则（口径见 .batch/night/org/ruling-git-workflow-1117.md §二·1/4/8）：
//   1. 尾行换行   .batch/night/**/*.md 的末字节必须是换行；不允许以连续空行结尾
//                 （末行无换行会让 `wc -l` 与 `awk NR` 恒差 1，指标本身不确定）。
//   2. 禁版本号文件名  路径里带 `.v3.` / `-v3` 一律不合规（版本由 git 承担）；
//                 `.batch/night/archive/` 与 `.batch/night/staging/` 豁免（历史件、中间稿）。
//   3. 缺卡号提醒  `--staged` 模式下读 COMMIT_EDITMSG，不含 `CARD-<数字>` 时**只提醒**、
//                 不影响退出码（拦死只会把人逼到 --no-verify）。
//
// 生效面（CARD-1117-E 改定）：
//   --all   门禁面＝`git ls-files` 已跟踪路径。未跟踪的历史件不进门禁，收编后才进。
//   --disk  统计面＝遍历磁盘全量（含未跟踪件、含被忽略件），**只统计，不作门禁**。
//   --staged  门禁面＝本次暂存内容（pre-commit 用）。
//
// baseline（冻结的历史条目清单，不是豁免声明）：
//   文件头三行必写 `# 条目数：<N>`、`# 生成 SHA：<commit>`、`# 生成命令：<命令>`；
//   之后每行一条仓库相对路径，`#` 起注释、空行忽略。缺头行、条目数与实际不符 ⇒ 报错退出（不静默降级）。
//   豁免只在「该路径不在本次变更集里」时生效：不动的历史件不罚，一旦被改动（含改名）照常按新规则检查。
//
// 输出：每个不合规项一行 `路径 · 规则名 · 判据`，末尾一行 `N 项不合规`；有不合规即 exit 1。
// **输出里不出现字节／md5／行数**——三元组不进协作件，也不进机检报告。
//
// 用法：
//   node scripts/ops/check-batch-hygiene.mjs --staged            # pre-commit 用：只看暂存内容
//   node scripts/ops/check-batch-hygiene.mjs --all               # check:fast 用：只看已跟踪路径
//   node scripts/ops/check-batch-hygiene.mjs --disk              # 统计全盘（含未跟踪历史件）
//   node scripts/ops/check-batch-hygiene.mjs --disk --write-baseline   # 冻结当前不合规清单（一次性）
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const RULE_TRAILING = 'trailing-newline'
export const RULE_VERSIONED = 'versioned-filename'
export const WATCH_ROOT = '.batch/night'
export const EXEMPT_VERSIONED_DIRS = [`${WATCH_ROOT}/archive/`, `${WATCH_ROOT}/staging/`]
/**
 * 尾行检查的目录豁免面（与版本文件名豁免面分开维护）：
 * archive/ 是「原样留档、事后哈希对账」的冻结区，补末行换行会改归档件字节，
 * 故只对尾行规则放行 archive/；staging/、cards/、reports/ 仍照常检查。
 */
export const EXEMPT_TRAILING_DIRS = [`${WATCH_ROOT}/archive/`]
export const CARD_NO_PATTERN = /CARD-\d+/u
export const VERSIONED_PATTERNS = [/\.v\d+\./u, /-v\d+$/u]
export const DEFAULT_BASELINE = 'scripts/ops/hygiene-baseline.txt'
export const BASELINE_COMMAND = 'node scripts/ops/check-batch-hygiene.mjs --disk --write-baseline'
export const DISK_NOTICE = '磁盘模式：含未跟踪历史件，仅作统计，不作门禁（统计面 ≠ 门禁面）'
export const BASELINE_HEADERS = ['# 条目数：', '# 生成 SHA：', '# 生成命令：']

/**
 * 判一条路径是否落在本次检查范围（.batch/night/**）。
 * @param {string} repoRelPath 仓库相对路径，posix 分隔符
 */
export function inScope(repoRelPath) {
  return repoRelPath === WATCH_ROOT || repoRelPath.startsWith(WATCH_ROOT + '/')
}

/**
 * 规则 1：尾行换行。返回 null 表示合规，否则返回判据文字。
 * @param {string} content 文件内容（UTF-8 文本）
 */
export function checkTrailingNewline(content) {
  if (content.length === 0) return '内容为空，末字节不是换行'
  if (!content.endsWith('\n')) return '末字节不是换行（末行缺换行）'
  const withoutLast = content.slice(0, -1)
  if (withoutLast.endsWith('\n')) return '以连续空行结尾（末行是空行）'
  return null
}

/**
 * 判一条路径是否豁免尾行检查（只看 EXEMPT_TRAILING_DIRS 前缀）。
 * @param {string} repoRelPath 仓库相对路径，posix 分隔符
 */
export function isTrailingExempt(repoRelPath) {
  return EXEMPT_TRAILING_DIRS.some((dir) => repoRelPath.startsWith(dir))
}

/**
 * 规则 2：禁版本号文件名。返回 null 表示合规（或落在豁免目录）。
 * @param {string} repoRelPath 仓库相对路径，posix 分隔符
 */
export function checkVersionedName(repoRelPath) {
  if (EXEMPT_VERSIONED_DIRS.some((dir) => repoRelPath.startsWith(dir))) return null
  const base = repoRelPath.split('/').pop() ?? ''
  const withoutExt = base.replace(/\.[^.]+$/u, '')
  const hitFull = VERSIONED_PATTERNS[0].test(repoRelPath)
  const hitBase = VERSIONED_PATTERNS[0].test(base) || VERSIONED_PATTERNS[1].test(withoutExt)
  if (hitFull || hitBase) return '文件名带版本号（版本由 git 承担，请去掉 .vN/-vN）'
  return null
}

/**
 * 对一组「路径 + 内容」批量判规则，返回不合规项数组（保持输入顺序）。
 * @param {Array<{path: string, content: string}>} files
 */
export function collectViolations(files) {
  const violations = []
  for (const file of files) {
    if (!inScope(file.path)) continue
    const versioned = checkVersionedName(file.path)
    if (versioned) violations.push({ path: file.path, rule: RULE_VERSIONED, reason: versioned })
    if (file.path.endsWith('.md') && !isTrailingExempt(file.path)) {
      const trailing = checkTrailingNewline(file.content)
      if (trailing) violations.push({ path: file.path, rule: RULE_TRAILING, reason: trailing })
    }
  }
  return violations
}

/**
 * 渲染为「每项一行 + 汇总一行」。
 * @param {Array<{path: string, rule: string, reason: string}>} violations
 */
export function renderReport(violations) {
  const lines = violations.map((v) => `${v.path} · ${v.rule} · ${v.reason}`)
  lines.push(`${violations.length} 项不合规`)
  return lines.join('\n')
}

/**
 * 解析 `git status --porcelain -z` 输出为路径集合（含未跟踪件）。改名同时收新旧两路径。
 * @param {string} text 状态输出
 */
export function changeSetFromPorcelain(text) {
  const parts = text.split('\0').filter(Boolean)
  const paths = new Set()
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i]
    const code = entry.slice(0, 2)
    const rel = entry.slice(3)
    if (code.includes('R') || code.includes('C')) {
      if (rel) paths.add(rel)
      const original = parts[i + 1]
      i += 1
      if (original) paths.add(original)
      continue
    }
    if (rel) paths.add(rel)
  }
  return paths
}

/**
 * 解析 baseline 文本。头三行缺失、条目数与实际不符 ⇒ 返回 error（调用方报错退出）。
 * @param {string} text baseline 全文
 */
export function parseBaseline(text) {
  const lines = text.split('\n')
  const head = lines.slice(0, 3)
  const missing = BASELINE_HEADERS.filter((header, idx) => !(head[idx] ?? '').startsWith(header))
  if (missing.length > 0) {
    return { error: `baseline 头三行缺 ${missing.join(' / ')}（无头行不得当「无豁免」处理）` }
  }
  const entries = new Set()
  for (const line of lines.slice(3)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    entries.add(trimmed)
  }
  const declared = Number(head[0].slice(BASELINE_HEADERS[0].length).trim())
  if (!Number.isInteger(declared)) {
    return { error: `baseline 头行「条目数」不是整数：${head[0]}` }
  }
  if (declared !== entries.size) {
    return { error: `baseline 条目数与实际不符：头行 ${declared}、实际 ${entries.size}` }
  }
  return { entries, declared }
}

/**
 * 渲染 baseline 文本：头三行 + 排序后的路径清单。
 * @param {string[]} paths 仓库相对路径
 * @param {{sha: string, command?: string}} meta
 */
export function renderBaseline(paths, meta) {
  const unique = [...new Set(paths)].sort((a, b) => a.localeCompare(b, 'en'))
  const head = [
    `${BASELINE_HEADERS[0]}${unique.length}`,
    `${BASELINE_HEADERS[1]}${meta.sha}`,
    `${BASELINE_HEADERS[2]}${meta.command ?? BASELINE_COMMAND}`,
  ]
  return [...head, ...unique].join('\n') + '\n'
}

/**
 * 应用 baseline 豁免：命中清单且**不在本次变更集**里才跳过。
 * @param {Array<{path: string, rule: string, reason: string}>} violations
 * @param {Set<string>|null} entries baseline 条目；null＝无 baseline
 * @param {Set<string>} changed 本次变更集路径
 */
export function applyBaseline(violations, entries, changed) {
  if (!entries || entries.size === 0) return { kept: violations, skipped: [] }
  const kept = []
  const skipped = []
  for (const violation of violations) {
    if (entries.has(violation.path) && !changed.has(violation.path)) skipped.push(violation)
    else kept.push(violation)
  }
  return { kept, skipped }
}

function git(args, opts = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true, ...opts })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败：${(result.stderr || '').trim()}`)
  }
  return result.stdout
}

function readIfExists(absPath) {
  if (!fs.existsSync(absPath)) return null
  return fs.readFileSync(absPath, 'utf8')
}

function stagedFiles(repoRoot) {
  const out = git(['-C', repoRoot, 'diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((rel) => inScope(rel))
    .map((rel) => ({
      path: rel,
      content: git(['-C', repoRoot, 'show', `:${rel}`], { encoding: 'utf8' }),
    }))
}

/** 门禁扫描面：git 已跟踪路径（未跟踪件不进门禁；文件在盘上缺失则跳过）。 */
function trackedFiles(repoRoot) {
  const out = git(['-C', repoRoot, 'ls-files', '-z', '--', WATCH_ROOT])
  return out
    .split('\0')
    .filter(Boolean)
    .map((rel) => ({ path: rel, content: readIfExists(path.join(repoRoot, rel)) }))
    .filter((file) => file.content !== null)
}

function walkWorkTree(repoRoot) {
  const root = path.join(repoRoot, WATCH_ROOT)
  const files = []
  const visit = (absDir) => {
    if (!fs.existsSync(absDir)) return
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const abs = path.join(absDir, entry.name)
      if (entry.isDirectory()) {
        visit(abs)
        continue
      }
      if (!entry.isFile()) continue
      const rel = path.relative(repoRoot, abs).split(path.sep).join('/')
      files.push({ path: rel, content: fs.readFileSync(abs, 'utf8') })
    }
  }
  visit(root)
  return files
}

function changeSet(repoRoot) {
  const out = git([
    '-C',
    repoRoot,
    'status',
    '--porcelain',
    '-z',
    '--untracked-files=all',
    '--',
    WATCH_ROOT,
  ])
  return changeSetFromPorcelain(out)
}

function loadBaseline(repoRoot, baselineRel) {
  const abs = path.isAbsolute(baselineRel) ? baselineRel : path.join(repoRoot, baselineRel)
  if (!fs.existsSync(abs)) return { entries: null, path: baselineRel }
  const parsed = parseBaseline(fs.readFileSync(abs, 'utf8'))
  if (parsed.error) return { error: `${baselineRel}：${parsed.error}` }
  return { entries: parsed.entries, path: baselineRel }
}

function commitMessageReminder(repoRoot) {
  const gitPath = git(['-C', repoRoot, 'rev-parse', '--git-path', 'COMMIT_EDITMSG']).trim()
  const abs = path.isAbsolute(gitPath) ? gitPath : path.join(repoRoot, gitPath)
  if (!fs.existsSync(abs)) return null
  const message = fs.readFileSync(abs, 'utf8')
  if (message.trim() === '') return null
  // 提交信息里已有卡号，或已是 merge/revert 这类自动生成的，不提醒
  if (CARD_NO_PATTERN.test(message)) return null
  if (/^Merge |^Revert |^fixup! |^squash! /mu.test(message)) return null
  return '提交信息缺卡号 CARD-xxxx（只提醒，不拦提交）'
}

function repoRoot() {
  return git(['rev-parse', '--show-toplevel']).trim()
}

function parseArgs(argv) {
  const opts = { mode: null, baseline: DEFAULT_BASELINE, writeBaseline: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--all' || arg === '--disk' || arg === '--staged') {
      const mode = arg.slice(2)
      if (opts.mode && opts.mode !== mode) {
        console.error(`模式互斥：已给 --${opts.mode}，又给 ${arg}`)
        return null
      }
      opts.mode = mode
      continue
    }
    if (arg === '--write-baseline') {
      opts.writeBaseline = true
      continue
    }
    if (arg === '--baseline') {
      opts.baseline = argv[i + 1] ?? ''
      i += 1
      if (!opts.baseline) {
        console.error('--baseline 需要一个路径')
        return null
      }
      continue
    }
    if (arg.startsWith('--baseline=')) {
      opts.baseline = arg.slice('--baseline='.length)
      if (!opts.baseline) {
        console.error('--baseline 需要一个路径')
        return null
      }
      continue
    }
    console.error(`未知参数：${arg}`)
    return null
  }
  if (!opts.mode) {
    console.error('用法：node scripts/ops/check-batch-hygiene.mjs [--staged|--all|--disk] [--baseline <path>] [--write-baseline]')
    return null
  }
  if (opts.writeBaseline && opts.mode !== 'disk') {
    console.error('--write-baseline 只能配合 --disk 使用（它冻结的是磁盘全量扫描的不合规清单）')
    return null
  }
  return opts
}

function writeBaselineFile(repoRoot, baselineRel, violations) {
  const abs = path.isAbsolute(baselineRel) ? baselineRel : path.join(repoRoot, baselineRel)
  const sha = git(['-C', repoRoot, 'rev-parse', '--short', 'HEAD']).trim()
  const text = renderBaseline(
    violations.map((v) => v.path),
    { sha },
  )
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, text, 'utf8')
  const entries = new Set(violations.map((v) => v.path)).size
  console.log(`写入 ${baselineRel}（--disk 生成：${violations.length} 处不合规、${entries} 条路径）`)
}

function main(argv) {
  const opts = parseArgs(argv)
  if (!opts) {
    process.exit(2)
  }
  const root = repoRoot()
  const files =
    opts.mode === 'all' ? trackedFiles(root) : opts.mode === 'disk' ? walkWorkTree(root) : stagedFiles(root)
  if (opts.mode === 'disk') console.log(DISK_NOTICE)

  if (opts.writeBaseline) {
    const violations = collectViolations(files)
    writeBaselineFile(root, opts.baseline, violations)
    process.exit(0)
  }

  // --disk 是统计面，不应用 baseline：豁免只影响门禁面，否则「历史件没被掩盖」就无从证明
  if (opts.mode === 'disk') {
    const violations = collectViolations(files)
    console.log(renderReport(violations))
    if (violations.length > 0) {
      console.log('修法：给缺换行的文件末尾补一个换行；带版本号的文件用 `git mv` 改名（archive/ 与 staging/ 下豁免）；历史件本身不动则进 baseline 冻结清单。')
      process.exit(1)
    }
    process.exit(0)
  }

  const baseline = loadBaseline(root, opts.baseline)
  if (baseline.error) {
    console.error(baseline.error)
    process.exit(2)
  }
  const { kept, skipped } = applyBaseline(collectViolations(files), baseline.entries, changeSet(root))
  console.log(renderReport(kept))
  if (skipped.length > 0) {
    console.log(`（baseline 冻结清单豁免 ${skipped.length} 项：清单内且本次未改动）`)
  }
  if (kept.length > 0) {
    console.log('修法：给缺换行的文件末尾补一个换行；带版本号的文件用 `git mv` 改名（archive/ 与 staging/ 下豁免）；历史件本身不动则进 baseline 冻结清单。')
    process.exit(1)
  }
  if (opts.mode === 'staged') {
    const reminder = commitMessageReminder(root)
    if (reminder) console.log(reminder)
  }
  process.exit(0)
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (invokedDirectly) main(process.argv.slice(2))
