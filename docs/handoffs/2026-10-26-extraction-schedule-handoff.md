# 交接：实机验证（明天续）+ P20 抽取排期

> 状态：进行中（2026-10-26 05:20）。分支 `exp/resource-ledger`，基准 SHA `600907bd`（工作树在本文提交前只有 `docs/README.md`、`docs/plans/prompt-assembly-backlog.md` 两处未提交改动）。
> 上一份交接：`2026-10-26-live-verification-handoff.md`（**实机验证的操作手册在那里，本文不重复**；本文只补今天的新证据与新排期）。

---

## 1. 明天第一件事（实机验证）

1. **重启 `pnpm dev`**。这一轮改了 `src/shared/`（`space-machine-line` / `space-time-consistency` / `space-anchor`），
   主进程与渲染层都要重新加载；只点「刷新」不会换掉已在跑的主进程逻辑。
2. 按 `docs/design/product/live-verification-checklist.md` 跑：**A9–A12**（验 N1 五维问句）、**C1**（平台画像日志基线）、
   **C2**（方案 A 的唯一裁判，⓪ 先把两条硬指标写进文风槽）、**D2**（修稿轮措辞）。
3. 读数记在哪：C2 的基线必须在**挪槽位之前**取；平台画像为空时 C1 日志整行不打印（第四条前置）。

**⚠️ 一条读数已作废**：若之前记过「空间检查 7 处待确认」，那个数字今天换了口径，不要再当基线用（见 §2）。

---

## 2. 今天落地了什么（三个提交，都已跑过测试）

| 提交 | 内容 | 怎么验的 |
|---|---|---|
| `3736081a` | 空间检查分出「待确认 / 设计内提示」两档；`rule-not-encoded`、`end-of-day-2400` 归 `info`；计数只数 `attention` | 18 例单测 + 浏览器渲染 4 例 + tsc |
| `600907bd` | **机读行加第三值 `hours=none`**；缺窗口不再按「自评低频」免检；左栏计数改走 `spaceAuditCounts` | 20 例单测（含 `none` 三态、分级不免检、fail-open）+ 浏览器 4 例 + tsc |
| （随 `600907bd`） | `space-time-consistency` 认 `noWindow`、`space-anchor` 判 `unknown` | 空间四文件 104 例全绿 |

### 口径变更（重要，会改变你看到的数字）

`entry=` 写满而 `hours=` 缺失的行，以前只有一个解释（缺窗口）。现在三态：

| 写法 | 含义 | 检查 |
|---|---|---|
| `hours=07:00-17:00` | 有时段 | 参与钟点判定 |
| `hours=none` | **显式**声明「本空间无时段概念」（低敏感区 / 通过型场景） | 不报、不判定 |
| 不写 `hours=` | 缺失（漏写，或还没决定） | 报「缺窗口」，二选一 |

**分级（长期舞台 / 一次性场景）只改措辞，不再免检** —— 分级声明是模型自己写的，给它免检权等于
「贴个低频就永远不判」。你那份《师父派我来除魔》的世界观现在报 **5 处待确认 + 2 条设计内提示**：

- 5 处全是 `hours=` 缺失（内门活脉 / 长老会议事堂 / 试药房 / 下山道 / 山门），每条要么补窗口、要么写 `none`；
- 2 条是「约束装不下」（内门活脉「无令不得入」、试药房「不得外出」），归设计内提示、不计数。

其中至少 3 个（内门活脉·筑基后必回 / 长老会议事堂·试药名额议定处 / 试药房·主角被灌残篇）**会复发**，
所以标「一次性」是模型偷懒，该给窗口。

---

## 3. P20 排期（已定，未开工）

登记在 `docs/plans/prompt-assembly-backlog.md` 的「2026-10-26 四格写入通道」节。评估全文在
`docs/design/architecture/p1-1-worldbuilding-extraction-assessment.md`。

| 期 | 项 | 依赖 | 动 schema | 动 prompt | 排序理由 |
|---|---|---|---|---|---|
| **P20-1** | 能力候选抽取 | 无 | ❌ | ❌ | 唯一「来源轴正确 + 零迁移 + 零 prompt」；顺带产出「候选→采纳」面，供 P20-3 复用 |
| **P20-2** | 秘密宿体 secrets | 先裁「新表 vs 并 M16」 | ✅ m21 | ❌ | 改库 ⇒ 必须等实机验证收口，否则读数被迁移噪声干扰 |
| **P20-3** | 章末后处理提议 | **P20-1 的候选面** | ❌ | ❌ | 幂等 / 中断 / 引文定位 = W6b 那一整套，风险最高，最后 |

**三期的共同底线**：候选**不写库、不进 prompt**，只有作者逐条采纳后才落库；`source='derived'` 的语义必须严格是
「模型提议 + 作者采纳」，不是「模型写入」。理由见评估稿 §4（四种失败形态）。

**P20-1 建议拆两段交付**：1a 确定性解析第 1 维等级表（零模型，等级名 / 升级代价 / 卡点）；
1b 可选 LLM 补 `weakness`（「体系漏洞」是散文），必须走 `generationOutputForPurpose`（判据 CU）且引文精确命中。

---

## 4. 待作者裁定（三条，按影响面排序）

1. **P20-2 形状**：新表 `secrets`（建议）还是并入 M16 `knowledge_states`？
   并入的代价是破坏 M16「键必须可回查定稿」的封闭默认，且抽取漂移会连带污染知情格。
2. **第 4 维模板改不改**：现在写的是「没有时段就**不要写这个字段**」，这句话让「缺字段」同时承担
   「漏写」和「不适用」两种语义 —— 这就是你说的那个「世界观生成的漏洞」。最小改法：改成「没有时段写 `hours=none`」，
   并给分级声明加格式（长期舞台必须给窗口）。
   **⚠️ 撞判据 AO**：你有 `world_building` 全局覆盖版（N1 完整版），改内置模板会被**静默遮蔽**，
   必须同步改覆盖版或先禁用，否则改完「看起来没生效」。
3. **能力抽取要不要 1b**：只做确定性（1a）今天就能用，但 `weakness`（敌人能怎么破）抽不到；
   加 LLM 要引入一次 structured-data 调用与新的候选校验。

---

## 5. 环境与坑（今天新踩的）

- **`dist-electron` 会自己重建，但 ≠ 窗口已换代码**：今天确认 `dist-electron/vector-store-C7s0sfyD.js` 04:56 就含新代码，
  而作者那边「点了刷新没变化」的一半原因是**左栏计数**还在用 `issues.length`（已修），另一半是主进程未重启。
  → 判据：先看进程启动时间（`Get-Process electron | Select StartTime`），再看产物里有没有新字符串。
- **vitest 不做类型检查**：`generation-output-contract.test.ts` 里 `withoutComments` 漏了首参，测试全绿但 `tsc` 报错，
  是上一轮遗留的。改 `src/shared` 之后**必须单独跑 `npx tsc --noEmit`**。
- 测试仍走 Electron ABI：`node scripts/run-tests-electron.mjs <paths>`；electron 侧用例需
  `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID` + `--testTimeout=30000`。
- 浏览器用例走另一套：`npx vitest run --config vitest.browser.config.ts <*.browser.tsx>`（`run-tests-electron.mjs` 找不到它们）。

---

## 6. 已知未修 / 不做

- **`resource_registry` 的抽取不存在**：资源账本走的是「定稿后补扫」（`db:resources` 那条链），不是从世界观抽。
  评估稿 §3 没有把它列进 P20 —— 它的来源轴是定稿，不是设定。
- **物品 / 知情不从世界观抽**（来源轴不成立），已在评估稿判死，不要重开。
- `validateItem` 零重试（角色详情是否给 `maxCompactSingleFallbacks`）仍挂着，等实机验证后定。
- `base-command.ts:383` 的 trim-hash 第三处（`persistComposition` 只在 `length` 时触发）仍未修。
- `.runtime/.cache/novel-quality-modernization/s05-owner-tests.stale-20261026`（435MB）待清理。
