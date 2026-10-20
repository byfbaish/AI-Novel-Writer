import { LegacyRosterRecoveryPanel } from './LegacyRosterRecoveryPanel'
import { resourceWriteAllowed } from '../../shared/project-paths'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Save, RefreshCw, Sparkles, Loader2, AlertTriangle, FileText, ListTree, X } from 'lucide-react'
import { renderIcon } from '../panels/sidebar/sidebar-icons'

import { registerEditorExitSaveHandler, useEditorStore, type PlanningRecoverySaveSnapshot } from '../../stores/editor-store'
import ArchitectureConfirmDialog from '../dialogs/ArchitectureConfirmDialog'
import { Button } from '../ui/Button'
import { ipc } from '../../services/ipc-client'
import { requireIpcSuccess } from '../../services/ipc-result'
import { CORE_FIELD_MAP, parseCoreField } from '../../services/resource-protocol'
import { hasArchContent } from '../../services/architecture-service'
import { localizeNovelConfigFacts } from '../../shared/novel-config-localization'
import { appErrorMessage } from '../../i18n/app-errors'
import { toast } from '../ui/Toast'
import { CharacterCardImportButton } from '../characters/CharacterCardImportButton'
import CodeMirrorEditor from './CodeMirrorEditor'
import ArcStructureTree, { readArcTreeState, writeArcTreeState } from './ArcStructureTree'
import OutlineTreePanel, { readOutlineTreeState, writeOutlineTreeState, type OutlineTreePanelState } from './OutlineTreePanel'
import { buildArcTree } from '../../shared/arc-tree'
import { buildOutlineTree } from '../../shared/outline-tree'
import { SaveFeedback, type SaveOutcome } from './save-feedback'
import { useProjectStore } from '../../stores/project-store'
import { useLocaleStore } from '../../stores/locale-store'
import { launchCreativeWorkflow } from '../../services/workflows/creative-workflow-launcher'
import {
  describeSynopsisUnitProbe,
  probeSynopsisUnitLaunchForProject,
  reportSynopsisUnitProbe,
} from '../../services/workflows/synopsis-unit-launch'
import type { ArchitectureUnitRange } from '../../shared/generation-owner-contract'
import { formatChapterPosition } from '../../shared/chapter-position'
import { createArchitectureWorkflow } from '../../services/workflows/architecture-workflow'
import { renderPlotOutlineSynopsis, validPlotOutlineAuthorPrefix, plotOutlineCoveredTo } from '../../shared/plot-outline-contract'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useSynopsisUnitChainStore } from '../../stores/synopsis-unit-chain-store'
import { UNIT_CHAIN_STOP_COPY } from '../../services/workflows/synopsis-unit-chain'
import { useLayoutStore } from '../../stores/layout-store'
import { globalEventBus } from '../../shared/event-bus'
import {
  OUTLINE_CHARACTER_NUDGE_COPY,
  dismissOutlineCharacterNudge,
  publishOutlineCharacterNudgeConfig,
  readOutlineCharacterNudgeDismissedVersion,
  shouldNudgeOutlineCharacterSupplement,
  subscribeOutlineCharacterNudgeConfig,
} from '../../services/architecture-character-nudge'
import {
  ARCH_REFRESH_BLOCKED_MESSAGE,
  ARCH_PROJECT_MISMATCH_MESSAGE,
  ArchReloadGate,
  archEditStoreAction,
  decideArchExternalRefresh,
  didArchSaveSettle,
  hasUnsavedArchEdit,
  isArchProjectCurrent,
  reassertBlockedArchEdit,
  shouldRefreshArchOnWorkflowComplete,
  writeArchEditState,
} from './arch-file-refresh-policy'
import {
  canExplicitlyRepairCharacterRoster,
  getCharacterRosterRepairPresentation,
} from './character-roster-repair-state'
import { useCharacterRosterRepair } from './use-character-roster-repair'
import {
  captureProjectSession,
  isProjectSessionCurrent,
  isProjectSessionPath,
} from '../project-session-gate'

type ArchStepKey = 'premise' | 'characters' | 'worldbuilding' | 'plotStructure' | 'synopsis'

/** 与 Sidebar / WorldBuildingEditor 保持一致的架构文件元信息 */
const ARCH_META: Record<ArchStepKey, { iconName: string; label: string; labelEn: string; desc: string; descEn: string }> = {
  premise: { iconName: 'target', label: '故事前提', labelEn: 'Premise', desc: 'Logline、核心冲突、金手指定位', descEn: 'Logline, central conflict, and story hook' },
  characters: { iconName: 'users', label: '角色图谱', labelEn: 'Character graph', desc: '角色弧光、关系网、矛盾交织', descEn: 'Character arcs, relationships, and conflicts' },
  worldbuilding: { iconName: 'globe', label: '世界观', labelEn: 'Worldbuilding', desc: '核心规则、阶层断层、深层危机、空间结构', descEn: 'Core rules, social divides, deeper crises, and spatial structure' },
  plotStructure: { iconName: 'compass', label: '卷 / 单元结构', labelEn: 'Volumes and units', desc: '按卷与单元切段，交代处境、阻力与代价', descEn: 'Volume and unit breakdown: states, pressure, and permanent costs' },
  synopsis: { iconName: 'map', label: '情节大纲', labelEn: 'Synopsis', desc: '按所选故事结构展开的章节级大纲', descEn: 'Chapter-level outline following the selected structure' },
}

/** 从文件路径推断出 ArchStepKey */
function detectStepKey(filePath: string): ArchStepKey | null {
  const field = parseCoreField(filePath)
  const coreKey = Object.keys(CORE_FIELD_MAP).find(key => CORE_FIELD_MAP[key] === field)
  if (coreKey) return coreKey as ArchStepKey
  if (filePath.endsWith('premise.md')) return 'premise'
  if (filePath.endsWith('characters.md')) return 'characters'
  if (filePath.endsWith('worldbuilding.md')) return 'worldbuilding'
  if (filePath.endsWith('plot_structure.md')) return 'plotStructure'
  if (filePath.endsWith('synopsis.md')) return 'synopsis'
  return null
}

interface Props {
  tabId: string
  filePath: string
  projectKey: string
  content: string
  savedContent: string
}

/**
 * 架构文件编辑器（Markdown 文件 WYSIWYG 编辑）
 * - 使用 CodeMirrorEditor（document 模式）+ hideStatusBar，底部栏信息整合到本组件工具栏
 * - 脏状态通过比较内容字符串判断，不依赖 onChange 时机
 */
export default function ArchFileViewer(props: Props) {
  const currentProject = useProjectStore(s => s.currentProject)
  const projectSession = captureProjectSession(currentProject)
  const sessionKey = projectSession && isProjectSessionPath(projectSession, props.projectKey)
    ? `${projectSession.projectId}:${projectSession.leaseId}`
    : `inactive:${props.projectKey}`

  // 同一路径重新打开会产生新 lease；重挂载可隔离旧会话的编辑器临时状态。
  return <ArchFileViewerSession key={sessionKey} {...props} />
}

function ArchFileViewerSession({
  tabId,
  filePath,
  projectKey,
  content: initialContent,
  savedContent: initialSavedContent,
}: Props) {
  const stepKey = detectStepKey(filePath)
  const isCharacterProjection = stepKey === 'characters'
  const meta = stepKey ? ARCH_META[stepKey] : null
  const currentProject = useProjectStore(s => s.currentProject)
  const text = useLocaleStore(s => s.text)
  const recoveryTab = useEditorStore(s => s.tabs.find(tab => tab.id === tabId && tab.planningRecovery))
  /** 弧光结构内容是否由枚举模板兜底（老模板用户）。作者保存一次后自动清除。 */
  const archEnumFallback = useEditorStore(s => s.tabs.find(tab => tab.id === tabId)?.archEnumFallback ?? false)

  /**
   * 「情节大纲」的副标题必须反映**本书当前实际生效**的结构来源，不能写死：
   * - 自定义弧光结构（`plotStructurePlan` 非空）→ 大纲按它展开；
   * - 否则回退到「小说设定 · 故事结构」所选模板。
   * 不这么做的话，作者在小说设定里改了故事结构，这里仍显示旧文案。
   */
  const [synopsisStructureDesc, setSynopsisStructureDesc] = useState<{ zh: string; en: string } | null>(null)
  /**
   * 大纲三层树需要的两个**非本文档**输入：
   * - `plotStructurePlan`：卷/单元结构的原文（大纲文件里没有它）；
   * - `totalChapters`：全书总章数，`arcSpanForChapters` 折算章→单元时必须有分母。
   * 两者都只在「情节大纲」这一步取。
   */
  const [outlineArcPlan, setOutlineArcPlan] = useState('')
  const [outlineTotalChapters, setOutlineTotalChapters] = useState(0)
  useEffect(() => {
    if (stepKey !== 'synopsis') {
      setSynopsisStructureDesc(null)
      setOutlineArcPlan('')
      setOutlineTotalChapters(0)
      return
    }
    const session = captureProjectSession(currentProject)
    if (!session || !isProjectSessionPath(session, projectKey)) {
      setSynopsisStructureDesc(null)
      setOutlineArcPlan('')
      setOutlineTotalChapters(0)
      return
    }
    let disposed = false
    void ipc.invokeWithProjectSession(session, 'db:project-core-get', session.projectPath)
      .then(core => {
        if (disposed || !isProjectSessionCurrent(session)) return
        setOutlineArcPlan(String(core?.plotStructurePlan ?? ''))
        const chapters = Number(core?.totalChapters)
        setOutlineTotalChapters(Number.isSafeInteger(chapters) && chapters > 0 ? chapters : 0)
        if (String(core?.plotStructurePlan ?? '').trim().length > 50) {
          setSynopsisStructureDesc({
            zh: '按本书自定义「卷 / 单元结构」展开',
            en: 'Expanded from this book’s custom volume and unit structure',
          })
          return
        }
        const structure = String(core?.plotStructure ?? '') || currentProject?.novelConfig?.plotStructure || ''
        const zh = localizeNovelConfigFacts({ plotStructure: structure }, 'zh-CN').plotStructure
        const en = localizeNovelConfigFacts({ plotStructure: structure }, 'en-US').plotStructure
        setSynopsisStructureDesc(zh && en ? { zh: `按「${zh}」展开`, en: `Expanded from “${en}”` } : null)
      })
      .catch(() => {
        if (disposed) return
        setSynopsisStructureDesc(null)
        setOutlineArcPlan('')
        setOutlineTotalChapters(0)
      })
    return () => { disposed = true }
  }, [stepKey, currentProject, projectKey])
  const [recovery, setRecovery] = useState(recoveryTab?.planningRecovery)
  const [authorEnd, setAuthorEnd] = useState(String(recoveryTab?.planningSaveEnd ?? ''))
  const [recoveryError, setRecoveryError] = useState('')
  const [continuing, setContinuing] = useState(false)
  const recoverySession = useRef(captureProjectSession(currentProject))
  const authorEndRef = useRef(authorEnd)
  const recoveryRef = useRef(recovery)
  const hasRecovery = Boolean(recoveryTab)
  const currentProjectKey = currentProject?.path
  const projectMatches = isArchProjectCurrent(projectKey, currentProjectKey)
  const planningTargetUnit = recovery?.plotOutline?.sourceExpected.writingLanguage === 'en-US' ? text('词', 'words') : text('字', 'characters')

  const refreshRecovery = useCallback(async () => {
    const session = recoverySession.current
    const original = recoveryTab?.planningRecovery
    if (!session || !original || !isProjectSessionCurrent(session)) return
    const next = await ipc.invokeWithProjectSession(session, 'generation:read-context', { handle: original.handle })
    if (isProjectSessionCurrent(session)) { recoveryRef.current = next; setRecovery(next) }
    return next
  }, [recoveryTab?.planningRecovery])
  useEffect(() => {
    if (!hasRecovery) return
    void refreshRecovery().catch(error => setRecoveryError(appErrorMessage(useLocaleStore.getState().locale, error)))
  }, [hasRecovery, refreshRecovery])

  // 磁盘上的内容（已保存的基准）
  const savedContentRef = useRef(initialSavedContent)
  // 编辑器当前内容（用 ref 而非 state，避免每次键入都重渲染导致光标跳末尾）
  const currentContentRef = useRef(initialContent)
  // 传给 CodeMirrorEditor 的初始内容（只有『外部重载』时才更新，不随用户键入变化）
  const [editorContent, setEditorContent] = useState(initialContent)

  const [saving, setSaving] = useState(false)
  const [saveOutcome, setSaveOutcome] = useState<SaveOutcome>('idle')
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [checkingArch, setCheckingArch] = useState(false)
  const [fullArchStatus, setFullArchStatus] = useState<Record<string, boolean>>({})
  /**
   * 当前大纲已覆盖到第几章（0 = 无章级条目）。
   * 供对话框的「续写」勾选项自动推出下一批起点，见 `plotOutlineCoveredTo`。
   */
  const [synopsisCoveredTo, setSynopsisCoveredTo] = useState(0)
  const lastCompletedArchitectureRunRef = useRef<string | null>(null)
  const [refreshBlockedMessage, setRefreshBlockedMessage] = useState<string | null>(null)
  const reloadGateRef = useRef(new ArchReloadGate())

  const isArchRunning = useWorkflowStore(s => s.isTypeRunning('architecture_generation'))
  const {
    snapshot: rosterSnapshot,
    repairError: rosterRepairError,
    isRepairing: extracting,
    refresh: loadCharacterRosterStatus,
    migrate: handleRepairCharacterRoster,
  } = useCharacterRosterRepair({ projectKey, enabled: isCharacterProjection })

  // 中文字数（由 CodeMirrorEditor 回调更新）
  const [charCount, setCharCount] = useState(0)

  // ===== E4j-3：卷 / 单元 只读树（抽屉，可 pin） =====
  // 只在「卷 / 单元结构」这一步显示：别的文档没有卷单元层级。
  const showArcTree = stepKey === 'plotStructure' && !isCharacterProjection
  const arcTree = useMemo(
    () => (showArcTree ? buildArcTree(editorContent) : null),
    [showArcTree, editorContent],
  )
  const [treeState, setTreeState] = useState(() => (showArcTree ? readArcTreeState(projectKey, filePath) : { pinned: false, expanded: [] }))
  const [treeOpen, setTreeOpen] = useState(false)
  const [revealLine, setRevealLine] = useState<{ line: number; nonce: number } | null>(null)
  const patchTreeState = (next: { pinned?: boolean; expanded?: readonly number[] }) => {
    setTreeState(previous => {
      const merged = { pinned: next.pinned ?? previous.pinned, expanded: next.expanded ?? previous.expanded }
      writeArcTreeState(projectKey, filePath, merged)
      return merged
    })
  }
  const toggleVolume = (volumeIndex: number) => {
    patchTreeState({
      expanded: treeState.expanded.includes(volumeIndex)
        ? treeState.expanded.filter(index => index !== volumeIndex)
        : [...treeState.expanded, volumeIndex],
    })
  }
  const expandAllVolumes = () => patchTreeState({ expanded: (arcTree?.volumes ?? []).map(volume => volume.index) })
  const collapseAllVolumes = () => patchTreeState({ expanded: [] })
  const jumpToLine = (line: number) => setRevealLine({ line, nonce: Date.now() })

  // ===== E4j-4：情节大纲的 卷 / 单元 / 章 三层树 =====
  // 只在大纲这一步显示，且必须**同时**拿到卷单元结构与全书总章数（缺一个就无法折算归属）。
  const showOutlineTree = stepKey === 'synopsis' && !isCharacterProjection
  const outlineTree = useMemo(
    () => (showOutlineTree ? buildOutlineTree(outlineArcPlan, editorContent, outlineTotalChapters) : null),
    [showOutlineTree, outlineArcPlan, editorContent, outlineTotalChapters],
  )
  const [outlineTreeState, setOutlineTreeState] = useState<OutlineTreePanelState>(
    () => (showOutlineTree ? readOutlineTreeState(projectKey, filePath) : { pinned: false, expanded: [] }),
  )
  const [outlineTreeOpen, setOutlineTreeOpen] = useState(false)
  const patchOutlineTreeState = (next: { pinned?: boolean; expanded?: readonly string[] }) => {
    setOutlineTreeState(previous => {
      const merged = { pinned: next.pinned ?? previous.pinned, expanded: next.expanded ?? previous.expanded }
      writeOutlineTreeState(projectKey, filePath, merged)
      return merged
    })
  }
  const toggleOutlineNode = (key: string) => {
    patchOutlineTreeState({
      expanded: outlineTreeState.expanded.includes(key)
        ? outlineTreeState.expanded.filter(item => item !== key)
        : [...outlineTreeState.expanded, key],
    })
  }
  const allOutlineKeys = useMemo(() => {
    const keys: string[] = []
    for (const volume of outlineTree?.volumes ?? []) {
      keys.push(`v:${volume.index}`)
      for (const unit of volume.units) keys.push(`v:${volume.index}:u:${unit.index}`)
    }
    return keys
  }, [outlineTree])
  const expandAllOutlineNodes = () => patchOutlineTreeState({ expanded: allOutlineKeys })
  const collapseAllOutlineNodes = () => patchOutlineTreeState({ expanded: [] })

  /**
   * 作者定调（2026-10-11）：大纲先出、角色随后补。大纲已完成、而作者还没处理过
   * 这条提醒时，在「情节大纲」页常驻一条醒目提示 —— **只提示，绝不自动建卡**
   * （大纲可能还要修改，时机由作者决定）。
   *
   * 作者修订（2026-10-20）：不允许「点一次就永久消失」。三个出口：
   * × 关闭只算这一稿处理过（大纲一更新就回来）；「不再提示」关的是全局开关，
   * 在 设置 → 编辑器 里能重新打开。
   */
  const [outlineCharacterNudge, setOutlineCharacterNudge] = useState(false)
  const [outlineNudgeGloballyDisabled, setOutlineNudgeGloballyDisabled] = useState(false)
  /** E3 T12：连续生成的进度（调度在 App，这里只读来显示）。 */
  const unitChain = useSynopsisUnitChainStore(s => s.chain)
  useEffect(() => {
    let cancelled = false
    void ipc.invoke('config:get')
      .then((config) => {
        if (!cancelled) setOutlineNudgeGloballyDisabled(config?.autoPromptOutlineCharacterSupplement === false)
      })
      .catch(() => { /* 读不到配置时按「开启」处理：宁可多提示一次，也别悄悄静音。 */ })
    // 别处（toast / 设置面板）改了开关，这里要立刻跟上，免得横幅还挂在那里。
    const unsubscribe = subscribeOutlineCharacterNudgeConfig(setOutlineNudgeGloballyDisabled)
    return () => { cancelled = true; unsubscribe() }
  }, [])
  useEffect(() => {
    if (stepKey !== 'synopsis' || !projectMatches) { setOutlineCharacterNudge(false); return }
    setOutlineCharacterNudge(shouldNudgeOutlineCharacterSupplement({
      synopsis: editorContent,
      dismissedVersion: readOutlineCharacterNudgeDismissedVersion(projectKey),
      globallyDisabled: outlineNudgeGloballyDisabled,
    }))
  }, [stepKey, projectMatches, editorContent, projectKey, outlineNudgeGloballyDisabled])
  /** 只处理「这一稿」：大纲更新后自动重新提示。 */
  const settleOutlineNudge = () => {
    dismissOutlineCharacterNudge(projectKey, editorContent)
    setOutlineCharacterNudge(false)
  }
  /** 真的不再显示：关全局开关，并告诉作者去哪儿打开回来。 */
  const disableOutlineNudgeGlobally = async () => {
    settleOutlineNudge()
    const text = useLocaleStore.getState().text
    try {
      const result = await ipc.invoke('config:set', { autoPromptOutlineCharacterSupplement: false })
      if (result && result.success === false) throw new Error(result.error || text('未知错误', 'Unknown error'))
      setOutlineNudgeGloballyDisabled(true)
      publishOutlineCharacterNudgeConfig(true)
      toast.info(text(OUTLINE_CHARACTER_NUDGE_COPY.dismissedHint.zh, OUTLINE_CHARACTER_NUDGE_COPY.dismissedHint.en), 7000)
    } catch (error) {
      toast.error(text(
        `关闭提示失败：${error instanceof Error ? error.message : String(error)}`,
        `Could not turn the reminder off: ${error instanceof Error ? error.message : String(error)}`,
      ))
    }
  }

  // 脚状态（独立 state，不跟着 content 走）
  const [isDirty, setIsDirty] = useState(initialContent !== initialSavedContent)
  const visibleBlockedMessage = projectMatches
    ? refreshBlockedMessage
    : ARCH_PROJECT_MISMATCH_MESSAGE

  // 外部内容更新时的热重载（拦截 store.syncTabContent 带来的 props.content 更新）
  useEffect(() => {
    if (!projectMatches) return
    const decision = decideArchExternalRefresh({
      savedContent: savedContentRef.current,
      currentContent: currentContentRef.current,
    }, initialContent)
    if (decision.kind === 'blocked') {
      reassertBlockedArchEdit(
        useEditorStore.getState(),
        tabId,
        currentContentRef.current,
      )
      setRefreshBlockedMessage(ARCH_REFRESH_BLOCKED_MESSAGE)
      return
    }
    if (decision.kind === 'apply') {
      reloadGateRef.current.recordContentChange()
      setLoading(false)
      savedContentRef.current = initialContent
      currentContentRef.current = initialContent
      setEditorContent(initialContent)
      setIsDirty(false)
      setRefreshBlockedMessage(null)
    }
  }, [initialContent, projectMatches, tabId])


  // 内容变化回调：更新 ref，不触发重渲染，避免 content prop 回传导致光标跳末尾
  const handleChange = useCallback((md: string) => {
    if (isCharacterProjection) return
    reloadGateRef.current.recordContentChange()
    setLoading(false)
    setSaveOutcome('idle')
    currentContentRef.current = md
    const storeAction = archEditStoreAction({
      savedContent: savedContentRef.current,
      currentContent: md,
    })
    const dirty = storeAction === 'update-dirty'
    setIsDirty(dirty)
    // 同步 editor-store 的 tab.dirty，供标题栏警示灯、Tab 圆点、关闭确认使用
    writeArchEditState(useEditorStore.getState(), tabId, md, storeAction)
  }, [isCharacterProjection, tabId])

  /** 保存（统一走 ai-novel://core/ DB 路径） */
  const handleSave = useCallback(async (md: string, propagateFailure = false) => {
    if (isCharacterProjection) return
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      return
    }
    reloadGateRef.current.invalidate()
    setLoading(false)
    setSaving(true)
    setSaveOutcome('idle')
    const savedSnapshot = useEditorStore.getState().tabs.find(tab => tab.id === tabId)
    let submittedSnapshot = { content: md, contentRevision: savedSnapshot?.contentRevision ?? 0 }
    try {
      if (!resourceWriteAllowed(filePath)) throw new Error('资源只读或无效')
      if (recoveryRef.current) {
        const original = recoveryRef.current
        const session = recoverySession.current
        if (!session || !isProjectSessionCurrent(session)) throw new Error(text('项目会话已切换，请重新打开恢复稿', 'The project session changed. Reopen the recovery draft.'))
        const fresh = await ipc.invokeWithProjectSession(session, 'generation:read-context', { handle: original.handle })
        const progress = original.plotOutline
        const candidate = fresh.plotOutlineRecovery
        const tab = useEditorStore.getState().tabs.find(tab => tab.id === tabId)
        const operationId = tab?.planningSaveOperationId
        if (!progress || !candidate || !operationId || candidate.leaseEpoch !== session.leaseId) throw new Error(text('恢复内容暂时无法读取，请重新打开恢复稿', 'Recovery content is unavailable. Reopen the recovery draft.'))
        const pending = tab?.planningSaveSnapshot
        if (pending?.status === 'saved' || candidate.saved && !pending) throw new Error(text('本次恢复已保存，后续修改仅供复制。', 'This recovery is saved. Further edits can only be copied.'))
        if (candidate.writeState.kind !== 'ready' && !candidate.saved) throw new Error(text('当前无法保存，请等待生成结束或检查来源变化', 'Wait for generation to finish or check changed sources before saving.'))
        let submission = pending
        if (!submission) {
          const committedRange = { from: progress.range.from, to: Number(authorEndRef.current) }
          let synopsis = md.trimEnd()
          if (!validPlotOutlineAuthorPrefix(synopsis, progress, committedRange)) {
            const expected = progress.sourceExpected
            const title = renderPlotOutlineSynopsis('', expected.totalChapters, expected)
            const generatedTo = Math.min(progress.range.from + (progress.composition?.chapters?.length ?? 0), progress.range.to)
            const oldTail = renderPlotOutlineSynopsis('', generatedTo, expected).slice(title.length)
            if (oldTail && candidate.draft.endsWith(oldTail) && synopsis.endsWith(oldTail)) synopsis = synopsis.slice(0, -oldTail.length)
            synopsis = synopsis.trimEnd() + renderPlotOutlineSynopsis('', committedRange.to, expected).slice(title.length)
          }
          if (!validPlotOutlineAuthorPrefix(synopsis, progress, committedRange)) throw new Error(text('请保留连续完整章节，并移除所选保存终点之后的未完成内容。原有范围外内容须保持不变。', 'Keep complete consecutive chapters and remove incomplete content after the selected ending chapter. Preserve the original content outside this range.'))
          submission = {
            ...submittedSnapshot, status: 'pending', channel: 'db:project-core-synopsis-commit',
            request: { synopsis, expected: progress.sourceExpected,
              authorRecovery: { sourceHandle: candidate.sourceHandle, leaseEpoch: candidate.leaseEpoch, operationId, committedRange } },
          } satisfies PlanningRecoverySaveSnapshot
          useEditorStore.getState().setPlanningSaveSnapshot(tabId, submission)
        }
        if (submission.channel !== 'db:project-core-synopsis-commit') throw new Error('INVALID_PLANNING_SAVE_CHANNEL')
        const result = await ipc.invokeWithProjectSession(session, 'db:project-core-synopsis-commit', {
          ...submission.request, authorRecovery: { ...submission.request.authorRecovery, leaseEpoch: candidate.leaseEpoch },
        }, projectKey)
        if (!result.success && !pending && isProjectSessionCurrent(session)) useEditorStore.getState().setPlanningSaveSnapshot(tabId, undefined)
        requireIpcSuccess(result, '保存恢复大纲')
        if (!isProjectSessionCurrent(session)) return
        submittedSnapshot = { ...submission, content: submission.request.synopsis }
        const currentTab = useEditorStore.getState().tabs.find(tab => tab.id === tabId)
        if (submission.content !== submittedSnapshot.content && currentTab?.content === submission.content
          && (currentTab.contentRevision ?? 0) === submission.contentRevision && currentContentRef.current === submission.content) {
          currentContentRef.current = submittedSnapshot.content
          setEditorContent(submittedSnapshot.content)
          useEditorStore.getState().syncTabContent(tabId, submittedSnapshot.content)
          submittedSnapshot.contentRevision = useEditorStore.getState().tabs.find(tab => tab.id === tabId)?.contentRevision ?? 0
        }
        useEditorStore.getState().setPlanningSaveSnapshot(tabId, { ...submission, status: 'saved' })
        setRecoveryError('')
      } else if (filePath.startsWith('ai-novel://core/')) {
        const dbField = parseCoreField(filePath)
        if (!dbField) return
        requireIpcSuccess(await ipc.invokeWithProjectSession(
          projectSession,
          'db:project-core-update',
          { [dbField]: md },
          projectSession.projectPath,
        ), '保存架构文件')
        // 作者一旦保存弧光结构，内容即为本书专属自由弧，撤销「模板兜底」提示。
        if (dbField === CORE_FIELD_MAP.plotStructure) {
          useEditorStore.getState().setTabArchEnumFallback(tabId, false)
        }
      } else {
        // DB 化后架构文件不应有物理路径；如果意外触发，尝试 FS 写入兜底
        console.warn('[ArchFileViewer] 非预期的物理路径保存:', filePath)
        requireIpcSuccess(
          await ipc.invokeWithProjectSession(
            projectSession,
            'fs:write-file',
            filePath,
            md,
            projectSession.projectPath,
          ),
          '保存架构文件',
        )
      }
      if (isProjectSessionCurrent(projectSession)) {
        reloadGateRef.current.invalidate()
        setLoading(false)
        const savedContent = submittedSnapshot.content
        savedContentRef.current = savedContent
        if (recoveryRef.current) useEditorStore.getState().settleTabSave(tabId, submittedSnapshot)
        const settled = recoveryRef.current
          ? !useEditorStore.getState().tabs.find(tab => tab.id === tabId)?.dirty
          : didArchSaveSettle(savedContent, currentContentRef.current)
        if (settled) {
          setIsDirty(false)
          setRefreshBlockedMessage(null)
          if (!recoveryRef.current) useEditorStore.getState().markTabSaved(tabId, savedContent)
          setSaveOutcome('saved')
        } else {
          setIsDirty(true)
          if (!recoveryRef.current) useEditorStore.getState().updateTabContent(tabId, currentContentRef.current)
          setSaveOutcome('idle')
        }
        if (recoveryRef.current) await refreshRecovery()
      }
    } catch (error) {
      if (isProjectSessionCurrent(projectSession)) {
        if (recoveryRef.current) setRecoveryError(appErrorMessage(useLocaleStore.getState().locale, error))
        setSaveOutcome('failed')
        toast.error(appErrorMessage(useLocaleStore.getState().locale, error))
      }
      // Exit-save must reject so the caller cannot close an unsaved document.
      if (propagateFailure) throw error
    } finally {
      if (isProjectSessionCurrent(projectSession)) setSaving(false)
    }
  }, [filePath, isCharacterProjection, projectKey, tabId, refreshRecovery, text])

  useEffect(() => {
    if (isCharacterProjection) return
    // EditorArea unmounts the inactive tab. The store removes this handler only
    // when the tab itself closes, so an inactive dirty document can still save
    // during application exit.
    registerEditorExitSaveHandler({
      tabId,
      type: 'arch-file',
      projectKey,
      save: () => handleSave(currentContentRef.current, true),
    })
  }, [handleSave, isCharacterProjection, projectKey, tabId])

  /** 从 DB 重新加载（AI 生成后刷新用） */
  const handleReload = useCallback(async () => {
    if (recoveryRef.current) {
      try {
        await refreshRecovery()
        setRecoveryError('')
      } catch (error) {
        setRecoveryError(appErrorMessage(useLocaleStore.getState().locale, error))
      }
      return
    }
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      return
    }
    if (hasUnsavedArchEdit({
      savedContent: savedContentRef.current,
      currentContent: currentContentRef.current,
    })) {
      reassertBlockedArchEdit(
        useEditorStore.getState(),
        tabId,
        currentContentRef.current,
      )
      setRefreshBlockedMessage(ARCH_REFRESH_BLOCKED_MESSAGE)
      return
    }

    const reloadToken = reloadGateRef.current.begin()
    setLoading(true)
    try {
      let newContent = ''
      if (filePath.startsWith('ai-novel://core/')) {
        const core = await ipc.invokeWithProjectSession(
          projectSession,
          'db:project-core-get',
          projectSession.projectPath,
        )
        const dbField = parseCoreField(filePath)
        newContent = dbField && core
          ? String(core[dbField as keyof typeof core] ?? '')
          : ''
      } else {
        // 数据库存储后，架构文件不应再有物理路径。
        console.warn('[ArchFileViewer] 非预期的物理路径刷新:', filePath)
        const res = await ipc.invokeWithProjectSession(
          projectSession,
          'fs:read-file',
          filePath,
          projectSession.projectPath,
        )
        if (res.success) newContent = res.content
      }
      const currentTab = useEditorStore.getState().tabs.find(tab => tab.id === tabId)
      if (
        !reloadGateRef.current.isCurrent(reloadToken)
        || !isProjectSessionCurrent(projectSession)
        || currentTab?.projectKey !== projectKey
      ) {
        return
      }
      const decision = decideArchExternalRefresh({
        savedContent: savedContentRef.current,
        currentContent: currentContentRef.current,
      }, newContent)
      if (decision.kind === 'blocked') {
        reassertBlockedArchEdit(
          useEditorStore.getState(),
          tabId,
          currentContentRef.current,
        )
        setRefreshBlockedMessage(ARCH_REFRESH_BLOCKED_MESSAGE)
        return
      }
      if (decision.kind === 'apply') {
        savedContentRef.current = decision.content
        currentContentRef.current = decision.content
        setEditorContent(decision.content)
        setIsDirty(false)
        setRefreshBlockedMessage(null)
        useEditorStore.getState().markTabSaved(tabId, decision.content)
      }
    } catch (error) {
      if (
        reloadGateRef.current.isCurrent(reloadToken)
        && isProjectSessionCurrent(projectSession)
      ) {
        console.warn('[ArchFileViewer] 架构文档刷新失败:', error)
      }
    } finally {
      if (reloadGateRef.current.isCurrent(reloadToken) && isProjectSessionCurrent(projectSession)) {
        setLoading(false)
      }
    }
  }, [filePath, projectKey, tabId, refreshRecovery])

  useEffect(() => {
    const reloadGate = reloadGateRef.current
    return () => {
      reloadGate.invalidate()
    }
  }, [])

  // 监听架构生成完成事件，自动刷新当前页面
  useEffect(() => {
    return globalEventBus.on('WORKFLOW_COMPLETE', (payload) => {
      const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
      if (!projectSession || !isProjectSessionCurrent(projectSession)) return
      if (!shouldRefreshArchOnWorkflowComplete(
        payload,
        projectSession,
        lastCompletedArchitectureRunRef.current,
      )) return
      lastCompletedArchitectureRunRef.current = payload.runId
      void handleReload()
      void loadCharacterRosterStatus()
    })
  }, [handleReload, loadCharacterRosterStatus, projectKey])

  /** 确认后启动架构生成工作流 */
  const handleConfirm = async (
    selectedSteps: ArchStepKey[],
    stepGuidance: Record<string, string>,
    synopsisRange?: { from: number; to: number },
    targetUnits?: number,
    unitChainTotal?: number,
  ) => {
    const projectSession = captureProjectSession(useProjectStore.getState().currentProject)
    if (!projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      throw new Error('项目会话已切换，未启动架构生成')
    }
    if (!isProjectSessionCurrent(projectSession)) throw new Error('项目会话已切换，未启动架构生成')
    // E3 探针（T10）：开关打开且本次勾了情节大纲 ⇒ 「点一次 = 一个单元」，范围由落库游标决定，
    // 对话框里的章号区间不再生效。开关关掉 / 算不出单元（旧骨架、无检查点）一律原样退回按章区间。
    // ⚠️ 探针**必须把结论说出来**（控制台 + toast + window.__e3UnitProbe）：否则现场只看到「点了没反应」。
    let synopsisUnit: ArchitectureUnitRange | null = null
    // 连写用：卷号 + 本卷还剩几个单元（探针给不出就按「1 个单元、不判卷界」处理）。
    let synopsisUnitVolume: number | null = null
    let synopsisUnitCapacity = 1
    // T11 起这是正式行为（开关在设置里，默认开）：不再有 DEV 锁，探针自己读配置。
    if (selectedSteps.includes('synopsis')) {
      const probe = await probeSynopsisUnitLaunchForProject({
        projectSession,
        totalChapters: Number(currentProject?.novelConfig?.totalChapters),
      })
      reportSynopsisUnitProbe(probe)
      synopsisUnit = probe.unit
      synopsisUnitVolume = probe.volume?.index ?? null
      synopsisUnitCapacity = Math.max(1, probe.volume?.remainingUnits ?? 1)
      if (probe.unit) {
        toast.info(`[E3] 单元批次：${formatChapterPosition({
          chapter: probe.unit.from,
          volumeIndex: probe.volume?.index,
          unitIndex: probe.unit.unitIndex,
        }, 'zh-CN')}（上界 ${probe.unit.maxChapters} 章）`)
      } else {
        toast.info(`本次按章区间生成：${describeSynopsisUnitProbe(probe)}`)
      }
    }
    // 启动前后各留一条：现场「点了没反应」时能立刻分辨是「没走到这里」「启动抛错」还是「启动了但没回执」。
    if (import.meta.env.DEV) console.warn('[E3] 提交工作流…', synopsisUnit ? '单元模式' : '按章区间')
    try {
      const receipt = await launchCreativeWorkflow({
        workflow: 'generate_architecture',
        selectedSteps,
        stepGuidance,
        ...(synopsisUnit ? { synopsisUnit } : { synopsisRange }),
        targetUnits,
      }, projectSession)
      // E3 T12：连写 N 个单元。这里只负责「起链」——后续批次由 App 在每批完成时
      // 重新探针、算下一个单元再发新 run；本组件随时可能被卸载，不能拿它当调度器。
      const requestedChain = synopsisUnit ? Math.min(synopsisUnitCapacity, Math.max(1, Math.floor(unitChainTotal ?? 1))) : 1
      if (synopsisUnit && requestedChain > 1 && receipt?.runId) {
        useSynopsisUnitChainStore.getState().start({
          projectPath: projectSession.projectPath,
          total: requestedChain,
          volumeIndex: synopsisUnitVolume,
          runId: receipt.runId,
          // 作者对这批大纲的要求必须对后续每一批都成立，否则前后几批口径不一致。
          targetUnits: targetUnits ?? null,
          stepGuidance,
        })
        toast.info(`连续生成已开始：本次连写 ${requestedChain} 个单元，只到本卷末`)
      } else {
        useSynopsisUnitChainStore.getState().clear()
      }
      if (import.meta.env.DEV) console.warn('[E3] 工作流已启动')
    } catch (error) {
      useSynopsisUnitChainStore.getState().stop('failed', '首批没有启动成功')
      console.warn('[E3] 工作流启动失败', error)
      throw error
    }
  }

  const handleOpenDialog = async () => {
    const projectSession = captureProjectSession(currentProject)
    if (!stepKey || !projectMatches || !projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      return
    }
    setCheckingArch(true)
    try {
      const core = await ipc.invokeWithProjectSession(
        projectSession,
        'db:project-core-get',
        projectSession.projectPath,
      )
      if (!isProjectSessionCurrent(projectSession)) return
      const roster = await ipc.invokeWithProjectSession(
        projectSession,
        'db:character-roster-read',
        projectSession.projectPath,
      )
      if (!isProjectSessionCurrent(projectSession)) return
      // ★ 不再本地重写一份判据：同一状态写多份必然漏步骤。
      //   实测：本处曾漏掉 plotStructure → 弧光已生成却显示「待生成」。
      const status: Record<string, boolean> = {
        premise: hasArchContent(core?.premise),
        characters: roster?.status === 'ready' || hasArchContent(core?.charactersArch),
        worldbuilding: hasArchContent(core?.worldbuilding),
        plotStructure: hasArchContent(core?.plotStructurePlan),
        synopsis: hasArchContent(core?.synopsis),
      }

      // 对于当前文件，如果编辑器内已修改但未保存，也暂时以前面的基准为准即可
      const EditorContentLen = currentContentRef.current.length;
      if (EditorContentLen > 50 && !currentContentRef.current.includes('待生成')) {
        status[stepKey] = true
      }
      setFullArchStatus(status)
      // 「续写」起点由**章级标题**推出（不用末尾那句提示行：它只在未写满时存在，且可被手改）。
      setSynopsisCoveredTo(plotOutlineCoveredTo(core?.synopsis))
      setShowDialog(true)
    } catch (error) {
      if (isProjectSessionCurrent(projectSession)) {
        console.warn('[ArchFileViewer] 检查架构状态失败:', error)
      }
    } finally {
      if (isProjectSessionCurrent(projectSession)) setCheckingArch(false)
    }
  }

  const continuePlanning = async () => {
    if (continuing || saving) return
    setContinuing(true)
    try {
      const next = await refreshRecovery()
      const continuation = next?.planningContinuation
      const session = recoverySession.current
      if (!session || !isProjectSessionCurrent(session) || !continuation?.remainingRange
        || !['ready', 'continued'].includes(continuation.state)) throw new Error(text('当前不能继续，请先保存完整章节或等待生成结束', 'Save completed chapters or wait for generation to finish before continuing.'))
      await useWorkflowStore.getState().startWorkflow(createArchitectureWorkflow({
        projectPath: projectKey, projectSession: session, selectedSteps: ['synopsis'],
        synopsisRange: continuation.remainingRange, targetUnits: continuation.targetUnits, restartFrom: continuation.sourceHandle,
      }))
      await refreshRecovery()
    } catch (error) { setRecoveryError(appErrorMessage(useLocaleStore.getState().locale, error)) }
    finally { setContinuing(false) }
  }
  const generated = initialContent.length > 50 && !initialContent.includes('待生成')

  const rosterPresentation = stepKey === 'characters'
    ? getCharacterRosterRepairPresentation(rosterSnapshot, text, rosterRepairError)
    : null
  const canRepairRoster = canExplicitlyRepairCharacterRoster(rosterPresentation)
  const discardCharacterProjectionDraft = useCallback(() => {
    if (!isCharacterProjection) return
    // 旧版未保存 Markdown 草稿仍停留在只读编辑器中，作者可先复制。只有
    // 明确点击后才放弃该草稿并接受当前确定性投影。
    const projection = rosterSnapshot?.renderedMarkdown ?? initialSavedContent
    savedContentRef.current = projection
    currentContentRef.current = projection
    setEditorContent(projection)
    setIsDirty(false)
    writeArchEditState(useEditorStore.getState(), tabId, projection, 'sync-saved')
  }, [initialSavedContent, isCharacterProjection, rosterSnapshot?.renderedMarkdown, tabId])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 工具栏（背景与编辑区一致，内嵌在内容区中而非独立标题栏） */}
      <div
        className="flex items-center justify-between gap-2 px-3 h-9 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-editor-bg)',
        }}
      >
        {/* 左侧：Emoji + 标题 + 描述 */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>{meta ? renderIcon(meta.iconName, 14) : <FileText size={14} />}</span>
          <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
            {meta ? text(meta.label, meta.labelEn) : text('架构文档', 'Architecture document')}
          </span>
          {meta && (
            <span className="text-xs truncate hidden sm:inline" style={{ color: 'var(--color-text-muted)' }}>
              — {stepKey === 'synopsis' && synopsisStructureDesc
                ? text(synopsisStructureDesc.zh, synopsisStructureDesc.en)
                : text(meta.desc, meta.descEn)}
            </span>
          )}
        </div>

        {/* 右侧：字数 + 状态 + 操作按钮 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCharacterProjection && (
            <CharacterCardImportButton projectKey={projectKey} disabled={!projectMatches} />
          )}

          {/* 字数 */}
          {charCount > 0 && (
            <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {charCount.toLocaleString()} {text('字', 'characters')}
            </span>
          )}

          {/* 保存状态 */}
          {saving && (
            <span className="text-xs" style={{ color: 'var(--color-accent)' }}>{text('保存中...', 'Saving...')}</span>
          )}
          {isDirty && !saving && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-warning)' }} title={text('有未保存的修改', 'Unsaved changes')} />
          )}
          <SaveFeedback dirty={isDirty} saving={saving} outcome={saveOutcome} />

          {/* 卷/单元树（E4j-3）：只在结构页出现 */}
          {showArcTree && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (treeState.pinned) {
                  // 已固定为侧栏时，这个按钮负责取消固定并收起
                  patchTreeState({ pinned: false })
                  setTreeOpen(false)
                  return
                }
                setTreeOpen(open => !open)
              }}
              title={treeState.pinned
                ? text('取消固定并收起结构树', 'Unpin and hide the tree')
                : treeOpen ? text('收起结构树', 'Hide structure tree') : text('卷 / 单元结构树', 'Volume / unit tree')}
              aria-pressed={treeState.pinned || treeOpen}
            >
              <ListTree size={13} style={treeOpen || treeState.pinned ? { color: 'var(--color-accent)' } : undefined} />
            </Button>
          )}

          {/* 大纲目录（E4j-4）：只在情节大纲页出现 */}
          {showOutlineTree && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (outlineTreeState.pinned) {
                  patchOutlineTreeState({ pinned: false })
                  setOutlineTreeOpen(false)
                  return
                }
                setOutlineTreeOpen(open => !open)
              }}
              title={outlineTreeState.pinned
                ? text('取消固定并收起大纲目录', 'Unpin and hide the outline contents')
                : outlineTreeOpen ? text('收起大纲目录', 'Hide outline contents') : text('大纲目录（卷 / 单元 / 章）', 'Outline contents (volume / unit / chapter)')}
              aria-pressed={outlineTreeState.pinned || outlineTreeOpen}
            >
              <ListTree size={13} style={outlineTreeOpen || outlineTreeState.pinned ? { color: 'var(--color-accent)' } : undefined} />
            </Button>
          )}

          {/* 刷新按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReload}
            title={text('从磁盘重新加载（AI 生成完成后可点击刷新）', 'Reload from disk (refresh after AI generation completes)')}
            disabled={loading || !projectMatches}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>

          {/* 保存按钮（有修改时才显示） */}
          {!isCharacterProjection && isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleSave(currentContentRef.current) }}
              disabled={saving || !projectMatches || recoveryTab?.planningSaveSnapshot?.status === 'saved' || Boolean(recovery && recovery.plotOutlineRecovery?.writeState.kind !== 'ready' && !(recovery.plotOutlineRecovery?.saved && recoveryTab?.planningSaveSnapshot?.status === 'pending'))}
              title={text('保存（Cmd+S）', 'Save (Cmd+S)')}
            >
              <Save size={12} />
              {text('保存', 'Save')}
            </Button>
          )}

          {/* 旧项目只可显式安全修复；不再从 Markdown 标题/排版提取角色卡。 */}
          {stepKey === 'characters' && canRepairRoster && !isArchRunning && rosterPresentation?.actionLabel && (
            <Button
              size="sm"
              disabled={extracting || !projectMatches}
              onClick={() => { void handleRepairCharacterRoster() }}
              className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:from-amber-600 hover:to-orange-600 border-none hover:shadow hover:-translate-y-[0.5px] transition-all"
              title={rosterPresentation.actionTitle}
            >
              {extracting
                ? <RefreshCw size={12} className="animate-spin opacity-90" />
                : <AlertTriangle size={12} className="opacity-90" />
              }
              {extracting ? text('处理中...', 'Working...') : rosterPresentation.actionLabel}
            </Button>
          )}

          {/* AI 生成按钮 */}
          {stepKey && meta && !recovery && (
            <Button
              variant="ai"
              size="sm"
              onClick={handleOpenDialog}
              disabled={checkingArch || !projectMatches}
              title={generated
                ? text(`AI 重新生成「${meta.label}」`, `AI Regenerate “${meta.labelEn}”`)
                : text(`AI 生成「${meta.label}」`, `AI Generate “${meta.labelEn}”`)}
            >
              {checkingArch ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generated ? text('AI 重新生成', 'AI Regenerate') : text('AI 生成', 'AI Generate')}
            </Button>
          )}
        </div>
      </div>

      {recovery && <div className="px-3 py-2 text-xs space-y-2" aria-label={text('大纲恢复', 'Outline recovery')}>
        {recoveryTab?.planningSaveSnapshot?.status === 'saved' && <p>{text('本次恢复已保存，后续修改仅供复制。', 'This recovery is saved. Further edits can only be copied.')}</p>}
        <p>{text('这是可编辑的恢复稿。保存只写入本地，不会调用模型。请用“## 第1章：标题”这样的章标题，保留连续完整章节。', 'Edit this recovery draft. Saving is local and does not call a model. Keep complete consecutive chapters with headings such as “## Chapter 1: Title”.')}</p>
        <label>{text('保存到第几章', 'Last complete chapter')} <input type="number" min={recovery.plotOutline?.range.from} max={recovery.plotOutline?.range.to} value={authorEnd} onChange={event => {
          const value = event.target.value
          authorEndRef.current = value; setAuthorEnd(value)
          useEditorStore.setState(state => ({ tabs: state.tabs.map(tab => tab.id === tabId ? { ...tab, planningSaveEnd: value } : tab) }))
        }} /></label>
        <p>{recovery.planningContinuation?.remainingRange
          ? text(`待完成第 ${recovery.planningContinuation.remainingRange.from} 至 ${recovery.planningContinuation.remainingRange.to} 章，每章目标 ${recovery.planningContinuation.targetUnits} ${planningTargetUnit}。`, `Chapters ${recovery.planningContinuation.remainingRange.from} to ${recovery.planningContinuation.remainingRange.to} remain. Target ${recovery.planningContinuation.targetUnits} ${planningTargetUnit} per chapter.`)
          : text('本次所选章节已保存。', 'The selected chapters are saved.')}</p>
        {recovery.plotOutlineRecovery?.writeState.kind === 'blocked' && <p>{text('生成尚在进行、来源已变化或本稿已保存时，不能覆盖正式内容。草稿仍可编辑和复制。', 'Active generation, changed sources or an already saved draft prevent replacing saved content. You can still edit and copy this draft.')}</p>}
        <button type="button" className="btn-secondary" disabled={continuing || saving || !projectMatches || !recovery.planningContinuation?.remainingRange || !['ready', 'continued'].includes(recovery.planningContinuation.state)} onClick={() => { void continuePlanning() }}>{text('继续生成缺少的章节', 'Generate remaining chapters')}</button>
        <details><summary>{text('原始候选', 'Original candidate')}</summary><pre className="whitespace-pre-wrap max-h-40 overflow-auto">{recoveryTab?.originalContent}</pre></details>
        {recoveryError && <p role="alert">{recoveryError}</p>}
      </div>}

      {/* E3 T12：连续生成单元 —— 进度 + 停止入口。
          「停止」只表示不再发下一批，当前这一批会写完（半路砍掉等于白烧一次生成）。 */}
      {projectMatches && unitChain && unitChain.projectPath === projectKey && (
        <div
          role="status"
          className="flex items-start gap-2 px-3 py-2 text-xs flex-shrink-0"
          style={{
            color: 'var(--color-text-secondary)',
            backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-accent) 25%, transparent)',
          }}
        >
          <Loader2 size={13} className={`flex-shrink-0 mt-0.5${unitChain.status === 'running' ? ' animate-spin' : ''}`} />
          <span className="flex-1">
            {unitChain.status === 'running'
              ? text(
                `连续生成中：第 ${Math.min(unitChain.launched, unitChain.total)}/${unitChain.total} 个单元 —— 这一批写完会自动接着写下一批，只到本卷末。`,
                `Chaining units: ${Math.min(unitChain.launched, unitChain.total)}/${unitChain.total} — the next batch starts automatically and stops at the volume end.`,
              )
              : text(
                `连续生成已停止（${Math.min(unitChain.launched, unitChain.total)}/${unitChain.total}）：`
                  + `${UNIT_CHAIN_STOP_COPY[unitChain.stopReason ?? 'manual'].zh}`,
                `Unit chaining stopped (${Math.min(unitChain.launched, unitChain.total)}/${unitChain.total}): `
                  + `${UNIT_CHAIN_STOP_COPY[unitChain.stopReason ?? 'manual'].en}`,
              )}
            {import.meta.env.DEV && unitChain.stopDetail ? `｜${unitChain.stopDetail}` : ''}
          </span>
          {unitChain.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[0.68rem] flex-shrink-0"
              onClick={() => useSynopsisUnitChainStore.getState().stop('manual')}
            >
              {text('停止连写', 'Stop chaining')}
            </Button>
          )}
          {unitChain.status !== 'running' && (
            <button
              type="button"
              className="flex-shrink-0 rounded p-0.5 mt-0.5"
              title={text('收起这条提示', 'Hide this notice')}
              aria-label={text('收起这条提示', 'Hide this notice')}
              onClick={() => useSynopsisUnitChainStore.getState().clear()}
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* 大纲已完成但尚未系统补过角色 → 常驻醒目提示（可关闭；绝不自动执行）。 */}
      {projectMatches && stepKey === 'synopsis' && !recovery && outlineCharacterNudge && (
        <div
          role="status"
          className="flex items-start gap-2 px-3 py-2 text-xs flex-shrink-0"
          style={{
            color: 'var(--color-warning)',
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
          }}
        >
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span className="flex-1">
            {text(OUTLINE_CHARACTER_NUDGE_COPY.banner.zh, OUTLINE_CHARACTER_NUDGE_COPY.banner.en)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[0.68rem] flex-shrink-0"
            onClick={() => { settleOutlineNudge(); useLayoutStore.getState().setSidebarView('characters') }}
          >
            {text(OUTLINE_CHARACTER_NUDGE_COPY.action.zh, OUTLINE_CHARACTER_NUDGE_COPY.action.en)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[0.68rem] flex-shrink-0"
            onClick={() => { void disableOutlineNudgeGlobally() }}
          >
            {text(OUTLINE_CHARACTER_NUDGE_COPY.dismiss.zh, OUTLINE_CHARACTER_NUDGE_COPY.dismiss.en)}
          </Button>
          {/* 关闭 ≠ 不再提示：只对当前这一稿生效，大纲一更新就回来。 */}
          <button
            type="button"
            className="flex-shrink-0 rounded p-0.5 mt-0.5"
            style={{ color: 'color-mix(in srgb, var(--color-warning) 70%, var(--color-text))' }}
            title={text(OUTLINE_CHARACTER_NUDGE_COPY.close.zh, OUTLINE_CHARACTER_NUDGE_COPY.close.en)}
            aria-label={text(OUTLINE_CHARACTER_NUDGE_COPY.close.zh, OUTLINE_CHARACTER_NUDGE_COPY.close.en)}
            onClick={settleOutlineNudge}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {projectMatches && stepKey === 'characters' && <LegacyRosterRecoveryPanel onRecover={handleRepairCharacterRoster} busy={extracting} />}
      {stepKey === 'characters' && rosterPresentation && (
        <div
          role="status"
          className="flex items-start gap-2 px-3 py-2 text-xs"
          style={{
            color: rosterPresentation.kind === 'ready' || rosterPresentation.kind === 'empty'
              ? 'var(--color-text-secondary)'
              : 'var(--color-warning-text)',
            backgroundColor: 'var(--color-editor-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {rosterPresentation.kind === 'ready' || rosterPresentation.kind === 'empty'
            ? <FileText size={13} className="flex-shrink-0 mt-0.5" />
            : <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />}
          <span><strong>{rosterPresentation.label}</strong> · {rosterPresentation.description}</span>
        </div>
      )}

      {isCharacterProjection && (
        <div
          role="note"
          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
          style={{
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-editor-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span>{text(
            '角色图谱由角色名单自动生成，只读展示。请到「角色管理」修改角色身份、资料和关系。',
            'The character graph is a read-only projection of the roster. Edit identity, profile, and relationships in Character Management.',
          )}</span>
          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={discardCharacterProjectionDraft}
              title={text('旧草稿可先复制；点击后明确放弃并加载当前角色图谱', 'Copy the legacy draft first; this explicitly discards it and loads the current character graph.')}
            >
              {text('放弃旧草稿并加载投影', 'Discard draft and load projection')}
            </Button>
          )}
        </div>
      )}

      {stepKey === 'plotStructure' && archEnumFallback && (
        <div
          role="note"
          className="flex items-start gap-2 px-3 py-2 text-xs"
          style={{
            color: 'var(--color-warning-text)',
            backgroundColor: 'var(--color-editor-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{text(
            '此内容由所选「故事结构」模板自动派生，并非本书记录的自由弧。不建议直接修改——一旦保存即转为本书专属的弧光结构（自由弧），此后不再随模板变化。若希望自定义本书的弧光推进，请直接编辑并保存；若只想沿用模板，可保持原样。',
            'This content is auto-derived from the selected story-structure template, not a custom arc saved for this book. Editing is not recommended — saving it converts it into this book’s own arc structure (free arc) and it will no longer follow the template. To customize this book, edit and save; to keep using the template, leave it unchanged.',
          )}</span>
        </div>
      )}

      {visibleBlockedMessage && (
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-2 text-xs"
          style={{
            color: 'var(--color-warning-text)',
            backgroundColor: 'var(--color-editor-bg)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span>{visibleBlockedMessage}</span>
        </div>
      )}

      {/* 内容区：pin 时左树右文；不 pin 时树是浮层抽屉（作者 2026-10-19 裁定） */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showArcTree && treeState.pinned && (
          <div className="w-64 flex-shrink-0 h-full">
            <ArcStructureTree
              tree={arcTree}
              onJumpLine={jumpToLine}
              pinned={treeState.pinned}
              expanded={treeState.expanded}
              onTogglePin={() => patchTreeState({ pinned: false })}
              onToggleVolume={toggleVolume}
              onExpandAll={expandAllVolumes}
              onCollapseAll={collapseAllVolumes}
            />
          </div>
        )}
        {showOutlineTree && outlineTreeState.pinned && (
          <div className="w-64 flex-shrink-0 h-full">
            <OutlineTreePanel
              tree={outlineTree}
              onJumpLine={jumpToLine}
              pinned={outlineTreeState.pinned}
              expanded={outlineTreeState.expanded}
              onTogglePin={() => patchOutlineTreeState({ pinned: false })}
              onToggleNode={toggleOutlineNode}
              onExpandAll={expandAllOutlineNodes}
              onCollapseAll={collapseAllOutlineNodes}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <CodeMirrorEditor
            mode="document"
            scrollMemoryKey={`arch-file:${tabId}`}
            revealLine={revealLine}
            content={editorContent}
            filePath={filePath}
            editable={!isCharacterProjection}
            onChange={isCharacterProjection ? undefined : handleChange}
            onSave={isCharacterProjection ? undefined : handleSave}
            onCharCountChange={setCharCount}
            hideStatusBar
            placeholder={text(
              '尚未生成内容，点击右上角「AI 生成」或直接在此编辑...',
              'No content yet. Click “AI Generate” in the top-right or start editing here...',
            )}
          />
          {/* 抽屉模式：浮在正文左侧，不占布局宽度 */}
          {showArcTree && !treeState.pinned && treeOpen && (
            <div
              className="absolute left-0 top-0 bottom-0 w-64 z-20 shadow-lg"
              style={{ backgroundColor: 'var(--color-editor-bg)' }}
            >
              <ArcStructureTree
                tree={arcTree}
                onJumpLine={jumpToLine}
                pinned={treeState.pinned}
                expanded={treeState.expanded}
                onTogglePin={() => patchTreeState({ pinned: true })}
                onToggleVolume={toggleVolume}
                onExpandAll={expandAllVolumes}
                onCollapseAll={collapseAllVolumes}
                onClose={() => setTreeOpen(false)}
              />
            </div>
          )}
          {showOutlineTree && !outlineTreeState.pinned && outlineTreeOpen && (
            <div
              className="absolute left-0 top-0 bottom-0 w-64 z-20 shadow-lg"
              style={{ backgroundColor: 'var(--color-editor-bg)' }}
            >
              <OutlineTreePanel
                tree={outlineTree}
                onJumpLine={jumpToLine}
                pinned={outlineTreeState.pinned}
                expanded={outlineTreeState.expanded}
                onTogglePin={() => patchOutlineTreeState({ pinned: true })}
                onToggleNode={toggleOutlineNode}
                onExpandAll={expandAllOutlineNodes}
                onCollapseAll={collapseAllOutlineNodes}
                onClose={() => setOutlineTreeOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* AI 生成确认弹窗 */}
      {stepKey && (
        <ArchitectureConfirmDialog
          isOpen={showDialog}
          onClose={() => setShowDialog(false)}
          archStatus={fullArchStatus}
          initialSelectedSteps={[stepKey]}
          synopsisCoveredTo={synopsisCoveredTo}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  )
}
