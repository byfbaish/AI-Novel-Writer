# CARD-S3-D10 交件报告 · 清空生成内容（apply 位）

执行方：developer
本卡代码由包 `f268ca863c29999cc7609aa3db9b871d2a597153c2f0a45c06e7e09d0fd58983` 提供，developer 仅 apply 与验收。

## 0. 判定面

- worktree：`C:/develop/workspace/AI-writer/wt-d10`
- 分支：`card/s3-d10-clear-reset`，起点 `9cd24897`
- 提交：`71f72b9bcc36e362ac050e028f0b82c478506699`（`CARD-S3-D10`），未 push、未动 develop 主区
- `git status --porcelain -uall`：0 行（空）
- `git diff --numstat 9cd24897..HEAD`：
  ```
  127	0	electron/repositories/__tests__/project-clear-receipt.test.ts
  12	1	electron/repositories/project-clear-repository.ts
  ```
- 新增文件：无（`--diff-filter=A` 输出为空）⇒ R4 第 2 条“无新增生产文件”成立。
- 白名单外改动：无（两件都在包 §五 白名单内）。

## 1. 落盘内容（逐条对包）

1. `electron/repositories/project-clear-repository.ts`
   - `CLEAR_COUNT_TABLES.generatedText`（`:46`）追加 `generation_artifacts`／`generation_attempts`／`generation_runs`／`generation_roots`。
   - `:174` 之后、`DELETE FROM reviews` 之前：`if (hasTable(db, 'review_cycles')) db.prepare('DELETE FROM review_cycles').run()`。
   - `cleared.push('generatedText')` 之前：按 `generation_artifacts → generation_attempts → generation_runs` 循环删，再删 `generation_roots`。
2. `electron/repositories/__tests__/project-clear-receipt.test.ts`
   - 新增 3 条用例（四表归零并计入 4 类／老库无 M01 不抛／review_cycles 与 reviews 次序守门）。

## 2. 证据（命令原文与末行）

- `node scripts/run-tests-electron.mjs electron/repositories/__tests__/project-clear-receipt.test.ts`
  ```
   ✓ electron/repositories/__tests__/project-clear-receipt.test.ts (5 tests) 29ms
        Tests  5 passed (5)
  ```
  `EXIT=0`
- `node scripts/check-fast.mjs`
  ```
  [check:fast] 全部通过。
  ```
  `EXIT=0`
- 文件 sha256：
  ```
  78614951b9834673f2f556e6d7f10ed798d78c27d6981962bd4f892f4b60568f  electron/repositories/project-clear-repository.ts
  99fd5afe8f233e2d3502def689c5272a2fc515a791abc65397c79a131d68560d  electron/repositories/__tests__/project-clear-receipt.test.ts
  ```

## 3. 判据 5 的守门用例（admin 11-22 13:1x 硬要求）

- 用例真造了 `confirmation_review_id ≠ review_id` 的数据行：`seedReviewPair()` 先插 confirmation 目标 review（rowid 更小），再插 `review_id` 指向的 review，断言 `confirmationReviewId < reviewId`；`review_cycles` 行按 `review-cycle-repository.ts:762-766` 的 UPDATE 形态取值。
- 断言结局：`review_cycles` = 0、`reviews` = 0、`generation_roots` = 0，且 `clearGeneratedData({generatedText:true})` 不抛。

## 4. 事实更正（与裁定前提不同，附实测）

裁定与更正段写「`:61` 无 ON DELETE＝RESTRICT」。实测该列为 **NO ACTION**：

```
pragma foreign_key_list(review_cycles) →
{"id":2,"table":"reviews","from":"confirmation_review_id","to":"id","on_update":"NO ACTION","on_delete":"NO ACTION"}
{"id":3,"table":"reviews","from":"review_id","to":"id","on_update":"NO ACTION","on_delete":"CASCADE"}
```

两种删法实测（同一形态数据行）：
- `DELETE FROM reviews WHERE id=<confirmation_review_id>` → `FOREIGN KEY constraint failed`（子行还在，NO ACTION 在语句结束检查时挡住）。
- `DELETE FROM reviews`（整表）→ 不抛、两表归 0：`review_id` 那条被删时 CASCADE 在同语句里把子行带走，检查时已无引用。
- 变异实测：把兜底行挪到 `cleared.push('generatedText')` 之前（reviews 之后）→ `Tests 5 passed (5)`，**「挪回必红」仍造不出来**（此为包内该句不成立的实测依据，已按事实写进用例注释）。
- 结论：兜底行是保险——它守住「将来若把 reviews 改成按条件删」这条路径；今天这条整表删路径上它不是承重的。

## 4.5 判据 1：残留宿主逐表清单（本次 apply 后复核）

| 表 | 现象里的哪类卡片 | 读它的入口（文件:行） |
|---|---|---|
| `generation_runs` | 「第1章生成记录」每条记录一行 | `electron/services/main-generation-owner.ts:334` `SELECT run_id FROM generation_runs ORDER BY created_at_ms DESC, rowid DESC`；IPC `generation:list`（`electron/controllers/generation-controller.ts`） |
| `generation_artifacts` | 记录下的候选稿／「确认继续已选正文」卡片 | `src/components/panels/AIOutputPanel.tsx:320-344`（`item.view.artifacts`／`candidates`／`unsavedTails` 判定）；`main-generation-owner.ts:252` 以 `SELECT 1 FROM generation_artifacts WHERE artifact_id=? AND status<>'discarded'` 判可见 |
| `generation_attempts` | 「第1章审稿候选」的恢复稿／重试可用态 | `generation:read-context` 的 `recovery`（`AIOutputPanel.tsx:321-323`）；`main-generation-owner.ts:915` 由 `generation_artifacts` 反查 `attempt_id` |
| `generation_roots` | 批次根（多章批量生成留下的批次卡） | `generation:list-batches`（`generation-controller.ts:285`）；`main-generation-owner.ts:1032/1101/1251` 以 `generation_runs r JOIN generation_roots g` 取根 |

即：三类残留卡片不是三处独立来源，而是「根 → 运行 → 尝试 → 产物」这条链上的四张表；只删 `runs` 会因外键（子表引用 `generation_runs`／`generation_roots`）残留或在删父表时报错，故按 `artifacts → attempts → runs → roots` 先子后父删。

## 5. 判据覆盖（本 apply 位能交到哪一步）

| 判据 | 状态 | 说明 |
|---|---|---|
| 1 残留宿主清单 | 外派已交，本卡已复算（见 §4.5 四表清单） | 三类卡片宿主＝`generation_runs`／`generation_attempts`／`generation_artifacts`（卡 §1③） |
| 2 实机三档清空后卡片数 0 | **未做**（口径待裁） | 卡 §5 写「实机复验须在 develop 由 developer 执行」，与 11-22 10:36 主身口径「worktree 只跑单元测试、禁实机 GUI、developer 不写生产码入库」冲突；我无权动 develop 主区 |
| 3 回执原文与 DB 计数对账 | **未做**（同上） | 同上，需实机 |
| 4 订阅方非零（文件:行＋运行时日志） | 运行时日志未取 | 需实机 |
| 5 单测＋check:fast | **通过** | 见 §2 |
| 6 实例纪律三项 | **未产生** | 本卡未跑实机，故 `instancesThisRun`／`exitCode`／`leftoverElectronProcesses` 无读数，不虚报 |

## 6. 停手说明

判据 2/3/4 需要真实主进程＋IPC＋界面，属 live 层；我在本 worktree 内按现行纪律不跑实机 GUI。请裁定这两条由谁在何处执行（QA 入库后在主树跑／另开实机卡），我按裁定补证据或直接交 QA 判静态与单测部分。

<!-- DONE -->
