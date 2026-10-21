import { create } from 'zustand'

/**
 * 运行中的思考文本**只留尾部**。
 *
 * 2026-10-21 实机：审稿一次 attempt 的 reasoning 分片可达每秒上百个，
 * 原实现 `text: previous.text + chunk` 单调增长且无上限 —— 一旦有界面订阅它，
 * 每个分片都会触发一次整棵子树重渲染 + 一次强制布局，单次成本随文本长度线性上升
 * （总量 O(n²)），渲染进程内存因此一路涨到 10GB。
 * 详见 docs/design/features/ai-output-live-render-design.md。
 *
 * 现在的纪律：
 * - **界面不再订阅本 store**（AI 输出面板运行态只显示状态行 + 低频预览）；
 * - 本 store 只服务诊断：保留尾部一小段，供排查「模型是不是在胡说」；
 * - 上限固定，`append` 的工作量恒定，不会随会话长度恶化。
 */
export const MAX_VISIBLE_REASONING_CHARS = 8_192
const TRUNCATED_NOTICE = '…（更早的思考已省略）\n'

function capTail(text: string): string {
  if (text.length <= MAX_VISIBLE_REASONING_CHARS) return text
  return TRUNCATED_NOTICE + text.slice(-MAX_VISIBLE_REASONING_CHARS)
}

/** Volatile display state. Hidden reasoning never joins workflow history or generation artifacts. */
export const useWorkflowReasoningStore = create<{
  entries: Record<string, { attemptId: string; text: string }>
  append: (workflowRunId: string, attemptId: string, chunk: string) => void
  clear: (workflowRunId: string) => void
}>(set => ({
  entries: {},
  append: (workflowRunId, attemptId, chunk) => set(state => {
    const previous = state.entries[workflowRunId]
    const base = previous?.attemptId === attemptId ? previous.text : ''
    return { entries: { ...state.entries, [workflowRunId]: { attemptId, text: capTail(base + chunk) } } }
  }),
  clear: workflowRunId => set(state => {
    if (!(workflowRunId in state.entries)) return state
    const entries = { ...state.entries }
    delete entries[workflowRunId]
    return { entries }
  }),
}))
