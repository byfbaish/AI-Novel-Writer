**★ 前置闸（已放行）**：admin 已于 2026-11-23 22:29 书面裁「准 A」——抽取对象＝`blueprint.characters[]`，「≥2 次」门槛作废、换成「≥2 字＋台账交叉核对」，匹配单向（登记名逐字包含于蓝图姓名串，不反查）；空间解析器只出解析器不出规则。实施包 §1.4 已同步为裁定结果。**本件可投。**

# 外派派单 · AC2／S2 具名人物登记的层间引用完整性

## 0 必读与确认（先回四行，再开工）

开工前必读：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④本卡相关通道件 `docs/agents/{copilot,workbuddy,doubao,task-board}-channel.md` 中与本次任务对口的一份；⑤派单正文点名的卡面或设计稿。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：是否「工作模式」（不是「对话模式」）、当前模型名与档位（派单点名要求 `DeepSeek v4.1 Flash`，写成「快速」或其它低档一律算不合格）

缺这四行，我不认这件已开工。模式或模型不对，**先停手回报，不许交付**——11-22 豆包就出现新开会话落进「对话模式」＋模型被降成「快速」，产出的东西质量不可信。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不起 Electron 实机，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node node_modules/vitest/vitest.mjs run <单文件>`，或派单点名的 `pnpm test <单文件>`。
- 只改本卡白名单文件，不新增文件，不动 `.batch/*` 任何件；不 push 到 mainline，不 tag，不 `git add -f`，不 `--no-verify`；分支与 push 权限以派单明写为准。
- 改删除语义，不扩白名单，不串别的卡；**一卡一会话**，做完即停，不在同一会话里接下一张。
- **模式闸**：开局必须是「工作模式」＋派单指定模型（默认 `DeepSeek v4.1 Flash`）。落在「对话模式」或被降成「快速」等低档模型，立即停手、回报实际模式与模型，不许用该会话的产出交付。
- 不把「待验」写成「已证实」；无证据不下结论；报告里不许出现「已修好」这类措辞，除非派单明写允许落地。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行是身份头，第四行是 §0 的第四问（模式与模型），缺任一行按可疑件退回。**下面三行除会话标识外逐字照抄，不要自己填卡号或改写 From：**

```
From: AC2-S2-WorkBuddy
To: 大肥鱼@主身
卡号：4027dbef｜会话标识：<本次会话首次开工时间 HH:MM 或 WorkBuddy 会话 id>｜起点：681eeb66bac698fa532af1e8d7b36859478be96f
模式：<工作模式|对话模式>｜模型：<模型名与档位，须为 DeepSeek v4.1 Flash 工作模式>
```

---

## 1 本卡坐标

- 卡号：`4027dbef`｜卡名「AC2 层间引用完整性（具名实体）」｜阶段：群 Goal AC 系 S2
- 起点：`681eeb66bac698fa532af1e8d7b36859478be96f`（完整 sha 见 `git rev-parse` 输出）
- 分支：`card/arch-ac2-s2`（在 `wt-2` 里开；**不要动 develop 主工作区**）
- 产物落点：`C:\tmp\ac2-s2\workbuddy\`（回执、自测原文、变异记录都落这里）
- 实施包（必读，代码逐字照抄）：`.batch/night/staging/ac2-s2/impl-package.md`

## 2 口径六条（admin 与项目总负责人核定，越一条即退回）

1. **锚点只有一处来源**：世界观第 4 维两类登记（`src/services/builtin-prompt-templates.ts:668-672`）。`characters` 表**只作交叉核对**，冲突以登记行为准（ADR `docs/adr/0027-architecture-shape-three-decisions.md:34`，设计稿 `docs/design/architecture/architecture-consistency-design.md:219`）。
2. **设计稿 `:214` 那一行是旧口径**（写「比对 `characters` 表＋`worldbuilding`」），与 `:219` 裁定段相左——**一律以 `:219` 为准**。不得把人物表当权威来源，不得按 `:214` 反过来判。
3. **名单为空必须显式未判**：覆盖度字段加在既有 `ConsistencyPreflightCoverage`（`src/shared/consistency-preflight.ts:260-265`）上，并按实施包 §2 的 `describeNamedEntityCoverage` 补四条文案分支。名单空 ⇒ 不报冲突、不静默通过、必须给出「为什么没判」。
4. **不改写既有语义**：`src/shared/space-time-consistency.ts` 一行都不许动（`:271` 注释、`:286` 全等查表原样保留）；**不纳入别名／简称／错别字**（ADR `:55` 明写不覆盖）；不重复实现全文指纹；两套匹配器**并存不合并**。
5. **抽取对象与匹配方向（admin 22:29 裁「准 A」）**：抽取对象＝蓝图的结构化点名数组 `blueprint.characters[]`（模板强制「完整姓名」，`src/services/workflows/commands/directory.command.ts:243`）；匹配**单向**——登记名**去尾部括注后**包含于蓝图姓名串（覆盖「林昭（主角）」与「老陈」／「老陈（早餐摊摊主）」两种异写），**不反查**「登记了但未被引用」那半边；**双向包含作废**；本卡不做自由文本抽人名（要 NER／别名归一，ADR `:55` 不覆盖），「≥2 次」门槛作废、保留「≥2 字」。`blueprint.characters[]` 里若有**不是完整姓名**的项（空串、纯标点、指代「他」「那女人」、超长混写），一律 **fail-open 跳过**：不报错、不崩、不产 finding（模板只是提示词形状约束，不是编译期保证——项目总负责人 22:36）。
6. **空间解析器只出解析器、不出规则（admin 22:29 裁定）**：`parseRegisteredSpaceNames` 必须带正面用例（证明它不吞【具名人物登记】行）；**本轮不发射 finding，为后续复用预留**（既有的 trim 全等已在报未登记空间名，再叠同类规则就是双报或只多报误报）；**判据只认人物那一半，未使用的导出不算达成**。

## 3 白名单（2 新 2 改，超出一律退回）

| 文件 | 动作 |
|---|---|
| `src/shared/named-registration-consistency.ts` | **新增**（实施包 §2 全文） |
| `src/shared/__tests__/named-registration-consistency.test.ts` | **新增**（实施包 §4，13 用例） |
| `src/services/consistency-preflight.ts` | 改（实施包 §3 的 3a–3d） |
| `src/shared/consistency-preflight.ts` | 改（实施包 §3e：只加两个覆盖度字段与注释） |

**不许新增白名单以外的文件**（不含新测文件之外的新增）。**不许**碰面板 `src/components/dialogs/ConsistencyPreflightPanel.tsx`。

## 4 交付要分清三类东西（回执里分开写）

1. **解析器**：`parseNamedPersonRegistrations`（人物四段行）与 `parseRegisteredSpaceNames`（空间机读行）—— 各自认哪些行、不认哪些行（人物：四段全非空、无 `hours=`／`entry=`、「无」不算；空间：首段是名字且至少一个 `key=value`）。
2. **校验**：`findUnregisteredPersonRisks` —— 守卫顺序（登记空→台账不可用→章号→单字名→豁免）、**单向逐字包含＋去尾部括注**、键 `named:unregistered-person:<小写姓名>`。
3. **用例**：13 条正负用例＋5 发变异，哪条用例证明哪个守卫不是空断言。
4. **显式缺口（必须照实写进回执第 9 项，禁止润色成达成）**：地名侧本轮**仍旧只有既有 trim 全等**（`src/shared/space-time-consistency.ts:286`，注释 `:271`），「逐字包含」**未接线**；`parseRegisteredSpaceNames` 属**未使用导出，不算达成**，它的用例只证明「不吞【具名人物登记】行」。任何把本卡写成「层间引用完整性已达成」的措辞一律退回（项目总负责人 22:36 定，S2 收口时逐条对核）。

## 5 变异靶（逐发单改一处、跑、复原、记原文）

- **M1** 删 `if (registrations.length === 0) return []` ⇒ 用例 4／5 转红
- **M2** 删 `if (!scope.rosterNames) return []` ⇒ 用例 6 转红
- **M3** 把 `coreName()` 改成 `return name.trim()`（去掉去尾部括注）⇒ 用例 3 转红（蓝图「林昭」对登记「林昭（主角）」）
- **M4** 删 `reference.length < MIN_NAMED_ENTITY_LENGTH` 的 `continue` ⇒ 用例 8 转红
- **M5** `namedPersonStableFactKey` 去掉 `trim()` 归一 ⇒ 用例 11 转红（若只去一处仍相等，改去 `toLocaleLowerCase` 并把用例 11 换成大小写断言，报告里写明实际做法）

## 6 自测命令（原样跑，原文进回执）

```bash
node scripts/run-tests-electron.mjs src/shared/__tests__/named-registration-consistency.test.ts
node scripts/run-tests-electron.mjs src/shared/__tests__/space-time-consistency.test.ts src/shared/__tests__/consistency-preflight.test.ts
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
pnpm check:fast
git status --porcelain
```

> 字面 `pnpm test` 在 worktree 里会触发依赖校验 purge node_modules（`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`，`pnpm.mjs:249560`）——本组已裁定采信等价入口 `node scripts/run-tests-electron.mjs`；**不要**为此 `pnpm install`。

自检还要给两行：

```bash
grep -n "space-time-consistency" src/shared/named-registration-consistency.ts src/services/consistency-preflight.ts
grep -c "db:character-roster-read" src/services/consistency-preflight.ts
```

第一行必须**零命中**（本卡不许 import／改动空间—钟点模块）；第二行给实际条数。

## 7 回执九项（缺项按未交处理）

1. 四行头（见 §0.2）
2. 提交 sha、父 sha、分支名、`git status --porcelain` 原文
3. `git show --stat` 原文（确认只有白名单文件）
4. 三类改动（解析器／校验／用例）各自要点
5. 13 条用例的 `Tests N passed (N)` 汇总行原文（**不接受** `-t` 过滤跑）
6. 五发变异逐发的失败数原文＋复原后汇总行
7. §6 四条命令的原文与退出码（`TEST_EXIT=`／`TSC_EXIT=`／`CF_EXIT=`）
8. 两行自检输出（`space-time-consistency` 零命中／`db:character-roster-read` 实际行号）
9. 已知不足与未做项（照实写，不许把「没做」写成「不需要」）

## 8 时间盒与成本

受理后 40 分钟交件；超时先回一句卡在哪。派单时点按现行模型策略走（非高峰 DeepSeek V4.1 Flash）。
