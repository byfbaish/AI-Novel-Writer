import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import RendererStartup, { MIGRATION_NOTICE_AUTO_DISMISS_MS } from '../RendererStartup'
import { useLocaleStore } from '../../../stores/locale-store'
import { useAppearanceStore, type AppearanceBootstrapDependencies } from '../../../stores/appearance-bootstrap'
import { APPEARANCE_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY, LEGACY_UI_STORAGE_KEY } from '../../../shared/appearance-profile'

const originalLocale = useLocaleStore.getState()
let host: HTMLDivElement
let root: Root
const keys = [APPEARANCE_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY, LEGACY_UI_STORAGE_KEY, 'startup-notice-related']
const notice = { legacySourceIgnored: true, preservedUnknownCount: 1 }

function dependencies(noticeValue: typeof notice | undefined, onGetState?: () => void): AppearanceBootstrapDependencies {
  return {
    waitForMainReady: async () => {
      onGetState?.()
      return { state: 'ready', globalGeneration: '启动世代', skinRevision: 0, ...(noticeValue ? { migrationNotice: noticeValue } : {}) }
    },
    readSkinSnapshot: async () => ({ globalGeneration: '启动世代', skinRevision: 0, backgroundSkin: 'classic' }),
    acknowledgeReadback: async () => true,
  }
}
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  keys.forEach(key => localStorage.removeItem(key))
  useAppearanceStore.setState(useAppearanceStore.getInitialState(), true)
  useLocaleStore.setState({ locale: 'zh-CN' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount()); host.remove()
  keys.forEach(key => localStorage.removeItem(key))
  useAppearanceStore.setState(useAppearanceStore.getInitialState(), true)
  useLocaleStore.setState(originalLocale)
  vi.restoreAllMocks()
})

const banner = () => host.querySelector('[role="status"]')
const dismiss = () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === '知道了')

it('迁移提示在工作台可见时渲染，点击知道了后消失且不再重渲染', async () => {
  let reads = 0
  const load = vi.fn(async () => ({ default: () => <p>合成工作台</p> }))
  await act(async () => root.render(<RendererStartup dependencies={dependencies(notice, () => { reads++ })} loadWorkspace={load} />))
  await vi.waitFor(() => expect(host.textContent).toContain('合成工作台'))
  expect(banner()).not.toBeNull()
  expect(banner()?.textContent).toContain('旧来源已保留')
  expect(reads).toBe(1)
  await act(async () => dismiss()!.click())
  expect(banner()).toBeNull()
  expect(host.textContent).toContain('合成工作台')
})

it('点击知道了不会重新进入启动检查，工作台实例保持不变', async () => {
  let mounts = 0
  function Workspace() {
    useEffect(() => { mounts++; return () => { mounts-- } }, [])
    return <textarea aria-label="未保存正文" defaultValue="作者正在写的正文" />
  }
  const load = vi.fn(async () => ({ default: Workspace }))
  await act(async () => root.render(<RendererStartup dependencies={dependencies(notice)} loadWorkspace={load} />))
  await vi.waitFor(() => expect(host.querySelector('textarea')).not.toBeNull())
  const editor = host.querySelector('textarea')!
  editor.value = '点了知道了之后不能丢的正文。'
  await act(async () => dismiss()!.click())
  expect(host.querySelector('textarea')).toBe(editor)
  expect(editor.value).toBe('点了知道了之后不能丢的正文。')
  expect(mounts).toBe(1)
  expect(load).toHaveBeenCalledTimes(1)
})

it('外观在提示可见后失败时只呈现告警，不把迁移提示一并显示', async () => {
  const load = vi.fn(async () => ({ default: () => <p>合成工作台</p> }))
  await act(async () => root.render(<RendererStartup dependencies={dependencies(notice)} loadWorkspace={load} />))
  await vi.waitFor(() => expect(banner()).not.toBeNull())
  localStorage.setItem(APPEARANCE_STORAGE_KEY, '外部变化')
  await act(async () => { expect(useAppearanceStore.getState().update({ colorTheme: 'dark' })).toBe(false) })
  expect(useAppearanceStore.getState().phase).toBe('blocked')
  await vi.waitFor(() => expect(host.querySelector('[role="alert"]')).not.toBeNull())
  expect(banner()).toBeNull()
})

it('提示挂着不动时会自行消失，不会永久遮挡标题栏', async () => {
  vi.useFakeTimers()
  try {
    const load = vi.fn(async () => ({ default: () => <p>合成工作台</p> }))
    await act(async () => root.render(<RendererStartup dependencies={dependencies(notice)} loadWorkspace={load} />))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(banner()).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(MIGRATION_NOTICE_AUTO_DISMISS_MS) })
    expect(banner()).toBeNull()
    expect(host.textContent).toContain('合成工作台')
  } finally { vi.useRealTimers() }
})

it('无迁移提示时不渲染任何横幅', async () => {
  const load = vi.fn(async () => ({ default: () => <p>合成工作台</p> }))
  await act(async () => root.render(<RendererStartup dependencies={dependencies(undefined)} loadWorkspace={load} />))
  await vi.waitFor(() => expect(host.textContent).toContain('合成工作台'))
  expect(banner()).toBeNull()
  expect(dismiss()).toBeUndefined()
})
