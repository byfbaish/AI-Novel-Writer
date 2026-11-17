# P36 · 清除生成数据时一并清掉计量表

- 时间：2026-11-14 15:5x（Asia/Shanghai）
- 仓库：`C:\develop\workspace\AI-writer\develop`（`git rev-parse --show-toplevel` 已确认，不是 wt-1）
- 分支：`exp/resource-ledger`
- 起点：`28b0e822fc18ef9c2705d9100c51ce83104b3d7b`（P35 已提交）
- 提交：`66b188f8cb953edfd9401857b7b76d5f4657212a`（`fix:` 前缀，点名 add，无 `-A`）
- 授权：可改码 + 本卡点名允许 `git add` + commit；未 push、未 reset/checkout/stash

## 一、改动文件

1. `electron/repositories/project-clear-repository.ts`
2. `electron/repositories/__tests__/project-clear-repositories.test.ts`

`git show --numstat HEAD` 原文：

```text
51	0	electron/repositories/__tests__/project-clear-repositories.test.ts
3	1	electron/repositories/project-clear-repository.ts
```

## 二、两段 diff 摘要

### 1. 计数清单

`CLEAR_COUNT_TABLES.generatedText` 在 `revisions` 与 `drafts` 之间插入 `draft_edit_stats`，与 `drafts` / `contents` 同档：

```diff
-    generatedText: ['finalized_draft_import_operations', ..., 'reviews', 'revisions', 'drafts', 'contents', 'summary_snapshots', 'volume_handoffs'],
+    generatedText: ['finalized_draft_import_operations', ..., 'reviews', 'revisions', 'draft_edit_stats', 'drafts', 'contents', 'summary_snapshots', 'volume_handoffs'],
```

`blueprints` / `creativeFields` 两档数组未动。

### 2. 删除顺序与老库保护

在 `DELETE FROM revisions` 之后、`DELETE FROM drafts` 之前插入：

```ts
// 先删计量子表再删 drafts；老库没有 M30 表时安静跳过。
if (hasTable(db, 'draft_edit_stats')) db.prepare('DELETE FROM draft_edit_stats').run()
```

`drafts` / `contents` / `summary_snapshots` / `volume_handoffs` 的既有删除顺序与语义未动；`volumes` 的 `UPDATE actual_last = NULL ...` 段未动。

## 三、新增用例与输出

测试入口：工程既有单测入口（Electron 运行时 / ABI 145；本机 PATH 无 `pnpm`，故直接调用其底层脚本，仍是单文件、不起应用进程）：

```powershell
node scripts/run-tests-electron.mjs run electron/repositories/__tests__/project-clear-repositories.test.ts
```

输出尾部：

```text
✓ electron/repositories/__tests__/project-clear-repositories.test.ts (13 tests) 1784ms

Test Files  1 passed (1)
     Tests  13 passed (13)
```

新增两条：

- `clears draft edit stats with generated text and counts the extra category`：真实内存库升到 v31，种 1 条 `drafts`、1 条 `contents`、1 条 `draft_edit_stats`；清 `generatedText` 后三表均 0 行，回执 `counts.generatedText = { categories: 3, rows: 3 }`。P36 前该表未计入，只会是 `2 / 2`。
- `skips draft edit stats without throwing when the legacy database has no such table`：mock 的 `sqlite_master` 查询对 `draft_edit_stats` 返回不存在；清 `generatedText` 不抛错，且 prepare 调用中不出现 `DELETE FROM draft_edit_stats`。

## 四、C4 反证（真跑、真红）

临时去掉 `hasTable` 保护，改成无条件 `db.prepare('DELETE FROM draft_edit_stats').run()`，只跑老库用例：

```text
× skips draft edit stats without throwing when the legacy database has no such table 4ms
AssertionError: expected [ …(83) ] to not include 'DELETE FROM draft_edit_stats'
Tests  1 failed | 12 skipped (13)
EXIT=1
```

已立即还原保护并复跑：

```text
Tests  13 passed (13)
EXIT=0
```

## 五、验收判据对照

- **C1**：真实库清 `generatedText` 后 `draft_edit_stats` 为 0 行；`counts.generatedText.categories` 为 3（drafts + contents + draft_edit_stats），P36 前为 2，递增 1。
- **C2**：无该表的老库路径用 mock `sqlite_master` 返回 false 证明：不 prepare `DELETE FROM draft_edit_stats`、不抛错、`cleared = ['generatedText']`。
- **C3**：`blueprints` / `creativeFields` 两档的 `CLEAR_COUNT_TABLES` 未改；既有 `clears selected generated project data in one database transaction` 用例仍绿（13/13 中包含）。
- **C4**：去掉保护后老库用例真红；还原后全绿。
- **C5**：porcelain 提交后为空；仅两个文件；`draft_edit_stats` 表结构与 P35 写入逻辑零改动。

## 六、闸门

本机无 `pnpm`，使用 `pnpm check:fast` 的唯一实现脚本：

```powershell
node scripts/check-fast.mjs
EXIT=0
```

```text
[check:fast] typecheck ✓ 23.5s
doc links: checked 1470, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
```

`git diff --check` 退出码 0。

## 七、提交与状态

`git log --oneline -2`：

```text
66b188f8 fix: clear draft edit stats with generated text
28b0e822 feat: record draft edit metrics with origin tagging
```

`git status --porcelain`：空。

## 八、回执字段

- 投前 currentSessionId：`38453472829355778`
- 投后 currentSessionId：`38453472829355778`
- 是否一致：是
- 例外依据：不适用（未用 --new）
- 模型芯片原文：豆包自动档
- HEAD：`66b188f8cb953edfd9401857b7b76d5f4657212a`
- 信号路径：`C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p36-clear-stats.done`

<!-- DONE -->
