# process.execPath 自定义 env 审计（只读扫描）

- 时间：2026-11-12 13:07
- 扫描器：`.batch/night/audit-execpath-env.mjs`（启发式：取 `process.execPath` 前 400 / 后 1200 字符，识别 spawn 家族调用与 `env:` 字面量，判断是否含 `process.env` 或 `ELECTRON_RUN_AS_NODE`）
- 覆盖：仓库内 `.ts/.tsx/.mjs/.cjs/.js`，跳过 `node_modules/.git/.batch/.runtime/.vite/dist/out/build/release`

## 总量

| 项 | 数 |
|---|---|
| 含 `process.execPath` 的文件 | 52 |
| `process.execPath` 出现点 | 182 |
| 其中带 `env:` 字面量 | 45 |
| env 含 `process.env` 展开或显式注入该变量（安全） | 36 |
| 未见 `env:`（继承父进程，安全） | 84 |

## 命中「env 字面量且无继承」的 9 处，逐条核过

| 位置 | 判定 | 依据 |
|---|---|---|
| `electron/__tests__/package-contract.test.ts:211-216` | **已修** | 本次在 `bypassEnv` 补 `ELECTRON_RUN_AS_NODE: '1'`，:216 与 :225 两处 spawn 都继承 |
| `electron/__tests__/package-contract.test.ts:225` | 同一修复覆盖 | `{ ...bypassEnv, AI_NOVEL_RELEASE_GATE }` |
| `plugins/.../qualification.spec.ts:355` | 误报 | 命中文本是 `expect.stringContaining(...)`，不是 spawn options |
| `plugins/.../qualification.spec.ts:365` | 误报 | 同上 |
| `scripts/task-board/test/cli.test.mjs:31` | 误报 | 命中 `{ stdout += chunk }`，非 env |
| `scripts/__tests__/generate-cloud-build-manifest.test.ts:122` | 安全 | `environmentWithOverrides(process.env, {...})` 基于 `process.env`，继承该变量 |
| `scripts/__tests__/release-win-verify.test.ts:601` | 安全 | `isolatedEnvironment` = `Object.entries(process.env)` 过滤 `node_options/temp/tmp` 三项，不含该变量过滤 ⇒ 继承 |
| `scripts/__tests__/release-win-verify.test.ts:727` | 安全 | 同上（另带 `timeout: 5_000`） |
| `scripts/__tests__/windows-cloud-build-workflow.test.ts:288` | 误报 | 命中 YAML 文本 `{{ runner.temp }}` |

**结论：除已修的 `package-contract.test.ts` 外，无第二处「自定义最小 env 且丢掉 ELECTRON_RUN_AS_NODE」的 spawn。**

## 反向情况（有意为之，未改）

- `vite.config.ts:28`、`scripts/worktree-dev.mjs:49`、`scripts/renderer-surface-e2e.mjs:754` 及一批 `scripts/f05-*-journey.mjs`：主动 `delete env.ELECTRON_RUN_AS_NODE`，目的是用**真 GUI** 跑 Electron（它们就是 GUI 用例），不要当 bug 修。
- `scripts/quality-modernization-run.mjs:386`：`electronRunAsNode ? '1' : ''`——空串在 Electron 里等同未设 ⇒ 走 GUI，同样是显式选择。
- `scripts/quality-modernization-driver.mjs:1135`：`{ executable: process.execPath, electronRunAsNode: false }`，显式 GUI 分支。

## 验收

`node scripts/run-tests-electron.mjs electron/__tests__/package-contract.test.ts`
→ `Test Files 1 passed (1)`、`Tests 5 passed (5)`、`Duration 861ms`、墙钟 1.59s、exit 0。
（此前该文件在全量与 master 对照轮里都卡死在同一处，night-probe 那棵树活了 7 小时 24 分。）

> 注：`pnpm test` 走 `pnpm install` 预检时会因 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 提前退出，本次验收直接调用 `scripts/run-tests-electron.mjs`（与 `package.json` 的 `test` 脚本等价）。
