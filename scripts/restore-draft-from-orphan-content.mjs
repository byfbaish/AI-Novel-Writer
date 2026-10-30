/* global process */
/**
 * 把「正文还在、草稿行没了」的章节从 `contents` 捞回草稿箱（一次性数据恢复）。
 *
 * ## 什么时候用它
 *
 * 「删除正文」（`chapter:delete-finalized` → `deleteChapterFacts`）会先删 `drafts` 行、
 * 再删 `contents` 行；后者在仍被别的行引用时会失败并被吞掉。于是出现一种中间态：
 * **`contents` 里正文还在，`drafts` 表里却一条都不剩** —— 界面看起来「整章没了」，
 * 其实字还在库里。本脚本只做一件事：为这些孤儿正文重建 `drafts` 行。
 *
 * 它**不**碰 `finalization_outbox` / `summary_snapshots` / `post_process_runs`：
 * 恢复出来的是**未定稿草稿**（`status='draft'`），作者确认正文无误后重新定稿即可，
 * 派生由定稿链自己重建。硬塞定稿收据只会造出「收据说定稿了、派生却没有」的假象。
 *
 * ## 用法
 *
 * ```bash
 * # 1) 先看有哪些孤儿正文（缺省 dry-run，不写库）
 * ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
 *   scripts/restore-draft-from-orphan-content.mjs --project "D:/books/某书" --chapter 1
 *
 * # 2) 确认后写入（可只挑某几条：--content 9）
 * ... --project "D:/books/某书" --chapter 1 --content 9 --apply
 * ```
 *
 * 幂等：目标章已存在的 `content_id` 一律跳过，不覆盖现库。
 */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const Database = createRequire(import.meta.url)('better-sqlite3')

/** 与 `src/shared/draft-units.ts` 的 `countDraftUnits` 逐字一致。 */
const HAN = /\p{Script=Han}/gu
const WORD = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}[\p{L}\p{M}]*)*/gu
const NOISE = /[\s\p{P}\p{S}]/gu
function countDraftUnits(text) {
  const normalized = text.normalize('NFC')
  const han = normalized.match(HAN)?.length ?? 0
  const withoutHan = normalized.replace(HAN, ' ')
  const words = withoutHan.match(WORD)?.length ?? 0
  const other = [...withoutHan.replace(WORD, '').replace(NOISE, '')].length
  return han + words + other
}

function parseArgs(argv) {
  const args = { apply: false }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (key === '--apply') { args.apply = true; continue }
    if (key === '--project') { args.project = argv[++index]; continue }
    if (key === '--chapter') { args.chapter = Number(argv[++index]); continue }
    if (key === '--content') { args.content = argv[++index].split(',').map(Number); continue }
    throw new Error(`无法识别的参数：${key}`)
  }
  if (!args.project) throw new Error('缺少 --project')
  if (!Number.isSafeInteger(args.chapter) || args.chapter < 1) throw new Error('缺少或非法的 --chapter')
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const dbPath = path.join(args.project, '.ai-novel', 'project.db')
  if (!existsSync(dbPath)) throw new Error(`找不到项目库：${dbPath}`)
  const db = new Database(dbPath)
  try {
    const orphans = db.prepare(`
      SELECT c.id, length(c.body) AS bytes, c.created_at
      FROM contents c
      WHERE NOT EXISTS (SELECT 1 FROM drafts d WHERE d.content_id = c.id)
      ORDER BY c.id
    `).all()
    if (orphans.length === 0) {
      console.log('没有孤儿正文：所有 contents 行都挂在某条草稿上。')
      return
    }

    const chosen = args.content ? orphans.filter(row => args.content.includes(row.id)) : orphans
    console.log(`孤儿正文 ${orphans.length} 条${args.content ? `，本次选中 ${chosen.length} 条` : ''}；目标章：第 ${args.chapter} 章`)
    for (const row of orphans) {
      const body = db.prepare('SELECT body FROM contents WHERE id = ?').pluck().get(row.id)
      const units = countDraftUnits(body)
      const picked = chosen.some(item => item.id === row.id)
      console.log(`  ${picked ? '→' : ' '} content#${row.id}  ${units} 字  ${row.created_at}  ${JSON.stringify(body.slice(0, 32))}`)
    }

    if (!args.apply) {
      console.log('\n（dry-run）加 --apply 才会写入。')
      return
    }

    const insert = db.prepare(`
      INSERT INTO drafts (chapter_number, version, status, source, content_id, word_count, source_dependencies)
      VALUES (?, ?, 'draft', 'restore', ?, ?, '[]')
    `)
    const restore = db.transaction(() => {
      let version = (db.prepare('SELECT COALESCE(MAX(version), 0) FROM drafts WHERE chapter_number = ?')
        .pluck().get(args.chapter)) ?? 0
      let created = 0
      for (const row of chosen) {
        const exists = db.prepare('SELECT 1 FROM drafts WHERE content_id = ?').pluck().get(row.id)
        if (exists) { console.log(`  跳过 content#${row.id}：已有草稿引用它`); continue }
        const body = db.prepare('SELECT body FROM contents WHERE id = ?').pluck().get(row.id)
        version += 1
        insert.run(args.chapter, version, row.id, countDraftUnits(body))
        created += 1
        console.log(`  已恢复 content#${row.id} → 第 ${args.chapter} 章 v${version}`)
      }
      return created
    })
    console.log(`\n写入完成：新增 ${restore()} 条草稿（status=draft，未定稿）。`)
    console.log('回到应用刷新草稿箱即可看到；确认正文无误后再重新定稿，派生会自动重建。')
  } finally {
    db.close()
  }
}

main()
