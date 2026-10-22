# 世界状态（W 线）· 工间交接（2026-10-22 收工 · 同日续做 W4a/W5 完成）

> **用途**：上下文过长时的接力点。**先读这一页，再读主设计稿**，防止目标漂移。
> 分支：`exp/world-state` · 代码 HEAD：`19383cdd` + 本轮提交（W4a 接线 + W5 视图）· 工作区：代码与文档一并提交
> 进度：**W0–W3 全部完结 · W4a 三段流水线已接线 · §11.7 五维检查已落地 · W5 只读视图已落地（含归位表）· W4b 后置**
> 主设计稿：[`docs/design/architecture/world-state-review-and-wiring-plan.md`](../design/architecture/world-state-review-and-wiring-plan.md)
> 台账：[`docs/plans/prompt-assembly-backlog.md`](../plans/prompt-assembly-backlog.md) 12.6（W 线）· 12.8（C1 一人多身份）· 12.9（§10-8）· 12.10（五维齐备性检查）

---

## 0. 今天收工时做了什么（顺序按发生）

| # | 动作 | 状态 |
|---|---|---|
| 1 | §10-7「程实」残留核查 | ✅ 全库零命中，已清除（作者已完成，我核验） |
| 2 | §10-8 旧全局覆盖遮蔽第 4/5 维 —— 查明三条硬事实 | ✅ 见 §11.6 |
| 3 | 作者裁定 **路径 C：采纳新版内置正文** | ✅ **已执行**（全局资产，留了备份） |
| 4 | 顺带立 **判据 DG**（采纳必须连带清 `taskGuidance`） | ✅ |
| 5 | 落盘时踩坑 ⇒ 立 **判据 DH**（覆盖必须显式写 `writingLanguage`） | ✅ |
| 6 | 登记 **§11.7 架构链五维齐备性检查**（作者：要做，今天不做） | ✅ 已立项 |

**★ §10「待作者裁定」表至此归零**（1–6 早已定、7 已清除、8 已定并执行、9/10 早已定）。

---

## 1. 目标（不要漂移）

W 线要解决的不是"缺状态数据"，而是 **"状态已经有了，两条消费链都不读，且没人发现"**（W0 时的实测：
`characters.cs_*` 在更新，正文链 `.withCharacterStates('')` 硬编码空串，审稿链只放行 `author` 而库里全是 `derived`）。
所以 W 线的排序原则是 **接线 → 元数据 → 差分 → 建槽**，而不是先定槽。

**不在本线**（别顺手做）：
- ❌ 让定稿补写"审稿说过但定稿没提"的字段（那是**补写**不是防错，属 W4 之后的新课题）
- ❌ W5 视图里编辑状态（它必须是只读，否则成第五个事实源，§17）
- ❌ 提前落 W4b 的 schema（三槽已存在，先落会造第二事实源）
- ❌ 动 `~/.vela/` 里其余 19 份旧覆盖（只有 `refine_chapter` 带 `builtinRevision`，但那是另一条线的事）

---

## 2. W 线现状（接手先看这张表）

| 期 | 状态 | 落点 | 备注 |
|---|---|---|---|
| W0 | ✅ | 正文链注入 `cs_*`（derived 标「·派生」）+ 审稿链放行 derived | 三处与预案不同，见 §9.3 |
| W1 | ✅ | `shared/review-execution-contract.ts`（**判据版**，不是复用生成侧文本） | §9.4 |
| W2 | ✅ | 日序两列走 **M10（v10→v11）**；`period` 不建字段 | 判据 CT/CU/CV/CW |
| W3 | ✅ | 第一单元 `07435526`（报告 v3，判据 CY/CZ）· 第二单元 `d4806d92`（定稿期交叉，判据 DA/DB）+ `4c8df58d`（面板） | 冲突 ⇒ `review-conflict` 待裁决，**不静默写回** |
| W4a | ✅ | 纯函数 `src/shared/cast-ledger.ts`（四档，11 例）· 读取 `electron/services/world-state-read.ts` · 补全 `cast-ledger-completion.command.ts` + `cast-ledger-completion-workflow.ts` · 证明 `cast-ledger-generation-proof.ts` · 类型 `src/shared/cast-ledger-completion.ts` | **先生成后 stage**（不是设计稿的「先 stage」）：见 §7.2；写路径仍只有 `approve` |
| **W5** | ✅ | `src/components/panels/sidebar/WorldStateView.tsx` + `world-state-view-model.ts`；通道 `world-state:read` | 只读；唯一动作是 orphan 行「补齐并建卡」（启动工作流，不直接写库） |
| §11.7 | ✅ | `src/shared/worldbuilding-completeness.ts` + `architecture.command.ts` 一行日志 | 缺维可见不阻断；空/读不懂时只提示「未能识别标题结构」 |
| W4b | ⬜ | 六槽 + 设计意图栏 | **后置**，不提前落 schema |

**判据 D 系列速查**（全文在 `notes/data-and-schema.md`，注入层 `MEMORY.md` 有指针）：

| 判据 | 一句话 | 违反症状 |
|---|---|---|
| DA | 冲突判定用 **span 重叠 + 位置定先后**，不靠字符串比较 | 值不等但位置合法 ⇒ 误报冲突 |
| DB | **闸门粒度必须与判据粒度一致**（原文哈希 ⇒ 逐条引文存活） | 粗闸门**静默**整体否决细判据 |
| DE | 跨卡的身份重合**永远进不了**同卡比较（`cs_*` 按 ID 存） | 一人两卡 ⇒ 两份账永不冲突 |
| DF | 多身份三形态分**读者知情** × **身份寿命**两维，不是真假 | 按"真假"做 ⇒ 地基错 |
| DG | 采纳新版正文只换 `content` 不换 `taskGuidance` ⇒ **必须连带清** | 旧副本"避免概括式说明"成了反向指令 |
| DH | 落盘覆盖**必须显式写 `writingLanguage`**（内置对象上没有） | 整份覆盖**静默失效**（"采纳了却没生效"） |
| CS | 机读失败必须**显式降级**（存 NULL 显示「缺失」，别填 0） | 缺数据被画成 0 |
| CX | 待办队列不得产生**永远无法应用**的项；`stage` 有**两处**调用点 | 改一处等于没改 |

---

## 3. 下一步待办（按顺序，都有完整实现路径）

### ① W4a 接线：三段流水线（✅ 已落地 2026-10-22，细节见 §7）

作者已裁定 ②A「建卡复用角色提案链」，但 `character-proposals.stage` 现有五个入口**都要求上游产物**，
而 `orphan` **只有名字**。**A1 与 A2 不是二选一，是三段流水线**：

| 段 | 做什么 | 现状 |
|---|---|---|
| ① 起骨架 | orphan 名字 → 提案项（产物**必然只有 name**） | 要新写 `{ kind: 'cast-ledger', names }` |
| ② 补全 | 补 appearance/background/… | **能力现成**：`prompt-language.ts` 的 `detailSystem` + `detailContract`；缺的是把 `detailSystem` 从 `architecture.command.ts` 抽出来支持最小 manifest（`detailTask` 的输入形态本就支持） |
| ③ 落库 | 提案链 `approve` | 现成 |

**★ 必须串 ②**：`characters` 写入只校验 `name` 非空 ⇒ 只有名字的卡技术上能落库 ⇒ 不串 ② 就是 §4.4 那种 `retired=1` 空壳卡。

**落地方式与上表的差异**：实现是 **② 补全 → ① 骨架（stage）→ ③ approve**，即 **先生成、后 stage**。
source 从「只有 `names`」扩成 `{ kind:'cast-ledger', names, handle, artifacts }` —— 因为 `proposalBatchId` 由 source 决定（改 source 即换批次，旧批次永远 pending，判据 CX），且 items 只能由 proof 派生。于是「只带名字的可批准批次」**结构上不存在**。

### ② §11.7 五维齐备性检查（✅ 已落地 2026-10-22）

- **落点**：架构链写 `project_core.worldbuilding` 之后。
- **检查**：五个 `### N.【…】` 标题齐备；第 5 维再查「起点：」那行（t0 是日序原点）。
- **缺维时**：**可见但不阻断**（复用 `describeSpaceTimeCoverage` 的措辞风格）。
- **不做**：❌ 缺维判 error（存量项目会爆假问题）❌ 自动重生成 ❌ 改正文。
- **验收**：① 只生成三维 ⇒ 落库后能看到"缺第 4/5 维" ② 五维齐全时不显示 ③ 存量项目（第 5 维是手工追加的）不误报。
- **落地**：`src/shared/worldbuilding-completeness.ts`（`inspectWorldBuildingCompleteness` + `describeWorldBuildingCompleteness`，零依赖）+ `architecture.command.ts` 写库后追加一条 `callbacks.log`；19 例单测。非空但零命中 ⇒ 只提示「未能识别五维标题结构」一条（判据 CS：不猜）。

### ③ W5 只读视图（W4a 的唯一出口 · ✅ 已落地 2026-10-22）

含 `cast-ledger` 的 `orphan` / `ambiguous` 区。硬边界见 §17：只读、不编辑、不当第五个事实源；
状态来源（author / derived / 未定）在界面上可区分；**没有任何写路径**。

**落地**：`WorldStateView.tsx`（四区：归位表四档 / 章节轴 / 角色六槽+来源 / 连续性事实）+ `world-state-view-model.ts`（纯函数 19 例）+ `world-state:read` 只读通道（`electron/services/world-state-read.ts`）。
唯一动作是 orphan 行的「补齐并建卡」：披露模型端点 → 启动两段式工作流 → 任务面板预览确认 → 才 `approve` 写名单；视图自身不调 approve。

### ④ C1 一人多身份（待作者选档，**未开工**）

作者已判定 **L1 不够用**，要求先做 **L2a（身份分面 + 揭示章）** 还是 **L2b（per-observer 认知）** 由他定。
**地基是身份分面**（先做观察者维度会错：没有分面，"谁知道"没有可指对象）。
(a) 反派双底的实现姿态**不是藏起来**，是「告诉模型 + 划期界」（先例：`review-far-term-setting.ts`）。
⚠️ 需要新增表，动工前必须先定「一张卡对应 N 个身份」里**身份包含哪几个字段**。

### ⑤ W4b 六槽 + 设计意图栏

后置。等 W5 视图跑通再落 schema。

---

## 4. 环境与已知坑（接手必读，原文在 `notes/env-and-conventions.md`）

- **ABI 双态**：Node 127 / Electron 145 ⇒ 测试走 `ELECTRON_RUN_AS_NODE=1 <electron.exe> vitest.mjs run <paths>`；`pnpm dev` 前先 `pnpm run rebuild:electron`。
  （本次导出内置模板用的是 `npx vitest run <path>`，属纯 `src/` 测试，走普通 vitest 即可。）
- **改 `src/` 非组件模块必须重启 `pnpm dev`**（热启动不重渲染）。
- **沙箱 safe-delete 阈值 50**：批量测试的 cleanup 会被误报失败。
- `datetime('now')` 无时区须补 `Z`；`promptCatalog` 每进程只读一次。
- 视觉保真契约有 **2 例既有失败**（`architecture-workflow.ts` 含 `→`），非本线回归，别当自己的锅。

---

## 5. 其他遗留（不在 W 线，但别丢）

- **第 4 章仍未定稿 ⇒ 日序 7 待写入并目视**（W2 的日序链最后一环没跑通）。
- `package-contract.test.ts` 2 例 GPU 崩溃、`main-generation-owner.test.ts` 全量超时 ⇒ 环境问题，非本线。
- E3 逐单元生成已收口（T1–T12），原文在 `notes/generation-pipeline.md`「第十九批」。
- 弧光链条 P13→P17 待复验四条；架构层 P11-2 / P11-3 / P12-2 待动（需 lane 六步）。

---

## 6. 本次动过的文件（清单）

| 文件 | 动作 |
|---|---|
| `docs/design/architecture/world-state-review-and-wiring-plan.md` | §10 表（7/8）· §8.1/§8.2/§11.4 补指向 · **新增 §11.6 + §11.6.1 + §11.7** · §9.2 补 W5 行 |
| `docs/plans/prompt-assembly-backlog.md` | 新增 12.9（§10-8）+ 12.10（五维齐备性检查，已立项） |
| `~/.vela/prompts/world_building.zh-CN.json` | **路径 C 重写**（内置五维 + 保留定制 `systemRole` + 清 `taskGuidance` + 写 `builtinRevision=aa51011a1f09f4c4`） |
| `~/.vela/prompts/world_building.zh-CN.json.bak-before-adopt-builtin-20261022` | 备份（3383 字节；后缀非 `.json` ⇒ 加载器跳过） |
| `docs/handoffs/2026-10-22-world-state-w4-handoff.md` | 本文档 |

**没有动任何代码**（上一轮全是文档 + 一份全局资产；`src/` 工作区当时干净）。

---

## 7. 同日续做：W4a 接线 + §11.7 + W5 视图（2026-10-22 完成记录）

> 这一节是紧接着 §0–§6 的第二轮。**§6 的「没有动任何代码」只适用于上一轮**。

### 7.1 交付清单

**新增（20）**

| 文件 | 作用 |
|---|---|
| `docs/design/architecture/world-state-w4a-wiring-plan.md` | 本轮实施计划（作者已批准；四阶段 + 逐文件改动 + 验收）。**原落在 `docs/plans/`，违反放置规则 §3.2-1，已移至 `design/architecture/` 并在 `docs/README.md` §4.2 登记** |
| `src/shared/worldbuilding-completeness.ts` | §11.7 五维识别 + 描述（零依赖纯函数） |
| `src/shared/__tests__/worldbuilding-completeness.test.ts` | 19 例 |
| `src/shared/world-state-view.ts` | W5 视图类型 + `emptyWorldStateView` |
| `electron/services/world-state-read.ts` | 归位表/章节轴/角色/连续性事实的只读组装 |
| `electron/services/__tests__/world-state-read.test.ts` | 8 例 |
| `src/shared/cast-ledger-completion.ts` | 补全产物解析 + 逐字段严格校验（名字集合必须恰好相等） |
| `src/shared/__tests__/cast-ledger-completion.test.ts` | 14 例 |
| `electron/services/cast-ledger-generation-proof.ts` | cast-ledger 的生成证明，`sourceHash = textHash(JSON.stringify([canonicalSource, items]))` |
| `electron/services/__tests__/cast-ledger-generation-proof.test.ts` | 12 例 |
| `electron/services/__tests__/character-proposal-cast-ledger.test.ts` | 6 例（stage 幂等 / 相交冲突 / approve 映射） |
| `src/services/workflows/commands/cast-ledger-completion.command.ts` | 补全 + stage 命令（`cast-ledger-character-completion`） |
| `src/services/workflows/cast-ledger-completion-workflow.ts` | 两段式：补全 → 确认并写入角色卡 |
| `src/services/workflows/__tests__/cast-ledger-completion.command.test.ts` | 8 例 |
| `src/services/workflows/__tests__/cast-ledger-completion-workflow.test.ts` | 5 例 |
| `src/components/panels/sidebar/world-state-view-model.ts` | 视图纯函数（四档分组 / 日序 / 提及摘要 / 来源文案） |
| `src/components/panels/sidebar/__tests__/world-state-view-model.test.ts` | 19 例 |
| `src/components/panels/sidebar/WorldStateView.tsx` | W5 视图（四区 + orphan「补齐并建卡」） |
| `src/components/panels/sidebar/__tests__/WorldStateView.render.test.tsx` | 3 例（无项目分支） |
| `src/components/panels/sidebar/__tests__/WorldStateView.completion.browser.tsx` | 4 例（真 Chromium：披露 / 启动 / 无模型 / 只读边界） |

**修改（15）**

| 文件 | 动作 |
|---|---|
| `src/shared/character-proposal.ts` | `CharacterProposalSource` 加 `cast-ledger` 档 + history `sourceGroup` |
| `src/shared/ipc-channels.ts` | 加 `'world-state:read'` |
| `electron/controllers/db-controller.ts` | 注册该通道（先 `assertRequiredExpectedProjectPath`，库未开返回空视图） |
| `electron/controllers/__tests__/db-controller-project-context.test.ts` | +28 行（新通道的跨项目拒绝） |
| `electron/repositories/review-cycle-repository.ts` | `listCurrentReviewStateDeltaMentions`（每章最新 finalized 草稿，`status==='ok' && sameContent` 才采信） |
| `electron/services/character-proposal-service.ts` | stage cast-ledger 分支 + pending 幂等/冲突 + `adopt-generated` 映射 + 标签 |
| `electron/services/generation-character-proposal-proof.ts` | 分派 cast-ledger（forWrite 时校验 handle） |
| `electron/services/main-generation-owner.ts` | approve 的 handle 解析加 cast-ledger |
| `src/services/character-proposal-history-client.ts` | 组 + 标签「来自归位表补全」 |
| `src/services/workflows/character-proposal-preview.ts` | 预览加一句来源说明 |
| `src/services/workflows/commands/architecture.command.ts` | 写库后追加五维检查日志（不 throw） |
| `src/stores/layout-store.ts` | `SidebarView` 加 `'world-state'` |
| `src/components/layout/LeftToolWindowBar.tsx` | 加「世界状态」按钮（Compass，世界之后、剧情之前） |
| `src/components/layout/__tests__/LeftToolWindowBar.test.tsx` | 标签断言加「世界状态」 |
| `src/components/panels/Sidebar.tsx` | 标题 + 渲染分支 |

### 7.2 关键裁决：先生成、后 stage

设计稿 A1 是 `{ kind:'cast-ledger', names }`（只有名字就 stage）。实现改成
`{ kind:'cast-ledger', names, handle:{projectId,epoch,rootActionId,runId}, artifacts:[{artifactId,revision,textHash}] }`：

1. `proposalBatchId` 由 `JSON.stringify([projectId, source])` 决定 ⇒ 改 source 就是换批次，旧批次永远 pending（判据 CX）。
2. 提案项只能由 proof 派生 ⇒ 只有名字的 proof 无法产出可批准字段。
3. 先 stage 再补全 ⇒ 库里存在过「只带名字的可批准批次」，窗口内一点通过就是空壳卡。**先生成后 stage 让它结构上不可能。**

配套两条：stage 时同名字集合的 pending 批次**直接复用**（幂等）；相交但集合不同报
`CHARACTER_CAST_LEDGER_PENDING_CONFLICT`。补全命令在 stage 前**重查名单**，名字已被建卡则整批报「名单已变化，请刷新世界状态后重试」（不做静默剔除）。
detail 产物里的 `currentState` 故意不投影 ⇒ 新卡是「未观测」，不伪造第 0 章状态（判据 CS）。

### 7.3 验证

| 项 | 结果 |
|---|---|
| `pnpm typecheck` | exit 0 |
| 定向单测 11 文件 | **134 passed**（worldbuilding 19 · world-state-read 8 · db-controller 36 · cast-ledger-completion 14 · proof 12 · proposal 6 · command 8 · workflow 5 · view-model 19 · render 3 · LeftToolWindowBar 4） |
| browser（Chromium headless） | `WorldStateView.completion.browser.tsx` **4 passed** |
| 未跑 | 全量 `pnpm test`（ABI 双态 + 已知环境噪声，见 §4） |

运行命令（已验证可直接复用）：

```powershell
$env:ELECTRON_RUN_AS_NODE=1; & ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run <测试路径…>
$env:ELECTRON_RUN_AS_NODE=1; & ./node_modules/electron/dist/electron.exe ./node_modules/vitest/vitest.mjs run --config vitest.browser.config.ts <browser 测试路径>
```

### 7.4 偏差与未做

**偏差（都已接受，不影响目标）**

1. `SidebarView` id 用 `'world-state'`、图标用 Compass（计划写 `'worldstate'` + Gauge）——内部命名。
2. A1 → 「先生成后 stage」（§7.2）。
3. `CHARACTER_DETAIL_BATCH_SIZE` 在架构命令里未导出 ⇒ 新命令本地声明同名常量 3。
4. `operation` / authorInput 前缀在渲染层与 electron 层各声明一份（渲染层不能 import electron 模块：better-sqlite3 ABI）。
5. 命令的 `buildTask` 不提供 `promptBudget`（skill 注入按实际字节现算，写死 limit 会误报 `PromptBudgetExceededError`）。
6. 冻结清单用「本批 items」（slotId 仍用全量下标，分批后稳定）。
7. `CharacterData` 无 `aliases` 字段 ⇒ 命令侧「名字是否已有卡」只按显示名命中；**归位表读取层仍走 `character_aliases`**。
8. 覆盖不全（产物条数 != 名单条数）即失败，不 stage 部分批次。

**未做（有意）**

- 视图不订阅 `REFRESH_RESOURCE`：approve 建卡后需手动刷新（header 已提示「快照可能已过期」）。
- W4b 六槽 + 设计意图栏、C1 一人多身份、从正文抽名、归位表持久化 —— 均未动。
- 手工验收（真实模型跑一次三维世界观、蓝图加名→orphan→补齐→字段非空→回视图消失）**尚未执行**，下一轮接手时补。

### 7.5 下一步建议

1. 手工跑通 §7.4 最后那条端到端（本轮只有单测 + browser 测试覆盖）。
2. W5 视图订阅 `REFRESH_RESOURCE`（`characterCards` / `summary`）做自动刷新。
3. W4b 六槽 + 设计意图栏（先拿 W5 真实数据定槽，不提前落 schema）。

