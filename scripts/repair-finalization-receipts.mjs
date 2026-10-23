/* global process */
/**
 * 定稿收据修复（一次性运维脚本，2026-10-23）。
 *
 * ## 什么时候需要它
 *
 * 旧框架不完善时存在旁路写入：正文在**定稿之后**被改过，而 `finalization_outbox`
 * 里的 `content_snapshot` / `content_hash` 还停在定稿那一刻。守卫补齐之后这类章
 * 一律被判「定稿正文来源收据已失效」（`SummaryRepository.readFinalizedSource` 返回 null），
 * 于是「资源账本回填」「修复后处理」都进不去，而产品里**没有重新定稿的入口**。
 *
 * 例（2026-10-23 实机，第 2 章）：正文本体 2942 字、收据快照 2942 字，42 处字符不同
 * （`不到十枚` ↔ `不到五十枚`），收据 hash 只与自己自洽。
 *
 * ## 判据（三条同时成立才修，缺一不修）
 *
 * 1. `drafts.status = 'finalized'`
 * 2. `finalization_outbox.content_snapshot !== contents.body`
 * 3. `sha256(content_snapshot) === content_hash` —— 收据自洽 ⇒ 坏的是它与正文的关系
 *
 * 第 3 条不成立 = 收据自身损坏，是另一类问题，**只报不修**。
 *
 * ## 修什么（以**当前正文**为准）
 *
 * ```
 * content_snapshot := contents.body
 * content_hash     := sha256(contents.body)
 * content_revision := content_revision + 1
 * updated_at       := now
 * ```
 *
 * **不碰正文、不跑后处理、不删任何行。**
 *
 * ## 用法
 *
 * 本机 better-sqlite3 是按 Electron ABI 编译的，必须用 electron 当 node 跑：
 *
 * ```bash
 * # 先看报告（缺省 dry-run，不写任何东西）
 * ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
 *   scripts/repair-finalization-receipts.mjs --project "D:/books/某书"
 *
 * # 确认后写入
 * ... --project "D:/books/某书" --apply
 * ```
 *
 * 参数：`--project <path>`（必填，项目目录或 project.db 路径）、`--apply`、`--chapter <n>`、
 */
import { copyFileSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { applyStaleDependencyRepair, findStaleDependencies } from './lib/draft-dependency-repair.mjs'

const Database = createRequire(import.meta.url)('better-sqlite3')

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
    chapter: valueOf('chapter') ? Number(valueOf('chapter')) : undefined,
    apply: argv.includes('--apply'),
  }
}

function resolveDbPath(project) {
  if (!project) throw new Error('缺少 --project')
  const resolved = path.resolve(project)
  if (existsSync(resolved) && statSync(resolved).isFile()) return resolved
  const candidate = path.join(resolved, '.ai-novel', 'project.db')
  if (existsSync(candidate)) return candidate
  throw new Error(`找不到项目库：${candidate}`)
}

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex')

function formatLocalStamp(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

/** 两段文本的差异摘要：首个差异位置 + 差异字符数 + 两侧片段。 */
function describeDrift(body, snapshot) {
  const limit = Math.min(body.length, snapshot.length)
  let first = 0
  while (first < limit && body[first] === snapshot[first]) first += 1
  let differing = 0
  for (let i = 0; i < limit; i += 1) if (body[i] !== snapshot[i]) differing += 1
  differing += Math.abs(body.length - snapshot.length)
  const from = Math.max(0, first - 12)
  return {
    first,
    differing,
    bodySample: body.slice(from, first + 24).replace(/\s+/gu, ' '),
    snapshotSample: snapshot.slice(from, first + 24).replace(/\s+/gu, ' '),
  }
}

function scan(db, chapter) {
  const rows = db.prepare(`
    SELECT drafts.id AS draftId, drafts.chapter_number AS chapterNumber, drafts.status,
           contents.body AS body,
           finalization_outbox.finalization_id AS finalizationId,
           finalization_outbox.content_hash AS contentHash,
           finalization_outbox.content_snapshot AS snapshot,
           summary_snapshots.source_content_hash AS summaryHash
    FROM drafts
    JOIN contents ON contents.id = drafts.content_id
    LEFT JOIN finalization_outbox ON finalization_outbox.draft_id = drafts.id
    LEFT JOIN summary_snapshots ON summary_snapshots.draft_id = drafts.id
    WHERE drafts.status = 'finalized'
      ${chapter === undefined ? '' : 'AND drafts.chapter_number = @chapter'}
    ORDER BY drafts.chapter_number, drafts.version, drafts.id
  `).all(chapter === undefined ? {} : { chapter })

  return rows.map((row) => {
    const body = row.body ?? ''
    const snapshot = row.snapshot
    if (row.finalizationId === null || snapshot === null) {
      return { ...row, verdict: 'no-outbox', reason: '没有定稿收据行（无法补建，需走一次定稿流程）' }
    }
    if (!/^[a-f0-9]{64}$/u.test(row.contentHash ?? '')) {
      return { ...row, verdict: 'receipt-corrupt', reason: 'content_hash 不是 64 位十六进制' }
    }
    if (sha256(snapshot) !== row.contentHash) {
      return { ...row, verdict: 'receipt-corrupt', reason: '收据自身不自洽（快照与 hash 对不上），只报不修' }
    }
    if (snapshot === body) return { ...row, verdict: 'ok' }
    return { ...row, verdict: 'drift', drift: describeDrift(body, snapshot) }
  })
}

function printReport(results, dbPath) {
  console.log(`\n库：${dbPath}`)
  console.log('章 | draft | 判定 | 说明')
  console.log('---|---|---|---')
  for (const row of results) {
    const detail = row.verdict === 'drift'
      ? `正文与收据不同：首个差异在第 ${row.drift.first} 字，共 ${row.drift.differing} 处`
      : row.verdict === 'ok' ? '收据与正文一致' : (row.reason ?? '')
    console.log(`第 ${row.chapterNumber} 章 | ${row.draftId} | ${row.verdict} | ${detail}`)
    if (row.verdict === 'drift') {
      console.log(`    正文：…${row.drift.bodySample}…`)
      console.log(`    收据：…${row.drift.snapshotSample}…`)
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const dbPath = resolveDbPath(args.project)
  const results = scan(new Database(dbPath, { readonly: true, fileMustExist: true }), args.chapter)
  printReport(results, dbPath)

  const drift = results.filter(row => row.verdict === 'drift')
  const corrupt = results.filter(row => row.verdict === 'receipt-corrupt')
  const missing = results.filter(row => row.verdict === 'no-outbox')

  console.log('\n=== 汇总 ===')
  console.log(`可补扫（收据有效）：${results.filter(row => row.verdict !== 'no-outbox').length - drift.length - corrupt.length} 章`)
  console.log(`需要修复（drift）：${drift.length} 章${drift.length ? ' → 第 ' + drift.map(r => r.chapterNumber).join('、') + ' 章' : ''}`)
  if (corrupt.length) console.log(`收据自身损坏（只报不修）：第 ${corrupt.map(r => r.chapterNumber).join('、')} 章`)
  if (missing.length) console.log(`没有收据行（只报不修）：第 ${missing.map(r => r.chapterNumber).join('、')} 章`)

  if (drift.length > 0) {
    console.log('\n=== 修复后会被标成「派生过期」的下游 ===')
    for (const row of drift) {
      const nextHash = sha256(row.body)
      if (row.summaryHash && row.summaryHash !== nextHash) {
        console.log(
          `第 ${row.chapterNumber} 章：summary_snapshots.source_content_hash=${row.summaryHash.slice(0, 12)}… `
          + `（要点/角色状态是按旧文本算的）。要不要重跑「修复后处理」由你决定，本脚本不动它。`,
        )
      }
    }
  }

  // 收据对齐正文之后，**下游草稿记的旧指纹**必须一并更新，否则之后的新章提交会被
  // `DraftRepository.create` 的递归链校验拒掉（`GENERATION_DRAFT_SOURCE_STALE`，
  // 2026-10-24 实测：第 3 章记着第 2 章的旧指纹，导致第 4 章永远提交不了）。
  const staleDependencies = (() => {
    try {
      const probe = new Database(dbPath, { readonly: true, fileMustExist: true })
      const found = findStaleDependencies(probe)
      probe.close()
      return found
    } catch {
      return []
    }
  })()
  if (staleDependencies.length) {
    console.log('\n=== 下游草稿的依赖指纹已过期（不修就永远提交不了新章） ===')
    for (const item of staleDependencies) {
      console.log(`  ${item.owner} → 依赖 ${item.dependsOn}：${item.from} → ${item.to}`)
    }
    console.log('  加 --apply 时会一并级联更新（只改指纹，不动正文）。')
  }

  if (!args.apply) {
    console.log('\n（dry-run：没有写入任何数据。确认无误后加 --apply）')
    return
  }
  if (drift.length === 0 && staleDependencies.length === 0) {
    console.log('\n没有需要修复的章，未写入。')
    return
  }
  // 本地时间，与项目里既有 .bak-* 命名（`project.db.bak-m10version-20261022000011`）一致。
  const stamp = formatLocalStamp(new Date())
  const backupPath = `${dbPath}.bak-receipt-${stamp}`
  copyFileSync(dbPath, backupPath)
  console.log(`\n已备份：${backupPath}`)

  const db = new Database(dbPath)
  try {
    // 拿写锁再做：拿不到就说明有别的进程在写（应用开着）。比看 wal 的 mtime 可靠 ——
    // 本脚本自己读一次就会刷新 mtime，那样的守卫只会误报。
    try {
      db.exec('BEGIN IMMEDIATE')
      db.exec('COMMIT')
    } catch (error) {
      console.log(`\n⚠ 拿不到写锁（${error instanceof Error ? error.message : String(error)}）。请先关闭应用再重跑。`)
      process.exitCode = 1
      return
    }
    const update = db.prepare(`
      UPDATE finalization_outbox
      SET content_snapshot = @snapshot,
          content_hash = @hash,
          content_revision = content_revision + 1,
          updated_at = datetime('now', 'localtime')
      WHERE draft_id = @draftId
    `)
    const run = db.transaction((rows) => {
      for (const row of rows) update.run({ draftId: row.draftId, snapshot: row.body, hash: sha256(row.body) })
    })
    run(drift)
    if (drift.length) console.log(`已修复 ${drift.length} 章：第 ${drift.map(row => row.chapterNumber).join('、')} 章。`)
    // 级联：收据已对齐新正文，下游草稿还记着旧指纹 —— 不更新的话，那些章之后再生成/提交都会被拒。
    const cascadeTargets = findStaleDependencies(db)
    if (cascadeTargets.length) {
      const touched = db.transaction(() => applyStaleDependencyRepair(db))()
      console.log(`级联更新 ${touched} 个草稿的依赖指纹：${cascadeTargets.map(item => `${item.owner}→${item.dependsOn}`).join('、')}。`)
    }
    console.log('正文未改动；现在可以回到「世界状态 → 资源 → 账本回填」补扫。')
  } finally {
    db.close()
  }
}

try {
  main()
} catch (error) {
  console.error(`失败：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
