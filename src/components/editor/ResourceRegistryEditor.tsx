/**
 * 资源登记（W6a-5，2026-10-23）。
 *
 * ## 为什么单独一页
 *
 * W6a-0 最初把 `<ResourceRegistryPanel>` 嵌在「世界观」卡片下面（WorldBuildingEditor 的
 * `f.key === 'worldbuilding'` 分支）。实机截图（2026-10-23）确认那个位置**放不下**：
 * 面板是十列表格 + 候选确认区，挤在架构卡片列里名称列被压到只能看前几个字、
 * 「口径」列直接截断 —— 作者没法核对，也就没法确认候选。
 *
 * 所以它独立成一个 tab：左栏「故事架构」组内、世界观之后（`ProjectTree` 的
 * `WorldBuildingGroup`），拿到整块编辑区宽度。
 *
 * ## 它只负责「喂三份输入」
 *
 * 1. `worldbuilding`：抽出候选的**唯一**输入（不扫已定稿正文，设计稿 §4.6.5）；
 * 2. `storedCandidates`：生成世界观时写进检查点的那份提案（下一本那一路）；
 * 3. `writingLanguage`：提示词语言。
 *
 * 面板自己管草稿、候选、落库；本页不改任何数据，只有两个只读来源
 * （`db:project-core-get` + `fs:read-json partial_arch.json`）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Coins } from 'lucide-react'

import { CANONICAL_PROJECT_DIRECTORY } from '../../shared/project-format'
import { resolveWritingLanguage, type WritingLanguage } from '../../shared/writing-language'
import { globalEventBus } from '../../shared/event-bus'
import { ipc } from '../../services/ipc-client'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { ResourceRegistryPanel } from './ResourceRegistryPanel'
import { LatestRequestGate } from './latest-request-gate'

export function ResourceRegistryEditor({ projectKey }: { projectKey: string }) {
  const currentProject = useProjectStore(state => state.currentProject)
  const text = useLocaleStore(state => state.text)
  const projectMatches = currentProject?.path === projectKey
  const [worldbuilding, setWorldbuilding] = useState('')
  const [storedCandidates, setStoredCandidates] = useState('')
  const [writingLanguage, setWritingLanguage] = useState<WritingLanguage>('zh-CN')
  const requestGate = useRef(new LatestRequestGate())

  const load = useCallback(async () => {
    await Promise.resolve()
    const projectSession = captureProjectSession(currentProject)
    if (!projectMatches || !projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      requestGate.current.begin()
      setWorldbuilding('')
      setStoredCandidates('')
      return
    }
    const projectPath = projectSession.projectPath
    const requestId = requestGate.current.begin()
    const core = await ipc.invokeWithProjectSession(projectSession, 'db:project-core-get', projectPath).catch(() => null)
    const partialResult = await ipc.invokeWithProjectSession(
      projectSession,
      'fs:read-json',
      `${projectPath}/${CANONICAL_PROJECT_DIRECTORY}/partial_arch.json`,
      projectPath,
    ).catch(() => null)
    // 两次读之间可能切了项目：迟到的结果不能写进新项目的 state。
    if (!requestGate.current.isLatest(requestId) || !isProjectSessionCurrent(projectSession)) return
    const partial = partialResult?.success === true
      ? (partialResult as { data?: Record<string, unknown> }).data
      : undefined
    setWorldbuilding(core?.worldbuilding || '')
    setStoredCandidates(typeof partial?.world_building_resource_candidates === 'string'
      ? partial.world_building_resource_candidates
      : '')
    setWritingLanguage(resolveWritingLanguage(
      core?.writingLanguage ?? currentProject?.novelConfig?.writingLanguage,
    ))
  }, [currentProject, projectKey, projectMatches])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timer)
  }, [load])

  // 世界观被改写（作者存盘 / 生成写库）后要重读：候选的引文校验以当前正文为准。
  useEffect(() => {
    const refreshIfCurrentProject = () => {
      const projectSession = captureProjectSession(currentProject)
      if (!projectSession || !isProjectSessionCurrent(projectSession)) return
      if (!isProjectSessionPath(projectSession, projectKey)) return
      void load()
    }
    const unsubUpdated = globalEventBus.on('ARCH_FILE_UPDATED', refreshIfCurrentProject)
    const unsubComplete = globalEventBus.on('WORKFLOW_COMPLETE', refreshIfCurrentProject)
    return () => { unsubUpdated(); unsubComplete() }
  }, [currentProject, load, projectKey])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
          <Coins size={14} />
          {text('资源登记', 'Resource registry')}
        </h2>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '这里登记的是资源定义（名称、单位、口径、换算关系），也就是账本唯一的权威值来源。登记完去「世界状态 → 资源」补扫，账本才会从已定稿正文里抽出变动。',
            'Resource definitions live here (name, unit, period, conversion) and are the ledger’s only source of authority. Register them, then run the backfill under World state → Resources so movements are extracted from finalized chapters.',
          )}
        </p>
      </div>
      <ResourceRegistryPanel
        projectKey={projectKey}
        worldbuilding={worldbuilding}
        storedCandidates={storedCandidates}
        writingLanguage={writingLanguage}
      />
    </div>
  )
}

export default ResourceRegistryEditor
