# P36 首验报告（QA）

- 卡号：P36 · 清库带上 `draft_edit_stats`
- 对象：`66b188f8cb953edfd9401857b7b76d5f4657212a`「fix: clear draft edit stats with generated text」（父 `28b0e822`，2026-11-14 15:53:32 +0800）
- 派验单：`.batch/night/review-requests/P36.md`（C1–C5 + 五条独立判定项）
- 交付方报告：`.batch/night/reports/p36-clear-stats.md`（5,263B / MD5 `1D03794C41C4057E19165A35A3712ABC` / 135 行 / 末行 `<!-- DONE -->`）
- 信号：`delivered\dad6df13f302\p36-clear-stats.done`（137B，15:54:29 落盘，未原地改写）
- 判定：**PASS 5/5**（1 条备注，不拦）

## 环境

`pnpm test`（Electron ABI 145）；工作区 `C:\develop\workspace\AI-writer\develop`；判定时 HEAD = 判定对象，porcelain 空，tag 30 个（未新增）。

## C1 清库真归零（自造库 + 原始输出）

一次性用例（跑完即删）用 `:memory:` 建 v31 库（`initializeLegacyBaselineSchema` + `migrateSchema(...CURRENT_DESKTOP_SCHEMA_VERSION)`），插 1 条 draft + 1 条 contents + **2 行** `draft_edit_stats`（`human` 10 字 / `ai` 3 字），再调 `ProjectClearRepository.clearGeneratedData({ generatedText: true })`。原始输出（`C:\develop\workspace\tmp\p36-qa-clear.log`）：

```
QA-P36 清理前: finalized_draft_import_operations=0 | post_process_steps=0 | post_process_runs=0 | reviews=0 | revisions=0 | draft_edit_stats=2 | drafts=1 | contents=1 | summary_snapshots=0 | volume_handoffs=0
QA-P36 清理后: finalized_draft_import_operations=0 | post_process_steps=0 | post_process_runs=0 | reviews=0 | revisions=0 | draft_edit_stats=0 | drafts=0 | contents=0 | summary_snapshots=0 | volume_handoffs=0
QA-P36 counts.generatedText = {"categories":3,"rows":4} cleared = ["generatedText"]
```

⇒ 计量表确实归零（2→0），且与 drafts/contents 同批清掉。

## C2 计数与表数

- `CLEAR_COUNT_TABLES.generatedText` 表数：父提交 `28b0e822` **9** → HEAD **10**（`draft_edit_stats` 插在 `revisions` 之后、`drafts` 之前）。
- 实测 `counts.generatedText = { categories: 3, rows: 4 }`：3 = 有行的表数（drafts / contents / draft_edit_stats），4 = 三表行数之和（1+1+2）。与交付方用例「真库计数 3 类 3 行」同口径，只是我多插了 1 行计量数据。
- 派验项措辞「差是不是正好 1」按**表清单长度**成立（9→10）。

## C3 老库路径（我用真老库，比 mock 更强）

同一套 `:memory:` 库先只迁到 **v30**（`migrateSchema(..., 30)`），确认 `user_version = 30`、`draft_edit_stats` **不存在**，插 1 draft + 1 contents：

```
QA-P36 老库 user_version = 30 有 draft_edit_stats = false
QA-P36 老库清理前: … draft_edit_stats=<无表> | drafts=1 | contents=1 …
QA-P36 老库清理后: … draft_edit_stats=<无表> | drafts=0 | contents=0 …
QA-P36 老库 counts = {"categories":2,"rows":2}
```

⇒ 不抛错，行为与改前一致（计数只算实际有行的表，不会把不存在的新表算进去）。

## C4 反证（两条都做了）

- **A 去掉 `hasTable` 保护**（`if (hasTable(db, 'draft_edit_stats')) …` → 直接 `db.prepare('DELETE FROM draft_edit_stats').run()`）→ `Tests 1 failed | 12 passed (13)`，红的是：

```
× skips draft edit stats without throwing when the legacy database has no such table
AssertionError: expected [ …(83) ] to not include 'DELETE FROM draft_edit_stats'
```

- **B 把 DELETE 挪到 `DELETE FROM drafts` 之后**（只交换 `:178`/`:179` 两行）→ **13/13 全绿**。

**备注（不拦）**：B 分支无用例保护，即「先删计量子表再删 drafts」这个顺序目前只靠约定，没被测试锁住。功能上无影响（`draft_edit_stats.draft_id` 无外键、`drafts` 删除不触发级联），所以本卡 PASS；若以后要锁顺序，应补一条断言语句先后顺序的用例，别指望计数用例发现。

## C5 改动面

```
51	0	electron/repositories/__tests__/project-clear-repositories.test.ts
3	1	electron/repositories/project-clear-repository.ts
```

只有点名两文件；`git show --numstat` 无 `package.json`/docs/契约/UI；判定后 `git checkout` 还原反证改动，`git status --porcelain` 空（原始输出 `PORCELAIN_END` 前无行）。

## 备注与建议

1. 顺序无用例保护（见 C4 备注）—— 记 0.5.0 已知项即可，不必回工。
2. 计量表清理只由 `generatedText` 档带走；`blueprints` 等其它档不动它，符合卡面「只改 generatedText 清单」。
3. 交付方报告对 C1 的表述是「真库计数 3 类 3 行」，与我的 3 类 4 行不冲突（我多写 1 行计量数据以证「多行也全清」）。

## 结论

**PASS 5/5**，交负责人终审。
