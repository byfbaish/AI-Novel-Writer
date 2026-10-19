// 沙箱内的 vitest 运行器（本机默认 pool 会 spawn EPERM，改用 threads + 不加载 vite.config）
// 用法：node .tmp-run-tests.mjs <test-file> [...]
import { startVitest } from 'vitest/node'
const files = process.argv.slice(2)
if (files.length === 0) { console.error('no test files'); process.exit(2) }
const vitest = await startVitest('test', files, {
  run: true, watch: false, config: false, reporters: ['default'],
  pool: 'threads', fileParallelism: false,
})
if (!vitest) { console.error('vitest failed to start'); process.exit(2) }
const failed = vitest.state.getCountOfFailedTests?.() ?? -1
const files_ = vitest.state.getFiles?.() ?? []
let collected = 0
for (const f of files_) collected += (f.tasks ?? []).reduce((n, t) => n + (t.type === 'test' ? 1 : (t.tasks?.length ?? 0)), 0)
await vitest.close()
console.log('RESULT collected=' + collected + ' failed=' + failed)
process.exit(failed > 0 || collected === 0 ? 1 : 0)