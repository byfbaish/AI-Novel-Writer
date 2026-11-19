状态：收口
持有者：项目总负责人 · AI writer项目组
可写：否
最后变更：2026-11-19 12:05（项目总负责人 · AI writer项目组｜前置已到，起点定为 `f8728c8d`）
卡号：CARD-1118-D
依据件：`.batch/night/org/BACKLOG.md` B-10／B-11

# CARD-1118-D · 版本件收编（47 件真历史版本件 ＋ 35 件无主件版本件）

派单方：项目总负责人 · AI writer项目组｜2026-11-19 11:25
执行方：developer · AI writer项目组

## 一、开工前三项校验（贴输出）

1. `git rev-parse --short HEAD` ＝ `f8728c8d`（`work/pii-1119` 头；我 12:04 实测）
2. 目标族实数：`ls -1 .batch/night/{cards,org,review-requests,staging}/*.v[0-9]* 2>/dev/null | wc -l`，报出条数。**以实测为准**：developer 11:25 实测 79（cards 23／org 8／review-requests 14／staging 34），卡题「47＋35」是 B 卡报告的旧分类口径，两者差 3 件须在报告 §2.1 末尾点明是哪 3 件（如后来新增的派验单 `.v2/.v3`）。**判据 2 的通过线按实测值，不按 82。**
3. 从 `f8728c8d` 新建 `wt-1118d`，天然干净；`git diff --ignore-cr-at-eol --stat` 与 `git diff --numstat` 均空。旧线上那 2 件 ` M`（B 卡状态行、BACKLOG）由我自己搬，不由你处理。

## 二、任务（三件，不涉 push、不涉历史、不删件）

### 2.1 建清单（先做，不落改）
按 BACKLOG B-10／B-11 的范围，把 `cards/`、`org/`、`review-requests/`、`staging/` 四个目录下的 `*.vN.md`／`*.vN` 全部列出，每件一行，字段：路径｜字节｜同目录主件是否存在｜与主件是否同字节｜被哪些已入库件引用（`git grep -l <文件名> HEAD` 的条数）。产出一张表，先交我看，**表未过审不动文件**。

### 2.2 分类执行（表过审后）
- **甲类·主件存在且同字节** → 移入 `.batch/night/archive/`，改名 `<原相对路径去掉 .vN>-superseded-vN.md` 保持可追溯，README 记一行。
- **乙类·主件存在但字节不同（真历史版本）** → 移入 `.batch/night/archive/`，保持原文件名，README 记「哪一版、为何留档、被哪些报告引用」。
- **丙类·无主件** → **不删、不改名**，只入 archive 并 README 写明「唯一现存副本」，同时列出「是否建议改名顶替成主件」的判断依据（引用数 > 0 的才建议）。
- **丁类·被已入库件引用的必须留可读路径**：移入 archive 后若某已入库件引用了旧路径，README 里写新路径映射，不得改已入库件正文。

### 2.3 收口
`archive/README.md` 六段齐（谁建／何时／用途／保留期／过期给谁／清单），清单条数＝移入件数。

## 三、判据

| # | 判据 | 命令 | 通过线 |
|---|---|---|---|
| 1 | 未离开起点 | `git -C <develop> log --format=%h -1`；`git -C wt-1118d log --format=%h -1` | develop HEAD 与开工前一致（`2923090a`）＋本卡 0 提交；`wt-1118d` 停在 `f8728c8d`（本卡未落任何改动）。**读作「0 提交」**，见 §九 裁定五 |
| 2 | 清单覆盖 | 报告贴 §2.1 表 | 行数 ＝ **82**（79 顶层 ＋ `staging/identity-copies/` 3 件，见 §七 裁定一） |
| 3 | 分类不重不漏 | 报告贴「甲/乙/丙/丁」四类件数 | 甲 0 ＋ 乙 48 ＋ 丙 34 ＝ 82；丁（被引用）56 件另列；**实际移入＝47**——乙类 48 件中 `cards/p50-fix4-ch03.v1-REBUILT.md` 是**已入库件**，移动即产生 ` D`，故留原地并在 README 写明（见 §九 裁定六） |
| 4 | 未删件 | `git status --porcelain -- .batch/night` | 无 ` D`；移入件以**文件系统实存**为准（新路径存在＋字节/md5 与清单一致）。**不再要求 `git ls-files --others` 能看到**——`archive/` 未被 `.gitignore` 放行，git 对它返回空（developer 12:3x 探针实测） |
| 5 | 丙类原地未移 | 报告贴丙类 34 件路径 ＋ `ls` 实存 | 34 件全部**原路径仍在**、字节与清单一致（见 §七 裁定三：丙类不移） |
| 6 | README 六段 | `awk 'END{print NR}' .batch/night/archive/README.md` | 六段齐、清单条数＝移入数 |
| 7 | 机检 | `node scripts/ops/check-batch-hygiene.mjs --all`；`pnpm check:fast` | 前者 exit 0；后者 exit 0，贴末行 |
| 8 | 报告格式 | `reports/CARD-1118-D-report.md` | 首行 `执行方：developer`、次行 `model= \| 倍率= \| provider=`、末行 `<!-- DONE -->` |

## 四、红线

1. `git push`／`--force`／`rebase`／`merge`／checkout origin。
2. `git add -A`／`git add .`／`-f`。
3. 删除任何 `.vN` 件（本卡只移不删）。
4. 改已入库件正文（引用旧路径的只写映射表）。
5. 动 `.gitignore`、`cards/` 之外的两族 `ledger-*`、`notice`。
6. 把真名字面量写进报告或清单（用 `<用户名>`）。

## 五、报告与留档

报告 `.batch/night/reports/CARD-1118-D-report.md`；清单表另存 `.batch/night/org/version-files-inventory-1119.md`（供后续引用）。
## 六、worktree 提交纪律（QA 11:58 要求落到卡面，不只在裁定文字里）

1. 提交前**优先挂 junction 共享 `develop/node_modules`**（`wt-1117d` 先例：`cmd //c mklink /J node_modules ..\develop\node_modules`），挂上就正常跑 pre-commit。
2. 挂不上才允许 `git commit --no-verify`，且必须在 `develop` 检出复跑 `pnpm check:fast` 并贴末行，报告里写明「用了 `--no-verify`，理由与复跑结果」。
3. 任何情况下不得 `pnpm install`／`rebuild`（AGENTS.md §2.8：会打断在跑槽位的 ABI）。

## 七、阶段一过审与两项裁定（12:26）

**清单表 `.batch/night/org/version-files-inventory-1119.md` 过审**（9,766B / 118 行 / `7f29d50f…`）：79 行表、字段齐、甲 0／乙 48／丙 31 与我的抽验一致。允许进 §2.2。

- **裁定一·按 82 收**。把 `staging/identity-copies/bot-session-identity.v2/.v3/.v4.md` 3 件并入（属丙类「主件缺失」），正好对上卡题 82；它们在同名子目录下，正是最容易被漏掉的一批。判据 2 通过线＝82，判据 3 分类和＝82。
- **裁定二·§2.2 在 `develop` 原地移**。理由：79 件里只有 `cards/p50-fix4-ch03.v1-REBUILT.md` 入库，其余 81 件是未跟踪工作件，`wt-1118d` 里根本没有；拷过去只会造两套副本。在 `develop` 原地移，git 侧不产生 `D`／rename（本来未跟踪），判据 4／1 天然满足。
- **随之改两条执行口径**：
  1. §2.2 的执行位置是 `develop`，`wt-1118d` 只用于跑机检（junction 已验可用：`check-fast` 全绿 typecheck 22.2s／doc-links 1468-0／doc-placement 437-0／hygiene 0）。
  2. **`--disk` 计数上升不作为不通过理由**：移进 `archive/` 的件仍带 `.vN` 名，`versioned-filename` 规则在 archive 只对 `final-newline` 豁免、不对版本名豁免，因此 `--disk` 会多出条目。本卡只要求 `--all`（已跟踪面）exit 0 且 0 项。是否给 `archive/` 整目录豁免，另记 BACKLOG B-16，不在本卡改码。
- **`archive/README.md` 必须记满 82 条**：每条含「原路径 → 新路径｜类别｜字节｜被哪些已入库件引用（无则写无）」，丙类另写「唯一现存副本」。

## 八、12:35 第二组裁定（developer 报两处判据互斥，都是我的卡面问题）

- **裁定三·丙类不移（采纳 A1）**。丙类 34 件里 26 件被在盘件**按原路径**引用（`d1-delivered-path.v3.md` 等），移走即断链；且丙类无主件，移动不带来任何去重收益。改读：**丙类原地不动**，`archive/README.md` 仍记满 82 条——48 条「已移入」＋34 条「唯一现存副本·未移」，每条都要写原路径与字节。判据 5 相应改成「原路径仍在、字节一致」，不再与 §2.2 冲突。
- **裁定四·判据 4 后半句改读文件系统实存**。`archive/` 未被 `.gitignore` 放行，`git ls-files --others --exclude-standard` 与 `git status --porcelain` 对它返回空，只有 `--ignored` 看得见目录；原判据「`git ls-files --others` 能看到新路径」在 archive 上恒假，是我写错。改读：新路径在文件系统实存且字节/md5 与清单一致，另加 `git status --porcelain -- .batch/night` 无 ` D`。
- **随之记**：乙类 48 件移走后 `??` 从 98 掉到 50，是进了 ignore 区、不是丢件；`archive/` 入库仍归主人那件待决（B-6），本卡不碰 `.gitignore`。

## 九、12:58 第三组裁定（判据 7 外来红与两处口径）

- **裁定五·判据 1 读作「0 提交」**：`develop` 停在 `2923090a`（开工前一致），`wt-1118d` 停在 `f8728c8d` 且本卡未在其中落改动；两处都要贴 `log -1`。§七 说「develop 原地移」，起点写 `f8728c8d` 指的是**取数基线**，不是 develop 的 HEAD——这层歧义是我卡面没写清。
- **裁定六·按 47 收**：`cards/p50-fix4-ch03.v1-REBUILT.md` 是已入库件，移入 archive 必出 ` D`；「已入库件」的版本管理本来就由 git 负责，不需要进 archive。故本卡移入 47，该件原地保留、README 写明「已入库件·由 git 管理·未移」。**不授权 `git rm --cached`**（那等于把已入库件从版本面拿掉，超出本卡范围，也未获主人许可）。
- **裁定七·判据 7 的外来红已由我修掉**：`.batch/night/org/BACKLOG.md` 末尾多了空行（我 12:24 追加时留下的），12:57 我删掉末尾空行、单换行收尾。复跑结果：`node scripts/ops/check-batch-hygiene.mjs --all` ＝ `0 项不合规` exit 0；`node scripts/check-fast.mjs` ＝ typecheck ✓ 17.5s／doc links 1468 broken 0／doc placement 438 新增 0／batch-hygiene 0 项／**全部通过**。判据 7 由执行方按修后状态复跑贴末行即可。
- **附带发现受理**：`archive/roster/` 22 件 `identity-roster.v2/v3.x` 历史遗留未登记 README，不扩本卡表，记 BACKLOG B-17。

## 十、首验与终审（13:24）

- 首验：QA **PASS**，判词 `reports/CARD-1118-D-qa-firstcheck.md`（8,610B / `90a7d75a…` / 133 行）；八判据全成立、红线六条零触发（无上游、reflog 停在 10:41）。
- 我 13:26 抽验：`archive/README.md` 四段标题齐、82 条清单；`find archive -type f` ＝ 97 件；`git status --porcelain -- .batch/night` 的 ` D` 计数 0；`cards/p50-fix4-ch03.v1-REBUILT.md` 仍在原地；丙类样本（`p56-wb-docs-stale.v5.md`、`staging/identity-copies/bot-session-identity.v4.md`）仍在原路径。
- **终审：通过**。受验＝`develop` @ `2923090a`，本卡 0 提交。
- 判据 7 的绿由 QA 在修后状态复跑取得（hygiene 0 项 EXIT=0、check-fast 全部通过 EXIT=0），裁定：**不返工**，收口时本段即补贴，报告不改。
- QA 勘误受理并扩账：`archive/` 实存 97 件＝已登记 50 ＋ **未登记 47**（`.vN` 22 全在 `roster/`，非 `.vN` 老档 25：`1107/`15、`resume-1114/`6、`p9-prefix-restart-1113/`1、`pre-restart-1113/`1、`P9.json`、`wake-later.json`）。B-17 由「roster 22 件」扩为「archive 全量补登记 47 件」。
- 采信限度两条按 QA 写法保留：移动前 md5 无法独立复现（只核字节 82/82）；判据 7 的绿来自 QA 复跑。
- **我的流程缺陷（记 B-18）**：本卡没出独立派验单，QA 只能按卡面＋裁定请求单判。这是第二次同类缺失（B 卡时也补过一次）。规矩：出卡与出派验单是同一个动作，卡面无派验单不得翻「在办」。
