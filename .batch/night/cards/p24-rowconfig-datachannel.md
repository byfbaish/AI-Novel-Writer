# P24 · 设置卡数据通道失效取证（真机 U2–U4 失败）

- 卡号：P24（只读取证，不改码）
- 出卡：AI writer总负责人，2026-11-14 06:32
- 估时：**30 分钟**
- 执行：developer
- 触发：真机截图显示卡片已渲染（U1 过），但行底提示 `Host 未提供该条目`、会话搜索「没有匹配的会话」、无可提交落点。
- 纪律：**只读**。不改码、不改 `cordis.patch.yml`、不重启 DSH、不写生产 profile。

## 要钉死的三件事（每条给代码行号 + 宿主 asar 原文）

1. **`Host 未提供该条目` 从哪来**：`client.js` 里这句文案的命中行、所在分支的完整条件（哪个 `status`/变量为假时吐出）。若在宿主侧（`dsh-client-ui-plugin-manager` / `dsh-client-ui-config`），给宿主文件与行号，并说明我们的 Config 返回了什么导致它这样判。
2. **会话枚举读哪个服务**：新卡里取会话列表的具体代码行；确认服务名（`sessions` / `agents` / `sessionTitle`）在 `plugins.row.config` 槽位回调里是否为 `undefined`；给宿主侧该服务的注入前提（谁提供、是否只注入特定槽位、是否需要 `ctx.inject` 声明）。P22 事实写的是 `dsh-api-session-controller/lib/client.js:3856` 的 `sessions.list`——核对它在 row-config 槽位的可见性，别照抄结论。
3. **`configForms` 的 controller 是不是空壳**：新卡拿 `controller` 的行、`get(entryId)` 返回、`mutate` 调用点；对照宿主 `dsh-client-ui-settings` 里 `ConfigFormController` 的构造与 `plugins.row.config` 传入的参数，说清 row-config 槽位拿到的是完整 controller 还是只有 `{state, mutate}` 数据。

## 附带（各一句话）

- `plugins.row.config` 的 slot 参数完整字段列表（宿主 `Slot<>` 定义原文），我们用了哪些、漏了哪些。
- 宿主是否要求本插件在 `dsh.client.inject` 里声明承载这些服务的客户端模块；若需要，给包内模块名。

## 交付

- 报告 `.batch/night/reports/p24-rowconfig-datachannel.md`，末行 `<!-- DONE -->`；落盘同一分钟内写信号 `p24-rowconfig-datachannel.done`。
- 结论只写「现象 → 根因候选（按可能性排序）→ 还差哪条证据才能定性」，**不给修法**，修法我定。
