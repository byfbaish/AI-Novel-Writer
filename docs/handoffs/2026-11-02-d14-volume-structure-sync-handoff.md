# 交接：D14 卷结构自动同步（A 已落地验证）+ 实机链路第二轮读数

> 交接基准：2026-11-02 01:2x · 分支 `exp/resource-ledger` · HEAD `9baa7977` · **工作区脏（未提交，见 §六）**
> 上一班：[`2026-11-01-invalidation-line-closeout.md`](2026-11-01-invalidation-line-closeout.md)（P2-3 全线收口）
> 缺陷主稿：[`design/product/live-pipeline-acceptance-defects-assessment.md`](../design/product/live-pipeline-acceptance-defects-assessment.md)（D1–D17，**已补齐 D12–D17**）
> 台账：[`plans/prompt-assembly-backlog.md`](../plans/prompt-assembly-backlog.md) §「2026-11-02 实机链路验收缺陷」

---

## 〇、三十秒版本

**D14 的 A 部分（两步自动）修完并实机验过了**：架构一变就自动建卷结构、定稿一章就自动推进该卷 `actual_last`，另外补了一次性全卷对账（老项目的历史数据只能靠它补齐）。

**B 部分（缺口提前警告）一行代码都不用写** —— `ChapterCreationDialog` 早就集成了 `VolumeHandoffGatePanel`，它不出现的唯一原因就是 `volumes` 表是空的。A 做完，B 自动生效。**但它今天没能实机看到**，原因见 §四。

今天顺手把管线又推了一格：**第 10 章的大纲和蓝图都生成出来了**（卷二最后一章），**正文还没写**。

> **下一班第一件事**：写第 10 章正文 → 定稿 → 开「写作第 11 章」→ 看闸门是否弹「上一卷第 2 卷没有交接单」。那一步做完，D14 才算整条闭环。

---

## 一、今天的产出

### 1.1 代码（4 个文件）

| 文件 | 做什么 |
|---|---|
| `electron/services/volume-structure-sync.ts` | **新增**。三个导出：`syncVolumeStructureFromCore`（建结构 + 对账）、`markVolumeProgressForChapter`（定稿推进一卷）、`refreshVolumeProgress`（全卷对账）。头注写清「为什么需要 / 只做零决策的两步 / 登记交接单不在这里 / 失败一律吞掉不阻断主流程」 |
| `electron/controllers/db-controller.ts` | `db:project-core-update`、`db:project-core-commit-generated` 在 `plotStructurePlan` / `synopsis` 变动后同步；`db:volumes-rebuild` 后追加对账 |
| `electron/controllers/finalization-controller.ts` | 定稿成功后 `markVolumeProgressForChapter(db, candidate.chapterNumber)` |
| `electron/services/__tests__/volume-structure-sync.test.ts` | **新增**，13 条 |

### 1.2 文档

- 缺陷主稿：§D14 新增「处置」整节（改前/改后对照 + 实机复验数字 + B 未验原因）；总表补 **D17**；新增「D8 的现场实锤」；状态行改 `待裁定（2026-11-02；…D14 已修且 A 已实机复验、B 待第 10 章）`
- 台账：D14 行改 `✅ A 已修并实机复验（2026-11-02）；B 待第 10 章`，新增「落地记录」小节 + D17 排到第 10 位
- 清单 `live-verification-checklist.md`：本轮 §8 读数（上一段会话写的）

### 1.3 验证

- 新测 13 条全过；回归 `volume-structure-repository`(12) / `volume-handoff-repository`(14) / `volume-handoff-gate`(11) 全过
- `tsc --noEmit` EXIT=0
- 文档门禁：`check-doc-links` 1063 链接 0 断链；`check-doc-placement` EXIT=0

---

## 二、实机读数（D14 A 的证据）

项目：`/c/develop/workspace/AI-writer/师父派我来除魔，幕后真凶竟是小师妹`

| 时点 | 动作 | `volumes.actual_last` 读到的值 |
|---|---|---|
| 改代码前 | — | 6 卷**全部 `null`**（第 1 卷 6 章、第 2 卷 3 章都已定稿） |
| 定稿侧复验 | 第 9 章「退回草稿」→ 重新「定稿」（零生成成本） | `volume:2`(7–10) 由 `null` → **9**，`actual_source='finalized'`；其余 5 卷不动 |
| 回填侧复验 | 点一次「重建卷结构」 | `volume:1`(1–6) 由 `null` → **6**；3–6 卷仍 `null` |

**第二行是关键教训**：只补「定稿事件」不够。老项目的卷行是**后建**的（手动重建那次），1–6 章的定稿早于代码上线，没有事件会再来一次 ⇒ 必须有一次性对账 `refreshVolumeProgress`。这条已写进测试（`回填历史：正文先定稿、卷结构后建 ⇒ 一次对账补齐全卷进度`）。

---

## 三、今天的三个新现场记录

### ① D17（中·新登记）大纲提交不记覆盖章区间 ⇒ 失效范围被放大

**先记作者判断**：「这一屏就是**上游重建 → 下游失效机制的验证成功**」。它确实做对了：认出对象（蓝图 3 / 交接单 1 / 已定稿 3，分三类）、算出跨度（每条写 `情节大纲 6 → 7`）、点名不可回头那条（"含卷末交接单：它会被拒绝读取，下一卷会开不了工"）、给退路且守约（取消一次后 `upstream_revision_log` rev 仍为 6，一位没动）。

**实测预演没夸大**：提交第 10 章（只一章）后，「同步」页列出 **7 项需要处置**，与预演逐条对上。但每行理由是「第7版 01:12 重新生成，**改动章未知**」。

根因：`project-core-repository.ts:315-317`

```ts
changedChapters: request.authorRecovery ? expandChapterRange(request.authorRecovery.committedRange) : []
```

`authorRecovery` 只有「恢复存稿」路径才有 ⇒ **正常 AI 生成落盘一律记空集** ⇒ `changedChaptersBetween`（`src/shared/upstream-revisions.ts:668`）对空集返回 `null` ⇒ 判定侧按「拿不到可收窄的章集 ⇒ 按全改算」（`:749-750`）。

**对照（容易看错的地方）**：流水里 rev5=`[1..6]`、rev6=`[7,8,9]` 是有章集的，但那两次是**蓝图批量提交**（`blueprint-repository.ts:833` 把蓝图章号写进 `outline` 域），不是大纲提交。两条管道共用 `outline:book` 一个键 —— **光看流水看不出差别**。

量级：每追加一批大纲 = 把此前所有已定稿章拖进处置清单。30 章是 7 条，300 章就是每次续写都要人工忽略 290 条。

### ② D8 的现场实锤（不是新缺陷，是拿到了复现步骤）

「AI 生成故事架构」对话框原话：

```
未按单元生成：检查点里有未完成批次（synopsis_incomplete=true）：中断续写语义未定，本次走按章区间
```

E3「点一次 = 一个单元」在**本项目当前状态下降级成按章区间**。复现：跑一批大纲 → 中途停 → 再打开对话框 → 单元探针必然降级。

### ③ D2 又复现两次

今天的大纲 run（`958d89fd`）和第 10 章蓝图 run（`957dca59`）**内容都已成功落库**，但 `generation_runs.status` 一直停在 `running`，任务面板**没有任何新卡片**。也就是「产物有了、界面说还在跑」。定稿那次（00:55）反而是正常走完的。

---

## 四、D14 B 为什么今天没验成（两道闸，缺一不可）

1. **权威章号闸**：`ChapterCreationDialog.tsx:311` —— 目标章必须等于「定稿之后的下一章」。当前下一章 = 10，所以「写作第 11 章」这个入口根本走不到闸门判定那一步。
2. **大纲覆盖闸**：蓝图生成要求大纲已覆盖该章（对话框原话「第 11 章及以后还没有大纲，暂时不能生成蓝图」）。

⇒ 必须先有第 10 章正文。**今天已经把第 10 章的大纲和蓝图做出来了**：

- `upstream_revision_log`：outline `rev 6 → 7`（2026-11-01 17:12 UTC / 本地 01:12）
- `project_core.synopsis` 现 10 个标题，末条 `## 第10章：月底查账，他把双倍追罚砍回单倍`
- `blueprints` 现有第 10 章：`月底查账，他把双倍追罚砍回单倍`

**下一步顺序（别跳）**：写第 10 章正文 → 定稿（会顺带验证 `volume:2.actual_last` 推到 10）→ 生成第 11 章大纲（单元 3:1）→ 生成第 11 章蓝图 → 开「写作第 11 章」看闸门。

> ⚠️ 生成第 11 章大纲同样会再报一轮「作废 3 章 / N 章」。按 D17 的分析，这是因为章集没记，**不是真的改坏了前面的章**；但要作者签字这个动作省不掉。

---

## 五、下一步（按台账排序，作者已定「起点 D14」）

| 序 | 编号 | 状态 | 备注 |
|---|---|---|---|
| 1 | D14 | A ✅ / B ⏳ | B 只差「写完第 10 章 + 有第 11 章蓝图」 |
| 2 | D12 | 未开工 | 真因是**短细纲把上一章全文当本章任务**（`generate-draft.command.ts:1142-1144`），不是校验太严。修法两条都要：给 `predecessor` 加显式结构分隔或只给结尾片段 + 要点；拦截后带原因自动重跑一次 |
| 3 | D2 | 未开工 | 抛错点必须落终态 + `blocked_code`；任务面板把「工作流未完成」呈现为失败态。**今天又攒了 2 条 `running`** |
| 4 | D1 | 代码已改·未提交·未验证 | `advanceBinding` 在 `generation-run-repository.ts` + `main-generation-owner.ts`。**建议只用单元测验验，不要再实机试**（代价是重跑大纲批次） |
| 5 | D17 | 未开工 | 与 D8 同屏，可一起改 |
| 6 | D18 | 未开工 | 蓝图钩子偏离大纲「收尾：」行，**三个环节合成一条**（条款互斥 / 自造设定 / 未兑现无告警）。已排除「审查」：模型产物与库逐字一致、`finishReason=stop`。取证 → 缺陷稿 §D18 |
| 7 | D13 / D15 / D3 | 未开工 | D3 的根因在 D14，D14 修完后 D3 才值得改文案 |
| 8 | D4–D8 / D9–D11 / D16 | 未开工 | — |

---

## 六、脏状态：**全部未提交**

`git status` 共 18 改 + 10 新增。分组如下（**接手先 `git diff` 逐项确认再决定怎么拆提交**）：

| 组 | 文件 | 归属 |
|---|---|---|
| **今天的 D14** | `electron/services/volume-structure-sync.ts`(新)、`electron/services/__tests__/volume-structure-sync.test.ts`(新)、`electron/controllers/db-controller.ts`、`electron/controllers/finalization-controller.ts`、`docs/plans/prompt-assembly-backlog.md`、`docs/design/product/live-pipeline-acceptance-defects-assessment.md`(新) | 已验证，可提交 |
| **D1 绑定推进** | `electron/repositories/generation-run-repository.ts`、`electron/services/main-generation-owner.ts` | 未验证（见 §五） |
| **仅注释** | `electron/repositories/blueprint-repository.ts`、`src/shared/upstream-revisions.ts` | 落地 2026-11-01 作者裁定「删蓝图不 bump」的说明，**纯注释** |
| **系统通知（另一块未完成功能）** | `electron/controllers/system-notification-controller.ts`(新)、`src/services/system-notify/`(新)、`src/shared/system-notification.ts`(新)、`electron/ipc-handlers.ts`、`src/App.tsx`、`src/shared/ipc-channels.ts`、`electron/utils/config-utils.ts`、`vite.config.ts`、两个 ipc-handlers 测试 | **与本轮无关，别顺手提交** |
| **文档** | `docs/README.md`、`docs/agents/doc-placement-baseline.json`、`docs/design/architecture/upstream-version-and-derived-invalidation-design.md`、`docs/design/product/live-verification-checklist.md`、`docs/design/prompt/previous-chapter-context-assessment.md`(新) | 随对应改动一起走 |

---

## 七、别做的事（都是踩过的）

1. **别点「重置情节大纲检查点」** —— 文案直说「从全书起点重来」，会把 1–10 章大纲全部作废。
2. **别用「AI 重新生成」整篇覆盖大纲** —— 只有确认 E3 单元模式生效（对话框出现 `[E3] 单元批次` 提示）时它才是「一个单元」；本项目当前是**降级成按章区间**（D8），必须在「生成范围」里手填章号区间。
3. **别给 `BlueprintRepository.delete` / `clearAll` 补 bump** —— 2026-11-01 作者裁定：真实层级是「大纲 > 蓝图 > 正文」，删蓝图不 bump 是对的。
4. **别按章号反推单元** —— E3 的硬约束，范围只认落库游标 / 显式区间。
5. **别把 `.workbuddy/`、`.agent/` 当缓存删**。
6. **本机 `pnpm` 在 sh 里是坏的**（`npm/node_modules/node/bin/node: line 1: This: command not found`）⇒ hook / 脚本一律走 `node`。

---

## 八、复现今天的验证（命令 + UI 路径）

### 8.1 跑测试 / 类型检查

```bash
cd /c/develop/workspace/AI-writer/develop
env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
  ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron ./node_modules/vitest/vitest.mjs run \
  electron/services/__tests__/volume-structure-sync.test.ts
./node_modules/.bin/tsc --noEmit -p tsconfig.json
node scripts/check-doc-links.mjs && node scripts/check-doc-placement.mjs
```

> `env -u` 两个变量必须带：沙箱 safe-delete 会在 fixture cleanup 时报 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`，失败栈落在 `rmSync` 而不是断言。

### 8.2 读库（better-sqlite3 的 ABI 只能走 Electron）

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron your-script.cjs
```

**今天最常用的三条查询**

```sql
SELECT volume_id, planned_first, planned_last, actual_last, actual_source FROM volumes ORDER BY volume_index;
SELECT chapter_number, status, outline_rev FROM drafts ORDER BY chapter_number;
SELECT rev, changed_chapters, covers_all, at FROM upstream_revision_log WHERE domain='outline' ORDER BY rev;
```

### 8.3 驱动界面（调试端口是作者要求留着的）

`vite.config.ts` 开着 `AI_NOVEL_UI_DEBUG_PORT` → `--remote-debugging-port=9222`。用 `playwright-core` 的 `chromium.connectOverCDP('http://127.0.0.1:9222')` 直连（`agent-browser` 在本机会反复 SIGTERM，别用）。

**坐标踩坑（省你半小时）**

- 视口 1440×900，**截图是 0.75 缩放**，看图估的坐标要 ×1.333
- 左侧导航按钮（首页/项目/小说…）**点两次会折叠侧栏**（`layout-store.ts:119-123` 的 toggle），侧栏消失就再点一次，别去找开关
- 对话框内容可滚动，`y > 900` 的坐标点不到；优先用 `element.click()` 而不是 `mouse.click(x, y)`
- React 受控输入要 `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + `dispatchEvent(new Event('input'))`；给「起始章」设 10 而「结束章」还是 5 时，「确认生成」会变灰（区间非法），**先设起始再设结束**即可

---

## 九、留给下一班的一个疑点（没查完）

第 10 章的大纲标题是 `## 第10章：月底查账…`，而前 9 章都是 `## 第2卷第1单元第3章（全书第9章）：双倍功勋的刀`。**按章区间模式生成的标题少了「卷 / 单元 / 全书第 N 章」三层格式。**

E4j-4 的三层树有 `declared` / `computed` 兜底（`outline-tree` 的 `heading` source 优先级 heading > declared > computed），所以大概率不会炸；但**第 10 章在卷单元树里被归到哪一层，没有实测**。如果后面发现「第 10 章挂错卷」，先看这里，不要先去怀疑卷结构。
