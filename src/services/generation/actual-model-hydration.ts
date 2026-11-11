import { ipc } from '../ipc-client'
import type { ProjectSessionContext } from '../../shared/ipc-channels'
import { useActualModelStore } from '../../stores/actual-model-store'

/**
 * D16：重启 / 切项目后回填「最近一次实际调用用过的模型」。
 *
 * 事实源是主进程持久化的 `binding_json.sourceManifest.modelReceipt`；这里只走一条
 * **轻量**通道取 `{modelId, modelName}`，不拉 `generation:list`（那份要带全部产物全文，
 * 启动期拉它是浪费，且列表里多数 run 与本意无关）。
 *
 * 用 `generation:last-model` 而不是读 store 缓存：渲染层的 actual store 是纯内存的，
 * 重启必然归零，不重建就会退回配置值——那正是 D16 原现象。
 */
export async function hydrateActualModel(session: ProjectSessionContext | null): Promise<void> {
  if (!session) {
    useActualModelStore.getState().clearActualModel()
    return
  }
  try {
    const model = await ipc.invokeWithProjectSession(session, 'generation:last-model') as
      { modelId: string; modelName: string } | null
    if (!model) {
      // 该项目从未跑过生成：清掉上一个项目留下的模型，避免串项目。
      useActualModelStore.getState().clearActualModel()
      return
    }
    useActualModelStore.getState().recordActualModel(model)
  } catch {
    // 回填失败不阻塞界面；状态栏退回配置值，与「尚无实际调用」同义。
  }
}
