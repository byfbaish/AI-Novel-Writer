# S5 收口清单（admin 下发 · 2026-11-25 01:35 +0800）

判定面：wt-2 = `card/s4-o1-event-progress`，HEAD `85c927aef374dd92475a3b145fb3d52aa1f53c32`，porcelain 0。
本次 S2–S4 的提交链（在卡分支上，未 push）：

| 阶段 | 提交 | 内容 | 文件数与行数 |
|---|---|---|---|
| S2 C1-a | `34aa0000` | 相关性筛选（三档） | 4 文件 +1,036/−1 |
| S2 P0 | `41daa79c` | M30 漏登 `draft_edit_stats` 补登 | 3 文件 44/6 |
| S2 C1-b | `8a42a566` | 字段级并排对比＋三选一＋排序＋M31 快照 lane | 16 文件 +1,642/−6 |
| S3 P6-a | `e219977b` | 章区间纯函数＋每章预算派生＋视图 | 7 文件（含 task-budget-planner.ts 1/1） |
| S3 P6-b | `a1bcabee` | NarrativeThreadEditor 接线＋browser 测试＋设计稿 | 3 文件 368/37 |
| S3 P6-c | `cbbe82c3` | 复用 NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT（F1 打回最小修） | 1 文件 3/2 |
| S4 O1-a | `641ffc0c` | 事件进度纯函数＋测试 | 2 文件 630/0 |
| S4 O1-b | `85c927ae` | 进度行注入＋调用点＋单测 | 5 文件 132/5 |

## A. 三张卡置 done 的证据对应

- `744f13a8`（C1）：`34aa0000` + `41daa79c` + `8a42a566`；判词 `s2-c1a-qa-verdict.md`（167 行／10,390 B／`30dc2d57…`）与 `s2-c1b-verdict.md` **v2**（143 行／15,110 B／`855bd8432fc810134745160875769631fb0beb585eac349cd3990798e1960f5c`）。browser 覆盖弹窗三选一：`src/components/characters/__tests__/character-regeneration-diff-panel.browser.tsx`（144 行）。
- `342b428f`（P6）：`e219977b` + `a1bcabee` + `cbbe82c3`；判词 `s3-p6-verdict.md`（160 行／14,217 B／`3665ffd0e99d31b547f04fd521ee8b2ac97ea205e43e4bc72b5cce3b1dc41524`，§1–§7 原文＋§9 复核）。
- `58188c1c`（O1）：`641ffc0c` + `85c927ae`；判词 `s4-o1-verdict.md`（113 行／14,691 B／`4e9b88c7…`），Tests 106 passed = 基线 97 + 9，四个必发变异全真红。

## B. 必须补的两处文档（本 goal 内，白名单外由 S5 统一做）

1. **C1 `source_revision` 语义**：实现为准（存覆盖**前**），现有 `docs/*` 写反了。若不改文档，J6 正常回退会一直判 STALE、J7 退化成恒成立。等我方 QA 复核实现后按实现改文字。
2. **O1 设计稿 §3.2／§3.4 订正**：`docs/design/architecture/o1-unit-event-progress-design.md` 的 N 口径改为「本批章数 b」并按 `s0` 偏移；同时写明快照表归 O1-b、循环 import 为已接受技术债。

## C. 收口件必须记的账（一条不许漏）

1. **两次外派越线**：豆包自行 `git commit` 两次 —— `41daa79c`（17:17:08）、`8a42a566`（17:38:07，发生在 17:33 转达「只写盘」之后）。只登记、不改历史。
2. **C1-b 判词用 v2**（`855bd843…`）；v1 `1abdf4bf…`（138 行／14,660 B）作废，不引用。
3. **J8 缺实机半**：无窗口实机证据，由同进程 SELECT 原文＋`live-evidence.json` 替代，需另开卡补实机。
4. **P6 超限静默无提示**：区间超 10 章只是禁用提交按钮，无文案；进 BACKLOG 建议段。
5. **豆包 S4 回执未落盘**（`C:\tmp\c1-s2\doubao\s4-o1\` 目录未建），由联络人抄录 `receipt-to-owner.md` 172 行／12,329 B／`d96dea1e…`，首行标 `[抄录]`；不追认为执行方回执。
6. **循环 import 技术债**：`src/shared/arc-position.ts:2` ⇄ `src/shared/o1-event-progress.ts:39`（`splitMinorSteps`）；断环需改 `unitEventSteps` 入参形状，随 O1-b。
7. **`startStep` 未钳 fail-open**：`architecture.command.ts:3668` 传 `lastDeclaredStep(...) ?? 0`，`o1-event-progress.ts:104` 在 `startStep > stepCount-1` 时 `return null` ⇒ 整批进度行静默消失、无错值也无提示。建议在 `arc-position.ts:1362` 附近钳到 `[0, stepCount-1]`，随 O1-b。
8. **`t84789` 来源**：本卡实测自证，缺独立出处，S5 补来源或改判据措辞。
9. **pre-commit 钩子缺 `CARD-xxxx` 未拦提交**：记一条工具链待办，不追改历史。
10. **C1 BACKLOG 建议**：`picked` 不随筛选剪枝，先勾后关档会删到看不见的卡（既有语义、非本卡引入）。
11. **P6 派单与实施包措辞不一致**（「除这些行以外」那句）；实施包要求原样，不记红，只记瑕疵。
12. **J4c 括号算例勘误**：`.batch/night/staging/s4-o1/erratum-01.md`（27 行／1,824 B／`91251e53…`）。

## D. 三行闸（收口件必须贴原文）

```
node scripts/check-fast.mjs            → 期望 EXIT=0
git status --porcelain -uall           → 期望 0 行
git rev-parse HEAD  vs  git ls-remote origin refs/heads/exp/resource-ledger
```

push 归主身：本地与远端相等之前，S5 不算 done。远端现值 `f2fd6d047830ccadfeb2082f05a642cbe79bc8cf`。

## E. 要更新的三处正文

1. `docs/roadmap/ROADMAP.md`：四条 L2 转达标，删掉对应的「阻塞」证据行。
2. `docs/plans/prompt-assembly-backlog.md`：C1／P6／O1 三题移入已完成段，超限无提示与 `picked` 剪枝进建议段。
3. 台账：追加本轮 S2–S4 全部提交与判词，历史原话只加括注。

## F. 边界

- 白名单＝`docs/` 三处正文＋`.batch/night/` 收口件；**不许动 `src/` 任何文件**（O1-b 那两条技术债不在本 goal）。
- 收口件落 `.batch/night/org/`，正文带行数／字节／sha，贴每处改动行号。
- 收口件写出后先给我核，我核过再报主身 push。
