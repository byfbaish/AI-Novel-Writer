import { describe, expect, it } from 'vitest'

import {
  buildRunArgs,
  classifyOutcome,
  createRunId,
  describeFileEdit,
  detectAuthRequired,
  parseArgv,
  parseStreamJson,
  resolveCliCommand,
  slugify,
  stripAnsi,
  summarizeRun,
} from '../cli.mjs'

/**
 * 用例来源：2026-11-05 在本机真跑 `codebuddy -p` 抓到的两段真实输出。
 * 未登录那段尤其重要——CLI 的**退出码是 0**，只能靠文案判定，所以这是一条回归样本，
 * 不是编造的简化串。
 */
const AUTH_REQUIRED_OUTPUT =
  'Authentication required. Please use /login command to sign in to your account\n'

/** `--output-format stream-json` 的真实骨架：init → assistant(text+tool_use) → user(tool_result) → result */
const STREAM_OK = [
  JSON.stringify({ type: 'system', subtype: 'init', session_id: 'sess-1', model: 'deepseek-v4.1-flash', cwd: 'C:\\develop\\workspace\\AI-writer\\wt-2', tools: ['Read', 'Edit', 'Bash'] }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '先看一下文件' }] } }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-1', name: 'Edit', input: { file_path: 'docs/agents/workbuddy-channel.md', old_string: 'a', new_string: 'b' } }] } }),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-2', name: 'Write', input: { file_path: 'scripts/workbuddy/new.mjs', content: 'x' } }] } }),
  JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'ok' }, { type: 'tool_result', tool_use_id: 'tu-2', is_error: true, content: 'Permission denied by user' }] } }),
  JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '改完了 2 个文件', session_id: 'sess-1', num_turns: 3, duration_ms: 4200, total_cost_usd: 0.0123, usage: { input_tokens: 100, output_tokens: 20 } }),
].join('\n')

describe('detectAuthRequired', () => {
  it('识别真实未登录输出（CLI 退出码仍是 0，这是唯一判据）', () => {
    expect(detectAuthRequired(AUTH_REQUIRED_OUTPUT)).toBe(true)
  })

  it('带 ANSI 颜色也认得出', () => {
    expect(detectAuthRequired('\u001b[31mAuthentication required\u001b[0m')).toBe(true)
  })

  it('正常结果不误判', () => {
    expect(detectAuthRequired('改完了 2 个文件，登录页也顺手修了')).toBe(false)
  })
})

describe('stripAnsi', () => {
  it('去掉颜色序列但保留正文', () => {
    expect(stripAnsi('\u001b[1m\u001b[32mOK\u001b[0m done')).toBe('OK done')
  })

  it('非字符串输入不炸', () => {
    expect(stripAnsi(null)).toBe('')
    expect(stripAnsi(undefined)).toBe('')
  })
})

describe('parseArgv', () => {
  // 回归：最初用「上一个参数不是 -- 开头就算位置参数」，`run --dry-run "任务"` 把任务吞了
  it('布尔 flag 后面的位置参数不会被吞掉', () => {
    const parsed = parseArgv(['--dry-run', '只回复两个字母：OK'], ['dry-run'])
    expect(parsed.flags.has('dry-run')).toBe(true)
    expect(parsed.positionals).toEqual(['只回复两个字母：OK'])
  })

  it('--name value 成对取值，value 可以是路径或负数以外的任意串', () => {
    const parsed = parseArgv(['--cwd', 'C:\\develop\\wt-2', '--timeout', '15', '任务文本'], ['dry-run'])
    expect(parsed.options.get('cwd')).toBe('C:\\develop\\wt-2')
    expect(parsed.options.get('timeout')).toBe('15')
    expect(parsed.positionals).toEqual(['任务文本'])
  })

  it('末尾布尔 flag 不吃值', () => {
    const parsed = parseArgv(['任务', '--json'], ['json'])
    expect(parsed.positionals).toEqual(['任务'])
    expect(parsed.flags.has('json')).toBe(true)
  })

  it('未声明布尔且后面跟 -- 开头的也不吞', () => {
    const parsed = parseArgv(['--model', '--json', '任务'], ['json'])
    expect(parsed.flags.has('model')).toBe(true)
    expect(parsed.flags.has('json')).toBe(true)
    expect(parsed.positionals).toEqual(['任务'])
  })
})

describe('createRunId', () => {
  it('形如 YYYYMMDD-HHMMSS-xxxx，可直接当目录名', () => {
    expect(createRunId(new Date(2026, 10, 5, 1, 2, 3), () => 0.5)).toMatch(/^20261105-010203-[0-9a-f]{4}$/)
  })
})

describe('slugify', () => {
  it('中文保留，空格与标点折成单个连字符', () => {
    expect(slugify('审查 D18 章尾钩子设计稿')).toBe('审查-D18-章尾钩子设计稿')
  })

  it('超长截断，不出现尾部连字符', () => {
    const slug = slugify('a'.repeat(60), 10)
    expect(slug).toBe('a'.repeat(10))
    expect(slug.endsWith('-')).toBe(false)
  })

  it('全是符号时退化成 task（不能出现空目录名）', () => {
    expect(slugify('   ')).toBe('task')
    expect(slugify('!!!')).toBe('task')
  })
})

describe('resolveCliCommand', () => {
  it('WORKBUDDY_CLI 指到 Node 脚本时用当前 node 当解释器', () => {
    const resolved = resolveCliCommand({
      env: { WORKBUDDY_CLI: 'C:\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\bin\\codebuddy' },
      platform: 'win32',
      exists: () => true,
      execPath: 'C:\\app\\node.exe',
    })
    expect(resolved.command).toBe('C:\\app\\node.exe')
    expect(resolved.args).toEqual(['C:\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\bin\\codebuddy'])
    expect(resolved.shell).toBe(false)
    expect(resolved.via).toBe('env')
  })

  it('WB_COMMAND 指到 .exe 时不额外套 node', () => {
    const resolved = resolveCliCommand({
      env: { WB_COMMAND: 'C:\\tools\\codebuddy.exe' },
      platform: 'win32',
      exists: () => true,
      execPath: 'C:\\app\\node.exe',
    })
    expect(resolved.command).toBe('C:\\tools\\codebuddy.exe')
    expect(resolved.args).toEqual([])
  })

  it('在 npm 全局目录里找到包时用 node 跑 bin（Git Bash 下 shim 是坏的）', () => {
    const bin = 'C:\\Users\\me\\AppData\\Roaming\\npm\\node_modules\\@tencent-ai\\codebuddy-code\\bin\\codebuddy'
    const resolved = resolveCliCommand({
      env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming', USERPROFILE: 'C:\\Users\\me' },
      platform: 'win32',
      exists: candidate => candidate === bin,
      execPath: 'C:\\app\\node.exe',
    })
    expect(resolved.command).toBe('C:\\app\\node.exe')
    expect(resolved.args).toEqual([bin])
    expect(resolved.via).toBe('npm-global')
  })

  it('找不到时退回 PATH 上的 codebuddy（Windows 需要 shell 才能解析 .cmd）', () => {
    const resolved = resolveCliCommand({ env: {}, platform: 'win32', exists: () => false })
    expect(resolved.command).toBe('codebuddy')
    expect(resolved.shell).toBe(true)
    expect(resolved.via).toBe('path')
  })
})

describe('buildRunArgs', () => {
  it('默认：-p + 跳过权限 + stream-json，且 prompt 不在参数里', () => {
    expect(buildRunArgs()).toEqual(['-p', '--dangerously-skip-permissions', '--output-format', 'stream-json'])
  })

  it('选项顺序稳定、成对出现', () => {
    const args = buildRunArgs({ model: 'deepseek-v4.1-flash', fallbackModel: 'glm-4.6', maxTurns: 8, disallowedTools: ['Bash(git:*)'] })
    expect(args.join(' ')).toContain('--model deepseek-v4.1-flash')
    expect(args.join(' ')).toContain('--fallback-model glm-4.6')
    expect(args.join(' ')).toContain('--max-turns 8')
    expect(args.slice(-2)).toEqual(['--disallowedTools', 'Bash(git:*)'])
  })

  it('resume 优先于 continue（两个一起给 CLI 会报错）', () => {
    const args = buildRunArgs({ resumeSessionId: 'sess-9', continueSession: true })
    expect(args.join(' ')).toContain('--resume sess-9')
    expect(args).not.toContain('--continue')
  })

  it('no-skip-permissions 时不带 -y（需要人工授权时用）', () => {
    expect(buildRunArgs({ skipPermissions: false })).not.toContain('--dangerously-skip-permissions')
  })
})

describe('describeFileEdit', () => {
  it('Write 记 create，Edit 记 edit', () => {
    expect(describeFileEdit({ name: 'Write', input: { file_path: 'a.md' } })).toEqual({ tool: 'Write', kind: 'create', path: 'a.md' })
    expect(describeFileEdit({ name: 'Edit', input: { file_path: 'a.md' } })).toEqual({ tool: 'Edit', kind: 'edit', path: 'a.md' })
  })

  it('apply_patch 记 patch，NotebookEdit 取 notebook_path', () => {
    expect(describeFileEdit({ name: 'apply_patch', input: { path: 'b.ts' } })?.kind).toBe('patch')
    expect(describeFileEdit({ name: 'NotebookEdit', input: { notebook_path: 'c.ipynb' } })?.path).toBe('c.ipynb')
  })

  it('只读工具与缺路径的调用不算副作用', () => {
    expect(describeFileEdit({ name: 'Read', input: { file_path: 'a.md' } })).toBeNull()
    expect(describeFileEdit({ name: 'Edit', input: {} })).toBeNull()
    expect(describeFileEdit(undefined)).toBeNull()
  })
})

describe('parseStreamJson', () => {
  const parsed = parseStreamJson(STREAM_OK)

  it('从 init 事件取 sessionId/model/cwd', () => {
    expect(parsed.init).toMatchObject({ sessionId: 'sess-1', model: 'deepseek-v4.1-flash' })
  })

  it('tool_use 全部记下，改文件的折算成 fileEdits', () => {
    expect(parsed.toolCalls.map(call => call.name)).toEqual(['Edit', 'Write'])
    expect(parsed.fileEdits).toEqual([
      { tool: 'Edit', kind: 'edit', path: 'docs/agents/workbuddy-channel.md' },
      { tool: 'Write', kind: 'create', path: 'scripts/workbuddy/new.mjs' },
    ])
  })

  it('tool_result 回填 ok，权限拒绝进 deniedTools（不信 agent 自述）', () => {
    expect(parsed.toolCalls[0].ok).toBe(true)
    expect(parsed.toolCalls[1].ok).toBe(false)
    expect(parsed.deniedTools).toEqual(['Write'])
  })

  it('result 事件的文本/turns/耗时/花费都取到', () => {
    expect(parsed.result).toMatchObject({ subtype: 'success', isError: false, turns: 3, durationMs: 4200, costUsd: 0.0123 })
    expect(parsed.text).toBe('改完了 2 个文件')
  })

  it('非 JSON 行进 invalidLines，不打断解析（CLI 会混入提示语）', () => {
    const mixed = ['Git Bash not detected, using cmd.exe', STREAM_OK.split('\n')[0], 'not json at all'].join('\n')
    const result = parseStreamJson(mixed)
    expect(result.invalidLines).toEqual(['Git Bash not detected, using cmd.exe', 'not json at all'])
    expect(result.init?.sessionId).toBe('sess-1')
  })

  it('未登录时 stdout 是纯文案：认出来且不假装成功', () => {
    const result = parseStreamJson(AUTH_REQUIRED_OUTPUT)
    expect(result.authRequired).toBe(true)
    expect(result.result).toBeNull()
  })

  it('空输入不炸', () => {
    expect(parseStreamJson('').events).toEqual([])
    expect(parseStreamJson(undefined).authRequired).toBe(false)
  })
})

describe('classifyOutcome', () => {
  it('未登录 → 2（NEED_HUMAN_LOGIN），哪怕 CLI 退出码是 0', () => {
    const parsed = parseStreamJson(AUTH_REQUIRED_OUTPUT)
    expect(classifyOutcome({ exitCode: 0, parsed })).toMatchObject({ exitCode: 2, status: 'need-human-login' })
  })

  it('超时 → 4，优先于退出码判定', () => {
    expect(classifyOutcome({ exitCode: null, timedOut: true, parsed: parseStreamJson('') })).toMatchObject({ exitCode: 4, status: 'timeout' })
  })

  it('CLI 缺失 → 3', () => {
    expect(classifyOutcome({ spawnError: new Error('ENOENT') })).toMatchObject({ exitCode: 3, status: 'cli-missing' })
  })

  it('退出码非 0 → 1', () => {
    expect(classifyOutcome({ exitCode: 137, parsed: parseStreamJson('') })).toMatchObject({ exitCode: 1, status: 'failed' })
  })

  it('退出码 0 但 result 标了 error → 1（不能把失败当成功）', () => {
    const parsed = parseStreamJson(JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, result: '' }))
    expect(classifyOutcome({ exitCode: 0, parsed })).toMatchObject({ exitCode: 1, status: 'failed' })
  })

  it('正常完成 → 0', () => {
    expect(classifyOutcome({ exitCode: 0, parsed: parseStreamJson(STREAM_OK) })).toMatchObject({ exitCode: 0, status: 'completed' })
  })
})

describe('summarizeRun', () => {
  it('给值班的人看的最小集合', () => {
    const summary = summarizeRun(parseStreamJson(STREAM_OK))
    expect(summary).toMatchObject({
      text: '改完了 2 个文件',
      sessionId: 'sess-1',
      model: 'deepseek-v4.1-flash',
      turns: 3,
      toolCalls: 2,
      toolNames: ['Edit', 'Write'],
      deniedTools: ['Write'],
    })
    expect(summary.fileEdits).toHaveLength(2)
  })
})
