/**
 * Error model shared by the transport, identity and ops layers.
 *
 * Every failure the CLI can explain to an agent carries one of these codes so
 * the exit status and the message stay consistent across CLI and MCP shells.
 */

export const EXIT = Object.freeze({
  OK: 0,
  FAIL: 1,
  NO_CANDIDATE: 2,
  CONFLICT: 3,
  UNAVAILABLE: 4,
  USAGE: 5,
})

/** Codes that mean "the board cannot be used from here", i.e. exit 4. */
const UNAVAILABLE_CODES = new Set([
  'unreachable',
  'forbidden',
  'not-mounted',
  'invalid-response',
  'board-mismatch',
  'ambiguous',
])

export class BoardError extends Error {
  /**
   * @param {string} code stable failure class (see UNAVAILABLE_CODES and EXIT)
   * @param {string} message operator-facing explanation
   * @param {{ status?: number, cause?: unknown }} [options]
   */
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'BoardError'
    this.code = code
    this.status = options.status
  }
}

/** Map a thrown value to the process exit code the CLI must return. */
export function exitCodeFor(error) {
  if (!(error instanceof BoardError)) return EXIT.FAIL
  if (error.code === 'conflict') return EXIT.CONFLICT
  if (error.code === 'no-candidate') return EXIT.NO_CANDIDATE
  if (error.code === 'usage') return EXIT.USAGE
  if (UNAVAILABLE_CODES.has(error.code)) return EXIT.UNAVAILABLE
  return EXIT.FAIL
}

/** Human-readable one-liner for any thrown value. */
export function describeError(error) {
  if (error instanceof BoardError) return `${error.code}: ${error.message}`
  if (error instanceof Error) return error.message
  return String(error)
}
