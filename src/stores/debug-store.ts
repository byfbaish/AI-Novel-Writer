import { create } from 'zustand'

/**
 * 调试开关状态宿主（P0 骨架）。
 *
 * 目前只承载一件事：Prompt 追踪总开关与自定义落盘根目录。追踪记录器
 * （片段层 hook + IO 层 hook）尚未接线，本 store 先把「开关状态 + 持久化 +
 * 状态栏指示」立起来，让后续 P1/P2 有稳定的读写入口。
 *
 * 持久化到 localStorage：这是纯本地调试偏好，不涉及项目数据，
 * 也不应写进项目库或主进程配置。
 */

const STORAGE_KEY = 'ai-novel-writer.debug'

export interface DebugSettings {
  /** Prompt 片段追踪总开关：打开后把每次生成的输入/输出落盘。 */
  promptTraceEnabled: boolean
  /**
   * 预留：自定义落盘根目录。
   *
   * 当前落盘固定在项目根内的 `debug/prompt-trace`——`fs:write-file` 强制目标位于
   * 项目根内（既有沙箱边界），写到项目外需要新增一条专用受控 IPC。字段先保留，
   * 以免破坏已持久化的 localStorage 结构；启用外部目录时再接线。
   */
  traceRoot: string | null
}

interface DebugState extends DebugSettings {
  setPromptTraceEnabled: (enabled: boolean) => void
  setTraceRoot: (root: string | null) => void
}

/** 测试可注入的内存存储替身。 */
export interface DebugStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function defaultStorage(): DebugStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function readSettings(storage: DebugStorage | null): DebugSettings {
  const fallback: DebugSettings = { promptTraceEnabled: false, traceRoot: null }
  if (!storage) return fallback
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<DebugSettings>
    return {
      promptTraceEnabled: parsed.promptTraceEnabled === true,
      traceRoot: typeof parsed.traceRoot === 'string' && parsed.traceRoot.trim()
        ? parsed.traceRoot
        : null,
    }
  } catch {
    return fallback
  }
}

function writeSettings(storage: DebugStorage | null, settings: DebugSettings): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 隐私模式或配额耗尽时静默降级：调试偏好不值得打断创作。
  }
}

/**
 * 创建调试 store。导出工厂是为了让测试注入内存存储，
 * 生产环境直接用 `useDebugStore`。
 */
export function createDebugStore(storage: DebugStorage | null = defaultStorage()) {
  const initial = readSettings(storage)
  return create<DebugState>()((set, get) => ({
    ...initial,
    setPromptTraceEnabled: (enabled) => {
      set({ promptTraceEnabled: enabled })
      writeSettings(storage, {
        promptTraceEnabled: enabled,
        traceRoot: get().traceRoot,
      })
    },
    setTraceRoot: (root) => {
      const normalized = root && root.trim() ? root.trim() : null
      set({ traceRoot: normalized })
      writeSettings(storage, {
        promptTraceEnabled: get().promptTraceEnabled,
        traceRoot: normalized,
      })
    },
  }))
}

export const useDebugStore = createDebugStore()

export const DEBUG_STORAGE_KEY = STORAGE_KEY
