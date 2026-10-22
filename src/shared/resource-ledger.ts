/** W6 资源账本的跨进程契约与纯函数（主进程仓储 / IPC / 渲染层共用）。
 *
 * 上半部分是**形状**（IPC 载荷、仓储出入参）；下半部分是**零 IO 的纯函数**：
 * 余额算术、中断判定、逐章序列，以及「模型输出 → 变动行」的解析（设计稿 §5.3 / §5.2）。
 *
 * 两个半边放在同一个文件是刻意的：文案里只要出现「余额」「中断」「起点」这三个词，
 * 就必须落在同一处，否则 UI、抽取、回填各写一遍，三份算术迟早互相不认识（判据 DI 的同型问题）。
 */

import { parseChineseNumber } from './worldbuilding-numeric-audit'
import type { WritingLanguage } from './writing-language'

/** 一条资源定义（`resources`）。`resource_id` 是稳定键，永不复用。 */
export interface ResourceDefinition {
  resourceId: string
  /** 资源族：同族多品阶共享（如「灵石」）；单例资源为 null。 */
  familyId: string | null
  name: string
  tier: number
  unit: string
  /** 换算锚；null = 不可通兑。**不是 0** —— 0 会被读成「免费兑换」。 */
  anchorValue: number | null
  period: string
  earnNote: string
  costNote: string
  /** W4b 的「设计意图栏」：仅展示、不参与算术（判据 DL）。 */
  scarcityNote: string
  anchorNote: string
  createdAt: string
  updatedAt: string
}

/** 作者登记/修改时的入参；`resourceId` 缺省表示新建。 */
export interface ResourceDefinitionInput {
  resourceId?: string
  familyId?: string | null
  name: string
  tier?: number
  unit: string
  anchorValue?: number | null
  period: string
  earnNote?: string
  costNote?: string
  scarcityNote?: string
  anchorNote?: string
}

export type ResourceMovementSource = 'finalized-extract' | 'author'

/** 一条逐章变动（`resource_movements`）。`chapter_number=0` 专表开篇起点。 */
export interface ResourceMovement {
  id: number
  chapterNumber: number
  resourceId: string
  delta: number
  /** 记账当时的单位快照；与 `resources.unit` 不一致即显式冲突，不静默合并。 */
  unit: string
  evidence: string
  source: ResourceMovementSource
  createdAt: string
}

/** 写入一条变动。`unit` 缺省时取写库当刻的 `resources.unit`（快照语义）。 */
export interface ResourceMovementInput {
  resourceId: string
  delta: number
  unit?: string
  evidence: string
}

export type ResourceWriteResult =
  | { success: true; resourceId: string }
  | { success: false; error: string }

export type ResourceDeleteResult =
  | { success: true }
  /** 已有账本行时拒绝删除，且**不级联**清历史（外键 ON DELETE RESTRICT 的第二道保险）。 */
  | { success: false; error: string; movementCount?: number }

export type ResourceMovementReplaceResult =
  | { success: true; inserted: number }
  | { success: false; error: string }

// ============================================================================
// 纯算术（设计稿 §5.3）—— 零 IO，不读库、不调用模型
// ============================================================================
//
// 三条硬规则逐条落在代码里，缺一条账本就「看起来正常但全错」：
//
// 1. **中断即停**（判据 DJ）：某章没扫过 ⇒ 该章及之后一律 unknown，不跨过累加、不填 0。
// 2. **起点是一条 movement**：`chapter_number=0` 且 `source='author'`；缺它 ⇒ 第 1 章 unknown，
//    **不得假定 0**（假定 0 会让「作者没登记起点」和「开篇确实是 0 枚」变成同一件事）。
// 3. **单位不混算**：`movement.unit !== resources.unit` ⇒ 显式冲突，各自独立成链，
//    不静默合并、不自动换算（否则作者把「枚」改成「块」，历史 delta 会被静默重解释）。

/** 余额算术只需要这五个字段：仓储行 `ResourceMovement` 可直接传进来。 */
export type LedgerMovement = Pick<
  ResourceMovement,
  'chapterNumber' | 'resourceId' | 'delta' | 'unit' | 'source'
>

/** 参与算术的资源侧面：稳定键 + **当前**单位（历史行的单位是快照，可能与它不同）。 */
export interface LedgerResourceRef {
  resourceId: string
  unit: string
}

/**
 * 扫描状态：**已确认扫过的章号**（`post_process_steps.step_key='resource-ledger'` 且 `ok=1`，
 * 且属于该章最新一次跑批）。
 *
 * 用「已扫章号」而不是「未扫章号」：没跑过的步骤在库里根本没有行
 * （`baseline-schema.ts:292` 的 `post_process_steps` 只有 `ok INTEGER`），
 * 所以「不存在」必须等价于「没扫过」，正列表天然满足这个默认值。
 */
export interface ResourceLedgerScanState {
  scannedChapters: readonly number[]
}

/** 已知 / 未知 / 冲突。**未知不等于 0**，冲突也不等于 0。 */
export type LedgerBalance =
  | { kind: 'known'; value: number; throughChapter: number }
  /** `fromChapter` = 从第几章起余额不可知（含该章）。 */
  | { kind: 'unknown'; reason: 'not-scanned' | 'no-origin'; fromChapter: number }
  /** 单位冲突：`units` 至少两个，含资源当前单位。不合并、不换算。 */
  | { kind: 'conflict'; reason: 'unit-mismatch'; units: string[]; fromChapter: number }

/** 起点行的章号。`0` 专表「开篇起点」，且只允许 `source='author'`（§5.1）。 */
export const LEDGER_ORIGIN_CHAPTER = 0

function isOriginMovement(movement: LedgerMovement): boolean {
  return movement.chapterNumber === LEDGER_ORIGIN_CHAPTER && movement.source === 'author'
}

/**
 * 中断起点推导：返回第 1 章起**第一个**没扫过的章号；到 `throughChapter` 为止都扫过则返回 `null`。
 *
 * 注意判定区间是 `1..throughChapter` 的**每一章**，不是「有 movement 的那些章」：
 * 一章没扫、且恰好也没有变动，仍然是中断 —— 这正是判据 DJ 要防的漏一章后全体静默错位。
 */
export function interruptedSince(
  scanState: ResourceLedgerScanState,
  throughChapter: number,
): number | null {
  const scanned = new Set(scanState.scannedChapters)
  const last = Math.max(0, Math.trunc(Number.isFinite(throughChapter) ? throughChapter : 0))
  for (let chapter = 1; chapter <= last; chapter += 1) {
    if (!scanned.has(chapter)) return chapter
  }
  return null
}

/**
 * 第 `chapterNumber` 章的资源余额：`Σ movements(≤ n)`，含开篇起点。
 *
 * 判定顺序是刻意的：
 * 1. **单位冲突**先判 —— 哪怕后面有一章没扫，也不该把一个「枚/块混记」的账本
 *    说成「只是没扫到」，那是两种完全不同的修法；
 * 2. **起点缺失**其次 —— 没有锚点时「扫没扫过」不改变结论，先说更根本的那条；
 * 3. **中断**最后 —— 前两条都成立才轮到「扫过没有」。
 */
export function balanceAt(
  resource: LedgerResourceRef,
  movements: readonly LedgerMovement[],
  chapterNumber: number,
  scanState: ResourceLedgerScanState,
): LedgerBalance {
  const throughChapter = Math.max(0, Math.trunc(Number.isFinite(chapterNumber) ? chapterNumber : 0))
  const own = movements.filter((movement) =>
    movement.resourceId === resource.resourceId
    && movement.chapterNumber >= LEDGER_ORIGIN_CHAPTER
    && movement.chapterNumber <= throughChapter)

  const mismatched = own.filter((movement) => movement.unit !== resource.unit)
  if (mismatched.length > 0) {
    return {
      kind: 'conflict',
      reason: 'unit-mismatch',
      units: [resource.unit, ...new Set(mismatched.map((movement) => movement.unit))].filter(Boolean),
      fromChapter: Math.min(...mismatched.map((movement) => movement.chapterNumber)),
    }
  }

  // 规则 2：起点是「一条 movement」，不是一个字段，也不许假定 0。
  if (!own.some(isOriginMovement)) {
    return { kind: 'unknown', reason: 'no-origin', fromChapter: 1 }
  }

  const interrupted = interruptedSince(scanState, throughChapter)
  if (interrupted !== null) {
    return { kind: 'unknown', reason: 'not-scanned', fromChapter: interrupted }
  }

  return {
    kind: 'known',
    value: own.reduce((sum, movement) => sum + movement.delta, 0),
    throughChapter,
  }
}

/** 逐章余额序列的一个点。`value === null` 表示**未知**（W6c 画小条形时留空，不画成 0）。 */
export interface LedgerSeriesPoint {
  chapterNumber: number
  value: number | null
}

/**
 * 逐章余额序列（第 1 章到第 `toChapter` 章），给 W6c 的余额走势用。
 *
 * 未知章必须是 `null`：填 0 会让「账本中断」在图上画成「余额归零」，
 * 作者看到的是一条断崖，而不是一条断掉的信息。
 */
export function buildLedgerSeries(
  resource: LedgerResourceRef,
  movements: readonly LedgerMovement[],
  scanState: ResourceLedgerScanState,
  toChapter: number,
): LedgerSeriesPoint[] {
  const last = Math.max(0, Math.trunc(Number.isFinite(toChapter) ? toChapter : 0))
  const points: LedgerSeriesPoint[] = []
  for (let chapter = 1; chapter <= last; chapter += 1) {
    const balance = balanceAt(resource, movements, chapter, scanState)
    points.push({ chapterNumber: chapter, value: balance.kind === 'known' ? balance.value : null })
  }
  return points
}

/**
 * 一句人话，供 W6c 的资源卡直接显示。
 *
 * 未知时**只说「第 n 章起账本中断」**，永远不说「0 枚」（判据 DJ / DK）：
 * 「0 枚」是一个可被作者当成事实写进下一章的数，而中断只是一个待补的空白。
 */
export function summarizeLedger(
  resource: LedgerResourceRef,
  movements: readonly LedgerMovement[],
  scanState: ResourceLedgerScanState,
  chapterNumber: number,
  language: WritingLanguage = 'zh-CN',
): string {
  const balance = balanceAt(resource, movements, chapterNumber, scanState)
  const english = language === 'en-US'
  if (balance.kind === 'known') {
    return english
      ? `Chapter ${balance.throughChapter}: ${balance.value} ${resource.unit}`
      : `第 ${balance.throughChapter} 章余额 ${balance.value} ${resource.unit}`
  }
  if (balance.kind === 'conflict') {
    const units = balance.units.join(' / ')
    return english
      ? `Unit conflict (${units}) from chapter ${balance.fromChapter}: not merged and not converted, so the balance is unknown.`
      : `第 ${balance.fromChapter} 章起单位冲突（${units}）：不合并、不换算，余额未知`
  }
  if (balance.reason === 'no-origin') {
    // 这里**不写「中断」**：没有起点是「还没登记」，不是「有一章没扫」。
    // 两者修法完全不同（补一条开篇登记 vs 补扫那一章），而 W7 的注入文本会直接引用这句 ——
    // 说成「中断」会让模型以为中间漏了数据，而不是缺一个开头。
    return english
      ? 'Opening balance is not registered: the chapter-0 author entry is missing, so the balance is unknown — not zero. This is a registration gap, not a scan interruption.'
      : '未登记开篇余额：缺少第 0 章的作者登记行，余额未知——不是 0（这是登记缺口，不是扫描中断）'
  }
  return english
    ? `The ledger is interrupted from chapter ${balance.fromChapter}: the balance is unknown — not zero.`
    : `第 ${balance.fromChapter} 章起账本中断：余额未知——不是 0`
}

// ============================================================================
// 抽取解析（设计稿 §5.2）—— 零 IO，模型输出 → 变动行
// ============================================================================

/** 解析时认得的一条资源：登记表里的名字 + 单位（**不含** `earn_note` / `anchor_value`）。 */
export interface LedgerExtractionResource {
  resourceId: string
  name: string
  unit: string
}

/** 丢弃计数：少了几条要说清为什么，不能静默吞掉（判据 CX）。 */
export interface LedgerExtractionDrops {
  /** 资源名不在登记表里（模型自己造了一种资源）。 */
  unknownResource: number
  /** delta 读不成整数（「一百二」以外的模糊写法、小数、`半`）。 */
  unreadableDelta: number
  /** delta 读成 0：库里不允许 0 行（`delta` 没有默认值，缺失就是没有这条行）。 */
  zeroDelta: number
  /** 引文不在本章正文里逐字命中。 */
  missingQuote: number
  /** 模型给的单位与登记单位不同：**照样保留**，让它变成下游的显式冲突。 */
  unitMismatch: number
}

export interface LedgerExtractionResult {
  movements: ResourceMovementInput[]
  dropped: LedgerExtractionDrops
  /** 整份输出读不出来（坏 JSON / 不是对象 / 没有 movements 数组）。**不是**「本章没有变动」。 */
  unreadable: boolean
}

function readJsonObject(rawText: string): Record<string, unknown> | null {
  const trimmed = rawText.trim()
  if (!trimmed) return null
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(trimmed)
  let candidate = (fenced?.[1] ?? trimmed).trim()
  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) return null
  candidate = candidate.slice(firstBrace, lastBrace + 1)
  try {
    const parsed: unknown = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

/**
 * delta 归一：阿拉伯整数直接用；字符串走既有 `parseChineseNumber`（一百二十 → 120）。
 *
 * 归一失败一律返回 `unreadable`，**不猜**（判据 DK：模型只读数，程序不做模糊推断）。
 * 带 `-` / `−` / `负` 前缀视为支出。
 */
function readDelta(raw: unknown): { delta: number } | { problem: 'unreadable' | 'zero' } {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isSafeInteger(raw)) return { problem: 'unreadable' }
    return raw === 0 ? { problem: 'zero' } : { delta: raw }
  }
  if (typeof raw !== 'string') return { problem: 'unreadable' }
  let text = raw.trim().replace(/\s+/gu, '')
  let sign = 1
  if (/^[-−—负]/u.test(text)) {
    sign = -1
    text = text.slice(1)
  }
  if (!text) return { problem: 'unreadable' }
  const value = parseChineseNumber(text)
  if (value === null || !Number.isSafeInteger(value)) return { problem: 'unreadable' }
  if (value === 0) return { problem: 'zero' }
  return { delta: sign * value }
}

/**
 * 把模型输出解析成变动行。**永不抛错**：坏 JSON 也只返回 `unreadable: true`。
 *
 * 三条丢弃规则（都计入 `dropped`）：
 * - 资源名必须与登记表**逐字**相等（不做模糊匹配：猜错就产出一批假账）；
 * - `quote` 必须在本章正文里逐字命中（判据 DJ 的核对依据，模型编引文就丢）；
 * - `delta` 必须能归一成正负整数，且不能是 0。
 *
 * 单位不同的条目**不丢弃**（只计数）：把它写进去，`balanceAt` 才会把它判成显式冲突；
 * 丢弃等于把「作者改了单位」这件事抹掉，正好是 §5.1 第一条 ★ 要防的静默重解释。
 *
 * 顶层任何 `balance` / `total` / `remaining` 字段一律忽略（判据 DK）。
 */
export function parseResourceMovementExtraction(
  rawText: string,
  chapterText: string,
  resources: readonly LedgerExtractionResource[],
): LedgerExtractionResult {
  const dropped: LedgerExtractionDrops = {
    unknownResource: 0,
    unreadableDelta: 0,
    zeroDelta: 0,
    missingQuote: 0,
    unitMismatch: 0,
  }
  const parsed = readJsonObject(rawText)
  if (!parsed || !Array.isArray(parsed.movements)) {
    return { movements: [], dropped, unreadable: true }
  }

  const movements: ResourceMovementInput[] = []
  for (const entry of parsed.movements as unknown[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      dropped.unknownResource += 1
      continue
    }
    const record = entry as Record<string, unknown>
    const name = typeof record.resource === 'string' ? record.resource.trim() : ''
    const resource = resources.find((item) => item.name === name || item.resourceId === name)
    if (!resource) {
      dropped.unknownResource += 1
      continue
    }

    const delta = readDelta(record.delta)
    if ('problem' in delta) {
      if (delta.problem === 'zero') dropped.zeroDelta += 1
      else dropped.unreadableDelta += 1
      continue
    }

    const quotedUnit = typeof record.unit === 'string' ? record.unit.trim() : ''
    if (quotedUnit && quotedUnit !== resource.unit) dropped.unitMismatch += 1
    const unit = quotedUnit || resource.unit

    const rawQuote = record.quote ?? record.evidence
    const quote = typeof rawQuote === 'string' ? rawQuote.trim() : ''
    if (!quote || !chapterText.includes(quote)) {
      dropped.missingQuote += 1
      continue
    }

    movements.push({ resourceId: resource.resourceId, delta: delta.delta, unit, evidence: quote })
  }

  return { movements, dropped, unreadable: false }
}
