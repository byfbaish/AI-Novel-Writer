/* global process */
/**
 * Smoke-test the task-board MCP shell over stdio.
 *
 * Spawns scripts/task-board/mcp.mjs exactly the way an MCP client would, then
 * walks the handshake: initialize -> notifications/initialized -> tools/list ->
 * tools/call task_board_list. Read-only: never claims or mutates a card.
 *
 * Usage: node scripts/task-board/probe-mcp-stdio.mjs
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const serverPath = path.join(here, 'mcp.mjs')

const child = spawn(process.execPath, [serverPath], {
  cwd: here,
  env: { ...process.env, DSH_BOARD_AGENT: 'workbuddy:mcp-probe' },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
})

let buffer = ''
const pending = new Map()
const stderr = []

child.stderr.on('data', chunk => stderr.push(String(chunk)))

child.stdout.on('data', chunk => {
  buffer += String(chunk)
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    if (!line) continue
    let message
    try {
      message = JSON.parse(line)
    } catch {
      console.log(`[non-json stdout] ${line.slice(0, 160)}`)
      continue
    }
    const resolve = pending.get(message.id)
    if (resolve) {
      pending.delete(message.id)
      resolve(message)
    }
  }
})

const send = (payload, expectReply = true) => {
  child.stdin.write(`${JSON.stringify(payload)}\n`)
  if (!expectReply) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    pending.set(payload.id, resolve)
    setTimeout(() => reject(new Error(`timeout waiting for id=${payload.id}`)), 20_000)
  })
}

const fail = message => {
  console.error(`FAIL ${message}`)
  child.kill()
  process.exit(1)
}

const init = await send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '0.0.0' } },
})
if (init.error) fail(`initialize: ${JSON.stringify(init.error)}`)
console.log(`initialize ok: server=${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version ?? ''}`)

await send({ jsonrpc: '2.0', method: 'notifications/initialized' }, false)

const tools = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
if (tools.error) fail(`tools/list: ${JSON.stringify(tools.error)}`)
const names = (tools.result?.tools ?? []).map(tool => tool.name)
console.log(`tools/list ok: ${names.length} 个 -> ${names.join(', ')}`)

const listName = names.find(name => /list/i.test(name))
if (!listName) fail('没有 list 类工具，无法只读验证')

const called = await send({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: { name: listName, arguments: {} },
})
if (called.error) fail(`tools/call ${listName}: ${JSON.stringify(called.error)}`)

const text = called.result?.content?.map(part => part.text ?? '').join('')
let parsed = null
try {
  parsed = JSON.parse(text)
} catch {
  /* 非 JSON 也接受，只要不是 isError */
}
if (called.result?.isError) fail(`${listName} returned isError: ${String(text).slice(0, 200)}`)

const tasks = parsed?.tasks ?? parsed
const count = Array.isArray(tasks) ? tasks.length : 'n/a'
console.log(`tools/call ${listName} ok: ${count} 张卡${parsed?.ledgerId ? ` · ledgerId=${String(parsed.ledgerId).slice(0, 8)}…` : ''}`)
if (stderr.length) console.log(`stderr: ${stderr.join('').trim().split('\n').slice(0, 3).join(' | ')}`)

child.kill()
console.log('PASS stdio MCP shell 可用')
