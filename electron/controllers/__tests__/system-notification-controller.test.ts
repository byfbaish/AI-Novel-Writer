import { beforeEach, describe, expect, it, vi } from 'vitest'

type IpcHandler = (...args: unknown[]) => Promise<unknown>

class FakeNotification {
  readonly options: { title: string; body: string; silent?: boolean }
  private readonly listeners = new Map<string, () => void>()
  shown = false

  constructor(options: { title: string; body: string; silent?: boolean }) {
    this.options = options
    mocks.notifications.push(this)
  }

  on(event: string, listener: () => void): this {
    this.listeners.set(event, listener)
    return this
  }

  show(): void {
    this.shown = true
  }

  click(): void {
    this.listeners.get('click')?.()
  }
}

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  notifications: [] as FakeNotification[],
  supported: true,
  config: {
    systemNotificationEnabled: true,
    notificationOnlyWhenUnfocused: true,
  } as { systemNotificationEnabled?: boolean; notificationOnlyWhenUnfocused?: boolean },
}))

vi.mock('electron', () => ({
  Notification: class extends FakeNotification {
    static isSupported(): boolean {
      return mocks.supported
    }
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler)
    }),
  },
  BrowserWindow: {
    fromWebContents: vi.fn((sender: { window: FakeWindow }) => sender.window),
  },
}))

vi.mock('../../utils/config-utils', () => ({
  GLOBAL_CONFIG_PATH: 'fixture://config.json',
  DEFAULT_GLOBAL_CONFIG: {
    systemNotificationEnabled: true,
    notificationOnlyWhenUnfocused: true,
  },
  readJsonFile: () => mocks.config,
}))

class FakeWindow {
  focused = false
  minimized = false
  destroyed = false
  readonly show = vi.fn()
  readonly focus = vi.fn()
  readonly restore = vi.fn()
  readonly webContents = {
    isDestroyed: vi.fn(() => this.destroyed),
    send: vi.fn(),
  }

  isFocused(): boolean { return this.focused }
  isMinimized(): boolean { return this.minimized }
  isDestroyed(): boolean { return this.destroyed }
}

function handler(channel: string): IpcHandler {
  const registered = mocks.handlers.get(channel)
  if (!registered) throw new Error(`Missing IPC handler: ${channel}`)
  return registered as IpcHandler
}

function senderFor(win: FakeWindow): { sender: { window: FakeWindow } } {
  return { sender: { window: win } }
}

const REQUEST = { title: 'AI小说作家', body: '「第 3 章」已完成' }

beforeEach(async () => {
  vi.resetModules()
  mocks.handlers.clear()
  mocks.notifications.length = 0
  mocks.supported = true
  mocks.config = { systemNotificationEnabled: true, notificationOnlyWhenUnfocused: true }
  const { registerSystemNotificationController } = await import('../system-notification-controller')
  registerSystemNotificationController()
})

describe('system notification controller', () => {
  it('弹一条无声通知（声音归渲染侧，避免双响）', async () => {
    const win = new FakeWindow()
    win.focused = false

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: true })

    expect(mocks.notifications).toHaveLength(1)
    expect(mocks.notifications[0].options).toMatchObject({
      title: 'AI小说作家',
      body: '「第 3 章」已完成',
      silent: true,
    })
    expect(mocks.notifications[0].shown).toBe(true)
  })

  it('窗口在前台时不打扰（suppressed-focused），连 Notification 都不构造', async () => {
    const win = new FakeWindow()
    win.focused = true

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: false, reason: 'suppressed-focused' })
    expect(mocks.notifications).toHaveLength(0)
  })

  it('最小化时照弹（minimized 不算「作者正盯着」）', async () => {
    const win = new FakeWindow()
    win.minimized = true

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: true })
  })

  it('关掉「聚焦时抑制」后，前台也弹', async () => {
    mocks.config = { systemNotificationEnabled: true, notificationOnlyWhenUnfocused: false }
    const win = new FakeWindow()
    win.focused = true

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: true })
  })

  it('总开关关闭时一条都不弹', async () => {
    mocks.config = { systemNotificationEnabled: false, notificationOnlyWhenUnfocused: true }
    const win = new FakeWindow()

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: false, reason: 'suppressed-disabled' })
    expect(mocks.notifications).toHaveLength(0)
  })

  it('平台不支持时降级为 unsupported，不抛错', async () => {
    mocks.supported = false
    const win = new FakeWindow()

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: false, reason: 'unsupported' })
  })

  it('空正文 / 非法 route / 非对象一律拒绝，不弹畸形通知', async () => {
    const win = new FakeWindow()
    const show = handler('system-notification:show')

    await expect(show(senderFor(win), { title: 'x', body: '   ' }))
      .resolves.toEqual({ shown: false, reason: 'invalid-request' })
    await expect(show(senderFor(win), { ...REQUEST, route: 'nowhere' }))
      .resolves.toEqual({ shown: false, reason: 'invalid-request' })
    await expect(show(senderFor(win), null))
      .resolves.toEqual({ shown: false, reason: 'invalid-request' })
    expect(mocks.notifications).toHaveLength(0)
  })

  it('缺标题时用兜底名，不弹空标题通知', async () => {
    const win = new FakeWindow()

    await handler('system-notification:show')(senderFor(win), { body: '已完成' })
    expect(mocks.notifications[0].options.title).toBe('AI Novel Writer')
  })

  it('点击通知：窗口回前台并把 route 推回渲染进程', async () => {
    const win = new FakeWindow()
    win.minimized = true

    await handler('system-notification:show')(senderFor(win), { ...REQUEST, route: 'ai-output' })
    mocks.notifications[0].click()

    expect(win.restore).toHaveBeenCalled()
    expect(win.show).toHaveBeenCalled()
    expect(win.focus).toHaveBeenCalled()
    expect(win.webContents.send).toHaveBeenCalledWith(
      'system-notification:activated',
      { route: 'ai-output' },
    )
  })

  it('没有 route 时点击只回前台，不推送跳转', async () => {
    const win = new FakeWindow()

    await handler('system-notification:show')(senderFor(win), REQUEST)
    mocks.notifications[0].click()

    expect(win.focus).toHaveBeenCalled()
    expect(win.webContents.send).not.toHaveBeenCalled()
  })

  it('窗口已销毁：不弹、点击也不炸', async () => {
    const win = new FakeWindow()
    win.destroyed = true

    await expect(handler('system-notification:show')(senderFor(win), REQUEST))
      .resolves.toEqual({ shown: false, reason: 'unsupported' })
    expect(mocks.notifications).toHaveLength(0)
  })

  it('permission 通道是可 await 的 handle（不是会被丢弃返回值的 on）', async () => {
    await expect(handler('system-notification:permission')({}))
      .resolves.toBe('granted')
    mocks.supported = false
    await expect(handler('system-notification:permission')({}))
      .resolves.toBe('unsupported')
  })
})
