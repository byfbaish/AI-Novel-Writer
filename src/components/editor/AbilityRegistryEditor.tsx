import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocaleStore } from '../../stores/locale-store'
import { useProjectStore } from '../../stores/project-store'
import { globalEventBus } from '../../shared/event-bus'
import { ipc } from '../../services/ipc-client'
import { captureProjectSession, isProjectSessionCurrent, isProjectSessionPath } from '../project-session-gate'
import { AbilityRegistryPanel } from './AbilityRegistryPanel'
import { LatestRequestGate } from './latest-request-gate'

/**
 * P1-1 能力登记页（独立 tab）。
 *
 * 与关键物品、制度、知情登记同一类入口：都是「世界观的产物清单」，塞不进世界观卡片
 * （W6a-5 的实机教训：十列以上的表格嵌在卡片里会被截断）。
 *
 * ## 本页只喂一份输入：`worldbuilding`
 *
 * 它是 P20-1a 能力候选的**唯一**来源（第 1 维等级表）。刻意**不读** `partial_arch.json`：
 * 资源那条读它是因为要取「生成世界观时模型写的那份提案」，而 1a 是**零模型确定性解析**，
 * 拿到世界观就能现算，多一个来源就多一处「两份候选打架」的可能。
 */
export function AbilityRegistryEditor({ projectKey }: { projectKey: string }) {
  const currentProject = useProjectStore(state => state.currentProject)
  const text = useLocaleStore(state => state.text)
  const projectMatches = currentProject?.path === projectKey
  const [worldbuilding, setWorldbuilding] = useState('')
  const requestGate = useRef(new LatestRequestGate())

  const load = useCallback(async () => {
    await Promise.resolve()
    const projectSession = captureProjectSession(currentProject)
    if (!projectMatches || !projectSession || !isProjectSessionPath(projectSession, projectKey)) {
      requestGate.current.begin()
      setWorldbuilding('')
      return
    }
    const requestId = requestGate.current.begin()
    const core = await ipc.invokeWithProjectSession(
      projectSession,
      'db:project-core-get',
      projectSession.projectPath,
    ).catch(() => null)
    // 读的期间可能切了项目：迟到的结果不能写进新项目的 state。
    if (!requestGate.current.isLatest(requestId) || !isProjectSessionCurrent(projectSession)) return
    setWorldbuilding(core?.worldbuilding || '')
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
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {text('能力（本书的能力规则）', 'Abilities (book-level rules)')}
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          {text(
            '登记金手指、体系漏洞、宝物权限这类「属于这本书」的规则：能做什么、要付什么、什么情况下会被破。角色技能留在角色卡里，这里不重复登记。',
            'Register book-level rules such as the golden finger, system loopholes, and artifact permissions: what it does, what it costs, how it breaks. Character skills stay on character cards.',
          )}
        </p>
      </div>
      <AbilityRegistryPanel projectKey={projectKey} worldbuilding={worldbuilding} />
    </div>
  )
}

export default AbilityRegistryEditor
