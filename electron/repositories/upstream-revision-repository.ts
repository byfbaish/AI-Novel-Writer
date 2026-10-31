import { getProjectDb } from '../database'
import {
  BOOK_SCOPE,
  mergeRevisionLogIntoChangedChapters,
  normalizeRevisionReason,
  parseChangedChapters,
  parseRevisionLogChapters,
  serializeChangedChapters,
  upstreamRefKey,
  withChangedChapters,
  type ParsedChangedChapters,
  type UpstreamDomain,
  type UpstreamRevisionLogEntry,
  type UpstreamRevisionReason,
  type UpstreamRevisionSnapshot,
} from '../../src/shared/upstream-revisions'

/**
 * `upstream_revisions`（当前态）与 `upstream_revision_log`（流水，M27 / S6c）的读写
 * （P2-2 期 1 建表，期 2 加判定所需的两种写语义，S6c 加流水）。
 *
 * ## 这一层的唯一职责：让「上游改了一版」这件事可写、可读
 *
 * 它**不判断谁该失效**（那是 `src/shared/upstream-revisions.ts` 的纯函数），
 * 也不清理任何派生（那是读取侧的事）。
 *
 * ## 两张表的分工不许含糊
 *
 * - 当前态表定「旧没旧」：一次一行，`rev` 是判定用的那个值；
 * - 流水表记「哪一版、什么时候、因为什么、改了哪些章」：只追加，一版一行。
 *
 * **S6c 期 2 起章集只记流水**（流水表存在时 `bump` 不再写 `changed_chapters` 列，
 * 该列冻结成流水建立之前的历史尾巴）。之所以敢把判定原料的一部分挪过去：
 * 流水与 `bump` 同事务、同一次写入，不存在「两份可能不一致」的窗口期。
 * 反过来的形状（判定读当前态、取证读流水）会让 `replace` 与 20 版上限
 * 把历史越洗越糊，而流水是唯一没被加工过的那份。
 *
 * ## 为什么 `bump` 不自己开事务
 *
 * 所有真实调用点本身已经在写事务里（`ProjectCoreRepository.update` 的调用方、
 * `commitSynopsis` 的 CAS 事务、`BlueprintRepository.commitRange` 的
 * `tx.immediate()`）。再包一层 `db.transaction` 在 better-sqlite3 里会生成
 * SAVEPOINT，语义没错但多一层开销与一个失败分支；更实际的问题是
 * **版本 +1 必须和内容写入原子**，如果这里自己开事务而调用方没开，
 * 会出现「内容写了、rev 没加」或反过来 —— 那样比不加版本更糟。
 * 所以：**由调用方保证事务**，本层只发语句。
 */
export interface UpstreamRevisionRow {
  domain: string
  scope: string
  rev: number
  digest: string
  /** 两代格式的解析结果。判定侧只认这一种语义。 */
  changedChapters: ParsedChangedChapters
  updatedAt: string
}

/**
 * 章集的写入语义。**没有 `merge`**（期 1 的直觉写法，期 2 核出来是错的）：
 *
 * - `newRevOnly`（默认）：把本次章集挂到**新 rev 这个键**上，不与旧键取并集。
 *   取并集会让「改 31 → 改 33」序列里第 31 章那行被判脏（它写于 rev2，
 *   而 rev3 只改了 33），也就是**拒绝作者刚改完的卡**。
 * - `replace`：整列清空，语义是「这一版改动了全部章」。整本大纲重生成、
 *   恢复稿整段替换走这条。**不能**靠「传空数组 + 取并集」表达 —— 并集会把
 *   历史章集留着，于是 rev 涨了却只有旧章判脏（漏判）。
 */
export type ChangedChaptersMode = 'newRevOnly' | 'replace'

export interface BumpUpstreamRevisionInput {
  domain: UpstreamDomain
  /** 单例域传 `BOOK_SCOPE`（默认）；大纲按单元传单元 id。 */
  scope?: string
  /** 本次改动的章集合（仅 `outline` 有意义）。 */
  changedChapters?: readonly number[]
  /** 内容摘要（可选）。相同 ⇒ 一定没变，可安全跳过重算；不同 ⇒ **不知道**（模型产出不可复现）。 */
  digest?: string
  /** 缺省 `newRevOnly`。 */
  mode?: ChangedChaptersMode
  /**
   * 这一版为什么涨（S6c / M27）。**可以不传**，缺省落 `unknown`。
   *
   * 不强制传，是因为「接线」和「机制」必须能分开上线：先让每一版都记下**时间**，
   * 再把各处能准确说出的原因逐点接上。反过来（先要求传原因），任何一处漏接
   * 都会让这次 bump 直接抛错 —— 一本旁路账本不该有把业务写入弄失败的权力。
   */
  reason?: UpstreamRevisionReason
}

type RawRow = { domain: string; scope: string; rev: number; digest: string; changed_chapters: string; updated_at: string }

type ProjectDatabase = NonNullable<ReturnType<typeof getProjectDb>>

/**
 * 取库。
 *
 * 写方法接受可选 `database`，是因为 `ProjectCoreRepository.update(data, db)` 本身
 * 允许传入非默认库（迁移、临时库、测试夹具）。若这里硬取 `getProjectDb()`，
 * 内容写进 A 库、版本写进 B 库，比不写版本更糟。
 *
 * **读方法也必须接受它**：期 2 起读取侧要在同一个 `db` 上比对版本与派生行，
 * 读默认库会让「写 A 读 B」从写入问题变成判定问题（更难查）。
 */
function requireDb(database?: ProjectDatabase | null): ProjectDatabase {
  const db = database ?? getProjectDb()
  if (!db) throw new Error('项目数据库未连接')
  return db
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

/**
 * 流水表是否存在（M27 之前建的库没有）。
 *
 * 不存在 ⇒ **跳过写流水，不跳过写版本**：版本账是判定原料，流水只是取证原料，
 * 前者缺了功能就错，后者缺了只是暂时没证据。反过来说，也**不许**因为流水表
 * 缺失就让 `bump` 返回 `null` —— 那会把「没记流水」误报成「没记版本」。
 */
function hasLogTable(db: ProjectDatabase): boolean {
  try {
    return Boolean(db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='upstream_revision_log'",
    ).get())
  } catch { return false }
}

type RawLogRow = {
  domain: string; scope: string; rev: number; at: string; reason: string
  changed_chapters: string; covers_all: number
}

function toLogEntry(raw: RawLogRow): UpstreamRevisionLogEntry {
  return {
    domain: raw.domain,
    scope: raw.scope,
    rev: raw.rev,
    at: raw.at,
    reason: normalizeRevisionReason(raw.reason),
    changedChapters: parseRevisionLogChapters(raw.changed_chapters),
    coversAll: raw.covers_all === 1,
  }
}

/**
 * 追加一行流水。**与 `bump` 同一个事务**（调用方已开事务，本层不自开）。
 *
 * 三处细节都是刻意的：
 * - `reason` 缺省落 `unknown`（`normalizeRevisionReason`），**不落空串**；
 * - `covers_all` 独立成列：`replace` 语义是「全部章都变了」，空数组兼表达会被
 *   读成「一章没改」，两个相反的意思不能共用一个值；
 * - 章集存**普通数组**（不是 `upstream_revisions.changed_chapters` 的两代格式）。
 */
function appendLog(db: ProjectDatabase, input: BumpUpstreamRevisionInput, scope: string, rev: number): void {
  if (!hasLogTable(db)) return
  const coversAll = (input.mode ?? 'newRevOnly') === 'replace'
  db.prepare(`
    INSERT INTO upstream_revision_log (domain, scope, rev, reason, changed_chapters, covers_all)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.domain, scope, rev, normalizeRevisionReason(input.reason),
    JSON.stringify([...(input.changedChapters ?? [])]), coversAll ? 1 : 0,
  )
}

/**
 * 查某一域的全部流水（`rev` 升序，同 rev 按写入先后）。
 *
 * `read()` 与 `changeLog()` 都走这里：三处各写一遍 SQL，迟早有一处忘了加
 * `covers_all` 或漏了排序 —— 那种漂移在测试里表现为「文案突然少一段」，
 * 很难联想到这里。
 */
function queryHistory(db: ProjectDatabase, domain: string, scope: string): UpstreamRevisionLogEntry[] {
  const rows = db.prepare(`
    SELECT domain, scope, rev, at, reason, changed_chapters, covers_all
    FROM upstream_revision_log WHERE domain = ? AND scope = ? ORDER BY rev ASC, id ASC
  `).all(domain, scope) as RawLogRow[]
  return rows.map(toLogEntry)
}

export class UpstreamRevisionRepository {
  /**
   * 版本表是否存在。**算失效清单之前必须问一次**（期 3a）。
   *
   * 为什么不能拿 `list()` 的结果代替：表不存在时 `list()` 也返回 `[]`，
   * 而空快照会让每条 `source_ref` 的 `need = 0` ⇒ 每一行都判 stale ⇒
   * plan 报出一份「全军覆没」的清单。那是 blast radius 虚假膨胀，
   * 比「看不出来」更坑作者。所以「没有版本表」与「有表但没行」必须分开。
   */
  static hasTable(database?: ProjectDatabase | null): boolean {
    const db = database ?? getProjectDb()
    if (!db) return false
    return hasRevisionTable(db)
  }

  /**
   * 上游改了一版：`rev + 1`，返回新版本号。
   *
   * 表里没有这一行时直接建到 `rev = 1`（不是 0 再 +1）——「第一次改动就是第 1 版」
   * 比「先有第 0 版表示从没改过」少一个需要解释的状态。
   *
   * ## 返回值为什么是 `number | null`
   *
   * 表不存在（库还没升到 v26）⇒ **`null`，不是 `0`**。这两个必须分开：
   * - `0` 是**合法版本号**（`ensure` 刚建的行）；
   * - `null` 表示「这张库还没有版本账」。
   *
   * 调用方拿 `null` 就**不写** `source_ref`（派生留空 ⇒ 判 `legacy`）。若把 0 写进去，
   * 派生会带着一个版本表里不存在的 rev，判定时 `have === need === 0` 直接判 valid ——
   * **把「库未升级」伪装成「最新」**，比 legacy 更糟。
   *
   * ## 为什么要 CAS
   *
   * 同进程内 better-sqlite3 是同步的，两个窗口也是同一主进程 ⇒ 天然串行，撞不上。
   * 但跨进程（工坊脚本 / 迁移任务 / 第三方直接开库）没有保护，而
   * `fenceProjectSession` 是**身份栅栏不是文件锁**。所以 `UPDATE` 带上
   * `AND rev = ?`：`changes === 0` 说明有人抢先，**重读重试一次**，仍失败返回
   * `null`（放弃记版本，**不阻断业务写入** —— 旁路账本不该成为失败点）。
   */
  static bump(input: BumpUpstreamRevisionInput, database?: ProjectDatabase | null): number | null {
    const db = requireDb(database)
    if (!hasRevisionTable(db)) return null
    const scope = input.scope ?? BOOK_SCOPE
    const mode: ChangedChaptersMode = input.mode ?? 'newRevOnly'
    /**
     * 章集记哪儿（S6c 期 2）。
     *
     * 流水表在 ⇒ **只记流水**，`changed_chapters` 列冻结成「流水建立之前的历史尾巴」。
     * 这一列带着两代格式与 20 版上限，让它继续长就是让那个「为省空间设的补丁」
     * 继续决定判定精度 —— 而流水本身不设上限。
     *
     * 流水表不在（未升到 v28 的老库）⇒ 只能走旧路径，上限仍生效。
     */
    const logOnly = hasLogTable(db)
    const attempt = (): number | null => {
      const existing = db.prepare(
        'SELECT rev, changed_chapters FROM upstream_revisions WHERE domain = ? AND scope = ?',
      ).get(input.domain, scope) as { rev: number; changed_chapters: string } | undefined
      const digest = input.digest ?? ''
      if (!existing) {
        const inserted = logOnly
          ? db.prepare(`
            INSERT INTO upstream_revisions (domain, scope, rev, digest)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(domain, scope) DO NOTHING
          `).run(input.domain, scope, digest)
          : db.prepare(`
            INSERT INTO upstream_revisions (domain, scope, rev, digest, changed_chapters)
            VALUES (?, ?, 1, ?, ?)
            ON CONFLICT(domain, scope) DO NOTHING
          `).run(
            input.domain, scope, digest,
            serializeChangedChapters(withChangedChapters(
              { legacyChapters: [], byRev: new Map() }, 1, input.changedChapters ?? [],
            )),
          )
        return inserted.changes === 1 ? 1 : null
      }
      const nextRev = existing.rev + 1
      // 流水表在时不碰 `changed_chapters`：那一列是历史尾巴，改写它等于
      // 把「流水建立之前」的证据一起抹掉（`replace` 曾在这里清空它）。
      const updated = logOnly
        ? db.prepare(`
          UPDATE upstream_revisions
          SET rev = ?, digest = ?, updated_at = datetime('now')
          WHERE domain = ? AND scope = ? AND rev = ?
        `).run(nextRev, digest, input.domain, scope, existing.rev)
        : db.prepare(`
          UPDATE upstream_revisions
          SET rev = ?, digest = ?, changed_chapters = ?, updated_at = datetime('now')
          WHERE domain = ? AND scope = ? AND rev = ?
        `).run(
          nextRev, digest,
          serializeChangedChapters(mode === 'replace'
            ? { legacyChapters: [], byRev: new Map<number, readonly number[]>() }
            : withChangedChapters(parseChangedChapters(existing.changed_chapters), nextRev, input.changedChapters ?? [])),
          input.domain, scope, existing.rev,
        )
      return updated.changes === 1 ? nextRev : null
    }
    const first = attempt()
    if (first !== null) {
      appendLog(db, input, scope, first)
      return first
    }
    // 重试上限 1 次：仍是 null 说明在这个库上并发写很频繁，继续重试只会把
    // 调用方的写入事务拖长（版本是旁路账本，不值这个代价）。
    const retried = attempt()
    if (retried !== null) appendLog(db, input, scope, retried)
    return retried
  }

  /**
   * 建一行 `rev = 0` 的占位（幂等），返回当前 rev。
   *
   * 用途：**单元大纲刚生成、还没有任何派生依赖它时**先把行建出来，让后续
   * `buildSourceRef` 取得到值。没有这一行，`buildSourceRef` 会跳过该键，
   * 派生就被记成 `legacy` —— 一个刚生成的新派生被判 `legacy` 是假信号。
   *
   * 表不存在返回 `null`（与 `bump` 同一语义：`0` 是合法版本号，不能兼任"没有"）。
   *
   * **不写流水**：`0` 表示「从没改过」，不是一个版本；把它记进流水会让
   * 「历史第一版」变成一条「改了但没改什么」的记录。
   */
  static ensure(domain: UpstreamDomain, scope: string = BOOK_SCOPE, database?: ProjectDatabase | null): number | null {
    const db = requireDb(database)
    if (!hasRevisionTable(db)) return null
    const existing = db.prepare(
      'SELECT rev FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).pluck().get(domain, scope) as number | undefined
    if (typeof existing === 'number') return existing
    db.prepare(`
      INSERT INTO upstream_revisions (domain, scope, rev) VALUES (?, ?, 0)
      ON CONFLICT(domain, scope) DO NOTHING
    `).run(domain, scope)
    const created = db.prepare(
      'SELECT rev FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).pluck().get(domain, scope) as number | undefined
    return typeof created === 'number' ? created : null
  }

  /**
   * 读一行。没有该行返回 `null`（**不返回 0**：「没有版本」和「第 0 版」是两件事）。
   *
   * `changedChapters` 是**两份合起来的**（S6c 期 2）：`changed_chapters` 列只剩
   * 流水表建立之前的那些版本，之后每一版都在流水里。只读列会让调用方看到半个
   * 真相（新库上通常是空的），而空章集的判定语义是「全部章都改过」—— 一次
   * 误读就是全库判脏。
   */
  static read(domain: UpstreamDomain, scope: string = BOOK_SCOPE, database?: ProjectDatabase | null): UpstreamRevisionRow | null {
    const db = database ?? getProjectDb()
    if (!db || !hasRevisionTable(db)) return null
    const raw = db.prepare(
      'SELECT * FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).get(domain, scope) as RawRow | undefined
    if (!raw) return null
    const row = toRow(raw)
    if (!hasLogTable(db)) return row
    const entries = queryHistory(db, domain, scope)
    if (entries.length === 0) return row
    return { ...row, changedChapters: mergeRevisionLogIntoChangedChapters(row.changedChapters, entries) }
  }

  /**
   * 单个键的当前 rev；没有该行返回 `null`（语义同上）。
   *
   * **不走 `read()`**：`read()` 现在要顺带查流水补章集，而这里只问版本号 ——
   * 调用点（plan、`buildSourceRef`）会连续问很多次，多一条流水查询纯属浪费。
   */
  static readRev(domain: UpstreamDomain, scope: string = BOOK_SCOPE, database?: ProjectDatabase | null): number | null {
    const db = database ?? getProjectDb()
    if (!db || !hasRevisionTable(db)) return null
    const rev = db.prepare(
      'SELECT rev FROM upstream_revisions WHERE domain = ? AND scope = ?',
    ).pluck().get(domain, scope) as number | undefined
    return typeof rev === 'number' ? rev : null
  }

  /**
   * 某一域的全部流水（**按 `rev` 升序**，同 rev 多行按写入先后）。
   *
   * 同 rev 出现多行是**正常痕迹**，不是脏数据：导入更早的便携包会让 rev 回退，
   * 之后再 bump 就会与流水里已有的 rev 撞号。所以这里不合并、不去重，
   * 由读取方按 `id` 顺序理解「同一版被写过两次」。
   *
   * 表不存在（M27 之前的库）⇒ 返回空数组。**空数组不等于「没改过」**：
   * 调用方要区分「没有流水」与「流水说没改」，须先问 `hasLog()`。
   */
  static history(domain: UpstreamDomain, scope: string = BOOK_SCOPE, database?: ProjectDatabase | null): UpstreamRevisionLogEntry[] {
    const db = database ?? getProjectDb()
    if (!db || !hasLogTable(db)) return []
    return queryHistory(db, domain, scope)
  }

  /** 某一域最近一行流水（按 `id` 取，不按 `rev` —— 撞号时后写的才是最新的）。 */
  static latestLog(domain: UpstreamDomain, scope: string = BOOK_SCOPE, database?: ProjectDatabase | null): UpstreamRevisionLogEntry | null {
    const db = database ?? getProjectDb()
    if (!db || !hasLogTable(db)) return null
    const row = db.prepare(`
      SELECT domain, scope, rev, at, reason, changed_chapters, covers_all
      FROM upstream_revision_log WHERE domain = ? AND scope = ? ORDER BY id DESC LIMIT 1
    `).get(domain, scope) as RawLogRow | undefined
    return row ? toLogEntry(row) : null
  }

  /** 流水表是否存在。**「没有流水」与「流水说没改」必须分开**（同 `hasTable` 的理由）。 */
  static hasLog(database?: ProjectDatabase | null): boolean {
    const db = database ?? getProjectDb()
    return db ? hasLogTable(db) : false
  }

  /** 全部行，按 domain/scope 排序 —— 给面板与 plan 阶段用。 */
  static list(database?: ProjectDatabase | null): UpstreamRevisionRow[] {
    const db = database ?? getProjectDb()
    if (!db || !hasRevisionTable(db)) return []
    const rows = db.prepare(
      'SELECT * FROM upstream_revisions ORDER BY domain ASC, scope ASC',
    ).all() as RawRow[]
    return rows.map(toRow)
  }

  /**
   * 章集视图（`键 → 解析后的章集`），直接喂 `derivedStatusForChapters`。
   *
   * ## 两份来源，流水优先（S6c 期 2）
   *
   * `upstream_revisions.changed_chapters` 覆盖「流水表建立之前」的版本，
   * `upstream_revision_log` 覆盖之后每一版 —— 缺任一段，`changedChaptersBetween`
   * 都会判「收窄不了」⇒ 整域按全改算，按章收窄这件事就整段失效。
   * 同 rev 两边都有时以流水为准（当前态列被 `replace` / 20 版上限加工过）。
   *
   * ## 读一次全表就够
   *
   * 判定要逐行做，但在循环里反复调 `list()` 会把 `sqlite_master` 探测与整表扫描
   * 乘以行数（`get-all` 上是上千倍）。
   */
  static changeLog(database?: ProjectDatabase | null): ReadonlyMap<string, ParsedChangedChapters> {
    const db = database ?? getProjectDb()
    const map = new Map<string, ParsedChangedChapters>()
    for (const row of UpstreamRevisionRepository.list(db)) {
      map.set(upstreamRefKey(row.domain as UpstreamDomain, row.scope), row.changedChapters)
    }
    if (!db || !hasLogTable(db)) return map
    const grouped = new Map<string, UpstreamRevisionLogEntry[]>()
    for (const raw of db.prepare(`
      SELECT domain, scope, rev, at, reason, changed_chapters, covers_all
      FROM upstream_revision_log ORDER BY rev ASC, id ASC
    `).all() as RawLogRow[]) {
      const key = upstreamRefKey(raw.domain as UpstreamDomain, raw.scope)
      const bucket = grouped.get(key)
      if (bucket) bucket.push(toLogEntry(raw))
      else grouped.set(key, [toLogEntry(raw)])
    }
    for (const [key, entries] of grouped) {
      // 流水有、当前态行没有的键：只可能出现在「版本行被删、流水还留着」的库上。
      // 不能丢 —— 丢了那些版本的章集就没了，判定退回全改。
      map.set(key, mergeRevisionLogIntoChangedChapters(map.get(key), entries))
    }
    return map
  }

  /**
   * 当前版本快照（`键 → rev`），直接喂 `derivedStatus` 与 `buildSourceRef`。
   *
   * 键用 `upstreamRefKey(domain, scope)` 生成，与派生侧 `source_ref` 的键完全同构 ——
   * 这两处一旦格式不一致，比对会永远返回「全落后」。所以键的拼装只允许有
   * `upstreamRefKey` 一个来源。
   */
  static snapshot(database?: ProjectDatabase | null): UpstreamRevisionSnapshot {
    return UpstreamRevisionRepository.snapshotWithOverride([], database)
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
    database?: ProjectDatabase | null,
  ): UpstreamRevisionSnapshot {
    const map = new Map<string, number>()
    for (const row of UpstreamRevisionRepository.list(database)) {
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
