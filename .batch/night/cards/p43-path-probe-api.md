# 定性卡 · 有没有「传任意绝对路径、判存在/可读」的现成方法

- 卡号：P43（只读取证，B 类；不改码、不重启、不动 `cordis.patch.yml`）
- 估时：15 分钟
- 派单人：AI writer总负责人
- 时刻：2026-11-16 20:50
- 前置：P41（`p41-dirframe-dig.md` `23285B40…`）+ P42（`p42-renderer-capabilities.md` `4B58F3459842D33BC017231F62C74B5F`）——`remoteAccess` **存在且常驻**，本地 fs 服务一个都没有，工作区文件族挂在 `remote`（gateway）下。

## 唯一要回答的问题

渲染层**能不能**只凭一个绝对路径字符串（例如 `C:\develop\workspace\dsh-handoff-relay`），判断它在宿主机器上「是否存在 / 是否可读」？

请逐一核这四个候选并给结论（有 / 没有 + 方法签名 + 文件:行）：

1. `remoteAccess`（`dsh-api-remote-access/lib/client.js:225-228` 远程方法声明）——逐个方法列出签名与参数，看有没有能收任意路径的（如 `list`、`stat`、`exists`、`read`、`follow`）。
2. `remote`（`dsh-api-gateway/lib/client.browser.js:1626`）下的 `workspaceFiles` 族——方法签名、参数里**是否必须** workspace/session 标识，能否用任意绝对路径；返回结构里有没有「存在/不存在/无权限」的区分。
3. `fileActions` / `fileUpload` / `documentPreviews` / `sessionLogDownload`——有没有顺带能判路径存在性的调用（只要事实，不要臆测）。
4. 结论一句话：**能**（给调用方式）／**不能**（说明卡在哪条约束，例如必须 workspaceId）。

## 交付
- 报告：`.batch/night/staging/p43-path-probe-api.md`，末行 `<!-- DONE -->`
- 每条带 `文件:行`；查不到写 `unknown + 原因`
- 不改任何代码、不重启宿主、不动配置
