# C1-b addendum · M31 版本口与 portable 登记缺口

出件：developer · AI writer项目组 ／ 2026-11-24
依据：大肥鱼 11-24 裁「批扩两处登记（`electron/migrations/registry.ts` 的 MIGRATION_LANE、`src/shared/project-storage.ts` 的 MIGRATION_IDS），并核 `LATEST_SCHEMA_VERSION` 已为 31 的来由，出 addendum（白名单升 16 项）」
基准取证树：`C:/develop/workspace/AI-writer/wt-2`，`git rev-parse HEAD` = `34aa0000`，`git status --porcelain` 0 行
适用件：`dispatch-doubao-c1b.md`（160 行/15,204B/`36365fd3…`）、`dispatch-workbuddy-c1b.md`（159 行/15,207B/`fa89f9d3…`）；本 addendum 与其冲突时以本件为准。

## §0 三行结论

1. **31 不是给 M31 预留的**：`electron/migrations/registry.ts:35` 已有 `{ id: 'M30', from: 30, to: 31, owner: 'P35' }`，`:38` `LATEST_SCHEMA_VERSION = 31` 是 M30 的目标版本。M31 必须写 `from: 31 → to: 32`，且**两处版本常量都要改 32**（`registry.ts:38`、`desktop-registry.ts:40`）；后者不在原派单 item 13 引用的行范围内，不改则 `migrateSchema(..., CURRENT_DESKTOP_SCHEMA_VERSION)` 停在 31，M31 永不执行、[live] 判据必红。
2. **另有一处先于本卡的运行时坏点**：M30 提交 `1e1b4840` 建了 `draft_edit_stats`，但没改 `electron/services/portable-project-field-policy.json`、`electron/services/portable-project-format.ts`。`assertPortableSourceSchema`（`portable-project-format.ts:169-189`）是 fail-closed（`:178` 表不在 `tables` 即抛 `PORTABLE_SCHEMA_UNSUPPORTED`），故 HEAD 上「项目导出 / 便携备份」运行时不可用，测试实测红（见 §6）。这**不是 C1-b 引入**，但 M31 若不登记就会把这个坏点一起带上 M31。
3. 若要 C1-b 收工时该测试转绿且不加深坏点，白名单需 14 → **19 项**，并在同一套改动里补登 M30 的 `draft_edit_stats`；这条与「一卡一提交」有冲突面，见 §5 待裁定 D2。

## §1 版本号与登记点（逐行）

| 落点 | 现状 | C1-b 应改成 |
|---|---|---|
| `electron/migrations/registry.ts:35` 相邻行 | `{ id: 'M30', from: 30, to: 31, owner: 'P35' }` | 其后追加 `{ id: 'M31', from: 31, to: 32, owner: '<卡号 owner>' }`；m00–m30 一行不动 |
| `electron/migrations/registry.ts:38` | `LATEST_SCHEMA_VERSION = 31` | `= 32`（否则 `runner` 认为 32 越过最新版，直接拒） |
| `electron/migrations/desktop-registry.ts:40` | `CURRENT_DESKTOP_SCHEMA_VERSION = 31` | `= 32`（**必须**；`:254` 的 `migrateSchema(..., CURRENT_DESKTOP_SCHEMA_VERSION)` 以它为迁移目标） |
| `src/shared/project-storage.ts:5` | `MIGRATION_IDS` 末项 `'M30'` | 追加 `'M31'` |
| `electron/migrations/desktop-registry.ts:221-225` | M30 接线块（`...m30Schemas`、verify） | 照抄一份 M31 接线，`:226-250` 的 `schemas(32)` 指纹集与 `:249` 的 `...draftEditStatSchemas` 之后追加 `...characterRegenerationSnapshotSchemas` |

自动通过的既有闸门（不必改，只作核）：`electron/migrations/__tests__/runner.test.ts:84-92` 只断言编号连续 / `from`–`to` 首尾相接 / 有 owner；`src/shared/__tests__/novel-contracts.test.ts:222` 断言 M00..M(n) 连续。全仓当前无 M31 任何痕迹（`grep -rn "M31" electron src docs` 无结果），不存在抢占。

设计口径：`docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md` §4.5 定表 `character_regeneration_snapshots`，5 列 `operation_id` / `character_id` / `source_revision` / `field_json` / `created_at`，照 M08 `character_cast_decisions` 先例（`m08-structured-refs-and-cast-decisions.ts:22-25`：`created_at` 由应用写 ISO 字符串，禁 `datetime('now')`）。基线 DDL（`electron/migrations/baseline-schema.ts`）冻结，不动。

## §2 portable 缺口（本 addendum 的新事实）

- `electron/services/portable-project-format.ts:18` 的 `PortableFieldPolicy['origin']` 联合类型只到 `'m28-delta'`；每个 `mXX` 增量表都在策略 JSON 里有一个同名数组（`m06Tables` / `m08Tables` / … / `m28Fields`），并在 `:109-110` 的 `delta` 判定与 `:119-137` 的 origin 链里各出现一次。
- `electron/services/portable-project-field-policy.json` 现 66 张表：`draft_edit_stats`（M30）不在 `tables` 里，`character_regeneration_snapshots`（M31）也不会自己出现。
- fail-closed 三点（`portable-project-format.ts:169-189`）：DB 里有表但 `tables` 没有 ⇒ 抛（`:178`）；有列但 `fieldPolicy` 没有 ⇒ 抛（`:181`）；策略里有、DB 里没有且不在 `optionalFields` ⇒ 抛（`:185`）。
- 因此**任何新增迁移表都必须同步登记**，否则 `exportPortableProject` 在运行时整条不可用（这正是测试注释 `:100-104` 记录的 M22 同类事故）。

## §3 白名单增补：14 → 19 项

在原派单 item 1–14 之外新增下列五处（编号续用）：

| 15 | `electron/migrations/registry.ts` `:35` 后、`:38` | **修改**：MIGRATION_LANE 追加 M31（`from:31 → to:32`）；`LATEST_SCHEMA_VERSION` 31 → 32。仅这两处，m00–m30 行不动（大肥鱼 已批） |
| 16 | `src/shared/project-storage.ts` `:5` | **修改**：`MIGRATION_IDS` 追加 `'M31'`（大肥鱼 已批） |
| 17 | `electron/migrations/desktop-registry.ts` **`:40`**（并入 item 13，item 13 行范围改为 `:40`、`:221-226`、`:226-250`） | **修改**：`CURRENT_DESKTOP_SCHEMA_VERSION` 31 → 32；其余同 item 13 |
| 18 | `electron/services/portable-project-format.ts` `:18`、`:30-90`（就近新增两个 Set）、`:109-110`、`:119-137` | **修改**：origin 联合类型加 `'m30-delta' \| 'm31-delta'`；新增 `m30Tables` / `m31Tables` 两个 Set；`delta` 判定加这两项；origin 链按 `m06`/`m08` 先例插入两支 |
| 19 | `electron/services/portable-project-field-policy.json` | **修改**：`m30Tables: ["draft_edit_stats"]`、`m31Tables: ["character_regeneration_snapshots"]`；`tables` 里补 `draft_edit_stats` 8 列（`id`/`draft_id`/`at`/`origin`/`changed_chars`/`old_chars`/`new_chars`/`save_count`，全 `"D"`）与 `character_regeneration_snapshots` 5 列（全 `"D"`，口径见下） |

口径：两者都用 `"D"`（`preserve-domain`）。`draft_edit_stats` **不能**用 `"B"`——`m30-draft-edit-stats.ts:5-13` 的设计原话是「改了多少字事后再也重建不出来」，而 `"B"` 的语义正是 `rebuildable-metric-version`（现全仓只有 `text_metric_versions` 用它）。`character_regeneration_snapshots` 是被改字段的历史值，属作者内容，同 M08 用 `"D"`。

配套测试（同批必须改，否则判据不可测）：`electron/services/__tests__/portable-project-format.test.ts` `:101`、`:102`、`:276` 的 `{ tables: 66, fields: 638 }` → `{ tables: 68, fields: 651 }`（M30 +1 表 8 列、M31 +1 表 5 列）；`:152` 的 `expect(added).toHaveLength(283)` → `296`；按 M06/M08 先例补两条 bucket 断言（`m30-delta` / `m31-delta` 各精确列出 8 / 5 个 key），`:158` 的 `expect(delta).toHaveLength(126)` 仍必须是 126 —— 新增两张表**不得**落进 `m01-m05-delta` 桶。该测试文件未在派单白名单内，需与本 addendum 一并补入（记为第 19 项的一体两面：策略 JSON ＋ 断言，同一文件族）。

## §4 判据增补

- **J9 [static]**：`node scripts/run-tests-electron.mjs electron/services/__tests__/portable-project-format.test.ts` → `EXIT=0`，末行 `Tests 29 passed (29)`（当前基线见 §6 为 2 红）。这条同时钉住 §1 的三处版本号（该测试建库走 `getDesktopMigrationRegistry()` + `CURRENT_DESKTOP_SCHEMA_VERSION`，版本不同步会先在 `verifySchema` 抛）。
- J1–J8 原文不动。若 §5 的 D2 裁定为「先出一笔 M30 修补」，则本卡起点 sha 由 `34aa0000` 顺延为那笔的提交号，起点闸门的 porcelain 0 判据不变。

## §5 待裁定（两问，都请大肥鱼一句话定）

- **D1 白名单是否升 19 项**（含 portable 三件套）。不升的代价：M31 表不进便携策略 ⇒ 本卡合入即让「项目导出 / 便携备份」从「已坏」变成「坏且带 M31」；且 J9 无法给绿。
  - 推荐：升。三项里 2 项是纯登记（JSON + 类型），1 项是断言数字，改动面与既有 M22/M06/M08 先例完全同形，风险低。
- **D2 M30 的 `draft_edit_stats` 补登怎么走**：(a) 与 C1-b 同笔提交，commit message 末行注明 `also: M30 draft_edit_stats portable registration (fixes regression from 1e1b4840)`；(b) 先出一笔 M30 修补，C1-b 起点 sha 顺延。
  - 推荐 (a)：一卡一提交的初衷是「一张卡的范围可审」，而 (b) 会让 C1-b 的起点不再是 `34aa0000`、派单件里的起点闸门与白名单全部要重发一次，成本明显更大；把 M30 那一条写在 message 里可审可查。若大肥鱼坚持纯卡面，(b) 也成立，我会同步改派单件的起点 sha。

未决即不动：D1/D2 未定前豆包/WorkBuddy 都不投，派单件保持原样。

## §6 取证原文

```
$ cd wt-2 && git rev-parse --short=8 HEAD
34aa0000
$ git status --porcelain -uall | wc -l
0
$ node scripts/run-tests-electron.mjs electron/services/__tests__/portable-project-format.test.ts
 Test Files  1 failed (1)
      Tests  2 failed | 27 passed (29)
EXIT=1
```

失败行原文（`portable-project-format.test.ts:101`、`:276`）：
`expected { tables: 67, fields: 646 } to deeply equal { tables: 66, fields: 638 }`
即盘上实际 67 表/646 列，策略期望 66/638，差的正是 `draft_edit_stats` 的 1 表 8 列。加 M31 后实际为 68/651。

附注（不在本卡范围，仅备案）：`docs/design/features/d2-run-lease-abort-design.md:92-98` 仍把 M30 写成「29 → 30 的跑租约迁移」，与现行 `registry.ts:35`（M30 = 30→31 draft_edit_stats、跑租约改由 M22 列承载）不符，属既有文档编号漂移；本卡不修 docs。
