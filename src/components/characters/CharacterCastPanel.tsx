import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, UserMinus } from 'lucide-react'
import { ipc } from '../../services/ipc-client'
import type { CharacterCastDecisionView } from '../../shared/character-proposal'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { useCharacterStore } from '../../stores/character-store'
import { captureProjectSession, isProjectSessionCurrent } from '../project-session-gate'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * 「锚点人物（不建卡）」管理面（R6 / 段三 T14）。
 *
 * 存在的理由：作者可以把一个候选登记为「有引用键、没有卡槽」的锚点人物（摊主/门卫），
 * 该名字因此退出待建卡候选集。在此之前**没有撤销口** —— 已批准批次不可改写，
 * 于是那个名字永久退出候选清单，删卡也救不回来（设计稿 §9.7 老陈案）。
 *
 * 这里只做四件事：列出当前有效的登记、撤销、改口吻/定位、显示登记来源。
 * 它不派生候选、也不写角色卡 —— 效果全在主进程的 append-only 决定日志里。
 */
export function CharacterCastPanel() {
  const project = useProjectStore(state => state.currentProject)
  const session = captureProjectSession(project)
  return session ? <SessionPanel key={`${session.projectId}:${session.leaseId}`} session={session} /> : null
}

/** 登记来源：operationId 前缀是唯一稳定的来源轴（日志没有别的时间/来源列）。 */
function sourceLabel(operationId: string, text: (zh: string, en: string) => string): string {
  if (operationId.startsWith('cast-backfill:')) return text('历史登记（自动回填）', 'Historical (backfilled)')
  if (operationId.startsWith('cast-approve:')) return text('来自候选确认', 'From candidate confirmation')
  return text('手动登记', 'Registered manually')
}

function SessionPanel({ session }: { session: ProjectSessionContext }) {
  const text = useLocaleStore(state => state.text)
  const rosterRevision = useCharacterStore(state => state.rosterRevision)
  const [decisions, setDecisions] = useState<CharacterCastDecisionView[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** 正在改口吻/定位的那一条（按名字）。 */
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ anchorRole: '', catchphrase: '', relationToProtagonist: '' })

  const load = useCallback(async (failure = '') => {
    try {
      const next = await ipc.invokeWithProjectSession(session, 'character-cast:list')
      if (!isProjectSessionCurrent(session)) return
      setDecisions(next)
      setError(failure)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [session])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load, rosterRevision])

  async function revoke(decision: CharacterCastDecisionView) {
    if (busy) return
    setBusy(true); setError('')
    try {
      // 撤销是**新决定**：主进程追加一条 revoke，该名字随即回到待建卡候选集。
      const next = await ipc.invokeWithProjectSession(session, 'character-cast:revoke', {
        name: decision.name, operationId: `cast-revoke:${decision.decisionId}`,
      })
      if (!isProjectSessionCurrent(session)) return
      setDecisions(next); setEditing(null)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  async function save(decision: CharacterCastDecisionView) {
    if (busy) return
    setBusy(true); setError('')
    try {
      // 改口吻/定位 = 追加一条 register；当前态取最后一条（不重写历史）。
      const next = await ipc.invokeWithProjectSession(session, 'character-cast:register', {
        name: decision.name, anchorRole: draft.anchorRole,
        catchphrase: draft.catchphrase, relationToProtagonist: draft.relationToProtagonist,
        operationId: `cast-edit:${decision.decisionId}:${draft.anchorRole}:${draft.catchphrase}:${draft.relationToProtagonist}`,
      })
      if (!isProjectSessionCurrent(session)) return
      setDecisions(next); setEditing(null)
    } catch (cause) {
      if (isProjectSessionCurrent(session)) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (isProjectSessionCurrent(session)) setBusy(false)
    }
  }

  function startEdit(decision: CharacterCastDecisionView) {
    setEditing(decision.name)
    setDraft({ anchorRole: decision.anchorRole, catchphrase: decision.catchphrase, relationToProtagonist: decision.relationToProtagonist })
  }

  // 没有登记时整块不出现：空面板只是噪声。
  if (!decisions.length && !error) return null
  return <section className="border-b border-[var(--color-border)] p-2 space-y-2"
    aria-label={text('锚点人物（不建卡）', 'Anchored supporting roles (no card)')}>
    <button type="button" className="flex w-full items-center gap-1 text-xs font-medium"
      aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      {text(`锚点人物（不建卡）（${decisions.length}）`, `Anchored supporting roles (no card) (${decisions.length})`)}
    </button>
    {open && <>
      <p className="text-xs text-[var(--color-text-secondary)]">{text('这些名字有引用键、但没有角色卡，因此不算待建卡候选。撤销后名字会回到候选清单（蓝图仍声明他，清单自然带回）。', 'These names have a reference key but no card, so they are not pending candidates. Revoking returns the name to the candidate list (the blueprint still declares it, so it comes back naturally).')}</p>
      {decisions.map(decision => <div key={decision.decisionId} className="rounded-md border border-[var(--color-border)] p-1.5 space-y-1">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{decision.name}</div>
            <div className="truncate text-[0.7rem] text-[var(--color-text-secondary)]">
              {decision.anchorRole || text('未填定位', 'No role yet')}
              {decision.catchphrase ? ` · ${text('口吻：', 'Voice: ')}${decision.catchphrase}` : ''}
            </div>
            {decision.relationToProtagonist && <div className="truncate text-[0.7rem] text-[var(--color-text-secondary)]">
              {text('与主角：', 'To protagonist: ')}{decision.relationToProtagonist}
            </div>}
            <div className="text-[0.65rem] text-[var(--color-text-muted)]">{sourceLabel(decision.operationId, text)}</div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="sm" className="h-6 text-[0.7rem]" disabled={busy}
              aria-label={text(`改口吻定位：${decision.name}`, `Edit voice and role: ${decision.name}`)}
              onClick={() => (editing === decision.name ? setEditing(null) : startEdit(decision))}>
              {text('改口吻/定位', 'Edit voice/role')}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={busy}
              aria-label={text(`撤销登记：${decision.name}`, `Revoke registration: ${decision.name}`)}
              title={text('撤销登记（名字回到待建卡候选）', 'Revoke (the name returns to pending candidates)')}
              onClick={() => void revoke(decision)}>
              <UserMinus size={12} />
            </Button>
          </div>
        </div>
        {editing === decision.name && <div className="space-y-1 pt-1">
          <Input aria-label={text(`定位：${decision.name}`, `Role: ${decision.name}`)} className="h-6 text-xs"
            value={draft.anchorRole} onChange={event => setDraft(value => ({ ...value, anchorRole: event.target.value }))}
            placeholder={text('定位（如：早餐摊摊主）', 'Role (e.g. breakfast-stall owner)')} />
          <Input aria-label={text(`固定口吻：${decision.name}`, `Catchphrase: ${decision.name}`)} className="h-6 text-xs"
            value={draft.catchphrase} onChange={event => setDraft(value => ({ ...value, catchphrase: event.target.value }))}
            placeholder={text('固定口吻（如：来碗豆浆）', 'Catchphrase (e.g. a bowl of soy milk?)')} />
          <Input aria-label={text(`与主角关系：${decision.name}`, `Relation to protagonist: ${decision.name}`)} className="h-6 text-xs"
            value={draft.relationToProtagonist} onChange={event => setDraft(value => ({ ...value, relationToProtagonist: event.target.value }))}
            placeholder={text('与主角关系（如：旧识）', 'Relation to protagonist (e.g. old acquaintance)')} />
          <Button size="sm" className="h-6 text-[0.7rem]" disabled={busy || !draft.anchorRole.trim()}
            onClick={() => void save(decision)}>{text('保存', 'Save')}</Button>
        </div>}
      </div>)}
    </>}
    {error && <p role="alert" className="text-xs text-[var(--color-error)] break-all">{error}</p>}
  </section>
}
