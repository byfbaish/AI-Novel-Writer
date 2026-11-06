/**
 * D8（§12.10.3）：**「卷/单元路线是否启用」的单一事实源**。
 *
 * 起因（豆包复审 Q4）：弹窗显示读「打开弹窗时的探针」、主入口提交读
 * 「提交那一刻的探针」、第二入口打包态干脆不探 —— 同一个配置三处结论。
 * 作者 04:56 / 05:03 定的判据本来就是**配置开关**（不是本次探针有没有成功），
 * 所以这里把开关值收进一份 store：弹窗显示、两个入口提交、清场触发全读它。
 * `SettingsModal.applySynopsisUnitMode` 切换时同步写入 ⇒ 弹窗开着切配置，
 * 显示与提交仍一致（§12.6 第 13 条的前置）。
 */

import { create } from 'zustand'
import { ipc } from '../services/ipc-client'

interface SynopsisRouteState {
  /** 与 `synopsisUnitModeEnabled` 的兜底一致：未写过配置 = 开启。 */
  unitRouteEnabled: boolean
  setUnitRouteEnabled: (enabled: boolean) => void
}

export const useSynopsisRouteStore = create<SynopsisRouteState>((set) => ({
  unitRouteEnabled: true,
  setUnitRouteEnabled: (enabled) => set({ unitRouteEnabled: enabled }),
}))

/**
 * 读用户设置并同步 store。**永不抛错**：读不到配置按「开启」处理
 * （与 `synopsisUnitModeEnabled` 同一个兜底，不能因为一次 IPC 抖动退回旧路线）。
 * 返回同步后的值，供提交侧立刻使用。
 */
export async function syncSynopsisRoute(): Promise<boolean> {
  let enabled = true
  try {
    const config = await ipc.invoke('config:get') as { synopsisUnitMode?: boolean } | null
    enabled = config?.synopsisUnitMode !== false
  } catch {
    enabled = true
  }
  useSynopsisRouteStore.getState().setUnitRouteEnabled(enabled)
  return enabled
}
