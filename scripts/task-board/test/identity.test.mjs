import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveBoard, readCache, writeCache } from '../lib/identity.mjs'
import { startFakeBoard } from './fake-board.mjs'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-task-board-'))
}

function portOf(url) {
  return Number(new URL(url).port)
}

test('explicit url wins and caches the ledgerId', async () => {
  const board = await startFakeBoard({ ledgerId: 'ledger-A' })
  const stateDir = tempDir()
  const resolved = await resolveBoard({ explicitUrl: board.url, stateDir, env: {}, listPorts: () => [] })
  assert.equal(resolved.url, board.url)
  assert.equal(resolved.ledgerId, 'ledger-A')
  assert.equal(resolved.snapshot.schemaVersion, 7)
  assert.equal(readCache(stateDir).ledgerId, 'ledger-A')
  await board.close()
})

test('an explicit url that is unreachable stays fatal and skips discovery', async () => {
  const board = await startFakeBoard({})
  const url = board.url
  await board.close()
  let discoveryRan = false
  await assert.rejects(
    () => resolveBoard({
      explicitUrl: url,
      stateDir: tempDir(),
      env: {},
      probeTimeoutMs: 300,
      listPorts: () => {
        discoveryRan = true
        return []
      },
    }),
    (error) => error.code === 'unreachable',
  )
  assert.equal(discoveryRan, false)
})

test('a stale env URL falls through to discovery', async () => {
  const board = await startFakeBoard({ ledgerId: 'ledger-B' })
  const resolved = await resolveBoard({
    stateDir: tempDir(),
    env: { DSH_WEB_URL: 'http://127.0.0.1:1' },
    probeTimeoutMs: 300,
    listPorts: () => [{ port: portOf(board.url), name: 'node' }],
  })
  assert.equal(resolved.ledgerId, 'ledger-B')
  await board.close()
})

test('discovery ignores unrelated listeners and finds the board', async () => {
  const board = await startFakeBoard({ ledgerId: 'ledger-C' })
  const resolved = await resolveBoard({
    stateDir: tempDir(),
    env: {},
    probeTimeoutMs: 300,
    listPorts: () => [
      { port: 1, name: 'unrelated' },
      { port: portOf(board.url), name: 'DeepSeek Harness.exe' },
    ],
  })
  assert.equal(resolved.url, board.url)
  assert.equal(resolved.ledgerId, 'ledger-C')
  await board.close()
})

test('a cached url whose ledgerId changed is discarded, not trusted', async () => {
  const board = await startFakeBoard({ ledgerId: 'ledger-D' })
  const stateDir = tempDir()
  writeCache(stateDir, { url: board.url, ledgerId: 'some-other-ledger' })
  const resolved = await resolveBoard({
    stateDir,
    env: {},
    probeTimeoutMs: 300,
    listPorts: () => [{ port: portOf(board.url), name: 'node' }],
  })
  assert.equal(resolved.ledgerId, 'ledger-D')
  assert.equal(readCache(stateDir).ledgerId, 'ledger-D')
  await board.close()
})

test('two boards on the machine are reported as ambiguous', async () => {
  const first = await startFakeBoard({ ledgerId: 'ledger-E' })
  const second = await startFakeBoard({ ledgerId: 'ledger-F' })
  await assert.rejects(
    () => resolveBoard({
      stateDir: tempDir(),
      env: {},
      probeTimeoutMs: 300,
      listPorts: () => [
        { port: portOf(first.url), name: 'node' },
        { port: portOf(second.url), name: 'node' },
      ],
    }),
    (error) => error.code === 'ambiguous',
  )
  await first.close()
  await second.close()
})

test('a newer board schema is accepted and an older one is reported', async () => {
  const newer = await startFakeBoard({ schemaVersion: 8, ledgerId: 'ledger-newer' })
  const resolved = await resolveBoard({
    stateDir: tempDir(),
    env: {},
    probeTimeoutMs: 300,
    listPorts: () => [{ port: portOf(newer.url), name: 'node' }],
  })
  assert.equal(resolved.snapshot.schemaVersion, 8)
  await newer.close()

  const older = await startFakeBoard({ schemaVersion: 6, ledgerId: 'ledger-older' })
  await assert.rejects(
    () => resolveBoard({
      stateDir: tempDir(),
      env: {},
      probeTimeoutMs: 300,
      listPorts: () => [{ port: portOf(older.url), name: 'node' }],
    }),
    (error) => error.code === 'invalid-response',
  )
  await older.close()
})

test('no candidates at all reports unreachable', async () => {
  await assert.rejects(
    () => resolveBoard({ stateDir: tempDir(), env: {}, listPorts: () => [] }),
    (error) => error.code === 'unreachable',
  )
})
