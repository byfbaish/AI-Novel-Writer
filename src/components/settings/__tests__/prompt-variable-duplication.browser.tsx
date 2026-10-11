import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { BUILTIN_PROMPTS } from '../../../services/prompt-templates'
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

describe('prompt variable duplication guard', () => {
  it('warns when the guidance re-inserts a variable the template body already renders', async () => {
    const builtin = BUILTIN_PROMPTS.find((template) => template.key === 'generate_global_config')
    if (!builtin) throw new Error('Missing built-in prompt fixture')

    // 模板正文本身就会渲染 {{user_idea}}；再写进「补充创作指导」就会把同一段内容注入两遍。
    const duplicatedGuidance = '依据灵感 {{user_idea}} 生成完整小说配置。'
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'prompt:load-global') {
        return { templates: [{ ...builtin, taskGuidance: duplicatedGuidance }], diagnostics: [] }
      }
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
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(<PromptSettings />)
    })
    await act(async () => {
      await page.getByRole('button', { name: /全文配置生成/ }).click()
    })
    await expect.element(page.getByRole('textbox', { name: '补充创作指导' })).toHaveValue(duplicatedGuidance)

    await expect.element(page.getByText(/是模板正文本身就会渲染的/)).toBeVisible()
    // 只提示、不替作者删字：作者的原文必须原样留在编辑器里。
    await expect.element(page.getByRole('textbox', { name: '补充创作指导' })).toHaveValue(duplicatedGuidance)
  })
})
