#!/usr/bin/env node
/**
 * Doubao desktop automation instance - minimal CDP probe.
 *
 * Zero dependencies: Node 22 ships global fetch + WebSocket.
 * Usage: node scripts/doubao/probe.mjs [port]
 *
 * Reads only: no clicking, no message sending. Safe to run anytime.
 */

const port = Number(process.argv[2] ?? 9331)

const listTargets = async () => {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  if (!response.ok) throw new Error(`/json/list returned ${response.status}`)
  return response.json()
}

const evaluate = (socket, expression) =>
  new Promise((resolve, reject) => {
    const requestId = 1
    const timer = setTimeout(() => reject(new Error('Runtime.evaluate timed out')), 15_000)
    const onMessage = event => {
      const message = JSON.parse(String(event.data))
      if (message.id !== requestId) return
      clearTimeout(timer)
      socket.removeEventListener('message', onMessage)
      if (message.error) return reject(new Error(message.error.message))
      if (message.result?.exceptionDetails) {
        return reject(new Error(message.result.exceptionDetails.exception?.description ?? 'evaluation threw'))
      }
      resolve(message.result?.result?.value)
    }
    socket.addEventListener('message', onMessage)
    socket.send(JSON.stringify({
      id: requestId,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true },
    }))
  })

const connect = url =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => reject(new Error('WebSocket connect timed out')), 10_000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(socket) }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket connect failed')) }, { once: true })
  })

// Optional: node scripts/doubao/probe.mjs 9331 --eval "<expression>"
const inlineExpression = process.argv[3] === '--eval' ? process.argv[4] : undefined

const targets = await listTargets()
if (!inlineExpression) {
  console.log(`CDP 127.0.0.1:${port} - ${targets.length} target(s)`)
  for (const target of targets) {
    console.log(`  [${target.type}] ${target.title || '(no title)'}\n      ${target.url}`)
  }
}

const page = targets.find(target => target.type === 'page' && target.url.includes('doubao-chat'))
  ?? targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl)
if (!page) throw new Error('no injectable page target found')

console.log(`\n注入目标: ${page.url}`)
const socket = await connect(page.webSocketDebuggerUrl)
try {
  const expression = inlineExpression ?? `(() => ({
    title: document.title,
    href: location.href,
    readyState: document.readyState,
    textLength: (document.body?.innerText ?? '').length,
    head: (document.body?.innerText ?? '').slice(0, 160).replace(/\\s+/g, ' '),
    loggedIn: !location.href.includes('login')
  }))()`
  const value = await evaluate(socket, expression)
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
} finally {
  socket.close()
}
