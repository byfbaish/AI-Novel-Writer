import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'

import {
  KNOWLEDGE_EVIDENCE_MAX,
  KNOWLEDGE_TEXT_MAX,
  knowledgeFactKey,
  type KnowledgeFactCandidate,
  type KnowledgeRefState,
  type KnowledgeStateDefinition,
  type KnowledgeStateInput,
} from '../../shared/knowledge-state'
import type { CharacterData } from '../../../electron/repositories/character-repository'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P1-1 知情登记面板（作者侧唯一写入口）。
 *
 * 这一格回答的是「这个角色在这一章知道哪件事」，所以一行必须由三个东西组成：
 * **谁 + 哪条事实 + 从哪一章起知道**。三样缺一样都不是一条知情关系。
 *
 * ## 事实只能「引用」，不能新写
 *
 * 事实来自**已定稿且当前投影有效**的连续性索引（`db:knowledge-fact-candidates`），面板只
 * 允许从中选；也允许手填「章号 + 逐字引文」，但那同样走 `knowledgeFactKey` —— 与库里
 * 那条事实算出同一个 key 才算指对。**面板不存任何陈述**：一旦允许作者另写一份说法，
 * 同一件事就有两种措辞，封闭默认立刻失效。
 *
 * ## 角色必须有 characterId
 *
 * 人粒度是 `character_id`。旧数据里可能还有只有名字、没有 id 的角色 —— 这些**不出现**在
 * 选择器里，面板写明原因（而不是拿名字当 id 兜底：同名不同人会把两条登记并成一条）。
 *
 * ## 失效三态只展示，不自动修
 *
 * `stale` / `unverifiable` 的行标红并给「重选事实」入口。面板不会自动改键、不会自动删行 ——
 * 那等于替作者认定「新的就是旧的那条」。
 *
 * ## 保存前不落库
 *
 * 编辑全在本地草稿行里，点「保存」才逐行提交；**同角色同事实重复则整批不提交**
 * （本地先算 key 比对，不等数据库报 UNIQUE）。
 */
type LocaleText = (zh: string, en: string) => string

interface DraftRow {
  key: string
  knowledgeId?: string
  characterId: string
  /** 当前选中的候选 key（`pick` 模式）；手动填写时为空。 */
  pickedFactKey: string
  mode: 'pick' | 'manual'
  factChapter: string
  factEvidence: string
  learnedChapter: string
  /** 这条知情关系本身的出处（可空、不进提示词）。 */
  evidence: string
  refState?: KnowledgeRefState
  removing: boolean
  confirmingRemove: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    characterId: '',
    pickedFactKey: '',
    // 新行默认展开手填：候选列表可能为空（没定稿 / 投影失效），那时也必须能登记。
    // 一旦从候选里选了一条，就切到 `pick`（引文与章号由候选给出，不再手改）。
    mode: 'manual',
    factChapter: '',
    factEvidence: '',
    learnedChapter: '',
    evidence: '',
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

function rowFromDefinition(entry: KnowledgeStateDefinition): DraftRow {
  return {
    key: entry.knowledgeId,
    knowledgeId: entry.knowledgeId,
    characterId: entry.characterId,
    // 已登记的行按「手填」打开：它引用的那条事实可能已不在候选里（stale），
    // 强行按候选模式打开会让选择器显示成空白，作者会以为登记丢了。
    pickedFactKey: '',
    mode: 'manual',
    factChapter: String(entry.factChapter),
    factEvidence: entry.factEvidence,
    learnedChapter: String(entry.learnedChapter),
    evidence: entry.evidence,
    refState: entry.refState,
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

const POSITIVE = /^[1-9]\d*$/u

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'KNOWLEDGE_DUPLICATED': return text('这个角色对这条事实已经登记过了', 'This character already has that fact registered')
    case 'KNOWLEDGE_SCHEMA_MISSING': return text('这个项目的数据库还没有知情表，无法保存', 'This project database has no knowledge table yet')
    case 'KNOWLEDGE_NOT_FOUND': return text('这条登记已经不在了，刷新列表即可', 'That entry is gone; reload the list')
    case 'KNOWLEDGE_CHARACTER_NOT_FOUND': return text('这个角色已经不在角色表里了，请重新选角色', 'That character is no longer in the roster; pick another')
    case 'PROJECT_NOT_OPEN': return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('KNOWLEDGE_INVALID:')) {
        return text(`有一个字段不合法（${error.slice('KNOWLEDGE_INVALID:'.length)}），没有保存`, 'A field is invalid, nothing was saved')
      }
      return text(`保存失败（${error ?? '未知原因'}）`, `Save failed (${error ?? 'unknown'})`)
  }
}

function refStateLabel(state: KnowledgeRefState, text: LocaleText): string {
  switch (state) {
    case 'valid': return text('引用有效', 'reference valid')
    case 'stale': return text('引用失效：该章已无此事实，请重选', 'stale: the fact is gone from that chapter; pick again')
    case 'unverifiable': return text('无法核对：该章定稿投影读不到，请稍后重试或重选', 'unverifiable: that chapter\u2019s finalized index is unreadable')
  }
}

export function KnowledgeRegistryPanel({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [characters, setCharacters] = useState<CharacterData[]>([])
  const [candidates, setCandidates] = useState<KnowledgeFactCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setRows([])
      setCharacters([])
      setCandidates([])
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    const [listed, roster, facts] = await Promise.all([
      ipc.invokeWithProjectSession(projectSession, 'db:knowledge-list', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:character-get-all', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:knowledge-fact-candidates', projectSession.projectPath),
    ])
    if (!isProjectSessionCurrent(projectSession)) return
    setLoading(false)
    setCharacters(Array.isArray(roster) ? roster : [])
    // 候选读不到只影响「选事实」，手动填写照常可用 —— 不因此挡住整页。
    setCandidates(facts?.success ? facts.candidates ?? [] : [])
    if (!listed.success) { setLoadError(writeErrorLabel(listed.error, text)); return }
    setLoadError('')
    setRows((listed.entries ?? []).map(rowFromDefinition))
  }, [projectKey, text])

  useEffect(() => {
    // 挂载即读；不轮询 —— 本页只服务作者手工登记。
    queueMicrotask(() => void load())
  }, [load])

  /** 有 character_id 的角色才可选：人粒度是 id，名字不唯一。 */
  const selectableCharacters = useMemo(
    () => characters.filter(character => Boolean(character.characterId)),
    [characters],
  )
  const withoutIdCount = characters.length - selectableCharacters.length

  const applyField = (key: string, field: keyof DraftRow, value: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, [field]: value, error: '' } : row)))
  }

  /** 选中候选 ⇒ 同时写入章号与引文（两者就是这条事实的全部引用信息）。 */
  const pickFact = (key: string, factKey: string) => {
    setStatus('')
    setRows(previous => previous.map(row => {
      if (row.key !== key) return row
      if (factKey === '') return { ...row, pickedFactKey: '', mode: 'manual', error: '' }
      const candidate = candidates.find(item => item.factKey === factKey)
      if (!candidate) return { ...row, pickedFactKey: factKey, error: '' }
      return {
        ...row,
        pickedFactKey: factKey,
        mode: 'pick',
        factChapter: String(candidate.chapterNumber),
        factEvidence: candidate.factEvidence,
        error: '',
      }
    }))
  }

  /** 失效行「重选事实」：回到候选模式，但不清角色与得知章。 */
  const repick = (key: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key
      ? { ...row, mode: 'pick', pickedFactKey: '', factChapter: '', factEvidence: '', refState: undefined, error: '' }
      : row)))
  }

  const addRow = () => { setRows(previous => [...previous, emptyRow()]); setStatus('') }

  const removeRow = (key: string) => {
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.knowledgeId) return previous.filter(row => row.key !== key)
      return previous.map(row => (row.key === key ? { ...row, confirmingRemove: true, error: '' } : row))
    })
  }

  const undoRemove = (key: string) => {
    setRows(previous => previous.map(row => (
      row.key === key ? { ...row, removing: false, confirmingRemove: false, error: '' } : row)))
  }

  const confirmRemove = (key: string) => {
    setRows(previous => previous.map(row => (
      row.key === key ? { ...row, removing: true, confirmingRemove: false, error: '' } : row)))
  }

  /**
   * 本地校验（异步：重复判定要算引用键）。
   *
   * 「同角色同事实重复」在这里就拦下 —— 不等数据库报 UNIQUE，否则提交到一半才发现，
   * 前面几行已经落库了（违背「整批不提交」）。
   */
  const validateRows = async (current: readonly DraftRow[]): Promise<Map<string, string>> => {
    const problems = new Map<string, string>()
    const seen = new Map<string, string>()
    for (const row of current) {
      if (row.removing) continue
      if (!row.characterId.trim()) {
        problems.set(row.key, text('请先选角色', 'Pick a character'))
        continue
      }
      if (!POSITIVE.test(row.factChapter.trim())) {
        problems.set(row.key, text('事实所在章只能填正整数', 'Fact chapter must be a positive integer'))
        continue
      }
      if (!POSITIVE.test(row.learnedChapter.trim())) {
        problems.set(row.key, text('得知章只能填正整数', 'Learned chapter must be a positive integer'))
        continue
      }
      if (Number(row.learnedChapter) < Number(row.factChapter)) {
        problems.set(row.key, text('得知章不能早于事实所在章', 'Learned chapter cannot precede the fact chapter'))
        continue
      }
      const evidence = row.factEvidence.trim()
      if (!evidence) {
        problems.set(row.key, text('请从候选里选一条事实，或手填逐字引文', 'Pick a fact or paste a verbatim quote'))
        continue
      }
      if (evidence.length > KNOWLEDGE_EVIDENCE_MAX) {
        problems.set(row.key, text('引文过长：请只摘这句话，不要贴整段', 'Quote too long: excerpt the sentence, not the paragraph'))
        continue
      }
      if (row.evidence.trim().length > KNOWLEDGE_TEXT_MAX) {
        problems.set(row.key, text('出处说明过长', 'Evidence note too long'))
        continue
      }
      const factKey = await knowledgeFactKey(Number(row.factChapter), evidence)
      const identity = `${row.characterId}\u0000${factKey}`
      if (seen.has(identity)) {
        problems.set(row.key, text('同一角色对同一条事实重复登记了', 'This character has that fact twice'))
        continue
      }
      seen.set(identity, row.key)
    }
    return problems
  }

  const save = async () => {
    // 连点由 ref 挡：state 的 busy 在这一帧还是旧值。
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    const current = rows
    const problems = await validateRows(current)
    if (problems.size > 0) {
      // 校验不通过就整批不提交：一行重名不该让别的行偷偷落库。
      setRows(previous => previous.map(row => problems.has(row.key) ? { ...row, error: problems.get(row.key) ?? '' } : row))
      setStatus(text(`有 ${problems.size} 行还需要修改，本次没有提交`, `${problems.size} row(s) need fixing; nothing was saved`))
      return
    }
    busyRef.current = true
    setBusy(true)
    let saved = 0
    let removed = 0
    const kept: DraftRow[] = []
    for (const row of current) {
      if (row.removing) {
        const result = await ipc.invokeWithProjectSession(projectSession, 'db:knowledge-delete', row.knowledgeId!, projectSession.projectPath)
        if (result.success) { removed += 1; continue }
        kept.push({ ...row, removing: false, error: writeErrorLabel(result.error, text) })
        continue
      }
      const input: KnowledgeStateInput = {
        ...(row.knowledgeId ? { knowledgeId: row.knowledgeId } : {}),
        characterId: row.characterId,
        factChapter: Number(row.factChapter.trim()),
        factEvidence: row.factEvidence.trim(),
        learnedChapter: Number(row.learnedChapter.trim()),
        evidence: row.evidence.trim(),
      }
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:knowledge-upsert', input, projectSession.projectPath)
      if (!result.success) { kept.push({ ...row, error: writeErrorLabel(result.error, text) }); continue }
      // 用后端回的 id 改写本地行：不重载，作者的光标不会跳。
      saved += 1
      kept.push({ ...row, key: result.knowledgeId ?? row.key, knowledgeId: result.knowledgeId ?? row.knowledgeId, error: '' })
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    // 保存后重读：`refState` 只在主进程算，本地算不出来，所以必须回读一次（不重载整页）。
    setRows(kept)
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已保存 ${saved} 条知情`, `${saved} knowledge state(s) saved`))
    if (removed > 0) parts.push(text(`已删除 ${removed} 条`, `${removed} removed`))
    if (kept.some(row => row.error)) parts.push(text('有行保存失败，看每行下方提示', 'some rows failed; see the row messages'))
    setStatus(parts.join('；') || text('没有需要保存的改动', 'Nothing to save'))
    if (saved > 0) void load()
  }

  return (
    <div className="space-y-3" data-testid="knowledge-registry-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={addRow} disabled={busy}>
          <Plus size={13} />{text('新增一条', 'Add entry')}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy || loading}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {text('保存', 'Save')}
        </Button>
        {status && <span role="status" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>

      {loadError && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{loadError}</p>}

      {withoutIdCount > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }} data-testid="knowledge-legacy-characters">
          <AlertTriangle size={12} className="inline" />{' '}
          {text(
            `有 ${withoutIdCount} 个角色没有角色 id（旧版数据），不会出现在下面的选择器里 —— 知情必须绑定到具体角色，不能用名字代替。`,
            `${withoutIdCount} character(s) have no character id (legacy data) and are not selectable \u2014 knowledge must bind to a character, not a name.`,
          )}
        </p>
      )}

      {loading
        ? <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text('读取中…', 'Loading…')}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left align-bottom font-normal" style={{ color: 'var(--color-text-muted)', width: '9rem' }}>
                    {text('角色', 'Character')} *
                  </th>
                  <th className="px-1 py-1 text-left align-bottom font-normal" style={{ color: 'var(--color-text-muted)', width: '16rem' }}>
                    {text('事实（来自定稿）', 'Fact (from finalized prose)')} *
                    <span className="block text-[10px] leading-tight opacity-70">
                      {text('从候选里选，或手填章号 + 逐字引文', 'Pick a candidate, or type chapter + verbatim quote')}
                    </span>
                  </th>
                  <th className="px-1 py-1 text-left align-bottom font-normal" style={{ color: 'var(--color-text-muted)', width: '5rem' }}>
                    {text('自第几章得知', 'Learned in')} *
                  </th>
                  <th className="px-1 py-1 text-left align-bottom font-normal" style={{ color: 'var(--color-text-muted)', width: '10rem' }}>
                    {text('出处', 'Evidence')}
                    <span className="block text-[10px] leading-tight opacity-70">
                      {text('这条知情本身的出处；只在本页可见，不进提示词', 'where this entry comes from; registry only, not injected')}
                    </span>
                  </th>
                  <th className="px-1 py-1 text-left align-bottom font-normal" style={{ color: 'var(--color-text-muted)', width: '8rem' }}>
                    {text('引用状态', 'Reference')}
                  </th>
                  <th className="px-1 py-1" style={{ width: '6rem' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const broken = row.refState === 'stale' || row.refState === 'unverifiable'
                  return (
                    <tr key={row.key} data-testid="knowledge-row"
                      style={{ opacity: row.removing ? 0.5 : 1 }}>
                      <td className="px-1 py-0.5 align-top">
                        <select
                          data-field="characterId"
                          aria-label={`${text('角色', 'Character')} ${index + 1}`}
                          aria-invalid={row.error ? true : undefined}
                          value={row.characterId}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'characterId', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        >
                          <option value="">{text('（选择角色）', '(pick a character)')}</option>
                          {selectableCharacters.map(character => (
                            <option key={character.characterId} value={character.characterId}>{character.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-0.5 align-top space-y-1">
                        <select
                          data-field="factPicker"
                          aria-label={`${text('事实', 'Fact')} ${index + 1}`}
                          value={row.mode === 'manual' ? '' : row.pickedFactKey}
                          disabled={row.removing || busy}
                          onChange={event => pickFact(row.key, event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        >
                          <option value="">{text('（手填章号 + 引文）', '(type chapter + quote)')}</option>
                          {candidates.map(candidate => (
                            <option key={candidate.factKey} value={candidate.factKey}>
                              {text(
                                `第${candidate.chapterNumber}章 · ${candidate.statement || candidate.factEvidence}`,
                                `Chapter ${candidate.chapterNumber} \u00b7 ${candidate.statement || candidate.factEvidence}`,
                              )}
                            </option>
                          ))}
                        </select>
                        {row.mode === 'manual' && (
                          <div className="flex gap-1">
                            <input
                              data-field="factChapter"
                              aria-label={`${text('事实所在章', 'Fact chapter')} ${index + 1}`}
                              aria-invalid={row.error ? true : undefined}
                              value={row.factChapter}
                              disabled={row.removing || busy}
                              onChange={event => applyField(row.key, 'factChapter', event.target.value)}
                              placeholder={text('章号', 'chapter')}
                              style={{ width: '3.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                            />
                            <input
                              data-field="factEvidence"
                              aria-label={`${text('逐字引文', 'Verbatim quote')} ${index + 1}`}
                              aria-invalid={row.error ? true : undefined}
                              value={row.factEvidence}
                              disabled={row.removing || busy}
                              onChange={event => applyField(row.key, 'factEvidence', event.target.value)}
                              placeholder={text('逐字引文', 'verbatim quote')}
                              style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        <input
                          data-field="learnedChapter"
                          aria-label={`${text('自第几章得知', 'Learned in')} ${index + 1}`}
                          aria-invalid={row.error ? true : undefined}
                          value={row.learnedChapter}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'learnedChapter', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        <input
                          data-field="evidence"
                          aria-label={`${text('出处', 'Evidence')} ${index + 1}`}
                          value={row.evidence}
                          disabled={row.removing || busy}
                          onChange={event => applyField(row.key, 'evidence', event.target.value)}
                          style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 4px' }}
                        />
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        {row.refState && (
                          <span data-testid="knowledge-ref-state"
                            style={{ color: broken ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                            {refStateLabel(row.refState, text)}
                          </span>
                        )}
                        {broken && (
                          <Button size="sm" variant="ghost" onClick={() => repick(row.key)} disabled={busy}>
                            {text('重选事实', 'Pick again')}
                          </Button>
                        )}
                      </td>
                      <td className="px-1 py-0.5 align-top">
                        {row.removing
                          ? (
                            <Button size="sm" variant="ghost" onClick={() => undoRemove(row.key)} disabled={busy}>
                              <Undo2 size={13} />{text('撤销', 'Undo')}
                            </Button>
                          )
                          : row.confirmingRemove
                            ? (
                              <Button size="sm" variant="ghost" onClick={() => confirmRemove(row.key)} disabled={busy}>
                                <Trash2 size={13} />{text('确认删除', 'Confirm delete')}
                              </Button>
                            )
                            : (
                              <Button size="sm" variant="ghost" onClick={() => removeRow(row.key)} disabled={busy}>
                                <Trash2 size={13} />{text('删除', 'Delete')}
                              </Button>
                            )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {text(
                  '还没有登记任何知情关系。「谁在这一章知道什么」现在只在作者脑子里——写的时候没人提醒，回头读才发现未卜先知或集体失忆。',
                  'No knowledge state registered yet. Who knows what at this point only lives in your head right now.',
                )}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {text(
                '只登记「谁知道」：登记过的事实，未列出的角色会被视为不知道；未登记的事实一概不判。未来的「得知章」不会写进当前章（那是剧透）。',
                'Only positive knowledge is registered: for a registered fact, characters not listed are treated as not knowing it; unregistered facts are not judged. Future "learned in" chapters are never injected into the current chapter.',
              )}
            </p>
            {rows.filter(row => row.error).map(row => (
              <p key={row.key} role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {selectableCharacters.find(character => character.characterId === row.characterId)?.name
                  || text('新行', 'new row')}：{row.error}
              </p>
            ))}
          </div>
        )}
    </div>
  )
}
