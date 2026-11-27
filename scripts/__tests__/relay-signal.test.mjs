import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DONE_MARKER,
  assertInWatchDir,
  assertPathIn,
  scanSignals,
  signalBody,
  signalInstruction,
  watchDirsOf,
  writeSignal,
} from '../lib/relay-signal.mjs'

/**
 * 回归样本取自 2026-11-27 C5-pre 事故：派单走 `task --no-wait`，回执落在 `C:\tmp\up-c5pre\doubao\`，
 * 信号件一个都没有，豆包联络人整轮结束后再也没有被叫醒，relay.log 之后 0 条投递。
 *
 * 改版后守四件事：
 * ① `--signal` 必须在 watch 目录内（不在 → relay 永远看不到）；
 * ② 信号件首行必须 @ 联络人——这两条 watch 的 targetIdentity 是群地址，relay 按 NO_MENTION 拒收；
 * ③ 信号件必须一次写全（含 DONE）——relay 静默到点即投，预写占位件等于叫醒联络人看空件；
 * ④ 扫描能明确分出「待完成 / 已就绪」，并跳过被拒件。
 */
const fixedNow = new Date('2026-11-27T03:00:00.000Z')

describe('assertPathIn', () => {
  const watch = ['C:\\dsh-relay\\signals\\doubao']

  it('接受 watch 目录里的文件', () => {
    expect(assertPathIn(watch, 'C:\\dsh-relay\\signals\\doubao\\c5-pre.done'))
      .toBe('C:\\dsh-relay\\signals\\doubao\\c5-pre.done')
  })

  it('大小写与结尾斜杠不影响判定', () => {
    expect(() => assertPathIn(['c:\\DSH-RELAY\\signals\\doubao\\'], 'C:\\dsh-relay\\signals\\doubao\\x.done')).not.toThrow()
  })

  it('拒绝事故里那个无人 watch 的目录', () => {
    expect(() => assertPathIn(watch, 'C:\\tmp\\up-c5pre\\doubao\\receipt-to-owner.md')).toThrow(/watch 目录/)
  })

  it('拒绝只是前缀相近的兄弟目录', () => {
    expect(() => assertPathIn(watch, 'C:\\dsh-relay\\signals\\doubao-old\\x.done')).toThrow(/watch 目录/)
  })
})

describe('assertInWatchDir', () => {
  it('豆包/WorkBuddy 各认自己的 watch 目录', () => {
    expect(assertInWatchDir('doubao', 'C:\\dsh-relay\\signals\\doubao\\a.done')).toContain('doubao')
    expect(assertInWatchDir('workbuddy', 'C:\\dsh-relay\\wakeup\\workbuddy\\a.done')).toContain('workbuddy')
    expect(() => assertInWatchDir('doubao', 'C:\\dsh-relay\\signals\\workbuddy\\a.done')).toThrow(/watch 目录/)
  })

  it('未知通道直接报错，不静默放行', () => {
    expect(() => watchDirsOf('nobody')).toThrow(/未知外派通道/)
  })
})

describe('signalBody', () => {
  it('首行是 @联络人（relay 的群通道闸），末行是 DONE（提前触发投递）', () => {
    const text = signalBody({ channel: 'doubao', title: 'C5-pre', receiptPath: 'C:\\tmp\\r.md', replyTail: '做完了', now: fixedNow })
    const lines = text.split('\n')
    expect(lines[0]).toBe('@豆包联络人 派单完成，请取件。')
    expect(text.trimEnd().endsWith(DONE_MARKER)).toBe(true)
    expect(text).toContain('C:\\tmp\\r.md')
    expect(text).toContain('做完了')
    expect(text).toContain(fixedNow.toISOString())
  })

  it('没有 @ 联络人就不是合法信号件（NO_MENTION 会被 relay 拒收）', () => {
    const text = signalBody({ channel: 'workbuddy', title: 'x', now: fixedNow })
    expect(text.split('\n')[0].startsWith('@workbuddy联络人 ')).toBe(true)
  })

  it('低置信时把判定依据写进件里，不冒充「真交件」', () => {
    const text = signalBody({ channel: 'doubao', title: 'x', evidence: '界面静默 180s 且未见回执文件（低置信）', now: fixedNow })
    expect(text).toContain('判定依据')
    expect(text).toContain('低置信')
  })

  it('收尾摘要压到 300 字以内，摘要里的换行被压平', () => {
    const text = signalBody({ channel: 'doubao', title: 'x', replyTail: 'A\n\nB' + '长'.repeat(400), now: fixedNow })
    const summary = text.split('\n').find(line => line.startsWith('- 收尾摘要：'))
    expect(summary.length).toBeLessThan(320)
    expect(summary).not.toContain('\n')
  })
})

describe('signalInstruction', () => {
  it('收尾要求里给出路径、@ 原文与 DONE 原文', () => {
    const text = signalInstruction('doubao', 'C:\\dsh-relay\\signals\\doubao\\c5-pre.done')
    expect(text).toContain(DONE_MARKER)
    expect(text).toContain('C:\\dsh-relay\\signals\\doubao\\c5-pre.done')
    expect(text).toContain('@豆包联络人')
    expect(text).toContain('叫醒')
  })
})

describe('writeSignal + scanSignals', () => {
  let root
  let watchDir

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'relay-signal-'))
    watchDir = join(root, 'signals', 'doubao')
    mkdirSync(watchDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('写到目录外会被拒，目录内一次写全（含 DONE 与 @）', () => {
    expect(() => writeSignal({ channel: 'doubao', path: join(root, 'outside.done'), dirs: [watchDir] })).toThrow(/watch 目录/)
    const target = join(watchDir, 'c5-pre.done')
    writeSignal({ channel: 'doubao', path: target, title: 'C5-pre', receiptPath: 'C:\\tmp\\r.md', replyTail: 'ok', dirs: [watchDir], now: fixedNow })
    const text = readFileSync(target, 'utf8')
    expect(text).toBe(signalBody({ channel: 'doubao', title: 'C5-pre', receiptPath: 'C:\\tmp\\r.md', replyTail: 'ok', now: fixedNow }))
    expect(text.trimEnd().endsWith(DONE_MARKER)).toBe(true)
  })

  it('分出待完成与已就绪，忽略点文件与被拒件', () => {
    writeSignal({ channel: 'doubao', path: join(watchDir, 'ready.done'), title: 'ready', dirs: [watchDir], now: fixedNow })
    writeFileSync(join(watchDir, 'pending.done'), '@豆包联络人 半截件\n', 'utf8')
    writeFileSync(join(watchDir, 'old.done.rejected.md'), '@豆包联络人 x\n' + DONE_MARKER + '\n', 'utf8')
    writeFileSync(join(watchDir, '.keep'), 'x', 'utf8')

    const report = scanSignals('doubao', { dirs: [watchDir] })
    expect(report.ready).toBe(1)
    expect(report.pending).toBe(1)
    expect(report.dirs[0].files.map(file => file.name).sort()).toEqual(['pending.done', 'ready.done'])
  })

  it('目录不存在时如实报 missing，不当成空队列', () => {
    const report = scanSignals('doubao', { dirs: [join(root, 'nope')] })
    expect(report.dirs[0].missing).toBe(true)
    expect(report.pending + report.ready).toBe(0)
  })
})
