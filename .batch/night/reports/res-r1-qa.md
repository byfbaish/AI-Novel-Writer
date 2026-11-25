# CARD-1125-R1 · QA 首验判词（Q1 取证与盲评闸口）

- 判定对象：`.batch/night/reports/res-q1-evidence-1125.md`｜137 行／15,377 B／sha256 `6884401e608965c36c6b5aa56febac981f5870f96f781b41c5530e8f88bb9dde`
- 提交链：`bd3cac46` → `041b323d` → `7bf974cc`
- 卡面：`.batch/night/cards/CARD-1125-R1-q1-evidence-blind-eval-gate.md`（判据 7 可归属式表在 `:33-40`）
- A 件判定版：`.batch/night/reports/planui-design-assessment.md`｜200 行／22,509 B／`4b2ff09b62f67f9e4fc44fb8bba80d36425cb6a8dbef88462e30d062b77bfbc7`（`7866fc61`）
- 判定面 HEAD：`1ea450e1`；`git status --porcelain -uall` 1 行（`?? .batch/night/reports/res-r2-identifier-map.md`，归 R2）
- 自跑闸门：`node scripts/check-fast.mjs` → `[check:fast] 全部通过。`／`0 项不合规`／`CF_EXIT=0`

## 判定：打回（2 项必改）

J2–J6 PASS；J1 的判断 1／判断 3 依据成立、判断 2 依据不成立；J7 实质成立但陈述有错句。

| # | 判据 | 结果 |
|---|---|---|
| 1 | 三行判断各有 `文件:行`／URL 依据，无依据不进结论 | **打回**（判断 2，见 F2） |
| 2 | `A:160` Novelcrafter 明确二选一，`grep` 一致 | PASS |
| 3 | 准入三格无空值 | PASS |
| 4 | 每篇判定时长上限有数字 | PASS |
| 5 | 最迟决策日或「需主人定」 | PASS |
| 6 | `git diff --name-only` 只含三目录 | 条件 PASS（记 F3） |
| 7 | `check-fast` EXIT=0 ＋ porcelain 有归属 ＋ 三件脚本对基线 | **打回**（陈述错句，见 F1） |

## 逐条证据

**J1 · 判断 1 PASS**：四条依据我逐行打开成立——
`src/shared/plot-outline-contract.ts:149` 的 `const { from, unitIndex, maxChapters, volumeRemaining } = unit` 确实无 `to`；
`src/services/workflows/architecture-workflow.ts:129-131` 单元模式 `synopsisRange = … : null`，`assertPlanningActionRange` 在 `:131` 仅对非 null 生效；
`src/shared/generation-owner-contract.ts:63`／`:71`；
`src/shared/arc-position.ts:19-20`。

**J1 · 判断 3 PASS**：`src/shared/character-proposal.ts:89-91` 写「重建名单」语义；`src/shared/plot-outline-contract.ts:9` `PLANNING_ACTION_CHAPTER_LIMIT = 10`、`:20-23` 超限抛 `GENERATION_PLANNING_RANGE_INVALID`。成立。

**J1 · 判断 2 打回（F2）**：交付件 `:68` 把 `src/components/editor/NarrativeThreadEditor.tsx:1153` 标为「选章 `NativeSelect`」——`:1153` 实为 `eventDraftId`（事件定稿）选择器；选章在 `:1212`（`NativeSelect id="narrative-thread-ai-blueprint" value={aiRangeStart}`），数量在 `:1218`（`max={NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT}`）。
同时「现状是单章入口／档 1 待做」与盘面不符：`:722-733` `generatePlanCandidates` → `narrativeThreadPlanRange(aiRangeStart, aiRangeCount, totalChapters)` → `launchPlanRange`（`:639`），plan 模式**已按章区间生成**（P6 档 1 于 `cbbe82c3` 落地并已判 PASS）。
依据打开后与原句不符 ⇒ 该行判据不成立，不是措辞问题。

**J2 PASS**：A 件现 `:162` 有 Novelcrafter 链接、「给链接不删句」二选一明确，`grep -n Novelcrafter` 仅该行。交付件写 `A:160` 是 A 件改版前的位置，现为 `:162`（A 件行号整体 +2，见记账 R1）。

**J3 PASS**：三格无空值——①进 3 条＋排除 4 条；②每轮 1 篇／90 分钟／负责人发起；③「需主人定」写明缺语料授权与档期。

**J4 PASS**：90 分钟，有数字。

**J5 PASS**：写「需主人定」（卡面允许），未编日期；建议值 2026-11-28 明确标注「只作建议不作格值」。

**J6 条件 PASS（F3）**：`git diff --name-only 435fa002..HEAD` 三处，其中 `.batch/night/cards/CARD-1125-R1-q1-evidence-blind-eval-gate.md` 由负责人 `f3dca555`／`40532cb9` 两笔卡面改动带入，按可归属口径**不判漂移**；但卡面三目录的字面永远过不了这一条，建议补一句「卡面自身改动除外」。

**J7 打回（F1）**：交付件 `:131` 写「三件脚本 sha 与 §0 基线逐个相等（`b241fcd5`／`2fefdb64`／`2a61487e`）」。现盘 attach 为 `2c4b472e…`，`2a61487e…` 是开工值，§0.0 自己已记「变更归主身、有报备」。同一份件里两处互相矛盾，须改。

## 必改

**F1**：`:131` 改成——「另两件与基线逐个相等（`b241fcd5`／`2fefdb64`）；attach 由 `2a61487e…` 变为 `2c4b472e…`（归主身、有报备），按可归属口径不计漂移」。

**F2**：判断 2 的三处要一起改——
①`:1153` 删除或改述为「事件定稿选择器」，不再称选章；
②依据改指 `:1212`（选章下拉）＋`:1218`（章数上限）＋`:722-733`（`generatePlanCandidates` 按区间调用）；
③「现状是单章入口／档 1 待做」改为「区间控件已随 P6 档 1 落地（`cbbe82c3`），剩余问题是 X」——X 只写盘面能证的内容，证不出就不写。
A 件 `:92` 同一句也要同步改。

## 记账（不阻断）

R1 A 件已由 `7866fc61` 就地改版（`:160`→`:162`、`:163`→`:165`、`:90`→`:92`、`:197`→`:199`），交付件里所有 A 行号整体 +2，复判按新版。
R2 判据 7 的 porcelain 面已变化：现 1 行 `?? .batch/night/reports/res-r2-identifier-map.md`（归 R2）。
R3 三件脚本本次已由主身随 `1ea450e1` 入库，attach 的变更记录与 `§0.0` 一致。
R4 `.batch/night/tmp-r1*.py` 临时脚本已清，不挡提交。
R5 我在 21:0x 已把 F1／F2／F3 要点贴群，负责人裁「等她改完再出终判」；本判词按现盘出，改完只需复核 F1／F2 两处原文。

## 复判最小口径

1. `sed -n '131p'` 无「逐个相等」与 `2a61487e`；
2. 判断 2 依据指向 `:1212`／`:1218`／`:722-733`，且不再有「单章入口／档 1 待做」原句（`grep -c` 命中 0）；
3. A 件 `:92` 同步；
4. `check-fast` `CF_EXIT=0`、porcelain 每行可归属、交付件新 sha 贴出。

---

## 复判（2026-11-25 21:18）：PASS

判定对象更新为：交付件 138 行／17,599 B／`2d14c92522e81674d007c940703a8e211b4f3ffb114c57df1c4e456714a50770`（提交 `0b405bdd`）；A 件 200 行／23,441 B／`5ef35c5cc26eace129060bc7260486ff864bffc93028e020cccd9f308bb1da3d`。

**F1 已消**（交付件 `:131`）：改成「按件说明」——`doubao.mjs`（`b241fcd5…`）与 `model-policy.mjs`（`2fefdb64…`）逐个相等；`workbuddy-attach.mjs` 由 `2a61487e…` 变 `2c4b472e…`、归主身有报备；并补记三件已随 `1ab5fb59`／`1ea450e1` 入库。与 `§0.0` 自述一致，不再自相矛盾。

**F2 已消**（交付件 `:68`）：判断 2 依据整段换成 `:1212`（起点章 `NativeSelect`，绑 `aiRangeStart`）／`:1218`（章数 `max={NARRATIVE_THREAD_PLAN_CHAPTER_LIMIT}`）／`:722-733`（`narrativeThreadPlanRange` 区间闸），写明「档 1 已由 `cbbe82c3` 落地」，缺的是档 1 之外两件（按单元分批、候选分组折叠 UI）。「单章入口／档 1 待做」在判断与结论正文清零。
A 件同步到同一套（`:92` 现状句、`:199` 附录、`:5` 件头修订注写明 `:1153` 是 `eventDraftId`）。

**F3 已消（卡面侧）**：`8947b31d` 在卡面 `:72` 与派验单 `:16` 各补两项例外。

**J6（新口径）PASS**：`git diff --name-only 435fa002..HEAD` 10 个文件逐个可归属——卡面＋派验单＝例外①；`planui-design-assessment.md`／`res-q1-evidence-1125.md`＝R1；`res-r2-identifier-map.md`／`docs/research/2026-11-26-c1-2-field-diff-spec.md`＝R2；`scripts/` 三件＝例外②（`doubao.mjs` ← `1ab5fb59`，另两件 ← `1ea450e1`）。无列不出归属的行。

**J7 PASS**：`node scripts/check-fast.mjs` → `全部通过`／`0 项不合规`／`CF_EXIT=0`；收工 `porcelain -uall` 1 行（`?? .batch/night/reports/res-r1-qa.md`，本判词，归 QA）。

**J1／J2／J3／J4／J5** 维持 PASS（见上）。

### 记账（不阻断，不影响 PASS）

R6 交付件 `:94`（§1.4）与 `:114`（A-1 行）仍以「A 件原引 `:226`／`:1050`／`:1081`、仍是单章下拉」叙述——那是改版前的快照，A 件现盘 `:199` 已写 `:1212`／`:1218`／`:722-733`。作为勘误沿革可留；若 A 件再改一次，这两行须同步，否则会变成新的过期叙述。
R7 交付件 `:138`（§4 待裁第 2 条「是否同笔对齐 `:226`／`:1050`／`:1081`」）已无对象——A 件已对齐，建议删或标「已消」。
R8 A 件 `:163`「没有一家做逐字 diff」的收窄由负责人定稿（`§4` 待裁第 1 条），不属本卡判据。
