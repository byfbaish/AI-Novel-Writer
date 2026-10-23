#!/usr/bin/env node
/* global process */
/**
 * 修复「草稿来源依赖」里过期的前文内容指纹（`GENERATION_DRAFT_SOURCE_STALE`）。
 *
 * 背景（2026-10-24 实测）：`source_dependencies` 每条记着「我所依据的前文草稿当时的内容 sha256」。
 * 提交新草稿时 `DraftRepository.create` 会**递归**校验整条链（ch4 → ch3 → ch2 → ch1），
 * 任何一环的前文内容变了、而这条依赖没跟着更新，提交就会被拒。
 *
 * 已知会留下这种债的路径：批量脚本直接改写正文（例如 W2 把「不到五十枚」修正成「不到十枚」），
 * 或 `repair-finalization-receipts.mjs` 把定稿收据对齐到新正文 —— 收据自洽了，下游却没跟着更新。
 * 表现是：之后所有新章节都提交不了，而作者只看到 `GENERATION_REQUEST_FAILED:Error`。
 *
 * 用法（必须用 Electron 当 Node 跑：项目依赖 better-sqlite3 的 Electron ABI）：
 *   dry-run（默认，只打印将要做的修改）：
 *     ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe \
 *       scripts/repair-stale-draft-dependencies.mjs --project "<项目根目录>"
 *   实际写入（先自动备份 .ai-novel/project.db）：
 *     ... --project "<项目根目录>" --apply
 *
 * 它只改 `source_dependencies` 里的 `contentHash`，**不动正文、不动定稿回执**。
 * 语义前提：前文的改动是作者认可的（脚本无法判断，请先看 dry-run 清单再 --apply）。
 */
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { applyStaleDependencyRepair, findStaleDependencies } from './lib/draft-dependency-repair.mjs'

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const projectRoot = arg('project')
const apply = process.argv.includes('--apply')
if (!projectRoot) {
  console.error('缺少 --project <项目根目录>')
  process.exit(2)
}
const dbPath = join(projectRoot, '.ai-novel', 'project.db')
if (!existsSync(dbPath)) {
  console.error(`找不到数据库：${dbPath}`)
  process.exit(2)
}

const db = new Database(dbPath, { readonly: !apply })
const repairs = findStaleDependencies(db)

if (!repairs.length) {
  console.log('没有发现过期依赖，无需修复。')
  db.close()
  process.exit(0)
}

console.log(`发现 ${repairs.length} 处过期依赖：`)
for (const item of repairs) {
  console.log(`  ${item.owner} → 依赖 ${item.dependsOn}：${item.from} → ${item.to}`)
}

if (!apply) {
  console.log('\n这是 dry-run。确认上面的改动符合预期后，加 --apply 执行（会先备份数据库）。')
  db.close()
  process.exit(0)
}

const backup = `${dbPath}.bak-stale-deps-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`
copyFileSync(dbPath, backup)
console.log(`\n已备份：${backup}`)

const touched = db.transaction(() => applyStaleDependencyRepair(db))()
console.log(`已更新 ${touched} 个草稿的依赖指纹。重新生成该章并提交即可。`)
db.close()
