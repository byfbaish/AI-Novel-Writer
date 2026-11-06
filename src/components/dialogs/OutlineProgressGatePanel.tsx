import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'

import type { ProjectSessionContext } from '../../shared/ipc-channels'
import type { OutlineProgressGate } from '../../shared/outline-progress-gate'
import { acknowledgeOutlineProgress } from '../../services/outline-progress-gate'
import { useLocaleStore } from '../../stores/locale-store'
import { Button } from '../ui/Button'

/**
 * 大纲领先正文的闸门面板（P1-2 期 1，2026-10-25；**2026-11-06 扩成二维**，D3）。
 *
 * ## 为什么这里可以「打断」
 *
 * 它在**卷首**出现，一卷一次。它拦的不是错误，而是一个**看不见的事实**：
 * 这一批大纲拿不到「上一卷实际写成了什么样」，只能拿计划。作者常常是有意这么做的
 * （先铺多卷大纲再写正文），所以这里**只能提醒，不能阻断**：一个「我知道，继续」的出口是必须的。
 *
 * ## 三档，说的是「本批实际用了什么材料」而不是「哪个字段没填」
 *
 * | `reason` | 事实 | 该去做什么 |
 * |---|---|---|
 * | `prose-unfinalized` | 上一卷正文还没写完，所以没有交接单 | 去写正文 |
 * | `handoff-missing` | 正文写完了，但你没登记交接单 | 去「卷末交接」页登记 |
 * | `handoff-stale` | 有单，但它是更早写的，上游改过了 ⇒ 不会用它 | 去更新那张单 |
 *
 * 后两档是 2026-11-06 补的：原来只判第一档，于是「已定稿但没登记单」「单过期」两种同样
 * 走计划摘要的降级被判成 `aligned`、界面零提示（详见 `shared/outline-progress-gate.ts` 文件头）。
 *
 * ## 两个出口，没有「静默跳过」
 *
 * - **我知道，仍按计划继续**：写一条带理由的确认（`consistency_exemptions`，可撤销）；
 * - **取消，我先去…**：什么都不写，作者回去处理（下次进同一卷首还会问）。
 *
 * 与开写闸门（`VolumeHandoffGatePanel`）的区别：这里**没有「生成初稿」** ——
 * 缺的是正文或作者的取舍，不是一份能当场生成、作者也认的产物，给个按钮只会制造假的解决感。
 */
export default function OutlineProgressGatePanel({
  gate, projectSession, onProceed, onDismiss,
}: {
  gate: OutlineProgressGate
  projectSession: ProjectSessionContext
  onProceed: () => void
  onDismiss: () => void
}) {
  const locale = useLocaleStore(state => state.locale)
  const text = useLocaleStore(state => state.text)
  const range = gate.range
  const volumeLabel = text(`第${range.volumeIndex}卷`, `Volume ${range.volumeIndex}`)
  const rangeLabel = range.first === null || range.last === null
    ? text('起止未定', 'range unresolved')
    : text(`第${range.first}–${range.last}章`, `chapters ${range.first}–${range.last}`)
  // 三档各自的「事实」与「该去做什么」。`reason` 为空（老调用/理论态）按第一档处理，
  // 不新造第四种说法。
  const gateReason = gate.reason ?? 'prose-unfinalized'
  const isHandoff = gateReason === 'handoff-missing' || gateReason === 'handoff-stale'
  const title = gateReason === 'handoff-missing'
    ? text('上一卷的卷末交接单还没登记', 'The previous volume has no handoff note')
    : gateReason === 'handoff-stale'
      ? text('上一卷的卷末交接单过期了', 'The previous volume\'s handoff note is out of date')
      : text('上一卷正文还没整卷定稿', 'The previous volume\'s prose is not finalized')
  const body = gateReason === 'handoff-missing'
    ? text(
        `${volumeLabel}（${rangeLabel}）正文已经整卷定稿，但没有登记卷末交接单。`
        + `本卷大纲只能基于卷纲计划，不是这一卷实际写完的样子 —— 卷末停在什么事上、哪笔债没结，都进不来。`,
        `${volumeLabel} (${rangeLabel}) prose is finalized, but no handoff note was recorded. `
        + `This volume's outline can only follow the plan, not what actually happened at the end of it.`,
      )
    : gateReason === 'handoff-stale'
      ? text(
          `${volumeLabel}（${rangeLabel}）的卷末交接单是更早写的，之后上游已经改过。`
          + `为了不把旧事实当成当前事实，本次不会使用它 —— 本卷大纲仍只能基于卷纲计划。`,
          `${volumeLabel} (${rangeLabel}) has a handoff note written earlier, and its upstream has changed since. `
          + `It will not be used, so this volume's outline can only follow the plan.`,
        )
      : text(
          `${volumeLabel}（${rangeLabel}）正文只定稿到第${gate.draftLastChapter}章，还差 ${gate.missingChapters} 章。`
          + `继续规划下一卷大纲时，它只能基于计划，不是实际结局 —— 微小的差异会顺着卷快照传导回大纲。`,
          `${volumeLabel} (${rangeLabel}) prose is finalized through chapter ${gate.draftLastChapter} only; `
          + `${gate.missingChapters} chapter(s) remain. The next volume's outline can only follow the plan, not the actual outcome.`,
        )
  const dismissLabel = gateReason === 'handoff-missing'
    ? text('取消，我先去登记交接单', 'Cancel, I will record the handoff note first')
    : gateReason === 'handoff-stale'
      ? text('取消，我先去更新交接单', 'Cancel, I will update the handoff note first')
      : text('取消，我先去补正文', 'Cancel, I will write the prose first')
  const defaultReason = gateReason === 'handoff-missing'
    ? text(
        `作者已知${volumeLabel}（${rangeLabel}）未登记卷末交接单，仍继续规划下一卷大纲`,
        `Author knows ${volumeLabel} (${rangeLabel}) has no handoff note and continues planning the next volume's outline`,
      )
    : gateReason === 'handoff-stale'
      ? text(
          `作者已知${volumeLabel}（${rangeLabel}）的卷末交接单已过期，仍继续规划下一卷大纲`,
          `Author knows ${volumeLabel} (${rangeLabel})'s handoff note is out of date and continues planning the next volume's outline`,
        )
      : text(
          `作者已知${volumeLabel}（${rangeLabel}）正文仅定稿至第${gate.draftLastChapter}章，仍继续规划下一卷大纲`,
          `Author knows ${volumeLabel} (${rangeLabel}) prose is finalized through chapter ${gate.draftLastChapter} only, and continues planning the next volume's outline`,
        )
  const [reason, setReason] = useState(defaultReason)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const trimmed = reason.trim()

  const acknowledge = async () => {
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      const result = await acknowledgeOutlineProgress({
        projectSession,
        volumeId: range.volumeId,
        reason: trimmed.slice(0, 500),
      })
      if (!result.success) {
        setError(text(
          `没能记下这次确认（${result.error ?? '未知原因'}），可以重试`,
          `Could not record the confirmation (${result.error ?? 'unknown'}); please retry`,
        ))
        return
      }
      onProceed()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={text('大纲进度确认', 'Outline progress confirmation')}
      data-testid="outline-progress-gate"
      className="rounded-md border px-3 py-3 space-y-3"
      style={{ borderColor: 'var(--color-warning)' }}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">
            {title}
          </p>
          <p data-testid="outline-progress-gate-reason" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {body}
          </p>
          {!isHandoff && gate.authorityStatus === 'invalid' && (
            <p data-testid="outline-progress-gate-invalid" className="text-xs" style={{ color: 'var(--color-danger)' }}>
              {text(
                '另外：定稿章号账本有断章或重复，已按「未定稿」处理。建议先到定稿列表核对。',
                'Note: the finalized chapter ledger has a gap or duplicates, so this is treated as not finalized. Check the finalization list first.',
              )}
            </p>
          )}
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
          {text('这次确认会记一条可撤销的记录（理由必填）', 'This confirmation records a revocable note (reason required)')}
        </span>
        <textarea
          aria-label={text('确认理由', 'Confirmation reason')}
          className="w-full rounded-md border px-2 py-1 text-xs"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
      </label>

      {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onDismiss} disabled={saving}>
          {dismissLabel}
        </Button>
        <Button variant="ai" onClick={() => void acknowledge()} disabled={saving || !trimmed}>
          {text('我知道，仍按计划继续', 'I know, continue with the plan')}
        </Button>
      </div>

      {/* 把「为什么值得打扰一次」说清楚：一卷一次，且可撤销。 */}
      <p className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
        {locale === 'en-US'
          ? 'This prompt appears once per volume (when its outline starts). Confirming it records a revocable note; delete that note on the volume handoff page to be asked again.'
          : '这条提示一卷只出现一次（开始规划本卷大纲时）。确认会记一条可撤销的记录；在「卷末交接」页删掉它，下次会重新提醒。'}
      </p>
    </section>
  )
}
