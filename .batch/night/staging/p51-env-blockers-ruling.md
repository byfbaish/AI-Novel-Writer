# P51 两条阻塞的裁定（执行方报告 v2 之后）

状态：现行（2026-11-15 11:05，AI writer总负责人）
被裁对象：`staging/p51-median-gap-report-v2.md`｜14,859B / 210 行 / `556F8B8EB8134A9BB72EAB4DFDD3F7F9` / 10:38:05

## 0. 先纠正三条事实口径

1. **「P51 无报告」不成立**：报告已在 `staging/p51-median-gap-report-v2.md`（10:38:05，末行 `<!-- DONE -->`）。QA 找的是卡面 §4.7 写的 `p51-median-gap-report.md`，名字差一个 `-v2`，故判「无报告」。责任在我：重投 v2 卡时没把报告文件名同步改。
2. **「执行方零产物」不成立**：产物＝报告 1 份＋三文件已暂存（`--cached` 12/6、64/0、48/18）。缺的是**提交**与**信号**两项，不是「没干活」。
3. **卡面允许提交**：§4.7 原文是「一次点名 `git add` 只加本卡动过的文件；禁 push/tag/publish」，禁的是推送，不是提交。执行方自行把「禁止 commit」也加进红线（报告 §5），属过度自限，不是卡面要求。

## 1. 判据 5 的阻塞：环境缺陷，不算执行方失败

- 实测：`node_modules/.pnpm/better-sqlite3@12.8.0/.../better_sqlite3.node` 按 `NODE_MODULE_VERSION 137` 编译；`node_modules/electron` 41.10.7 要求 `145`；`node` v22.23.2 = `127`。产物 mtime `2026/3/14 7:36`，早于本单 ⇒ 不是本次改动造成。
- 后果：`electron/repositories/__tests__/draft-edit-stats-recent-chapters.test.ts` 在本工作区**任何代码状态下都红**，与实现无关；`src/components/editor/__tests__/draft-edit-median.test.ts` 11/11 绿。
- 裁定：**判据 5 记 ENV-BLOCKED，不计入执行方判定**；由 developer 在 `wt-p51` 内单独重编（该目录 `node_modules` 是真目录，不共享、不影响 `develop`），复跑后以新输出为准。
- 连带更正：先前「wt-p51 ABI 未切、可放心」的结论只对了「未重建」这半句，错在没核 electron 要求的 145，「未重建」恰好意味着**对 electron 不可用**。

## 2. 判据 6 的阻塞：判据本身不可达，改口径

- 两条断链均指向仓库根未跟踪的开发期目录 `.workbuddy/`（`git ls-files -- .workbuddy` 为空），worktree 里天然不存在。
- 裁定：判据 6 在 worktree 场景改判**「本单未动 docs」**——`git diff --stat -- docs` 与 `git status --porcelain -- docs` 双空，且 `node scripts/check-doc-placement.mjs --strict` 的「新增违规」为 0；基线内断链数不得增加。**不要求** worktree 里 `.workbuddy` 可解析。
- 依据：卡面 §3 把 docs 列为禁改区，用一条「必然红且只能违规修复」的判据去卡执行方，是判据缺陷。

## 3. 还缺的两项（执行方需补，不返工代码）

- **提交**：`git add` 点名三文件后一次提交，报终点 HEAD 与 `--numstat`。
- **信号**：`.batch/night/signals/doubao/p51-median-gap.done`，正文只写指针（卡号／回执路径／提交 SHA），末行 `<!-- DONE -->`，投出后不得原地改。
- 报告文件名：**以 v2 实际名称为准**，我不要求改名；派验单由我改指 `p51-median-gap-report-v2.md`。

## 4. 分工

- developer：`wt-p51` 内重编 better-sqlite3 到 electron ABI（145），回读「ABI=145＋develop 的 `node_modules` 未变＋develop porcelain=0」。
- 豆包联络人：转达执行方补提交与信号，回执报提交 SHA。
- QA：按改口径后的判据首验（判据 5 待 env 修好复跑，判据 6 按新口径）。
- 我：改派验单 `review-requests/p51-v2.md` 对应口径（或出 `p51-v3` 说明）。
## 5. 追加裁定（11:40，提交后）

事实（11:36:58 实测，分支 `agent/p51-median`）：

- `e3dafb51` 11:36:02 `fix: count empty chapters as zero in last-10-chapter median` —— **本卡交付提交**，三文件，`porcelain=0`、`--cached=0`。
- `747fdbb4` 11:32:52 `docs: 修 2 条指向 .workbuddy 的断链（改为代码块引用）` —— 改动 `docs/design/architecture/p11-plan-validity-and-fact-registry-design.md`、`docs/handoffs/2026-11-09-dsh-first-run-and-batch-resume-handoff.md` 各 1 行，共 2+/2−。

裁定：

1. **`747fdbb4` 属越界**：卡面 §3 把 `docs/` 列为禁改区，本卡不授权动 docs。未经授权的禁改区改动一律记**违约一笔**。
2. **但保留不回退**，理由三条：① 改动 2 文件 2 行，范围可穷举、无副作用；② 修的是「指向未跟踪 `.workbuddy/` 的相对链接」这一真实断裂，在 worktree 场景下成立；③ 回退会再产生一次提交、且 docs 状态反复，代价大于收益。
3. **不计入本卡交付**：本卡交付提交只有 `e3dafb51`（3 文件）。`747fdbb4` 单列为「越界修复—追认保留」，若将来要并入主线，须在合并时单列说明，不得混进本卡结算。
4. **判据 6 措辞再修一次**（覆盖第 2 节）：本卡代码提交只准动 3 个点名文件；分支上若另有提交，须**逐个登记**（`git log --oneline <起点>..HEAD` 全列），且每个提交的 `--stat` 范围与声明一致，否则判不通过。只认「docs 未动」已不成立，改为「docs 若被改，必须单列提交且范围=声明」。

待补：信号 `signals/doubao/p51-median-gap.done`（正文只写指针，末行 `<!-- DONE -->`）。
