# E4 施工记录（append-only）

> 用途：**每完成一个细粒度任务就追加一条**，防止 Token 额度耗尽导致工作丢失。
> 规则：只追加，不改历史条目；每条写「做了什么 / 改了哪些文件 / 验证结果 / 下一步」。
> 设计稿：[`volume-quota-context-budget-design.md`](../design/architecture/volume-quota-context-budget-design.md)
> 分支：`exp/arc-tree-v2` · 基准 `0e97f8de`

---

## 0. 施工前状态（2026-10-19）

| 项 | 值 |
|---|---|
| 分支 / HEAD | `exp/arc-tree-v2` / `0e97f8de` |
| 基线 `tsc --noEmit` | ✅ 通过（exit 0） |
| 未提交改动 | 设计稿 5 个文件（见下） |
| ⚠️ **git 不可用** | `.git` 目录写入被沙箱拒绝（`index.lock: Permission denied`），**本轮无法 commit**，改动留在工作区 |

设计稿改动（待作者自行提交）：

- `docs/design/architecture/volume-quota-context-budget-design.md`（新增）
- `docs/design/architecture/arc-budget-engine-design.md`（状态行）
- `docs/design/architecture/unit-budget-elastic-allocation-design.md`（§3 标为已被取代 + E3/E4 行）
- `docs/handoffs/2026-10-19-arc-budget-handoff.md`（§3 进度 + §5 待裁定）
- `docs/README.md`（索引一行）

## 1. 任务清单（细粒度，逐条勾）

| # | 任务 | 状态 |
|---|---|---|
| T1 | 建立本施工记录 | ✅ |
| T2 | E4a-1：`outline-budget.ts` 纯函数 + 单测（`OUTLINE_OVERSHOOT` / `OUTLINE_TOTAL_OVERSHOOT`） | ✅ |
| T3 | E4a-2：`planVolumeStats` 卷内统计纯函数 + 单测 | ✅ |
| T4 | E4b：`cached_tokens` 解析进 attempt receipt | ✅ |
| T5 | E4c：前缀投影只读预估（打日志，不改行为） | ✅ |
| T6 | E4j-1：滚动条可见性修复 | ✅ |
| T7 | E4j-2：Tab `scrollTop` 墓碑 | ✅（LRU4 实例未做，见记录） |
| T8 | E4j-3：分卷折叠 + 卷/单元树（抽屉可 pin） | ✅ UI 完成（文本折叠共享、窄屏自动退回待做） |
| T9 | E4h：按卷冻结（作者触发） | ⬜ |
| T10 | E4i：全量清除补弧光 | 🟡 代码已改，测试待原生模块重建 |
| T11 | E4e：卷末快照（handoff + anchor）+ M10 | ⬜ |
| T12 | E4j-2b：Tab 进度保留**全量覆盖**（所有 Tab 兜底 memory key + 内容稳定后重试恢复） | ✅ |
| T13 | E4j-4：**情节大纲三层树**（卷/单元/章 + 归属来源标记） | ✅ |
| T14 | E4j-2c：切 Tab 进度**仍然**丢失的真根因（remember 挪到 layout cleanup） | ✅ 待作者 GUI 确认 |

---

## 记录

### 2026-10-19 · T1 建立施工记录

- 新增 `docs/handoffs/2026-10-19-e4-implementation-log.md`（本文件）
- 记录施工前基线：`tsc --noEmit` 通过；git 写入被拒（无法 commit）
- 下一步：T2
### 2026-10-19 · T2 E4a-1：大纲字数探针纯函数（完成）

**做了什么**

- 新增 `src/shared/outline-budget.ts`（纯函数，无 IO）：
  - `outlineLengthOf(text)`：去空白计字，与 `auditArcDensity` 的 `densityLength` 同口径；
  - `auditOutlineLength(chapters, targetUnits)`：两条探针
    - `OUTLINE_OVERSHOOT`：**连续 ≥3 章** 实际字数 > 目标 × 1.5（只报**最长的一段**，不刷 98 条告警）；
    - `OUTLINE_TOTAL_OVERSHOOT`：总量 > 目标 × 章数 × 1.3；
  - `renderOutlineLengthReport(findings, language)`：渲染成一段可读日志，空数组返回 `null`；
  - 常量 `OUTLINE_OVERSHOOT_RUN = 3` / `OUTLINE_OVERSHOOT_FACTOR = 1.5` / `OUTLINE_TOTAL_OVERSHOOT_FACTOR = 1.3`。
- 新增 `src/shared/__tests__/outline-budget.test.ts`（21 条）。

**关键设计**

- **fail-open**：目标 ≤0 / 非整数 / NaN、没有章节、条目非法 ⇒ 返回空数组，调用方直接不打印；
- **只报不拦**（作者裁定：字数目标在 UI 里自己调，不加自动闸门）；
- **边界归中**：正好 1.5 倍不算超（避免浮点噪声误报）。

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| 逻辑自测（node type-strip 脚本，20 项断言） | ✅ ALL PASSED |
| `npx vitest run` | ❌ **环境不可用**：`spawn EPERM` + `tailwindcss-oxide` 原生绑定 UTF-8 解码失败（沙箱限制，与本改动无关） |

> ⚠️ **vitest 在本机跑不起来**（不是本改动的错）：`[plugin externalize-deps] Error: spawn EPERM` + `Could not load @tailwindcss/oxide-win32-x64-msvc`。已改用 `node --experimental-strip-types` 跑等价断言作为替代验证。**后续任务都按这个方式验证**。

**下一步**：T3（`planVolumeStats` 卷内统计纯函数）
### 2026-10-19 · T3 E4a-2：`planVolumeStats` 卷内统计（完成）

**做了什么**

- `src/shared/arc-position.ts` 新增（紧邻 `planProgress`）：
  - `VolumeStats` / `VolumeStatsRef` 类型；
  - `planVolumeStats(parsed, totalChapters, ref)`：只返回 `majorIndex` / `midCount` / `volumeChapters` / `actualUsed` / `remaining` / `bookProgress`，**不含 `budget` / `z` / `state`**；
  - `renderVolumeStats(stats, language)`：一行可读日志；
- 新增 `src/shared/__tests__/volume-stats.test.ts`（13 条）。

**关键口径**

| 口径 | 做法 |
|---|---|
| 卷长 | `scaledBoundaries` 折算，**与弧位块同源**（不另写一份） |
| `actualUsed` | 调用方负责按卷首/卷末截断后传入；本函数再 `min(..., volumeChapters)` 兜底 |
| `remaining` | `max(0, volumeChapters − actualUsed)`，**永不为负** |
| `bookProgress` | 不给 `coveredTo` 时为 `null`（不是 0）——避免把"没给"误读成"没写" |
| 失败姿态 | 结构不可解析 / 越界 / 卷长 ≤0 ⇒ `null`（fail-open） |

**与旧口径的关系**

- `planProgress` **保留不删**（E1 的 7 条单测仍引用），但**生产调用点要改用 `planVolumeStats`**；
- 这是刻意的过渡：先加新函数、再切调用点、最后才删旧的，避免一次性改动同时动纯函数与状态机。

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| 逻辑自测（18 项断言） | ✅ ALL PASSED |

**下一步**：T4（`cached_tokens` 解析进 attempt receipt）
### 2026-10-19 · T4 E4b：`cached_tokens` 解析（完成）

**做了什么**

- `src/shared/ipc-channels.ts`：`TokenUsage` 加 `cachedPromptTokens?: number | null`（**观测值，不参与结算**，是 `promptTokens` 的子集）；
- `electron/llm/openai-provider.ts`：
  - 非流式：解析 `usage.prompt_tokens_details.cached_tokens`（`:134-152`）；
  - 流式：同样解析，同时进 `onUsageEvidence` 与最终 `onDone` 的 usage（`:280-310`）；
- `electron/llm/__tests__/openai-provider.test.ts`：新增 2 条（缓存命中透传 / 供应商不报时字段缺省）。

**关键口径**

| 情形 | 行为 |
|---|---|
| 供应商报了 `cached_tokens: 768` | `cachedPromptTokens: 768` |
| 供应商报了 `cached_tokens: 0` | `cachedPromptTokens: 0`（**报了但没命中**） |
| 供应商没报 | **字段缺省**（不是 0）——「没报」≠「命中 0」 |
| 结算 | **完全不变**：`settleProviderUsage` 不读这个字段 |

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `arc-position.test.ts` + `openai-provider.test.ts` | ✅ **126 passed**（含新增 2 条） |

**工具链记录（重要，后续复用）**

`npx vitest run` 在本机沙箱下**跑不起来**（默认 pool `spawn EPERM` + vite 配置加载时 `tailwindcss-oxide` 原生绑定解码失败）。
可用替代：`.tmp-run-tests.mjs`（vitest node API + `pool: threads` + `config: false`）：

```
node .tmp-run-tests.mjs <test-file> [...]
```

**下一步**：T5（前缀投影只读预估）
### 2026-10-19 · T5 E4c：大纲前缀只读预估 + 字数体检接入（完成）

**做了什么**

- 新增 `src/shared/outline-prefix-budget.ts`：
  - `estimateOutlinePrefix()`：算「整段前缀」与「投影后」各多少字、token 区间、省下比例；
  - `planOutlinePrefixBudget()`：再加「按当前速度还能写几章」（整段 / 投影后）；
  - `renderOutlinePrefixBudget()`：可读日志；
- `src/services/workflows/commands/architecture.command.ts`：
  - 新增 `summarizeOutlinePrefix()`（只读，打日志）与 `summarizeOutlineLength()`（字数体检）；
  - 新增私有 `listOutlineChapterLengths()`：从大纲正文逐章切字数；
  - 调用点：`execute` 里 `summarizeUnitBudget` 之后，两行日志；**不改提示词、不改批次范围**；
- 新增测试：`outline-prefix-budget.test.ts`（16 条）、`outline-budget-report.test.ts`（8 条）。

**关键口径（两处踩坑后修正）**

| 坑 | 后果 | 修法 |
|---|---|---|
| L4「最近 K 章」被当成独立层叠加在 L2 上 | 顶层算出的投影体积**比整段还大**（7500 > 6001） | L4 是 L2 的**子集**，改成 `max(L2, 最近K章)`，不叠加 |
| 第一卷也算「上一卷交接单」1,500 字 | 第一卷凭空多出体积，savedRatio 变负 | `locateVolume` 返回 `majorIndex`，只有 `majorIndex > 1` 才计 L3 |

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| 新增 2 个测试文件 | ✅ 24 passed |
| 回归：`unit-budget-report` + `plot-outline-batch.command` + 新报告 | ✅ **57 passed** |

**下一步**：T6（滚动条可见性修复，E4j-1）
### 2026-10-19 · T6 E4j-1：滚动条可见性（完成）

**做了什么**

- `src/components/editor/CodeMirrorEditor.tsx` 的 `.cm-scroller` 主题：
  - 加 `scrollbarGutter: "stable"`（预留槽位，内容不再因出现/消失而抖动）；
  - `scrollbarWidth: "thin"` + `scrollbarColor`（Firefox）；
  - 显式 `::-webkit-scrollbar` / `-thumb` / `-thumb:hover`（细条 + 悬停变亮）。

**为什么之前「看不见滚动条」**：`.cm-content` 是 `max-width:800px; margin:0 auto`，滚动容器却是整个视口宽——滚动条被推到最右边，宽屏下离正文 800px 远。

**验证**：`npx tsc --noEmit` ✅ exit 0。视觉需在 `pnpm dev` 里实际看一眼（本机无法跑浏览器 E2E）。

---

### 2026-10-19 · T7 E4j-2：切 Tab 保留浏览进度（完成，墓碑路径）

**做了什么**

- 新增 `src/components/editor/editor-scroll-memory.ts`（**旁路记忆，不进 store**，避免滚动这种高频事件触发重渲染）：
  - `rememberEditorScroll` / `restoreEditorScroll`（CodeMirror：`scrollTop` + 光标 anchor/head）；
  - `rememberElementScroll` / `restoreElementScroll`（普通 `overflow-y-auto` 容器）；
  - LRU 裁剪 `EDITOR_SCROLL_MEMORY_LIMIT = 20`；`clearEditorScrollMemory()` 供切项目用；
- `CodeMirrorEditor`：新增 `scrollMemoryKey` prop；卸载前 `remember`，挂载后下一帧 `restore`；
- `ArchFileViewer`：传 `scrollMemoryKey={`arch-file:${tabId}`}`；
- `ReviewReport`：新增 `scrollMemoryKey` prop，钩子挂在 **Session 子组件**（外层每换报告会重建 Session）；
- `EditorArea`：传 `scrollMemoryKey={`review-report:${activeTab.id}`}`；
- 测试：`editor-scroll-memory.test.ts`（9 条）。

**关键决策**

| 决策 | 理由 |
|---|---|
| 模块级 Map，不用 Zustand | 滚动是高频事件，进 store 会触发重渲染；这里只做旁路记忆 |
| `scrollTop === 0` 时不覆盖目标 | 避免把「本来就停在顶部」误当成「恢复成顶部」 |
| 光标位置一起记 | 成本几乎为零，审稿对照场景差别明显 |
| **暂不做 LRU 4 实例** | 墓碑路径已能解决「回到顶部」；实例保留涉及 `EditorArea` 只渲染当前 tab 的结构性改动，单独一轮 |

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| 新增 9 条 + 回归批次（5 个文件） | ✅ **166 passed** |
| `project-clear-repositories.test.ts` | ⚠️ **环境不可用**：`better-sqlite3` 原生模块与当前 Node ABI 不匹配（NODE_MODULE_VERSION 145 vs 137），7 条既有测试报错，与本次改动无关 |

**下一步**：T10（E4i 全量清除补弧光 —— 代码已改，测试等 `pnpm rebuild` 后才能验）
### 2026-10-19 · T8 E4j-3（上半）：卷 / 单元 只读树的数据层（完成）

**做了什么**

- 新增 `src/shared/arc-tree.ts`：
  - `buildArcTree(plan)` → `ArcTree { volumes[{ index, name, line, units[{ index, name, line, hand, tier }] }], twoLevel }`；
  - `arcTreeUnitCount(tree)`：折叠时显示「N 单元」；
- 新增 `src/shared/__tests__/arc-tree.test.ts`（8 条）。

**关键设计**

| 决策 | 理由 |
|---|---|
| **不改 `parseArcStructure`** | 它的职责是「文本 → 结构」，树只需要额外一个「行号」；独立扫行号，不往核心解析器塞视图字段 |
| 标题扫描与解析结果**数量必须对上**，否则返回 `null` | 出半棵树比不出树更糟（点击跳转会错位） |
| 单元徽标从「逼法」标注读 `hand` / `tier` | 与 `auditTwoLevelDensity` 同一份正则语义；让「相邻两单元同类」一眼可见 |
| 无标注时 `hand`/`tier` 为 `null`，**不编** | 与全仓「不给看起来合理的默认值」一致 |

**验证**：`npx tsc --noEmit` ✅；新测试 8 条 ✅ passed。

**剩余（下半）**：树组件本身（左侧抽屉、可 pin、与文本折叠共享状态、点击跳转）。
需在 `pnpm dev` 里做视觉验证——本机无法跑浏览器 E2E。
### 2026-10-19 · T8b E4j-3：卷/单元树 UI（完成）

**做了什么**

| 文件 | 改动 |
|---|---|
| `src/components/editor/ArcStructureTree.tsx`（新增） | 只读树组件 + `readArcTreeState` / `writeArcTreeState`（sessionStorage，按项目+文件隔离） |
| `src/components/editor/CodeMirrorEditor.tsx` | 新增 `revealLine: { line, nonce }`：跳到指定行并选中标题行 |
| `src/components/editor/ArchFileViewer.tsx` | 工具栏「结构树」按钮；pin 时左树右文、不 pin 时浮层抽屉；接 `buildArcTree` |
| `src/components/editor/__tests__/arc-structure-tree.test.ts`（新增） | 6 条：默认折叠、pin、按项目隔离、损坏 JSON、非法序号过滤 |

**作者三条裁定的落点**

| 裁定 | 实现 |
|---|---|
| 「默认当然是折叠状态」 | `DEFAULT_STATE = { pinned: false, expanded: [] }`，打开即全折叠 |
| 「但要允许人家全量展开」 | 头部一个「展开 / 折叠」按钮，一键全展开或全折叠 |
| 「可折叠抽屉 + 能选择性固定住」 | 默认浮层抽屉；pin 后变常驻侧栏（左树右文）|

**几个实现细节**

| 细节 | 理由 |
|---|---|
| `revealLine` 用 `{ line, nonce }` 而不是纯行号 | 同一行连点两次也要生效——作者期望「再跳一次」而不是「什么都没发生」 |
| `view.dispatch` 里带 `EditorView.scrollIntoView` | 只设选区的话 CodeMirror 不一定滚动（视口外） |
| 树只读、编辑仍在右侧 | markdown 自由格式不可能无损往返，可编辑树 = 两份事实 |
| 折叠/pin 存 `sessionStorage` | 视图偏好不是作品数据；换项目「轻装上阵」（作者原话） |
| 单元徽标只显示「交手」类型，档位放 tooltip | 抽屉宽 256px，全部塞进去会换行 |

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| 合并回归（9 个文件） | ✅ **197 passed** |
| 视觉验证 | ⚠️ **未做**——需要在 `pnpm dev` 里看一眼抽屉/pin/跳转（本机无法跑浏览器 E2E） |

**已知待办**

- 与**文本折叠**共享状态（设计稿 §7A.1 要求「树节点折叠 + 文本折叠共享同一个折叠状态」）；
  当前只做了树的折叠，文本侧仍是整篇（CodeMirror 折叠需要 `foldGutter` 或自定义 facade）。
- 窄屏 pin 后正文 <600px 时自动退回抽屉（设计稿 §7A.1b 提到，未实现）。

---

### 2026-10-19 · T12 E4j-2b：切 Tab 保留浏览进度**全量覆盖**（完成）

**作者指出的缺口**

> 「T7 的 Tab 进度保留只做成了审稿链，不是全部——卷单元和情节大纲之间切换，是没有进度保留」

T7 只给 `ArchFileViewer`（卷单元页）与 `ReviewReport`（审稿报告）传了 `scrollMemoryKey`，
**其余所有 Tab 一个都没传**，于是它们根本不会 remember/restore。

**根因（两层，缺一不可）**

| 层 | 现象 | 根因 |
|---|---|---|
| 1. key | 大多数 Tab 压根不记 | `scrollMemoryKey` 是可选 prop，只有两个调用点传了 |
| 2. 时机 | 记了也白记 | 恢复只跑**一次** `requestAnimationFrame`；而 `ArchFileViewer` 切 Tab 时是**异步**先清空再 `setEditorContent`，CodeMirror 重建文档后 `scrollTop` 被重置为 0——那一帧 restore 早就跑完了 |

**做了什么**

| 文件 | 改动 |
|---|---|
| `CodeMirrorEditor.tsx` | `scrollMemoryKey` → `scrollMemoryKeyProp`，并**所有 Tab 兜底**：`scrollMemoryKeyProp ?? (filePath ? "doc:" + filePath : undefined)`——DraftEditor / ChapterCardEditor / 正文包装层只要给了 `filePath` 就自动获得记忆 |
| `CodeMirrorEditor.tsx` | 恢复逻辑从「一次 rAF」改成「**重试到内容稳定**」：连续 2 帧 `view.state.doc.length` 不变才 `restoreEditorScroll`，最多约 20 帧 |

**关键决策**

| 决策 | 理由 |
|---|---|
| 兜底 key 用 `doc:<filePath>` 而非 `tabId` | 同一份文档可能在不同 tab 打开；按文档记比按 tab 记更符合「回到我上次看的地方」 |
| 恢复要「内容稳定」而非「挂载即可」 | 内容是被异步灌进来的，挂载瞬间 `doc.length === 0`，此时 restore 一定失败 |
| 最多 20 帧就放弃 | 文档超过 ~330ms 还没稳定，说明不是正常灌内容，再等只是浪费 |

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `editor-scroll-memory.test.ts` | ✅ 9 passed |

**遗留**

- 真正的「切 Tab 不卸载实例」（LRU 4 实例）仍未做——本任务是**墓碑路径的全量覆盖**，
  实例保留涉及 `EditorArea` 只渲染当前 tab 的结构性改动，按 §7A.3 单独立项。

---

### 2026-10-19 · T13 E4j-4：情节大纲三层树（完成）

**作者提出的问题**

> 「现在的情节大纲生成以后，是不是跟卷纲之间的关联性丢失了？也就是说，我随便挑一章，问你它属于哪一卷、哪一单元，还能找出这种关系么？……大纲的内容长度将会比卷纲的长度还要长，那么卷纲都有一个树形目录，大纲更有理由增加一个了。」

**先答问题：关联是「算出来的」，不是「存下来的」**

- 大纲正文里**没有**归属字段，每章只有「覆盖：」行（写一次性转折位 ID 或「无」）；
- 真实项目 10 章里 **8 章写「覆盖：无」**，仅 ch3=`M1-1/逼法`、ch9=`M1-2/逼法`；
- 归属由 `arcSpanForChapters`（卷/单元区间**按计划等分折算**）反推 ⇒ **某单元写超，后面整体错位**。

⇒ 所以树上必须**显式暴露「这个归属是折算的」**，否则作者会把它当成事实去校对。

**做了什么**

| 文件 | 改动 |
|---|---|
| `src/shared/outline-tree.ts`（新增，153 行） | `buildOutlineTree(plan, synopsis, totalChapters)` → `OutlineTree{ volumes[].units[].chapters[], twoLevel, computedCount, mismatchCount }`；每章带 `source: declared / computed / mismatch`、`declaredId`、`line`、`title`；`unitIndexFromCoverId("M1-2/逼法")` → 2 |
| `src/shared/__tests__/outline-tree.test.ts`（新增） | 7 条：声明/折算/不一致三态、行号、缺参 fail-open、章数缺失 |
| `src/components/editor/OutlineTreePanel.tsx`（新增） | 三层树 UI + `readOutlineTreeState`/`writeOutlineTreeState`（sessionStorage，独立 key `outline-tree:`） |
| `src/components/editor/ArchFileViewer.tsx` | 取 `plotStructurePlan` + `totalChapters`（复用已有的 `db:project-core-get` effect）；工具栏「大纲目录」按钮；pin 左树右文 / 浮层抽屉；点击章节点 → `revealLine` 跳行 |

**关键口径**

| 口径 | 做法 |
|---|---|
| **数据来源是两份文档** | 大纲文件里没有卷单元结构 ⇒ 必须从 `project_core.plot_structure_plan` 取；`arcSpanForChapters` 还要 `totalChapters` 当分母 |
| 归属判定优先级 | 有「覆盖：<本卷某个单元>」⇒ 用它并比对折算结果；否则用折算值 |
| 跨卷声明 / 序号越界 | 一律按折算处理（比对无意义） |
| 解析不出章级条目 | 返回 `null`，面板显示「大纲还没有章级条目」而不是半棵树 |
| 视图偏好**与卷纲树分开存** | 节点键不同（卷纲按卷序号，大纲 `v:1` / `v:1:u:2`），混存会互相污染 |
| 章节点三态 | `declared` 无标记 / `computed` 灰空心圈 / `mismatch` 琥珀警示点——**漂移的早期信号** |

**与卷纲树的差异（有意为之）**

| 项 | 卷纲树 `ArcStructureTree` | 大纲树 `OutlineTreePanel` |
|---|---|---|
| 层级 | 卷 → 单元 | 卷 → 单元 → **章** |
| 节点行号来自 | 独立扫 title 行 | 章：`## 第 N 章` 标题行 |
| 额外信息 | 单元徽标（交手/档位） | **归属来源标记** + 顶部汇总（N 章折算 / N 章不一致） |

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `outline-tree.test.ts` + `arc-tree.test.ts` | ✅ **15 passed** |
| 视觉验证 | ⚠️ **未做**——需在 `pnpm dev` 里看抽屉/pin/跳转 |

**已知待办**

- 章节点点击跳转只做「滚到章标题」，没做「高亮整章范围」；
- 若作者手工在大纲里插入/删除章，`line` 会立即失效（重新构建即可，因为树是纯函数派生）。


### 2026-10-19 · T14 E4j-2c：切 Tab 进度**仍然**丢失的真根因（完成）

**作者反馈（第二轮）**

> 「重启以后已经看到了章节大纲的树目录，非常不错，这体验一下子就上去了。但是章节大纲和卷单元的 Tab 之间互切，依然没有看到进度的保留，还是会刷到页顶。」

T12 给所有 Tab 兜底了 memory key、也改成「内容稳定后重试恢复」，但**恢复从没成功过**——因为进度压根没被记住。

**真根因：remember 挂在 passive cleanup，那时 ref 已为 null**

React 卸载删子树时的顺序是：**layout cleanup → 摘 DOM / 摘 ref → passive cleanup**，而 `<CodeMirror>` 内部的 EditorView 也在 layout 阶段销毁。所以 T7/T12 写在 `useEffect`（passive）cleanup 里的 `rememberEditorScroll(scrollMemoryKey, editorRef.current?.view)` 拿到的永远是 `null`，而记忆模块对 `!view` 是**静默 return** 的——于是「存」这一步从来没发生过。`ReviewReport` 的普通 div 容器同理。

**怎么证实的（不是猜）**

用 Playwright 写探针，在真实 `@uiw/react-codemirror` 上分别读两个时机：

| 时机 | 读数 |
|---|---|
| layout cleanup | `{ scrollTop: 800, connected: true, destroyed: false, docLen: 22291 }` |
| passive cleanup | `null` |

⇒ 修复方向确定：**把 remember 挪到 `useLayoutEffect` 的 cleanup**。

**做了什么**

| 文件 | 改动 |
|---|---|
| `src/components/editor/CodeMirrorEditor.tsx` | remember 移到 `useLayoutEffect` cleanup；新增 `scrollLiveRef`（只有真发生过 scroll 事件才落账，挡 StrictMode 双跑把旧进度写成 0）；恢复成功后同时标记 live |
| `src/components/editor/ReviewReport.tsx` | 同一处修复（`useLayoutEffect` cleanup + `reportScrollLiveRef`） |
| `src/components/editor/__tests__/CodeMirrorEditor-scroll-memory.browser.tsx`（新增） | 3 条浏览器回归测试：①滚到中途切走再回来位置还在 ②滚回顶部再切走记的是顶部 ③没滚动过就不落账 |

**关键决策**

| 决策 | 理由 |
|---|---|
| 用 `scrollLiveRef` 而不是「每次都存」 | `main.tsx` 开着 `React.StrictMode`，dev 下挂载后 effect 会「清理 → 重跑」一次；照写会把手里的旧进度覆盖成 0 |
| 判定用「发生过 scroll 事件」而非「读数 > 0」 | 作者把长文档拉回顶部再切走时，记 0 才是对的；而 StrictMode 双跑是同一个同步批次、早于任何 scroll 事件派发，不会误伤 |
| 测试必须能**证伪** | 临时把 remember 改回 passive cleanup 重跑：用例 ① 按预期失败（`readEditorScrollMemory(KEY)` 为 undefined），确认测试测的是真行为而不是空转 |

**测试环境坑（写在这里防下次踩）**

浏览器测试不加载项目 CSS，Tailwind 类全失效 ⇒ CodeMirror 没有高度约束，`.cm-scroller` 的 `clientHeight === scrollHeight === 6225`，写 `scrollTop` 直接被夹回 0（会误判成修复无效）。仅给 `.cm-scroller` 设高也无效（CM 自身样式压过内联/低优先级规则）。**必须先钉 `.cm-editor { height: 160px !important }`，scroller 的百分比高度才有参照。**

**验证**

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx eslint`（3 个改动文件） | ✅ 无输出 |
| `CodeMirrorEditor-scroll-memory.browser.tsx` | ✅ 3 passed |
| `CodeMirrorEditor-draft-units.browser.tsx`（回归） | ✅ 1 passed |
| `editor-scroll-memory.test.ts`（回归） | ✅ 9 passed |
| 真实 GUI 人工验证 | ⚠️ **待作者在 app 里确认**：情节大纲 ↔ 卷单元互切后位置保留 |

**下一步**

- 作者确认后，视情况再评估 §7A.3 的 LRU 4 实例（墓碑路径已可用，实例保留能让光标/撤销历史也保留）。
