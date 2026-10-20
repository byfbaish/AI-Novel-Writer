import { type ReactNode, useEffect } from 'react'
import { type Theme, useThemeStore } from './stores/theme-store'
import { useLayoutStore } from './stores/layout-store'
import { useLLMStore } from './stores/llm-store'
import { useProjectStore } from './stores/project-store'
import { useMCPStore } from './stores/mcp-store'
import { useWorkflowStore } from './stores/workflow-store'
import { useLocaleStore } from './stores/locale-store'
import { useSkinStore } from './stores/skin-store'
import { ipc } from './services/ipc-client'
import TitleBar from './components/layout/TitleBar'
import StatusBar from './components/layout/StatusBar'
import LeftToolWindowBar from './components/layout/LeftToolWindowBar'
import RightToolWindowBar from './components/layout/RightToolWindowBar'
import ShellV2 from './components/layout/v2/ShellV2'
import Sidebar from './components/panels/Sidebar'
import EditorArea from './components/panels/EditorArea'
import AIPanel from './components/panels/AIPanel'
import AIOutputPanel from './components/panels/AIOutputPanel'
import BottomPanel from './components/panels/BottomPanel'
import NewProjectDialog from './components/dialogs/NewProjectDialog'
import ImportNovelDialog from './components/dialogs/ImportNovelDialog'
import ChapterCreationDialog from './components/dialogs/ChapterCreationDialog'
import ExportDialog from './components/dialogs/ExportDialog'
import SettingsModal from './components/settings/SettingsModal'
import { ANIME_SKIN_URL } from './components/settings/AppearanceSettings'
import { ErrorBoundary } from './components/ErrorBoundary'
import { actionToast } from './components/ui/ActionToast'
import { UpdateNotifier } from './components/updates/UpdateNotifier'
import { globalEventBus } from './shared/event-bus'
import {
  projectSessionContextFromProject,
  sameProjectSessionContext,
} from './shared/project-session-context'
import { getAutoNextChapterPrefill, type NextChapterBlueprint } from './services/auto-next-chapter'
import { pendingBlueprintCandidates } from './services/character-card-generation-sources'
import {
  OUTLINE_CHARACTER_NUDGE_COPY,
  dismissOutlineCharacterNudge,
  publishOutlineCharacterNudgeConfig,
  readOutlineCharacterNudgeDismissedVersion,
  shouldNudgeOutlineCharacterSupplement,
} from './services/architecture-character-nudge'
import { useSynopsisUnitChainStore } from './stores/synopsis-unit-chain-store'
import { probeSynopsisUnitLaunchForProject } from './services/workflows/synopsis-unit-launch'
import { formatChapterPosition } from './shared/chapter-position'
import { decideUnitChainStep, UNIT_CHAIN_STOP_COPY, type UnitChainStopReason } from './services/workflows/synopsis-unit-chain'
import { launchCreativeWorkflow } from './services/workflows/creative-workflow-launcher'
import type { BlueprintCharacterSyncOperation } from '../electron/repositories/blueprint-repository'
import type { SkinId } from './shared/skin-types'

// eslint-disable-next-line react-refresh/only-export-components
export function resolveSkinBackgroundUrl(skinId: SkinId, customUrl: string | null): string | null {
  if (skinId === 'anime') return ANIME_SKIN_URL
  if (skinId === 'custom') return customUrl
  return null
}

/**
 * E3 T12：批次之间必须等上一批**真正退出活跃列表**再发下一批。
 *
 * `WORKFLOW_COMPLETE` 是在清理 `activeRuns` **之前**同步广播的（workflow-store 里
 * 那句注释写得很清楚），而资源冲突判定不看 run 状态 —— 立刻发下一批会撞上自己刚写完的那批。
 */
async function waitForRunReleased(runId: string, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!useWorkflowStore.getState().activeRuns.some(run => run.id === runId)) return true
    await new Promise(resolve => setTimeout(resolve, 120))
  }
  return false
}

/** The sole decorative skin layer at the App root. It never participates in accessibility. */
export function SkinBackgroundLayer({
  skinId,
  backgroundUrl,
  onImageError,
}: {
  skinId: SkinId
  backgroundUrl: string | null
  onImageError?: () => void
}) {
  const imageUrl = resolveSkinBackgroundUrl(skinId, backgroundUrl)
  return (
    <div
      aria-hidden="true"
      data-skin-background={skinId}
      className="app-skin-background"
    >
      {imageUrl && <img src={imageUrl} alt="" className="app-skin-background-image" onError={onImageError} />}
    </div>
  )
}

/** Stable root semantics let image skins opt into their own readability tokens for every color theme. */
export function AppSkinRoot({
  theme,
  skinId,
  children,
}: {
  theme: Theme
  skinId: SkinId
  children: ReactNode
}) {
  return (
    <div
      className="app-skin-root flex flex-col w-full h-full overflow-hidden"
      data-theme={theme}
      data-skin={skinId}
      data-skin-readability={skinId === 'classic' ? 'theme-default' : 'high-contrast'}
    >
      {children}
    </div>
  )
}

/**
 * 主应用组件
 * 使用 react-resizable-panels 实现可拖拽调整大小的四区布局
 */
export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const initLocale = useLocaleStore((s) => s.init)
  const text = useLocaleStore((s) => s.text)
  const sidebarOpen = useLayoutStore(s => s.sidebarOpen)
  const sidebarView = useLayoutStore(s => s.sidebarView)
  const currentProject = useProjectStore(s => s.currentProject)
  const aiPanelOpen = useLayoutStore(s => s.aiPanelOpen)
  const bottomPanelOpen = useLayoutStore(s => s.bottomPanelOpen)
  const immersive = useLayoutStore(s => s.immersive)
  const rightView = useLayoutStore(s => s.rightView)
  const settingsOpen = useLayoutStore(s => s.settingsOpen)
  const closeSettings = useLayoutStore(s => s.closeSettings)
  const newProjectOpen = useLayoutStore(s => s.newProjectOpen)
  const closeNewProject = useLayoutStore(s => s.closeNewProject)
  const exportOpen = useLayoutStore(s => s.exportOpen)
  const closeExport = useLayoutStore(s => s.closeExport)
  const importNovelOpen = useLayoutStore(s => s.importNovelOpen)
  const closeImportNovel = useLayoutStore(s => s.closeImportNovel)
  const chapterCreationOpen = useLayoutStore(s => s.chapterCreationOpen)
  const chapterCreationPrefill = useLayoutStore(s => s.chapterCreationPrefill)
  const closeChapterCreation = useLayoutStore(s => s.closeChapterCreation)
  const initLLM = useLLMStore((s) => s.init)
  const loadRecentProjects = useProjectStore((s) => s.loadRecentProjects)
  const skinState = useSkinStore((s) => s.skinState)
  const skinBackgroundUrl = useSkinStore((s) => s.backgroundUrl)
  const initSkin = useSkinStore((s) => s.init)
  const disposeSkin = useSkinStore((s) => s.dispose)
  const recoverFromImageFailure = useSkinStore((s) => s.recoverFromImageFailure)

  // 初始化：主题 + LLM 模型 + 最近项目 + 缩放级别
  useEffect(() => {
    initLocale()
    initTheme()
    initLLM()
    loadRecentProjects()
    // 初始化 MCP Store
    useMCPStore.getState().init().catch(e => console.warn('[MCP] 初始化失败:', e))
    // 初始化 ProjectService — 注册全局事件监听（生命周期与 App 一致）
    import('./services/project-service').then(({ initProjectService }) => {
      initProjectService()
    }).catch(e => console.warn('[ProjectService] 初始化失败:', e))

    // C) 工作流完成时弹出 ActionToast 通知（不依赖任何面板状态）
    const unsubActionToast = globalEventBus.on('WORKFLOW_COMPLETE', ({ projectSession, runId }) => {
      if (!sameProjectSessionContext(
        projectSession,
        projectSessionContextFromProject(useProjectStore.getState().currentProject),
      )) return
      const text = useLocaleStore.getState().text
      const { activeRuns, history } = useWorkflowStore.getState()
      const completedRun = activeRuns.find(r => r.id === runId)
        ?? history.find(r => r.id === runId)
      if (!completedRun) return
      actionToast.workflowComplete(
        text(`「${completedRun.title}」已完成`, `“${completedRun.title}” completed`),
        () => useLayoutStore.getState().openRightPanel('ai-output')
      )
    })

    const unsubAutoOpenNextChapter = globalEventBus.on('FINALIZE_COMPLETE', ({      chapterNumber,
      projectSession,
      source,
    }) => {
      void (async () => {
        try {
          if (source === 'batch') return
          const isCurrentProjectSession = () => sameProjectSessionContext(
            projectSession,
            projectSessionContextFromProject(useProjectStore.getState().currentProject),
          )
          if (!isCurrentProjectSession()) return
          const config = await ipc.invoke('config:get')
          if (!isCurrentProjectSession()) return
          if (!config.autoOpenNextChapterAfterFinalize) return

          const nextChapterNumber = chapterNumber + 1
          const [blueprint, existingDraft] = await Promise.all([
            ipc.invokeWithProjectSession(
              projectSession,
              'db:blueprint-get',
              nextChapterNumber,
              projectSession.projectPath,
            ),
            ipc.invokeWithProjectSession(
              projectSession,
              'db:draft-get-latest',
              nextChapterNumber,
              projectSession.projectPath,
            ),
          ])
          if (!isCurrentProjectSession()) return
          const prefill = getAutoNextChapterPrefill(
            true,
            chapterNumber,
            blueprint as NextChapterBlueprint | null,
            existingDraft !== null,
          )
          if (prefill) useLayoutStore.getState().openChapterCreation(prefill)
        } catch (error) {
          console.warn('[AutoNextChapter] 无法打开下一章创作窗口:', error)
        }
      })()
    })

    // P1: after a blueprint commit, offer to build the newly declared characters.
    // The prompt is best-effort — a failure must never disturb the finished run.
    const unsubBlueprintCharacterPrompt = globalEventBus.on('WORKFLOW_COMPLETE', ({ projectSession, runId }) => {
      void (async () => {
        try {
          if (!sameProjectSessionContext(
            projectSession,
            projectSessionContextFromProject(useProjectStore.getState().currentProject),
          )) return
          const { activeRuns, history } = useWorkflowStore.getState()
          const run = activeRuns.find(r => r.id === runId) ?? history.find(r => r.id === runId)
          if (!run || (run.type !== 'directory' && run.type !== 'novel_import')) return
          const config = await ipc.invoke('config:get')
          if (config.autoPromptBlueprintCharacterSync === false) return
          if (!sameProjectSessionContext(
            projectSession,
            projectSessionContextFromProject(useProjectStore.getState().currentProject),
          )) return
          const [operations, cards, declined] = await Promise.all([
            // 全量而非 pending：completion 只说明"提议已暂存过"，未决定的候选仍是待办。
            ipc.invokeWithProjectSession(projectSession, 'db:blueprint-character-sync-list-all', projectSession.projectPath),
            ipc.invokeWithProjectSession(projectSession, 'db:character-get-all', projectSession.projectPath),
            ipc.invokeWithProjectSession(projectSession, 'character-proposal:list-declined'),
          ])
          if (!sameProjectSessionContext(
            projectSession,
            projectSessionContextFromProject(useProjectStore.getState().currentProject),
          )) return
          const pending = pendingBlueprintCandidates(
            operations as BlueprintCharacterSyncOperation[],
            (cards as { name: string }[]).map(card => card.name),
            declined as string[],
          )
          // No candidates means no prompt: an empty notice is pure noise.
          if (!pending.length) return
          const text = useLocaleStore.getState().text
          actionToast.workflowComplete(
            text(
              `发现 ${pending.length} 个待建卡角色（${pending.slice(0, 3).map(candidate => candidate.name).join('、')}${pending.length > 3 ? ' 等' : ''}）`,
              `${pending.length} character(s) awaiting cards (${pending.slice(0, 3).map(candidate => candidate.name).join(', ')}${pending.length > 3 ? ', …' : ''})`,
            ),
            () => useLayoutStore.getState().setSidebarView('characters'),
          )
        } catch (error) {
          console.warn('[BlueprintCharacterPrompt] 无法读取待建卡角色:', error)
        }
      })()
    })

    // 情节大纲生成后：**强烈建议**补一次角色卡，但绝不自动执行（大纲可能还要改）。
    //
    // 收尾三档（作者 2026-10-20 定调：点一次就永久消失不符合常理）：
    //   · 「去补角色卡」：这一稿算处理过了，跳到角色管理；
    //   · 「稍后」：这一稿先放一放 —— 大纲一旦更新（新批次 / 改章节）会再来；
    //   · 「不再提示」：关掉全局开关 `autoPromptOutlineCharacterSupplement`，
    //     与 设置 → 编辑器 里那个开关是同一份状态，随时能在那里打开回来。
    // 判据是「大纲稿本指纹」，所以同一份大纲不会被反复打扰，改过的大纲才会重新提示。
    const unsubOutlineCharacterNudge = globalEventBus.on('WORKFLOW_COMPLETE', ({ projectSession, runId }) => {
      void (async () => {
        try {
          const isCurrentProjectSession = () => sameProjectSessionContext(
            projectSession,
            projectSessionContextFromProject(useProjectStore.getState().currentProject),
          )
          if (!isCurrentProjectSession()) return
          const { activeRuns, history } = useWorkflowStore.getState()
          const run = activeRuns.find(r => r.id === runId) ?? history.find(r => r.id === runId)
          if (!run || run.type !== 'architecture_generation') return
          const config = await ipc.invoke('config:get')
          if (!isCurrentProjectSession()) return
          if (config.autoPromptOutlineCharacterSupplement === false) return
          const core = await ipc.invokeWithProjectSession(
            projectSession,
            'db:project-core-get',
            projectSession.projectPath,
          ) as { synopsis?: string } | null
          if (!isCurrentProjectSession()) return
          const projectPath = projectSession.projectPath
          const synopsis = core?.synopsis
          if (!shouldNudgeOutlineCharacterSupplement({
            synopsis,
            dismissedVersion: readOutlineCharacterNudgeDismissedVersion(projectPath),
          })) return
          const text = useLocaleStore.getState().text
          /** 只处理「这一稿」：大纲更新后自动重新提示。 */
          const settleThisDraft = () => dismissOutlineCharacterNudge(projectPath, synopsis)
          /** 真的不再显示：关全局开关 + 告诉作者去哪儿打开回来。 */
          const turnOffEverywhere = async () => {
            settleThisDraft()
            try {
              const result = await ipc.invoke('config:set', { autoPromptOutlineCharacterSupplement: false })
              if (result && result.success === false) throw new Error(result.error || text('未知错误', 'Unknown error'))
              publishOutlineCharacterNudgeConfig(true)
              actionToast.show({
                type: 'info',
                duration: 8000,
                message: text(OUTLINE_CHARACTER_NUDGE_COPY.dismissedHint.zh, OUTLINE_CHARACTER_NUDGE_COPY.dismissedHint.en),
              })
            } catch (error) {
              console.warn('[OutlineCharacterNudge] 关闭全局提示失败:', error)
              actionToast.show({
                type: 'warning',
                duration: 8000,
                message: text(
                  `关闭提示失败：${error instanceof Error ? error.message : String(error)}`,
                  `Could not turn the reminder off: ${error instanceof Error ? error.message : String(error)}`,
                ),
              })
            }
          }
          actionToast.show({
            type: 'warning',
            duration: 0,
            message: text(OUTLINE_CHARACTER_NUDGE_COPY.toast.zh, OUTLINE_CHARACTER_NUDGE_COPY.toast.en),
            actions: [
              {
                label: text(OUTLINE_CHARACTER_NUDGE_COPY.action.zh, OUTLINE_CHARACTER_NUDGE_COPY.action.en),
                onClick: () => {
                  settleThisDraft()
                  useLayoutStore.getState().setSidebarView('characters')
                },
              },
              {
                label: text(OUTLINE_CHARACTER_NUDGE_COPY.later.zh, OUTLINE_CHARACTER_NUDGE_COPY.later.en),
                variant: 'ghost',
                onClick: settleThisDraft,
              },
              {
                label: text(OUTLINE_CHARACTER_NUDGE_COPY.dismiss.zh, OUTLINE_CHARACTER_NUDGE_COPY.dismiss.en),
                variant: 'ghost',
                onClick: turnOffEverywhere,
              },
            ],
          })
        } catch (error) {
          console.warn('[OutlineCharacterNudge] 无法检查角色补充提醒:', error)
        }
      })()
    })

    // E3 T12：连续单元（**链式新 run**）。每批写完都重新探一次检查点，算出下一个单元再发一批。
    // 三条铁律：① 只认自己这一批的 runId（别的架构 run 不许推进这条链）；
    // ② 每批重新读检查点（游标会动，不能缓存）；③ 换卷就停（v1 只连到本卷末）。
    // 调度放 App 而不是大纲页：那个组件会被切走、会被卸载，链不能跟着断。
    const unsubUnitChainStep = globalEventBus.on('WORKFLOW_COMPLETE', ({ projectSession, runId }) => {
      const chain = useSynopsisUnitChainStore.getState().chain
      if (!chain || chain.status !== 'running' || chain.runId !== runId) return
      void (async () => {
        const text = useLocaleStore.getState().text
        const stopChain = (reason: UnitChainStopReason, detail: string | null) => {
          useSynopsisUnitChainStore.getState().stop(reason, detail)
          const copy = UNIT_CHAIN_STOP_COPY[reason]
          actionToast.show({
            type: 'info',
            duration: 8000,
            message: text(`连续生成结束：${copy.zh}`, `Unit chaining finished: ${copy.en}`),
          })
        }
        if (!sameProjectSessionContext(
          projectSession,
          projectSessionContextFromProject(useProjectStore.getState().currentProject),
        )) {
          stopChain('project-changed', null)
          return
        }
        try {
          // 先等上一批退出活跃列表：资源冲突判定不看状态，抢跑必撞自己。
          if (!await waitForRunReleased(runId)) {
            stopChain('failed', '上一批没有退出活跃任务，本次未发起下一批')
            return
          }
          const totalChapters = Number(useProjectStore.getState().currentProject?.novelConfig?.totalChapters)
          const probe = await probeSynopsisUnitLaunchForProject({ projectSession, totalChapters })
          // 探针期间作者可能点了「停止连写」：重新读一遍，别拿旧快照推进。
          const live = useSynopsisUnitChainStore.getState().chain
          if (!live || live.status !== 'running' || live.runId !== runId) return
          const decision = decideUnitChainStep({
            chain: live,
            next: probe.unit ? { volumeIndex: probe.volume?.index ?? null } : null,
            probeReason: probe.reason,
          })
          if (decision.action === 'stop') {
            stopChain(decision.reason ?? 'no-unit', decision.detail)
            return
          }
          const receipt = await launchCreativeWorkflow({
            workflow: 'generate_architecture',
            selectedSteps: ['synopsis'],
            // 作者的补充指导与目标字数**每批都重放**，否则第二批起口径就变了。
            stepGuidance: live.stepGuidance,
            ...(live.targetUnits === null ? {} : { targetUnits: live.targetUnits }),
            synopsisUnit: probe.unit!,
          }, projectSession)
          useSynopsisUnitChainStore.getState().advance(receipt.runId)
          console.warn(`[E3] 连写：下一批已发起（${formatChapterPosition({
            chapter: probe.unit!.from,
            volumeIndex: probe.volume?.index,
            unitIndex: probe.unit!.unitIndex,
          }, 'zh-CN')}）`)
        } catch (error) {
          stopChain('failed', error instanceof Error ? error.message : String(error))
        }
      })()
    })

    // 失败与取消都不发 WORKFLOW_COMPLETE，只能盯 store：当前批次一失败就停链，
    // 否则链会挂在那里等一个永远不来的完成事件。
    const unsubUnitChainFailure = useWorkflowStore.subscribe((state) => {
      const chain = useSynopsisUnitChainStore.getState().chain
      if (!chain || chain.status !== 'running' || !chain.runId) return
      const run = state.activeRuns.find(item => item.id === chain.runId)
        ?? state.history.find(item => item.id === chain.runId)
      if (!run || run.status !== 'failed') return
      useSynopsisUnitChainStore.getState().stop('failed', run.error ?? null)
    })

    return () => {
      // App 卸载时销毁 ProjectService（开发环境 HMR 时会触发）
      import('./services/project-service').then(({ disposeProjectService }) => {
        disposeProjectService()
      }).catch(() => {})
      unsubActionToast()
      unsubAutoOpenNextChapter()
      unsubBlueprintCharacterPrompt()
      unsubOutlineCharacterNudge()
      unsubUnitChainStep()
      unsubUnitChainFailure()
    }
  }, [initLocale, initTheme, initLLM, loadRecentProjects])

  useEffect(() => {
    if (!ipc.isElectron) return undefined
    void initSkin()
    return disposeSkin
  }, [disposeSkin, initSkin])

  useEffect(() => {
    if (!ipc.isElectron) return
    void ipc.invoke('project:smoke-open-request').then(async (request) => {
      if (!request) return
      const opened = await useProjectStore.getState().openProject(request.projectPath)
      if (!opened) throw new Error('烟测项目打开失败')
      const confirmed = await ipc.invoke('project:smoke-open-confirm', request.projectPath)
      if (!confirmed.success) throw new Error(confirmed.error || '烟测项目确认失败')
    }).catch(error => console.error('[SmokeProjectOpen]', error))
  }, [])

  // 全局快捷键: Cmd+N 新建项目，Cmd+O 打开项目
  // 注意：Cmd+=/- 缩放已由 TitleBar.tsx 统一处理，此处不重复注册
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        useLayoutStore.getState().openNewProject()
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        const folder = await ipc.invoke('dialog:select-folder', 'project-open')
        if (folder) {
          useProjectStore.getState().openProject(folder)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <AppSkinRoot theme={resolvedTheme} skinId={skinState.activeSkin}>
      <SkinBackgroundLayer
        skinId={skinState.activeSkin}
        backgroundUrl={skinBackgroundUrl}
        onImageError={() => void recoverFromImageFailure()}
      />
      <UpdateNotifier />
      <ShellV2
        home={!currentProject || sidebarView === 'home'}
        theme={resolvedTheme}
        titleBar={<TitleBar />}
        rail={<LeftToolWindowBar />}
        sidebar={(
          <ErrorBoundary fallbackLabel={text('侧边栏渲染失败', 'Sidebar failed to render')}>
            <Sidebar />
          </ErrorBoundary>
        )}
        editor={(
          <ErrorBoundary fallbackLabel={text('编辑区渲染失败', 'Editor failed to render')}>
            <EditorArea onNewProject={() => useLayoutStore.getState().openNewProject()} />
          </ErrorBoundary>
        )}
        aiPanel={(
          <ErrorBoundary fallbackLabel={text('AI 面板渲染失败', 'AI panel failed to render')}>
            {rightView === 'ai-output' ? <AIOutputPanel /> : <AIPanel />}
          </ErrorBoundary>
        )}
        bottom={<BottomPanel />}
        statusBar={<StatusBar />}
        rightRail={<RightToolWindowBar />}
        sidebarOpen={sidebarOpen}
        aiPanelOpen={aiPanelOpen}
        bottomOpen={bottomPanelOpen}
        immersive={immersive}
      />

      {/* 全局对话框 — 由 layout-store 控制开关，不再依赖 window.dispatchEvent */}
      <NewProjectDialog
        open={newProjectOpen}
        onClose={closeNewProject}
      />
      <ImportNovelDialog
        open={importNovelOpen}
        onClose={closeImportNovel}
      />
      <ChapterCreationDialog
        isOpen={chapterCreationOpen}
        prefill={chapterCreationPrefill}
        onClose={closeChapterCreation}
      />
      <ExportDialog
        isOpen={exportOpen}
        onClose={closeExport}
      />
      {/* 全屏设置弹窗 */}
      <SettingsModal
        open={settingsOpen}
        onClose={closeSettings}
      />

    </AppSkinRoot>
  )
}
