import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 被错误白名单压掉的「未知错误」留一份完整记录。
 *
 * 为什么需要它：`generation` 的 IPC 网关把白名单之外的错误统一压成
 * `GENERATION_REQUEST_FAILED:<类名>`，**只带类名、不带 message**（安全：message 可能含正文）。
 * 代价是 `fs` 的 `ENOENT`、better-sqlite3 的嵌套事务错误这类普通 `Error`
 * 全部退化成同一个 `:Error`，真因永久消失 —— 2026-10-24 的 `commit-draft` 失败
 * 就是这样查了两轮查不动。
 *
 * 落盘约定与 `debug/prompt-trace` 一致：写在**用户自己的项目目录**，不写全局目录；
 * 只在未知错误（罕见）时调用；任何写入失败都会被吞掉，绝不影响原错误。
 */

/** 超过这个大小就滚动，只保留最后若干条。 */
const MAX_BYTES = 256 * 1024
const KEEP_LINES = 20
const MAX_MESSAGE = 2_000

export interface UnclassifiedGenerationError {
  at: string
  channel: string
  name: string
  message: string
  stack?: string
}

function rotate(file: string): void {
  try {
    if (!existsSync(file) || statSync(file).size <= MAX_BYTES) return
    const kept = readFileSync(file, 'utf8').trimEnd().split('\n').slice(-KEEP_LINES)
    writeFileSync(file, `${kept.join('\n')}\n`, 'utf8')
  } catch {
    // 滚动失败就让文件继续长，不能因此丢错误记录。
  }
}

export function recordUnclassifiedGenerationError(
  projectPath: string,
  channel: string,
  error: unknown,
): void {
  try {
    if (!projectPath) return
    const dir = join(projectPath, 'debug')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const file = join(dir, 'generation-error.log')
    const message = error instanceof Error ? error.message : String(error)
    const entry: UnclassifiedGenerationError = {
      at: new Date().toISOString(),
      channel,
      name: error instanceof Error ? error.name : typeof error,
      message: message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE)}…[truncated]` : message,
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 8).join('\n') : undefined,
    }
    appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8')
    rotate(file)
  } catch {
    // 诊断写入失败不是业务错误，静默。
  }
}
