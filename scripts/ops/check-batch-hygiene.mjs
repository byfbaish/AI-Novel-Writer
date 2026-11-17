#!/usr/bin/env node
// 只读机检：协作介质（.batch/night/**）的卫生规则。**不改任何文件**。
//
// 三条规则（口径见 .batch/night/org/ruling-git-workflow-1117.md §二·1/4/8）：
//   1. 尾行换行   .batch/night/**/*.md 的末字节必须是换行；不允许以连续空行结尾
//                 （末行无换行会让 `wc -l` 与 `awk NR` 恒差 1，指标本身不确定）。
//   2. 禁版本号文件名  路径里带 `.v3.` / `-v3` 一律不合规（版本由 git 承担）；
//                 `.batch/night/archive/` 与 `.batch/night/staging/` 豁免（历史件、中间稿）。
//   3. 缺卡号提醒  `--staged` 模式下读 COMMIT_EDITMSG，不含 `CARD-<数字>` 时**只提醒**、
//                 不影响退出码（拦死只会把人逼到 --no-verify）。
//
// 输出：每个不合规项一行 `路径 · 规则名 · 判据`，末尾一行 `N 项不合规`；有不合规即 exit 1。
// **输出里不出现字节／md5／行数**——三元组不进协作件，也不进机检报告。
//
// 用法：
//   node scripts/ops/check-batch-hygiene.mjs --staged   # pre-commit 用：只看暂存内容
//   node scripts/ops/check-batch-hygiene.mjs --all      # check:fast 用：看整个工作树
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export const RULE_TRAILING = 'trailing-newline'
export const RULE_VERSIONED = 'versioned-filename'
export const WATCH_ROOT = '.batch/night'
export const EXEMPT_VERSIONED_DIRS = [`${WATCH_ROOT}/archive/`, `${WATCH_ROOT}/staging/`]
export const CARD_NO_PATTERN = /CARD-\d+/u
export const VERSIONED_PATTERNS = [/\.v\d+\./u, /-v\d+$/u]

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
    if (file.path.endsWith('.md')) {
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

function git(args, opts = {}) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true, ...opts })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败：${(result.stderr || '').trim()}`)
  }
  return result.stdout
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

function main(argv) {
  const mode = argv.includes('--all') ? 'all' : argv.includes('--staged') ? 'staged' : null
  if (!mode) {
    console.error('用法：node scripts/ops/check-batch-hygiene.mjs [--staged|--all]')
    process.exit(2)
  }
  const root = repoRoot()
  const files = mode === 'all' ? walkWorkTree(root) : stagedFiles(root)
  const violations = collectViolations(files)
  console.log(renderReport(violations))
  if (violations.length > 0) {
    console.log('修法：给缺换行的文件末尾补一个换行；带版本号的文件用 `git mv` 改名（archive/ 与 staging/ 下豁免）。')
    process.exit(1)
  }
  if (mode === 'staged') {
    const reminder = commitMessageReminder(root)
    if (reminder) console.log(reminder)
  }
  process.exit(0)
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (invokedDirectly) main(process.argv.slice(2))
