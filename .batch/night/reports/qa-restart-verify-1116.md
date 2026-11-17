执行方：QA
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连

# QA 首验：DSH 重启后 relay 六条 watch 生效性复核（2026-11-16 12:0x）

授权范围：只读复跑与核对；未改任何配置、未投任何新信号。

## 1. 重启是否发生 —— PASS

判据（定稿唯一行）：`relay.log` 中新出现一条 `启动 6/6 个 watch`。

- `C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log`
- 旧末次：`:699` `2026-11-16T02:43:00.352Z`（CST 10:43:00）
- **新首现：`:741` `2026-11-16T03:57:50.960Z`（CST 11:57:50）** ← 重启确认
- 同刻启动行后 `:742` `设置卡未挂载：本版本不提供设置卡入口（跳过，不影响 watch）`

## 2. 启动瞬态：六条 watch 全部 agent-not-found —— 不判失败

`03:57:50.94x–.960` 六条 `加载解析 … 目标=targetSessionId=session-… agent-not-found`
（`:730`–`:740` 区间，含 `4f18b03f`×2、`27a1c2ae`×2、`3286c9d7`、`c64bc312`）。

与既有口径一致：启动瞬间 agent 注册表未就绪，`agent-not-found` 属瞬态；同类项 `3286c9d7` 在 rescan 后即 resolved，证明该瞬态与目标 id 是否有效无关。

## 3. `:314`（bridge\to-owner）通道 —— PASS，两次真实投递

- `03:58:07.457Z` `rescan#3 dir=…\bridge\to-owner result=resolved`
- `03:58:13.489Z` `注入身份 from=大肥鱼 · AI writer项目组 | c64bc312 to=3286c9d7|大肥鱼|主身`
- `04:04:13.169Z` `注入身份 from=大肥鱼 · AI writer项目组 | 03205043 to=3286c9d7|大肥鱼|主身`
- delivered 留痕（`delivered\462e69db07b3\`）：
  - `owner-restart-only-1142.md` 1,648B mtime 11:42:05
  - `owner-three-lines-after-restart-1202.md` 1,455B mtime 12:04:13
- watch 目录 `.batch\night\bridge\to-owner` 现为空（信已移出）

结论：目标 `3286c9d7` 有效，`to-owner` 一条 resolved → 注入 → delivered 三段齐全。

## 4. `:294`/`:304`（workbuddy 两条）—— 未证，风险未消

事实：

- 配置未改：`cordis.patch.yml` 13,007B｜mtime `2026-11-16 12:00:00`｜MD5 `cb97616487793912bd99ff574aea0eb7`（与重启前同值）；`:294`/`:304` 仍 `session-4f18b03f-94e3-4f01-ab37-23e0f592ca50`；`:314`=`3286c9d7`、`:319`=`c64bc312`；`grep -c '0103a0ac\|66023777\|4f18b03f'`=2（两处均为 `4f18b03f`）。
- 旧 id 已死：`session-4f18b03f-…\session.v4.jsonl.zstd` 3,893,908B，最后写 `11:40:32`，此后不增长。
- 现行 id：`session-6acae4d3-34b1-4a4e-b955-9de8e28caaf0\session.v4.jsonl.zstd` 252,584B，`12:04:24` 仍在写。
- 重启后 `relay.log` **无** workbuddy 两条 watch 的 `resolved` 记录（`rescan#1`–`#3` 该两个目录均 `result=not-found`，其后未再出现该目录的解析行）。

判定：不能记 PASS，也不记 FAIL（无真实投递，无从证伪）。状态=`未证`。
风险：若 `4f18b03f` 确实不可解析，workbuddy 侧两条通道（wakeup-inbox\workbuddy、signals\workbuddy）自 11:40:32 起即断，重启不能修复。

## 5. 首验结论

| 项 | 判定 | 依据 |
|---|---|---|
| 重启发生 | PASS | `relay.log:741` 新启动行 03:57:50.960Z |
| :314 to-owner 通道 | PASS | resolved + 2 次注入 + delivered 2 件 |
| :294/:304 workbuddy | 未证 | 目标 id 仍为 `4f18b03f`（已停写），重启后无 resolved |
| 六条全通 | 不成立 | 五条无 resolved 记录 |

建议（不自行执行，交项目总负责人裁定）：
1. `:294`/`:304` 改到现行 `6acae4d3` 后需再重启一次，并按六条分别列解析结果验收；勿以「to-owner 已投出」替代。
2. 判件一律看 MD5：该文件被按相同内容反复重写（mtime 11:34→11:40→11:45→11:51→12:00），mtime 不作「被改」证据。
3. 静态 id 绑定的结构性问题仍在：12:02 定时任务 target 11:40:32 已自动跟随轮换，relay 配置不跟 ⇒ 每次轮换须人工重绑，建议写成固定动作并入名册。

<!-- DONE -->
