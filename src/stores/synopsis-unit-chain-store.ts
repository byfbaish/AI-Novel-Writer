import { create } from 'zustand'
import type { SynopsisUnitChainState, UnitChainStopReason } from '../services/workflows/synopsis-unit-chain'

/**
 * E3 T12：连续单元的**进行中状态**。
 *
 * 只活在内存里：应用重启后不该「悄悄地接着写」，那比停下来更吓人。
 * 丢了它也不丢数据 —— 每批都在检查点里，作者重新打开弹窗就能看到下一个单元。
 */
interface SynopsisUnitChainStore {
  chain: SynopsisUnitChainState | null
  /** 首批：作者刚确认「连写 N 个单元」。 */
  start: (input: {
    projectPath: string
    total: number
    volumeIndex: number | null
    runId: string
    targetUnits?: number | null
    stepGuidance?: Record<string, string>
  }) => void
  /** 又发起了一批：`launched + 1`，并换绑新的 run。 */
  advance: (runId: string) => void
  stop: (reason: UnitChainStopReason, detail?: string | null) => void
  clear: () => void
}

export const useSynopsisUnitChainStore = create<SynopsisUnitChainStore>(set => ({
  chain: null,
  start: ({ projectPath, total, volumeIndex, runId, targetUnits = null, stepGuidance = {} }) => set({
    chain: {
      projectPath,
      total: Math.max(1, Math.floor(total)),
      launched: 1,
      volumeIndex,
      runId,
      targetUnits: typeof targetUnits === 'number' && Number.isFinite(targetUnits) ? targetUnits : null,
      // 深拷一份：调用方之后改这个对象不该影响后续批次的口径。
      stepGuidance: { ...stepGuidance },
      status: 'running',
      stopReason: null,
      stopDetail: null,
    },
  }),
  advance: runId => set(state => {
    if (!state.chain || state.chain.status !== 'running') return state
    return { chain: { ...state.chain, launched: state.chain.launched + 1, runId } }
  }),
  stop: (reason, detail = null) => set(state => {
    if (!state.chain) return state
    if (state.chain.status === 'stopped' && state.chain.stopReason === reason) return state
    return { chain: { ...state.chain, status: 'stopped', stopReason: reason, stopDetail: detail } }
  }),
  clear: () => set({ chain: null }),
}))
