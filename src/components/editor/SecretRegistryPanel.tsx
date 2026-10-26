import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'

import {
  SECRET_DETAIL_MAX,
  SECRET_TEXT_MAX,
  type SecretDefinition,
  type SecretInput,
} from '../../shared/secret'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * P20-2 秘密宿体登记面板（作者侧唯一写入口）。
 *
 * ## 一行 = 一个秘密
 *
 * 不是「谁在第几章知道什么」（那是知情格 M16），而是「**谁在捂、谁还不知道、第几章穿**」。
 * 两者的区别写在 `src/shared/secret.ts` 文件头（含为什么不并入 M16 的四条逐列对照）。
 *
 * ## 真相本体写在这里，但不会进正文提示词
 *
 * `detail` 是给**审稿员**判「有没有提前泄密」用的。正文链从不读它（判据 DP 同族：
 * 第 3 维整维跳过就是为了防剧透，秘密的真相比第 3 维原文更直白）。
 * 所以本页写得多细都不会污染正文 —— 但也正因如此，它**不改善**生成质量，只改善审稿。
 *
 * ## 保存前不落库、重名整批不提交、删除要确认
 *
 * 与知情、能力、制度、物品登记同一纪律：本地校验通过才逐行提交；
 * 一个重名就让整批留在本地（一行失败不该让别的行偷偷落库）。
 *
 * ## 揭穿章留空是**合法状态**，不是漏填
 *
 * 空 = 作者还没决定第几章穿。推导时按「任何章都算未揭穿」处理（保守方向）。
 * 所以这里不给红字催填 —— 催出来的假章号会让守卫在错误的章放行。
 */
type LocaleText = (zh: string, en: string) => string

interface DraftRow {
  key: string
  secretId?: string
  title: string
  detail: string
  /** 名字用顿号/逗号分隔，提交前拆成数组。 */
  holders: string
  unaware: string
  revealChapter: string
  evidence: string
  removing: boolean
  confirmingRemove: boolean
  error: string
}

function emptyRow(): DraftRow {
  return {
    key: `draft:${crypto.randomUUID()}`,
    title: '',
    detail: '',
    holders: '',
    unaware: '',
    revealChapter: '',
    evidence: '',
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

function rowFromDefinition(secret: SecretDefinition): DraftRow {
  return {
    key: secret.secretId,
    secretId: secret.secretId,
    title: secret.title,
    detail: secret.detail,
    holders: secret.holders.join('、'),
    unaware: secret.unaware.join('、'),
    revealChapter: secret.revealChapter === null ? '' : String(secret.revealChapter),
    evidence: secret.evidence,
    removing: false,
    confirmingRemove: false,
    error: '',
  }
}

const POSITIVE = /^[1-9]\d*$/u

/** 名字输入里允许的分隔符：顿号、中英文逗号、分号、换行。 */
function splitNames(value: string): string[] {
  return value.split(/[、,，;；\n]/u).map(name => name.trim()).filter(Boolean)
}

function writeErrorLabel(error: string | undefined, text: LocaleText): string {
  switch (error) {
    case 'SECRET_DUPLICATED': return text('这个名字的秘密已经登记过了', 'A secret with that name is already registered')
    case 'SECRET_SCHEMA_MISSING': return text('这个项目的数据库还没有秘密表，无法保存', 'This project database has no secret table yet')
    case 'SECRET_NOT_FOUND': return text('这条秘密已经不在了，刷新列表即可', 'That entry is gone; reload the list')
    case 'PROJECT_NOT_OPEN': return text('项目数据库未打开', 'The project database is not open')
    default:
      if (error?.startsWith('SECRET_INVALID:')) {
        return text(`有一个字段不合法（${error.slice('SECRET_INVALID:'.length)}），没有保存`, 'A field is invalid, nothing was saved')
      }
      return text(`保存失败（${error ?? '未知原因'}）`, `Save failed (${error ?? 'unknown'})`)
  }
}

export function SecretRegistryPanel({ projectKey }: { projectKey: string }) {
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
    const listed = await ipc.invokeWithProjectSession(projectSession, 'db:secrets-list', projectSession.projectPath)
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

  const addRow = () => { setRows(previous => [...previous, emptyRow()]); setStatus('') }

  const removeRow = (key: string) => {
    setRows(previous => {
      const target = previous.find(row => row.key === key)
      // 未落库的新行直接消失：没有历史可谈。
      if (!target?.secretId) return previous.filter(row => row.key !== key)
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

  /** 本地校验：重名整批拦下，揭穿章只能是正整数或留空 —— 不等数据库报 UNIQUE / CHECK。 */
  const validateRows = (current: readonly DraftRow[]): Map<string, string> => {
    const problems = new Map<string, string>()
    const seen = new Set<string>()
    for (const row of current) {
      if (row.removing) continue
      const title = row.title.trim()
      if (!title) {
        problems.set(row.key, text('秘密名是必填项', 'Secret name is required'))
        continue
      }
      if (title.length > SECRET_TEXT_MAX) {
        problems.set(row.key, text('秘密名过长', 'Secret name is too long'))
        continue
      }
      if (seen.has(title)) {
        problems.set(row.key, text('这个秘密名在本页重复了', 'This secret name is used twice on this page'))
        continue
      }
      seen.add(title)
      if (!row.detail.trim()) {
        problems.set(row.key, text('真相是必填项（审稿要靠它判有没有提前泄密）', 'The truth is required; review uses it to detect premature reveals'))
        continue
      }
      if (row.detail.trim().length > SECRET_DETAIL_MAX) {
        problems.set(row.key, text('真相过长，压成一句话', 'The truth is too long; keep it to one statement'))
        continue
      }
      if (row.revealChapter.trim() && !POSITIVE.test(row.revealChapter.trim())) {
        problems.set(row.key, text('「计划揭穿章」只能填正整数，或留空表示还没定', 'Planned reveal chapter must be a positive integer, or empty if undecided'))
        continue
      }
      for (const [label, names] of [
        [text('隐瞒者', 'Hiders'), row.holders],
        [text('尚不知情', 'Unaware'), row.unaware],
        [text('出处', 'Evidence'), row.evidence],
      ] as const) {
        if (splitNames(names).some(name => name.length > SECRET_TEXT_MAX)) {
          problems.set(row.key, text(`${label}里有名字过长`, `${label}: a name is too long`))
          break
        }
      }
    }
    return problems
  }

  const save = async () => {
    if (busyRef.current) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    const current = rows
    const problems = validateRows(current)
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
        const result = await ipc.invokeWithProjectSession(projectSession, 'db:secrets-delete', row.secretId!, projectSession.projectPath)
        if (result.success) { removed += 1; continue }
        kept.push({ ...row, removing: false, error: writeErrorLabel(result.error, text) })
        continue
      }
      const input: SecretInput = {
        ...(row.secretId ? { secretId: row.secretId } : {}),
        title: row.title.trim(),
        detail: row.detail.trim(),
        holders: splitNames(row.holders),
        unaware: splitNames(row.unaware),
        // 留空 = 还没定，提交 null（不是 0、也不是空串）。
        revealChapter: row.revealChapter.trim() ? Number(row.revealChapter.trim()) : null,
        evidence: row.evidence.trim(),
      }
      const result = await ipc.invokeWithProjectSession(projectSession, 'db:secrets-upsert', input, projectSession.projectPath)
      if (result.success) { saved += 1; continue }
      kept.push({ ...row, error: writeErrorLabel(result.error, text) })
    }
    busyRef.current = false
    setBusy(false)
    if (!isProjectSessionCurrent(projectSession)) return
    const parts: string[] = []
    if (saved > 0) parts.push(text(`已保存 ${saved} 条`, `${saved} saved`))
    if (removed > 0) parts.push(text(`已删除 ${removed} 条`, `${removed} deleted`))
    if (kept.length > 0) parts.push(text(`${kept.length} 条没保存成功`, `${kept.length} failed`))
    setStatus(parts.join('；'))
    /**
     * 有失败就**不**重载：`load()` 会把 `rows` 替换成库里的数据，失败行当场消失
     * —— 作者刚填的名字与真相全没了，还得重打一遍。
     *
     * 未重载的代价是「已成功的新行下次保存会再提交一次」，而这对本表是幂等的
     * （同名报 `SECRET_DUPLICATED` 而不是产生第二条），所以安全。
     */
    if (kept.length === 0) await load()
    else setRows(kept)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={addRow} disabled={busy}>
          <Plus className="w-3.5 h-3.5" />
          {text('新增一条', 'Add one')}
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy || loading}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {text('保存', 'Save')}
        </Button>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />}
        {status && <span role="status" className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{status}</span>}
      </div>

      {loadError && <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{loadError}</p>}

      {!loading && rows.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '还没有登记任何秘密。世界观第 3 维写了「谁在隐瞒什么」的话，把它拆成一条条记在这里，审稿时才知道哪一章还不能写出真相。',
            'No secrets registered yet. If dimension 3 of your worldbuilding says who hides what, record them here one by one so review knows which chapters must not reveal the truth.',
          )}
        </p>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.key}
              data-testid="secret-row"
              className="rounded border p-2 space-y-1.5"
              style={{ borderColor: 'var(--color-border)', opacity: row.removing ? 0.5 : 1 }}
            >
              <div className="flex items-center gap-2">
                <input
                  data-field="title"
                  className="flex-1 text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                  placeholder={text('秘密名（一句话：谁在捂什么）', 'Secret name (one line: who hides what)')}
                  value={row.title}
                  maxLength={SECRET_TEXT_MAX}
                  disabled={row.removing}
                  onChange={event => applyField(row.key, 'title', event.target.value)}
                />
                <input
                  data-field="revealChapter"
                  className="w-24 text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                  placeholder={text('揭穿章', 'Reveal ch.')}
                  value={row.revealChapter}
                  disabled={row.removing}
                  onChange={event => applyField(row.key, 'revealChapter', event.target.value)}
                />
                {row.confirmingRemove ? (
                  <>
                    <Button size="sm" variant="destructive" onClick={() => confirmRemove(row.key)}>
                      {text('确认删除', 'Confirm delete')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => undoRemove(row.key)}>
                      {text('取消', 'Cancel')}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => removeRow(row.key)} disabled={row.removing}>
                    <Trash2 className="w-3.5 h-3.5" />
                    {text('删除', 'Delete')}
                  </Button>
                )}
                {row.removing && (
                  <Button size="sm" variant="ghost" onClick={() => undoRemove(row.key)}>
                    <Undo2 className="w-3.5 h-3.5" />
                    {text('撤销', 'Undo')}
                  </Button>
                )}
              </div>

              <textarea
                data-field="detail"
                className="w-full text-xs px-2 py-1 rounded border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                rows={2}
                placeholder={text('真相本体（只给审稿用，不会进正文提示词）', 'The truth itself (review only; never sent to the draft prompt)')}
                value={row.detail}
                maxLength={SECRET_DETAIL_MAX}
                disabled={row.removing}
                onChange={event => applyField(row.key, 'detail', event.target.value)}
              />

              <div className="flex items-center gap-2">
                <input
                  data-field="holders"
                  className="flex-1 text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                  placeholder={text('隐瞒者（谁在捂，顿号分隔）', 'Hiders (comma separated)')}
                  value={row.holders}
                  disabled={row.removing}
                  onChange={event => applyField(row.key, 'holders', event.target.value)}
                />
                <input
                  data-field="unaware"
                  className="flex-1 text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                  placeholder={text('尚不知情（顿号分隔，可留空）', 'Unaware (comma separated, may be empty)')}
                  value={row.unaware}
                  disabled={row.removing}
                  onChange={event => applyField(row.key, 'unaware', event.target.value)}
                />
              </div>

              <input
                data-field="evidence"
                className="w-full text-xs px-2 py-1 rounded border"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                placeholder={text('出处（世界观第 3 维原文，可留空）', 'Evidence (worldbuilding dimension 3, optional)')}
                value={row.evidence}
                disabled={row.removing}
                onChange={event => applyField(row.key, 'evidence', event.target.value)}
              />

              {row.revealChapter.trim() === '' && !row.removing && (
                <p data-testid="secret-undecided" className="text-[10px] flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                  <AlertTriangle className="w-3 h-3" />
                  {text('揭穿章未定：任何一章都按「还没揭穿」处理（保守方向）', 'Reveal chapter undecided: every chapter is treated as not revealed yet (conservative)')}
                </p>
              )}
              {row.error && (
                <p role="alert" className="text-xs" style={{ color: 'var(--color-danger)' }}>{row.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
