From: 项目总负责人 · AI writer项目组 | 5b1e2d16
To: developer | {{SECRET_2xwpbfdt}} | 群分身

状态：收口
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-18 11:23（项目总负责人 · AI writer项目组）
卡号：CARD-1118-B
依据件：`cards/CARD-1118-reboot-first.md`（首卡，本卡为其后续，不重复）

# CARD-1118-B · 分叉收口（A 方案）＋未跟踪件归位

## 一、执行与复核
- 执行方：developer
- 复核：QA（首验）→ 项目总负责人（终审）
- 前置：首卡（`CARD-1118-reboot-first`）终审通过后开工；本卡不碰 `.batch/night/org/ledger-*`

## 二、已定事实（我 10:15–10:20 实测，不必重查，但可复算核对）
- 本地 `exp/resource-ledger`（`1dd9e948`）与 `origin/exp/resource-ledger`（`27971070`）**无共同祖先**：`git merge-base` 空；本地根提交 `cbd99031`／`6da77628`，远端根提交 `11592e31`。
- 作者不同：本地 `大管家 <butler@<主机名>>`，远端 `baiyunfei <…>`。
- 树差 119 文件、299+/299−，逐处为路径占位符差异：本地写 `C:/Users/<用户名>/…`，远端写真实用户名。**两侧内容同源，远端才是真仓库**。
- 结论：本地 `.git` 是一份重建仓库，不是该 GitHub 仓库的原生历史；本地 1042 个提交不能作为基线。

## 三、终裁：A 方案（不动远端历史，可回滚）
1. **留档**：`git branch archive/local-rebuilt-1118 1dd9e948`，一个字不改，不删。
2. **换基线**：`git switch -c work/reboot-1118 origin/exp/resource-ledger`。此后 `work/reboot-1118` 是本项目唯一工作分支。
3. **不 push、不 force、不 rebase、不 merge 无关历史**（B 方案强推已排除；把两套历史 merge 会造出双根树）。
4. 119 处占位符差异**以远端真名为准**，不回退成 `<用户名>`。

## 四、未跟踪件归位（`大肥鱼` 10:1x 裁定第②条）
切分支前先 `git status --porcelain | grep -c '^??'` 记数（当前 96 件），切完再记一次，数不许少——少了说明有件被覆盖，立刻停手报我。

按三类处理，逐类给清单：
1. **`.batch/night/**`**：按 B 卡口径点名 `git add <具体路径>` 入库（禁 `-A`、禁 `-f`）。`*.vN.md` 中**与主件字节相同**的重复件（已确认至少 `org/ledger-append-1117-hy4flash-auth.v7.md` 与主件 md5 同为 `91bdbf8ee88cc04d91ef500c3139df27`）**不入库**，列进报告待收编去重。
2. **`.c/`、`reports/hy4-*`**：按 B-1e —— 同目录有 `README.md` 或首行说明（谁建/何时/用途/保留期/过期给谁）则留并入库或留盘注明；无说明则逐件列进 BACKLOG「待认领」，留盘不动。
3. **其余**：逐件判，判不了的列清单报我，不许静默删。

## 五、完成判据（逐条给命令与 exit，缺一条即打回）
1. `git branch --list 'archive/local-rebuilt-1118'` → 恰一条，`git rev-parse --short archive/local-rebuilt-1118` → `1dd9e948`。
2. `git rev-parse --abbrev-ref HEAD` → `work/reboot-1118`；`git merge-base HEAD origin/exp/resource-ledger` → 等于 `origin/exp/resource-ledger`（即基线之上）。
3. `git rev-list --count origin/exp/resource-ledger..HEAD` → 本卡全部提交数（贴出数字，别写「若干」）。
4. 切分支前后未跟踪件计数一致（贴两次 `grep -c '^??'` 与 `git status --porcelain | wc -l`）。
5. `git diff --stat HEAD origin/exp/resource-ledger | tail -1` → `0 files changed`（证明没把占位符版本带回来）。
6. 占位符抽查：`grep -rn '<用户名>' scripts/ops/ | wc -l` → `0`。
7. 三类归位各给一份清单（路径 + 处置：入库／留盘／进 BACKLOG），`.vN` 重复件单独一节；`.batch/night` 入库件逐条 `git add` 命令原文贴出。
8. 本卡不 push：`git status -sb | head -1` 显示 ahead 数且无 `[behind]`；`git branch -vv | grep reboot` 无 `[origin/…]` 上游。
9. 报告首行 `执行方：developer`、第二行 `model= | 倍率= | provider=`、末行 `<!-- DONE -->`。

## 六、边界
- 只动 git 分支拓扑与本机未跟踪件；不改源码语义、不改 `.gitignore`、不动 notice、不碰 `.batch/night/org/ledger-1117-hy4flash-auth*` 族。
- 任何删除动作先列清单报我，一件都不许自己删。
- 真名 vs 占位符：只认远端真名；发现别处还有占位符，记进报告，不顺手改。
