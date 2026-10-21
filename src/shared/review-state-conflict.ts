import type { ReviewStateDeltaItem } from './review-generation-report'

/**
 * 审稿差分 × 定稿回写的交叉裁决（W3 第二单元 · 判据 DA）。
 *
 * 为什么需要交叉：审稿和定稿后处理是**两个独立的读者**，读同一段正文。审稿在
 * `stateDelta` 里记下「正文写的是 A」，定稿期又自己读一遍得出「是 B」，然后直接写回
 * `cs_*`。两个读者打架时，静默选一边就是造第二个事实源 —— 而这一边还会带
 * `provenance.kind='derived'`，看起来和别的高置信度派生值毫无区别。
 *
 * **判据 DA：冲突判定必须用 span 重叠，不能字符串比较。**
 * 反例：同一章里「早上带 6 枚」与「傍晚剩 2 枚」是同一字段的两次观测，字符串不等
 * 却是**正确**的时序变化。只比值就会把正常的时间推进判成冲突；只比位置又分不清
 * 「谁读错了」。所以先看两处引文是不是同一段话：
 *
 * - 同一段话（span 重叠）却读出两个值 ⇒ 至少一方读错，**冲突**。
 * - 不同段话：正文更靠后的那次观测代表更新的状态。定稿读的是更后面 ⇒ 定稿赢；
 *   审稿读的是更后面 ⇒ 定稿漏了后文的变化，**冲突**。
 */

export interface StateEvidenceSpan {
  /** JS UTF-16 码元偏移，坐标系与定稿正文一致。 */
  start: number
  end: number
}

export type ReviewStateConflictVerdict =
  /** 两个读者读到同一个值 —— 无论位置如何，都不存在争议。 */
  | 'agree'
  /** 审稿引文在前面，定稿引文在后面：定稿是更新的状态，按定稿写回。 */
  | 'finalization-wins'
  /** 同一段话读出两个值，或正文更靠后处写了另一个值。交给作者裁决。 */
  | 'conflict'

/**
 * 值的归一化：**只抹掉不承载信息的差异，不做同义改写**。
 *
 * 抹掉：全/半角差异（NFKC）、空白（含全角空格）、句读与引号括号。
 * 不抹：汉字数字 vs 阿拉伯数字（`六枚` / `6枚`）、语序、修饰词（`余量：6枚` / `6枚`）。
 *
 * 后者会被判成冲突 —— **这是有意的**。「看起来差不多」正是 AC5 静默失效的来源：
 * 归一化一旦聪明到能猜同义，它就会把「6 枚」和「16 枚」也猜成一样。多问作者一次
 * 的代价，远小于把一个错值当作者审定值写进 `cs_*`。
 */
/** 句读与引号括号：只影响写法，不影响值。用集合而不是字符类，避免 `[` `]` 的转义歧义。 */
const STATE_VALUE_NOISE = new Set('，。、；：！？,.;:!?…"\'“”‘’「」『』（）()[]【】《》')

export function normalizeStateValue(value: string): string {
  return Array.from(value.normalize('NFKC'))
    .filter(char => !/[\s\u3000]/u.test(char) && !STATE_VALUE_NOISE.has(char))
    .join('')
    .toLowerCase()
}

export function judgeReviewStateConflict(
  review: { observed: string; span: StateEvidenceSpan },
  finalized: { value: string; span: StateEvidenceSpan },
): ReviewStateConflictVerdict {
  if (normalizeStateValue(review.observed) === normalizeStateValue(finalized.value)) return 'agree'
  const overlaps = review.span.start < finalized.span.end && finalized.span.start < review.span.end
  if (overlaps) return 'conflict'
  return review.span.start >= finalized.span.end ? 'conflict' : 'finalization-wins'
}

/**
 * 一审稿差分条目 + 它在**定稿正文**里的精确位置。
 *
 * `span` 为 null = 这条 quote 在正文里定位不到或不唯一。调用方**不得**把它当成
 * 「没有观测」：那是一份存在但不可用的证据，按判据 CS 应显式降级为待裁决，
 * 而不是当成「审稿没意见」。
 */
export interface ReviewStateObservation extends ReviewStateDeltaItem {
  span: StateEvidenceSpan | null
}

/**
 * 把 v3 差分条目逐条定位到正文。定位规则与生成侧保持一致（`locateGoalEvidence`
 * 的 requireUnique 口径）：**能定位到两处的引文不是弱证据，是错证据。**
 *
 * 与生成侧不同的是这里**不丢弃** —— 生成侧丢弃是因为报告要落盘成事实记录；
 * 交叉裁决阶段丢弃等于把「审稿提过这个字段、但锚点坏了」静默吃掉，作者永远不会
 * 知道有条观测没被判。所以保留 `span: null`，由调用方降级。
 */
export function locateReviewStateObservations(
  items: readonly ReviewStateDeltaItem[],
  content: string,
): ReviewStateObservation[] {
  return items.map(item => {
    const quote = item.quote.trim()
    const start = quote ? content.indexOf(quote) : -1
    if (!quote || start < 0 || content.indexOf(quote, start + 1) >= 0) return { ...item, span: null }
    // quote 归一成正文的精确切片：报告体里带的可能与正文只差空白，回写/比对要用正文那份。
    return { ...item, quote: content.slice(start, start + quote.length), span: { start, end: start + quote.length } }
  })
}
