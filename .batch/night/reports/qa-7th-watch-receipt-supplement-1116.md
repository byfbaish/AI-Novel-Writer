执行方：QA
取数件：C:\Users\<用户名>\.dsh\profiles\desktop\dsh-handoff-relay\relay.log / 150,567B / MD5 a069aa895999c9b653bf055cca574222
model=DeepSeek-V4.1-Flash | 倍率=非高峰 5 折 | provider=官方直连

# 第 7 条 watch 件级投达：接收侧回执独立复核（补充件，附于 qa-7th-watch-livecheck-1116.md）

判定：**接收侧回执已取到，原「覆盖缺口·不追」关闭**。结论 PASS 不变。

## 1. 我复核的对象与取数时刻
- 源件：`C:\Users\<用户名>\.dsh\sessions\--C-develop-workspace-dsh-plugins-project--\session-c9ff5961-2f11-4337-a885-3cf826db31b0\session.v4.jsonl.zstd`
- 我 13:50 现读：546,662B｜MD5 `7782d7dabecd2c33bc6b49713ea4b0de`｜mtime 13:17:34 —— 与 developer 报值逐位相同。
- 只读取证：复制出件后离线解压，未跑该会话、未唤醒、未改任何文件。

## 2. 解压与取数方式（工具坑，务必照此做）
`session.v4.jsonl.zstd` 是**多帧拼接**（本件 163 帧）。`zlib.zstdDecompressSync` 只解第一帧，得 223 字节、会误判「没有这件」。
正解：按魔数 `28 B5 2F FD` 切帧后逐帧解。我实测 **frames=163，解压后 1,591,687B / 347 行**，与 developer 的 347 行一致。

## 3. 逐条原文（我亲自 grep 出数，非引用他人）
- `seq 298` `time=1794805698927` → `2026-11-16T05:08:18.927Z`，`type=agent/inbox/spliced`，插入正文首两行 `From: 大肥鱼 · AI writer项目组 | 03205043` / `To: 大肥鱼 · DSH 插件组 | c9ff5961 | 群分身`。
- `seq 299` `05:08:18.928Z` `turn/start` `{"turn": 13}` —— 同一毫秒被叫起。
- `seq 303` `05:08:18.996Z` `user/message`，`source={"kind":"plugin:dsh-handoff-relay"}` —— 来源可机检。
- `seq 307` `05:08:38.239Z` `assistant/message`（turn 13 step 1）→ `seq 308` 同毫秒 `tool/call` `ops_bash cat "…/bridge/to-plugin-group/selftest-7th-watch-1116.md"` → `seq 311` `05:08:51.564Z` `tool/result` 读回内容。

## 4. 判据表（本单五条全中）
| # | 凭据 | 出处 | 结果 |
|---|---|---|---|
| 1 | 出侧注入身份行 | `relay.log:842` `05:08:18.936Z` | ✅ |
| 2 | 出侧去重记账 | `dedupe.json` `at=05:08:18.935Z`、`contentHash=911829c84cf0…` | ✅ |
| 3 | 出侧落地副本 | `delivered\7f7c38b2b656\selftest-7th-watch-1116.md` 345B / `96dcdba1…` | ✅ |
| 4 | 外证（不看 relay） | 源目录只剩 `.gitkeep` | ✅ |
| 5 | **接收侧回执** | 本件 `seq 298/299/303/307/311` | ✅ 本补充件新增 |

## 5. 措辞订正（供名册与台账下一自然版本引用）
- 原句「**无接收侧回执，目标会话归属仅有 relay 自证**」（我 13:44 提出、负责人 13:45 采纳）→ 现改为「**已取到接收侧回执（transcript seq 298/303/307），该句已被后续取证推翻**」。
- 原句保留价值只剩一条，仍需留着：`delivered\` 子目录是 watch 目录 sha1 前 12 位、**不含 session 信息**，所以出侧路径不能证明投给了哪个会话，接收侧必须另取。

## 6. 边界与失效条件
- 本条只对**本单**（`selftest-7th-watch-1116.md` → `c9ff5961`，13:08:18）成立，不外推到其他 watch。
- 判「件级投达」仍按五条：出侧四条缺一记未验；接收侧回执按需取（目标会话 transcript 的 `agent/inbox/spliced` + `user/message` 的 `source.kind=plugin:dsh-handoff-relay`）。
- 引 transcript 行号必须带 `seq`，不带行号——帧数会随会话增长变化（本件已 163 帧）。

<!-- DONE -->
