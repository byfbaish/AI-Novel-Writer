# S1 交件回执摘要（卡 `d2f24410`）

> 依据：豆包回执 `C:\tmp\s1\doubao\receipt-to-owner.md`（9,693 B，12:04）与 `receipt-fix01-to-owner.md`（10,671 B，12:15）。`C:\tmp` 会被清，四项摘录如下；同卡两轮，**以 12:15 补正回执为准**（12:16 那轮只核盘不重写）。落点 `C:\develop\workspace\AI-writer\wt-s1`，分支 `card/s1-syntax-check`，改动未提交留工作树。

## 一、起点 sha

`2692c90bd`（= 设计案＋判据修正件入库笔；`wt-s1` HEAD 我实测仍是它，改动全部未提交）

## 二、改动清单

```
M  package.json                                          （一行 script）
?? docs/research/2026-11-27-syntax-check-category-rules.md
?? scripts/__tests__/syntax-check.test.mjs                （287 行）
?? scripts/lib/syntax/corpus.mjs                          （160 行）
?? scripts/lib/syntax/gate.mjs                            （55 行）
?? scripts/lib/syntax/rules.mjs                           （334 行）
?? scripts/lib/syntax/phrases.skeleton.json               （"version": "v2", H: [], G: []）
?? scripts/syntax-check.mjs                               （324 行）
```

## 三、自跑读数（两组数都已贴，验收口径＝带词表）

```
node scripts/syntax-check.mjs .runtime/res-eval/blind-eval-v1.md --stats --phrases .runtime/res-eval/phrases.v1.json
  covered=30/49 (range=A/B/H/F)
  verdict_covered=20/49
  denominator: T=49 (51 quoted fragments - 2 summary-only, non-countable)

node scripts/syntax-check.mjs .runtime/res-eval/blind-eval-v1.md --stats
  covered=15/49 (range=A/B/H/F)
  verdict_covered=3/49
  H: disabled (no phrase table)        ← 判定集收缩，不是回归
```

确定性：两次 `--json --phrases …` 输出同 sha256 `8a230a9a7b5302ef80432702efa6792153de166288e65f7e119fcc7ce4b92e05`。
误报闸门：A 0.59/3.09、B 1.76/9.27、F 0/1.4、G 0/1.4、H 0/4.78 过线；C 7.05/6.74、D 0.59/0.56 不过线→自动降 `report` 并打 WARN（成对出现）。
用例：`scripts/__tests__/syntax-check.test.mjs` 24/24；`node scripts/check-fast.mjs` 全过（typecheck ✓／doc-links 1487 0 broken／doc-placement 448 份 0 违规／batch-hygiene ✓）。

## 四、词条 grep 0 命中（语料零外流）

```
docs/research/2026-11-27-syntax-check-category-rules.md : 0
scripts/syntax-check.mjs                                 : 0
scripts/lib/syntax/corpus.mjs / gate.mjs / rules.mjs      : 0
```

词表正文只在 `.runtime/res-eval/phrases.v1.json`（`version: v2`，H 12 条分 3 组、G 4 条），仓内只有零命中骨架。仓里 `docs/handoffs/archive/2026-10-29-four-layers-unattended-plan.md:89`、`scripts/experiments/card-materials.md` 等旧件出现「指节发白」，属 11-27 前既有内容，按「往前修不追改历史」不属本卡范围。
