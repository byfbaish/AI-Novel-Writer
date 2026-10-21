# 世界状态（W 线）· 工间交接（2026-10-22 收工）

> **用途**：上下文过长时的接力点。**先读这一页，再读主设计稿**，防止目标漂移。
> 分支：`exp/world-state` · 代码 HEAD：`d2c8d41a`（+ 本文档提交）· 工作区：文档待提交，代码干净
> 进度：**W0–W3 全部完结 · W4a 纯函数已落地 · W5 升为 W4a 唯一出口 · W4b 后置**
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
| W4a | ⚙️ | `src/shared/cast-ledger.ts`（四档 `carded`/`ambiguous`/`anchored`/`orphan`，11 例） | 纯函数已落地，**接线未做** |
| **W5** | ⬜ | 只读视图 + **归位表并入此视图** | **W4a 的唯一出口**，排在 §11.7 之后 |
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

### ① W4a 接线：三段流水线（唯一有完整路径的事）

作者已裁定 ②A「建卡复用角色提案链」，但 `character-proposals.stage` 现有五个入口**都要求上游产物**，
而 `orphan` **只有名字**。**A1 与 A2 不是二选一，是三段流水线**：

| 段 | 做什么 | 现状 |
|---|---|---|
| ① 起骨架 | orphan 名字 → 提案项（产物**必然只有 name**） | 要新写 `{ kind: 'cast-ledger', names }` |
| ② 补全 | 补 appearance/background/… | **能力现成**：`prompt-language.ts` 的 `detailSystem` + `detailContract`；缺的是把 `detailSystem` 从 `architecture.command.ts` 抽出来支持最小 manifest（`detailTask` 的输入形态本就支持） |
| ③ 落库 | 提案链 `approve` | 现成 |

**★ 必须串 ②**：`characters` 写入只校验 `name` 非空 ⇒ 只有名字的卡技术上能落库 ⇒ 不串 ② 就是 §4.4 那种 `retired=1` 空壳卡。

### ② §11.7 五维齐备性检查（已立项，作者说要做）

- **落点**：架构链写 `project_core.worldbuilding` 之后。
- **检查**：五个 `### N.【…】` 标题齐备；第 5 维再查「起点：」那行（t0 是日序原点）。
- **缺维时**：**可见但不阻断**（复用 `describeSpaceTimeCoverage` 的措辞风格）。
- **不做**：❌ 缺维判 error（存量项目会爆假问题）❌ 自动重生成 ❌ 改正文。
- **验收**：① 只生成三维 ⇒ 落库后能看到"缺第 4/5 维" ② 五维齐全时不显示 ③ 存量项目（第 5 维是手工追加的）不误报。

### ③ W5 只读视图（W4a 的唯一出口）

含 `cast-ledger` 的 `orphan` / `ambiguous` 区。硬边界见 §17：只读、不编辑、不当第五个事实源；
状态来源（author / derived / 未定）在界面上可区分；**没有任何写路径**。

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

**没有动任何代码**（本轮全是文档 + 一份全局资产；`src/` 工作区干净）。
