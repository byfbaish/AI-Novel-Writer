import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Plus, RefreshCw, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react'

import {
  renderVolumeHandoffSection,
  VOLUME_HANDOFF_MAX_CHARS,
  type VolumeHandoffDefinition,
  type VolumeHandoffInput,
} from '../../shared/volume-handoff'
import { volumeEffectiveRanges, type VolumeDefinition, type VolumeRange } from '../../shared/volume-structure'
import type { ConsistencyExemption } from '../../shared/consistency-preflight'
import { volumeHandoffAckKey } from '../../shared/volume-handoff-gate'
import { ipc } from '../../services/ipc-client'
import {
  describeVolumeHandoffFailure,
  generateVolumeHandoff,
} from '../../services/volume-handoff-generation'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P1-2 期 1b 卷末交接单登记面板（作者侧唯一写入口）。
 *
 * ## 一条记录 = 一卷，**只选卷、不填章号**
 *
 * M19 之后区间由 `volumes` 派生（`volumeEffectiveRanges`：起点 = 上一卷有效末章 + 1，
 * 末章 = `actual_last ?? planned_last`）。作者以前要自己数「这一卷从第几章到第几章」，
 * 现在只需在下拉里选一卷，区间只读展示。
 *
 * ## 为什么区间要标来源
 *
 * 四种来源的可信度完全不同：`actual`（该卷已标记写完，末章来自定稿章）> `headings`
 * （synopsis 归属标题精确观测）> `declared`（按大纲自报章数折算）> `even`（按卷数均分）。
 * 界面必须标出来，否则作者会把估算当事实 —— 而模型也会（节首措辞跟着变）。
 *
 * ## 「标记本卷已完成」写的是事实，不是推算
 *
 * 值取该卷区间内**已定稿章的最大章号**（`drafts.status='finalized'` 的查询），不是
 * `planned_last`。所以点它不会把估算写进 `actual_*`；没写过定稿章时它会明确报错。
 *
 * ## 首次打开自动建结构（唯一的自动写操作）
 *
 * `db:volumes-list` 返回 `state === 'empty'` 时自动调一次重建 —— 表空时没有东西可删，
 * 风险为零。`state === 'stale'` **不自动重建**（作者可能正在改大纲），只显示黄条。
 *
 * ## 保存前按「保存后的快照」校验
 *
 * 只剩两条：必须选卷、同一卷不能两份。**区间重叠校验已删除** —— 区间不再由作者输入，
 * 它由卷结构构造为连续不重叠，作者无法制造重叠。
 */
type LocaleText = (zh: string, en: string) => string

/** 「已人工复查」的确认键前缀：与开写闸门共用同一个拼法（`volumeHandoffAckKey`）。 */
const ACK_PREFIX = volumeHandoffAckKey('')

type VolumeState = 'ready' | 'stale' | 'empty' | 'unparsed'

interface DraftRow {
  key: string
  handoffId?: string
  /** `''` = 还没选卷。 */
  volumeId: string
  worldState: string
  heroState: string
  /** 多行文本域：一行一条（保存时 `split('\n').filter(trim)`）。 */
  events: string
  items: string
  debts: string
  openThread: string
  /** `author` = 作者版（自动生成永不覆盖）；`generated` = 模型初稿；`''` = 新行。 */
  source: string
  /** 本行是否被作者改过：保存时决定它升格为作者版还是保持初稿。 */
  edited: boolean
  /** 该行正在生成初稿（按钮转圈、整表禁用写入）。 */
  generating: boolean
  expanded: boolean
  removing: boolean
  confirmingRemove: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    volumeId: '',
    worldState: '',
    heroState: '',
    events: '',
    items: '',
    debts: '',
    openThread: '',
    // 作者亲手新建的行本来就是作者版。
    source: '',
    edited: true,
    generating: false,
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
    volumeId: handoff.volumeId,
    worldState: handoff.worldState,
    heroState: handoff.heroState,
    events: handoff.events.join('\n'),
    items: handoff.items.join('\n'),
    debts: handoff.debts.join('\n'),
    openThread: handoff.openThread,
    source: handoff.source,
    edited: false,
    generating: false,
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

/**
 * 只用于字数预览的假定义。
 *
 * 区间只影响被 `slice(2)` 掉的两行头，所以传占位值即可 —— 这样**没选卷时字数也不再恒为 0**
 * （旧实现 `Number('') || 0` 会让区间变成 0，`volumeIndex` 为 0 时渲染函数直接返回空串）。
 */
function previewDefinition(row: DraftRow): VolumeHandoffDefinition {
  return {
    handoffId: row.handoffId ?? '',
    volumeId: row.volumeId,
    volumeIndex: 1,
    firstChapter: 1,
    lastChapter: 1,
    boundaryBasis: 'actual',
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
  const section = renderVolumeHandoffSection(previewDefinition(row), 'zh-CN', 1, Number.MAX_SAFE_INTEGER)
  if (!section) return 0
  return section.split('\n').slice(2).join('\n').length
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

/** 区间文案：`第41–60章 · 折算`（来源必须露出来，作者才知道能不能信）。 */
function rangeLabel(range: VolumeRange | undefined, text: LocaleText): string {
  if (!range) return text('—', '—')
  if (range.first === null || range.last === null) return text('起止未定', 'unresolved')
  const basis = range.basis === 'actual' ? text('实际', 'actual')
    : range.basis === 'headings' ? text('精确', 'exact')
      : range.basis === 'declared' ? text('折算', 'scaled')
        : text('估算', 'estimated')
  return text(`第${range.first}–${range.last}章 · ${basis}`, `ch ${range.first}–${range.last} · ${basis}`)
}

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'VOLUME_HANDOFF_VOLUME_TAKEN': return text('这一卷已经有一份交接单了', 'That volume already has a handoff')
    case 'VOLUME_HANDOFF_VOLUME_NOT_FOUND': return text('这一卷已不在卷结构里，请重新选择', 'That volume is no longer in the structure; pick another')
    case 'VOLUME_HANDOFF_SCHEMA_MISSING': return text('这个项目的数据库还没有交接单表，无法保存', 'This project database has no handoff table yet')
    case 'VOLUME_HANDOFF_NOT_FOUND': return text('这条交接单已经不在了，刷新列表即可', 'That handoff is gone; reload the list')
    case 'VOLUME_STRUCTURE_SCHEMA_MISSING': return text('这个项目的数据库还没有卷结构表，请先升级项目', 'This project database has no volume tables yet')
    case 'VOLUME_STRUCTURE_UNPARSED': return text('大纲里没有可识别的卷 / 单元结构，无法建立', 'No volume/unit structure found in the outline')
    case 'VOLUME_MARK_DONE_NO_FINALIZED': return text('这一卷还没有已定稿的章，无法标记完成', 'This volume has no finalized chapter yet')
    case 'VOLUME_MARK_DONE_NO_PLANNED_START': return text('这一卷的起始章还没算出来，无法标记完成', 'This volume has no planned start chapter yet')
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
  const [volumes, setVolumes] = useState<VolumeDefinition[]>([])
  const [volumeState, setVolumeState] = useState<VolumeState>('ready')
  const [volumeWarnings, setVolumeWarnings] = useState<string[]>([])
  /** 「已人工复查」的确认（开写闸门写的豁免行）；这里只负责展示与撤销。 */
  const [acknowledged, setAcknowledged] = useState<ConsistencyExemption[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState('')
  const busyRef = useRef(false)
  const autoBuiltRef = useRef(false)

  const ranges = useMemo(() => volumeEffectiveRanges(volumes), [volumes])
  const rangeById = useMemo(() => new Map(ranges.map(range => [range.volumeId, range])), [ranges])
  const volumeById = useMemo(() => new Map(volumes.map(volume => [volume.volumeId, volume])), [volumes])

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setRows([]); setVolumes([]); setLoadError(''); setLoading(false)
      return
    }
    setLoading(true)
    const [volumeRes, handoffRes, exemptions] = await Promise.all([
      ipc.invokeWithProjectSession(projectSession, 'db:volumes-list', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:volume-handoffs-list', projectSession.projectPath),
      ipc.invokeWithProjectSession(projectSession, 'db:consistency-exemption-list', projectSession.projectPath),
    ])
    if (!isProjectSessionCurrent(projectSession)) return
    setLoading(false)
    if (!volumeRes.success) { setLoadError(writeErrorLabel(volumeRes.error, text)); return }
    if (!handoffRes.success) { setLoadError(writeErrorLabel(handoffRes.error, text)); return }
    setLoadError('')
    setVolumes(volumeRes.volumes ?? [])
    setVolumeState(volumeRes.state ?? 'ready')
    setVolumeWarnings(volumeRes.warnings ?? [])
    setRows((handoffRes.entries ?? []).map(rowFromDefinition))
    setAcknowledged((exemptions ?? []).filter(entry => !entry.revoked && entry.stableFactKey.startsWith(ACK_PREFIX)))

    // 表里一行都没有 ⇒ 自动建一次（没有东西可删，风险为零）。`stale` 不自动重建。
    if (volumeRes.state === 'empty' && !autoBuiltRef.current) {
      autoBuiltRef.current = true
      const rebuilt = await ipc.invokeWithProjectSession(
        projectSession, 'db:volumes-rebuild', projectSession.projectPath)
      if (!isProjectSessionCurrent(projectSession)) return
      if (rebuilt.success) {
        setVolumes(rebuilt.volumes ?? [])
        setVolumeState((rebuilt.volumes ?? []).length > 0 ? 'ready' : 'unparsed')
        setVolumeWarnings(rebuilt.warnings ?? [])
      } else {
        setVolumeState('unparsed')
        setLoadError(writeErrorLabel(rebuilt.error, text))
      }
    }
  }, [projectKey, text])

  useEffect(() => {
    // 挂载即读；不轮询 —— 本页只服务作者手工登记。
    queueMicrotask(() => void load())
  }, [load])

  const rebuild = async () => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    busyRef.current = true
    setBusy(true)
    const result = await ipc.invokeWithProjectSession(projectSession, 'db:volumes-rebuild', projectSession.projectPath)
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    if (!result.success) { setLoadError(writeErrorLabel(result.error, text)); return }
    setVolumes(result.volumes ?? [])
    setVolumeState((result.volumes ?? []).length > 0 ? 'ready' : 'unparsed')
    setVolumeWarnings(result.warnings ?? [])
    const removed = result.removed ?? 0
    const retained = result.retained ?? []
    setStatus([
      text(`重建完成：${(result.volumes ?? []).length} 卷`, `${(result.volumes ?? []).length} volume(s) rebuilt`),
      removed > 0 ? text(`删除 ${removed} 卷`, `${removed} removed`) : '',
      retained.length > 0 ? text(`保留 ${retained.join('、')} 卷（有交接单）`, `kept ${retained.join(', ')}`) : '',
    ].filter(Boolean).join('；'))
  }

  const markDone = async (row: DraftRow) => {
    if (busyRef.current || !row.volumeId) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    busyRef.current = true
    setBusy(true)
    const result = await ipc.invokeWithProjectSession(
      projectSession, 'db:volumes-mark-done', row.volumeId, projectSession.projectPath)
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    if (!result.success || !result.volume) {
      // 只标红，不清空作者已经填好的六项。
      setRows(previous => previous.map(item => (
        item.key === row.key ? { ...item, error: writeErrorLabel(result.error, text) } : item)))
      return
    }
    const saved = result.volume
    setVolumes(previous => previous.map(volume => (volume.volumeId === saved.volumeId ? saved : volume)))
    setStatus(text(`第${saved.volumeIndex}卷：实际到第${result.actualLast}章`,
      `Volume ${saved.volumeIndex}: actual end is chapter ${result.actualLast}`))
  }

  /**
   * 用卷内各章定稿要点重新生成初稿（P1-2 期 2）。
   *
   * **作者版不可重新生成** —— 这是「一次模型调用」与「作者半小时手改」之间唯一的闸门，
   * 与定稿链的步骤用同一个 `source === 'author'` 判定（按钮本身也 disabled，这里是第二道）。
   *
   * 未保存且已有手打内容的新行也拒绝：先保存，否则这次生成会把打了一半的字直接换掉。
   */
  const regenerate = async (row: DraftRow) => {
    if (busyRef.current || row.generating) return
    if (row.source === 'author') return
    const range = rangeById.get(row.volumeId)
    if (!range) return
    const fail = (message: string) => setRows(previous => previous.map(item => (
      item.key === row.key ? { ...item, generating: false, error: message } : item)))
    if (range.first === null || range.last === null) {
      fail(text('本卷起止未定，无法生成（先重建卷结构）', 'This volume has no chapter range yet; rebuild the structure first'))
      return
    }
    const typed = [row.worldState, row.heroState, row.events, row.items, row.debts, row.openThread]
      .some(value => value.trim())
    if (!row.handoffId && typed) {
      fail(text('这一行还没保存。先保存，再生成初稿（否则手打的内容会被替换）',
        'Save this row first, then generate; otherwise what you typed would be replaced'))
      return
    }
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    busyRef.current = true
    setBusy(true)
    setRows(previous => previous.map(item => (item.key === row.key ? { ...item, generating: true, error: '' } : item)))
    try {
      const projections = await ipc.invokeWithProjectSession(
        projectSession,
        'db:continuity-list-before',
        range.last + 1,
        projectSession.projectPath,
      )
      if (!isProjectSessionCurrent(projectSession)) return
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
        writingLanguage: useProjectStore.getState().currentProject?.novelConfig?.writingLanguage ?? 'zh-CN',
        projectSession,
      })
      if (!isProjectSessionCurrent(projectSession)) return
      if (!result.ok) {
        fail(describeVolumeHandoffFailure(result.reason, text))
        return
      }
      const saved = await ipc.invokeWithProjectSession(projectSession, 'db:volume-handoffs-upsert', {
        ...(row.handoffId ? { handoffId: row.handoffId } : {}),
        volumeId: row.volumeId,
        ...result.draft,
        source: 'generated',
      }, projectSession.projectPath)
      if (!isProjectSessionCurrent(projectSession)) return
      if (!saved.success || !saved.entry) {
        fail(writeErrorLabel(saved.error, text))
        return
      }
      const entry = saved.entry
      setRows(previous => previous.map(item => (
        item.key === row.key ? { ...rowFromDefinition(entry), expanded: item.expanded } : item)))
      setStatus(text(
        `已生成初稿（正文 ${result.report.bodyChars}/${VOLUME_HANDOFF_MAX_CHARS} 字；要点 ${result.coverage.usedChapters.length} 章）`,
        `Draft generated (body ${result.report.bodyChars}/${VOLUME_HANDOFF_MAX_CHARS} chars; notes from ${result.coverage.usedChapters.length} chapters)`,
      ))
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error))
    } finally {
      busyRef.current = false
      setBusy(false)
      setRows(previous => previous.map(item => (item.generating ? { ...item, generating: false } : item)))
    }
  }

  /** 撤销一条「已人工复查」：下次进入该卷第一章会重新提醒。 */
  const revokeAck = async (stableFactKey: string) => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    busyRef.current = true
    setBusy(true)
    const result = await ipc.invokeWithProjectSession(
      projectSession, 'db:consistency-exemption-revoke', stableFactKey, projectSession.projectPath)
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    if (!result.success) { setStatus(writeErrorLabel(result.error, text)); return }
    setAcknowledged(previous => previous.filter(entry => entry.stableFactKey !== stableFactKey))
    setStatus(text(
      '已撤销确认：下次进入该卷第一章会重新提醒',
      'Confirmation revoked: entering that volume again will ask once more',
    ))
  }

  const applyField = (key: string, field: keyof DraftRow, value: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key
      // 动过任何字段 ⇒ 这一行升格为作者版（保存时据此决定 `source`）。
      ? { ...row, [field]: value, edited: true, error: '' }
      : row)))
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
   * 本地校验：判的是**保存后的快照**（排除被删的行）。
   *
   * 只剩两条 —— 必须选卷、同一卷不能两份。区间不再由作者输入，所以「重叠」这个错误形态
   * 已经从根上消失（相邻卷的起点由上一卷末章 + 1 派生，不可能重叠）。
   */
  const validateSnapshot = (snapshot: readonly DraftRow[]): Map<string, string> => {
    const problems = new Map<string, string>()
    const active = snapshot.filter(row => !row.removing)
    for (const row of active) {
      if (!row.volumeId) {
        problems.set(row.key, text('请选择卷', 'Choose a volume'))
        continue
      }
      if (!volumeById.has(row.volumeId)) {
        problems.set(row.key, text('这一卷已不在卷结构里，请重新选择', 'That volume is no longer in the structure'))
      }
    }
    const byVolume = new Map<string, string[]>()
    for (const row of active) {
      if (!row.volumeId || problems.has(row.key)) continue
      byVolume.set(row.volumeId, [...(byVolume.get(row.volumeId) ?? []), row.key])
    }
    for (const [volumeId, keys] of byVolume) {
      if (keys.length < 2) continue
      const index = volumeById.get(volumeId)?.volumeIndex
      for (const key of keys) {
        problems.set(key, text(`第${index}卷登记了不止一份`, `Volume ${index} is registered more than once`))
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
      // 校验不通过就整批不提交：一行有问题不该让别的行偷偷落库。
      setRows(previous => previous.map(row => problems.has(row.key) ? { ...row, error: problems.get(row.key) ?? '' } : row))
      setStatus(text(`有 ${problems.size} 行还需要修改，本次没有提交`, `${problems.size} row(s) need fixing; nothing was saved`))
      return
    }
    busyRef.current = true
    setBusy(true)
    let saved = 0
    let removed = 0
    // **先删后写**：删掉的行不该在写入期间占着它那一卷的唯一名额。
    for (const row of current.filter(item => item.removing)) {
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:volume-handoffs-delete', row.handoffId!, projectSession.projectPath)
      if (result.success) { removed += 1; continue }
      // 删不掉就必须停下：继续写会撞上「这一卷已经有一份」这种假冲突。
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
        volumeId: row.volumeId,
        worldState: row.worldState.trim(),
        heroState: row.heroState.trim(),
        events: toList(row.events),
        items: toList(row.items),
        debts: toList(row.debts),
        openThread: row.openThread.trim(),
        /**
         * 只有**动过的行**升格为作者版。
         *
         * 整页点一次保存就把没碰过的初稿也冻成作者版，会让这些行永久失去「重新生成」；
         * 而「初稿 + 作者手改」混在同一页里是常态。
         */
        source: row.edited || !row.handoffId ? 'author' : row.source,
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

  const canAdd = volumeState !== 'unparsed' && volumes.length > 0

  return (
    <div className="space-y-3" data-testid="volume-handoff-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={addRow} disabled={busy || !canAdd}>
          <Plus size={13} />{text('新增一卷', 'Add volume')}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy || loading}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {text('保存', 'Save')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void rebuild()} disabled={busy || loading}>
          <RefreshCw size={13} />{text('重建卷结构', 'Rebuild structure')}
        </Button>
        {status && <span role="status" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>

      <p data-testid="volume-structure-state" className="text-xs" style={{
        color: volumeState === 'unparsed'
          ? 'var(--color-danger)'
          : volumeState === 'stale' ? 'var(--color-warning, #b45309)' : 'var(--color-text-muted)',
      }}>
        {volumeState === 'unparsed'
          ? text('大纲里没有可识别的卷 / 单元结构，无法建立卷结构', 'No volume/unit structure in the outline')
          : volumeState === 'stale'
            ? text('卷结构已过期（大纲比表新）。重建只更新计划区间，不会清空实际末章。',
              'Volume structure is stale. Rebuilding only refreshes planned ranges; actual end chapters are kept.')
            : volumeState === 'empty'
              ? text('尚未建立卷结构', 'No volume structure yet')
              : text(`卷结构：${volumes.length} 卷`, `${volumes.length} volume(s)`) }
      </p>

      {volumeWarnings.length > 0 && (
        <p className="text-[10px]" style={{ color: 'var(--color-warning, #b45309)' }}>
          <AlertTriangle size={11} className="inline" />{' '}
          {text(`有 ${volumeWarnings.length} 处观测与算出的区间不一致（大纲与实际不同步）`,
            `${volumeWarnings.length} observation(s) fall outside the computed range`)}
        </p>
      )}

      {loadError && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{loadError}</p>}

      {loading
        ? <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{text('读取中…', 'Loading…')}</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {[
                    [text('卷', 'Volume'), '9rem'],
                    [text('来源', 'Source'), '5rem'],
                    [text('区间', 'Chapters'), '9rem'],
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
                  const volume = volumeById.get(row.volumeId)
                  const range = rangeById.get(row.volumeId)
                  return (
                    <Fragment key={row.key}>
                      <tr data-testid="volume-handoff-row" style={{ opacity: row.removing ? 0.5 : 1 }}>
                        <td className="px-1 py-0.5 align-top" data-field="volume-cell">
                          {volume
                            ? `第${volume.volumeIndex}卷${volume.name ? ` · ${truncate(volume.name, 10)}` : ''}`
                            : row.volumeId
                              ? text('（已不在卷结构里）', '(not in structure)')
                              : '—'}
                        </td>
                        <td className="px-1 py-0.5 align-top" data-field="source-cell" data-source={row.source}>
                          {row.source === 'author' ? (
                            <span
                              data-testid="volume-handoff-source-author"
                              style={{
                                background: 'var(--color-text)', color: 'var(--color-surface)',
                                borderRadius: 3, padding: '0 4px', fontSize: 10,
                              }}
                            >{text('作者版', 'Author')}</span>
                          ) : row.source === 'generated' ? (
                            <span
                              data-testid="volume-handoff-source-generated"
                              style={{
                                border: '1px solid var(--color-warning, #b45309)',
                                color: 'var(--color-warning, #b45309)',
                                borderRadius: 3, padding: '0 4px', fontSize: 10,
                              }}
                            >{text('初稿', 'Draft')}</span>
                          ) : '—'}
                        </td>
                        <td className="px-1 py-0.5 align-top" data-field="range-cell">{rangeLabel(range, text)}</td>
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
                          <td colSpan={9} className="px-1 py-2 align-top">
                            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                              <label className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('哪一卷', 'Volume')}</span>
                                <select
                                  data-field="volumeId"
                                  aria-label={text('哪一卷', 'Volume')}
                                  aria-invalid={row.error ? true : undefined}
                                  value={row.volumeId}
                                  disabled={row.removing || busy}
                                  onChange={event => applyField(row.key, 'volumeId', event.target.value)}
                                  style={inputStyle}
                                >
                                  <option value="">{text('（请选择卷）', '(choose a volume)')}</option>
                                  {volumes.map(volume => (
                                    <option key={volume.volumeId} value={volume.volumeId}>
                                      {`第${volume.volumeIndex}卷${volume.name ? ` · ${volume.name}` : ''} · ${rangeLabel(rangeById.get(volume.volumeId), text)}${volume.source === 'retained' ? text('（大纲已无此卷，保留）', ' (retained)') : ''}`}
                                    </option>
                                  ))}
                                  {/* 交接单指向已删的卷：给一个失效选项，让作者能看见并改选。 */}
                                  {row.volumeId && !volumeById.has(row.volumeId) && (
                                    <option value={row.volumeId}>
                                      {text('（这一卷已不在卷结构里）', '(this volume is no longer in the structure)')}
                                    </option>
                                  )}
                                </select>
                              </label>
                              <div className="block">
                                <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{text('区间（自动，不可编辑）', 'Range (automatic)')}</span>
                                <div data-field="range-readonly" className="flex items-center gap-2" style={{ ...inputStyle, minHeight: 24 }}>
                                  <span>{rangeLabel(range, text)}</span>
                                  <Button size="sm" variant="ghost" data-action="mark-volume-done"
                                    onClick={() => void markDone(row)}
                                    disabled={busy || !row.volumeId || volume?.source === 'retained'}>
                                    {text('标记本卷已完成', 'Mark volume done')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    data-action="regenerate-handoff"
                                    onClick={() => void regenerate(row)}
                                    disabled={busy || !row.volumeId || row.source === 'author' || row.generating}
                                    title={row.source === 'author'
                                      ? text(
                                        '作者版不会被自动覆盖；如需模型初稿，请删除本行后重新生成',
                                        'Author-owned handoffs are never overwritten; delete this row if you want a model draft',
                                      )
                                      : text(
                                        '用本卷各章的定稿要点重新生成初稿（作者版不会被覆盖）',
                                        'Regenerate a draft from this volume\'s finalized chapter notes (author-owned rows are never overwritten)',
                                      )}
                                  >
                                    {row.generating
                                      ? <Loader2 size={13} className="animate-spin" />
                                      : <RefreshCw size={13} />}
                                    {row.generating ? text('生成中…', 'Generating…') : text('重新生成', 'Regenerate')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                              {text(
                                '区间由卷结构算出：起点接着上一卷，末章优先用「实际末章」（标记完成时取该卷已定稿章的最大章号）。',
                                'Ranges come from the volume structure: the start continues the previous volume, and the end prefers the actual last chapter (max finalized chapter when you mark it done).',
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
                {canAdd
                  ? text(
                    '还没有登记任何卷末交接单。写到第 4 卷时，前 3 卷正文早已退出上下文 —— 这张表补的就是那段跨卷记忆。',
                    'No volume handoff registered yet. By volume 4 the earlier prose is long gone from context; this table is that missing cross-volume memory.',
                  )
                  : text(
                    '先在「重建卷结构」里从大纲建出卷，才能登记交接单。',
                    'Rebuild the volume structure from the outline first, then you can register handoffs.',
                  )}
              </p>
            )}
            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
              <AlertTriangle size={11} className="inline" />{' '}
              {text(
                '正文链只注入「上一卷」（有效末章在本章之前的那一份）；没有实际末章的卷按物化区间判断，界面会标「估算」。',
                'The draft chain only injects the previous volume (the one whose effective end is before this chapter); volumes without an actual end fall back to the materialized range, marked "estimated".',
              )}
            </p>
            {rows.filter(row => row.error).map(row => (
              <p key={row.key} role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                {volumeById.get(row.volumeId)
                  ? text(`第${volumeById.get(row.volumeId)!.volumeIndex}卷`, `Volume ${volumeById.get(row.volumeId)!.volumeIndex}`)
                  : text('新行', 'new row')}：{row.error}
              </p>
            ))}
            {acknowledged.length > 0 && (
              <details data-testid="volume-handoff-acks" className="mt-2">
                <summary className="cursor-pointer text-xs">
                  {text(`已确认的跨卷衔接（${acknowledged.length}）`, `Confirmed handovers (${acknowledged.length})`)}
                </summary>
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {text(
                    '这些卷在开写下一卷时不会再提醒。撤销一条，下次进入该卷第一章会重新提醒。',
                    'These volumes no longer prompt when the next volume starts. Revoke one to be asked again.',
                  )}
                </p>
                {acknowledged.map(entry => {
                  const volumeId = entry.stableFactKey.slice(ACK_PREFIX.length)
                  const index = volumeById.get(volumeId)?.volumeIndex
                  return (
                    <div key={entry.stableFactKey} className="mt-1 flex items-start justify-between gap-2 text-xs">
                      <span>{index ? text(`第${index}卷`, `Volume ${index}`) : volumeId}：{entry.reason}</span>
                      <Button size="sm" variant="ghost" data-action="revoke-handoff-ack" disabled={busy}
                        onClick={() => void revokeAck(entry.stableFactKey)}>
                        <RotateCcw size={13} />{text('撤销', 'Revoke')}
                      </Button>
                    </div>
                  )
                })}
              </details>
            )}
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
