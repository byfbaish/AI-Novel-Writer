# 外派件 · FACT 扩大 preflight 规则集（WorkBuddy）

> 逐字带 `.batch/night/staging/ext-dispatch-header.md` 三段。缺任一段退回重发。

## 0 必读与确认（先回四行，再开工）

开工前必读（五件，缺一不可）：

1. 仓内 `AGENTS.md`
2. 仓内 `README.md`
3. `docs/agents/worktree-parallel.md`
4. `docs/agents/workbuddy-channel.md`
5. 本件 + 同目录三份：`.batch/night/staging/fact-s2/impl-package.md`（**改法以此为准**）、`candidates-and-rejects.md`（取舍依据）、`judgement-and-evidence.md`（验收判据）

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：必须「工作模式」＋ `DeepSeek v4.1 Flash`；写成「快速」或其它低档一律不合格

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`pnpm test <单文件>`（本项目 `pnpm test` 走的才是正确 ABI 运行时，**不要**改用裸 `node` 跑 vitest）。
- 只改本卡白名单文件，**不新增文件**，不动 `.batch/*` 任何件；不 push 到 mainline，不 tag，不 `git add -f`，不 `--no-verify`。
- 改删除语义，不扩白名单，不串别的卡；**一卡一会话**，做完即停，不在同一会话里接下一张。
- **模式闸**：开局必须是「工作模式」＋派单指定模型。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞。

## 0.2 回执头（缺则判可疑）

```
From: FACT-preflight-3rules-WorkBuddy
To: 大肥鱼@主身
卡号：bb3f0d83-3f24-43a9-977d-8ef6b4e8eb9b｜会话标识：<新会话首次时间或会话 id>｜起点：7bffc1ee7cd1d13db02466bcfdbe12bd73625490
模式：<工作模式|对话模式>｜模型：<模型名与档位>
```

---

## 1 任务（一句话）

在既有确定性预检通路里**新增 3 条规则**（`attacks.space` 未登记 / `attacks.hour` 越窗 / 同一格被两章作废），纯函数、零语义解析、缺字段 fail-open、独立 `slot:` 前缀；**不新增流程、不改面板、不改提示词、不新增文件**。

改法、文案、函数签名、边界守卫全部写在 `impl-package.md` §2，**照抄即可，不需要你自己设计**。与 `impl-package.md` 冲突时以 `impl-package.md` 为准；与卡面冲突时停手回报。

## 2 白名单（5 个文件，逐字照此，多一个即打回）

1. `src/shared/space-time-consistency.ts`
2. `src/shared/consistency-preflight.ts`
3. `src/services/consistency-preflight.ts`
4. `src/shared/__tests__/space-time-consistency.test.ts`
5. `src/shared/__tests__/consistency-preflight-space-time.test.ts`

**绝对不动**（`impl-package.md` §3 全文）：`findSpaceTimeConflicts` 现有判定与文案、`parseSpaceRules`、`normalizeKeyEvents`/`declaredAttack`、`ConsistencyPreflightCoverage`、两个对话框调用点、提示词与契约文件、迁移与 IPC。

## 3 分支与提交

- 开工：`git switch -c card/fact-preflight-3rules`（起点 `7bffc1ee`，`git status --porcelain` 必须为空；不空先停手回报）
- 提交：一个 commit 即可，message 建议 `feat(preflight): attacks 三条确定性规则 (FACT bb3f0d83)`
- **只 commit，不 push**（push 归主身）。commit 后贴 `git log -1 --oneline` 与 `git status --porcelain`（应为空）
- 预提交钩子会跑 `pnpm check:fast`，它在钩子里红了就是代码问题，**不许** `--no-verify`

## 4 自测与取证（命令原文，结果整段贴回）

```bash
pnpm test src/shared/__tests__/space-time-consistency.test.ts src/shared/__tests__/consistency-preflight-space-time.test.ts
pnpm check:fast
grep -n "ipc\|fs\|node:" src/shared/space-time-consistency.ts
git diff --stat
```

要贴的末行：单测的 `Tests N passed (N)` 汇总行（**不接受** `-t` 过滤跑）、两条命令的 `EXIT=`、`grep` 零命中、`git diff --stat` 恰好 5 个文件。

## 5 回执要求（缺项按可疑件退回）

1. 上面 §0.2 的四行头
2. 起点 sha 与 `git rev-parse HEAD`（提交后）
3. 四条命令的**原文与末行**（含 `Tests N passed (N)`、`EXIT=0`）
4. `hash 回归` 那条用例里 `spaceTimeStableFactKey(['unregistered-space','6','查无此店'])` 的**改造前字面量**与**改造后实际值**各一行（这是判据 2 的唯一证据）
5. 逐条对白名单的文件清单（5 行）
6. 三条规则的判据→用例名映射表（R1/R2/R3 各正负向）
7. 不确定处：明确写「未判」并说清缺什么，不要猜

## 6 时间盒

- 25 分钟无回执 ⇒ 视为卡住，回报卡点（当前在读什么、卡在哪条判据）。
- 完成即停，不在同一会话接下一张。

## 7 成本口径（派单方注意）

WorkBuddy 高峰禁派窗为周一至周五 `09:00–12:00`、`14:00–18:00`。本件投出时间已过 18:00，属非高峰（积分 5 折），可派。
