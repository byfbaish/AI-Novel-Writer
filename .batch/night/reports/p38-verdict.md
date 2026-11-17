# P38 终审：PASS

- 对象：`0e76f498688c28618e4c597b6d6c4731e599472b`「feat: show draft edit metrics in review report」，父 `66b188f8`
- 首验：QA `.batch/night/reports/p38-qa-firstcheck.md` 9,558B / `27656ADC18D1F6C03B518542933EEAE8`（改判后版）
- 派验单：`.batch/night/review-requests/P38.md` 4,354B / `A3E8C3D38F2FE872538F6F470C280F57`
- 交办报告：`.batch/night/reports/p38-edit-stats-report.md` 7,864B / 173 行 / `E1D3F52D27326F1D8839B79886EF442F`
- 信号：`p38-edit-stats-report.done` 143B / 16:39:08 在 `delivered\`，源目录空

## 判定

通过。A2/A3（作者动作数、千字改动）从「数据已落库、报表读取未接线」转为「已接线、可在审稿报告页读」。

## 我自己核过的事实

1. 盘面：HEAD=`0e76f498`，`git rev-list --count 66b188f8..HEAD`=1，porcelain 0，tag 仍 30 个，numstat 7 文件 +206 −0，与联络人、QA 三方读数一致。
2. 禁动区：`src/shared/review-generation-report.ts`、`review-chapter.command.ts`、`generate-draft.command.ts` 三处 blob 与起点相同（联络人逐字比、QA diff 0 行，我采这条双证）。
3. 口径落点：`src/components/editor/review-edit-metrics.ts:21` `filter(row => row.origin === 'human')`、`:22` `changed_chars > 0`、`:25-27` 分母 `new_chars` 之和、分母为 0 显示「—」；`review-edit-metrics.ts:17-18` 注释写明保存次数含 AI 行。
4. 界面落点：`ReviewReport.tsx:1279-1282` 错误态「计量读取失败」、`:1285-1286` 空态「暂无计量数据（本版起记录）」、`:1290-1297` 三数 + 「仅统计作者本人改动，AI 修稿不计」。
5. 接线：`ipc-channels.ts:1256` `'db:draft-edit-stats'` 入参 `[draftId, expectedProjectPath]`；`db-controller.ts:1271-1273` 走 `assertRequiredExpectedProjectPath` + `listForDraft`；`ReviewReport.tsx:523-530` 读原始行、`:530` 纯函数汇总。
6. 降级路径通：handler 不包 try/catch 是有意为之——`assertRequiredExpectedProjectPath` 抛错会被渲染层 catch 成 `editMetricsState='error'`（`:535-536`），落到「计量读取失败」，不会炸报告。

## C5 改判（本裁定留档）

原卡面「`pnpm test` 全量必须绿」改为：**改动面点名套件必须全绿；全量测试允许与基线同红，但须附基线树 `66b188f8` 整树同套件同失败的逐项对照，不得有新增红**。

依据：QA 用基线整树跑同批失败套件，StatusBar 3、project-restore 29、verify-win-package 4 两棵树同数同原文，证明非本卡引入；既有红长期存在，「全量绿」字面执行会让每张改码卡卡死。不开口子：新增红一律判红，故对照必须逐项列出。

## 记账项（不拦，不进返工）

- C4 无组件级用例，只有主进程 handler 与错误分支的代码级核对。真机轮须看报告页小节实际排版与空/错态是否真的显示（现记 backlog，列入真机验收清单）。
- `db:draft-edit-stats` 是本仓少数不包 try/catch 的 handler；如日后 `listForDraft` 改成可能抛非 assert 类错误，须补 try/catch 并区分错误文案。
- 10 章中位数、按 `chapter_number` 聚合仍不做，backlog。

## 下一步

- 验收文档 `market-quality-acceptance.md` 的 A2/A3 状态列 🟡→✅、G-A 从「部分可验」升「可验（除 A4）」，由产品经理改、我核。
- 真机轮（G-B/G-C 开跑、A4）等主人定；relay 线 0.5.0 仍不发版、不打 tag。

<!-- DONE -->
