状态：收口
持有者：项目总负责人 · AI writer项目组（已收口）
可写：是
最后变更：2026-11-19 21:1x（项目总负责人 · AI writer项目组）
卡号：CARD-1119-E
依据件：本卡；`review-requests/CARD-1119-E-hygiene-archive-exempt.md`

# CARD-1119-E · 机检尾行规则对 `.batch/night/archive/` 豁免

## 一、这件事是什么（背景与两个真事实）

`.batch/night/archive/` 的 97 件归档件要被 git 管起来（B-6，主人 11-19 18:57 已准 `.gitignore` 反向包含），但一入库机检就红 8 项：`.batch/night/archive/roster/identity-roster.v3.8/.v3.9/.v3.12/.v3.13` 等缺末行换行。

两个必须先写明的事实（我 19:5x 实测，别凭卡面猜）：

1. `scripts/ops/check-batch-hygiene.mjs` 的尾行检查**从来没有目录豁免**：`:88-93` 对所有 `.md` 一律 `checkTrailingNewline`；只有版本文件名规则有 `EXEMPT_VERSIONED_DIRS`（`:38`，含 archive 与 staging）。
2. 因此 F 卡判据 8 那条「`--disk` 的 archive 尾行 0 项」是**在空集上成立**的（当时树里没有 archive/，193 件被 ignore）；QA 首验 F 时已指出真反证来自单测夹具。**本卡就是把它补成真的。**

处理方向已由大肥鱼 与主人认可：**改码豁免，不补换行**——补换行＝改归档件字节，与「原样留档、事后哈希对账」冲突。

## 二、要做什么（只此三件）

1. 新增 `EXEMPT_TRAILING_DIRS = [`${WATCH_ROOT}/archive/`]`（与 `EXEMPT_VERSIONED_DIRS` 并列，不合并——两者豁免面不同，合并会让 staging 的尾行也免检）。
2. 尾行检查改为：路径以 `EXEMPT_TRAILING_DIRS` 任一前缀开头 ⇒ 跳过；其余（含 `${WATCH_ROOT}/staging/`、`cards/`、`reports/`）照旧检查。
3. 单测补两向反证：`archive/` 下缺尾行的 `.md` **不报**；`staging/` 与其它的 `.md` 缺尾行 **照报**。

**不动**：`EXEMPT_VERSIONED_DIRS`、`--disk`／`--all` 的取值来源、退出码语义、修法行文案、`archive/` 内任何文件内容。

## 三、起点与工作区

- 起点：`work/pii-1119` @ `f8728c8d`（脱敏线，唯一基线；旧线 `work/reboot-1118` @ `2923090a` 永不用）
- 工作区：`wt-1119e`；分支：`card/1119-E`
- 开工四项校验（缺一项不许开工）：①`git rev-parse --short HEAD` = `f8728c8d`；②`git merge-base --is-ancestor f8728c8d HEAD && echo ok` 为 ok；③目标文件 `scripts/ops/check-batch-hygiene.mjs` 与 `scripts/ops/__tests__/check-batch-hygiene.test.mjs` 存在；④`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均空；⑤`ls scripts/ops/__tests__/ | grep hygiene` 目标族已核（B-9 教训：出卡前先 ls）。

> 注：这条线的工作区在本机没有 `node_modules`。提交前优先给 `wt-1119e` 挂 junction 共享 `develop/node_modules`（`wt-1117d` 先例，不 install／不 rebuild／不改 ABI）；挂不上才用 `--no-verify`，并必须在 `develop` 复跑 `node scripts/check-fast.mjs` 贴末行。

## 四、判据（命令 + 期望，逐条给实输出与 exit）

1. **豁免面正确（口径按 QA 20:2x 建议定）**：源码可写模板字面量 `` [`${WATCH_ROOT}/archive/`] ``（与 `:37-38` 既有写法一致），**判据读作「运行时解析后等于 `.batch/night/archive/`」**——贴两行：①`grep -n 'EXEMPT_TRAILING_DIRS' scripts/ops/check-batch-hygiene.mjs` 的源码行；②`node -e "import('./scripts/ops/check-batch-hygiene.mjs').then(m=>console.log(JSON.stringify(m.EXEMPT_TRAILING_DIRS)))"` 的解析值，须为 `[".batch/night/archive/"]`。源码里出现字面量也接受，但不得两处并存两个常量。
2. **staging 不被牵连**：`git show <sha>:scripts/ops/check-batch-hygiene.mjs | grep -c 'EXEMPT_VERSIONED_DIRS'` 仍 ≥ 1 且其值仍含 `staging/`（贴行）。
3. **两向反证跑真单测**：`node scripts/run-tests-electron.mjs scripts/ops/__tests__/` → 全绿，且新增用例名里能看出「archive 不报」与「staging 照报」两条（贴用例名与 passed 数）。若工作区跑不动，改在 `develop` 跑并说明原因。
4. **在 `78d56ea0` 上验真红转绿**：临时克隆 `work/archive-in-git-1119`，把本卡改后的 `check-batch-hygiene.mjs` 放进去跑 `--all` → `0 项不合规` `EXIT=0`（贴输出）。**反证**：同一临时树把 `EXEMPT_TRAILING_DIRS` 临时置空再跑 → 必须仍报 **8 项**（贴输出），证明豁免没把检查整体关掉。8 项的构成按 QA 实测：**7 件缺末行**（`identity-roster` 的 `v2`／`v3.8`／`v3.9`／`v3.10`／`v3.11`／`v3.12`／`v3.13`）＋**1 件以连续空行结尾**（`identity-roster.v3.1.md`）；两种子形态都由同一条 `checkTrailingNewline` 产出，豁免面覆盖两者，不许只修「缺末行」一种。
5. **本线不回归**：在 `wt-1119e` 跑 `node scripts/ops/check-batch-hygiene.mjs --all` → `0 项不合规` `EXIT=0`。
6. **gate 过**：`node scripts/check-fast.mjs` → `全部通过` `EXIT=0`（贴末两行）。
7. **提交面干净**：`git show --name-only --pretty=format: <sha> | grep -c '^\.batch/'` = 0；`git rev-list --count f8728c8d..<sha>` = 1。
8. **报告三处格式**：首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`；报告里写明「F 卡判据 8 曾是空集通过」这条背景已被本卡补成真。

## 五、红线（触发任一即不通过）

1. 改 `archive/` 内任何文件的字节（含补末行换行），或删文件。
2. 把尾行豁免扩到 `archive/` 以外（尤其 `staging/`、`cards/`、`reports/`）。
3. 顺手动 `EXEMPT_VERSIONED_DIRS`、`--disk`、退出码、修法行文案。
4. `git add -A`／`git add .`／`-f`／`--force`／push／rebase／merge。
5. 在工作区留下临时克隆、反证件、`_tmp*` 等未清理产物（用完即删）。
6. 未跑判据 4 的反证就报完成。

## 六、落点

- 报告：`.batch/night/reports/CARD-1119-E-report.md`
- 派验单：`.batch/night/review-requests/CARD-1119-E-hygiene-archive-exempt.md`（与卡面同时出，B-18）
- 开工前先回一行「我领这张」；本卡不得与 archive 入库那一笔混在一起（大肥鱼 20:0x 口径）。
