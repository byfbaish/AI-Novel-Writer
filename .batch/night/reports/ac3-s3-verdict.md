# AC3/S3 首验判词 · 弧层引用闭合（卡 `ed210a27`）

- 判定面：`wt-2` 分支 `card/arch-ac3-s3`，HEAD `b5a14f1cefaa57c5f02894139f2b4bede6f5cce1`（父 `57d05871`），`git status --porcelain` 0 行，未 push／未 tag。
- 交件面：`git show --numstat b5a14f1c` → `129/0 src/shared/arc-cover-consistency.ts`、`179/0 src/shared/__tests__/arc-cover-consistency.test.ts`、`13/2 src/services/consistency-preflight.ts`（合计 `+321/−2`，3 文件）。
- 判位：QA 首次验收（按卡面／派单独立复跑）。终审归项目总负责人；本判词只覆盖 AC3 五判据与「重排报 UNKNOWN_NODE／接线只此一处／无新增流程步骤」三问。
- 取证时间：2026-11-24 01:11–01:16（Asia/Shanghai）。取证用的临时用例 `src/shared/__tests__/qa-ac3-reorder.test.ts` 跑完即删，删后 `porcelain` 0 行。

## 1. 判据表

| # | 判据 | 分层 | 结论 | 证据 |
|---|---|---|---|---|
| ① | 弧层校验接进既有预检通路，能判红 | [mock] | PASS | §2 测试原文；§3 变异 M-c／M-e |
| ② | 结构位 ID 重排后报 `UNKNOWN_NODE` | [mock] | PASS | §4 我亲自实跑（重排前 INV-1 → 重排后恰 1 条 UNKNOWN_NODE） |
| ③ | `validateArcCovers` 生产接线只此一处，无新增流程步骤 | [static] | PASS | §5 grep 原文：`db:project-core-get` 计数 1（前后同）；调用方计数前后逐项相同；`arc-node.ts` 零改 |
| ④ | 纯函数、无 IO、无副作用、缺字段 fail-open | [static] | PASS | §5 严格 IO grep rc=1 零命中；§4 豁免用例；`#4`–`#9` fail-open 六例 |
| ⑤ | 正负用例与变异测试到位 | [mock] | PASS（带 §6.1 记账） | §3 八发表；负向非空由 M-b／M-c／M-d／M-e 证明；M1／M2／M-f 记等价 |

**总判：PASS**（五条全过；§6.1 的「接线本身无测试覆盖」不构成打回理由——判据⑤要求的是「负向断言非空」，该要求在纯函数层已由四发有效变异满足，接线层属方法学建议，见 §6.1）。

## 2. 独立复跑（我自跑，非采信回执）

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/arc-cover-consistency.test.ts \
    src/shared/__tests__/consistency-preflight-space-time.test.ts src/shared/__tests__/arc-node.test.ts
 ✓ src/shared/__tests__/arc-cover-consistency.test.ts (11 tests) 8ms
 ✓ src/shared/__tests__/arc-node.test.ts (27 tests) 9ms
 ✓ src/shared/__tests__/consistency-preflight-space-time.test.ts (27 tests) 8ms
 Test Files  3 passed (3)
      Tests  65 passed (65)
EXIT=0
```

交付方与 developer 报的是「三文件 46 passed」——那组只含 `arc-cover-consistency`＋两个 preflight 文件；我另把 `arc-node.test.ts`（27 例）一并跑，确认接线没有反向破坏结构解析。

```
$ ./node_modules/.bin/tsc --noEmit
（无输出）TSC_EXIT=0
```

```
$ node scripts/check-fast.mjs
[check:fast] typecheck ✓ 25.5s
doc links: checked 1468, broken 0
doc placement: 扫描 439 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
CF_EXIT=0
```

`pnpm check:fast` 字面入口在 `wt-2` 不可用（`node_modules` 是指向 develop 的目录联接，pnpm 要 purge 时抛 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`），按前例采信等价入口 `node scripts/check-fast.mjs`。

## 3. 变异测试（八发，全部我自己动手，每发 `cp` 备份复原）

| 发 | 变异 | 结果 | 性质 |
|---|---|---|---|
| M-a | 接线处 `...findArcCoverRisks(...)` → `...([] as ReturnType<...>)` | `Tests 11 passed (11)` **无红** | **接线层零覆盖**（见 §6.1） |
| M-b | `messageFor` 的 `UNKNOWN_NODE` 分支 `zhCN` 恒空串 | `1 failed \| 10 passed`，红=`#2` | 有效 |
| M-c | `arcCoverStableFactKey` 去掉 `code` 段 | `5 failed \| 6 passed`，红=`#1 #2 #3 #10 #11` | 有效 |
| M-d | 豁免过滤去掉 `!item.revoked` | `1 failed \| 10 passed`，红=`#10` | 有效 |
| M-e | 删 `if (nodes.length === 0) return []`（`:105`） | `1 failed \| 10 passed`，红=`#8` | 有效（我补的发） |
| M1 | 删章号守卫（`:100`） | `11 passed` **无红** | 等价（`arc-node.ts:242` `validateArcCovers` 首行同守卫） |
| M2 | 删 `totalChapters` 守卫（`:102`） | `11 passed` **无红** | 等价（`arc-node.ts:105` `listArcNodes` 首行同守卫） |
| M-f | 删 `chapter.covers.length === 0`（`:109` 半句） | `11 passed` **无红** | 等价（`arc-node.ts:242` `covers.length === 0` 已兜底；我补测的发） |

复原后：`git status --porcelain` 只有临时用例一行，删后 0 行；`git rev-parse HEAD` 仍 `b5a14f1c`。

对 admin 三选一的核对：选项①「接线换 `...[]`」实测**不转红**（M-a），不能作有效证据；真正有效的是②（M-c）与③（M-b）。developer 交的 M6＝③，成立。

## 4. 重排场景实跑（我的判位任务）

临时用例 4 例，跑完删除；命令与原文：

```
$ node scripts/run-tests-electron.mjs src/shared/__tests__/qa-ac3-reorder.test.ts
 ✓ src/shared/__tests__/qa-ac3-reorder.test.ts (4 tests) 7ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

夹具＝测试文件同一份 150 章三级弧光，只把大弧一的「中弧 1 门牌错位（含小弧：睁眼十秒／纸门牌／第一笔登记账）」与「中弧 2 三方上门」**整段对调**（含小弧行、保留自报章数），大纲里同一行 `覆盖：M1-1/小弧:纸门牌`、同一章号 3：

1. 重排前：`stableFactKey = arc:cover:INV-1-OUT_OF_RANGE:M1-1/小弧:纸门牌`（该小弧在 10–18 章，第 3 章提前声明）——**不是** UNKNOWN。
2. 重排后：`findings` 恰 1 条，`stableFactKey = arc:cover:UNKNOWN_NODE:M1-1/小弧:纸门牌`，`severity=warning`，`sourceChapter=3`，`sourceLayer=undefined`，`issue.zhCN` 含「可能拼写错误，或弧光已重排」，`evidence` 含「未知结构位」。
3. 对照：重排后 `M1-2/转折` 仍存在（只是区间变成 27–52）⇒ 报 `INV-1-OUT_OF_RANGE`，**不**报 UNKNOWN——证明失效的只是「名字型位置 ID」（小弧 ID 含小弧名），纯序号 ID 只会错位不会消失。这与 `arc-node.ts:58-64` 的已知限制注释一致。
4. 豁免：把重排产生的 `arc:cover:UNKNOWN_NODE:M1-1/小弧:纸门牌` 放进未撤销豁免 ⇒ `findings` 为 `[]`。

结论：Goal 的「重排即报 UNKNOWN_NODE 供复核」在函数层成立，且文案对作者有指向性（改 ID 或改声明），不是泛泛「未知」。

## 5. 接线与流程（static）

```
$ git diff --name-only 57d05871 b5a14f1c
src/services/consistency-preflight.ts
src/shared/__tests__/arc-cover-consistency.test.ts
src/shared/arc-cover-consistency.ts
```

- 三文件，`arc-node.ts`／`arc-position.ts`／任何 `components/`／任何 `workflows/commands/` 零改 ⇒ 未动流程步骤与调用链。
- `readConsistencyPreflight` 调用方计数：`57d05871` 与 `HEAD` 完全相同（`BatchChapterCreationDialog.tsx:2`／`ChapterCreationDialog.tsx:2`／`consistency-preflight.ts:2`）。
- IPC 读取次数：`grep -c "db:project-core-get" src/services/consistency-preflight.ts` = `1`（接线前同一行；本笔只是把返回类型加宽并多留三字段，没有新增第二次读）。
- 严格 IO grep（`require\(|from '(node:|fs|path|electron)|ipc\.|document\.|window\.`）→ `GREP_RC=1` 零命中；新模块只 `import ... from './arc-node'` 与 `import type`。
- 接线形态：`import` 一行（`:11`）＋ findings 数组里一个 spread（`:72`），`arcLayer` 在既有 `try` 内取值，`catch` 时保持 `undefined` ⇒ `{...undefined}` 合法、纯 fail-open。

## 6. 记账（不打回，需下一手知悉）

**6.1 接线层无测试覆盖。** M-a 把 `findArcCoverRisks(...)` 整段换成 `[]`，11 例全绿——说明现有用例只测纯函数，**没有任何用例验证「服务层真的把这行调起来了」**。判据⑤在纯函数层已满足（§3 四发有效），但「接进去了」目前只有 code review 为证。建议记 BACKLOG：给 `readConsistencyPreflight` 加一条服务层用例（mock `ipc.invokeWithProjectSession`，断言 arc 键出现在返回值里），或明说此接线只由评审判。**这也解释了为什么 admin 三选一的①不成立**：换掉接线不会红。

**6.2 键不含章号 ⇒ 一次豁免全书生效。** `arc:cover:<code>:<id>` 与 `roster:`／`named:` 同口径；对「同一格反复报」是优点，但作者若只在一个章上误判为可接受，会把这个 ID 全书的同类问题一起消掉。判词记录，不要求改。

**6.3 两级「卷／单元」结构恒 fail-open。** 用例 `#6` 锁住了这条边界（输出合同禁止两级结构写 `覆盖：`，`parseChapterArcCovers` 恒空）⇒ 该规则在两级项目上永不触发。这是**显式缺口**，须写进 S4 收口件，禁止对外表述为「弧层引用完整性已达成」。

**6.4 M1／M2／M-f 三处守卫与上游重复。** 三处删掉行为不变（§3），属防御性重复而非漏断言；按 admin 裁定记「等价」，不记「漏断言」。若后续 `arc-node.ts` 的上游守卫被删，这三处会重新变成唯一屏障——不建议现在清理。

**6.5 分支谱系。** `card/arch-ac3-s3` 起点 `57d05871` **含 AC1 合并 `2e43a912`**、**不含 AC2 代码 `5e99d2ad`**（`git merge-base --is-ancestor` 实测 `AC2_CODE_IN=no`／`AC1_CODE_IN=yes`）。合并顺序：先并 AC2（或在本次合并时把两次 `db:character-roster-read` 并成一次读、两处用），否则 `consistency-preflight.ts` 在本分支上是「AC1 读一份、无 AC2 读」，AC2 合并时要解一次冲突。

**6.6 回执与交付面。** 回执 `C:\tmp\ac3-s3\workbuddy\receipt-to-owner.md` 120 行／7,787B／`bf056545…`，四行头齐 `:1-4`，模式行为「工作模式｜DeepSeek-V4.1-Flash（会话自身标识，自报）」；`会话标识：2026-11-24 00:53…宿主侧会话 id 在进程内不可读` 属自报字段，不能当外部可核事实，但不影响判据。实质交付面是主身补完的提交 `b5a14f1c`（WorkBuddy 未 commit），按纪律不计入 PASS 的交付链。

## 7. 未判边界

1. 未判 `arc-node.ts` 内部解析/折算正确性（本期零改，判据在 `arc-node.test.ts` 与 P12 设计稿）。
2. 未判真实项目上的端到端表现（无 [live] 判据；本卡判据全部落在函数层与静态面）。
3. 未判 `INV-2-DUPLICATE`／`INV-3-UNCOVERED`（跨章台账，不属 `validateArcCovers` 射程，见 `arc-node.ts:238` 注释）。
4. 未判 UI 呈现（本卡不写 `sourceLayer`，面板二元硬编码问题归既有 D 系卡）。
