# 定性卡 · 设置卡框沿为什么没有红/绿

- 卡号：P41（只读取证，B 类：产物落 staging，不改码、不提交、不重启宿主）
- 估时：15 分钟（只读取证）
- 派单人：AI writer总负责人
- 时刻：2026-11-16 20:36

## 现象（主人真机，重启后）
主人重启 DSH 后打开 插件 → 已安装 → dsh-handoff-relay → 包含的组件 → 设置卡，路径输入框**仍然没有红/绿**。
`relay.log` 20:30:17 仍有：`设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）`（index.js:867 分支 ⇒ `getService(ctx,'settings')` 拿不到服务）。同时 20:30:16 启动行是 `启动 7/7 个 watch`（P40 生效）。

## 要回答的三个问题（只答事实，不给改法）
1. **渲染来源**：用户看到的那张卡，到底是 `client.js` 里的 `DirPathField`（`client.js:258-291`，P39 改的就是它），还是宿主按 schema 生成的通用表单？判据要能指认到 DOM 或组件名。
2. **`kind` 实际值**：`probeDirectory`（`client.js:207-241`）在这种宿主下是否恒返回 `{kind:"none"}`、`checking`、还是能出 `ok/bad`。要给出「取不到 remoteAccess / 取不到工作区文件」分别在哪一行返回。
3. **主进程能不能自己判目录**：插件主进程（`index.js`）是否具备直接读文件系统的能力，以及有没有现成通道把结果送给渲染层（例如已有的 slot props、`configForms` 控制器、或插件自己的 route）。只报「有/没有 + 证据位置」，不设计实现。

## 交付
- 报告：`.batch/night/staging/p41-dirframe-dig.md`，末行 `<!-- DONE -->`
- 章首写：`起点 HEAD=<插件仓库 HEAD>`
- 每条结论必须带 `文件:行` 或 DOM 取证原文；拿不到就写 `unknown + 原因`，不许猜
- **不改任何代码、不重启宿主、不动 `cordis.patch.yml`**
