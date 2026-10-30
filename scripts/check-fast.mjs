#!/usr/bin/env node
// 闸门「快档」的唯一实现：typecheck + 两个文档检查。约 20–30 秒。
//
// 为什么单独一个脚本而不是 package.json 里用 `&&` 串起来：
//
// **`pnpm` 在本机的 sh 环境里是坏的**（`npm/node_modules/node/bin/node: line 1: This: command not found`
// —— npm 全局 shim 的内容被 sh 当成脚本读了）。而 git hook 恰恰是用 sh 执行的，
// 于是 pre-commit 里只要写 `pnpm ...`，就会**因为环境坏了而不是因为代码坏了**把每次提交挡住。
// 那种闸门第一天就会被 `git commit --no-verify` 绕过，等于没有。
//
// 所以：**hook → node → 本脚本**，全程不经过 pnpm。子命令一律用 `process.execPath` 直接拉起，
// 既绕开 shim，也保证用的是同一个 node。
//
// 用法：
//   node scripts/check-fast.mjs      # 闸门档
//   pnpm check:fast                  # 同上（package.json 的别名，人手动跑时用）
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const steps = [
  { name: 'typecheck', args: [path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'] },
  { name: 'doc-links', args: [path.join(ROOT, 'scripts', 'check-doc-links.mjs')] },
  { name: 'doc-placement', args: [path.join(ROOT, 'scripts', 'check-doc-placement.mjs'), '--strict'] },
]

for (const step of steps) {
  const entry = step.args[0]
  if (!fs.existsSync(entry)) {
    console.error(`[check:fast] 找不到 ${path.relative(ROOT, entry)} —— 先跑 pnpm install。`)
    process.exit(1)
  }
  const started = Date.now()
  // stdio: 'inherit' 是为了让 tsc 的错误行号原样透出，不被吞掉
  const result = spawnSync(process.execPath, step.args, { cwd: ROOT, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) {
    console.error(`\n[check:fast] ${step.name} 失败（${((Date.now() - started) / 1000).toFixed(1)}s）。修完再提交。`)
    process.exit(result.status ?? 1)
  }
  console.log(`[check:fast] ${step.name} ✓ ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

console.log('[check:fast] 全部通过。')
