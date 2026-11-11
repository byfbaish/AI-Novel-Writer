import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectSessionContext } from '../../../shared/ipc-channels'
import { hydrateActualModel } from '../actual-model-hydration'
import { useActualModelStore } from '../../../stores/actual-model-store'

// `vi.mock` 会被提升到文件顶部，工厂里不能引普通顶层变量，必须走 `vi.hoisted`。
const invokeWithProjectSession = vi.hoisted(() => vi.fn())

vi.mock('../../ipc-client', () => ({ ipc: { invokeWithProjectSession } }))

const sessionA: ProjectSessionContext = {
  projectId: 'project-a',
  projectPath: 'C:/novels/project-a',
  leaseId: 'lease-a',
} as ProjectSessionContext

const modelA = { modelId: 'model-a', modelName: 'ollama/qwen3.5:9b-128k' }
const modelB = { modelId: 'model-b', modelName: 'deepseek-flash' }

const actual = () => useActualModelStore.getState().actual
/** 预置成「上一个项目留下的值」，用来分辨「清空」与「什么都不做」。 */
const seedPreviousProject = () => useActualModelStore.setState({ actual: modelA })

describe('hydrateActualModel（D16 启动期回填）', () => {
  beforeEach(() => {
    invokeWithProjectSession.mockReset()
    useActualModelStore.setState({ actual: null })
  })

  it('没有项目时清空，不留上一个项目的模型', async () => {
    seedPreviousProject()

    await hydrateActualModel(null)

    expect(actual()).toBeNull()
    expect(invokeWithProjectSession).not.toHaveBeenCalled()
  })

  it('主进程回 null（该项目从未生成过）时清空', async () => {
    seedPreviousProject()
    invokeWithProjectSession.mockResolvedValue(null)

    await hydrateActualModel(sessionA)

    expect(actual()).toBeNull()
    expect(invokeWithProjectSession).toHaveBeenCalledWith(sessionA, 'generation:last-model')
  })

  it('回填成功时记录主进程带回的模型', async () => {
    invokeWithProjectSession.mockResolvedValue(modelB)

    await hydrateActualModel(sessionA)

    expect(actual()).toEqual(modelB)
  })

  /**
   * 2026-11-11 豆包独立复核指出的缺陷：原 catch 块注释写「状态栏退回配置值」，
   * 但里面什么都没做 ⇒ 切项目失败时 store 留着上一个项目的模型，而状态栏把它
   * 标成「实际调用」。删掉 catch 里的 clearActualModel，本用例必红。
   */
  it('回填抛错时同样清空——失败不能保留上一个项目的模型', async () => {
    seedPreviousProject()
    invokeWithProjectSession.mockRejectedValue(new Error('PROJECT_SESSION_STALE'))

    await hydrateActualModel(sessionA)

    expect(actual()).toBeNull()
  })
})
