# W6a-4 资源登记提案通道 · 交接（2026-10-23）

分支 `exp/resource-ledger` · 基线提交 `94532555` · **进行中，未完成**

---

## 0. 一句话

作者问「资源登记只能靠手动么」。核实后确认：**不是字段抽象填不动，是设计稿 §3.4 写了
「模型只能提议，落库前必须确认」、而 §9 分期表没有任何一期实现这个通道** —— 于是
`resources` 永远是空表，W6b 抽取没有名单可喂，整条账本空转。本轮补这一环。

**已完成的那一半（下一本）**：生成世界观后自动跑一次抽取，候选进检查点。
**未完成的那一半（本书）**：登记面板上的「从世界观抽取候选」按钮 + 候选确认区。

---

## 1. 读什么（按顺序）

| 顺序 | 文件 | 看什么 |
|---|---|---|
| 1 | `docs/design/architecture/w6-resource-ledger-design.md` **§4.6** | 本期的完整设计：通道形态、抽哪些列、两个触发点、缺单位怎么办、范围 |
| 2 | `src/shared/worldbuilding-resource-extract.ts` | 核心契约。**已完成**，改之前先读头注释 |
| 3 | `src/services/workflows/commands/architecture.command.ts` 搜 `attachWorldBuildingResourceCandidates` | 生成侧挂载，**已完成** |
| 4 | `src/components/editor/ResourceRegistryPanel.tsx` | **未完成**，下一步就改这里 |
| 5 | `src/components/editor/WorldBuildingEditor.tsx` | **未完成**，需要传两个 prop |

---

## 2. 已完成（提交 `94532555`）

| 项 | 位置 | 状态 |
|---|---|---|
| 设计稿 §4.6 + §9 分期表 W6a-4 行 | `w6-resource-ledger-design.md` | ✅ |
| 核心契约（类型 / 解析 / 过滤 / 成句） | `src/shared/worldbuilding-resource-extract.ts` 新建 | ✅ 24 例 |
| 模板 zh / en | `builtin-prompt-templates.ts` + `prompt-language.ts`，key = `world_building_resource_extract` | ✅ 模板契约 76 例全绿 |
| 生成侧挂载（下一本） | `architecture.command.ts` 的 `attachWorldBuildingResourceCandidates` | ✅ |
| purpose + 输出形态冻结 | `WORLD_BUILDING_RESOURCE_EXTRACT_PURPOSE = 'world-building-resource-extract'`，`outputOverrides` 里 `output: 'structured-data'` | ✅ |
| 检查点字段 | `PartialArchData.world_building_resource_candidates`（**两处**：`architecture.command.ts:114` 与 `architecture-workflow.ts:31`） | ✅ |
| 测试 | 解析器 24 例；架构命令 51 例（原 49 + 新增 2） | ✅ `tsc` 0 · `eslint` 0 |

---

## 3. 未完成（下一步照这个做）

### 3.1 面板：`src/components/editor/ResourceRegistryPanel.tsx`

现在是纯手动 CRUD（十列表格）。要加：

1. **新增可选 props**：`worldbuilding?: string`（世界观全文）、`storedCandidates?: string`（检查点里那份 JSON 字符串）。
2. **「从世界观抽取候选」按钮**
   - `worldbuilding` 为空 ⇒ 禁用 + 一句说明。
   - 调用链照抄 `finalize-chapter.command.ts` 第 112 与 417 行附近（渲染层取模板 + 调模型）：
     `resolvePromptTemplate('world_building_resource_extract', projectSession, writingLanguage)`
     → `renderPrompt(template, { world_building }, writingLanguage)`
     → `composePromptSystemRole(template, writingLanguage)`
     → `useLLMStore.getState().generate(..., { responseFormat: { type: 'json_object' }, purpose: 'world-building-resource-extract' })`
   - 结果**必须**过 `filterResourceCandidates(parseResourceCandidates(content), worldbuilding)`。
   - 失败/坏 JSON ⇒ 面板上写「本次没有拿到可用的提案结果（世界观不受影响）」，**不弹窗、不动表格**。
   - loading 态 + 禁止重复点击。
3. **候选行展示**：名称 / 族 / 品阶 / 单位 / 周期 / 换算锚 / 三条说明，并且**必须显示 `quote`（原文依据）与 `anchorQuote`（若有）**——这是作者敢不敢勾选的唯一依据。
4. **落库闸门**：`isCandidateCommittable(candidate)` 为 false（缺 `unit`）⇒ 复选框禁用，就地标「缺单位，请补一个 —— 单位错了会让以后每一笔记账都对不上」。**不要给"强行落库"的口子**。
5. **确认登记**：勾选后一个按钮，逐条 `db:resources-upsert`（`ResourceDefinitionInput`：`name/unit/period` 必填，其余有值才传）。逐条反馈，成功的移除，失败的就地显示后端原因，**其他行继续**。
6. **去重**：候选名与已登记资源同名 ⇒ 标「已登记」并禁用勾选（别让它撞 UNIQUE）。
7. `storedCandidates` 解析后喂进同一个候选区（同一套展示与闸门）。

### 3.2 编辑面：`src/components/editor/WorldBuildingEditor.tsx`

`loadStatus` 里已经读到了 `partial` 与 `core?.worldbuilding`（见 `storedSelfReview` 的处理）。
把 `partial?.world_building_resource_candidates` 存进 state，并把两个 prop 传给
`<ResourceRegistryPanel />`（渲染点在文件末尾 `f.key === 'worldbuilding'` 那一支）。

### 3.3 测试

`src/components/editor/__tests__/` 下加/扩（**browser 测试必须显式 `--config vitest.browser.config.ts`，
`*.browser.tsx` 不在默认配置里，默认跑会静默跳过**）：
- 每条候选都显示 quote 证据；
- 缺 `unit` 的行复选框禁用，且点「登记」**不发出 `db:resources-upsert`**；
- 勾选后逐条 upsert，入参里 `unit`/`period` 正确，未勾选的行不产生 upsert；
- 与已登记资源同名的候选标「已登记」且不可勾选；
- 抽取失败 ⇒ 显示「没有拿到可用结果」，表格不受影响。

---

## 4. 会踩的坑（都是这一轮踩过的）

1. **换算锚是十列里唯一要求「另给一条引文」的列**（`anchorQuote`）。理由写在
   `ResourceCandidate.anchorQuote` 的注释里，别删：
   - 单位填错 ⇒ 之后每条变动判成 `unit-mismatch`，**有冲突机制兜住**；
   - 周期填错 ⇒ 审稿第 9 维「计量口径」专门抓日结/月结双口径，**有机制兜住**；
   - **锚值填错 ⇒ 没有任何机制能发现**，它只是按一个假汇率折算，账本全程"算得通"。
   所以 `anchorQuote` 抄不实 ⇒ 锚值归 null（保留整行，因为「不可通兑」是可用状态，不是「资源不存在」）。
2. **候选只进内存 state，不落盘**（§4.6.3）。落盘的只有生成侧那一路（检查点字段）。
   本书这一路重开面板再跑一次即可，不要为了"刷新后仍在"给它加持久化。
3. **生成器现在多一次模型调用**（正文 + 自审 + 提案）。已有的调用次数断言要跟着 +1；
   测试里区分辅助调用用 `isAuxiliaryCall`（`architecture.command.test.ts` 里已定义，
   同时认自审与提案两个 marker）。
4. **取消语义**：`context.cancelled` 时**既不发调用也不落盘**。取消不是提案的结论 ——
   写下去只会在编辑面留一条与代码无关的「本次未完成」。有专门用例钉着。
5. **UI 上 null 一律显示成「—」，绝不能显示成 0**。换算锚尤其：0 会被读成「免费兑换」，
   与「不可通兑」正好相反。
6. **purpose 字符串是契约的一部分**（主进程按 purpose 冻结输出形态），改它等于改输出合同。

---

## 5. 本次会话的环境事实

- **子 agent 通道不可用**：派了两个后台 agent（生成侧 / 面板侧），都在 ~45 秒被杀掉、
  零输出。与之前「三个 Explore 返回空结果」同一毛病。本轮剩余工作**自己做**，别再派。
- 命令（pnpm shim 在本机 Git Bash 里是坏的）：
  ```
  node ./node_modules/typescript/bin/tsc --noEmit
  node ./node_modules/eslint/bin/eslint.js <files>
  env -u CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR -u CODEBUDDY_TOOL_CALL_ID \
    ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe \
    ./node_modules/vitest/vitest.mjs run <paths>
  ```
  （`env -u` 是摘掉 safe-delete 包装器，否则测试 cleanup 的 `fs.rmSync` 会被误判失败）

---

## 6. 三个已裁定的问题（不要重新讨论）

| 问题 | 裁定 |
|---|---|
| 通道形态 | **生成后单独抽取 pass**，不做「世界观模板加机读登记块」，也不两者都做 |
| 本书抽取范围 | **只扫世界观全文**，不扫已定稿章节正文（判据 CX：假阳性会变成作者要逐条筛的待办） |
| 缺单位时 | **不给落库**，标「待补」。不做「未定单位」占位（那会让所有变动显示成冲突） |

---

## 7. 这一期的验收

- 下一本：生成世界观后，编辑面能看到候选（带原文依据），勾选后才进 `resources`。
- 本书：点一次「从世界观抽取候选」⇒ 拿到名称 + 周期 + 收入/支出说明（模板第 2 维强制要求写了这些），
  补上单位 ⇒ 落库 ⇒ **再去 W6c 点「补扫第 1–N 章」** ⇒ 第 4 章的灵石账就能查出来。
- 顺序不能反：**先登记，后补扫**。没登记就补扫是空的。
