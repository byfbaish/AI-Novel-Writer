import { useLocaleStore } from '../../stores/locale-store'
import type { Locale } from '../../i18n/types'
import { sourceConflictCopy, type SourceConflictStatus } from '../../shared/source-conflict-copy'

/**
 * D4：来源冲突的两层并列文案（纯展示）。
 *
 * 由同一份 `sourceStatus='conflict'` 同时渲染产物层与批次层两条 `<p>`：
 * - 产物层：这一稿不能保存，仍可复制；
 * - 批次层：后续单元不再执行，需重新发起。
 *
 * 无交互、不参与生成判定；`data-conflict-layer` 便于组件单测分别断言两层。
 */
export default function SourceConflictNotice({ sourceStatus, locale }: { sourceStatus: SourceConflictStatus; locale?: Locale }) {
  const storeLocale = useLocaleStore(s => s.locale)
  // 显式 locale（组件单测 / 需要锁死语种时）优先；浏览器常规渲染走 store 订阅。
  const copy = sourceConflictCopy(locale ?? storeLocale, sourceStatus)
  if (!copy) return null
  return (
    <div role="status" className="space-y-1">
      <p data-conflict-layer="output">{copy.output}</p>
      <p data-conflict-layer="batch">{copy.batch}</p>
    </div>
  )
}
