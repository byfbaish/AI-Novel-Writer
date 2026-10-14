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
 * 把主进程的错误码翻译成作者能行动的话；未知码原样透出（便于取证）。
 * SOURCE_CHANGED 在证明收窄后只剩一种触发：候选所依据的本章角色名单被动过，
 * 或整次生成使命已被替换——两种情况都只能取消批次重来。
 */
function describeFailure(raw: string, text: (zh: string, en: string) => string): string {
  if (raw.includes('CHARACTER_PROPOSAL_SOURCE_CHANGED')) return text('生成这批候选所依据的来源已被修改（例如对应章节的角色名单变了），候选已过期。请取消这个批次；重新生成后会产出与现状一致的新候选。', 'The source these candidates were derived from has since changed (for example the chapter roster). The batch is stale: cancel it; regenerating produces fresh candidates.')
  if (raw.includes('CHARACTER_ID_REVISION_CONFLICT')) return text('角色名册刚被其他操作更新，请重新打开该批次后再保存。', 'The roster changed in another operation. Reopen this batch and save again.')
  if (raw.includes('CHARACTER_PROPOSAL_SOURCE_MISSING')) return text('这批候选的来源记录已不存在，只能取消这个批次。', 'The source record for this batch no longer exists; the batch can only be cancelled.')
  if (raw.includes('CHARACTER_RELATIONSHIP_PROPOSAL_INVALID')) return text('某条关系提议的两端没有被采用（新建/采用到已有角色），关系无处可写。请把该关系的两端改为新建或采用，或放弃这条关系后再保存。', 'A proposed edge has an endpoint that produces no character. Set both endpoints to create/adopt, or drop that edge, then save.')
  return raw
}

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
      // 取消 = 纯状态翻转、无任何身份效果；若就此消失，作者（常因保存报错而取消）
      // 会永远失去这批候选 —— 把它们留在收件箱里给一个「重新打开」的出路。
      setEntries(history.filter(entry => !FINALIZED_GROUPS.includes(entry.sourceGroup)
        && ['pending-approval', 'cancelled'].includes(entry.status)))
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
      const raw = cause instanceof Error ? cause.message : String(cause)
      await loadEntries(describeFailure(raw, text))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  async function reopen(entry: CharacterProposalHistoryEntry) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await ipc.invokeWithProjectSession(session, 'character-proposal:reopen',
        { proposalBatchId: entry.proposalBatchId, expectedRevision: entry.revision })
      if (!isProjectSessionCurrent(session)) return
      await loadEntries()
    } catch (cause) {
      if (isProjectSessionCurrent(session)) {
        const raw = cause instanceof Error ? cause.message : String(cause)
        setError(describeFailure(raw, text))
      }
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  if (!entries.length && !error) return null
  return <section className="border-b border-[var(--color-border)] p-2 space-y-2" aria-label={text('待处理角色候选', 'Pending character candidates')}>
    {entries.length > 0 && <>
      <div className="text-xs font-medium">{text(`待处理角色候选（${entries.length}）`, `Pending character candidates (${entries.length})`)}</div>
      <p className="text-xs text-[var(--color-text-secondary)]">{text('这些候选还没有结论。可以新建角色、采用到已有角色、登记为功能配角（不建卡），或暂不采用。', 'These candidates have no decision yet. Create a character, adopt into an existing one, register an anchored supporting role without a card, or keep unresolved.')}</p>
      {!batch && entries.map(entry => <div key={entry.proposalBatchId} className="flex items-center gap-2">
        <Button variant={entry.status === 'pending-approval' ? 'outline' : 'ghost'} size="sm" disabled={busy}
          aria-label={text(`检查角色候选：${entry.label}`, `Review character candidates: ${entry.label}`)} onClick={() => void read(entry)}>
          {entry.status === 'cancelled' ? text(`已取消 · ${entry.label}`, `Cancelled · ${entry.label}`) : entry.label}
        </Button>
        {entry.status === 'cancelled' && <Button variant="outline" size="sm" disabled={busy}
          onClick={() => void reopen(entry)}>{text('重新打开', 'Reopen')}</Button>}
      </div>)}
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
