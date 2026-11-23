# 外派派单 · AC3/S3 弧层引用闭合（接线卡）

## 0 必读与确认（先回四行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/{copilot,workbuddy,doubao,task-board}-channel.md` 中与本次任务对口的一份；⑤派单正文点名的卡面或设计稿。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：是否「工作模式」（不是「对话模式」）、当前模型名与档位（派单点名要求 `DeepSeek v4.1 Flash`，写成「快速」或其它低档一律算不合格）

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node node_modules/vitest/vitest.mjs run <单文件>`，或派单点名的 `node scripts/run-tests-electron.mjs <单文件>`。
- 只改本卡白名单文件，不新增文件（本卡有明文例外，见 §2），不动 `.batch/*` 任何件；不 push 到 mainline，不 tag，不 `git add -f`，不 `--no-verify`；分支与 push 权限以本派单为准。
- 改删除语义，不扩白名单，不串别的卡；**一卡一会话**，做完即停，不在同一会话里接下一张。
- **必须新开会话**：本次一律开新会话，不得复用任何既有会话（含 `60e73cbf`）；复用旧会话的产出不采信。
- **模式闸**：开局必须是「工作模式」＋派单指定模型（默认 `DeepSeek v4.1 Flash`）。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行是身份头，第四行是 §0 的第四问（模式与模型），缺任一行按可疑件退回：

```
From: AC3-S3-WorkBuddy
To: 大肥鱼@主身
卡号：ed210a27-4a31-4b72-b46d-4f572aaa914c｜会话标识：<新会话首次时间或会话 id>｜起点：57d05871
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

---

## §1 任务一句话

把**已经存在**的 `validateArcCovers` 接进章节预检通路：新增一个纯函数 `findArcCoverRisks`，由它取本章在情节大纲里声明的结构位（`覆盖：` 行）与弧光结构摊平后的结构位清单比对，把违规译成既有的 `ConsistencyFinding`；**不改 `arc-node.ts` 的一行**，不建表，不做语义解析。

## §2 白名单（4 文件：2 新增 2 修改）

**明文例外**（覆盖 §0.1 的「不新增文件」）：本卡必须新增下面 2 个文件，除此之外不得新增任何文件。

| # | 路径 | 动作 |
|---|---|---|
| 1 | `src/shared/arc-cover-consistency.ts` | **新增**，代码逐字照 `/c/tmp/ac3-s3/workbuddy/impl-package.md` §2 |
| 2 | `src/shared/__tests__/arc-cover-consistency.test.ts` | **新增**，用例与变异靶照 §4 |
| 3 | `src/services/consistency-preflight.ts` | **修改**，仅三处：import（§3a）、`db:project-core-get` 多留三位（§3b）、findings 数组加一行（§3c） |
| 4 | 本卡回执文件（见 §7） | 新增，放 `C:\tmp\ac3-s3\workbuddy\receipt-to-owner.md`，**不在仓内** |

**禁改**：`src/shared/arc-node.ts`（零改）、`src/shared/consistency-preflight.ts` 的 `ConsistencyPreflightCoverage`、`ConsistencySourceLayer`、任何面板组件、任何 `.batch/*`。

## §3 口径（四条，逐条照做）

1. **只接线，不新建校验器**。判定逻辑必须来自 `arc-node.ts` 的 `listArcNodes` / `parseChapterArcCovers` / `validateArcCovers`；不许在 `arc-cover-consistency.ts` 里另写一份「结构位是否越界」的判断（`arc-node.ts:230` 明写纯函数只此一份，两处各算一份必漂移）。
2. **fail-open 五连**：章号非正整数 → `[]`；`totalChapters` 非正整数 → `[]`；`listArcNodes` 返回空 → `[]`；大纲里没有本章或 `covers` 为空（含「覆盖：无」）→ `[]`。**任何一条都不许抛异常**。
3. **不写 `sourceLayer`**。面板 `src/components/dialogs/ConsistencyPreflightPanel.tsx:42-43` 是二元硬编码，写了会显示成「本章蓝图」，误导作者去改蓝图。
4. **文案照抄 §2 的 `messageFor`，不许收窄**。`UNKNOWN_NODE` 必须保留「可能拼写错误，或弧光已重排」这句——卡面判据就靠它认。

## §4 变异五发（每发跑一遍，记录转红的用例号）

- **M1**：删掉 `totalChapters` 守卫 → 用例 #7 必须红。
- **M2**：删掉 `chapter.covers.length === 0` 守卫 → 用例 #4 必须红。
- **M3**：`arcCoverStableFactKey` 去掉 `code` 段 → 用例 #1 必须红（键全文断言）。
- **M4**：豁免过滤条件改成 `item.revoked` → 用例 #10 必须红。
- **M5**：删掉 `nodes.length === 0` 守卫 → 用例 #8 必须红。

变完必须**还原**，还原后重跑一遍全绿；回执里写明「变异发数 / 每发转红用例号 / 还原后全绿」。

## §5 自测命令（原样贴回执）

```bash
node scripts/run-tests-electron.mjs \
  src/shared/__tests__/arc-cover-consistency.test.ts \
  src/shared/__tests__/consistency-preflight.test.ts \
  src/shared/__tests__/consistency-preflight-space-time.test.ts
pnpm check:fast
```

接线前后对照（两段原文都要贴）：

```bash
grep -rn "arc-cover-consistency\|findArcCoverRisks" --include=*.ts src | grep -v __tests__
```
接线前应**零输出且 rc=1**；接线后应有 3 行（新增文件定义 1 行 + 服务层 import 1 行 + 调用 1 行）。

## §6 边界（越界即退回）

- 不读、不改 `src/shared/arc-node.ts`（只需 import 它的三个导出）。
- 不实现 INV-2（跨章重复）/ INV-3（漏覆盖）——那是 `summarizeArcCoverFindings` 的活。
- 不扩覆盖度字段、不改面板、不改 `ConsistencySourceLayer`。
- 不建表、不加列、不写迁移脚本。
- 不在两级「卷 / 单元」结构上强行判（它没有 `覆盖：` 行，规则在那种结构上就是 fail-open，用例 #6 已把这条锁住）。

## §7 回执九项（缺项按未交处理）

1. 四行头（§0.2，逐字）
2. 分支名 `card/arch-ac3-s3`、起点 `57d05871`、提交 sha（**只 commit 本分支，不 push**）
3. `git diff --numstat 57d05871` 的 4 行原文（3 仓内文件 + 说明）
4. 单测汇总行原文（`Test Files N passed` + `Tests N passed`）
5. `pnpm check:fast` 末行原文 + 退出码
6. 变异五发的转红用例号 + 还原后全绿原文
7. §5 两段 grep 原文（接线前 rc=1 零输出 / 接线后 3 行）
8. 用到的 `db:project-core-get` 字段读取行号（`src/services/consistency-preflight.ts` 里那三行）
9. 会话标识 + 实际模式 + 实际模型名

## §8 时间盒

25 分钟内交出回执与产物目录；产物目录 `C:\tmp\ac3-s3\workbuddy\` 的 mtime 静默 5 分钟即视为卡住，我会按未交处理并上报。

## §9 成本

当前时段按 `pickModel()` 判定为非高峰可派（DeepSeek V4.1 Flash，5 折）。若命中 09:00–12:00 / 14:00–18:00 高峰窗，不得开工，等窗口。
