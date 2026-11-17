# selftest1114 实例操作要点（developer，2026-11-14 01:41）

## 现状

- 旧实例仍在跑：`PID 47592`，命令行 `node ...\@deepseek-ai\dsh\lib\bin.js --profile selftest1114 --port 61001 --no-open`，跑的是**改码前**的 `client.js`（md5 `492C1B9F3E04D50A6DBA4F7B9B9915F9`）。重新验证前必须先结束它，否则端口占用。
- profile 已就绪：`C:\Users\<用户名>\.dsh\profiles\selftest1114\cordis.patch.yml` 在位（一条 watch 指向 `%TEMP%\relay-selftest-watch`，`targetSessionId: session-selftest-dummy`）。

## 坑：profile 里的插件是**硬链接**，改仓库不一定跟着变

- `profiles\selftest1114\node_modules\dsh-handoff-relay` 是 SymbolicLink → `.pnpm\dsh-handoff-relay@file+..+…\node_modules\dsh-handoff-relay`。
- 而 `.pnpm` 里那份 `index.js` / `client.js` 是**硬链接**回仓库（`fsutil hardlink list` 同时列出仓库路径与 store 路径）。
- 后果：编辑器/git 换文件通常等于「新建文件再改名」，硬链接会断，store 里留旧内容 → 实例仍加载旧代码，看起来像「改了没生效」。
- 稳妥做法：改完码先跑 `dsh plugin --profile selftest1114 install` 刷新，再**逐个比对 md5**（至少 `index.js`、`client.js`）与仓库一致，才启动实例。

## 启动与取证

- 启动：`dsh --profile selftest1114 --port 61001 --no-open`（隐藏窗口、stdout/stderr 重定向到 profile 下 boot*.log）。
- 判据三条：①进程存活、端口监听 ②`selftest1114\dsh-handoff-relay\relay.log` 出现 `设置卡 schema 基线=` 行 ③**browser-skill 打开 `http://127.0.0.1:61001` → 设置 → 插件 → 插件配置，肉眼见到 Handoff Relay 卡**。
- 控制台必须干净：不再出现 `slot entry crashed in 'settings.plugin.item'`。

## 补记（01:44）· `?rev=` 与硬链接的实测

- `?rev=` **不需要反推**：页面网络面板里 `/plugins/dsh-handoff-relay/client.js?rev=…` 就是当前真正加载的那一份，直接读它即可（上一轮读到 `rev=1d66f1e4dfdc`）。
- 用内容哈希反推 rev 失败：`client.js` 9021B 的 sha1 `3cf50647…`、sha256 `3c98fe48…`、md5 `c32194e7…` 都不等于 `1d66f1e4dfdc` ⇒ rev 不是单纯内容哈希，别拿仓库 md5 反推，会得到假结论。
- 硬链接实测：改码后 profile `.pnpm` store 的 `client.js` 与仓库仍一致（9021B、md5 `C32194E7…`）⇒ 那次是原地写，硬链接没断。「硬链接会断」是**条件性**风险（看编辑方式），不是必然；保险做法仍是启动前比一次 md5。
