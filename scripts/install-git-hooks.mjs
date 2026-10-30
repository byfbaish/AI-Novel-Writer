#!/usr/bin/env node
// 安装/刷新本地 git hook。挂在 `prepare` 上，所以 `pnpm install` 之后自动生效；
// 也可以手动跑 `pnpm hooks:install`（改过本脚本或 hook 内容后需要重跑）。
//
// 只装一个 hook：`pre-commit` → `pnpm check:fast`。
//
// ## 为什么 pre-commit 只跑 fast 档
//
// 全量测试在本机是 **20 分钟起步且当前不稳**（2026-10-31 实测：单进程全量跑到文件列表
// 打完就没有汇总，连跑 3 次都是）。把它塞进 pre-commit，第一天就会被 `--no-verify` 绕过去
// —— 闸门一旦被绕，就退化成"写在文档里的规则"，正是本机制要消灭的东西。
// 所以：**快的用闸门拦，慢的留给 `pnpm check:full` 手动跑**（口径见
// docs/agents/documentation-charter.md §9）。
//
// ## 为什么失败也要 exit 0
//
// 本脚本还挂在 `prepare` 上。如果它 exit 1，`pnpm install` 就会整体失败 ——
// 而"装了依赖但 hook 没装上"不该阻断任何人装依赖。装没装上看打印。
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const MARKER = '# generated-by: scripts/install-git-hooks.mjs'
const HOOK = `#!/bin/sh
${MARKER}
# 提交前闸门：只跑快档（typecheck + 文档检查），约 25 秒。
# 全量测试不在这里 —— 理由见 docs/agents/documentation-charter.md §9。
#
# 为什么直接调 node 而不是 pnpm：本机的 pnpm 在 sh 里会报
#   npm/node_modules/node/bin/node: line 1: This: command not found
# （npm 全局 shim 的内容被 sh 当脚本读了）。hook 是 sh 跑的，写 pnpm 就会
# 「因为环境坏了而不是代码坏了」把每次提交挡住 —— 那种闸门只会被 --no-verify 绕过。
node scripts/check-fast.mjs || {
  echo ""
  echo "提交被拦住：pnpm check:fast 未通过。修完再提交，或用 --no-verify 并说明理由。"
  exit 1
}
`

function gitHooksDir() {
  const dotGit = path.join(ROOT, '.git')
  if (!fs.existsSync(dotGit)) return null
  // worktree / submodule：`.git` 是一个文本文件，里面写着真正的 gitdir
  if (fs.statSync(dotGit).isFile()) {
    const match = fs.readFileSync(dotGit, 'utf8').match(/gitdir:\s*(.+)/u)
    if (!match) return null
    const resolved = path.resolve(ROOT, match[1].trim())
    // worktree 的 hooks 是共享的，在 common dir 下
    const commonFile = path.join(resolved, 'commondir')
    const common = fs.existsSync(commonFile)
      ? path.resolve(resolved, fs.readFileSync(commonFile, 'utf8').trim())
      : resolved
    return path.join(common, 'hooks')
  }
  return path.join(dotGit, 'hooks')
}

const hooksDir = gitHooksDir()
if (!hooksDir) {
  console.log('[hooks] 不在 git 仓库里（没有 .git），跳过。')
  process.exit(0)
}
if (!fs.existsSync(hooksDir)) {
  try { fs.mkdirSync(hooksDir, { recursive: true }) } catch {
    console.log(`[hooks] 无法创建 ${hooksDir}，跳过。`)
    process.exit(0)
  }
}

const target = path.join(hooksDir, 'pre-commit')
if (fs.existsSync(target)) {
  const current = fs.readFileSync(target, 'utf8')
  if (!current.includes(MARKER)) {
    console.log(`[hooks] ${target} 已存在且不是本脚本生成的，未覆盖。`)
    console.log('        要接管它：手动删除后重跑 `pnpm hooks:install`。')
    process.exit(0)
  }
  if (current === HOOK) {
    console.log('[hooks] pre-commit 已是最新，无需改动。')
    process.exit(0)
  }
}

fs.writeFileSync(target, HOOK, { mode: 0o755 })
try { fs.chmodSync(target, 0o755) } catch { /* Windows 上没有意义，忽略 */ }
console.log(`[hooks] 已写入 ${path.relative(ROOT, target)}（pre-commit → pnpm check:fast）`)
