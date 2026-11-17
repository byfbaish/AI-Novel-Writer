# P35 · 编辑计量接线：diff + 来源标记

- 时间：2026-11-14 15:3x（Asia/Shanghai）
- 仓库：`C:\develop\workspace\AI-writer\develop`（`git rev-parse --show-toplevel` 已确认，不是 wt-1）
- 分支：`exp/resource-ledger`
- 起点 HEAD：`9070999c2055da3ad4d617532b537b11a4ea3c13`（与投前核对一致）
- 授权：可改码；红线 1-4 已确认
- 红线执行：未做任何 git 写操作（add / commit / reset / checkout / stash / push 全未执行），因此**本卡改动尚未提交**；报告与信号已落盘。

## 一、落点与实现

### 1. 迁移与表

新增迁移：`electron/migrations/m30-draft-edit-stats.ts`（M30，30 → 31，owner `P35`）。

新建独立表 `draft_edit_stats`，列：

| 列 | 类型 / 约束 | 说明 |
|---|---|---|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | 事件行主键 |
| `draft_id` | INTEGER NOT NULL | 草稿 id |
| `at` | TEXT NOT NULL DEFAULT (datetime('now')) | 保存时刻 |
| `origin` | TEXT NOT NULL DEFAULT 'ai' | `human` / `ai`，缺省 ai |
| `changed_chars` | INTEGER NOT NULL DEFAULT 0 | 本次最小差异字数 |
| `old_chars` | INTEGER NOT NULL DEFAULT 0 | 覆盖前正文长度 |
| `new_chars` | INTEGER NOT NULL DEFAULT 0 | 覆盖后正文长度 |
| `save_count` | INTEGER NOT NULL DEFAULT 0 | 该草稿到这次保存的序号（1、2、3…） |

另建索引 `idx_draft_edit_stats_draft (draft_id, id)`。迁移的 apply 使用 `CREATE TABLE IF NOT EXISTS` + 先查 `sqlite_master` 再建，表/索引已存在时跳过；verify 只读检查表、索引、八列、主键、`NOT NULL` 与默认值。

连带同步（既有 lane 机制要求的六处）：

- `electron/migrations/registry.ts`：lane 追加 `M30 { from: 30, to: 31, owner: 'P35' }`；`LATEST_SCHEMA_VERSION = 31`。
- `electron/migrations/desktop-registry.ts`：`CURRENT_DESKTOP_SCHEMA_VERSION = 31`（整行格式未改）；import / apply / `schemas(31)` / `createM30Migration` / implementations / recognizedSchemas 全部补齐。
- `src/shared/project-storage.ts`：`MIGRATION_IDS` 末尾追加 `'M30'`。

未改 `baseline-schema.ts`，未改任何既有表的既有列。

### 2. handler 落点

`electron/controllers/db-controller.ts` 的 `db:draft-update-content`：

1. 现有项目路径校验、`getMeta`、finalized 拦截保持不变；
2. **在 `DraftRepository.updateContent` 之前**用 `ContentRepository.getBody(draft.contentId)` 读旧正文；
3. 算 `changedChars`；
4. 调 `DraftRepository.updateContent(id, content, wordCount)` 覆盖；
5. 调 `DraftEditStatsRepository.record(...)` 落一行；
6. 计量写入失败只 `console.warn`，不回滚、不改变正文保存结果。

新增仓储：`electron/repositories/draft-edit-stats-repository.ts`。`record` 在同一个 DB 事务里先取该草稿的 `MAX(save_count)+1`，再插入事件行，保证连续保存累加且每次保存都有独立记录。

### 3. 来源标记

- `src/shared/ipc-channels.ts`：`db:draft-update-content` 的 args 增加可选第 5 个业务参数 `origin?: 'human' | 'ai'`。
- handler 同签名；缺省（不传或非 `'human'`）一律记 `'ai'`。
- `src/components/editor/DraftEditor.tsx` 的 `doSave` 在 `projectSession.projectPath` 后只加一行 `'human'`，其余编辑器行为未动。
- AI 修稿路径不需要显式传 `ai`，继续用缺省即可。

## 二、`changedChars` 算法

一句话：**先削掉新旧正文的公共前后缀，再对变化中段做字符级 Levenshtein 编辑距离（替换 / 插入 / 删除各记 1 字）**；长度按 JS 字符串 UTF-16 code unit 计。

C3 样本（与单测同值）：

- 旧：90 个「甲」+ 10 个「乙」（100 字）
- 新：90 个「甲」+ 10 个「丙」（100 字）
- 期望 `changed_chars = 10`；单测实测 `10`。

## 三、测试与反证

命令（工程单测入口，`ELECTRON_RUN_AS_NODE=1`，纯 Node 运行时，不启动 Chromium / 应用进程）：

```powershell
node scripts/run-tests-electron.mjs run electron/migrations/__tests__/m30-draft-edit-stats.test.ts
node scripts/run-tests-electron.mjs run electron/controllers/__tests__/db-controller-project-context.test.ts
node node_modules/vitest/vitest.mjs run src/shared/__tests__/novel-contracts.test.ts
```

### 1) M30 迁移 / 累加（新增文件，3 条）

输出尾部：

```text
✓ electron/migrations/__tests__/m30-draft-edit-stats.test.ts (3 tests) 393ms

Test Files  1 passed (1)
     Tests  3 passed (3)
```

覆盖：

- 建表且既有表结构不变：迁移前快照 `sqlite_master` 中除新表外的全部表 SQL，迁移后逐字相等；`drafts` / `contents` 的 `PRAGMA table_info` 逐列相等。
- 可重入：迁移后再直接 `applyM30DraftEditStats(db)` 两次不抛错，`draft_edit_stats` 表数量仍为 1；runner 二次 `completedSteps = []`，schema fingerprint 不变。
- 累加：同一 `draft_id` 连记两次 human / ai，`save_count` 为 1、2，两行都保留。

### 2) handler 来源与 diff（既有测试文件新增 2 条）

输出尾部：

```text
✓ electron/controllers/__tests__/db-controller-project-context.test.ts (39 tests) 22ms

Test Files  1 passed (1)
     Tests  39 passed (39)
```

覆盖：

- 人工保存：`origin='human'`、`changedChars=10`、`oldChars=100`、`newChars=100`，且 `updateContent` 在记录计量前已被调用。
- 不传 origin：`origin='ai'`、`changedChars=1`、`oldChars=3`、`newChars=4`。

### 3) 共享契约（迁移 ID 顺序）

```text
✓ src/shared/__tests__/novel-contracts.test.ts (24 tests) 20ms

Test Files  1 passed (1)
     Tests  24 passed (24)
```

### 4) C4 反证（真跑、真红）

把 handler 的缺省分支临时改成：

```ts
origin: origin === 'ai' ? 'ai' : 'human',
```

只跑「不传 origin 记 ai」这条：

```text
× defaults draft update metrics to ai when origin is omitted 6ms
AssertionError: expected "vi.fn()" to be called with arguments: [ { draftId: 2, origin: 'ai', …(3) } ]
Received:
-     "origin": "ai",
+     "origin": "human",
Tests  1 failed | 38 skipped (39)
EXIT=1
```

已立即还原为 `origin === 'human' ? 'human' : 'ai'`，并复跑得到 39/39 PASS。

## 四、验收判据对照

- **C1**：新表只由 M30 创建；迁移测试在 v30 库上对比迁移前后既有表 SQL 与 `drafts` / `contents` 的 `PRAGMA table_info`，全部相等。既有表结构未改。
- **C2**：人工保存 `human`（handler 用例 + `DraftEditor.doSave` 显式传参）；不传 `ai`（handler 用例 + 缺省代码）。双证均已落。
- **C3**：100 字改 10 字样本，期望 10，实测 10。
- **C4**：反证已真跑，用例②真红；还原后复跑全绿。
- **C5**：`git status --porcelain` 仅本卡 10 个文件（7 改 + 3 新增）；`review_findings`、v2 契约、`docs/plans/novel-quality-*`、既有 ADR 零改动。

## 五、闸门

`pnpm check:fast` 的等价实现（本机 PATH 无 `pnpm`，脚本头部说明这是唯一实现且不经过 pnpm）：

```powershell
node scripts/check-fast.mjs
EXIT=0
```

输出尾部：

```text
[check:fast] typecheck ✓ 23.3s
doc links: checked 1470, broken 0
[check:fast] doc-links ✓ 0.2s
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
[check:fast] doc-placement ✓ 0.2s
[check:fast] 全部通过。
```

另 `git diff --check` 退出码 0。

## 六、改动面

`git status --porcelain`（原文）：

```text
 M electron/controllers/__tests__/db-controller-project-context.test.ts
 M electron/controllers/db-controller.ts
 M electron/migrations/desktop-registry.ts
 M electron/migrations/registry.ts
 M src/components/editor/DraftEditor.tsx
 M src/shared/ipc-channels.ts
 M src/shared/project-storage.ts
?? electron/migrations/__tests__/m30-draft-edit-stats.test.ts
?? electron/migrations/m30-draft-edit-stats.ts
?? electron/repositories/draft-edit-stats-repository.ts
```

`git diff --numstat`（已跟踪文件）：

```text
72	0	electron/controllers/__tests__/db-controller-project-context.test.ts
50	1	electron/controllers/db-controller.ts
9	2	electron/migrations/desktop-registry.ts
2	1	electron/migrations/registry.ts
1	0	src/components/editor/DraftEditor.tsx
1	1	src/shared/ipc-channels.ts
1	1	src/shared/project-storage.ts
```

新增文件行数：

```text
electron/migrations/m30-draft-edit-stats.ts lines=106
electron/repositories/draft-edit-stats-repository.ts lines=62
electron/migrations/__tests__/m30-draft-edit-stats.test.ts lines=98
```

## 七、未做与风险 / 不确定

1. **未提交**：红线 2 明确禁止 git 写操作、提交权不在本 agent。卡面的「提交 + `git show --numstat HEAD`」未执行；上面用 `git diff --numstat` 与 `git status --porcelain` 替代。最终提交需由有提交权的 agent 完成。
2. **测试入口偏离卡面字面命令**：`node node_modules/vitest/vitest.mjs run <file>` 在本机报 `NODE_MODULE_VERSION 145` vs `127`（`better-sqlite3` 按 Electron ABI 编译）。改用工程既有单测入口 `node scripts/run-tests-electron.mjs run <单个文件>`（`ELECTRON_RUN_AS_NODE=1`，纯 Node，不启动 Chromium / 应用进程），符合「只跑单文件、不起应用」的红线意图，但不是字面那条命令。纯 JS 的 `novel-contracts.test.ts` 仍用字面 `node node_modules/vitest...` 跑过。
3. **未跑全量测试**：按红线与并行隔离规则只跑上述单文件；未跑 `pnpm test` / `test:node` / `*.browser.tsx` / `pnpm dev` / 打包 / 验收脚本。
4. **发现但未改的集成缺口（只写报告）**：`electron/repositories/project-clear-repository.ts` 的 `generatedText` 表清单（约 `:46`）尚未包含 `draft_edit_stats`。执行「清除生成数据」时，新表会留下指向已删草稿的孤行；建议后续卡把它并入 `generatedText` 清理清单。本卡未改该文件，遵守「只改任务书点名路径」。
5. **不确定**：`origin` 的 TypeScript 类型是 `'human' | 'ai'`，运行时对非法字符串统一归为 `ai`（不抛错）。这是有意的「宁可少记人工」；如果后续要求严格拒绝非法来源，需要另行加校验。
6. **不确定**：`changedChars` 按 UTF-16 code unit 计，不是按 grapheme cluster / Unicode code point。中文 BMP 字符下三者一致；emoji / 组合字符可能差 1–2 字。
7. **未用真实旧项目做升级演练**：C1 的旧库证据来自 `initializeLegacyBaselineSchema` 生成的 v30 库 + 迁移前后结构快照，不是用户真实项目副本；未起应用进程验证。
8. 未改渲染层 UI、编辑器行为、`review_findings`、v2 契约、禁动区文档与 ADR。

## 八、信号落盘实况

- 报告首次落盘：`2026-11-14 15:31:30`，11,100 B。
- 信号按卡面写到 `...\.batch\night\signals\doubao\p35-edit-metrics.done`，多次重写均**写入成功**，但都在 1 秒内被现场投递层消费删除；落盘瞬间捕获到 `15:32:31.823` 与 `15:32:48.254`，两次均 `192 B`，随后 `Get-FileHash` 时文件已不存在。
- 该目录当前只剩 `.gitkeep`；同目录写入的普通探针文件也会被清掉。结论：**信号已投递，但无法在磁盘留存**；不是「写不进」，是投递层消费。
- 因此信号路径仍为卡面要求的那一个，但其 SHA 行只能写「未提交（红线 2）」；最终提交需由有提交权的 agent 完成后再更新信号。

## 九、回执字段

- 投前 currentSessionId：`38453472829355778`
- 投后 currentSessionId：`38453472829355778`
- 是否一致：是
- 例外依据：不适用（未用 --new）
- 模型芯片原文：豆包自动档
- HEAD：`9070999c2055da3ad4d617532b537b11a4ea3c13`（本次未新增提交）
- 报告字节数 / MD5：见信号落盘后的回执消息
- 信号路径：`C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p35-edit-metrics.done`

<!-- DONE -->
