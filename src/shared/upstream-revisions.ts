/**
 * 上游版本与派生来源判定（P2-2，2026-10-30）。
 *
 * ## 它解决什么
 *
 * 「上游重建不触碰任何下游表」是这个库的既有事实（见
 * `docs/handoffs/2026-10-30-invalidation-and-deletion-baseline.md` §三）。
 * 事实本身没错，错的是**下游没有凭据知道自己旧了**：15 类派生里绝大多数
 * 永远不知道自己基于的是哪一版上游，于是上游改了、派生照旧被消费。
 *
 * 这里给两样东西：
 * - 上游三域各一条单调递增的 `rev`（`worldbuilding` / `arc` / `outline:<unit>`）；
 * - 派生侧记一个 `source_ref`（生成这一行时的快照），读取时比一次。
 *
 * ## 为什么是「读时判定」而不是「写时推送」
 *
 * 行业五套先例（物化视图维护 / Bazel change pruning / Salsa red-green / dbt
 * state:modified / K8s level-triggered）收敛到同一条：**写入时不向外传播，
 * 读取时再验证**。K8s 那边的论证最直白 —— 事件会丢、会乱序、会在进程重启时
 * 消失，靠事件驱动的失效系统迟早永久错。
 *
 * 所以本模块**没有任何通知、订阅、反向索引**。它只有两个纯函数：
 * 写入侧取快照（`buildSourceRef`），读取侧比对（`derivedStatus`）。
 *
 * ## 为什么不与 `chapter-staleness.ts` 合并
 *
 * 两者传播拓扑同形（都是自上而下），但**判定原料不同**：
 * - 章节域：有序、单调，`requiredGeneration` 靠扫描变更日志前缀最大算出，
 *   语义是「只影响该章之后」；
 * - 上游域：无序集合（`{worldbuilding:3, arc:1}` 谁先谁后无意义）。
 *
 * 硬塞进一个函数，要么把有序压成集合（丢掉「只影响之后」），要么把集合碾成
 * 一条线（丢掉「哪一域变了」）。所以两者**分开判定、共用出口** ——
 * `chapterStaleness()` 的返回值由调用方适配成 `DerivedValidity`，
 * 读取侧的拒绝逻辑与文案只写一次。裁定记录见
 * `docs/design/architecture/upstream-version-and-derived-invalidation-design.md` §七。
 */

/**
 * 上游域。**只有三个**，这是核过代码的结果，不是设计取舍：
 *
 * - `volumes.planned_*` 看着像上游，实际是 M19 明写的「由重建任务从
 *   `plot_structure_plan` + `synopsis` 算出来的物化副本，**不是权威**」，
 *   属确定性派生（A 档），现算即可，不记版本。
 * - `chapter` 域已有 `continuity_projection_meta.generation` 一整套机制，
 *   不复刻（见文件头「为什么不合并」）。
 */
export type UpstreamDomain = 'worldbuilding' | 'arc' | 'outline'

/** 单例域（全书只有一份）的作用域名。 */
export const BOOK_SCOPE = 'book'

/**
 * `source_ref` 的键。形如 `worldbuilding:book` / `arc:book` / `outline:u07`。
 *
 * 恒为 `domain:scope` 两段（`scope` 自身不含冒号），解析时 `split(':')` 第一段
 * 即 domain。**不要让 scope 变成复合路径**（如 `outline:u07:31-40`）——
 * 那样键会随改动变化，同一批的两个版本变成两行互不相干的记录。
 */
export type UpstreamRefKey = string

/** 派生侧记录的来源快照：键 → 生成时的 rev。 */
export type DerivedSourceRef = Readonly<Record<UpstreamRefKey, number>>

export function upstreamRefKey(domain: UpstreamDomain, scope: string = BOOK_SCOPE): UpstreamRefKey {
  return `${domain}:${scope}`
}

/** 键解析。格式不合法时返回 `null`（调用方按 `legacy` 处理，不猜）。 */
export function parseUpstreamRefKey(key: string): { domain: string; scope: string } | null {
  const separator = key.indexOf(':')
  if (separator <= 0 || separator === key.length - 1) return null
  return { domain: key.slice(0, separator), scope: key.slice(separator + 1) }
}

/** 当前版本表的只读视图：键 → 当前 rev。 */
export type UpstreamRevisionSnapshot = ReadonlyMap<UpstreamRefKey, number>

/**
 * 写入侧取快照：把「这一行依赖哪些上游」翻译成「它们此刻各是第几版」。
 *
 * `keys` 里若有当前版本表还没记录过的键，该键**不进快照** —— 它表示「这一行
 * 生成时，该上游还没有版本概念」，读取侧会因此判 `legacy`，而不是伪造一个
 * rev=0 假装自己是最新的。
 */
export function buildSourceRef(
  keys: readonly UpstreamRefKey[],
  current: UpstreamRevisionSnapshot,
): DerivedSourceRef {
  const snapshot: Record<UpstreamRefKey, number> = {}
  for (const key of keys) {
    const rev = current.get(key)
    if (typeof rev === 'number' && Number.isSafeInteger(rev)) snapshot[key] = rev
  }
  return snapshot
}

/** 判定结果的四种形态。 */
export type DerivedValidityState =
  /** 每个依赖域的 rev 都与当前一致 */
  | 'valid'
  /** 至少一个依赖域落后（或与当前不一致） */
  | 'stale'
  /** 没有来源记录：上游版本机制出现之前生成的存量行 */
  | 'legacy'
  /** 本就不该有来源（未定稿、无派生），不参与判定、不出徽标 */
  | 'not-applicable'

/** 某一个落后的域。文案要用它回答「到底哪一域变了」。 */
export interface DerivedDrift {
  key: UpstreamRefKey
  /** 生成这一行时该域的 rev */
  have: number
  /** 当前 rev */
  need: number
}

export type DerivedValidity =
  | { state: 'valid' }
  | { state: 'stale'; behind: readonly DerivedDrift[] }
  | { state: 'legacy' }
  | { state: 'not-applicable'; reason: string }

/** 派生本身不存在时的构造器，省得每个调用点自己写字面量。 */
export function notApplicable(reason: string): DerivedValidity {
  return { state: 'not-applicable', reason }
}

/**
 * 读取侧判定。纯函数：不读库、不看时间、不写任何东西。
 *
 * ## 为什么判 `have !== need` 而不是 `have < need`
 *
 * 正常情况下 `rev` 单调递增，落后必然是 `have < need`。但有两种情况会让
 * `have > need` 出现，且都必须算脏：
 * - 上游被「清除全部」后重建，版本表若被重置过（防御性：rev 设计上不复位，
 *   但这里不依赖那个约定）；
 * - 库被备份恢复到更早的版本 —— 这跟删除收据那次事故是同一个家族
 *   （ADR-0026：收据描述的现实可能已经不在了）。
 *
 * 用 `!==` 的代价是「多判几条脏」，收益是不会漏判。这个方向选错一次就是
 * 静默消费旧数据。
 *
 * ## `source_ref` 里出现未知键怎么办
 *
 * 例如快照记着 `outline:u07` 但当前版本表里没有这一行。这说明上游那一批被
 * 删掉了，而派生还留着 —— 派生基于的东西已经不存在，**判 stale**（`need` 记 0），
 * 不当 legacy（legacy 是「从来没记过来源」，性质不同：那种还有可能本来就对）。
 */
export function derivedStatus(
  sourceRef: DerivedSourceRef | null | undefined,
  current: UpstreamRevisionSnapshot,
): DerivedValidity {
  if (!sourceRef || typeof sourceRef !== 'object') return { state: 'legacy' }
  const keys = Object.keys(sourceRef)
  if (keys.length === 0) return { state: 'legacy' }
  const behind: DerivedDrift[] = []
  for (const key of keys) {
    const have = sourceRef[key]
    if (!Number.isSafeInteger(have)) continue
    const need = current.get(key) ?? 0
    if (have !== need) behind.push({ key, have, need })
  }
  return behind.length === 0 ? { state: 'valid' } : { state: 'stale', behind }
}

/** 该派生是否需要在界面上提示、并在读取侧拦截（`legacy` 不在拦截范围，见设计稿 §十.4）。 */
export function blocksConsumption(result: DerivedValidity): boolean {
  return result.state === 'stale'
}

/**
 * 把落后的域翻译成一句人话。
 *
 * 只报「上游变了」没有信息量 —— 作者要知道的是**哪一域变了**，才能判断要不要
 * 整体重来。顺序按 `worldbuilding` → `arc` → `outline` 固定，保证同一份数据
 * 每次渲染出的文案一致（避免界面抖动）。
 */
export function describeDrift(behind: readonly DerivedDrift[]): string {
  const order: readonly string[] = ['worldbuilding', 'arc', 'outline']
  const label: Record<string, string> = {
    worldbuilding: '世界观',
    arc: '弧光',
    outline: '情节大纲',
  }
  const ranked = [...behind].sort((left, right) => {
    const leftDomain = parseUpstreamRefKey(left.key)?.domain ?? left.key
    const rightDomain = parseUpstreamRefKey(right.key)?.domain ?? right.key
    const leftRank = order.indexOf(leftDomain)
    const rightRank = order.indexOf(rightDomain)
    if (leftRank !== rightRank) return (leftRank < 0 ? order.length : leftRank) - (rightRank < 0 ? order.length : rightRank)
    return left.key.localeCompare(right.key)
  })
  const parts = ranked.map((drift) => {
    const parsed = parseUpstreamRefKey(drift.key)
    const domain = parsed?.domain ?? drift.key
    const name = label[domain] ?? domain
    const scope = parsed && parsed.scope !== BOOK_SCOPE ? `（${parsed.scope}）` : ''
    return `${name}${scope}`
  })
  return parts.join('、')
}

/**
 * 把章区间展开成章号数组（`changed_chapters` 的写入形态）。
 *
 * 为什么不存 `{from,to}` 而是展开：判定时要回答的是「第 N 章在不在这批里」，
 * 展开后是 `includes` 一次，存区间则每次都要判区间包含。而且区间会重叠
 * （同一批先改 31–35、再改 33–37），展开后并集天然正确，存区间要自己算合并。
 *
 * 边界：`from > to` 或非安全整数一律返回空数组（= 不知道 / 全部），
 * 与 `refCoversChapter` 的「空数组视为覆盖」约定一致 —— 坏数据的方向必须是
 * **多判脏**，不是漏判。
 */
export function expandChapterRange(range: Readonly<{ from: number; to: number }> | null | undefined): number[] {
  if (!range) return []
  const { from, to } = range
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return []
  if (from <= 0 || to < from) return []
  const chapters: number[] = []
  for (let chapter = from; chapter <= to; chapter += 1) chapters.push(chapter)
  return chapters
}


/**
 * 某个派生依赖的第 N 章是否在被改过的范围内。
 *
 * 只有 `outline` 域需要这一问（它按批次分版）；`worldbuilding` / `arc` 是全书的，
 * 改了就是全改。所以本函数对非 `outline` 的键**恒返回 true** —— 调用方不必自己
 * 判域，避免「忘了判域就当成没改过」。
 */
export function refCoversChapter(
  key: UpstreamRefKey,
  changedChapters: readonly number[] | null | undefined,
  chapterNumber: number,
): boolean {
  const parsed = parseUpstreamRefKey(key)
  if (!parsed) return true
  if (parsed.domain !== 'outline') return true
  if (!changedChapters || changedChapters.length === 0) return true
  return changedChapters.includes(chapterNumber)
}

// ============================================================================
// 期 2：按章收窄的判定（P2-2，2026-10-30）
// ============================================================================
//
// 上面那半（`derivedStatus`）只回答「rev 一样吗」。期 2 之后 `changed_chapters`
// 要参与判定，于是判定从「一个值比另一个值」变成「一段区间里改过哪些章」。
// 新增的四条不变量都在下面这段里，每条对应一个会**静默出错**的形态，改之前先读。

/**
 * 章集的存储形态：`rev → 改动的章号`。
 *
 * 为什么不是「累积并集」：连续改第 31、33 章后，累积并集是 `[31,33]`；此时判
 * **第 31 章那行**（它写于 rev2）→ `have=2, need=3`，若拿累积并集算交集，
 * 31 ∈ `[31,33]` ⇒ 判 stale ⇒ **拒绝作者刚改完的那张卡**。方向反了。
 * 按 rev 存才能只取 `(have, need]` 这一段，31 不在 rev3 的改动里，判 valid。
 *
 * **上限**：`changed_chapters` 只保留最近若干版，更早的**合并成「全部章」**
 * （保守方向）。见 `MAX_CHANGED_CHAPTER_REVS`。
 */
export type ChangedChapterLog = ReadonlyMap<number /* rev */, readonly number[]>

/** 解析结果。两代格式都在里面，判定侧只认一种语义。 */
export interface ParsedChangedChapters {
  /**
   * 旧格式（裸数组 `[31,33]`）里记着的章号。
   *
   * **非空 ⇒ 无法按 rev 收窄**：旧格式没记「哪一版改的」，只能当作「这些章在
   * 任何一版都可能改过」。判定侧按「覆盖全部章」处理（宁可多判脏，不漏判）。
   */
  legacyChapters: readonly number[]
  /** 新格式：rev → 章号。 */
  byRev: ChangedChapterLog
}

/** `changed_chapters` 保留的 rev 条目上限；超出时把最旧的条目合并成「全部章」。 */
export const MAX_CHANGED_CHAPTER_REVS = 20

function toChapterList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is number => typeof item === 'number' && Number.isSafeInteger(item) && item > 0)
    .sort((left, right) => left - right)
}

/**
 * 解析 `changed_chapters`（两代格式）。
 *
 * - 裸数组（期 1 写入的）⇒ `legacyChapters`；
 * - 对象 `{"2":[31],"3":[33]}` ⇒ `byRev`；
 * - 坏数据 ⇒ 两个都空 ⇒ 判定侧按「覆盖全部章」处理（空集 = 全改，见下）。
 */
export function parseChangedChapters(raw: unknown): ParsedChangedChapters {
  if (typeof raw !== 'string' || !raw.trim()) return { legacyChapters: [], byRev: new Map() }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return { legacyChapters: [], byRev: new Map() } }
  if (Array.isArray(parsed)) return { legacyChapters: toChapterList(parsed), byRev: new Map() }
  if (!parsed || typeof parsed !== 'object') return { legacyChapters: [], byRev: new Map() }
  const byRev = new Map<number, readonly number[]>()
  let legacyChapters: readonly number[] = []
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    // `legacy` 键是「旧格式章集」在新格式里的落点：写入侧换代时不能丢，
    // 丢了就等于把「不知道哪一版改的」冒充成「没改过」。
    if (key === 'legacy') { legacyChapters = toChapterList(value); continue }
    const rev = Number(key)
    if (!Number.isSafeInteger(rev) || rev < 1) continue
    byRev.set(rev, toChapterList(value))
  }
  return { legacyChapters, byRev }
}

/** 把章集写成新格式（`bump` 用）。旧格式章集落到 `legacy` 键上，不丢。 */
export function serializeChangedChapters(parsed: ParsedChangedChapters): string {
  const record: Record<string, number[]> = {}
  if (parsed.legacyChapters.length > 0) {
    record.legacy = [...parsed.legacyChapters].sort((left, right) => left - right)
  }
  for (const [rev, chapters] of [...parsed.byRev.entries()].sort((left, right) => left[0] - right[0])) {
    record[String(rev)] = [...chapters]
  }
  return JSON.stringify(record)
}

/**
 * 写入一条「第 `rev` 版改了这些章」。
 *
 * 超过 `MAX_CHANGED_CHAPTER_REVS` 时把**最旧的两条合并**（并集挂到较新的那条上），
 * 而不是把旧章塞进 `legacy`：后者会让项目在多次手改后永久「全部章都算改过」，
 * 把收窄这件事废掉。合并只让那一条覆盖的 rev 跨度变宽，方向仍是多判脏，且
 * 对「快照晚于被合并那些改动」的行没有影响（它们本来就不该被那些改动判脏）。
 */
export function withChangedChapters(
  parsed: ParsedChangedChapters,
  rev: number,
  chapters: readonly number[],
): ParsedChangedChapters {
  const byRev = new Map(parsed.byRev)
  const normalized = toChapterList(chapters)
  if (normalized.length > 0) {
    const merged = new Set([...(byRev.get(rev) ?? []), ...normalized])
    byRev.set(rev, [...merged].sort((left, right) => left - right))
  } else if (!byRev.has(rev)) {
    byRev.set(rev, [])
  }
  while (byRev.size > MAX_CHANGED_CHAPTER_REVS) {
    const oldest = [...byRev.keys()].sort((left, right) => left - right)[0]
    const next = [...byRev.keys()].sort((left, right) => left - right)[1]
    const merged = new Set([...(byRev.get(next) ?? []), ...(byRev.get(oldest) ?? [])])
    byRev.delete(oldest)
    byRev.set(next, [...merged].sort((left, right) => left - right))
  }
  return { legacyChapters: parsed.legacyChapters, byRev }
}

/**
 * 覆盖 `(have, need]` 这一段实际改到的章。
 *
 * 返回 `null` = **无法收窄**（旧格式、条目已溢出、或该 rev 段没有任何记录），
 * 调用方必须按「覆盖全部章」处理。
 *
 * 方向：坏数据、缺记录、看不懂，一律偏保守（多判脏）。反过来的代价是
 * 「整本重生成后所有派生看似有效」—— 那是本设计里最危险的漏判。
 */
export function changedChaptersBetween(
  parsed: ParsedChangedChapters | null | undefined,
  have: number,
  need: number,
): readonly number[] | null {
  if (!parsed) return null
  // 旧格式没记 rev ⇒ 只能当作全改。
  if (parsed.legacyChapters.length > 0) return null
  const chapters = new Set<number>()
  let sawEntry = false
  for (let rev = have + 1; rev <= need; rev += 1) {
    const entry = parsed.byRev.get(rev)
    if (!entry) continue
    sawEntry = true
    for (const chapter of entry) chapters.add(chapter)
  }
  if (!sawEntry) return null
  return chapters.size === 0 ? null : [...chapters].sort((left, right) => left - right)
}

/** 派生覆盖的章集合。`null` 与 `[]` 都表示「说不清 ⇒ 按全部章」（与 `refCoversChapter` 同向）。 */
function coversEveryChapter(chapters: readonly number[] | null | undefined): boolean {
  return !chapters || chapters.length === 0
}

/**
 * 期 2 的判定入口：在 `derivedStatus` 之上加「按章收窄」。
 *
 * 四条不变量（改之前先读，每条都对应一个会静默出错的形态）：
 *
 * 1. **空章集 = 覆盖全部章。** `refCoversChapter:268` 早就是这个约定。若把空集
 *    当成「什么都没改」，`replace`（整本重生成）之后所有派生都会判 valid ——
 *    全设计最危险的漏判。
 * 2. **`have > need` 一律算脏，不看章集。** 区间 `(have, need]` 在 `have > need`
 *    时为空，不能据空集判有效。备份恢复到更早版本、导入更早的便携包都会出现，
 *    而 `derivedStatus` 早已把「`!==` 而不是 `<`」写死为纪律（`:132-142`）。
 * 3. **缺键 = 覆盖全部章。** `changes` 里没这条记录、或 `current` 里没这个键
 *    （`need = 0`）⇒ 按全改算，与 `derivedStatus` 的 `need = 0 ⇒ stale` 同向。
 * 4. **非 `outline` 域恒覆盖全部章。** 世界观 / 弧光是全书一份，改了就是全改。
 *
 * `chapters`：该派生覆盖的章号。蓝图 = `[N]`；交接单 = 整卷区间；剧情树 = `null`（全书）。
 */
export function derivedStatusForChapters(
  sourceRef: DerivedSourceRef | null | undefined,
  current: UpstreamRevisionSnapshot,
  changes: ReadonlyMap<UpstreamRefKey, ParsedChangedChapters> | null | undefined,
  chapters: readonly number[] | null,
): DerivedValidity {
  if (!sourceRef || typeof sourceRef !== 'object') return { state: 'legacy' }
  const keys = Object.keys(sourceRef)
  if (keys.length === 0) return { state: 'legacy' }
  const behind: DerivedDrift[] = []
  for (const key of keys) {
    const have = sourceRef[key]
    if (!Number.isSafeInteger(have)) continue
    const need = current.get(key) ?? 0
    if (have === need) continue
    // 不变量 2：倒退（备份恢复 / 导入更早的包）不看章集，一律脏。
    if (have > need) { behind.push({ key, have, need }); continue }
    // 不变量 4：非 outline 域恒覆盖全部章。
    const domain = parseUpstreamRefKey(key)?.domain ?? key
    if (domain !== 'outline') { behind.push({ key, have, need }); continue }
    // 不变量 1 / 3：拿不到可收窄的章集 ⇒ 按全改算。
    const changed = changedChaptersBetween(changes?.get(key), have, need)
    if (!changed || coversEveryChapter(chapters)) { behind.push({ key, have, need }); continue }
    const touched = chapters!.some(chapter => changed.includes(chapter))
    if (touched) behind.push({ key, have, need })
  }
  return behind.length === 0 ? { state: 'valid' } : { state: 'stale', behind }
}
