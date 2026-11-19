执行方：developer · AI writer项目组（群分身）
model=deepseek-v4.1 | 倍率=非高峰 5 折 | provider=官方直连

# GOAL stage 2 · archive 登记补齐 ＋ 未跟踪件清场 · 交件报告

- 分支：`exp/mainline-1119`｜起点 `68fa0381`｜提交 **`f2ffa905`**（父 `68fa0381`，1 提交）
- 工作区：`C:/develop/workspace/AI-writer/develop`（无 worktree，按 `worktree-parallel.md` §3.1 只用固定三槽，本卡不开新槽）
- 依据件：`.batch/night/org/stage2-disposition-1119.md`（§一 五字段取数依据、§二 计数口径、§三 G1–G5 归属、§五 判词落点）
- 未 push、未 rebase／merge／checkout origin、未 `git clean`／`git stash`、未 `git add -A`（全部点名 add）

## 一、交付物

| 产物 | 路径 | 字节 | 行 | MD5 | 说明 |
|---|---|---|---|---|---|
| 登记表（97 条） | `.batch/night/archive/README.md` | 35,902 | 173 | `a04b349d6f8ca64bf02d78f3bd68536b` | 单表 97 行、五字段齐；UTF-8 无 BOM、`crlf=0`、末字节 `0a` |
| G1 入库 | 卡面／派验单／裁定／报告／规范件 **27 件** | — | — | — | 含 `org/stage2-disposition-1119.md`、`reports/GOAL2-untracked-inventory-qa.md` |
| G2 归位后入库 | `.batch/night/staging/vn-history-1119/` **37 件** | — | — | — | 原相对结构保留（`cards/`・`org/`・`review-requests/`・`staging/…`） |
| G3/G4/G5 移出 | `C:/tmp/pmo-stage2-quarantine/` **7 件** ＋ 该目录 `README.md` | — | — | — | 不入库，按原相对路径存放、可 `mv` 复位 |

提交面：**65 files changed, 6,539 insertions(+), 104 deletions(-)**（65 ＝ README 1 ＋ G1 27 ＋ G2 37；104 删除行全部来自 README 旧版被替换的正文行，无任何件被删）。

## 二、判据取证（三条自核 ＋ 附加核）

### 判据 1 · 条目 97

```console
$ grep -c '^| [0-9]' .batch/night/archive/README.md
97
$ git ls-tree -r --name-only HEAD -- .batch/night/archive | grep -vc 'MANIFEST\.sha256$'
97
$ git show HEAD:.batch/night/archive/MANIFEST.sha256 | wc -l
97
```

### 判据 2 · 与树件双向差集 0／0（路径完全对应）

```console
$ node -e "… tree vs README §二 路径集双向差集 …"
tree=97 readme=97
tree-only=
readme-only=
```

### 判据 3 · `git status --porcelain -uall` 清单（`??` 归零）

```console
$ git status --porcelain -uall | wc -l
0
$ git status --porcelain -uall | grep -c '^??'   # 提交后
0
```

清场前 71 件（负责人 23:50 计数为 69，其后新增 `org/stage2-disposition-1119.md`、`reports/GOAL2-untracked-inventory-qa.md` 两件），逐件归属：

| 组 | 件数 | 去向 | 归属依据 |
|---|---|---|---|
| G1 | 27 | 点名 `git add` 入库 | disposition §三 G1（25）＋事后新增 2 |
| G2 | 37 | 移入 `.batch/night/staging/vn-history-1119/` 后入库 | disposition §三 G2；`staging/` 在 `EXEMPT_VERSIONED_DIRS`，`--all` 仍 0 项 |
| G3 | 5 | 移出到 `C:/tmp/pmo-stage2-quarantine/`（SQLite 运行态） | disposition §三 G3 |
| G4 | 1 | 同上（`delivered/62e69db07b3/2026-11-18-2000-report.md`） | disposition §三 G4 |
| G5 | 1 | 同上（`scripts/workbuddy/space-readonly-check.mjs`，B-8 待认领） | disposition §三 G5 |

### 附加核 · 归档面未被改动

```console
$ git show --name-only --pretty=format: f2ffa905 | grep -c '^\.batch/night/archive/'
1                       # 只有 README.md
$ git diff --stat 68fa0381 f2ffa905 -- .batch/night/archive/
 .batch/night/archive/README.md | 213 ++++++++++++++++++++++++++++++++-----------
 1 file changed, ...
```

`MANIFEST.sha256` 与 96 件归档物字节零改动（提交面不含它们）。

## 三、五字段取数来源（逐件可核）

按 disposition §一 的顺序取，**取不到即写 `待补`、禁写「未知」、不作推断**：

- **谁建**：件内 `生成人：` → （`cards/`・`review-requests/`）`From:` 行发文方 → 报告类 `执行方：` → `作者：`／`采集人：` → 维护人括注。共 32 条落到 `待补`（见 §五）。
- **何时**：件内 `生成时刻`／`版本：v…（日期）`／`时间：`／`采集时间`／`deliveredAt` → 文件名或所在子目录日期段（`1107`／`1113`／`resume-1114`／`1116`／`1117`／`20261119`）→ 首 30 行内日期 → 均取不到 `待补`（6 条）。
- **用途**：件内首个标题行（`.done` 信号件改写为「完成信号（要点），指向 `reports/<x>.md`」），配合原目录语义在 §一 说明；不使用推断性描述。
- **保留期限**：统一「长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e」。
- **是否清洗版**：统一「是（与 `MANIFEST.sha256` 一致）」——97 件全部来自 `78d56ea0` 的脱敏入库版，字节与清单逐件一致（stage 1 已核 `mismatch=0`）。

## 四、机检与闸门（提交前跑，末行原文）

```console
$ node scripts/ops/check-batch-hygiene.mjs --all
0 项不合规
$ pnpm check:fast
[check:fast] typecheck ✓ 32.2s
doc links: checked 1468, broken 0
doc placement: 扫描 438 份 md，当前违规 0 条，基线内 0 条，新增 0 条
0 项不合规
[check:fast] 全部通过。
EXIT=0
```

提交后复跑同样两条：`0 项不合规`、`git status --porcelain -uall | wc -l` = `0`。

## 五、`待补` 38 条（已列进 README §四，逐条带缺字段与补法）

分布：`1107/` 15 件（bridge 信件 8 ＋ 信号 `.done` 7，均无件内署名）、`resume-1114/` 6 件、`*-1113/` 2 件、`P9.json`／`wake-later.json` 2 件、`cards/` 3 件（缺何时）、`review-requests/` 5 件（缺何时）、`staging/` 5 件。

缺「谁建」32 条、缺「何时」6 条，无一条缺「用途／保留期限／是否清洗版」。补法已按类写在 README §四（查台账条目／查同卡报告件 `执行方：` 行／查 1107 段 bridge 台账）。**按 disposition §四，本阶段不追平不算不通过，但清单必须列全** —— 已列全 38 条。

## 六、授权边界内的两处副作用（须让 QA 知情）

机检 `--all` 首次复跑报 **4 项 trailing-newline**，全部由本阶段新入库件带来（不是既有件变红）：3 件 G1 件以连续空行结尾、1 件 G2 件末行缺换行。按 check 的修法提示「给缺换行的文件末尾补一个换行」处理，**只动文件末尾空白，不动任何正文**：

| 文件 | 处理 | 处理后字节 |
|---|---|---|
| `.batch/night/cards/CARD-1118-D-version-files.md` | 末尾连续空行收敛为单个 `\n` | 11,474 |
| `.batch/night/cards/CARD-1119-A-pii-line-landing.md` | 同上 | 5,846 |
| `.batch/night/review-requests/CARD-1119-A-pii-line-landing.md` | 同上 | 2,879 |
| `.batch/night/staging/vn-history-1119/staging/dispatch-schedule.v1.md` | 末尾补 `\n` | 1,743 |

这 4 件都是**首次入库**（`A` 状态），`git diff` 不产生「对已有版本的内容改动」，且四件均不在 `archive/`（归档面冻结未破）。若负责人认为流转件尾部空白也不许动，处置方案是改走 baseline 冻结清单——本卡未那样做，理由：本阶段判据要求 `--all` 为 0 项，而 disposition 未给冻结清单的落点。

## 七、给下一阶段的移交点

1. 本阶段只交**登记**，不动段级 payload；`archive/` 97 件字节仍以 `MANIFEST.sha256` 为准。
2. `staging/vn-history-1119/` 是新目录（37 件），`staging/` 豁免使 `--all` 保持 0；后续若把它也移进 `archive/`，会撞 stage 1 的 97 冻结，须另开卡。
3. QA 判词落点按 disposition §五：`.batch/night/reports/GOAL2-archive-readme-qa-firstcheck.md`（判词落盘时为本阶段唯一新增 `??`，随下一笔点名 add）。
4. `C:/tmp/pmo-stage2-quarantine/README.md` 已按 B-1e 写六段（谁建／何时／用途／保留期／过期给谁／回滚）。

<!-- DONE -->
