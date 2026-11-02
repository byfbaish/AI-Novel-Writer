import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { writeCache } from '../lib/identity.mjs'
import { startFakeBoard } from './fake-board.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const MCP = path.join(REPO_ROOT, 'scripts', 'task-board', 'mcp.mjs')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-task-board-mcp-'))
}

function startMcp(env) {
  const child = spawn(process.execPath, [MCP], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DSH_BOARD_STATE_DIR: env.stateDir,
      DSH_BOARD_URL: env.url ?? '',
      DSH_WEB_URL: '',
      DSH_BOARD_AGENT: env.agent ?? '',
    },
  })
  const pending = new Map()
  const stray = []
  let nextId = 1
  const reader = readline.createInterface({ input: child.stdout, crlfDelay: Infinity })
  reader.on('line', (line) => {
    const message = JSON.parse(line)
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
      return
    }
    stray.push(message)
  })
  function request(method, params) {
    const id = nextId
    nextId += 1
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), 5_000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        resolve(message)
      })
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }
  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }
  return { child, request, notify, stray }
}

async function initialize(session) {
  const response = await session.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } })
  session.notify('notifications/initialized')
  return response
}

function toolPayload(response) {
  assert.equal(response.result?.isError, undefined, JSON.stringify(response.result))
  return JSON.parse(response.result.content[0].text)
}

test('initialize negotiates a version and lists the thirteen task_board tools', async () => {
  const board = await startFakeBoard({})
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: 'test:agent' })
  const init = await initialize(session)
  assert.equal(init.result.serverInfo.name, 'dsh-task-board')
  assert.equal(init.result.protocolVersion, '2025-06-18')
  assert.deepEqual(init.result.capabilities, { tools: {} })
  const list = await session.request('tools/list', {})
  const names = list.result.tools.map((tool) => tool.name)
  assert.equal(names.length, 13)
  assert.ok(names.every((name) => name.startsWith('task_board_')))
  assert.ok(names.includes('task_board_create'))
  assert.deepEqual(session.stray, [])
  session.child.kill()
  await board.close()
})

test('tools/call drives claim, done and the empty-next case', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }] }] })
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: 'test:agent' })
  await initialize(session)

  const doctor = toolPayload(await session.request('tools/call', { name: 'task_board_doctor', arguments: {} }))
  assert.equal(doctor.ledgerId, board.ledgerId)

  const claimed = toolPayload(await session.request('tools/call', { name: 'task_board_next', arguments: {} }))
  assert.equal(claimed.claimed, true)
  assert.equal(claimed.task.id, 't1')

  const done = toolPayload(await session.request('tools/call', {
    name: 'task_board_done',
    arguments: { taskId: 't1', summary: 'done via mcp', report: 'reports/t1.md' },
  }))
  assert.equal(done.task.status, 'done')
  assert.equal(board.snapshot().tasks[0].executions.at(-1).external, true)

  const empty = toolPayload(await session.request('tools/call', { name: 'task_board_next', arguments: {} }))
  assert.deepEqual(empty, { claimed: false })
  session.child.kill()
  await board.close()
})

test('task_board_create publishes a card, then next can claim it', async () => {
  const board = await startFakeBoard({})
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: 'test:agent' })
  await initialize(session)
  const created = toolPayload(await session.request('tools/call', {
    name: 'task_board_create',
    arguments: { title: 'from mcp', description: 'd', prompt: 'do the thing', tags: ['external'] },
  }))
  assert.equal(created.task.status, 'todo')
  assert.deepEqual(created.task.tags, [{ name: 'external' }])
  const claimed = toolPayload(await session.request('tools/call', { name: 'task_board_next', arguments: {} }))
  assert.equal(claimed.task.id, created.id)
  session.child.kill()
  await board.close()
})

test('a notification with no id produces no response frame', async () => {
  const board = await startFakeBoard({})
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: 'test:agent' })
  await initialize(session)
  session.notify('ping')
  const listed = await session.request('tools/list', {})
  assert.ok(Array.isArray(listed.result.tools))
  assert.deepEqual(session.stray, [])
  session.child.kill()
  await board.close()
})

test('the MCP shell re-resolves the board after a restart on a new port', async () => {
  const first = await startFakeBoard({ ledgerId: 'ledger-first' })
  const stateDir = tempDir()
  const session = startMcp({ stateDir, url: first.url, agent: 'test:agent' })
  await initialize(session)
  const before = toolPayload(await session.request('tools/call', { name: 'task_board_doctor', arguments: {} }))
  assert.equal(before.ledgerId, 'ledger-first')
  await first.close()

  const second = await startFakeBoard({ ledgerId: 'ledger-second' })
  writeCache(stateDir, { url: second.url, ledgerId: 'ledger-second' })
  const after = toolPayload(await session.request('tools/call', { name: 'task_board_doctor', arguments: {} }))
  assert.equal(after.ledgerId, 'ledger-second')
  assert.equal(after.url, second.url)
  session.child.kill()
  await second.close()
})

test('a tool failure is reported with isError, not a protocol error', async () => {
  const board = await startFakeBoard({})
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: '' })
  await initialize(session)
  const response = await session.request('tools/call', { name: 'task_board_next', arguments: {} })
  assert.equal(response.result.isError, true)
  assert.match(response.result.content[0].text, /identity/u)
  session.child.kill()
  await board.close()
})

test('an unknown method is a JSON-RPC -32601 and an unknown tool is an isError', async () => {
  const board = await startFakeBoard({})
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: 'test:agent' })
  await initialize(session)
  const unknownMethod = await session.request('nope/nope', {})
  assert.equal(unknownMethod.error.code, -32601)
  const unknownTool = await session.request('tools/call', { name: 'task_board_nope', arguments: {} })
  assert.equal(unknownTool.result.isError, true)
  session.child.kill()
  await board.close()
})

test('a permission-less read still works without an agent identity', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  const session = startMcp({ stateDir: tempDir(), url: board.url, agent: '' })
  await initialize(session)
  const listed = toolPayload(await session.request('tools/call', { name: 'task_board_list', arguments: {} }))
  assert.equal(listed.tasks.length, 1)
  session.child.kill()
  await board.close()
})
