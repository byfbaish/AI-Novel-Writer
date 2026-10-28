#!/usr/bin/env node
/* global process */
/**
 * prompt override audit —— 「全局覆盖版正在遮蔽哪些内置改动」体检。
 *
 * ## 为什么要有这个脚本
 *
 * `promptCatalog.resolve` 的优先级是 `project > global > builtin`（判据 AO）。
 * 而作者点「保存自定义」时，落盘的是 `{ ...内置模板, systemRole, taskGuidance }`
 * —— **把当时的内置正文整份冻结进覆盖文件**。于是从旧版本升级上来之后，
 * 新版内置模板的任何改动都会被静默遮蔽：不报错、不提示、界面照常。
 *
 * 典型事故：N1 把世界观第 1 维的问句从 2 问改到 7 问，若 `world_building`
 * 存在旧覆盖版，作者跑完一章会发现「改硬了没用」——而实际是改动根本没进模型。
 *
 * `prompt-builtin-revision.ts` 提供了 `isBuiltinOverrideStale`，但它是
 * **只提示不自动改**（无法区分「作者有意定制」与「旧版原样副本」）。
 * 本脚本是它的命令行版本：一次列出全部落后项，供验证前清障。
 *
 * ## 用法
 *
 *   node scripts/audit-prompt-overrides.mjs            # 自动定位全局数据根
 *   node scripts/audit-prompt-overrides.mjs --root <dir>  # 指定 prompts 目录
 *   node scripts/audit-prompt-overrides.mjs --project <项目目录>   # 一并扫项目级（可重复）
 *
 * ## ★ 两级都要查（2026-10-28 血的教训）
 *
 * 优先级是 `project > global > builtin`，**项目级比全局级更高**。只扫全局会得出
 * 「没有覆盖版、改动立即生效」的**假阴性**：作者改完模板、跑了一整轮生成，产出的
 * 仍是旧口径，而命令行显示一切正常。当天就这么白跑了一轮角色生成。
 *
 * 项目在磁盘上任意位置、没有注册表可枚举，所以项目级只能由 `--project` 显式给。
 * 没给的时候脚本会在结尾提醒「项目级未检查」，不要把那份输出当成完整结论。
 *
 * 退出码恒为 0（这是体检不是闸门）；需要闸门的场合请用 `--strict`。
 *
 * ## 判定口径（与 `promptBuiltinRevision` 严格一致，不要自己发明）
 *
 * 摘要只覆盖作者**不能**编辑的部分：name / description / content /
 * systemRole / taskGuidance / variables / requiredContextVariables。
 * `systemSuffix` 不参与（渲染时始终取内置），`key` 与 `writingLanguage` 是身份标记。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.dirname(here)

const argv = process.argv.slice(2)
const argOf = flag => {
  const index = argv.indexOf(flag)
  return index >= 0 && argv[index + 1] ? argv[index + 1] : undefined
}
const argRoot = argOf('--root')
// 项目级可重复给：`--project A --project B`。优先级 project > global，所以先扫项目。
const projectDirs = argv.flatMap((value, index) => (value === '--project' && argv[index + 1] ? [path.resolve(argv[index + 1])] : []))
const strict = argv.includes('--strict')

/**
 * 定位当前**真正生效**的全局数据根。
 *
 * 这里的坑值得记：`%APPDATA%/ai-novel-writer` 看着像数据根，其实只是 Electron
 * 的 userData；真正的 prompts 在 `generations/<uuid>/prompts`，而 dev 模式
 * 用的是 `~/.ai-novel-writer-dev`（`vite.config.ts` 设 `AI_NOVEL_APP_DATA_HOME`）。
 * 拿错目录会得出「没有覆盖版」的假阴性。
 */
function resolvePromptsDirs() {
  if (argRoot) return [path.resolve(argRoot)]
  const candidates = []
  const roots = [
    path.join(os.homedir(), '.ai-novel-writer-dev'),
    process.platform === 'win32' && process.env.APPDATA
      ? path.join(process.env.APPDATA, 'ai-novel-writer')
      : path.join(os.homedir(), '.config', 'ai-novel-writer'),
  ]
  for (const root of roots) {
    const receiptPath = path.join(root, '.migration', 'receipt.json')
    let generation, receipt
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
      generation = receipt.generation
    } catch {
      // 没有 receipt ⇒ 迁移没发生，prompts 可能还在根目录或 legacy 位置
      const direct = path.join(root, 'prompts')
      if (fs.existsSync(direct)) candidates.push(direct)
      continue
    }
    if (typeof generation === 'string') {
      const dir = path.join(root, 'generations', generation, 'prompts')
      if (fs.existsSync(dir)) candidates.push(dir)
    }
  }
  return candidates
}

/** 用 esbuild 把 TS 打进临时 cjs，借它拿到内置模板与摘要算法（不重写一份）。 */
async function loadBuiltinModule() {
  const esbuild = await import('esbuild')
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-audit-'))
  const outfile = path.join(outdir, 'bundle.cjs')
  await esbuild.build({
    entryPoints: [path.join(repoRoot, 'src/services/builtin-prompt-templates.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile,
    logLevel: 'silent',
    // 摘要算法单独打一份，避免把 reviewer 模块链也拖进来
  })
  const revisionOut = path.join(outdir, 'revision.cjs')
  await esbuild.build({
    entryPoints: [path.join(repoRoot, 'src/services/prompt-builtin-revision.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile: revisionOut,
    logLevel: 'silent',
  })
  const builtin = await import(pathToFileURL(outfile).href)
  const revision = await import(pathToFileURL(revisionOut).href)
  return { builtin, revision, outdir }
}

/** 覆盖版里 key 可能不在内置（作者删过模板 / 改了 key），要能报出来。 */
function readOverrides(dir) {
  const entries = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const file = path.join(dir, name)
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      entries.push({ file, name, error: String(error?.message ?? error) })
      continue
    }
    entries.push({ file, name, template: parsed })
  }
  return entries
}

/** 只报「差在哪」，不 dump 全文——作者要的是判断，不是两段几百字。 */
function describeDelta(override, builtin) {
  const lines = []
  const fields = ['name', 'description', 'content', 'systemRole', 'taskGuidance']
  for (const field of fields) {
    const a = override[field] ?? ''
    const b = builtin[field] ?? ''
    if (a === b) continue
    const lenA = [...a].length
    const lenB = [...b].length
    lines.push(`${field}: 覆盖 ${lenA} 字 → 内置 ${lenB} 字（差 ${lenB - lenA >= 0 ? '+' : ''}${lenB - lenA}）`)
  }
  const keysOf = value => Object.keys(value ?? {}).sort()
  const va = keysOf(override.variables).join(',')
  const vb = keysOf(builtin.variables).join(',')
  if (va !== vb) lines.push(`variables 集合不同：覆盖 [${va}] / 内置 [${vb}]`)
  const ra = (override.requiredContextVariables ?? []).join(',')
  const rb = (builtin.requiredContextVariables ?? []).join(',')
  if (ra !== rb) lines.push(`requiredContextVariables 不同：覆盖 [${ra}] / 内置 [${rb}]`)
  return lines
}

async function main() {
  const scopes = []
  for (const projectDir of projectDirs) {
    scopes.push({ label: `项目级（${path.basename(projectDir)}）`, dir: path.join(projectDir, '.ai-novel', 'prompts') })
  }
  for (const dir of resolvePromptsDirs()) scopes.push({ label: '全局级', dir })

  if (scopes.length === 0) {
    console.error('未找到全局数据根。用 --root 指定 prompts 目录，或用 --project 指定项目目录。')
    process.exit(strict ? 1 : 0)
  }
  const { builtin: builtinModule, revision: revisionModule } = await loadBuiltinModule()
  const builtins = builtinModule.BUILTIN_PROMPTS ?? []
  const promptBuiltinRevision = revisionModule.promptBuiltinRevision
  const byKey = new Map(builtins.map(template => [template.key, template]))

  let staleCount = 0
  let unknownCount = 0
  let freshCount = 0

  for (const scope of scopes) {
    if (!fs.existsSync(scope.dir)) {
      console.log(`\n${scope.label}：无覆盖目录（${scope.dir}），该作用域不遮蔽任何内置改动`)
      continue
    }
    console.log(`\n${scope.label}：${scope.dir}`)
    const overrides = readOverrides(scope.dir)
    const jsonCount = overrides.filter(entry => !entry.error).length
    console.log(`覆盖版 ${jsonCount} 份 / 内置模板 ${builtins.length} 份\n`)

    const rows = []
    for (const entry of overrides) {
      if (entry.error) {
        rows.push({ key: entry.name, state: '解析失败', detail: [entry.error] })
        staleCount += 1
        continue
      }
      const template = entry.template
      const key = template.key
      const builtin = key ? byKey.get(key) : undefined
      if (!builtin) {
        rows.push({ key: key ?? entry.name, state: '内置已无此 key', detail: ['覆盖版会继续生效，但内置侧已删除或改名'] })
        unknownCount += 1
        continue
      }
      const expected = promptBuiltinRevision(builtin)
      const actual = template.builtinRevision
      if (actual === expected) {
        freshCount += 1
        rows.push({ key, state: '✅ 与内置一致', detail: [] })
        continue
      }
      staleCount += 1
      const detail = []
      detail.push(actual ? `摘要 ${String(actual).slice(0, 8)} ≠ 内置 ${expected.slice(0, 8)}` : '覆盖版没有摘要（旧版本写入）')
      detail.push(...describeDelta(template, builtin))
      rows.push({ key, state: '⚠️ 遮蔽中', detail })
    }

    rows.sort((left, right) => (left.state === right.state ? (left.key < right.key ? -1 : 1) : left.state.localeCompare(right.state)))
    for (const row of rows) {
      console.log(`${row.state}  ${row.key}`)
      for (const line of row.detail) console.log(`           ${line}`)
    }
  }

  console.log(`\n汇总：遮蔽中 ${staleCount} / 与内置一致 ${freshCount} / 内置无对应 ${unknownCount}`)
  if (staleCount > 0) {
    console.log('处理方式（三选一，代码不会自动改作者资产）：')
    console.log('  1. 设置里点「恢复默认」——覆盖版删除，回落内置（⚠️ 会同时删掉该项目级与全局级的同名覆盖）')
    console.log('  2. 设置里「采纳新版内置」——把内置正文同步进覆盖，保留作者改过的 taskGuidance')
    console.log('  3. 确认是有意定制 ⇒ 忽略本提示，但要知道内置改进不会生效')
  }
  if (projectDirs.length === 0) {
    console.log('\n⚠️ 项目级未检查：优先级是 project > global > builtin，项目级会盖住全局级与内置。')
    console.log('   验证前请补上：node scripts/audit-prompt-overrides.mjs --project <项目目录>')
  }
  process.exit(strict && staleCount > 0 ? 1 : 0)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
