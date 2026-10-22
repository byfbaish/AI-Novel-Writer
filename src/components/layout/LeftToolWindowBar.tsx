import {
  FolderOpen,
  BookOpen,
  Users,
  Home,
  ListTree,
  Globe2,
  GitBranch,
  History,
  Compass,
} from 'lucide-react'
import { useLayoutStore, type SidebarView } from '../../stores/layout-store'
import { useProjectStore } from '../../stores/project-store'
import { openBuiltinEditor } from '../panels/sidebar/sidebar-file-openers'
import { useLocaleStore } from '../../stores/locale-store'

/** 左侧侧边栏视图按钮配置（不含 Home，它单独渲染） */
const sidebarActivities: Array<{ id: SidebarView; icon: typeof FolderOpen; zh: string; en: string }> = [
  { id: 'project', icon: FolderOpen, zh: '项目', en: 'Project' },
  { id: 'knowledge', icon: BookOpen, zh: '小说', en: 'Novel' },
  { id: 'characters', icon: Users, zh: '角色', en: 'Cast' },
]

function LeftNavButton({
  icon: Icon,
  label,
  active,
  onClick,
  title,
}: {
  icon: typeof FolderOpen
  label: string
  active?: boolean
  onClick: () => void
  title?: string
}) {
  return (
    <div className="relative w-full px-1">
      <button
        onClick={onClick}
        title={title ?? label}
        className={`left-nav-button${active ? ' is-active' : ''}`}
      >
        <Icon size={22} strokeWidth={active ? 2 : 1.75} />
        <span className="left-nav-label">{label}</span>
      </button>
    </div>
  )
}

/**
 * 左侧工具窗口栏（LeftToolWindowBar）
 * JetBrains 风格：带文字标签的左侧主导航，全高
 */
export default function LeftToolWindowBar() {
  const activeRailItem = useLayoutStore(s => s.activeRailItem)
  const sidebarView = useLayoutStore(s => s.sidebarView)
  const currentProject = useProjectStore(s => s.currentProject)
  const setSidebarView = useLayoutStore(s => s.setSidebarView)
  const text = useLocaleStore(s => s.text)

  /** Home 按钮是否激活 */
  const homeActive = activeRailItem === 'home' || (!currentProject && sidebarView === 'project')
  const plotTreeActive = activeRailItem === 'plot-tree'

  return (
    <div
      className="writer-left-rail no-select flex flex-col h-full"
      style={{
        width: 'var(--width-left-bar)',
        flexShrink: 0,
      }}
    >
      {/* ===== 顶部：Home + 侧边栏视图切换 ===== */}
      <div className="flex flex-col items-center w-full pt-0.5">

        {/* Home 按钮 — 点击切换到主页视图 */}
        <LeftNavButton
          icon={Home}
          label={text('首页', 'Home')}
          active={homeActive}
          onClick={() => setSidebarView('home')}
          title={text('欢迎页', 'Welcome')}
        />

        {/* 分割线 */}
        <div className="writer-nav-divider w-8 my-1" style={{ height: 1 }} />

        {/* 侧边栏视图按钮 */}
        {sidebarActivities.map(({ id, icon: Icon, zh, en }) => {
          const label = text(zh, en)
          const isActive = activeRailItem === id && !(id === 'project' && homeActive)
          return (
            <LeftNavButton
              key={id}
              icon={Icon}
              label={label}
              active={isActive}
              title={label}
              onClick={() => setSidebarView(id)}
            />
          )
        })}

        <div className="writer-nav-divider w-8 my-1" style={{ height: 1 }} />

        <LeftNavButton
          icon={ListTree}
          label={text('蓝图', 'Plot')}
          active={activeRailItem === 'blueprint'}
          title={text('章节蓝图', 'Chapter blueprint')}
          onClick={() => {
            setSidebarView('project', 'blueprint')
            openBuiltinEditor('chapter-card-editor', text('章节蓝图', 'Chapter blueprint'), 'chapter-card')
          }}
        />
        <LeftNavButton
          icon={Globe2}
          label={text('故事架构', 'Story')}
          active={activeRailItem === 'world'}
          title={text('故事架构', 'Story architecture')}
          onClick={() => {
            setSidebarView('project', 'world')
            openBuiltinEditor('world-building-editor', text('故事架构', 'Story architecture'), 'world-building')
          }}
        />
        <LeftNavButton
          icon={Compass}
          label={text('世界状态', 'World state')}
          active={activeRailItem === 'world-state'}
          title={text('世界状态', 'World state')}
          onClick={() => setSidebarView('world-state')}
        />
        <LeftNavButton
          icon={GitBranch}
          label={text('剧情', 'Plot tree')}
          active={plotTreeActive}
          title={text('剧情树', 'Plot tree')}
          onClick={() => {
            setSidebarView('project', 'plot-tree')
            openBuiltinEditor(
              'narrative-thread-editor',
              text('剧情树与叙事线索', 'Plot tree & narrative threads'),
              'narrative-thread',
              'plot-tree',
            )
          }}
        />
        <LeftNavButton
          icon={History}
          label={text('历史', 'History')}
          title={text('版本历史', 'Version history')}
          onClick={() => {
            if (!currentProject) return
            if (sidebarView !== 'project' || activeRailItem !== 'project' || !useLayoutStore.getState().sidebarOpen) {
              setSidebarView('project')
            }
            openBuiltinEditor('version-history', text('版本历史', 'Version history'), 'version-history')
          }}
        />
      </div>

      {/*
        弹性间隔。
        这里原本还有「任务 / 日志 / 模型 / 设置」四个按钮 —— 已全部移除：
        任务/日志/模型的唯一入口在底部状态栏左下角（StatusBar），设置只在标题栏。
        左栏只留视图导航。
      */}
      <div className="flex-1" />
    </div>
  )
}
