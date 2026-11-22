#!/usr/bin/env node
// 安装/刷新本地 git hook。挂在 `prepare` 上，所以 `pnpm install` 之后自动生效；
// 也可以手动跑 `pnpm hooks:install`（改过本脚本或 hook 内容后需要重跑）。
//
// 只装一个 hook：`pre-commit` → `pnpm check:fast` → 协作介质卫生检查
// （`scripts/ops/check-batch-hygiene.mjs --staged`：尾行换行、禁版本号文件名，见
//  .batch/night/org/ruling-git-workflow-1117.md §二·1/4/8）。
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

# 分支闸门（2026-11-22）：协作文档 .batch/ 只准提交到主线。
# 教训：主身的一笔 docs 提交落在 card/s3-d16-indicator-verify（4ef01457）上，
# 卡分支因此凭空多出一笔，只能 cherry-pick 回主线再 branch -f 回退。
# 只拦 .batch/（卡面/判词/派单/报告这些协作介质），产品码在卡分支上照常提交。
branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "exp/mainline-1119" ]; then
  docs_staged=$(git diff --cached --name-only --diff-filter=ACMR -- '.batch/')
  if [ -n "$docs_staged" ]; then
    echo ""
    echo "提交被拦住：当前分支 $branch 不是 exp/mainline-1119，暂存区却含协作文档："
    echo "$docs_staged"
    echo "协作文档（.batch/）一律提交到主线：git switch exp/mainline-1119 后再提交。"
    echo "确属例外请用 --no-verify，并在提交信息里写明理由。"
    exit 1
  fi
fi

node scripts/check-fast.mjs || {
  echo ""
  echo "提交被拦住：pnpm check:fast 未通过。修完再提交，或用 --no-verify 并说明理由。"
  exit 1
}

# 协作介质卫生：尾行换行、禁版本号文件名（.batch/night/archive 与 staging 豁免）。
# 只读检查，不改文件；失败时打印修法，不替人改。
node scripts/ops/check-batch-hygiene.mjs --staged || {
  echo ""
  echo "提交被拦住：协作介质卫生检查未通过（尾行换行／带版本号文件名）。"
  echo "修法：给文件末尾补一个换行（printf '\\n' >> <path>）；带 .vN 的文件用 git mv 改名。"
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
console.log(`[hooks] 已写入 ${path.relative(ROOT, target)}（pre-commit → pnpm check:fast → 协作介质卫生检查）`)
