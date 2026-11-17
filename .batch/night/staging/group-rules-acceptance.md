# 验收证据口径：dsh-group-rules-prompt（群规则改走系统提示词）

- 规格来源：`C:\Users\<用户名>\.dsh\bot\workspace\specs\2026-11-15-group-rules-systemprompt.md`（4,893B / 8AC1BF93A2BECA62E07983710BF08B86 / 75 行 / crlf=0）
- 判定方：QA（群分身）。**改的人不自证**：developer 只交产物与命令，判定与回读由 QA 做。
- 本文件是判据与取证方式的定义，不含结论；结论落独立验收报告。

## 0 取证工具与基线（开工前已实测，非设想）

工具：`.batch/night/tools/qa-session-dump.cjs`（QA 只读，Node v24.20.0）

```bash
node .batch/night/tools/qa-session-dump.cjs "<session.v4.jsonl.zstd>" "<needle 或 ->"
```

能力：DSH 会话落盘 `~/.dsh/sessions/<workspace>/session-<uuid>/session.v4.jsonl.zstd` 是**多帧 zstd**（追加写），单次 `zstdDecompressSync` 只能解第一帧；工具按帧魔数 `28 B5 2F FD` 切段逐帧解，输出每条 `system/message`、`user/message` 的 `seq / role / chars / sha16`，命中 needle 时打印偏移与上下文。

**关键事实：system 段在会话落盘里可独立读到**——`system/message` 记录里 `data.message.content[].text` 就是整段系统提示词。这意味着「群规则进没进系统提示词」不必依赖插件自报，也不用插件 debug dump。

现状基线（`session-9c03a032-1742-4bf2-b59e-02a5848689d3`，本群某成员会话，2026-11-15 23:58 实测）：

| 指标 | 现状值 |
|---|---|
| `system/message` 条数 | 1（整段 37,522 字符，**不含**公告） |
| 含公告的 `user/message` | 6 条以上，公告首句落点 `at=647 / 654 / 665 / 693 / 7755` |
| 群 notice 长度 | 1,504 字符（`state.json` → `rooms[session-4f78136d-…].notice`） |
| 公告内独有块偏移 | `【团队边界·三条底线】`=165、`【投递身份 From/To` =614、`【@ 硬规则`=1108、`【流转件版本纪律】`=1437 |

**判据用词必须避开的一个坑**：群 notice 指针稿与公告共享首句「本群仅一名人类，人类指令最高；…全员立即静默」，指针贴上后这句话仍会出现在 user 段。所以**不能**用这句话判「公告是否消失」，必须用公告独有块 `【团队边界·三条底线】`（或 `【流转件版本纪律】`）。

取群会话 id：`state.json` → `rooms["session-4f78136d-2080-4806-ba83-0e5295209594"].sessions[<botId>]`；会话文件在 `~/.dsh/sessions/--C-Users-~4F2F~4E91~98DE-.dsh-bot-workspace--/session-<id>/session.v4.jsonl.zstd`。

## 1 五条判据（对应规格 §6）

### 判据 1 system 段含群规则，user 段不再有公告全文

```bash
node .batch/night/tools/qa-session-dump.cjs "<群会话>" "群聊规则（AI writer项目组）"   # 期望 system/message has=true
node .batch/night/tools/qa-session-dump.cjs "<群会话>" "【团队边界·三条底线】"          # 期望所有 user/message has=false
```

判定线：两条同时成立才过。只满足 user 段消失、system 段拿不到 → **无法开判**（可能插件未加载）。
注意：`system/message` 现状只有 1 条，若插件生效后仍只有首轮那一条且内容未变，说明系统提示词没有重拼 → 不算过，须追到「哪一次请求带上了群规则」。

### 判据 2 连续两轮 user 消息长度不随轮次增长

```bash
node .batch/night/tools/qa-session-dump.cjs "<群会话>" -    # 看同会话最近两条 user/message 的 chars
```

判定线：连发两轮群消息后，第 2 轮的 `user/message` 里不含公告独有块，且其 `chars` 相比第 1 轮不出现 ≈1.5K 的阶梯增长。基线对照：现状每轮 user 里都带 1,504 字符公告副本。
env 归因：两轮之间若会话被换段（出现 `[Handoff · part N]`），本轮样本作废，重取。

### 判据 3 同一 Bot 私聊会话不含群规则

```bash
node .batch/night/tools/qa-session-dump.cjs "<该 bot 私聊会话>" "群聊规则（AI writer项目组）"
```

判定线：`system/message` 与 `user/message` 全部 `has=false`。
取证要点：私聊会话 id 不能从 `rooms[].sessions` 取；由 developer 给出该 bot 私聊会话的实际落盘路径，QA 只读。若给不出路径 → 无法开判。

### 判据 4 规则文件改动后下一轮自动生效

探针：在 `docs/GROUP-RULES.md` 末尾追加一行 `QA-PROBE-1116`，发一轮群消息，然后：

```bash
node .batch/night/tools/qa-session-dump.cjs "<群会话>" "QA-PROBE-1116"
```

判定线：新一轮的 system 段 `has=true`；恢复文件后下一轮 `has=false`。探针改动由 developer 或 QA 均可，但**改的人和判的人不能是同一个**；QA 判时应自己恢复并核对文件哈希回到原值（`git diff --stat docs/GROUP-RULES.md` 为空）。

### 判据 5 禁用/卸载即回滚

```bash
node .batch/night/tools/qa-session-dump.cjs "<群会话>" "【团队边界·三条底线】"   # 期望 user/message has=true 重新出现
node .batch/night/tools/qa-session-dump.cjs "<群会话>" "群聊规则（AI writer项目组）" # 期望 system/message has=false
```

判定线：两条同时成立；且 `cordis.patch.yml` 里该插件条目关闭后**没有残留注入**（system 段不再增长 ≈1,504 字符的规则块）。
前提：回滚验证需要宿主重启一次，重启属主人或负责人授权范围，QA 不自行重启。

## 2 判定线与不可判情形

- 五条全过才 PASS；任何一条只能拿到自我报告（截图、口头、插件日志）→ 判「**无法开判**」，不判通过、也不判打回。
- 环境失败（插件未装进副本 profile、宿主未重启、路径写错）→ 判「无法开判」，报告须写明失败证据与谁的责任面。
- 群 notice 指针归主人贴：指针未贴**不算失败**，但报告必须写明验收当时 notice 是 1,504 字原状还是已缩成指针——两种情况判据 1/2 的期望值不同（指针在 → user 段仍会有那句共享首句，属正常）。
- 一切数字以 QA 实跑输出为准，不采信 developer 自报值；其自报值只用于对账。

## 3 报告口径

验收报告落 `.batch/night/staging/group-rules-acceptance-report.md`，五条判据各给：命令原文、关键输出行（含 `chars / sha16 / has`）、PASS/FAIL/无法开判 + 一句理由。
