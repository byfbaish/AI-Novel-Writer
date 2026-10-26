import { useCallback, useEffect, useState } from 'react'
import { EyeOff, Loader2, RotateCcw, ShieldOff } from 'lucide-react'

import { cn } from '../../lib/utils'
import type { ConsistencyExemption } from '../../shared/consistency-preflight'
import {
  activeExemptionKeys,
  secretChapterExemptionKey,
  secretExemptionKey,
  secretExemptionScope,
  secretGuardsChapter,
  secretPendingKnowledge,
  type SecretDefinition,
} from '../../shared/secret'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { Button } from '../ui/Button'

/**
 * 审稿报告里的「秘密守卫处置」块（P20-3 前置，2026-10-26 作者要求）。
 *
 * ## 它在解决什么
 *
 * 审稿员判「本章写出了某条秘密的真相」是对的，但有三种完全不同的情形，系统以前只说第一种：
 * 1. **真泄密** → 去改稿（这条不用本块）；
 * 2. **作者就是要在本章提前揭穿** → 本章放行，之后照旧（**临时豁免**）；
 * 3. **真相已经人尽皆知** → 这条秘密不再是秘密（**永久豁免**）。
 *
 * 没有 2/3，作者只能每章看着同一条问题重复出现 —— 最后学会无视整个守卫节。
 *
 * ## 两个动作都写 `consistency_exemptions`，不写 secrets 表
 *
 * 那张表的三列（稳定键 + 理由 + 可撤销）正好是豁免需要的全部，且已被两个闸门用着。
 * 键格式与语义在 `secret.ts`：`secret-exempt:<id>` / `secret-exempt:<id>#ch<N>`。
 *
 * **不改秘密本体**：`revealChapter` 是作者的创作计划，豁免是「这次别管」，两者不能互相顶替。
 *
 * ## 为什么不代写知情登记
 *
 * M16 的引用键是 `sha256(章号 + 定稿逐字引文)`，`refState` 只认落在该章 current 投影里的键。
 * 审稿发生在**定稿之前**，此刻写进去的行当场 `unverifiable`，定稿后大概率 `stale`（永不注入）。
 * 所以这里只把「欠谁一条知情」摆出来，登记留到定稿后由作者选事实完成。
 */
export function SecretGuardDisposition({
  projectKey,
  chapterNumber,
}: {
  projectKey: string
  chapterNumber?: number
}) {
  const text = useLocaleStore(state => state.text)
  const [secrets, setSecrets] = useState<SecretDefinition[]>([])
  const [exemptions, setExemptions] = useState<ConsistencyExemption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')

  const usable = Number.isSafeInteger(chapterNumber) && (chapterNumber ?? 0) > 0

  const load = useCallback(async () => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      setSecrets([])
      setExemptions([])
      setLoaded(false)
      return
    }
    /**
     * **fail-open**：读失败就当「没有可处置的秘密」，整块不出现。
     *
     * 这是审稿报告里的一块附注，不是审稿本身 —— 它读不到不该让整份报告崩掉，
     * 也不该在控制台留一串未处理拒绝。反向的代价是作者看不到豁免入口，
     * 但秘密页仍然是完整可用的，所以不会丢功能。
     */
    try {
      const [listed, exemptionRows] = await Promise.all([
        ipc.invokeWithProjectSession(projectSession, 'db:secrets-list', projectSession.projectPath),
        ipc.invokeWithProjectSession(projectSession, 'db:consistency-exemption-list', projectSession.projectPath),
      ])
      if (!isProjectSessionCurrent(projectSession)) return
      setSecrets(listed.success ? (listed.entries ?? []) : [])
      setExemptions(Array.isArray(exemptionRows) ? exemptionRows : [])
      setLoaded(true)
    } catch {
      if (!isProjectSessionCurrent(projectSession)) return
      setSecrets([])
      setExemptions([])
      setLoaded(false)
    }
  }, [projectKey])

  useEffect(() => {
    if (!usable) return
    // 挂载即读；不轮询 —— 保存动作自己会重读。
    queueMicrotask(() => void load())
  }, [load, usable])

  const write = async (key: string, reason: string) => {
    if (busyKey) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    setBusyKey(key)
    setError('')
    let result: { success?: boolean; error?: string } | undefined
    try {
      result = await ipc.invokeWithProjectSession(
        projectSession, 'db:consistency-exemption-save', key, reason, projectSession.projectPath,
      )
    } catch {
      result = undefined
    }
    setBusyKey('')
    if (!isProjectSessionCurrent(projectSession)) return
    if (!result?.success) {
      setError(text(`没能记下这次豁免（${result?.error ?? '未知原因'}）`, `Could not record this waiver (${result?.error ?? 'unknown'})`))
      return
    }
    await load()
  }

  const revoke = async (key: string) => {
    if (busyKey) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) return
    setBusyKey(key)
    setError('')
    let result: { success?: boolean; error?: string } | undefined
    try {
      result = await ipc.invokeWithProjectSession(
        projectSession, 'db:consistency-exemption-revoke', key, projectSession.projectPath,
      )
    } catch {
      result = undefined
    }
    setBusyKey('')
    if (!isProjectSessionCurrent(projectSession)) return
    if (!result?.success) {
      setError(text(`没能撤销（${result?.error ?? '未知原因'}）`, `Could not revoke (${result?.error ?? 'unknown'})`))
      return
    }
    await load()
  }

  if (!usable) return null
  const chapter = chapterNumber as number
  // 已揭穿的秘密不在这里出现：期界先于豁免，两件事混在一处会让作者以为「豁免」把他从「已揭穿」里捞出来了。
  const guardable = secrets.filter(entry => secretGuardsChapter(entry, chapter))
  // 没有可守卫的秘密 ⇒ 整块不出现（不给每份审稿报告都加一段噪音）。
  if (!loaded || guardable.length === 0) return null
  const keys = activeExemptionKeys(exemptions)

  return (
    <section
      data-testid="secret-guard-disposition"
      className="mb-4 rounded-lg border p-3 text-xs space-y-2"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
    >
      <div className="flex items-center gap-1.5 font-medium text-[var(--color-text)]">
        <EyeOff size={13} />
        {text(`秘密守卫处置（第 ${chapter} 章）`, `Secret guard disposition (Chapter ${chapter})`)}
      </div>
      <p style={{ color: 'var(--color-text-muted)' }}>
        {text(
          '审稿若判「本章写出了真相」：确实写错了就去改稿；本章故意提前揭穿选“临时豁免”（只免这一章）；真相已经人尽皆知选“永久豁免”。',
          'If review says this chapter states a truth: fix the draft when it is a real leak; choose "waive this chapter" when the reveal is deliberate here; choose "permanent waiver" once the truth is common knowledge.',
        )}
      </p>

      <div className="space-y-1.5">
        {guardable.map(entry => {
          const scope = secretExemptionScope(entry, chapter, keys)
          const permanentKey = secretExemptionKey(entry.secretId)
          const chapterKey = secretChapterExemptionKey(entry.secretId, chapter)
          const pending = secretPendingKnowledge(entry)
          return (
            <div
              key={entry.secretId}
              data-testid="secret-guard-row"
              data-scope={scope}
              className="rounded border px-2 py-1.5 space-y-1"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[var(--color-text)]">{entry.title}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {entry.revealChapter === null
                    ? text('揭穿章未定', 'reveal chapter undecided')
                    : text(`计划揭穿：第 ${entry.revealChapter} 章`, `planned reveal: Chapter ${entry.revealChapter}`)}
                </span>
                <span
                  data-testid="secret-guard-scope"
                  className={cn(
                    'px-1.5 py-0.5 rounded',
                    scope === 'none' ? 'text-[var(--color-text-muted)]' : 'bg-yellow-500/20 text-[var(--color-warning-text)]',
                  )}
                >
                  {scope === 'permanent'
                    ? text('已永久豁免', 'permanently waived')
                    : scope === 'chapter'
                      ? text('已临时豁免（本章）', 'waived for this chapter')
                      : text('照常守卫', 'guarded')}
                </span>

                <span className="ml-auto flex items-center gap-1">
                  {scope === 'none' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="secret-waive-chapter"
                        disabled={busyKey !== ''}
                        onClick={() => void write(chapterKey, text(
                          `临时豁免：第 ${chapter} 章提前揭穿`, `Temporary waiver: deliberate reveal in Chapter ${chapter}`,
                        ))}
                      >
                        {busyKey === chapterKey ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {text('临时豁免本章', 'Waive this chapter')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid="secret-waive-permanent"
                        disabled={busyKey !== ''}
                        onClick={() => void write(permanentKey, text(
                          '永久豁免：真相人尽皆知', 'Permanent waiver: the truth is common knowledge',
                        ))}
                      >
                        {busyKey === permanentKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                        {text('永久豁免', 'Waive permanently')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid="secret-waive-revoke"
                      disabled={busyKey !== ''}
                      onClick={() => void revoke(scope === 'permanent' ? permanentKey : chapterKey)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      {text('撤销豁免', 'Revoke waiver')}
                    </Button>
                  )}
                </span>
              </div>

              {scope !== 'none' && (
                <p data-testid="secret-waive-pending" style={{ color: 'var(--color-text-muted)' }}>
                  {pending.names.length > 0
                    ? text(
                      `欠一条知情登记：${pending.names.join('、')} 从第 ${chapter} 章起知道。定稿后到知情页登记（现在写会立刻失效：引用键要落在该章定稿的连续性投影里）。`,
                      `One knowledge entry is owed: ${pending.names.join(', ')} learn it in Chapter ${chapter}. Register it after finalization (writing it now would immediately go stale: the reference key must exist in that chapter's finalized continuity projection).`,
                    )
                    : text(
                      `欠一条知情登记：本章谁知道了这件事还没登记。定稿后到知情页补（现在写会立刻失效）。`,
                      'One knowledge entry is owed: who learned this in this chapter is not registered yet. Add it after finalization (writing it now would go stale).',
                    )}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
    </section>
  )
}
