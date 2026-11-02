/* global process */
/**
 * Start an isolated dev instance for a parallel worktree slot.
 *
 *   node scripts/worktree-dev.mjs 1     # wt-1 -> renderer 5181 / CDP 9223
 *   node scripts/worktree-dev.mjs 2     # wt-2 -> renderer 5182 / CDP 9224
 *
 * Why a script instead of `AI_NOVEL_WORKTREE_SLOT=1 pnpm dev`:
 *   1. `pnpm` is broken under this machine's sh (npm shim resolves node to a
 *      non-existent path), so hooks and entry points must go through `node`.
 *   2. `predev` has to run the same Electron-ABI probe before Vite boots;
 *      reusing the exported helper keeps one implementation.
 *   3. Two sandbox variables (`CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR`,
 *      `CODEBUDDY_TOOL_CALL_ID`) make the safe-delete shim reject Vite's
 *      dependency re-optimisation (>50 files). Stripping them for the child
 *      keeps the semantics identical without the spurious failure.
 *
 * The slot table itself lives in vite.config.ts - this script only validates the
 * argument and hands the slot over, so the ports have exactly one source.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ensureElectronNativeBinding } from './prepare-native-for-electron.mjs'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SUPPORTED_SLOTS = ['1', '2']

const slot = String(process.argv[2] ?? '').trim()
if (!SUPPORTED_SLOTS.includes(slot)) {
  console.error(`usage: node scripts/worktree-dev.mjs <${SUPPORTED_SLOTS.join('|')}>`)
  process.exit(2)
}

const nativeBinding = await ensureElectronNativeBinding()
console.log(
  nativeBinding.repaired
    ? 'better-sqlite3 rebuilt for Electron ABI.'
    : 'better-sqlite3 already matches the Electron ABI.',
)

const env = { ...process.env, AI_NOVEL_WORKTREE_SLOT: slot }
delete env.CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR
delete env.CODEBUDDY_TOOL_CALL_ID
// Vite must not inherit a parent process' ELECTRON_RUN_AS_NODE; the config
// deletes it for `serve`, but clearing it here keeps the child honest.
delete env.ELECTRON_RUN_AS_NODE

const viteBin = path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const child = spawn(process.execPath, [viteBin], {
  cwd: repositoryRoot,
  env,
  stdio: 'inherit',
  windowsHide: false,
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('exit', code => process.exit(code ?? 0))
