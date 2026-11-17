# CARD-1117-E 合并进 card/git-track-ops-1117 —— 取证记录

执行方：大肥鱼（群 admin · AI writer项目组）
model=未取 | 倍率=未取 | provider=未取（本件为本地合并与取证，未派外部执行方）
时间：2026-11-17 17:11–17:17（Asia/Shanghai）
工作目录：C:\develop\workspace\AI-writer\develop（checkout 于 card/git-track-ops-1117）

## 一、合并前状态

- 分支头：`7182062d` docs(backlog): 碎片文件与分支清理 backlog，记 A/D 合并后两处集成红
- A 卡 `7de913f6`、D 卡 `c25fb57b` 均已在分支内（`git merge-base --is-ancestor` 为真）
- 合并历史手法：`0609a4a8` merge(card/1117-A)、`4a530d73` merge(card/1117-D)，均为 `--no-ff`
- E 卡 `9575abaa` 未在分支内
- 已跟踪改动：无（`git status --porcelain | grep -v '^??'` 为空）

## 二、合并

命令：

    git merge --no-ff card/1117-E-hygiene-scope -m "merge(card/1117-E-hygiene-scope): 机检生效面改为已跟踪路径，历史件走 baseline 冻结（验收通过）"

结果：`Merge made by the 'ort' strategy.`，无冲突。

- 合并提交：`72989e16c683781eaf9dc1f9827ec9af23cc468c`
- 父提交：`7182062d45019ac7a3ebd9b70254037e061267e1` + `9575abaa4e78fadb5f6a7fde50018af83c6ac3b8`
- 变更：4 files changed, 655 insertions(+), 18 deletions(-)
  - `scripts/ops/__tests__/check-batch-hygiene.test.mjs` | 204 +
  - `scripts/ops/__tests__/ops-scripts.test.mjs` | 24 +-
  - `scripts/ops/check-batch-hygiene.mjs` | 247 +
  - `scripts/ops/hygiene-baseline.txt` | 198 +（create mode 100644）

未 push、未打 tag、未合并到主线。

## 三、合并后复跑（HEAD=`72989e16`）

### 1) check:fast（`node scripts/check-fast.mjs`，即 package.json:20 `check:fast`）

    [check:fast] typecheck ✓ 18.4s
    doc links: checked 1468, broken 0
    [check:fast] doc-links ✓ 0.1s
    doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
    [check:fast] doc-placement ✓ 0.1s
    0 项不合规
    （baseline 冻结清单豁免 1 项：清单内且本次未改动）
    [check:fast] batch-hygiene ✓ 0.1s
    [check:fast] 全部通过。

    EXIT=0

### 2) 两处集成红逐条反证

- 红 1（检查器生效面）：`--all` 在 develop 树 **EXIT=0**、「0 项不合规」；`--disk` 仍 **EXIT=1**、「236 项不合规」且首行为「磁盘模式：含未跟踪历史件，仅作统计，不作门禁」。即门禁面绿、统计面仍红，历史件未被掩盖。
- 红 2（`wc -l` 命中）：`scripts/ops/__tests__/ops-scripts.test.mjs:75` 的 `wc -l` 是守卫的**惯用式清单**（`idioms` 数组），非违规用法；守卫遍历面已按 16:14 裁定收窄到 A 卡五件产出脚本。

### 3) ops 测试（`node scripts/run-tests-electron.mjs scripts/ops/__tests__`）

    Test Files  2 passed (2)
         Tests  38 passed (38)
    TESTS_EXIT=0

### 4) baseline 现状

- 路径：`scripts/ops/hygiene-baseline.txt`｜198 行
- 头三行：`# 条目数：195` / `# 生成 SHA：7182062d` / `# 生成命令：node scripts/ops/check-batch-hygiene.mjs --disk --write-baseline`
- 本次合并未改动该文件（沿 E 卡提交原字节）

## 四、结论

E 卡合入后，`card/git-track-ops-1117` @ `72989e16` 上 `check:fast` 绿（EXIT=0），A/D/E 三卡所致两处集成红均已解除；分支停在本地，等主人对「落主线」的口径。

<!-- DONE -->
