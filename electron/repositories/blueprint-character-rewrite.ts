import type BetterSqlite3 from 'better-sqlite3'
import { UpstreamRevisionRepository } from './upstream-revision-repository'
import { currentSourceRefValue, hasColumn } from './derived-source-ref'

/**
 * 「改蓝图里的角色名单」= 改上游（P2-2 期 2，第三条手改通道）。
 *
 * ## 为什么这是一条独立通道
 *
 * 蓝图有两条正式写入路径（`BlueprintRepository.upsert` / `commitRange`），它们
 * 都会 bump 大纲版本。但角色改名与角色合并走的是**裸 `UPDATE blueprints SET
 * characters`** —— 改的是**会进正文 prompt** 的列（`characters` 决定这一章谁在场），
 * 而版本号不动 ⇒ 派生被判 `valid` ⇒ 静默拿过期阵容写正文。方向是漏判，最危险那侧。
 *
 * 两处调用（`character-roster-repository.ts` 的手工名单保存、
 * `character-repository.ts` 的角色改名）逻辑相同，只差一个「名字怎么变」的映射，
 * 所以骨架在这里写一次，变换由调用方传。
 *
 * ## 为什么先全部算完再写
 *
 * 原实现是「逐行 解析 → 校验 → 写」交错：第 3 行数据损坏时，前两行已经改了。
 * 虽然调用方都在事务里（回滚能救），但「等到 bump 完才知道要改哪些章」要求
 * 先收集。顺带把执行顺序修正成：**全部校验通过 → bump → 写行**。
 *
 * @returns 实际被改写的章号（`[]` = 没有任何一行的阵容变了，因此**不 bump**）。
 */
export function rewriteBlueprintCharacters(
  db: BetterSqlite3.Database,
  transform: (names: readonly string[]) => readonly string[],
): number[] {
  const blueprints = db.prepare(
    'SELECT chapter_number, characters FROM blueprints',
  ).all() as Array<{ chapter_number: number; characters: string }>

  const rewrites: Array<{ chapter: number; characters: string }> = []
  for (const blueprint of blueprints) {
    let raw: unknown
    try {
      raw = JSON.parse(blueprint.characters)
    } catch {
      throw new Error(`第 ${blueprint.chapter_number} 章蓝图角色列表损坏`)
    }
    if (!Array.isArray(raw) || !raw.every(name => typeof name === 'string')) {
      throw new Error(`第 ${blueprint.chapter_number} 章蓝图角色列表格式错误`)
    }
    const next = transform(raw as string[])
    // 逐字节比对：没变就不写、也不进章集。改名一个角色却把全书每一章都记成
    // 「改过」，等于让按章收窄永久失效（每次改名全库判脏）。
    if (JSON.stringify(next) !== JSON.stringify(raw)) {
      rewrites.push({ chapter: blueprint.chapter_number, characters: JSON.stringify(next) })
    }
  }
  if (rewrites.length === 0) return []

  const outlineRev = UpstreamRevisionRepository.bump(
    { domain: 'outline', changedChapters: rewrites.map(rewrite => rewrite.chapter) },
    db,
  )
  // 来源快照按「这次的新 rev」算**一次**：每行都算等于每行读一遍整张版本表。
  const useSourceRef = outlineRev !== null && hasColumn(db, 'blueprints', 'source_ref')
  const sourceRefValue = useSourceRef ? currentSourceRefValue(db, 'chapter-plan', outlineRev) : ''
  const update = useSourceRef
    ? db.prepare(`
        UPDATE blueprints
        SET characters = ?, source_ref = ?, updated_at = datetime('now')
        WHERE chapter_number = ?
      `)
    : db.prepare(`
        UPDATE blueprints
        SET characters = ?, updated_at = datetime('now')
        WHERE chapter_number = ?
      `)
  for (const rewrite of rewrites) {
    if (useSourceRef) update.run(rewrite.characters, sourceRefValue, rewrite.chapter)
    else update.run(rewrite.characters, rewrite.chapter)
  }
  return rewrites.map(rewrite => rewrite.chapter)
}
