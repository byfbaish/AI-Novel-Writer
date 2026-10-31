import type Database from 'better-sqlite3'
import type { MigrationImplementation, SchemaReader } from './registry'

/**
 * M28：`drafts.outline_rev` —— 「这一章定稿时，大纲是第几版」（P2-3 / S6，2026-10-31）。
 *
 * ## 为什么现在才有这一列
 *
 * 硬拒链走到今天，唯一没有判据的就是**已定稿正文**：`drafts` 只记「哪一版、什么状态」，
 * 不记「依据的是哪一版大纲」。于是「改了第 12 章大纲，会不会影响第 8 章已经定稿的正文」
 * 这件事在库里查不出来，只能记进 `unseen` 说「本期不判」。
 *
 * ## 为什么只记大纲一域，不记 `source_ref` 三域
 *
 * 定稿正文的直接上游是**大纲**，不是世界观/弧光：世界变了会先让大纲旧（M26 的中环），
 * 再由大纲带动正文 —— 这是「级联逐层发生、不跨层直传」那条裁定。
 * 若这里也记三域，作者改一个设定就会让**所有已定稿章节**同时变红，
 * 而它们其实一个字都不用改（改完大纲、确认第 8 章不受影响，才是正确答案）。
 * 这正是 S6a 收窄 `BOOK_SOURCE_KEYS` 要避免的那件事，不能在正文层重犯。
 *
 * ## 为什么默认 `-1` 而不是 `0` / `NULL`
 *
 * - `0` 不能用：`HYPOTHETICAL_NEXT_REV = 0` 已经占了这个值表示「假想再造一版」，
 *   一处 `0` 双义会让「还没记」被读成「按下一版算」。
 * - `NULL` 不能用：`NOT NULL` 一撤，将来每个读取方都要自己兜一层 `?? -1`，
 *   而漏兜的那一处会把 `NULL` 当成「版本 0」参与比较。
 * - `-1` 是**显式的「没有记录」**：版本号从 1 起，负值不可能与真实版本撞上，
 *   读取侧一见 `< 1` 就按 `legacy` 处理（进 `unseen`，不猜）。
 *
 * ## 为什么不回填
 *
 * 迁移时「补一个当前大纲版本」等于声称「这些章节是按当前大纲定稿的」。事实不是这样 ——
 * 它们各自定稿于某个已经找不回来的版本上。补一个值会让**真正该复查的章节被判 `valid`**
 * （假阴性，方向错），而留 `-1` 只是如实说「不知道」。与 M27 那条「`at` 保留事件时间、
 * 改写成导入时刻等于伪造证据」是同一条纪律。
 *
 * 基线（`baseline-schema.ts`）已冻结，所以走新 lane。
 */
export const M28_DRAFT_OUTLINE_REV_COLUMN = 'outline_rev'
export const M28_DRAFT_OUTLINE_REV_UNKNOWN = -1

type ColumnInfo = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

function columnsOf(db: Database.Database): ColumnInfo[] {
  return db.prepare('PRAGMA table_info(drafts)').all() as ColumnInfo[]
}

/** 幂等：列已在就跳过（`ALTER TABLE ADD COLUMN` 重复执行会抛 duplicate column）。 */
export function applyM28DraftOutlineRev(db: Database.Database): void {
  if (columnsOf(db).some(item => item.name === M28_DRAFT_OUTLINE_REV_COLUMN)) return
  db.exec(
    `ALTER TABLE drafts ADD COLUMN ${M28_DRAFT_OUTLINE_REV_COLUMN} INTEGER NOT NULL DEFAULT ${M28_DRAFT_OUTLINE_REV_UNKNOWN}`,
  )
}

/**
 * 只读校验：形状错了返回 false，由 runner 回滚整步（含 `user_version`）。
 *
 * 断言三条：
 * - 列在：缺了它，定稿时写 `outline_rev` 会直接抛，定稿这个核心动作整条失败；
 * - `NOT NULL`：可空会让「没记」与「记成 -1」变成两种状态，读取侧迟早只处理其中一种；
 * - 默认 `-1`：默认值写错（比如 `0`）会让**每一条老数据**在读取侧被当成「按第 0 版算」，
 *   而这不会立刻报错，只会让已定稿章节永远判 `stale`（或永远判 `valid`）——
 *   两种错都不会在测试里自己冒出来。
 */
export function verifyM28DraftOutlineRev(db: Database.Database): boolean {
  try {
    const column = columnsOf(db).find(item => item.name === M28_DRAFT_OUTLINE_REV_COLUMN)
    if (!column) return false
    if (column.notnull !== 1) return false
    return (column.dflt_value ?? '') === String(M28_DRAFT_OUTLINE_REV_UNKNOWN)
  } catch { return false }
}

/** The central schema runner owns this transaction and PRAGMA user_version. */
export function createM28Migration(deps: {
  database(reader: SchemaReader): Database.Database
  verifyKnownSchema(reader: SchemaReader): boolean
}): MigrationImplementation {
  return { id: 'M28', from: 28, to: 29, owner: 'P2-3',
    migrate: reader => applyM28DraftOutlineRev(deps.database(reader)),
    verify: reader => deps.verifyKnownSchema(reader) && verifyM28DraftOutlineRev(deps.database(reader)) }
}
