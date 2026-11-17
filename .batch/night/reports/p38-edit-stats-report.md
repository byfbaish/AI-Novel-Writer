# P38 · 审稿报告显示本章编辑计量

- 时间：2026-11-14 16:2x（Asia/Shanghai）
- 仓库：`C:\develop\workspace\AI-writer\develop`（`git rev-parse --show-toplevel` 已确认）
- 分支：`exp/resource-ledger`
- 起点：`66b188f8cb953edfd9401857b7b76d5f4657212a`
- 提交：`0e76f498688c28618e4c597b6d6c4731e599472b`（`feat:` 前缀，点名 add，无 `-A`）
- 授权：可改码 + 点名 `git add` + 一个 commit；未 push、未 reset/checkout/stash、未建分支

## 一、改动面（7 个文件，超出预期的 5 个，逐条说明）

| 文件 | 性质 | 为什么必要 |
|---|---|---|
| `src/shared/ipc-channels.ts` | 改 | 新增 `db:draft-edit-stats` 声明与 `DraftEditStatRow` 共享类型；邻居同风格 |
| `electron/controllers/db-controller.ts` | 改 | 新增只读 handler，套 `assertRequiredExpectedProjectPath`，直接复用 `listForDraft` |
| `src/components/panels/EditorArea.tsx` | 改 | 给 `<ReviewReport>` 传 `draftId={activeTab.draftId}` |
| `src/components/editor/ReviewReport.tsx` | 改 | 报告顶部「本章编辑计量」小节、取数、空/失败态 |
| `src/components/editor/review-edit-metrics.ts` | 新增 | 把口径抽成渲染层纯函数，避免埋在 1400 行组件里无法单测 |
| `src/components/editor/__tests__/review-edit-metrics.test.ts` | 新增 | 四条口径用例；纯函数独立文件使测试无需拉起 React 组件 |
| `electron/controllers/__tests__/db-controller-project-context.test.ts` | 改 | 按相邻 handler 的既有 mock 写法补一条「返回行 + 路径不符拒绝」 |

后两项新增文件是「预期 5 个」之外的两项，原因如上：口径纯函数必须可独立测试，而 handler 测试沿用既有项目会话测试文件，不另造第二套 mock。

`git show --numstat HEAD` 原文：

```text
25	0	electron/controllers/__tests__/db-controller-project-context.test.ts
5	0	electron/controllers/db-controller.ts
82	0	src/components/editor/ReviewReport.tsx
47	0	src/components/editor/__tests__/review-edit-metrics.test.ts
33	0	src/components/editor/review-edit-metrics.ts
1	0	src/components/panels/EditorArea.tsx
13	0	src/shared/ipc-channels.ts
```

## 二、主进程只读通道

```ts
ipcMain.handle('db:draft-edit-stats', async (_event, draftId: number, expectedProjectPath: string) => {
  assertRequiredExpectedProjectPath(getCurrentProjectPath(), expectedProjectPath)
  return DraftEditStatsRepository.listForDraft(draftId)
})
```

- 入参 `[draftId, expectedProjectPath]`，项目会话守卫与相邻 `db:draft-delete` 同款。
- 没有新写 SQL 聚合；`listForDraft` 原样返回 `id ASC` 的全部行。
- 契约声明：

```ts
'db:draft-edit-stats': { args: [draftId: number, expectedProjectPath: string]; return: DraftEditStatRow[] }
```

## 三、口径纯函数（`src/components/editor/review-edit-metrics.ts`）

```ts
const humanRows = rows.filter(row => row.origin === 'human')
const authorActions = humanRows.filter(row => row.changed_chars > 0).length
const changedChars = humanRows.reduce((sum, row) => sum + row.changed_chars, 0)
const newChars = humanRows.reduce((sum, row) => sum + row.new_chars, 0)
const changedPerKChars = newChars > 0 ? (changedChars / newChars * 1000).toFixed(1) : '—'
return { saveCount: rows.length, authorActions, changedPerKChars }
```

- 保存次数 = 全部行数（含 AI）。
- 作者动作 = 仅 `human && changed_chars > 0`；AI 行不参与。
- 千字改动分子分母都只取 `human` 行；分母 0 显示 `—`，保留 1 位小数。
- 范围 = 该 draft 全部行，无时间截断。

## 四、渲染层

`EditorArea.tsx:792` 调用点新增：

```tsx
draftId={activeTab.draftId}
```

`ReviewReport.tsx` 在统计栏下方、图例/总体评价之前插入小节：

- 正常：`本章编辑计量：保存 N 次 · 作者改动 M 处 · 千字改动 R`，第二行 `（仅统计作者本人改动，AI 修稿不计）`；
- 无行：`暂无计量数据（本版起记录）`；
- 通道抛错或 3 秒超时：`计量读取失败`；
- 样式：`text-right text-xs`、`var(--color-text-muted)`、`font-variant-numeric: tabular-nums`，未新增配色 token；
- 取数失败只改这一行文案，不改变报告正文、条目、确认快照的渲染路径。

## 五、测试

最终相关单测（Electron 运行时 / ABI 145；本机无 `pnpm`，用其底层入口）：

```text
✓ src/components/editor/__tests__/review-edit-metrics.test.ts (4 tests) 2ms
✓ electron/controllers/__tests__/db-controller-project-context.test.ts (40 tests) 29ms

Test Files  2 passed (2)
      Tests  44 passed (44)
```

四条口径用例：

1. 空数组 ⇒ `saveCount 0 / authorActions 0 / —`；
2. 全部 human 空保存 ⇒ 保存 2、作者动作 0、`0.0`；
3. 混合含 `new_chars=0` ⇒ AI 的 50 字不计，作者动作 2、`150.0`；
4. 正常三数 ⇒ 保存 3、作者动作 2、`28.0`（分母 1500，不是 3500）。

handler 用例：`db:draft-edit-stats` 在 `C:/projects/A` 返回原始行；切到 `C:/projects/B` 后用 A 路径调用被项目会话守卫拒绝，且 `listForDraft` 未被调用。

### 全量测试实际结果（未绿，如实记录）

卡面要求全量 `pnpm test` 绿。本机无 `pnpm`，实际执行其同一入口：

```powershell
node scripts/run-tests-electron.mjs run --exclude scripts/__tests__/locale-shell.interaction.test.ts
```

该轮排除了一个会起本地服务、与跨 agent 红线「禁起应用进程测试」冲突的 interaction 用例。结果：

```text
Test Files  39 failed | 603 passed (642)
     Tests  231 failed | 8464 passed | 14 skipped (8709)
      Errors  36 errors
   Duration  601.58s
FULL_UNIT_EXIT=1
```

失败集中在打包/发布/Mac 官方 fixture/task-board/更新 interaction 等环境型套件（如 `f05-a11-official-windows-driver`、`verify-win-package`、`smoke-win-installer`、`project-restore-service`、`update-section.interaction`），**不是 P38 触碰的 7 个文件**：本轮的 `review-edit-metrics.test.ts` 与 `db-controller-project-context.test.ts` 均全绿，且失败清单中未出现 `ReviewReport` / `EditorArea` / `ipc-channels`。

不确定项：未做「起点 HEAD 同样全量」的基线对照（红线禁 stash/checkout），因此不能断言这 39 个失败文件全是既有红；只能确认它们不在 P38 改动面内。全量未绿这一项不满足卡面要求，留给 QA 首验裁定。

## 六、闸门

```powershell
node scripts/check-fast.mjs
EXIT=0
```

```text
[check:fast] typecheck ✓ 21.8s
doc links: checked 1470, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
```

## 七、禁动区核对

- `src/shared/review-generation-report.ts`、`review-chapter.command.ts`、`ReviewReport.tsx` 的 `ReviewJSON` 接口：本次读取范围内未发现改动。
- `generate-draft.command.ts` 的 `callbacks.log` 链：未改。
- schema / 迁移 / 依赖 / `review_findings`：未改。
- `draft-edit-stats-repository.ts`：未改写入语义，也未改文件。

## 八、提交与状态

`git log --oneline -3`：

```text
0e76f498 feat: show draft edit metrics in review report
66b188f8 fix: clear draft edit stats with generated text
28b0e822 feat: record draft edit metrics with origin tagging
```

`git status --porcelain`：空。`git diff --check` 退出码 0。

## 九、回执字段

- 投前 currentSessionId：`38453472829355778`
- 投后 currentSessionId：`38453472829355778`
- 是否一致：是
- 例外依据：不适用（未用 --new）
- 模型芯片原文：豆包自动档
- HEAD：`0e76f498688c28618e4c597b6d6c4731e599472b`
- 信号路径：`C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p38-edit-stats-report.done`

<!-- DONE -->
