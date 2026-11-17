From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: developer · AI writer项目组 · 群分身

# CARD-1117-A：产出脚本去三元组、机检去行数

状态：**可投**（前置＝无；与 C、D 可并行，与 B 不并行——B 会搬 staging，先等本卡合并）
估时：改码 60 分钟 + 首验 25 分钟
执行方：developer；首验方：QA
类型：**A 类**（产生仓库提交，须配派验单 `review-requests/CARD-1117-A-de-triplet.md`）

依据：`.batch/night/org/ruling-git-workflow-1117.md` §二·3、§二·4、§三·A（提交 `1224ee2b`）。

改订：2026-11-17 14:1x，项目总负责人改「`git mv` 迁移」为「新增件入库」——原卡误设七件已入库，实为未跟踪件（`git ls-files .batch/night/staging` 为空），无历史可迁；判据 4/5 相应改为「提交不含 `.batch/` 路径」与「报告写明无历史」，staging 原件改由 B 卡统一搬。developer 14:0x 提出，我复核后采纳。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\wt-1117a`（执行方自建：`git worktree add C:\develop\workspace\AI-writer\wt-1117a -b card/1117-A 1224ee2b`），分支 `card/1117-A`，起点 HEAD `1224ee2b`。
- 禁在 `C:\develop\workspace\AI-writer\develop` 里改码或提交。
- 开工第一动作逐条核，任一不符即停手回执，不自行换目录：
  1. `git rev-parse --show-toplevel` 规范化后 ＝ `C:/develop/workspace/AI-writer/wt-1117a`。
  2. `git branch --show-current` ＝ `card/1117-A`。
  3. `git rev-parse --short HEAD` ＝ `1224ee2b`。
  4. `git diff --numstat HEAD` 与 `git diff --ignore-cr-at-eol --stat HEAD` 双空，且 `git diff --cached --numstat` 空。
  5. `git -c core.quotepath=false status --porcelain=v1` 首列无 `M/A/D/R/U`；`??` 白名单为空。
  6. 目标目录不存在（本卡新建）：`ls scripts/ops` 报 No such file or directory；素材源只读存在：`test -f C:/develop/workspace/AI-writer/develop/.batch/night/staging/make-ledger-v7.mjs` 为真（七件是 develop 的未跟踪件，不在本工作树内，只读取内容、不搬不删）。
- 禁 `pnpm install`／`rebuild`／`pnpm dev`（切 ABI 会打断其他槽位）。

## 1. 起因与背景

三元组（字节／md5／行数）被写进文件正文，而产物由整份重写脚本产出 ⇒ 换一版全链路作废，人人重报重算（11:00–12:50 的 63 条消息里 51% 在复述三元组）。同时机检把「行数」当判据，而末行无换行使 `wc -l` 与 `awk NR` 恒差 1，指标本身不确定。裁定 §二·3/4 要求三元组退出正文、汇报只报 commit sha；§三·A 指派本卡。

## 2. 要改成什么（唯一口径）

1. **产出类脚本不再往正文写三元组**：生成的文件里不得出现 `字节`／`md5`／`MD5`／`sha256`／`行数` 这类自报字段（引用他人数据、历史记述不算）。
2. **机检不再以行数相等为通过判据**：凡「行数／`wc -l`／`awk NR` 相等」作为 pass 条件的分支，改判内容判据（关键行存在／正则可匹配／哈希由 `git show` 当场算）。
3. **脚本以新增件形式入库 `scripts/ops/`**：七件从未被 git 跟踪（`git ls-files .batch/night/staging` 在 `1224ee2b` 上为空），无历史可迁，故不用 `git mv`；内容自 develop 工作区的 staging 副本只读取出，去掉三元组与行数判据后写成新文件，`git add` 点名入库。**本卡不动 `.batch/night/staging` 一个字节**——原件搬 `.batch/night/archive/staging/` 归 B 卡。

迁移清单（本卡范围，不多不少）：`make-ledger-v7.mjs`、`fix-ledger-v7.mjs`、`patch-reboot.mjs`、`pointer-metrics.mjs`、`no-at-count.mjs`、`no-at-count.v2.mjs`、`no-at-count.v3.mjs`。
`no-at-count` 三版合并为一支 `scripts/ops/no-at-count.mjs`（口径取 v3 的 B 口径＋`who` 排除）；staging 下的 v2/v3 原件不动，随其余废版一并由 B 卡搬进 `.batch/night/archive/staging/`。

## 3. 落点与禁改区【硬】

- 新增：`scripts/ops/*.mjs`（七件，`no-at-count` 只留一支）
- **不动**：`.batch/night/staging/`（含 README 与全部原件，整目录归 B 卡）
- 补：`scripts/ops/__tests__/`（至少覆盖「生成件正文无三元组字段」与「机检不再比对行数」两条）
- **禁改**：`scripts/workbuddy/model-policy.mjs` 与其测试；`.batch/night/org/*`、`.batch/night/reports/*`、`.batch/night/roster/*`（B 卡范围）；`.gitignore`；`docs/` 禁动区（`docs/plans/novel-quality-*`、`docs/research/novel-quality-modernization/`、`docs/adr/` 既有条目）。

## 4. 验收判据【硬】

每条须能指认（文件:行 或 命令输出），缺一条即不通过：

1. `git ls-files 'scripts/ops/*'` 非空且含上表七个脚本名（`no-at-count` 只留一支）。
2. `grep -rn "md5\|MD5\|sha256\|行数" scripts/ops/*.mjs` 结果逐条解释：引用/注释放行，写入产物正文的一律不许。
3. `grep -rn "wc -l\|awk NR\|split('\\\\n').length" scripts/ops/*.mjs` 不得出现在 pass 判定分支（附行号说明）。
4. 本次提交不含任何 `.batch/` 路径：`git show --name-only --pretty=format: <sha> | grep -c '^\.batch/'` ＝ `0`。
5. 报告须写清「七件原为未跟踪件、无迁移历史」，并附当场 `git ls-files .batch/night/staging` 为空的输出；不要求 `git log --follow`。
6. 新增测试 `pnpm test scripts/ops/__tests__` 全绿，附 exit code。
7. `pnpm check:fast` 全绿，附 exit code。
8. 提交信息含卡号 `CARD-1117-A`；不 push、不打 tag、不合并。

## 5. 交付物

- 提交（一卡一提交即可；`git add` 点名具体路径，禁 `-A`）
- 报告：`.batch/night/reports/CARD-1117-A-report.md`（首行 `执行方：developer`，第二行 `model= | 倍率= | provider=`，末行 `<!-- DONE -->`）
- 不写三元组：不要报字节／md5／行数，只报关键命令输出摘要。
