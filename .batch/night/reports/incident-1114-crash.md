# 事故登记：DSH 整机崩溃（疑似与 dsh-handoff-relay 有关）

- 首次登记：2026-11-14 00:07（大肥鱼，群 admin）
- 报告人：主人。原话要点：「交接的插件被我暂停了，因为发生了一个恶性 bug，导致 DSH 整个崩溃。目前已通过第三方手段将该插件关闭了。@AI writer总负责人 你找人调查一下这个。」
- 定责状态：**未定性**。本文件只登记事实与我方的冻结动作，崩因归 developer 取证、QA 判定。

## 1. 已核实的事实（我这边只读核过）
- 崩溃日志两份，时间相邻 18 秒：
  - `C:\Users\<用户名>\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\crash-2026-11-13T16-02-28-685Z-host.log`（32,870B，mtime 2026/11/14 00:02:28）
  - `...\crash-2026-11-13T16-02-46-409Z-host.log`（31,550B，mtime 00:02:46）
- 插件仓库 `C:\develop\workspace\dsh-handoff-relay`：HEAD `8c5c073`，`porcelain` 空。
- **本地已存在 tag `v0.4.0`**（谁打的、是否已 push，待 developer 报；push 前须停）。
- 时间线对照：23:42 P11 报告落盘（新增 `client.js` 9,021B + `dsh.client` 注入）、23:58 P12 提交 `8c5c073`、00:02 两次崩溃。P11 引入「浏览器半身」是本次发版里唯一的新增运行时面。
- 宿主进程：核时未列出（DSH 已由主人重启，当前 GUI 端口 53206）。

## 2. 冻结动作（本文件生效即执行）
1. **停 npm publish**。npm 发布不可撤回，只能 deprecate；崩因未定性前不发布（产品经理与我同判）。tag/push 也只做可审计动作，不做发布。
2. **不动线上配置**：不重启、不改 `cordis.patch.yml`、不投探针（插件已由主人用第三方手段关闭，任何自动恢复都可能把崩溃带回来）。
3. **不删现场**：两份 crash log、`delivered/`、`relay.log`、`~/.dsh/dsh-handoff-relay-state.json` 一律保留。
4. **接线全断**：插件停用 ⇒ 群窗↔私聊窗桥、两个 signals 通道、P8 投递全部不可用。对外承诺的相关链路不得再声称「已通」。

## 3. 连带失效（已确认）
- 明早 **10:05 的唤醒任务 `dsh-wake-20261114-1005-6263`** 依赖「写文件进 `wakeup-inbox` → relay 投递 → 唤醒 developer」。relay 停用后这条链必断：文件会留在原地不投，等于没叫。
  - 处置：改为我人工兜底（10:00–10:10 手动点名 developer 要甲/乙结论）。台账 `trigger-gap.md` 同步。
- `dsh-wake-20261114-1800-5718` 同理，届时按插件是否恢复决定。

## 4. developer 取证四答（00:08–00:10 到齐，我只登记不代判）
1. **崩溃点**：`dsh: fatal load failure: Error: cannot get property "settings" without inject`，两帧 `at mountSettingsCard (…/dsh-handoff-relay/index.js:668:31)` / `at new apply (…/index.js:974:8)`。两次崩溃栈完全相同。**不指向 `client.js`，与 `dsh.client` 注入无关。**
2. **7 条 watch 已加载完**：`:971`/`:972` 启动日志排在 `:974` 之前，最后一条为 `启动 7/7 个 watch；stableMs=5000`，其后无输出。
3. **崩溃前最后一条 relay 日志**＝上面那条启动行。
4. **`v0.4.0` 已 push**（developer 00:06 做，在停发指令到达之前）：tag 对象 `935622c`、peeled `8c5c073`；master `fe19581..8c5c073` 已推；**`npm publish` 未执行**，registry latest 仍 0.3.2。
   - 我的复核（只读）：本地 HEAD `8c5c073`、porcelain 空、`git rev-parse v0.4.0` = `935622c`、`v0.4.0^{commit}` = `8c5c073`，与 developer 所报一致。
   - **远端已改记为实测**（00:14，我自己走 GitHub 公开 API 核的，`git ls-remote` 走 443 仍不通）：`GET /repos/byfbaish/dsh-handoff-relay/git/refs/tags/v0.4.0` → `sha=935622c0a423fed2ea1256e80ba566035cad7942`、`type=tag`；`/git/ref/heads/master` → `8c5c073d090154094c479650e7355958cedc7c6e`。与本地逐字一致。
   - 公开渠道复核（我实测）：`registry.npmjs.org/dsh-handoff-relay/latest` → `version=0.3.2`、`gitHead=fe1958112bcdb9b80db5c6e89fb392342d21f510`，即仍是崩溃前的版本。
- 机制（developer/QA 一致）：`index.js:10` `export const inject = ['agents']`，`:668` 读 `ctx.settings` 未声明 → cordis 加载期同步抛错；`:974` 为 `void mountSettingsCard(...)` 无 catch → 升级为 `fatal load failure` → 宿主 exit 1。
- 附带项：`schemastery` 在插件目录 `ERR_MODULE_NOT_FOUND`，修好注入后设置卡只会走 warn 分支（不崩）。
- 修复方向已由负责人开 P13 卡：`ctx.get('settings')` + 整段 try/catch，**不把 `settings` 写进 inject**（与 QA/联络人建议的 `inject=['agents','settings']` 不同，以负责人卡面为准）；另加严格 ctx 冒烟测试（Proxy 拦截未声明属性即抛）。

## 4b. 发版口径（负责人 00:10 已定，两条登记）
1. **`npm publish` 全程未执行**，registry `latest` 仍 `0.3.2` ⇒ 公开渠道不存在崩溃版，不需要 deprecate。
2. **`v0.4.0` tag 与 master 均保留在 `8c5c073`**，不撤 tag、不回退 master，作为「已发布 tag 不含崩溃版」的审计锚点；修复前进，**版本号走 `0.4.1`**。
   - 理由（负责人原话要点）：P11 的改动是要修好继续用的，回退等于把设置卡与三次重扫全扔了；且插件已被主人停用、registry 也装不到坏版。
   - 风险备注（我保留意见不反驳）：公开仓库 master 仍会崩，按 master 直接装的人会中招；`0.4.1` 发布后需在 README/发布说明里标明「0.4.0 不可用、请用 0.4.1」。
   - 遗留待办：`v0.4.0` 这个 tag 永远指向坏提交，将来若要「0.4.0 也干净」仍需主人拍板（移动已公开 tag 属审计动作）；当前不处理。

## 5. 恢复口径（沿用产品侧建议，待负责人裁定）
先定性崩因 → 再决定是否回退 0.3.2 → 恢复后 watch 目录保持为空、只放一个探针，避免把存量重放一遍。

## 6. 修复进度登记（大肥鱼，只记事实）
- 00:11:21 P13 派豆包；00:17:37 收口：HEAD `3e9abd6`（`c55d7f1` 修 ctx 未声明服务、`3e9abd6` 补严格 ctx 测试），porcelain 空（我 00:18 复查一致）。
- 报告 `.batch/night/reports/p13-settings-inject-crash.md` 12,011B / 00:17:20，读数 99/99。
- 重启交互脚本 `.batch/night/staging/restart-interaction-script.md` 3,668B / 00:17:17，现场记录 `restart-progress.md` 272B / 00:17:47（我用 Get-Item 核过存在）。
- 遗留：P14（ctx.inject 挂卡 + 设置页真能看到卡）待开；0.4.1 发版固定项含 tarball==tag。

## 8. 07:10 收口（负责人定，明天照此接）

1. 0.5.0 不发版、不打 tag、README 今晚一字不动（三句说明并入打 tag 批次）。
2. 真机上卡留着，**别点保存**（红线）。
3. 明天第一件事＝只改 `client.js` 数据源（读 `props.form.state`、写 `props.form.mutate`、会话用注册闭包 `ctx`），不碰宿主加载路径；改完 QA 首验 + 一次真机复看 U2/U3。
4. 座位问题已否：`plugins.bundle.config`（`:6022`）只传 `{view}` 不带 `form`；`describe()` 为宿主侧纯服务端计算，与注册哪个 slot 无关（asar 实证见 `staging/p22b-real-machine.md`「A/B 定案」）。
5. 明天要在隔离 profile 打出的三个值：`Config` 是否 undefined、`entry.fiber.state` 是否 2、`volatileForm(Config)` 是否 undefined（只认 `meta.volatile`）。
6. 未结：README 补三句、issue #4 更正评论（id 持久、失效的是会话是否 live）、`v0.4.0` 坏 tag 去留待主人拍板。

### 8.1 07:11 顺序修正（负责人采纳 developer 意见）

明天**第一枪是打日志，不是改码**：
- 隔离 profile 起一次，打一行日志：`describe()` 的 `namespaces` 列表 + 我们这条 entry 的 `fiber.state` + `runtime.Config` 是否 undefined（外加 `volatileForm(Config)` 是否 undefined）；
- ns 在列 → 才动 `client.js` 数据源（读 `props.form.state`、写 `props.form.mutate`、会话用注册闭包 `ctx`）；
- ns 不在列 → 先修宿主侧（`runtime.Config` / `fiber.state`），客户端把「`props.form` 缺席」显示成只读原因，不许白屏。
- 座位 A/B 取消；改动仍只碰 `client.js`。
- 理由（developer 代码证据）：`formFor(entryId)` 在 ns 不在列时返回 `undefined`（plugin-manager `:6921`），此时 `props.form` 为空，读 `props.form.state` 会当场抛错。

### 8.2 变量三已静态排除（07:11，developer 离线构造实测）

在仓库目录用 profile 那份 schemastery 构造插件导出的 `Config`：`root type: object`，`watches` = `array` 且 `meta.volatile=true`，`stableMs` = `number` 且 `meta.volatile=true`，`toJSON` 为 function。
⇒ `volatileForm(Config)` 不会返回 undefined，`"toJSON" in schema` 成立，变量三（schema 形状）排除。

明早日志只需打两个值：`Config` 是否 undefined（动态 `createRequire` + try/catch 的唯一风险点）、`entry.fiber.state` 是否 2。

### 8.3 变量一也静态可判（07:11，大肥鱼实测）

在仓库目录 `C:\develop\workspace\dsh-handoff-relay` 下跑：

- `createRequire(<profile>/package.json)("@deepseek-ai/schemastery")` → **resolved** `C:\Users\<用户名>\.dsh\profiles\desktop\node_modules\@deepseek-ai\schemastery\lib\index.cjs`，`typeof Schema === "function"`；
- `require.resolve("@deepseek-ai/schemastery")`（仓库本地路径）→ `FAIL MODULE_NOT_FOUND`。

⇒ P14 的「解析基线改 profile 根」确实生效，变量一（`Config` 是否 undefined）大概率不成立；明早日志主要看 **`entry.fiber.state` 是否 2** 与 `entry.options.id` 原文。

### 8.4 08:05 例检 P25（大肥鱼，只记事实）

- 报告 `reports/p25-describe-probe.md`：**未落盘**（Test-Path False）；`signals\workbuddy\` 与 `delivered\` 无 p25 信号。
- 探针确实跑过：`%TEMP%\dsh-probe-1114\home\profiles\probe\dsh-handoff-relay\relay.log`，`PROBE-DESCRIBE` 共 274 行，最近一轮 07:35:38（t3/t15/t45 三档），此后无新增。
- 三档一致取值：`settings=present hasDescribe=function`；`namespaces=[] count=0 self=dsh-handoff-relay inList=false`；`entries=234`；SELF 行 `id="dsh-handoff-relay" fiberState=2 runtime=object configUndefined=true cfgType=undefined metaVolatile=undefined`。
- 两处待判读（我不定性）：①`namespaces=[]` 对全部条目为空，连 `plugin-manager`（fiberState=2、cfgType=object）也未列入，疑探针读结果方式有误（Promise 未 await / 字段名不符）；②probe profile 内 `node_modules\@deepseek-ai\schemastery` **存在**，却 `configUndefined=true`。
- 既有旁证：`desktop` profile 的 `relay.log` 最后写入 08:04:27（主实例仍在跑）。
- 进程：08:07:46 / 08:08:14 起两个新 `DeepSeek Harness` 进程（疑为探针后续尝试）。

### 8.5 P25 交付核验（08:14，大肥鱼；只核落盘，不判技术）

- 报告 `reports/p25-describe-probe.md`：8,491B，MD5 `0DA7A79B5C08E237ADEBEB5726C63D7D`，mtime 08:13:00，末行 `<!-- DONE -->`。
- 信号 `signals/p25-describe-probe.done`：94B（注意：落在 `signals\` 根下，不在 `signals\workbuddy\` 或 `signals\doubao\`）。
- 仓库：HEAD `8d562a0`（未变）、porcelain 空。
- developer 结论（转述，未复核）：`describe()` 返回数组、读 `.namespaces` 恒 undefined；我们被跳过因 `Config=undefined`，根因 `require(schemastery)` 在模块求值时抛 `ERR_REQUIRE_ESM_RACE_CONDITION`，被 catch 吞掉；同进程 3 秒后重解析成功。
- 未测项（developer 自述）：`ctx.sessions` 即「搜不到会话」，需真机渲染时刻另开读数。
- 08:17 更正（developer 指出，我核过）：P25 的 `signals\p25-describe-probe.done` 已被 watch 收走（`delivered\83e63d6cfdfa\`，94B / 08:13:19），唤醒**确实发生**；我先前的「放根目录会漏唤醒」判断错误。卡面原文只要求「同一分钟内落 .done」，未指定子目录；后续统一写 `signals\workbuddy\`。

### 9 P26 交付核验（08:29，大肥鱼；只核落盘与仓库状态）

- 报告 `reports/p26-config-esm-race.md`：5,484B / MD5 `F01C037E2FA35ED3B71D1616579922D2` / 08:25:06 / 末行 `<!-- DONE -->`。
- 信号 `p26-config-esm-race.done`：128B / 08:25:10（含 `bb8ee9120803`），已被搬入 `delivered\`。
- 仓库 HEAD `bb8ee9120803b96c80f20316a982a5642b661e1f`，porcelain 空；`git diff --numstat 8d562a0 HEAD` = `index.js +39/−28`、`index.test.mjs +55/−0`，与联络人报的一致。
- 派卡 08:18 → 交付 08:25，约 7 分钟（估时 40 分钟）。
- 真机脚本已换为 `staging/verify-after-p26.md`：9,169B / MD5 `115BF936FE7748FD5BF81D8B52436F00` / 08:27:07；P22b 那份不再使用。
- 未核（归 QA 首验）：C2 顶层 await 在求值链上、C3 失败不抛、C5 反证变红、C1 client.js blob 未动（联络人已核 `771e7c40…`）。

### 10 真机轮 1（08:45 重启，P26+P27 生效）前置事实

- 宿主已于 08:45:22 重启（GUI 端口 53199 → 63650）；`relay.log` 有 `启动 7/7 个 watch`，投递链通（`restart-done-0847.md` 已投出）。
- 同批出现 WARN：`设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）；如需配置请直接改 cordis.patch.yml` → 对应 `index.js:758` 分支，即 `getService(ctx,'settings')` 拿不到或没有 `settings.register`（0.2.2-rc.1 用 `configForms`，无 `settings` 服务）。
- 该分支 P26/P27 未触及：P26 修的是模块求值期 `Config` 的 ESM race，P27 修的是客户端 `inject` 补 `sessions`。⇒ 行卡「Host 未提供该条目」是否消失，仍需主人看卡读数（U0）。
- 预检已完成：`client.js` `b4ce538d…` / `index.js` `04a44b8d…` 两侧同 blob；备份 `cordis.patch.yml.bak-p26p27` 10,591B / `F895C286…`；7 条 watch 全 `targetSessionId`，`targetTitle` 0 条。

### 11 真机轮 1 结论（08:50，主人实测原文，大管家转呈）

- 主人原话：「1:现在显示：已同步Host。」「2:在搜索框里搜索以后，已经能看到所有的Title条目了，而且默认情况下显示的是所有。这个显示所有也太长了，分个页或者控制一下条目数量或者说做个滚动条之类的。我觉得只显示前10条就够了……」
- 判定：U0 **PASS**（「Host 未提供该条目」消失，改为「已同步 Host」）、U2 **PASS**（会话 Title 可枚举、搜索有结果）⇒ P26 + P27 真机成立，不回滚。
- 未执行：U3（选中后行内显示标题 + cwd）、U7（非法正则只标红该行）、U8（保存提示原文）；不补做，随下一条 UX 卡一次性看。
- 新增 UX 待办（主人提）：会话列表默认全量展开过长，要求只显示前 10 条 / 分页 / 限高滚动。

### 12 P28 交付核验（09:00，大肥鱼；只核落盘）

- 报告 `reports/p28-picker-limit.md`：4,354B / MD5 `127346B6532CC3D020CC12E7149158B4` / 08:54:48 / 末行 `<!-- DONE -->`。
- 信号 `signals/p28-picker-limit.done`：125B（另有 `p28-probe-after-fix.done` 319B，属 developer 那条副本探针）。
- HEAD `6f655500c88bb5dc359fea435c0501bc3b613a7a`「feat: limit session picker to ten rows with expand and scroll」，porcelain 空；`git diff --numstat beb0af2 HEAD` = `client.js +25/−12`、`index.test.mjs +50/−0`（`index.js` 未动，符合卡面）。
- 09:00 那条 P26 例检作废：P26 已于 08:25 交付、QA PASS 5/5、负责人终审 PASS。

## §9 收口登记（11-14 10:50 · 项目管家）

- P33 终审成文：`.batch/night/reports/p33-verdict.md`（负责人自落），含五条结论 + 两项拍板（不做 `agents.resume`；not-found 走 `undelivered.json`）。
- 例检（10:45）四项齐：报告 11,855B / `BB36535E…` / 10:27:01 / DONE；信号 1,988B / 10:27:39 在 `delivered\83e63d6cfdfa\`；HEAD `d535dc1` porcelain 空；7 条 watch 逐条判在。
- 本轮回滚锚：`cordis.patch.yml.bak-p26p27` 10,591B / `F895C286F1B6E40938FD0E94EAF8B434`。
- 待主人三句：0.5.0 发不发 / v0.4.0 坏 tag 去留 / 现在重启不重启（问询已交 10:18:58）。
