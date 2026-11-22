import { useLocaleStore } from '../../stores/locale-store'
import type { Locale } from '../../i18n/types'
import { sourceConflictBatchLayer, sourceConflictCopy, type SourceConflictStatus } from '../../shared/source-conflict-copy'

/**
 * D4：来源冲突的两层并列文案（纯展示）。
 *
 * 同一份 `sourceStatus='conflict'` 驱动产物层，批次层另由真实批状态驱动，两层各有前置条件：
 * - 产物层（随 conflict 出现）：这一稿不能保存，仍可复制；
 * - 批次层（**只在批次确实已停止时出现**）：本批已停止、后续单元不再执行、需重新发起。
 *
 * `batchStopped` 必须来自真实批状态（`evaluateBatchRecoveryGate(...).terminated`，即 root run
 * 终态 ∈ failed/cancelled/aborted），**不许**用 `sourceStatus === 'conflict'` 顶替：
 * 只坏了一稿就把「整批已停」报出去，是这一层要修的误报。反过来，批次真的停了也要说得出来，
 * 所以批次层不依赖 `sourceStatus`——只有批次层可读时，本组件仍渲染。
 * `batchChapterNumber` 是 `gate.wayOut.chapterNumber`，用来说清停在哪、从哪章重开。
 *
 * 无交互、不参与生成判定；`data-conflict-layer` 便于组件单测分别断言两层。
 */
export default function SourceConflictNotice({ sourceStatus, batchStopped = false, batchChapterNumber = null, locale }: {
  sourceStatus: SourceConflictStatus
  /** 真实批状态：只有批次确实已停止才为 true。单稿冲突、批次未停时为 false（默认）。 */
  batchStopped?: boolean
  /** `gate.wayOut.chapterNumber`：这一批停在哪一章；取不到传 null，不编造章号。 */
  batchChapterNumber?: number | null
  locale?: Locale
}) {
  const storeLocale = useLocaleStore(s => s.locale)
  // 显式 locale（组件单测 / 需要锁死语种时）优先；浏览器常规渲染走 store 订阅。
  const uiLocale = locale ?? storeLocale
  const copy = sourceConflictCopy(uiLocale, sourceStatus)
  if (!copy && !batchStopped) return null
  return (
    <div role="status" className="space-y-1">
      {copy && <p data-conflict-layer="output">{copy.output}</p>}
      {batchStopped && <p data-conflict-layer="batch">{sourceConflictBatchLayer(uiLocale, batchChapterNumber)}</p>}
    </div>
  )
}
