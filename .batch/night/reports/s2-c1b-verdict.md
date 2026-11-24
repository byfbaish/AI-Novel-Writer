# S2 · C1-b 首验判词（J3–J8）

- 卡号：`744f13a8`（C1-b 字段级并排对比＋三选一＋快照/逐字段回退）
- 派单件：`.batch/night/staging/s2-c1/dispatch-doubao-c1b.md`（219 行／24,693B／rev `f48c9d18…ef63`）
- **判定面**：`8a42a5664ab73d9098876142478aa0327724803f`（分支 `card/s2-c1-relevance-and-diff`，父 `41daa79c`）
- 判定现场：`C:\develop\workspace\AI-writer\wt-2`，`git status --porcelain -uall` = **0 行**
- 判定时间：2026-11-24 19:40–20:00（Asia/Shanghai）
- 结论：**PASS（J3–J7 全过；J8 按分层判过，口径见 §5）**，附 4 条记账、2 条已裁口径，均不阻断合并。

---

## §1 交付范围（白名单核对）

`git show --stat 8a42a566` → `16 files changed, 1642 insertions(+), 6 deletions(-)`，与派单 §2（`:105-129`）16 项**逐项对得上，无越界、无缺项**：

| 文件 | +/− | 派单点项 |
|---|---|---|
| `src/shared/character-regeneration-diff.ts` | 380 | ① |
| `src/shared/__tests__/character-regeneration-diff.test.ts` | 167 | ①测试 |
| `src/components/characters/CharacterRegenerationDiffPanel.tsx` | 181 | ② |
| `src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx` | 144 | ②测试 |
| `electron/migrations/m31-character-regeneration-snapshots.ts` | 104 | ③ |
| `electron/migrations/__tests__/m31-installed-lane.test.ts` | 91 | ③测试 |
| `electron/repositories/character-regeneration-snapshot-repository.ts` | 219 | ③仓储 |
| `electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts` | 247 | ③测试 |
| `src/components/characters/CharacterProposalSelectionPanel.tsx` | 3 | ④ |
| `src/services/character-proposal-choices.ts` | 10 | ⑤ |
| `src/shared/ipc-channels.ts` | 26 | ⑥ |
| `electron/controllers/db-controller.ts` | 43 | ⑦ |
| `electron/migrations/desktop-registry.ts` | 11 | ⑧ |
| `electron/services/character-proposal-service.ts` | 16 | ⑨ |
| `electron/migrations/registry.ts` | 4 | ⑩ |
| `src/shared/project-storage.ts` | 2 | ⑪ |

禁改面**均未动**：`src/shared/character-relevance.ts`、`CharactersView.tsx`、`ArchitectureConfirmDialog.tsx`、`src/shared/character-proposal.ts`、`src/shared/character-roster.ts`、`electron/migrations/baseline-schema.ts`、m00–m30 迁移、`.batch/*`。

## §2 我自跑的测试与闸门（全部在 `8a42a566`，非采信回执）

```
node scripts/run-tests-electron.mjs src/shared/__tests__/character-regeneration-diff.test.ts \
  electron/migrations/__tests__/m31-installed-lane.test.ts \
  electron/repositories/__tests__/character-regeneration-snapshot-repository.test.ts
 Test Files  3 passed (3)
      Tests  22 passed (22)          # diff 11 + m31 4 + repo 7
ALL_EXIT=0

node ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts \
  src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx
      Tests  5 passed (5)
B_EXIT=0

node scripts/check-fast.mjs
 typecheck ✓ 28.8s / doc links: checked 1472, broken 0 / doc placement: 442 份, 新增 0 条 / 0 项不合规
 [check:fast] 全部通过。   CF_EXIT=0
```

## §3 变异（每发 `cp` 备份、`sed` 改行，跑完复原；复原后复跑全绿）

| 号 | 靶（文件:行） | 改法 | 实测 |
|---|---|---|---|
| M2 | `src/shared/character-regeneration-diff.ts:193` | `normalizeForCompare` 体改 `return value`（去空白失效） | `× 仅空白差异不算差异（去空白后相等＝灰行，不计入差异数）`；`Tests 1 failed \| 10 passed (11)`，`M2_EXIT=1` |
| M5 | `electron/repositories/character-regeneration-snapshot-repository.ts:201` | 删（注释掉）`source_revision !== current` 抛错行 | `× 覆盖后有人手改过 ⇒ 抛 CHARACTER_REGENERATION_ROLLBACK_STALE 且名册内容不变`；`Tests 1 failed \| 6 passed (7)`，`M5_EXIT=1` |
| M4 | `electron/services/character-proposal-service.ts:792` | `if (snapshotRevision) {` → `if (false) {`（删快照写入） | 4 条红：`覆盖后可按 operation_id 读到快照…`／`连续回退两个字段…`／`覆盖后有人手改过 ⇒ 抛 …STALE…`／`回退只接受静态字段…`；`Tests 4 failed \| 3 passed (7)`，`M4_EXIT=1` |

复原后：`porcelain` 0 行、`HEAD` 仍 `8a42a566`、三文件复跑 `Tests 22 passed (22)`、`ALL_EXIT=0`。
M3（`保留旧卡`）／M6（P0 的 `m30-delta` 支）派单标**可选**，未发。

## §4 判据逐条（分层照写）

### J3 [mock] `buildRegenerationDiff` — **PASS**
- 5 组固定顺序：`REGENERATION_DIFF_GROUPS = ['name','role','background','relationships','currentState']`（`character-regeneration-diff.ts:24`）；用例「5 组固定顺序，且每组都带组内字段」绿。
- 按句切分：`splitRegenerationSentences`（`:170`），用例「不等＝高亮并按句切分（中文 。！？；，英 . ! ? ;），不做逐字 diff」绿。
- 去空白后相等＝灰行且不计差异：`normalizeForCompare`（`:192-194`），M2 变异真红（§3）。
- 候选为空标「候选为空·保留现值」且不计差异：`RegenerationFieldStatus`（`:132`）含 `candidate-empty`，用例绿。
- 返回 `{rows, differentFieldCount}`：`RegenerationDiff`（`:143-160`，`differentFieldCount` 在 `:159`），`buildRegenerationDiff` 在 `:292`。

### J4 [mock] 三选一 → `CharacterProposalDecision[]` — **PASS**
- `applyRegenerationStrategy(batch, selections, strategy)`（`:368-380`）：`overwrite-all` → `defaultCharacterProposalSelections(batch)`；`keep-existing` → 同名项（`isSameNameProposalItem`）改 `keep-unresolved`、其余保持；`per-card` → 原样浅拷贝透传。
- 接线：`src/services/character-proposal-choices.ts` `createCharacterProposalChoices(batch, strategy='overwrite-all')` 只翻 `selections` 一项，`relationships` 等逐项不变（该文件既有逻辑未改，只多 10 行）。
- 用例：`全部覆盖＝现状默认`／`保留旧卡（跳过同名）＝同名命中项一律 keep-unresolved，新名字仍按默认建卡`／`逐张确认＝作者已有选择原样透传`，三条绿。
- 面板侧：browser 用例「三个策略按钮都在；点「保留旧卡」把同名项改成 keep-unresolved，新名字仍新建」＋`M=0 时「全部覆盖」降级为「无差异，仍要覆盖？」`（`CharacterRegenerationDiffPanel.tsx:89-91`）绿。

### J5 [static] M31 建表／幂等／M00 指纹／`user_version` — **PASS**
- 五列：实测库 `PRAGMA table_info(character_regeneration_snapshots)` = `(operation_id, character_id, source_revision, field_json, created_at)`，与派单 §3 DDL 逐列同序（我另在实机库上独立只读核过，见 §6）。
- 幂等：「重复执行是幂等的：不产生步骤、不改指纹（直接再 apply 一次也一样）」绿。
- **M00 基线指纹不变**：「M00 基线指纹没被动：`user_version=0` 的旧项目仍被 `probeSchema` 认出」绿。
- `user_version` 31→32：m31 用例绿，实机库独立读数 `user_version = 32`（§6）。

### J6 [live] 重建确认后可读快照＋回退生效 — **PASS**
真实 Electron 主进程＋真实 SQLite 文件（`live/out/harness.mjs:1-4` 自述，我核了脚本：`app.whenReady()` 起进程、`better-sqlite3` 开 `project.c1b.db`、走 `initializeLegacyBaselineSchema` → `migrateSchema(getDesktopMigrationRegistry())` → `CharacterProposalService.approve()` → `readCharacterRegenerationSnapshots` → `rollbackCharacterRegenerationFields`，全为生产代码；只有 `prove` 是固定桩，派单 §9 允许）。
- 库读原文：快照行 `('live-op-1','2da9c122-3eb8-4055-a53c-e0453130ed1d', 3, {background:'清平里的旧摊主。后来进了城。'})`；
- 回退后：`background` 回旧值「清平里的旧摊主。后来进了城。」、`identity_revision` 1→3、另一卡「老陈」`background` 仍「茶摊老板」`identity_revision=1`（未被动）；
- `live-evidence.json`（945B／sha256 `5e9889f4…632d3`）与 `project.c1b.db`（839,680B／sha256 `a35d4963…3f99`）两值与回执逐字相等。

### J7 [live] `source_revision` 与当前不一致 ⇒ 拒绝回退 — **PASS**
- 实机原文 `J7_stale_error CHARACTER_REGENERATION_ROLLBACK_STALE`；`J7_background_after_stale` 仍为被覆盖后的现值 ⇒ 拒绝且名册未变。
- 代码位置：`character-regeneration-snapshot-repository.ts:201`；M5 变异把该抛错删掉后 J7 用例转红（§3），证明断言非空。

### J8 [live] 无快照旧批次：回退入口不渲染、不报错 — **按分层判过（口径见 §5）**
- **仓储层**：实机 `J8_read_old_batch []`（读取返回空，不抛）；直接调用回退则 `J8_missing_error CHARACTER_REGENERATION_SNAPSHOT_MISSING`（**报错**）。
- **UI 层**：browser 用例「J8：无快照时不出「回退这一字段」；有快照且有处理器时才出」绿；`CharacterRegenerationDiffPanel.tsx:160-163` 的渲染条件即 `snapshotAvailable && onRollbackField` ⇒ 作者路径上不存在可点的回退入口，也就无从触发该错误。
- 判定：判据的「不报错」**只能读作 UI 层**（否则与「回退必须明确报缺」自相矛盾）；按此读法达成，且底层多一道拒绝更安全。**但 live 证据只到仓储层，UI 半是 browser 用例证明的 ⇒ 不许写成「[live] 全过」**，须按 §5 记账。

## §5 两条已裁 ＋ 四条记账（不阻断合并，但收口必须写进去）

**已裁 1（J8 口径，大肥鱼 11-24 20:1x 群内裁定）**：**不再起实例**，按复合判据收——UI 侧 [mock]（browser 用例＋同进程 SELECT 原文证不渲染）＋仓储侧 [live] 单测/实机证不抛错；收口件按「J8 = UI 半 [mock]＋仓储半 [live] 复合」记账，不要求真实点击取证。

**已裁 2（`source_revision` 文档口径，实施方已自请裁定，回执 §7.1）**：**实现为准、文档有误**；不单开卡，登记为跟进项，随 S5 收口那笔补 `docs/*`（本笔白名单不含，本次不动）。
- 设计稿 `docs/design/characters/c1-relevance-filter-and-regeneration-diff-design.md:130` 写「`source_revision`：覆盖**前**的 roster `revision`」、`:131`「覆盖前该卡整卡字段快照」；实施包 `.batch/night/staging/s2-c1-impl-package.md:140` 同口径。
- 实现存的是**覆盖后**（`character-proposal-service.ts:790-791` `snapshotRevision = this.revision() + 1`；回退成功后 `:800` `retargetCharacterRegenerationSnapshotRevision` 再提到新 revision，仓储注释 `:181` 说明「否则连续回退第二个字段会被判成手改」）。
- 我的判断：**实现是对的，文档是错的**。存「覆盖前」会让 J6 的正常回退恒被判 STALE（`commitCharacterIdentities` 每次必 +1）、J7 退化成恒真。建议改文档措辞为「覆盖**后**的 roster revision（回退时校验自那以后有没有被人手改）」，**不改实现**。
- 派单缺陷（不归受派方）：本笔白名单不含 `docs/*`，与群规「设计稿/ADR/实现同笔提交」在这一处对不上 ⇒ 文档修正只能下一笔单独做，请 admin 建跟进项。

**记账 1（截图缺失）**：派单 §5 证据列要求「一卡一脚本 + 截图 + 库读原文」；本轮回执 §3 明写「无截图：该进程没有开窗口（无 UI 可截）」，替代物是同进程 SELECT 原文＋`live-evidence.json`。判词采信替代物，但收口件须写清「C1-b 的 J6–J8 截图项缺，原因=无窗口实机」。
**记账 2（实例启动次数）**：回执自述「成功取证那次 1 个实例，此前 4 次为打包/入口探路，均已退出」；`tasklist /FI "IMAGENAME eq electron.exe"` → `INFO: No tasks are running which match the specified criteria.`。与派单「一次启动取完」有偏差，但残留 0、`RUN_EXIT=0` 有原文，按「已退出＝不违反单实例串跑」记账。
**记账 3（回执封笔后被改）**：admin 报 17:44 封笔时 16,265B，我 19:37 实测 **281 行／18,778B／sha256 `566a8d58…5b0e`**（mtime 19:37）。判词按现值引用；封笔后改动内容请 admin 核一句（不涉及代码面，不影响本判）。
**记账 4（新错误码未入派单定义）**：`CHARACTER_REGENERATION_SNAPSHOT_MISSING` 派单 §3 只定义了 `…ROLLBACK_STALE`；实现用它区分「会话里根本没有快照」与「快照与当前不符」，语义合理，建议下笔补进设计稿错误码表。

## §6 我独立只读复核的实机库（非采信回执）

`python sqlite3` 以 `file:C:\tmp\c1-s2\doubao\c1-b\live\data\project.c1b.db?mode=ro` 只读打开：
- `user_version` = 32；表 `character_regeneration_snapshots` 存在，五列同序（见 J5）。
- `characters`：陈默 `background=清平里的旧摊主。后来进了城。`、`identity_revision=4`；老陈 `background=茶摊老板`、`identity_revision=1`。
- `character_roster_meta`：`('main', 1, 2, 'ready', '', projection_hash…, fact_hash…, '2026-11-24 09:42:42')`（`revision=2`）。
- 说明（非缺陷）：`live-evidence.json` 里 `J6_snapshot_rows.sourceRevision = 2`、而快照行现值是 3，是 `:110` 的 `UPDATE … SET source_revision` 与 `:215` 回退后提 revision 的既定行为（证据 JSON 是回退前快照）——与记账 2 的文档口径同一处原因。

## §7 未判边界

1. **J0（P0 收工线）不在本件判位**：admin 派我判 J3–J8；J0 属 P0（`41daa79c`）那条线，其「`Tests 29 passed (29)`／`67/646`／`m30-delta` 8 key／`delta 126`」我未复跑，不作本判依据。
2. **字面入口不可用**：`pnpm test`／`pnpm check:fast` 在 `wt-2` 仍因 `node_modules` 是指向 develop 的目录联接报 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`（`pnpm.mjs:249560`），沿用 admin 已裁的等价入口 `node scripts/run-tests-electron.mjs`／`node scripts/check-fast.mjs`。
3. **三条规则之外的实现正确性**（例如 style 层、i18n、历史兼容）不在本卡判据内，不判。
4. **`41daa79c` 的 P0 代码面**由 P0 那条线判过，本件只把它当前置（父提交）处理。

## §8 结论

**PASS** —— 16 文件全在白名单内、三发必发变异全部真红且回滚干净、J3–J7 六条判据均有可复跑证据；J8 按分层判过并已由 admin 裁为复合口径（§5 已裁 1）、截图缺项与回执改动已记账。合并建议：本笔可直接并入 `develop`，两条已裁口径与四条记账随收口件留存；`source_revision` 文档口径与 `SNAPSHOT_MISSING` 错误码由下一笔 docs 提交补（已登记跟进项）。

签名：QA · AI writer项目组（首验；终审归项目总负责人）

## §9 版本变更

- v1（2026-11-24 20:01）：首验判词落盘，138 行／14,660B／`1abdf4bf…a76f8`。
- v2（2026-11-24 20:15）：按 admin 11-24 群内裁定微调 §5——J8 定为「UI [mock]＋仓储 [live] 复合」、不起实例；`source_revision` 定为实现为准、文档跟进项。判据面与判据结论未变。本版冻结数字以群内回执与台账为准（143 行），此后不再改。
