# S2 首次验收判词 · FACT preflight 三条规则（attacks 族）

- 卡号：`bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b`
- 判定面（只判这一个 HEAD）：`0ec6c89c39a4c48f890d9caab41dd13a7db61805`，分支 `card/fact-preflight-3rules`（wt-2），父 `7bffc1ee`
- 派验：大肥鱼 2026-11-23 18:3x（判定面 + 四项复核 + 三条记账）
- 验收人：QA（首次验收，只判本卡；终审归项目总负责人）

## 结论

**PASS（首次验收通过，建议入库后按 BACKLOG 记一条 R3 窗口限制）。**

三条规则（R1 未登记空间 / R2 越窗 / R3 跨章同格）实现与实施包 §2 逐条同构，纯函数、零 IO、零语义解析、缺字段 fail-open、`slot:` 前缀独立、正负向用例非空断言（已用变异测试证明）。无 [live] 判据（本卡纯函数＋单测），判词不涉实机。

## 判据逐条

| # | 判据（卡面/阶段 acceptance） | 层级 | 证据 | 结论 |
|---|---|---|---|---|
| 1 | 纯函数、无 IO（shared 层） | [static] | 我自跑严格口径 grep：`src/shared/space-time-consistency.ts`、`src/shared/consistency-preflight.ts` 均 rc=1 零命中；`space-time-consistency.ts` 仅两条 import（`:16` 纯类型 `blueprint-key-events`、`:17` `space-machine-line`） | 满足 |
| 2 | 零语义解析 | [static] | 判定只走 `parseSpaceRules`→`byName.get(attack.space)`（`space-time-consistency.ts:414-416`）、`parseTimeWindow`＋`isWithinWindow`（`:449-452`）、`(space,hour)` 分组（`:497-502`）；无正则匹配正文、无意图词 | 满足 |
| 3 | 缺字段 fail-open | [static]+[mock] | `:415` `if (!rules.length) return []`；`declaredSlotAttacks`（`:379-390`）对 `kind!=='slot'`/空 space/空 hour 一律丢；`hours=none`（`:447`）、无每日窗口（`:449`）跳过；`parseTimeWindow` 失败跳过（`:450-451`）。变异测试：把 `:415` 改成 `if (false && …)` ⇒ 3 条负向用例转红（见下） | 满足 |
| 4 | `stableFactKey` 前缀隔离 | [static]+[mock] | `fnvStableFactKey(prefix, parts)`（`:235-242`）；`spaceTimeStableFactKey` 原样转发 `'space'`（`:248-250`）；`slotStableFactKey` 转发 `'slot'`（`:253-255`）。我**独立手写** FNV-1a 64 复算：`['unregistered-space','6','查无此店']` → `space:6f155ee620aee7cd`（与测试字面量 `:534` 一致）、同入参 `slot:` → `slot:6f155ee620aee7cd`；`['a']` → `space:af63dc4c8601ec8c` / `slot:af63dc4c8601ec8c`（哈希同、前缀不同 ⇒ 族间不串扰） | 满足 |
| 5 | 每条规则正向「必须判」＋负向「旧项目零误报」≥1 例 | [mock] | R1 正向 `:404-416`、R1 负向（world 为 `undefined/null/''/'   '/纯散文` 五种）`:423-430`；R2 正向 `:452-461`、R2 负向 `hours=none`/按月窗口/非法 `25:00`/缺 hour/窗口内 `:463-492`；R3 正向 `:495-507`、R3 负向（单章/同章重复/不同格）`:509-526`；键隔离 `:530-537`、hash 回归 `:540-542`。接线层另有豁免/撤销/fail-open/R3 仍判 `:154-247` | 满足 |
| 6 | 面板/coverage/提示词不动 | [static] | `git diff --name-status 7bffc1ee..HEAD` 只有 5 个 M、无 A/D；`src/components/**` 零改动；`grep ConsistencyPreflightCoverage` 在 diff 中零命中 | 满足 |
| 7 | 未 push、develop 未动 | [static] | `git ls-remote origin 'refs/heads/card/*'` 无 `card/fact-preflight-3rules`；`exp/resource-ledger` 仍 `f2989162`；develop HEAD `444aa228`、`git status --porcelain -- src` 0 行 | 满足 |

## 我自跑的原文（判定面 wt-2）

```text
$ pnpm test src/shared/__tests__/space-time-consistency.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts
 ✓ src/shared/__tests__/consistency-preflight-space-time.test.ts (27 tests) 9ms
 ✓ src/shared/__tests__/space-time-consistency.test.ts (56 tests) 10ms
 Test Files  2 passed (2)
      Tests  83 passed (83)
FINAL_EXIT=0

$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 17.4s
doc links: checked 1467, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
EXIT=0
```

白名单＋改动量（`git show --numstat --format= 0ec6c89c`）：`space-time-consistency.ts` 179/6、`shared/consistency-preflight.ts` 64/1、`services/consistency-preflight.ts` 22/16、`space-time-consistency.test.ts` 176/0、`consistency-preflight-space-time.test.ts` 101/2 ⇒ `5 files changed, 542 insertions(+), 25 deletions(-)`。

## 变异测试（证明负向用例不是空断言）

1. 精确改 `space-time-consistency.ts:415`（新函数 `findSlotAttackConflicts` 的 fail-open 守卫）为 `if (false && !rules.length) return []` ⇒
   `3 failed | 80 passed`，转红的三条正是：`★ fail-open：worldBuildingText 缺失 / 无机读行 ⇒ R1/R2 一条都不判`、`★ 设定层缺失时 R1/R2 fail-open，但 R3 仍判`、`负向：世界观一条机读行都没有 ⇒ 不判（旧项目零误报）`。
2. 还原后：`git status --porcelain -- src` 0 行、HEAD 仍 `0ec6c89c`、83 passed 全绿。
3. 前两次误改命中旧函数 `:281`（老 `findSpaceTimeConflicts` 守卫），仅老用例转红，已作废不计。

## 四条裁决的落实情况

| 裁定 | 落实 | QA 认定 |
|---|---|---|
| ① 宽口径 `fs` 作废，改严格 IO 口径 | 我自跑 `grep -nE "\brequire\(|from '(node:|fs|path|electron)|\bipc\."`：两个 shared 文件 rc=1 零命中；`services/` 命中 3 行 `ipc.invokeWithProjectSession`（`:29/:40/:45`，全为既有调用，非本卡新增） | 采信 |
| ② `porcelainLines` 拆 `porcelainSrcLines: 0` ＋ 3 行 `d12-*` | `porcelain -- src` 0 行；`-uall` 3 行 `d12-*` 的 mtime 为 11-21 18:53/19:18/19:56（早于本卡 18:31 提交），确为遗留件 | 采信 |
| ③ `enUS` 允许对译 | 逐条对照 R1/R2/R3 的 zhCN/enUS：占位符一致、语义一致、无漏译 | 采信 |
| ④ 排序补 `space/hour` 字典序 | `:507` `.sort((a,b)=>a.last-b.last||a.space.localeCompare(b.space)||a.hour.localeCompare(b.hour))`，主键仍 `sourceChapter` 升序 | 采信 |

## 记账（不打回，需落档）

1. **产物已补落并核过**（此前记「产物未落盘」）：`C:\tmp\fact-s2\workbuddy\receipt-to-owner.md`，133 行／5,884B／sha256 `a800adc744152c2340027fee6830e272a40192b37a7d74b8d68a63a02286e09a`，五段齐；其自报 numstat、`space:` 前后字面量、83 passed 与我自己的读数逐项相同。落盘前那一轮按「产物未落盘」记账，现已闭合。
2. **R3 判定窗口限制（建议 BACKLOG 一行）**：R3 只能看到调用方传入的 `blueprints`。单章路径 `src/components/dialogs/ChapterCreationDialog.tsx:362` 只传 `[{…}]` 一个 ⇒ R3 在该路径**永不触发**；批量路径 `BatchChapterCreationDialog.tsx:223-226` 传本批窗口 ⇒ **跨批次的同格重复检测不到**。属纯增量下的已知覆盖缺口（不产生误报），与裁定①「单章不传 `structuredRefs`」同性质，建议与之一并进 BACKLOG，不在本卡扩范围。
3. 外派 receipt 里第 3 条 3 行 `d12-*` 仍标「说明」未标「已闭合」——文字问题，按裁定②不影响判定。

## 判词边界

- 本判词只覆盖 `0ec6c89c` 这一个 HEAD；以后任何改动（含合并冲突解法、amend）都需重取。
- 本卡无 [live] 判据，我**未**做实机（对话框触发 preflight 属 UI 链路）；若入库后要验「面板上真能看到这三条」，属另一张 live 卡。
- 入库合并 sha 由 admin 回填；`exp/resource-ledger` 推送归主身。
