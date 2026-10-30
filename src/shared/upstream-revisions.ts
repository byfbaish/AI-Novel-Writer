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
 * 合并批内改动章集合（`changed_chapters`）。
 *
 * 设计动机见设计稿 §4.1：上游**重新生成**只有批级入口，但**手改**能停在单章
 * （章节卡 `saveChapterBlueprint`、agent 的 `db:blueprint-upsert`）。所以批的
 * rev 仍是身份，章集合是这批的内容描述。
 *
 * **累积而不是覆盖**：同一批连改两次第 31 章和第 33 章，下游第 31 章那条派生
 * 落后于 rev=2，而 `changed_chapters` 若只留 `[33]`，它就会被判 `valid` ——
 * 漏判。所以并集。
 *
 * 上限保护：集合只用于「我这章在不在被改过的范围内」，保留全部章号即可；
 * 单卷最多几百章，JSON 数组不会失控。
 */
export function mergeChangedChapters(
  existing: readonly number[] | null | undefined,
  incoming: readonly number[],
): number[] {
  const merged = new Set<number>()
  for (const value of existing ?? []) {
    if (Number.isSafeInteger(value) && value > 0) merged.add(value)
  }
  for (const value of incoming) {
    if (Number.isSafeInteger(value) && value > 0) merged.add(value)
  }
  return [...merged].sort((left, right) => left - right)
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
