# 六条 watch × 目标会话 对照表（定性用，不含修改）

采集时间 2026-11-16 01:40 (+08:00)｜采集人 大肥鱼 · AI writer项目组 | 74a01c9a
方法：读 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 6 条 watch；到 `~/.dsh/sessions/` 逐条找 `<run>/<targetSessionId>` 目录；与 `~/.dsh/bot/state.json` 的 `bots[*].sessionId`（主身）与 `rooms[AI writer项目组].sessions`（群分身）逐个比对。

## 表

| # | yml 行 | watch 目录 | target 前8位 | 目录存在 | 目录最后写入 | 与当前会话关系 |
|---|---|---|---|---|---|---|
| 1 | 293 | wakeup-inbox\workbuddy | d17681e6 | 是 | 2026-11-15T14:04:12Z | **= workbuddy联络人 群分身**（相等） |
| 2 | 298 | wakeup-inbox\doubao | 27a1c2ae | 是 | 2026-11-15T14:04:15Z | **= 豆包联络人 群分身**（相等） |
| 3 | 303 | signals\workbuddy | d17681e6 | 是 | 2026-11-15T14:04:12Z | **= workbuddy联络人 群分身**（相等） |
| 4 | 308 | signals\doubao | 27a1c2ae | 是 | 2026-11-15T14:04:15Z | **= 豆包联络人 群分身**（相等） |
| 5 | 313 | bridge\to-owner | a1d48adb | 是 | 2026-11-15T12:03:18Z | **不相等**：主身当前为 9dd40854（我，大肥鱼） |
| 6 | 318 | bridge\to-group | dca91e1d | 是 | 2026-11-15T15:38:18Z | **不相等**：我在本群的群分身当前为 9c03a032 |

## 结论（定性，不是猜测）

- 六条的 targetSessionId 目录**全部存在**，没有一条是「id 写成不存在的字符串」⇒ 不是拼写/落盘错误。
- 4/6 相等（两个联络人的群分身），投递链路本身正常。
- 不相等的是 **5、6 两条，且都指向我自己的会话**：一条是我的主身旧段（a1d48adb），一条是我在本群的群分身旧段（dca91e1d）。两个旧段的目录都还在，但当前活跃段已换成新 id（9dd40854 / 9c03a032）。
- 即：**不是系统性错绑，也不是 id 拼错；是「我自己的会话换过段、静态配置没跟着换」**。watch 配置只在宿主启动时读一次，所以换段后必然指旧。
- 因此「等 rescan / 等重启」对这两条**不成立**：旧段不会自己回来，重启只会让它继续指向旧段。要修只能改配置指向当前段，或改成按身份跟随（已知的插件增强方向）。

## relay.log 原句（同一目标、连续三次）

```
2026-11-15T15:10:36.975Z WARN [dsh-handoff-relay] watches[4] 解析不到目标，保持未投递（reason=agent-not-found）：20261115-2312-notice-status-sync.md（dir=...\.batch\night\bridge\to-owner，目标=targetSessionId=<a1d48adb…>）
2026-11-15T16:13:15.034Z WARN ... 同一 dir、同一目标
2026-11-15T17:22:30.835Z WARN ... 20261116-0122-owner-two-decisions.md
2026-11-15T17:30:26.658Z WARN ... 20261116-0127-owner-qa-model-failure.md
2026-11-15T17:33:40.696Z WARN ... 20261115-2312-notice-status-sync.md（重试）
```

另：`.batch/night/bridge/delivered/` 目录当前为空（0 个文件）——与 QA 的观察一致；relay 的实际 delivered 目录在 `~/.dsh/profiles/desktop/dsh-handoff-relay/delivered`。

## 修复卡（草稿，**不执行**，等主人一句话）

- 改动对象：`~/.dsh/profiles/desktop/cordis.patch.yml`
  - 第 314 行 `bridge/to-owner` → `targetSessionId: session-9dd40854-...`（主身当前段）
  - 第 319 行 `bridge/to-group` → `targetSessionId: session-9c03a032-...`（本群分身当前段）
- 前置：改前先备份（`cordis.patch.yml.bak-<时间>`），改后核 crlf=0。
- 生效：relay 只在启动时读配置 ⇒ **需重启 DSH 一次**，与重启验收窗口合并，不单独占用。
- 回滚：把备份覆盖回去再重启。
- 副作用提示：只要我和我的群分身再换段，这两条会再次失效 —— 治本要改插件按身份解析（已有方向，另案）。

## 待主人拍板
1. 是否改这两条（改哪条、还是两条都改）；
2. 改完是否与重启验收合并同一个窗口；
3. 是否同意「治本＝插件按身份解析」进入排期。

落款：大肥鱼 · AI writer项目组 | session 74a01c9a | 2026-11-16 01:40
