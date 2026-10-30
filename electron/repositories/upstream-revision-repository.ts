import { getProjectDb } from '../database'
import {
  BOOK_SCOPE,
  mergeChangedChapters,
  upstreamRefKey,
  type UpstreamDomain,
  type UpstreamRevisionSnapshot,
} from '../../src/shared/upstream-revisions'

/**
 * `upstream_revisions` 的读写（P2-2 期 1，2026-10-30）。
 *
 * ## 这一层的唯一职责：让「上游改了一版」这件事可写、可读
 *
 * 它**不判断谁该失效**（那是 `src/shared/upstream-revisions.ts` 的纯函数），
 * 也不清理任何派生（那是读取侧的事）。期 1 只做到「版本存在且可观测」，
 * 不改任何现有行为 —— 所以本文件被任何现有读路径 import 都不应该，
 * 只有**写入点**和**未来的判定点**会用它。
 *
 * ## 为什么 `bump` 不自己开事务
 *
 * 所有调用点本身已经在写事务里（`ProjectCoreRepository.update` 的调用方、
 * `commitSynopsis` 的 CAS 事务）。再包一层 `db.transaction` 在 better-sqlite3
 * 里会生成 SAVEPOINT，语义没错但多一层开销与一个失败分支；更实际的问题是
 * **版本 +1 必须和内容写入原子**，如果这里自己开事务而调用方没开，
 * 会出现「内容写了、rev 没加」或反过来 —— 那样比不加版本更糟。
 * 所以：**由调用方保证事务**，本层只发语句。
 */
export interface UpstreamRevisionRow {
  domain: string
  scope: string
  rev: number
  digest: string
  changedChapters: number[]
  updatedAt: string
}

export interface BumpUpstreamRevisionInput {
  domain: UpstreamDomain
  /** 单例域传 `BOOK_SCOPE`（默认）；大纲按单元传单元 id。 */
  scope?: string
  /** 批内改动章集合（仅 `outline` 有意义），与既有值取并集。 */
  changedChapters?: readonly number[]
  /**
   * 内容摘要（可选）。相同 ⇒ 一定没变，可安全跳过重算（设计稿 §四）；
   * 不同 ⇒ **不知道**（模型产出不可复现，§3.1），不可据此判「没变」。
   */
  digest?: string
}

type RawRow = { domain: string; scope: string; rev: number; digest: string; changed_chapters: string; updated_at: string }

type ProjectDatabase = NonNullable<ReturnType<typeof getProjectDb>>

/**
 * 取库。
 *
 * 写入方法接受可选 `database`，是因为 `ProjectCoreRepository.update(data, db)` 本身
 * 允许传入非默认库（迁移、临时库、测试夹具）。若这里硬取 `getProjectDb()`，
 * 内容写进 A 库、版本写进 B 库，比不写版本更糟。
 */
function requireDb(database?: ProjectDatabase | null): ProjectDatabase {
  const db = database ?? getProjectDb()
  if (!db) throw new Error('项目数据库未连接')
  return db
}

/** 解析 `changed_chapters`。坏数据一律当空数组 —— 章集合只用于缩小影响面，不能因为它坏掉就阻断写入。 */
function parseChangedChapters(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is number => typeof value === 'number' && Number.isSafeInteger(value))
  } catch { return [] }
}

/**
 * 表是否存在。**不存在不算错误**，见 `bump` 的说明。
 *
 * 每次查询 `sqlite_master` 的开销可以忽略（SQLite 把它当系统目录缓存），
 * 所以不做进程级缓存 —— 缓存要在库切换/关闭时失效，漏失效的代价是「换库后
 * 仍按旧库的判断跳过写入」，比多查一次贵得多。
 */
function hasRevisionTable(db: ProjectDatabase): boolean {
  try {
    return Boolean(db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='upstream_revisions'",
    ).get())
  } catch { return false }
}

function toRow(raw: RawRow): UpstreamRevisionRow {
  return {
    domain: raw.domain,
    scope: raw.scope,
    rev: raw.rev,
    digest: raw.digest,
    changedChapters: parseChangedChapters(raw.changed_chapters),
    updatedAt: raw.updated_at,
  }
}

export class UpstreamRevisionRepository {
  /**
   * 上游改了一版：`rev + 1`，返回新版本号。
   *
   * 表里没有这一行时直接建到 `rev = 1`（不是 0 再 +1）——「第一次改动就是第 1 版」
   * 比「先有第 0 版表示从没改过」少一个需要解释的状态。
   *
   * `changedChapters` **取并集而不是覆盖**：同一批连改第 31、33 章，若第二次把集合
   * 覆盖成 `[33]`，依赖第 31 章的那条派生就会在 `rev` 已变的情况下被判 `valid` ——
   * 正是要防的漏判（见 `mergeChangedChapters` 注释）。
   */
  static bump(input: BumpUpstreamRevisionInput, database?: ProjectDatabase | null): number {
    const db = requireDb(database)
    // 表不在 = 这个库还没升到 v25 = 上游版本机制尚未启用。
    //
    // **静默跳过，不抛错**：这是一本**旁路账本**，不该成为业务写入的失败点。
    // 「内容写进去了、版本没记」在这里是安全的 —— 因为同一批派生也还没有
    // `source_ref`，读取侧一律判 `legacy`（不知道），不会伪装成 `valid`。
    // 反过来，为了记一笔账让作者的正文/大纲写入失败，代价完全不成比例。
    if (!hasRevisionTable(db)) return 0
    const scope = input.scope ?? BOOK_SCOPE
    const existing = db.prepare(
      'SELECT rev, changed_chapters FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).get(input.domain, scope) as { rev: number; changed_chapters: string } | undefined
    const nextRev = (existing?.rev ?? 0) + 1
    const mergedChapters = mergeChangedChapters(
      parseChangedChapters(existing?.changed_chapters),
      input.changedChapters ?? [],
    )
    const digest = input.digest ?? ''
    if (existing) {
      db.prepare(`
        UPDATE upstream_revisions
        SET rev = ?, digest = ?, changed_chapters = ?, updated_at = datetime('now')
        WHERE domain = ? AND scope = ?
      `).run(nextRev, digest, JSON.stringify(mergedChapters), input.domain, scope)
    } else {
      db.prepare(`
        INSERT INTO upstream_revisions (domain, scope, rev, digest, changed_chapters)
        VALUES (?, ?, ?, ?, ?)
      `).run(input.domain, scope, nextRev, digest, JSON.stringify(mergedChapters))
    }
    return nextRev
  }

  /**
   * 建一行 `rev = 0` 的占位（幂等）。
   *
   * 用途：**单元大纲刚生成、还没有任何派生依赖它时**先把行建出来，让后续
   * `buildSourceRef` 取得到值。没有这一行，`buildSourceRef` 会跳过该键，
   * 派生就被记成 `legacy` —— 一个刚生成的新派生被判 `legacy` 是假信号。
   */
  static ensure(domain: UpstreamDomain, scope: string = BOOK_SCOPE, database?: ProjectDatabase | null): number {
    const db = requireDb(database)
    if (!hasRevisionTable(db)) return 0
    const existing = db.prepare(
      'SELECT rev FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).pluck().get(domain, scope) as number | undefined
    if (typeof existing === 'number') return existing
    db.prepare('INSERT INTO upstream_revisions (domain, scope, rev) VALUES (?, ?, 0)').run(domain, scope)
    return 0
  }

  /** 读一行。没有该行返回 `null`（**不返回 0**：「没有版本」和「第 0 版」是两件事）。 */
  static read(domain: UpstreamDomain, scope: string = BOOK_SCOPE): UpstreamRevisionRow | null {
    const db = getProjectDb()
    if (!db || !hasRevisionTable(db)) return null
    const raw = db.prepare(
      'SELECT * FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).get(domain, scope) as RawRow | undefined
    return raw ? toRow(raw) : null
  }

  /** 单个键的当前 rev；没有该行返回 `null`（语义同上）。 */
  static readRev(domain: UpstreamDomain, scope: string = BOOK_SCOPE): number | null {
    return UpstreamRevisionRepository.read(domain, scope)?.rev ?? null
  }

  /** 全部行，按 domain/scope 排序 —— 给面板与 plan 阶段用。 */
  static list(): UpstreamRevisionRow[] {
    const db = getProjectDb()
    if (!db || !hasRevisionTable(db)) return []
    const rows = db.prepare(
      'SELECT * FROM upstream_revisions ORDER BY domain ASC, scope ASC',
    ).all() as RawRow[]
    return rows.map(toRow)
  }

  /**
   * 当前版本快照（`键 → rev`），直接喂 `derivedStatus` 与 `buildSourceRef`。
   *
   * 键用 `upstreamRefKey(domain, scope)` 生成，与派生侧 `source_ref` 的键完全同构 ——
   * 这两处一旦格式不一致，比对会永远返回「全落后」。所以键的拼装只允许有
   * `upstreamRefKey` 一个来源。
   *
   * `excludeKeys` 用于 plan 阶段：算「**假如**这一域变成 rev+1 会波及什么」时，
   * 把该键从快照里剔除再逐条判定更麻烦 —— 直接传入覆盖值反而清楚。
   */
  static snapshot(): UpstreamRevisionSnapshot {
    return UpstreamRevisionRepository.snapshotWithOverride([])
  }

  /**
   * 在真实快照上叠加「假想版本」，供 plan 阶段使用（设计稿 §八）。
   *
   * `overrides` 里的键**必须已存在于表中**：plan 是问「如果这域再改一版会怎样」，
   * 不是「凭空造一个域」。给不存在的键一个假 rev 会让所有派生都不匹配，
   * 于是 plan 报出「全军覆没」的假警报 —— 那是 blast radius 最危险的低估/高估混合体。
   */
  static snapshotWithOverride(
    overrides: ReadonlyArray<{ domain: UpstreamDomain; scope?: string; rev: number }>,
  ): UpstreamRevisionSnapshot {
    const map = new Map<string, number>()
    for (const row of UpstreamRevisionRepository.list()) {
      map.set(upstreamRefKey(row.domain as UpstreamDomain, row.scope), row.rev)
    }
    for (const override of overrides) {
      const key = upstreamRefKey(override.domain, override.scope ?? BOOK_SCOPE)
      if (!map.has(key)) continue
      map.set(key, override.rev)
    }
    return map
  }
}
