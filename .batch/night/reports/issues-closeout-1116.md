# dsh-handoff-relay issue 结案清单（大肥鱼 11-16 19:58）

线上核读方式：浏览器直读 `https://github.com/byfbaish/dsh-handoff-relay/issues?q=is:issue`（匿名 API 被限流；本机未装 gh，仓库无 token）。
核读结果：**#1–#5 全部 open**，均 opened 16h ago。

## 建议 close（3 条）

| # | 标题 | 结案依据（提交 / 代码 / 真机） |
|---|---|---|
| 1 | 0.4.0 启动即崩：宿主条目读未声明服务（cannot get property "settings" without inject） | `2ea6b53` mount settings card through ctx.inject；`74f4cc1` 改走 configForms 不再硬注入 settingsScope；`index.js:862` 注释「取不到就整段跳过，绝不触碰 ctx.settings 属性」。真机：11-14 02:39 后无新 crash 日志；11-16 两次重启（10:06、10:14）均 8/8 watch 起来、无崩。 |
| 2 | web boot: 1 entry did not activate —— 客户端 inject 硬编码旧服务名 settingsScope | `client.js:21 const inject = ["slots", "sessions"]`（已无 settingsScope）；`client.js:142` ctx.get 兜底；`client.js:211` ctx.get("remoteAccess")；`beb0af2` inject sessions 服务。真机：relay.log 18:14:18 起无 `pending (waiting for service` 行。 |
| 5 | 以真实路径加载时 schemastery 解析失败（ERR_MODULE_NOT_FOUND） | `26ba94c` resolve schemastery from the host profile root；`bb8ee91` ESM import + top-level await；`index.js:8/99-107 createRequire(<profile>/package.json)`。真机：PROBE-DESCRIBE `entry#228 configUndefined=false / cfgType=object`（p28 报告，修复前后对照在案）。 |

## 建议保留 open（2 条）

| # | 为什么不 close |
|---|---|
| 3 | 建议型（宿主侧健康检查 / 心跳状态文件 / README 一句「源目录有文件 ≠ 已投递」）。**原样成立、未做**。今晚又踩了一次同形态：插件停用期间 to-owner 文件不被搬走，只能靠人去查目录判。建议补一条评论把今晚实例记上，不 close。 |
| 4 | 已部分实现，但**离结案还差两步**：①正文事实要更正——会话 id 是持久标识，重启后失效的是「该 id 是否 live」，不是 id 变了（`release-050-checklist.md:22` 有这条待办）；②标题绑定已落地（`1c8a7a9` title 优先、`de69c8f` 默认 exact=true、`dee1b9f` 行配置卡），但「重启后自动重接」仍未做——今晚 watches[7] 两次 `agent-not-found` 就是活例。保留 open，等自动重接落地再关。 |

## 执行前提（待核）

- 本机无 gh、API 匿名限流、仓库无 token ⇒ 我这边**只能读、不能 close**。
- close 需要 GitHub 写权限：WorkBuddy 是否有登录态/凭据，待 @workbuddy联络人 核实。
- 流程：QA 核「依据在仓库里真存在」→ 负责人终审 → 有写权限的一方执行 close，每条附一句关闭理由。
