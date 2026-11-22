# CARD-S3-D10 · 清空生成内容：渲染层重置 + 清理回执

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`5a285e83`**
顺序：**S3 第四张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行（只做清空入口的重置与回执，不改历史面板本身）；实机复验不外派；证据只认命令与输出原文。

## 1. 现状（读于 `5a285e83`；表行 `:76`、正文 `:694-714`）

- 状态：**🟡 已实施，待实机**（机制级兑现、仅单测；`20:3x` 已合并主区 `e0704a07`；**回执事件生产订阅方为零、残留宿主未定位 ⇒ 现象未闭环**）。
- 现象：清空后 DB 侧计数为 0（`blueprints`/`drafts`/`volumes`/`volume_units`/`volume_handoffs` 全 0），界面仍显示「第1章审稿候选」「第1章生成记录」「确认继续已选正文」等卡片与孤立「复制」「编辑恢复稿」按钮。
- 清空语义：`src/components/dialogs/ClearProjectDataDialog.tsx:35/43/51`（三档：故事架构、章节规划、正文与审稿）。
- 缺口（2026-11-22 外派复核更正）：①渲染层重置钩子**已存在**（`src/services/project-clear-service.ts:171-199`：关 Tab、`useDraftStore.reset()`、`clearAllArchProgress`、`notifySynopsisCandidateDiscarded`、重载角色卡、刷新文件树）；②`PROJECT_DATA_CLEARED` 已于 2026-11-09 移除（`project-clear-service.ts:164-167`，原文「生产订阅方为零…现已移除发射与事件类型」），现存订阅为 `system-notice-toast.ts:33` 的通用 `SYSTEM_NOTICE`；③**残留宿主＝`generation_runs`＋`generation_attempts`＋`generation_artifacts`**（`AIOutputPanel.tsx:320-344,356-359,423,476,504`；`main-generation-owner.ts:332-336`），不含 localStorage 键。

## 2. 要做什么

1. **残留宿主清单**：外派已给出（三类卡片同源＝上条③三表）；apply 时按同一路径复核一遍，逐条列宿主。
2. **接上重置**：清空完成后由渲染进程侧重置对应 store/localStorage 键，使界面与 DB 口径一致；能清则清，清不掉（第三方缓存/无法定位）**照实登记**，不许用「强制刷新页面」当修法。
- **修法（负责人 11-22 裁 A）**：扩白名单到 `electron/repositories/project-clear-repository.ts`，在 `clearGeneratedData` 事务内按 `generation_artifacts → generation_attempts → generation_runs → generation_roots` 追加删除，并把四表补进 `:46` 计数清单。禁在面板层隐藏卡片、禁改既有删除语句与三档语义。
3. **接上回执**：让既有回执事件有真实订阅方，清空完成后给出「清了哪几类、各多少条」的可见回执（数字须与 DB 计数可对账）。
4. 不改历史面板自身的渲染逻辑；不改三档语义。

## 3. 白名单与禁改区

- 可改：`ClearProjectDataDialog.tsx`、承载清空 IPC 的主进程 handler（仅加回执发射与日志，不改删除语义）、渲染层 store 的重置入口、其单测。
- 禁改：`blueprints`/`drafts`/`volumes` 等表的删除语句、`archive/`、`generation:list` 载荷形态、D12 注入与重跑区。
- 不许为了「看起来干净」而在面板层隐藏卡片（须真重置）；不许绕过项目授权闸门。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. 残留宿主清单：三类卡片各自的宿主（文件路径/键名/表名）逐条列出。
2. 实机：清空三档各跑一次，清空后界面卡片数为 0（贴清空前/后读数）。
3. 回执：可见回执原文含各类条数，且与同一时刻 DB 计数逐类对账一致。
4. 订阅方非零：贴订阅注册处的文件:行与运行时日志一行。
5. 单测：重置与回执各一条；`pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`。
6. 实例纪律三项：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`（须 0）。

## 5. 外派位

- **静态活可外派**：读码列「残留可能宿主清单」与「回执事件订阅链」，产物只登记、不进判据。
- **不可外派：实机复验须在 `develop` 由 developer 执行。**

## 6. 回执与交付

- 分支：`card/s3-d10-clear-reset`，从 `5a285e83` 起；点名路径 `git add`（禁 `-A`）。
- 交件：报告 `.batch/night/staging/s3-d10-clear-reset-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。
- 停手：若残留无法在不动第三方实现的前提下清零，停手报清单与已排除路径，不许改判据。

## 7. 实例纪律

单实例复用、跑完必关；evidence 含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`。

## 8. R4 判据（作用域写死）

判据二段，缺一不可：

1) `git diff --numstat 5a285e83..card/s3-d10-clear-reset -- src electron scripts` 输出为空（无改动、无新增）。
2) **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下的文件；若本卡白名单允许新增（仅验收/取证脚本），须逐条列出路径并在判词中标注「白名单内新增」。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。

## 9. 修订留痕（项目总负责人 · 11-22，只加口径说明，§4 判据文字与 §8 写法不动）

1. **起点改钉 `9cd24897`**（admin 11-22 定，D16 入库后的主线头）：本卡 §1 行内、页首版本行、§5「分支为…，从 `5a285e83` 起」、§8 判据 1) 里的 `5a285e83` **一律按本行替换为 `9cd24897`**。照抄 `5a285e83` 会多出 `5a285e83..9cd24897` 那段差，属假红。
2. **§3 白名单补两件**（原 §1「修法（负责人 11-22 裁 A）」已写，但 §3 漏列，此处补齐）：
   - `electron/repositories/project-clear-repository.ts` —— 仅限 `clearGeneratedData` 事务内按 `generation_artifacts → generation_attempts → generation_runs → generation_roots` 追加删除，并把四表补进计数清单；禁改既有删除语句、事务边界、三档语义；
   - `electron/repositories/__tests__/project-clear-receipt.test.ts` —— 本卡单测。
3. **行号以实测为准**：`CLEAR_COUNT_TABLES` 声明在 `electron/repositories/project-clear-repository.ts:45`，三档在 `:46-48`；`:54-58` 是 `emptyCounts()`，不是计数清单。
4. **R4 观察项（admin 11-22 定，不判 FAIL）**：`base..工作头` 会看到 `dcddcb08`（纯文档两件）与 `27d70e07`（`scripts/install-git-hooks.mjs` +18，pre-commit 分支闸门）——两处记观察项，不判 FAIL。
   三条细节（闸门只在本机 `.git/hooks/` 生效、不入库；作用域仍是 `9cd24897..工作头`）详见 `.batch/night/staging/s3-d10-r4-observation-main.md`（19 行 / 1,592B / sha256 `2d00e6c66f7d7927a2caff05a7b0d5c93dd9883e0280dc823ff8d3324db82e23`），本行只作指针、不抄正文。
