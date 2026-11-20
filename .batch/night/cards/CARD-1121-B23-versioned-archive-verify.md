# CARD-1121-B23 · `archive/` 的 `versioned-filename` 豁免核查（结论：B-23 不成立）

- 状态：已交（验证记录卡，非改码卡）
- 来源：BACKLOG **B-23**（2026-11-20 05:45 记）；Goal「AI writer 收尾清零」stage 2，2026-11-21 00:30 裁为「B-23 走 C：不成立结案」
- 执行方：developer · AI writer项目组（群分身）
- From：developer · AI writer项目组（群分身）｜To：项目总负责人 · AI writer项目组（群分身）
- **本卡不改码，故无分支、无单测。**

## 0. 工作区前置【硬】
- 工作目录：`C:/develop/workspace/AI-writer/develop`
- 分支：`exp/mainline-1119`｜起点 SHA：`0d2671db`（含 `376ce148`）
- 开工前三项校验：HEAD=`0d2671db`、`scripts/ops/check-batch-hygiene.mjs` 存在、`git diff --numstat HEAD` 为空（本卡未动码）
- 归档冻结：`git diff --name-only 376ce148 HEAD -- .batch/night/archive` 为空；`MANIFEST.sha256`＝`ab1119a28ff94b38825da188feb228eea456a151efdd134fa5567f51d98426b0`

## 1. 起因
BACKLOG B-23 记「`--disk` 对 `archive/` 内 `.vN` 仍按『同目录须有主件』报错，须改码」。核查结论与记录相反。

## 2. 结论（一行）
**不成立：`archive/` 自 `d1a6e75c`（11-17）起已豁免 `versioned-filename`，代码中无「同目录须有主件」规则，`--disk` 对 archive 命中 0 行——不是本 Goal 修好的，是从未缺过。**

## 3. 三条证据（判据来源行号）
1. `scripts/ops/check-batch-hygiene.mjs:38` `EXEMPT_VERSIONED_DIRS` 含 `` `${WATCH_ROOT}/archive/` ``；该常量与规则同提交 `d1a6e75c` 落地（`git log -S` 实证）
2. `scripts/ops/check-batch-hygiene.mjs:85` 命中豁免目录直接 `return null`；`grep -rn "主件" scripts/` → exit 1（0 命中）
3. 实测 archive 内 `.vN` **71 件**（69 md＋2 mjs），`--disk | grep -E '^\.batch/night/archive/' | wc -l` → **0**；14 项全在 `signals/lead` 4、`tmp/` 7、`tools/` 5

## 4. 证据文件
`.batch/night/reports/s2-b23-versioned-archive-not-a-defect.md`

## 5. 禁改区（本卡遵守）
`archive/` 内任何件字节、`MANIFEST.sha256`、`archive/README.md`；`EXEMPT_VERSIONED_DIRS` 与 `--disk` 行为本卡均未动。

## 6. 判据与状态
- BACKLOG 有结案行且写「不成立」＋三条证据：见同批 `BACKLOG.md` B-23 结案段
- 归档件字节零改动、`MANIFEST` 97 条复核一致：实测通过
- QA 独立复核：待判

<!-- DONE -->
