# 外派派单（豆包）· PLANUI S4 · O1 单元内逐章事件进度水位（卡 58188c1c）

## 0 必读与确认（先回四行，再开工）

开工前必读五件：①仓内 `AGENTS.md`；②`README.md`；③`docs/agents/worktree-parallel.md`；④通道件 `docs/agents/doubao-channel.md`；⑤本卡设计稿 `docs/design/architecture/o1-unit-event-progress-design.md`（190 行）与实施包 `.batch/night/staging/s4-o1/impl-package.md`（**333 行／35,465B／`sha256 f51ac0120081e02a348a37222a13e9487430a0cc5ff221888c9d7df8a8a90beb`**；只读 §0.3、§1 现状、§2 白名单、§3 口径、§4 判据、§5 变异、§8 不做）。

> ⚠️ 设计稿 §3.2 那两句话（「N ＝ 该章落盘时单元内已写章数」「写到第 6 章时 N=6」）**是算术错误**：`k` 与 `N` 同步增长 ⇒ `floor(k·M/N)=M`，而合法编号只到 `E(M-1)`；实施包 §0.3 给出口径与实算原文（分母 `b = to - from + 1` 带起点偏移 `s0`、上界钳 `M-1`）。**以实施包为准，不按设计稿 §3.2 字面实现。** 设计稿 §6.4「不新增表」仍有效（本卡不建表）。

回四行再动手：

1. 读了哪几份（路径）
2. 各自当前版本或日期
3. 据此要遵守的三条口径
4. **当前模式与模型**：必须「工作模式·本地电脑」（不是「对话模式」）；模型一行写「未自证，见渠道读数」——模型由联络人贴 `node scripts/doubao/doubao.mjs markers` 原文取证，你不必自证，也**不许**自己写一个模型名充数

缺前三行我不认这件已开工；模式不对**先停手回报，不许交付**。

## 0.1 跨 agent 红线（机器注入，直接确认，不要为此去读文档）

- 不碰宿主设置（音量／亮度／电源／网络／时区／输入法／通知），不装卸软件，不改注册表与服务启动项，不弹窗、不抢焦点。
- 不 `pnpm install`，不切 node ABI，不跑全量测试，不跑 `test:browser`／`test:node`；自测只准文件级：`node scripts/run-tests-electron.mjs <单文件…>`。
- **本卡没有任何 `[live]` 判据**（不碰主进程、不碰 DB、不改请求数）⇒ **不许起 Electron、不许跑实机脚本、不许调真实模型**。判据全在 `[static]`／一个 `[mock]`（纯字符串渲染）。
- 只改 §2 白名单那 7 项，不新增白名单外文件（含任何新测试文件），不动 `.batch/*` 任何件，不 `git add -f`，不 `--no-verify`，不 tag。
- **必须新开会话**：不得复用任何既有会话（含 S3 P6 及任何 WorkBuddy 旧会话）；复用旧会话的产出不采信。
- **模式闸**：开局必须是「新工作任务 ＋ 本地电脑」。落在「对话模式」或档位被降，立即停手、回报实际模式，不许用该会话的产出交付。
- 一卡一会话，做完即停，不在同一会话里接下一张。

## 0.2 回执头（缺则判可疑）

回执固定四行，前三行身份头，第四行模式与模型，缺任一行按可疑件退回：

```
From: S4O1-Doubao
To: 大肥鱼@主身
卡号：58188c1c｜会话标识：<新会话首次时间或会话 id>｜起点：cbbe82c3
模式：<工作模式·本地电脑>｜模型：未自证，见渠道读数
```

回执正文另起一行固定写：**「只写盘，未提交」**（本卡禁止任何 git 写操作，见 §0.4 第 4 条）。

## 0.3 步骤 0 · 起点闸门（开工第一件事是核它）

前提：分支已由**豆包联络人在投前创建并检出**（`git -C C:/develop/workspace/AI-writer/wt-2 switch -c card/s4-o1-event-progress cbbe82c3`）。**创建分支也是 git 写操作，不归你做**——你到场上时分支应已存在。

开工第一条命令（三项原文必须贴回执）：

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall
```

判据：分支名逐字 `card/s4-o1-event-progress`、HEAD 逐字 `cbbe82c3`、porcelain **0 行**。**任一项不符 → 立即停手**：不写文件、不 `git switch -c`、不 `checkout`、不 commit，回执只写三项原文与停手原因。

> 本机有两套检出：`AI-writer-wt-1`（HEAD `89ec7014`）与本卡所在的 `AI-writer-wt-2`。豆包项目 chip 常显示 `AI-writer-wt-1`。**本卡所有 git／文件操作一律带绝对路径 `C:/develop/workspace/AI-writer/wt-2`**；若 `rev-parse` 回 `89ec7014`，就是走错树，立即停手回报。

## 0.4 豆包通道准入（逐条必守，缺一条即停手回报）

1. **模式必须是「新工作任务 + 本地电脑」。** 对话模式没有本地文件权限，只会回「我无法读取你本地磁盘文件」（`doubao-channel.md:149`／`:331`）——那不是模型变笨，是模式错。开局先 `node scripts/doubao/bootstrap.mjs` 新建线程。
2. **顺序不能反：新建线程 → 切「本地电脑」→ 最后切档位。** 新建线程会把档位重置回「中」（`:148`／`:337`）；对话模式下档位 chip 只显示「快速」（`:167`），看到「快速」先怀疑模式而不是模型。
3. **项目定位用绝对路径，不靠「项目」chip 猜**（同 §0.3 的 `wt-1`／`wt-2` 提示）。
4. **禁一切 git 写操作（本卡硬性，含 `add` 与 `commit`）。** 提交由豆包联络人代做：你只把文件写到盘上，联络人 `git add <点名路径>`（不用 `-A`）＋ `git commit -m "O1-a: …"`。因此禁止 `add`、`commit`、`switch`、`checkout`、`restore`、`reset`、`stash`、`clean`、`push`、`merge`、`rebase`、`tag`——**一条都不许**。C1-b 已有两笔越线提交（`41daa79c`、`8a42a566`）记在外派纪律里，本卡重犯按整卡退回。读操作（`rev-parse`／`status`／`diff`／`log`／`show`／`grep`）不受限。
5. **豆包没有工具层硬拦截。** 红线全靠你自己守、事后验收核对，故：①每条 `git`／`node` 命令的原文输出贴进回执；②收工 `status --porcelain -uall` 会列出你改过的 7 项文件——**这是预期**（本卡就是只写盘），不要为此去 commit、也不要手工清理或回退；判据是「列出的路径全部落在 §2 白名单内」且 `rev-parse --short HEAD` 仍是 `cbbe82c3`（HEAD 未动即证明你没提交）。
6. **串行。** 一个实例一个窗口，同一时刻只跑一个任务（`:377`）；本卡执行期间不得并派第二个任务。
7. **命令语法按 PowerShell 写。** 若终端是 PowerShell，`| wc -l` 不可用，等价写法：`(git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall | Measure-Object -Line).Lines`；两者择一把**原文**贴回执。
8. **证据措辞纪律。** 没读到的只能写「本次读取的文件内未找到」，**不许写「全仓没有」**（`:308`）；测试条数与 tsc 结果原样粘贴，不许总结成「全部通过」（`:315`）；判据跑不成就写「未跑成 + 报错原文」，不许用别的证据顶。

---

## §1 任务一句话

单元模式每章多输出一行 `进度：E<n>`（累计水位），并把这套水的**计算、解析、判定**做成纯函数；同时在既有「单元弧位块」末尾注入一行「本单元事件进度：共 M 步…本批 N 章，第 k 章末应落在 E a–E b」——**不新增模板变量、不改请求数与 cursor、不建表、不碰 UI**。一笔写盘（提交由联络人代做）：`O1-a:` 主题。

---

## §2 白名单（7 项：2 新增 / 5 修改）

> 除下列 7 项外，任何文件改动都算越界。**不许自建第 8 个文件，包括测试。** 每项的导出面、签名、插入锚点、numstat 硬上限见实施包 §2，本处只列清单。

### 新增（2）

1. `src/shared/o1-event-progress.ts` —— 纯函数（`unitEventSteps`／`eventBandOf`／`lastDeclaredStep`／`parseProgressLine`／`enforceEventProgress`／`renderEventProgressHint` ＋ 三个类型）。只可 import `./arc-position` 的 `splitMinorSteps` 与 `../shared/writing-language` 类型，**不许** import electron／react／ipc。
2. `src/shared/__tests__/o1-event-progress.test.ts`

### 修改（5）

3. `src/services/prompts/synopsis-two-level-suffix.ts` —— ZH `:29-35` 与 EN `:135-141` 各加一条第 6 行清单项 ＋ 同时改「除这些行以外…」那句；`:37`／`:143` 禁覆盖行原文**一字不改**。numstat ≤ `8/4`。
4. `src/shared/arc-position.ts` —— `renderUnitArcPositionBlock` 加第 6 个可选参 `progress?: { batchSize: number; startStep: number }`（块尾追加一行）；`withProjectedUnitArcGuide` 加第 7 个可选参透传。numstat ≤ `20/4`；不传参时两函数输出**逐字不变**。
5. `src/services/__tests__/synopsis-two-level-suffix.test.ts` —— **只追加**，既有 16 条一字不改。
6. `src/shared/__tests__/unit-arc-position.test.ts` —— **只追加**一个新 `describe`，既有 `:30`／`:51`／`:82`／`:134` 四个不动。**只加一条 `toContain` 不算完成**：必须同时断言 (a) 不传参时块内无「事件进度」、(b) 传参时提示行在返回串**末尾**（`endsWith(hint)` ＋ 末行逐字等于 `renderEventProgressHint(...)` 的返回）、(c) 块内既有四行原文仍在且提示行只出现 1 次。三条缺一即打回。
7. `src/services/workflows/commands/architecture.command.ts` —— 两处：①在 `:13`（`from '../../../shared/arc-position'`）**之后新增一行** `import { lastDeclaredStep } from '../../../shared/o1-event-progress';`（不能塞进 `:13`，源不同）；②调用点 `:3660` `? withProjectedUnitArcGuide(`（6 实参，`writingLanguage,` 在 `:3666`）之后新增第 7 实参 `{ batchSize: to - from + 1, startStep: lastDeclaredStep(sourceExpected.synopsis) ?? 0 },`；不许写 `:36xx`；numstat ≤ `16/2`。

---

## §3 口径（六条，逐条照做；细节以实施包 §3 为准）

1. **「进度：」是唯一允许的第 6 行**：`钩子：` 从「最后一行」降为「倒数第二行」，`进度：E<n>` 占最后一行，**两句必须同笔改**；只加一条清单项，不加解释段／示例；新行文本里不许出现 `{{`。EN 同步 `Progress: E<n>`。
2. **步数 M 唯一取法**：`unitEventSteps(span.midMinors)` —— 复用既有 `splitMinorSteps`（`arc-position.ts:95-102`），小弧 `text` 切不出 ≥2 段时该小弧计 1 步；**不许再写一份 `split(/→|->/)`**。`M < 2` ⇒ 不声明水位（注入行 `''`、判定 `[]`）。
3. **分母是 `batchSize`＝本批章数**（`to - from + 1`），**不是** `maxChapters`、不是「已写章数」；`j` ＝章在本批内的序号。再加**起点偏移** `startStep = s0`：取 `lastDeclaredStep(sourceExpected.synopsis) ?? 0`，钳到 `[0, M-1]`（`s0` 只从落库大纲的最后一条声明读，不建表、不缓存）。实现里 `grep -c "maxChapters"` 与 `grep -c "frozenN"` 都必须为 0。
4. **区间**：`raw = s0 + j·(M-1-s0)/b`，`lower = max(s0, min(M-1, floor(raw)))`、`upper = max(s0, min(M-1, ceil(raw)))`；`j = b` 时上界恒 `M-1`。**`upper` 已钳到 `M-1`，不许再写成 `M`**（`EM` 是不存在的步号）。「每章最多推进 1 步」只在 `b ≥ M-1-s0` 时成立，别当断言。
5. **EV-1..4 全部 fail-open**，只出提示、不阻断、不改请求；只核声明不核正文；缺行＝未声明（跳过该章，不顺延）。**EV-1 的两个布尔量各自算**：`isUnitLastBatch` ≡ 本次是单元模式批次（`unitContext !== null`，`architecture.command.ts:3509-3514`；本仓一批即单元收口，`:4011` `advanceUnitCursor` 恒推进）；`lastChapterWritten` ≡ `backfill.to >= to`（`:360-371`、`:4004`）；`unitComplete = isUnitLastBatch && lastChapterWritten`，为 false 时不出 EV-1。**本卡不接线调用**（判定期在生成之后），只交纯函数＋单测。
6. **注入行一条、进块末、零新变量**：`renderEventProgressHint` 返回**一行**中文（en 同义），只出现在单元弧位块最后一行；一条请求只注入一次；数字全由入参算，实现里不许出现 `10`／`4096`／`3072`／`32768` 字面量。

---

## §4 判据（J1、J1b、J2–J9，逐条给命令；原文见实施包 §4）

| # | 层 | 判据摘要 | 证据 |
|---|---|---|---|
| J1 | [static] | `unitEventSteps` 四条边界（空／多小弧／无箭头／`undefined`） | o1 单测汇总行 |
| J1b | [static] | `lastDeclaredStep`：无声明 ⇒ `null`；多行取**最后一条**；`进度：E2`／`进度:E2`／`Progress: E2`／前后空白都认；负例 `进度:E`、`进度：EX`、`进度：E`、`进度：-1`、`进度：E 2` ⇒ `null`；前导零 `进度：E03` ⇒ `3` | o1 单测汇总行 |
| J2 | [static] | 折算表（`s0=0,M=4,b=10`：`j=1 [0,1]`、`j=4 [1,2]`、`j=10 [3,3]`；`s0=3,M=4,b=10`：全 `[3,3]`；`s0=0,M=6,b=3`：`[1,2] [3,4] [5,5]`）＋全枚举 `0≤s0<M≤12`、`1≤b≤10` 断言 `s0 ≤ lower ≤ upper ≤ M-1` 且 `upper−lower ≤ 1`；`j=b` ⇒ `upper=M-1` | 同上 |
| J3 | [static] | EV-1..4 各 2 条边界（含 `unitComplete=false` 的两种来源各一条、`upper=M-1` 时不存在 EV-2 触发值、`M<2`、缺行、乱序先排序） | 同上 |
| J4 | [static] | 指纹不变：`promptRenderSignature` 与 `synopsisInputFingerprintParts(...).combined` 写死常量逐字相等 ＋ 内置 `systemSuffix` 未变 ＋ **负用例**（塞一段 suffix 进临时模板 ⇒ 签名必变） | 同上 |
| J4b | [static] | ZH 含 `进度：E<n>` 次数 1、EN 含 `Progress: E<n>` 次数 1、两者仍含原禁覆盖行、`{{` 计数不变 | suffix 测试汇总行 |
| J4c | [static] | 冻结语义（三个入参各一条）：同参重复调用逐字相同；`batchSize` 10 vs 8 的 `j=2` 区间必不同；`startStep` 0 vs 1 的 `j=1` 区间必不同（`s0=1,M=4,b=2` ⇒ `[2,2]`）；`grep -c maxChapters` = 0、`grep -c frozenN` = 0 | o1 单测汇总行 |
| J4d | [static] | 未写章不预判：`declarations` 只到 `j=6`、`b=6` ⇒ 无第 7 章告警；`unitComplete=false` 不出 EV-1 | 同上 |
| J5 | [mock] | 注入行渲染与**落点**：传 `{batchSize:3,startStep:0}` ⇒ `block.endsWith(hint)` 为真、末行逐字等于 `renderEventProgressHint(...)`、匹配 `^本单元事件进度：本单元共 \d+ 步（E0–E\d+）；本批 3 章，起点 E\d+；第 1 章末应落在 .*终态 E\d+。只核声明，不阻断生成。$`、提示行只出现 1 次、既有四行原文仍在；不传 ⇒ `not.toContain('事件进度')` 且既有 4 条 `toContain` 仍绿；en 同测 | unit-arc-position 汇总行 |
| J6 | [static] | 不新增模板变量：suffix 的 `{{` 计数与 `cbbe82c3` 相同；o1 模块 `{{` 0 命中、无禁用字面量 | 两行 grep 原文 |
| J7 | [static] | 白名单与零越界：`porcelain` 7 行全在白名单内；`diff --numstat` 满足各文件硬上限；diff 内无 `purpose`／`synopsis_unit_cursor`／`covered_to` 新增行 | 三条原文 |
| J8 | [static] | `node scripts/check-fast.mjs` ⇒ `CF_EXIT=0`；`node node_modules/typescript/bin/tsc --noEmit` ⇒ `TSC_EXIT=0` | 两行原文 |
| J9 | [static] | 既有三文件基线（改动前实测 `Tests 97 passed (97)`、`EXIT=0`）改动后 ≥ 97＋新增条数且绿；suffix 测试 16 条条条仍在 | 前后两行汇总行 |

**没有任何 `[live]`**：本卡不碰主进程／DB／请求数。若你认为某条需要实机，**先在回执里写「未跑成 + 理由」，不许自行起实例**。

---

## §5 变异（M1／M2／M3／M3b 必发，M4 可选；每发转红并写红掉的用例号）

| 号 | 靶 | 改法 | 期望转红 |
|---|---|---|---|
| M1 | `eventBandOf` 上界 | `Math.ceil` → `Math.floor` | J2（`M=6,b=3` 的 `j=1` 由 `[1,2]` 变 `[1,1]`）、J3 |
| M2 | EV-2 比较符 | `reached > upper` → `reached >= upper` | J3 |
| M3 | 起点偏移 | `eventBandOf` 里把 `startStep` 当 0 | J2（`s0=3,M=4,b=10` 那组转红）＋J4c |
| M3b | 注入行分母 | `batchSize` 换成 `stepCount` | J5（文案正则不符）＋J2 |
| M4（可选） | 禁覆盖行 | 新行改成 `覆盖：进度 E<n>` | J4b |

变异纪律：改回原文用**手工编辑**（禁 `checkout`／`restore`／`stash`／`reset`），改回后 `porcelain` 必须回到 7 行清单且 `diff --numstat` 与变异前逐字相同。

---

## §6 命令（逐条原文贴回执）

```
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --abbrev-ref HEAD
git -C C:/develop/workspace/AI-writer/wt-2 rev-parse --short HEAD
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall
node scripts/run-tests-electron.mjs src/shared/__tests__/o1-event-progress.test.ts
node scripts/run-tests-electron.mjs src/services/__tests__/synopsis-two-level-suffix.test.ts src/shared/__tests__/arc-position.test.ts src/shared/__tests__/unit-arc-position.test.ts
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-fast.mjs
git -C C:/develop/workspace/AI-writer/wt-2 diff --numstat
git -C C:/develop/workspace/AI-writer/wt-2 status --porcelain -uall
```

（这些命令在 `C:/develop/workspace/AI-writer/wt-2` 下执行；`run-tests-electron.mjs` 与 `check-fast.mjs` 用相对路径即可，工作目录必须是 `wt-2`。）

---

## §7 交付与回执

- 一笔写盘：`O1-a: 单元内逐章事件进度水位（suffix 第 6 行＋纯函数＋弧位块注入）`（提交由联络人代做）。
- 回执：四行身份头 ＋「只写盘，未提交」＋§4 每条判据的**命令原文与末行结果**（J1–J9 一条都不能缺，缺哪条写「未跑成 + 原因」）。
- 回执必须含：`rev-parse --short HEAD` = `cbbe82c3`、`porcelain` 的 7 行清单、`diff --numstat` 九宫格原文、两处测试汇总行、`CF_EXIT`／`TSC_EXIT`。
- 产物目录约定（联络人用）：本卡回执与变异记录由你在正文里贴，不需要另建目录写文件。

---

## §8 不做（越界即打回）

1. 不建表、不动 `electron/migrations/*`、不动 `desktop-registry`／`project-storage`／portable 三件、不动 `CURRENT_DESKTOP_SCHEMA_VERSION`。
2. 不碰编辑器 UI（`NarrativeThreadEditor.tsx` 及 browser 测试）、不做提示条、不做水位 UI 展示。
3. 不改内置模板（`prompt-templates*`）、不改 `synopsisInputsFingerprint`／`promptRenderSignature`、不改 `{{step_guidance}}`。
4. 不改请求数／purpose／cursor／batch 大小；不调真实模型；不起 Electron。
5. 不写「小弧已废」这类口径（`naming: 'volume'` 只影响措辞、不改解析，见 `src/shared/arc-position.ts:142-151`；旧项目小弧仍在，`:49`／`:1372-1375`）；不新造术语。
6. 不改 `docs/*` 任何文件（含设计稿文件头）。

---

## §9 已处理的三处冲突（不要在实现里再犯）

1. **路径**：suffix 在 `src/services/prompts/synopsis-two-level-suffix.ts`（不是 `src/services/` 下）——派单原文的旧路径不存在，见实施包 §0.1。
2. **第四处同笔不是 `prompt-language-contract.test.ts`**：该文件对本 suffix 零断言（`grep` 0 命中），第四处改为 `src/shared/__tests__/unit-arc-position.test.ts`。见实施包 §0.2。
3. **设计稿 §3.2 的 N 口径作废**：分母取 `batchSize`＝本批章数、带起点偏移 `s0`、上界钳 `M-1`；按设计稿字面实现会得到 `[M,M]` 恒满水位（实施包 §0.3 有算术原文）。若你对这条有异议，先停手回报，**不许两种都写**。
