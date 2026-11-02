/**
 * The only writer-facing client of the DSH task board.
 *
 * The board's HTTP surface is `GET /api/task-board/state` and
 * `POST /api/task-board/action`. Both require a browser-shaped marker: we send
 * an `Origin` header that exactly matches the authority we dial (the board's
 * guard compares `new URL(Origin).host` with the `Host` header). This module
 * owns that detail, the timeout, and the mapping from HTTP status to BoardError.
 *
 * Nothing here writes the ledger: the board is the single writer.
 */

import http from 'node:http'
import { BoardError } from './errors.mjs'

const STATE_PATH = '/api/task-board/state'
const ACTION_PATH = '/api/task-board/action'
const INVALID_ENVELOPE_ERRORS = new Set(['invalid-action', 'json-required', 'body-too-large'])

/**
 * Normalize a base URL an operator typed (or an env var carried) into the root
 * the board is mounted under, without a trailing slash.
 * @param {string} input
 * @returns {string}
 */
export function normalizeBaseUrl(input) {
  const url = new URL(String(input).trim())
  if (url.protocol !== 'http:') {
    // DSH serves loopback plain HTTP; accepting https here would advertise a
    // transport this client does not actually implement.
    throw new BoardError('usage', `board URL must be http:// (DSH serves loopback HTTP), got ${url.protocol}`)
  }
  const path = url.pathname.replace(/\/+$/u, '')
  return `${url.origin}${path}`
}

function endpoint(base, suffix) {
  const url = new URL(base)
  const prefix = url.pathname.replace(/\/+$/u, '')
  url.pathname = `${prefix}${suffix}`
  url.search = ''
  url.hash = ''
  return url
}

/**
 * @param {string} baseUrl root of the board, e.g. `http://127.0.0.1:62185`
 * @param {{ timeoutMs?: number }} [options]
 */
export function httpTransport(baseUrl, options = {}) {
  const base = normalizeBaseUrl(baseUrl)
  const timeoutMs = options.timeoutMs ?? 8_000
  const parsed = new URL(base)
  const origin = parsed.origin
  const agent = new http.Agent({ keepAlive: false })

  /**
   * @param {URL} target
   * @param {'GET'|'POST'} method
   * @param {string|undefined} body
   * @returns {Promise<{ status: number, text: string }>}
   */
  function request(target, method, body) {
    return new Promise((resolve, reject) => {
      const headers = { origin, accept: 'application/json' }
      if (body !== undefined) {
        headers['content-type'] = 'application/json'
        headers['content-length'] = Buffer.byteLength(body)
      }
      const req = http.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method,
          headers,
          timeout: timeoutMs,
          agent,
        },
        (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }))
          res.on('error', (cause) => reject(new BoardError('unreachable', `board response stream failed: ${cause.message}`, { cause })))
        },
      )
      req.on('timeout', () => {
        req.destroy(new Error('request timed out'))
      })
      req.on('error', (cause) => {
        reject(new BoardError('unreachable', `cannot reach the task board at ${origin}: ${cause.message}`, { cause }))
      })
      if (body !== undefined) req.write(body)
      req.end()
    })
  }

  function decodeSnapshot(text, status) {
    let value
    try {
      value = JSON.parse(text)
    } catch (cause) {
      throw new BoardError('invalid-response', `board returned non-JSON (HTTP ${status})`, { status, cause })
    }
    if (typeof value !== 'object' || value === null || !Array.isArray(value.tasks)) {
      throw new BoardError('invalid-response', 'board response is not a task-board snapshot', { status })
    }
    return value
  }

  function failure(status, text) {
    if (status === 401 || status === 403) {
      return new BoardError(
        'forbidden',
        'the task board refused this request (check that Origin == Host and that the board plugin is enabled; a DSH upgrade may have tightened the fence)',
        { status },
      )
    }
    if (status === 404) {
      return new BoardError('not-mounted', 'no task board is mounted at this URL (plugin disabled or wrong port)', { status })
    }
    let reason = ''
    try {
      const body = JSON.parse(text)
      if (typeof body?.error === 'string') reason = body.error
    } catch {
      /* keep the generic reason */
    }
    if (status === 400) {
      return INVALID_ENVELOPE_ERRORS.has(reason)
        ? new BoardError('invalid-response', `board rejected the request envelope (${reason})`, { status })
        : new BoardError('conflict', `board refused the action: ${reason || 'rejected'}`, { status })
    }
    return new BoardError('invalid-response', `board answered HTTP ${status}${reason === '' ? '' : `: ${reason}`}`, { status })
  }

  return {
    url: base,
    origin,

    /** Read the full revisioned snapshot. */
    async getState() {
      const { status, text } = await request(endpoint(base, STATE_PATH), 'GET', undefined)
      if (status !== 200) throw failure(status, text)
      return decodeSnapshot(text, status)
    },

    /**
     * Apply one board action. The envelope is the board's own wire shape:
     * `{ requestId, action, initiator? }`; the reply is the new snapshot.
     * @param {{ requestId: string, action: object, initiator?: string }} envelope
     */
    async apply({ requestId, action, initiator }) {
      if (typeof requestId !== 'string' || requestId === '') {
        throw new BoardError('usage', 'requestId is required')
      }
      const body = JSON.stringify({
        requestId,
        action,
        ...(typeof initiator === 'string' && initiator !== '' ? { initiator } : {}),
      })
      const { status, text } = await request(endpoint(base, ACTION_PATH), 'POST', body)
      if (status !== 200) throw failure(status, text)
      return decodeSnapshot(text, status)
    },
  }
}
