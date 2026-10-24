import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const checker = resolve(process.cwd(), 'scripts/check-prompt-wiring.mjs')

/**
 * 这个脚本的核心是「AST 能不能抓住 5 种注入形态」。写法一变（换成具名参数对象、换个
 * helper 名），脚本会安静地少认出几条链然后报全绿 —— 只能靠 fixture 黑盒验证。
 *
 * 夹具自包含：`builtin-prompt-templates.ts` 不 import 真实文件，否则 esbuild 会把
 * 整个 `src/` 拖进内存打包。
 */

const TEMPLATES = `
export interface PromptTemplate {
  key: string
  name: string
  description: string
  content: string
  systemSuffix?: string
  systemRole?: string
  taskGuidance?: string
  variables: Record<string, string>
  requiredContextVariables?: readonly string[]
}

export const BUILTIN_PROMPTS: PromptTemplate[] = [
  {
    key: 'demo_wired',
    name: '接线样例',
    description: 'fixture',
    content: '甲：{{alpha}}\\n乙：{{beta}}',
    systemSuffix: '输出合同：{{gamma}}',
    variables: { alpha: 'a', beta: 'b', gamma: 'c' },
    // 故意声明：脚本若改用 requiredContextVariables 当判据，这里的取值会改变结论。
    requiredContextVariables: ['alpha'],
  },
  {
    key: 'demo_orphan',
    name: '孤儿样例',
    description: 'fixture',
    content: '丙：{{delta}}',
    variables: { delta: 'd' },
  },
]
`

const BUILDER = `
export interface DemoPromptTemplate {
  key: string
  content: string
  systemSuffix?: string
}

export class BasePromptBuilder {
  protected variables: Record<string, string> = {}
  protected systemSuffixOverride?: string

  constructor(protected template: DemoPromptTemplate, protected readonly writingLanguage: string) {}

  public withSuffixOverride(text: string): this {
    this.systemSuffixOverride = text
    return this
  }

  public build(): string {
    return this.template.content
  }
}

export class DemoPromptBuilder extends BasePromptBuilder {
  /** 改名形态：方法名 ≠ 变量名。 */
  withSeed(seed: string) {
    this.variables.alpha = seed
    return this
  }

  withNote(note: string) {
    this.variables.beta = note
    return this
  }

  withContract(contract: string) {
    this.variables.gamma = contract
    return this
  }
}
`

const GOOD_COMMAND = `
import { resolvePromptTemplate } from '../../prompt-templates'
import { renderPrompt, renderPromptTaskGuidance } from '../../../../shared/render-prompt'
import { BasePromptBuilder, DemoPromptBuilder } from '../../prompts/prompt-builder'

/** 形态 1：builder 方法链。 */
export async function builderChain(session: unknown, language: 'zh-CN') {
  const template = await resolvePromptTemplate('demo_wired', session, language)
  if (!template) throw new Error('missing')
  return new DemoPromptBuilder(template, language)
    .withSeed('a')
    .withNote('b')
    .withContract('c')
    .build()
}

/** 形态 2：renderPrompt + 对象字面量。 */
export async function renderChain(session: unknown, language: 'zh-CN') {
  const template = await resolvePromptTemplate('demo_wired', session, language)
  if (!template) throw new Error('missing')
  return renderPrompt(template, { alpha: 'a', beta: 'b', gamma: 'c' }, language)
}

/** 形态 3：受保护的 variables 直接赋值。 */
export async function assignChain(session: unknown, language: 'zh-CN') {
  const template = await resolvePromptTemplate('demo_wired', session, language)
  if (!template) throw new Error('missing')
  const prompt = new BasePromptBuilder(template, language)
  ;(prompt as unknown as { variables: Record<string, string> }).variables = { alpha: 'a', beta: 'b', gamma: 'c' }
  return prompt.build()
}

/** 形态 4：只渲染 suffix，mode ⇒ guidance。 */
export async function guidanceChain(session: unknown, language: 'zh-CN') {
  const template = await resolvePromptTemplate('demo_wired', session, language)
  if (!template) throw new Error('missing')
  const vars = { gamma: 'c' }
  return renderPromptTaskGuidance(template, vars, language)
}
`

/** 故意漏掉 suffix 变量 `gamma`。 */
const BAD_COMMAND = `
import { resolvePromptTemplate } from '../../prompt-templates'
import { DemoPromptBuilder } from '../../prompts/prompt-builder'

export async function leakyChain(session: unknown, language: 'zh-CN') {
  const template = await resolvePromptTemplate('demo_wired', session, language)
  if (!template) throw new Error('missing')
  return new DemoPromptBuilder(template, language).withSeed('a').withNote('b').build()
}
`

function writeFixture(root: string, relativePath: string, content: string) {
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
}

function fixture(options: { commands?: Array<[string, string]>; templates?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ai-novel-prompt-wiring-'))
  writeFixture(root, 'src/services/builtin-prompt-templates.ts', options.templates ?? TEMPLATES)
  writeFixture(root, 'src/services/prompt-language.ts', 'export const EN_US_BUILTIN_PROMPTS = Object.freeze({})\n')
  writeFixture(root, 'src/services/prompts/prompt-builder.ts', BUILDER)
  for (const [file, content] of options.commands ?? []) writeFixture(root, file, content)
  return root
}

// 夹具永远过不了真实阈值（2 个模板 / 4 条链 / 3 个方法），必须压低 —— 这也是
// `--min-*` 存在的唯一理由。
const FIXTURE_LIMITS = ['--min-templates', '1', '--min-chains', '1', '--min-methods', '1']

function runChecker(root: string, args: string[] = []): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [checker, ...args], { cwd: root, encoding: 'utf8' })
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** 取某个分段（`[gap]` → 下一个段头之前）。 */
function section(output: string, name: string): string {
  const start = output.indexOf(`[${name}]`)
  if (start < 0) return ''
  const rest = output.slice(start + name.length + 2)
  const end = rest.search(/\n\[/)
  return end < 0 ? rest : rest.slice(0, end)
}

describe('prompt wiring checker', () => {
  it('keeps a fully wired template out of [gap] and reports full coverage', () => {
    const root = fixture({ commands: [['src/services/workflows/commands/good.command.ts', GOOD_COMMAND]] })
    try {
      const result = runChecker(root, FIXTURE_LIMITS)

      expect(result.status).toBe(0)
      expect(section(result.stdout, 'gap')).not.toContain('demo_wired')
      expect(result.stdout).toMatch(/demo_wired\s+full\s+2\/2\s+1\/1/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports a missing suffix variable as [gap] but still exits 0 in report mode', () => {
    const root = fixture({ commands: [['src/services/workflows/commands/bad.command.ts', BAD_COMMAND]] })
    try {
      const result = runChecker(root, FIXTURE_LIMITS)

      expect(result.status).toBe(0)
      expect(section(result.stdout, 'gap')).toContain('demo_wired')
      expect(section(result.stdout, 'gap')).toContain('gamma')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('exits 1 for the same fresh gap under --strict', () => {
    const root = fixture({ commands: [['src/services/workflows/commands/bad.command.ts', BAD_COMMAND]] })
    try {
      const result = runChecker(root, [...FIXTURE_LIMITS, '--strict'])

      expect(result.status).toBe(1)
      expect(section(result.stdout, 'gap')).toContain('demo_wired')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('lists a template with no consuming chain under [no-consumer]', () => {
    const root = fixture({ commands: [['src/services/workflows/commands/good.command.ts', GOOD_COMMAND]] })
    try {
      const result = runChecker(root, FIXTURE_LIMITS)

      expect(section(result.stdout, 'no-consumer')).toContain('demo_orphan')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('emits machine-readable JSON without any human-readable line', () => {
    const root = fixture({ commands: [['src/services/workflows/commands/good.command.ts', GOOD_COMMAND]] })
    try {
      const result = runChecker(root, [...FIXTURE_LIMITS, '--json'])

      expect(result.status).toBe(0)
      const payload = JSON.parse(result.stdout)
      expect(payload.summary.templates).toBe(2)
      expect(payload.items.map((item: { key: string }) => item.key).sort()).toEqual(['demo_orphan', 'demo_wired'])
      expect(payload.items.find((item: { key: string }) => item.key === 'demo_wired').chains.length).toBe(4)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails the self-check instead of reporting all green when the registry is unreadable', () => {
    const root = fixture({
      templates: `
export const BUILTIN_PROMPTS = [
  { key: 'demo_wired', name: 'n', description: 'd', content: '{{alpha}}', variables: { alpha: 'a' } },
]
`,
    })
    try {
      const result = runChecker(root, ['--min-templates', '5', '--min-chains', '1', '--min-methods', '1'])

      expect(result.status).toBe(1)
      expect(result.stderr).toContain('自检失败')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
