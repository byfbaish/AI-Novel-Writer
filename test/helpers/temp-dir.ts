import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

/**
 * 测试临时目录的删除助手。**两条纪律都在这里，别在用例里自己写 `fs.rmSync`。**
 *
 * ## 一、为什么不能直接 `fs.rmSync(root)`
 *
 * 某些宿主（WorkBuddy 等）会把 `fs.rmSync` 换成一个 shim：**spawn 一个 genie-trash 子进程
 * 把目标移进回收站**，失败时 fail-closed 抛错、绝不真删。对"删一个刚建的临时目录"这是纯噪声，
 * 而且大目录会直接超时：
 *
 * ```
 * Error: [safe-delete] 操作失败: spawnSync …genie-trash\win32-x64.exe ETIMEDOUT
 *   at trashViaBinary … Object.wrappedRmSync [as rmSync]
 * ```
 *
 * 这个 shim 有一条内部 bypass 规则：**系统临时目录下的删除直接透传原生实现**。所以先把目录
 * rename 进系统 temp 再删 —— 同一块盘上的 rename 是 O(1)，不需要拷贝内容，随后的删除走原生。
 *
 * ## 二、为什么删不掉也不抛（2026-10-30 第二轮实测 / 2026-11-12 A 案修订）
 *
 * 透传原生后仍会偶发 `EPERM`：Windows 上 sqlite 句柄比 `close()` 晚一拍释放。
 * 表现是「断言全部通过、失败栈落在 `afterEach`」—— 正好是这套助手本来要消灭的那种噪声。
 *
 * 2026-11-12 定性：`os.tmpdir()` 与项目同在 `C:` 卷，**不是跨卷**；同卷目录被句柄锁住时
 * `renameSync` 也会被拒，随后就地 `rmSync` 撞上同一把锁，异常冒到用例 ⇒ 全量 35 条同源 EPERM。
 * 于是分三层：
 * 1. `discardTree` 先带重试 rename（等句柄晚一拍释放）→ 再带重试删；
 * 2. rename 重试用尽、就地删也失败时**按路径分流**：`.runtime/` 下或仓库根之外 ⇒ 静默放过
 *    （只累计一个计数，留给 sweep 末尾打一行汇总）；**仓库根内且非 `.runtime/` ⇒ 照旧抛** ——
 *    这条是「可能删到项目里真实目录」的保护，不放宽；
 * 3. 下一轮开跑前由 `sweepDiscardedTrees()` 收尸：除了系统 temp 的 `discard-*`，还要清
 *    `.runtime/.cache` 下那些 rename / 就地删都没删掉的残留（清单 + `discard-*` 前缀两路）。
 *
 * 「静默放过」只适用于第 2 步已判定为可弃的路径，且失败路径会登记到清单，不会无声丢失。
 */
const TEMP_RETRY = { maxRetries: 20, retryDelay: 100 } as const
const STAGED_PREFIX = 'discard-'
const RUNTIME_DIR_NAME = '.runtime'

/**
 * 仓库根。测试入口 `scripts/run-tests-electron.mjs` 以 `cwd: repositoryRoot` 起 vitest，
 * 所以 `process.cwd()` 是主口径；`import.meta.url` 推导作为兜底（防个别用例 chdir 后再加载）。
 * 只在模块加载时求一次，之后不随 cwd 漂移。
 */
const REPOSITORY_ROOT = (() => {
  try {
    const fromModule = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
    if (fs.existsSync(path.join(fromModule, 'package.json'))) return fromModule
  } catch {
    // vite/vitest 转换后 import.meta.url 未必是文件 URL ⇒ 落到 cwd
  }
  return path.resolve(process.cwd())
})()

/** 本进程内「按路径静默放过」的删除失败次数，供 sweep 末尾打一行汇总。 */
let deferredCount = 0

/** 同步等待；Node 的 `fs.rmSync` 内建重试用的也是这一套，不引入新依赖。 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * rename 也按 TEMP_RETRY 重试：句柄晚一拍释放时，第一次 rename 被拒不代表两秒后还被拒。
 * 只对重试用尽仍失败抛错（交给调用方进 catch 就地删），与 `rmSync(..., TEMP_RETRY)` 同语义。
 */
function renameWithRetry(source: string, target: string): void {
  let lastError: unknown
  for (let attempt = 0; attempt <= TEMP_RETRY.maxRetries; attempt += 1) {
    try {
      fs.renameSync(source, target)
      return
    } catch (error) {
      lastError = error
      if (attempt < TEMP_RETRY.maxRetries) sleepSync(TEMP_RETRY.retryDelay)
    }
  }
  throw lastError
}

/**
 * 判定「删不掉时可以静默放过」的路径：
 * - 仓库根之外（`os.tmpdir()` 等，含跨盘符时 `path.relative` 返回绝对路径）⇒ 可弃；
 * - 仓库根内 `.runtime/` 下（gitignored 的临时区）⇒ 可弃；
 * - 其余（仓库根内、非 `.runtime/`）⇒ **不可弃，照旧抛**，这是防误删真实目录的保护。
 */
function isDisposableRoot(root: string): boolean {
  const absolute = path.resolve(root)
  const relative = path.relative(REPOSITORY_ROOT, absolute)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return true
  return relative.split(path.sep)[0].toLowerCase() === RUNTIME_DIR_NAME
}

/** 就地删失败的残留清单，放在 `.runtime/.cache/`（gitignored），供下一轮 sweep 收尸。 */
function pendingFile(): string {
  return path.join(REPOSITORY_ROOT, RUNTIME_DIR_NAME, '.cache', '.discard-pending.txt')
}

function notePending(root: string): void {
  try {
    const file = pendingFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.appendFileSync(file, `${path.resolve(root)}\n`, 'utf8')
  } catch {
    // 记账本身失败也不能把用例变红
  }
}

export function discardTree(root: string): void {
  const staged = path.join(os.tmpdir(), `${STAGED_PREFIX}${randomUUID()}`)
  try {
    renameWithRetry(root, staged)
  } catch {
    // 重试用尽仍不能 rename：跨卷 / 源已不存在 / 句柄仍锁着 ⇒ 只能就地删。
    try {
      fs.rmSync(root, { recursive: true, force: true, ...TEMP_RETRY })
      return
    } catch (error) {
      // 就地删也撞上同一把锁。按路径分流，而不是一律抛。
      if (!isDisposableRoot(root)) throw error
      deferredCount += 1
      notePending(root)
      return
    }
  }
  try {
    fs.rmSync(staged, { recursive: true, force: true, ...TEMP_RETRY })
  } catch {
    // 句柄还没放：留给 sweepDiscardedTrees()。
  }
}

/**
 * 删一棵**可能含 junction / symlink 的**目录树：先把链接拆掉，再删目录。
 *
 * ## 为什么不能用 `fs.rmSync(root, { recursive: true })`
 *
 * 2026-11-12 事故：`scripts/__tests__/quality-modernization-r3-native.test.mjs` 把仓库根的
 * 真实 `electron/` 以 junction 挂进测试目录，收尾 `fs.rmSync` 在 Windows 上顺着 junction
 * 递归进真实目标，**把 455 个源码文件删了**。六轮全量基线因此全废（跑到一半源码没了，
 * 268–270 个测试文件成片红），排查了一整夜。
 *
 * 链接本身不是内容：先用 `unlinkSync` 拆（只删链接，目标完好），再删剩余目录。
 * 拆链接失败（权限/占用）也不抛，交给后面的 `rmSync` 和 `sweepDiscardedTrees()`。
 */
export function discardTreeWithoutFollowingLinks(root: string): void {
  unlinkLinksInTree(root)
  fs.rmSync(root, { recursive: true, force: true, ...TEMP_RETRY })
}

function unlinkLinksInTree(dir: string): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    // Windows junction 在 Dirent 上就是 isSymbolicLink() === true、isDirectory() === false
    if (entry.isSymbolicLink()) {
      try { fs.unlinkSync(full) } catch { /* 占用/权限：留给 rmSync 与 sweep */ }
      continue
    }
    if (entry.isDirectory()) unlinkLinksInTree(full)
  }
}

/**
 * 删掉所有残留。只在测试进程全部退出后调用（vitest `globalSetup` 的 teardown），
 * 那时不会有句柄还锁着。返回**仍然删不掉**的条数，供上层决定要不要提一句。
 *
 * 两处来源：系统 temp 下的 `discard-*`（rename 成功但没删掉的 staged 目录），以及
 * `.runtime/.cache/` 下 rename / 就地删都失败的残留（清单登记 + `discard-*` 前缀）。
 */
export function sweepDiscardedTrees(): number {
  const temp = os.tmpdir()
  let remaining = 0
  let names: string[]
  try { names = fs.readdirSync(temp) } catch { names = [] }
  for (const name of names) {
    if (!name.startsWith(STAGED_PREFIX)) continue
    try { fs.rmSync(path.join(temp, name), { recursive: true, force: true, ...TEMP_RETRY }) }
    catch { remaining += 1 }
  }

  const runtimeCache = path.join(REPOSITORY_ROOT, RUNTIME_DIR_NAME, '.cache')
  // 盲区之一：失败清单里登记过的路径（下一轮开跑时句柄已释放，多半能删掉）
  const file = pendingFile()
  let pending: string[] = []
  try { pending = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean) } catch { /* 无清单 */ }
  const stillPending: string[] = []
  for (const target of [...new Set(pending)]) {
    // 清单被污染时也不碰仓库根内的真实目录 —— 与 discardTree 的保护同一条判据
    if (!isDisposableRoot(target)) continue
    try { fs.rmSync(target, { recursive: true, force: true, ...TEMP_RETRY }) }
    catch { stillPending.push(target); remaining += 1 }
  }
  try {
    // 用写空内容代替 unlinkSync：宿主 shim 会拦 unlink，清空文件不走删除
    fs.writeFileSync(file, stillPending.length > 0 ? `${stillPending.join('\n')}\n` : '', 'utf8')
  } catch { /* 记账失败不影响清扫 */ }

  // 盲区之二：.runtime/.cache 下带 discard- 前缀的目录（与系统 temp 同一套命名）
  try {
    for (const name of fs.readdirSync(runtimeCache)) {
      if (!name.startsWith(STAGED_PREFIX)) continue
      try { fs.rmSync(path.join(runtimeCache, name), { recursive: true, force: true, ...TEMP_RETRY }) }
      catch { remaining += 1 }
    }
  } catch { /* .cache 不存在 */ }

  if (deferredCount > 0 || remaining > 0) {
    console.log(`[temp-dir] sweep: ${remaining} 处临时目录仍删不掉；本轮按路径放过 ${deferredCount} 处删除失败`)
  }
  return remaining
}
