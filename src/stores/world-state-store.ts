/**
 * world-state-store — W5「世界状态」快照的唯一持有者。
 *
 * 为什么要有这一层：
 * - 左栏只做分类导航（需要四个计数），主区页面渲染明细，两处必须看同一份快照；
 *   各自 `useEffect` 里 invoke 就会读两遍，刷新时机还会打架。
 * - 只读契约集中在这里：全文件只出现 'world-state:read' 一个通道。
 *
 * 新鲜度规则（沿用原 WorldStateView 的做法，不能省）：
 * 快照带 `path`，调用方按当前项目路径比对；项目切换后旧项目的数据不得冒充本项目。
 */
import { create } from 'zustand'
import { ipc } from '../services/ipc-client'
import type { WorldStateView } from '../shared/world-state-view'

/**
 * 左栏导航的分类。
 *
 * `space`（空间检查，2026-10-22）追加在末尾；`resources`（资源账本，W6c）
 * 插在 `characters` 之后 —— 设计稿 §6 把「人 / 物 / 事」并列，资源属于「物」，
 * 与角色相邻才符合阅读顺序。
 */
export type WorldStateSection = 'cast' | 'timeline' | 'characters' | 'resources' | 'facts' | 'space'

export interface WorldStateSnapshot {
  /** 这份快照属于哪个项目；与当前项目不一致时调用方必须当作「尚未读取」。 */
  path: string
  view: WorldStateView | null
  error: string | null
}

interface WorldStateStoreState {
  snapshot: WorldStateSnapshot | null
  /** 在途请求的目标项目路径；null 表示空闲。 */
  loadingPath: string | null
  /** 手动刷新中（只有作者点刷新才转圈，切换分类/项目不转）。 */
  refreshing: boolean
  section: WorldStateSection
  /** 请求序号：项目切换 / 手动刷新时只接受最新一次响应。 */
  requestSeq: number
  load: (projectPath: string | null, options?: { force?: boolean }) => Promise<void>
  refresh: (projectPath: string | null) => Promise<void>
  setSection: (section: WorldStateSection) => void
  reset: () => void
}

const initialState = {
  snapshot: null as WorldStateSnapshot | null,
  loadingPath: null as string | null,
  refreshing: false,
  section: 'cast' as WorldStateSection,
  requestSeq: 0,
}

export const useWorldStateStore = create<WorldStateStoreState>()((set, get) => ({
  ...initialState,

  load: async (projectPath, options) => {
    const force = options?.force ?? false

    if (!projectPath) {
      set({ snapshot: null, loadingPath: null, refreshing: false, requestSeq: get().requestSeq + 1 })
      return
    }

    const { snapshot, loadingPath } = get()
    // 已有本项目的成功/失败结果就不再重复读；在途请求也不叠加。
    if (!force && snapshot?.path === projectPath && (snapshot.view || snapshot.error)) return
    if (!force && loadingPath === projectPath) return

    const seq = get().requestSeq + 1
    set({ requestSeq: seq, loadingPath: projectPath, ...(force ? { refreshing: true } : {}) })

    try {
      const view = await ipc.invoke('world-state:read', projectPath)
      if (get().requestSeq !== seq) return
      set({ snapshot: { path: projectPath, view, error: null }, loadingPath: null, refreshing: false })
    } catch (error) {
      if (get().requestSeq !== seq) return
      set({
        snapshot: {
          path: projectPath,
          view: null,
          error: error instanceof Error ? error.message : String(error),
        },
        loadingPath: null,
        refreshing: false,
      })
    }
  },

  refresh: async (projectPath) => {
    await get().load(projectPath, { force: true })
  },

  setSection: (section) => set({ section }),

  reset: () => set({ ...initialState }),
}))

/** 按项目路径取新鲜快照；路径不匹配一律视为「还没有读取」。 */
export function selectWorldStateSnapshot(
  state: Pick<WorldStateStoreState, 'snapshot'>,
  projectPath: string | null,
): WorldStateSnapshot | null {
  if (!projectPath || !state.snapshot) return null
  return state.snapshot.path === projectPath ? state.snapshot : null
}
