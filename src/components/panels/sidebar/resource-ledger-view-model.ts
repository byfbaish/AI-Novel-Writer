/**
 * resource-ledger-view-model — W6c「资源」分区的展示层纯函数。
 *
 * 为什么单独一个文件（而不是并进 world-state-view-model.ts）：
 * - 这里的输入是**账本**（`LedgerBalance` / `LedgerSeriesPoint` / `ResourceDefinition`），
 *   和 W5 的归位表 / 时间线没有任何共用字段；
 * - 三态文案、族分组、异常阈值都必须能单测（判据 DJ 的显示口径就在这里定），
 *   但一个字节的算术都不在这里 —— `balanceAt` 是唯一算术入口，本文件只读它的结果。
 *
 * 只读契约：本文件不访问 IPC、不拼 SQL、不修改入参。
 */
import type {
  LedgerBalance,
  LedgerMovement,
  LedgerSeriesPoint,
  ResourceDefinition,
} from '../../../shared/resource-ledger'

export type ResourceLanguage = 'zh-CN' | 'en-US'

/**
 * 异常（骤增 / 骤降）的保守阈值：**相对上一可算点变化 ≥ 50% 且绝对额 ≥ 10 单位**。
 *
 * 为什么两条都要：
 * - 只看比例：`1 枚 → 2 枚` 也是 +100%，但这是小数目资源的日常波动，天天报警等于没报警；
 * - 只看绝对额：`1000 → 1100` 是 +10%（正常赚了一笔），`10 → 20` 才是真跳变。
 * 50% 对应「翻倍 / 腰斩」，是可被作者一眼判断的量级；10 单位是「一条正经收入」的下限。
 * 阈值只影响标记，不影响余额算术。
 */
export const RESOURCE_JUMP_RATIO = 0.5
export const RESOURCE_JUMP_MIN_ABS = 10

export interface ResourceJump {
  chapterNumber: number
  /** 上一次可算的章号（可能不是相邻章：中间的未知章被跳过，但不会被当成 0）。 */
  previousChapter: number
  delta: number
  /** 相对上一可算点的变化率；上一可算点为 0 时为 null（除零，只按绝对额判）。 */
  ratio: number | null
}

/**
 * 逐章走势上的骤增 / 骤降。
 *
 * 比较的是**相邻两个可算点**：未知章（`value === null`）不参与比较、也不会被当成 0，
 * 所以「第 4 章未扫描、第 5 章恢复」时，第 5 章比的是第 3 章，而不是和 0 比。
 */
export function detectResourceJumps(points: readonly LedgerSeriesPoint[]): ResourceJump[] {
  const jumps: ResourceJump[] = []
  let previous: { chapterNumber: number; value: number } | null = null

  for (const point of points) {
    if (point.value === null) continue
    if (previous) {
      const delta = point.value - previous.value
      const absolute = Math.abs(delta)
      const ratio = previous.value === 0 ? null : absolute / Math.abs(previous.value)
      const overRatio = ratio === null || ratio >= RESOURCE_JUMP_RATIO
      if (absolute >= RESOURCE_JUMP_MIN_ABS && overRatio) {
        jumps.push({
          chapterNumber: point.chapterNumber,
          previousChapter: previous.chapterNumber,
          delta,
          ratio,
        })
      }
    }
    previous = { chapterNumber: point.chapterNumber, value: point.value }
  }

  return jumps
}

export interface ResourceFamilyGroup {
  /** 分组键：有族用 `family:<id>`，单例用 `resource:<id>`（保证互不串组）。 */
  key: string
  familyId: string | null
  /** 组标题：有族显示族名（作者登记的 family_id 文本），单例不显示标题。 */
  title: string | null
  items: ResourceDefinition[]
}

/**
 * 按 `family_id` 分组（设计稿 §3.3）：同族多品阶放一起，**不合计**。
 *
 * 族级余额是派生展示（要按 `anchor_value` 折算，且只有全部品阶都有锚值时才成立），
 * 本波只分组不算总和 —— 一个「灵石 1,200」的合计数在没有锚值时是编出来的。
 * 组内按品阶、再按名字排序；单例资源各自成组，保持读取层顺序的稳定。
 */
export function groupResourcesByFamily(items: readonly ResourceDefinition[]): ResourceFamilyGroup[] {
  const groups = new Map<string, ResourceFamilyGroup>()

  for (const item of items) {
    const familyId = typeof item.familyId === 'string' && item.familyId.trim() ? item.familyId.trim() : null
    const key = familyId ? `family:${familyId}` : `resource:${item.resourceId}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
      continue
    }
    groups.set(key, {
      key,
      familyId,
      title: familyId,
      items: [item],
    })
  }

  for (const group of groups.values()) {
    group.items.sort((left, right) => (left.tier - right.tier) || left.name.localeCompare(right.name, 'zh-CN'))
  }

  return [...groups.values()]
}

export interface ResourceBalanceText {
  /** 卡片上「当前余额」那一行。known = 数值；其余两态是明确的不可知说明，**不是 0**。 */
  primary: string
  /** 第二行：截止章 / 中断起点 / 冲突起始章。 */
  secondary: string
  /** 供 UI 上色；与 `balance.kind` 一一对应。 */
  tone: 'known' | 'unknown' | 'conflict'
}

/**
 * 三态显示文案（判据 DJ / 设计稿 §9.2）。
 *
 * 与共享层 `summarizeLedger` 的差别是**故意**的：`summarizeLedger` 把「缺开篇起点」
 * 也说成「账本中断」，而这里必须区分 —— 起点缺失是**登记问题**（补一条第 0 章登记即可），
 * 中断是**扫描问题**（补扫即可），两种修法完全不同。共享层的算术语义未动，只换显示口径。
 */
export function describeResourceBalance(
  balance: LedgerBalance,
  unit: string,
  language: ResourceLanguage,
): ResourceBalanceText {
  const english = language === 'en-US'

  if (balance.kind === 'known') {
    return {
      primary: `${balance.value} ${unit}`,
      secondary: english
        ? `Through chapter ${balance.throughChapter}`
        : `截至第 ${balance.throughChapter} 章`,
      tone: 'known',
    }
  }

  if (balance.kind === 'conflict') {
    const units = balance.units.join(' / ')
    return {
      primary: english ? `Unit mismatch: ${units}` : `单位不一致：${units}`,
      secondary: english
        ? `Mixed units from chapter ${balance.fromChapter}; not merged, not converted, so no total is shown.`
        : `第 ${balance.fromChapter} 章起混记 ${units}；不合并、不换算，因此这里不显示合计。`,
      tone: 'conflict',
    }
  }

  if (balance.reason === 'no-origin') {
    return {
      primary: english ? 'Unknown (no opening balance registered)' : '未知（未登记开篇余额）',
      secondary: english
        ? 'No chapter-0 opening entry, so the balance is unknown — not zero. This is a registry gap, not an interrupted scan.'
        : '缺少第 0 章的开篇起点，余额不可知——不是 0。这是登记缺口（补一条开篇登记即可），不是扫描中断。',
      tone: 'unknown',
    }
  }

  return {
    primary: english
      ? `Unknown (not scanned from chapter ${balance.fromChapter})`
      : `未知（第 ${balance.fromChapter} 章起未扫描）`,
    secondary: english
      ? `The ledger is interrupted from chapter ${balance.fromChapter}: the balance is unknown — never zero.`
      : `第 ${balance.fromChapter} 章起账本中断：余额不可知——不按 0 计。`,
    tone: 'unknown',
  }
}

/** 变动来源徽标。 */
export const RESOURCE_MOVEMENT_SOURCE_LABELS: Record<LedgerMovement['source'], { zh: string; en: string }> = {
  'finalized-extract': { zh: '定稿抽取', en: 'Finalized extract' },
  author: { zh: '作者登记', en: 'Author entry' },
}

/** `+120` / `-6`（带符号：变动列表里没有符号就分不清收支）。 */
export function formatMovementDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta}`
}

/** 变化率文案；上一可算点为 0 时只能说「从 0 起」。 */
export function describeJump(jump: ResourceJump, language: ResourceLanguage): string {
  const direction = jump.delta > 0
    ? (language === 'en-US' ? 'Jump up' : '骤增')
    : (language === 'en-US' ? 'Jump down' : '骤降')
  const amount = formatMovementDelta(jump.delta)
  if (jump.ratio === null) {
    return language === 'en-US'
      ? `${direction} at chapter ${jump.chapterNumber}: ${amount} (from zero)`
      : `${direction} 第 ${jump.chapterNumber} 章 ${amount}（从 0 起）`
  }
  const percent = Math.round(jump.ratio * 100)
  return language === 'en-US'
    ? `${direction} at chapter ${jump.chapterNumber}: ${amount} (${percent}% vs chapter ${jump.previousChapter})`
    : `${direction} 第 ${jump.chapterNumber} 章 ${amount}（较第 ${jump.previousChapter} 章 ${percent}%）`
}
