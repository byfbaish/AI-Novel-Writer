From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: developer · AI writer项目组 · 群分身

# CARD-1117-D：机检与 pre-commit（尾行换行、禁 vN 文件名、缺 sha 提醒）

状态：**可投**（前置＝无；与 A、C 可并行；本卡改 `scripts/install-git-hooks.mjs` 与 `check:fast` 接线，若 A 同时改 `scripts/ops/` 各自文件不重叠，可并行）
估时：改码 70 分钟 + 首验 25 分钟
执行方：developer；首验方：QA
类型：**A 类**（产生仓库提交，须配派验单 `review-requests/CARD-1117-D-hooks.md`）

依据：`.batch/night/org/ruling-git-workflow-1117.md` §二·1/4/8、§三·D（提交 `1224ee2b`）。

## 0. 工作区前置【硬】

- 工作目录：`C:\develop\workspace\AI-writer\wt-1117d`（`git worktree add C:\develop\workspace\AI-writer\wt-1117d -b card/1117-D 1224ee2b`），分支 `card/1117-D`，起点 HEAD `1224ee2b`。
- 禁在 `develop` 里改码或提交。
- 开工前三项校验同 A 卡 §0 第 1–3 条（路径 `wt-1117d`、分支 `card/1117-D`）；另核 `git ls-files 'scripts/install-git-hooks.mjs' 'scripts/check-fast.mjs'` 两条非空。
- 禁 `pnpm install`／`rebuild`／`pnpm dev`；**禁跑 `pnpm hooks:install` 去改全局/共享 hook**（会在 `develop` 的 `.git` 里生效，影响他人）——本卡只在工作树内造测试夹具验证逻辑。

## 1. 起因与背景

末行无换行使 `wc -l` 与 `awk NR` 恒差 1（`build-v68.py` 明写 `no trailing newline kept`），指标本身不确定；同时文件名带 `.vN` 让「哪份是现行」靠人脑判断，出现过 `fix-ledger-v7.mjs` 为躲机检改写措辞这类副作用。裁定 §二·1/4/8 要求尾行换行由 pre-commit 统一、文件名禁版本号、汇报必须带 commit sha；§三·D 指派本卡。

## 2. 要改成什么（唯一口径）

1. **新机检脚本** `scripts/ops/check-batch-hygiene.mjs`（纯只读、`exit 0/1`、`--staged` 与 `--all` 两种模式）：
   - **尾行换行**：`.batch/night/**/*.md` 暂存内容末字节必须为 `\n` 且不得连续多空行结尾（`\n\n` 结尾判不合规）；`--all` 模式扫工作树同规则。
   - **禁版本号文件名**：暂存路径中命中 `\.v[0-9]+\.`（如 `x.v3.md`）或 `-v[0-9]+$` 判不合规；`.batch/night/archive/` 与 `.batch/night/staging/` 下**豁免**（历史件与中间稿允许）。
   - 输出格式：每个不合规项一行 `路径 · 规则名 · 判据`，末尾一行汇总 `N 项不合规`；`exit 1`。三元组不进输出（不报行数）。
2. **接进 pre-commit**：`scripts/install-git-hooks.mjs` 生成的 hook 在 `check:fast` 之后追加一步 `node scripts/ops/check-batch-hygiene.mjs --staged`，失败即 exit 1 并打印修法（`printf '\n' >> <path>` 或 `git mv` 改名）。hook 内容改动须同步更新脚本内注释与 README 说明（如有）。
3. **接进 `check:fast`**：`scripts/check-fast.mjs` 增加一步调用 `check-batch-hygiene.mjs --all`；若当前工作树本就存在不合规历史件，先输出清单并要求：要么本次修，要么在 `.batch/night/archive/` 之外的白名单常量里显式列名＋理由（白名单最多 10 条，逐条写理由）。
4. **汇报缺 sha 提醒（不阻断）**：`check-batch-hygiene.mjs --staged` 若提交信息（`git log -1 --pretty=%B` 在 commit-msg 阶段不可用，故实现在 `commit-msg` hook 或 `--staged` 模式下读 `.git/COMMIT_EDITMSG`）不含 `CARD-[0-9]`，打印一行提醒 `提交信息缺卡号 CARD-xxxx`，`exit 0`。**只提醒不拦**，避免逼出 `--no-verify`。

## 3. 落点与禁改区【硬】

- 新建：`scripts/ops/check-batch-hygiene.mjs`
- 新建：`scripts/ops/__tests__/check-batch-hygiene.test.mjs`（≥4 用例：末行换行、末行多空行、`.vN` 文件名、archive 豁免）
- 改：`scripts/install-git-hooks.mjs`（hook 内容追加一步）、`scripts/check-fast.mjs`（接一步）
- **禁改**：`.gitignore`；`src/`；`.batch/night/**` 的实际内容文件（本卡不动协作件，只加检查）；`docs/` 禁动区；`scripts/workbuddy/model-policy.mjs` 与其测试
- **禁**：在 `develop` 的 `.git` 上跑 `pnpm hooks:install`；`--no-verify`；`git add -A`

## 4. 验收判据【硬】

每条须能指认（命令输出／文件:行），缺一条即不通过：

1. `node scripts/ops/check-batch-hygiene.mjs --all` 在干净树上 `exit 0`；在手工造的三个夹具（无末行换行、`.v3.md` 文件名、archive 下 `.v3.md`）上分别 `exit 1`、`exit 1`、`exit 0`（三个夹具路径与输出逐条贴报告，用完删掉）。
2. `node scripts/ops/check-batch-hygiene.mjs --staged` 对已 `git add` 的不合规文件 `exit 1`，输出不含「行数」字样。
3. `pnpm test scripts/ops/__tests__/check-batch-hygiene.test.mjs` 全绿，附 exit code。
4. `scripts/install-git-hooks.mjs` 生成的 hook 文本含 `check-batch-hygiene.mjs --staged`（`grep -n` 命中行号）；hook 仍保留原 `check-fast.mjs` 调用。
5. `scripts/check-fast.mjs` 含 `check-batch-hygiene` 调用（`grep -n` 命中行号），且 `pnpm check:fast` 在本工作树 `exit 0`（贴输出尾部）。
6. 缺卡号提醒：用 `printf 'no card\n' > .git/COMMIT_EDITMSG` 造夹具，`--staged` 模式打印提醒且 `exit 0`。
7. 白名单（若有）≤10 条，每条带理由文字；无白名单则报告写明「无」。
8. 提交信息含卡号 `CARD-1117-D`；不 push、不打 tag、不合并。

## 5. 交付物

- 提交（一卡一提交；`git add` 点名 `scripts/ops/check-batch-hygiene.mjs`、测试文件、`scripts/install-git-hooks.mjs`、`scripts/check-fast.mjs`）
- 报告：`.batch/night/reports/CARD-1117-D-report.md`（首行 `执行方：developer`，第二行 `model= | 倍率= | provider=`，末行 `<!-- DONE -->`）
- 报告贴夹具命令与输出，不写字节／md5／行数。
