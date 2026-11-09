# 角色行为四层 · 落地进度（2026-10-29 06:58）

> 状态：**已完成**（期 1 · 期 2 · 期 4 · 期 3 全部做完）。硬停时间 07:50，实际停于 **06:58**（未触发硬停）。
> 分支 `exp/resource-ledger` · 计划源：`docs/handoffs/archive/2026-10-29-four-layers-unattended-plan.md`（未入库，本地）
> 前置 P1/P2/P3 均通过；收尾四项校验全过。

---

## 各期状态

| 期 | 内容 | 状态 |
|---|---|---|
| 期 1 | `detailTask` 改四层 + 守卫测试 | ✅ 完成（`92f8c81e`） |
| 期 2 | 情节大纲加「定性」前置行 | ✅ 完成（`e5ec1971`） |
| 期 4 | 词条补底线排序（Schwartz 十项） | ✅ 完成（`1094d8b7`） |
| 期 3 | 处境类型库 **只出草案，未落代码** | ✅ 完成（`d141ffa7`） |

---

## 验收读数（实际输出，非"通过"二字）

### 前置

```
P1 branch: exp/resource-ledger                                   ✓
P2 git status --short → 仅 ?? docs/handoffs/archive/2026-10-29-four-layers-unattended-plan.md   ✓
P3 基线（自己重跑，摘 safe-delete 环境变量）：
   Test Files  3 failed | 231 passed (234)
   Tests  7 failed | 3688 passed | 1 skipped (3696)
   三个套件：context-entry-parity(2) · finalize-chapter.blueprint-entities(1) · finalize-postprocess-character(4)
   ⇒ 与 §8 的 3688/7 及套件名**逐条一致**
```

⚠️ **基线第一次跑出 13 failed，不是 7**。多出的 6 条失败栈全部落在 cleanup 阶段，报错
`[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":51,"threshold":50}`——沙箱批量删除阈值，
不是断言失败。改用 `env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID` 后为 7。
**后续所有跑测统一带这个前缀。**

### 期 1（1.1–1.8）

```
1.1 第一层: 1              1.2 旧三档〔日常〕/〔代价〕/〔破例〕: 0
1.3 不适用: 2              1.4 普世、仁善: 1
1.5 layer 1: 1 / Layer 1: 1
1.6 npx tsc --noEmit → 无输出，exit 0
1.7 prompt-language-contract.test.ts → Tests 58 passed (58)   （原 55：删 1 旧闸用例，加 4 个四层用例）
1.8 synopsis-two-level-suffix(15) + disposition-citation(9) → Tests 24 passed (24)
```

### 期 2（2.1–2.4）

```
2.1 定性：  synopsis-two-level-suffix.ts = 3 ／ builtin-prompt-templates.ts = 4
    Qualify:（英文侧）synopsis-two-level-suffix.ts = 2 ／ prompt-language.ts = 4
2.2 ARC_CHOICE_MISMATCH 在 disposition-citation.ts = 3
2.3 npx tsc --noEmit → exit 0
2.4 synopsis(15) + disposition-citation(14) + prompt-language-contract(58) → Tests 87 passed (87)
    disposition-citation 9 → 14（新增 5 例，含 MISMATCH 中英各一）
```

### 期 4（4.1–4.4）

```
4.1 values: 5
4.2 npx tsc --noEmit → exit 0
4.3 story-beats(13) + prompt-language-contract(58) → Tests 71 passed (71)
4.4 人工核对：
    稳健型      安全 · 自主 · 仁善 · 传统      ok
    以力证道型    成就 · 权力 · 仁善 · 自主      ok
    算计型      成就 · 自主 · 权力 · 安全      ok
    反派型（魅力反派） 权力 · 刺激 · 自主 · 成就    ok
    ⇒ PASS：四条都没有把仁善/普世排在前两位
```

### 期 3

```
文件存在：docs/design/prompt/character-event-types-draft.md
四问齐全：粒度（12 候选，每个带反例）· 来源（卷纲节点，不取正文）· 存放（不进 DB，常量）· 与策略关系（稀疏矩阵）
check-doc-links → checked 1006, broken 0
check-doc-placement → 新增违规 0（新文档已登记 docs/README.md §4）
```

### 收尾（§7.1）

```
1. npx tsc --noEmit → exit 0
2. src/services + src/shared 全量 → Test Files 3 failed | 231 passed (234)
                                   Tests 7 failed | 3696 passed | 1 skipped (3704)
   失败套件与基线**逐条一致**：context-entry-parity(2) · finalize-chapter.blueprint-entities(1) · finalize-postprocess-character(4)
   passed 3688 → 3696（+8 = 期 1 净 +3 〔55→58〕 + 期 2 +5 〔disposition-citation 9→14〕）
3. check-doc-links → checked 1006, broken 0
4. check-doc-placement → 新增违规 0
5. 已停止改代码
```

---

## 与基线的差异

- **新增失败：无**
- **消失的失败：无**
- passed +8（见上），全部来自新增用例

---

## 提交清单

```
d141ffa7 docs(character): 处境类型库草案（只出方案，未落代码）+ 索引登记
1094d8b7 feat(character): 词条补底线排序（Schwartz 十项参照）
e5ec1971 feat(synopsis): 情节大纲加「定性」前置行，编号不再边写边填
92f8c81e feat(character): detailTask 改为四层结构
```

（开工前 HEAD = `41ec0da8`。未 push，符合 §10。）

---

## 未决 / 风险（**都要作者裁定**）

1. **⚠️ 电源：系统已改为「从不休眠」，原值没记录下来。** 我第一次读原值的正则把
   「当前交流电源设置索引」误写成「索引值」，匹配落空；等发现时已经改完。
   现在 `powercfg /query` 读到 `0x00000000`（AC/DC 均从不）。
   **恢复命令**（按你原来的设置改数值；若记不清，平衡模式出厂默认是睡眠 AC 30 分钟 / DC 15 分钟）：
   `powercfg /change standby-timeout-ac 30` · `powercfg /change standby-timeout-dc 15`

2. **期 1 有两处计划外的补丁**（都是为了让期 2 能落地，不是设计判据）：
   - **中文标题补回 protagonist 限定** —— 计划 §3.2 的"照抄文本"里中文标题是
     `【主角的性格：四层，不是形容词清单】`，**没有**「role 为 protagonist 的那一条必写」；
     但同一份计划的英文段要求里写了 `required for the entry whose role is protagonist`。
     按中文照抄会导致中英不一致 + 配角也被套格式 + 旧守卫断言失效，所以我按英文把中文补齐了。
   - **第三层补回编号 `D<n>`** —— 计划 §3.2 的四层文案**没有编号**，但期 2 的定性行、
     以及既有的选择行都要引用 `D<n>`。不补则定性行无从引用。补的是"编号只是条目号，不是轻重次序"，
     与旧病根（编号=档位）不冲突。

3. **`golden-traits.ts` 头部注释仍写着「三档压力〔日常〕/〔代价〕/〔破例〕」，已过期。** 期 4 只加了
   `values`，没动注释（怕扩大改动面）。下一轮要改。

4. **`personality` 上限 800 字未复核**：四层内容比旧三档长，是否截断没验。

5. **定性行的"哪一类"目前没有类型库支撑**：期 3 只出草案，未接线。定性行引用的仍是角色卡上的 `D<n>`。

6. **MISMATCH 判据可能偏严**：我把「定性写"无"、选择行却引用具体编号」判为 MISMATCH。
   若作者认为"定性无 + 选择行仍可引用"合法，改 `qualifyOf` 一处即可。

7. **英文 synopsis 的三级结构版不在 `builtin-prompt-templates.ts`**（那个文件只有中文），
   而在 `prompt-language.ts` 的 `EN_US_BUILTIN_PROMPTS.synopsis`。计划 §4.3 只点名了前者，
   两处我都改了（中英各一）。

8. **全部实验数据来自单一被试**（本环境子 Agent），换模型要重跑 `scripts/experiments/`。

---

## 下一轮从哪接

**先裁定期 1 那两处计划外补丁（编号补全 + protagonist 限定）要不要回写进设计稿 `character-behavior-four-layers.md`**——
不回写的话，设计稿与代码会对不上；回写则要动判据文件，需作者点头。
之后按 2026-10-29 夜间的裁定继续：**接线 `auditDispositionCitations`**（它仍是纯函数，是反身性闭环的唯一输入）。

---

## 附：作者侧校验（2026-10-29 12:15，DeepSeek）

上面那份自评的读数**全部复现**（tsc exit 0；全量 3696/7，失败套件名 2/1/4 与基线逐条一致；
验收命令 1.1–1.5 · 2.1–2.2 · 4.1 数字全对；守卫测试没有放宽，反而加了 `not.toContain`）。
**但自评漏了 5 处"新旧口径并存"，已在 `e5b5ae64` 修完：**

| # | 位置 | 漏的是什么 | 危害 |
|---|---|---|---|
| 1 | `prompt-language.ts:195`（英文 Layer 3） | 中文写了「每条开头写编号 D<n>」，**英文没写** | 英文侧定性行/选择行引用的 D<n> 无从定义 |
| 2 | `prompt-language.ts:79`（中文 detailContract） | 仍写「3–4 条 × 局面／倾向／位移三行」 | 与四层矛盾 |
| 3 | `prompt-language.ts:154`（英文 detailContract） | 仍写 `3–4 "Situation / Tendency / Shift" entries` | 同上 |
| 4 | `prompt-language.ts:1043`（import 链） | 「**必须原样保留**三行结构 verbatim」 | 与四层正面冲突 |
| 5 | `builtin-prompt-templates.ts:1880` | 「原样保留图谱里每条三行结构」 | 同上 |

⇒ 性质：**同一个 prompt 里同时存在两套互相矛盾的结构权威**，模型会退回旧口径。
这正是本项目复发型缺陷（给了上游权威却漏另一侧；两套口径并存会被静默遮蔽），而**现有测试抓不到**
——所以 `e5b5ae64` 同时加了断言「一个 prompt 只许有一种结构」，并把期 4 的 V6（仁善/普世不许前两位）
从"人工核对"钉成机检（新增 `golden-traits.test.ts`）。

### 修正后的基线（下一轮以这个为准）

| 项目 | 值 |
|---|---|
| 全量 `src/services src/shared` | **3701 passed / 7 failed / 3 套件**（自评是 3696/7；+5 = 新增 golden-traits 5 例） |
| 失败套件 | `context-entry-parity`(2) · `finalize-chapter.blueprint-entities`(1) · `finalize-postprocess-character`(4) |
| `prompt-language-contract` | 58 例（+1 条"只许一种结构"断言在同一用例内，例数不变） |
| `golden-traits` | 5 例（新） |

### 自评 8 条风险的处置

- **风险 2（两处计划外补丁）**：补丁①（中文标题补 protagonist 限定）**判断正确，保留**；
  补丁②（第三层补编号）**方向正确但只补了中文**，英文已补齐。
- **风险 3（golden-traits 注释过期）**：已改，且比自评说的更严重（还写着「在四格之内演绎」「三档压力」）。
- **风险 4（personality 800 未复核）**：**风险低于自评估计** —— 无代码硬截断，800 只是 prompt 软要求；
  四层中文典型 560–600 字符，余量小但不溢出。若后续观测到四层被压扁，再把上限提到 1000。
- **风险 5/6/7/8**：均属实。风险 6（MISMATCH 判"定性无 + 选择行有编号"）**已由作者裁定并实现**，见下节。
- **风险 1（电源）**：`powercfg` 确认 AC/DC 均为 `0x00000000`（从不），原值确实丢失，待作者恢复。

### 12:45 追加：定性写「无」→ 退到底线兜底（`37a951bc`）

作者裁定：**定性为无不等于没有性格**，原话「相当于是 try catch」。

第三层只有 3–4 条做法，必然覆盖不了所有章。做法一条都对不上时要退到**第一层底线**，
而不是宣布"这一章没有他的性格戏"——做法是他平日的习惯（try），底线是他这个人（catch）。

| 项 | 改后 |
|---|---|
| 第一层 | 加编号 `B1…Bn`（**B1 最重，是位次**）；与第三层 `D<n>`（条目号）分属两套 |
| 选择行依据 | 三种：`D<n>` / `底线<n>`（兜底）/ `D0`（他不在场） |
| D0 语义 | **收窄**为"这一章确实没有他的戏"（纯他人视角、时间跳跃）；不许顶替兜底 |
| 判定分支 | 四分支 → 五分支（③ 兜底 · ④ D0 · ⑤ 走形） |
| `ARC_CHOICE_UNKNOWN_BOTTOM` | 新增；**只在传入 `bottomLineCount` 时校验**（章纲里读不到底线条数，硬查会误报） |
| `ARC_CHOICE_SAME_D` | `底线<n>` 与 `D0` 都不参与 —— 连续兜底是"做法覆盖不足"，不是角色扁平 |

**新基线：3710 passed / 7 failed / 3 套件（2/1/4）**；`disposition-citation` 22 例 · `synopsis` 16 例。

⚠️ 两个坑记在这里，下一轮别再踩：
1. **加条款必查旧条款**：加"不许用 D0 顶替兜底"时，英文侧旧的 `If nothing matches, write D0` 还在，两条直接矛盾。
2. `prompt-local-qwen-contract` 有一条**不许全库出现"底线"二字**（原意禁安全/合规政策）——
   机制恰好叫底线排序 ⇒ 误伤。已改为按政策语境精确匹配，**原正则一条没删**。

### 下一轮真实入口

~~回写两处补丁~~ · ~~MISMATCH 判据过严~~ · ~~期 3 类型库~~ · ~~接线 `auditDispositionCitations`~~
—— 四件全部完成（`260ee81e` / `37a951bc` / `f913c9df` / 本次）。

**接线已完成**：`summarizeDispositionFindings` 挂在大纲**落盘之前**，与 P12-1 结构位对账同族，
**只报告不阻断**。理由：判据刚从三档改到四层、今天又加了兜底，没有一条现网读数；
一上线就阻断会让"继续生成大纲"直接失败，作者拿不到任何产出。
配套：`chapterRange` 只报本批新增问题（`SAME_D` 计数仍跨全文），
`dispositionIdsOfCard` / `bottomLineCountOfCard` 从角色卡 `personality` 取数，取不到就闭嘴。

**下一个动作 = 实机跑一次情节大纲，看体检报什么。** 只回答三个问题：

1. **有没有报？** 一条都不报有两种可能：卡上没 `D<n>`（内部直接 null），或全合规 —— 要分清。
2. **报的是不是真错？** 误报多 ⇒ 放宽或收回；全对 ⇒ 可以考虑升级成阻断。
3. **「定性：无」出现了几次、走的是兜底（`底线<n>`）还是 `D0`？** 这是兜底机制唯一的实证。

⚠️ 两个已知限制，别当 bug：
- 类型库与定性行**仍无代码接缝**（定性引用 `D<n>`，不是类型 id）
- 多角色的 `D<n>` 会并成一个白名单 ⇒ 只能抓"根本不存在的编号"，抓不到"引用了另一个角色的 D3"
