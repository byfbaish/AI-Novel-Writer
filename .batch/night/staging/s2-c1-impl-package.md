# C1 实施包 · 角色相关性筛选 + 重生成字段级并排对比

- 卡：`744f13a8-7a5c-49dc-beab-9e0d7259cc4e`「C1：角色相关性筛选 + 重生成字段级并排对比」
- 判定面起点：`95a30ae6c406fa898636f88456eafb8c73bb6891`（`git rev-parse HEAD`，porcelain 仅 `?? .batch/night/reports/planui-design-assessment.md`）
- 建议分支：`card/s2-c1-relevance-and-diff`
- 设计稿（唯一口径）：`docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md`（190 行 / 15,488 B / `2811765e…`）
- 出包人：developer（本包不含生产码实现；实现由外派执行，QA 判）

---

## 0. 结论先行

C1 是两块互不依赖的活，建议**同一分支两笔提交、一次外派**：

| 批次 | 内容 | 是否需要 DB 迁移 | 判据 |
|---|---|---|---|
| C1-a | 相关性筛选三档 + 命中原因标签 + 两档排序（纯函数 + `CharactersView`） | 否 | 判据 1–2 |
| C1-b | 字段级并排 diff 纯函数 + 三选一 + 快照表 + 逐字段回退（新 lane M31 + IPC + service） | 是（M31） | 判据 3–8 |

理由：C1-a 无迁移无 IPC，判据全 `[static]/[mock]`，先落可先把「一眼筛」用起来；C1-b 触碰迁移链与角色名册提交事务，风险与回归面差一个量级。若 admin 要求一次交付，两笔提交仍必须分开（便于单独回退）。

---

## 1. 事实基线（本包每条都已实测，行号可复核）

### 1.1 相关性筛选的落点

| 事实 | 位置 |
|---|---|
| 列表过滤只有「名字搜索」 | `src/components/panels/sidebar/CharactersView.tsx:62-65`（`normalizedQuery` → `filteredCharacters`） |
| 分页 | 同文件 `:66-71`（`CHARACTER_PAGE_SIZE = 50` 在 `:26`） |
| 「全选」已按当前筛选结果（含未显示页） | 同文件 `:96-101` |
| 行渲染与副标题（同名用背景/ID 后缀区分） | 同文件 `:208-245`，副标题在 `:239` |
| 顶部操作栏（放三档勾选与排序的位置） | 同文件 `:143-167`；搜索框 `:196-205` |
| 空态与「没有匹配的角色」 | 同文件 `:246-257` |
| 角色条目字段（含 `relationships` / `currentState`） | `src/shared/character-roster.ts:75-102` |
| 蓝图角色同步记录（档②的数据源） | `src/shared/ipc-channels.ts:1076-1088`（`db:blueprint-character-sync-list-pending` / `-list-all`） |
| 大纲/世界观三串（档③的数据源） | `db:project-core-get`（`src/shared/ipc-channels.ts:997`），字段契约见 `src/shared/plot-outline-contract.ts:166-177`（`plotOutlineExpected` 逐字段取用） |

### 1.2 重生成对比的落点

| 事实 | 位置 |
|---|---|
| 提案面板（受控视图，宿主持有确认） | `src/components/characters/CharacterProposalSelectionPanel.tsx:16-22`（props）、`:15` 注释「host owns confirmation」 |
| 现有「一段说明」两段文案（要升级成对比屏的位置） | 同文件 `:46-51` |
| 重建语义判定 | 同文件 `:44` ← `src/shared/character-proposal.ts:92`（`kind==='generation' && inputKind==='architecture'`） |
| 逐项四选一选择器 | 同文件 `:107-129`（`map/create/functional/keep-unresolved`） |
| 决策类型（三选一**不得**新增类型） | `src/shared/character-proposal.ts:60-72` |
| 默认选择器（三选一只改默认） | `src/services/character-proposal-choices.ts:35-38`（`createCharacterProposalChoices`） |
| 重建覆盖的实际发生点（主进程） | `electron/services/character-proposal-service.ts:723-767`（`replaceAdoptedCharacterFields` `:742-752`、退休 `:760-767`） |
| 原子提交与 revision 自增 | `electron/services/character-proposal-service.ts:784` → `electron/repositories/character-roster-repository.ts:1180`（`commitCharacterIdentities`），事务在 `:1188`，revision 校验 `:1213` |
| 作者手改字段的归属（回退要避开） | `character-proposal-service.ts:746` `authorOwnedFields(existing.provenance)` |

### 1.3 迁移与 IPC 的既有范式

| 事实 | 位置 |
|---|---|
| 迁移链到 M30，M30 = `from:30 → to:31` | `electron/migrations/desktop-registry.ts:221-226`；新 lane 必为 M31（`from:31 → to:32`） |
| 注册表构造与指纹集 | 同文件 `:226-250`（`createMigrationRegistry([m00…m30], [...schemas])`），M30 用 `schemas(31)`，M31 须 `schemas(32)` |
| lane 迁移文件范式（幂等 + `PRAGMA table_info` verify + `created_at` 由应用写 ISO） | `electron/migrations/m08-structured-refs-and-cast-decisions.ts:16-76`（表定义 `:26-39`、幂等 `:49-54`、verify `:56-66`、`createM08Migration` `:69-76`） |
| 基线不可动 | `electron/migrations/baseline-schema.ts:10-15` |
| IPC 类型表 | `src/shared/ipc-channels.ts`（角色名册读取 `db:character-roster-read` 的类型定义在同文件 `:1090` 附近，handler 在 `electron/controllers/db-controller.ts:815`） |
| lane 迁移测试范式 | `electron/migrations/__tests__/m30-draft-edit-stats.test.ts` |

### 1.4 回归面：同一面板/收件箱的既有调用方（**改面板必须全过**）

| 调用方 | 位置 | 影响的语义 |
|---|---|---|
| `CharacterProposalInbox` | `src/components/characters/CharacterProposalInbox.tsx:164` | 待处理候选；确认按钮 `:167` → `decide('approve')` `:111` → `character-proposal:approve` |
| `FinalizedCharacterProposalPanel` | `src/components/characters/FinalizedCharacterProposalPanel.tsx:94` | 定稿正文里出现的新角色（增量语义，非重建） |
| `BottomPanel`（生成任务面板） | `src/components/panels/BottomPanel.tsx:395` | 生成 run 内的提案，架构重建走这里 |
| `CharactersView` 挂载收件箱 | `src/components/panels/sidebar/CharactersView.tsx:192-195` | 列表上方四块面板，顺序不可乱 |

> **`src/components/dialogs/ArchitectureConfirmDialog.tsx` 不在本卡白名单**：C1 的触发点是角色提案（上面四处），不是架构生成确认弹窗。该文件由 P6 档 1 独占——本卡任何人不得改它，避免两卡同改一行。

---

## 2. 白名单（多一个文件都算越界）

### 2.1 新增（11）

| # | 文件 | 作用 |
|---|---|---|
| 1 | `src/shared/character-relevance.ts` | 纯函数：三档命中 + 排序比较器 |
| 2 | `src/shared/__tests__/character-relevance.test.ts` | 判据 1–2 单测 |
| 3 | `src/shared/character-regeneration-diff.ts` | 纯函数：字段并排、按句切分、差异计数、三选一→决策 |
| 4 | `src/shared/__tests__/character-regeneration-diff.test.ts` | 判据 3–4 单测 |
| 5 | `src/components/characters/CharacterRegenerationDiffPanel.tsx` | 对比屏（表 + 三选一 + 差异高亮） |
| 6 | `src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx` | 判据 2/3/4 的渲染面 |
| 7 | `electron/migrations/m31-character-regeneration-snapshots.ts` | 新 lane 表（§4.2 五列） |
| 8 | `electron/migrations/__tests__/m31-installed-lane.test.ts` | 判据 5 |
| 9 | `electron/repositories/character-regeneration-snapshot-repository.ts` | 写快照 / 读快照 / 逐字段回退 |
| 10 | `electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts` | 判据 6–8 的仓储层 |
| 11 | `src/components/characters/__tests__/characters-view-relevance.browser.tsx` | 判据 2 的列表面（三档 + 排序 + 只标不勾） |

### 2.2 修改（7，逐处说明）

| # | 文件:行 | 改什么 | 边界 |
|---|---|---|---|
| 12 | `src/components/panels/sidebar/CharactersView.tsx:143-167`、`:196-205`、`:208-245` | 顶部加三档勾选 + 排序单选；行内加命中原因标签（`:239` 副标题下方新增一行） | 不动 `:62-71` 的搜索/分页逻辑结构；`visibleKeys`/全选语义 `:96-101` 保持「当前筛选结果」 |
| 13 | `src/components/characters/CharacterProposalSelectionPanel.tsx:46-51` | 在说明文案下方插入 `<CharacterRegenerationDiffPanel>`（仅 `rebuild === true` 时渲染） | 不动 `:52-69` 列表结构、不动 `:107-129` 四选一 |
| 14 | `src/services/character-proposal-choices.ts:35-38` | `createCharacterProposalChoices` 接受可选 `strategy`，按三选一生成默认 `selections` | 默认值必须与现状逐项相同（不传 strategy 时行为零变化） |
| 15 | `src/shared/ipc-channels.ts:1105-1108` 之后 | 新增 2 条通道：`db:character-regeneration-snapshot-read`、`db:character-regeneration-field-rollback`（`db:blueprint-character-sync-list-all` 已存在 `:1081-1084`，勿重加） | 只加通道，不改既有通道签名 |
| 16 | `electron/controllers/db-controller.ts:815` 之后 | 注册上一条的 handler（读快照 / 回退） | 沿用 `expectedProjectPath` 项目会话校验写法 |
| 17 | `electron/migrations/desktop-registry.ts:221-226` 与 `:226-250` | 注册 M31，补 `schemas(32)` 指纹集 | 不得改动 m00–m30 任何一行 |
| 18 | `electron/services/character-proposal-service.ts:784` 前后 | 在**同一事务**内：提交前把被覆盖卡的旧字段写成快照行；`operationId` 用 `request.operationId` | 不改 `:723-767` 的覆盖/退休判定；不改 `commitCharacterIdentities` 的签名与校验 |

---

## 3. 判据（卡 prompt 六条 + 设计稿 §6 八条 → 落成可判）

| # | 层 | 判据（可判形态） | 证据 |
|---|---|---|---|
| J1 | [static] | `src/shared/character-relevance.ts` 导出纯函数 `characterRelevanceHits(entry, ctx)`，返回 `('relationship'｜'blueprint'｜'outline')[]`；无 IO、无 `import` 自 electron/store | 文件 + `tsc --noEmit` `EXIT=0` |
| J2 | [mock] | 5 张卡（仅关系 / 仅蓝图 / 仅大纲 / 全不中 / 全中）→ 标签逐行符合设计稿 §3.1；「每行最多 2 条，多余 +N」；未命中显示「无剧情线索」且**仍在列表**；三档全开时结果集 = 未筛；关掉某档只减不隐 | `character-relevance.test.ts` + `characters-view-relevance.browser.tsx` |
| J3 | [mock] | `buildRegenerationDiff(oldEntry, candidate)`：5 组固定顺序（名字/身份/背景/关系/当前状态）；组内按 `。！？；`（英 `. ! ? ;`）切句；**去空白后相等＝灰行且不计差异**；候选为空字段标「候选为空·保留现值」且**不计差异数**；返回 `{rows, differentFieldCount}` | `character-regeneration-diff.test.ts` |
| J4 | [mock] | 三选一 → `CharacterProposalDecision[]`：`全部覆盖`＝现状默认（`map`／`create` 原样）；`保留旧卡`＝所有同名项 `keep-unresolved` 且不新增卡；`逐张确认`＝不改动作者已有选择（透传） | 同上 + 面板 browser 测试点三条 |
| J5 | [static] | M31 建表后：`PRAGMA table_info(character_regeneration_snapshots)` 含 §4.2 五列；重复执行幂等；**M00 基线指纹不变**（旧项目 `probeSchema` 仍识别）；`user_version` 由 31 → 32 | `m31-installed-lane.test.ts` |
| J6 | [live] | 真实 Electron + 真实 SQLite：一次架构重建（`全部覆盖`）确认后，被覆盖卡存在按 `operation_id` 可读的快照；对某字段回退 → 该字段回到旧值、roster `revision` 自增、其他卡不变 | 一卡一脚本 + 截图 + 库读原文 |
| J7 | [live] | `source_revision` 与当前 revision 不一致（模拟人手改）时回退**被拒绝**，返回明确错误（如 `CHARACTER_REGENERATION_ROLLBACK_STALE`），roster 内容不变 | 同上 |
| J8 | [live] | 无快照的旧批次：回退入口不渲染、不报错（只显示只读差异） | 同上 |

分层说明：J6–J8 属真实主进程 + DB，按群规必须 `[live]`；未跑成写「未跑成 + 报错原文」，不得用 mock 顶替。

---

## 4. 关键实现约束

### 4.1 相关性筛选三条硬约束

1. **只标不勾**：三档只影响「显示与标签」，`picked` 数组只能由作者点选/全选按钮改变（`CharactersView.tsx:96-101` 语义不变）。
2. **并集，不留交集器**：三档全是「或」；默认全开；不做排除档（设计稿 §7.2）。
3. **匹配口径**：中文逐字子串、英文大小写不敏感；**不做别名/代称**（设计稿 §3.2 第 1 条）。档②数据未就绪（新项目没蓝图）时该档命中恒空，**不得报错、不得当作全不中**。

### 4.2 快照表 `character_regeneration_snapshots`（新 lane，M31）

```
operation_id   TEXT NOT NULL      -- 本批 operationId；一次覆盖一组行
character_id   TEXT NOT NULL
source_revision INTEGER NOT NULL  -- 覆盖前 roster revision
field_json     TEXT NOT NULL      -- 覆盖前整卡字段 JSON
created_at     TEXT NOT NULL      -- 应用写 ISO 字符串（禁用 datetime('now')，同 M08 :22-25）
PRIMARY KEY (operation_id, character_id)
CREATE INDEX idx_character_regeneration_snapshots_operation ON character_regeneration_snapshots(operation_id);
```

- 落库时机：`electron/services/character-proposal-service.ts:784` 之前、**同一个 `db.transaction`** 内（`commitCharacterIdentities` 自身在 `:1188` 开事务，外层包一层＝savepoint，原子性成立）。
- 回退实现：`commitCharacterIdentities(db, { approval: { action:'author-edit', source:{kind:'author', …}, expectedRevision: sourceRevision }, changes:[{characterId, fields}] }, …)`——**复用作者手改通道**，天然自增 revision 并留审批记录；**不得**新增第二条写名册的路径。
- `source_revision !== 当前 revision` ⇒ 抛错拒绝（J7），**不强制覆盖**。
- 表名与列名照抄本包，不得改名（QA 按字面核对）。

### 4.3 三选一只改默认选择

- 不新增 `CharacterProposalDecision` 变体（`src/shared/character-proposal.ts:60-72` 不得改）。
- `保留旧卡（跳过同名）`＝把**同名命中项**置 `keep-unresolved`，新名字仍按现有默认（该建卡的建卡）——这是「作者只想补新名字」的语义（设计稿 §4.4）。
- 策略状态不进 `ApproveCharacterProposalRequest`，只在 `CharacterProposalChoices` 内（`character-proposal-choices.ts:17-33`），最终仍由 `selections` 表达。

### 4.4 外派红线（逐条写进派单件）

1. 不改 M00 基线 DDL、不动 `electron/migrations/baseline-schema.ts:13-15`；新表只走 M31。
2. 不碰 `src/components/dialogs/ArchitectureConfirmDialog.tsx`（P6 独占）。
3. 不改重建语义（同名即同一人、空字段保留现值）；不改 `isArchitectureRebuildBatch` 判据。
4. worktree 里只跑单元测试（`node scripts/run-tests-electron.mjs <paths>`）与 browser 测试（`vitest.browser.config.ts`），禁全量、禁 `pnpm test` 裸跑（无 TTY 会 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`）。
5. 真实模型调用只准走 Magpie `group/ai-novel`（`http://127.0.0.1:3425/v1`），禁 `group/deepseek`；本卡正常不需要模型调用。
6. 不 commit、不 push、不动 develop；产物落 `C:\tmp\c1-s2\workbuddy\`。

---

## 5. 变异点（≥3，给 QA 复算；每发必须转红并写红掉的用例号）

| 号 | 靶 | 改法 | 期望转红 |
|---|---|---|---|
| M1 | 档② 蓝图未就绪守卫 | 删掉「同步记录为空 ⇒ 该档不产命中」守卫，改成抛错/或恒标命中 | J2 的「新项目无蓝图不报错」用例 |
| M2 | 差异比较的「去空白后相等」 | 改成直接 `!==` 比较（不去空白） | J3 的「仅空白差异不计差异」用例 |
| M3 | 三选一 `保留旧卡` | 把同名项改成 `map`（等价于全部覆盖） | J4 的「保留旧卡 ⇒ 全 keep-unresolved」用例 |
| M4 | 快照写入时机 | 把快照写入移到 `commitCharacterIdentities` **之后**并在其后抛错（或删掉该写入） | J7 的「stale revision 拒绝回退」前置夹具（无快照即失败） |
| M5 | 回退的 revision 校验 | 删掉 `source_revision !== current` 抛错分支 | J7 全条 |

> M1/M3/M4/M5 各至少 1 条断言转红；只红 0 条按「断言空」退回。

---

## 6. 命令（外派自测，原文贴回执）

```
node scripts/run-tests-electron.mjs src/shared/__tests__/character-relevance.test.ts src/shared/__tests__/character-regeneration-diff.test.ts electron/migrations/__tests__/m31-installed-lane.test.ts electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts
node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx src/components/characters/__tests__/characters-view-relevance.browser.tsx
node scripts/check-fast.mjs
```

汇总行必须出现 `Tests N passed`（不接受 `-t` 过滤）、`CF_EXIT=0`。

---

## 7. 本卡不做

- 不做逐字文本 diff；不做三档交集/排除；不做别名与代称；不加出场索引表；「最近出场」排序不做（设计稿 §5、§7）。
- 不做「字段级部分采用」（只覆盖背景、保留关系）；只做整卡三选一 + 覆盖后逐字段回退（设计稿 §8.3）。
- 不改 `ArchitectureConfirmDialog`；不动 P6 的章区间。

## 8. 待 admin 裁的两点

1. **拆两笔还是并一笔**：本包建议 C1-a / C1-b 两笔提交（§0）；若要求一笔，仍保两笔 commit。
2. **回退入口位置**：本包按设计稿 §4.5「弹窗每行提供回退」实现为「重建批次确认屏在批次已批准后仍可打开（读快照）」，需在 `CharacterProposalInbox` 的已批准批次历史里给一个入口——若 admin 认为已批准批次不该再出弹窗，则回退入口改挂角色编辑器，白名单要加 `src/components/editor/DraftEditor.tsx` 之外的编辑器面板（本包未含）。
