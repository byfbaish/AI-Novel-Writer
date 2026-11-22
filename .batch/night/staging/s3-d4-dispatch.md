# 派单 · CARD-S3-D4（批次中止与「来源已变化」文案分层）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
时间：2026-11-22 10:2x
放行依据：**已获主人 10:18 放行**（群管理分身在群内传达原话「就按照负责人说的那个顺序开」）；卡面 `:3` 那句「待主人批准后方可派卡」按群管理分身指令留库内不动，本件即为批准。
顺序：S3 第一张（D4 → D7 → D16 → D10 → D11，逐卡串行，上一张 PASS 且入库后才派下一张）。

## 0. 开工件必读确认（三行，缺一行不许 start；写在交件报告开头）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、卡面、本件。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行（只改卡面 §3 白名单内文件）；实机复验在 `develop` 由 developer 执行、不外派；证据只认命令与输出原文，push 只由主身。

## 1. 钉死的件（developer 读的是这两个 sha）

| 件 | 路径 | sha256 | 行/字节 |
|---|---|---|---|
| 卡面 | `.batch/night/cards/s3-d4-conflict-copy.md` | `5bc84e8b1f1fb4254c4d9044ae8e240fd702b024f3a36fe991a7fc92587e81e3` | 67 行 / 5,079B |
| 派验单 | `.batch/night/review-requests/s3-d4-conflict-copy.md` | 见下方群里贴的整行 | — |

两份都在库内（`785674c5`），起点与 base 一律 **`b4e8da53`**，分支 **`card/s3-d4-conflict-copy`**。开工前先报一次 `git rev-parse --short HEAD` 与 `git rev-parse --abbrev-ref HEAD`，确认从 `b4e8da53` 起。

## 2. 要做的事（与卡面 §2 一致，此处只列执行位）

- 产物层（已有）：这一稿不能保存，仍可复制。
- 批次层（新增）：本批已停止、后续单元不会再执行、需重新发起——**只在批次确实已停止时出现**，判据来自真实批状态，不能只看 `sourceStatus === 'conflict'`。
- 两层文案放同一处共享常量（`src/shared/` 或既有文案模块），由 `sourceStatus` + 批状态组合渲染；不改六个散落文件。

## 3. 白名单与禁改区

- 可改：`src/components/panels/AIOutputPanel.tsx`、承载文案的共享模块（新增或既有）、其单测；`AIOutputPanel` 相关 browser 测试只允许同步断言（只加不减，报告点名改了哪条）。
- 禁改：`src/components/editor/*`、`NarrativeThreadEditor.tsx`、`VersionHistory.tsx`、`ArchFileViewer.tsx`；`sourceStatus` 判定逻辑；D1/D2 状态机与 `GENERATION_SOURCE_CHANGED` 触发点；`chapter-materials.ts`、D12 注入与重跑区；批次真假的判定。

## 4. 判据（四条，缺一条即 FAIL；QA 逐条要输出原文）

1. 界面/日志证据：制造「来源冲突 + 批次中止」，同一屏读到两层文案原文（中/英各一份）；再制造「只有单稿冲突、批次未停」，**只**出现产物层。
2. 单测：整文件汇总行 + 末行 `EXIT=`（`pnpm test <相关路径>`，不许 `-t` 过滤）；两支分支各一条（有中止 / 无中止），断言文案互斥。
3. **改动面相等于白名单**：`git diff --name-only b4e8da53..card/s3-d4-conflict-copy -- src electron scripts` 的每一行都必须落在 §3 白名单内（`src/components/panels/AIOutputPanel.tsx`、承载两层文案的共享模块、其单测、`AIOutputPanel` 相关 browser 测试）；出现白名单外路径即 FAIL，并须逐行贴出 `git diff --numstat` 原文。
4. **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下文件（`git diff --name-status` 中不得有 `A` 行）；白名单内新增的取证脚本须逐条列出路径并标注「白名单内新增」。

辅助（不算通过条件，但要报）：`pnpm check:fast` 末行 + `EXIT=`；实例纪律 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses=0`。

## 5. 外派位

- **静态活可外派**：读码定位「批状态从哪读、两层文案挂哪个组件」、给复现步骤清单；外派产物只作登记，不进判据。
- **不可外派：实机复验须在 `develop` 由 developer 执行**（主人 11-21 19:07；AGENTS 第 8 条）。

## 6. 停手条件

① 若「批次已停止」在现有数据里无法可靠读出（拿不到真实批状态），**停手贴原文报我**，不许用 `sourceStatus` 代替、不许改批次判定、不许把提示改成永远显示。
② 若两层文案无法在同一屏共存（布局/组件结构限制），停手报，不许拆成两处各自显示。
③ 触到禁改区、或需要改 `sourceStatus` 语义才能完成 ⇒ 停手报。

## 7. 交件

- 分支 `card/s3-d4-conflict-copy` 提交（点名路径 `git add`，禁 `-A`）；**不 push**，push 归主身。
- 报告 `.batch/night/staging/s3-d4-conflict-copy-report.md`：全部命令与输出原文、必读确认三行、判据逐条对账、改了哪条既有断言。
- 群里交件 @ 项目总负责人 与 QA；判词由 QA 落 `.batch/night/reports/s3-d4-qa-firstcheck.md` 并投 `.batch/night/bridge/to-owner`。

> 判据 3/4 修订（2026-11-22 10:2x，负责人裁定）：原措辞「`--numstat` 输出为空」只适用于零改码卡（如 D16／D1）；本卡要改 `AIOutputPanel.tsx` 与共享文案模块，故改为「改动面全落白名单 ＋ 无新增生产文件」。判定面仍是提交 sha，不是工作区。
