# AC3/S3 核盘记录（developer）

- 卡：`ed210a27-4a31-4b72-b46d-4f572aaa914c`（AC3/S3）
- 判定面：`wt-2` 分支 `card/arch-ac3-s3`，HEAD `b5a14f1cefaa57c5f02894139f2b4bede6f5cce1`，父 `57d05871`
- 起点：`57d05871`
- 核盘时间：2026-11-24 01:05–01:10（+08）
- 回执：`C:\tmp\ac3-s3\workbuddy\receipt-to-owner.md`（120 行／7,787B／`bf056545ec8906d8588101b44a15eb2faaf29a489aa8a932a8b793d7d396a3ae`；2026-11-24 02:01 外派会话被补话唤醒后改写为 122 行／8,611B／`e92e8bb5fa4b1d3f59ef8132ec81c1fd4f95942f5b0770ff10bc815bdae344a0`，新增 §9／§10；判据基准仍取本行所记的 00:58 版，新件只作补证）

## 0. 树与改动面

```
$ git log -1 --oneline
b5a14f1c feat(preflight): AC3/S3 弧层引用闭合接线（卡 ed210a27）
$ git status --porcelain
（空）
$ git diff --numstat 57d05871 HEAD
13	2	src/services/consistency-preflight.ts
179	0	src/shared/__tests__/arc-cover-consistency.test.ts
129	0	src/shared/arc-cover-consistency.ts
```

与回执一致；无 `arc-node.ts` 改动、无迁移、无新表。

## 1. 接线前后 grep 三段原文

接线前（`57d05871` 的树内容，`git grep`）：

```
$ git grep -n "arc-cover-consistency\|findArcCoverRisks" 57d05871 -- src
（无输出）
rc=1
```

接线后（HEAD `b5a14f1c`）：

```
$ grep -rn "arc-cover-consistency\|findArcCoverRisks" --include=*.ts src | grep -v __tests__
src/shared/arc-cover-consistency.ts:95:export function findArcCoverRisks(
src/services/consistency-preflight.ts:11:import { findArcCoverRisks } from '../shared/arc-cover-consistency'
src/services/consistency-preflight.ts:72:        ...findArcCoverRisks({ chapterNumber: blueprint.chapterNumber, ...arcLayer }, exemptions),
rc=0
```

即：新增 1 个纯函数文件、接线 1 处调用 + 1 处 import，通路其余不动。

## 2. IO 面（无新 IPC、无新表）

```
$ grep -cn "db:project-core-get" src/services/consistency-preflight.ts
1
$ grep -n "from './arc-node'" src/shared/arc-cover-consistency.ts
10:import { listArcNodes, parseChapterArcCovers, validateArcCovers, type ArcCoverViolation } from './arc-node'
```

- 弧层三项（`plotStructurePlan`／`synopsis`／`totalChapters`）复用既有那一次 `db:project-core-get`，不新增 IPC；
- 四个符号全是 `arc-node.ts` 既有导出，没有重算结构位、没有建表。

## 3. 变异六发（每发跑完立即 `git checkout --`；每发后 `git status --porcelain` 均为空）

工具：`node scripts/run-tests-electron.mjs src/shared/__tests__/arc-cover-consistency.test.ts`；靶文件 `src/shared/arc-cover-consistency.ts`。

| # | 变异 | rc | 汇总行 | 转红用例 |
|---|---|---|---|---|
| M1 | 删 `totalChapters` 非法守卫 | 0 | `Tests  11 passed (11)` | **无（等价变异）** |
| M2 | 删 `covers` 空守卫 | 0 | `Tests  11 passed (11)` | **无（等价变异）** |
| M3 | `arcCoverStableFactKey` 键去掉 `code` 段 | 1 | `Tests  5 failed \| 6 passed (11)` | #1、#2、#3、#10、#11 |
| M4 | 豁免过滤 `!item.revoked` → `item.revoked` | 1 | `Tests  1 failed \| 10 passed (11)` | #10 |
| M5 | 删 `nodes.length === 0` 守卫 | 1 | `Tests  1 failed \| 10 passed (11)` | #8 |
| M6 | **补发**：`messageFor` 的 `UNKNOWN_NODE` 分支恒返回空串 | 1 | `Tests  1 failed \| 10 passed (11)` | #2 |

### M1／M2 为等价变异的证据（上游已兜底）

```
$ grep -n "if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return \[\]" src/shared/arc-node.ts
105:  if (!Number.isSafeInteger(totalChapters) || totalChapters < 1) return []
$ grep -n "if (!Number.isSafeInteger(chapterNumber) || covers.length === 0) return \[\]" src/shared/arc-node.ts
242:  if (!Number.isSafeInteger(chapterNumber) || covers.length === 0) return []
```

- M1 删守卫后，`listArcNodes(plan, undefined)` 在 `arc-node.ts:105` 直接返回 `[]`，随后 `nodes.length === 0` 仍 `return []` ⇒ 行为不变。
- M2 改成只判 `!chapter` 后，`validateArcCovers(nodes, [], n)` 在 `arc-node.ts:242` 因 `covers.length === 0` 返回 `[]` ⇒ 行为不变。
- 结论：这两条是本卡守卫与上游 fail-open 的重复，属**等价变异**，不构成「漏断言」。判词应按「等价」记。

### 补发的有效变异（直击新增路径）

M6 把 `messageFor` 的 `UNKNOWN_NODE` 分支改成返回空文案，用例 #2（断言 finding 的 issue 里必须保留「可能拼写错误，或弧光已重排」）立刻转红 `Tests  1 failed | 10 passed (11)`。证明该断言非空、且直击本卡新增的文案路径（而非上游 `arc-node` 的既有逻辑）。

## 4. 测试汇总行（Electron 运行时，三文件）

核盘开始前（未变异）：

```
 ✓ src/shared/__tests__/arc-cover-consistency.test.ts (11 tests)
 ✓ src/shared/__tests__/arc-node.test.ts (27 tests)
 ✓ src/shared/__tests__/consistency-preflight.test.ts (8 tests)
 Test Files  3 passed (3)
      Tests  46 passed (46)
```

六发变异全部回滚后复跑：

```
 Test Files  3 passed (3)
      Tests  46 passed (46)
```

树：`git status --porcelain` 空、`git rev-parse HEAD` = `b5a14f1cefaa57c5f02894139f2b4bede6f5cce1`（与变异前一致，无残留改动）。

## 5. 未覆盖项（据实记）

- `pnpm check:fast` 的字面入口在本机 worktree 无 TTY 会崩在 pnpm purge（`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`），执行方已改跑 `node scripts/check-fast.mjs` rc=0；我没有复跑 check:fast（不属核盘五项），交 QA 时按「等价入口 rc=0」采信。
- 类型层面（`tsc`）未单独复跑，只经 vitest 的 esbuild 转译；如需严格，请由 QA 或收口人补 `node node_modules/typescript/bin/tsc --noEmit`。
