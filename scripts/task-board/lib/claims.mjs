/**
 * Claim files record who holds a card, until when, and which requestIds a retry
 * must reuse: `<stateDir>/boards/<ledgerId>/claims/<taskId>.json` (0700 dirs,
 * 0600 files, tmp+rename so a crash never exposes a half-written lease).
 *
 * A claim carries no board authority — the board ledger owns every transition
 * and `move` is the CAS — so a lost claim is always recoverable by `reap`.
 * Windows cannot express POSIX mode bits; the atomic rename bound still holds.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const CLAIM_SCHEMA_VERSION = 1
const DIR_MODE = 0o700
const FILE_MODE = 0o600
const MAX_ID_LENGTH = 200

/** Reject ids that would escape the claims directory or break a filename. */
function assertSafeId(value, label) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_ID_LENGTH) {
    throw new TypeError(`${label} must be a non-empty string (<=${MAX_ID_LENGTH} chars)`)
  }
  if (value !== value.trim() || value === '.' || value === '..' || /[\\/\0]/.test(value)) {
    throw new TypeError(`unsafe ${label} for a claim file: ${JSON.stringify(value)}`)
  }
  return value
}

function assertSafeTaskId(taskId) {
  return assertSafeId(taskId, 'claim.taskId')
}

export function boardDir(stateDir, ledgerId) {
  return path.join(stateDir, 'boards', assertSafeId(ledgerId, 'ledgerId'))
}

export function claimsDir(stateDir, ledgerId) {
  return path.join(boardDir(stateDir, ledgerId), 'claims')
}

function claimPath(stateDir, ledgerId, taskId) {
  return path.join(claimsDir(stateDir, ledgerId), `${assertSafeTaskId(taskId)}.json`)
}

function validateClaim(claim, ledgerId) {
  if (claim === null || typeof claim !== 'object' || Array.isArray(claim)) {
    throw new TypeError('claim must be an object')
  }
  assertSafeTaskId(claim.taskId)
  if (typeof claim.agentId !== 'string' || claim.agentId.trim() === '') {
    throw new TypeError('claim.agentId must be a non-empty string')
  }
  if (claim.boardLedgerId !== undefined && claim.boardLedgerId !== ledgerId) {
    // Never write a claim that belongs to another board: the board is the ledger.
    throw new Error(`claim for ${claim.taskId} belongs to board ${claim.boardLedgerId}, not ${ledgerId}`)
  }
  return { ...claim, schemaVersion: CLAIM_SCHEMA_VERSION, boardLedgerId: ledgerId }
}

function writeFileAtomic(target, data) {
  const tmp = `${target}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  try {
    fs.writeFileSync(tmp, data, { mode: FILE_MODE, flag: 'wx' })
    fs.renameSync(tmp, target)
  } finally {
    // Rename already moved it on success; this only removes a crashed attempt.
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* nothing left behind */
    }
  }
  try {
    fs.chmodSync(target, FILE_MODE)
  } catch {
    /* Windows: no POSIX bits to set */
  }
}

/**
 * Write (or replace) a claim atomically. Returns the normalized claim that was
 * persisted, so callers can print its `leaseUntil` without re-reading.
 */
export function writeClaim(stateDir, ledgerId, claim) {
  const normalized = validateClaim(claim, ledgerId)
  fs.mkdirSync(claimsDir(stateDir, ledgerId), { recursive: true, mode: DIR_MODE })
  writeFileAtomic(claimPath(stateDir, ledgerId, normalized.taskId), `${JSON.stringify(normalized, null, 2)}\n`)
  return normalized
}

/** Read one claim; `null` when absent, corrupt, or owned by another board. */
export function readClaim(stateDir, ledgerId, taskId) {
  let raw
  try {
    raw = fs.readFileSync(claimPath(stateDir, ledgerId, taskId), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  return parseClaim(raw, taskId, ledgerId)
}

function parseClaim(raw, expectedTaskId, ledgerId) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (parsed.taskId !== expectedTaskId) return null
  if (typeof parsed.agentId !== 'string' || parsed.agentId.trim() === '') return null
  if (parsed.boardLedgerId !== ledgerId) return null
  return parsed
}

/** Delete a claim; returns whether this call removed it (idempotent). */
export function deleteClaim(stateDir, ledgerId, taskId) {
  try {
    fs.unlinkSync(claimPath(stateDir, ledgerId, taskId))
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

/**
 * All readable claims for a board, sorted by `claimedAt` (then `taskId`) so
 * `mine`/`reap` are stable. Malformed, empty, misplaced and foreign-board files
 * are removed (best effort) instead of being returned: a corrupt claim means
 * "no lease here", which reap then treats as an orphaned running card.
 */
export function listClaims(stateDir, ledgerId) {
  const dir = claimsDir(stateDir, ledgerId)
  let names
  try {
    names = fs.readdirSync(dir)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const claims = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const file = path.join(dir, name)
    const taskId = name.slice(0, -'.json'.length)
    let claim = null
    try {
      claim = parseClaim(fs.readFileSync(file, 'utf8'), taskId, ledgerId)
    } catch {
      // Unreadable (e.g. a directory wearing a .json name) counts as corrupt.
    }
    if (claim === null) {
      try {
        fs.unlinkSync(file)
      } catch {
        /* raced with another process or not a file; the next pass retries */
      }
      continue
    }
    claims.push(claim)
  }
  claims.sort((a, b) => (a.claimedAt ?? 0) - (b.claimedAt ?? 0) || String(a.taskId).localeCompare(String(b.taskId)))
  return claims
}

/**
 * Merge `patch` into an existing claim and persist it atomically.
 * Returns the merged claim, or `null` when there was nothing to update.
 */
export function updateClaim(stateDir, ledgerId, taskId, patch) {
  assertSafeTaskId(taskId)
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new TypeError('claim patch must be an object')
  }
  if (patch.taskId !== undefined && patch.taskId !== taskId) {
    throw new TypeError('a claim patch cannot change taskId')
  }
  const current = readClaim(stateDir, ledgerId, taskId)
  if (current === null) return null
  return writeClaim(stateDir, ledgerId, { ...current, ...patch, taskId })
}
