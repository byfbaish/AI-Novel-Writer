# P22b · 设置卡界面：三列自定义行 + 会话选择器 + configForms 写回

估时：90 分钟。执行方：豆包（代码类，按口径手动指定 DeepSeek V4.1 Flash）。联络人：豆包联络人。

仓库：`C:\develop\workspace\dsh-handoff-relay`（HEAD 应为 P22a 合并后的提交）

## 0. 规格来源

实现以 `.batch/night/essays/p22-interaction-spec.md` 为准（§3 布局、§4 交互、§5 不做、§6 U1–U8、§7 已裁定）。规格与本节冲突时以本节为准。

## 1. 前置事实（developer 已确认，直接照用，别再自己找）

- **渲染层没有 `sessionTitle` 服务**（那是宿主侧，`index.js:359 sessionTitleOf` → `ctx.get('sessionTitle')`）。渲染层枚举与搜索一律用 `sessions` 服务：
  `ctx.sessions.list.getSnapshot().byId[id] = {id, displayTitle, title, cwd, running, blank, …}`；
  搜索框按 **`displayTitle`** 本地过滤（`search()` 搜的是消息内容，不是标题）。副行用 `cwd`。
- **`agent-not-found` 的语义**（用于失效态判定，不要写成「id 不存在」）：该 id 不在当前宿主实例的 agents 注册表里，即未装配/未存活；`index.js:381 findAgentById` → `agents.get(id)`，再 `agents.roots()`，取不到即 `{found:false}`；全程不查磁盘、不看 cwd。
- 槽位挂点 key：`dsh-handoff-relay#dsh-handoff-relay`。
- **写回唯一入口 = `configForms` 保存**（落 `cordis.patch.yml`）；宿主只给带 `.volatile()` 的 `Config` 条目出表单、也只接受这些路径写入 ⇒ `index.js` 必须同批加 `export const Config`。
- 设置卡写入本身会被 Loader 热重载，但 relay 目前只在启动时读一次 config，所以「重启宿主后生效」是**现状**，按这句话写文案；不要把「立即生效」写进界面。
- **写回 API 签名**（`dsh-client-ui-settings/lib/client.js`）：`configForms.get(entryId)` 取到后，`set(field, value)`（`:1140`）/ `unset(field)` / `mutate(ops, expectedRevision)`（`:1165`）；`ops = [{op:'set'|'unset', path:[...], value?}]`，返回 boolean；底层 `remote.settings.mutate(ns, ops, rev)`，最终原子写 `cordis.patch.yml`（`dsh-config-editor:24-26`、`:69`）。宿主只给 `.volatile()` 路径出表单，写非 volatile 路径直接抛（`dsh-settings/lib/index.js:418`、`:505-506`）。
- **不会有第二套自动表单**（developer 已确认）：`dsh-client-ui-plugin-manager/lib/client.js:5790-5799` 的 `data-plugin-config` 区只有一句 `renderSlot("plugins.item",{view:"page",form},{only:item.id})`，页面自身没有表单组件；`form` 只是 `{state, mutate}` 数据（`:6919-6927 formFor`）。画什么完全由我们组件决定。
- 但 `Config` 与两处槽位**必须同批注册**：包详情页的配置区取决于注册了 `plugins.item`，行卡「配置」入口取决于 `ledger.rows.has(rowConfigKey(pkg,rowId))`（`:7002-7012`）——只有 `Config` 不注册行槽位，入口根本不出现。
- schema 写法：`Schema.array(Schema.object({...})).volatile()` 是**推断、非已证**——宿主 asar 里「数组对象 volatile」零命中，只有 `z.dict(z.object({...})).volatile()`（`dsh-llm-deepseek-account/lib/index.js` 的 `modelOverrides`）与 `z.array(z.string()...).volatile()`（`indexes`）两例可抄。
- **所以第 0 步必须先做一次最小实测（spike）**：写一条 watch → 触发重载 → 读回，确认「数组对象 + volatile」能存能读且结构不变。通过就按结构化 schema 做；不通过再退 `Schema.any().volatile()`，并在报文里写清「退到 any + 原因 + 校验改由 UI 承担」。**不许不实测就写结论。**
- 运行时是 box，读前必须逐层 unwrap，照 `@goodandready/dsh-agent-loop-guard/lib/index.js:20-33` 的 `plainConfig()`（`while (typeof v === 'function') v = v(); v = v.get()`），否则拿到的是函数或 `{get}`；加用例证明 unwrap 前后 watch 行为一致。

## 2. 必做

1. 卡片注册到 `plugins.row.config`，key = `dsh-handoff-relay#dsh-handoff-relay`；`client.js` 导出 `inject` **只留 `["slots"]`**，`configForms` 用 `ctx.get` 取、取不到再延后（P17 已有形态，不重写）。
2. 三列表头：`目录` / `目标会话` / `完成规则`；每行右端 `删除`；底部 `新增一行`（默认目录空、目标空、完成规则=文本 + `<!-- DONE -->`）。
3. 目标会话列：按钮「选择会话」→ 弹层内搜索框（按显示名过滤）+ 列表项显示 `标题` 与《cwd》副行；选中后行内显示标题 + 目录。**界面上不得出现任何要求输入 Session ID 的输入框**（U4，截图取证）。
4. 写回字段：`targetTitle` + `exact: true`，若该行原有 `targetSessionId` 则保留作兜底；不写 `targetCwd`（不存在该字段）。
5. 完成规则列三态：`文本` / `正则` / `不使用`；选正则时输入框下**常驻**三句约束（只扫尾部约 4KB、固定 `m` 标志且 ≤200 字符、禁嵌套量词）；正则编译失败只标红该行，其他行不受影响。
6. `保存`：校验全部行 → 失效行保留旧值并**列出哪几行没过校验（行号 + 原因）**，其余行照常写入 → 提示「已保存，重启宿主后生效」。`放弃修改`：恢复到最后一次保存值。
7. `client.js` 的 apply 全路径不得抛异常：渲染、事件、保存失败都要 catch 并降级成一行错误文案（崩过一次，这里不接受「理论上不会抛」）。

## 3. 硬约束

- 动 `client.js` + `index.js` + `index.test.mjs` 三个文件。`index.js` 只允许加**配置 schema 导出**（`export const Config`，含 `.volatile()`，覆盖 `watches` 与 `stableMs` 两个字段），**不得改** watch 解析、投递、重扫、warn 判定任何一行（P22a 刚改完，动了就回退）。
- 起因（developer 2026-11-14 阻断结论）：宿主只给带 `.volatile()` 的 `Config` 条目出表单、也只接受这些路径写入；relay 现在没有 `export const Config`，所以"只动 client.js"不成立。
- schema 优先保持结构化（`watches` 是对象数组，字段 `dir`/`targetTitle`/`targetSessionId`/`exact`/`done`），不许无故退化成字符串 blob。只有 spike 证明「数组对象 + volatile」不可行时才允许退 `Schema.any().volatile()`，且必须在报告首段写明实测过程与放弃理由——不许拿推断当已证。
- 零新增依赖、零构建步骤：`client.js` 保持可直接被宿主加载的单文件 ESM，禁止 JSX、禁止 import 第三方。
- 禁止按 DSH 版本硬分支；旧宿主没有 `configForms` 时降级为只读提示，不许抛错。
- 不许写 yml 文件、不许 shell 出去。

## 4. 验收判据（逐条要能核）

- B0 spike 证据：贴「写入一条 watch → 重载 → 读回」的完整原文（写前 yml 片段、写后 yml 片段、读回对象），并说明最终用的是结构化 schema 还是 `Schema.any()`。这一步不过，后面的都不算。
- B1 静态：`grep -n 'plugins.row.config' client.js` 命中；`inject` 仍为 `["slots"]`；`grep -n 'export const Config' index.js` 与 `grep -n 'volatile()' index.js` 各命中；`package.json` 无新增 dependencies；版本保持 0.5.0。另贴 `git diff --numstat` 证明 `index.js` 只多了 schema/读时 unwrap 那几行、没碰解析与投递段。
- B2 测试：`node index.test.mjs` 全绿并贴末行读数；新增用例至少覆盖「三态切换」「正则编译失败只红该行」「保存列出未通过行」三条。
- B3 反证：把 `client.js` 回退到 `74f4cc1` 版本跑同一套新测试必须红，贴 FAIL 数。
- B4 渲染：用与 P15 同款桩执行一次渲染，断言三列表头、行节点、`选择会话` 按钮都在，且 `Session ID` 字样在渲染输出里 0 命中。
- B5 真机项（不在本次首验）：U1–U8，尤其 U5 重启后不用手改仍能投、U7 正则 `(a+)+` 只红该行。
- B6 提交纪律：`git add` 点名两个文件，禁 `-A`；porcelain 空；报告末行 `<!-- DONE -->`。

## 5. 文案统一（规格里两处不一致，以此为准）

失效行文案 = **「目标会话已失效（原名称「<标题>」未找到），请重新选择」**（§4.4 版本），U6 里那句短的作废。

## 6. 交付物

- 代码提交（`client.js` + `index.js` 的 Config 段 + `index.test.mjs`）
- 报告 `.batch/night/reports/p22b-settings-ui.md`（含 B0–B4 命令原文与输出）
- 信号文件 `.batch/night/signals/doubao/p22b-settings-ui.done`

**信号文件是交付的一部分，不是可选项**：报告落盘后必须在同一分钟内写出该 `.done`，写不进就在回执里明说「信号未写 + 原因」。P22a 就是漏写这一步，导致联络人 14 分钟后才发现交付（2026-11-14 事故）。联络人也不许只等唤醒，到估时点必须主动查盘。

## 7. 明确不做

会话搜索按 id / 按目录过滤 / 收藏；历史与投递日志；正则测试器；行内拖拽；批量导入导出；多播。
## 8. 投递指令（联络人 2026-11-14 05:2x 投前核对，按最新盘面重述；与上文冲突时以本节为准）

投前基线（我实跑）：HEAD `de69c8f`（P22a 合并后）、`node index.test.mjs` = `TOTAL: 123/123 PASS` / `RESULT: PASS`、`git status --porcelain` 空。

三条硬要求，按顺序执行：
1. **第一步是 B0 spike，不是写界面**：写一条 watch → 触发重载 → 读回，贴「写前 yml / 写后 yml / 读回对象」三段原文。数组对象 + `.volatile()` 未经验证；不过就退 `Schema.any().volatile()`，并在报告首段写明实测过程与原因。没实测就写结论 = 未通过。
2. **改动范围**：只动 `client.js`、`index.js`（仅加 `export const Config` + 读时 unwrap）、`index.test.mjs`。**禁止动 P22a 刚改的 watch 解析 / 投递 / 重扫 / warn 任何一行**，动了就回退。
3. **信号文件**：报告落盘后同一分钟内写 `.batch/night/signals/doubao/p22b-settings-ui.done`（绝对路径 `C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao\p22b-settings-ui.done`，三行：报告路径 / 提交 SHA / `<!-- DONE -->`）。写不进就在回执里立刻明说「信号未写 + 原因」。报告末行同样写 `<!-- DONE -->`。

模型：负责人指定 DeepSeek V4.1 Flash（代码类）。联络人 CLI 无 `--model` 参数、模型芯片点不开，实际档位以回执 `model=` 为准，请如实回传。

提交纪律：`git add` 点名文件，禁 `-A`；提交后 porcelain 必须空；回执照旧四行 + 模型芯片 + HEAD/字节/MD5。
