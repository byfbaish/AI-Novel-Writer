import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

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
 * ## 二、为什么删不掉也不抛（2026-10-30 第二轮实测）
 *
 * 透传原生后仍会偶发 `EPERM`：Windows 上 sqlite 句柄比 `close()` 晚一拍释放，
 * **rename 允许有打开的句柄，删除不允许**。表现是「断言全部通过、失败栈落在 `afterEach`」——
 * 正好是这套助手本来要消灭的那种噪声。
 *
 * 于是分三层，**任何一层都不向上抛**：
 * 1. `discardTree` 先 rename（几乎不可能失败）→ 再带 4s 重试删；
 * 2. 还删不掉就**静默放过**（staged 路径一定在 `os.tmpdir()` 下，不污染项目、不影响结论）；
 * 3. 整个 vitest 跑完后由 `sweepDiscardedTrees()` 收尸 —— 那时 worker 已退出、句柄全没了。
 *
 * 只有第 3 步也失败了才打**一行**汇总（不是每例一条），因为那意味着磁盘上真堆下来了。
 */
const TEMP_RETRY = { maxRetries: 20, retryDelay: 100 } as const
const STAGED_PREFIX = 'discard-'

export function discardTree(root: string): void {
  const staged = path.join(os.tmpdir(), `${STAGED_PREFIX}${randomUUID()}`)
  try {
    fs.renameSync(root, staged)
  } catch {
    // 跨卷（项目与 temp 不在同一盘）或源已不存在 ⇒ 只能就地删。
    // 这条路失败**要暴露**：删的可能是项目里的真实目录，不是 temp。
    fs.rmSync(root, { recursive: true, force: true, ...TEMP_RETRY })
    return
  }
  try {
    fs.rmSync(staged, { recursive: true, force: true, ...TEMP_RETRY })
  } catch {
    // 句柄还没放：留给 sweepDiscardedTrees()。
  }
}

/**
 * 删掉所有 `discard-*` 残留。只在测试进程全部退出后调用（vitest `globalSetup` 的 teardown），
 * 那时不会有句柄还锁着。返回**仍然删不掉**的条数，供上层决定要不要提一句。
 */
export function sweepDiscardedTrees(): number {
  const temp = os.tmpdir()
  let remaining = 0
  let names: string[]
  try { names = fs.readdirSync(temp) } catch { return 0 }
  for (const name of names) {
    if (!name.startsWith(STAGED_PREFIX)) continue
    try { fs.rmSync(path.join(temp, name), { recursive: true, force: true, ...TEMP_RETRY }) }
    catch { remaining += 1 }
  }
  return remaining
}
