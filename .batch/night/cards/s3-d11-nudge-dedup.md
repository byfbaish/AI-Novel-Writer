# CARD-S3-D11 · 「补角色卡」提示去重：整卷完成才提示一次（取法裁定）

> **待主人批准后方可派卡**（群管理分身 2026-11-22 依主身令加）

From: 项目总负责人 · AI writer项目组
To: developer · AI writer项目组（执行方）；QA · AI writer项目组（首验方）
版本：v1 · 2026-11-22 · 起点：`exp/mainline-1119` 头 **`b4e8da53`**
顺序：**S3 第五张**（D4 → D7 → D16 → D10 → D11）

## 0. 开工件必读确认（三行，缺一行不许 start）

① 读了哪几份：`README.md`、`AGENTS.md`、`.batch/night/org/ruling-dispatch-v6-1120.md`、本卡。
② 版本或日期：`README.md` `c87cd4ab`（2026-11-14）；`AGENTS.md` `a276fffb`（2026-11-07）；`ruling-dispatch` v6 · 2026-11-20。
③ 三条口径：授权边界最窄执行；实机复验不外派；证据只认命令与输出原文。

## 1. 现状（读于 `b4e8da53`；表行 `:77`、正文 `:720-760`）

- 状态：**🟡 已实施，待实机**（独立复核基本兑现、仅单测；`20:3x` 合并主区 `e0704a07`；**定稿态用 `chain.status` 投影、未直读 `synopsis_incomplete`，取法待裁定**）。
- 提示：`src/services/architecture-character-nudge.ts:43-47`（`toast.zh` / `banner.zh` / `action`）。
- 去重指纹：`:112` `outlineNudgeDraftVersion()` → `c<章级覆盖数>:l<正文长度>`；判定 `:130-137` `shouldNudgeOutlineCharacterSupplement()`（`dismissedVersion !== 当前指纹` 才提示）。
- 机制问题：每一批大纲都会让「覆盖数」与「正文长度」同时变化 ⇒ 指纹必然变 ⇒ 「已处理」立即失效 ⇒ 同一卷连写多批就弹多次。作者心中的「一稿」是整卷写完那份。
- 另：2026-11-09 22:0x 作者裁定「W2 现象来源按现状已达标结项」，指**注入点**问题（不存在按批追加角色集合进正文 prompt 的注入点），与本卡的**提示去重**不是同一件事，本卡只改提示。

## 2. 我的裁定（取法，写死在卡里，执行方不再自选）

- **定稿态取法**：以检查点 `synopsis_incomplete === false`（`partial_arch.json`）作为「整卷大纲完成」的唯一判据，**直读检查点**；不得再用 `chain.status` 投影（投影会把「链状态」当「大纲完成」，语义不等价）。
- **去重粒度**：改为**卷级**——指纹含卷序号（形如 `v<volumeIndex>`）且仅在「该卷 `synopsis_incomplete === false`」时才提示；同一卷无论写多少批，只提示 1 次；进入下一卷且满足条件，再提示 1 次。
- 已 dismiss 记录的兼容：存量 `dismissedVersion`（`c…:l…` 形态）在迁移时视为「已处理过旧形态」并保留，不清空用户已处理状态；新形态与原形态不得互相误判。

## 3. 白名单与禁改区

- 可改：`src/services/architecture-character-nudge.ts`（指纹与判定）、其单测、读取检查点的只读投影（若需新增读取，优先复用既有读取路径）。
- 禁改：提示文案（`:43-47`）、把缺失角色集合注入正文 prompt 的任何路径（作者已裁不注入）、`synopsis_incomplete` 的写入逻辑、D6 常量、D12 注入区。
- 不许把提示改成阻塞或弹窗打断。

## 4. 判据（QA 首验逐条，逐条要输出原文）

1. 同一卷连写 3 批（检查点仍 `incomplete=true` 时）⇒ 提示 0 次；最后一次使 `synopsis_incomplete=false` ⇒ 提示 1 次。
2. 进入下一卷并完成 ⇒ 再提示 1 次（贴两卷的 `volumeIndex` 与提示次数）。
3. 存量 dismiss 记录兼容：迁移前已 dismiss 的记录不被误判成「未处理」（贴迁移前后读数）。
4. 单测：①同卷多批不重复；②跨卷各一次；③存量形态兼容。
5. `pnpm test <相关路径>` 整文件汇总行 + `pnpm check:fast` 末行 + `EXIT=`。
6. 实例纪律三项（实机若走界面）：`instancesThisRun`、`exitCode`、`leftoverElectronProcesses`。

## 5. 外派位

- **静态活可外派**：读码核对「检查点字段读取路径」「存量 dismiss 记录形态」；产物只登记。
- **不可外派：实机复验须在 `develop` 由 developer 执行**。

## 6. 回执与交付

- 分支：`card/s3-d11-nudge-dedup`，从 `b4e8da53` 起；点名路径 `git add`（禁 `-A`）。
- 交件：报告 `.batch/night/staging/s3-d11-nudge-dedup-report.md`；群里交件 @ 项目总负责人 与 QA；回执走 `.batch/night/bridge/to-owner`。

## 7. 实例纪律

单实例复用、跑完必关；evidence 含 `instancesThisRun`、`exitCode`、`leftoverElectronProcesses`。

## 8. R4 判据（作用域写死）

判据二段，缺一不可：

1) `git diff --numstat b4e8da53..card/s3-d11-nudge-dedup -- src electron scripts` 输出为空（无改动、无新增）。
2) **无新增生产文件**：分支上未新增 `src/`、`electron/`、`scripts/` 下的文件；若本卡白名单允许新增（仅验收/取证脚本），须逐条列出路径并在判词中标注「白名单内新增」。

不采信不带 `<base>..<branch>` 作用域的 `git diff --stat`（全树常有他人在办的流转件，D1 那次全树假红即此）。
