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
 * 「大纲」自己依赖的两个域（P2-3 期 3b · 中间环）。
 *
 * **不含 `outline`**：派生不记自己。记进去会让大纲刚写完就判自己 stale。
 *
 * 这一条就是作者 2026-10-31 裁定的「补齐中间环」：世界/弧光改了 → 大纲被判旧 →
 * 提示作者重生成大纲 → 大纲 rev +1 → 蓝图/交接单才 stale。**级联逐层发生，
 * 不跨层直传**。没有这条，「蓝图只记 outline」的收窄（S6a）会让世界观改动
 * 在整个链路上变成静默。
 */
export const SYNOPSIS_SOURCE_KEYS: readonly UpstreamRefKey[] = Object.freeze([
  upstreamRefKey('worldbuilding'),
  upstreamRefKey('arc'),
])

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
 * 「这一类派生到底依赖哪几个域」—— **S6a 的收窄口径，唯一出处**（2026-10-31）。
 *
 * ## 为什么不再三域全记
 *
 * 期 2 让三处写入点共用 `BOOK_SOURCE_KEYS`，于是「改世界观 ⇒ 每一张蓝图都 stale ⇒
 * 正文链硬拒」变成了跨层直传。作者的裁定是**级联逐层发生**：世界观改了先只该提醒
 * 「大纲旧了」；大纲真被重生成之后，蓝图才跟着旧。三域全记把这两级压成了一级，
 * 表现就是「改一个设定，全部章节写不了」。
 *
 * 收窄之后，「世界改了」这件事仍然有人接：M26 的 `project_core.synopsis_source_ref`
 * 让大纲自己记 world/arc（见 `SYNOPSIS_SOURCE_KEYS`）。**两者必须一起存在** ——
 * 只收窄、不补中间环，世界观改动就在整条链路上彻底静默。
 *
 * ## 剧情树为什么保留三域
 *
 * 它不是大纲的下游：它由整份架构（世界 + 弧光 + 大纲）一次性生成，三个域都是它的
 * **直接**上游。把它也收窄成单域，就等于「世界观大改，剧情树照旧被认为有效」。
 *
 * ## 存量行不受影响
 *
 * 判定只比对 `source_ref` 里**出现过**的键，所以老行仍按三域判（多报一次），
 * 重生成之后自然按新口径。**不回填**：回填等于替作者断言「你这段没受世界影响」。
 */
export type DerivedSourceKind = 'chapter-plan' | 'architecture'

/** 章级规划派生：章节蓝图、卷末交接单。只依赖情节大纲。 */
const CHAPTER_PLAN_SOURCE_KEYS: readonly UpstreamRefKey[] = Object.freeze([
  upstreamRefKey('outline'),
])

const SOURCE_KEYS_BY_KIND: Readonly<Record<DerivedSourceKind, readonly UpstreamRefKey[]>> = Object.freeze({
  'chapter-plan': CHAPTER_PLAN_SOURCE_KEYS,
  architecture: BOOK_SOURCE_KEYS,
})

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
  kind: DerivedSourceKind,
  outlineRev?: number | null,
): string {
  const snapshot = UpstreamRevisionRepository.snapshot(db)
  const ref: Record<UpstreamRefKey, number> = { ...buildSourceRef(SOURCE_KEYS_BY_KIND[kind], snapshot) }
  if (typeof outlineRev === 'number' && Number.isSafeInteger(outlineRev)) {
    ref[upstreamRefKey('outline')] = outlineRev
  }
  return serializeSourceRefValue(ref)
}

/**
 * 写侧：大纲自己的来源列值（M26）。**只记 worldbuilding + arc**。
 *
 * 与 `currentSourceRefValue` 分开而不是加参数，是因为两者问的不是同一个问题：
 * 那个问「这一行派生基于哪一版上游」，这个问「这段大纲是在什么前提下写出来的」。
 * 合成一个函数会让调用点必须传一个"要哪些域"的清单 —— 那就等于把口径挪到调用点，
 * 而口径只该有一个出处。
 */
export function synopsisSourceRefValue(db: ProjectDatabase): string {
  if (!hasColumn(db, 'project_core', 'synopsis_source_ref')) return ''
  const snapshot = UpstreamRevisionRepository.snapshot(db)
  const ref: Record<UpstreamRefKey, number> = {}
  for (const key of SYNOPSIS_SOURCE_KEYS) {
    // **缺键一律记 0，不许跳过**。这是本函数与 `buildSourceRef` 唯一的不同，
    // 且是刻意的：判定侧只比对 `source_ref` 里**出现过**的键，跳过就等于把这个域
    // 永久排除在判定之外 —— 于是「弧光第一次被改」这种最常见的情形完全无声。
    // 0 的含义是「写这段大纲时，该域还没有任何版本记录」，第一次 bump 落在 1，
    // 比对立刻成立（`need = 1 > have = 0`）。方向保守：宁可多提示一次。
    const rev = snapshot.get(key)
    ref[key] = typeof rev === 'number' && Number.isSafeInteger(rev) ? rev : 0
  }
  return serializeSourceRefValue(ref)
}
