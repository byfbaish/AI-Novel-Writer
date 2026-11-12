# 2026-11-12 全量基线与两个根因

> 状态：已定稿（技术结论部分）；「脏树断言」一节为待核现象，不是结论。
> 授权：可改码、可提交，不推送。

## 结论先行

今天之前，全量测试**从来没有跑完过**。两个独立故障叠在一起：

1. **跑全量会删掉半个仓库**：`quality-modernization-r3-native.test.mjs` 把仓库根的 `electron/` 以 junction 挂进临时目录，收尾 `fs.rmSync(recursive)` 在 Windows 上顺着 junction 递归进真实目标，把 455 个源码文件删了。本轮之后，任何一轮跑到一半源码消失、成片 `Cannot find module …/electron/**` 都是它。
2. **跑到某个用例就永久挂死**：`package-contract.test.ts` 用 `spawnSync(process.execPath, ['scripts/require-release-gate.mjs'])` 并传一份手写的 env，`process.execPath` 此时是 electron.exe，env 里没有 `ELECTRON_RUN_AS_NODE`，于是走 GUI 模式、不退出，gpu-process/network-service 常驻。

两处都已修，全量现在能跑完、不删源码。修复后基线：**21 failed files / 642 收集 641，62 failed tests / 8621 passed，Errors 2，329.66s**。

## 提交

| 提交 | 内容 |
|---|---|
| `20d40cd9` | `test/helpers/temp-dir.ts` 新增 `discardTreeWithoutFollowingLinks()`（先递归 `unlink` 链接再 `rmSync`）；`quality-modernization-r3-native.test.mjs:871` 改用它；`package-contract.test.ts` 的 `bypassEnv` 补 `ELECTRON_RUN_AS_NODE: '1'` |
| `1ecbe568` | `electron/services/__tests__/main-generation-owner.test.ts:81` 收尾改用 `discardTree()`，消掉 22 条 `ENOTEMPTY` |

两笔都在本地 `exp/resource-ledger`，**未推送**。

## 一、删除源（P0）

机制与证据：

- `scripts/__tests__/quality-modernization-r3-native.test.mjs:611` `fs.symlinkSync(path.join(ROOT, 'electron'), path.join(adapter, 'electron'), 'junction')`，用例结束 `:870` `fs.rmSync(directory, { recursive: true, force: true })`。
- 一次性检出 `r3-probe` 上实测：跑前 `electron` 448 个 `.ts`、`porcelain=0`；单跑该文件 5.11s 后 `.ts=0`、`porcelain=455`。用 `-t` 只跑那一个用例，同样归零。把 `:611` 的 junction 列表里 `electron` 去掉后，`.ts=448`、`porcelain=0` —— 但那是拿覆盖换的，不采。
- 对照实验：单独 `fs.rmSync` 一个只含 junction 的临时目录，Node 只 unlink 链接、目标完好。所以不是「rmSync 一律跟随链接」，是这条用例的组合路径触发了顺链删除。
- 同型第二处：`scripts/__tests__/quality-modernization-planning-resume.test.mjs:32`（`['src','electron','node_modules','test']`）。它文件内没有任何 `rmSync` 清理，今天不会删东西；已立卡约束：将来谁给它加清理，必须用 `discardTreeWithoutFollowingLinks()`。

修复后验证：`r3-native` 单跑 `38 passed (38)`、`electron` 448 → 448、`porcelain` 不变。

## 二、挂死源

- `electron/__tests__/package-contract.test.ts:207-215` 的 `bypassEnv` 只有 PATH/SystemRoot/npm_lifecycle_event；`:212`/`:221` 用它 spawn `scripts/require-release-gate.mjs`。`process.execPath` 是 electron.exe ⇒ 缺 `ELECTRON_RUN_AS_NODE` ⇒ GUI 模式。
- 现象佐证：进程链 `electron.exe …vitest run` → worker → `electron.exe scripts/require-release-gate.mjs` → gpu-process + network-service，CPU 不动、日志零增长。今早 05:31 起的 night-probe 树卡在这里 7 小时 24 分；master 对照轮 12:33 也卡在同一处。
- 修复：`bypassEnv` 补 `ELECTRON_RUN_AS_NODE: '1'`。验收：该文件 `5 passed`、`Duration 861ms`、exit 0（此前挂死 7h24m）。
- 同类风险审计（`.batch/night/audit-execpath-env.mjs`）：52 个文件、182 处 `process.execPath`、45 处带 `env:` 字面量，逐条核完只有 `package-contract.test.ts` 一处真险；`release-win-verify.test.ts:601/:727`、`generate-cloud-build-manifest.test.ts:124` 都展开了 `process.env`，安全。

## 三、基线数字

| 轮次 | 日志 | Test Files | Tests | Errors | Duration |
|---|---|---|---|---|---|
| 修复前 | `reports/full-after-fix.log` | 27 failed \| 615 passed (642) | 114 failed \| 8578 passed \| 16 skipped (8708) | 48 | 444.25s |
| 修 ENOTEMPTY 后（develop） | `reports/full-after-enotempty.log` | 22 failed \| 620 passed (642) | 66 failed \| 8626 passed \| 16 skipped (8708) | 48 | 310.07s |
| 干净 worktree | `reports/full-after-enotempty-2.log` | 21 failed \| 620 passed (641) | 62 failed \| 8621 passed \| 15 skipped (8698) | 2 | 329.66s |

三轮 `electron` 都是 448 个 `.ts`、`porcelain electron/` 0 条，零删除。执行 `pnpm test` 等价于 `node scripts/run-tests-electron.mjs`（`pnpm test` 会先跑 install 预检，非 TTY 时可能报 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）。

## 四、残留失败（按文件归因）

21 个失败文件分四组：

- **`ENOTEMPTY` 7 条**（与已修的 8 处同类，是 Windows 句柄延迟，明早一起修）：`scripts/__tests__/quality-modernization-run.test.mjs:1292/1741/5086`、`scripts/__tests__/f05-a11-official-windows-driver.test.ts:12`、`scripts/__tests__/smoke-win-installer.test.ts:999/1023`。
- **`node:test` 套件被 vitest 误收**（报 `(0 test)`，仓库本有 `.node-test.mjs` 命名约定，这 6 个没跟上）：`scripts/task-board/test/{claims,cli,identity,mcp,ops,transport}.test.mjs`。
- **installer 类自造假包被 vite 扫到**（`Invalid package …app.asar`）：`smoke-win-installer.test.ts`、`verify-win-package.test.ts`、`f05-a11-official-windows-driver.test.ts` 一带。注意该项在修复前一轮是 48 个 unhandled，干净 worktree 里只剩 2 个 —— 与 `.runtime/cache` 里此前的残留有关，未坐实。
- **其余单点失败**：`electron/__tests__/summary-continuity-migration.test.ts`、`electron/mcp/__tests__/mcp-ipc-bridge.test.ts`、`electron/services/__tests__/{generation-source-binding,legacy-roster-generation,main-generation-owner}.test.ts`、`scripts/__tests__/{project-migration-acceptance,public-repository-hygiene,real-provider-generation-qualification,renderer-browser-qualification-contract,locale-shell.interaction,update-section.interaction}.test.ts`、`src/components/layout/__tests__/StatusBar.test.tsx`。

## 五、待核（现象，不作因果）

- **「干净 worktree 里那批断言为何也红」——未解释。** 已在 develop 与一次干净 worktree（`full-run`，HEAD `1ecbe568`，`node_modules` 为 junction）观察到同一批文件以同样方式失败。补充可查事实两条，均**不足以**构成结论：① 仓库里 `.batch/` 有 4 个文件是**已入库**的（`git ls-files .batch` 非空），所以任何 checkout 都带 `.batch/`，不是未跟踪残留；② `scripts/__tests__/public-repository-hygiene.test.ts` 的 `prohibitedPaths` 里含 `AGENTS.md`，而 `AGENTS.md` 按 ADR-0025 是入库的。这两条只是读代码得到的事实，是否即为失败原因需明早单独验证。
- **`641 vs 642`**：干净 worktree 只收集到 641 个测试文件，比 develop 少 1 个，缺的是哪个文件未定位。
- 上一轮 `Errors 48 → 2` 的差量同样未坐实。

## 复跑口径

```bash
git worktree add ../full-run --detach HEAD
cmd /c mklink /J "…\full-run\node_modules" "…\develop\node_modules"
cd ../full-run
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/run-tests-electron.mjs
# 收尾：先 cmd /c rmdir <worktree>\node_modules 拆 junction，再 git worktree remove --force
```

全量必须在隔离 worktree 里跑；带 junction 的目录在删除前一律先拆链接。
