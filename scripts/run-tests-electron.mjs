/* global process */
/**
 * 统一测试入口：用 Electron 的 Node 运行时跑 vitest。
 *
 * ## 为什么不能直接用 `vitest run`
 *
 * `better-sqlite3` 是原生模块，必须针对**某一个** NODE_MODULE_VERSION 编译。
 * 本工程有两个运行时：Node 22（ABI 127）与 Electron 41（ABI 145）。原先的做法是
 * 在两者间来回 `prepare:native-*` 切编译产物，代价三条：
 *
 * 1. **`pnpm dev` 开着就切不动**——Electron 进程持有 `better_sqlite3.node`，
 *    prebuild-install 直接报 `EBUSY: resource busy or locked`，测试起不来。
 * 2. 每次切换几十秒，且切完另一侧就坏，下一次 `pnpm dev` 还得再切回来。
 * 3. 切漏了不会立刻发现，而是跑测试时抛一个跟业务毫无关系的 ABI 报错，
 *    极易被误读成「刚改的代码把库弄坏了」。
 *
 * 改成固定走 Electron 运行时之后，**全工程只有一份 ABI**，`pnpm dev` 与 `pnpm test`
 * 可以同时跑：dev 用 Electron 进程、测试用 `ELECTRON_RUN_AS_NODE=1`（此时 Electron
 * 是纯 Node，不启动 Chromium），两者读同一个已编译产物，谁也不用改它。
 *
 * ## 用法
 *
 * ```
 * pnpm test                      # 全量
 * pnpm test src/shared           # 指定目录
 * pnpm test src/foo.test.ts -t 某用例
 * ```
 *
 * 参数原样透传给 vitest；只有本次没显式指定 run / watch 模式时，才补一个 `run`，
 * 这样 `pnpm test -- --watch` 这类用法不会被前缀破坏。
 *
 * 纯 Node 场景（不需要原生模块）仍可直接 `vitest run`，无需本脚本。
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronExecutable = require('electron')
const vitestEntry = path.join(repositoryRoot, 'node_modules', 'vitest', 'vitest.mjs')

const forwarded = process.argv.slice(2)
const explicitMode = forwarded.some(argument => argument === 'run' || argument === 'watch' || argument === '--watch')
const vitestArguments = explicitMode ? forwarded : ['run', ...forwarded]

const result = spawnSync(electronExecutable, [vitestEntry, ...vitestArguments], {
  cwd: repositoryRoot,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  windowsHide: true,
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
