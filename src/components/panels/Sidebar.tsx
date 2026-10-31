/**
 * Sidebar — 左侧导航面板容器
 *
 * 纯路由容器，根据 sidebarView 切换子视图。
 * 所有子视图已拆分到 sidebar/ 子目录。
 */

import { useState, useEffect } from 'react'
import { useLayoutStore } from '../../stores/layout-store'
import { ContextMenu } from '../ui/ContextMenu'
import KnowledgePanel from './KnowledgePanel'
import HomeSidebarPanel from './sidebar/HomeSidebarPanel'
import ProjectTree from './sidebar/ProjectTree'
import CharactersView from './sidebar/CharactersView'
import WorldStateNav from './sidebar/WorldStateNav'
import {
  registerMenuSetter, unregisterMenuSetter,
  type SidebarMenuState,
} from './sidebar/sidebar-menu'
import { useLocaleStore } from '../../stores/locale-store'

/** 左侧面板 */
export default function Sidebar() {
  const sidebarView = useLayoutStore(s => s.sidebarView)
  const text = useLocaleStore(s => s.text)
  // 全局右键菜单状态
  const [sidebarMenu, setSidebarMenu] = useState<SidebarMenuState | null>(null)

  // 注册 / 注销右键菜单 setter
  useEffect(() => {
    registerMenuSetter(setSidebarMenu)
    return () => { unregisterMenuSetter() }
  }, [])

  const viewTitles: Record<string, string> = {
    home:       text('主页', 'Home'),
    project:    text('项目结构', 'Project'),
    knowledge:  text('知识库', 'Knowledge'),
    characters: text('角色管理', 'Characters'),
    'world-state': text('世界状态', 'World state'),
    // S7：侧栏没有可导航的层级，只给一句说明 —— 留一个空白面板会让作者以为没加载出来。
    'derived-health': text('同步', 'Sync'),
  }

  return (
    <div
      className="skin-workspace-panel w-full h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--color-sidebar)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      <div className="panel-header">
        <span>{viewTitles[sidebarView]}</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {sidebarView === 'home'       && <HomeSidebarPanel />}
        {sidebarView === 'project'    && <ProjectTree />}
        {sidebarView === 'knowledge'  && <KnowledgePanel />}
        {sidebarView === 'characters' && <CharactersView />}
        {sidebarView === 'world-state' && <WorldStateNav />}
        {sidebarView === 'derived-health' && (
          <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {text(
              '按「上游改了、下游还没跟上」列出派生内容。每一行的「去处置」会跳到对应编辑器，改不改由你决定。',
              'Derived content that trails its upstream. "Open" jumps to the matching editor; whether to regenerate is up to you.',
            )}
          </p>
        )}
      </div>

      {/* 动态右键菜单 */}
      {sidebarMenu && (
        <ContextMenu
          items={sidebarMenu.items}
          position={sidebarMenu.position}
          onClose={() => setSidebarMenu(null)}
        />
      )}
    </div>
  )
}
