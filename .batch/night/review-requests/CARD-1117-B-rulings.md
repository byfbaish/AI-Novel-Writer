From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: QA · AI writer项目组 · 群分身

# CARD-1117-B 评审追加段（终裁／退回／修订／终审）

本文是 `CARD-1117-B-baseline-intake.md`（3,540B 交付版，内容不动）的追加记录。按流转件版本纪律，派验单原文件保留为当时交付物，评审过程中追加的裁定段单独成文，不原地覆盖。

## 五、18:2x 终裁（交件 `c70aabb8` 后，四条，QA 按此判）

**裁定 1（判据 8 改判据文字，不返工）**：判据 8 原写「`--disk` 报 `0 项不合规`」，实际不可能——`archive/` 内 42 件历史件尾行缺换行，修它即改历史件字节，与「原样留档、事后哈希对账」冲突。改读作：
- `--all` `exit 0` 且 `0 项不合规`（门禁面）；
- `--disk` 在**六类收编目录**（cards/org/reports/review-requests/roster/staging）范围内 `0 项不合规`；
- `archive/` 内尾行项单列计数、不作为不通过理由。
QA 须给出这三项各自的实际数字，不要只写「成立」。

**裁定 2（尾行规范化扩到 31 件：允许，但须逐件证明只差末尾换行）**：卡面 §2.6 只点名 1 件，developer 扩到 31 件，理由是为满足判据 8 的 `--disk` 0。目的正当，但红线 4 是「不许改协作件内容」，扩范围必须有证据：
- QA 逐件跑 `git diff 72989e16..c70aabb8 -- <path>`，每件只允许出现「末尾换行」类差异（`\ No newline at end of file` 消失／新增一空行），出现任何字词改动即不通过并指名路径；
- 31 件清单与报告 §2.4 逐行对得上；
- 报告须写明「只改末尾换行、正文零字改动」并给出取证命令。

**裁定 3（判据 2／6 的两张清单：允许拆成表 A、表 B）**：表 A＝搬入 `archive/` 193 件，表 B＝首次入库 613 件。判据 2 对表 A、判据 6 对表 B，各自行数自洽即可；判据 6 的「≥230」下限不变（613 远超，须解释为何是 613 而不是 234——即入库范围不只 staging，QA 要核这 613 里有没有不该入库的路径）。

**裁定 4（判据 4 取值范围）**：`git log --diff-filter=D --name-only 72989e16..c70aabb8` 为准，不加范围的写法作废。

**archive 尾行豁免另开卡：暂不**。本卡不动 `archive/`；「检查器对 archive 目录尾行规则做豁免」记入 `org/BACKLOG.md` 待办，B 卡合并后再议，不在本卡顺手改检查器。

## 六、18:4x 首验退回裁定（QA 判词 `reports/CARD-1117-B-qa-firstcheck.md`）

QA 判不通过，两处缺陷同在一张提交面上，我认判。裁定如下，developer 照此闭合：

**① 一卡一提交 ⇒ 用 `amend`，不开补丁提交。** 分支未 push、无他人依赖，`git commit --amend` 不会改写已发布历史；「一卡一提交」是裁定件 §二 的口径，补丁提交会让本卡变两提交。amend 后分支头变化，QA 重验按新 sha，不按 `c70aabb8`。

**② baseline 必须进提交面。** 判据 8 读的是提交内容，不是工作区：`git show HEAD:scripts/ops/hygiene-baseline.txt | grep -vc '^#'` 须为 **194**，并贴 `git status` 无该文件的 ` M` 行。这正是本卡唯一要改的工具数据，漏了它本卡等于没改。

**③ 记账件名：改判据文字，不返工改名**（此条 18:5x 修订，见 §七）。判据点名 `org/ledger-append-hy4flash-auth.md`，实际入库 `org/ledger-append-1117-hy4flash-auth.md`；`-1117-` 是日期段不是 `vN`，去版本号本意已达成，且该名被 22 处既有件引用（staging 两脚本、`reboot-hy4flash-sync*` 系列、`cards/reboot-hy4flash-sync.v1/.v2`），改名即为断链或改历史件字节，与本卡「原样留档」原则冲突。故判据 5 第三条改读作：`git ls-files .batch/night/org | grep -E 'ledger-append-.*\.md$'` 恰一条且不含 `.v[0-9]`。QA 判词该条按成立记。

**④ QA 的三处口径我全部采纳，不再返工**：
- 30 件首次入库件用末字节 `0a` 核验（首次入库 diff 是整文件新增，「只差末尾换行」不可判）——31/31 通过，成立；
- 613 里 46 条可清理类（staging 下 13 个 `.mjs` 副本、`tmp-*.jsonl`、`.bak`、png）**记 `org/BACKLOG.md`，本卡不清理**；
- 红线 3 无需 `-f`（`.gitignore` 第 92-100 行 `!` 反向包含）成立，不构成违规。

**⑤ 重交只补四条取证**：`--all` 输出、`head -3 scripts/ops/hygiene-baseline.txt`、`git ls-files` 记账件那条、`git status` 干净；已在判词里成立的九条不重跑。

## 七、18:5x 修订（§六 ③ 作废重裁）

我起初按「判据逐字点名」要求改名，查过引用面后改判：**不改名，改判据文字**。

依据：该名为 `ledger-append-1117-hy4flash-auth.md`，22 处既有件引用它（`staging/fix-ledger-v7.mjs`、`staging/make-ledger-v7.mjs`、`staging/reboot-hy4flash-sync-report.md`、`reports/reboot-hy4flash-sync-qa-firstcheck.md`、`cards/reboot-hy4flash-sync.v1.md`、`.v2.md` 等）。改名要么让这 22 处断链，要么逼着去改历史件字节——两者都违反本卡「原样留档、事后哈希对账」与红线 4。`-1117-` 是日期段，不属 `vN`，去版本号的目的已经达到。

故：**本卡只有一处必修 —— baseline 进提交面**（§六 ①② 不变，amend 闭合）。§六 ③ 作废。

## 八、18:5x 终审（通过）

**结论：通过，放行合并。受验提交 `59420a57`（amend 后新头，单亲 `72989e16`，`git rev-list --count 72989e16..59420a57` ＝ 1）。**

我的独立抽查（只查 QA 未覆盖项，不重复其取证）：
- `git rev-parse 59420a57^` ＝ `72989e16`，单亲成立；`count` ＝ 1，amend 未留双提交。
- `git show 59420a57:scripts/ops/hygiene-baseline.txt | grep -vc '^#'` ＝ **194**；头三行 `# 条目数：194` / `# 生成 SHA：7182062d` / `# 生成命令：…--disk --write-baseline` 齐全，未降级。
- `git show --name-status 59420a57` 分布＝607 `A` + 2 `M`，无 `D`／`R`；`M` 两件为 `scripts/ops/hygiene-baseline.txt` 与提交面内被补尾行的件，与 §五 裁定 2 一致。

QA 判词 `reports/CARD-1117-B-qa-firstcheck.md`（不通过）→ 修 → `reports/CARD-1117-B-qa-recheck.md`（PASS），两轮判词都在，链路完整。缺陷 ① 的成因（工作区改了没 `git add`，`--all` 与 `check:fast` 双绿抓不到）记为本卡教训：**判据写「提交面」时，取证命令必须从 `git show <sha>:<path>` 读，不许读工作区**。

**遗留三条，均不在本卡返工：**
1. **baseline 清零**：E 卡 §八 收缩判据写明「收编完成或条目清零必须删除」。收编已完成、`--all` 已不再打印「豁免 N 项」（194 条零命中），故 baseline 已无存在理由。另开 F 卡：删 `scripts/ops/hygiene-baseline.txt` + 检查器去掉豁免分支，与「archive 尾行豁免」一并议。
2. `archive/` 内 42 件尾行项、613 里 46 条可清理类（staging 下 13 个 `.mjs` 副本、`tmp-*.jsonl`、`.bak`、png）——记 `org/BACKLOG.md`。
3. 合并动作由 owner 侧执行，我不 push、不打 tag、不合并；落点待「落主线」裁定（to-owner 已投 17:20 件，HEAD 引用更新为 `59420a57`）。
