# `.batch/` 提交闸门：放行范围一页方案

> 状态：待裁定（2026-11-25）· 产品经理出稿 · 受 admin 11-25 04:2x 指派
> 只出方案，不动钩子代码。定完由 developer 改 `scripts/install-git-hooks.mjs`（钩子是它生成的）。

## 1. 现状（事实）

| 事实 | 出处 |
|---|---|
| 钩子不是手写的，由脚本生成 | `scripts/install-git-hooks.mjs:1-116`，产物 `.git/hooks/pre-commit:2` `generated-by: scripts/install-git-hooks.mjs` |
| 判定只看两件事：**分支名**是否 `exp/mainline-1119`、暂存区是否含 `.batch/` | `.git/hooks/pre-commit:15-26`（同源 `install-git-hooks.mjs:41-51`） |
| 唯一例外是 `--no-verify`，且钩子自己写着「确属例外请用 --no-verify，并在提交信息里写明理由」 | `.git/hooks/pre-commit:23` |
| 闸门事实上没守住：**非主线 ref 上已有 35 笔**碰过 `.batch/` 的提交（主线 153 笔） | `git log --all --oneline --not exp/mainline-1119 -- .batch` → `35`；`git log exp/mainline-1119 --oneline -- .batch` → `153` |
| 规则起因是一笔 docs 提交落到卡分支，代价是 cherry-pick 回主线 + `branch -f` 回退 | `.git/hooks/pre-commit:12-13`（案件 `4ef01457`） |

结论：现在不是「有没有例外」，而是「例外全靠人记 `--no-verify`」——35 笔里没有一笔留下可检索的放行理由。

## 2. 三个放行范围（三选一）

### A 卡分支白名单
分支名匹配 `exp/*`、`card/*` 即整条放行，其余照旧。
- 改动：`install-git-hooks.mjs:42` 一行（`!= exp/mainline-1119` → 不在白名单）。
- 好处：最省事，一笔改完，以后不再申请例外。
- 代价：`.batch/night/bridge/`（投递件）与 `.batch/night/staging/`（派单件、放行件）**也一起进卡分支**。放行件是「口径定义」，同一口径出现两个分支版本时，报告引哪个 sha 都说不清——本轮 283,000 → 265,000 的来回就是这么来的。

### B 目录白名单（仅卡分支放行 reports 与 cards）
分支不是主线时，只放行 `.batch/night/reports/`、`.batch/night/cards/`；`bridge/`、`staging/` 在卡分支**仍然必拦**，其余 `.batch/` 也照拦。
- 改动：`install-git-hooks.mjs:43` 的路径过滤加两条排除（`':!.batch/night/reports/' ':!.batch/night/cards/'`），并在后面补一条「`bridge/` 或 `staging/` 命中即 exit 1」的反向检查。
- 好处：挡住真正要挡的两类（投递件是「投完即消费」，本来就不该入库；派单/放行件是口径，必须单面），而报告与卡面**必须**引用本分支的 commit sha 与产物，卡分支才是它的家。
- 代价：钩子逻辑从「一个分支名判断」变成「分支名 + 两个目录」，脚本多约 10 行；判定表要写进仓库文档，否则下次改的人不知道这两个目录为什么豁免。

### C 文件级白名单（提交信息自证）
允许在提交信息里写 `Batch-Allow: <理由>`，钩子读到最后一条提交信息就放行。
- 改动：钩子多读 `git log -1 --pretty=%B`。
- 好处：放行理由**留在提交历史里**，可 `git log --grep=Batch-Allow` 检索——这是三选里唯一自带留痕的。
- 代价：本质是「自己给自己发许可」，与 `--no-verify` 同性质，只是把理由从口头挪进仓库；一旦有人随手写一句就过，闸门就变装饰。

## 3. 放行后谁还能拦（放行不等于没人管）

| 闸 | 拦什么 | 对放行件是否仍生效 |
|---|---|---|
| `pnpm check:fast`（钩子 `:28-32`） | typecheck + 文档索引/链接/放置 | 是（不限分支） |
| 协作介质卫生（钩子 `:36-41`，`scripts/ops/check-batch-hygiene.mjs`） | 尾行换行、禁版本号文件名（`archive/` 只豁免尾行、`staging/` 豁免版本号，见 `:38`/`:44`） | 是 |
| `pre-push` | 只做 git-lfs 检查，**不看内容** | 不拦——别指望它兜底 |
| 收口对账（负责人/QA 手工） | 合并前 `git diff --numstat`、`porcelain -uall`、HEAD 与远端比对 | 是，且是唯一能发现「同一文件两个版本」的一层 |

所以取 B 之后，`reports/` 只剩三层：check-fast、卫生检查、收口对账。**第三层必须每次写清比的是哪个 HEAD**（本轮已吃过教训：卡分支 HEAD 与主线 HEAD 是两面，不许写「相等」）。

## 4. 误放行的代价（按已发生案例量化）

1. **同一份文件出现两个 HEAD 版本，对账永远不相等**。本轮实例：报告正文在卡分支（301 行）、口径件在主线（77 行），`git rev-parse HEAD` 两边本来就不可能相等，只能分列记录。
2. **同一文件在两分支各改一次 ⇒ 合并必冲突，且没有权威面**。冲突解决时没人能说哪个是正本（口径件 283,000/265,000 两版就是预演）。
3. **卡分支被删或 rebase 掉 ⇒ 报告没有入库副本**。`.batch/` 若不进主线，等于只活在工作区 + 一个临时分支上。
4. **最小代价是可逆的**：`4ef01457` 那次靠 cherry-pick + `branch -f` 收回了——错落一笔的成本是「一次人工搬运 + 一次对账解释」，不是数据丢失。这也是当年选择用钩子而不是流程约定的原因。

## 5. 产品侧建议

**取 B**，并加一条便宜的留痕要求：卡分支提交 `.batch/night/reports/` 时，提交信息首行写 `卡分支协作介质: <卡号或批次号>`。理由：B 挡住两类真该挡的（投递件、口径件），同时把 C 唯一的优点（留痕）用一行提交信息补回来——收口时 `git log --grep='卡分支协作介质'` 一条命令就能列出全部放行件，不必再问任何人。

不建议：① 用环境变量开关放行（与 `--no-verify` 等价，且连理由都留不下）；② 现改钩子后不写判定表（下次改钩子的人只会看到两个豁免目录，不知道为什么）。

改动清单（若裁定 B）：`scripts/install-git-hooks.mjs` 一处 + `docs/agents/worktree-parallel.md` 或 `rule-registry.md` 加判定表一行 + 重新 `node scripts/install-git-hooks.mjs` 生成 `.git/hooks/pre-commit`。代价：约半小时，含一次钩子自测（卡分支放 report 通过、放 staging 被拦、主线照旧）。
