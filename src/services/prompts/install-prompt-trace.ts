import { configurePromptTrace } from './prompt-trace'
import { useDebugStore } from '../../stores/debug-store'
import { promptCatalog } from '../prompt-templates'
import { getActiveProjectSessionContext } from '../../shared/project-session-context'

/**
 * 把 Prompt 片段追踪接到渲染层的 `debug-store` 开关上。
 *
 * 必须在应用启动、任何生成发生之前调用一次（`main.tsx`）。
 * 分开成独立文件是为了让 `prompt-trace` 保持零依赖（可被主进程/测试单独引用），
 * 只在这里引入 store 与 catalog（渲染层专属依赖）。
 *
 * 追踪关闭时 `recordFragments` 首行短路，本装配不会带来运行时开销。
 */
export function installPromptTraceFromDebugStore(): void {
  configurePromptTrace({
    enabled: () => useDebugStore.getState().promptTraceEnabled,
    runHandle: () => undefined, // P2：由命令作用域注入 mainGenerationRunHandle
    resolveSource: (key) => {
      try {
        return promptCatalog.peek(key, getActiveProjectSessionContext() ?? undefined)?.source ?? 'builtin'
      } catch {
        return 'builtin'
      }
    },
  })
}
