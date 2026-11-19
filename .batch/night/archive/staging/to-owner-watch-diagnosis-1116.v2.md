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


## 更正（01:50）：这条通道不是「从来没通过」

QA 的依据是项目内 `.batch/night/bridge/delivered/` 为空——那是**看错了目录**。relay 的真实 delivered 在 profile 下：`~/.dsh/profiles/desktop/dsh-handoff-relay/delivered/`，共 114 个文件、5 个目标目录。

其中属于 to-owner 的那个目录有 33 件，含 7 件给主人的信，按时间：
`ask-owner-050-1020.md`、`owner-decision-ack-1424.md`、`owner-hold-answer-1430.md`、`20261115-1740-owner-five-pending.md`、`20261115-1743-owner-four-pending.md`、`20261115-1943-owner-handoff-supplement-request.md`、`20261115-2012-handoff-confirmations-request.md`

该目录最后写入 = **2026-11-15T12:03:18.075Z（本地 20:03:18）**；与我主身旧段目录 a1d48adb 的最后写入 12:03:18.138Z 同一秒。此后 23:10、01:22、01:30 三封信全部 `agent-not-found`。

结论改成：**这条通道一直工作到 2026-11-15 20:03，随我主身换段当场失效**。不是从来没通过，也不是 id 拼错——是静态配置跟不上我自己的会话换段。修复方向不变（改两行指向当前段），但「从未通过」这个定性要撤。

## 修复卡（v2，**不执行**，等主人一句话）

- 改动对象：`~/.dsh/profiles/desktop/cordis.patch.yml`
  - 第 314 行 `bridge/to-owner` → 主身当前段的 sessionId
  - 第 319 行 `bridge/to-group` → 我在本群分身的当前段 sessionId
- **目标 id 的来源（不许手抄）**：执行时现读 `~/.dsh/bot/state.json`
  - to-owner：`bots[<大肥鱼 bot id>].sessionId`
  - to-group：`rooms['AI writer项目组'].sessions[<大肥鱼 bot id>]`
  - 取到后用脚本写入，禁止人工转录 44 位 id。
- 改前备份：`cordis.patch.yml.bak-<YYYYMMDDHHMM>-rebind`，改后核 crlf=0。
- 生效：relay 只在启动时读配置 ⇒ **需重启 DSH 一次**，与重启验收合并同一窗口。
- **回滚（按 QA 意见改）**：不是「把备份覆盖回去」——旧配置本身就是坏态，覆盖回去等于回到故障态且再重启一次。真实回滚＝**改回「上一版能被复核证明可用」的值**，即：若本次目标 id 来自 state.json 但重启后仍未 resolved，则恢复到修改前的备份、重启，并以「`relay.log` 出现至少一条成功投递记录」为唯一验收判据，不看配置文件长相。
- 生效判据（不看配置、看投递）：在 `bridge/to-owner` 放一件测试件 → `relay.log` 无 `agent-not-found` → `delivered/<目标>/` 出现该文件。三条齐才算修好。
- 注：我和我的群分身再换段，这两条会再次失效——治本＝插件按身份解析（另案，须走正规构建发布）。

## 待主人拍板
1. 是否改这两条（改哪条、还是两条都改）；
2. 改完是否与重启验收合并同一窗口；
3. 是否同意「治本＝插件按身份解析」进入排期。

落款：大肥鱼 · AI writer项目组 | session 74a01c9a | 2026-11-16 01:50
