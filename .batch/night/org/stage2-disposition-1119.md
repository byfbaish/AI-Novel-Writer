状态：生效
持有者：项目总负责人 · AI writer项目组
可写：只读（执行方按此清单动作，改动须回报）
最后变更：2026-11-19 23:50
卡号：CARD-1119-G
依据件：`org/board-roadmap.md`、Goal stage 2 acceptance、`.batch/night/archive/README.md`

# stage 2 口径：README 五字段来源 ＋ 69 件未跟踪件归属

## 一、README 五字段的取数依据（按序取，取不到才写 `待补`）

| 字段 | 第一依据 | 第二依据 | 取不到时 |
|---|---|---|---|
| 谁建 | 该件的卡面 `执行方：` 行（`.batch/night/cards/<卡号>-*.md`） | 台账 `.batch/night/reports/task-ledger.md` 对应条目 | `待补`＋进 §四 待补清单 |
| 何时 | 文件名里的日期段（`1119`／`20261119`）＋该件 `mtime`（`stat`） | 台账条目日期 | `待补` |
| 用途 | 文件名语义＋原目录（`roster/`=身份名册历史版、`cards/`=卡面历史版、`reports/`=报告历史版、`review-requests/`=派验单历史版、`staging/`=待决件） | 卡面 §一 目的段 | `待补` |
| 保留期限 | 统一写「长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e」 | — | 不许留空 |
| 是否清洗版 | 97 件全部来自 `78d56ea0` 清洗入库，统一「是（与 `MANIFEST.sha256` 一致）」 | — | 不许留空 |

**硬规矩**：禁写「未知」；禁把 5 字段合并成一句；`待补` 必须同时进 §四 清单（谁、缺哪字段、下一张卡怎么补）。README 里**不写文件名以外的推断性描述**（如「应该是某次实验」），推断一律不进 README。

## 二、README 结构与计数口径

- 一行一件，路径与 `git ls-tree -r --name-only HEAD -- .batch/night/archive` 完全对应；含 `README.md` 自身一条，**不含** `MANIFEST.sha256`。
- 合计 97 条（97 = 96 件归档物 ＋ README 自身）。
- 97 件目录分布（`ls-tree` 实测 23:52，供核对）：`staging/` 22、`roster/` 22、`1107/` 15、`review-requests/` 13、`org/` 8、`resume-1114/` 6、`cards/` 6、根级 3、`pre-restart-1113/` 1、`p9-prefix-restart-1113/` 1，合计 97（含 `README.md`，不含 `MANIFEST.sha256`）。

## 三、69 件未跟踪件的归属（本阶段一次清完，禁 `git clean`／`git stash`）

清场后 `git status --porcelain -uall | grep -c '^??'` 须为 `0`。

### G1 · 入库（25 件）

本阶段 `git add` 点名入库，属协作介质（卡面／派验单／裁定／报告／规范件）。

- `.batch/night/cards/CARD-1118-C-placeholder-close.md`
- `.batch/night/cards/CARD-1118-D-version-files.md`
- `.batch/night/cards/CARD-1119-A-pii-line-landing.md`
- `.batch/night/org/ruling-dispatch-v4-1119.md`
- `.batch/night/org/version-files-inventory-1119.md`
- `.batch/night/reports/CARD-1118-B-qa-firstcheck.md`
- `.batch/night/reports/CARD-1118-B-report.md`
- `.batch/night/reports/CARD-1118-C-qa-firstcheck.md`
- `.batch/night/reports/CARD-1118-C-report.md`
- `.batch/night/reports/CARD-1118-D-qa-firstcheck.md`
- `.batch/night/reports/CARD-1118-D-report.md`
- `.batch/night/reports/CARD-1119-A-qa-firstcheck.md`
- `.batch/night/reports/CARD-1119-A-report.md`
- `.batch/night/reports/CARD-1119-E-qa-firstcheck.md`
- `.batch/night/reports/CARD-1119-E-report.md`
- `.batch/night/reports/GOAL1-archive-first-merge-qa-firstcheck.md`
- `.batch/night/reports/GOAL1-archive-first-merge-report.md`
- `.batch/night/review-requests/CARD-1118-B-rulings.md`
- `.batch/night/review-requests/CARD-1118-C-placeholder-close.md`
- `.batch/night/review-requests/CARD-1118-C-rulings.md`
- `.batch/night/review-requests/CARD-1119-A-pii-line-landing.md`
- `.batch/night/staging/CARD-1118-D-ruling-request-1119.md`
- `.batch/night/staging/doubao-cli-investigation-20261119.md`
- `.batch/night/staging/v4-signing-receipt-20261119.md`
- `.batch/night/staging/voided/owner-config-fix-1116-correction-1128.md`

### G2 · 移入 `.batch/night/staging/vn-history-1119/` 后入库（37 件）

这些是**无主件的历史 `.vN` 件**：`staging/` 对 `versioned-filename` 规则豁免，故移入该目录再入库既不破 97、也不再报不合规。移动用 `git mv` 前先 `mkdir -p`，逐件点名，禁整目录 `git add`。

- `.batch/night/cards/d1-delivered-path.v1.md`
- `.batch/night/cards/d1-delivered-path.v2.md`
- `.batch/night/cards/d1-delivered-path.v3.md`
- `.batch/night/cards/d1-delivered-path.v4.md`
- `.batch/night/cards/d1-delivered-path.v5.md`
- `.batch/night/cards/p55-pinned-cwd-allowlist.v1.md`
- `.batch/night/cards/p55-pinned-cwd-allowlist.v2.md`
- `.batch/night/cards/p56-fix-report-header.v1.md`
- `.batch/night/cards/p56-wb-docs-stale.v1.md`
- `.batch/night/cards/p56-wb-docs-stale.v2.md`
- `.batch/night/cards/p56-wb-docs-stale.v3.md`
- `.batch/night/cards/p56-wb-docs-stale.v4.md`
- `.batch/night/cards/p56-wb-docs-stale.v5.md`
- `.batch/night/cards/reboot-hy4flash-sync.v1.md`
- `.batch/night/cards/reboot-hy4flash-sync.v2.md`
- `.batch/night/cards/wb-rules-example.v1.md`
- `.batch/night/org/process-efficiency-assign-1116.v1.md`
- `.batch/night/org/process-efficiency-draft-v1.md`
- `.batch/night/review-requests/merge-p55-into-develop.v1.md`
- `.batch/night/review-requests/p31-v2.md`
- `.batch/night/review-requests/p51-v2.md`
- `.batch/night/staging/dispatch-schedule-endorse-doubao.v1.md`
- `.batch/night/staging/dispatch-schedule-endorse-doubao.v2.md`
- `.batch/night/staging/dispatch-schedule-endorse-doubao.v3.md`
- `.batch/night/staging/dispatch-schedule-endorse-doubao.v4.md`
- `.batch/night/staging/dispatch-schedule.v1.md`
- `.batch/night/staging/dispatch-schedule.v2.md`
- `.batch/night/staging/dispatch-schedule.v3.md`
- `.batch/night/staging/identity-copies/bot-session-identity.v2.md`
- `.batch/night/staging/identity-copies/bot-session-identity.v3.md`
- `.batch/night/staging/identity-copies/bot-session-identity.v4.md`
- `.batch/night/staging/message-admission.v1.md`
- `.batch/night/staging/pointer-plan.v1.md`
- `.batch/night/staging/pointer-plan.v2.md`
- `.batch/night/staging/pointer-plan.v3.md`
- `.batch/night/staging/pointer-plan.v4.md`
- `.batch/night/staging/wb-quota-schedule-1117.v1.md`

### G3 · 移出工作区到 `C:/tmp/pmo-stage2-quarantine/`（5 件，运行数据，不入库）

SQLite 运行态文件（`-shm`／`-wal`）与样例库，属本机运行数据，不入 git。移动后在该目录写 `README.md`（谁建／何时／用途／保留期／过期给谁，按 B-1e）。

- `.batch/night/staging/project.db-shm`
- `.batch/night/staging/project.db-wal`
- `.batch/night/staging/samples-02/.ai-novel/project.db`
- `.batch/night/staging/samples-02/.ai-novel/project.db-shm`
- `.batch/night/staging/samples-02/.ai-novel/project.db-wal`

### G4 · 移出工作区到 quarantine（1 件，relay 投递留痕）

通道落盘件，留本机留痕、不入库。

- `delivered/62e69db07b3/2026-11-18-2000-report.md`

### G5 · 移出工作区到 quarantine，待认领（1 件）

BACKLOG B-8 的未跟踪件，来源未确证；按 B-1e 移入 quarantine 并登记，认领后决定入库或删。

- `scripts/workbuddy/space-readonly-check.mjs`

## 四、`待补` 清单（§一 产生，本阶段内不追平不算不通过，但必须列全）

（developer 在 README 落盘后追加；每条＝路径 ＋ 缺哪字段 ＋ 建议补法。）

## 五、QA 判词落点

- 首验判词：`.batch/night/reports/GOAL2-archive-readme-qa-firstcheck.md`（本阶段入库面，G1 一并 add）。
- 现有 `reports/GOAL1-archive-first-merge-qa-firstcheck.md`（6,804B／`b21c0671…`／98 行）属 G1，随本阶段入库，**不改字节**。
