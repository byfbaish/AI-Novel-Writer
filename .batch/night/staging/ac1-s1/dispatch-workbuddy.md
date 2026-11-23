# 外派件 · AC1/S1 层内一致性（WorkBuddy）

> 逐字带 `.batch/night/staging/ext-dispatch-header.md` 三段。缺任一段退回重发。
> 卡号 `a7589d74`｜起点 `90c49657bac698fa532af1e8d7b36859478be96f`｜分支 `card/arch-ac1-s1`｜产物落 `C:\tmp\ac1-s1\workbuddy\`。

## 0 必读与确认（先回四行，再开工）

开工前必读（五件，缺一不可）：

1. 仓内 `AGENTS.md`
2. 仓内 `README.md`
3. `docs/agents/worktree-parallel.md`
4. `docs/agents/workbuddy-channel.md`
5. 本件 + `.batch/night/staging/ac1-s1/impl-package.md`（**改法以此为准**）＋ `docs/design/architecture/architecture-consistency-design.md` 的 `:199`–`:203`（裁定段）

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：必须「工作模式」＋ `DeepSeek V4.1 Flash`；写成「快速」或其它低档一律不合格

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`pnpm test <单文件>`（本项目 `pnpm test` 走的才是正确 ABI 运行时，**不要**改用裸 `node` 跑 vitest）。
- 只改本卡白名单文件，不动 `.batch/*` 任何件；不 push 到 mainline，不 tag，不 `git add -f`，不 `--no-verify`。
- 改删除语义，不扩白名单，不串别的卡；**一卡一会话**，做完即停，不在同一会话里接下一张。
- **模式闸**：开局必须是「工作模式」＋派单指定模型。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞。

## 0.2 回执头（缺则判可疑）

```
From: AC1-S1-WorkBuddy
To: 大肥鱼@主身
卡号：a7589d74｜会话标识：<新会话首次时间或会话 id>｜起点：90c49657bac698fa532af1e8d7b36859478be96f
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

---

## 1 任务（一句话）

新增 **1 个纯函数**「角色名册投影状态自洽」，接入既有确定性预检通路；纯函数**只吃 IPC 快照里的 `status`**，`src/shared` 内零哈希重算；补正向＋负向用例，并用**四发变异**证明负向断言非空。

改法、签名、文案、边界守卫全在 `impl-package.md` §2–§4，**照抄即可，不要自己设计**。与本件冲突以本件为准；与 `impl-package.md` 冲突停手回报。

## 2 白名单（3 个文件，逐字照此，多一个即打回）

1. **新增** `src/shared/character-roster-consistency.ts`（内容照 `impl-package.md` §2 逐字）
2. **新增** `src/shared/__tests__/character-roster-consistency.test.ts`（用例表照 §4 十条）
3. **改** `src/services/consistency-preflight.ts`（只加 §3.1 import、§3.2 读快照、§3.3 拼一行，共三处）

> 白名单里两个新文件是本卡对 §0.1「不新增文件」的**明文例外**，只这两条，别的不许新增。

**绝对不动**：`electron/repositories/character-roster-repository.ts`（尤其 `deriveRosterStatus` 不许导出、不许改判据）、`src/shared/character-roster.ts`、`src/shared/consistency-preflight.ts`、`src/components/dialogs/ConsistencyPreflightPanel.tsx`、`src/services/workflows/commands/architecture.command.ts`、`src/shared/ipc-channels.ts`、设计稿与 ADR、`.batch/*`。

## 3 三条口径（写死，改则退回）

1. **只吃 IPC 快照的 `status`**：`ipc.invokeWithProjectSession(session, 'db:character-roster-read', session.projectPath)`，`src/shared` 里**不许**出现 `hashText`／`fullFactHash`／`projection_hash`／`fact_hash` 任何重算（设计稿 `:201`「二选一，禁止两处各判一遍」）。
2. **接入点不变调用链**：`src/services/consistency-preflight.ts` 的 `findings` 数组拼接（现 `:43-62`），新规则在 `:61` 那行之后加一行；`blueprints.map(...)` 内部、`coverage`、`ConsistencyPreflightResult` 形状都不动。
3. **不做「散文 vs 表」对比**：只判 `status === 'inconsistent'` 一种；`empty`／`ready`／`legacy_repair_required` 一律不判（fail-open，不产 info）。`sourceLayer` **不加**。
4. **文案照抄、不许收窄**：`inconsistent` 有四个发射点——`:827`（`empty` 态仍有残留）／`:831`（`legacy_cards_preserved`）／`:835`（`legacy_markdown_pending` 有卡无 markdown）／`:843`（`ready` 三哈希任一不等）。所以 `evidence`／`issue`／`suggestion` 必须用实施包 §2 那一版（同时覆盖「三哈希不符」与「迁移态未收尾」两支），**不许**改写成「只说三哈希不一致」。

## 4 变异靶（四发，逐发跑、逐发贴输出，改完立刻改回）

| 发 | 改法 | 必红的用例 |
|---|---|---|
| M1 | `if (status !== 'inconsistent') return []` → `if (false) return []` | #4 ready／#5 empty／#6 legacy_repair_required |
| M2 | 删 `!Number.isInteger(scope.chapterNumber) \|\| scope.chapterNumber <= 0` 守卫 | #9 章号 0／-1 |
| M3 | 删 `if (!factHash) return []` | #8 缺 factHash |
| M4 | 删 `activeExemptions.has(stableFactKey)` 判断 | #2 豁免生效 |

每发跑完立刻恢复原文件再跑下一发；**交付时工作树里不许留变异体**（`git diff` 只能是你最终要提交的那版）。

## 5 分支与提交

- 开工：`git switch -c card/arch-ac1-s1`（起点 `90c49657`，`git status --porcelain` 必须为空；不空先停手回报）
- 提交：一个 commit，message `feat(preflight): AC1/S1 角色名册投影状态自洽 (card a7589d74)`
- **只 commit，不 push**（push 归主身）。commit 后贴 `git log -1 --oneline` 与 `git status --porcelain`（应为空）
- 预提交钩子会跑 `pnpm check:fast`，钩子里红就是代码问题，**不许** `--no-verify`

## 6 自测与取证（命令原文，结果整段贴回）

```bash
pnpm test src/shared/__tests__/character-roster-consistency.test.ts
pnpm test src/shared/__tests__/consistency-preflight.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts
pnpm check:fast
grep -n "hashText\|fullFactHash\|projection_hash\|fact_hash" src/shared/character-roster-consistency.ts
grep -n "db:character-roster-read" src/services/consistency-preflight.ts
git diff --stat
```

要贴的末行：单测的 `Tests N passed (N)` 汇总行（**不接受** `-t` 过滤跑）、`check:fast` 的 `[check:fast] 全部通过。` 与 `CF_EXIT=0`、第二条 `grep` **零命中**、第三条 `grep` 给出**实际调用行号**（QA 要这一行）、`git diff --stat` 恰好 3 个文件（2 新 1 改）。

## 7 回执要求（缺项按可疑件退回）

1. §0.2 的四行头
2. 起点 sha 与提交后 `git rev-parse HEAD`
3. §6 五条命令的**原文与末行**（含 `Tests N passed (N)`、`CF_EXIT=0`、两条 grep 输出）
4. **四发变异的逐发输出**：每发贴「改法一行＋转红用例名＋`Tests N failed` 汇总行」，并注明已恢复
5. 白名单三行清单（2 新 1 改）＋`git diff --stat`
6. 判据→用例映射：正向 `status==='inconsistent'` 1 条、豁免 1 条；负向 ready／empty／legacy_repair_required／缺快照／缺 factHash／章号 0 各 1 条
7. **`db:character-roster-read` 的实际调用行号**（`src/services/consistency-preflight.ts:N`）与 `findCharacterRosterRisks` 拼接行号
8. 回执正文落 `C:\tmp\ac1-s1\workbuddy\receipt-to-owner.md`
9. 不确定处写「未判」并说明缺什么，不要猜

## 8 时间盒

- 25 分钟无回执 ⇒ 视为卡住，回报卡点（当前在读什么、卡在哪条判据）。
- 完成即停，不在同一会话接下一张。

## 9 成本口径

WorkBuddy 高峰禁派窗为周一至周五 `09:00–12:00`、`14:00–18:00`；本件投出在 22:0x（非高峰，积分 5 折），可派。
