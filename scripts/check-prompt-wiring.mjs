#!/usr/bin/env node
/* global process */
/**
 * prompt wiring —— 「模板声明了变量，但没有链路注入」体检。
 *
 * 为什么要有这个脚本：`golden_finger` / `rhythm_profile` / `pacing_guidance` /
 * `character_dynamics` 四个事实源是**同一种形状**的问题 —— 事实源存在，只接了当时
 * 那一条链就交付了，其余链路静默丢字段。人肉 review 每次都能漏掉下一个同款缺口。
 *
 * ## 判定模型（改这条模型前先读完全文）
 *
 * - declared：该模板会被渲染的文本里的 `{{var}}`。分两段 ——
 *   `content`（content ∪ taskGuidance）与 `suffix`（systemSuffix），中英取并集。
 * - chain：「取到 template 的那段代码」+ 同一**函数体**内对它的注入。
 * - mode：`full`（两段都渲染）/ `guidance`（只 renderPromptTaskGuidance，只渲染 suffix）。
 * - injected：该链注入的变量名集合。
 * - required：`full` ⇒ content ∪ suffix；`guidance` ⇒ suffix ∪ taskGuidance 占位符。
 * - gap：`required − injected` 非空。
 *
 * ## 绝对不要用这三个判据（历史上有人「优化」回去过，别再犯）
 *
 * 1. `requiredContextVariables` —— 它不是「必须注入」。`src/shared/render-prompt.ts:17-23`
 *    的语义是「作者覆盖版把占位符删了时，把内置声明的值补到正文末尾」，而且
 *    `variables[key]` 为空时**静默什么都不加**。拿它当判据会漏掉所有真缺口。
 * 2. `variables` 字典 —— 与占位符集合不是同一集合。`premise` 的 `variables` 有 12 项，
 *    但 `step_guidance` 只出现在 `systemSuffix`；`assistant_writing_identity` 的字典项数
 *    碰巧等于占位符数，那是巧合，不是规律。
 * 3. 「方法名小写 = 变量名」—— `withCoreSeed → premise`（prompt-builder.ts:391）、
 *    `withUserIdea → user_idea`（:422）、`withN → n`（:469）、`withM → m`（:474）。
 *    映射表只能从 `this.variables.<name> =` 的赋值节点读出来。
 *
 * ## 注入形态（AST 判定；正则不可用）
 *
 * 0. 定位窗口：从取模节点向上找最近的 `FunctionLike` 且有 body，然后 Walk 整个子树
 *    （含内部箭头回调）。固定行窗必漏 —— `generate-draft.command.ts` 的第二处注入
 *    离取模点约 80 行。
 * 1. `.withXxx(...)`：`CallExpression` + `PropertyAccessExpression`，名字 ∈ 方法表。
 *    **额外要求同函数体内出现过 `new <Xxx>Builder(`**，否则记 `builder-orphan-method`
 *    warning —— 全仓有 `.withLeaseHeartbeat(...)` 这类非 builder 的同形方法。
 * 2. `renderPrompt(t, {...})`：`args[1]` 是 `ObjectLiteralExpression`。
 * 3. `(prompt as unknown as {...}).variables = {...}`：左是名为 `variables` 的
 *    `PropertyAccessExpression`、右是对象字面量（目前仅 analyze-style.command.ts）。
 * 4. `renderPromptTaskGuidance(t, vars, lang)`：`args[1]` 是 Identifier ⇒ 同函数体内
 *    找 `const <id> = { ... }`；同时 mode ⇒ `guidance`。
 * 5. `{ build: () => base.build() + contract }` 包装：见到名为 `build` 的
 *    `PropertyAssignment` 且右侧是 `ArrowFunction` ⇒ mode 判 `full`。
 *
 * ## 参数
 *
 *   node scripts/check-prompt-wiring.mjs                  # 报告模式，退出码恒 0
 *   node scripts/check-prompt-wiring.mjs --strict         # 新增缺口 / no-consumer ⇒ 1
 *   node scripts/check-prompt-wiring.mjs --json           # 只输出 JSON
 *   --root <dir>          # 体检根目录（默认当前工作目录 cwd），fixture 测试用
 *   --min-templates <n>   # 覆盖自检阈值
 *   --min-chains <n>
 *   --min-methods <n>
 *
 * ⚠️ `--min-*` 是**唯一**为可测性让路的地方：fixture 只有 2 个模板、几条链，必须能压低
 * 阈值才跑得起来。真仓库请永远用默认值 —— 阈值就是「脚本还看得见东西」的证明。
 */
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { build } from 'esbuild'
import ts from 'typescript'

/** 自检下限：脚本读不出东西时必须红，而不是安静地报「全绿」。 */
const SELF_CHECK = { minTemplates: 25, minChains: 20, minMethods: 60 }

/**
 * 已知缺口。**不另落 JSON** —— 只有 3 条，写在代码里 diff 更可读。
 * `code` 必须与判定产出的 code 逐字一致，否则这条已知会失效。
 */
const KNOWN = [
  {
    key: 'chapter_blueprint',
    code: 'no-consumer',
    reason: '历史遗留·无运行时消费方（作者 2026-10-24 裁定：不删不搬）',
  },
  {
    key: 'extract_initial_characters',
    code: 'no-consumer',
    reason: '历史遗留·无运行时消费方',
  },
  {
    key: 'character_dynamics',
    code: 'content-not-rendered',
    reason: '只用 systemRole + taskGuidance，正文 8 个占位符不渲染（清单稿 §7 G6）',
  },
]

/**
 * 主信号覆盖不到的链路。**每条必须写 reason**，且 `file`/`line` 必须是真实注入点：
 * 脚本会按同样的 AST 规则重新分析这一行所在的函数体，而不是照抄一份变量名列表。
 */
const INDIRECT_CHAINS = [
  {
    key: 'edit_selected_text',
    file: 'electron/services/editor-inline-generation.ts',
    line: 49,
    reason:
      '主进程内联改写链：模板由 generation-source-binding.ts:549 从 importPrompts 取出、随 '
      + 'EditorInlineContext 冻结传递，editorInlineTask() 在 electron/ 侧才 renderPrompt —— '
      + "src 里根本没有 resolvePromptTemplate('edit_selected_text')，主信号扫不到。",
  },
]

/** 解析器自身的唯一出口，不是消费方（`getBuiltinPromptTemplate(key, …)` 拿的是入参）。 */
const RESOLVER_MODULE = 'src/services/prompt-templates.ts'
const RESOLVER_NAMES = new Set(['resolvePromptTemplate', 'getBuiltinPromptTemplate'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.runtime', '__tests__', 'dist', 'dist-electron'])

// ─── 小工具 ────────────────────────────────────────────────────────────────

const toPosix = (value) => value.split(path.sep).join('/')
const placeholdersOf = (text) => {
  if (!text) return []
  const found = new Set()
  // matchAll 内部会克隆正则，不会串改 lastIndex；仍每次新建，避免被外部复用污染。
  for (const match of text.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/giu)) found.add(match[1].toLowerCase())
  return [...found]
}
const union = (...lists) => [...new Set(lists.flat())]
const option = (argv, name, fallback) => {
  const inline = argv.find((value) => value.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = argv.indexOf(name)
  const next = index >= 0 ? argv[index + 1] : undefined
  return next && !next.startsWith('--') ? next : fallback
}
const countOf = (number) => Number.parseInt(String(number), 10)

// ─── 模板注册表（esbuild 内存打包 + data URL import）────────────────────────

async function loadRegistry(root) {
  const entry = [
    "export { BUILTIN_PROMPTS } from './src/services/builtin-prompt-templates.ts';",
    "export { EN_US_BUILTIN_PROMPTS } from './src/services/prompt-language.ts';",
  ].join('')
  const bundled = await build({
    stdin: { contents: entry, resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
}

function readTemplates(registry) {
  const builtin = Array.isArray(registry.BUILTIN_PROMPTS) ? registry.BUILTIN_PROMPTS : []
  const english = registry.EN_US_BUILTIN_PROMPTS ?? {}
  return builtin
    .filter((template) => typeof template?.key === 'string')
    .map((template) => {
      // 英文侧只有 systemRole / content / systemSuffix（见 prompt-language.ts 的
      // PromptLanguageTemplate），`variables` 恒取中文那份（getBuiltinPromptTemplate
      // 用 `{ ...builtin, ...translated }` 合并）。这里只取占位符，取字段即可。
      const translated = english[template.key] ?? {}
      return {
        key: template.key,
        content: union(placeholdersOf(template.content), placeholdersOf(template.taskGuidance), placeholdersOf(translated.content)),
        suffix: union(placeholdersOf(template.systemSuffix), placeholdersOf(translated.systemSuffix)),
        taskGuidance: union(placeholdersOf(template.taskGuidance), placeholdersOf(translated.taskGuidance)),
      }
    })
    .sort((left, right) => left.key.localeCompare(right.key))
}

// ─── builder 方法表（typescript 编译器 API）────────────────────────────────

function readMethodTable(root) {
  const file = path.join(root, 'src/services/prompts/prompt-builder.ts')
  if (!fs.existsSync(file)) return { table: new Map(), byName: new Map(), sideEffects: [] }
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const table = new Map()
  const sideEffects = []
  const visitClass = (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name)) continue
        const method = member.name.text
        if (!method.startsWith('with')) continue
        // `this.variables.<name> = …` —— 变量名在**左值的第二个标识符**上，不是方法名。
        let variable = null
        const walk = (inner) => {
          if (
            ts.isBinaryExpression(inner)
            && inner.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && ts.isPropertyAccessExpression(inner.left)
            && ts.isPropertyAccessExpression(inner.left.expression)
            && inner.left.expression.name.text === 'variables'
          ) variable = inner.left.name.text
          ts.forEachChild(inner, walk)
        }
        walk(member)
        if (variable) table.set(`${node.name.text}.${method}`, variable)
        else sideEffects.push(`${node.name.text}.${method}`)
      }
    }
    ts.forEachChild(node, visitClass)
  }
  visitClass(source)
  // 表按「类.方法」计数（68 变量方法 + 1 副作用方法 = 69）；跨类重名共 13 个，
  // 但映射到同一变量，所以按方法名再压一层给形态 1 用。
  const byName = new Map()
  for (const [qualified, variable] of table) byName.set(qualified.slice(qualified.indexOf('.') + 1), variable)
  return { table, byName, sideEffects }
}

// ─── 链发现 ────────────────────────────────────────────────────────────────

function collectSourceFiles(dir, out = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      collectSourceFiles(path.join(dir, entry.name), out)
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$|\.d\.ts$/.test(entry.name)) {
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

function propertyNameText(name) {
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isPrivateIdentifier(name)) return name.text
  return null
}

function objectLiteralNames(node) {
  const names = []
  for (const property of node.properties) {
    if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
      const name = propertyNameText(property.name)
      if (name) names.push(name)
    }
  }
  return names
}

/** 三元两分支都要收：`templateKey` 一个常量名背后是两条链。 */
function collectStringBranches(expression, out) {
  if (!expression) return
  if (ts.isConditionalExpression(expression)) {
    collectStringBranches(expression.whenTrue, out)
    collectStringBranches(expression.whenFalse, out)
    return
  }
  if (ts.isParenthesizedExpression(expression)) return collectStringBranches(expression.expression, out)
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    out.push(expression.text)
    return
  }
  if (ts.isBinaryExpression(expression)) {
    const kind = expression.operatorToken.kind
    if (kind === ts.SyntaxKind.QuestionQuestionToken || kind === ts.SyntaxKind.BarBarToken) {
      collectStringBranches(expression.left, out)
      collectStringBranches(expression.right, out)
    }
  }
}

/** 同文件常量回代：先在最近的函数作用域找，再逐层向外，最后落到模块作用域。 */
function findVariableInitializer(name, node) {
  const scopes = []
  let cursor = node
  while (cursor) {
    if (ts.isFunctionLike(cursor) && cursor.body) scopes.push(cursor.body)
    cursor = cursor.parent
  }
  scopes.push(node.getSourceFile())
  for (const scope of scopes) {
    let found = null
    const visit = (inner) => {
      if (found) return
      if (
        ts.isVariableDeclaration(inner)
        && ts.isIdentifier(inner.name)
        && inner.name.text === name
        && inner.initializer
      ) {
        found = inner.initializer
        return
      }
      ts.forEachChild(inner, visit)
    }
    visit(scope)
    if (found) return found
  }
  return null
}

function resolveKeyArgument(argument, node) {
  if (!argument) return { keys: [], via: 'literal', unresolved: true }
  // `getBuiltinPromptTemplate(template.key, …)` 是对**已知模板**再解析一次，不是新链路。
  if (ts.isPropertyAccessExpression(argument) && argument.name.text === 'key') return null
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return { keys: [argument.text], via: 'literal', unresolved: false }
  }
  if (ts.isIdentifier(argument)) {
    const keys = []
    collectStringBranches(findVariableInitializer(argument.text, node), keys)
    return { keys: [...new Set(keys)], via: `const:${argument.text}`, unresolved: keys.length === 0 }
  }
  return { keys: [], via: 'literal', unresolved: true }
}

function enclosingFunctionWithBody(node) {
  let cursor = node.parent
  while (cursor) {
    if (ts.isFunctionLike(cursor) && cursor.body) return cursor
    cursor = cursor.parent
  }
  return null
}

function discoverChains(root) {
  const chains = []
  const warnings = []
  for (const file of collectSourceFiles(path.join(root, 'src'))) {
    const relative = toPosix(path.relative(root, file))
    if (relative === RESOLVER_MODULE) continue
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const inFile = []
    const visit = (node) => {
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && RESOLVER_NAMES.has(node.expression.text)
      ) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
        const resolved = resolveKeyArgument(node.arguments[0], node)
        if (resolved?.unresolved) {
          warnings.push({ code: 'unresolved-key', file: relative, line, detail: node.getText(source).slice(0, 80) })
        } else if (resolved) {
          for (const key of resolved.keys) inFile.push({ key, file: relative, line, via: resolved.via, node })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)

    // `resolve(...) ?? getBuiltin(...)`（同一 key、行号差 ≤2）是同一条链，不是两条。
    // 不同 key 的相邻 fallback（import-novel 的 with_vectors || infer_novel_config）不合并。
    inFile.sort((left, right) => left.line - right.line)
    const merged = []
    for (const chain of inFile) {
      const same = merged.find((item) => item.key === chain.key && Math.abs(item.line - chain.line) <= 2)
      if (same) {
        same.mergedLines.push(chain.line)
        continue
      }
      merged.push({ ...chain, mergedLines: [chain.line] })
    }
    chains.push(...merged)
  }
  return { chains, warnings }
}

/** 形态 4 的变量对象就在同一个函数体里，直接按名字找 `const <id> = { … }`。 */
function findObjectLiteralInWindow(windowNode, name) {
  let found = null
  const visit = (node) => {
    if (found) return
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer
      && ts.isObjectLiteralExpression(node.initializer)) {
      found = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(windowNode.body ?? windowNode)
  return found
}

/**
 * 在一个函数体里收集注入。返回注入集合 + mode + 该链自己的问题。
 * 注意：形态 0 的窗口就是整个函数体（含嵌套箭头），所以调用方传进来的必须是
 * 「取模节点的最近有 body 的 FunctionLike」。
 */
function analyzeWindow(windowNode, methods) {
  const injected = new Set()
  const builderCalls = []
  const renderProps = []
  const assignmentProps = []
  const guidanceNames = []
  let hasNewBuilder = false
  let hasBuildCall = false
  let hasBuildArrow = false
  let hasBuilderHelper = false
  let hasRenderPrompt = false
  let hasVariablesAssign = false
  let hasGuidance = false

  const visit = (node) => {
    if (ts.isNewExpression(node) && node.expression && ts.isIdentifier(node.expression) && /Builder$/.test(node.expression.text)) {
      hasNewBuilder = true
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text
      if (methods.byName.has(name)) builderCalls.push({ name })
      if (name === 'build') hasBuildCall = true
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text
      if (name === 'callLLMWithBuilder') hasBuilderHelper = true
      if (name === 'renderPrompt') {
        hasRenderPrompt = true
        const argument = node.arguments[1]
        if (argument && ts.isObjectLiteralExpression(argument)) renderProps.push(...objectLiteralNames(argument))
      }
      if (name === 'renderPromptTaskGuidance') {
        hasGuidance = true
        const argument = node.arguments[1]
        if (argument && ts.isObjectLiteralExpression(argument)) guidanceNames.push(...objectLiteralNames(argument))
        else if (argument && ts.isIdentifier(argument)) {
          const literal = findObjectLiteralInWindow(windowNode, argument.text)
          if (literal) guidanceNames.push(...objectLiteralNames(literal))
        }
      }
    }
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && node.left.name.text === 'variables'
      && ts.isObjectLiteralExpression(node.right)
    ) {
      hasVariablesAssign = true
      assignmentProps.push(...objectLiteralNames(node.right))
    }
    if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === 'build' && ts.isArrowFunction(node.initializer)) {
      hasBuildArrow = true
    }
    ts.forEachChild(node, visit)
  }
  visit(windowNode.body ?? windowNode)

  const warnings = []
  if (builderCalls.length > 0 && !hasNewBuilder) {
    // 全仓有 `.withLeaseHeartbeat(...)` 这类非 builder 的同形方法：只认方法名会误判。
    for (const call of builderCalls) {
      warnings.push({ code: 'builder-orphan-method', detail: `.${call.name}(…) 所在函数体没有 new *Builder(` })
    }
  } else {
    for (const call of builderCalls) injected.add(methods.byName.get(call.name))
  }
  for (const name of renderProps) injected.add(name)
  for (const name of assignmentProps) injected.add(name)
  for (const name of guidanceNames) injected.add(name)

  const fullSignal = builderCalls.length > 0 || hasRenderPrompt || hasVariablesAssign
    || hasBuildArrow || hasBuildCall || hasBuilderHelper
  return { injected, mode: hasGuidance && !fullSignal ? 'guidance' : 'full', warnings }
}

function analyzeIndirectChains(root, methods) {
  const chains = []
  const warnings = []
  for (const entry of INDIRECT_CHAINS) {
    const file = path.join(root, entry.file)
    if (!fs.existsSync(file)) {
      warnings.push({ code: 'indirect-missing', file: entry.file, line: entry.line, detail: entry.key })
      continue
    }
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    let anchor = null
    const visit = (node) => {
      if (anchor) return
      if (ts.isCallExpression(node) && node.getStart(source) >= 0
        && source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 === entry.line) {
        anchor = node
        return
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    const windowNode = anchor ? enclosingFunctionWithBody(anchor) : null
    if (!windowNode) {
      warnings.push({ code: 'indirect-missing', file: entry.file, line: entry.line, detail: entry.key })
      continue
    }
    const analysis = analyzeWindow(windowNode, methods)
    warnings.push(...analysis.warnings.map((warning) => ({ ...warning, file: entry.file, line: entry.line, detail: `${entry.key} · ${warning.detail}` })))
    chains.push({
      key: entry.key,
      file: entry.file,
      line: entry.line,
      via: 'indirect-table',
      reason: entry.reason,
      injected: analysis.injected,
      mode: analysis.mode,
    })
  }
  return { chains, warnings }
}

// ─── 判定 ──────────────────────────────────────────────────────────────────

function evaluate(templates, chains) {
  const byKey = new Map()
  for (const chain of chains) {
    if (!byKey.has(chain.key)) byKey.set(chain.key, [])
    byKey.get(chain.key).push(chain)
  }
  const knownFor = (key, code) => KNOWN.find((item) => item.key === key && item.code === code)

  const items = templates.map((template) => {
    const keyChains = byKey.get(template.key) ?? []
    const analyzed = keyChains.map((chain) => {
      const required = chain.mode === 'full'
        ? union(template.content, template.suffix)
        : union(template.suffix, template.taskGuidance)
      const missing = required.filter((name) => !chain.injected.has(name))
      // `guidance` 链只跑 `renderPromptTaskGuidance`，整段正文根本不参与渲染 ——
      // 所以「正文缺」不是「注入集合里少几个名字」，而是正文全部没渲染。
      const rendersContent = chain.mode === 'full'
      const contentMissing = rendersContent
        ? template.content.filter((name) => !chain.injected.has(name))
        : [...template.content]
      return {
        file: chain.file,
        line: chain.line,
        via: chain.via,
        mode: chain.mode,
        injected: [...chain.injected].sort(),
        missing: missing.sort(),
        contentMissing,
      }
    })

    let code = 'ok'
    if (analyzed.length === 0) code = 'no-consumer'
    else if (analyzed.some((chain) => chain.missing.length > 0)) code = 'gap'
    else if (analyzed.some((chain) => chain.contentMissing.length > 0)) code = 'content-not-rendered'

    const known = code === 'ok' ? null : knownFor(template.key, code)
    return {
      key: template.key,
      code,
      known: Boolean(known),
      reason: known?.reason,
      declared: { content: template.content, suffix: template.suffix },
      chains: analyzed,
    }
  })
  return items
}

// ─── 输出 ──────────────────────────────────────────────────────────────────

function printReport({ templates, chains, methods, items, warnings }) {
  const byCode = (code) => items.filter((item) => item.code === code)
  const noConsumer = byCode('no-consumer')
  const info = byCode('content-not-rendered')
  const gaps = byCode('gap')
  const problems = [...noConsumer, ...info, ...gaps]
  const fresh = problems.filter((item) => !item.known)
  const unresolved = warnings.filter((warning) => warning.code === 'unresolved-key').length

  console.log(
    `prompt wiring: ${templates.length} 模板 / ${chains.length} 条链 / `
    + `缺口 ${problems.length} 条（已知 ${problems.length - fresh.length}，新增 ${fresh.length}）/ 未解析 ${unresolved} 处`,
  )

  const section = (title, rows) => {
    console.log(`\n[${title}]`)
    if (rows.length === 0) console.log('  （无）')
    for (const item of rows) {
      const chain = item.chains[0]
      const facts = []
      if (chain) facts.push(`${chain.file}:${chain.line} · ${chain.mode}`)
      if (chain?.missing.length) facts.push(`缺 ${chain.missing.join(', ')}`)
      if (item.code === 'content-not-rendered') facts.push(`正文 ${chain.contentMissing.length} 个占位符未渲染`)
      const head = facts.join(' · ')
      console.log(`  ${item.key.padEnd(40)}${head}${item.reason ? `${head ? ' — ' : ''}${item.reason}` : ''}`)
    }
  }
  section('no-consumer', noConsumer)
  section('info', info)
  section('gap', gaps)

  console.log('\n[ok]')
  const ok = byCode('ok')
  console.log(ok.length === 0 ? '  （无）' : `  ${ok.map((item) => item.key).join(', ')}`)

  console.log('\n[warnings]')
  if (warnings.length === 0) console.log('  （无）')
  for (const warning of warnings) {
    const where = warning.file ? `${warning.file}:${warning.line} · ` : ''
    console.log(`  ${warning.code} — ${where}${warning.detail}`)
  }

  const methodProbe = methods.table.size
  console.log(`\n[coverage]  （builder 方法表 ${methodProbe} 项 / 副作用 ${methods.sideEffects.length} 项）`)
  console.log(`  ${'key'.padEnd(40)}${'mode'.padEnd(10)}${'content'.padEnd(9)}suffix`)
  for (const item of items) {
    const modes = [...new Set(item.chains.map((chain) => chain.mode))]
    const mode = modes.length === 0 ? '—' : (modes.includes('full') ? 'full' : modes[0])
    const injected = new Set(item.chains.flatMap((chain) => chain.injected))
    // `guidance` 链不渲染正文：这一列写 0/N，否则「变量都注入了」会被读成「正文都渲染了」。
    const rendersContent = modes.includes('full')
    const coveredContent = rendersContent ? item.declared.content.filter((name) => injected.has(name)).length : 0
    const content = `${coveredContent}/${item.declared.content.length}`
    const suffix = `${item.declared.suffix.filter((name) => injected.has(name)).length}/${item.declared.suffix.length}`
    console.log(`  ${item.key.padEnd(40)}${mode.padEnd(10)}${content.padEnd(9)}${suffix}`)
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────────

function selfCheckFailure(detail, counts, limits) {
  console.error(
    `prompt wiring: 自检失败 —— 模板 ${counts.templates}/≥${limits.templates}，`
    + `链 ${counts.chains}/≥${limits.chains}，方法表 ${counts.methods}/≥${limits.methods}。\n`
    + `${detail}\n`
    + '这通常意味着：① 模板注册表换了导出名；② 注入写法换代（如改用具名参数对象）；③ 代码目录被移动。\n'
    + '先修脚本，不要相信下面的报告。',
  )
  process.exit(1)
}

async function main() {
  const argv = process.argv.slice(2)
  const flags = new Set(argv)
  const root = path.resolve(option(argv, '--root', process.cwd()))
  const limits = {
    templates: countOf(option(argv, '--min-templates', SELF_CHECK.minTemplates)),
    chains: countOf(option(argv, '--min-chains', SELF_CHECK.minChains)),
    methods: countOf(option(argv, '--min-methods', SELF_CHECK.minMethods)),
  }

  const methods = readMethodTable(root)
  const registry = await loadRegistry(root)
  const templates = readTemplates(registry)
  const discovered = discoverChains(root)
  const indirect = analyzeIndirectChains(root, methods)

  const chains = []
  const warnings = [...discovered.warnings, ...indirect.warnings]
  for (const chain of [...discovered.chains, ...indirect.chains]) {
    const windowNode = chain.node ? enclosingFunctionWithBody(chain.node) : null
    if (chain.via === 'indirect-table') {
      chains.push(chain)
      continue
    }
    if (!windowNode) {
      warnings.push({ code: 'unresolved-window', file: chain.file, line: chain.line, detail: chain.key })
      continue
    }
    const analysis = analyzeWindow(windowNode, methods)
    warnings.push(...analysis.warnings.map((warning) => ({ ...warning, file: chain.file, line: chain.line, detail: `${chain.key} · ${warning.detail}` })))
    chains.push({ key: chain.key, file: chain.file, line: chain.line, via: chain.via, injected: analysis.injected, mode: analysis.mode })
  }
  chains.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)

  // 交叉校验：`promptKeys: [...]` 只用来确认「声明过的 key 至少有一条链」，不作主信号。
  const crossChecked = new Set(chains.map((chain) => chain.key))
  const declaredKeys = new Set(templates.map((template) => template.key))
  for (const file of collectSourceFiles(path.join(root, 'src'))) {
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(/promptKeys:\s*\[([^\]]*)\]/g)) {
      for (const keyMatch of match[1].matchAll(/'([a-z0-9_]+)'/g)) {
        if (declaredKeys.has(keyMatch[1]) && !crossChecked.has(keyMatch[1])) {
          warnings.push({
            code: 'prompt-key-without-chain',
            file: toPosix(path.relative(root, file)),
            line: text.slice(0, match.index).split('\n').length,
            detail: keyMatch[1],
          })
        }
      }
    }
  }

  const counts = { templates: templates.length, chains: chains.length, methods: methods.table.size }
  if (counts.templates < limits.templates || counts.chains < limits.chains || counts.methods < limits.methods) {
    selfCheckFailure(
      `阈值：模板 ≥${limits.templates}、链 ≥${limits.chains}、方法表 ≥${limits.methods}`
      + `${limits.templates === SELF_CHECK.minTemplates ? '' : '（--min-* 覆盖，仅供 fixture 测试）'}`,
      counts,
      limits,
    )
  }

  const items = evaluate(templates, chains)
  const summary = {
    templates: templates.length,
    chains: chains.length,
    methods: methods.table.size,
    gap: items.filter((item) => item.code === 'gap').length,
    known: items.filter((item) => item.known).length,
    noConsumer: items.filter((item) => item.code === 'no-consumer').length,
    info: items.filter((item) => item.code === 'content-not-rendered').length,
    unresolved: warnings.filter((warning) => warning.code === 'unresolved-key').length,
  }

  if (flags.has('--json')) {
    console.log(JSON.stringify({ root, templates: templates.length, chains: chains.length, summary, items, warnings }, null, 2))
  } else {
    printReport({ templates, chains, methods, items, warnings })
  }

  const fresh = items.filter((item) => !item.known && item.code !== 'ok')
  const blocked = fresh.length > 0 || summary.unresolved > 0
  if (flags.has('--strict') && blocked) process.exit(1)
  process.exit(0)
}

await main()
