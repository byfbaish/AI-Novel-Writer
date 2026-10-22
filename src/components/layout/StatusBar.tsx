import { useState, useEffect } from 'react'
import { Wifi, CheckCircle2, Zap, ScrollText, Cpu } from 'lucide-react'
import { useLLMStore } from '../../stores/llm-store'
import { useLayoutStore, type BottomTab } from '../../stores/layout-store'
import { useWorkflowStore } from '../../stores/workflow-store'
import { useLocaleStore } from '../../stores/locale-store'

/** 底部工具窗的三个 Tab 在状态栏左下角的入口配置 */
const bottomEntries: Array<{ id: BottomTab; icon: typeof Zap; zh: string; en: string }> = [
  { id: 'tasks',  icon: Zap,        zh: '任务', en: 'Tasks' },
  { id: 'log',    icon: ScrollText, zh: '日志', en: 'Logs' },
  { id: 'models', icon: Cpu,        zh: '模型', en: 'Models' },
]

/**
 * 底部状态栏。
 *
 * 左下角是「任务 / 日志 / 模型」三个底部工具窗入口（2026-10-22 作者要求挪到下方）。
 * 为什么落在状态栏而不是底栏内容区旁边：底栏内容区随面板开合整体消失，
 * **承担不了自己的入口** —— W5 宽屏改造时移除左栏四按钮后全应用没有任何入口，
 * 表现就是「下方什么都没有」。状态栏永远渲染，是唯一可靠的位置。
 *
 * 其余精简原则（2026-10-22 作者裁定，仍然有效）：
 * - 品牌 + 版本号：标题栏与「关于」里都有，重复。
 * - 当前项目名：标题栏已显示，重复。
 * - 「重载提示词」：提示词在设置里改完在设置里刷新才成闭环，已移除。
 * 右侧仍是「AI 任务胶囊 + 当前模型」。
 */
export default function StatusBar() {
  const models = useLLMStore(s => s.models)
  const defaultModelId = useLLMStore(s => s.defaultModelId)
  const openSettings = useLayoutStore(s => s.openSettings)
  const bottomTab = useLayoutStore(s => s.bottomTab)
  const bottomPanelOpen = useLayoutStore(s => s.bottomPanelOpen)
  const openBottomTab = useLayoutStore(s => s.openBottomTab)
  const toggleBottomPanel = useLayoutStore(s => s.toggleBottomPanel)
  const activeRuns = useWorkflowStore(s => s.activeRuns)
  const defaultModel = models.find(
    (m) => m.id === defaultModelId && m.purposes?.some((p) => p !== 'embedding')
  )
  const text = useLocaleStore(s => s.text)

  return (
    <div
      className="writer-statusbar no-select flex items-center justify-between"
      style={{
        height: 'var(--height-statusbar)',
        fontSize: "0.75rem",
        flexShrink: 0,
      }}
    >
      {/* 左下角：底部工具窗入口（任务 / 日志 / 模型） */}
      <div className="flex items-center h-full">
        {bottomEntries.map(({ id, icon: Icon, zh, en }) => {
          const active = bottomPanelOpen && bottomTab === id
          const hasPending = activeRuns.some(r => r.status === 'running' || r.status === 'waiting')
          return (
            <button
              key={id}
              className="writer-statusbar-segment flex items-center gap-1 px-2 h-full transition-colors"
              style={{
                cursor: 'pointer',
                color: active ? 'var(--color-accent)' : undefined,
                boxShadow: active ? 'inset 0 -2px 0 var(--color-accent)' : 'none',
              }}
              title={text(
                active ? `收起${zh}` : `打开${zh}`,
                active ? `Hide ${en.toLowerCase()}` : `Show ${en.toLowerCase()}`,
              )}
              onClick={() => (active ? toggleBottomPanel() : openBottomTab(id))}
            >
              <Icon size={11} strokeWidth={active ? 2 : 1.5} />
              <span>{text(zh, en)}</span>
              {id === 'tasks' && hasPending && (
                <span
                  className="w-[5px] h-[5px] rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* 右侧：AI 胶囊 + 模型名 */}
      <div className="flex items-center h-full">
        {/* AI 任务胶囊指示器（右下角） */}
        <AITaskCapsule />

        {defaultModel ? (
          <StatusBarSegment
            title={text(`当前模型：${defaultModel.name}`, `Current model: ${defaultModel.name}`)}
            onClick={() => openSettings()}
          >
            <Wifi size={11} />
            <span className="opacity-80 max-w-[120px] truncate">{defaultModel.name}</span>
          </StatusBarSegment>
        ) : (
          <StatusBarSegment
            title={text('点击配置模型', 'Click to configure a model')}
            onClick={() => openSettings()}
          >
            <span className="opacity-50">{text('未配置模型', 'No model configured')}</span>
          </StatusBarSegment>
        )}
      </div>
    </div>
  )
}


// ===== AI 任务胶囊指示器（Layer 1）=====

/**
 * StatusBar 中心区域的 AI 工作流胶囊
 * - 无任务时不渲染
 * - 有任务时显示步骤名 + 微型进度条 + 百分比
 * - 多任务时显示 "N个任务运行中"
 * - 完成后短暂显示完成态然后淡出
 */
function AITaskCapsule() {
  const text = useLocaleStore(s => s.text)
  // 使用 selector 精确订阅，避免 globalLogs 等高频字段导致被动重渲染
  const activeRuns = useWorkflowStore(s => s.activeRuns)
  const getActiveStepInfo = useWorkflowStore(s => s.getActiveStepInfo)
  // 使用 string 而非 object，避免引用变化导致不必要的 effect 重触发
  const [completedTitle, setCompletedTitle] = useState<string | null>(null)

  // 监听任务从有到无的转换，短暂显示完成态
  useEffect(() => {
    if (activeRuns.length === 0 && completedTitle) {
      const timer = setTimeout(() => setCompletedTitle(null), 1800)
      return () => clearTimeout(timer)
    }
  }, [activeRuns.length, completedTitle])

  // 监听任务完成事件：当活跃列表刚变为空时触发（只依赖 activeRuns.length）
  useEffect(() => {
    if (activeRuns.length > 0) return // 还有活跃任务，不做操作
    const { history } = useWorkflowStore.getState()
    if (history.length > 0) {
      const latest = history[0]
      if (latest.status === 'completed') {
        // 使用函数式更新，只有值实际不同时才触发重渲染
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCompletedTitle(prev => {
          const newTitle = latest.title
          return prev === newTitle ? prev : newTitle
        })
      }
    }
  }, [activeRuns.length])

  const stepInfo = getActiveStepInfo()

  // 完成态渲染
  if (!stepInfo && completedTitle) {
    return (
      <div
        className="ai-task-capsule ai-task-capsule--complete"
        onClick={() => useLayoutStore.getState().openRightPanel('ai-output')}
      >
        <CheckCircle2 size={10} />
        <span className="truncate">
          {text(`${completedTitle} 完成`, `${completedTitle} complete`)}
        </span>
      </div>
    )
  }

  // 无任务
  if (!stepInfo) return null

  const { stepName, progress, total, completed } = stepInfo

  // 多任务模式
  if (activeRuns.length > 1) {
    return (
      <div
        className="ai-task-capsule"
        onClick={() => useLayoutStore.getState().openRightPanel('ai-output')}
        title={text('点击查看任务进度', 'View task progress')}
      >
        {/* 脉冲圆点 */}
        <span
          className="w-[5px] h-[5px] rounded-full animate-pulse flex-shrink-0"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
        <span>{text(`${activeRuns.length}个任务运行中...`, `${activeRuns.length} tasks running...`)}</span>
      </div>
    )
  }

  // 单任务模式：步骤名 + 微型进度条 + 百分比
  const effectiveProgress = Math.max(5, progress)
  return (
    <div
      className="ai-task-capsule"
      onClick={() => useLayoutStore.getState().openRightPanel('ai-output')}
      title={text('点击查看 AI 输出详情', 'View AI output')}
    >
      {/* 脉冲圆点 */}
      <span
        className="w-[5px] h-[5px] rounded-full animate-pulse flex-shrink-0"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />
      {/* 步骤名（截断） */}
      <span className="truncate max-w-[120px]">{stepName}</span>
      {/* 微型进度条 */}
      <div
        style={{
          width: 40,
          height: 2,
          borderRadius: 1,
          backgroundColor: 'rgba(var(--color-accent-rgb), 0.2)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${effectiveProgress}%`,
            backgroundColor: 'var(--color-accent)',
            borderRadius: 1,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      {/* 进度百分比 */}
      <span className="font-mono text-[0.62rem] flex-shrink-0 opacity-80">
        {completed}/{total}
      </span>
    </div>
  )
}


/** 状态栏分段（可点击） */
function StatusBarSegment({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title?: string
  onClick?: () => void
}) {
  return (
    <div
      className="writer-statusbar-segment flex items-center gap-1 px-2 h-full cursor-default transition-colors"
      title={title}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {children}
    </div>
  )
}
