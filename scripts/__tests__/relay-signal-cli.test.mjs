/**
 * 派单闸的命令行层测试（隔离审 2026-11-27 第 6 条：14 条 lib 测试测不到「闸到底拦没拦」）。
 *
 * 这些断言全部在连 CDP 之前就该失败：参数不合规就拒发，进程非零退出、stderr 有明确原因。
 * 真跑一次派单要浏览器和真模型调用，不适合进单测；这里只钉住「拒发」这一半。
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { writeSignal } from '../lib/relay-signal.mjs'

const repoRoot = resolve(import.meta.dirname, '..', '..')
const doubao = join(repoRoot, 'scripts', 'doubao', 'doubao.mjs')
const workbuddy = join(repoRoot, 'scripts', 'workbuddy', 'workbuddy-attach.mjs')

const run = (script, argv) => {
  const out = spawnSync(process.execPath, [script, ...argv], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, NO_COLOR: '1' },
  })
  return { code: out.status, text: `${out.stdout ?? ''}${out.stderr ?? ''}` }
}

describe('doubao 派单闸', () => {
  it('--no-wait 没有 --signal 直接拒发', () => {
    const { code, text } = run(doubao, ['task', '闸测试', '--no-wait'])
    expect(code).not.toBe(0)
    expect(text).toContain('必须同时给 --signal')
    expect(text).toContain('dsh-relay')
  })

  it('--signal 落在 watch 目录外直接拒发', () => {
    const outside = join(tmpdir(), 'not-a-watch-dir', 'x.done')
    const { code, text } = run(doubao, ['task', '闸测试', '--no-wait', '--signal', outside])
    expect(code).not.toBe(0)
    expect(text).toContain('必须落在')
  })

  it('--signal 不配 --no-wait 直接拒发', () => {
    const { code, text } = run(doubao, ['task', '闸测试', '--signal', 'C:\\dsh-relay\\signals\\doubao\\x.done'])
    expect(code).not.toBe(0)
    expect(text).toContain('只配合 --no-wait')
  })
})

describe('workbuddy 派单闸（含 say 这条路）', () => {
  it('task --no-wait 没有 --signal 直接拒发', () => {
    const { code, text } = run(workbuddy, ['task', '闸测试', '--no-wait'])
    expect(code).not.toBe(0)
    expect(text).toContain('必须同时给 --signal')
  })

  it('say --no-wait 同样拒发（闸在分发层，不在 task 里）', () => {
    const { code, text } = run(workbuddy, ['say', '闸测试', '--no-wait'])
    expect(code).not.toBe(0)
    expect(text).toContain('必须同时给 --signal')
  })

  it('say --no-wait 给目录外的信号件也拒发', () => {
    const outside = join(tmpdir(), 'not-a-watch-dir', 'x.done')
    const { code, text } = run(workbuddy, ['say', '闸测试', '--no-wait', '--signal', outside])
    expect(code).not.toBe(0)
    expect(text).toContain('必须落在')
  })
})

describe('writeSignal 幂等', () => {
  it('同一路径第二次写直接跳过，不产生第二份内容不同的件', () => {
    const dir = mkdtempSync(join(tmpdir(), 'relay-signal-'))
    const path = join(dir, 'card.done')
    const first = writeSignal({ channel: 'doubao', path, title: 'CARD-1', replyTail: 'ok', dirs: [dir] })
    expect(first).toBe(resolve(path))
    writeFileSync(path, '执行方自己写的旧件', 'utf8')
    const second = writeSignal({ channel: 'doubao', path, title: 'CARD-1', replyTail: 'ok', dirs: [dir] })
    expect(second).toBeNull()
  })
})
