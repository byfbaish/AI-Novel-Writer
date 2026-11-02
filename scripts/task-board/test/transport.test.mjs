import { test } from 'node:test'
import assert from 'node:assert/strict'
import { httpTransport, normalizeBaseUrl } from '../lib/transport.mjs'
import { BoardError, exitCodeFor, EXIT } from '../lib/errors.mjs'
import { startFakeBoard } from './fake-board.mjs'

test('normalizeBaseUrl strips a trailing slash and keeps the mount', () => {
  assert.equal(normalizeBaseUrl('http://127.0.0.1:62185/'), 'http://127.0.0.1:62185')
  assert.equal(normalizeBaseUrl('http://127.0.0.1:62185/dsh/'), 'http://127.0.0.1:62185/dsh')
})

test('normalizeBaseUrl rejects https instead of advertising an unimplemented transport', () => {
  assert.throws(() => normalizeBaseUrl('https://127.0.0.1:62185'), (error) => error instanceof BoardError && error.code === 'usage')
})

test('GET state with the matching Origin returns the snapshot', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', title: 'x', status: 'todo' }] })
  const transport = httpTransport(board.url)
  const state = await transport.getState()
  assert.equal(state.schemaVersion, 7)
  assert.equal(state.tasks[0].id, 't1')
  assert.equal(state.scheduler.ledgerId, board.ledgerId)
  await board.close()
})

test('a refused request maps to forbidden (exit 4), not unreachable', async () => {
  const board = await startFakeBoard({ forceStateStatus: 403 })
  await assert.rejects(
    () => httpTransport(board.url).getState(),
    (error) => error instanceof BoardError && error.code === 'forbidden' && exitCodeFor(error) === EXIT.UNAVAILABLE,
  )
  await board.close()
})

test('an Origin that does not match the Host is refused', async () => {
  const board = await startFakeBoard({ requiredOrigin: 'http://127.0.0.1:1' })
  await assert.rejects(
    () => httpTransport(board.url).getState(),
    (error) => error instanceof BoardError && error.code === 'forbidden',
  )
  await board.close()
})

test('apply posts the JSON envelope and returns the new snapshot', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  const transport = httpTransport(board.url)
  const snapshot = await transport.apply({
    requestId: 'req-1',
    action: { kind: 'move', taskId: 't1', status: 'running' },
    initiator: 'copilot:doc-runner',
  })
  assert.equal(snapshot.tasks[0].status, 'running')
  const actionCalls = board.calls.filter((call) => call.path === '/api/task-board/action')
  assert.equal(actionCalls.length, 1)
  assert.equal(JSON.parse(actionCalls[0].body).requestId, 'req-1')
  assert.equal(actionCalls[0].headers['content-type'], 'application/json')
  await board.close()
})

test('a refused move maps to conflict (exit 3)', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  const transport = httpTransport(board.url)
  await assert.rejects(
    () => transport.apply({ requestId: 'req-2', action: { kind: 'move', taskId: 't1', status: 'todo' } }),
    (error) => error instanceof BoardError && error.code === 'conflict' && exitCodeFor(error) === EXIT.CONFLICT,
  )
  await board.close()
})

test('an unknown action kind is reported as a bad envelope, not a conflict', async () => {
  const board = await startFakeBoard({})
  await assert.rejects(
    () => httpTransport(board.url).apply({ requestId: 'req-3', action: { kind: 'nope' } }),
    (error) => error instanceof BoardError && error.code === 'invalid-response',
  )
  await board.close()
})

test('an envelope with an over-long initiator is a bad envelope, not a conflict', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  await assert.rejects(
    () => httpTransport(board.url).apply({
      requestId: 'req-long',
      action: { kind: 'move', taskId: 't1', status: 'running' },
      initiator: 'x'.repeat(300),
    }),
    (error) => error instanceof BoardError && error.code === 'invalid-response',
  )
  await board.close()
})

test('an unreachable port maps to unreachable (exit 4)', async () => {
  const board = await startFakeBoard({})
  const url = board.url
  await board.close()
  await assert.rejects(
    () => httpTransport(url, { timeoutMs: 500 }).getState(),
    (error) => error instanceof BoardError && error.code === 'unreachable' && exitCodeFor(error) === EXIT.UNAVAILABLE,
  )
})

test('requestId idempotency returns the same revision on a retry', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo' }] })
  const transport = httpTransport(board.url)
  const first = await transport.apply({ requestId: 'same', action: { kind: 'move', taskId: 't1', status: 'running' } })
  const second = await transport.apply({ requestId: 'same', action: { kind: 'move', taskId: 't1', status: 'running' } })
  assert.equal(first.revision, second.revision)
  await board.close()
})
