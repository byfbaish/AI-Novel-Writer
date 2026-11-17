# P15 真机证据：设置页卡片可见（developer，2026-11-14 02:00）

## 结论

修好后卡片**真机上确实出现**，位于 `设置 → 插件 → 插件配置` 最上方，自带表格一行（目录 / 目标会话 / 完成规则 / 删除）、`exact` 勾选项、「新增一行 / 保存 / 放弃修改」与「已同步 Host（revision 0）」。下方仍是官方三项（终端 / Agent 循环 / 网页搜索）。

截图：`.batch\night\evidence\p15-card-visible\settings-plugin-card-0158.png`（112,115B，md5 `3ACCEA8C1EAA4F908CAB20711D3B4720`）

## 三条判据

1. 进程存活、61001 监听（pid 33084，01:56:23 起）。
2. `relay.log` 有 `设置卡 schema 基线=C:\Users\<用户名>\.dsh\profiles\desktop\package.json resolved=…\@deepseek-ai\schemastery\lib\index.cjs`（本次 01:56 段落）。
3. 页面可见卡、控制台**不再有** `slot entry crashed in 'settings.plugin.item'`。

## 加载凭据：`?rev=` 改动前后

- 改动前：`/plugins/dsh-handoff-relay/client.js?rev=1d66f1e4dfdc`（旧字节 md5 `492C1B9F3E04D50A6DBA4F7B9B9915F9`）
- 改动后：`/plugins/dsh-handoff-relay/client.js?rev=3cf506475afe`（新字节 md5 `C32194E764B7C08588EDCEF86F182342`）

## 更正我自己先前的一句话

我此前说「`?rev=` 不是内容哈希」。**错了。** `?rev=` 就是**实际被服务的那份文件字节**的 sha1 前 12 位：

- 新字节 sha1 = `3cf506475afe64fcf84dde487357311084a4fbd7` → rev `3cf506475afe`，与页面一致。

当时对不上，是因为我拿**仓库里的新文件**去算，而服务端那时还在发**旧的缓存字节**——两边不是同一份文件。所以 rev 可以校验，但必须拿「服务端实际发的那份」算。

## 真机阶段踩到的硬坑（比「硬链接可能断」更硬）

`profiles\selftest1114\node_modules\.pnpm\…\dsh-handoff-relay` 那份副本，会在**实例启动之后**被 pnpm 从内容寻址仓库重新物化回旧字节：

- 01:48 核：仓库与 profile 副本都已是新内容（md5 `C32194E7…`，硬链接未断）。
- 01:50:17：profile 副本 mtime 被刷新，md5 变回旧值 `492C1B9F…`；服务端随即一直发旧文件，页面表现就是「没卡」。
- 处置：改码后必须先 `dsh plugin --profile selftest1114 install` 刷新副本，再核 `node_modules\dsh-handoff-relay\client.js` 的 md5 与仓库一致，才启动实例；启动后再拉一次 `/plugins/<name>/client.js` 比 md5，确认服务的是新字节。

## 操作顺序（下次直接用）

1. `git -C C:\develop\workspace\dsh-handoff-relay rev-parse --short HEAD` 记录提交
2. 结束占用 61001 的 node 进程
3. `dsh plugin --profile selftest1114 install`
4. 核 profile 副本 md5 == 仓库 md5
5. 启动 `node ...\dsh\lib\bin.js --profile selftest1114 --port 61001 --no-open`
6. `Invoke-WebRequest /plugins/dsh-handoff-relay/client.js` 核 md5 == 仓库 md5、读 rev
7. browser-skill 打开页面（必要时硬刷新）→ 设置 → 插件 → 插件配置 → 截图

## 补记（02:07）· 三者一致性读数

| 取法 | 字节 | md5 | blob（git hash-object） |
|---|---|---|---|
| 服务端实际发出 `/plugins/dsh-handoff-relay/client.js` | 9,021 | `c32194e764b7c08588edcef86f182342` | — |
| profile `node_modules\dsh-handoff-relay\client.js`（store 侧） | 9,021 | `c32194e764b7c08588edcef86f182342` | `e76141cf2a4349a9fb7a27fc7f1e4ce1823d980a` |
| 仓库工作区 `client.js` | 9,232 | `d05605c18dd5ae04c1696af3342a3f35` | `e76141cf2a4349a9fb7a27fc7f1e4ce1823d980a` |

- 仓库 `HEAD` = `848c26d`，`HEAD:client.js` blob = `e76141cf…`，与 store blob 逐字相同。
- `?rev=` = `3cf506475afe` = 服务端字节 sha1 前 12 位。
- 仓库工作区字节数是 9,232、md5 也不同，只因 `core.autocrlf=true` 把 LF 换成 CRLF；**核一致性要按 blob，不能比工作区 md5**。
