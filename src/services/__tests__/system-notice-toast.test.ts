import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../components/ui/Toast', () => ({
  toast: {
    info: mocks.info,
    success: mocks.success,
    warning: mocks.warning,
    error: mocks.error,
  },
}))

import { globalEventBus } from '../../shared/event-bus'
import { initSystemNoticeToast } from '../system-notice-toast'

describe('initSystemNoticeToast', () => {
  let dispose: (() => void) | undefined

  beforeEach(() => {
    dispose = initSystemNoticeToast()
  })

  afterEach(() => {
    dispose?.()
    dispose = undefined
    vi.clearAllMocks()
  })

  it('renders the clear receipt as exactly one info toast, message verbatim', () => {
    const receipt = '故事架构：清了 2 类，共 5 条。 章节规划：清了 1 类，共 3 条。 正文与审稿：清了 3 类，共 12 条。'
    globalEventBus.emit('SYSTEM_NOTICE', { level: 'info', message: receipt })

    // 三段回执是一条消息里的三行文本：只弹一条，不拆三条、不改写。
    expect(mocks.info).toHaveBeenCalledTimes(1)
    expect(mocks.info).toHaveBeenCalledWith(receipt, 6000)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.warning).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('maps warn / error / success to their own toast types', () => {
    globalEventBus.emit('SYSTEM_NOTICE', { level: 'warn', message: 'w' })
    globalEventBus.emit('SYSTEM_NOTICE', { level: 'error', message: 'e' })
    globalEventBus.emit('SYSTEM_NOTICE', { level: 'success', message: 's' })

    expect(mocks.warning).toHaveBeenCalledWith('w')
    expect(mocks.error).toHaveBeenCalledWith('e')
    expect(mocks.success).toHaveBeenCalledWith('s')
    expect(mocks.info).not.toHaveBeenCalled()
  })

  it('stops delivering after dispose', () => {
    globalEventBus.emit('SYSTEM_NOTICE', { level: 'info', message: 'before' })
    dispose?.()
    dispose = undefined
    globalEventBus.emit('SYSTEM_NOTICE', { level: 'info', message: 'after' })

    expect(mocks.info).toHaveBeenCalledTimes(1)
    expect(mocks.info).toHaveBeenCalledWith('before', 6000)
  })
})
