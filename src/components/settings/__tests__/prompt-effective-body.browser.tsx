import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { getBuiltinPromptTemplate, reloadGlobalCustomPrompts } from '../../../services/prompt-templates'
import { useLocaleStore } from '../../../stores/locale-store'
import PromptSettings from '../PromptSettings'

const originalLocaleState = useLocaleStore.getState()

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface TestVelaApi {
  invoke: ReturnType<typeof vi.fn>
  on: () => () => void
  once: () => void
  send: () => void
  setZoomLevel: () => void
  setZoomFactor: () => void
  getZoomLevel: () => number
}

let root: Root | undefined
let container: HTMLDivElement | undefined

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  root = undefined
  container = undefined
  useLocaleStore.setState(originalLocaleState)
  const { useProjectStore } = await import('../../../stores/project-store')
  useProjectStore.setState({ currentProject: null })
})

/** 挂载面板、展开「全文配置生成」条目。`overrides` 为空即代表当前生效的是内置模板。 */
async function mountAndExpand(overrides: unknown[]) {
  const invoke = vi.fn(async (channel: string) => {
    if (channel === 'prompt:load-global') return { templates: overrides, diagnostics: [] }
    throw new Error(`Unexpected IPC channel: ${channel}`)
  })
  ;(window as unknown as { aiNovelAPI: TestVelaApi }).aiNovelAPI = {
    invoke,
    on: () => () => {},
    once: () => {},
    send: () => {},
    setZoomLevel: () => {},
    setZoomFactor: () => {},
    getZoomLevel: () => 0,
  }

  useLocaleStore.setState({ locale: 'zh-CN' })
  // `promptCatalog` 的全局覆盖在每个进程内只读一次，之后 `loadCustomPrompts()` 不再回盘。
  // 同一文件里的第二个用例必须显式重载，否则会沿用上一个用例的覆盖快照。
  await reloadGlobalCustomPrompts()
  const host = document.createElement('div')
  document.body.append(host)
  container = host
  root = createRoot(host)
  await act(async () => {
    root?.render(<PromptSettings />)
  })
  await act(async () => {
    await page.getByRole('button', { name: /全文配置生成/ }).click()
  })
  return host
}

function builtinFixture() {
  const builtin = getBuiltinPromptTemplate('generate_global_config', 'zh-CN')
  if (!builtin) throw new Error('Missing built-in prompt fixture')
  return builtin
}

describe('prompt effective body visibility', () => {
  it('exposes the in-effect built-in body and offers no redundant "new built-in" section', async () => {
    const builtin = builtinFixture()
    const host = await mountAndExpand([])

    // 关键诉求：作者必须能看到「现在生效的到底是什么规则」，此前正文在面板里完全不可见。
    expect(host.textContent).toContain(builtin.content)
    expect(host.textContent).toContain('当前生效的模板正文')
    // 没有覆盖就没有「新旧对比」的需要，不应出现第二个正文块。
    expect(host.textContent).not.toContain('新版内置正文')
  })

  it('shows the frozen override body alongside the newer built-in body so the author can compare before restoring', async () => {
    const builtin = builtinFixture()
    // 覆盖文件冻结的是保存当时的内置正文 —— 这里用可辨识的文本来代表「旧版」。
    const frozenBody = '【旧版内置正文】依据 {{user_idea}} 生成配置。'
    const host = await mountAndExpand([{ ...builtin, content: frozenBody, taskGuidance: '我的自定义指导' }])

    await expect.element(page.getByRole('textbox', { name: '补充创作指导' })).toHaveValue('我的自定义指导')

    // 生效的是覆盖版冻结的正文……
    expect(host.textContent).toContain(frozenBody)
    // ……而新版内置正文同时可见，作者可自行比对后再决定是否恢复默认。
    expect(host.textContent).toContain(builtin.content)
    expect(host.textContent).toContain('新版内置正文')
    expect(host.textContent).toContain('当前生效的模板正文')
  })
})
