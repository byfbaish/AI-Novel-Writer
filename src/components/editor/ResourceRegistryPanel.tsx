import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, RefreshCw, Save, Trash2, Undo2 } from 'lucide-react'

import type { ResourceDefinition, ResourceDefinitionInput } from '../../shared/resource-ledger'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * W6a-0 资源登记 —— 作者侧的资源定义 SSoT 入口。
 *
 * 三件事只在这里发生：
 * 1. **定义**，不是余额：余额/中断判定属于 W6c 与纯函数层，这块面板不显示任何数字汇总。
 * 2. **保存前不落库**：编辑全在本地草稿行里，点「保存」才一次性提交。
 * 3. **`scarcity_note` 只展示**（判据 DL）：标签写成「设计意图」，并明写不参与任何计算。
 */
type LocaleText = (zh: string, en: string) => string

/** 十个可编辑列。顺序即表头顺序。 */
type DraftField =
  | 'name'
  | 'familyId'
  | 'tier'
  | 'unit'
  | 'period'
  | 'anchorValue'
  | 'earnNote'
  | 'costNote'
  | 'scarcityNote'
  | 'anchorNote'

interface Column {
  field: DraftField
  labelZh: string
  labelEn: string
  /** 必填列在表头加星号。 */
  required?: boolean
  /** 表头小字：只解释语义，不参与校验。 */
  hintZh?: string
  hintEn?: string
  width: string
}

const COLUMNS: readonly Column[] = [
  { field: 'name', labelZh: '名称', labelEn: 'Name', required: true, width: '9rem' },
  { field: 'familyId', labelZh: '资源族', labelEn: 'Family', width: '7rem' },
  { field: 'tier', labelZh: '品阶', labelEn: 'Tier', width: '4rem' },
  { field: 'unit', labelZh: '单位', labelEn: 'Unit', required: true, width: '5rem' },
  { field: 'period', labelZh: '口径（周期）', labelEn: 'Period', required: true, width: '7rem' },
  {
    field: 'anchorValue',
    labelZh: '换算锚',
    labelEn: 'Anchor',
    hintZh: '留空 = 不可通兑',
    hintEn: 'Blank = not convertible',
    width: '6rem',
  },
  { field: 'earnNote', labelZh: '收入说明', labelEn: 'Earned by', width: '9rem' },
  { field: 'costNote', labelZh: '支出说明', labelEn: 'Spent on', width: '9rem' },
  {
    field: 'scarcityNote',
    labelZh: '设计意图',
    labelEn: 'Design intent',
    hintZh: '仅展示，不参与任何计算',
    hintEn: 'Display only, never used in any calculation',
    width: '10rem',
  },
  { field: 'anchorNote', labelZh: '换算说明', labelEn: 'Anchor note', width: '9rem' },
]

interface DraftRow {
  /** 渲染 key；已落库行直接用 `resourceId`，新行用本地随机串。 */
  key: string
  resourceId?: string
  name: string
  familyId: string
  tier: string
  unit: string
  period: string
  anchorValue: string
  earnNote: string
  costNote: string
  scarcityNote: string
  anchorNote: string
  /** 已有账本记录的删除只是打标记，保存时才真的调 `db:resources-delete`。 */
  removing: boolean
  /** 本行就地错误（校验 / 后端拒绝原因）。 */
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    name: '',
    familyId: '',
    tier: '0',
    unit: '',
    period: '',
    anchorValue: '',
    earnNote: '',
    costNote: '',
    scarcityNote: '',
    anchorNote: '',
    removing: false,
    error: '',
  }
}

function rowFromDefinition(resource: ResourceDefinition): DraftRow {
  return {
    key: resource.resourceId,
    resourceId: resource.resourceId,
    name: resource.name,
    familyId: resource.familyId ?? '',
    tier: String(resource.tier ?? 0),
    unit: resource.unit,
    period: resource.period,
    // null 渲染成空串：空 = 不可通兑；渲染成 0 会被读成「免费兑换」。
    anchorValue: resource.anchorValue === null ? '' : String(resource.anchorValue),
    earnNote: resource.earnNote ?? '',
    costNote: resource.costNote ?? '',
    scarcityNote: resource.scarcityNote ?? '',
    anchorNote: resource.anchorNote ?? '',
    removing: false,
    error: '',
  }
}

/**
 * 本地校验：名称非空且不重复、单位非空、口径非空、换算锚只能空或正数。
 *
 * `0` 必须拦在这里：仓储把它读成「1 单位 = 0 基准值」，等价于免费兑换，
 * 而作者想表达的是「不可通兑」——那是留空，不是 0。
 */
function validateRows(
  rows: readonly DraftRow[],
  text: LocaleText,
): Map<string, string> {
  const problems = new Map<string, string[]>()
  const push = (key: string, message: string) => {
    const list = problems.get(key)
    if (list) list.push(message)
    else problems.set(key, [message])
  }
  const seenNames = new Set<string>()
  for (const row of rows) {
    if (row.removing) continue
    const name = row.name.trim()
    const firstOwner = seenNames.has(name)
    if (!name) push(row.key, text('名称不能为空', 'Name is required'))
    else if (firstOwner) push(row.key, text(`名称与上面的行重复：${name}`, `Duplicate name above: ${name}`))
    if (name) seenNames.add(name)
    if (!row.unit.trim()) push(row.key, text('单位不能为空', 'Unit is required'))
    if (!row.period.trim()) push(row.key, text('口径（周期）不能为空', 'Accounting period is required'))
    const tier = row.tier.trim()
    if (tier && (!Number.isSafeInteger(Number(tier)) || Number(tier) < 0)) {
      push(row.key, text('品阶只能是不小于 0 的整数', 'Tier must be an integer of 0 or more'))
    }
    const anchor = row.anchorValue.trim()
    if (anchor) {
      const value = Number(anchor)
      if (!Number.isFinite(value) || value <= 0) {
        push(row.key, text(
          '换算锚只能留空或填正数：0 会被读成「免费兑换」，不可通兑请留空',
          'Anchor must be blank or positive: 0 reads as a free exchange; leave it blank when not convertible',
        ))
      }
    }
  }
  return new Map([...problems].map(([key, messages]) => [key, messages.join('；')]))
}

function toInput(row: DraftRow): ResourceDefinitionInput {
  const anchor = row.anchorValue.trim()
  const tier = row.tier.trim()
  return {
    ...(row.resourceId ? { resourceId: row.resourceId } : {}),
    familyId: row.familyId.trim() || null,
    name: row.name.trim(),
    tier: tier ? Number(tier) : 0,
    unit: row.unit.trim(),
    anchorValue: anchor ? Number(anchor) : null,
    period: row.period.trim(),
    earnNote: row.earnNote.trim(),
    costNote: row.costNote.trim(),
    scarcityNote: row.scarcityNote.trim(),
    anchorNote: row.anchorNote.trim(),
  }
}

/** 写库失败的可见文案。后端回的是错误码，不是给人看的话。 */
function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'RESOURCE_NAME_DUPLICATED':
      return text('名称已存在，请换一个名字', 'That name already exists')
    case 'RESOURCE_LEDGER_SCHEMA_MISSING':
      return text(
        '这个项目的数据库还没有资源账本表，无法保存',
        'This project database has no resource ledger tables yet',
      )
    case 'PROJECT_NOT_OPEN':
      return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('RESOURCE_INVALID:')) {
        return text(
          `有一个字段不合法（${error.slice('RESOURCE_INVALID:'.length)}），没有保存`,
          `One field is invalid (${error.slice('RESOURCE_INVALID:'.length)}) and was not saved`,
        )
      }
      return text(
        `保存失败（${error ?? '未知原因'}）`,
        `Could not save (${error ?? 'unknown reason'})`,
      )
  }
}

function deleteErrorLabel(
  error: string | undefined,
  movementCount: number | undefined,
  text: LocaleText,
): string {
  if (error === 'RESOURCE_HAS_MOVEMENTS') {
    // 这不是「偶发失败」，重试一万次也不会成功，所以只解释原因、不给重试入口。
    return movementCount === undefined
      ? text(
          '该资源已有账本记录，删定义会丢掉历史',
          'This resource already has ledger entries; deleting the definition would lose that history',
        )
      : text(
          `该资源已有 ${movementCount} 条账本记录，删定义会丢掉历史`,
          `This resource already has ${movementCount} ledger entries; deleting the definition would lose that history`,
        )
  }
  if (error === 'RESOURCE_NOT_FOUND') {
    return text('这条资源已经不在了，刷新列表即可', 'This resource no longer exists; refresh the list')
  }
  return writeErrorLabel(error, text)
}

export function ResourceRegistryPanel({ projectKey }: { projectKey: string }) {
  const currentProject = useProjectStore(state => state.currentProject)
  const text = useLocaleStore(state => state.text)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [loadError, setLoadError] = useState('')
  /** 保存中禁止重复提交；state 更新滞后一拍，挡不住连点。 */
  const busyRef = useRef(false)

  const applyField = useCallback((key: string, field: DraftField, value: string) => {
    setRows(previous => previous.map(row => (
      row.key === key ? { ...row, [field]: value, error: '' } : row
    )))
    setStatus('')
  }, [])

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setRows([])
      setLoadError('')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await ipc.invokeWithProjectSession(
        projectSession,
        'db:resources-list',
        projectSession.projectPath,
      )
      if (!isProjectSessionCurrent(projectSession)) return
      if (!result.success) {
        setLoadError(writeErrorLabel(result.error, text))
        return
      }
      setLoadError('')
      setRows((result.resources ?? []).map(rowFromDefinition))
    } catch {
      if (isProjectSessionCurrent(projectSession)) {
        setLoadError(text('无法读取资源清单', 'Could not read the resource list'))
      }
    } finally {
      if (isProjectSessionCurrent(projectSession)) setLoading(false)
    }
  }, [projectKey, text])

  useEffect(() => {
    // 延到微任务再读：effect 体内同步 setState 会触发级联渲染（react-hooks/set-state-in-effect）。
    queueMicrotask(() => { void load() })
  }, [load, currentProject?.sessionLease])

  const addRow = () => {
    setRows(previous => [...previous, emptyRow()])
    setStatus('')
  }

  const removeRow = (key: string) => {
    setStatus('')
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.resourceId) return previous.filter(row => row.key !== key)
      return previous.map(row => (row.key === key ? { ...row, removing: true, error: '' } : row))
    })
  }

  const undoRemove = (key: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, removing: false, error: '' } : row)))
  }

  const save = async () => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setStatus(text('项目会话已切换，请重新打开这个页面', 'The project session changed; reopen this page'))
      return
    }
    const current = rows
    const problems = validateRows(current, text)
    if (problems.size > 0) {
      // 校验不通过就整批不提交：一行重名不该让别的行偷偷落库。
      setRows(previous => previous.map(row => (
        problems.has(row.key) ? { ...row, error: problems.get(row.key) ?? '' } : row
      )))
      setStatus(text(
        `有 ${problems.size} 行还需要修改，本次没有提交`,
        `${problems.size} row(s) need changes; nothing was submitted`,
      ))
      return
    }

    busyRef.current = true
    setBusy(true)
    setStatus('')
    try {
      const kept: DraftRow[] = []
      let saved = 0
      let failed = 0
      for (const row of current) {
        if (!isProjectSessionCurrent(projectSession)) return
        if (row.removing) {
          if (!row.resourceId) continue
          const result = await ipc.invokeWithProjectSession(
            projectSession,
            'db:resources-delete',
            row.resourceId,
            projectSession.projectPath,
          )
          if (result.success) continue
          failed += 1
          // 删不掉就把行留着，原因写在这一行下面 —— 历史不能被静默丢掉。
          kept.push({
            ...row,
            removing: false,
            error: deleteErrorLabel(result.error, result.movementCount, text),
          })
          continue
        }
        const input = toInput(row)
        const result = await ipc.invokeWithProjectSession(
          projectSession,
          'db:resources-upsert',
          input,
          projectSession.projectPath,
        )
        if (result.success && result.resourceId) {
          saved += 1
          kept.push({
            ...row,
            key: result.resourceId,
            resourceId: result.resourceId,
            name: input.name,
            familyId: input.familyId ?? '',
            unit: input.unit,
            period: input.period,
            tier: String(input.tier ?? 0),
            anchorValue: input.anchorValue === null || input.anchorValue === undefined
              ? ''
              : String(input.anchorValue),
            error: '',
          })
        } else {
          failed += 1
          kept.push({ ...row, error: writeErrorLabel(result.error, text) })
        }
      }
      if (!isProjectSessionCurrent(projectSession)) return
      setRows(kept)
      setStatus(failed === 0
        ? text(`已保存 ${saved} 条资源定义`, `Saved ${saved} resource definition(s)`)
        : text(
            `已保存 ${saved} 条，${failed} 条没有保存（原因见对应行）`,
            `Saved ${saved}; ${failed} not saved (see the affected rows)`,
          ))
    } catch {
      if (isProjectSessionCurrent(projectSession)) {
        setStatus(text('保存失败，请查看下方各行的提示', 'Saving failed; see the per-row messages'))
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <section
      data-testid="resource-registry-panel"
      aria-label={text('资源登记', 'Resource registry')}
      className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-panel)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {text('资源登记', 'Resource registry')}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '这里登记的是资源定义（名称、单位、口径、换算关系），不是余额。改完点「保存」一次性提交。',
              'These are resource definitions (name, unit, period, conversion), not balances. Edits are submitted together when you save.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => void load()} title={text('刷新', 'Refresh')} disabled={busy}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} disabled={busy}>
            <Plus size={12} />
            {text('增行', 'Add row')}
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={busy || loading || rows.length === 0}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {busy ? text('保存中...', 'Saving...') : text('保存', 'Save')}
          </Button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-xs" style={{ color: 'var(--color-error-text)' }}>{loadError}</p>
      )}
      {status && (
        <p role="status" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{status}</p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '先登记本书的资源：灵石分品阶就填同一个资源族，涨跌各自的货币各占一行。',
            "Register this book's resources first: tiered spirit stones share one family, and each currency that rises or falls gets its own row.",
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ color: 'var(--color-text)' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-secondary)' }}>
                {COLUMNS.map(column => (
                  <th
                    key={column.field}
                    scope="col"
                    className="text-left align-bottom px-1 pb-1 font-medium whitespace-nowrap"
                    style={{ minWidth: column.width }}
                  >
                    {text(column.labelZh, column.labelEn)}
                    {column.required && <span aria-hidden="true"> *</span>}
                    {column.hintZh && column.hintEn && (
                      <span className="block text-[0.65rem] font-normal" style={{ color: 'var(--color-text-muted)' }}>
                        {text(column.hintZh, column.hintEn)}
                      </span>
                    )}
                  </th>
                ))}
                <th scope="col" className="text-left px-1 pb-1 font-medium whitespace-nowrap">
                  {text('操作', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <Fragment key={row.key}>
                  <tr
                    data-testid="resource-row"
                    data-removing={row.removing ? 'true' : 'false'}
                    style={{ opacity: row.removing ? 0.5 : 1 }}
                  >
                    {COLUMNS.map(column => {
                      const label = `${text(column.labelZh, column.labelEn)} ${index + 1}`
                      return (
                        <td key={column.field} className="px-1 py-0.5 align-top">
                          <input
                            data-field={column.field}
                            aria-label={label}
                            aria-invalid={row.error ? true : undefined}
                            className="w-full h-6 px-1.5 rounded text-xs"
                            style={{
                              backgroundColor: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text)',
                              textDecoration: row.removing ? 'line-through' : undefined,
                            }}
                            inputMode={
                              column.field === 'tier' ? 'numeric'
                                : column.field === 'anchorValue' ? 'decimal'
                                  : undefined
                            }
                            // 0 不是一个「没填」的占位值，它就是「基础品阶 / 单例资源」。
                            // 不写这句的话，作者会以为留空等于「未分品阶」，而库里存的是 0。
                            placeholder={
                              column.field === 'tier' ? text('0=基础', '0=base')
                                : column.field === 'anchorValue' ? text('空=不通兑', 'blank=no exchange')
                                  : undefined
                            }
                            value={row[column.field]}
                            disabled={row.removing || busy}
                            onChange={event => applyField(row.key, column.field, event.target.value)}
                          />
                        </td>
                      )
                    })}
                    <td className="px-1 py-0.5 align-top whitespace-nowrap">
                      {row.removing ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => undoRemove(row.key)}
                          title={text('撤销删除', 'Undo delete')}
                        >
                          <Undo2 size={12} />
                          {text('撤销', 'Undo')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => removeRow(row.key)}
                          title={text('删除这一行', 'Delete this row')}
                        >
                          <Trash2 size={12} />
                          {text('删除', 'Delete')}
                        </Button>
                      )}
                    </td>
                  </tr>
                  {row.error && (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="px-1 pb-1">
                        <span role="alert" className="text-xs" style={{ color: 'var(--color-error-text)' }}>
                          {row.error}
                        </span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ResourceRegistryPanel
