import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'

import {
  renderVolumeHandoffSection,
  VOLUME_HANDOFF_MAX_CHARS,
  type VolumeHandoffDefinition,
  type VolumeHandoffInput,
} from '../../shared/volume-handoff'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P1-2 期 1 卷末交接单登记面板（作者侧唯一写入口）。
 *
 * ## 一条记录 = 一卷
 *
 * 只记「下一卷必须承接的几件事」。逐章摘要的家是 `summary_snapshots`，这里再登一份
 * 就是第二套账，所以本页**没有**「从定稿生成」这类入口 —— 期 2 才有。
 *
 * ## 卷号与两个章号**全部手填**
 *
 * 不做任何区间推算（作者 2026-10-24 裁定砍掉）：旧格式大纲的章标题根本没有卷号
 * （`parseOutlineChapterHeading` 对 `## 第45章：名` 返回 `volumeIndex: null`），
 * 按章数等分推断又会随超写整体漂移。每行输入框下方固定提示「章号请对照大纲里该卷的
 * 最后几章填写」—— 手填两个章号是这一期故意接受的麻烦。
 *
 * ## 保存前按「保存后的快照」校验
 *
 * 判的是**这一批保存完之后**的库：排除被删的行、把同批次其他行的新值算进去，再判
 * 区间重叠与卷号重复。逐行对当前库判会把「同时改两行」误判成冲突。
 * 任一冲突 ⇒ **整批不提交**并逐行标红（一行失败不该让别的行偷偷落库）。
 *
 * ## 字数提示不阻断保存
 *
 * 显示「正文 N / 1500 字」，超了红字但**照样能存**：注入侧会按规则丢弃超出部分，
 * 那是有序丢弃（后面的先丢），比拦住作者不让他存更符合写作现场。
 */
type LocaleText = (zh: string, en: string) => string

interface DraftRow {
  key: string
  handoffId?: string
  volumeIndex: string
  firstChapter: string
  lastChapter: string
  worldState: string
  heroState: string
  /** 多行文本域：一行一条（保存时 `split('\n').filter(trim)`）。 */
  events: string
  items: string
  debts: string
  openThread: string
  expanded: boolean
  removing: boolean
  confirmingRemove: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    volumeIndex: '',
    firstChapter: '',
    lastChapter: '',
    worldState: '',
    heroState: '',
    events: '',
    items: '',
    debts: '',
    openThread: '',
    expanded: true,
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

function rowFromDefinition(handoff: VolumeHandoffDefinition): DraftRow {
  return {
    key: handoff.handoffId,
    handoffId: handoff.handoffId,
    volumeIndex: String(handoff.volumeIndex),
    firstChapter: String(handoff.firstChapter),
    lastChapter: String(handoff.lastChapter),
    worldState: handoff.worldState,
    heroState: handoff.heroState,
    events: handoff.events.join('\n'),
    items: handoff.items.join('\n'),
    debts: handoff.debts.join('\n'),
    openThread: handoff.openThread,
    expanded: false,
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

/** 多行文本域 → 字符串数组：空行丢弃（作者习惯留空行分隔）。 */
function toList(value: string): string[] {
  return value.split('\n').map(line => line.trim()).filter(Boolean)
}

function toDefinition(row: DraftRow): VolumeHandoffDefinition {
  return {
    handoffId: row.handoffId ?? '',
    volumeIndex: Number(row.volumeIndex.trim()) || 0,
    firstChapter: Number(row.firstChapter.trim()) || 0,
    lastChapter: Number(row.lastChapter.trim()) || 0,
    worldState: row.worldState,
    heroState: row.heroState,
    events: toList(row.events),
    items: toList(row.items),
    debts: toList(row.debts),
    openThread: row.openThread,
    source: 'author',
    createdAt: '',
    updatedAt: '',
  }
}

/**
 * 正文行字数：直接借渲染函数算（**不复制一份计数逻辑**）。
 *
 * 传 `Number.MAX_SAFE_INTEGER` 让一切装得下，于是不出现省略行；去掉节标题与说明句
 * 两行之后剩下的就是「正文行」——与注入侧同一个口径。
 */
function bodyChars(row: DraftRow): number {
  const section = renderVolumeHandoffSection(toDefinition(row), 'zh-CN', 1, Number.MAX_SAFE_INTEGER)
  if (!section) return 0
  return section.split('\n').slice(2).join('\n').length
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

const POSITIVE = /^[1-9]\d*$/u

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'VOLUME_HANDOFF_VOLUME_TAKEN': return text('这个卷号已经被另一份交接单占用了', 'That volume number is already used')
    case 'VOLUME_HANDOFF_RANGE_CONFLICT': return text('章号区间与另一份交接单重叠了', 'The chapter range overlaps another handoff')
    case 'VOLUME_HANDOFF_SCHEMA_MISSING': return text('这个项目的数据库还没有交接单表，无法保存', 'This project database has no handoff table yet')
    case 'VOLUME_HANDOFF_NOT_FOUND': return text('这条交接单已经不在了，刷新列表即可', 'That handoff is gone; reload the list')
    case 'PROJECT_NOT_OPEN': return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('VOLUME_HANDOFF_INVALID:')) {
        return text(`有一个字段不合法（${error.slice('VOLUME_HANDOFF_INVALID:'.length)}），没有保存`, 'A field is invalid, nothing was saved')
      }
      return text(`保存失败（${error ?? '未知原因'}）`, `Save failed (${error ?? 'unknown'})`)
  }
}

export function VolumeHandoffRegistryPanel({ projectKey }: { projectKey: string }) {
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
      setRows([]); setLoadError(''); setLoading(false)
      return
    }
    setLoading(true)
    const listed = await ipc.invokeWithProjectSession(projectSession, 'db:volume-handoffs-list', projectSession.projectPath)
    if (!isProjectSessionCurrent(projectSession)) return
    setLoading(false)
    if (!listed.success) { setLoadError(writeErrorLabel(listed.error, text)); return }
    setLoadError('')
    setRows((listed.entries ?? []).map(rowFromDefinition))
  }, [projectKey, text])

  useEffect(() => {
    // 挂载即读；不轮询 —— 本页只服务作者手工登记。
    queueMicrotask(() => void load())
  }, [load])

  const applyField = (key: string, field: keyof DraftRow, value: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, [field]: value, error: '' } : row)))
  }

  const toggleExpanded = (key: string) => {
    setRows(previous => previous.map(row => (row.key === key ? { ...row, expanded: !row.expanded } : row)))
  }

  const addRow = () => { setRows(previous => [...previous, emptyRow()]); setStatus('') }

  const removeRow = (key: string) => {
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.handoffId) return previous.filter(row => row.key !== key)
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
   * 本地校验：判的是**保存后的快照**（排除被删的行、算入同批新值）。
   * 卷号重复与区间重叠都整批拦下 —— 这两种错落库后都会静默注入错卷。
   */
  const validateSnapshot = (snapshot: readonly DraftRow[]): Map<string, string> => {
    const problems = new Map<string, string>()
    const active = snapshot.filter(row => !row.removing)
    const parsed: Array<{ key: string; volume: number; first: number; last: number }> = []
    for (const row of active) {
      if (!POSITIVE.test(row.volumeIndex.trim())) {
        problems.set(row.key, text('卷号必须是正整数', 'Volume number must be a positive integer'))
        continue
      }
      if (!POSITIVE.test(row.firstChapter.trim())) {
        problems.set(row.key, text('起始章号必须是正整数', 'First chapter must be a positive integer'))
        continue
      }
      if (!POSITIVE.test(row.lastChapter.trim())) {
        problems.set(row.key, text('结束章号必须是正整数', 'Last chapter must be a positive integer'))
        continue
      }
      const volume = Number(row.volumeIndex.trim())
      const first = Number(row.firstChapter.trim())
      const last = Number(row.lastChapter.trim())
      if (last < first) {
        problems.set(row.key, text('结束章号不能小于起始章号', 'Last chapter must not be smaller than the first'))
        continue
      }
      parsed.push({ key: row.key, volume, first, last })
    }
    // 卷号重复：同一卷两条会让「上一卷是哪份」无法回答。
    const byVolume = new Map<number, string[]>()
    for (const item of parsed) byVolume.set(item.volume, [...(byVolume.get(item.volume) ?? []), item.key])
    for (const [volume, keys] of byVolume) {
      if (keys.length < 2) continue
      for (const key of keys) problems.set(key, text(`第${volume}卷登记了不止一份`, `Volume ${volume} is registered more than once`))
    }
    // 区间重叠：重叠 = 同一章落在两条记录里 = 静默注入错卷。相邻（20 / 21）不算重叠。
    for (let left = 0; left < parsed.length; left += 1) {
      for (let right = left + 1; right < parsed.length; right += 1) {
        const a = parsed[left]!
        const b = parsed[right]!
        if (a.first > b.last || b.first > a.last) continue
        problems.set(a.key, text('章号区间与另一卷重叠了', 'The chapter range overlaps another volume'))
        problems.set(b.key, text('章号区间与另一卷重叠了', 'The chapter range overlaps another volume'))
      }
    }
    return problems
  }

  const save = async () => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    const current = rows
    const problems = validateSnapshot(current)
    if (problems.size > 0) {
      // 校验不通过就整批不提交：一行重叠不该让别的行偷偷落库。
      setRows(previous => previous.map(row => problems.has(row.key) ? { ...row, error: problems.get(row.key) ?? '' } : row))
      setStatus(text(`有 ${problems.size} 行还需要修改，本次没有提交`, `${problems.size} row(s) need fixing; nothing was saved`))
      return
    }
    busyRef.current = true
    setBusy(true)
    let saved = 0
    let removed = 0
    // **先删后写**：区间互换时中间态会被判成重叠，先删掉旧行才能腾出位置。
    for (const row of current.filter(item => item.removing)) {
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:volume-handoffs-delete', row.handoffId!, projectSession.projectPath)
      if (result.success) { removed += 1; continue }
      // 删不掉就必须停下：继续写会撞上「卷号已被占用」这种假冲突。
      busyRef.current = false
      setBusy(false)
      setRows(previous => previous.map(item => (item.key === row.key ? { ...item, error: writeErrorLabel(result.error, text) } : item)))
      setStatus(text('删除失败，本次没有写入任何一行', 'Delete failed; nothing was written'))
      return
    }
    const kept: DraftRow[] = []
    for (const row of current.filter(item => !item.removing)) {
      const input: VolumeHandoffInput = {
        ...(row.handoffId ? { handoffId: row.handoffId } : {}),
        volumeIndex: Number(row.volumeIndex.trim()),
        firstChapter: Number(row.firstChapter.trim()),
        lastChapter: Number(row.lastChapter.trim()),
        worldState: row.worldState.trim(),
        heroState: row.heroState.trim(),
        events: toList(row.events),
        items: toList(row.items),
        debts: toList(row.debts),
        openThread: row.openThread.trim(),
      }
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:volume-handoffs-upsert', input, projectSession.projectPath)
      if (!result.success) { kept.push({ ...row, error: writeErrorLabel(result.error, text) }); continue }
      // 用后端回的行改写本地行：不重载，作者的光标不会跳。
      saved += 1
      const entry = result.entry
      kept.push(entry
        ? { ...rowFromDefinition(entry), expanded: row.expanded, key: entry.handoffId }
        : { ...row, error: '' })
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    setRows(kept)
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已保存 ${saved} 份交接单`, `${saved} handoff(s) saved`))
    if (removed > 0) parts.push(text(`已删除 ${removed} 份`, `${removed} removed`))
    if (kept.some(row => row.error)) parts.push(text('有行保存失败，看每行下方提示', 'some rows failed; see the row messages'))
    setStatus(parts.join('；') || text('没有需要保存的改动', 'Nothing to save'))
  }

  return (
    <div className="space-y-3" data-testid="volume-handoff-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={addRow} disabled={busy}>
          <Plus size={13} />{text('新增一卷', 'Add volume')}
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
                  {[
                    [text('卷号', 'Volume'), '4rem'],
                    [text('章号区间', 'Chapters'), '8rem'],
                    [text('卷末世界', 'World'), '12rem'],
                    [text('主角', 'Protagonist'), '10rem'],
                    [text('事件', 'Events'), '4rem'],
                    [text('物品', 'Items'), '4rem'],
                    [text('债', 'Debts'), '4rem'],
                    [text('', ''), '9rem'],
                  ].map(([label, width], index) => (
                    <th key={index} className="px-1 py-1 text-left align-bottom font-normal"
                      style={{ color: 'var(--color-text-muted)', width }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const chars = bodyChars(row)
                  const overBudget = chars > VOLUME_HANDOFF_MAX_CHARS
                  return (
                    <Fragment key={row.key}>
                      <tr data-testid="volume-handoff-row" style={{ opacity: row.removing ? 0.5 : 1 }}>
                        <td className="px-1 py-0.5 align-top" data-field="volumeIndex-cell">{row.volumeIndex || '—'}</td>
                        <td className="px-1 py-0.5 align-top" data-field="range-cell">
                          {row.firstChapter && row.lastChapter ? `第${row.firstChapter}–${row.lastChapter}章` : '—'}
                        </td>
                        <td className="px-1 py-0.5 align-top" data-field="worldState-cell">{truncate(row.worldState, 20) || '—'}</td>
                        <td className="px-1 py-0.5 align-top" data-field="heroState-cell">{truncate(row.heroState, 20) || '—'}</td>
                        <td className="px-1 py-0.5 align-top" data-field="events-cell">{toList(row.events).length}</td>
                        <td className="px-1 py-0.5 align-top" data-field="items-cell">{toList(row.items).length}</td>
                        <td className="px-1 py-0.5 align-top" data-field="debts-cell">{toList(row.debts).length}</td>
                        <td className="px-1 py-0.5 align-top space-y-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleExpanded(row.key)} disabled={busy}>
                            {row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            {row.expanded ? text('收起', 'Collapse') : text('编辑', 'Edit')}
                          </Button>
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
                      {row.expanded && (
                        <tr data-testid="volume-handoff-detail">
                          <td colSpan={8} className="px-1 py-2 align-top">
                            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('第几卷', 'Volume number')}</span>
                                <input
                                  data-field="volumeIndex"
                                  aria-label={text('第几卷', 'Volume number')}
                                  aria-invalid={row.error ? true : undefined}
                                  value={row.volumeIndex}
                                  disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'volumeIndex', event.target.value)}
                                  style={inputStyle}
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('起始章', 'First chapter')}</span>
                                <input
                                  data-field="firstChapter"
                                  aria-label={text('起始章', 'First chapter')}
                                  value={row.firstChapter}
                                  disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'firstChapter', event.target.value)}
                                  style={inputStyle}
                                />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('结束章', 'Last chapter')}</span>
                                <input
                                  data-field="lastChapter"
                                  aria-label={text('结束章', 'Last chapter')}
                                  value={row.lastChapter}
                                  disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'lastChapter', event.target.value)}
                                  style={inputStyle}
                                />
                              </label>
                            </div>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                              {text(
                                '章号请对照大纲里该卷的最后几章填写（本书不做任何区间推算）。',
                                'Fill both chapter numbers by hand from the outline (this tool does not infer ranges).',
                              )}
                            </p>
                            <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('卷末世界', 'World at volume end')}</span>
                                <textarea data-field="worldState" aria-label={text('卷末世界', 'World at volume end')}
                                  rows={2} value={row.worldState} disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'worldState', event.target.value)} style={inputStyle} />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('卷末主角', 'Protagonist at volume end')}</span>
                                <textarea data-field="heroState" aria-label={text('卷末主角', 'Protagonist at volume end')}
                                  rows={2} value={row.heroState} disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'heroState', event.target.value)} style={inputStyle} />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('待承接的事件（一行一条）', 'Events to carry forward (one per line)')}</span>
                                <textarea data-field="events" aria-label={text('待承接的事件', 'Events')}
                                  rows={3} value={row.events} disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'events', event.target.value)} style={inputStyle} />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('关键物品（一行一条）', 'Key items (one per line)')}</span>
                                <textarea data-field="items" aria-label={text('关键物品', 'Key items')}
                                  rows={3} value={row.items} disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'items', event.target.value)} style={inputStyle} />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('未结清的债（一行一条）', 'Outstanding debts (one per line)')}</span>
                                <textarea data-field="debts" aria-label={text('未结清的债', 'Debts')}
                                  rows={2} value={row.debts} disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'debts', event.target.value)} style={inputStyle} />
                              </label>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('卷末未决', 'Unresolved at volume end')}</span>
                                <textarea data-field="openThread" aria-label={text('卷末未决', 'Unresolved')}
                                  rows={2} value={row.openThread} disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'openThread', event.target.value)} style={inputStyle} />
                              </label>
                            </div>
                            <p
                              data-testid="volume-handoff-chars"
                              className="text-[10px] mt-1"
                              style={{ color: overBudget ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                            >
                              {text(`正文 ${chars} / ${VOLUME_HANDOFF_MAX_CHARS} 字`, `Body ${chars} / ${VOLUME_HANDOFF_MAX_CHARS} chars`)}
                              {overBudget
                                ? ` ${text('超出部分注入时会按顺序丢弃，仍可保存', 'Over-budget items are dropped in order at injection time; you can still save')}`
                                : ''}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                {text(
                  '还没有登记任何卷末交接单。写到第 4 卷时，前 3 卷正文早已退出上下文 —— 这张表补的就是那段跨卷记忆。',
                  'No volume handoff registered yet. By volume 4 the earlier prose is long gone from context; this table is that missing cross-volume memory.',
                )}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              <AlertTriangle size={11} className="inline" />{' '}
              {text(
                '正文链只注入「上一卷」（章号区间结束在本章之前的那一份）。两卷区间互换请分两次保存。',
                'The draft chain only injects the previous volume (the range that ends before this chapter). To swap two ranges, save twice.',
              )}
            </p>
            {rows.filter(row => row.error).map(row => (
              <p key={row.key} role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {row.volumeIndex ? text(`第${row.volumeIndex}卷`, `Volume ${row.volumeIndex}`) : text('新行', 'new row')}：{row.error}
              </p>
            ))}
          </div>
        )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '2px 4px',
} as const
