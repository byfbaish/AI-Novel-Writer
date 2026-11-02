/**
 * Minimal Chrome DevTools Protocol client for Doubao desktop automation.
 * Zero dependencies: Node 22 global fetch + WebSocket.
 *
 * This module deliberately knows nothing about Doubao's DOM - selectors live in
 * doubao.mjs so that a Doubao UI update only requires touching one file.
 */

export const DEFAULT_PORT = 9331

export async function listTargets(port = DEFAULT_PORT) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  if (!response.ok) throw new Error(`CDP /json/list returned ${response.status} on port ${port}`)
  return response.json()
}

/** The chat renderer is the only page that carries a live conversation. */
export function pickChatPage(targets) {
  return targets.find(target => target.type === 'page' && target.url.includes('doubao-chat'))
    ?? null
}

export function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timed out')), 10_000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(socket) }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP WebSocket connect failed')) }, { once: true })
  })
}

export function createClient(socket) {
  let nextId = 1
  const pending = new Map()

  const onMessage = event => {
    let message
    try { message = JSON.parse(String(event.data)) } catch { return }
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.error) entry.reject(new Error(message.error.message))
    else entry.resolve(message.result)
  }
  socket.addEventListener('message', onMessage)

  const send = (method, params = {}, timeoutMs = 30_000) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} timed out`) ) }, timeoutMs)
      pending.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ id, method, params }))
    })

  const evaluate = async (expression, timeoutMs = 30_000) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: timeoutMs,
    }, timeoutMs + 5_000)
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'renderer evaluation threw')
    }
    return result.result?.value
  }

  return {
    send,
    evaluate,
    insertText: text => send('Input.insertText', { text }),
    key: async (key, code, windowsVirtualKeyCode, modifiers = 0) => {
      const base = { key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers }
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    },
    close: () => {
      socket.removeEventListener('message', onMessage)
      socket.close()
    },
  }
}

export async function withChat(fn, port = DEFAULT_PORT) {
  const targets = await listTargets(port)
  const page = pickChatPage(targets)
  if (!page) {
    throw new Error(
      `端口 ${port} 上没有找到豆包聊天页。先运行 scripts/doubao/start-doubao-cdp.cmd 启动自动化实例。`,
    )
  }
  const socket = await connect(page.webSocketDebuggerUrl)
  const client = createClient(socket)
  try {
    return await fn(client, page)
  } finally {
    client.close()
  }
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
