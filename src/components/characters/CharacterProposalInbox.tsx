import { useCallback, useEffect, useState } from 'react'
import { ipc } from '../../services/ipc-client'
import { createCharacterProposalChoices, toApproveCharacterProposalRequest, type CharacterProposalChoices } from '../../services/character-proposal-choices'
import type { CharacterProposalBatch, CharacterProposalHistoryEntry } from '../../shared/character-proposal'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { useCharacterStore } from '../../stores/character-store'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import { Button } from '../ui/Button'
import { CharacterProposalSelectionPanel } from './CharacterProposalSelectionPanel'

/**
 * Batches owned by the finalization/import panel. Listed there, so the inbox must not
 * repeat them — one pending batch gets exactly one entry point.
 */
const FINALIZED_GROUPS: readonly string[] = ['finalized-generation', 'import']

/**
 * 待处理角色候选的常驻入口。
 *
 * 为什么需要它：候选批次是按来源分别落库的（前提+配置 / 章节蓝图 / 创作资料 …），
 * 而确认面板只在"刚生成完"的那条流程里出现。**离开那个面板就等于永别** —— 没有任何
 * 地方会再说"还有 N 个候选没处理"。老陈案正是如此：他在 `pending-approval` 的蓝图
 * 批次里挂着，而 `CharactersView` 里既没有汇总也没有提醒，于是没有任何人知道他还欠一次决定。
 *
 * 这里只做三件事：列出所有仍待处理的批次、打开其中一个、确认或取消。
 * 它不派生任何候选、也不写角色卡 —— 效果仍由主进程在确认时原子落库。
 */
export function CharacterProposalInbox() {
  const project = useProjectStore(state => state.currentProject)
  const session = captureProjectSession(project)
  return session ? <SessionInbox key={`${session.projectId}:${session.leaseId}`} session={session} /> : null
}

function SessionInbox({ session }: { session: ProjectSessionContext }) {
  const text = useLocaleStore(state => state.text)
  const characters = useCharacterStore(state => state.characters)
  const rosterRevision = useCharacterStore(state => state.rosterRevision)
  const [entries, setEntries] = useState<CharacterProposalHistoryEntry[]>([])
  const [batch, setBatch] = useState<CharacterProposalBatch | null>(null)
  const [choices, setChoices] = useState<CharacterProposalChoices | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const identities = characters.flatMap(character => character.characterId
    ? [{ characterId: character.characterId, name: character.name, role: character.role }] : [])

  const loadEntries = useCallback(async (failure = '') => {
    try {
      const history = await ipc.invokeWithProjectSession(session, 'character-proposal:list-history')
      if (!isProjectSessionCurrent(session)) return
      setEntries(history.filter(entry => entry.status === 'pending-approval' && !FINALIZED_GROUPS.includes(entry.sourceGroup)))
      setError(failure)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [session])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEntries() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadEntries, rosterRevision])

  async function read(entry: CharacterProposalHistoryEntry) {
    setBusy(true); setError(''); setBatch(null); setChoices(null)
    try {
      const next = await ipc.invokeWithProjectSession(session, 'character-proposal:read', { proposalBatchId: entry.proposalBatchId })
      if (!isProjectSessionCurrent(session)) return
      setBatch(next); setChoices(createCharacterProposalChoices(next))
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  async function decide(action: 'approve' | 'cancel') {
    if (!batch || !choices || busy) return
    setBusy(true); setError('')
    try {
      if (action === 'approve') await ipc.invokeWithProjectSession(session, 'character-proposal:approve',
        toApproveCharacterProposalRequest(choices, `character-adoption-inbox:${batch.proposalBatchId}`))
      else await ipc.invokeWithProjectSession(session, 'character-proposal:cancel', {
        proposalBatchId: batch.proposalBatchId, expectedRevision: batch.revision,
      })
      if (!isProjectSessionCurrent(session)) return
      if (action === 'approve') await useCharacterStore.getState().load(session.projectPath, session)
      setBatch(null); setChoices(null)
      await loadEntries()
    } catch (cause) {
      if (!isProjectSessionCurrent(session)) return
      setBatch(null); setChoices(null)
      await loadEntries(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  if (!entries.length && !error) return null
  return <section className="border-b border-[var(--color-border)] p-2 space-y-2" aria-label={text('待处理角色候选', 'Pending character candidates')}>
    {entries.length > 0 && <>
      <div className="text-xs font-medium">{text(`待处理角色候选（${entries.length}）`, `Pending character candidates (${entries.length})`)}</div>
      <p className="text-xs text-[var(--color-text-secondary)]">{text('这些候选还没有结论。可以新建角色、采用到已有角色、登记为功能配角（不建卡），或暂不采用。', 'These candidates have no decision yet. Create a character, adopt into an existing one, register an anchored supporting role without a card, or keep unresolved.')}</p>
      {!batch && entries.map(entry => <Button key={entry.proposalBatchId} variant="outline" size="sm" disabled={busy}
        aria-label={text(`检查角色候选：${entry.label}`, `Review character candidates: ${entry.label}`)} onClick={() => void read(entry)}>
        {entry.label}
      </Button>)}
    </>}
    {error && <p role="alert" className="text-xs text-[var(--color-error)] break-all">{error}</p>}
    {batch && choices && <>
      <CharacterProposalSelectionPanel batch={batch} identities={identities} choices={choices} onChange={setChoices} disabled={busy} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void decide('cancel')}>{text('取消这个批次', 'Cancel this batch')}</Button>
        <Button size="sm" disabled={busy} onClick={() => void decide('approve')}>{text('保存这些决定', 'Save these decisions')}</Button>
      </div>
    </>}
  </section>
}
