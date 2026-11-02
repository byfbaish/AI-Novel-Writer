/**
 * Find *which* task board this CLI is talking to, and prove it is the same one
 * across restarts.
 *
 * The DSH Desktop host starts its web server with `--port 0`, so the port is
 * assigned by the OS on every launch and the URL exists only in the main
 * process (plus `DSH_WEB_URL` inside DSH-hosted shells). Resolution therefore
 * walks: explicit flag -> explicit env -> DSH_WEB_URL -> cached URL -> local
 * port discovery. The `scheduler.ledgerId` from `/state` is the identity used
 * to refuse a stale URL that now belongs to a different board.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { httpTransport } from './transport.mjs'
import { BoardError } from './errors.mjs'

export const DEFAULT_STATE_DIR = path.join(os.homedir(), '.dsh-task-board')

/** Resolve the local state directory (0700), honouring DSH_BOARD_STATE_DIR. */
export function stateDirFrom(env = process.env) {
  const override = typeof env.DSH_BOARD_STATE_DIR === 'string' ? env.DSH_BOARD_STATE_DIR.trim() : ''
  return override === '' ? DEFAULT_STATE_DIR : path.resolve(override)
}

export function cacheFile(stateDir) {
  return path.join(stateDir, 'config.json')
}

/** Read the cached `{ url, ledgerId }`, returning undefined when absent/invalid. */
export function readCache(stateDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile(stateDir), 'utf8'))
    if (typeof parsed?.url !== 'string' || typeof parsed?.ledgerId !== 'string') return undefined
    return parsed
  } catch {
    return undefined
  }
}

/** Persist the resolved board identity for the next process (0600, tmp+rename). */
export function writeCache(stateDir, entry) {
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 })
  const target = cacheFile(stateDir)
  const tmp = `${target}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify({ ...entry, savedAt: Date.now() })}\n`, { mode: 0o600 })
  fs.renameSync(tmp, target)
}

/** Loopback listener seen on this machine. */
function loopbackListener(port, pid, name) {
  const numericPort = Number(port)
  if (!Number.isSafeInteger(numericPort) || numericPort <= 0 || numericPort > 65_535) return undefined
  return { port: numericPort, pid: Number.isSafeInteger(pid) ? pid : undefined, name: name ?? '' }
}

function runCommand(command, args, timeout = 5_000) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout, windowsHide: true })
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== 'string') return ''
  return result.stdout
}

function windowsListeners() {
  const listeners = []
  const netstat = runCommand('netstat', ['-ano', '-p', 'tcp'])
  const pidToName = new Map()
  const tasklist = runCommand('tasklist', ['/FO', 'CSV', '/NH'])
  for (const line of tasklist.split(/\r?\n/u)) {
    const match = /^"([^"]+)","(\d+)"/u.exec(line)
    if (match !== null) pidToName.set(Number(match[2]), match[1])
  }
  for (const line of netstat.split(/\r?\n/u)) {
    const fields = line.trim().split(/\s+/u)
    if (fields.length < 5 || fields[0].toUpperCase() !== 'TCP' || fields[3].toUpperCase() !== 'LISTENING') continue
    const local = fields[1]
    const port = local.slice(local.lastIndexOf(':') + 1)
    const host = local.slice(0, local.lastIndexOf(':'))
    if (host !== '127.0.0.1' && host !== '[::1]') continue
    const listener = loopbackListener(port, Number(fields[4]), pidToName.get(Number(fields[4])))
    if (listener !== undefined && !listeners.some((existing) => existing.port === listener.port)) listeners.push(listener)
  }
  return listeners
}

function posixListeners() {
  const listeners = []
  const parsed = new Map()
  const lsof = runCommand('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'])
  for (const line of lsof.split(/\r?\n/u)) {
    const match = /^(\S+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+TCP\s+(\S+)\s+\(LISTEN\)/u.exec(line)
    if (match === null) continue
    const local = match[3]
    const host = local.slice(0, local.lastIndexOf(':'))
    const port = local.slice(local.lastIndexOf(':') + 1)
    if (host !== '127.0.0.1' && host !== '[::1]') continue
    parsed.set(Number(port), { pid: Number(match[2]), name: match[1] })
  }
  const ss = runCommand('ss', ['-ltnp'])
  for (const line of ss.split(/\r?\n/u)) {
    const match = /\s(\S+):(\d+)\s+\S+\s+users:\(\("([^"]+)",pid=(\d+)/u.exec(line)
    if (match === null) continue
    const host = match[1]
    const port = Number(match[2])
    if (host !== '127.0.0.1' && host !== '[::1]') continue
    if (!parsed.has(port)) parsed.set(port, { pid: Number(match[4]), name: match[3] })
  }
  for (const [port, meta] of parsed) {
    const listener = loopbackListener(port, meta.pid, meta.name)
    if (listener !== undefined) listeners.push(listener)
  }
  return listeners
}

/**
 * Enumerate loopback TCP listeners owned by local processes. Returns [] when
 * the platform tools are unavailable: discovery then simply finds nothing.
 */
export function listLoopbackListeners(platform = process.platform) {
  try {
    return platform === 'win32' ? windowsListeners() : posixListeners()
  } catch {
    return []
  }
}

function dshLike(listener) {
  return /deepseek|dsh/iu.test(listener.name)
}

/**
 * Order candidate ports: DSH-process listeners first, then the rest; a bounded
 * list keeps discovery quick when many local services are listening.
 */
export function candidateUrls(listeners, limit = 80) {
  const ordered = [...listeners].sort((left, right) => Number(dshLike(right)) - Number(dshLike(left)) || left.port - right.port)
  const urls = []
  for (const listener of ordered.slice(0, limit)) {
    const url = `http://127.0.0.1:${listener.port}`
    if (!urls.includes(url)) urls.push(url)
  }
  return urls
}

function ledgerIdOf(snapshot) {
  const ledgerId = snapshot?.scheduler?.ledgerId
  if (typeof ledgerId !== 'string' || ledgerId === '') {
    throw new BoardError('invalid-response', 'the task board did not report scheduler.ledgerId; refusing to guess which board this is')
  }
  return ledgerId
}

/**
 * Resolve the board to use.
 *
 * @param {{
 *   explicitUrl?: string,
 *   stateDir?: string,
 *   env?: Record<string, string | undefined>,
 *   transportFor?: (url: string, options?: { timeoutMs?: number }) => any,
 *   listPorts?: () => { port: number, pid?: number, name?: string }[],
 *   probeTimeoutMs?: number,
 * }} [options]
 * @returns {Promise<{ transport: any, url: string, ledgerId: string, snapshot: object }>}
 */
export async function resolveBoard(options = {}) {
  const env = options.env ?? process.env
  const stateDir = options.stateDir ?? stateDirFrom(env)
  const transportFor = options.transportFor ?? ((url, transportOptions) => httpTransport(url, transportOptions))
  const listPorts = options.listPorts ?? (() => listLoopbackListeners())
  const probeTimeoutMs = options.probeTimeoutMs ?? 800

  const finish = async (transport, snapshot) => {
    const ledgerId = ledgerIdOf(snapshot)
    try {
      writeCache(stateDir, { url: transport.url, ledgerId, schemaVersion: snapshot.schemaVersion })
    } catch {
      // A read-only state dir must not stop a read-only command: the cache is an
      // optimization, not a requirement, and discovery can run again next time.
    }
    return { transport, url: transport.url, ledgerId, snapshot }
  }

  const explicit = typeof options.explicitUrl === 'string' && options.explicitUrl.trim() !== '' ? options.explicitUrl.trim() : ''
  if (explicit !== '') {
    const transport = transportFor(explicit)
    const snapshot = await transport.getState()
    return finish(transport, snapshot)
  }

  const envCandidates = [env.DSH_BOARD_URL, env.DSH_WEB_URL]
    .filter((value) => typeof value === 'string' && value.trim() !== '')
    .map((value) => value.trim())
  for (const url of envCandidates) {
    try {
      const transport = transportFor(url)
      const snapshot = await transport.getState()
      return await finish(transport, snapshot)
    } catch (error) {
      if (!(error instanceof BoardError)) throw error
      // A stale/incorrect env URL falls through to the cache and discovery.
    }
  }

  const cached = readCache(stateDir)
  if (cached !== undefined) {
    try {
      const transport = transportFor(cached.url)
      const snapshot = await transport.getState()
      if (ledgerIdOf(snapshot) === cached.ledgerId) return await finish(transport, snapshot)
    } catch (error) {
      if (!(error instanceof BoardError)) throw error
    }
  }

  const candidates = candidateUrls(listPorts())
  const found = []
  const rejected = []
  for (const url of candidates) {
    try {
      const transport = transportFor(url, { timeoutMs: probeTimeoutMs })
      const snapshot = await transport.getState()
      const version = snapshot?.schemaVersion
      // The board only adds fields between schema generations this client
      // understands, so a newer schema is still usable; an older one is not.
      if (!Number.isInteger(version) || version < 7) {
        rejected.push(`${url} (schema ${String(version)})`)
        continue
      }
      found.push({ transport, snapshot })
    } catch {
      /* not a board, or not reachable; keep probing */
    }
  }
  if (found.length === 1) return finish(found[0].transport, found[0].snapshot)
  if (found.length > 1) {
    const urls = found.map((entry) => entry.transport.url).join(', ')
    throw new BoardError('ambiguous', `found more than one task board (${urls}); pass --url to choose one`)
  }
  if (rejected.length > 0) {
    throw new BoardError(
      'invalid-response',
      `found loopback services but no supported task board (${rejected.join(', ')}); this CLI needs schemaVersion >= 7`,
    )
  }
  throw new BoardError(
    'unreachable',
    'no task board found: start DSH, or pass --url / set DSH_BOARD_URL or DSH_WEB_URL',
  )
}
