结论：FAIL ｜ 产物：C:\develop\workspace\AI-writer\develop\.batch\night\reports\doubao-oss-readiness.md ｜ 不通过项 5 条

# dsh-file-watch · 开源就绪度审查（只读）

审查对象：`C:\develop\workspace\dsh-file-watch`（git 仓库，4 笔提交，HEAD `4d5d3a7`）。已跟踪文件 7 个：`.gitignore`、`README.md`、`README.zh-CN.md`、`cordis.patch.yml`、`index.js`、`index.test.mjs`、`package.json`。
本轮没有运行任何测试命令，也没有改动该仓库任何文件（工作区里 `.gitignore` 的那处 `M` 是既存改动，见 §1.4）。

**一句话结论：代码本身可以公开（零依赖、职责干净、历史无内部痕迹），但按现状不能直接发——两处内部痕迹要清、安装段对开源读者不可执行、缺 LICENSE 文件、测试覆盖有明显空洞。**

| 项 | 判定 | 一句话 |
|---|---|---|
| 1 脱敏 | **不通过** | 2 处内部残留：`index.js:3` 的悬空内部报告引用；测试里的内部验收编号与「按任务给定」 |
| 2 依赖 | 通过 | 零 npm 运行时依赖，只用 `node:` 内置模块；隐式依赖是宿主 API（计入第 4 项） |
| 3 职责单一 | 通过 | 只做「稳定/标记判定 → 投递给目标会话」，无卡号映射、无跨文件状态机 |
| 4 文档 | **不通过** | 互链与字段齐全 ✔；但安装段不可执行、声明 MIT 却无 LICENSE 文件 |
| 5 测试 | **不通过** | 8 条覆盖主路径；19 个判定分支无覆盖，另有编号跳号 |

---

## 1. 脱敏（不通过：2 条）

### 1.1 命中项（逐条带行号）

| # | 位置 | 原文 | 为什么是问题 | 改法（只描述，不改） |
|---|---|---|---|---|
| P1 | `index.js:3` | `source 依 Session Format v4（生产者自有 kind），取证见 reports/p2-multi-watch.md。` | 指向一个**不在仓库里**的内部报告（`.gitignore:3` 还把 `reports/` 忽略掉了，所以永远取不到）；`p2-multi-watch` 是内部流程命名 | 删掉「取证见 …」半句，或改成仓库内可点开的说明锚点 |
| P2 | `index.test.mjs:4` | `// 假 ctx 形状按任务给定：{ agents: { get: () => ({ followup: (m) => calls.push(m) }) } }` | 「按任务给定」是内部派活语境，开源读者无从对照 | 改成「假 ctx 的最小形状」 |
| P3 | `index.test.mjs:7-13` + `:72/:77/:81/:99/:116/:133/:163/:199` | `// 判定线：` `//   T1 … T2 … T3 … T4 … T5 … T7 … T8`，以及每条 `check('T1 …')` 标签 | 这些 T 编号是内部验收项编号，且 **T6 缺号**（`:13` 直接 T8），等于把内部台账结构漏在开源代码里 | 标签改成行为描述（如 `stable-window: no delivery while writing`），删掉 `判定线` 段或改写为「Covered behaviour」 |
| P4 | `.gitignore:2-3` | `inbox/`、`reports/` | 内部投递目录名与内部报告目录名，开源读者不知为何忽略；`reports/` 这行还是未提交改动 | 合并成一句通用注释，或仅在确实需要时保留 |

### 1.2 已核干净（附证据）

- 全仓（含 `.gitignore`、排除 `.git/`）逐行 grep 未命中：`C:\develop`、`AI-writer`、`.batch`、`night`、`豆包`/`doubao`、真实人名、真实用户路径、任何数字型卡号/会话号。
- git 历史 4 笔提交（`bcb6c0e`、`8ae8695`、`fa6a8f4`、`4d5d3a7`）作者统一 `dsh-plugin <dsh-plugin@example.com>`；`git log --all -p` 全量扫描未命中上述内部字样。
- 会话 id 示例是纯占位符（`README.md:46`、`README.zh-CN.md:40` 的 `session-xxxxxxxx-…`），不可反推真实会话。

### 1.3 一处误报，先排除

README 里两处被 `bot` 关键字命中的行（`README.md:23`、`README.md:53`）命中的是英文单词 **both**（`delivers only if **both** values are unchanged`、`needs both dir and targetSessionId`），不是 Bot 名，判为 grep 假阳性。

### 1.4 状态说明

`.gitignore` 工作区相对 HEAD 多了一行 `reports/`（`git diff` 显示 +1 行），属未提交改动。本轮只读，未动它。

---

## 2. 依赖（通过）

- **零运行时依赖**：`package.json`（共 23 行）没有 `dependencies` / `devDependencies` / `peerDependencies` / `optionalDependencies` 任何一个字段；`scripts` 只有 `test`（`:20-22`）。
- **只用内置模块**：`index.js:5-7` 仅 `node:fs`、`node:path`、`node:crypto`；`index.test.mjs:15-19` 仅 `node:assert/strict`、`node:fs`、`node:os`、`node:path` + 本地 `./index.js`。所以不存在「lockfile 之外要多装一个包」的情况，也不需要 lockfile。
- **但存在隐式依赖——宿主契约**（这一点不判它为「依赖不通过」，因为零 npm 依赖的事实成立；它的实际后果是「装不起来」，所以计入第 4 项）：
  - `index.js:9` `export const inject = ['agents']`（要求宿主提供 `agents` 服务）
  - `index.js:64-73` 用 `ctx.agents.get(id)` 与 `ctx.agents.roots()`
  - `index.js:91` 用 `agent.followup(message)`
  - `index.js:195` 用 `ctx.effect(() => dispose)`
  - `index.js:47-48` 要求消息 `source.kind` 满足 Session Format v4 规则
  这 5 处宿主 API 在 README 里一处都没定义（见 §4.2）。

---

## 3. 职责单一（通过）

- 全文 197 行，只有一条职责：`fs.watch` 事件 → 快照 `(size, mtimeMs)` + 静默计时 → 投递一条消息（`index.js:52-152`）。
- **没有**卡号映射、任务台账、浏览器/网络、跨文件状态机。状态只有两处局部结构：`pending`（每文件待投递快照，`:53`）与 `delivered`（已投递快照去重，`:54`），且都在 `startWatch` 内，按 watch 隔离。
- 配置校验也只围绕「这条 watch 能不能起」（`:171-184`），没有混入业务流程。
- 唯一可议的耦合是第 1 项的注释（悬空内部报告）与第 2 项的宿主契约——都属于「外部耦合」，不属于「职责混杂」。

---

## 4. 文档（不通过：2 条）

### 4.1 通过的部分（先记清楚）

| 检查点 | 证据 | 结论 |
|---|---|---|
| 中英互链 | `README.md:1` `[中文](README.zh-CN.md)`；`README.zh-CN.md:1` `[English](README.md)` | ✔ 双向 |
| 配置示例 | `README.md:40-51`、`README.zh-CN.md:34-45`（两个 watch 的完整 YAML） | ✔ |
| `watches[]` 字段说明 | `README.md:66-68`、`README.zh-CN.md:58-60`（`dir` 绝对路径必填、`targetSessionId` 必填、数组非空） | ✔ 齐全 |
| `stableMs` 说明 | `README.md:69`、`README.zh-CN.md:61`（默认 5000、全局共用、单项不可覆盖） | ✔ |
| `doneMarker` 说明 | `README.md:18-19`、`README.md:71`、`README.zh-CN.md:15-16`、`:63`（末尾 2 KB 内命中即立即投递、默认值） | ✔ |
| 附带的 `message` | `README.md:70`、`README.zh-CN.md:62`（支持 `{file}/{reason}/{size}/{mtimeMs}`） | ✔（但默认文案未说明，见 4.2） |
| 测试说明 | `README.md:73-80`、`README.zh-CN.md:65-71` 均写 `node index.test.mjs`、预期 `8/8 PASS`，与测试实际 8 条 `check` 一致 | ✔ |

### 4.2 不通过项

**D1 · 安装段对开源读者不可执行。** `README.md:36-38` 全文只有一句 "Register the package as a bundle in a profile, then set its config in that profile's patch layer"；`README.zh-CN.md:31-32` 同义。缺三样：
- 宿主的名字与获取方式（全文没有出现过宿主项目名或链接，读者不知道 "profile" 属于谁）；
- 具体安装命令（没有 `npm install` / 放置目录 / `dsh.bundle.patch` 是怎么被读取的，只在 `cordis.patch.yml:1-7` 注释里、而且不在 README 里）；
- `targetSessionId` 从哪来（`:46` 只给了 `session-xxxx…` 占位符，没有一句「在你的宿主里怎么查当前会话 id」）。
按现状，一个没接触过该宿主的读者照 README 走不完。

**D2 · 声明 MIT 但仓库没有 LICENSE 文件。** `package.json:19` `"license": "MIT"`，`README.md:82-84` / `README.zh-CN.md:73-75` 也只写两字 "MIT"；仓库根目录 7 个已跟踪文件里没有 `LICENSE`/`COPYING`（`git ls-files` 可证）。开源发布前必须补一份标准 MIT 全文，并带版权行。

### 4.3 附注（不计入 5 条，但发版前建议顺手做）

- `package.json` 缺 `files` 字段 ⇒ `npm pack` 会把 `index.test.mjs`、`.gitignore` 一并打进包；同时缺 `repository` / `homepage` / `bugs` / `keywords` / `author`，包页会是空的。
- `README.md:70` 只列了 `message` 的占位符，没说默认文案是什么；而默认文案是中文（`index.js:14`），英文 README 的读者第一次收到通知会意外。

---

## 5. 测试（不通过：覆盖不全 + 编号跳号）

### 5.1 现有 8 条与判定逻辑的对应

| 测试 | 覆盖的判定 | 证据 |
|---|---|---|
| T1 持续写 3 秒 0 次 | 静默计时被写入不断重置 | `index.test.mjs:68-74` ↔ `index.js:116-134` |
| T2a 停止写 5 秒恰好 1 次 | 到期复读 stat 且两值未变才投递 | `:76-79` ↔ `index.js:102-112` |
| T2b 再等 1.2 秒仍 1 次 | `delivered` 去重（同快照不重复） | `:98-101` ↔ `index.js:77`、`:123` |
| T4 消息形状 | `buildMessage` 四个字段 + v4 `source.kind` | `:81-96` ↔ `index.js:43-49` |
| T3 DONE 立即投递 | 尾部标记命中即投递（不等静默） | `:112-120` ↔ `index.js:107`、`:111`、`:132` |
| T5 会话未加载 | `agents.get` 返 undefined 时写 warn、不抛 | `:127-137` ↔ `index.js:82-88` |
| T7 双目录不串 | 状态按 watch 隔离 + 目标不串 | `:143-177` ↔ `index.js:52-54` |
| T8 坏目录不拖垮整插件 | 逐条校验 + 跳过并点名 | `:186-207` ↔ `index.js:171-184` |

**没有**测试的判定分支（19 项，全部对应 `index.js` 的具体行）：

| # | 分支 | 位置 | 为什么算「判定」而不是杂项 |
|---|---|---|---|
| B1 | `stableMs` 非有限/≤0 时回退 5000 | `:156` | 配置容错判定，误配会静默变化行为 |
| B2 | `message` 模板替换 4 个占位符 | `:40-42`、`:157` | 唯一改变输出文本的分支，从未测过自定义模板 |
| B3 | `doneMarker` 自定义值 | `:158` | 换标记后「立即投递」是否还成立 |
| B4 | `watches` 非数组 / 空 → warn「未启动」 | `:163-166` | 与 T8「不能整插件不启动」是相反方向，未测 |
| B5 | `dir` 非绝对路径 → 跳过 | `:171-174` | 校验分支 |
| B6 | `targetSessionId` 空/非字符串 → 跳过 | `:175-178` | 校验分支 |
| B7 | `agents.get` 抛错 → warn 继续 | `:67-68` | 容错分支 |
| B8 | `agents.roots` 抛错 → warn 继续 | `:70-71` | 容错分支 |
| B9 | `get` 返回 undefined 但 `roots()` 里有该 id → 兜底命中 | `:69-72` | 这是「会话未加载」的**另一条**通路，T5 只测了 roots 为空 |
| B10 | `followup` 抛错 → warn | `:93` | 投递失败判定 |
| B11 | `fs.watch` 启动失败 / watcher `error` 事件 | `:144-149` | 起不来时的处置 |
| B12 | `filename` 为 null → `listFiles()` 全扫 | `:142`、`:135-138` | 平台差异分支，恰好是 README 没提的 Windows 行为 |
| B13 | 空文件（`length<=0`）与尾部读失败 | `:28`、`:33-34` | 「读完返回 false」的两个早退 |
| B14 | 目录里的子目录被跳过 | `:121` `!st.isFile()` | 只投文件 |
| B15 | 事件后 stat 失败（删除/改名）与到期 stat 失败 | `:120`、`:101` | 文件消失时不投递、不残留 timer |
| B16 | **同一文件第二快照再投递一次** | `:123`、`:77` | T2b 只证明了「不重复」，没证明「内容变了要再投一次」 |
| B17 | `checkStable` 收到过期 state 早退 | `:98` | 旧 timer 与当前 pending 不一致时的竞态 |
| B18 | `dispose` 幂等、`ctx.effect` 注册 | `:57-59`、`:195` | 卸载路径，测试里 `ctx` 没有 `effect` |
| B19 | 标记落在尾部 2048 字节之外 → 应**不**立即投递 | `:12`、`:26` | 这是一个明确的边界语义（README 写了「末尾 2 KB」，但没测过反例） |

另：`index.test.mjs:7-13` 的编号 T1→T8 **跳过 T6**，测试标签里也是（`:133` T5 之后直接 `:163` T7）。作为开源代码，跳号会被读者当成「丢了一条用例」。字符串判定为「8 条」是够的（T2a/T2b 分开计数），但编号体系不连续。

### 5.2 关于「通过」的门槛

本项判定线是「每条判定逻辑都有覆盖」。按上表，19 条分支无覆盖、其中 B9/B16/B19 是**行为语义**层面（不是边角容错），所以判不通过。

---

## 6. 未覆盖 / 不确定（本轮只读的边界）

1. **没有运行任何测试命令**（本轮红线），所以「8/8 PASS」只是按代码判读出的覆盖关系，不是实测结果；B12/B17 这类平台竞态分支尤其只能靠读代码判断。
2. 未实测 `fs.watch` 启动失败与 `filename=null` 的真实触发条件（需要真实宿主/真实 Windows 目录事件），标**不确定**。
3. 未审宿主侧代码（`inject`/`followup`/`effect` 的真实签名）：本报告只按 `index.js` 的调用方式推断契约，宿主侧未读 ⇒ 属「本次读取的文件内未找到」宿主定义。
4. 未评估包名占用、npm 发布流程、CI 配置（仓库里没有 CI 文件）。
5. 未把 `README` 送第三方英文母语复核，语言质量不在本轮判据内。

---

## 7. 附加项

**当前会话 session id**：`38453483473440258`（来源：本会话 agent workspace 路径段；除此之外没有可读的会话标识）。

<!-- DONE -->
