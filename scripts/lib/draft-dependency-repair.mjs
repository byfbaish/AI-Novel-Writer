/**
 * 草稿来源依赖（`drafts.source_dependencies`）的共享修复逻辑。
 *
 * 每条依赖记着「我所依据的前文草稿**当时**的内容 sha256」。提交新草稿时
 * `DraftRepository.create` 会**递归**校验整条链（ch4 → ch3 → ch2 → ch1），
 * 任何一环的前文内容变了、而依赖没跟着更新，提交就会被拒
 * （`GENERATION_DRAFT_SOURCE_STALE`）。
 *
 * 会让它过期的两条已知路径：
 * 1. 批量脚本直接改写正文（W2 把「不到五十枚」修正成「不到十枚」）；
 * 2. `repair-finalization-receipts.mjs` 把定稿收据对齐到新正文 —— 收据自洽了，
 *    但**下游草稿记的还是旧指纹**，于是下游全部 stale。
 *
 * 本模块只负责「找出 / 就地更新指纹」，**不备份、不开事务**：调用方负责。
 * 它不动正文、不动定稿回执。
 */
import { createHash } from 'node:crypto'

const sha256 = text => createHash('sha256').update(text).digest('hex')

/** draftId → { chapter, hash }（当前正文） */
function currentDraftHashes(db) {
  const map = new Map()
  for (const row of db.prepare(`SELECT d.id, d.chapter_number, c.body
    FROM drafts d JOIN contents c ON c.id = d.content_id`).all()) {
    map.set(row.id, { chapter: row.chapter_number, hash: sha256(row.body) })
  }
  return map
}

/**
 * 找出过期的依赖（只读）。
 * @returns {{ draftId: number, owner: string, dependsOn: string, from: string, to: string }[]}
 */
export function findStaleDependencies(db) {
  const current = currentDraftHashes(db)
  const repairs = []
  for (const row of db.prepare('SELECT id, chapter_number, source_dependencies FROM drafts ORDER BY chapter_number, version').all()) {
    for (const dep of JSON.parse(row.source_dependencies || '[]')) {
      const target = current.get(dep.draftId)
      if (!target || dep.contentHash === target.hash) continue
      repairs.push({
        draftId: row.id,
        owner: `ch${row.chapter_number}`,
        dependsOn: `ch${target.chapter}`,
        from: String(dep.contentHash).slice(0, 12),
        to: target.hash.slice(0, 12),
      })
    }
  }
  return repairs
}

/** 就地把过期指纹更新为当前值；返回被改写的草稿行数。调用方负责备份与事务。 */
export function applyStaleDependencyRepair(db) {
  const current = currentDraftHashes(db)
  const update = db.prepare('UPDATE drafts SET source_dependencies = ? WHERE id = ?')
  let touched = 0
  for (const row of db.prepare('SELECT id, source_dependencies FROM drafts').all()) {
    const dependencies = JSON.parse(row.source_dependencies || '[]')
    let changed = false
    for (const dep of dependencies) {
      const target = current.get(dep.draftId)
      if (target && dep.contentHash !== target.hash) {
        dep.contentHash = target.hash
        changed = true
      }
    }
    if (changed) {
      update.run(JSON.stringify(dependencies), row.id)
      touched += 1
    }
  }
  return touched
}
