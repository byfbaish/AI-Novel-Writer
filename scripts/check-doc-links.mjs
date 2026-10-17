#!/usr/bin/env node
// 文档链接检查：防止 docs 重组后留下断链。
// 用法：node scripts/check-doc-links.mjs [--json]
// 规则：只检查仓库内相对链接；外部 URL、纯锚点、以及 IGNORE 中登记的说明性路径跳过。
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs')

// 说明性路径：设计稿里用作「示例目录」的假路径，不是真实导航目标。
const IGNORE = [
  'debug-prompt-trace-design.md:8f3a21c0/',
]

const SKIP_DIRS = new Set(['node_modules', '.git', '.runtime', '.worktrees', '.pnpm-store', '.workbuddy'])

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.md$/i.test(entry.name)) out.push(full)
  }
}

const files = []
walk(DOCS, files)
for (const name of fs.readdirSync(ROOT)) {
  if (/\.md$/i.test(name)) files.push(path.join(ROOT, name))
}

const broken = []
let checked = 0
for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/')
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(/\]\(([^)\s#]+)(#[^)\s]*)?\)/g)) {
    const target = match[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/') || target.startsWith('#')) continue
    if (IGNORE.some(rule => rel.endsWith(rule.split(':')[0]) && target.startsWith(rule.split(':')[1]))) continue
    checked += 1
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target))
    if (!fs.existsSync(resolved)) broken.push(`${rel} -> ${target}`)
  }
}

const json = process.argv.includes('--json')
if (json) console.log(JSON.stringify({ checked, broken }, null, 2))
else {
  console.log(`doc links: checked ${checked}, broken ${broken.length}`)
  for (const item of broken) console.log('  ' + item)
}
process.exit(broken.length === 0 ? 0 : 1)
