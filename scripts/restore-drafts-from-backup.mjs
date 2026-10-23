/* global process */
/**
 * 从备份库按章恢复草稿与派生行（一次性数据恢复，2026-10-23）。
 *
 * ## 背景
 *
 * 「删除定稿」当前等于「连该章唯一草稿与正文一起删」（每章通常只有 v1 一条草稿，
 * 它就是定稿）。作者想改本章时只能删，正文因此丢失。产品侧已另行补齐「退回草稿」，
 * 本脚本负责把**已经误删**的章节从备份里捞回来。
 *
 * ## 范围
 *
 * 只恢复与目标章相关的这些表（其余表一概不动）：
 * `contents` → `drafts` → `finalization_outbox` → `revisions` → `reviews` → `summary_snapshots`
 *
 * - **目标库已有同 id 行 ⇒ 跳过**，不覆盖（现库为准）；
 * - `post_process_runs` / `post_process_steps` **不恢复**：它们可由「修复后处理」重跑重建，
 *   而强行搬回会让「这一步到底跑没跑过」变成两套说法；
 * - 恢复后若定稿收据与正文不一致（历史 drift），再跑一次
 *   `scripts/repair-finalization-receipts.mjs` 即可（幂等）。
 *
 * ## 用法
 *
 * ```bash
 * # 先看报告（缺省 dry-run）
 * ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
 *   scripts/restore-drafts-from-backup.mjs \
 *   --project "D:/books/某书" --backup "D:/books/某书/.ai-novel/project.db.bak-xxx" --chapters 2,3,4
 *
 * # 确认后写入
 * ... --apply
 * ```
 */
import { copyFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const Database = createRequire(import.meta.url)('better-sqlite3')

/**
 * 恢复顺序即外键依赖顺序：contents 先于 drafts，drafts 先于 outbox/revisions/reviews/snapshots。
 *
 * `key` 是该表的主键列 —— `finalization_outbox` **没有 `id`**（主键是 `finalization_id`），
 * 按 `id` 找会直接抛「缺少 id 列」。每张表都要显式声明，不能假设统一命名。
 */
const TABLES = [
  { table: 'contents', key: 'id' },
  { table: 'drafts', key: 'id' },
  { table: 'finalization_outbox', key: 'finalization_id' },
  { table: 'revisions', key: 'id' },
  { table: 'reviews', key: 'id' },
  { table: 'summary_snapshots', key: 'id' },
]

function parseArgs(argv) {
  const valueOf = (name) => {
    const hit = argv.find(arg => arg.startsWith(`--${name}=`))
    if (hit) return hit.slice(name.length + 3)
    const index = argv.indexOf(`--${name}`)
    if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) return argv[index + 1]
    return undefined
  }
  return {
    project: valueOf('project'),
    backup: valueOf('backup'),
    chapters: (valueOf('chapters') ?? '')
      .split(',')
      .map(item => Number(item.trim()))
      .filter(item => Number.isInteger(item) && item > 0),
    apply: argv.includes('--apply'),
  }
}

function resolveDbPath(project) {
  if (!project) throw new Error('缺少 --project')
  const resolved = path.resolve(project)
  if (existsSync(resolved) && statSync(resolved).isFile()) return resolved
  const candidate = path.join(resolved, '.ai-novel', 'project.db')
  if (!existsSync(candidate)) throw new Error(`找不到项目库：${candidate}`)
  return candidate
}

function formatLocalStamp(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function columnsOf(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name)
}

/**
 * 从备份里取出「与目标章相关」的行。
 *
 * 每张表的关联方式不同，且必须**先算 contents 的 id 集合**再取 drafts 依赖：
 * 修订稿与审稿各自挂在 base_draft_id 上，它们的正文存在 revision/review 自己的 content_id。
 */
function collect(backup, chapters) {
  const placeholders = chapters.map(() => '?').join(', ')
  const drafts = backup.prepare(
    `SELECT * FROM drafts WHERE chapter_number IN (${placeholders}) ORDER BY chapter_number, version, id`,
  ).all(...chapters)
  const draftIds = drafts.map(row => row.id)
  const draftPlaceholders = draftIds.length ? draftIds.map(() => '?').join(', ') : 'NULL'
  const revisions = draftIds.length
    ? backup.prepare(`SELECT * FROM revisions WHERE base_draft_id IN (${draftPlaceholders}) OR merged_to_draft_id IN (${draftPlaceholders}) ORDER BY id`)
      .all(...draftIds, ...draftIds)
    : []
  const reviews = draftIds.length
    ? backup.prepare(`SELECT * FROM reviews WHERE base_draft_id IN (${draftPlaceholders}) ORDER BY id`).all(...draftIds)
    : []
  const outbox = draftIds.length
    ? backup.prepare(`SELECT * FROM finalization_outbox WHERE draft_id IN (${draftPlaceholders}) ORDER BY draft_id`).all(...draftIds)
    : []
  const snapshots = draftIds.length
    ? backup.prepare(`SELECT * FROM summary_snapshots WHERE draft_id IN (${draftPlaceholders}) ORDER BY draft_id`).all(...draftIds)
    : []

  const contentIds = new Set()
  for (const row of drafts) if (row.content_id !== null && row.content_id !== undefined) contentIds.add(row.content_id)
  for (const row of revisions) if (row.content_id !== null && row.content_id !== undefined) contentIds.add(row.content_id)
  for (const row of reviews) if (row.content_id !== null && row.content_id !== undefined) contentIds.add(row.content_id)
  const contents = [...contentIds].length
    ? backup.prepare(`SELECT * FROM contents WHERE id IN (${[...contentIds].map(() => '?').join(', ')}) ORDER BY id`)
      .all(...[...contentIds])
    : []

  return { contents, drafts, finalization_outbox: outbox, revisions, reviews, summary_snapshots: snapshots }
}

function insertRows(target, table, key, rows) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 }
  const available = new Set(columnsOf(target, table))
  let inserted = 0
  let skipped = 0
  for (const row of rows) {
    const keys = Object.keys(row).filter(key => available.has(key))
    if (!keys.includes(key)) throw new Error(`${table} 缺少主键列 ${key}，无法按行恢复`)
    const exists = target.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ?`).get(row[key])
    if (exists) { skipped += 1; continue }
    target.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    ).run(...keys.map(key => row[key]))
    inserted += 1
  }
  return { inserted, skipped }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.chapters.length === 0) throw new Error('缺少 --chapters（例：--chapters 2,3,4）')
  const dbPath = resolveDbPath(args.project)
  if (!args.backup || !existsSync(args.backup)) throw new Error('缺少 --backup 或备份文件不存在')

  const backup = new Database(args.backup, { readonly: true, fileMustExist: true })
  const payload = collect(backup, args.chapters)
  backup.close()

  console.log(`\n现库：${dbPath}`)
  console.log(`备份：${args.backup}`)
  console.log(`目标章：第 ${args.chapters.join('、')} 章`)
  for (const { table } of TABLES) {
    const rows = payload[table]
    const detail = table === 'drafts'
      ? rows.map(row => `#${row.id} 第${row.chapter_number}章 v${row.version} ${row.status}`).join(' / ')
      : `${rows.length} 行`
    console.log(`  ${table}: ${rows.length} 行${detail ? ` —— ${detail}` : ''}`)
  }

  if (!args.apply) {
    console.log('\n（dry-run：没有写入任何数据。确认无误后加 --apply）')
    return
  }

  const stamp = formatLocalStamp(new Date())
  const backupPath = `${dbPath}.bak-restore-${stamp}`
  copyFileSync(dbPath, backupPath)
  console.log(`\n已备份现库：${backupPath}`)

  const target = new Database(dbPath)
  target.pragma('foreign_keys = OFF')
  try {
    const run = target.transaction(() => {
      for (const { table, key } of TABLES) {
        const outcome = insertRows(target, table, key, payload[table])
        console.log(`  ${table}: 写入 ${outcome.inserted}，跳过（已存在）${outcome.skipped}`)
      }
    })
    run()
    const problems = target.pragma('foreign_key_check')
    if (Array.isArray(problems) && problems.length > 0) {
      console.log(`\n⚠ 外键自检发现 ${problems.length} 处悬空引用（前 5 条）：`)
      for (const problem of problems.slice(0, 5)) console.log(`   ${JSON.stringify(problem)}`)
    } else {
      console.log('\n外键自检通过。')
    }
    console.log('恢复完成。若定稿收据与正文不一致，再跑一次 repair-finalization-receipts.mjs（幂等）。')
    console.log('post_process_runs / steps 未恢复：需要后处理状态时，对相应章点一次「修复后处理」。')
  } finally {
    target.pragma('foreign_keys = ON')
    target.close()
  }
}

try {
  main()
} catch (error) {
  console.error(`失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
