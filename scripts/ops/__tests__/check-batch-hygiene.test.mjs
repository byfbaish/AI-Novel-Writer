import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { describe, expect, it } from 'vitest'

import {
  DISK_NOTICE,
  RULE_TRAILING,
  RULE_VERSIONED,
  applyBaseline,
  changeSetFromPorcelain,
  checkTrailingNewline,
  checkVersionedName,
  collectViolations,
  inScope,
  parseBaseline,
  renderBaseline,
  renderReport,
} from '../check-batch-hygiene.mjs'

const SCRIPT = new URL('../check-batch-hygiene.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1')

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} 失败：${(result.stderr || '').trim()}`)
  }
  return result.stdout
}

function checker(cwd, args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', windowsHide: true })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** 临时 git 仓库：只含 .batch/night/reports 一个目录。 */
function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hygiene-scope-'))
  run('git', ['init', '-q'], dir)
  run('git', ['config', 'user.email', 'probe@example.invalid'], dir)
  run('git', ['config', 'user.name', 'probe'], dir)
  run('git', ['config', 'core.autocrlf', 'false'], dir)
  fs.mkdirSync(path.join(dir, '.batch', 'night', 'reports'), { recursive: true })
  return dir
}

function writeFile(dir, rel, content) {
  const abs = path.join(dir, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf8')
}

function commitAll(dir, message = 'CARD-1 init') {
  run('git', ['add', '-A'], dir)
  run('git', ['commit', '-q', '-m', message], dir)
}

function writeBaselineFor(dir, paths, rel = 'scripts/ops/hygiene-baseline.txt') {
  const text = renderBaseline(paths, { sha: 'deadbeef' })
  writeFile(dir, rel, text)
  return { rel, text }
}

describe('尾行换行规则', () => {
  it('末行有换行且不是连续空行 ⇒ 合规', () => {
    expect(checkTrailingNewline('# 标题\n正文\n')).toBeNull()
  })

  it('末行缺换行 ⇒ 不合规', () => {
    expect(checkTrailingNewline('# 标题\n正文')).toMatch('末行缺换行')
  })

  it('以连续空行结尾 ⇒ 不合规', () => {
    expect(checkTrailingNewline('# 标题\n\n')).toMatch('连续空行')
  })

  it('空文件 ⇒ 不合规', () => {
    expect(checkTrailingNewline('')).toMatch('内容为空')
  })

  it('CRLF 结尾按换行算，不误判', () => {
    expect(checkTrailingNewline('# 标题\r\n正文\r\n')).toBeNull()
  })
})

describe('禁版本号文件名规则', () => {
  it('cards 下 .v3.md ⇒ 不合规', () => {
    expect(checkVersionedName('.batch/night/cards/CARD-1117-A.v3.md')).toMatch('版本号')
  })

  it('reports 下 -v7 结尾 ⇒ 不合规', () => {
    expect(checkVersionedName('.batch/night/reports/report-v7.md')).toMatch('版本号')
  })

  it('archive 下豁免', () => {
    expect(checkVersionedName('.batch/night/archive/staging/no-at-count.v2.mjs')).toBeNull()
  })

  it('staging 下豁免', () => {
    expect(checkVersionedName('.batch/night/staging/pointer-plan.v4.md')).toBeNull()
  })

  it('普通文件名不误判', () => {
    expect(checkVersionedName('.batch/night/reports/CARD-1117-A-report.md')).toBeNull()
  })
})

describe('范围与汇总', () => {
  it('只检查 .batch/night/**', () => {
    expect(inScope('.batch/night/reports/x.md')).toBe(true)
    expect(inScope('.batch/night')).toBe(true)
    expect(inScope('docs/notes.md')).toBe(false)
    expect(inScope('.batch/other/x.md')).toBe(false)
  })

  it('collectViolations 跳过范围外文件，并按规则分类', () => {
    const violations = collectViolations([
      { path: 'docs/a.v3.md', content: 'no newline' },
      { path: '.batch/night/reports/b.v3.md', content: '# 标题\n' },
      { path: '.batch/night/reports/c.md', content: '# 标题' },
    ])
    expect(violations.map((v) => `${v.rule}:${v.path}`)).toEqual([
      `${RULE_VERSIONED}:.batch/night/reports/b.v3.md`,
      `${RULE_TRAILING}:.batch/night/reports/c.md`,
    ])
  })

  it('汇总行只报条目数，不出现字节／md5／行数', () => {
    const report = renderReport([
      { path: '.batch/night/reports/c.md', rule: RULE_TRAILING, reason: '末行缺换行' },
    ])
    expect(report).toContain('.batch/night/reports/c.md · trailing-newline · 末行缺换行')
    expect(report.split('\n').pop()).toBe('1 项不合规')
    expect(report).not.toMatch(/字节|md5|MD5|行数/u)
  })
})

describe('变更集解析', () => {
  it('收未跟踪件（??），改名同时收新旧两路径', () => {
    const changed = changeSetFromPorcelain(
      ['?? .batch/night/reports/new.md\0', 'R  .batch/night/a.md\0.batch/night/b.v2.md\0', ' M .batch/night/c.md\0'].join(''),
    )
    expect([...changed].sort()).toEqual([
      '.batch/night/a.md',
      '.batch/night/b.v2.md',
      '.batch/night/c.md',
      '.batch/night/reports/new.md',
    ])
  })
})

describe('baseline 文本形态', () => {
  it('头三行 + 排序去重 + 末尾换行', () => {
    const text = renderBaseline(['.batch/night/b.md', '.batch/night/a.md', '.batch/night/b.md'], { sha: '1234abcd' })
    const lines = text.split('\n')
    expect(lines[0]).toBe('# 条目数：2')
    expect(lines[1]).toBe('# 生成 SHA：1234abcd')
    expect(lines[2]).toBe('# 生成命令：node scripts/ops/check-batch-hygiene.mjs --disk --write-baseline')
    expect(lines.slice(3, 5)).toEqual(['.batch/night/a.md', '.batch/night/b.md'])
    expect(text.endsWith('\n')).toBe(true)
  })

  it('头三行缺失 ⇒ 报错（不静默降级为无豁免）', () => {
    const parsed = parseBaseline('.batch/night/a.md\n')
    expect(parsed.error).toMatch('头三行缺')
  })

  it('条目数与实际不符 ⇒ 报错', () => {
    const parsed = parseBaseline(
      ['# 条目数：3', '# 生成 SHA：deadbeef', '# 生成命令：x', '.batch/night/a.md'].join('\n') + '\n',
    )
    expect(parsed.error).toMatch('条目数与实际不符')
  })

  it('条目数正确且注释/空行被忽略 ⇒ 解析成功', () => {
    const parsed = parseBaseline(
      ['# 条目数：1', '# 生成 SHA：deadbeef', '# 生成命令：x', '', '# 注释', '.batch/night/a.md', ''].join('\n'),
    )
    expect(parsed.error).toBeUndefined()
    expect([...parsed.entries]).toEqual(['.batch/night/a.md'])
  })
})

describe('baseline 豁免语义', () => {
  const violation = { path: '.batch/night/reports/hist.v2.md', rule: RULE_VERSIONED, reason: '版本号' }

  it('清单内且本次未改动 ⇒ 跳过', () => {
    const { kept, skipped } = applyBaseline([violation], new Set([violation.path]), new Set())
    expect(kept).toEqual([])
    expect(skipped).toEqual([violation])
  })

  it('清单内但本次改动 ⇒ 照常报红', () => {
    const { kept, skipped } = applyBaseline([violation], new Set([violation.path]), new Set([violation.path]))
    expect(kept).toEqual([violation])
    expect(skipped).toEqual([])
  })

  it('无 baseline 或清单未命中 ⇒ 照常报红', () => {
    expect(applyBaseline([violation], null, new Set()).kept).toEqual([violation])
    expect(applyBaseline([violation], new Set(['.batch/night/other.md']), new Set()).kept).toEqual([violation])
  })
})

describe('扫描面：--all 只看已跟踪，--disk 看磁盘全量', () => {
  it('已跟踪的不合规件 ⇒ --all 报红；未跟踪的不合规件 ⇒ --all 不见、--disk 可见', () => {
    const dir = tmpRepo()
    writeFile(dir, '.batch/night/reports/tracked.v2.md', '# 标题\n')
    commitAll(dir)
    writeFile(dir, '.batch/night/reports/untracked.v9.md', '# 标题\n')

    const all = checker(dir, ['--all'])
    expect(all.status).toBe(1)
    expect(all.stdout).toContain('.batch/night/reports/tracked.v2.md')
    expect(all.stdout).not.toContain('untracked.v9.md')

    const disk = checker(dir, ['--disk'])
    expect(disk.status).toBe(1)
    expect(disk.stdout.split('\n')[0]).toBe(DISK_NOTICE)
    expect(disk.stdout).toContain('untracked.v9.md')
  })

  it('只有未跟踪的不合规件 ⇒ --all 绿（门禁不罚历史件）', () => {
    const dir = tmpRepo()
    writeFile(dir, '.batch/night/reports/ok.md', '# 标题\n')
    commitAll(dir)
    writeFile(dir, '.batch/night/reports/hist.v1.md', '# 标题\n')
    expect(checker(dir, ['--all']).status).toBe(0)
  })
})

describe('baseline 端到端（临时仓库）', () => {
  it('清单内未改动 ⇒ --all 绿并报豁免；改动后 ⇒ 照常报红', () => {
    const dir = tmpRepo()
    const rel = '.batch/night/reports/hist.v2.md'
    writeFile(dir, rel, '# 标题\n')
    commitAll(dir)
    const { rel: baselineRel } = writeBaselineFor(dir, [rel])
    commitAll(dir, 'CARD-1 baseline')
    const exempt = checker(dir, ['--all'])
    expect(exempt.status).toBe(0)
    expect(exempt.stdout).toContain('baseline 冻结清单豁免 1 项')

    fs.appendFileSync(path.join(dir, rel), '追加一行\n', 'utf8')
    const changed = checker(dir, ['--all'])
    expect(changed.status).toBe(1)
    expect(changed.stdout).toContain(rel)

    expect(baselineRel).toBe('scripts/ops/hygiene-baseline.txt')
  })

  it('baseline 文件缺失 ⇒ 不豁免', () => {
    const dir = tmpRepo()
    writeFile(dir, '.batch/night/reports/hist.v2.md', '# 标题\n')
    commitAll(dir)
    const result = checker(dir, ['--all'])
    expect(result.status).toBe(1)
    expect(result.stdout).not.toContain('baseline 冻结清单豁免')
  })

  it('baseline 头行缺失 ⇒ exit 2 并报错', () => {
    const dir = tmpRepo()
    writeFile(dir, '.batch/night/reports/ok.md', '# 标题\n')
    commitAll(dir)
    writeFile(dir, 'scripts/ops/hygiene-baseline.txt', '.batch/night/a.md\n')
    const result = checker(dir, ['--all'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('头三行缺')
  })

  it('--write-baseline 生成的头三行与条目数可用 --all 复现', () => {
    const dir = tmpRepo()
    writeFile(dir, '.batch/night/reports/hist.v2.md', '# 标题\n')
    writeFile(dir, '.batch/night/reports/ok.md', '# 标题\n')
    commitAll(dir)

    const written = checker(dir, ['--disk', '--write-baseline'])
    expect(written.status).toBe(0)
    const text = fs.readFileSync(path.join(dir, 'scripts', 'ops', 'hygiene-baseline.txt'), 'utf8')
    expect(text.split('\n')[0]).toBe('# 条目数：1')
    expect(text).toContain('.batch/night/reports/hist.v2.md')

    commitAll(dir, 'CARD-1 baseline')
    expect(checker(dir, ['--all']).status).toBe(0)
  })
})
