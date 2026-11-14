结论：PASS ｜ 产物：C:\develop\workspace\AI-writer\develop\reports\fix-collect-642.md ｜ 判定线：收集面 642→641 且该文件不在列表 ｜ 证据：同一收集命令改前 642 行（命中 compare.test.ts）→ 改后 641 行（命中 0），集合差集仅 `scripts/.tmp/d18-review/compare.test.ts`

# WB-E3 · vitest 收集面 642→641：exclude `scripts/.tmp`

- 时间：2026-11-12
- 授权：可改码 + 可提交（不含推送），只改 `vite.config.ts` 一处
- 提交：`1ba4819e`（分支 `exp/resource-ledger`），**未推送**

## 一、结论

PASS。全部判定线命中，五条反例均未命中。

## 二、改动（唯一一处）

`vite.config.ts` 的 `test.exclude` 数组新增一行 `'**/scripts/.tmp/**',`，插在 `'**/.runtime/**',` 与 `'**/plugins/**',` 之间，与既有 `**/.worktrees/**` / `**/.runtime/**` 同为绝对 glob 风格。数组其余项一字未动，未整体重写。

```diff
--- a/vite.config.ts
+++ b/vite.config.ts
@@ -153,6 +153,7 @@ export default defineConfig(({ command }) => {
       '**/.pnpm-store/**',
       '**/.workbuddy/**',
       '**/.runtime/**',
+      '**/scripts/.tmp/**',
       '**/plugins/**',
       // Frozen planning scripts retain their standalone Node entrypoints.
```

`git diff --stat`（提交前）与 `git diff --cached --stat`（提交时）均为：

```
 vite.config.ts | 1 +
 1 file changed, 1 insertion(+)
```

## 三、验证口径：纯收集，未跑任何测试

改前改后使用**完全相同**的命令（cwd = 仓库根）：

```
node ./node_modules/vitest/vitest.mjs list --filesOnly --run
```

`vitest 4.1.11` 的 `list --filesOnly` 只做文件收集并列出路径，不执行用例、不加载 `better-sqlite3`。本轮**未**调用 `pnpm test`、`pnpm check:full`、`vitest run` 或任何全量测试。输出写到系统 temp，未落在 `scripts/.tmp`。

| 时点 | 收集行数 | `scripts/.tmp/d18-review/compare.test.ts` 是否在收集结果里 |
|---|---|---|
| **改前** | **642** | 在（`grep -c` = 1） |
| **改后** | **641** | 不在（`grep -c` = 0） |

集合对比（改前 / 改后列表各排序后取差集，`comm`）：

- 改前 − 改后 = `scripts/.tmp/d18-review/compare.test.ts`（**仅此 1 项**）
- 改后 − 改前 = **空**

即：这一行只排除了目标临时测试，没有连带排除其他任何测试文件，也没有意外引入新收集项。

## 四、`scripts/.tmp` 未删任何文件

| 时点 | `find scripts/.tmp -type f \| wc -l` |
|---|---|
| 改前 | **189** |
| 改后 | **189** |

判定线「改前改后不变」满足。全程未对 `scripts/.tmp` 执行任何写入或删除；目标文件仍在原处（2169 字节，mtime 2026-11-04 23:56）。

> **⚠️ 与卡面数字的差异（记录待裁决，本轮不自行处理）**：卡面写「169 个文件」，实测为 **189**，改前改后两次同命令均为 189，差 20 个。同目录内有 102 个文件的 mtime 晚于 2026-11-05（即 11-04 之后存在新增写入），但本轮**未对成因下结论**，也未据此改动任何文件。判定线按「改前改后不变」执行，已满足。

## 五、提交

- 提交前暂存区为空，`git status --short -uno` 仅 `M vite.config.ts`；只执行 `git add vite.config.ts`。
- 本报告 `reports/fix-collect-642.md` 是要求的产物，属于未跟踪文件，**未纳入提交**，因此 `git diff --stat` 与提交内容都只有 `vite.config.ts` 一个文件。
- commit message（字面）：`exclude scripts/.tmp 临时目录，修复 develop 与干净 worktree 收集面不一致（642→641）`
- pre-commit hook 自动跑 `check:fast`（typecheck + 文档检查，**不含全量测试**）：typecheck ✓ 25.3s、doc-links 检查 1436 条 / broken 0、doc-placement 扫描 431 份 md / 违规 0。
- **未执行 `git push`**。

## 六、工作区旁证（非本轮改动）

- 卡面「develop」按工作目录 `C:\develop\workspace\AI-writer\develop`（相对干净 worktree 的主 checkout）理解；实际分支名为 `exp/resource-ledger`。
- 改前 `git status --short` 曾显示 `M scripts/__tests__/public-repository-hygiene.test.ts` 及大量未跟踪 `.batch/` 条目；改后该文件已不在 modified 列表、暂存区为空。这些是并行任务的痕迹，本轮**未读写、未暂存、未提交**其中任何一项。
- 未改 `.batch/night/index.md`；未对任何卡执行 `review --pass`。

## 七、反例自检

| 反例 | 结果 |
|---|---|
| 删了 `scripts/.tmp` 下任何文件 | 未发生，189 → 189 |
| exclude 写成相对路径或整体重写数组 | 未发生，仅新增一行绝对 glob |
| 跑了全量或 `check:full` | 未发生（仅 `list --filesOnly` 收集 + hook 的 `check:fast`） |
| 报告没有 642 与 641 两个读数 | 两者均有，见 §三 |
| 改动了 `vite.config.ts` 以外的文件 | 未发生；报告为要求的产物、未跟踪、未提交 |
