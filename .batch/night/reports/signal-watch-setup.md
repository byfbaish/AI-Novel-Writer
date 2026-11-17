# 交付信号 watch 接线报告（配置层，零改码）

结论：`watches:` 由 3 条变 5 条，文件仍 UTF8 无 BOM，已有 3 条字节未变；hot reload 生效、未重启 DSH；
workbuddy 信号目录探针在落盘同秒被投递（`触发=DONE`），workbuddy联络人 会话被唤醒。

## 1. 追加后的 `watches:` 整段（原文 + 行号）

```yaml
289 : # --- dsh-handoff-relay -------------------------------------------------------
290 : - id: dsh-handoff-relay
291 :   name: dsh-handoff-relay
292 :   config:
293 :     watches:
294 :       - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox'
295 :         targetSessionId: 'session-daeb834f-a940-44d0-b4cc-9d56b7c5eb72'
296 :       - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\workbuddy'
297 :         targetSessionId: 'session-33494f59-babb-4168-af13-3b2fd525e7d0'
298 :       - dir: 'C:\develop\workspace\AI-writer\develop\scripts\dsh\wakeup-inbox\doubao'
299 :         targetSessionId: 'session-4380d607-48ec-47f4-a0b5-e086e856b377'
300 :       - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\workbuddy'
301 :         targetSessionId: 'session-33494f59-babb-4168-af13-3b2fd525e7d0'
302 :       - dir: 'C:\develop\workspace\AI-writer\develop\.batch\night\signals\doubao'
303 :         targetSessionId: 'session-4380d607-48ec-47f4-a0b5-e086e856b377'
304 :     stableMs: 5000
305 : - id: bot
```

插入前 L289-300 的三条 `dir`/`targetSessionId` 与 `stableMs: 5000` 逐字未动；插入点 = 原 `stableMs: 5000` 之前（字符偏移 9546）。

## 2. 备份

`C:\Users\<用户名>\.dsh\profiles\desktop\cordis.patch.yml.bak-0453`

## 3. 编码自查（无 BOM）

首三字节：`23 20 59`（`# Y`），不是 `EF BB BF 23`。

## 4. 端到端（只验 workbuddy 一条，未打扰豆包）

- 探针：`.batch\night\signals\workbuddy\probe-signal-channel.md`，落盘 **04:54:11**
- 目标会话 `session-33494f59`（workbuddy联络人）在 **04:54:11** 收到：
  `{"type":"agent/inbox/spliced"}` + `{"type":"user/message"}`，
  文本「文件 probe-signal-channel.md 已就绪（触发=DONE），请继续。」
- 触发标记为 `DONE`：文件末行命中 `<!-- DONE -->`，按插件判定立即投递，不等 5 秒静默窗口
- 探针已删除；`signals\workbuddy` 与 `signals\doubao` 现各只剩 `.gitkeep`

## 5. 未重启证据

DSH 未重启：GUI 端口 `58904` 的监听进程 `DeepSeek Harness.exe`（PID 12564）创建时间 **03:57:22**，早于本次改配置（04:53），本轮全程无重启动作；改完即生效说明走的是配置热重载。

## 6. 禁忌自查

- 未改 `index.js` / `index.test.mjs` / 两份 README / `package.json`
- 未动 `~/.dsh/settings.yaml`
- 未往 `scripts\dsh\wakeup-inbox` 丢文件（该目录仍只有 `.gitkeep`）
- 未动已有三条 watch 的 `dir` / `targetSessionId`

<!-- DONE -->
