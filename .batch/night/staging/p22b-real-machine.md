# P22b 真机验收脚本（U1–U8）· 2026-11-14

> 前置：P22b 终审 PASS。本脚本由主人在本机执行，每一步只回一句结果；执行中若某步不对，立即停止并把现象贴回来，不自行改配置。

## 0. 谁执行、群怎么办

重启会关掉 DSH，本群随之消失。所以：

- 本文件是**唯一现场记录**，每步结果由执行者追加到 `## 执行记录`。
- 重启后的核对由重启后新会话读本文件继续；主人只需要按提示回三句话。

## 1. 预检（不重启，先做）

1. 仓库干净与提交：
   `cd C:\develop\workspace\dsh-handoff-relay; git log --oneline -1; git status --porcelain`
   期望：HEAD 以 `8d562a0` 开头（P22c 合入后），porcelain 空（输出 `CLEAN`）。
2. 刷新 profile 副本（**必做**，否则页面加载旧 `client.js`）：
   `dsh plugin --profile desktop install`
3. 核服务端字节与仓库一致：
   `git hash-object client.js` 与 profile 下 `node_modules\dsh-handoff-relay\client.js` 的 `git hash-object` 应相同。
4. 备份配置（**必做，不是可选项**）：
   `Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml" "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml.bak-p22b"`，回执贴备份文件名。

> 为什么要备份：schema 的默认值会在保存时一并写进 yml（P22b spike 的写后样例里就多了 `targetSessionId: ''`、`exact: true`）。这是「脏但无害」——`index.js` 用 `hasId = typeof rawId === 'string' && rawId.trim() !== ''` 判空，空串等同未填；有标题时按标题优先、id 只做兜底。但 yml 会被改写，所以必须有备份，失败时能一行还原。

## 2. 重启（主人操作）

1. 完全退出 DSH 桌面端（不是最小化）。
2. 重新启动 DSH 桌面端，等界面正常出来。
3. 回一句：**「起来了」**（或「起不来 + 现象」）。

## 3. 看卡（U1，主人肉眼）

进入 `设置 → 插件 → 插件配置`，找 Handoff Relay 那块。

- 能否看到**三列表头**（目录 / 目标会话 / 完成规则）+ 「新增一行」？回「有卡」或「无卡」。
- 无卡时按顺序取证再停：① 控制台有没有 `web boot:` 报错或 `slot entry crashed`；② `设置→插件→已安装` 里点进本插件，是否有「配置」入口；③ 贴 `relay.log` 最后 5 行。

## 4. 界面逐条（U2–U4、U7–U8，主人肉眼）

| # | 动作 | 期望 | 记录 |
|---|---|---|---|
| U2 | 点某行「选择会话」，输入关键词 | 弹出搜索框，列表按显示名过滤，只剩匹配项 | |
| U3 | 选中一个会话后回看该行 | 行内显示标题 + 目录（cwd） | |
| U4 | 检查整张卡 | **没有任何要求输入 Session ID 的框** | |
| U7 | 某行完成规则选「正则」，填 `(a+)+`，点保存 | 只该行标红并拒绝，其他行仍可保存 | |
| U8 | 看保存提示 | 文案是「已保存，重启宿主后生效」，没有「立即生效」 | |

U3 保存后再补一条：贴 `cordis.patch.yml` 里该 watch 的原文（应含 `targetTitle` 与 `exact: true`，原有 `targetSessionId` 保留）。

## 5. 再次重启（U5、U6）

1. 退出并重开 DSH（第二次）。
2. 回「又起来了」。
3. U5：卡片里该行**仍显示同一个会话名**（不需要手改），且 `relay.log` 启动段该 dir 显示 `resolved` 或「命中 1 条」。
4. U6：把一个不再需要的历史会话删掉（或改名）后再重启 —— 该行进入失效态，文案「目标会话已失效（原名称「<标题>」未找到），请重新选择」，其余行照常。

> U6 有破坏性，放最后；不想做可跳过并记「未执行」。

## 6. 回滚（任一步 FAIL）

1. `Copy-Item cordis.patch.yml.bak-p22b cordis.patch.yml -Force`
2. `git checkout de69c8f -- client.js index.js`（回到 P22a 状态）
3. `dsh plugin --profile desktop install`，重启一次，记「已回滚 + 哪条 FAIL」。

## 执行记录

| 时刻 | 步骤 | 结果 | 备注 |
|---|---|---|---|
| 11-14 06:12 | 预检 1 | HEAD `8d562a0` / porcelain `CLEAN` | 大肥鱼代跑 |
| 11-14 06:12 | 预检 2 | 免做 | 仓库与 profile `client.js` blob 同为 `771e7c40…`，install 非必需 |
| 11-14 06:12 | 预检 3 | 备份已建 `cordis.patch.yml.bak-p22b`（10,591B，与原件同字节） | 回滚用这一份 |
| | 2. 重启 | | 主人操作 |
| | 3. 看卡 U1 | | 主人操作 |

## 真机现场（11-14 06:28，主人截图）

- 入口位置：`设置 → 插件 → 已安装 → README 页最下方「包含的组件」→ 点组件名`（宿主统一组织方式，其他插件一样）。README 须写明此路径。
- **U1 PASS**：卡片渲染出 `stableMs`、三列表头（目录 / 目标会话 / 完成规则）、`新增一行`、`保存`、`放弃修改`。
- **三处异常（同一疑因：槽位有渲染权、无条目读写上下文）**：
  1. 行底提示 `Host 未提供该条目`
  2. 会话搜索「没有匹配的会话」（搜「大肥鱼」等真实标题也为空）
  3. 无表单提交落点
- 现场纪律：定性前**不点保存、不改配置**，卡片留着当现场。
- 取证：P24 `.batch/night/cards/p24-rowconfig-datachannel.md`（只读，30 分钟，派 developer）。报告 `.batch/night/reports/p24-rowconfig-datachannel.md` 5,555B / MD5 `A9D2D95241BE56C9242B88DCC1014A61`。

## 今晚结论（11-14 07:00，负责人定 + 我转达）

- **不发版、不打 tag、不回滚代码、不做盲改**；对外 npm 仍 0.3.2。
- 坏的是设置卡的**数据通道**（读快照 `status="unavailable"`、写不进去）；插件核心（7 条 watch 投递）完好，改 `cordis.patch.yml` 的 `watches:` 照样生效。
- 根因指向宿主 `describe()` 未把 `dsh-handoff-relay` 列入 namespaces（`dsh-settings/lib/index.js:417-419` 要求 `runtime.Config` + fiber state=2 + `volatileForm` 非空）；已排除 key 传错、schema 跨实例两条。
- 待做：白天在**隔离 profile** 用与 `@goodandready/dsh-agent-loop-guard` 的 A/B 定死根因（最可疑差异：AG 静态声明 `@deepseek-ai/schemastery` 依赖，我们动态 `createRequire` 且失败静默）。
- 真机红线：卡可以留着看，**不要点保存**。
- 未执行：U2–U8 其余条目（等数据通道修好再验）。

## A/B 首选项（11-14 07:05，负责人定；明天白天隔离 profile 用它做实验）

1. 读配置改走宿主白送的 `props.form.state`，写走 `props.form.mutate`，不再自取 `controller` 快照。
2. 会话列表改用注册时闭包捕获的 `ctx`，不用 `props.ctx`。
   - **待自证**：`client.js:467` 是 `inject: () => ({ ctx, controller })`，`client.js:244` 读的 `props.controller` 正是这个 inject 的返回值，不是宿主 props 里的字段；因此「`props.ctx` 是 undefined」目前缺证据，且与「卡能渲染 ⇒ inject 已通」相冲突。
3. `plugins.row.config` 只保留为「已安装列表行上的配置入口」，不做数据主通道。
4. 仍列为第一条要钉的事实：宿主 `describe()` 的 `namespaces[]` 里到底有没有 `dsh-handoff-relay`（`:273` 那句文案只由 `namespaces.find(ns)` 为空触发）。
5. 社区可抄的两条：会话枚举读快照 `ids`/`byId`（0.1.7 起为 `{ids,byId,phase,projectionsBySession}`）；取服务用「整名优先 `ctx.get('x')` + 缺了降级显示」，不要把可选服务写进顶层 `inject`（顶层 inject 是装配期门控，缺一项 `apply()` 根本不跑）。搜索可直接用宿主 `@deepseek-ai/dsh-session-query`（SQLite FTS5）。
   - 参照：[dsh-session-control](https://www.npmjs.com/package/@goodandready/dsh-session-control)、[dsh-session-url](https://github.com/hy-sde/dsh-session-url)、[dsh-project-memory CHANGELOG 0.5.8「面板拿不到会话」](https://github.com/00080000/dsh-project-memory)

## A/B 定案（11-14 07:10，宿主 asar 实证）

`settings` 服务的 `describe()` 是**宿主侧纯服务端计算**，与浏览器里挂了哪个 slot 无关：

```js
describe(options) {
  const active = new Set();
  const descriptors = this.ownerContext.configEditor.configuration().flatMap(({ entry, inherited, override }) => {
    const schema = this.schema(entry);
    if (schema === void 0 || entry.fiber === void 0 || entry.fiber.runtime === null || entry.fiber.state !== 2) return [];
    const form = volatileForm(schema);
    if (form === void 0) return [];
    active.add(entry.id);
    ...
    this.revisions.set(entry.id, { raw, revision, ns: entry.options.id, autoGenerate });
```

⇒ `namespaces` 只由三件事决定：`schema(entry)` 非 undefined、`entry.fiber.state === 2`、`volatileForm(schema)` 非 undefined；`ns` 取 `entry.options.id`（即 profile patch 的条目 id，不是包名）。

结论：
1. **座位不是变量** —— 挂 `plugins.bundle.config` / `plugins.row.config` / 两处同挂，namespaces 完全相同，搬座位白烧一次重启窗口。且 `bundle.config`（`:6022`）只传 `{view}` 不带 `form`。
2. 真变量只有两个：**`runtime.Config` 是否 undefined**（我们动态 `createRequire` + try/catch 吞错）或 **`entry.fiber.state !== 2`**。
3. `volatileForm` 只认 `schema.meta.volatile`（或对象下某个子字段带 volatile），非 volatile 字段不进表单 —— 若我们给 `watches` 未加 `.volatile()`，`volatileForm` 可能返回 undefined，同样导致条目不被列出。**这条与第 2 点并列，明天一并打日志。**

明天顺序：只改 `client.js` 数据源（`props.form.state` / `props.form.mutate` + 闭包 `ctx`）→ QA 首验 → 一次真机复看 U2/U3。座位问题不试。
