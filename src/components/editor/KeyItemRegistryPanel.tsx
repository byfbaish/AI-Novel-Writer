import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'

import type { KeyItemDefinition, KeyItemInput } from '../../shared/key-item'
import { KEY_ITEM_LABEL_MAX, KEY_ITEM_TEXT_MAX } from '../../shared/key-item'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P1-1 关键物品登记面板（作者侧唯一写入口）。
 *
 * 这一格回答的是「刀在谁手里」，不是「有多少」：
 * - **没有数量、没有单位、没有余额** —— 那是资源（`resources`）的事，两者划界只看
 *   「有没有数量增减」；
 * - **状态是作者写的短语**（`已签` / `剩两副` / `被扣在执法殿`）。刻意不做枚举：
 *   本书真实物品混着「有无 / 归属 / 剩余份数 / 签署状态」四种形态，定枚举等于替作者写设定；
 * - **保存前不落库**：编辑全在本地草稿行里，点「保存」才逐行提交（与资源登记同一种交互，
 *   作者不用重新学一遍）。
 *
 * 出处怎么填：记得哪一章就以那一章作准（注入时会写成「第N章」），
 * 再贴一句**原文逐字引文**更好（注入时写成「第3章：『…』」）。
 * 什么都不填也行 —— 注入时会如实写「作者登记」，**不伪造章号**。
 */
type LocaleText = (zh: string, en: string) => string

type DraftField = 'name' | 'holderLabel' | 'holderCharacter' | 'statusNote' | 'chapterNumber' | 'evidence'

interface Column {
  field: DraftField
  labelZh: string
  labelEn: string
  required?: boolean
  hintZh?: string
  hintEn?: string
  width: string
}

const COLUMNS: readonly Column[] = [
  { field: 'name', labelZh: '物品', labelEn: 'Item', required: true, width: '9rem' },
  { field: 'holderLabel', labelZh: '持有者', labelEn: 'Holder', required: true, hintZh: '角色名 / 地点 / 无主', hintEn: 'character, place, or none', width: '7rem' },
  { field: 'holderCharacter', labelZh: '角色卡', labelEn: 'On stage as', hintZh: '与角色卡同名时才参与「本章出场优先」', hintEn: 'matches a character card to sort first', width: '7rem' },
  { field: 'statusNote', labelZh: '状态', labelEn: 'Status', hintZh: '作者原话，如「已签」「剩两副」', hintEn: 'free text', width: '11rem' },
  { field: 'chapterNumber', labelZh: '出处章', labelEn: 'Chapter', hintZh: '留空 = 作者登记，不伪造章号', hintEn: 'blank = author entry', width: '5rem' },
  { field: 'evidence', labelZh: '原文引文', labelEn: 'Quote', hintZh: '可留空；填了要逐字', hintEn: 'verbatim, optional', width: '14rem' },
]

interface DraftRow {
  key: string
  itemId?: string
  name: string
  holderLabel: string
  holderCharacter: string
  statusNote: string
  chapterNumber: string
  evidence: string
  removing: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    name: '',
    holderLabel: '',
    holderCharacter: '',
    statusNote: '',
    chapterNumber: '',
    evidence: '',
    removing: false,
    error: '',
  }
}

function rowFromDefinition(item: KeyItemDefinition): DraftRow {
  return {
    key: item.itemId,
    itemId: item.itemId,
    name: item.name,
    holderLabel: item.holderLabel,
    holderCharacter: item.holderCharacter,
    statusNote: item.statusNote,
    chapterNumber: item.chapterNumber === null ? '' : String(item.chapterNumber),
    evidence: item.evidence,
    removing: false,
    error: '',
  }
}

/** 本地校验：重名与章号形状在提交前就拦住，避免一次保存里半数行失败。 */
function validateRows(rows: readonly DraftRow[], text: LocaleText): Map<string, string> {
  const problems = new Map<string, string>()
  const seen = new Map<string, string>()
  for (const row of rows) {
    if (row.removing) continue
    const name = row.name.trim()
    if (!name) { problems.set(row.key, text('物品名称不能为空', 'Item name is required')); continue }
    if (name.length > KEY_ITEM_TEXT_MAX) { problems.set(row.key, text('物品名称过长', 'Item name is too long')); continue }
    if (!row.holderLabel.trim()) { problems.set(row.key, text('持有者不能为空（无主请写「无主」）', 'Holder is required (write "none" if unowned)')); continue }
    if (row.holderLabel.trim().length > KEY_ITEM_LABEL_MAX) { problems.set(row.key, text('持有者名字过长', 'Holder name is too long')); continue }
    const duplicated = seen.get(name)
    if (duplicated !== undefined) { problems.set(row.key, text(`物品与上面的行重复：${name}`, `Duplicate item: ${name}`)); continue }
    seen.set(name, row.key)
    const chapter = row.chapterNumber.trim()
    if (chapter && !/^[1-9]\d*$/u.test(chapter)) {
      problems.set(row.key, text('出处章只能填正整数，或留空', 'Chapter must be a positive integer, or blank'))
    }
  }
  return problems
}

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'KEY_ITEM_NAME_DUPLICATED': return text('这个物品名已存在，请换一个名字', 'That item name already exists')
    case 'KEY_ITEM_SCHEMA_MISSING': return text('这个项目的数据库还没有关键物品表，无法保存', 'This project database has no key-items table yet')
    case 'KEY_ITEM_NOT_FOUND': return text('这条物品已经不在了，刷新列表即可', 'That item is gone; reload the list')
    case 'PROJECT_NOT_OPEN': return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('KEY_ITEM_INVALID:')) {
        return text(`有一个字段不合法（${error.slice('KEY_ITEM_INVALID:'.length)}），没有保存`, 'A field is invalid, nothing was saved')
      }
      return text(`保存失败（${error ?? '未知原因'}）`, `Save failed (${error ?? 'unknown'})`)
  }
}

export function KeyItemRegistryPanel({ projectKey }: { projectKey: string }) {
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
    const result = await ipc.invokeWithProjectSession(projectSession, 'db:key-items-list', projectSession.projectPath)
    if (!isProjectSessionCurrent(projectSession)) return
    setLoading(false)
    if (!result.success) { setLoadError(writeErrorLabel(result.error, text)); return }
    setLoadError('')
    setRows((result.items ?? []).map(rowFromDefinition))
  }, [projectKey, text])

  useEffect(() => {
    // 挂载即读；不轮询 —— 本页只服务作者手工登记。
    queueMicrotask(() => void load())
  }, [load])

  const applyField = (key: string, field: DraftField, value: string) => {
    setStatus('')
    setRows(previous => previous.map(row => (row.key === key ? { ...row, [field]: value, error: '' } : row)))
  }

  const addRow = () => { setRows(previous => [...previous, emptyRow()]); setStatus('') }

  const removeRow = (key: string) => {
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.itemId) return previous.filter(row => row.key !== key)
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
        const result = await ipc.invokeWithProjectSession(projectSession, 'db:key-items-delete', row.itemId!, projectSession.projectPath)
        if (result.success) { removed += 1; continue }
        kept.push({ ...row, removing: false, error: writeErrorLabel(result.error, text) })
        continue
      }
      const chapter = row.chapterNumber.trim()
      const input: KeyItemInput = {
        ...(row.itemId ? { itemId: row.itemId } : {}),
        name: row.name.trim(),
        holderLabel: row.holderLabel.trim(),
        holderCharacter: row.holderCharacter.trim(),
        statusNote: row.statusNote.trim(),
        chapterNumber: chapter ? Number(chapter) : null,
        evidence: row.evidence.trim(),
      }
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:key-items-upsert', input, projectSession.projectPath)
      if (!result.success) { kept.push({ ...row, error: writeErrorLabel(result.error, text) }); continue }
      // 用后端回的 itemId 改写本地行：不重载，作者的光标不会跳。
      saved += 1
      kept.push({ ...row, key: result.itemId ?? row.key, itemId: result.itemId ?? row.itemId, error: '' })
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    setRows(kept)
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已保存 ${saved} 件物品`, `${saved} item(s) saved`))
    if (removed > 0) parts.push(text(`已删除 ${removed} 件`, `${removed} removed`))
    if (kept.some(row => row.error)) parts.push(text('有行保存失败，看每行下方提示', 'some rows failed; see the row messages'))
    setStatus(parts.join('；') || text('没有需要保存的改动', 'Nothing to save'))
  }

  return (
    <div className="space-y-3" data-testid="key-item-registry-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={addRow} disabled={busy}>
          <Plus size={13} />{text('新增一件', 'Add item')}
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
                  <tr key={row.key} data-testid="key-item-row"
                    style={{ opacity: row.removing ? 0.5 : 1 }}>
                    {COLUMNS.map(column => (
                      <td key={column.field} className="px-1 py-0.5 align-top">
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
                {text('还没有登记任何物品。正文里那把刀现在只在某个角色的「关键物品」一句话里——没有东西会在它被写丢了的时候报警。',
                  'No items registered yet. Right now that knife only lives in one character\u2019s free-text key-items field.')}
              </p>
            )}
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
