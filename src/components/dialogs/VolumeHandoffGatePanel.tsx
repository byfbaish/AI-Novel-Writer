import { useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'

import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { VOLUME_HANDOFF_MAX_CHARS, type VolumeHandoffInput } from '../../shared/volume-handoff'
import type { VolumeHandoffGate } from '../../shared/volume-handoff-gate'
import type { WritingLanguage } from '../../shared/writing-language'
import { ipc } from '../../services/ipc-client'
import { acknowledgeVolumeHandoff } from '../../services/volume-handoff-gate'
import { describeVolumeHandoffFailure, generateVolumeHandoff } from '../../services/volume-handoff-generation'
import { useLocaleStore } from '../../stores/locale-store'
import { Button } from '../ui/Button'

/**
 * 开写闸门（P1-2 期 2b）：进入新一卷第一章时，要求确认上一卷的跨卷记忆。
 *
 * ## 为什么这里可以「打断」
 *
 * 一卷二十章以上，这道提示一卷只出现一次。它换来的是一整卷的跨卷一致性 ——
 * 交接单缺失时，模型只能靠大纲写第 2 卷，那正是评审列为硬伤的失真形态。
 *
 * ## 三个出口，没有「静默跳过」
 *
 * - **生成初稿**：直接跑一次共享生成函数（与定稿链、面板同一个），生成完把摘要摆出来；
 * - **已人工复查，继续**：记一条确认（`consistency_exemptions`，带理由、可撤销）；
 * - **取消**：什么都不写，作者回去处理（下次进来还会问）。
 *
 * 生成完不让作者直接写：初稿没人看过，所以先展示「正文 N 字 / 要点来自几章」，
 * 由他点「就用这份，继续写」才算确认。
 */
export default function VolumeHandoffGatePanel({
  gate, projectSession, writingLanguage, onProceed, onDismiss,
}: {
  gate: VolumeHandoffGate
  projectSession: ProjectSessionContext
  writingLanguage: WritingLanguage
  onProceed: () => void
  onDismiss: () => void
}) {
  const locale = useLocaleStore(state => state.locale)
  const text = useLocaleStore(state => state.text)
  const [phase, setPhase] = useState<'gate' | 'generating' | 'generated'>('gate')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const range = gate.range
  const volumeLabel = text(`第${range.volumeIndex}卷`, `Volume ${range.volumeIndex}`)
  const rangeLabel = range.first === null || range.last === null
    ? text('起止未定', 'range unresolved')
    : text(`第${range.first}–${range.last}章`, `chapters ${range.first}–${range.last}`)

  const fail = (message: string) => {
    setError(message)
    setPhase('gate')
  }

  const generate = async () => {
    if (range.first === null || range.last === null) {
      fail(text('本卷起止未定，无法生成（先到「卷末交接」页重建卷结构）',
        'This volume has no chapter range yet; rebuild the structure on the handoff page first'))
      return
    }
    setPhase('generating')
    setError('')
    try {
      const projections = await ipc.invokeWithProjectSession(
        projectSession,
        'db:continuity-list-before',
        range.last + 1,
        projectSession.projectPath,
      )
      const notes = (projections ?? [])
        .filter(entry => entry.chapterNumber >= range.first! && entry.chapterNumber <= range.last!)
        .map(entry => ({ chapterNumber: entry.chapterNumber, chapterTitle: entry.chapterTitle, notes: entry.chapterNotes }))
        .filter(entry => entry.notes.trim().length > 0)
      const result = await generateVolumeHandoff({
        volumeIndex: range.volumeIndex,
        volumeName: range.name,
        firstChapter: range.first,
        lastChapter: range.last,
        notes,
        writingLanguage,
        projectSession,
      })
      if (!result.ok) { fail(describeVolumeHandoffFailure(result.reason, text)); return }
      const input: VolumeHandoffInput = {
        ...(gate.handoff ? { handoffId: gate.handoff.handoffId } : {}),
        volumeId: range.volumeId,
        ...result.draft,
        source: 'generated',
      }
      const saved = await ipc.invokeWithProjectSession(
        projectSession, 'db:volume-handoffs-upsert', input, projectSession.projectPath)
      if (!saved.success) { fail(saved.error ?? text('写入卷末交接单失败', 'Failed to write the handoff')); return }
      setSummary(text(
        `已生成初稿：正文 ${result.report.bodyChars}/${VOLUME_HANDOFF_MAX_CHARS} 字；要点来自 ${result.coverage.usedChapters.length} 章。`,
        `Draft generated: body ${result.report.bodyChars}/${VOLUME_HANDOFF_MAX_CHARS} chars; notes from ${result.coverage.usedChapters.length} chapter(s).`,
      ))
      setPhase('generated')
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const acknowledge = async (reason: string) => {
    const result = await acknowledgeVolumeHandoff({
      projectSession,
      volumeId: range.volumeId,
      reason,
    })
    if (!result.success) {
      fail(text(`没能记下这次确认（${result.error ?? '未知原因'}），可以重试`,
        `Could not record the confirmation (${result.error ?? 'unknown'}); please retry`))
      return
    }
    onProceed()
  }

  return (
    <section
      aria-label={text('卷末交接确认', 'Volume handoff confirmation')}
      data-testid="volume-handoff-gate"
      className="rounded-md border px-3 py-3 space-y-3"
      style={{ borderColor: 'var(--color-warning)' }}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">
            {text('上一卷的跨卷记忆还没确认', 'The previous volume\'s handoff has not been confirmed')}
          </p>
          <p data-testid="volume-handoff-gate-reason" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {gate.state === 'missing'
              ? text(
                `${volumeLabel}（${rangeLabel}）还没有卷末交接单。这一卷的正文已经退出上下文，缺了它，下一卷只能靠大纲接着写。`,
                `${volumeLabel} (${rangeLabel}) has no volume handoff. Its prose is already out of context; without a handoff the next volume can only follow the outline.`,
              )
              : text(
                `${volumeLabel}（${rangeLabel}）只有一份模型初稿，还没经你确认。请先看一眼再开写。`,
                `${volumeLabel} (${rangeLabel}) only has a model draft that you have not reviewed yet. Look at it before writing.`,
              )}
          </p>
        </div>
      </div>

      {phase === 'generated' && (
        <p data-testid="volume-handoff-gate-summary" className="text-xs">{summary}</p>
      )}
      {error && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      {phase === 'gate' && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onDismiss}>
            {text('取消，我先去处理', 'Cancel, I will handle it')}
          </Button>
          <Button
            variant="outline"
            onClick={() => void acknowledge(text(
              `作者确认已人工复查${volumeLabel}的跨卷衔接（${rangeLabel}）并继续写作`,
              `Author confirmed reviewing the handoff of ${volumeLabel} (${rangeLabel}) and continued writing`,
            ))}
          >
            {text('已人工复查，继续', 'Reviewed, continue')}
          </Button>
          <Button variant="ai" onClick={() => void generate()}>
            {text('生成初稿给我看', 'Generate a draft')}
          </Button>
        </div>
      )}

      {phase === 'generating' && (
        <div className="flex items-center justify-end gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Loader2 size={13} className="animate-spin" />
          {text('正在生成卷末交接初稿…', 'Generating the handoff draft…')}
        </div>
      )}

      {phase === 'generated' && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onDismiss}>
            {text('先去改一改', 'Let me edit it first')}
          </Button>
          <Button
            variant="ai"
            onClick={() => void acknowledge(text(
              `作者确认采用本次生成的${volumeLabel}卷末交接初稿（${rangeLabel}）并继续写作`,
              `Author accepted the generated handoff draft of ${volumeLabel} (${rangeLabel}) and continued writing`,
            ))}
          >
            {text('就用这份，继续写', 'Use this draft and continue')}
          </Button>
        </div>
      )}

      {/* 为什么这道闸值得打断一次：把频次说清楚，作者才愿意配合。 */}
      <p className="text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
        {locale === 'en-US'
          ? 'This prompt appears once per volume (when its first chapter starts). Confirming it records a revocable note; delete that note on the handoff page to be asked again.'
          : '这条提示一卷只出现一次（进入本卷第一章时）。确认会记一条可撤销的记录；在「卷末交接」页删掉它，下次会重新提醒。'}
      </p>
    </section>
  )
}
