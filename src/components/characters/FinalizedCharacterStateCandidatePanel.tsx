import { useCallback, useEffect, useState } from 'react'
import { ipc } from '../../services/ipc-client'
import type { PendingFinalizedCharacterStateCandidate, PendingFinalizedCharacterStateCandidateSummary, FinalizedCharacterCardDeltaBoard,
  PendingFinalizedCharacterCardDelta } from '../../shared/finalized-continuity'
import type { CharacterStateTextField } from '../../shared/character-roster'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { useCharacterStore } from '../../stores/character-store'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import { Button } from '../ui/Button'

const labels: Record<CharacterStateTextField, [string, string]> = {
  location: ['位置', 'Location'], powerLevel: ['能力等级', 'Power level'], physicalState: ['身体状态', 'Physical state'],
  mentalState: ['心理状态', 'Mental state'], keyItems: ['关键物品', 'Key items'], recentEvents: ['近期事件', 'Recent events'],
}

const EMPTY_BOARD: FinalizedCharacterCardDeltaBoard = { pending: [], hits: [] }

export function FinalizedCharacterStateCandidatePanel() {
  const project = useProjectStore(state => state.currentProject)
  const session = captureProjectSession(project)
  return session ? <SessionPanel key={`${session.projectId}:${session.leaseId}`} session={session} /> : null
}

function SessionPanel({ session }: { session: ProjectSessionContext }) {
  const text = useLocaleStore(state => state.text)
  const characters = useCharacterStore(state => state.characters)
  const [summaries, setSummaries] = useState<PendingFinalizedCharacterStateCandidateSummary[]>([])
  const [candidate, setCandidate] = useState<PendingFinalizedCharacterStateCandidate | null>(null)
  const [board, setBoard] = useState<FinalizedCharacterCardDeltaBoard>(EMPTY_BOARD)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadSummaries = useCallback(async (failure = '') => {
    try {
      const [pending, deltas] = await Promise.all([
        ipc.invokeWithProjectSession(session, 'finalized-character:list-state-candidates'),
        ipc.invokeWithProjectSession(session, 'finalized-character:list-card-deltas'),
      ])
      if (!isProjectSessionCurrent(session)) return
      // 两个 channel 都可能返回 null（旧主进程不认新通道），必须兜住 —— 否则整块面板白屏。
      setSummaries(Array.isArray(pending) ? pending : [])
      setBoard(deltas && Array.isArray(deltas.pending) && Array.isArray(deltas.hits) ? deltas : EMPTY_BOARD)
      setError(failure)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [session])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSummaries() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadSummaries])

  async function read(summary: PendingFinalizedCharacterStateCandidateSummary) {
    setBusy(true); setError(''); setCandidate(null)
    try {
      const next = await ipc.invokeWithProjectSession(session, 'finalized-character:read-state-candidate', {
        draftId: summary.draftId, candidateKey: summary.candidateKey,
      })
      if (isProjectSessionCurrent(session)) setCandidate(next)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  async function decide(decision: 'accept' | 'decline') {
    if (!candidate || busy) return
    setBusy(true); setError('')
    try {
      await ipc.invokeWithProjectSession(session, 'finalized-character:decide-state-candidate', {
        draftId: candidate.source.draftId, candidateKey: candidate.candidateKey, characterId: candidate.characterId,
        field: candidate.field, expectedFieldRevision: candidate.expectedFieldRevision,
        expectedFieldValueHash: candidate.expectedFieldValueHash,
        operationId: `finalized-character-state:${decision}:${candidate.candidateKey}`, decision,
      })
      if (!isProjectSessionCurrent(session)) return
      if (decision === 'accept') await useCharacterStore.getState().load(session.projectPath, session)
      setCandidate(null)
      await loadSummaries()
    } catch (cause) {
      if (!isProjectSessionCurrent(session)) return
      setCandidate(null)
      await loadSummaries(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  /**
   * 确认一条卡片增量。
   *
   * operationId 由 deltaKey 派生：同一条重复点「加入卡」不会写出两份 ——
   * 后端先写卡（`applyCardDelta` 幂等）再标记，replayed 时返回 `idempotent: true`。
   */
  async function decideDelta(item: PendingFinalizedCharacterCardDelta, decision: 'accept' | 'decline') {
    const deltaKey = item.delta.deltaKey
    if (!deltaKey || busy) return
    setBusy(true); setError('')
    try {
      await ipc.invokeWithProjectSession(session, 'finalized-character:decide-card-delta', {
        draftId: item.draftId, deltaKey, decision,
        operationId: `finalized-character-card:${decision}:${deltaKey}`,
      })
      if (!isProjectSessionCurrent(session)) return
      // 接受会改角色卡（软肋 / 筹码），必须重新拉一次角色数据，否则侧栏还是旧卡面。
      if (decision === 'accept') await useCharacterStore.getState().load(session.projectPath, session)
      await loadSummaries()
    } catch (cause) {
      if (!isProjectSessionCurrent(session)) return
      await loadSummaries(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  const nameOf = (characterId: string) => characters.find(character => character.characterId === characterId)?.name ?? characterId
  const kindLabel = (item: PendingFinalizedCharacterCardDelta['delta']) => item.kind === 'soft-spot'
    ? text('软肋', 'Soft spot')
    : item.change === 'lose' ? text('失去筹码', 'Lost chip')
      : item.change === 'replace' ? text('换筹码', 'Replaced chip') : text('新筹码', 'New chip')

  if (!summaries.length && !board.pending.length && !board.hits.length && !error) return null
  const current = candidate && characters.find(character => character.characterId === candidate.characterId)?.currentState?.[candidate.field]
  return <section className="border-b border-[var(--color-border)] p-2 space-y-2"
    aria-label={text('待处理角色状态建议', 'Pending state suggestions')}>
    {summaries.length > 0 && <>
      <div className="text-xs font-medium">{text(`待处理角色状态建议（${summaries.length}）`, `Pending state suggestions (${summaries.length})`)}</div>
      {!candidate && summaries.map(summary => <Button key={summary.candidateKey} variant="outline" size="sm" disabled={busy}
        aria-label={text('检查定稿状态建议', 'Review finalized state suggestion')} onClick={() => void read(summary)}>
        {summary.characterName} · {text(...labels[summary.field])}
      </Button>)}
    </>}
    {error && <p role="alert" className="text-xs text-[var(--color-error)] break-all">{error}</p>}
    {candidate && <>
      <div className="text-xs space-y-1">
        <div className="font-medium">{candidate.characterName} · {text(...labels[candidate.field])}</div>
        <div>{text('当前：', 'Current: ')}{current || text('空', 'Empty')}</div>
        <div>{text('建议：', 'Suggested: ')}{candidate.value}</div>
        {candidate.reason === 'review-conflict' && <>
          <div>{text('审稿读到：', 'Review read: ')}{candidate.reviewObserved || text('（引文不可用）', '(quote unavailable)')}</div>
          {candidate.reviewQuote && <blockquote className="border-l-2 border-[var(--color-warning)] pl-2 text-[var(--color-text-secondary)]">
            {candidate.reviewQuote}
          </blockquote>}
          <p className="text-[var(--color-warning-text)]">
            {text('审稿与定稿后处理读同一段正文得出了不同结果，需要你裁决。',
              'The review and the finalization pass read the same passage differently; your decision is required.')}
          </p>
        </>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void decide('decline')}>
          {text('拒绝状态建议', 'Reject state suggestion')}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void decide('accept')}>
          {text('接受状态建议', 'Accept state suggestion')}
        </Button>
      </div>
    </>}
    {board.pending.length > 0 && <>
      <div className="text-xs font-medium">{text(`待确认的角色卡增量（${board.pending.length}）`, `Pending card changes (${board.pending.length})`)}</div>
      {board.pending.map(item => <div key={item.delta.deltaKey} className="text-xs space-y-1 border-t border-[var(--color-border)] pt-1">
        <div className="font-medium">{nameOf(item.delta.characterId)} · {kindLabel(item.delta)}</div>
        <div>{item.delta.name}{item.delta.text ? ` —— ${item.delta.text}` : ''}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void decideDelta(item, 'decline')}>
            {text('不要', 'Discard')}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void decideDelta(item, 'accept')}>
            {text('加入卡', 'Add to card')}
          </Button>
        </div>
      </div>)}
    </>}
    {/* 顶撞账本只读：它不改卡面，回答的是「这条禁区还硬不硬」。 */}
    {board.hits.length > 0 && <div className="text-xs text-[var(--color-text-secondary)]">
      {text('顶撞账本：', 'Hit ledger: ')}{hitSummary(board.hits, text)}
    </div>}
  </section>
}

/** `X1 被顶 5 次 / 破 1 次` —— 按禁区编号折叠，只报次数。 */
function hitSummary(hits: readonly PendingFinalizedCharacterCardDelta[], text: (zh: string, en: string) => string): string {
  const byForbidden = new Map<string, { total: number; broken: number }>()
  for (const { delta } of hits) {
    const key = delta.forbidden ?? '?'
    const bucket = byForbidden.get(key) ?? { total: 0, broken: 0 }
    bucket.total += 1
    if (delta.broken) bucket.broken += 1
    byForbidden.set(key, bucket)
  }
  return [...byForbidden.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([forbidden, bucket]) => bucket.broken > 0
      ? text(`${forbidden} 被顶 ${bucket.total} 次（破 ${bucket.broken}）`, `${forbidden} pressed ${bucket.total}× (broken ${bucket.broken})`)
      : text(`${forbidden} 被顶 ${bucket.total} 次`, `${forbidden} pressed ${bucket.total}×`))
    .join(text('；', '; '))
}
