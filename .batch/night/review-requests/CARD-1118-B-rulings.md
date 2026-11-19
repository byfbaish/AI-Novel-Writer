状态：收口
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-18 11:22（项目总负责人 · AI writer项目组）
卡号：CARD-1118-B
依据件：`review-requests/CARD-1118-B-fork-close.v4.md`

# CARD-1118-B 终审（项目总负责人）

## 一、结论：通过

受验：分支 `work/reboot-1118` 拓扑＋索引＋报告 `.batch/night/reports/CARD-1118-B-report.md`（24,866B / `b7554a48253d43fe204a613b8d5ea9f6` / 307 行 / 末行 `<!-- DONE -->`）。
QA 首验判词 `.batch/night/reports/CARD-1118-B-qa-firstcheck.md`（12,528B / `5d455561c481956dec9cc1f411414f3b` / 234 行），结论 PASS、九条判据全成立、六红线零触发。

我独立抽验（11:20，不采信自报）：

- `git rev-list --count origin/exp/resource-ledger..HEAD` → 0
- `git diff --quiet HEAD origin/exp/resource-ledger` → exit 0
- `git rev-parse --abbrev-ref HEAD` → `work/reboot-1118`；`git branch -vv` 无 `[origin/…]` 上游
- `git status --porcelain`：`??` 90 ＋ `A ` 12
- `.batch/night/archive/org/ledger-append-1117-hy4flash-auth.v7.md` md5 `91bdbf8e…` ＝ 主件 md5（字节未变、只换了位置）
- `.batch/night/archive/README.md` 六段齐全（谁建/何时/用途/保留期/过期归属）

## 二、QA 五项勘误的处置

**不另存勘误件，勘误以 QA 判词 §四 为准。**

理由：报告已交件并以其 md5 与我核对记录绑定，另存勘误件会造出第二份「同内容不同字节」的流转件，正是 `batch-hygiene` 版本件规则的起因；而 QA 判词是独立冻结件，本就由收编卡引用。收编卡（下一张）开工时把判词 §四 五项抄进卡面 §二，即成闭环。

逐条处置：

1. ①②③（92＋12≠103、47/36→45/34、标题件数与清单条数不符）→ 记入收编卡，不改报告、不重做。
2. ④（移入 `.batch/night/archive/` 的件不再出现在 `??`/`A `）→ 采纳，收编卡口径补一句「`archive/` 内的件**视同在盘**，盘点时按目录计，不按 porcelain 计」。
3. ⑤（`scripts/workbuddy/space-readonly-check.mjs`）→ 本卡维持留盘待认领（BACKLOG B-8 已在案）；收编卡按 B-1e 补保留期与过期归属后入库，补不出则继续留盘，不许删。
4. developer 报告 §4.1(2) 两处把 `.batch/night/archive/` 写作 `archive/` → 如上，不另存勘误件；收编卡引用时写全路径。

## 三、遗留（交收编卡，不在本卡）

- 45 件真历史版本件、34 件无主件版本件：留盘原地、不入库、不改名、不删，按 B-10／B-11／B-12 逐件处置。
- db／wal／shm 5 件＋`staging/voided/` 1 件：维持留盘不入库。
- 81（QA 实测 83 个 `.vN` 文件，含 `archive/` 内 2 件）与 porcelain 计数的差值原因已固定为口径，不再讨论。
