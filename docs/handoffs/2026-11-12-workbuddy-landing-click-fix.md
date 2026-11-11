# 2026-11-12 WorkBuddy 落点点击修复（`+` 开草稿改为页面内 DOM click）

> 状态行：**已实施 + 实机复验通过 + 两轮独立复核 PASS**（随本文件同一次提交落库，未推送；2026-11-12 00:1x–01:1x）
> 授权：**可改码（`scripts/workbuddy/`）+ 主区实机探针**（依据作者 2026-11-12 00:0x 选择「现在修（推荐）」+「三段往返探针」要求）
> 角色：中控只改这一处 + 跑探针；独立复核由上下文隔离子 agent 做（判定 REWORK → 已按意见回炉，见 §6）。

## 1. 一句话结论

`docs/handoffs/2026-11-11-night-shift-plan.md` §10「提权坑的根因」第 1–3 条对应的问题**已在代码层被 `c441279c` 补了闸门，但闸门当时把 `--new` 派活全拒了**：坏的不是闸门，是「点空间 `+` 开草稿」用的**坐标点击**——在可滚动侧栏里算出的坐标与按钮实际位置不符，CDP 鼠标事件点在空处不报错，于是静默变成「点了没反应」。改成页面内 `element.click()` 后，`--new` 派活恢复，且「在 wt-2 干活 → 中途切 develop → 再切回 wt-2」三段往返实机全通、落点都由 `sessions.cwd` 回查证实。

## 2. 现场信号（2026-11-12 00:0x 探针，修复前）

| 动作 | 结果 |
|---|---|
| `task … --no-wait`（复用会话） | `[ok] 落点已证实：会话 6c7177f1-… @ C:/develop/workspace/AI-writer/wt-2` ⇒ 闸门 ② 成立 |
| `task … --no-wait --new` | `✗ [refuse] 点「+」后当前会话仍是 6c7177f1-…，新草稿没打开` ⇒ **一个字没打出去**，闸门 ① 拦住 |
| 按脚本算出的坐标（`219.89, 673`）用 `Input.dispatchMouseEvent` 点 `+` | 页面快照**完全不变**（`currentId` 未变、`messageCount` 仍 6、编辑器仍是空占位）⇒ 点了等于没点 |
| 页面内对同一 `.workspace-new-task-button` 调 DOM `btn.click()` | `wb.conversations.currentId` → **null**、`messageCount` → 0、编辑器空占位 ⇒ 新草稿确实打开 |

根因：`scripts/workbuddy/workbuddy-attach.mjs` 的旧 `openSpaceDraft()` 先 `scrollIntoView` 再 `getBoundingClientRect()` 算中心点，然后 `clickRect()` 发三个 CDP 鼠标事件；侧栏可滚动（当时 8 个空间）时坐标与实际按钮位置错位，而「点在空处」是最安静的一种失效。

## 3. 改动（5 文件，未提交）

| 文件 | 改了什么 |
|---|---|
| `scripts/workbuddy/attach.mjs` | 新增 `buildSpaceClickExpression({label, kind, sessionId, selectors})`：按 `.collapsible-section` → 标题文本**完全相等** → 点 `.workspace-new-task-button`（`kind='card'` 点第一张卡片；`sessionId` 按 `data-conversation-id` 精确点）。找不到空间/按钮/按钮禁用/无卡片一律返回 `{error}`，**绝不回落到别的空间**。 |
| `scripts/workbuddy/workbuddy-attach.mjs` | `openSpaceDraft()` 改用上面这条表达式，删掉坐标点击；保留 `currentId` 前后比对、`judgeLanding` 四态、`--force` 不赦免；`chips.workspace` 的 warn 保留，并在**真有值**时用 `workspaceMatches()` 兼容两种形态（空间名 `wt-2` / 完整 cwd）；新增「新草稿证据」：`switched-unverified` 时必须 `currentSessionId=null` + `messageCount=0` + 编辑器空（含欢迎文案）才放行。 |
| `scripts/workbuddy/__tests__/attach.test.mjs` | 新增 18 条用例：真点 +、空间不存在不误点、无 + 且别的空间有 + 也不回落、按钮禁用、标签精确相等（双向：`wt-2-old` ≠ `wt-2`、侧栏只有 `wt` 也不命中）、card 分支、无卡片、`sessionId` 精确点/不存在不退回，以及 7 条 `judgeFreshDraft` 空草稿证据。共 **65 passed**（原 47）。 |
| `docs/agents/workbuddy-channel.md` | 状态行、§2.3 四条（`chips.workspace` 两形态 / DOM click / 新草稿证据 / 夜间硬前提与跨目录可行）、§7 已验证/未验证重排、§8 两行新增。 |
| `docs/README.md` | 「接手别人的会话 → 最近一份」切到本稿。 |

## 4. 实机复验（2026-11-12 00:43–00:45，三段往返）

| 段 | 目标 | 结果 |
|---|---|---|
| P1 | wt-2 干活 | `[ok] 已确认是新草稿…` → `[ok] 落点已证实：会话 6d6f4fe4-… @ …/wt-2`，回复 `RT2-1-WT2-OK` |
| P2 | **中途切到 develop**（`--cwd …\develop --force --new`） | `[warn] --force 已越过归属护栏` → `[ok] 落点已证实：会话 43d75910-… @ …/develop`，回复 `RT2-2-DEV-OK` |
| P3 | **再切回 wt-2** | `[ok] 落点已证实：会话 32e166e5-… @ …/wt-2`，回复 `RT2-3-WT2-OK` |

三段都是**新会话**、`sessions` 表里 cwd 分别为 `wt-2 / develop / wt-2` 且 `status=completed`；全程**没有触发任何提权确认框**（日志里只有预期的那条 `--force` warn）。

⇒ 顺带回答了一个悬着的问题：**「WorkBuddy 进 develop」在修好点击后是可行的**。03:32 那次「方案 B 走不通（目标文件零写入、文本落旧会话）」的直接原因是 `+` 点空导致文本落进了旧会话，不是权限被硬拦。

## 5. 已知限制与后续项（写进 workbuddy-channel §7）

1. **`resumeSession()` 仍用坐标点击切卡片**（本轮未动，按 T0#3 不猜根因、不顺手改）。风险与本次同型：点偏后 `currentId` 读回原会话，函数仍返回 `ok:true`；若原会话 cwd 恰好等于目标 cwd，第 ② 道闸门会判 `cwd-ok`，任务静默进「同目录、错会话」。**后续项**：`buildSpaceClickExpression({sessionId})` 已就绪，改成页面内点卡片 + 断言 `currentSessionId === requested`，不符即拒。
2. **发送按钮 / 模型选择器仍走 `clickRect()` 坐标点击**（`clickSelector`），同一类风险；发送按钮点偏时只 warn。
3. **「新草稿证据」里的欢迎文案是硬编码前缀**（`/^今天帮你做些什么/`，实测 25 字符）。WorkBuddy 改文案时会退化成 **fail-closed** 报错（不会静默放行），错误信息里带字符数/占位可见，便于定位。
4. **`chips.workspace` 有两种形态**：会话里 `null`、草稿里空间名（`wt-2`）；个别版本可能是完整 cwd ⇒ 用 `workspaceMatches()` 兼容。旧代码拿它跟空间名比，在「值 = 完整 cwd」时会误杀（本轮撞到过）。
5. **DSH 侧「受限令牌 append 已存在日志被 ACL 拒 → `approval/asked`」是另一个洞**，`c441279c` 与本轮都没碰，也仍无实机验证。
6. **「新草稿证据」只证明「这是一张空草稿」，不证明「这是目标空间的那张」**：空间身份仍靠草稿里的 `chips.workspace`（非 null 才有）与闸门 ② 的事后 `sessions.cwd` 回查；两者都拿不到时只能 fail-closed 或标未证实。
7. **新旧两个表达式各复制了约 25 行选择器逻辑**（`buildSpaceActionExpression` 与 `buildSpaceClickExpression`），只有「返回 rect」与「调 `.click()`」不同；将来 UI 选择器改名要改两处。**后续项**：抽公共查找函数，用 `mode` 参数区分返回形态。

## 6. 复核记录

- 第一轮（子 agent `6d6c190c-…`，只读）：**REWORK** —— ①T0#5 文档零改动、代码注释指向 gitignored 的 `.runtime/` 证据；②新函数缺 `sessionId` 分支、易被当通用替代；③`resumeSession` 同类洞需登记；④`before=null && after=null` 落 `switched-unverified` 是盲区，建议加草稿证据；⑤单测漏「精确相等 / 不得回落 / card 无卡片」；⑥`chips.workspace` 与空间名比是既有 bug。
- 本轮已按 ②④⑤⑥ 全部回炉（并把证据搬进本稿）；①的文档同步即本稿 + docs/agents/workbuddy-channel.md §2.3/§7/§8；③按「登记为已知限制 + 后续项」处理。
- 第二轮（子 agent 95911f11-…，只读）：**PASS** —— 六条均有落点、闸门逻辑只增不减；并指出「新草稿证据零单测（已补 judgeFreshDraft 7 条）、landing.verdict 字面量分支应改 !landing.verified（已改）、文档 §7/§8 自相矛盾（已改）、精确相等单测只钉单向（已补反向）、本稿文件清单不全（已补）、fresh 不证明目标空间（已登记 §5-6，另记新旧表达式重复 §5-7）」。

## 7. 复现命令（照抄）

```powershell
cd C:\develop\workspace\AI-writer\develop
node scripts\workbuddy\workbuddy-attach.mjs task "只回复一行 OK" --new --no-wait --timeout 60
# 期望：先 [ok] 已确认是新草稿…，再 [ok] 落点已证实：会话 <新id> @ C:/develop/workspace/AI-writer/wt-2

node scripts\workbuddy\workbuddy-attach.mjs task "只回复一行 OK" --cwd C:\develop\workspace\AI-writer\develop --force --new --no-wait
# 期望：同上，但 cwd 是 …/develop（--force 只越过归属护栏，不越过落点闸门）
```
