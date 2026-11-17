From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: 产品经理 · AI writer项目组 · 群分身

# CARD-1117-C：协作规则并版（判定现行唯一文本）

状态：**可投**（前置＝无；与 A、D 可并行。不依赖 B，但文件落点必须与 B 的归档方向一致：文件名不带版本号）
估时：改文 45 分钟 + 首验 20 分钟
执行方：产品经理；首验方：QA
类型：**A 类**（产生仓库提交，须配派验单 `review-requests/CARD-1117-C-collab-rules.md`）

依据：`.batch/night/org/ruling-git-workflow-1117.md` §二 全八条、§三·C（提交 `1224ee2b`）。

改订：2026-11-17 14:1x，项目总负责人采纳产品经理 A 案——`reports/task-ledger.md` 是未跟踪件、新工作树里不存在，故本卡不改台账、只交指针行原文，判据 5 同步换写；台账收编与指针写入随 B 卡。另两处按盘上实情修正：`org/` 无 `collab-rules*` 旧件，「并入既有 v1」改为按卡面五条落 §六。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\wt-1117c`（`git worktree add C:\develop\workspace\AI-writer\wt-1117c -b card/1117-C 1224ee2b`），分支 `card/1117-C`，起点 HEAD `1224ee2b`。
- 禁在 `develop` 里改文或提交。
- 开工前三项校验同 A 卡 §0 第 1–3 条（路径 `wt-1117c`、分支 `card/1117-C`）；另核 `git ls-files '.batch/night/org/ruling-git-workflow-1117.md'` 非空。
- 禁 `pnpm install`／`rebuild`／`pnpm dev`。

## 1. 起因与背景

协作规则此前散在群 notice、台账 §2、若干方案件里，同一事实多份副本，改一处别处不动（今天的「谁有唯一写入权」「投递 From/To 形态」都因此反复对账）。裁定 §三·C 要求把 §二 八条并入协作规则，形成单一现行文本；本卡同时要求**文件名不带版本号**，否则并版第一天就违反新规则。

## 2. 要改成什么（唯一口径）

1. **新建唯一现行件** `.batch/night/org/collab-rules.md`：
   - 首行 `状态：现行`，第 2–3 行 `From:`／`To:`（按群 notice 的机检形态，半角冒号＋一个空格）。
   - 正文按主题分段，把**裁定 §二 八条**逐条落成祈使句，并写明「违反时的机检或人工拦点」；八条缺一条即不通过。
   - 并入既有 `v1` 里仍然有效的条款（台账唯一写手、@ 路由、版本纪律、对外写动作需先领、From/To 硬规则），与裁定冲突处**以裁定为准**并在该句后加 `（2026-11-17 裁定 1224ee2b 取代原规定）`。
2. **不保留旧副本**：`org/` 下此前若有 `collab-rules*` 旧件（含 `.vN`），`git mv` 进 `.batch/night/archive/org/`；若确实不存在旧件，报告里写明「不存在，故无搬迁」，不许编造路径。
3. **指针一处（本卡只交原文，不动台账）**：`reports/task-ledger.md` 目前是未跟踪件（`1224ee2b` 上 `git ls-files` 无此件，新工作树里不存在），本卡不碰它；指针行原文逐字写进报告，随 B 卡台账首次入库时一并写入。
4. **与 notice 的关系**写进文件：notice 装每轮必守的硬约束（≤2000 字符），`collab-rules.md` 装全量；发现两者冲突，以「notice 更严者优先」，并上报群 admin。

## 3. 落点与禁改区【硬】

- 新建：`.batch/night/org/collab-rules.md`
- **不动**：`.batch/night/reports/task-ledger.md`（未跟踪件，随 B 卡首次入库；本卡只交指针行原文）
- **禁改**：群 notice 本身（群分身不得改 notice，只上报）；`.batch/night/org/ruling-git-workflow-1117.md`（裁定原件，字节不动）；`scripts/`（A/D 卡范围）；`src/`；`docs/` 禁动区
- **禁**：新建任何带 `.vN` 或数字编号的文件名；`git add -A`

## 4. 验收判据【硬】

1. `git ls-files '.batch/night/org/collab-rules.md'` 非空；文件名无 `.v`／无数字编号。
2. 八条逐条可指认：报告里给「裁定 §二 第 N 条 → collab-rules.md 第 M 段」对照表，八行齐全。
3. 冲突条款均有取代标注：`grep -n "1224ee2b 取代" .batch/night/org/collab-rules.md` 至少命中一处（台账唯一写手或 @ 路由二者之一若有冲突）。
4. 首行 `状态：现行`、第 2–3 行机检通过：`/^(?:From|To): .+$/` 逐行匹配到 `sed -n '2p;3p'`。
5. 本卡提交不含 `reports/task-ledger.md`（`git show --name-only --pretty=format: <sha> | grep -c 'task-ledger'` ＝ `0`）；报告里给出指针行逐字原文，一行，格式「协作规则现行文本：`.batch/night/org/collab-rules.md`」。
6. 若搬迁旧件：`git status --porcelain` 中该件为 `R`，不是 `D`；无旧件则报告写明「不存在」。
7. 提交信息含卡号 `CARD-1117-C`；不 push、不打 tag、不合并。

## 5. 交付物

- 提交（一卡一提交）
- 报告：`.batch/night/reports/CARD-1117-C-report.md`（首行 `执行方：产品经理`，第二行 `model= | 倍率= | provider=`，末行 `<!-- DONE -->`）
- 报告只报 sha 前 8 位＋一句结论＋对照表，不写字节／md5／行数。
