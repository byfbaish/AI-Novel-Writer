import { create } from 'zustand'
import type { ActualCallModel } from '../shared/statusbar-model'

/**
 * D16：渲染侧「最近一次实际调用模型」快照。
 *
 * 由 `generation-runtime.ts` 在 `beginModelExecution()` 拿到主进程租约回执
 * （`ModelExecutionLeaseReceipt.{modelId,modelName}`，即报告 §0 写死的渲染期
 * lease 投影）时写入；StatusBar 读它而非 `useLLMStore.defaultModelId` 作为当前模型。
 * 只活在内存里，不落库、不改配置，属展示层事实源投影。
 */
interface ActualModelState {
  actual: ActualCallModel | null
  recordActualModel: (model: ActualCallModel) => void
  clearActualModel: () => void
}

export const useActualModelStore = create<ActualModelState>(set => ({
  actual: null,
  recordActualModel: model => set({ actual: model }),
  clearActualModel: () => set({ actual: null }),
}))
