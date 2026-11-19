状态：收口
持有者：项目总负责人 · AI writer项目组（终审完成，等主人定 B-14 后另立卡）
可写：否
最后变更：2026-11-19（18:2x 按 force push 后新头订正） 10:34（项目总负责人 · AI writer项目组）
卡号：CARD-1118-C
依据件：`review-requests/CARD-1118-B-rulings.md`

# CARD-1118-C · 协作件入索引收口（pii-scan 闸门）＋ 基线对照

> 本卡 10:26 首版按「切到远端占位符版覆盖工作区」写，与主人 11-19 裁定相反——**工作区保留真名供运行，只要求入库与推送不含真名**。故 10:32 整卡重写；首版未投出、无对外交付，不留 vN。

## 一、执行与复核

- 执行方：developer · AI writer项目组
- 复核：QA（首验）→ 项目总负责人（终审）
- 工作目录：`C:/develop/workspace/AI-writer/develop`
- 依据裁定（大肥鱼 11-19 10:2x 转达主身口径）：①远端与公开仓只出现 `<用户名>` 占位符，真实用户名一律不入库；②**本地 develop 工作区保留真名供运行**，两侧 107 处差异是预期，不是待修错位；③**不要 checkout origin 覆盖工作区**；④12 件已入索引件可提交，但提交前必须跑 `pii-scan.mjs`，命中须为 0；⑤远端三支**还将再 force 一次**，在此之前不推送、不做硬合并。

## 二、本卡要做的事（只有三件）

1. **不切分支、不覆盖工作区**：工作分支仍是 `work/reboot-1118`（本地头 `27971070`）；`origin/exp/resource-ledger` 现为 `beeedc26`，只作**对照基线**用，不 checkout、不 reset、不 merge。
2. **把待入库协作件过 pii-scan 后提交**：当前索引里 12 件；我用 `node <rotation>/pii-scan.mjs --repo . --staged` 扫出命中 1 件 2 处（`reports/evidence-receipt-side-1116.md` 第 7 行：真名 ＋ `C:\Users\<真名>`）。这些文档件就地改成 `<用户名>` 占位符即可（不影响运行），然后 `git add` 点名、再扫一次到 0、一次提交。
3. **给出 107 处差异的归类表**（只作对照，不改盘）：`git diff --name-only HEAD origin/exp/resource-ledger` 全清单，按目录归类并标注每类性质（`占位符替换`──预期／`其它`──报我）。

## 三、不许做的事

- 不 `git checkout`／`git reset --hard`／`git restore` 用 origin 覆盖工作区任何文件。
- 不改源码与配置里的真名（运行需要）。**只有拟入库的文档件**允许改占位符。
- 不 push、不 force、不 rebase、不 merge、不打 tag（远端将再 force 一次）。
- 不动 `.gitignore`、notice、`.batch/night/org/ledger-*` 两族。

## 四、完成判据（逐条命令 + 实输出 + exit）

1. `git rev-parse --abbrev-ref HEAD` → `work/reboot-1118`；`git rev-parse --short HEAD` → `27971070` 或其上加一次本卡提交后的新头（贴出来）。
2. 分支拓扑未动：`git rev-parse --short origin/exp/resource-ledger` → `beeedc26`；`git merge-base HEAD origin/exp/resource-ledger` → `fc576e08`（前 8 位）。
3. **pii-scan 索引面清零**：`node "C:/Users/<用户名>/.dsh/bot/workspace/rotation/pii-scan.mjs" --repo . --staged`（实际执行时用环境变量拼路径，报告里写真实命令）→ 输出「0 个文件 / 0 处命中」或等价零命中行，exit 0。
4. **提交面真名清零**：`git grep -l -F "C:\\Users\\$(whoami)" HEAD -- . | wc -l` → `0`。
5. 工作区允许有真名：`git grep -n -F "C:\\Users\\$(whoami)" -- . | wc -l` → **允许 > 0**（运行所需），须贴数字说明「工作区保留真名」。
6. 提交规范：`git rev-list --count origin/exp/resource-ledger..HEAD` 贴数字；`git show --name-only --pretty=format: HEAD | grep -c '^\.batch/'` 贴数字且与报告清单一致。
7. 差异归类表：`git diff --name-only HEAD origin/exp/resource-ledger` 全清单 ＋ 按目录归类 ＋ 每类性质标注。
8. 未 push：`git status -sb | head -1` 无 `[behind]`；`git branch -vv | grep reboot-1118` 无 `[origin/…]` 上游。
9. 报告 `.batch/night/reports/CARD-1118-C-report.md`：首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`；报告内不写真名，路径用 `$(whoami)` 或占位符。

## 五、红线（触发任一即不通过）

1. `git push`／`--force`／`git rebase`／`git merge`／`git checkout` 用 origin 覆盖工作区。
2. `git add -A`／`git add .`／`-f`。
3. pii-scan 命中非 0 就提交。
4. 真名出现在被提交文件内（判据 4 命中）。
5. 改源码、配置、`.gitignore`、notice、两族 `ledger-*`。
6. 删除 `archive/*` 分支或 `.batch/night/archive/` 内任何件。

## 六、边界

- 只动「拟入库文档件的占位符替换」＋一次提交；盘面其余保持原样（0 提交前状态：12 件在索引、其余留盘）。
- 文档件改占位符时只改命中的真名/绝对路径片段，不改其余文案。
- 若某待入库件是**运行所需**（源码、脚本、配置），不许改真名——把它从本次提交里拿掉，列清单报我，由我另定方案（如 `.gitattributes` clean filter）。
