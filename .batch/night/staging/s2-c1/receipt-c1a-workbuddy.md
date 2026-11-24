# C1-a 回执 · 角色相关性筛选 + 命中原因 + 两档排序（卡 744f13a8）

```
From: C1A-S2-WorkBuddy
To: 大肥鱼@主身
卡号：744f13a8-7a5c-49dc-beab-9e0d7259cc4e｜会话标识：2026-11-24 05:20 (GMT+8) 首次回执｜起点：95a30ae6
模式：工作模式｜模型：DeepSeek-V4.1-Flash
```

> 模型一栏是会话声明值；我读不到 UI 侧模型芯片，只能报声明值，无法自证档位。

---

## 0. 起点闸门（§0.3 三项原文）

开工第一条命令（**动任何文件之前**）：

```
$ git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
card/s2-c1-relevance-and-diff
$ git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
95a30ae6
$ git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | wc -l
0
```

三项与判据逐字一致（分支名 / `95a30ae6` / `0`），未 `git switch -c`、未切任何分支。

## 1. 收尾核验（§7 追加五行）

```
$ git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
card/s2-c1-relevance-and-diff
$ git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
34aa0000
$ git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | wc -l
0
$ git diff --stat 95a30ae6 HEAD
 src/components/panels/sidebar/CharactersView.tsx   | 184 ++++++++++-
 .../characters-view-relevance.browser.tsx          | 250 +++++++++++++++
 src/shared/__tests__/character-relevance.test.ts   | 253 +++++++++++++++
 src/shared/character-relevance.ts                  | 350 +++++++++++++++++++++
 4 files changed, 1036 insertions(+), 1 deletion(-)
$ sha256sum src/shared/character-relevance.ts src/shared/__tests__/character-relevance.test.ts src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
44fdd1f55d9e46a89018968bf53e3093039a020ebed62c4e5be7eeb5ee51bcce *src/shared/character-relevance.ts
0db55116737fe85f386db1f7911d7aabdf7f8634c76d1a03213b7c369176b1da *src/shared/__tests__/character-relevance.test.ts
308f09418c04d1bfbab9f9dac74a06f0af5fcf36ab657bc34853164f8ebc6741 *src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
```

## 2. 提交

- `git rev-parse HEAD` = `34aa000083a730eed180fef28a5434b5586456d2`
- 父 sha = `95a30ae6c406fa898636f88456eafb8c73bb6891`
- `git diff --numstat 95a30ae6 HEAD`：

```
183	1	src/components/panels/sidebar/CharactersView.tsx
250	0	src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx
253	0	src/shared/__tests__/character-relevance.test.ts
350	0	src/shared/character-relevance.ts
```

- `git status --porcelain -uall` 原文：**空**（0 行）
- 一笔 commit，message 以 `C1-a:` 开头，正文写明 J1／J2 与本卡号。
- pre-commit 钩子自动跑了 `check:fast`，通过（原文见 §6）。
- 钩子末尾提示「提交信息缺卡号 CARD-xxxx（只提醒，不拦提交）」——本卡按派单要求用 `C1-a:` 前缀 + 正文写卡 UUID，未改成 `CARD-` 格式。

## 3. J1 对号

| 要求 | 证据 |
|---|---|
| 导出 `characterRelevanceHits(entry, ctx)`，返回 `('relationship'｜'blueprint'｜'outline')[]` | `src/shared/character-relevance.ts` 具名导出，返回类型 `CharacterRelevanceLayer[]`，字面量联合就是那三项 |
| 无 IO | 全文件无 `fs` / `fetch` / `console` / 定时器；只有纯函数与字面量常量 |
| 无 `import` 自 `electron/` / store / `window` | 唯一 import 是 `./relationship-presentation`（shared 内模块，只 `import type { Locale }`，用来复用既有关系文本解析，避免第二套关系语法） |
| `tsc --noEmit` `EXIT=0` | `[check:fast] typecheck ✓ 25.0s`，`CF_EXIT=0` |

## 4. J2 对号（8 个断言点逐条）

夹具 = 5 张卡：仅关系 `程实` / 仅蓝图 `沈砚` / 仅大纲 `老陈` / 全不中 `无名氏` / 全中 `程婴`。
纯函数面 `src/shared/__tests__/character-relevance.test.ts`（18 条）+ 组件面 `characters-view-relevance.browser.tsx`（7 条）。

| 点 | 判据 | 用例（原文标题） | 结果 |
|---|---|---|---|
| ① | 三档全开结果集＝全集 | 纯：`① 三档全开时结果集＝未筛：5 张卡全部可见，且不会因"命中数不同"被丢掉`；组件：`J2① 三档全开：5 张卡全部在列表里，且每行标出命中的档` | pass（5/5） |
| ② | 关档只减不增、不隐藏未命中 | 纯：`② 关档只减不增：关掉「关系对象」只让仅关系命中的卡消失，未命中的卡仍在列表里`、`② 逐档关闭：只关「蓝图声明」不会动到仅大纲／仅关系／未命中的卡`；组件：`J2② 关掉「有关系对象」只减不增：仅关系命中的卡消失，未命中的卡仍在` | pass |
| ③ | 仅关系命中只出「有 N 条关系」 | 纯：`③ 仅关系命中只出「关系」这一条，并带条数`（`[{layer:'relationship',count:3}]`）；组件：`J2③④⑤⑥ ...` 断言含「有 3 条关系」且**不含**「蓝图声明过」 | pass |
| ④ | 仅蓝图命中只出「蓝图声明过」 | 纯：`④ 仅蓝图命中只出「蓝图」这一条，并带章号（升序去重）`（`[12,37]`）；组件：含「蓝图声明过（第 12、37 章）」且不含「条关系」 | pass |
| ⑤ | 仅大纲命中只出「出现在大纲／世界观」 | 纯：`⑤ 仅大纲命中只出「大纲／世界观」这一条，并带命中字段`；组件：含「出现在大纲／世界观」 | pass |
| ⑥ | 全不中出现「无剧情线索」且仍在列表 | 纯：`⑥ 全不中：可见，且三档任一组合下都不会被隐藏`；组件：`reasonTextOf(NO_HIT)` 含「无剧情线索」且 `rowOf(NO_HIT)` 存在 | pass |
| ⑦ | 原因最多 2 条 + `+N` | 纯：`⑦ 三档全中时原因最多显示 2 条，其余收成 +N（N=1）`；组件：`J2⑦ 三档全中只显示 2 条原因 + 「+1」，点开才给全` | pass |
| ⑧ | 两档排序 + 稳定 | 纯：`⑧「有剧情优先」按命中档数降序…`、`⑧「名字」按名字排序…`、`⑧ 排序稳定：主键相等（同名、同命中数）时保持入参顺序`；组件：`J2⑧ 排序两档…`、`J2⑧ 只标不勾：「全选」仍等于当前筛选结果…`（已选 0 → 全选后「已选 4」） | pass |
| 附表 | 档② 空数据（无蓝图）不抛错、不误判全不中 | 纯：`同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态"`；组件：`档② 未就绪（无蓝图）：不报错、不隐藏，只把该档的命中清空` | pass |

## 5. 变异（§5）

> **回滚方式说明**：本次靶子是新文件（untracked），`git checkout --` 对它无效（会报 pathspec 不匹配）。
> 改用「改回原字面量 + `sha256sum` 复核回到变异前值 + 复跑同值」，证据链比 checkout 更强（能证明字节级复原）。
> 变异前的靶文件 sha256：`44fdd1f55d9e46a89018968bf53e3093039a020ebed62c4e5be7eeb5ee51bcce`
> 变异期间 `git rev-parse HEAD` 始终 = `95a30ae6c406fa898636f88456eafb8c73bb6891`（未提交过变异）。

### M1 · 档② 蓝图未就绪守卫

改法：`if (!declarations || declarations.length === 0) return []` → `throw new Error('BLUEPRINT_SYNC_NOT_READY')`

红行原文：

```
     × 同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态" 3ms
 FAIL  src/shared/__tests__/character-relevance.test.ts > 档② 数据未就绪（J2 单列一条） > 同步记录为空时不抛错、不恒标命中、也不把卡判成"全不中之外的怪状态"
      Tests  1 failed | 17 passed (18)
```

回滚后：

```
44fdd1f55d9e46a89018968bf53e3093039a020ebed62c4e5be7eeb5ee51bcce *src/shared/character-relevance.ts
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### M2 · 三档并集语义（并集 → 交集）

改法：`characterRelevanceVisible` 里 `relevance.hits.some(layer => layers[layer])` → `relevance.hits.length === 3`

红行原文：

```
     × ① 三档全开时结果集＝未筛：5 张卡全部可见，且不会因"命中数不同"被丢掉 3ms
     × ② 关档只减不增：关掉「关系对象」只让仅关系命中的卡消失，未命中的卡仍在列表里 1ms
     × ② 逐档关闭：只关「蓝图声明」不会动到仅大纲／仅关系／未命中的卡 0ms
      Tests  3 failed | 15 passed (18)
```

回滚后：

```
44fdd1f55d9e46a89018968bf53e3093039a020ebed62c4e5be7eeb5ee51bcce *src/shared/character-relevance.ts
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### M3（可选）· 只标不勾 —— **未发**

原因：该靶在组件文件里，「命中卡自动塞进 picked」需要在读库回调里加一段写 `picked` 的临时代码，
回滚只能靠人工改回（不是 `checkout --`），两发必做项已满足，故按可选处理。组件面「只标不勾」的
正证仍在（`J2⑧ 只标不勾…` 断言进入批量删除时「已选 0」、点全选后「已选 4」）。

## 6. §6 三条命令原文

### 6.1 `node scripts/run-tests-electron.mjs src/shared/__tests__/character-relevance.test.ts`

```
 RUN  v4.1.11 C:/develop/workspace/AI-writer/wt-2
 ✓ src/shared/__tests__/character-relevance.test.ts (18 tests) 10ms
 Test Files  1 passed (1)
      Tests  18 passed (18)
```

### 6.2 `node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx`

```
 RUN  v4.1.11 C:/develop/workspace/AI-writer/wt-2
 ✓  chromium  src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx (7 tests) 377ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

只单文件运行，未跑全量 `test:browser`；组件面**跑成了**，所以不适用「未跑成 + 报错原文」的降级（层级仍按 `[mock]`：主进程用 mock 替身）。

### 6.3 `node scripts/check-fast.mjs`（等价于 `pnpm check:fast`，无 TTY 场景）

```
CF_EXIT=0
[check:fast] typecheck ✓ 25.0s
doc links: checked 1472, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 442 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.1s
0 项不合规
[check:fast] batch-hygiene ✓ 0.3s
[check:fast] 全部通过。
```

## 7. 改动清单

| # | 文件 | 动作 | 说明 |
|---|---|---|---|
| 1 | `src/shared/character-relevance.ts` | 新增 350 行 | 三档判定 / 原因槽位 / 两档排序 / 两个数据源归一，全部纯函数 |
| 2 | `src/shared/__tests__/character-relevance.test.ts` | 新增 253 行 | 18 条，5 卡夹具 + 排序 + 档② 空数据 + 数据源归一 |
| 3 | `src/components/panels/sidebar/__tests__/characters-view-relevance.browser.tsx` | 新增 250 行 | 7 条组件面断言，harness 照 `CharactersView.search.browser.tsx`，未改该既有文件 |
| 4 | `src/components/panels/sidebar/CharactersView.tsx` | 修改 183 / 删 1 | 三档勾选 + 排序单选 + 命中原因行 + 读库 effect |

## 8. 偏离与未做项（**请复核这三条**）

1. **`filteredCharacters` 的组合点在 `:62-71` 段内**（派单把该段列为「禁改：搜索/分页结构」）。
   - 为什么必须碰：`visibleKeys`（全选，`:96-101`）取的是 `filteredCharacters`。若相关性筛选放在别处，
     「全选」就会把**看不见的卡**一起选中——那是静默越权。要么让 `filteredCharacters` 承载相关性筛选（动这三行），
     要么动 `:66-71` + `:96-101`（动更多行）。选了前者：搜索三元、分页常量、`slice`、`visibleKeys` **一行未改**，
     只把 `filteredCharacters` 改成「搜索 + 三档 + 排序」的组合结果。
   - 另新增 `searchMatches` 承接原搜索过滤（原 `:63-65` 的逻辑原样搬过去）。
2. **三档勾选行放在搜索框正下方**（`CharactersView.tsx` 搜索块之后），不是派单猜的 h-9 顶栏 `:143-167`。
   - 原因：`h-9` 顶栏是「标题 + 4 个图标按钮」的单行 flex，塞 3 个复选框 + 1 个下拉会把标题挤掉，也超出侧栏宽度。
     搜索框正下方就在 `:196-205` 这一段里（派单允许的修改范围），仍在「列表头部」。
3. **M3 变异未发**（§5 可选），理由见 §5 末。

### 明确未做（属 C1-b / 本卡 §8）

- 无字段级 diff、无三选一、无 M31、无快照、无回退入口。
- 无新增 IPC 通道、未改 preload、未碰 `CharacterProposalSelectionPanel.tsx` / `character-proposal-choices.ts` /
  `ipc-channels.ts` / `db-controller.ts` / `electron/migrations/**` / `character-proposal-service.ts` /
  `ArchitectureConfirmDialog.tsx` / `character-roster.ts` / `character-proposal.ts`。
- 未做「最近出场」排序、未做别名／代称、未做交集／排除、未加索引表。
- 未 merge、未 rebase、未 tag、未 push 任何分支；未碰 `C:\develop\workspace\AI-writer\develop` 目录（只读过其中 `.batch` 两份件）。
- 未跑 `pnpm install`、未切 ABI、未起 Electron 实机、未跑全量测试。
- 未调用任何模型（本卡不需要）。

## 9. 口径落地补充（便于复核判据边界）

- **档② 只看蓝图 `characters` 声明**：`newCharacterCandidates`（待建卡提议）不计入——它属提案链路，
  算进来会让「被蓝图声明」和「待处理候选」混成一团。章号取 `characterSyncInput[].chapterNumber`，跨批次合并、升序去重。
- **档① 的条数**：`relationships` 先过既有 `parseRelationshipEdges`（结构化 JSON 与「角色：关系」自由文本都认）。
  文本非空但解析不出边时仍算命中，文案退化为「有关系记录」——不把「说不清几条」当成「没有关系」。
- **档② 名字相等**（非子串）：蓝图点名的是一份名单，用相等避免「程实」吃下「程实之」；档③ 才是子串匹配（正文检索）。
- **读库失败 = 未就绪**：`db:blueprint-character-sync-list-all` / `db:project-core-get` 任一抛错都降级成「未就绪」，
  表现为不筛 + 不标原因 + 顶栏显示「蓝图／大纲未就绪」，**不隐藏任何卡**。
