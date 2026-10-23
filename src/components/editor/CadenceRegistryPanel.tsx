import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'

import type { CadenceAxis, InstitutionCadence, InstitutionCadenceInput } from '../../shared/institution-cadence'
import { CADENCE_TEXT_MAX } from '../../shared/institution-cadence'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P1-1 制度登记面板（作者侧唯一写入口）。
 *
 * 这一格回答的是「这一章该不该发生那件周期性的事」，不是「该发多少」：
 * - **没有数量、没有金额、没有累积欠账** —— 那是派生数值（ADR-0022），不进提示词；
 * - **锚是「上次真的发生」**，不是制度生效的起算点。起算点要做模运算，漏写一轮就永久错位；
 * - **保存前不落库**：编辑全在本地草稿行里，点「保存」才逐行提交。
 *
 * 两个轴的区别，作者要能一眼看懂：
 * - 按章（`chapter`）：每 10 章一次 —— 写前就能判；
 * - 按日（`story-day`）：每 7 日一次 —— 需要「本章是第几天」，而新章的日序通常还不知道。
 *   想让它写前也能判，就填「按章降级」（如每 3 章）；不填就诚实地显示「未知」。
 */
type LocaleText = (zh: string, en: string) => string

type DraftText = 'name' | 'interval' | 'anchorChapter' | 'anchorStoryDay'
  | 'fallbackIntervalChapters' | 'chapterNumber' | 'evidence' | 'note'

interface Column {
  field: DraftText | 'axis'
  labelZh: string
  labelEn: string
  required?: boolean
  hintZh?: string
  hintEn?: string
  width: string
}

const COLUMNS: readonly Column[] = [
  { field: 'name', labelZh: '事件', labelEn: 'Event', required: true, width: '8rem' },
  { field: 'axis', labelZh: '轴', labelEn: 'Axis', required: true, hintZh: '按章 / 按日', hintEn: 'chapters / story days', width: '5rem' },
  { field: 'interval', labelZh: '每隔', labelEn: 'Every', required: true, hintZh: '正整数', hintEn: 'positive int', width: '4rem' },
  { field: 'anchorChapter', labelZh: '上次所在章', labelEn: 'Last chapter', hintZh: '上次真的发生的那一章', hintEn: 'when it last happened', width: '6rem' },
  { field: 'anchorStoryDay', labelZh: '上次日序', labelEn: 'Last story day', hintZh: '第 0 日起算，可填 0', hintEn: 'days from t0, 0 allowed', width: '6rem' },
  { field: 'fallbackIntervalChapters', labelZh: '按章降级', labelEn: 'Chapter fallback', hintZh: '要写前就能判，请填按章降级（如 3 = 每3章）', hintEn: 'fill to judge before writing', width: '6rem' },
  { field: 'chapterNumber', labelZh: '登记于第几章', labelEn: 'Registered at', hintZh: '不是「上次发生」，可留空', hintEn: 'not the anchor; optional', width: '6rem' },
  { field: 'evidence', labelZh: '原文引文', labelEn: 'Quote', hintZh: '可留空；填了要逐字', hintEn: 'verbatim, optional', width: '10rem' },
  { field: 'note', labelZh: '备注', labelEn: 'Note', hintZh: '只在本页可见，不进提示词', hintEn: 'registry only, not injected', width: '10rem' },
]

interface DraftRow {
  key: string
  cadenceId?: string
  name: string
  axis: CadenceAxis
  interval: string
  anchorChapter: string
  anchorStoryDay: string
  fallbackIntervalChapters: string
  chapterNumber: string
  evidence: string
  note: string
  removing: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    name: '',
    axis: 'chapter',
    interval: '',
    anchorChapter: '',
    anchorStoryDay: '',
    fallbackIntervalChapters: '',
    chapterNumber: '',
    evidence: '',
    note: '',
    removing: false,
    error: '',
  }
}

function textOrEmpty(value: number | null): string {
  return value === null ? '' : String(value)
}

function rowFromCadence(cadence: InstitutionCadence): DraftRow {
  return {
    key: cadence.cadenceId,
    cadenceId: cadence.cadenceId,
    name: cadence.name,
    axis: cadence.axis,
    interval: String(cadence.interval),
    anchorChapter: textOrEmpty(cadence.anchorChapter),
    anchorStoryDay: textOrEmpty(cadence.anchorStoryDay),
    fallbackIntervalChapters: textOrEmpty(cadence.fallbackIntervalChapters),
    chapterNumber: textOrEmpty(cadence.chapterNumber),
    evidence: cadence.evidence,
    note: cadence.note,
    removing: false,
    error: '',
  }
}

const POSITIVE = /^[1-9]\d*$/u
const NON_NEGATIVE = /^\d+$/u

/** 本地校验：重名与数值形状在提交前就拦住，避免一次保存里半数行失败。 */
function validateRows(rows: readonly DraftRow[], text: LocaleText): Map<string, string> {
  const problems = new Map<string, string>()
  const seen = new Map<string, string>()
  for (const row of rows) {
    if (row.removing) continue
    const name = row.name.trim()
    if (!name) { problems.set(row.key, text('事件名称不能为空', 'Event name is required')); continue }
    if (name.length > CADENCE_TEXT_MAX) { problems.set(row.key, text('事件名称过长', 'Event name is too long')); continue }
    const duplicated = seen.get(name)
    if (duplicated !== undefined) { problems.set(row.key, text(`事件与上面的行重复：${name}`, `Duplicate event: ${name}`)); continue }
    seen.set(name, row.key)
    const interval = row.interval.trim()
    if (!POSITIVE.test(interval)) {
      problems.set(row.key, text('「每隔」只能填正整数', 'Every must be a positive integer')); continue
    }
    const chapterFields: Array<[string, string, string]> = [
      [row.anchorChapter.trim(), '上次所在章', 'Last chapter'],
      [row.fallbackIntervalChapters.trim(), '按章降级', 'Chapter fallback'],
      [row.chapterNumber.trim(), '登记于第几章', 'Registered at'],
    ]
    const badChapter = chapterFields.find(([value]) => value && !POSITIVE.test(value))
    if (badChapter) {
      problems.set(row.key, text(`${badChapter[1]}只能填正整数，或留空`, `${badChapter[2]} must be a positive integer, or blank`))
      continue
    }
    const day = row.anchorStoryDay.trim()
    // 日序允许 0：故事开始那天就是第 0 日，它和「没登记」是两件事。
    if (day && !NON_NEGATIVE.test(day)) {
      problems.set(row.key, text('上次日序只能填非负整数（可填 0），或留空', 'Last story day must be 0 or a positive integer, or blank'))
    }
  }
  return problems
}

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'CADENCE_NAME_DUPLICATED': return text('这个事件名已存在，请换一个名字', 'That event name already exists')
    case 'CADENCE_SCHEMA_MISSING': return text('这个项目的数据库还没有制度表，无法保存', 'This project database has no cadence table yet')
    case 'CADENCE_NOT_FOUND': return text('这条制度已经不在了，刷新列表即可', 'That cadence is gone; reload the list')
    case 'PROJECT_NOT_OPEN': return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('CADENCE_INVALID:')) {
        return text(`有一个字段不合法（${error.slice('CADENCE_INVALID:'.length)}），没有保存`, 'A field is invalid, nothing was saved')
      }
      return text(`保存失败（${error ?? '未知原因'}）`, `Save failed (${error ?? 'unknown'})`)
  }
}

function numberOrNull(value: string): number | null {
  const trimmed = value.trim()
  return trimmed ? Number(trimmed) : null
}

export function CadenceRegistryPanel({ projectKey }: { projectKey: string }) {
  const text = useLocaleStore(state => state.text)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setRows([])
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await ipc.invokeWithProjectSession(projectSession, 'db:cadences-list', projectSession.projectPath)
    if (!isProjectSessionCurrent(projectSession)) return
    setLoading(false)
    if (!result.success) { setLoadError(writeErrorLabel(result.error, text)); return }
    setLoadError('')
    setRows((result.cadences ?? []).map(rowFromCadence))
  }, [projectKey, text])

  useEffect(() => {
    // 挂载即读；不轮询 —— 本页只服务作者手工登记。
    queueMicrotask(() => void load())
  }, [load])

  const applyField = (key: string, field: DraftText | 'axis', value: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, [field]: value, error: '' } : row)))
  }

  const addRow = () => { setRows(previous => [...previous, emptyRow()]); setStatus('') }

  const removeRow = (key: string) => {
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.cadenceId) return previous.filter(row => row.key !== key)
      return previous.map(row => (row.key === key ? { ...row, removing: true, error: '' } : row))
    })
  }

  const undoRemove = (key: string) => {
    setRows(previous => previous.map(row => (row.key === key ? { ...row, removing: false, error: '' } : row)))
  }

  const save = async () => {
    // 连点由 ref 挡：state 的 busy 在这一帧还是旧值。
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    const current = rows
    const problems = validateRows(current, text)
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
        const result = await ipc.invokeWithProjectSession(projectSession, 'db:cadences-delete', row.cadenceId!, projectSession.projectPath)
        if (result.success) { removed += 1; continue }
        kept.push({ ...row, removing: false, error: writeErrorLabel(result.error, text) })
        continue
      }
      const input: InstitutionCadenceInput = {
        ...(row.cadenceId ? { cadenceId: row.cadenceId } : {}),
        name: row.name.trim(),
        axis: row.axis,
        interval: Number(row.interval.trim()),
        anchorChapter: numberOrNull(row.anchorChapter),
        anchorStoryDay: numberOrNull(row.anchorStoryDay),
        fallbackIntervalChapters: numberOrNull(row.fallbackIntervalChapters),
        chapterNumber: numberOrNull(row.chapterNumber),
        evidence: row.evidence.trim(),
        note: row.note.trim(),
      }
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:cadences-upsert', input, projectSession.projectPath)
      if (!result.success) { kept.push({ ...row, error: writeErrorLabel(result.error, text) }); continue }
      // 用后端回的 cadenceId 改写本地行：不重载，作者的光标不会跳。
      saved += 1
      kept.push({ ...row, key: result.cadenceId ?? row.key, cadenceId: result.cadenceId ?? row.cadenceId, error: '' })
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    setRows(kept)
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已保存 ${saved} 条制度`, `${saved} cadence(s) saved`))
    if (removed > 0) parts.push(text(`已删除 ${removed} 条`, `${removed} removed`))
    if (kept.some(row => row.error)) parts.push(text('有行保存失败，看每行下方提示', 'some rows failed; see the row messages'))
    setStatus(parts.join('；') || text('没有需要保存的改动', 'Nothing to save'))
  }

  return (
    <div className="space-y-3" data-testid="cadence-registry-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={addRow} disabled={busy}>
          <Plus size={13} />{text('新增一条', 'Add cadence')}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy || loading}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {text('保存', 'Save')}
        </Button>
        {status && <span role="status" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>

      {loadError && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{loadError}</p>}

      {loading
        ? <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text('读取中…', 'Loading…')}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {COLUMNS.map(column => (
                    <th key={column.field} className="px-1 py-1 text-left align-bottom font-normal"
                      style={{ color: 'var(--color-text-muted)', width: column.width }}
                      title={text(column.hintZh ?? '', column.hintEn ?? '')}>
                      {text(column.labelZh, column.labelEn)}{column.required ? ' *' : ''}
                      {column.hintZh && (
                        <span className="block text-[10px] leading-tight opacity-70">{text(column.hintZh, column.hintEn ?? '')}</span>
                      )}
                    </th>
                  ))}
                  <th className="px-1 py-1" style={{ width: '4rem' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} data-testid="cadence-row"
                    style={{ opacity: row.removing ? 0.5 : 1 }}>
                    {COLUMNS.map(column => (
                      <td key={column.field} className="px-1 py-0.5 align-top">
                        {column.field === 'axis'
                          ? (
                            <select
                              data-field="axis"
                              aria-label={`${text(column.labelZh, column.labelEn)} ${index + 1}`}
                              aria-invalid={row.error ? true : undefined}
                              value={row.axis}
                              disabled={row.removing || busy}
                              onChange={event => applyField(row.key, 'axis', event.target.value)}
                              style={{
                                width: '100%',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 4,
                                padding: '2px 4px',
                              }}
                            >
                              <option value="chapter">{text('按章', 'chapters')}</option>
                              <option value="story-day">{text('按日', 'story days')}</option>
                            </select>
                          )
                          : (
                            <input
                              data-field={column.field}
                              aria-label={`${text(column.labelZh, column.labelEn)} ${index + 1}`}
                              aria-invalid={row.error ? true : undefined}
                              value={row[column.field]}
                              disabled={row.removing || busy}
                              onChange={event => applyField(row.key, column.field, event.target.value)}
                              style={{
                                textDecoration: row.removing ? 'line-through' : undefined,
                                width: '100%',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 4,
                                padding: '2px 4px',
                              }}
                            />
                          )}
                      </td>
                    ))}
                    <td className="px-1 py-0.5 align-top">
                      {row.removing
                        ? (
                          <Button size="sm" variant="ghost" onClick={() => undoRemove(row.key)} disabled={busy}>
                            <Undo2 size={13} />{text('撤销', 'Undo')}
                          </Button>
                        )
                        : (
                          <Button size="sm" variant="ghost" onClick={() => removeRow(row.key)} disabled={busy}>
                            <Trash2 size={13} />{text('删除', 'Delete')}
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {text('还没有登记任何周期事件。月例、送账日、巡夜这些「到没到点」的事，现在只在作者脑子里——写漏了不会有任何东西提醒。',
                  'No recurring events registered yet. Monthly rites, delivery days, night patrols only live in your head right now.')}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              {text('「上次所在章」要随剧情更新：它是判定的唯一锚，长期不更新就会一直显示「逾期」。',
                'Keep "last chapter" up to date: it is the only anchor; a stale anchor shows as overdue forever.')}
            </p>
            {rows.filter(row => row.error).map(row => (
              <p key={row.key} role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {row.name || text('新行', 'new row')}：{row.error}
              </p>
            ))}
          </div>
        )}
    </div>
  )
}
