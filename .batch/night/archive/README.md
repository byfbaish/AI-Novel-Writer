# `.batch/night/archive/` 说明（README）

## 一、目录用途与保留期限

- **谁建**：developer · AI writer项目组（群分身）。2026-11-18 首次建立（CARD-1118-B）；2026-11-19 CARD-1118-D 追加收编清单；2026-11-19 `78d56ea0` 整体入库（stage 1）；本版由 stage 2 按 `git ls-tree` 逐件补齐登记。
- **何时**：收编动作为 2026-11-19（`78d56ea0`）。每件的「何时」取该件自身可核的时间证据：件内 `生成时刻`／`版本：`／`时间：`／`采集时间`／`deliveredAt` → 文件名或所在子目录的日期段（`1107`／`1113`／`resume-1114`／`1116`／`1117`／`20261119` 等）→ 均取不到写 `待补` 并列入 §四。
- **用途**：收纳不再作为现行判定输入、但需留档备查的历史件——`.vN` 历史版本（与主件字节不同或已无主件）、历史名册、历史派验单与卡面、阶段性报告、通道信号与回执、bridge 信件。分类语义按原目录：`roster/`=身份名册历史版、`cards/`=卡面历史版、`review-requests/`=派验单历史版、`org/`=组织/台账件、`staging/`=待决件历史版、`1107/`・`resume-1114/`・`*-1113/`=按日期分段的通道件。
- **保留期限**：长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e。一律「只移不删、不改名」，拒绝就地删除或改字节。
- **过期归属**：由项目总负责人裁定删除或转存；无法联系时按群规留信（to-owner）后原地不动。
- **是否清洗版**：是。97 件全部来自提交 `78d56ea0` 的脱敏入库版；其中 **96 件**字节与 `MANIFEST.sha256` 逐件一致。**`README.md` 自身是登记表本体**，随补登记更新（stage 2 起），`MANIFEST.sha256` 中该条对应入库版（`78d56ea0`）字节，属已登记例外——回写 `MANIFEST.sha256` 须另出卡，不在登记卡内改。原件不随库外发。
- **计数口径**：本表一行一件，共 **97** 条 ＝ `git ls-tree -r --name-only HEAD -- .batch/night/archive` 的 98 项减去 `MANIFEST.sha256`，含 `README.md` 自身一条。目录分布：roster 22／staging 22／1107 15／review-requests 13／org 8／cards 6／resume-1114 6／（根级） 3／p9-prefix-restart-1113 1／pre-restart-1113 1。

## 二、登记清单（97 条）

| # | 归档路径（相对 `.batch/night/archive/`） | 谁建 | 何时 | 用途 | 保留期限 | 是否清洗版 |
|---|---|---|---|---|---|---|
| 1 | `1107/bridge-to-group/bug-duplicate-delivery-0654.md` | 大肥鱼（大管家窗口侧；据件内 :3「主人让直接报给你们」与落盘目录 `bridge-to-group`；原件无署名） | 2026-11-07 | 缺陷报告：桥接重复投递已读文件 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 2 | `1107/bridge-to-group/decision-p6-0612.md` | 大肥鱼（窗口侧转述主人裁定的那一方；据标题「主人原话（未转述）」；原件无署名） | 2026-11-07 | 主人裁定：P6 两点 + npm 令牌 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 3 | `1107/bridge-to-group/reverse-test-0558.md` | 大肥鱼 私聊窗口侧（据 :1–:2「私聊窗口反向测试」） | 2026-11-07 | 私聊窗口反向测试 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 4 | `1107/bridge-to-owner/ask-npm-token.md` | 大肥鱼 群窗口（据 :3「通过桥接发来的问询，来自项目群窗口」） | 2026-11-07 | 待主人操作：npm 发布需要访问令牌 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 5 | `1107/bridge-to-owner/ask-p6-addressing.md` | 大肥鱼 群窗口（据 :3「来自『我』在项目群里的另一个窗口」） | 2026-11-07 | 待主人裁定：插件寻址方案 P6 两点 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 6 | `1107/bridge-to-owner/bridge-handoff-reverse-test.md` | 大肥鱼 群窗口（据 :3「这是群窗口的……发给你的」） | 2026-11-07 | 交接：你有一个「向项目群窗口喊话」的通道（含一次反向测试） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 7 | `1107/bridge-to-owner/how-to-deliver-npm-token.md` | 大肥鱼 群窗口（据 :3「群窗口补发」） | 2026-11-07 | 补一条：npm 令牌怎么交 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 8 | `1107/bridge-to-owner/where-the-files-are.md` | 大肥鱼 群窗口（据 :3「群窗口的……发」） | 2026-11-07 | 你读不到内容的原因：通知里只有文件名，没有路径 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 9 | `1107/signals-doubao/dedupe-persist.done` | 豆包（推定：`cards/dedupe-persist.md:50` 要求落本路径；原件三行无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/dedupe-persist.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 10 | `1107/signals-doubao/docs-merge.done` | 豆包（推定：`cards/docs-merge.md:53` 要求落本路径；原件三行无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/docs-merge.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 11 | `1107/signals-doubao/npm-fields.done` | 豆包（推定：`cards/npm-fields-finish.md:18` 要求落本路径；原件三行无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/npm-fields.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 12 | `1107/signals-doubao/readme-032.done` | 豆包（推定：`cards/readme-032.md:30` 要求落本路径；原件三行无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/readme-032.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 13 | `1107/signals-doubao/story-rewrite.done` | 豆包（推定：`cards/story-rewrite.md:48` 要求落本路径；原件三行无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/story-rewrite.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 14 | `1107/signals-doubao/why-relay.done` | 豆包（推定：`cards/why-relay.md:33` 要求落本路径；原件两行无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/why-relay.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 15 | `1107/signals-workbuddy/p6-addressing.done` | WorkBuddy（推定：`cards/p6-addressing.md:47` 要求落本路径，经 workbuddy联络人 投递；原件无署名） | 2026-11-07 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/p6-addressing.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 16 | `P9.json` | 豆包联络人（件内 `"submitter": "豆包联络人"`） | 2026-11-13 | "card": "P9", | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 17 | `README.md` | developer · AI writer项目组（群分身） | 2026-11-18 | `.batch/night/archive/` 目录说明与收编登记表（本文件） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（入库版）；本体随补登记更新，`MANIFEST.sha256` 记入库时字节 |
| 18 | `cards/p31-dedupe-persist.v2.md` | QA 执笔、项目总负责人裁定（件内 :3 reissue 说明） | 2026-11-15（件内 :3「reissue 说明（11-15 10:3x…）」） | P31 · 投递层物理去重（拦在唤醒模型之前）· v2 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 19 | `cards/p51-median-gap.v2.md` | 豆包 | 待补 | P51 · 动作数中位数改「连续 10 章」口径（A 类改码卡）· v2 重投版 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 20 | `cards/p51-median-gap.v3.md` | 豆包 | 2026-11-15（件内 :46「v3 回写（2026-11-15 11:23…）」） | P51 v3 派验单/卡面（含 §9 v3 回写 2026-11-15 11:23）| 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 21 | `cards/p54-fix3-to8.v2.md` | 豆包 | 2026-11-15 | To 行身份段修复（D-TO8 ＋ To 标题段为空） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 22 | `cards/p54-fix3-to8.v3.md` | 豆包 | 2026-11-15 | To 行身份段修复（D-TO8 ＋ To 标题段为空） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 23 | `cards/p54-fromto-inject.v1.md` | AI writer总负责人 · AI writer项目组 | 2026-11-15 | P54-fix1 · relay 注入头强制写 From/To 身份（A 类改码卡） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 24 | `org/ledger-append-1117-hy4flash-auth.v1.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 台账一笔：Hy4 flash 白名单改动＝已授权 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 25 | `org/ledger-append-1117-hy4flash-auth.v2.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 台账一笔：Hy4 flash 白名单改动＝已授权 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 26 | `org/ledger-append-1117-hy4flash-auth.v3.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 台账一笔：Hy4 flash 白名单改动＝已授权 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 27 | `org/ledger-append-1117-hy4flash-auth.v4.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 状态：现行 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 28 | `org/ledger-append-1117-hy4flash-auth.v5.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 状态：现行 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 29 | `org/ledger-append-1117-hy4flash-auth.v6.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 状态：现行 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 30 | `org/ledger-append-1117-hy4flash-auth.v7.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 状态：现行 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 31 | `org/ledger-append-1117-hy4flash-auth.v8.md` | 大肥鱼主身，01:11 落盘 | 2026-11-17 | 状态：现行 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 32 | `p9-prefix-restart-1113/p9-failed-take.done` | 豆包（推定：`P9.json` 的 `signal` 字段指向本件，`cards/p9-failed-take.md:36` 要求落 `signals/doubao/`；原件无署名） | 2026-11-13 | 完成信号（报告路径：C:\develop\workspace\），指向 `reports/p9-failed-take.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 33 | `pre-restart-1113/doubao/p8-take.done` | 豆包（推定：落盘目录 `pre-restart-1113/doubao/`；产物 `reports/p8-take-and-cleanup.md` 无件内署名） | 2026-11-13 | 完成信号（产物路径：C:\develop\workspace\），指向 `reports/p8-take-and-cleanup.md` | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 34 | `resume-1114/bridge-to-owner/2026-11-14-0125-plugin-pitfalls-guide.md` | 大肥鱼 大管家窗口（件内 :24 自称外挂记忆 `MEMORY-EXT.md`、通篇以「主人，您…」口吻；无落款署名） | 2026-11-14 | 避坑指南已落地（17 条） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 35 | `resume-1114/bridge-to-owner/2026-11-14-0205-card-visible.md` | 大肥鱼 大管家窗口（同批 to-owner 信件，通篇「主人，您…」；无落款署名） | 2026-11-14 | 卡出来了：方案 A 三条判据全过 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 36 | `resume-1114/bridge-to-owner/2026-11-14-0207-release-notes-ready.md` | 大肥鱼 大管家窗口（同批 to-owner 信件，通篇「主人，您…」；无落款署名） | 2026-11-14 | 主人在上一条问询（2026-11-14-0205-card-visible.md）之外补一句： | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 37 | `resume-1114/signals-doubao/p13-settings-inject-crash.done` | 豆包（推定：落盘目录 `resume-1114/signals-doubao/`；原件无署名） | 2026-11-14 | 完成信号：完成：P13 修复（ctx.settings→getService+try/catch、调用点 .catch） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 38 | `resume-1114/signals-doubao/p14-settings-inject-mount.done` | 豆包（推定：落盘目录 `resume-1114/signals-doubao/`；原件无署名） | 2026-11-14 | 完成信号：完成：P14 挂卡改 ctx.inject(['settings'], cb) 就绪挂载 + schemast | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 39 | `resume-1114/wakeup-inbox/dsh-wake-20261114-0205-7426.md` | 待补 | 2026-11-14 | 检查点（11-14 02:05）：P11（23:33 派豆包，估 120-150 分钟）应已落盘。核 .batch/ni | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 40 | `review-requests/CARD-1118-B-fork-close.v2.md` | developer · AI writer项目组 | 2026-11-18 | CARD-1118-B 派验单 v2 · 分叉收口（A 方案）＋未跟踪件归位 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 41 | `review-requests/CARD-1118-B-fork-close.v3.md` | developer · AI writer项目组 | 2026-11-18 | CARD-1118-B 派验单 v3 · 分叉收口（A 方案）＋未跟踪件归位 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 42 | `review-requests/CARD-1118-B-fork-close.v4.md` | developer · AI writer项目组 | 2026-11-18 | CARD-1118-B 派验单 v4 · 分叉收口（A 方案）＋未跟踪件归位 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 43 | `review-requests/CARD-1118-C-placeholder-close.v2.md` | developer · AI writer项目组 | 2026-11-18 | CARD-1118-C 派验单 v2 · 协作件入索引收口（pii-scan 闸门） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 44 | `review-requests/CARD-1118-C-placeholder-close.v3.md` | developer · AI writer项目组 | 2026-11-18 | CARD-1118-C 派验单 v2 · 协作件入索引收口（pii-scan 闸门） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 45 | `review-requests/d1-delivered-path.v2.md` | WorkBuddy（2026-11-16 18:00 后派；周一 14:00–18:00 禁派窗内不投） | 2026-11-16 | 派验单 · D-1（注入正文指向 delivered 落点） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 46 | `review-requests/d1-delivered-path.v3.md` | WorkBuddy（2026-11-16 18:00 后派；周一 14:00–18:00 禁派窗内不投） | 2026-11-16 | 派验单 · D-1（注入正文指向 delivered 落点） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 47 | `review-requests/p54-fix3-to8.v2.md` | 豆包 | 2026-11-15 | p54-fix3-to8 派验单（To 行身份段：剥 session- ＋ 空标题占位） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 48 | `review-requests/p56.v2.md` | 项目总负责人 · AI writer项目组 | 待补 | 派验单 p56 · workbuddy 文档陈旧判据与 Hy4 残档清理 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 49 | `review-requests/p56.v3.md` | 项目总负责人 · AI writer项目组 | 待补 | 派验单 p56 · workbuddy 文档陈旧判据与 Hy4 残档清理 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 50 | `review-requests/p56.v4.md` | 项目总负责人 · AI writer项目组 | 待补 | 派验单 p56 · workbuddy 文档陈旧判据与 Hy4 残档清理 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 51 | `review-requests/p56.v5.md` | 项目总负责人 · AI writer项目组 | 待补 | 派验单 p56 · workbuddy 文档陈旧判据与 Hy4 残档清理 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 52 | `review-requests/reboot-hy4flash-sync.v2.md` | 项目总负责人 · AI writer项目组 | 待补 | 状态：待首验（等 developer 报告落盘后开工） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 53 | `roster/identity-roster.v2.md` | 大肥鱼（项目管家） | 2026-11-15 | Bot 身份名册（v2） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 54 | `roster/identity-roster.v3.1.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 55 | `roster/identity-roster.v3.10.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 56 | `roster/identity-roster.v3.11.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 57 | `roster/identity-roster.v3.12.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 58 | `roster/identity-roster.v3.13.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 59 | `roster/identity-roster.v3.14.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 60 | `roster/identity-roster.v3.15.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 61 | `roster/identity-roster.v3.16.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 62 | `roster/identity-roster.v3.17.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 63 | `roster/identity-roster.v3.18.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 64 | `roster/identity-roster.v3.19.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 65 | `roster/identity-roster.v3.2.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 66 | `roster/identity-roster.v3.20.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 67 | `roster/identity-roster.v3.3.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 68 | `roster/identity-roster.v3.4.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 69 | `roster/identity-roster.v3.5.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 70 | `roster/identity-roster.v3.6.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 71 | `roster/identity-roster.v3.7.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 72 | `roster/identity-roster.v3.8.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 73 | `roster/identity-roster.v3.9.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 74 | `roster/identity-roster.v3.md` | 大肥鱼（项目管家） | 2026-11-16 | Bot 身份名册（v3） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 75 | `staging/d1-delivered-path-report.v2.md` | WorkBuddy | 待补 | D-1 执行方报告：注入正文指向 delivered 落点 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 76 | `staging/d1-precheck-1117.v2.md` | ／取数件三元组（index.js 74243B / 58025002…）／model= | 2026-11-16 | D-1 派卡前置核对单（d1-delivered-path） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 77 | `staging/d1-precheck-1117.v3.md` | ／取数件三元组（index.js 74243B / 58025002…）／model= | 2026-11-16 | D-1 派卡前置核对单（d1-delivered-path） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 78 | `staging/d1-precheck-1117.v4.md` | ／取数件三元组（index.js 74243B / 58025002…）／model= | 2026-11-16 | D-1 派卡前置核对单（d1-delivered-path） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 79 | `staging/doubao-liaison-handoff.v2.md` | 豆包联络人 · AI writer项目组 | 2026-11-16 | 执行方：豆包联络人 · AI writer项目组 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 80 | `staging/doubao-liaison-handoff.v3.md` | 豆包联络人 · AI writer项目组 | 2026-11-16 | 执行方：豆包联络人 · AI writer项目组 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 81 | `staging/incident-plugin-push-1116.v2.md` | developer · AI writer项目组（906d802a） | 2026-11-16 | 插件仓 e6362a8 无人认领推送 · 取证 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 82 | `staging/no-at-count.v2.mjs` | 大肥鱼（维护人） | 2026-11-16 | // no-at-count.v2.mjs — 无@率唯一出处（大肥鱼维护，2026-11-16） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 83 | `staging/no-at-count.v3.mjs` | 大肥鱼（维护人） | 2026-11-16 | // no-at-count.v3.mjs — 无@率唯一出处（大肥鱼维护，2026-11-16 20:45） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 84 | `staging/owner-config-fix-1116.v2.md` | 项目总负责人 · AI writer项目组（件内 :3「拟定：」） | 2026-11-16 | 待主人执行的配置修正清单（relay watch 绑定） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 85 | `staging/owner-config-fix-1116.v3.md` | 项目总负责人 · AI writer项目组（件内 :3「拟定：」） | 2026-11-16 | 待主人执行的配置修正清单（relay watch 绑定）· v3 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 86 | `staging/owner-config-fix-1116.v4.md` | 项目总负责人 | 2026-11-16 | cordis.patch.yml relay 绑定修复 · v4（现状版） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 87 | `staging/owner-config-fix-1116.v5.md` | 项目总负责人 | 2026-11-16 | cordis.patch.yml relay 绑定 · v5（现状版，回滚路径已改正） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 88 | `staging/p54-realmachine-1115.v2.md` | developer | 2026-11-15 | P54 真机验取证（40f34b5 · 隔离副本） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 89 | `staging/p56-report.v2.md` | WorkBuddy | 2026-11-16 | p56 回执 · workbuddy 文档陈旧判据与 Hy4 残档清理 | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 90 | `staging/rules-example-acceptance.v2.md` | QA。 | 2026-11-16 | 验收口径：rules.example.md + README 迁移节（卡 1，执行方＝WorkBuddy） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 91 | `staging/rules-example-acceptance.v3.md` | QA。 | 2026-11-16 | 验收口径：rules.example.md + README 迁移节（卡 1，执行方＝WorkBuddy） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 92 | `staging/rules-review-docs-1116.v2.md` | 产品经理 · AI writer项目组（件内 :4「审阅人：」） | 2026-11-16 | rules-review-docs-1116（文档视角：与台账 / 名册 / notice 的冲突、缺口、不可执行） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 93 | `staging/to-owner-watch-diagnosis-1116.v2.md` | 大肥鱼 · AI writer项目组（件内 :3「采集人」） | 2026-11-16 | 六条 watch × 目标会话 对照表（定性用，不含修改） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 94 | `staging/wt2-merge-backout-plan-1116.v2.md` | developer · AI writer项目组 | 2026-11-16 | wt-2 → exp/resource-ledger 收口方案（v2 · 只计划，不动分支） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 95 | `staging/wt2-merge-backout-plan-1116.v3.md` | developer · AI writer项目组 | 2026-11-16 | wt-2 → exp/resource-ledger 收口方案（v3 · 含合并执行记录与三债现状） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 96 | `staging/wt2-merge-backout-plan-1116.v4.md` | developer · AI writer项目组 | 2026-11-16 | wt-2 → exp/resource-ledger 收口方案（v3 · 含合并执行记录与三债现状） | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |
| 97 | `wake-later.json` | 豆包联络人（件内 `"submitter": "豆包联络人"`） | 2026-11-13 | "card": "wake-later", | 长期（项目生命周期内）；过期处置见 `.batch/night/org/BACKLOG.md` B-1e | 是（与 `MANIFEST.sha256` 一致） |

## 三、stage 2 未跟踪件清场记录（2026-11-19/20）

按 `.batch/night/org/stage2-disposition-1119.md` §三分四组处置，禁 `git clean`／`git stash`：

- **G1 入库**：卡面／派验单／裁定／报告／规范件 27 件（含 `org/stage2-disposition-1119.md`、`reports/GOAL2-untracked-inventory-qa.md` 两件在负责人计数之后新增的件）。
- **G2 归位后入库**：无主件历史 `.vN` 37 件 → `.batch/night/staging/vn-history-1119/`（`staging/` 对 `versioned-filename` 豁免，故 `--all` 仍 0 项）；原相对结构保留）。
- **G3 移出工作区**：SQLite 运行态 5 件（`project.db`／`-wal`／`-shm`）→ `C:/tmp/pmo-stage2-quarantine/`，不入库。
- **G4 移出工作区**：`delivered/62e69db07b3/2026-11-18-2000-report.md`（relay 投递留痕 1 件）→ 同处留本机。
- **G5 移出工作区待认领**：`scripts/workbuddy/space-readonly-check.mjs` 1 件（BACKLOG B-8）。

## 四、`待补` 清单（8 条 · 2026-11-20 复核）

取数不到即写 `待补`、不写「未知」，也不作推断性描述；每条列出缺哪个字段与复核过程，交下一张补登记卡追平（BACKLOG「archive 待补字段清理」）。

本轮（stage 2 补字段）已把 38 条压到 8 条：`1107/` 15 件的写入方从件内括注（「群窗口的……发」「群窗口补发」「私聊窗口反向测试」「主人让直接报给你们」）与信号落盘约定（`cards/<同名>.md` 指定 `signals/<doubao|workbuddy>/`）取得；`P9.json`／`wake-later.json` 取件内 `"submitter"` 字段。

1. `cards/p51-median-gap.v2.md` —— 缺：何时；缺：何时；补法：原件无日期，`p51-qa-firstcheck.md:6` 只记「投出 07:52:10」不含日期。同族 v3 件内记 v3 回写 2026-11-15 11:23，可作上限参考但仍需台账逐版记时
2. `resume-1114/wakeup-inbox/dsh-wake-20261114-0205-7426.md` —— 缺：谁建；缺：谁建；补法：唤醒检查点便条，件内只有对 P11 的核对要求（无署名、无声称）。已查 `.batch/night/reports/` 与该批 to-owner 信件，均无写入方署名
3. `review-requests/p56.v2.md` —— 缺：何时；缺：何时；补法：派验单原件无日期；`task-ledger.md:187`（2026-11-16 08:31–08:45 段）提到 p56 但未逐版记时
4. `review-requests/p56.v3.md` —— 缺：何时；缺：何时；补法：同上（p56 系列派验单原件均无日期）
5. `review-requests/p56.v4.md` —— 缺：何时；缺：何时；补法：同上（p56 系列派验单原件均无日期）
6. `review-requests/p56.v5.md` —— 缺：何时；缺：何时；补法：同上（p56 系列派验单原件均无日期）
7. `review-requests/reboot-hy4flash-sync.v2.md` —— 缺：何时；缺：何时；补法：原件无日期；同族时间只能由 `CARD-1117` 系列卡推定，不写推断值
8. `staging/d1-delivered-path-report.v2.md` —— 缺：何时；缺：何时；补法：执行方报告原件无日期（v5 投出版记 11-16 16:03:18），v2 无对时应证

## 五、变更记录

- 2026-11-18：首次建立（CARD-1118-B，2 件同字节重复件）。
- 2026-11-19：CARD-1118-D 收编 47 件历史版本（乙类）；丙类 34 件原地保留不入本目录。
- 2026-11-19：`78d56ea0` 全目录 97 件入库（stage 1），生成 `MANIFEST.sha256`（97 条，自身不入表）。
- 2026-11-19/20：stage 2 按 `ls-tree` 逐件补登记至 97 条（五字段），并记录 G1–G5 清场。
