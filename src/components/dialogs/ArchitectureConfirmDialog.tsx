import { useCallback, useEffect, useRef, useState } from 'react'
import { Wand2, AlertCircle, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useProjectStore } from '../../stores/project-store'
import { guardArchitectureGeneration, guardCharacterRegeneration } from '../../services/workflow-guards'
import { createDefaultArchitectureSelection } from '../../services/architecture-step-selection'
import { toast } from '../ui/Toast'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Textarea'
import { useLocaleStore } from '../../stores/locale-store'
import { AUDIENCE_EN, GENRE_EN } from '../editor/novel-config-labels'
import { ipc } from '../../services/ipc-client'
import { resolveWritingLanguage } from '../../shared/writing-language'
import { assertPlanningActionRange, DEFAULT_PLANNING_ACTION_CHAPTERS, DEFAULT_PLANNING_TARGET_UNITS, parsePlanningTargetUnits, PLANNING_ACTION_CHAPTER_LIMIT, PLANNING_TARGET_UNITS_LIMIT } from '../../shared/plot-outline-contract'
import { captureProjectSession } from '../project-session-gate'
import {
  describeSynopsisUnitProbe,
  probeSynopsisUnitLaunchForProject,
  synopsisUnitLaunchEnabled,
  type SynopsisUnitProbeResult,
} from '../../services/workflows/synopsis-unit-launch'

type ArchStepKey = 'premise' | 'characters' | 'worldbuilding' | 'plotStructure' | 'synopsis'

const ARCH_FILES: Array<{
  key: ArchStepKey
  fileName: string
  label: string
  labelEn: string
  iconName: string
  desc: string
  descEn: string
}> = [
  { key: 'premise', fileName: 'premise.md', label: '故事前提', labelEn: 'Premise', iconName: 'target', desc: 'Logline、核心冲突、金手指定位', descEn: 'Logline, core conflict, and protagonist advantage' },
  { key: 'characters', fileName: 'characters.md', label: '角色图谱', labelEn: 'Characters', iconName: 'users', desc: '角色弧光、关系网、矛盾交织', descEn: 'Character arcs, relationships, and conflicts' },
  { key: 'worldbuilding', fileName: 'worldbuilding.md', label: '世界观', labelEn: 'World building', iconName: 'globe', desc: '核心规则、阶层断层、深层危机、空间结构', descEn: 'Core rules, social fault lines, hidden crises, and spatial structure' },
  { key: 'plotStructure', fileName: 'plot_structure.md', label: '卷 / 单元结构', labelEn: 'Volumes and units', iconName: 'compass', desc: '按卷与单元切段，交代处境、阻力与代价', descEn: 'Volume and unit breakdown: states, pressure, and permanent costs' },
  { key: 'synopsis', fileName: 'synopsis.md', label: '情节大纲', labelEn: 'Synopsis', iconName: 'map', desc: '按所选故事结构展开的章节级大纲', descEn: 'Chapter-level outline following the selected structure' },
]

const ARCH_STEP_COUNT = ARCH_FILES.length

/**
 * 章号步进器。
 *
 * 设计意图（作者 2026-10-11）：原生 number 输入自带的上下箭头只能 ±1，且要悬停才出现；
 * 分批生成时最常用的动作却是"再挪一点"——所以做成**常显的 ±1 / ±5 四键**。
 * 语义：起点上的步进 = 平移整批；终点上的步进 = 增删本批章数（上限由 PLANNING_ACTION_CHAPTER_LIMIT 约束）。
 */
function ChapterStepper({
  onStep, disabled, label,
}: {
  onStep: (delta: number) => void
  disabled: boolean
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label={label}>
      {[-5, -1, 1, 5].map(delta => (
        <button
          key={delta}
          type="button"
          disabled={disabled}
          onClick={() => onStep(delta)}
          aria-label={label + (delta > 0 ? ' +' : ' ') + delta}
          title={delta > 0 ? `加 ${delta} 章` : `减 ${-delta} 章`}
          className="h-6 min-w-[1.5rem] rounded border text-[0.68rem] tabular-nums outline-none transition-colors disabled:opacity-40 hover:bg-[var(--color-hover)]"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          {delta > 0 ? `+${delta}` : delta}
        </button>
      ))}
    </span>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
  /** 各架构文件的生成状态 */
  archStatus: Record<string, boolean>
  /** 预先选中的步骤（单文件生成时传入） */
  initialSelectedSteps?: ArchStepKey[]
  /** 打开时预填的情节大纲续批范围（从已确认的下一章开始；to 可在弹窗内调整）。 */
  initialSynopsisRange?: { from: number; to: number } | null
  /** 当前大纲已覆盖到第几章（0 表示还没有章级条目）。用于「续写」勾选项。 */
  synopsisCoveredTo?: number
  onConfirm: (
    selectedSteps: ArchStepKey[],
    stepGuidance: Record<string, string>,
    synopsisRange?: { from: number; to: number },
    targetUnits?: number,
    /** 单元模式下「连写几个单元」（E3 T12）；缺省 1 = 一次一个单元。 */
    synopsisUnitTotal?: number,
  ) => Promise<void>
}

/** 生成架构确认弹框（含步骤勾选） */
export default function ArchitectureConfirmDialog({
  isOpen, onClose, archStatus, initialSelectedSteps, initialSynopsisRange = null, synopsisCoveredTo = 0, onConfirm,
}: Props) {
  const currentProject = useProjectStore(s => s.currentProject)
  const text = useLocaleStore(s => s.text)
  const locale = useLocaleStore(s => s.locale)

  // 默认：未生成的全部勾选；或使用 initialSelectedSteps 覆盖
  const [checked, setChecked] = useState<Record<ArchStepKey, boolean>>(() => {
    return createDefaultArchitectureSelection(archStatus, initialSelectedSteps)
  })
  const wasOpen = useRef(false)

  // 每步的补充指导
  const [stepGuidance, setStepGuidance] = useState<Record<string, string>>({})
  // 是否展开指导输入区
  const [showGuidance, setShowGuidance] = useState(false)
  const [synopsisFrom, setSynopsisFrom] = useState('')
  const [synopsisTo, setSynopsisTo] = useState('')
  /** 「续写」：从已覆盖章节的下一章开始，默认推进 PLANNING_ACTION_CHAPTER_LIMIT 章。 */
  const [synopsisContinue, setSynopsisContinue] = useState(false)
  const [targetUnits, setTargetUnits] = useState(String(DEFAULT_PLANNING_TARGET_UNITS))
  /** E3 T12：单元模式下「连写几个单元」（1 = 一次一个，行为与改造前一致）。 */
  const [unitChainTotal, setUnitChainTotal] = useState('1')
  const [preferenceLoading, setPreferenceLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [guardError, setGuardError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let disposed = false
    void ipc.invoke('config:get').then(config => {
      if (!disposed) setTargetUnits(String(parsePlanningTargetUnits(config.outlineTargetUnits)))
    }).catch(error => {
      if (!disposed) setGuardError(error instanceof Error ? error.message : String(error))
    }).finally(() => { if (!disposed) setPreferenceLoading(false) })
    return () => { disposed = true; setPreferenceLoading(true) }
  }, [isOpen])

  // 每次弹窗打开时重置选中状态；续批入口会预填起止章并勾选情节大纲
  const resetChecked = useCallback(() => {
    const defaults = createDefaultArchitectureSelection(archStatus, initialSelectedSteps)
    setSynopsisContinue(false)
    // 连写个数每次都回到 1：它是「这一次要多跑几批」的选择，不该记成默认值。
    setUnitChainTotal('1')
    if (initialSynopsisRange) {
      defaults.synopsis = true
      setSynopsisFrom(String(initialSynopsisRange.from))
      setSynopsisTo(String(Math.min(initialSynopsisRange.to, initialSynopsisRange.from + PLANNING_ACTION_CHAPTER_LIMIT - 1)))
    } else {
      const total = Number(currentProject?.novelConfig.totalChapters) || 0
      setSynopsisFrom('1')
      setSynopsisTo(String(Math.min(total, DEFAULT_PLANNING_ACTION_CHAPTERS)))
    }
    setChecked(defaults)
  }, [archStatus, currentProject?.novelConfig.totalChapters, initialSelectedSteps, initialSynopsisRange])

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      resetChecked()
    }
    wasOpen.current = isOpen
  }, [isOpen, resetChecked])

  /**
   * E3 探针（T10）：打开弹窗就先探一次「这次点下去会不会按单元写」。
   * 弹窗里必须**如实显示**——否则界面上还留着章号区间，作者会以为按章跑（2026-10-20 现场踩过）。
   * 这里只是展示；真正的判定仍在确认时（父组件）与命令侧 `approveUnitContext`。
   */
  const [unitPreview, setUnitPreview] = useState<SynopsisUnitProbeResult | null>(null)
  const totalChapterCount = Number(currentProject?.novelConfig.totalChapters) || 0
  useEffect(() => {
    if (!isOpen || !import.meta.env.DEV || !synopsisUnitLaunchEnabled()) {
      setUnitPreview(null)
      return
    }
    const session = captureProjectSession(currentProject)
    if (!session) {
      setUnitPreview(null)
      return
    }
    let disposed = false
    // 先清空：弹窗重开时不能先闪一下上一轮的单元信息
    setUnitPreview(null)
    void probeSynopsisUnitLaunchForProject({ projectSession: session, totalChapters: totalChapterCount })
      .then(result => { if (!disposed) setUnitPreview(result) })
      .catch(() => { if (!disposed) setUnitPreview(null) })
    return () => { disposed = true }
  }, [isOpen, currentProject, totalChapterCount])
  /** 本次走单元模式时，章号区间与「续写」都不再参与生成。 */
  const unitMode = unitPreview?.unit ?? null
  /** 连写的硬上限 = 本卷还剩几个单元（v1 不跨卷）。读不到卷结构就只让写 1 个。 */
  const unitChainCapacity = Math.max(1, unitPreview?.volume?.remainingUnits ?? 1)
  /** 真正会发出去的个数：走单元模式且选了多个才算数。 */
  const requestedUnitChain = Math.min(
    unitChainCapacity,
    Math.max(1, Math.floor(Number(unitChainTotal) || 1)),
  )

  if (!currentProject) return null
  const config = currentProject.novelConfig
  const genre = [text(config.genre, GENRE_EN[config.genre] ?? config.genre), config.subGenre]
    .filter(Boolean)
    .join(' · ')
  const audience = text(config.targetAudience, AUDIENCE_EN[config.targetAudience] ?? config.targetAudience)

  const toggleStep = (key: ArchStepKey) =>
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))

  const selectedSteps = (Object.keys(checked) as ArchStepKey[]).filter(k => checked[k])
  const noneSelected = selectedSteps.length === 0

  const totalChapters = Number(config.totalChapters) > 0 ? Number(config.totalChapters) : 0
  // 「续写」：起点 = 已覆盖章 + 1，默认推进 PLANNING_ACTION_CHAPTER_LIMIT 章。
  // 只读不写：这里不改 synopsisFrom/To，取消勾选即回到手填值，行为可预期。
  const coveredTo = Number.isSafeInteger(synopsisCoveredTo) && synopsisCoveredTo > 0 ? synopsisCoveredTo : 0
  const continueStart = coveredTo + 1
  const canContinue = coveredTo > 0 && totalChapters > 0 && continueStart <= totalChapters
  const continueTo = canContinue ? Math.min(continueStart + PLANNING_ACTION_CHAPTER_LIMIT - 1, totalChapters) : 0
  const continuing = synopsisContinue && canContinue
  const effectiveSynopsisFrom = continuing ? String(continueStart) : synopsisFrom
  const effectiveSynopsisTo = continuing ? String(continueTo) : synopsisTo
  const synopsisLength = (() => {
    const start = Number(effectiveSynopsisFrom)
    const end = Number(effectiveSynopsisTo)
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && end >= start ? end - start + 1 : 0
  })()
  /** 起点步进 = 平移整批；起点越过终点时把终点一起推走（始终至少一章）。 */
  const stepSynopsisFrom = (delta: number) => {
    const current = Number(effectiveSynopsisFrom) || 1
    const upper = Math.max(1, totalChapters)
    const nextFrom = Math.min(Math.max(current + delta, 1), upper)
    const currentTo = Number(effectiveSynopsisTo) || nextFrom
    setSynopsisFrom(String(nextFrom))
    if (nextFrom > currentTo) setSynopsisTo(String(Math.min(nextFrom, upper)))
  }
  /** 终点步进 = 增删本批章数；上限受 PLANNING_ACTION_CHAPTER_LIMIT 约束，步进不会越界。 */
  const stepSynopsisTo = (delta: number) => {
    const start = Number(effectiveSynopsisFrom) || 1
    const current = Number(effectiveSynopsisTo) || start
    const maxTo = Math.min(totalChapters, start + PLANNING_ACTION_CHAPTER_LIMIT - 1)
    setSynopsisTo(String(Math.min(Math.max(current + delta, start), maxTo)))
  }
  const resolveSynopsisRange = (): { ok: true; range?: { from: number; to: number } } | { ok: false } => {
    if (!checked.synopsis) return { ok: true }
    const range = { from: Number(effectiveSynopsisFrom), to: Number(effectiveSynopsisTo) }
    try { assertPlanningActionRange(range) } catch { return { ok: false } }
    return range.to <= totalChapters ? { ok: true, range } : { ok: false }
  }

  const handleConfirm = async () => {
    if (noneSelected) return
    setIsConfirming(true)
    try {
      // 前置校验 1：小说配置是否填写
      const configGuard = guardArchitectureGeneration()
      if (!configGuard.ok) {
        setGuardError(configGuard.message || text('配置校验失败', 'Configuration validation failed.'))
        return
      }

      // 范围合法性（超出总章数或起大于止）
      // 单元模式下章号区间不参与生成，但仍要给出一个**合理的兜底区间**：
      // 万一确认时的探针退回按章（状态在弹窗期间变了），用的会是「从本单元起点连推一批」，
      // 而不是输入框里那个可能过期的手填值。
      const unitFallbackRange = unitMode
        ? { from: unitMode.from, to: Math.min(totalChapters, unitMode.from + PLANNING_ACTION_CHAPTER_LIMIT - 1) }
        : null
      const resolution = unitFallbackRange
        ? { ok: true as const, range: unitFallbackRange }
        : resolveSynopsisRange()
      if (!resolution.ok) {
        setGuardError(text(
          `情节大纲范围无效。请选择第 1–${totalChapters} 章内连续的 1–${PLANNING_ACTION_CHAPTER_LIMIT} 章。`,
          `Invalid plot-outline range. Select 1-${PLANNING_ACTION_CHAPTER_LIMIT} consecutive chapters within chapters 1-${totalChapters}.`,
        ))
        return
      }

      // 前置校验 2：如果勾选了角色图谱（意味着将重新生成角色卡），则必须确保蓝图为空
      if (selectedSteps.includes('characters') && archStatus.characters) {
        const charGuard = await guardCharacterRegeneration(undefined, locale)
        if (!charGuard.ok) {
          setGuardError(charGuard.message || text('角色卡不可重新生成', 'Character cards cannot be regenerated.'))
          return
        }
      }

      setGuardError(null)
      let target: number | undefined
      if (checked.synopsis) {
        try { target = parsePlanningTargetUnits(Number(targetUnits)) } catch {
          setGuardError(text(`每章大纲目标须为 1–${PLANNING_TARGET_UNITS_LIMIT} 的整数。`, `The outline target must be an integer from 1 to ${PLANNING_TARGET_UNITS_LIMIT}.`))
          return
        }
        try {
          const saved = await ipc.invoke('config:set', { outlineTargetUnits: target })
          if (!saved.success) throw new Error(saved.error)
        } catch {
          setGuardError(text('目标字数偏好保存失败。请重试，输入已保留。', 'Could not save the target preference. Your input is retained. Please retry.'))
          return
        }
      }
      await onConfirm(selectedSteps, stepGuidance, resolution.range, target, unitMode ? requestedUnitChain : undefined)
      onClose()
      const stepNames = selectedSteps.map(k => {
        const item = ARCH_FILES.find(f => f.key === k)
        return item ? text(item.label, item.labelEn) : ''
      }).filter(Boolean).join(text('、', ', '))
      toast.info(text(`已提交：正在生成${stepNames}...`, `Submitted: generating ${stepNames}...`))
    } catch (error) {
      setGuardError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsConfirming(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    } else {
      resetChecked()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={16} className="text-[var(--color-accent)]" />
            {text('AI 生成故事架构', 'Generate story architecture with AI')}
          </DialogTitle>
          <DialogDescription>
            {text('勾选要生成的步骤，未勾选的步骤将保留已有内容', 'Select the sections to generate. Unselected sections keep their existing content.')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 space-y-4">
          {/* 配置预览 */}
          <div
            className="rounded-lg p-3 space-y-1.5 text-xs"
            style={{ backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-border)' }}
          >
            <p className="font-medium text-[0.7rem] mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {text('当前配置预览', 'Current configuration')}
            </p>
            <div className="grid grid-cols-2 gap-1">
              <ConfigRow label={text('类型', 'Genre')} value={genre} />
              <ConfigRow label={text('受众', 'Audience')} value={audience} />
              <ConfigRow label={text('总章数', 'Chapters')} value={text(`${config.totalChapters} 章`, `${config.totalChapters}`)} />
              <ConfigRow label={text('每章字数', 'Words/chapter')} value={text(`${config.wordsPerChapter} 字`, `${config.wordsPerChapter} words`)} />
            </div>
            {config.coreOutline && (
              <p
                className="mt-1.5 pt-1.5 text-xs"
                style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                {config.coreOutline.slice(0, 80)}{config.coreOutline.length > 80 ? '...' : ''}
              </p>
            )}
          </div>

          {/* 步骤勾选列表 */}
          <div
            className="rounded-lg p-3 space-y-2.5"
            style={{ backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {text('勾选要生成的步骤', 'Sections to generate')}
              </p>
              <button
                onClick={() => setChecked({ premise: true, characters: true, worldbuilding: true, plotStructure: true, synopsis: true })}
                className="text-xs underline"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {text('全选', 'Select all')}
              </button>
            </div>

            {ARCH_FILES.map(f => {
              const exists = archStatus[f.key]
              const isChecked = checked[f.key]
              return (
                <label
                  key={f.key}
                  className="flex items-center gap-2.5 cursor-pointer select-none"
                  onClick={() => toggleStep(f.key)}
                >
                  {/* 复选框 */}
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      backgroundColor: isChecked ? 'var(--color-accent)' : 'transparent',
                      border: `1.5px solid ${isChecked ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    {isChecked && (
                      <Check size={10} strokeWidth={2} />
                    )}
                  </div>

                  {/* 步骤名 */}
                  <span className="text-xs flex-1" style={{ color: isChecked ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {text(f.label, f.labelEn)}
                    <span className="ml-1 text-[0.7rem]" style={{ color: 'var(--color-text-muted)' }}>
                      — {text(f.desc, f.descEn)}
                    </span>
                  </span>

                  {/* 状态标签 */}
                  <span
                    className={`text-[0.7rem] px-1.5 py-0.5 rounded flex-shrink-0 ${
                      exists
                        ? isChecked
                          ? 'bg-yellow-500/15 text-[var(--color-warning-text)]'
                          : 'bg-green-500/10 text-[var(--color-success-text)]'
                        : 'bg-[rgba(var(--color-accent-rgb),0.1)] text-[var(--color-accent)]'
                    }`}
                  >
                    {exists ? (isChecked ? text('将覆盖', 'Overwrite') : text('保留', 'Keep')) : text('待生成', 'New')}
                  </span>
                </label>
              )
            })}
          </div>

          {checked.synopsis && totalChapters > 0 && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ backgroundColor: 'var(--color-panel)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-warning-text)' }}>
                  <AlertTriangle size={13} />
                  {text('情节大纲 · 本次生成范围', 'Plot outline · batch scope')}
                </div>
                {coveredTo > 0 && !unitMode && (
                  <label
                    className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                    title={canContinue
                      ? text(`从已覆盖的下一章（第 ${continueStart} 章）开始，默认推进 ${PLANNING_ACTION_CHAPTER_LIMIT} 章`, `Start from the next uncovered chapter (chapter ${continueStart}), advancing ${PLANNING_ACTION_CHAPTER_LIMIT} chapters by default`)
                      : text('全书章节已全部覆盖', 'Every chapter is already covered')}
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={synopsisContinue}
                      disabled={!canContinue}
                      onChange={event => setSynopsisContinue(event.target.checked)}
                      aria-label={text('续写：从已覆盖章节之后开始', 'Continue: start after the covered chapters')}
                    />
                    {text('续写', 'Continue')}
                  </label>
                )}
              </div>
              <p
                role="note"
                className="text-xs leading-relaxed m-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                  {text(`全书共 ${totalChapters} 章，每次最多生成 ${PLANNING_ACTION_CHAPTER_LIMIT} 章。完成后可继续下一批。`, `The book has ${totalChapters} chapters. Generate up to ${PLANNING_ACTION_CHAPTER_LIMIT} chapters per action, then continue with the next batch.`)}
                </p>
                {coveredTo > 0 && !unitMode && (
                  <p role="status" className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>
                    {canContinue
                      ? continuing
                        ? text(
                            `续写：第 ${continueStart}–${continueTo} 章（已覆盖至第 ${coveredTo} 章）。要改用其它范围，请取消勾选后手填。`,
                            `Continuing: chapters ${continueStart}–${continueTo} (covered through ${coveredTo}). Uncheck to enter another range manually.`,
                          )
                        : text(
                            `已覆盖至第 ${coveredTo} 章。勾选「续写」将从第 ${continueStart} 章开始，默认推进 ${PLANNING_ACTION_CHAPTER_LIMIT} 章。`,
                            `Covered through chapter ${coveredTo}. Checking “Continue” starts at chapter ${continueStart} and advances ${PLANNING_ACTION_CHAPTER_LIMIT} chapters by default.`,
                          )
                      : text(`已覆盖至第 ${coveredTo} 章，全书章节均已覆盖。`, `Covered through chapter ${coveredTo}; every chapter is covered.`)}
                  </p>
                )}
                {unitPreview && !unitMode && (
                  <p role="status" className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>
                    {text(
                      `未按单元生成：${describeSynopsisUnitProbe(unitPreview)}`,
                      `Not generating by unit (reason: ${unitPreview.reason}).`,
                    )}
                  </p>
                )}
                {unitMode ? (
                  <div className="space-y-1.5">
                    <div
                      role="status"
                      className="rounded-md p-2 space-y-1 text-xs"
                      style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-accent)' }}
                    >
                      <p className="m-0 font-medium" style={{ color: 'var(--color-text)' }}>
                        {text(
                          // 卷号必须露出来：只写「第 k 个单元」时，作者没法分辨自己在卷一还是卷二
                          //（2026-10-20 实机就把它读成了「第二卷开始」）。
                          `单元模式：第 ${unitPreview?.volume?.index ?? 1} 卷 · 第 ${unitMode.unitIndex} 个单元`
                            + (unitPreview?.volume ? `（本卷共 ${unitPreview.volume.unitCount} 个）` : '')
                            + `，从第 ${unitMode.from} 章起`,
                          `Unit mode: volume ${unitPreview?.volume?.index ?? 1}, unit ${unitMode.unitIndex}`
                            + (unitPreview?.volume ? ` of ${unitPreview.volume.unitCount}` : '')
                            + `, starting at chapter ${unitMode.from}`,
                        )}
                      </p>
                      <p className="m-0" style={{ color: 'var(--color-text-secondary)' }}>
                        {text(
                          `本卷剩余 ${unitMode.volumeRemaining} 章，名义上界 ${unitMode.maxChapters} 章。篇幅由剧情决定，写完按实际章数落盘。`,
                          `${unitMode.volumeRemaining} chapters left in this volume, nominal cap ${unitMode.maxChapters}. The unit ends when the plot ends and the actual count is recorded afterwards.`,
                        )}
                      </p>
                      <p className="m-0" style={{ color: 'var(--color-text-muted)' }}>
                        {text(
                          '章号区间与「续写」在此模式下不生效；要按章生成请关掉 localStorage 开关。',
                          'The chapter range and “Continue” do not apply in unit mode.',
                        )}
                      </p>
                    </div>
                    {/* E3 T12：连写个数。上限就是本卷剩余单元数 —— v1 不跨卷。 */}
                    {unitChainCapacity > 1 && (
                      <label className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>{text('连写', 'Write')}</span>
                        <select
                          value={String(requestedUnitChain)}
                          disabled={continuing}
                          onChange={e => setUnitChainTotal(e.target.value)}
                          aria-label={text('连续生成几个单元', 'How many units to generate in a row')}
                          className="rounded-md px-2 py-1 text-xs outline-none transition-colors disabled:opacity-60"
                          style={{
                            color: 'var(--color-text)',
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {Array.from({ length: unitChainCapacity }, (_, index) => index + 1).map(count => (
                            <option key={count} value={String(count)}>{String(count)}</option>
                          ))}
                        </select>
                        <span>
                          {text(
                            `个单元（本卷还剩 ${unitChainCapacity} 个，连写只到本卷末）`,
                            `unit(s) — ${unitChainCapacity} left in this volume; chaining stops at the volume end`,
                          )}
                        </span>
                      </label>
                    )}
                  </div>
                ) : (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span style={{ color: 'var(--color-text-muted)' }}>{text('第', 'From ch.')}</span>
                  <input
                    type="number"
                    min={1}
                    max={totalChapters}
                    value={effectiveSynopsisFrom}
                    disabled={continuing}
                    onChange={e => setSynopsisFrom(e.target.value)}
                    placeholder="1"
                    aria-label={text('本次生成范围的起始章', 'First chapter of this batch')}
                    className="w-16 rounded-md px-2 py-1.5 text-xs outline-none transition-colors disabled:opacity-60"
                    style={{
                      color: 'var(--color-text)',
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <ChapterStepper onStep={stepSynopsisFrom} disabled={continuing} label={text('起始章微调', 'Adjust first chapter')} />
                  <span style={{ color: 'var(--color-text-muted)' }}>{text('章 到第', 'to ch.')}</span>
                  <input
                    type="number"
                    min={1}
                    max={totalChapters}
                    value={effectiveSynopsisTo}
                    disabled={continuing}
                    onChange={e => setSynopsisTo(e.target.value)}
                    placeholder={String(totalChapters)}
                    aria-label={text('本次生成范围的结束章', 'Last chapter of this batch')}
                    className="w-16 rounded-md px-2 py-1.5 text-xs outline-none transition-colors disabled:opacity-60"
                    style={{
                      color: 'var(--color-text)',
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                  <ChapterStepper onStep={stepSynopsisTo} disabled={continuing} label={text('结束章微调', 'Adjust last chapter')} />
                  <span className="text-xs" style={{ color: synopsisLength > PLANNING_ACTION_CHAPTER_LIMIT ? 'var(--color-error-text)' : 'var(--color-text-muted)' }}>
                    {synopsisLength > 0
                      ? text(`章（本批 ${synopsisLength} 章）`, `chapter(s) · ${synopsisLength} in this batch`)
                      : text('章', 'chapter')}
                  </span>
                </div>
                )}
                <label className="block text-xs">
                  {resolveWritingLanguage(config.writingLanguage) === 'zh-CN'
                    ? text('每章大纲目标字数', 'Outline target characters per chapter')
                    : text('每章大纲目标词数', 'Outline target words per chapter')}
                  <input
                    type="number" min={1} max={PLANNING_TARGET_UNITS_LIMIT} step={1}
                    value={targetUnits} disabled={preferenceLoading}
                    onChange={event => setTargetUnits(event.target.value)}
                    className="ml-2 w-20 rounded-md border px-2 py-1.5 bg-[var(--color-bg)]"
                  />
                </label>
                <p className="text-xs text-[var(--color-text-muted)]">{text('仅作生成目标，实际内容可多可少。', 'A generation target. Actual content may be longer or shorter.')}</p>
            </div>
          )}

          {/* 逐步指导区域（可折叠） */}
          {selectedSteps.length > 0 && (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--color-border)' }}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-panel)' }}
                onClick={() => setShowGuidance(!showGuidance)}
              >
                {showGuidance ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {text('为每个步骤添加补充指导（可选）', 'Add guidance for each section (optional)')}
              </button>
              {showGuidance && (
                <div className="px-3 pb-3 space-y-3" style={{ backgroundColor: 'var(--color-panel)' }}>
                  {ARCH_FILES.filter(f => checked[f.key]).map(f => (
                    <div key={f.key}>
                      <label className="text-[0.7rem] font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                        {text(f.label, f.labelEn)}
                      </label>
                      <Textarea
                        value={stepGuidance[f.key] || ''}
                        onChange={e => setStepGuidance(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={text(`对「${f.label}」生成的特殊要求，如：“多强调金手指的限制”`, `Special requirements for “${f.labelEn}”, such as limitations on the protagonist advantage`)}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {noneSelected && (
            <p className="text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[var(--color-error-text)]">
              <AlertTriangle size={13} className="inline mr-1" />
              {text('请至少勾选一个步骤', 'Select at least one section.')}
            </p>
          )}
          {/* 前置校验失败提示 */}
          {guardError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs bg-yellow-500/10 border border-yellow-500/30 text-[var(--color-warning-text)]">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-[var(--color-warning)]" />
              <span className="whitespace-pre-line">{guardError}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isConfirming}>{text('取消', 'Cancel')}</Button>
          <Button variant="default" onClick={handleConfirm} disabled={noneSelected || isConfirming || (checked.synopsis && preferenceLoading)}>
            <Wand2 size={13} />
            {isConfirming ? text('校验中...', 'Validating...') : text(`确认生成（${selectedSteps.length}/${ARCH_STEP_COUNT}）`, `Generate (${selectedSteps.length}/${ARCH_STEP_COUNT})`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  const text = useLocaleStore(s => s.text)
  return (
    <div className="flex items-center gap-1 text-xs">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}：</span>
      <span style={{ color: 'var(--color-text)' }}>{value || text('未填写', 'Not set')}</span>
    </div>
  )
}
