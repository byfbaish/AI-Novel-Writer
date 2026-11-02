import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startFakeBoard } from './fake-board.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CLI = path.join(REPO_ROOT, 'scripts', 'task-board', 'dsh-task-board.mjs')

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-task-board-cli-'))
}

function childEnv(stateDir) {
  return {
    ...process.env,
    DSH_BOARD_STATE_DIR: stateDir,
    DSH_BOARD_URL: '',
    DSH_WEB_URL: '',
    DSH_BOARD_AGENT: '',
  }
}

// The fake board lives in THIS process, so every CLI invocation must be async:
// spawnSync would block the event loop and the board could not answer.
function runCli(args, stateDir) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: REPO_ROOT, env: childEnv(stateDir) })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

test('doctor reports the resolved board as JSON and exits 0', async () => {
  const board = await startFakeBoard({ ledgerId: 'ledger-cli' })
  const result = await runCli(['doctor', '--json', '--url', board.url, '--agent', 'test:agent'], tempDir())
  assert.equal(result.code, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.ledgerId, 'ledger-cli')
  assert.equal(payload.schemaVersion, 7)
  assert.equal(payload.url, board.url)
  await board.close()
})

test('next claims a card as JSON, then reports no-candidate with exit 2', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }] }] })
  const stateDir = tempDir()
  const first = await runCli(['next', '--json', '--url', board.url, '--agent', 'test:agent'], stateDir)
  assert.equal(first.code, 0, first.stderr)
  const payload = JSON.parse(first.stdout)
  assert.equal(payload.claimed, true)
  assert.equal(payload.task.id, 't1')
  assert.equal(board.snapshot().tasks[0].status, 'running')
  const second = await runCli(['next', '--json', '--url', board.url, '--agent', 'test:agent'], stateDir)
  assert.equal(second.code, 2)
  await board.close()
})

test('two concurrent next processes produce exactly one claim', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 'only', tags: [{ name: 'external' }] }] })
  const stateDir = tempDir()
  const args = ['next', '--json', '--url', board.url, '--agent', 'test:agent']
  const [left, right] = await Promise.all([runCli(args, stateDir), runCli(args, stateDir)])
  assert.deepEqual([left.code, right.code].sort(), [0, 2])
  await board.close()
})

test('done requires a summary (usage, exit 5)', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }] }] })
  const stateDir = tempDir()
  assert.equal((await runCli(['next', '--url', board.url, '--agent', 'test:agent'], stateDir)).code, 0)
  const result = await runCli(['done', 't1', '--url', board.url, '--agent', 'test:agent'], stateDir)
  assert.equal(result.code, 5)
  await board.close()
})

test('done records the outcome and the board settles the card', async () => {
  // Pre-labelled `review`: `done` refuses a card nobody handed over, and this
  // test is about the CLI surface, not the handover path.
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }, { name: 'review' }] }] })
  const stateDir = tempDir()
  assert.equal((await runCli(['next', '--url', board.url, '--agent', 'test:agent'], stateDir)).code, 0)
  const result = await runCli(
    ['done', 't1', '--summary', 'shipped', '--report', 'reports/t1.md', '--json', '--url', board.url, '--agent', 'test:agent'],
    stateDir,
  )
  assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).task.status, 'done')
  const execution = board.snapshot().tasks[0].executions.at(-1)
  assert.equal(execution.external, true)
  assert.match(execution.error, /shipped/u)
  assert.match(execution.error, /reports\/t1\.md/u)
  await board.close()
})

test('a write command without an identity is a usage error', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }] }] })
  const result = await runCli(['next', '--url', board.url], tempDir())
  assert.equal(result.code, 5)
  await board.close()
})

test('a board that refuses requests exits 4 with a readable reason', async () => {
  const board = await startFakeBoard({ forceStateStatus: 403 })
  const result = await runCli(['doctor', '--url', board.url, '--agent', 'test:agent'], tempDir())
  assert.equal(result.code, 4)
  assert.match(result.stderr, /forbidden|refused/u)
  await board.close()
})

test('list prints a single JSON value when --json is set', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', title: 'first', status: 'todo' }] })
  const result = await runCli(['list', '--json', '--url', board.url], tempDir())
  assert.equal(result.code, 0, result.stderr)
  const lines = result.stdout.trim().split('\n')
  assert.equal(lines.length, 1)
  assert.equal(JSON.parse(lines[0]).tasks.length, 1)
  await board.close()
})

test('get, mine and reap are exposed by the CLI', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', title: 'first', tags: [{ name: 'external' }] }] })
  const stateDir = tempDir()
  const env = ['--url', board.url, '--agent', 'test:agent']
  assert.equal((await runCli(['next', ...env], stateDir)).code, 0)
  const get = await runCli(['get', 't1', '--json', ...env], stateDir)
  assert.equal(get.code, 0, get.stderr)
  assert.equal(JSON.parse(get.stdout).task.id, 't1')
  const mine = await runCli(['mine', '--json', ...env], stateDir)
  assert.equal(mine.code, 0, mine.stderr)
  assert.equal(JSON.parse(mine.stdout).claims.length, 1)
  const reap = await runCli(['reap', '--dry-run', '--json', ...env], stateDir)
  assert.equal(reap.code, 0, reap.stderr)
  assert.equal(JSON.parse(reap.stdout).dryRun, true)
  await board.close()
})

test('reap without an identity is a usage error', async () => {
  const board = await startFakeBoard({})
  const result = await runCli(['reap', '--url', board.url], tempDir())
  assert.equal(result.code, 5)
  await board.close()
})

test('tag marks a card for review and releases it in one call', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }] }] })
  const stateDir = tempDir()
  const env = ['--url', board.url, '--agent', 'test:agent']
  assert.equal((await runCli(['next', ...env], stateDir)).code, 0)
  const tagged = await runCli(['tag', 't1', '--add', 'review', '--remove', 'external', '--release', '--json', ...env], stateDir)
  assert.equal(tagged.code, 0, tagged.stderr)
  const payload = JSON.parse(tagged.stdout)
  assert.equal(payload.released, true)
  assert.deepEqual(payload.tags, [{ name: 'review' }])
  assert.equal(board.snapshot().tasks[0].status, 'todo')
  await board.close()
})

test('review --pass settles a handed-over card in one call', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'external' }] }] })
  const stateDir = tempDir()
  const env = ['--url', board.url, '--agent', 'test:agent']
  // The reviewer is a second identity: the worker that handed the card over is
  // recorded, and §5.3 refuses to let it pass its own work.
  const reviewer = ['--url', board.url, '--agent', 'test:reviewer']
  assert.equal((await runCli(['next', ...env], stateDir)).code, 0)
  assert.equal((await runCli(['tag', 't1', '--add', 'review', '--remove', 'external', '--release', ...env], stateDir)).code, 0)
  const selfReview = await runCli(['review', 't1', '--pass', ...env], stateDir)
  assert.equal(selfReview.code, 3, 'the worker cannot pass its own card')
  assert.match(selfReview.stderr, /handed over by test:agent/u)
  const reviewed = await runCli(['review', 't1', '--pass', '--json', ...reviewer], stateDir)
  assert.equal(reviewed.code, 0, reviewed.stderr)
  const payload = JSON.parse(reviewed.stdout)
  assert.equal(payload.verdict, 'pass')
  assert.equal(payload.task.status, 'done')
  assert.equal(board.snapshot().tasks[0].status, 'done')
  await board.close()
})

test('review needs exactly one verdict flag', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', tags: [{ name: 'review' }] }] })
  const result = await runCli(['review', 't1', '--url', board.url, '--agent', 'test:agent'], tempDir())
  assert.equal(result.code, 5)
  assert.match(result.stderr, /--pass or --rework/u)
  await board.close()
})

test('create publishes a card that next can then claim', async () => {
  const board = await startFakeBoard({})
  const stateDir = tempDir()
  const env = ['--url', board.url, '--agent', 'test:agent']
  const created = await runCli(
    ['create', '--title', 'T', '--description', 'D', '--prompt', 'do it', '--add', 'external', '--json', ...env],
    stateDir,
  )
  assert.equal(created.code, 0, created.stderr)
  const payload = JSON.parse(created.stdout)
  assert.equal(payload.task.status, 'todo')
  assert.deepEqual(payload.task.tags, [{ name: 'external' }])
  const claimed = await runCli(['next', '--json', ...env], stateDir)
  assert.equal(claimed.code, 0, claimed.stderr)
  assert.equal(JSON.parse(claimed.stdout).task.id, payload.id)
  await board.close()
})

test('create reads the prompt from a file and refuses both sources at once', async () => {
  const board = await startFakeBoard({})
  const stateDir = tempDir()
  const dir = tempDir()
  const file = path.join(dir, 'prompt.md')
  fs.writeFileSync(file, '# heading\nself-contained body\n', 'utf8')
  const env = ['--url', board.url, '--agent', 'test:agent']
  const fromFile = await runCli(['create', '--title', 'T', '--prompt-file', file, '--json', ...env], stateDir)
  assert.equal(fromFile.code, 0, fromFile.stderr)
  assert.match(JSON.parse(fromFile.stdout).task.prompt, /self-contained body/u)
  const both = await runCli(['create', '--title', 'T', '--prompt', 'x', '--prompt-file', file, ...env], stateDir)
  assert.equal(both.code, 5)
  const missingFile = await runCli(['create', '--title', 'T', '--prompt-file', path.join(dir, 'nope.md'), ...env], stateDir)
  assert.equal(missingFile.code, 5)
  await board.close()
})

test('create requires a title and a prompt (usage, exit 5)', async () => {
  const board = await startFakeBoard({})
  const env = ['--url', board.url, '--agent', 'test:agent']
  assert.equal((await runCli(['create', '--prompt', 'P', ...env], tempDir())).code, 5)
  assert.equal((await runCli(['create', '--title', 'T', ...env], tempDir())).code, 5)
  assert.equal(board.snapshot().tasks.length, 0)
  await board.close()
})

test('create --parent publishes a subtask', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 'parent', status: 'todo' }] })
  const result = await runCli(
    ['create', '--title', 'child', '--prompt', 'P', '--parent', 'parent', '--json', '--url', board.url, '--agent', 'test:agent'],
    tempDir(),
  )
  assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).parentId, 'parent')
  await board.close()
})

test('create --parent prints the labels it inherited in text mode', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 'parent', status: 'todo', tags: [{ name: 'external' }] }] })
  const result = await runCli(
    ['create', '--title', 'child', '--prompt', 'P', '--parent', 'parent', '--add', 'batch', '--url', board.url, '--agent', 'test:agent'],
    tempDir(),
  )
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /tags: external, batch/u)
  assert.match(result.stdout, /inherited: external/u)
  await board.close()
})

test('update rewrites the card text and prints its timestamps', async () => {
  const board = await startFakeBoard({ tasks: [{ id: 't1', status: 'todo', prompt: 'old' }] })
  const stateDir = tempDir()
  const env = ['--url', board.url, '--agent', 'test:agent']
  const updated = await runCli(['update', 't1', '--prompt', 'new', ...env], stateDir)
  assert.equal(updated.code, 0, updated.stderr)
  assert.match(updated.stdout, /updated t1: prompt/u)
  assert.match(updated.stdout, /times: created .+ · updated /u)
  assert.equal(board.snapshot().tasks[0].prompt, 'new')
  const again = await runCli(['update', 't1', '--prompt', 'new', ...env], stateDir)
  assert.equal(again.code, 0, again.stderr)
  assert.match(again.stdout, /unchanged t1/u)
  await board.close()
})

test('an unknown option is a usage error, not a crash', async () => {
  const result = await runCli(['doctor', '--nope'], tempDir())
  assert.equal(result.code, 5)
})
