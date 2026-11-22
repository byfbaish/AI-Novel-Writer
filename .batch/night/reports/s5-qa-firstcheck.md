# S5 首验判词（D5／D15／D18）—— **进行中，未出总判**

> 本件按 Goal S5「QA 一次复判三卡、判词一份」建立。当前只写入已在盘上可判的部分：D5 两条 `[static]`、D18 判据 1 `[static]`；D15 两条 `[static]` 等 patch 落盘，三卡的四条 `[live]` 等那一趟单实例实机。**四个 `[live]` 项未到齐前不出总判、不写 PASS。**

## 0 分母与判定面

| 件 | 行／字节／sha256 |
|---|---|
| 阶段卡 `.batch/night/staging/s5-stage-card.md` | 51 行 / 5,618B / `57da845ff2c9fd2aa9e39e8da0db4794b573e9fde32ff915cc40ce893346a5b1` |
| 缺陷稿 `docs/design/product/live-pipeline-acceptance-defects-assessment.md` | 1,241 行 / 158,795B / `d41fe137ec096151765b9abd2282c95f9b5e078b56d37722a626eb81ab0c2816` |
| D15 apply 派件（重发版、待用备份、未投） | `.batch/night/staging/s5-d15-apply-outbound.md` 68 行 / 5,204B / `bb71ca5f4a1ceff5f90ce6fb0611f2da2423a4b8192714d85a9260392613dad5` |
| 外派标准头 | `.batch/night/staging/ext-dispatch-header.md` 31 行 / 1,939B / `e3f19e7d0a6e958e…` |

判定面（代码面）＝主线头 `17794aa9`（`exp/mainline-1119` ＝ `ls-remote origin refs/heads/exp/resource-ledger`，20:54 与 21:01 两次核同值）。D18 卡分支 `7b48f074`（父 `17794aa9`，未 push、未 merge），其改动面 `git diff --numstat 17794aa9..7b48f074` ＝ `19/0 src/shared/__tests__/hook-payoff-report.test.ts`、`9/6 src/shared/hook-payoff-report.ts`，两文件、无新增。

判据字面一律回阶段卡 `:10–:20` 读，不采信派件／交件的转述。

## 1 D5 判据 1 `[static]` —— **PASS**

判据字面（阶段卡）：尖括号占位机检对样例命中、对合法尖括号不误报（纯函数单测原文）。

- 实现 `src/shared/arc-placeholder-guard.ts:32` `export function findAngleBracketPlaceholders(text: string): PlaceholderHit[]`；判据写在同一文件 `:6–:11`（半角 `<`／`>` 成对、内部 trim 非空、内部不是纯 HTML 标签名；`EXEMPT_TAGS` 在 `:20–:24`）。
- 单测两个方向都在：命中向 `src/shared/__tests__/arc-placeholder-guard.test.ts:53`（HTML 与占位符混排只命中 `<钩子>`）、`:60`（跨行累计 index）；不误报向 `:41–:48` 的 `it.each` 六例（大写标签、`h1–h6`、`<br/>`、空内部 `<>`、纯空白 `< >`）。
- 我复跑（判定面 `17794aa9`）：`node scripts/run-tests-electron.mjs src/shared/__tests__/arc-placeholder-guard.test.ts` → `Test Files 1 passed (1)`／`Tests 22 passed (22)`／`EXIT=0`。

## 2 D5 判据 2 `[static]` —— **PASS**

判据字面：落库前守卫仍接在写库路径上（grep 调用点原文，非只存在导出）。

- 调用点 `src/services/workflows/commands/architecture.command.ts:3228` `const placeholderHits = findAngleBracketPlaceholders(content)`，位置在 `this.assertNotCancelled(context)` 与 `await writeArchToDb('plotStructurePlan', content, …)`（同文件 `:3238`）之前；`import` 在 `:2`，非只导出。
- 全仓非测试命中 1 处（`grep -rn "arc-placeholder-guard\|findAngleBracketPlaceholders" --include=*.ts src electron | grep -v __tests__` → 只 `:2` 与 `:3228`）。

## 3 D18 判据 1 `[static]`（三子断言）—— **PASS 3/3**

判据字面（阶段卡）：三条子断言各一侧——事件型收尾行允许写未决后果；B 函数级 `drifted`／`[]` 且生产未接线（裁定 ⑩）；第 6 章两向（真落地章带 `[hook-unplanted]` 恰 1 次／无 `hookInput` 章不带前缀）——5／7 章本卡不判、只记账。

**(a) 事件型收尾行允许写未决后果 —— 成立。** 合同 `src/shared/blueprint-semantic-contract.ts:59`（zh）原句「事情已经发生、结果还没发生，正文停在写到的那一帧；不写成问话」；en 同句 `:47`「it has already happened, its result has not」。反向锁 `src/shared/__tests__/blueprint-semantic-contract.test.ts:211` 起 it 名 `states the hook as an occurred event with an open result, never as a non-event`，断言含上述两句且 `not.toContain('它不是事件')`／`not.toContain('suspenseHook is not an event')`。我复跑该文件 → `Tests 26 passed (26)`／`EXIT=0`。

**(b) B 函数级 `drifted`／`[]` 且生产未接线（裁定 ⑩）—— 成立。** `alignSuspenseHook` 定义在 `src/shared/suspense-hook-alignment.ts:58`，全仓 9 处命中＝该定义 ＋ 自身单测 8 行，`src`／`electron`／`scripts` 非测试代码零调用，即「在仓、未被生产接线」，与裁定 ⑩ 一致。

**(c) 第 6 章两向 —— 成立。** `src/shared/hook-payoff-report.ts` 先拆 `unplanted`／`graze`，`const marker = unplanted.length > 0 ? '[hook-unplanted] ' : ''` 只拼句首（先拆后拼，蹭线提示不会带该前缀）；两向单测同在 `hook-payoff-report.test.ts`（`:54` `grazeFindings()` 一组、`:82` 混排一组）。我复跑：在临时树 `wt-qa-d18`（detached `7b48f074`、`node_modules` 走 junction）`node scripts/run-tests-electron.mjs src/shared/__tests__/hook-payoff-report.test.ts` → `Test Files 1 passed (1)`／`Tests 8 passed (8)`／`TEST_EXIT=0`；跑完已 `git worktree remove --force`，主区未受影响（主区同文件在 `17794aa9` 上是 6 条，属未含本卡，不可当反例）。

## 4 D15 两条 `[static]` —— **待判**

patch 未落盘，无判定面可判（`wt-d15` 当前 `17794aa9`、porcelain 0 行；`C:\tmp\s5-outbound\D15-apply\` 下无 `d15.patch` 可见）。落盘后按阶段卡 `:18`／`:19` 两行逐条判：①单测原文里相接 `7-9`／`10-10` 不误报、全等只计一次且汇总行 `Tests 32 passed (32)`＋末行 `EXIT=`；②`summarizeVolumeWarnings` 成句、不重复计数。

## 5 四条 `[live]` —— **待那一趟实机**

D5 判据 3（真实生成一次、产物占位符 0）／D18 判据 2（定稿后标记在真实链路出现一次）在同一实例内取证；D15 本卡无 `[live]`。三项实例读数 `instancesThisRun=1`／`exitCode=0`／`leftoverElectronProcesses=0` 与 `tasklist | grep -c electron` 原文须进 evidence。缺任一项，对应判据记「不可判」，不默认通过。

## 6 记录项（不构成 FAIL）

1. **D5 判据字面的保守面**：`arc-placeholder-guard.ts:14–:17` 明写「`<span class="x">`、`<br />`（内部为 `br /`）不豁免，按判据字面仍属命中」，单测 `:69` 把这条钉死。若作者正文出现合法带属性 HTML 标签，会产生误报面；判据已声明、按字面判，故不判 FAIL，但实机取证的「占位符命中数」须能区分「真占位符」与「合法带属性标签」，证据里要贴命中原文。
2. **D5 判据 2 是「接上」不是「拦住」**：命中后只 `callbacks.log`（`architecture.command.ts:3233–:3236`），日志原句「将继续写入数据库」，随后照常 `writeArchToDb`。阶段卡只要求「守卫仍接在写库路径上」，故 PASS；若作者意图是阻断落库，需另裁，不在本卡判据内。
3. **D18 模板与合同字面不一致**：`src/services/builtin-prompt-templates.ts:1094`／`:1176` 仍无条件写「它不是本章要完成的事件」，而合同 `blueprint-semantic-contract.ts:59` 已改为「事情已经发生、结果还没发生」。语义层判据成立，模板字面未条件化，按 A 不动、只记录。
4. **判据名非仓内字符串**：阶段卡的「事件型收尾行允许写未决后果」是转述，`grep -rn "未决后果" src electron` → 0 命中属正常；取证按合同 `:59` ＋单测 `:211` 两层，不按字面字符串 grep。
5. **5／7 章零样本**：`fixtures/c5-ch6-hook-planting.fixture.ts:29-35` 只有第 6 章夹具，本卡判据 3 只判第 6 章两向；缺陷稿与收口件须原句写「第 5／7 章未验，待作者库导出真实文本后补验」，不得写「5／7 章不误标已验」。
