状态：放行
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-19 11:33（项目总负责人 · AI writer项目组）
卡号：CARD-1119-A
依据件：`cards/CARD-1119-A-pii-line-landing.md`

# CARD-1119-A 派验单 · 12 件协作件落到脱敏线

执行方：developer · AI writer项目组｜受验：`work/pii-1119` 上那一条提交
派单：项目总负责人 · AI writer项目组｜2026-11-19 11:33

## 一、为什么有这张卡

脱敏重写已完成：本地 `refs/heads/relive-src/exp/resource-ledger` 头 `beeedc26`（1810 提交，真名 0，我 11:26 实测）。旧线 `work/reboot-1118`（头 `2923090a`）含由旧历史继承的 93 件真名文件，**永不推送**。C 卡验收过的 12 件必须搬到脱敏线上，否则等于白做。

## 二、判据（命令 + 输出 + exit）

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 起点 | `git log --format=%h -2` | 第二行＝`beeedc26` |
| 2 | 一条提交 | `git rev-list --count beeedc26..HEAD` | `1` |
| 3 | 12 件齐 | `git show --name-only --pretty=format: HEAD \| sort` | 与 `2923090a` 清单逐行相同 |
| 4 | 字节等同 | `git diff 2923090a HEAD -- $(git show --name-only --pretty=format: 2923090a) \| wc -l` | `0` |
| 5 | 树面 PII | `git grep -l -F "C:\\Users\\$USERNAME" HEAD -- . \| wc -l` | `0` |
| 6 | 新增行 PII | `git show HEAD --unified=0 \| grep '^+' \| grep -cF "C:\\Users\\$USERNAME"` | `0` |
| 7 | 未 push | `git status -sb \| head -1`；`git branch -vv \| grep pii-1119` | 无 `[behind]`、无上游 |
| 8 | 机检 | `node scripts/ops/check-batch-hygiene.mjs --all`；`pnpm check:fast` | 各 exit 0 |
| 9 | 报告 | `.batch/night/reports/CARD-1119-A-report.md` | 三处格式齐、含 cherry-pick 退出码与 pii-scan 原始输出 |

> 11:40 勘误：判据 2 的起点 id 由 `bee2dc26` 更正为 `beeedc26`（前者不存在，`git cat-file -t` fatal；错源为转达笔误，非出卡侧）。引用脱敏线一律写 ref 全名。

## 三、红线

1. push／`--force`／`rebase`／`merge`／checkout origin。
2. 改 `refs/heads/relive-src/*`、`work/reboot-1118`、`archive/local-rebuilt-1118`。
3. `git add -A`／`git add .`／`-f`。
4. 冲突不报自改。
5. 报告写真实用户名。

## 四、审的重点

- 判据 4 是核心：搬过去的内容必须与 C 卡验收过的逐字节相同；任何「顺手改一行」都算改交付面，打回。
- 判据 5 必须为 0，因为目标线本身 0：若变正数，说明搬过去的东西带来了真名，直接不通过。
- 其余判据按 v2/v3 C 卡的教训：只认命令输出与 exit，不认「我核过了」。
## 五、判后记录（12:04）

- QA 首验 PASS，判词 `reports/CARD-1119-A-qa-firstcheck.md`（7,775B / `59f54028…` / 132 行）。
- 我终审通过，受验 `f8728c8d`；blob OID 逐件比对 0 处不同。
