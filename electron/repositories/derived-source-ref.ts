import type BetterSqlite3 from 'better-sqlite3'
import {
  buildSourceRef,
  upstreamRefKey,
  type DerivedSourceRef,
  type UpstreamDomain,
  type UpstreamRefKey,
} from '../../src/shared/upstream-revisions'
import { UpstreamRevisionRepository } from './upstream-revision-repository'

/**
 * 派生侧 `source_ref` 列的编解码（P2-2 期 2）。
 *
 * ## 为什么要单独一层
 *
 * 期 2 有三处写入点要写同一件事：「把上游三域此刻的 rev 拍成一张快照，塞进
 * 派生行」。三处各写一遍 `JSON.stringify(buildSourceRef(...))` 的风险不是重复
 * 三行代码，而是**键的拼法会分叉** —— 只要有一处手写成 `'outline'` 而不是
 * `upstreamRefKey('outline')`，那一处的派生就永远判 `stale`（键对不上
 * `UpstreamRevisionRepository.snapshot()` 的键），而且不报错。
 *
 * ## 存储形态
 *
 * 列是 `TEXT NOT NULL DEFAULT ''`：空串 = **没有来源记录**（`legacy`），
 * 非空 = `JSON.stringify(DerivedSourceRef)`。不用 `NULL` 是为了让「没记过」
 * 只有一种表示（`NULL` 会让 `NULL` 与 `''` 变成两种都表示"空"的状态）。
 */

type ProjectDatabase = BetterSqlite3.Database

/**
 * 派生依赖的三个上游域，**顺序固定**（序列化后字节稳定，便于比对与快照）。
 *
 * 这里故意只列 `book` 作用域：期 2 不做单元级分版（设计稿 §六），
 * `outline:<unit>` 是将来切换时要一次性重写全部 `source_ref` 的专门迁移窗口。
 */
export const DERIVED_SOURCE_DOMAINS: readonly UpstreamDomain[] = Object.freeze([
  'worldbuilding',
  'arc',
  'outline',
] as const)

/** 全书三键。键一律由 `upstreamRefKey` 拼 —— 全库唯一来源，别在这里手写字面量。 */
export const BOOK_SOURCE_KEYS: readonly UpstreamRefKey[] = Object.freeze(
  DERIVED_SOURCE_DOMAINS.map(domain => upstreamRefKey(domain)),
)

/**
 * 列存在性探针。
 *
 * 存在的理由与 `blueprints.structured_refs`（M08）完全一样：只建基线表的测试
 * 夹具、以及未升级到 v26 的库都没有这些列。此时写这一列会让整个业务写入
 * `no such column` 失败 —— 而 `source_ref` 是**旁路账本**，它不该成为失败点
 * （与期 1「bump 遇表不存在返回 null 而不抛」同一纪律）。
 */
export function hasColumn(db: ProjectDatabase, table: string, column: string): boolean {
  try {
    return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .some(entry => entry.name === column)
  } catch { return false }
}

/**
 * 解析列值 → `DerivedSourceRef`。空串、坏 JSON、非对象一律 `null`（⇒ `legacy`）。
 *
 * **坏数据不猜**：解析失败时返回 `null` 而不是 `{}`。两者都会判 `legacy`，
 * 但 `{}` 会让「写入侧以为记过一笔」变得看起来成立，而 `null` 明确表达"没有"。
 */
export function parseSourceRefValue(raw: unknown): DerivedSourceRef | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const ref: Record<UpstreamRefKey, number> = {}
  let count = 0
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) continue
    ref[key] = value
    count += 1
  }
  return count > 0 ? ref : null
}

/** 序列化。一域都没有记录时返回 `''`（= `legacy`），不写 `'{}'`。 */
export function serializeSourceRefValue(ref: DerivedSourceRef | null | undefined): string {
  if (!ref) return ''
  const keys = Object.keys(ref)
  return keys.length > 0 ? JSON.stringify(ref) : ''
}

/**
 * 写侧主入口：取「此刻」的版本快照，拍成列值。
 *
 * `outlineRev` 是本**次**改动把大纲推到的那一版（`bump` 的返回值）。
 *
 * ## 为什么必须显式传，而不是「再读一次当前 rev」
 *
 * 两者在**没有事务外并发**时结果相同，但这个函数的调用点都在写事务里，
 * 而 `bump` 刚刚把 rev 推到 N。再读一次也读到 N —— 那为什么要传？
 *
 * 因为 `bump` 可能是 `replace` 语义（整本大纲重生成），也可能是作者手改单章；
 * 两种情况 outline 的 rev 都是「这次的新值」。区别只在**章集**，而章集不写进
 * `source_ref`（它在 `upstream_revisions.changed_chapters` 里，是上游侧的事实）。
 * 所以传值等于把「这次的新 rev」这件事写死，不依赖"再读一次恰好读到"。
 *
 * `worldbuilding` / `arc` 没有「本次改动」的概念（它们的改动由各自的
 * `ProjectCoreRepository.update` 通道 bump，调用这里时已经是当前值）。
 */
export function currentSourceRefValue(
  db: ProjectDatabase,
  outlineRev?: number | null,
): string {
  const snapshot = UpstreamRevisionRepository.snapshot(db)
  const ref: Record<UpstreamRefKey, number> = { ...buildSourceRef(BOOK_SOURCE_KEYS, snapshot) }
  if (typeof outlineRev === 'number' && Number.isSafeInteger(outlineRev)) {
    ref[upstreamRefKey('outline')] = outlineRev
  }
  return serializeSourceRefValue(ref)
}
