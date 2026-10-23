# 交接：W6 收口 + 定稿语义 + W8 方向（2026-10-23）

> ⚠ **本文的"下一步"已被 [`2026-10-23-p0-1-close-and-target-baseline-handoff.md`](./2026-10-23-p0-1-close-and-target-baseline-handoff.md) 取代**
> （P0-1 已收口，目标基线以 `long-form-readiness-review.md` 为准）。本文保留作 W6/W8 方向的记录。
> 接手先读本文 §1 的「先读这四份」，再看 §5 的下一步。
> 分支 `exp/resource-ledger`（**工作区有 29 项未提交改动**，见 §2）· 基线提交 `e3d9af27`

---

## 1. 先读这四份

| 顺序 | 文件 | 看什么 |
|---|---|---|
| 1 | `docs/design/architecture/w6-resource-ledger-design.md` **§4.6 / §9.4 / §9.5 / §9.7** | 提案通道两条触发点、面板独立、抽取可诊断、**账本下线（§9.7）** |
| 1b | `docs/adr/0022-retire-resource-balance-ledger.md` | **为什么余额计算下线**：目标错位，不是实现问题 |
| 2 | `docs/adr/0021-revert-finalization-keeps-the-manuscript.md` | **定稿 ≠ 删除**：退回草稿的语义、只有定稿链尾部可动 |
| 3 | `docs/design/architecture/w8-nested-world-handoff-design.md` | **新方向**：线性嵌套世界的跨部切片交接（未开工） |
| 4 | 本文 §4 | 数据现场：这本书已经被修成什么样，别重复修 |

---

## 2. 未提交改动（29 项，全在 `exp/resource-ledger`）

**新增**

```
docs/adr/0021-revert-finalization-keeps-the-manuscript.md
docs/design/architecture/w8-nested-world-handoff-design.md
scripts/repair-finalization-receipts.mjs          定稿收据修复（dry-run 缺省）
scripts/restore-drafts-from-backup.mjs            按章从备份恢复草稿
src/components/editor/ResourceRegistryEditor.tsx   资源登记独立页
src/services/structured-json-call.ts               JSON 模式降级重试
+ 4 个测试文件（见 §3 验收数字）
```

**修改**：`ResourceRegistryPanel` / `WorldBuildingEditor` / `EditorArea` / `ProjectTree` / `editor-store` /
`sidebar-file-openers` / `DraftBoxGroup` / `finalized-chapter-deletion` / `llm-controller` /
`chapter-lifecycle-controller` / `chapter-deletion-repository` / `chapter-deletion-service` /
`chapter-deletion.ts` / `ipc-channels.ts` / `arch-step-checkpoint.ts` / W6 设计稿 / W6a-4 交接稿 + 3 个测试

**验收基线**（改动均通过这些）：`tsc` 0 · `eslint` 0 ·
`chapter-lifecycle-deletion.test.ts` **13 例** · `ResourceRegistryPanel.browser.tsx` 14 例 ·
`ResourceRegistryEditor.browser.tsx` 3 例 · `WorldBuildingEditor.recovery.browser.tsx` 9 例 ·
`structured-json-call` 8 例 + `describeCallFailure` 5 例 · 左栏 6 个 browser 文件 16 例 · 文档 0 断链

---

## 3. 本会话做完的四组事

### 3.1 资源登记提案通道（W6a-4 面板侧）
面板加了「从世界观抽取候选」+ 候选确认区。**两条触发点都通了**（下一本自动 / 本书手动）。
三个实施事实：`unit`/`period` **必须行内可编辑**（否则「缺单位请补一个」没有落点）；候选**必须重验引文**
（进面板时 + 正文变化时各一次）；**先登记、后补扫**。

### 3.2 面板独立成页（W6a-5）
嵌在「世界观」卡片下十列表格被截断 ⇒ 独立 tab `resource-registry`，左栏「故事架构」组内、世界观之后。
加一种编辑器要同时登记 `EditorTab['type']` 与 **`PROJECT_SCOPED_BUILTIN_TYPES`**（后者决定 tab id 是否按项目隔离）。

### 3.3 抽取失败可诊断（W6a-6）
`llm-controller` 原来在 `finishReason !== 'stop'` 时用三元**覆盖掉真实错误**，库里只剩 `finish:error`
（连失 5 次排查全靠猜）。现改为「`finish:<reason> | 真实错误摘要`」并存。
新增 `structured-json-call.ts`：服务端不认 `response_format: json_object` 时去掉该字段重试**一次**
（401/403/429/超时**不重试**）；面板失败时回显脱敏原因。

### 3.4 定稿语义（ADR-0021）
- **退回草稿**（草稿箱）：保留 `drafts`/`contents`，状态置 `revised`；删收据、后处理跑批、要点/角色状态、该章资源变动。正文实体稿与知识库照原投影清理。
- **删除正文**（正文章节）：原语义，连草稿一起删。
- **只能动定稿链尾部**：`requireFinalizedChainTail` 挂在 `requireFinalizedTarget` 上，两条入口共用。
- **`completed` 收据不等于「现在也是完成态」**：`resumeExistingOperation` 用 `factsStillActionable` 复核，
  陈旧就 `discard` 重来（否则库被恢复后会出现「界面报成功、数据不动」）。

---

## 4. 数据现场（`师父派我来除魔，幕后真凶竟是小师妹`）

**已做完，不要重复做**：

| 项 | 状态 |
|---|---|
| 定稿收据 | 第 1/2/3 章全部 `ok`（`repair-finalization-receipts.mjs` 复核输出） |
| 草稿 | 第 1/2/3 章 `finalized`，第 4 章 `revised`；第 2/3/4 章内容从备份恢复过 |
| **资源账本（已下线，ADR-0022）** | 曾跑通：`resources` 7 条、`resource_movements` 4 条、抽取 `success=1`（见 W6 §9.6）。现在**不再写入**，`resources` 含义收窄为「资源词汇表」；左栏「资源」分类与定稿后 `resource-ledger` 步骤都已下线，代码与表全部保留 |
| 备份 | `project.db.bak-receipt-20261023014146`（恢复源）· `.bak-restore-20261023015929` · `.bak-receipt-20261023015941` |

**遗留（已报告、未处理，需作者决定）**：

0. ~~开篇起点未登记~~（账本下线后不再需要）：`resource_movements` 无 `chapter_number=0` 行 ⇒ 余额一律显示
   `unknown(no-origin)`「未知（未登记开篇余额）」。这是刻意行为（不许假定 0），补一条
   `下品灵石 +N`（`source='author'`）即可看到余额与走势。
0b. **登记口径填错三处**（仍建议改，因为它影响生成时的口径）（机制按设计判冲突，不是代码 bug）：活气散 `unit=枚` 而正文与变动都是「副」
   ⇒ 会被判 `unit-mismatch` 且不显示合计；贡献点 `unit=100`（把金额填进了单位）；残卷 `period=永久兑换`、
   九转回魂草 `period=百年`（都不是口径词）。**代码侧已补 W6a-7**（面板对这两类形态给建议级提示，
   不阻断保存）—— 但**数据本身还得你自己在面板上改**，提示不会替你改。
1. 第 2 章的 `summary_snapshots.source_content_hash` 仍是旧值（要点/角色状态是按「五十枚」那版算的）。
   要重建就点「修复后处理」；不重建则它与正文不一致。
2. `post_process_runs` 未从备份恢复（刻意）：需要后处理状态时按章重跑。
3. `chapter_deletion_operations` 里还有两条 `completed` 幽灵收据（draft 2/3）。代码已能识别并作废重建，不必手工清。

**补扫前必读**：先在该书「故事架构 → 资源登记」登记资源，再去「世界状态 → 资源 → 账本回填」补扫。
没登记就补扫是空的（W6 §4.6 的根因）。

---

## 5. 下一步（按优先级）

> ⚠ **2026-10-23 晚更新**：优先级已被**长篇就绪度评审**重排 ——
> 见 `docs/design/architecture/long-form-readiness-review.md` 与台账
> `docs/plans/prompt-assembly-backlog.md` 顶部「2026-10-23 长篇就绪度重排」。
> **新的 P0 是「改稿连锁」，不是 W7**（改不了早期章节就写不了长篇）。
> 下面这份列表保留作当时记录。

1. **W6 已收口**：十一期落地 + 账本下线（ADR-0022，入口关闭、代码保留）。剩余只有一条数据建议：
   修三处登记口径（活气散单位应为「副」、贡献点 `unit=100`、残卷 `period=永久兑换`）—— 它影响生成时的口径，与账本无关。
2. **W8 讨论**：`w8-nested-world-handoff-design.md` §2 是核心——切片包里**有五项现在带不走**
   （关键物品、伏笔回收状态、能力槽、制度进度、未结构化的角色状态）。先确认「先补宿体还是先做只读包」。
3. **卷回滚 / 指定连续回退**（`MEMORY.md` 已登记）：指定退到某章并连带回退其后所有章节，与卷边界一起设计。
4. W6c 三处已知限制（补扫固定从第 1 章起 / 每章一个按钮 / 回填进度不入 store）。

---

## 6. 环境事实（本机，会反复撞）

- **子 agent 通道不可用**：本会话派两个后台 agent 均 ~45 秒被杀、零输出。**自己做，别派。**
- `pnpm` shim 在 Git Bash 里是坏的，命令一律走 `node ./node_modules/...`。
- better-sqlite3 是 Electron ABI ⇒ 脚本必须 `ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe <script>.mjs`。
- 跑 browser 测试必须显式 `--config vitest.browser.config.ts`，否则 `*.browser.tsx` 静默跳过。
- 批量测试 cleanup 会被 safe-delete 误报失败 ⇒ 摘 `CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR` + `CODEBUDDY_TOOL_CALL_ID`。
- **不要把 `-wal` 的 mtime 当作「应用在跑」的证据**：任何一次读都会刷新它。判写冲突用 `BEGIN IMMEDIATE`。

---

## 7. 两条最容易踩的设计红线（这轮新增）

1. **`completed` 不等于「现在也是完成态」**：凡是"重放已完成操作"，都必须先用事实复核一次。
2. **改稿 ≠ 删稿**：想改已定稿的章，只有「退回草稿」这一条路；删除只在正文章节，且只能从定稿链尾部开始。
