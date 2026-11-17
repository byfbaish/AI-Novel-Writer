# 0.4.1 发布说明（草稿，仓外，等主人点头后由我统一安排一次提交）

> 用法：发布时正文取下面「正文」一节；`npm publish` 说明与 GitHub Release 说明共用。

## ⚠️ 0.4.0 不可用（先说这条）

**请安装 0.4.1，不要安装 0.4.0，也不要从 master 的 `v0.4.0` 提交克隆安装。**
0.4.0（commit `8c5c073`）在宿主启动期会直接导致 DSH 退出：

```
dsh: fatal load failure: Error: cannot get property "settings" without inject
    at mountSettingsCard (.../dsh-handoff-relay/index.js:668:31)
```

## 正文

### 修复

- **启动崩溃（0.4.0 的致命问题）**：不再在声明式注入之外直接读 `ctx.settings`；改为 `ctx.inject(['settings'], cb)` 拿到服务后再挂设置卡，取不到时只记一条 warn 并跳过设置卡，watch 投递照常工作。回调内的异常被完整捕获，任何一个设置卡问题都不会再让宿主启动失败。
- **设置卡渲染崩溃**：设置卡里完成规则那一行少了一个逗号，导致 `row` 越出作用域、渲染时抛 `ReferenceError`，页面表现成「插件配置里没有这张卡」。已修正并补回归测试。
- **`@deepseek-ai/schemastery` 解析**：插件不再假设自己位于 profile 内，改为从 profile 根目录 `createRequire` 解析 schema 构造器，解析失败时降级跳过设置卡。

### 升级方式

```bash
dsh plugin install dsh-handoff-relay@0.4.1
```

升级后 **重启宿主**；设置页出现 Handoff Relay 的配置卡即为安装成功。

### 已知限制

- 一个 watch 目录只支持一个目标会话（单播）；多播尚未支持。
- `targetSessionId` 需填写当前存活的会话 id；宿主重启后会话 id 会变化，需重新配置。
- 设置卡在本部署中存在「watches 为空时不显示」的行为；先至少保留一条 watch 再看设置页。
