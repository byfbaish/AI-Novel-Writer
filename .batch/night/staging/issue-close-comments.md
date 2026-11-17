# issue 关闭评论（定稿，直接照抄，不要改写）

适用仓库：`byfbaish/dsh-handoff-relay`。主人 2026-11-16 20:00 已点头「关」。

## #1（0.4.0 启动即崩）

```
0.4.0 启动即崩。

修复：2ea6b53（改成经 ctx.inject 挂设置卡，provider 顺序无关）、74f4cc1（改用 configForms，不再硬注入 settingsScope）。
运行代码已不再触碰 ctx.settings：index.js:865 只经 getService(ctx,'settings')（内部 ctx.get）取服务，取不到整段跳过；index.js:12 inject 仅 ['agents']。全文 `ctx.settings` 唯一命中是 L862 的注释，注释与实现一致（不是「由 L862 实现」）。

真机验证：2026-11-16 两次完整退出并重启（版本 0.5.0，提交 8e4ad64，本地 junction 安装），无 crash 记录、无 pending。
注意：0.4.0 不可用，请装 0.4.1 或更高（当前 0.5.0）。
```

## #2（inject 硬编码 settingsScope）

```
inject 硬编码 settingsScope。

修复：beb0af2；client.js:21 的 inject 现为 ["slots","sessions"]，服务一律经 readService（client.js:140-145）走 ctx.get 取，带 try/catch；probeDirectory 取 remoteAccess 同样走 ctx.get（client.js:211）。

真机验证：2026-11-16 重启后 pending (waiting for service: settingsScope) 不再出现（版本 0.5.0，提交 8e4ad64）。
```

## #5（schemastery ERR_MODULE_NOT_FOUND）

```
schemastery 解析报 ERR_MODULE_NOT_FOUND。

修复：26ba94c、bb8ee91；index.js:104-112 用 createRequire(<profile>/package.json) 解析 @deepseek-ai/schemastery 再动态 import，任何失败只返回 error、降级为「无表单」，不向模块顶层抛出。

真机验证：2026-11-16 configUndefined=false，重启无报错（版本 0.5.0，提交 8e4ad64）。
```

## #4（保留 open，但正文要改一句）

把「重启后 id 会变」更正为：**会话 id 是持久标识（落 `~/.dsh/sessions/<workspace>/<uuid>/`）；重启后失效的是「该 id 在当前宿主里是否 live」，不是 id 本身**。自动重接尚未实现，watches 里的 `agent-not-found` 即该缺口的表现。

## #3（保留 open）

关闭时不留动。今晚又复现一次：插件停用期间投到 `to-owner/` 的文件不被搬走、也不通知用户，`relay.log` 无新行。
