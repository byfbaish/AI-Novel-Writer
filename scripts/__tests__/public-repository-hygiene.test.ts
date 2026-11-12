import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const prohibitedPaths = [
  'CONTEXT.md',
  'design-qa.md',
  'rule.md',
  'rule.lite.md',
  'docs/superpowers',
  'public/screenshot',
  'public/logos',
  'tsconfig.node.tsbuildinfo',
]

describe('public repository hygiene', () => {
  it('does not contain internal process material or generated output', () => {
    // prohibitedPaths 约束的是「不入库」而非「工作区里不存在」：被 .gitignore 忽略的
    // 本地产物（docs/superpowers、*.tsbuildinfo）允许留在工作区，但不能被 git 跟踪。
    const tracked = execFileSync('git', ['ls-files', '--', ...prohibitedPaths], { encoding: 'utf8' })
    for (const target of prohibitedPaths) {
      expect(tracked.includes(target), target).toBe(false)
    }
  })

  it('ignores prohibited local material before it can be staged', () => {
    const rootGitignore = readFileSync('.gitignore', 'utf8')

    for (const entry of [
      '/CONTEXT.md',
      '/docs/superpowers/',
      '/output/',
      '/public/screenshot/',
      '/public/logos/',
      '*.tsbuildinfo',
    ]) {
      expect(rootGitignore).toContain(entry)
    }

    // ADR-0025 (track-agents-md-and-copilot-channel): AGENTS.md 是常驻上下文，必须入库。
    // 反向防护：防止有人把它重新写进 .gitignore，或让它脱离 git 跟踪。
    const tracked = execFileSync('git', ['ls-files', 'AGENTS.md'], { encoding: 'utf8' }).trim()
    expect(tracked, 'AGENTS.md must stay tracked (ADR-0025)').toBe('AGENTS.md')
    expect(rootGitignore, 'AGENTS.md must not be ignored (ADR-0025)').not.toContain('/AGENTS.md')
  })
})
