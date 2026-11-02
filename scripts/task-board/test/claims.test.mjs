import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  boardDir,
  claimsDir,
  writeClaim,
  readClaim,
  deleteClaim,
  listClaims,
  updateClaim,
} from '../lib/claims.mjs'
import { claimableTasks, containerTaskIds, hasOpenExecution, isClaimable, reapPlan, tagHints } from '../lib/select.mjs'

const TMP = []
function makeStateDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-claims-'))
  TMP.push(dir)
  return dir
}
after(() => {
  for (const dir of TMP) fs.rmSync(dir, { recursive: true, force: true })
})

function makeClaim(overrides = {}) {
  const now = 1_790_000_000_000
  return {
    taskId: 't1',
    agentId: 'copilot:runner',
    boardLedgerId: 'ledger-1',
    boardUrl: 'http://127.0.0.1:1234',
    claimedAt: now,
    startedAt: now,
    leaseUntil: now + 3_600_000,
    pid: 42,
    host: 'test-host',
    moveRequestId: 'move-1',
    ...overrides,
  }
}

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'task',
    prompt: 'do the thing',
    status: 'todo',
    createdAt: 1_000,
    updatedAt: 1_000,
    executions: [],
    ...overrides,
  }
}

function makeSnapshot(tasks) {
  return { schemaVersion: 7, revision: 3, tasks, scheduler: { timeZone: 'UTC', ledgerId: 'ledger-1' } }
}

// ---------------------------------------------------------------- claims store

test('claim paths live under boards/<ledgerId>/claims', () => {
  const dir = makeStateDir()
  assert.equal(boardDir(dir, 'ledger-1'), path.join(dir, 'boards', 'ledger-1'))
  assert.equal(claimsDir(dir, 'ledger-1'), path.join(dir, 'boards', 'ledger-1', 'claims'))
})

test('writeClaim writes 0600 via tmp+rename and round-trips', () => {
  const dir = makeStateDir()
  const file = path.join(claimsDir(dir, 'ledger-1'), 't1.json')
  const written = writeClaim(dir, 'ledger-1', makeClaim())

  assert.equal(written.taskId, 't1')
  assert.equal(written.schemaVersion, 1)
  assert.equal(written.boardLedgerId, 'ledger-1')

  const raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw)
  assert.equal(parsed.agentId, 'copilot:runner')
  assert.equal(parsed.schemaVersion, 1)
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((name) => name.endsWith('.tmp')), [])
  if (process.platform === 'win32') {
    // Windows cannot express POSIX mode bits; the atomic tmp+rename path is the guarantee there.
    assert.ok(fs.existsSync(file))
  } else {
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
  }

  assert.deepEqual(readClaim(dir, 'ledger-1', 't1'), parsed)
  assert.equal(readClaim(dir, 'ledger-1', 'nope'), null)
})

test('writeClaim refuses a foreign board and path-escaping task ids', () => {
  const dir = makeStateDir()
  assert.throws(() => writeClaim(dir, 'ledger-1', makeClaim({ boardLedgerId: 'other' })), /board/)
  for (const bad of ['../evil', 'a/b', 'a\\b', '', '..']) {
    assert.throws(() => writeClaim(dir, 'ledger-1', makeClaim({ taskId: bad })), /taskId/)
  }
  assert.equal(fs.existsSync(claimsDir(dir, 'ledger-1')), false)
})

test('updateClaim merges, rewrites atomically, and returns null when absent', () => {
  const dir = makeStateDir()
  assert.equal(updateClaim(dir, 'ledger-1', 't1', { leaseUntil: 999 }), null)

  writeClaim(dir, 'ledger-1', makeClaim())
  const renewed = updateClaim(dir, 'ledger-1', 't1', { leaseUntil: 1_800_000_000_000, startedAt: 7 })
  assert.equal(renewed.leaseUntil, 1_800_000_000_000)
  assert.equal(renewed.startedAt, 7)
  assert.equal(renewed.agentId, 'copilot:runner')
  assert.equal(readClaim(dir, 'ledger-1', 't1').leaseUntil, 1_800_000_000_000)
  assert.deepEqual(fs.readdirSync(claimsDir(dir, 'ledger-1')).filter((n) => n.endsWith('.tmp')), [])
})

test('deleteClaim removes once and reports it', () => {
  const dir = makeStateDir()
  writeClaim(dir, 'ledger-1', makeClaim())
  assert.equal(deleteClaim(dir, 'ledger-1', 't1'), true)
  assert.equal(deleteClaim(dir, 'ledger-1', 't1'), false)
  assert.equal(readClaim(dir, 'ledger-1', 't1'), null)
})

test('listClaims ignores and cleans malformed files', () => {
  const dir = makeStateDir()
  const claims = claimsDir(dir, 'ledger-1')
  writeClaim(dir, 'ledger-1', makeClaim({ taskId: 't1', claimedAt: 2 }))
  writeClaim(dir, 'ledger-1', makeClaim({ taskId: 't2', claimedAt: 1 }))

  fs.writeFileSync(path.join(claims, 'broken.json'), '{"taskId":')
  fs.writeFileSync(path.join(claims, 'empty.json'), '')
  fs.writeFileSync(path.join(claims, 'wrong-board.json'), JSON.stringify(makeClaim({ taskId: 'wrong-board', boardLedgerId: 'other' })))
  fs.writeFileSync(path.join(claims, 'mismatch.json'), JSON.stringify(makeClaim({ taskId: 'not-mismatch' })))
  fs.writeFileSync(path.join(claims, 'notes.txt'), 'keep me')
  fs.writeFileSync(path.join(claims, 't3.json.123.tmp'), '{"taskId":"t3"}')

  const listed = listClaims(dir, 'ledger-1')
  assert.deepEqual(listed.map((claim) => claim.taskId), ['t2', 't1'])
  const survivors = fs.readdirSync(claims).sort()
  assert.deepEqual(survivors, ['notes.txt', 't1.json', 't2.json', 't3.json.123.tmp'])

  assert.deepEqual(listClaims(dir, 'missing-ledger'), [])
})

// ------------------------------------------------------------------ selection

test('isClaimable filters tags by name and skips non-claimable cards', () => {
  const base = makeTask({ tags: [{ name: 'external' }, { name: 'docs', promptPrefix: 'Read the docs.' }] })
  assert.equal(isClaimable(base), true)
  assert.equal(isClaimable(base, { tag: 'docs' }), true)
  assert.equal(isClaimable(base, { tag: 'absent' }), false)
  assert.equal(isClaimable(makeTask({ tags: [{ name: 'docs' }] })), false)
  assert.equal(isClaimable(makeTask({ tags: [] })), false)

  const skipped = [
    makeTask({ status: 'running', tags: [{ name: 'external' }] }),
    makeTask({ archivedAt: 1, tags: [{ name: 'external' }] }),
    makeTask({ hidden: true, tags: [{ name: 'external' }] }),
    makeTask({ schedule: { enabled: true }, tags: [{ name: 'external' }] }),
    makeTask({ prompt: '   ', tags: [{ name: 'external' }] }),
    makeTask({ prompt: undefined, tags: [{ name: 'external' }] }),
  ]
  for (const task of skipped) assert.equal(isClaimable(task), false, JSON.stringify(task))
  assert.equal(isClaimable(makeTask({ archivedAt: null, hidden: false, schedule: { enabled: false }, tags: [{ name: 'external' }] })), true)
})

test('claimableTasks sorts by createdAt ascending', () => {
  const tasks = [
    makeTask({ id: 'b', createdAt: 200, tags: [{ name: 'external' }] }),
    makeTask({ id: 'skip', createdAt: 50, tags: [{ name: 'other' }] }),
    makeTask({ id: 'c', createdAt: 300, tags: [{ name: 'external' }] }),
    makeTask({ id: 'a', createdAt: 100, tags: [{ name: 'external' }] }),
  ]
  assert.deepEqual(claimableTasks(tasks).map((task) => task.id), ['a', 'b', 'c'])
  assert.deepEqual(tasks.map((task) => task.id), ['b', 'skip', 'c', 'a'], 'input is not mutated')
  assert.deepEqual(claimableTasks(undefined), [])
})

test('containerTaskIds marks every parent that still owns unfinished work', () => {
  assert.deepEqual([...containerTaskIds(undefined)], [])
  assert.deepEqual([...containerTaskIds([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p' })])], ['p'])
  assert.deepEqual(
    [...containerTaskIds([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p', status: 'done' })])],
    [],
    'a parent whose children all landed is a leaf again',
  )
  assert.deepEqual(
    [...containerTaskIds([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p', archivedAt: 5 })])],
    [],
    'an archived child no longer holds its parent',
  )
  assert.deepEqual(
    [...containerTaskIds([makeTask({ id: 'p' }), makeTask({ id: 'c', parentId: 'p', status: 'running' })])],
    ['p'],
    'a child in flight is exactly when dispatching the parent would duplicate work',
  )
  const chain = [
    makeTask({ id: 'root' }),
    makeTask({ id: 'mid', parentId: 'root' }),
    makeTask({ id: 'leaf', parentId: 'mid' }),
  ]
  assert.deepEqual([...containerTaskIds(chain)].sort(), ['mid', 'root'])
})

test('claimableTasks never hands out a container card', () => {
  const tasks = [
    makeTask({ id: 'container', createdAt: 100, tags: [{ name: 'external' }] }),
    makeTask({ id: 'leaf', createdAt: 200, parentId: 'container', tags: [{ name: 'external' }] }),
  ]
  assert.deepEqual(claimableTasks(tasks).map((task) => task.id), ['leaf'])
  const containers = containerTaskIds(tasks)
  assert.equal(isClaimable(tasks[0], { containers }), false)
  // Without the set the predicate stays tag-only; every dispatch path builds the
  // set first (claimableTasks does it on its own), so this is not a gap in `next`.
  assert.equal(isClaimable(tasks[0]), true)
})

test('hasOpenExecution looks only at the last execution', () => {
  assert.equal(hasOpenExecution(makeTask()), false)
  assert.equal(hasOpenExecution(makeTask({ executions: [{ id: 'e1', endedAt: 1 }] })), false)
  assert.equal(hasOpenExecution(makeTask({ executions: [{ id: 'e1', startedAt: 1 }] })), true)
  assert.equal(hasOpenExecution(makeTask({ executions: [{ id: 'e1', endedAt: 1 }, { id: 'e2', startedAt: 2 }] })), true)
  assert.equal(hasOpenExecution(undefined), false)
})

test('tagHints returns non-empty promptPrefix strings only', () => {
  assert.deepEqual(tagHints(makeTask({ tags: [{ name: 'a', promptPrefix: 'Use English.' }, { name: 'b' }, { name: 'c', promptPrefix: '  ' }, { name: 'd', promptPrefix: 'Use English.' }] })), ['Use English.'])
  assert.deepEqual(tagHints(makeTask()), [])
  assert.deepEqual(tagHints(undefined), [])
})

// -------------------------------------------------------------------- reapPlan

test('reapPlan covers every decision branch', () => {
  const now = 1_790_000_000_000
  const leaseMs = 60_000
  const snapshot = makeSnapshot([
    makeTask({ id: 'settled', status: 'done', updatedAt: now }),
    makeTask({ id: 'host', status: 'running', updatedAt: now, executions: [{ id: 'run', startedAt: now }] }),
    makeTask({ id: 'live', status: 'running', updatedAt: now }),
    makeTask({ id: 'expired', status: 'running', updatedAt: now }),
    makeTask({ id: 'corrupt', status: 'running', updatedAt: now }),
    makeTask({ id: 'orphan', status: 'running', updatedAt: now - 10 * leaseMs }),
    makeTask({ id: 'recent-orphan', status: 'running', updatedAt: now - 10 }),
    makeTask({ id: 'todo', status: 'todo', updatedAt: now }),
  ])
  const claims = [
    makeClaim({ taskId: 'settled', leaseUntil: now + leaseMs }),
    makeClaim({ taskId: 'host', leaseUntil: now - leaseMs }),
    makeClaim({ taskId: 'live', leaseUntil: now + leaseMs }),
    makeClaim({ taskId: 'expired', leaseUntil: now - 1 }),
    makeClaim({ taskId: 'corrupt', leaseUntil: undefined }),
    makeClaim({ taskId: 'gone', leaseUntil: now + leaseMs }),
  ]

  const plan = reapPlan({ snapshot, claims, now, leaseMs })
  const byId = Object.fromEntries(plan.map((entry) => [entry.taskId, entry]))

  assert.deepEqual(byId.settled, { taskId: 'settled', action: 'delete-claim', reason: 'task-not-running' })
  assert.deepEqual(byId.gone, { taskId: 'gone', action: 'delete-claim', reason: 'task-missing' })
  assert.deepEqual(byId.host, { taskId: 'host', action: 'delete-claim', reason: 'host-running' })
  assert.deepEqual(byId.live, { taskId: 'live', action: 'keep', reason: 'lease-active' })
  assert.deepEqual(byId.expired, { taskId: 'expired', action: 'move-todo', reason: 'lease-expired' })
  assert.deepEqual(byId.corrupt, { taskId: 'corrupt', action: 'move-todo', reason: 'lease-expired' })
  assert.deepEqual(byId.orphan, { taskId: 'orphan', action: 'move-todo', reason: 'orphan-stale' })
  assert.equal(byId['recent-orphan'], undefined, 'a just-moved card is left alone')
  assert.equal(byId.todo, undefined, 'todo cards need no reap entry')
  assert.equal(plan.length, 7)
  assert.equal(snapshot.tasks.find((task) => task.id === 'expired').status, 'running', 'pure: nothing is applied')
})

test('reapPlan tolerates junk claims and empty snapshots', () => {
  const now = 1_790_000_000_000
  assert.deepEqual(reapPlan({ snapshot: makeSnapshot([]), claims: [], now, leaseMs: 1 }), [])
  const plan = reapPlan({
    snapshot: makeSnapshot([]),
    claims: [null, {}, { taskId: '' }, makeClaim({ taskId: 'ghost' })],
    now,
    leaseMs: 1,
  })
  assert.deepEqual(plan, [{ taskId: 'ghost', action: 'delete-claim', reason: 'task-missing' }])
  assert.throws(() => reapPlan({ snapshot: {}, claims: [], now, leaseMs: 1 }), /snapshot/)
})
