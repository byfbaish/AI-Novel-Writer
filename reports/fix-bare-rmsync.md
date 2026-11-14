结论：PASS ｜ 产物：C:\develop\workspace\AI-writer\develop\reports\fix-bare-rmsync.md ｜ 判定线：两个文件单跑 EPERM 均为 0 ｜ 证据：project-migration-acceptance「Test Files  1 passed (1)」「Tests  8 passed (8)」EPERM=0；real-provider-generation-qualification「Test Files  1 passed (1)」「Tests  16 passed (16)」EPERM=0

# WB-H3 · 用例自身裸 `rmSync` 收口 · 验收报告

- **本轮授权：可改码 + 可提交（不推送）**；时间盒 10 分钟，22:34 派活 → 22:40 收口。
- 分支 `exp/resource-ledger`｜基线 HEAD `bc5ab681`｜本卡提交 `a960d709`（**未推送**）。
- 未跑全量、未改 `test/helpers/temp-dir.ts`（`2bf24dd6` 已定稿）、未碰 `quality-modernization-run.test.mjs`（`bc5ab681` 已修完）。

## 1. 判定线逐条

| 判定线 | 改前 | 改后 | 结论 |
|---|---|---|---|
| `project-migration-acceptance.test.ts` 单跑 EPERM = 0 | 8 | **0** | ✅ |
| `real-provider-generation-qualification.test.ts` 单跑 EPERM = 0 | 1 | **0** | ✅ |
| 提交前 `pnpm check:fast` 绿 | — | exit=0 | ✅ |
| 提交范围只含两个目标文件 | — | 2 files | ✅ |

## 2. 改动明细（2 文件 / 6 insertions(+) / 4 deletions(-)）

import 写法复用仓库既有先例（`f05-a11-official-windows-driver.test.ts:5`、`smoke-win-installer.test.ts:7`）：`import { discardTree } from '../../test/helpers/temp-dir'`。

| 文件 | 位置 | 改前 | 改后 |
|---|---|---|---|
| `scripts/__tests__/project-migration-acceptance.test.ts` | `:1` | `node:fs` 具名导入含 `rmSync` | 去掉 `rmSync`，新增 helper import |
| 同上 | `:38`（原 `:37`） | `for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true })` | `for (const root of fixtures.splice(0)) discardTree(root)` |
| `scripts/__tests__/real-provider-generation-qualification.test.ts` | `:1` | `node:fs` 具名导入含 `rmSync` | 去掉 `rmSync`，新增 helper import |
| 同上 | `:442`（原 `:441`） | `rmSync(dirtyRepositoryRoot, { recursive: true, force: true })` | `discardTree(dirtyRepositoryRoot)` |

**残留核验**：对两个文件检索 `rmSync|unlinkSync|discardTree`，结果各只有 2 行 —— helper import 与唯一 `discardTree` 调用点；**裸 `rmSync` / `unlinkSync` 残留 0**，`node:fs` 具名导入里的 `rmSync` 已一并去掉（避免 unused import 触发 lint）。断言与用例数量一行未动。

## 3. 验证读数（单文件单跑，串行，未跑全量）

命令均为卡面指定的 `node scripts/run-tests-electron.mjs <单个文件>`，未摘环境变量、未加额外参数。`EPERM` 计数 = 日志中 `EPERM` 字面出现次数。

| 文件 | 日志 | exit | Test Files | Tests | EPERM |
|---|---|---|---|---|---|
| `project-migration-acceptance.test.ts` | `.batch/night/reports/h3-project-migration-acceptance.log` | 0 | `1 passed (1)` | `8 passed (8)` | **0** |
| `real-provider-generation-qualification.test.ts` | `.batch/night/reports/h3-real-provider-generation-qualification.log` | 0 | `1 passed (1)` | `16 passed (16)` | **0** |

`Test Files` / `Tests` 两行原样（日志原文带 ANSI 颜色控制符 `\x1b[…m`，下表为剥离控制符后的同一行，文字与数字未改）：

`h3-project-migration-acceptance.log:14-15`
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

`h3-real-provider-generation-qualification.log:8-9`
```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

EPERM 计数取证：对两份日志分别检索 `EPERM`，均返回 **No matches found（0 次）**。

## 4. 日志里的 sweep 汇总行说明（不是 EPERM、不是本次删除失败）

两份日志各有一行 `[temp-dir] sweep: N 处临时目录仍删不掉；本轮按路径放过 0 处删除失败`（project-migration N=2、real-provider N=10）。它是 `test/helpers/temp-dir.ts` 在测试进程退出/启动阶段清扫**历史遗留** `discard-*` 目录的汇总计数，且「**本轮按路径放过 0 处删除失败**」表明本次运行没有新增删除失败；该行不含 `EPERM`，两文件 exit 均为 0。日志中的中文在 PowerShell 控制台编码下显示乱码，英文判定行（`Test Files` / `Tests` / `EPERM`）不受影响。

## 5. 闸门与提交证据

- `pnpm check:fast`（提交前）：`typecheck ✓ 25.8s` / `doc links: checked 1436, broken 0` / `doc placement: 扫描 431 份 md，当前违规 0 条，基线内 0 条，新增 0 条` / `全部通过。`，`CHECK_FAST_EXIT=0`。
- `git commit` 的 pre-commit hook **自动重跑** `check:fast`：`typecheck ✓ 24.8s` / 1436 broken 0 / 431 份 0 违规 / 全部通过，`COMMIT_EXIT=0`。
- `git add -- <两个文件>` 后 `git diff --cached --name-only` 恰为 2 行：`scripts/__tests__/project-migration-acceptance.test.ts`、`scripts/__tests__/real-provider-generation-qualification.test.ts`。**未用 `git add -A`**。
- 提交 `a960d709`：`2 files changed, 6 insertions(+), 4 deletions(-)`；`git show --stat --oneline HEAD` 同上。提交后 `git status --short` 只有未跟踪的 `.batch/`、`reports/`，**没有** `.batch/`、`reports/`、`qm-run` 进入提交，也未推送。

## 6. 反例自查

| 反例 | 是否命中 |
|---|---|
| `git add -A` / 夹带 `.batch/`、`reports/`、`qm-run` | 未命中，见 §5 暂存名单与 HEAD stat |
| 只贴「已改」不给单跑 `EPERM=0` 读数 | 未命中，见 §3 两份日志原文与计数 |
| 改断言 / 跳过用例让测试变绿 | 未命中，diff 仅 4 行替换 + 2 行 import，断言与用例数不变（8 / 16 全 passed） |
| 顺手改全仓其它裸 `rmSync` | 未命中，仅两个目标文件 |

## 7. 范围外（本卡未动，需另开卡）

- 全仓另有约 90 个测试文件同样以裸 `rmSync` 收夹具（如 `summary-continuity-migration.test.ts:26`、`verify-win-package.test.ts:29`），今晚基线未报 EPERM，按勘误第 4 条不在本卡范围。
- `sweep` 汇总的 2 / 10 处历史残留目录属上一轮跑测遗留，本轮「按路径放过 0 处」，未在本卡清理，也不影响判定线。
- 未跑 `quality-modernization-run.test.mjs`（`bc5ab681` 已验 `195 passed (195)`、`EPERM=0`）。
