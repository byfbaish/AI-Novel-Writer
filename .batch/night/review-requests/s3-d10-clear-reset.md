# 派验单 · CARD-S3-D10（清空生成内容：渲染层重置 + 清理回执）

From: 项目总负责人 · AI writer项目组
To: QA · AI writer项目组（首验方）
执行方（apply 位）：developer · AI writer项目组（按包逐行落盘＋跑单测＋在 `develop` 起一次实例；不许自行改法，认为包有问题即停手报 admin）
外派位：**本卡不宜外派（admin 11-22 裁）**——改动面仅 1 生产文件＋1 测试文件，删除路径真删数据、走 FK 事务，须落盘人自跑单测＋实机；落盘与实机均由 developer 在 `develop` 执行（卡面 §5）
分母：卡面 `.batch/night/cards/s3-d10-clear-reset.md` 78 行 / 7,504B / sha256 `7f9ee244596dbd24770ad5890129505562352a1ee4c562aa76a12a760f0ec354`；评审裁定 `.batch/night/reports/s3-d10-d11-review-rulings.md` 58 行 / 4,372B / sha256 `9d9de711e91865b3b3af1db5b7053d7121dcfa97df4f44edc71a8f077d3cbe68`；实施包 `.batch/night/staging/s3-d10-impl-package.md` 102 行 / 12,388B / sha256 `f268ca863c29999cc7609aa3db9b871d2a597153c2f0a45c06e7e09d0fd58983`
认可件：`.batch/night/staging/s3-d10-impl-ack.md`（developer 每卡另出；判词只核「该件存在」与「其内所写包 sha == 本单分母包 sha」，不引其三列读数）
起点/base：**`9cd24897`**（D16 入库后的主线远端头，`git ls-remote origin refs/heads/exp/resource-ledger` 同值）；卡面写的 `5a285e83` 是卡面编写时的旧起点，本单一律以 `9cd24897` 为准
分支：`card/s3-d10-clear-reset`（从 `9cd24897` 起；点名路径 `git add`，禁 `-A`，**并 commit 一次、提交信息写 CARD-S3-D10**；不 push、不动 `develop` 主工作区）。依据：判定面须不可变——工作区读数会被后续动作污染，提交 sha 才钉得住；push 仍只归主身。（11-22 主身裁，此后本行冻结）
排期：D16 已收口入库，本卡为 S3 第四张；**不与 D11 并行**，一次一张、一次一个实例
放行依据：S3 顺序 D4 → D7 → D16 → D10 → D11；admin 11-22 12:3x 令「现在出 D10 派验单」；卡面页首「待主人批准后方可派卡」按该令视为已批——若 admin 认为未批，立即停单

## 判据（逐条要输出原文；缺一条即 FAIL）

**本卡判据分层（主身 11-22 口径，只加标签、判据文字不动）：第 2、3、4、6 条 `[live]`（真实 Electron＋真实 SQLite＋运行时日志）；第 1、5 条 `[static]`（读码清单、单测汇总行）。任一 `[live]` 条须贴 run id 与三项实例读数（`instancesThisRun`／`exitCode`／`leftoverElectronProcesses`）；`[static]` 条不得冒充实机结论；够不到的项写观察项，不改判据文字。**

1. **[static] 残留宿主清单**：三类卡片各自的宿主（文件路径／键名／表名）逐条列出；`generation_runs`／`generation_attempts`／`generation_artifacts`／`generation_roots` 四表须逐表写明，并标明哪张表对应哪类卡片。
   **口径说明（只加说明、判据文字不动）**：卡面判据 1 原文里引的 `git diff --numstat 5a285e83..card/...`，其中的起点**以本单为准＝`9cd24897`**（`5a285e83` 是卡面编写时的旧起点，已过时）；照抄旧值会多出 `5a285e83..9cd24897` 那段差，属假红。
   **行号以本单为准**：`CLEAR_COUNT_TABLES` 声明在 `electron/repositories/project-clear-repository.ts:45`，三档在 `:46-48`（`:46` 正文层／`:47` 架构层／`:48` 创作区）；`:54-58` 是 `emptyCounts()`，不是计数清单。
2. **[live] 实机清空三档各跑一次，清空后卡片数为 0**：贴清空前／后读数原文。**口径收紧（评审裁定 §1）：「卡片数为 0」只认 `generation:list` 三类卡片**；`db:recovery-candidate-list` 未查按记录项处理，既不判 FAIL 也不判 PASS；须贴 run id 与三项实例读数。
   **库口径（admin 11-22 定，硬要求）**：实机清空**必须用专用测试项目**，禁拿作者真实项目库（`.ai-novel/project.db`）当靶子；交件报告须写清项目名、库绝对路径、清空前备份路径与备份文件 sha256。本判据只认**那份库**上的前后读数，别的库读数一律不认。
3. **[live] 可见回执原文含各类条数，且与同一时刻 DB 计数逐类对账一致**：贴界面回执原文＋同一时刻用只读连接查到的逐类计数，两列并排；对不上即 FAIL，不许用「稍后再看」代替。逐类计数须贴**专用测试库**的生成账四表原文（`SELECT COUNT(*)` 于 `generation_runs`／`generation_attempts`／`generation_artifacts`／`generation_roots`），别的库读数不认；`counts.generatedText.rows` 现为 14 张表行数和（实施包 §二 改动 2），对账按此口径。须贴 run id 与三项实例读数。
4. **[live] 订阅方非零**：贴订阅注册处的 `文件:行`（代码面附证）＋清空时该订阅被调用的运行时日志一行；日志须带时间戳与条数，取自本轮 run。须贴 run id 与三项实例读数。
5. **[static] 单测**：重置与回执各一条；`pnpm test <相关路径>` 贴**整文件汇总行**＋末行 `EXIT=`；`pnpm check:fast` 贴末行＋`EXIT=`。
6. **[live] 实例纪律三项**：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）＋`tasklist | grep -c electron` 原文；三档清空须在同一轮一次起停内串跑，记 PID。
   **R4 例外（admin 11-22 定）**：`base..工作头` 里会看到 `scripts/install-git-hooks.mjs`（pre-commit 分支闸门，卡面白名单外）与纯文档提交 `dcddcb08`——两处**一律记观察项、不判 FAIL**；细则见 `.batch/night/staging/s3-d10-r4-observation-main.md`（19 行 / 1,592B / sha256 `2d00e6c66f7d7927a2caff05a7b0d5c93dd9883e0280dc823ff8d3324db82e23`）。

本卡判据分层：第 2、3、4、6 条 live、第 1、5 条 static。

## 交件面与纪律

- 改动面须**全部落在卡面 §3 白名单**（`ClearProjectDataDialog.tsx`、承载清空 IPC 的主进程 handler〔仅加回执发射与日志〕、渲染层 store 重置入口、其单测）＋评审裁定新增的 `electron/repositories/project-clear-repository.ts`〔仅在 `clearGeneratedData` 事务内按 `generation_artifacts → generation_attempts → generation_runs → generation_roots` 追加删除，并把四表补进 `:45` 声明的 `CLEAR_COUNT_TABLES`（三档行 `:46-48`；`:54-58` 的 `emptyCounts()` 不在此列）〕。超出白名单即**停手报**，不自行扩。
- 禁改：`blueprints`／`drafts`／`volumes`／`volume_units`／`volume_handoffs`／`summary_snapshots` 既有删除语句、事务边界、三档语义、`archive/`、`generation:list` 载荷形态、D12 注入与重跑区。
- 不许在面板层隐藏卡片；不许用「强制刷新页面」当修法；不许绕过项目授权闸门。
- 交件报告落 `.batch/night/staging/s3-d10-clear-reset-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。

## 判定纪律

- 只判本单列出的 6 条，不追加卡面外要求；判据分母＝卡面（`7f9ee244596dbd24770ad5890129505562352a1ee4c562aa76a12a760f0ec354`）＋本单，判据文字不许由执行方或首验方改动。
- 外派产物只是证据，不构成 PASS；判不了的部分写明「实机后补证」，不许默认通过。
- 判定面是提交 sha（`9cd24897` ＋分支头），不是工作区；工作区取证须同时贴 `git status --porcelain` 证明代码面干净、等于该 sha。
- 判词落 `.batch/night/reports/s3-d10-qa-firstcheck.md`，直投 `.batch/night/bridge/to-owner`；群里报最终 sha（行数／字节／sha256 整行）与结论。
- 入库后补一行「库内 sha 与盘上一致」。
