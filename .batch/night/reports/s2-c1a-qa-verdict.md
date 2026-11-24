# C1-a 首验判词（角色列表三档相关性筛选 + 命中原因 + 两档排序）

- 卡号：`744f13a8`（S2 C1-a）
- 判定面：`34aa000083a730eed180fef28a5434b5586456d2`（父 `95a30ae6c406fa898636f88456eafb8c73bb6891`，分支 `card/s2-c1-relevance-and-diff`）
- 判定时点：2026-11-24 05:41–05:5x（Asia/Shanghai）
- 判定人：QA（只读复算；未改 wt-2 任何文件、未 commit、未 push；变异发出后已复原并留 porcelain 0 原文）
- **结论：PASS**（J1 过、J2 八个断言点逐条覆盖、M1 变异真转红且回滚后回绿；四条记账不阻断）

## 0. 现场（wt-2）

```
$ git rev-parse --abbrev-ref HEAD
card/s2-c1-relevance-and-diff
$ git rev-parse HEAD
34aa000083a730eed180fef28a5434b5586456d2
$ git rev-parse HEAD^
95a30ae6c406fa898636f88456eafb8c73bb6891
$ git status --porcelain -uall | wc -l
0
$ git diff --numstat 95a30ae6 HEAD
183	1	src/components/panels/sidebar/CharactersView.tsx
250	0	src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
253	0	src/shared/__tests__/character-relevance.test.ts
350	0	src/shared/character-relevance.ts
```

白名单核对：仅上述 4 文件，无白名单外改动，`__screenshots__` 未被写。
新增三件指纹（`sha256sum` 原文）：

```
44fdd1f55d9e46a89018968bf53e3093039a020ebed62c4e5be7eeb5ee51bcce  src/shared/character-relevance.ts
0db55116737fe85f386db1f7911d7aabdf7f8634c76d1a03213b7c369176b1da  src/shared/__tests__/character-relevance.test.ts
308f09418c04d1bfbab9f9dac74a06f0af5fcf36ab657bc34853164f8ebc6741  src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
```

## 1. 判据 J1 —— [static] 纯函数面：**过**

`src/shared/character-relevance.ts` 全文件只有一行 import：

```
13:import { parseRelationshipEdges } from './relationship-presentation'
```

`relationship-presentation.ts` 亦只 `import type { Locale } from '../i18n/types'`（类型导入，无运行时依赖）。
禁用面 grep 原文（rc=1 零命中）：

```
$ grep -nE "from '(electron|node:)|require\(|window\.|document\.|localStorage|ipc\." src/shared/character-relevance.ts
RC=1
```

J1 点名的导出存在：`characterRelevanceHits(entry, ctx): CharacterRelevanceLayer[]`（`:196-201`），与 `characterRelevance`（`:178-190`）同一实现；命中档固定「关系 → 蓝图 → 大纲」顺序（`:186-188`），由用例 `return 的命中档固定按 关系 → 蓝图 → 大纲 排序且只含命中项` 覆盖。
类型检查：`check:fast` 内 `typecheck ✓ 18.1s`（见 §3）。

## 2. 命令复算（我自跑，非采信回执）

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/character-relevance.test.ts
 ✓ src/shared/__tests__/character-relevance.test.ts (18 tests) 10ms
 Test Files  1 passed (1)
      Tests  18 passed (18)
UNIT_EXIT=0

$ node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
 ✓ |chromium| src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx (7 tests) 346ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
BROWSER_EXIT=0
```

`pnpm test` / `pnpm check:fast` 字面入口沿用本群已裁的等价入口（`scripts/run-tests-electron.mjs`、`scripts/check-fast.mjs`），与该 worktree 的 `node_modules` 目录联接有关，非本卡问题。

## 3. `check:fast`（我自跑）

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 18.1s
doc links: checked 1472, broken 0
[check:fast] doc-links ✓ 0.1s
doc placement: 扫描 442 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.3s
[check:fast] 全部通过。
CF_EXIT=0
```

## 4. M1 变异（档② 无蓝图守卫 → 恒标命中）：**真转红**，回滚回绿

靶点 `src/shared/character-relevance.ts:153`，原文：

```ts
if (!declarations || declarations.length === 0) return []
```

改为：

```ts
if (!declarations || declarations.length === 0) return [1]
```

红原文（节选，逐字）：

```
 × 同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态" 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/shared/__tests__/character-relevance.test.ts > 档② 数据未就绪（J2 单列一条） > 同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态"
      Tests  1 failed | 17 passed (18)
M1_EXIT=1
```

复原（`cp` 回备份）后：

```
$ git status --porcelain -uall | wc -l
0
$ git rev-parse --short HEAD
34aa0000
      Tests  18 passed (18)
GREEN_EXIT=0
```

M3（只标不勾，把命中卡塞进 `picked`）：**未发（派单 §6 标「可选」）**。其正证仍在——browser 用例 `J2⑧ 只标不勾：「全选」仍等于当前筛选结果，三档过滤本身不改变勾选` 断言过滤后「已选 0」、点全选后「已选 4」（非全集 5）。

## 5. J2 八个断言点逐条对号（单测 + 组件侧）

| # | 断言点 | 单测原文用例 | 组件侧原文用例 | 判 |
|---|---|---|---|---|
| ① | 三档全开结果集＝全集 | `① 三档全开时结果集＝未筛：5 张卡全部可见…` | `J2① 三档全开：5 张卡全部在列表里，且每行标出命中的档` | 过（5/5 行，`data-relevance` 逐行对） |
| ② | 关档只减不增、不隐藏未命中 | `② 关档只减不增：…`、`② 逐档关闭：…` | `J2② 关掉「有关系对象」只减不增：…` | 过（关档后恰 4 行，`NO_HIT` 仍在） |
| ③ | 仅关系命中只出「有 N 条关系」 | `③ 仅关系命中只出「关系」这一条，并带条数` | `J2③④⑤⑥ …`（含「有 3 条关系」且**不含**「蓝图声明过」） | 过 |
| ④ | 仅蓝图命中只出「蓝图声明过」 | `④ 仅蓝图命中只出「蓝图」这一条，并带章号（升序去重）` | 同上（含「蓝图声明过（第 12、37 章）」） | 过 |
| ⑤ | 仅大纲命中只出「出现在大纲／世界观」 | `⑤ 仅大纲命中只出「大纲／世界观」这一条，并带命中字段` | 同上 | 过 |
| ⑥ | 全不中出现「无剧情线索」且仍可见 | `⑥ 全不中：可见，且三档任一组合下都不会被隐藏`、`⑦ 未命中时没有任何原因…` | `J2③④⑤⑥ …`（`toContain('无剧情线索')` + `rowOf(NO_HIT)` 存在） | 过 |
| ⑦ | 原因最多 2 条 + `+N`，点开给全 | `⑦ 三档全中时原因最多显示 2 条，其余收成 +N（N=1）` | `J2⑦ 三档全中只显示 2 条原因 + 「+1」，点开才给全`（点击按钮后 `+1` 消失、第三条出现） | 过（真点击，非渲染断言） |
| ⑧ | 排序两档 + 稳定 | `⑧「有剧情优先」按命中档数降序，同档数按名字`、`⑧「名字」按名字排序…`、`⑧ 排序稳定：主键相等…保持入参顺序` | `J2⑧ 排序两档：…切「名字」后按名字重排`、`J2⑧ 只标不勾：…` | 过（`selectOptions('name')` 真切控件，按 `localeCompare('zh-CN')` 逐字比对） |
| ＋ | 档② 空数据（无蓝图）单列一条 | `同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态"` | `档② 未就绪（无蓝图）：不报错、不隐藏，只把该档的命中清空` | 过（全中那张降为 `relationship,outline`，无连坐、无「读取失败」文案） |

组件面结论：断言**真盖到三档勾选与排序控件**（`page.getByRole('checkbox', { name: '有关系对象' }).click()`、`getByRole('combobox', { name: '角色排序' }).selectOptions('name')`、`getByRole('button', { name: '全选' })` 均触发真实事件并断言结果集/文案变化），不是只渲染。

## 6. 记账（不阻断，供后续处理）

1. **回执行数更正方向反了**：admin 记「回执实际 175 行／14,112 B／`9f09561a…`」，但我实测两处均为 **225 行**／14,112 B／`9f09561a…`：

   ```
   $ wc -lc C:/tmp/c1-s2/workbuddy/receipt-to-owner.md
     225 14112 C:/tmp/c1-s2/workbuddy/receipt-to-owner.md
   $ wc -lc .batch/night/staging/s2-c1/receipt-c1a-workbuddy.md
     225 14112 .batch/night/staging/s2-c1/receipt-c1a-workbuddy.md
   两处 sha256 同为 9f09561a2778f174ed2d098d0a5804391065097bf8ac13b37003a18923f3e75e
   ```

   即联络人原报「225 行」是对的，admin 的「175 行」更正不成立（字节与 sha 都对得上）。建议以 **225 行**为准并撤回那处更正。
2. **勾选行位置**（admin 要 QA 判一句）：设计稿 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md:66` 只写「列表头部加一组三档勾选（默认全开）」，§3.1 未规定必须在 `h-9` 顶栏。实现位于搜索框正下方、列表之上（`CharactersView.tsx:314-330` 区块），仍属「列表头部」，判 **一致**，非偏离。
3. **隐藏卡仍在 `picked`**：`picked` 不随筛选剪枝（`:279-289`），若先勾选一张卡再关掉其命中档，该卡从列表消失但「删除选中（N）」仍会删它。此语义在 `95a30ae6` 的搜索筛选下已存在，**非本卡引入**；三档筛选让触发更容易，建议记 BACKLOG（下轮在筛条件变化时剪枝或提示「已选中 N 张被隐藏」）。
4. **数据未就绪时的行为**：`relevanceContext === null`（读库失败／旧项目缺表）时列表不筛、不标原因，仅显示「蓝图／大纲未就绪」；排序控件仍可用（默认「有剧情优先」因命中全 0 退化为入参顺序）。`try/catch` 降级为 `null`（`CharactersView.tsx` 读库 effect），无「藏卡」路径。

## 7. 未判边界

- 本判词为 **[static] + [mock]** 两层：无真实 Electron + 真实 SQLite 实机证据，故作不出 `[live]` 结论；本卡派单判据亦只到 J1／J2。
- 组件断言基于 browser 配置的 DOM 渲染与事件，不等价于视觉版式/像素验收。
- 只判白名单 4 文件与 J1／J2；C1-b（字段级 diff、三选一、快照 M31）不在本判范围。
- 文中所引红/绿原文为当次终端逐字输出；变异已复原，`porcelain 0`、HEAD 仍 `34aa0000`。

## 8. 放行意见

**PASS**，可转 C1-b。四条记账中第 1 条请 admin 修正对账数字，第 3 条建议入 BACKLOG，第 2／4 条仅留痕。
