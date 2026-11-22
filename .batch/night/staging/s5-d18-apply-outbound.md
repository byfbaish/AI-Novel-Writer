# S5 · D18 apply 外派件（apply 序第 2 张，串行一次一张）

回执头（必须照写，缺则判可疑）：
```
From: D18-apply · WorkBuddy
To: 大肥鱼@主身
```

## 0 不许做的事（先看这段）

- 必须 `git worktree add <dir> 17794aa9` 新开树再改；**不 commit、不 push、不动 develop 主区**、不 tag、不 `git add -f`、不 `--no-verify`。
- 只改白名单两文件；不新增文件、不动 `electron/`、不加 IPC、**不写库**（`blueprints.notes`／`generation_artifacts`／draft 状态都不许）。
- 不改删除语义、不扩白名单、不串 S5 其它卡（D5 零改、D15 未到）。
- 禁实机 GUI、禁全量测试、禁 `test:browser`／`test:node`。
- 一卡一会话：本件只做 D18 apply，不接别的活。开工先读仓内 `AGENTS.md`、`README.md`、`docs/agents/worktree-parallel.md`。

## 1 需求说明（照此可干，无需回问）

1. `src/shared/hook-payoff-report.ts:43-59`（`summarizeDraftPayoffFindings`）：句首加稳定机读前缀 `[hook-unplanted] `，**只在真有 `C5-unplanted` 时出现**（蹭线-only 不许带，否则判据 4「出现一次」会被蹭线提示冒充）。最小改法：
   - 拆两数组：`const unplanted = messagesOf(findings, 'C5-unplanted', uiText)`、`const graze = messagesOf(findings, 'C5-name-graze', uiText)`；
   - `const marker = unplanted.length > 0 ? '[hook-unplanted] ' : ''`；
   - 正文 `${marker}⚠️ 钩子未落地体检（C5）：${[...unplanted, ...graze].join('；')}。${hint}`；
   - `findings.length === 0` 仍 `return null`，不变。
2. `src/shared/__tests__/hook-payoff-report.test.ts`：新增两条——①未落地命中 ⇒ `text.startsWith('[hook-unplanted] ')`；②蹭线-only ⇒ `not.toContain('[hook-unplanted]')` 且仍含「蹭线」。既有 `:44/66/80/85` 的 `toContain` 断言不得改动。
3. **不动**：`src/services/workflows/commands/finalize-chapter.command.ts:971`（`if (hookReport) callbacks.log(hookReport)` 原样）、`src/shared/suspense-hook-alignment.ts` 及其实例、`blueprint-semantic-contract.ts`、模板 `:1094/1098/1176/1180`。

## 2 验收标准

- 单测只认整文件汇总行＋末行 `EXIT=`：`pnpm test src/shared/__tests__/hook-payoff-report.test.ts`，贴原文，末行须 `EXIT=0`。
- 产物（三者都要）：
  1. `git diff > C:\tmp\s5-outbound\D18-apply\d18.patch`；
  2. `git status --porcelain` 行数（贴原文，白名单外应为 0）；
  3. `git rev-parse HEAD` 须为 `17794aa9` 起点的树头。
- `wc -lc` 两文件改动前后对照。

## 3 卡面判据对照

| 卡面判据 | 本卡能判否 | 证据来源 |
|---|---|---|
| 判据 3 `[static]` 第 6 章两向 | 能判 | 新增两条断言原文 |
| 判据 3「第 5／7 章不误标」 | **不判**（仓内零样本，已裁定记账，非本卡漏项） | — |
| 判据 4「定稿链路标记出现一次」`[live]` | 不能判（群内那一次实机） | apply 只保证前缀存在且只在未落地时出现 |
| 判据 2 B 环节 | 不判（守裁定 ⑩，生产不接线） | — |

## 4 回执地址与篇幅

投 `.batch\night\bridge\to-owner`，首两行按文头 From/To 原样写。回执正文 ≤300 字：结论一行＋`EXIT=` 一行＋patch 路径一行＋`HEAD` 一行。长内容落 `C:\tmp\s5-outbound\D18-apply\report.md`，群里只贴路径。
