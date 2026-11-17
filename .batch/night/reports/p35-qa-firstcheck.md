# P35 首验报告 · 编辑计量接线（diff + origin 标记）

- 判定对象：`28b0e822fc18ef9c2705d9100c51ce83104b3d7b`「feat: record draft edit metrics with origin tagging」，父 `9070999c`（分支 `exp/resource-ledger`）
- 派验单：`.batch/night/review-requests/P35.md`（负责人 15:2x 登记，C1–C5＋四条独立判定项）
- 交付报告：`.batch/night/reports/p35-edit-metrics.md`，11,852B / MD5 `0637077DD4F63FD516B2143B8EA0E8E0`（与本机复算一致）
- 运行时：全部用 `pnpm test`（Electron ABI 145）。直接用 `node node_modules/vitest` 会因 `NODE_MODULE_VERSION 145 vs 127` 全红，不构成缺陷。
- 我动手的边角：仅“把缺省暂时改成 human 跑一次再还原”和“新建一个一次性取证测试再删除”，两处都已回收，收尾 `git status --porcelain` 为空。

## 结论：PASS 5/5（不拦），附 3 条记账

C1–C5 全部独立复算通过；3 条记账都不是本卡引入的缺陷，一条是范围外集成缺口（交付方已自述）、一条是口径建议、一条是 src 文件数超出字面规则（负责人已预授权）。

## C1 新表只由 M30 建，既有表结构未改 —— 通过

我写了一次性取证测试（`electron/migrations/__tests__/__qa-p35-pragma.test.ts`，跑完即删）在 v30 库上做迁移前后 raw 对照，原始输出：

```
QA-C1 user_version before/after = 30 / 31
QA-C1 既有表数量 before/after = 66 / 67
QA-C1 新增表 = ["draft_edit_stats"] 删除表 = [] 定义被改的表 = []
QA-C1 PRAGMA table_info(drafts) before / after（11 列，逐列相同）
cid=0 | name=id | type=INTEGER | notnull=0 | dflt_value=null | pk=1
cid=1 | name=chapter_number | type=INTEGER | notnull=1 | dflt_value=null | pk=0
…（cid=2..9 略，前后两段逐字相等，测试内断言 after===before）
cid=10 | name=outline_rev | type=INTEGER | notnull=1 | dflt_value=-1 | pk=0
QA-C1 PRAGMA table_info(contents) before / after（3 列，前后相同）
cid=0 | name=id | type=INTEGER | notnull=0 | dflt_value=null | pk=1
cid=1 | name=body | type=TEXT | notnull=1 | dflt_value='' | pk=0
cid=2 | name=created_at | type=TEXT | notnull=0 | dflt_value=datetime('now') | pk=0
QA-C1 PRAGMA table_info(draft_edit_stats)
cid=0 | name=id | type=INTEGER | notnull=0 | dflt_value=null | pk=1
cid=1 | name=draft_id | type=INTEGER | notnull=1 | dflt_value=null | pk=0
cid=2 | name=at | type=TEXT | notnull=1 | dflt_value=datetime('now') | pk=0
cid=3 | name=origin | type=TEXT | notnull=1 | dflt_value='ai' | pk=0
cid=4 | name=changed_chars | type=INTEGER | notnull=1 | dflt_value=0 | pk=0
cid=5 | name=old_chars | type=INTEGER | notnull=1 | dflt_value=0 | pk=0
cid=6 | name=new_chars | type=INTEGER | notnull=1 | dflt_value=0 | pk=0
cid=7 | name=save_count | type=INTEGER | notnull=1 | dflt_value=0 | pk=0
```

- 结论：`drafts`（11 列）、`contents`（3 列）迁移前后**逐列相同**；66 张既有表里**定义被改 0 张、被删 0 张**；新增只有 `draft_edit_stats` 一张，8 列与默认值均符合卡面，`origin` 库层缺省就是 `'ai'`。
- 迁移可重入：交付用例 `is reentrant` 覆盖「apply 两次不抛错 + 表数量仍 1 + fingerprint 不变 + runner 二次 `completedSteps=[]`」，我复跑通过。
- 版本号同步：`electron/migrations/registry.ts:35` 追加 `M30 {from:30,to:31,owner:'P35'}`、`LATEST_SCHEMA_VERSION=31`；`desktop-registry.ts:39` `CURRENT_DESKTOP_SCHEMA_VERSION=31`，两处一致。M30 在参考库循环里与 M24–M29 同款（`for (const db of references) db.transaction(() => apply…)()`），不是新写法。

## C2 人工保存记 human、不传记 ai —— 通过（代码 + 用例双证）

- 缺省：`electron/controllers/db-controller.ts:1256` `origin: origin === 'human' ? 'human' : 'ai',`（注释写明「宁可少记人工」，因 update-content 被 AI 修稿复用）。
- 声明：`src/shared/ipc-channels.ts:1243` args 末位 `origin?: 'human' | 'ai'`，与 handler 签名 `:1240` 一致；该通道在 `src/` 只有 `DraftEditor.tsx:213` 一个调用点。
- 人工路径：`src/components/editor/DraftEditor.tsx:218` 在 `expectedProjectPath` 之后传 `'human'`，`git show` 该文件 numstat `1/0`，编辑器行为零改动。
- 用例：controller 39/39 通过，其中 `records human draft saves…` 断言 `{draftId:1, origin:'human', changedChars:10, oldChars:100, newChars:100}`；`defaults … to ai when origin is omitted` 断言 `origin:'ai'`。

## C3 changedChars 算法 —— 通过（手算与实现一致）

- 算法：`db-controller.ts:246 changedCharsBetween` 先削公共前后缀，再对变化中段做字符级 Levenshtein（替换/插入/删除各 1），`oldChars/newChars` 记全文字符长度；`ContentRepository.getBody` 在 `:1249`、覆盖在 `:1251`、计量在 `:1253`，顺序「先读后写」正确。
- 手算：样本「90 甲 + 10 乙」→「90 甲 + 10 丙」= 削去 90 字公共前缀后，剩 10 乙 对 10 丙，无公共后段，距离 = 10。用例实测 10，差 0%。
- 第二样本：`abc` → `abXc`，削前缀 `ab`、削后段 `c`，中段 `''`→`X` = 1，用例实测 1。
- 边界：若 `contentId` 取不到旧正文则按 `''` 计（=全文字数），只在异常数据上发生，可接受。

## C4 反证：缺省改回 human，用例②必红 —— 通过（真跑）

- 我把 `:1256` 临时改成 `origin: origin === 'ai' ? 'ai' : 'human',`，跑 `pnpm test electron/controllers/__tests__/db-controller-project-context.test.ts`：

```
 ❯ electron/controllers/__tests__/db-controller-project-context.test.ts (39 tests | 1 failed) 25ms
     × defaults draft update metrics to ai when origin is omitted 2ms
 FAIL … > defaults draft update metrics to ai when origin is omitted
AssertionError: expected "vi.fn()" to be called with arguments: [ { draftId: 2, origin: 'ai', …(3) } ]
 Tests  1 failed | 38 passed (39)
[exit code: 1]
```

- **红了几条：1 条**，正是用例②；用例①（显式 human）仍绿，说明断言确实钉在缺省上、不是靠测试自身传值。
- 已 `git checkout -- electron/controllers/db-controller.ts` 还原，复跑 39/39 绿，`git status --porcelain` 空、HEAD 未漂。

## C5 改动面与禁动区 —— 通过（记账一条）

- `git show --name-status HEAD` 恰 10 个文件（7 M + 3 A），无 `package.json`、无 `docs/`、无 `review_findings`、无 v2 契约、无 ADR；`git grep draft_edit_stats -- docs` exit 1（0 命中）。
- 提交后 `git status --porcelain` 为空；HEAD 无新 tag；工作树无夹带。
- **记账①**：`src/` 实际改了 3 个文件，派验单字面只允许 `ipc-channels.ts` 与 `DraftEditor.tsx` 两处，第三处是 `src/shared/project-storage.ts`（`MIGRATION_IDS` 末尾补 `'M30'`，`1/1`）。负责人已在本轮群内按「必要改动」预授权，故记账不拦；若不加这一行，`MigrationId` 类型对不上 M30。

## 独立复核的测试 / 闸门

- `pnpm test electron/migrations/__tests__/m30-draft-edit-stats.test.ts electron/controllers/__tests__/db-controller-project-context.test.ts` → `Test Files 2 passed (2)` / `Tests 42 passed (42)`，exit 0。
- `pnpm test src/shared/__tests__/novel-contracts.test.ts` → `Tests 24 passed (24)`（迁移 ID 顺序契约随 M30 同步）。
- `node scripts/check-fast.mjs` → `typecheck ✓ 18.1s`、`doc links: checked 1470, broken 0`、`doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条`、`全部通过。`，EXIT=0。

## 记账（不影响本卡判定，供负责人后续排卡）

**② 清库不刷新表（交付方报告 §7.4 已自述，我复核确认）**
`electron/repositories/project-clear-repository.ts:46` 的 `CLEAR_COUNT_TABLES.generatedText` 与 `:171-183` 的删除语句都不含 `draft_edit_stats`：执行「清除生成数据」会删 `drafts`/`contents`，但计量行留在库里，清除回执的 counts 也不含这张表。
补充一条我核过的边界，免得被高估：`drafts.id` 是 `INTEGER PRIMARY KEY AUTOINCREMENT`（`electron/migrations/baseline-schema.ts:113`），SQLite 在 AUTOINCREMENT 下不复用已删 id，所以**不会出现「新草稿继承旧 save_count」**，只剩「旧行残留 + 清除不彻底」这一个后果。卡面禁改其它文件，本卡没动是对的；建议单独一张小卡把新表并入 `generatedText` 清单。

**③ 空保存也计一行**
正文内容未变时 `changedChars=0` 仍插一行、`save_count` 照加 1（handler 无 `changedChars === 0` 短路）。A3 按改动字数算不受影响；A2 若直接数行数，「只点保存没改字」会被算成动作。建议在 A2 口径里写明「以 `changed_chars>0` 计动作」，或后续在写入口过滤。

**④ 计量可静默丢**
`DraftEditStatsRepository.record` 在 `getProjectDb()` 为空时直接 return、插入异常只 `console.warn`——符合「计量不拖累保存」的设计，但失败无计数、无日志文件留痕（只有主进程 console）。若 A2/A3 要当证据，报表侧需能看出「某次保存没有对应行」。

## 明确未做（不算缺陷）

- 未跑全量测试 / `test:browser` / `pnpm dev` / 打包（并行隔离与卡面红线一致）。
- 未用真实旧项目副本做升级演练（C1 的旧库来自 `initializeLegacyBaselineSchema` + v30 迁移，与交付方同一构造方式；真实项目首启验证归后续真机轮）。
- `probe.txt`（1B / `x`）与信号 189B→192B 原地改写不参与本判定（负责人与大肥鱼已定案）。
