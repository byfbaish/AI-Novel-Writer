import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import electron from 'vite-plugin-electron/simple';
import electronRenderer from 'vite-plugin-electron-renderer';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

// ESM 中不存在 __dirname，需要用 import.meta.url 来模拟
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 从 package.json 读取版本号，构建时注入到前端
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Local fork: two dev-only environment fixes. Both run before Electron is
// spawned, so the child process inherits the corrected environment.
//   1. ELECTRON_RUN_AS_NODE makes electron.exe boot as plain Node: no Chromium,
//      no built-in modules, and `import { app } from 'electron'` dies on load.
//   2. The installed release owns %APPDATA%/ai-novel-writer as its Electron
//      userData. The global data root defaults to the same path, and the
//      startup self-check rejects any intersection with GLOBAL_ROOT_INTERSECTION.
// Neither touches build output; `serve` is the only affected command.
function applyDevEnvironmentFixes(command: string): void {
  if (command !== 'serve') return
  delete process.env.ELECTRON_RUN_AS_NODE
  process.env.AI_NOVEL_APP_DATA_HOME ??= path.join(os.homedir(), '.ai-novel-writer-dev')
}

// Parallel-worktree isolation: one hard-coded slot per checkout.
//   slot 1 / 2  ->  sibling git worktrees (../wt-1, ../wt-2), each needs its own
//                   dev-server port, CDP port and Chromium profile.  The profile
//                   matters as much as the ports: Electron's single-instance lock
//                   and the sqlite/project runtime both key off `userData`, so two
//                   instances sharing it would evict each other.
// Slot 0 (unset) is the historical default and keeps every value unchanged.
const WORKTREE_SLOTS = {
  '1': { devServerPort: 5181, cdpPort: 9223 },
  '2': { devServerPort: 5182, cdpPort: 9224 },
} as const

type WorktreeSlot = { devServerPort: number; cdpPort?: number; userDataDir?: string }

function resolveWorktreeSlot(): WorktreeSlot {
  const raw = process.env.AI_NOVEL_WORKTREE_SLOT?.trim()
  if (!raw) return { devServerPort: 5180 }
  const slot = WORKTREE_SLOTS[raw as keyof typeof WORKTREE_SLOTS]
  if (!slot) {
    throw new Error(`AI_NOVEL_WORKTREE_SLOT must be ${Object.keys(WORKTREE_SLOTS).join(' or ')}, received "${raw}"`)
  }
  return {
    devServerPort: slot.devServerPort,
    cdpPort: slot.cdpPort,
    // `.runtime/` is gitignored, so the profile never leaks into the checkout.
    userDataDir: path.join(__dirname, '.runtime', 'worktree', `slot-${raw}`, 'user-data'),
  }
}
// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  applyDevEnvironmentFixes(command)
  const slot = resolveWorktreeSlot()
  // AI_NOVEL_UI_DEBUG_PORT stays the explicit override; the slot only supplies a default.
  const debugPort = process.env.AI_NOVEL_UI_DEBUG_PORT?.trim() || slot.cdpPort
  const startupArgs = [
    '.',
    '--no-sandbox',
    ...(debugPort ? [`--remote-debugging-port=${debugPort}`] : []),
    ...(slot.userDataDir ? [`--user-data-dir=${slot.userDataDir}`] : []),
  ]
  return {
  // BrowserWindow.loadFile() serves the renderer through file://.  Keep public
  // and bundled asset URLs relative to dist/ rather than the filesystem root.
  base: './',
  plugins: [tailwindcss(), react(), electron({
    main: {
      // Shortcut of `build.lib.entry`.
      entry: 'electron/main.ts',
      // 仅 `vite serve` 生效：CDP 端口与 worktree profile 从常量表推导，
      // 未设置 `AI_NOVEL_WORKTREE_SLOT` 且未设置 `AI_NOVEL_UI_DEBUG_PORT` 时行为完全不变。
      onstart: debugPort || slot.userDataDir
        ? ({ startup }) => startup(startupArgs)
        : undefined,
      vite: {
        build: {
          // 强制输出 CommonJS，保证 better-sqlite3 等 native 模块能正常加载
          rollupOptions: {
            external: ['better-sqlite3', '@lancedb/lancedb', 'yauzl'],
            output: {
              format: 'cjs'
            }
          }
        }
      }
    },
    preload: {
      // Shortcut of `build.rollupOptions.input`.
      // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
      input: path.join(__dirname, 'electron/preload.ts')
    }
  }), process.env.NODE_ENV !== 'test' && electronRenderer()],
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: slot.devServerPort,
    strictPort: true,
    watch: {
      ignored: ['**/docs/**']
    }
  },
  define: {
    // 构建时将 package.json 版本注入为全局常量，避免 StatusBar 硬编码版本号
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{ts,tsx}']
  },
  test: {
    // Test copy must not follow the operating-system locale of a CI runner.
    setupFiles: ['test/setup-locale.ts'],
    // 整轮只跑一次（不是每个文件一次）：给 discardTree 留在系统 temp 里的目录收尸。
    // 为什么要单独一个钩子：用例的 afterEach 删不掉是因为 sqlite 句柄还没释放，
    // 而这里所有 worker 都已退出，句柄全没了。细节见 test/helpers/temp-dir.ts 顶部注释。
    // 开跑前扫一次上一轮 discardTree 的残留（**不挂 teardown**，理由见文件内注释）。
    globalSetup: ['test/global-setup.ts'],
    // 本项目大量用例要建**真** SQLite（跑完 26 版迁移）再深拷贝目录，默认的 5s/10s 上限
    // 在并行跑全量时会稳定撞 `Test timed out in 5000ms` / `Hook timed out in 10000ms`，
    // 而这些用例单跑全过 —— 那是机器负载，不是缺陷信号。
    // 2026-10-30 清理既有红时实测：并行时单文件测试总耗时能被放大到 11 倍（wall 156s / cpu 1692s），
    // 所以这里放宽默认值，个别确实更慢的用例再在文件里覆盖。
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // 这台机器 20 逻辑核，vitest 默认会起 ~19 个 worker；而这里绝大多数用例是**真磁盘**作业
    // （跑完 26 版迁移建库、再深拷贝目录），并行度一高就是磁盘饱和 —— 实测单文件耗时可放大到 11 倍
    // （wall 166s / tests 1746s），然后每次全量都在**不同**文件上冒 1–2 例超时。
    // 限到四分之一（20 核 ⇒ 5 个 worker）：全量从 ~2.7 分钟变 ~5 分钟，换来稳定的 0 失败。
    // 这是"用时间买确定性"—— 反复调查假回归比多跑几分钟贵得多。
    maxWorkers: '25%',
    // 本地历史 worktree 和 pnpm 缓存可能包含旧版本测试；它们不是当前项目源码。
    exclude: [
      ...configDefaults.exclude,
      '**/.worktrees/**',
      '**/.pnpm-store/**',
      '**/.workbuddy/**',
      '**/.runtime/**',
      '**/plugins/**',
      // Frozen planning scripts retain their standalone Node entrypoints.
      // quality-modernization-run.test.mjs executes their assertions explicitly.
      '**/docs/plans/**',
      '**/.release/scripts/release-artifact-retention.test.mjs',
    ],
  },
  build: {
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        // 过滤掉已知的无害警告
        if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return;
        if (warning.message?.includes('Invalid key')) return;
        defaultHandler(warning);
      }
    }
  }
  };
});
