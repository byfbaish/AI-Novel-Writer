# P17 · 客户端条目不得硬 inject 旧服务名（0.5.0）

## 背景（已定性，勿再论证）
桌面壳 DSH 0.2.2-rc.1 的 `dsh-client-ui-settings` 已把 `settingsScope` 改成 `configForms` / `settingsSchema`，
仓库 `client.js:17` 仍导出 `const inject = ["slots", "settingsScope"]`，客户端 cordis 因此永远 pending，
渲染层 `assertEntriesActive` 抛错 → `bootFailed` IPC → 主进程打出 `web boot: 1 entry did not activate`，
宿主启动失败。`app.asar/lib/main.js:20648` 只是接收错误的 IPC 处理器，不是故障点。
佐证：`@linxin666/dsh-client-ui-task-board@0.4.16` 声明 `engines.dsh: ">=0.2.2-rc.1"`、注入 `configForms`。
另：`package.json` 的 `dsh.client.inject` 是**模块依赖**语义，不是服务名，本次不作为修复对象（但 C 项要动 `immediately`）。

## 必做
1. **A**：`client.js` 导出的 `inject` 只留 `["slots"]`；`apply` 内取服务改为
   `const forms = ctx.get("configForms") ?? ctx.get("settingsScope");`
   取到就用取到的那个服务挂卡；两个都取不到时，用 `ctx.inject(["configForms"], cb)` 延后挂卡，
   回调里仍取不到则 warn 跳过（不抛错、不挂死）。
2. **C**：`package.json` 去掉 `dsh.client.immediately`。
3. **不做**按 DSH 版本硬分支（硬注入本身就会 pending，代码根本执行不到）。
4. 版本号 `0.4.1` → `0.5.0`。

## 判据（逐条可核）
- `node index.test.mjs` 全绿，且新增用例覆盖：
  ① 导出 `inject` 数组不含 `settingsScope`、不含 `configForms`；
  ② 只有 `configForms` 时卡片挂载一次、服务对象非 undefined；
  ③ 只有旧 `settingsScope` 时同样挂载一次；
  ④ 两个服务都没有时：不抛错、不注册卡、watch 不受影响，且**不出现 pending 语义**（不通过 ctx.inject 死等）。
- `grep -n "settingsScope" client.js` 只允许出现在兜底读取那一行与注释里。
- `index.js`（宿主侧）行为零改动：不删不换 `inject = ['agents']`，不改 watch 判定逻辑。
- `git status --porcelain` 只有本次点名的文件；`git diff --numstat` 与报告一致。

## 约束
- 只改 `client.js`、`package.json`、`index.test.mjs`、`README.md`、`README.zh-CN.md`；不碰 `index.js`。
- 禁 `git add -A`（只点名文件）；禁打 tag；禁 `npm publish`；禁重启 DSH；禁往 watch 目录丢文件。
- 测试临时目录只用 `os.tmpdir()`，清理放 `finally`。
- 报告 `.batch/night/reports/p17-client-inject-configforms.md`，末行 `<!-- DONE -->`。

## 估时
45 分钟（含用例与自测）。

## 外部证据（大肥鱼 11-14 提供，已并入取证，不推翻定性）
- dsh-ego-browser issue #29：可选服务写进 inject → pending (waiting for service: betterSidebar)；从 inject 删掉后仍直接 \ctx.X\ 读取 → 报 cannot get property ... without inject。结论：inject 是硬依赖，\ctx.X\ 读未声明服务会被严格解析器拦；正解 \ctx.get(name)\ + 降级。
- deepseek-harness discussion #2463：同形态 pending (waiting for service: remote.scriptLibrary)，web boot 卡住。
- interview-forge / btw-sidebar 排障文档：不声明「apply 阶段才安装的服务」，否则自等死锁；client \`pply\ 抛异常会被 boot 审计拦整页（保护机制）。定位时看浏览器控制台 \web boot:\ 那条错误的**上方最近一次异常**。
- 追加要求：client 的 \`pply\ 全路径不得抛异常，失败一律 warn 降级；新增用例覆盖 ctx.get 读未声明服务不抛。
