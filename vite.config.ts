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
// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  applyDevEnvironmentFixes(command)
  return {
  // BrowserWindow.loadFile() serves the renderer through file://.  Keep public
  // and bundled asset URLs relative to dist/ rather than the filesystem root.
  base: './',
  plugins: [tailwindcss(), react(), electron({
    main: {
      // Shortcut of `build.lib.entry`.
      entry: 'electron/main.ts',
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
    port: 5180,
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
